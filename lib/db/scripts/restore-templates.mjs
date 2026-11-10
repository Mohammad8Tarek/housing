import pg from 'pg';

async function restoreTemplates() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin123@localhost:5432/staff-housing';
  const pool = new pg.Pool({ connectionString });
  
  const tables = [
    "buildings", "floors", "rooms", "employees", "employee_portal_accounts",
    "assignments", "maintenance", "reservations", "activity_logs", "settings",
    "hostings", "hosting_companions", "lookup_values"
  ];

  try {
    console.log("Restoring template tables in public schema...");
    for (const table of tables) {
      const backupName = `${table}_backup_migrated`;
      console.log(`Checking ${backupName}...`);
      
      const check = await pool.query("SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = $1", [backupName]);
      
      if (check.rows.length > 0) {
        // If the original table exists, drop it first (it might be half-broken)
        await pool.query(`DROP TABLE IF EXISTS public.${table} CASCADE`);
        // Rename backup to original
        await pool.query(`ALTER TABLE public.${backupName} RENAME TO ${table}`);
        // Truncate to make it a clean template
        await pool.query(`TRUNCATE TABLE public.${table} CASCADE`);
        console.log(`✅ Restored public.${table} from backup and truncated.`);
      } else {
        console.warn(`⚠️ Backup table ${backupName} not found.`);
      }
    }
  } catch (err) {
    console.error("❌ Restore failed:", err);
  } finally {
    await pool.end();
  }
}

restoreTemplates();
