const { Client } = require('pg');
const client = new Client('postgresql://postgres:admin123@localhost:5432/postgres');
client.connect()
  .then(() => client.query("SELECT tablename FROM pg_tables WHERE schemaname = 'public';"))
  .then(res => { console.log(res.rows.map(r => r.tablename)); client.end(); });
