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
import bcrypt from "bcryptjs";

const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});
const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  status: text("status").notNull().default("active"),
  firstName: text("first_name"),
  lastName: text("last_name"),
});
const employeePortalAccountsTable = pgTable("employee_portal_accounts", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
  passwordHash: text("password_hash").notNull(),
  isActive: boolean("is_active").notNull().default(true),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),
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
  pool.on("connect", (c) =>
    c.query("SET search_path TO public").catch(console.error),
  );
  const db = drizzle(pool);

  const employeeId = "EMP002";
  const password = "wrongpassword";

  try {
    const properties = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable);
    console.log("Properties:", properties);

    const results = await Promise.all(
      properties.map(async (p) => {
        return await db.transaction(async (tx) => {
          await tx.execute(
            sql`SET LOCAL search_path TO ${sql.identifier("prop_" + p.id)}, public`,
          );
          const [emp] = await tx
            .select()
            .from(employeesTable)
            .where(eq(employeesTable.employeeId, employeeId))
            .limit(1);
          if (!emp) return null;
          const [acc] = await tx
            .select()
            .from(employeePortalAccountsTable)
            .where(eq(employeePortalAccountsTable.employeeId, employeeId))
            .limit(1);
          return { emp, acc, propertyId: p.id };
        });
      }),
    );

    let employee = null;
    let account = null;
    let targetPropertyId = null;
    for (const found of results) {
      if (!found?.emp) continue;
      if (!employee) {
        employee = found.emp;
        account = found.acc;
        targetPropertyId = found.propertyId;
      }
      if (found.acc?.isActive) {
        employee = found.emp;
        account = found.acc;
        targetPropertyId = found.propertyId;
        break;
      }
    }

    console.log("Found emp:", employee?.id, account?.id, targetPropertyId);

    if (!employee) {
      console.log("401 no emp");
      return;
    }
    if (employee.status?.toUpperCase() !== "ACTIVE") {
      console.log("403 not active");
      return;
    }
    if (!account || !account.isActive) {
      console.log("401 no acc");
      return;
    }
    if (account.lockedUntil && account.lockedUntil > new Date()) {
      console.log("429 locked");
      return;
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    console.log("valid?", valid);
    if (!valid) {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SET LOCAL search_path TO ${sql.identifier("prop_" + targetPropertyId)}, public`,
        );
        await tx
          .update(employeePortalAccountsTable)
          .set({
            failedAttempts: sql`${employeePortalAccountsTable.failedAttempts} + 1`,
            lockedUntil: sql`CASE WHEN ${employeePortalAccountsTable.failedAttempts} + 1 >= 5 THEN NOW() + INTERVAL '1 minute' * 15 ELSE NULL END`,
            updatedAt: new Date(),
          })
          .where(eq(employeePortalAccountsTable.id, account.id));
      });
      console.log("Updated failedAttempts!");
    } else {
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SET LOCAL search_path TO ${sql.identifier("prop_" + targetPropertyId)}, public`,
        );
        await tx
          .update(employeePortalAccountsTable)
          .set({ failedAttempts: 0, lockedUntil: null, updatedAt: new Date() })
          .where(eq(employeePortalAccountsTable.id, account.id));
      });
      console.log("Updated success!");
    }
  } catch (err) {
    console.error("Failed:", err);
  }

  await pool.end();
}

run().catch(console.error);
