import { pool } from "@workspace/db";

async function run() {
  console.log("Starting DB renaming part 6 (employee_rating)...");
  const client = await pool.connect();

  try {
    const res = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'prop_%' OR schema_name = 'public'`);
    const schemas = res.rows.map(r => r.schema_name);

    for (const schema of schemas) {
      console.log(`Checking schema ${schema}...`);
      await client.query("BEGIN");
      try {
        await client.query(`ALTER TABLE IF EXISTS "${schema}".evaluations RENAME COLUMN employee_rating TO profile_rating`);
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
