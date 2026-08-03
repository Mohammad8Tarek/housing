import pg from "pg";
import fs from "fs";
import path from "path";

const { Pool } = pg;

async function migrate() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway"
  });

  const client = await pool.connect();
  try {
    const res = await client.query("SELECT schema_name FROM public.properties WHERE schema_name IS NOT NULL");
    const schemas = res.rows.map(r => r.schema_name);
    schemas.push("public");

    console.log("Schemas to migrate:", schemas);

    for (const schema of schemas) {
      console.log(`\nMigrating schema: ${schema}`);
      try {
        await client.query(`SET search_path TO ${schema}`);
        
        await client.query(`
          CREATE TABLE IF NOT EXISTS "password_reset_tokens" (
            "id" serial PRIMARY KEY NOT NULL,
            "employee_id" text NOT NULL,
            "property_id" integer NOT NULL,
            "token_hash" text NOT NULL,
            "expires_at" timestamp with time zone NOT NULL,
            "used_at" timestamp with time zone,
            "created_at" timestamp with time zone DEFAULT now() NOT NULL
          );
        `);
        console.log("Created password_reset_tokens");

        await client.query(`
          ALTER TABLE "employee_portal_accounts" ADD COLUMN IF NOT EXISTS "reset_failed_attempts" integer DEFAULT 0 NOT NULL;
        `);
        console.log("Added reset_failed_attempts to employee_portal_accounts");

        await client.query(`
          ALTER TABLE "employee_portal_accounts" ADD COLUMN IF NOT EXISTS "reset_locked_until" timestamp with time zone;
        `);
        console.log("Added reset_locked_until to employee_portal_accounts");

        // Note: family_visit_requests might only exist in public or some schemas, so use IF EXISTS if possible, but PG ALTER TABLE doesn't have IF EXISTS for the table itself natively without a DO block, so we'll wrap in try/catch.
        try {
          await client.query(`
            ALTER TABLE "family_visit_requests" ADD COLUMN IF NOT EXISTS "attachment_data" text;
          `);
          console.log("Added attachment_data to family_visit_requests");
        } catch (e) {
          // Table might not exist in this schema, ignore
        }

      } catch (err) {
        console.error(`Error migrating schema ${schema}:`, err.message);
      }
    }
    console.log("Done!");
  } finally {
    client.release();
    await pool.end();
  }
}

migrate().catch(console.error);
