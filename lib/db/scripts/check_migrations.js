import { Client } from "pg";

async function run() {
  const client = new Client({
    connectionString:
      process.env.DATABASE_URL ??
      (() => {
        throw new Error("Set DATABASE_URL");
      })(),
  });

  try {
    await client.connect();
    const res = await client.query(
      `SELECT name FROM taal_housing.tenant_migrations WHERE name LIKE '%date_of_birth%'`,
    );
    console.log("Migrations containing 'date_of_birth':", res.rows);
  } catch (err) {
    console.error("Error:", err);
  } finally {
    await client.end();
  }
}

run();
