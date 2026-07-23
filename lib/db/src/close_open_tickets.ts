import { pool, withTenant, maintenanceTable } from "./index.js";
import { ne, and } from "drizzle-orm";

async function main() {
  const res = await pool.query("SELECT id, name FROM public.properties");
  console.log(`Found ${res.rows.length} properties.`);

  for (const row of res.rows) {
    const propId = row.id;
    const propName = row.name;
    try {
      await withTenant(propId, async (tenantDb) => {
        // Get all non-closed tickets
        const allTickets = await tenantDb
          .select({ id: maintenanceTable.id, status: maintenanceTable.status, resolvedAt: maintenanceTable.resolvedAt })
          .from(maintenanceTable)
          .where(ne(maintenanceTable.status, "closed"));

        if (allTickets.length === 0) {
          console.log(`Property "${propName}" (ID: ${propId}): no open tickets.`);
          return;
        }

        const result = await tenantDb
          .update(maintenanceTable)
          .set({
            status: "closed",
            resolvedAt: new Date(),
          })
          .where(ne(maintenanceTable.status, "closed"))
          .returning({ id: maintenanceTable.id, status: maintenanceTable.status });

        console.log(`Property "${propName}" (ID: ${propId}): closed ${result.length} ticket(s).`);
        result.forEach(t => console.log(`  - #${t.id} → closed`));
      });
    } catch (err: any) {
      console.error(`Failed for property "${propName}" (ID: ${propId}):`, err.message);
    }
  }
}

main().catch(console.error).finally(() => {
  console.log("Done.");
  process.exit(0);
});
