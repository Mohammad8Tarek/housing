const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    const res = await c.query("SELECT employee_id, first_name, national_id, date_of_birth FROM employees LIMIT 5");
    console.log("Employees:", res.rows);
    const res2 = await c.query("SELECT e.employee_id, a.room_id, a.status FROM assignments a JOIN employees e ON a.employee_id = e.id LIMIT 5");
    console.log("Assignments:", res2.rows);
  } catch (err) {
    console.error(err);
  } finally {
    c.end();
  }
});
