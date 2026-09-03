import { pool } from "@workspace/db";

async function run() {
  console.log("Starting DB renaming (Employee -> Profile)...");
  const client = await pool.connect();

  try {
    const res = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'prop_%' OR schema_name = 'public'`);
    const schemas = res.rows.map(r => r.schema_name);
    console.log(`Found ${schemas.length} schemas: ${schemas.join(', ')}`);

    for (const schema of schemas) {
      console.log(`Renaming in schema ${schema}...`);
      await client.query("BEGIN");
      try {
        // 1. Rename table employees -> profiles
        await client.query(`ALTER TABLE IF EXISTS "${schema}".employees RENAME TO profiles`);
        
        // 2. Rename columns in profiles
        await client.query(`ALTER TABLE IF EXISTS "${schema}".profiles RENAME COLUMN employee_id TO profile_id`);

        // 3. Rename columns in other tables
        const tablesWithEmployeeId = [
          'activity_registrations', 'assignments', 'evaluations', 'hostings',
          'portal_conv_participants', 'portal_message_reads', 'portal_feedback',
          'portal_comments', 'portal_feedback_votes', 'portal_meal_orders',
          'portal_transport_bookings', 'portal_notification_reads',
          'portal_push_subscriptions', 'room_keys', 'survey_responses',
          'portal_accounts', 'portal_reset_tokens'
        ];

        for (const table of tablesWithEmployeeId) {
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
