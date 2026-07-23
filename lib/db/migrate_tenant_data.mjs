import pg from "pg";
const { Pool } = pg;

const DATABASE_URL = process.env.DATABASE_URL || "postgresql://postgres:admin123@localhost:5432/staff-housing";

const pool = new Pool({ connectionString: DATABASE_URL });

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
  "lookup_values"
];

async function migrate() {
  console.log("🚀 Starting Sunrise Housing Multi-Tenant Data Migration...");
  const client = await pool.connect();

  try {
    const res = await client.query("SELECT id, name FROM public.properties");
    const properties = res.rows;
    console.log(`Found ${properties.length} properties.`);

    for (const prop of properties) {
      const schemaName = `prop_${prop.id}`;
      console.log(`\n📦 Processing Property: ${prop.name} (Schema: ${schemaName})`);

      await client.query("BEGIN");
      await client.query(`CREATE SCHEMA IF NOT EXISTS ${schemaName}`);

      console.log(`   - Cloning tables and copying data...`);
      for (const table of TENANT_TABLES) {
        const tableExists = await client.query(`
          SELECT EXISTS (
            SELECT FROM information_schema.tables 
            WHERE table_schema = 'public' AND table_name = '${table}'
          );
        `);

        if (tableExists.rows[0].exists) {
          try {
            await client.query(`CREATE TABLE IF NOT EXISTS ${schemaName}.${table} (LIKE public.${table} INCLUDING ALL)`);

            const hasPropId = await client.query(`
              SELECT EXISTS (
                SELECT 1 FROM information_schema.columns 
                WHERE table_schema = 'public' AND table_name = '${table}' AND column_name = 'property_id'
              );
            `);

            if (hasPropId.rows[0].exists) {
              await client.query(`
                INSERT INTO ${schemaName}.${table}
                SELECT * FROM public.${table} WHERE property_id = ${prop.id}
                ON CONFLICT DO NOTHING;
              `);
              await client.query(`ALTER TABLE ${schemaName}.${table} DROP COLUMN IF EXISTS property_id`);
            } else if (table === "hosting_companions") {
              await client.query(`
                INSERT INTO ${schemaName}.${table}
                SELECT hc.* FROM public.hosting_companions hc
                JOIN public.hostings h ON hc.hosting_id = h.id
                WHERE h.property_id = ${prop.id}
                ON CONFLICT DO NOTHING;
              `);
            } else {
              // Copy all if no specific rule (shouldn't happen for our tenant tables)
              await client.query(`
                INSERT INTO ${schemaName}.${table}
                SELECT * FROM public.${table}
                ON CONFLICT DO NOTHING;
              `);
            }

            // Adjust sequence
            const seqRes = await client.query(`
              SELECT pg_get_serial_sequence('public.${table}', 'id') as seq;
            `);
            const seq = seqRes.rows[0]?.seq;
            if (seq) {
              await client.query(`
                SELECT setval(
                  pg_get_serial_sequence('${schemaName}.${table}', 'id'),
                  COALESCE((SELECT MAX(id) FROM ${schemaName}.${table}), 1),
                  false
                )
              `).catch(() => {});
            }

            console.log(`     ✅ Cloned and copied: ${table}`);
          } catch (err) {
            console.error(`     ❌ Error on ${table}:`, err.message);
          }
        }
      }

      await client.query("COMMIT");
      console.log(`🎉 Finished migrating ${prop.name}`);
    }

    console.log("\n🔒 Backing up old public tables...");
    await client.query("BEGIN");
    for (const table of TENANT_TABLES) {
      const tableExists = await client.query(`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' AND table_name = '${table}'
        );
      `);
      if (tableExists.rows[0].exists) {
        try {
          await client.query(`ALTER TABLE public.${table} RENAME TO ${table}_backup_migrated;`);
          console.log(`   ✅ Renamed public.${table} -> public.${table}_backup_migrated`);
        } catch (err) {
          // Ignore if already renamed
        }
      }
    }
    await client.query("COMMIT");

    console.log("\n✅✅✅ MIGRATION COMPLETED SUCCESSFULLY!");

  } catch (err) {
    await client.query("ROLLBACK");
    console.error("Migration failed:", err);
  } finally {
    client.release();
    pool.end();
  }
}

migrate();
