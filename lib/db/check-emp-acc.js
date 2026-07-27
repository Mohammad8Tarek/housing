import { Client } from 'pg';

async function run() {
  const remote = new Client('postgresql://neondb_owner:npg_B0kqYF6HbMEv@ep-sweet-star-ax4bqt1q-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
  await remote.connect();
  
  const res2 = await remote.query("SELECT column_name, data_type, table_schema FROM information_schema.columns WHERE table_name = 'employee_portal_accounts' ORDER BY table_schema, ordinal_position");
  console.log('Employee Portal Accounts columns:');
  console.table(res2.rows);

  await remote.end();
}

run().catch(console.error);
