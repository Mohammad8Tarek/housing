const pg = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '.env') });

async function run() {
  const client = new pg.Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  // Check all properties
  const props = await client.query('SELECT id, name, schema_name FROM public.properties');
  console.log('Properties:', props.rows);

  for (const prop of props.rows) {
    const schema = prop.schema_name || `prop_${prop.id}`;
    try {
      const emps = await client.query(`SELECT id, employee_id, first_name, last_name, status FROM ${schema}.employees WHERE employee_id = $1`, ['10575']);
      if (emps.rows.length > 0) {
        console.log(`\nFound employee in ${schema}:`, emps.rows[0]);
        
        // Check portal account
        const accs = await client.query(`SELECT id, employee_id, is_active, must_change_password, failed_attempts FROM ${schema}.employee_portal_accounts WHERE employee_id = $1`, ['10575']);
        console.log(`Portal account in ${schema}:`, accs.rows);
      }
    } catch (e) {
      console.log(`Schema ${schema} error:`, e.message);
    }
  }

  await client.end();
}

run().catch(e => { console.error(e); process.exit(1); });
