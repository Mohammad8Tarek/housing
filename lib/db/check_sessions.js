import { Client } from 'pg';

async function run() {
  const client = new Client({
    host: 'tokaido.proxy.rlwy.net',
    port: 22778,
    database: 'railway',
    user: 'postgres',
    password: 'FnAaKoiLFczmGZdCBIUwAJTHnDNHXFbV'
  });

  try {
    await client.connect();
    const res = await client.query(`SELECT COUNT(*) FROM public.user_sessions`);
    console.log("user_sessions count:", res.rows[0].count);
    const res2 = await client.query(`SELECT sid, expire FROM public.user_sessions LIMIT 5`);
    console.log("Sessions:", res2.rows);
  } catch (err) {
    console.error("Error:", err.message);
  } finally {
    await client.end();
  }
}

run();
