import { db, pool, hostingsTable, hostingCompanionsTable, withTenant } from "./index.js";
import { eq, inArray } from "drizzle-orm";

/**
 * Script لإضافة مرافقين لبيانات الاستضافة الموجودة
 * Usage: node ./dist/seed_guest_companions.mjs
 */

async function seedCompanions() {
  console.log("🌱 Seeding guest companions for existing hostings...\n");

  try {
    // Get all properties
    const result = await pool.query(
      "SELECT id, schema_name FROM public.properties WHERE status = 'active' ORDER BY id"
    );
    const properties = result.rows;

    if (!properties.length) {
      console.log("No active properties found.");
      return;
    }

    for (const prop of properties) {
      const propertyId = prop.id;
      const schemaName = prop.schema_name;

      console.log(`\n📌 Processing property: ${propertyId} (schema: ${schemaName})`);

      const hostings = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb.select().from(hostingsTable).limit(5);
      });

      if (!hostings.length) {
        console.log(`  └─ No hostings found for property ${propertyId}`);
        continue;
      }

      // Add sample companions to first few hostings
      for (let i = 0; i < Math.min(hostings.length, 3); i++) {
        const hosting = hostings[i];

        // Check if companions already exist
        const existingCompanions = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select()
            .from(hostingCompanionsTable)
            .where(eq(hostingCompanionsTable.hostingId, hosting.id));
        });

        if (existingCompanions.length > 0) {
          console.log(`  ├─ Hosting #${hosting.id} already has ${existingCompanions.length} companion(s)`);
          continue;
        }

        // Add sample companions
        const companions = [
          {
            name: "محمد علي",
            idNumber: "123456789",
            documentType: "ID",
            relation: "الابن",
            isChild: 0,
          },
          {
            name: "فاطمة علي",
            idNumber: "987654321",
            documentType: "ID",
            relation: "الابنة",
            isChild: 1,
            age: 8,
          },
        ];

        const inserted = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb.insert(hostingCompanionsTable).values(
            companions.map((c) => ({
              hostingId: hosting.id,
              name: c.name,
              idNumber: c.idNumber ?? null,
              documentType: c.documentType ?? null,
              documentImage: null,
              documentFileName: null,
              relation: c.relation ?? null,
              isChild: c.isChild ?? 0,
              age: (c as any).age ?? null,
            }))
          );
        });

        console.log(`  ├─ ✓ Added ${companions.length} companion(s) to hosting #${hosting.id}`);
      }
    }

    console.log("\n✅ Companion seeding completed!\n");
  } catch (error) {
    console.error("❌ Error seeding companions:", error);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

seedCompanions();
