const { Pool } = require('pg');
const dotenv = require('dotenv');
const path = require('path');

dotenv.config({ path: path.resolve(__dirname, '../../.env') });

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  
  // Check all properties
  const props = await pool.query('SELECT id, name, schema_name FROM public.properties');
  console.log('Properties:', props.rows);

  for (const prop of props.rows) {
    const schema = prop.schema_name || `prop_${prop.id}`;
    try {
      const emps = await pool.query(`SELECT id, employee_id, first_name, last_name, status FROM ${schema}.employees WHERE employee_id = $1`, ['10575']);
      if (emps.rows.length > 0) {
        console.log(`\nFound employee in ${schema}:`, emps.rows[0]);
        
        // Check portal account
        try {
           const accs = await pool.query(`SELECT id, employee_id, is_active, must_change_password, failed_attempts FROM ${schema}.employee_portal_accounts WHERE employee_id = $1`, ['10575']);
           console.log(`Portal account in ${schema}:`, accs.rows);
        } catch (e) {
           console.log(`Portal account table missing in ${schema}`);
        }
      }
    } catch (e) {
      console.log(`Schema ${schema} error:`, e.message);
    }
  }

  await pool.end();
}

run().catch(e => { console.error(e); process.exit(1); });
