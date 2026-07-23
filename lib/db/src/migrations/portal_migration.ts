/**
 * lib/db/src/migrations/portal_migration.ts — ESM-safe version
 * Run: DATABASE_URL="..." npx tsx src/migrations/portal_migration.ts
 */
import { readFileSync, existsSync } from "node:fs";
import { randomBytes } from "node:crypto";
import { resolve, dirname }         from "node:path";
import { fileURLToPath }            from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname  = dirname(__filename);
function loadEnv(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p,"utf-8").split("\n")) {
    const t = line.trim(); if (!t||t.startsWith("#")) continue;
    const eq = t.indexOf("="); if (eq===-1) continue;
    const k = t.slice(0,eq).trim(), v = t.slice(eq+1).trim().replace(/^["']|["']$/g,"");
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(resolve(__dirname,"..","..","..","..","artifacts","api-server",".env"));
loadEnv(resolve(__dirname,"..","..","..","..","..","artifacts","api-server",".env"));
import pg from "pg"; import bcrypt from "bcryptjs";
const { Pool } = pg;
const DB = process.env["DATABASE_URL"];
if (!DB) { console.error("❌ DATABASE_URL not set"); process.exit(1); }
const pool = new Pool({ connectionString: DB });
function temporaryPassword() {
  return process.env["DEFAULT_EMPLOYEE_PORTAL_PASSWORD"] || "1234";
}
async function run() {
  const client = await pool.connect();
  console.log("✅ Connected");
  try {
    await client.query("BEGIN");
    await client.query(`
      CREATE TABLE IF NOT EXISTS employee_portal_accounts (
        id SERIAL PRIMARY KEY,
        property_id INTEGER NOT NULL REFERENCES properties(id) ON DELETE CASCADE,
        employee_id TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        must_change_password BOOLEAN NOT NULL DEFAULT TRUE,
        is_active BOOLEAN NOT NULL DEFAULT TRUE,
        failed_attempts INTEGER NOT NULL DEFAULT 0,
        locked_until TIMESTAMPTZ,
        last_login_at TIMESTAMPTZ,
        password_changed_at TIMESTAMPTZ,
        created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
        updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
      )`);
    await client.query(`
      CREATE UNIQUE INDEX IF NOT EXISTS idx_portal_emp
        ON employee_portal_accounts(property_id, employee_id)`);
    const { rows: emps } = await client.query(
      `SELECT property_id, employee_id, first_name, last_name FROM employees`);
    console.log(`Found ${emps.length} employees`);
    let created=0, skipped=0;
    for (const e of emps) {
      const { rows: ex } = await client.query(
        `SELECT id FROM employee_portal_accounts WHERE property_id=$1 AND employee_id=$2`,
        [e.property_id, e.employee_id]);
      if (ex.length) { skipped++; continue; }
      const password = temporaryPassword();
      const hash = await bcrypt.hash(password, 12);
      await client.query(
        `INSERT INTO employee_portal_accounts(property_id,employee_id,password_hash,must_change_password)
         VALUES($1,$2,$3,TRUE)`,
        [e.property_id, e.employee_id, hash]);
      console.log(`  + ${e.first_name} ${e.last_name} (${e.employee_id}) temporary password: ${password}`);
      created++;
    }
    await client.query("COMMIT");
    console.log(`\n✅ Done — created:${created}  skipped:${skipped}`);
  } catch(err) {
    await client.query("ROLLBACK");
    console.error("❌ Failed:", err); process.exit(1);
  } finally {
    client.release(); await pool.end();
  }
}
run();
