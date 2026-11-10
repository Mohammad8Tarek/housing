import { Client } from 'pg';

async function run() {
  const client = new Client({ connectionString: process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL"); })() });

  try {
    await client.connect();
    const res = await client.query(`SELECT id, schema_name FROM public.properties`);
    console.log("Properties:", res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
