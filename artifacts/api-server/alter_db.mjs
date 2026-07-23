import fs from 'fs';
import pg from 'pg';

const envContent = fs.readFileSync('.env', 'utf-8');
const dbUrlMatch = envContent.match(/DATABASE_URL=(.+)/);
const dbUrl = dbUrlMatch ? dbUrlMatch[1].trim() : null;

if (!dbUrl) {
  console.error('DATABASE_URL not found in .env');
  process.exit(1);
}

const pool = new pg.Pool({
  connectionString: dbUrl
});

async function main() {
  try {
    await pool.query('ALTER TABLE public.user_signatures ALTER COLUMN signature_image_url TYPE text;');
    console.log('Successfully altered column type.');
  } catch (err) {
    console.error('Error altering column:', err);
  } finally {
    await pool.end();
  }
}

main();
