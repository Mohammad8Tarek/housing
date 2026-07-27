import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';
import { sql, eq } from 'drizzle-orm';
import { pgTable, text, serial, integer, timestamp, boolean } from 'drizzle-orm/pg-core';

export const employeePortalAccountsTable = pgTable("employee_portal_accounts", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

async function run() {
  const pool = new Pool({
    connectionString: 'postgresql://neondb_owner:npg_B0kqYF6HbMEv@ep-sweet-star-ax4bqt1q-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require'
  });
  pool.on('connect', c => c.query('SET search_path TO public').catch(console.error));
  const db = drizzle(pool);
  
  try {
     // insert without ON CONFLICT
     await pool.query(`INSERT INTO public.employee_portal_accounts (property_id, employee_id, password_hash, must_change_password) VALUES (1, 'EMP002', 'dummy', false)`);
     console.log('Inserted EMP002');
     
     const existing = await db.select().from(employeePortalAccountsTable).where(eq(employeePortalAccountsTable.employeeId, 'EMP002')).limit(1);
     
     console.log("Found:", existing[0].id);
     await db.update(employeePortalAccountsTable)
        .set({
          failedAttempts: sql`${employeePortalAccountsTable.failedAttempts} + 1`,
          lockedUntil: sql`CASE
            WHEN ${employeePortalAccountsTable.failedAttempts} + 1 >= 5
            THEN NOW() + INTERVAL '1 minute' * 15
            ELSE NULL
          END`,
          updatedAt: new Date(),
        })
        .where(eq(employeePortalAccountsTable.id, existing[0].id));
     console.log("Update success");
  } catch (err) {
    console.error('Failed:', err);
  }
  
  await pool.end();
}

run().catch(console.error);
