import { Client } from "pg";

async function run() {
  const remote = new Client(
    "postgresql://neondb_owner:npg_B0kqYF6HbMEv@ep-sweet-star-ax4bqt1q-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  );
  await remote.connect();

  const res = await remote.query(
    "SELECT column_name, data_type FROM information_schema.columns WHERE table_schema = 'prop_1' AND table_name = 'employees'",
  );
  console.log("Employees columns in prop_1:");
  console.table(res.rows);

  await remote.end();
}

run().catch(console.error);
