const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    for (const schema of ['taal_housing', 'elwaha_old', 'el_waha_new']) {
      const res = await c.query(`SELECT employee_id, first_name, national_id, date_of_birth FROM ${schema}.employees WHERE employee_id = '10575'`);
      if (res.rows.length) console.log(`Employee 10575 in ${schema}:`, res.rows);
      
      const res2 = await c.query(`SELECT a.status, r.room_number FROM ${schema}.assignments a JOIN ${schema}.employees e ON a.employee_id = e.id JOIN ${schema}.rooms r ON a.room_id = r.id WHERE e.employee_id = '10575'`);
      if (res2.rows.length) console.log(`Assignments for 10575 in ${schema}:`, res2.rows);
    }
  } catch (err) {
    console.error(err);
  } finally {
    c.end();
  }
});
