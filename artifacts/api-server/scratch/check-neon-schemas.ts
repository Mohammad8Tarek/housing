import { pool } from '@workspace/db';

async function check() {
  try {
    const { rows: schemas } = await pool.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name LIKE 'property_%'
    `);
    console.log("Schemas:", schemas.map(s => s.schema_name));
    
    for (const schema of schemas) {
      const s = schema.schema_name;
      const { rows: emps } = await pool.query(`
        SELECT id, employee_id, first_name, last_name, status
        FROM ${s}.employees
        WHERE first_name ILIKE '%mohamed%' OR last_name ILIKE '%mohamed%'
      `);
      
      if (emps.length > 0) {
        console.log(`\nFound in ${s}:`, emps);
        const empIds = emps.map(e => e.id).join(',');
        
        const { rows: assignments } = await pool.query(`
          SELECT * FROM ${s}.assignments
          WHERE employee_id IN (${empIds})
        `);
        console.log("Assignments:", assignments);
      }
    }
    
  } catch(e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
