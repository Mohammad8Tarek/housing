import { Client } from 'pg';

async function run() {
  const remote = new Client('postgresql://neondb_owner:npg_B0kqYF6HbMEv@ep-sweet-star-ax4bqt1q-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require');
  await remote.connect();
  
  await remote.query('SET search_path TO public');
  
  const res = await remote.query(`
    SELECT * FROM public.activity_logs ORDER BY created_at DESC LIMIT 10;
  `);
  console.log('Public logs:');
  console.table(res.rows);

  await remote.end();
}

run().catch(console.error);
