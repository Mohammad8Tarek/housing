
import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/sunrise_housing' });
async function run() {
  try {
    const res = await pool.query(\SELECT * FROM buildings WHERE name LIKE '%Building Test%'\);
    console.log('Found:', res.rows);
    if(res.rows.length > 0) {
      for(let b of res.rows) {
        try {
          await pool.query('DELETE FROM buildings WHERE id = ', [b.id]);
          console.log('Deleted', b.id);
        } catch(e) {
          console.error('Error deleting', b.id, e.message);
        }
      }
    }
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();

