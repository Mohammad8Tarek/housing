import { Client } from "pg";

async function run() {
  const remote = new Client(
    (process.env.DATABASE_URL ?? (() => { throw new Error("Set DATABASE_URL"); })()),
  );
  await remote.connect();

  await remote.query("SET search_path TO public");

  try {
    await remote.query(`
       INSERT INTO public.employee_portal_accounts (property_id, employee_id, password_hash, must_change_password)
       VALUES (1, 'EMP001', 'dummy', false)
       ON CONFLICT (employee_id) DO NOTHING;
     `);
    console.log("Inserted EMP001 with property_id = 1");
  } catch (e) {
    console.error("Insert failed:", e);
  }

  await remote.end();
}

run().catch(console.error);
