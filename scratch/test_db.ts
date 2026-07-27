import { db } from "../lib/db/src/index.js";
import { propertiesTable } from "../lib/db/src/schema/properties.js";

async function run() {
  try {
    console.log("Testing properties query...");
    const properties = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable);
    console.log("Success! Found", properties.length, "properties");
    process.exit(0);
  } catch (err) {
    console.error("DB Error:", err.message);
    process.exit(1);
  }
}

run();
