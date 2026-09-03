import { pool } from "@workspace/db";

async function run() {
  const client = await pool.connect();
  const res = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = 'public'`);
  console.log("TABLES:", res.rows.map(r => r.table_name));

  const res2 = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name LIKE '%employee%'`);
  console.log("COLUMNS with 'employee':", res2.rows.map(r => r.column_name));

  client.release();
  process.exit(0);
}
run();
