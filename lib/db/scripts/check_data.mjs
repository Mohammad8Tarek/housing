import pg from "pg";

const DATABASE_URL =
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:admin123@localhost:5432/staff-housing";

const client = new pg.Client({ connectionString: DATABASE_URL });

async function checkData() {
  try {
    await client.connect();

    // Get all properties
    const propsResult = await client.query(
      "SELECT id, schema_name FROM public.properties WHERE status = 'active' LIMIT 3"
    );
    const properties = propsResult.rows;

    console.log("\n=== Properties ===");
    console.log(properties);

    for (const prop of properties) {
      console.log(`\n=== Checking property ${prop.id} (schema: ${prop.schema_name}) ===`);

      // Check hostings
      const hostingsResult = await client.query(
        `SELECT id, employee_id, guests_count FROM ${prop.schema_name}.hostings LIMIT 3`
      );
      console.log("Hostings:", hostingsResult.rows);

      if (hostingsResult.rows.length > 0) {
        const hostingIds = hostingsResult.rows.map((h) => h.id);

        // Check companions for these hostings
        const companionsResult = await client.query(
          `SELECT * FROM ${prop.schema_name}.hosting_companions WHERE hosting_id = ANY($1)`,
          [hostingIds]
        );
        console.log(
          `Companions found: ${companionsResult.rows.length}`,
          companionsResult.rows.slice(0, 2)
        );
      }
    }
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await client.end();
  }
}

checkData();
