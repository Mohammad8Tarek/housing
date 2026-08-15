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
    const props = ['taal_housing', 'el_waha_new', 'elwaha_old'];
    
    for (const schema of props) {
      console.log(`\n--- Schema: ${schema} ---`);
      await client.query(`SET search_path TO ${schema}, public`);
      
      const queries = [
        "ALTER TABLE employees ADD COLUMN IF NOT EXISTS date_of_birth TEXT DEFAULT '' NOT NULL",
        "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ",
        "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ",
        "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS notes TEXT",
        "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS reported_by TEXT",
        "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS assigned_to INTEGER",
        "ALTER TABLE maintenance ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'maintenance'",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS nationality TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS gender TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS employee_code TEXT NOT NULL DEFAULT ''",
        "ALTER TABLE reservations ADD COLUMN IF NOT EXISTS level TEXT NOT NULL DEFAULT ''",
      ];
      
      for (const q of queries) {
        try {
          await client.query(q);
          console.log(`Success: ${q}`);
        } catch (err) {
          console.error(`Error on ${q}:`, err.message);
        }
      }
    }
  } catch (err) {
    console.error("Connection Error:", err);
  } finally {
    await client.end();
  }
}

run();
