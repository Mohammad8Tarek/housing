const { Pool } = require("pg");
const pool = new Pool({ connectionString: "postgresql://postgres:postgres@localhost:5432/postgres" });
async function run() {
  const res = await pool.query("SELECT id, username, EXISTS(SELECT 1 FROM public.user_signatures us WHERE us.user_id = users.id) as has_signature FROM public.users LIMIT 5");
  console.log(res.rows);
  pool.end();
}
run();
