import { db } from "../src/db";
import { usersTable } from "../../../lib/db/src/schema";
import { sql } from "drizzle-orm";

async function test() {
  const result = await db.select({
    id: usersTable.id,
    has_signature: sql<boolean>`EXISTS(SELECT 1 FROM public.user_signatures us WHERE us.user_id = ${usersTable.id})`,
  }).from(usersTable).limit(5);
  
  console.log(result);
  process.exit(0);
}
test();
