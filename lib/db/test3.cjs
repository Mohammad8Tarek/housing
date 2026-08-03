const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    await c.query('DELETE FROM taal_housing.employee_portal_accounts WHERE employee_id = $1 AND id != $2', ['10575', 10]);
    console.log('Deleted duplicates');
  } catch (e) {
    console.log('Error:', e.message);
  }
  c.end();
});
