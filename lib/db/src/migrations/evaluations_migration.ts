/**
 * lib/db/src/migrations/evaluations_migration.ts
 * Run: DATABASE_URL="..." npx tsx src/migrations/evaluations_migration.ts
 *
 * Changes:
 * 1. Make employee_id nullable (allow property-wide evaluations)
 * 2. Drop FK constraint on employee_id
 * 3. Add titleAr, titleEn, descriptionAr, descriptionEn, department columns
 * 4. Make rating nullable (admin doesn't have to set a rating)
 * 5. Add employeeRating column (employee's rating response)
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

function loadEnv(p: string) {
  if (!existsSync(p)) return;
  for (const line of readFileSync(p, "utf-8").split("\n")) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const eq = t.indexOf("=");
    if (eq === -1) continue;
    const k = t.slice(0, eq).trim();
    const v = t
      .slice(eq + 1)
      .trim()
      .replace(/^["']|["']$/g, "");
    if (!(k in process.env)) process.env[k] = v;
  }
}
loadEnv(
  resolve(__dirname, "..", "..", "..", "..", "artifacts", "api-server", ".env"),
);
loadEnv(
  resolve(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "artifacts",
    "api-server",
    ".env",
  ),
);

import pg from "pg";
const { Pool } = pg;

const DB = process.env["DATABASE_URL"];
if (!DB) {
  console.error("❌ DATABASE_URL not set");
  process.exit(1);
}

const pool = new Pool({ connectionString: DB });

async function run() {
  const client = await pool.connect();
  console.log("✅ Connected");
  try {
    await client.query("BEGIN");

    // Drop the FK constraint if it exists
    await client.query(`
      ALTER TABLE evaluations
      DROP CONSTRAINT IF EXISTS evaluations_employee_id_employees_id_fk
    `);
    console.log("  ✓ Dropped FK constraint");

    // Make employee_id nullable
    await client.query(`
      ALTER TABLE evaluations
      ALTER COLUMN employee_id DROP NOT NULL
    `);
    console.log("  ✓ Made employee_id nullable");

    // Make rating nullable
    await client.query(`
      ALTER TABLE evaluations
      ALTER COLUMN rating DROP NOT NULL
    `);
    console.log("  ✓ Made rating nullable");

    // Add titleAr column
    await client.query(`
      ALTER TABLE evaluations
      ADD COLUMN IF NOT EXISTS title_ar TEXT
    `);
    console.log("  ✓ Added title_ar");

    // Add titleEn column
    await client.query(`
      ALTER TABLE evaluations
      ADD COLUMN IF NOT EXISTS title_en TEXT
    `);
    console.log("  ✓ Added title_en");

    // Add descriptionAr column
    await client.query(`
      ALTER TABLE evaluations
      ADD COLUMN IF NOT EXISTS description_ar TEXT
    `);
    console.log("  ✓ Added description_ar");

    // Add descriptionEn column
    await client.query(`
      ALTER TABLE evaluations
      ADD COLUMN IF NOT EXISTS description_en TEXT
    `);
    console.log("  ✓ Added description_en");

    // Add department column
    await client.query(`
      ALTER TABLE evaluations
      ADD COLUMN IF NOT EXISTS department TEXT
    `);
    console.log("  ✓ Added department");

    // Add employeeRating column
    await client.query(`
      ALTER TABLE evaluations
      ADD COLUMN IF NOT EXISTS employee_rating REAL
    `);
    console.log("  ✓ Added employee_rating");

    await client.query("COMMIT");
    console.log("\n✅ Migration completed successfully");
  } catch (err) {
    await client.query("ROLLBACK");
    console.error("❌ Migration failed:", err);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
