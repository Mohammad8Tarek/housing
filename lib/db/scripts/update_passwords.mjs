import pg from "pg";

async function run() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
  await pool.query("UPDATE public.users SET password_hash = '$2b$10$pKDRqihAivsN79.X0SrP.OqFiFmstSsQxN3LgGF78mPs3FohmCDwS' WHERE username LIKE '%manager%'");
  console.log('Passwords updated to 123456');
  await pool.end();
}

run().catch(console.error);
