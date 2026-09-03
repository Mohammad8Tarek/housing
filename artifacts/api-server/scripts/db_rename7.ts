import { pool } from "@workspace/db";

async function run() {
  console.log("Starting DB renaming part 7 (Final columns)...");
  const client = await pool.connect();

  try {
    const res = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'prop_%' OR schema_name = 'public'`);
    const schemas = res.rows.map(r => r.schema_name);

    for (const schema of schemas) {
      console.log(`Checking schema ${schema}...`);
      await client.query("BEGIN");
      
      try {
        await client.query(`ALTER TABLE IF EXISTS "${schema}".portal_conversation_participants RENAME COLUMN employee_id TO profile_id`);
      } catch(e: any) { }

      try {
        await client.query(`ALTER TABLE IF EXISTS "${schema}".reservations RENAME COLUMN employee_code TO profile_code`);
      } catch(e: any) { }

      try {
        await client.query(`ALTER TABLE IF EXISTS "${schema}".hosting_requests RENAME COLUMN employee_name TO profile_name`);
      } catch(e: any) { }
        
      try {
        await client.query("COMMIT");
      } catch (e) {
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
