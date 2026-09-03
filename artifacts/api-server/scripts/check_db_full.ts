import { pool } from "@workspace/db";

async function run() {
  const client = await pool.connect();
  console.log("Checking for ANY remaining 'employee' references in the DB...");

  // 1. Tables
  const tables = await client.query(`SELECT table_name, table_schema FROM information_schema.tables WHERE table_name LIKE '%employee%'`);
  console.log("TABLES:", tables.rows);

  // 2. Columns
  const cols = await client.query(`SELECT table_name, column_name, table_schema FROM information_schema.columns WHERE column_name LIKE '%employee%'`);
  console.log("COLUMNS:", cols.rows);

  // 3. Indexes
  const idxs = await client.query(`SELECT indexname, schemaname FROM pg_indexes WHERE indexname LIKE '%employee%'`);
  console.log("INDEXES:", idxs.rows);

  // 4. Constraints
  const cons = await client.query(`
    SELECT conname, n.nspname as schemaname
    FROM pg_constraint c
    JOIN pg_namespace n ON n.oid = c.connamespace
    WHERE conname LIKE '%employee%'
  `);
  console.log("CONSTRAINTS:", cons.rows);

  // 5. Sequences
  const seqs = await client.query(`SELECT sequence_name, sequence_schema FROM information_schema.sequences WHERE sequence_name LIKE '%employee%'`);
  console.log("SEQUENCES:", seqs.rows);

  client.release();
  process.exit(0);
}
run();
