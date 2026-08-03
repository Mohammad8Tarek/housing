const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway' });
c.connect().then(async () => {
  try {
    const res = await c.query("SELECT b.id, b.name, p.name as property_name FROM buildings b JOIN properties p ON b.property_id = p.id");
    console.log('Found buildings:', res.rows.map(r => r.name + ' (' + r.property_name + ')'));
    const testBuildings = res.rows.filter(r => r.name.toLowerCase().includes('test'));
    for (const b of testBuildings) {
      console.log('Attempting to delete building:', b.name, 'ID:', b.id);
      try {
        await c.query('DELETE FROM buildings WHERE id = $1', [b.id]);
        console.log('Deleted', b.id);
      } catch (err) {
        console.error('FAILED to delete', b.id, err.message);
      }
    }
  } catch (err) {
    console.error(err);
  } finally {
    c.end();
  }
});
