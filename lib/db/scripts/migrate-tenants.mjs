import pg from 'pg';

async function migrateAll() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin123@localhost:5432/staff-housing';
  const pool = new pg.Pool({ connectionString });
  
  try {
    // Get all schemas that have a 'lookup_values' table
    const schemas = await pool.query(`
      SELECT table_schema 
      FROM information_schema.tables 
      WHERE table_name = 'lookup_values' 
      AND table_schema NOT IN ('information_schema', 'pg_catalog')
    `);
    
    for (const row of schemas.rows) {
      const schema = row.table_schema;
      console.log(`Migrating schema: ${schema}`);
      
      // lookup_values
      await pool.query(`ALTER TABLE "${schema}".lookup_values ADD COLUMN IF NOT EXISTS disabled boolean NOT NULL DEFAULT false`);
      
      // employee_portal_accounts
      const epaExists = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'employee_portal_accounts'`, [schema]);
      if (epaExists.rows.length) {
        await pool.query(`ALTER TABLE "${schema}".employee_portal_accounts ADD COLUMN IF NOT EXISTS reset_required boolean NOT NULL DEFAULT true`);
      }

      // employees
      const empExists = await pool.query(`SELECT 1 FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'employees'`, [schema]);
      if (empExists.rows.length) {
        await pool.query(`ALTER TABLE "${schema}".employees ADD COLUMN IF NOT EXISTS photo_url text`);
      }
    }
    
    console.log("✅ All applicable schemas updated successfully.");
  } catch (err) {
    console.error("❌ Migration failed:", err);
  } finally {
    await pool.end();
  }
}

migrateAll();
