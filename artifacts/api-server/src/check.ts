import { db, propertiesTable, withTenant, employeesTable, employeePortalAccountsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

async function check() {
  const properties = await db.select().from(propertiesTable);
  for (const p of properties) {
    try {
      await withTenant(p.id, async (tenantDb) => {
        const [emp] = await tenantDb.select().from(employeesTable).where(eq(employeesTable.employeeId, "10575"));
        if (emp) {
          console.log(`Found in prop_${p.id}:`, emp.firstName, emp.lastName, emp.status);
          const [acc] = await tenantDb.select().from(employeePortalAccountsTable).where(eq(employeePortalAccountsTable.employeeId, "10575"));
          console.log(`Account in prop_${p.id}:`, acc ? "Exists" : "MISSING!");
        }
      });
    } catch (e: any) {
      console.log(`Skipping prop_${p.id} due to error:`, e.message);
    }
  }
  process.exit(0);
}

check().catch(console.error);
