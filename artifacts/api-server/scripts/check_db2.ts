import { pool } from "@workspace/db";

async function run() {
  const client = await pool.connect();
  const res2 = await client.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_schema = 'public' AND column_name LIKE '%employee%'`);
  console.log("COLUMNS with 'employee':", res2.rows);
  client.release();
  process.exit(0);
}
run();
