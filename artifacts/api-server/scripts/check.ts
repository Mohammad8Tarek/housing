import { pool } from "@workspace/db";

async function check() {
  const r = await pool.query(
    "SELECT data_type FROM information_schema.columns WHERE table_name = 'user_signatures' AND column_name = 'signature_image_url'",
  );
  console.log("DATA TYPE IS: " + r.rows[0].data_type);
  process.exit(0);
}

check();
