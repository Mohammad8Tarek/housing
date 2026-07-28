import { pool } from "@workspace/db";

async function check() {
  try {
    const { rows: employees } = await pool.query(
      `SELECT id, employee_id, first_name, last_name FROM employees WHERE first_name ILIKE '%mohamed%' OR last_name ILIKE '%mohamed%' LIMIT 5`,
    );
    console.log("Employees:", employees);

    if (employees.length > 0) {
      const empIds = employees.map((e) => e.id).join(",");
      const { rows: assignments } = await pool.query(
        `SELECT id, employee_id, room_id, status FROM assignments WHERE employee_id IN (${empIds})`,
      );
      console.log("Assignments for these employees:", assignments);
    }

    const { rows: allAssignments } = await pool.query(
      `SELECT id, employee_id, room_id, status FROM assignments LIMIT 10`,
    );
    console.log("First 10 assignments overall:", allAssignments);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
