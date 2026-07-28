import { pool } from "@workspace/db";

async function run() {
  try {
    const res = await pool.query(
      "SELECT table_schema, table_name, column_name, data_type FROM information_schema.columns WHERE column_name LIKE '%signature%'",
    );
    console.table(res.rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    process.exit(0);
  }
}

run();
