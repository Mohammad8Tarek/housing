const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    const res = await c.query("SELECT count(*), state FROM pg_stat_activity GROUP BY state");
    console.log("Connections:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    c.end();
  }
});
