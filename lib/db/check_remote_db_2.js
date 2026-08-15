import { Client } from 'pg';
import fs from 'fs';

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
      WHERE table_schema = 'prop_1' AND table_name = 'employees'
    `);
    
    fs.writeFileSync('db_cols.json', JSON.stringify(res.rows, null, 2));
    console.log("Saved to db_cols.json");
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
