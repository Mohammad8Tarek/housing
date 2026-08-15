import { Client } from 'pg';

async function run() {
  const client = new Client({
    host: 'tokaido.proxy.rlwy.net',
    port: 22778,
    database: 'railway',
    user: 'postgres',
    password: 'FnAaKoiLFczmGZdCBIUwAJTHnDNHXFbV'
  });

  try {
    await client.connect();
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'taal_housing' AND table_name = 'employees'
    `);
    
    console.log("Columns in taal_housing.employees:");
    const cols = res.rows.map(r => r.column_name);
    console.log(cols.join(', '));
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
