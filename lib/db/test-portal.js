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

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
});

export const employeePortalAccountsTable = pgTable("employee_portal_accounts", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull().unique(),
  isActive: boolean("is_active").notNull().default(true),
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
    const properties = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable);
    console.log("Properties:", properties);

    for (const p of properties) {
      console.log("Checking property", p.id);
      await db.transaction(async (tx) => {
        await tx.execute(
          sql`SET LOCAL search_path TO ${sql.identifier("prop_" + p.id)}, public`,
        );
        const accs = await tx
          .select()
          .from(employeePortalAccountsTable)
          .limit(1);
        console.log("Accounts in", p.id, ":", accs);
      });
    }
  } catch (err) {
    console.error("Failed:", err);
  }

  await pool.end();
}

run().catch(console.error);
