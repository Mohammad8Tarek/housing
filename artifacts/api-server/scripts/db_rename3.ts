import { pool } from "@workspace/db";

async function run() {
  console.log("Starting DB renaming part 3 (Employee Portal Accounts)...");
  const client = await pool.connect();

  try {
    const res = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'prop_%' OR schema_name = 'public'`);
    const schemas = res.rows.map(r => r.schema_name);

    for (const schema of schemas) {
      console.log(`Checking schema ${schema}...`);
      await client.query("BEGIN");
      try {
        await client.query(`ALTER TABLE IF EXISTS "${schema}".employee_portal_accounts RENAME TO profile_portal_accounts`);
        await client.query(`ALTER TABLE IF EXISTS "${schema}".profile_portal_accounts RENAME COLUMN employee_id TO profile_id`);
        
        await client.query(`ALTER TABLE IF EXISTS "${schema}".password_reset_tokens RENAME COLUMN employee_id TO profile_id`);
        
        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`Error in schema ${schema}:`, e);
      }
    }

    console.log("DB renaming complete.");
  } catch (e) {
    console.error("Fatal Error:", e);
  } finally {
    client.release();
    process.exit(0);
  }
}

run();
