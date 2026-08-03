const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    for (const schema of ['public', 'taal_housing', 'elwaha_old', 'el_waha_new']) {
      const res = await c.query(`SELECT employee_id, first_name, national_id, date_of_birth FROM ${schema}.employees LIMIT 5`);
      console.log(`Employees in ${schema}:`, res.rows);
      const res2 = await c.query(`SELECT e.employee_id, a.room_id, a.status, r.room_number FROM ${schema}.assignments a JOIN ${schema}.employees e ON a.employee_id = e.id JOIN ${schema}.rooms r ON a.room_id = r.id LIMIT 5`);
      console.log(`Assignments in ${schema}:`, res2.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    c.end();
  }
});
