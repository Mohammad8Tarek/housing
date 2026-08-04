const { Client } = require('pg');
const conns = [
  'postgresql://postgres:admin123@localhost:5432/staff-housing',
  'postgresql://postgres:postgres@localhost:5432/railway',
  'postgresql://postgres:1234@localhost:5432/sunrise_housing',
  'postgresql://postgres:admin123@localhost:5432/railway'
];
(async () => {
  for (const connectionString of conns) {
    const c = new Client({ connectionString });
    try {
      await c.connect();
      const res = await c.query("SELECT id, name FROM buildings");
      console.log('--- DB:', connectionString, '---');
      console.table(res.rows);
      c.end();
    } catch (e) {
      // ignore
    }
  }
})();
