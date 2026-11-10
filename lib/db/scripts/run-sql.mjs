import fs from 'fs';
import pg from 'pg';
import path from 'path';

async function runMigration() {
  const connectionString = process.env.DATABASE_URL || 'postgresql://postgres:admin123@localhost:5432/staff-housing';
  const pool = new pg.Pool({ connectionString });
  
  try {
    const sqlPath = path.resolve(process.cwd(), 'src/migrations/fix_users_schema_and_add_indexes.sql');
    console.log('Reading SQL file from:', sqlPath);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    
    console.log('Connecting to Database...');
    await pool.query(sql);
    console.log('✅ Database updated successfully!');
  } catch (err) {
    console.error('❌ Migration failed:', err.message);
  } finally {
    await pool.end();
  }
}

runMigration();
