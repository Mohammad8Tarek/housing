import { pool } from "@workspace/db";

async function run() {
  console.log("Starting DB renaming part 4 (Remaining columns)...");
  const client = await pool.connect();

  try {
    const res = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'prop_%' OR schema_name = 'public'`);
    const schemas = res.rows.map(r => r.schema_name);

    for (const schema of schemas) {
      console.log(`Checking schema ${schema}...`);
      await client.query("BEGIN");
      try {
        const missedTables = [
          'portal_comment_likes',
          'push_subscriptions',
          'survey_item_responses'
        ];

        for (const table of missedTables) {
          try {
            await client.query(`ALTER TABLE IF EXISTS "${schema}"."${table}" RENAME COLUMN employee_id TO profile_id`);
          } catch(e: any) { }
        }
        
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
