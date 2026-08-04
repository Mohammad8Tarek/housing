const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    const res = await c.query("SELECT b.id, b.name FROM buildings b");
    console.log('All buildings in Railway DB:');
    console.table(res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    c.end();
  }
});
