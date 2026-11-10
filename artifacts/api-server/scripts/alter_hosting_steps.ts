import { pool } from "@workspace/db";

async function alterDB() {
  try {
    await pool.query(
      "ALTER TABLE public.hosting_request_approval_steps ALTER COLUMN signature_image_url_snapshot TYPE text",
    );
    console.log("Successfully altered hosting_request_approval_steps table.");
  } catch (error) {
    console.error("Error altering DB:", error);
  } finally {
    process.exit(0);
  }
}

alterDB();
