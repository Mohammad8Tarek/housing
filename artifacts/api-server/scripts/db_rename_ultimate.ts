import { pool } from "@workspace/db";

async function run() {
  const client = await pool.connect();
  console.log("Starting ULTIMATE DB renaming (All Schemas, All Objects) - Fixed...");

  try {
    const schemasRes = await client.query(`
      SELECT schema_name FROM information_schema.schemata 
      WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'
    `);
    const schemas = schemasRes.rows.map(r => r.schema_name);

    for (const schema of schemas) {
      console.log(`\nProcessing schema: ${schema}`);
      
      // 1. Rename tables
      const tablesRes = await client.query(`
        SELECT table_name FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name LIKE '%employee%'
      `, [schema]);
      for (const row of tablesRes.rows) {
        const oldName = row.table_name;
        const newName = oldName.replace(/employee/g, 'profile');
        try {
          await client.query(`ALTER TABLE IF EXISTS "${schema}"."${oldName}" RENAME TO "${newName}"`);
          console.log(`  Renamed table ${oldName} to ${newName}`);
        } catch(e: any) { console.log(`  Skipped table ${oldName}: ${e.message}`); }
      }

      // 2. Rename columns
      const colsRes = await client.query(`
        SELECT table_name, column_name FROM information_schema.columns 
        WHERE table_schema = $1 AND column_name LIKE '%employee%'
      `, [schema]);
      for (const row of colsRes.rows) {
        const oldName = row.column_name;
        const newName = oldName.replace(/employee/g, 'profile');
        try {
          await client.query(`ALTER TABLE IF EXISTS "${schema}"."${row.table_name}" RENAME COLUMN "${oldName}" TO "${newName}"`);
          console.log(`  Renamed column ${row.table_name}.${oldName} to ${newName}`);
        } catch(e: any) { console.log(`  Skipped column ${row.table_name}.${oldName}: ${e.message}`); }
      }

      // 3. Rename constraints
      const consRes = await client.query(`
        SELECT conname, relname 
        FROM pg_constraint c
        JOIN pg_class t ON c.conrelid = t.oid
        JOIN pg_namespace n ON n.oid = c.connamespace
        WHERE n.nspname = $1 AND conname LIKE '%employee%'
      `, [schema]);
      for (const row of consRes.rows) {
        const oldName = row.conname;
        const newName = oldName.replace(/employee/g, 'profile');
        try {
          await client.query(`ALTER TABLE IF EXISTS "${schema}"."${row.relname}" RENAME CONSTRAINT "${oldName}" TO "${newName}"`);
          console.log(`  Renamed constraint ${oldName} on ${row.relname} to ${newName}`);
        } catch(e: any) {
          console.log(`  Skipped constraint ${oldName}: ${e.message}`);
        }
      }

      // 4. Rename indexes
      const idxRes = await client.query(`
        SELECT indexname 
        FROM pg_indexes 
        WHERE schemaname = $1 AND indexname LIKE '%employee%'
      `, [schema]);
      for (const row of idxRes.rows) {
        const oldName = row.indexname;
        const newName = oldName.replace(/employee/g, 'profile');
        try {
          await client.query(`ALTER INDEX IF EXISTS "${schema}"."${oldName}" RENAME TO "${newName}"`);
          console.log(`  Renamed index ${oldName} to ${newName}`);
        } catch(e: any) {
          console.log(`  Skipped index ${oldName}: ${e.message}`);
        }
      }

      // 5. Rename sequences
      const seqRes = await client.query(`
        SELECT sequence_name FROM information_schema.sequences 
        WHERE sequence_schema = $1 AND sequence_name LIKE '%employee%'
      `, [schema]);
      for (const row of seqRes.rows) {
        const oldName = row.sequence_name;
        const newName = oldName.replace(/employee/g, 'profile');
        try {
           await client.query(`ALTER SEQUENCE IF EXISTS "${schema}"."${oldName}" RENAME TO "${newName}"`);
           console.log(`  Renamed sequence ${oldName} to ${newName}`);
        } catch(e: any) {
           console.log(`  Skipped sequence ${oldName}: ${e.message}`);
        }
      }
    }
  } finally {
    client.release();
  }
  console.log("Ultimate renaming done.");
  process.exit(0);
}
run();
