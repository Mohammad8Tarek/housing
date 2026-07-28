import { pool } from "@workspace/db";

async function check() {
  try {
    const { rows: room } = await pool.query(
      `SELECT * FROM taal_housing.rooms WHERE id = 199`,
    );
    console.log("Room 199:", room);
  } catch (e) {
    console.error(e);
  } finally {
    process.exit(0);
  }
}

check();
