import { pool } from "./index.js";

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("Running migrations to add new columns...");
    await client.query("ALTER TABLE activities ADD COLUMN IF NOT EXISTS is_published boolean DEFAULT false NOT NULL;");
    await client.query("ALTER TABLE activities ADD COLUMN IF NOT EXISTS target_departments text[] DEFAULT '{}' NOT NULL;");
    await client.query("ALTER TABLE evaluations ADD COLUMN IF NOT EXISTS status text DEFAULT 'pending' NOT NULL;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS department text;");
    await client.query("ALTER TABLE users ADD COLUMN IF NOT EXISTS job_title text;");
    
    // Also apply the propertyId nullable fix for users if it's not already done
    await client.query("ALTER TABLE users ALTER COLUMN property_id DROP NOT NULL;");
    
    // Add email and emergency_contact to employees table in all tenant schemas
    const schemasRes = await client.query('SELECT schema_name FROM public.properties WHERE schema_name IS NOT NULL');
    for (const row of schemasRes.rows) {
      const schemaName = row.schema_name;
      try {
        await client.query(`ALTER TABLE ${schemaName}.employees ADD COLUMN IF NOT EXISTS email text DEFAULT '' NOT NULL;`);
        await client.query(`ALTER TABLE ${schemaName}.employees ADD COLUMN IF NOT EXISTS emergency_contact text DEFAULT '' NOT NULL;`);
        console.log(`Updated employees table in schema: ${schemaName}`);
      } catch (err: any) {
        console.warn(`Could not update employees in ${schemaName}:`, err.message);
      }
    }

    console.log("✅ Migrations applied successfully!");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

runMigration().catch(console.error);
