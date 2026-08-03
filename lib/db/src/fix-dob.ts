import pg from "pg";

const { Pool } = pg;

async function check() {
  const pool = new Pool({
    connectionString: "postgresql://postgres:XUHDbeHeQPxHggeMmxrIlRBQdIIDeTdE@sakura.proxy.rlwy.net:15247/railway"
  });

  const client = await pool.connect();
  try {
    const res = await client.query("SELECT schema_name FROM information_schema.schemata");
    const schemas = res.rows.map(r => r.schema_name).filter(s => !['information_schema', 'pg_catalog', 'pg_toast'].includes(s));
    
    for (const schema of schemas) {
      try {
        const cols = await client.query(`SELECT column_name FROM information_schema.columns WHERE table_schema = $1 AND table_name = 'employees'`, [schema]);
        if (cols.rows.length > 0) {
          const hasDob = cols.rows.some(r => r.column_name === 'date_of_birth');
          console.log(`${schema}.employees: ${hasDob ? 'HAS date_of_birth' : 'MISSING date_of_birth'}`);
          
          if (!hasDob) {
            console.log(`Fixing ${schema}...`);
            await client.query(`ALTER TABLE "${schema}"."employees" ADD COLUMN IF NOT EXISTS "date_of_birth" text DEFAULT '' NOT NULL;`);
            console.log(`Fixed ${schema}`);
          }
        }
      } catch (err) {
      }
    }
    console.log("Done");
  } finally {
    client.release();
    await pool.end();
  }
}

check().catch(console.error);
