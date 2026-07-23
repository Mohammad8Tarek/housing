import pg from "pg";

async function run() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

  const res = await pool.query("SELECT id, name, schema_name FROM properties");
  
  for (const row of res.rows) {
    const pId = row.id;
    const schema = row.schema_name;
    console.log(`\nSeeding property: ${row.name} (Schema: ${schema})`);
    
    // 1. Create Building, Floor, Room in Tenant Schema
    try {
      await pool.query(`SET LOCAL search_path TO "${schema}", public`);
      
      const bRes = await pool.query(`INSERT INTO "${schema}".buildings (name, location, capacity) VALUES ('Test Building', 'North', 100) ON CONFLICT DO NOTHING RETURNING id`);
      let bId = bRes.rows.length ? bRes.rows[0].id : (await pool.query(`SELECT id FROM "${schema}".buildings LIMIT 1`)).rows[0].id;
      
      const fRes = await pool.query(`INSERT INTO "${schema}".floors (building_id, floor_number) VALUES ($1, '1') ON CONFLICT DO NOTHING RETURNING id`, [bId]);
      let fId = fRes.rows.length ? fRes.rows[0].id : (await pool.query(`SELECT id FROM "${schema}".floors WHERE building_id = $1 LIMIT 1`, [bId])).rows[0].id;
      
      const rRes = await pool.query(`INSERT INTO "${schema}".rooms (building_id, floor_id, room_number, room_type, capacity) VALUES ($1, $2, '101', 'single', 1) ON CONFLICT DO NOTHING RETURNING id`, [bId, fId]);
      let rId = rRes.rows.length ? rRes.rows[0].id : (await pool.query(`SELECT id FROM "${schema}".rooms WHERE building_id = $1 LIMIT 1`, [bId])).rows[0].id;
      
      // 2. Create Employee
      const eRes = await pool.query(`INSERT INTO "${schema}".employees (employee_id, first_name, last_name, national_id, department, job_title, hire_date) VALUES ('EMP-${pId}-01', 'Test', 'Employee', '123456789', 'Housekeeping', 'Cleaner', '2025-01-01') ON CONFLICT DO NOTHING RETURNING id`);
      let eId = eRes.rows.length ? eRes.rows[0].id : (await pool.query(`SELECT id FROM "${schema}".employees WHERE employee_id = $1 LIMIT 1`, [`EMP-${pId}-01`])).rows[0].id;
      
      // 3. Create Assignment
      await pool.query(`INSERT INTO "${schema}".assignments (employee_id, room_id, check_in_date, status) VALUES ($1, $2, '2025-01-01', 'ACTIVE') ON CONFLICT DO NOTHING`, [eId, rId]);
      
      // 4. Create Users (Housing Manager, HR Manager, Accounts Manager) in public schema
      await pool.query(`SET LOCAL search_path TO public`);
      
      const roles = ['housing_manager', 'hr_manager', 'accounts_manager'];
      for (const role of roles) {
        const username = `${role}_${pId}`;
        const uRes = await pool.query(`SELECT id FROM public.users WHERE username = $1`, [username]);
        if (uRes.rows.length === 0) {
          // Add default password: 'password' (bcrypt hash) -> $2b$10$xyz... we can just use a dummy hash since they can reset it, or we use a known hash. 
          // password: Password123
          const hash = '$2a$10$xWJkK/4d2tG3XQxK5z9C/e.uQY8dI5X.J3.0b5F/7.rFz5v0W5W/a'; 
          await pool.query(
            `INSERT INTO public.users (username, password_hash, email, property_id, roles, job_title, status) VALUES ($1, $2, $3, $4, $5, $6, 'active')`,
            [username, hash, `${username}@test.com`, pId, [role], role.replace('_', ' ').toUpperCase()]
          );
          console.log(`  Created user: ${username} with role: ${role}`);
        } else {
          console.log(`  User ${username} already exists`);
        }
      }
      
    } catch (e) {
      console.error(`  Error in property ${pId}:`, e);
    }
  }

  await pool.end();
  console.log("Done!");
}

run().catch(console.error);
