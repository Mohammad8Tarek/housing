import { pool } from "@workspace/db";

async function run() {
  console.log("Starting DB renaming (Employee -> Profile)...");
  const client = await pool.connect();

  try {
    const res = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name LIKE 'prop_%'`);
    const schemas = res.rows.map(r => r.schema_name);
    console.log(`Found ${schemas.length} property schemas.`);

    for (const schema of schemas) {
      console.log(`Renaming in schema ${schema}...`);
      await client.query("BEGIN");
      try {
        // 1. Rename table employees -> profiles
        await client.query(`ALTER TABLE IF EXISTS "${schema}".employees RENAME TO profiles`);
        
        // 2. Rename columns in profiles
        await client.query(`ALTER TABLE IF EXISTS "${schema}".profiles RENAME COLUMN employee_id TO profile_id`);
        // Note: the regex will rename employee_id to profile_id in the Drizzle schema.

        // 3. Rename columns in other tables
        const tablesWithEmployeeId = [
          'activity_registrations', 'assignments', 'evaluations', 'hostings',
          'portal_conv_participants', 'portal_message_reads', 'portal_feedback',
          'portal_comments', 'portal_feedback_votes', 'portal_meal_orders',
          'portal_transport_bookings', 'portal_notification_reads',
          'portal_push_subscriptions', 'room_keys', 'survey_responses'
        ];

        for (const table of tablesWithEmployeeId) {
          try {
            await client.query(`ALTER TABLE IF EXISTS "${schema}"."${table}" RENAME COLUMN employee_id TO profile_id`);
          } catch(e: any) {
            if (!e.message.includes('does not exist')) {
              console.log(`Skipped column rename in ${table}: ${e.message}`);
            }
          }
        }
        
        // 4. Rename indexes (optional, but good for cleanliness)
        const renameIndex = async (oldName: string, newName: string) => {
           try { await client.query(`ALTER INDEX IF EXISTS "${schema}"."${oldName}" RENAME TO "${newName}"`); } catch(e){}
        };
        await renameIndex('idx_employees_employee_id', 'idx_profiles_profile_id');
        await renameIndex('idx_employees_national_id', 'idx_profiles_national_id');
        await renameIndex('idx_employees_department', 'idx_profiles_department');
        await renameIndex('idx_employees_status', 'idx_profiles_status');
        await renameIndex('idx_employees_phone', 'idx_profiles_phone');
        await renameIndex('idx_assignments_employee_id', 'idx_assignments_profile_id');
        await renameIndex('idx_assignments_employee_status', 'idx_assignments_profile_status');
        await renameIndex('idx_hostings_employee_id', 'idx_hostings_profile_id');
        await renameIndex('idx_evaluations_employee_id', 'idx_evaluations_profile_id');

        await client.query("COMMIT");
      } catch (e) {
        await client.query("ROLLBACK");
        console.error(`Error in schema ${schema}:`, e);
      }
    }

    // Now public schema (portal accounts, etc.)
    console.log("Renaming in schema public...");
    await client.query("BEGIN");
    try {
        await client.query(`ALTER TABLE IF EXISTS public.portal_accounts RENAME COLUMN employee_id TO profile_id`);
        await client.query(`ALTER TABLE IF EXISTS public.portal_reset_tokens RENAME COLUMN employee_id TO profile_id`);
        
        // We also need to rename constraints or indexes if desired.
        try { await client.query(`ALTER INDEX IF EXISTS public.uq_portal_accounts_employee_id RENAME TO uq_portal_accounts_profile_id`); } catch(e){}
        try { await client.query(`ALTER INDEX IF EXISTS public.idx_reset_tokens_employee_id RENAME TO idx_reset_tokens_profile_id`); } catch(e){}
        
        await client.query("COMMIT");
    } catch (e) {
        await client.query("ROLLBACK");
        console.error(`Error in schema public:`, e);
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
