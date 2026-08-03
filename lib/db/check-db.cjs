const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    const res = await c.query("SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'");
    console.log("Tables:", res.rows.map(x => x.table_name));
  } catch (err) {
    console.error(err);
  } finally {
    c.end();
  }
});
