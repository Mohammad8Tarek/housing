import { Router } from "express";
import {
  db,
  propertiesTable,
  usersTable,
  settingsTable,
  pool,
  invalidateSchemaCache,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  CreatePropertyBody,
  UpdatePropertyBody,
  GetPropertyParams,
  UpdatePropertyParams,
  DeletePropertyParams,
  ListPropertiesResponse,
  GetPropertyResponse,
  UpdatePropertyResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { requirePermission, requireAuth } from "../middlewares/permissions.js";
import { su } from "../lib/request-utils.js";

const router: Router = Router();

router.get("/properties", requireAuth, async (req, res): Promise<void> => {
  const authUser = (req as any).authUser;
  const properties = await db
    .select()
    .from(propertiesTable)
    .orderBy(propertiesTable.id);
  const allowed = authUser?.isSystemAdmin
    ? properties
    : properties.filter((p) => (authUser?.propertyIds ?? []).includes(p.id));
  const serialized = allowed.map((p) => ({
    ...p,
    createdAt:
      p.createdAt instanceof Date &&
      typeof p.createdAt.toISOString === "function"
        ? p.createdAt.toISOString()
        : p.createdAt,
  }));
  res.json(ListPropertiesResponse.parse(serialized));
});

router.post(
  "/properties",
  requirePermission("properties", "create"),
  async (req, res): Promise<void> => {
    const parsed = CreatePropertyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { adminUsername, adminPassword, ...propData } = parsed.data as any;

    // توليد اسم السكيما من اسم السكن (مثال: TAAL Housing -> taal_housing)
    let schemaName = propData.name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "_")
      .replace(/^_+|_+$/g, "");

    if (!schemaName || !/^[a-z][a-z0-9_]*$/.test(schemaName))
      schemaName = `prop_${Date.now()}`;

    const [property] = await db
      .insert(propertiesTable)
      .values({ ...propData, schemaName })
      .returning();

    // ====== 🏗️ إنشاء السكيما والجداول بشكل أوتوماتيكي للسكن الجديد ======
    const TENANT_TABLES = [
      "buildings",
      "floors",
      "rooms",
      "employees",
      "employee_portal_accounts",
      "assignments",
      "maintenance",
      "reservations",
      "activity_logs",
      "settings",
      "hostings",
      "hosting_companions",
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
    ];

    // Tables that need property_id column (smart lock + push subscription tables)
    const TABLES_WITH_PROPERTY_ID = new Set([
      "room_locks",
      "room_keys",
      "key_audit_log",
      "push_subscriptions",
    ]);

    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA IF NOT EXISTS "${schemaName}"`);

      for (const table of TENANT_TABLES) {
        await client.query(
          `CREATE TABLE IF NOT EXISTS "${schemaName}".${table} (LIKE public.${table} INCLUDING ALL)`,
        );

        // Only drop property_id for tables that don't need it
        if (!TABLES_WITH_PROPERTY_ID.has(table)) {
          await client.query(
            `ALTER TABLE "${schemaName}".${table} DROP COLUMN IF EXISTS property_id`,
          );
        }

        // Fix sequences
        const seqRes = await client.query(
          `SELECT pg_get_serial_sequence('public.${table}', 'id') as seq`,
        );
        if (seqRes.rows[0]?.seq) {
          await client
            .query(
              `SELECT setval(pg_get_serial_sequence('"${schemaName}".${table}', 'id'), 1, false)`,
            )
            .catch((err: any) =>
              console.warn(
                `[Properties] Sequence reset skipped for ${table}: ${err.message}`,
              ),
            );
        }
      }
      await client.query("COMMIT");
    } catch (err) {
      await client
        .query("ROLLBACK")
        .catch((rollbackErr: any) =>
          console.warn("[Properties] ROLLBACK failed:", rollbackErr.message),
        );
      console.error("Error creating tenant schema:", err);
    } finally {
      client.release();
    }
    // =================================================================

    // Create default admin user for property
    if (adminUsername && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db.insert(usersTable).values({
        propertyId: property.id,
        username: adminUsername,
        passwordHash,
        roles: ["admin"],
        permissions: [],
        status: "active",
      });
    }

    // Create default settings (inside the new schema)
    try {
      await pool.query(
        `
      INSERT INTO "${schemaName}".settings (company_name, primary_color, default_language)
      VALUES ($1, $2, $3)
    `,
        [property.name, property.primaryColor, property.defaultLanguage],
      );
    } catch (e) {}

    const sp = {
      ...property,
      createdAt:
        property.createdAt instanceof Date &&
        typeof property.createdAt.toISOString === "function"
          ? property.createdAt.toISOString()
          : property.createdAt,
    };
    const s = su(req);
    await logActivity({
      req,
      propertyId: property.id,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إنشاء فرع جديد: ${property.name} (Schema: ${schemaName})`,
      actionType: "CREATE",
      module: "properties",
      entityType: "property",
      entityId: property.id,
    });
    res.status(201).json(GetPropertyResponse.parse(sp));
  },
);

router.get("/properties/:id", requireAuth, async (req, res): Promise<void> => {
  const params = GetPropertyParams.safeParse(req.params);
  if (!params.success) {
    res.status(400).json({ error: params.error.message });
    return;
  }

  const [property] = await db
    .select()
    .from(propertiesTable)
    .where(eq(propertiesTable.id, params.data.id));
  if (!property) {
    res.status(404).json({ error: "Property not found" });
    return;
  }
  const authUser = (req as any).authUser;
  if (
    !authUser?.isSystemAdmin &&
    !(authUser?.propertyIds ?? []).includes(property.id)
  ) {
    res.status(403).json({ error: "Access denied to this property" });
    return;
  }

  const s = {
    ...property,
    createdAt:
      property.createdAt instanceof Date &&
      typeof property.createdAt.toISOString === "function"
        ? property.createdAt.toISOString()
        : property.createdAt,
  };
  res.json(GetPropertyResponse.parse(s));
});

router.patch(
  "/properties/:id",
  requirePermission("properties", "edit"),
  async (req, res): Promise<void> => {
    const params = UpdatePropertyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdatePropertyBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { adminUsername, adminPassword, ...propData } = parsed.data as any;

    const [updated] = await db
      .update(propertiesTable)
      .set(propData as any)
      .where(eq(propertiesTable.id, params.data.id))
      .returning();
    if (!updated) {
      res.status(404).json({ error: "Property not found" });
      return;
    }

    // Invalidate schema cache after property update
    invalidateSchemaCache(params.data.id);

    // If admin credentials provided on edit, create a new user for the property
    if (adminUsername && adminPassword) {
      const passwordHash = await bcrypt.hash(adminPassword, 10);
      await db.insert(usersTable).values({
        propertyId: params.data.id,
        username: adminUsername,
        passwordHash,
        roles: ["admin"],
        permissions: [],
        status: "active",
      });
    }

    const sp2 = {
      ...updated,
      createdAt:
        updated.createdAt instanceof Date &&
        typeof updated.createdAt.toISOString === "function"
          ? updated.createdAt.toISOString()
          : updated.createdAt,
    };
    const s2 = su(req);
    await logActivity({
      req,
      propertyId: updated.id,
      username: s2.username,
      userId: s2.userId,
      userRole: s2.userRole,
      action: `تعديل بيانات الفرع: ${updated.name}`,
      actionType: "UPDATE",
      module: "properties",
      entityType: "property",
      entityId: updated.id,
    });
    res.json(UpdatePropertyResponse.parse(sp2));
  },
);

router.delete(
  "/properties/:id",
  requirePermission("properties", "delete"),
  async (req, res): Promise<void> => {
    const params = DeletePropertyParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [existingProp] = await db
      .select()
      .from(propertiesTable)
      .where(eq(propertiesTable.id, params.data.id));
    await db
      .delete(propertiesTable)
      .where(eq(propertiesTable.id, params.data.id));

    // Invalidate schema cache after property deletion
    invalidateSchemaCache(params.data.id);

    if (existingProp) {
      const s = su(req);
      await logActivity({
        req,
        propertyId: existingProp.id,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف الفرع: ${existingProp.name}`,
        actionType: "DELETE",
        module: "properties",
        entityType: "property",
        entityId: existingProp.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);
  },
);

export default router;
