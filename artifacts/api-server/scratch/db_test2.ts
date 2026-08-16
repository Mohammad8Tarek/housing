import { db } from "../src/db.js";
import { usersTable } from "../../../lib/db/src/schema/index.js";
import { sql } from "drizzle-orm";

async function test() {
  try {
    const result = await db.select({
      id: usersTable.id,
      has_signature: sql<boolean>`EXISTS(SELECT 1 FROM public.user_signatures us WHERE us.user_id = ${usersTable.id})`.mapWith(Boolean).as("has_signature"),
    }).from(usersTable).limit(5);
    
    console.log("Result:", result);
    
    const count = await db.execute(sql`SELECT * FROM public.user_signatures`);
    console.log("Signatures found:", count.rows);
  } catch (err) {
    console.error("Error:", err);
  }
  process.exit(0);
}
test();
