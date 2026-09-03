import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "./index.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  const client = await pool.connect();
  try {
    console.log("🚀 Running complete database schema & constraints migration...");

    const sqlPath = resolve(__dirname, "migrations", "20260904_complete_schema_and_constraints.sql");
    if (!existsSync(sqlPath)) {
      throw new Error(`Migration SQL file not found at: ${sqlPath}`);
    }

    const sql = readFileSync(sqlPath, "utf-8");
    await client.query(sql);

    console.log("✅ 20260904_complete_schema_and_constraints.sql applied successfully across all schemas!");
  } catch (err: any) {
    console.error("❌ Migration failed:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

runMigration().catch(console.error);
