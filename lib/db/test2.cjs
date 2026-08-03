const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    const r = await c.query('SELECT id, employee_id, password_changed_at, is_active FROM taal_housing.employee_portal_accounts WHERE employee_id = $1 ORDER BY id ASC', ['10575']);
    console.log(r.rows);
  } catch (e) {
    console.log('Error:', e.message);
  }
  c.end();
});
