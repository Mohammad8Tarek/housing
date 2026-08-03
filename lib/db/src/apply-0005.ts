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

    console.log("Schemas to migrate for date_of_birth:", schemas);

    for (const schema of schemas) {
      console.log(`\nMigrating schema: ${schema}`);
      try {
        await client.query(`SET search_path TO ${schema}`);
        
        await client.query(`
          ALTER TABLE "employees" ADD COLUMN IF NOT EXISTS "date_of_birth" text DEFAULT '' NOT NULL;
        `);
        console.log("Added date_of_birth to employees in", schema);
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
