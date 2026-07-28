async function run() {
  const { pool } = await import("./src/index.js");
  const res = await pool.query("SELECT count(*) FROM public.rooms");
  console.log("Total rooms:", res.rows[0].count);
  process.exit(0);
}
run();
