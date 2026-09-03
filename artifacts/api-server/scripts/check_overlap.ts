import { pool } from "@workspace/db";

async function run() {
  const client = await pool.connect();
  const schemasRes = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'`);
  const schemas = schemasRes.rows.map(r => r.schema_name);

  for (const schema of schemas) {
    const t = await client.query(`SELECT table_name FROM information_schema.tables WHERE table_schema = $1 AND table_name IN ('employees', 'profiles', 'employee_portal_accounts', 'profile_portal_accounts')`, [schema]);
    const names = t.rows.map(r => r.table_name);
    if (names.length > 0) {
      console.log(`Schema ${schema}:`, names.join(', '));
      // check row counts
      for (const name of names) {
        const countRes = await client.query(`SELECT count(*) as c FROM "${schema}"."${name}"`);
        console.log(`  - ${name}: ${countRes.rows[0].c} rows`);
      }
    }
  }
  client.release();
  process.exit(0);
}
run();
