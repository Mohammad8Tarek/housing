import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { sql, eq } from "drizzle-orm";
import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";

export const employeePortalAccountsTable = pgTable("employee_portal_accounts", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

async function run() {
  const pool = new Pool({
    connectionString:
      "postgresql://neondb_owner:npg_B0kqYF6HbMEv@ep-sweet-star-ax4bqt1q-pooler.c-4.us-east-2.aws.neon.tech/neondb?sslmode=require&channel_binding=require",
  });

  pool.on("connect", (c) => {
    c.query("SET search_path TO public").catch(console.error);
  });

  const db = drizzle(pool);

  try {
    await db.transaction(async (tx) => {
      await tx.execute(sql`SET LOCAL search_path TO prop_1, public`);
      const existing = await tx
        .select()
        .from(employeePortalAccountsTable)
        .limit(1);
      if (existing.length > 0) {
        console.log("Updating", existing[0].id);
        await tx
          .update(employeePortalAccountsTable)
          .set({ failedAttempts: 1 })
          .where(eq(employeePortalAccountsTable.id, existing[0].id));
        console.log("Update success");
      } else {
        console.log("No accounts to update");
      }
    });
  } catch (err) {
    console.error("Failed:", err);
  }

  await pool.end();
}

run().catch(console.error);
