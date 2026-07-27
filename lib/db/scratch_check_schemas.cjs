const { Client } = require('pg');
const client = new Client('postgresql://postgres:admin123@localhost:5432/staff-housing');
client.connect()
  .then(() => client.query("SELECT schema_name FROM information_schema.schemata;"))
  .then(res => { console.log(res.rows.map(r => r.schema_name)); client.end(); })
  .catch(console.error);
