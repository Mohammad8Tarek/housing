/**
 * Migration runner: applies public + tenant migrations at startup and
 * provisions new tenant schemas. The migration lists live in
 * ./public-migrations.ts and ./tenant-migrations.ts.
 */
import { pool } from "@workspace/db";
import { MIGRATIONS } from "./public-migrations.js";
import { TENANT_MIGRATIONS } from "./tenant-migrations.js";

export { MIGRATIONS, TENANT_MIGRATIONS };
export type { Migration } from "./public-migrations.js";

async function runForAllTenants(query: string): Promise<number> {
  const client = await pool.connect();
  try {
    // Pooled clients may carry a tenant search_path left by a previous raw
    // SET (this function itself used to leak it). Reset first AND qualify
    // the catalog query — otherwise `FROM properties` can resolve to an
    // EMPTY tenant.properties table and every migration silently skips.
    await client.query("SET search_path TO public");
    const { rows: properties } = await client.query(`
      SELECT DISTINCT s_name AS schema_name FROM (
        SELECT schema_name AS s_name FROM public.properties WHERE schema_name IS NOT NULL AND schema_name <> ''
        UNION
        SELECT schema_name AS s_name FROM information_schema.schemata 
        WHERE schema_name NOT IN ('information_schema', 'pg_catalog', 'pg_toast', 'public') 
          AND schema_name NOT LIKE 'pg_%'
      ) t
    `);
    let count = 0;
    for (const prop of properties) {
      try {
        await client.query(`SET search_path TO ${prop.schema_name}, public`);
        await client.query(query);
        count++;
      } catch (err: any) {
        if (
          !err?.message?.includes("already exists") &&
          !err?.message?.includes("duplicate key") &&
          !err?.message?.includes("cannot be dropped")
        ) {
          console.warn(
            `[migrations] tenant ${prop.id} (${prop.schema_name}): ${err?.message}`,
          );
        }
      }
    }
    return count;
  } finally {
    try {
      await client.query("SET search_path TO public");
    } catch {}
    client.release();
  }
}

export async function runMigrations(): Promise<void> {
  console.info("[migrations] Running startup migrations...");
  let ok = 0;
  for (const m of MIGRATIONS) {
    try {
      await pool.query(m.q);
      ok++;
    } catch (err: any) {
      if (
        !err?.message?.includes("already exists") &&
        !err?.message?.includes("duplicate key")
      ) {
        console.warn(`[migrations] ${m.name}: ${err?.message}`);
      }
    }
  }
  console.info(
    `[migrations] Public schema done — ${ok}/${MIGRATIONS.length} applied.`,
  );

  console.info("[migrations] Running tenant schema migrations...");
  let tOk = 0;
  for (const m of TENANT_MIGRATIONS) {
    try {
      const sqlToRun = m.q || (m as any).query;
      const count = await runForAllTenants(sqlToRun);
      tOk += count;
      console.info(`[migrations] ${m.name}: applied to ${count} tenants`);
    } catch (err: any) {
      console.warn(`[migrations] ${m.name}: ${err?.message}`);
    }
  }
  console.info(
    `[migrations] Tenant migrations done — ${tOk} total tenant-applications.`,
  );

  // Sync existing rooms' features into room_inventory across all properties
  try {
    const { syncAllRoomsFeaturesToInventory } = await import("../../routes/room-inventory.js");
    const { rows: props } = await pool.query("SELECT id FROM public.properties");
    for (const p of props) {
      await syncAllRoomsFeaturesToInventory(p.id);
    }
    console.info(`[migrations] Automatic room features inventory sync complete across all tenants.`);
  } catch (e: any) {
    console.warn(`[migrations] room-inventory auto-sync notice:`, e?.message);
  }

  // Auto-heal any orphan cross-property assignments
  try {
    const { healOrphanAssignments } = await import("../cross-property-service.js");
    const healed = await healOrphanAssignments();
    if (healed > 0) {
      console.info(`[migrations] Auto-healed ${healed} orphan cross-property assignments.`);
    }
  } catch (e: any) {
    console.warn(`[migrations] healOrphanAssignments notice:`, e?.message);
  }

  // Backfill Arabic data for profiles and lookups across all schemas
  try {
    const { backfillBilingualProfiles } = await import("../bilingual-backfill.js");
    const { totalUpdatedProfiles, totalUpdatedLookups } = await backfillBilingualProfiles();
    const totalUpdated = (totalUpdatedProfiles || 0) + (totalUpdatedLookups || 0);
    if (totalUpdated > 0) {
      console.info(`[migrations] Backfilled bilingual data for ${totalUpdated} profiles across schemas.`);
    }
  } catch (e: any) {
    console.warn(`[migrations] backfillBilingualProfiles notice:`, e?.message);
  }
}

export async function applyTenantMigrationsToSchema(schemaName: string): Promise<number> {
  const client = await pool.connect();
  let count = 0;
  try {
    await client.query(`SET search_path TO "${schemaName}", public`);
    for (const m of TENANT_MIGRATIONS) {
      try {
        await client.query(m.q || (m as any).query);
        count++;
      } catch (err: any) {
        if (
          !err?.message?.includes("already exists") &&
          !err?.message?.includes("duplicate key") &&
          !err?.message?.includes("cannot be dropped")
        ) {
          console.warn(`[migrations] tenant ${schemaName} (${m.name}): ${err?.message}`);
        }
      }
    }
  } finally {
    try {
      await client.query("SET search_path TO public");
    } catch {}
    client.release();
  }
  return count;
}

export async function provisionTenantSchema(schemaName: string, propertyId: number): Promise<boolean> {
  const TENANT_TABLES = [
    "buildings",
    "floors",
    "rooms",
    "room_beds",
    "profiles",
    "profile_documents",
    "profile_vacations",
    "profile_portal_accounts",
    "assignments",
    "maintenance",
    "reservations",
    "activity_logs",
    "settings",
    "hostings",
    "hosting_companions",
    "hosting_requests",
    "hosting_request_approval_steps",
    "lookup_values",
    "portal_documents",
    "portal_contacts",
    "evaluations",
    "activities",
    "activity_registrations",
    "survey_items",
    "survey_item_responses",
    "portal_notifications",
    "portal_notification_reads",
    "room_locks",
    "room_keys",
    "key_audit_log",
    "push_subscriptions",
    "device_tokens",
    "room_import_history",
    "room_import_templates",
    "password_reset_tokens",
    "room_inventory",
    "portal_feedback",
    "portal_comments",
    "portal_comment_likes",
    "portal_food_menu",
    "portal_meal_orders",
    "portal_transport_schedules",
    "portal_transport_bookings",
    "portal_conversations",
    "portal_conversation_participants",
    "portal_messages",
    "portal_message_reads",
    "workers",
    "gate_logs",
    "property_whatsapp_configs",
    "whatsapp_delivery_logs",
    "whatsapp_outbox_queue",
    "room_import_jobs",
    "ws_sessions",
    "custom_report_templates",
  ];

  const TABLES_WITH_PROPERTY_ID = new Set([
    "room_locks",
    "room_keys",
    "key_audit_log",
    "push_subscriptions",
    "device_tokens",
    "room_import_history",
    "room_import_templates",
    "password_reset_tokens",
    "gate_logs",
    "workers",
    "property_whatsapp_configs",
    "whatsapp_delivery_logs",
    "whatsapp_outbox_queue",
    "ws_sessions",
    "custom_report_templates",
  ]);

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

    for (const table of TENANT_TABLES) {
      const { rows } = await client.query(
        "SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1",
        [table],
      );
      if (rows.length > 0) {
        await client.query(
          `CREATE TABLE IF NOT EXISTS "${schemaName}".${table} (LIKE public.${table} INCLUDING ALL)`,
        );

        if (!TABLES_WITH_PROPERTY_ID.has(table)) {
          await client.query(
            `ALTER TABLE "${schemaName}".${table} DROP COLUMN IF EXISTS property_id`,
          );
        }

        const seqRes = await client.query(
          `SELECT pg_get_serial_sequence('public.${table}', 'id') as seq`,
        );
        if (seqRes.rows[0]?.seq) {
          await client
            .query(
              `SELECT setval(pg_get_serial_sequence('"${schemaName}".${table}', 'id'), 1, false)`,
            )
            .catch(() => {});
        }
      }
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK").catch(() => {});
    console.error(`[Properties] Error provisioning schema "${schemaName}":`, err);
    return false;
  } finally {
    client.release();
  }

  // Apply full tenant migrations to newly provisioned schema
  try {
    const applied = await applyTenantMigrationsToSchema(schemaName);
    console.info(`[Properties] Applied ${applied} tenant migrations to "${schemaName}"`);
  } catch (e: any) {
    console.warn(`[Properties] Tenant migrations warning on "${schemaName}":`, e?.message);
  }

  // Sync rooms inventory
  try {
    const { syncAllRoomsFeaturesToInventory } = await import("../../routes/room-inventory.js");
    await syncAllRoomsFeaturesToInventory(propertyId);
  } catch (e: any) {
    console.warn(`[Properties] syncAllRoomsFeaturesToInventory warning:`, e?.message);
  }

  return true;
}
