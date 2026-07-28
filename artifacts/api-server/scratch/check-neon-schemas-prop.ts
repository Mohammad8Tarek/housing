import { pool } from "@workspace/db";

async function check() {
  try {
    const { rows: properties } = await pool.query(
      `SELECT id, name, schema_name FROM public.properties`,
    );
    console.log("Properties:", properties);

    for (const prop of properties) {
      const s = prop.schema_name || `prop_${prop.id}`;

      const { rows: emps } = await pool.query(`
        SELECT id, employee_id, first_name, last_name, status
        FROM ${s}.employees
        WHERE first_name ILIKE '%mohamed%' OR last_name ILIKE '%mohamed%'
      `);

      if (emps.length > 0) {
        console.log(`\nFound in ${s}:`, emps);
        const empIds = emps.map((e) => e.id).join(",");

        const { rows: assignments } = await pool.query(`
          SELECT * FROM ${s}.assignments
          WHERE employee_id IN (${empIds})
        `);
        console.log("Assignments:", assignments);
      }
    }
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
