import { Pool } from "pg";
const pool = new Pool({
  connectionString:
    "postgresql://postgres:admin123@localhost:5432/staff-housing",
});

async function run() {
  await pool.query(
    "ALTER TABLE public.hosting_request_approval_steps ALTER COLUMN signature_image_url_snapshot TYPE text",
  );
  console.log("Done");
  process.exit(0);
}
run().catch(console.error);
