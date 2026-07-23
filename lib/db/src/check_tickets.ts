import { pool, withTenant, maintenanceTable } from "./index.js";
import { inArray, ne, or } from "drizzle-orm";

async function main() {
  const res = await pool.query("SELECT id, name FROM public.properties");
  console.log(`Found ${res.rows.length} properties.`);

  for (const row of res.rows) {
    const propId = row.id;
    const propName = row.name;
    try {
      await withTenant(propId, async (tenantDb) => {
        const tickets = await tenantDb
          .select({ id: maintenanceTable.id, status: maintenanceTable.status })
          .from(maintenanceTable);
        const open = tickets.filter(t => t.status === 'open' || t.status === 'in_progress');
        console.log(`Property "${propName}" (ID: ${propId}): ${tickets.length} total tickets, ${open.length} open/in_progress`);
        tickets.forEach(t => console.log(`  - #${t.id}: ${t.status}`));
      });
    } catch (err: any) {
      console.error(`Failed for property ${propName} (ID: ${propId}):`, err.message);
    }
  }
}

main().catch(console.error).finally(() => {
  console.log("Done.");
  process.exit(0);
});
