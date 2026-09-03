import { pool } from "@workspace/db";

async function run() {
  const client = await pool.connect();
  try {
    const schemasRes = await client.query(`SELECT schema_name FROM information_schema.schemata WHERE schema_name NOT LIKE 'pg_%' AND schema_name != 'information_schema'`);
    const schemas = schemasRes.rows.map(r => r.schema_name);

    for (const schema of schemas) {
      console.log(`Creating table in ${schema}...`);
      await client.query(`
        CREATE TABLE IF NOT EXISTS "${schema}"."profile_documents" (
          id SERIAL PRIMARY KEY,
          profile_id INT NOT NULL REFERENCES "${schema}"."profiles"(id) ON DELETE CASCADE,
          file_name TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_data TEXT NOT NULL,
          uploaded_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
        );
      `);
      await client.query(`
        CREATE INDEX IF NOT EXISTS "idx_profile_documents_profile_id" ON "${schema}"."profile_documents"("profile_id");
      `);
    }
    console.log("Done!");
  } finally {
    client.release();
    process.exit(0);
  }
}
run();
