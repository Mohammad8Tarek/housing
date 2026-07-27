import { Client } from 'pg';

async function run() {
  const remote = new Client('postgresql://neondb_owner:npg_B0kqYF6HbMEv@ep-sweet-star-ax4bqt1q-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
  await remote.connect();
  
  const res = await remote.query("SELECT table_schema, table_name FROM information_schema.tables WHERE table_name = 'employees'");
  console.log('Schemas with employees table:');
  console.table(res.rows);

  await remote.end();
}

run().catch(console.error);
