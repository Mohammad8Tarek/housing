import { pgTable, text } from "drizzle-orm/pg-core";
import { db } from "../lib/db/src/index.js";

const fakeTable = pgTable("this_table_does_not_exist", {
  id: text("id"),
});

async function run() {
  try {
    await db.select().from(fakeTable);
  } catch (err) {
    console.error("EXACT ERROR MESSAGE:");
    console.error(err.message);
    process.exit(1);
  }
}
run();
