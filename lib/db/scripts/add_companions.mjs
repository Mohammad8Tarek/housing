import pg from "pg";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:admin123@localhost:5432/staff-housing";

const client = new pg.Client({ connectionString: DATABASE_URL });

async function addCompanions() {
  try {
    await client.connect();

    // Get properties
    const propsResult = await client.query(
      "SELECT id, schema_name FROM public.properties WHERE status = 'active' LIMIT 1"
    );
    const property = propsResult.rows[0];

    if (!property) {
      console.log("No active property found");
      return;
    }

    console.log(`\nAdding companions to property ${property.id} (${property.schema_name})`);

    // Get hostings
    const hostingsResult = await client.query(
      `SELECT id, guests_count FROM ${property.schema_name}.hostings LIMIT 5`
    );
    const hostings = hostingsResult.rows;

    console.log(`Found ${hostings.length} hostings`);

    for (const hosting of hostings) {
      console.log(`\n🔄 Adding companions to hosting #${hosting.id}...`);

      // Create sample companions based on guests_count
      const companions = [];
      if (hosting.guests_count >= 1) {
        companions.push({
          hosting_id: hosting.id,
          name: "أحمد محمد",
          id_number: "123456789",
          document_type: "ID",
          relation: "الابن",
          is_child: 0,
          age: null,
        });
      }
      if (hosting.guests_count >= 2) {
        companions.push({
          hosting_id: hosting.id,
          name: "فاطمة محمد",
          id_number: "987654321",
          document_type: "ID",
          relation: "الابنة",
          is_child: 1,
          age: 10,
        });
      }

      // Insert companions
      for (const companion of companions) {
        await client.query(
          `INSERT INTO ${property.schema_name}.hosting_companions
           (hosting_id, name, id_number, document_type, relation, is_child, age)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            companion.hosting_id,
            companion.name,
            companion.id_number,
            companion.document_type,
            companion.relation,
            companion.is_child,
            companion.age,
          ]
        );
      }

      console.log(`✅ Added ${companions.length} companion(s) to hosting #${hosting.id}`);
    }

    console.log("\n✅ Done!");
  } catch (error) {
    console.error("❌ Error:", error.message);
  } finally {
    await client.end();
  }
}

addCompanions();
