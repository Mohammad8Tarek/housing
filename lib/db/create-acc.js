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
  passwordHash: text("password_hash").notNull(),
  mustChangePassword: boolean("must_change_password").notNull().default(true),
  isActive: boolean("is_active").notNull().default(true),
  failedAttempts: integer("failed_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
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
    const existing = await db
      .select()
      .from(employeePortalAccountsTable)
      .where(eq(employeePortalAccountsTable.employeeId, "EMP001"))
      .limit(1);
    if (existing.length === 0) {
      console.log("Inserting EMP001");
      await db.insert(employeePortalAccountsTable).values({
        employeeId: "EMP001",
        passwordHash: "dummyhash",
      });
    } else {
      console.log("EMP001 already has account");
    }
  } catch (err) {
    console.error("Failed:", err);
  }

  await pool.end();
}

run().catch(console.error);
