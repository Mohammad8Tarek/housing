import { pool } from './lib/db/src/index.ts';

async function test() {
  await pool.query("INSERT INTO public.user_signatures (user_id, signature_image_url) VALUES (1, 'test') ON CONFLICT DO NOTHING");
  await import('./test-sign.ts');
}
test();
