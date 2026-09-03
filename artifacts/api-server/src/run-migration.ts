import { readFileSync, existsSync } from "node:fs";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { pool } from "@workspace/db";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

async function runMigration() {
  console.log("🚀 Connecting to database to apply complete schema and constraints...");
  const client = await pool.connect();
  try {
    // Possible paths for the migration SQL file
    const potentialPaths = [
      resolve(__dirname, "..", "..", "..", "lib", "db", "src", "migrations", "20260904_complete_schema_and_constraints.sql"),
      resolve(__dirname, "..", "lib", "db", "src", "migrations", "20260904_complete_schema_and_constraints.sql"),
      resolve(process.cwd(), "lib", "db", "src", "migrations", "20260904_complete_schema_and_constraints.sql"),
    ];

    let sqlContent = "";
    for (const p of potentialPaths) {
      if (existsSync(p)) {
        console.log(`📄 Found migration SQL file at: ${p}`);
        sqlContent = readFileSync(p, "utf-8");
        break;
      }
    }

    if (!sqlContent) {
      throw new Error("Could not find 20260904_complete_schema_and_constraints.sql");
    }

    console.log("⚡ Executing SQL migration across public and all tenant schemas...");
    await client.query(sqlContent);
    console.log("✅ 20260904_complete_schema_and_constraints.sql applied successfully!");

    // Verify constraints on reservations
    const resCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'reservations' AND table_schema = 'public'
    `);
    console.log("📋 Verified public.reservations columns:", resCols.rows.map(r => r.column_name).join(", "));

    // Verify constraints on rooms
    const roomCols = await client.query(`
      SELECT column_name, data_type 
      FROM information_schema.columns 
      WHERE table_name = 'rooms' AND table_schema = 'public'
    `);
    console.log("📋 Verified public.rooms columns:", roomCols.rows.map(r => r.column_name).join(", "));

    console.log("🎉 Database schema and constraints updated successfully!");
  } catch (err: any) {
    console.error("❌ Migration error:", err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
    process.exit(0);
  }
}

runMigration().catch(console.error);
