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
    console.log("Connected to remote DB");

    // Check columns in prop_1.employees
    const res = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_schema = 'prop_1' AND table_name = 'employees'
    `);
    
    console.log("Columns in prop_1.employees:");
    for (const row of res.rows) {
      console.log(`- ${row.column_name} (${row.data_type})`);
    }

    // Check if properties table exists and has rows
    const propsRes = await client.query(`SELECT * FROM public.properties`);
    console.log("Properties in DB:");
    console.log(propsRes.rows);

  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
