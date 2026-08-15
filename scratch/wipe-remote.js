import { Pool } from 'pg';

async function run() {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const client = await pool.connect();
  try {
    console.log("Dropping schemas...");
    const res = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'
    `);
    for (const row of res.rows) {
      console.log(`Dropping schema ${row.schema_name} CASCADE...`);
      await client.query(`DROP SCHEMA IF EXISTS "${row.schema_name}" CASCADE`);
      if (row.schema_name === 'public') {
        console.log(`Recreating schema public...`);
        await client.query(`CREATE SCHEMA public`);
      }
    }
    console.log("Database wiped successfully!");
  } catch (e) {
    console.error("Error:", e.message);
  } finally {
    client.release();
    pool.end();
  }
}

run();
