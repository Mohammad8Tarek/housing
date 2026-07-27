import { db, propertiesTable, withTenant, employeePortalAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";

async function updatePassword() {
  const hash = await bcrypt.hash("1234", 12);
  const properties = await db.select().from(propertiesTable);
  for (const p of properties) {
    try {
      await withTenant(p.id, async (tenantDb) => {
        const [acc] = await tenantDb.select().from(employeePortalAccountsTable).where(eq(employeePortalAccountsTable.employeeId, "10575"));
        if (acc) {
          await tenantDb.update(employeePortalAccountsTable).set({ passwordHash: hash, failedAttempts: 0, lockedUntil: null }).where(eq(employeePortalAccountsTable.id, acc.id));
          console.log(`Password updated to 1234 for 10575 in prop_${p.id}`);
        }
      });
    } catch (e: any) {
    }
  }
  process.exit(0);
}

updatePassword().catch(console.error);
