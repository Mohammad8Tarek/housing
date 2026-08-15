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
    await client.query('SET search_path TO taal_housing, public');
    console.log("Running ALTER TABLE...");
    const res = await client.query("ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth TEXT DEFAULT '' NOT NULL");
    console.log("Success:", res);
  } catch (err) {
    console.error("Query Error:", err);
  } finally {
    await client.end();
  }
}

run();
