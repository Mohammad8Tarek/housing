const { Client } = require('pg');
const c = new Client({ connectionString: 'postgresql://postgres:1234@localhost:5432/sunrise_housing' });
c.connect().then(async () => {
  try {
    const res = await c.query("SELECT b.id, b.name, p.name as property_name FROM buildings b JOIN properties p ON b.property_id = p.id");
    console.log('Found buildings in sunrise_housing (1234):', res.rows.map(r => r.name + ' (' + r.property_name + ')'));
  } catch (err) {
    console.error('sunrise_housing (1234):', err.message);
  } finally {
    c.end();
  }
});
const c2 = new Client({ connectionString: 'postgresql://postgres:postgres@localhost:5432/railway' });
c2.connect().then(async () => {
  try {
    const res = await c2.query("SELECT b.id, b.name, p.name as property_name FROM buildings b JOIN properties p ON b.property_id = p.id");
    console.log('Found buildings in railway (postgres):', res.rows.map(r => r.name + ' (' + r.property_name + ')'));
  } catch (err) {
    console.error('railway (postgres):', err.message);
  } finally {
    c2.end();
  }
});
const c3 = new Client({ connectionString: 'postgresql://postgres:admin123@localhost:5432/railway' });
c3.connect().then(async () => {
  try {
    const res = await c3.query("SELECT b.id, b.name, p.name as property_name FROM buildings b JOIN properties p ON b.property_id = p.id");
    console.log('Found buildings in railway (admin123):', res.rows.map(r => r.name + ' (' + r.property_name + ')'));
  } catch (err) {
    console.error('railway (admin123):', err.message);
  } finally {
    c3.end();
  }
});
