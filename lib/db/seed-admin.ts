import { drizzle } from "drizzle-orm/node-postgres";
import pg from "pg";
import * as schema from "@workspace/db/schema";
import bcrypt from "bcryptjs";

const { Pool } = pg;

async function seedAdmin() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required");
  }

  const pool = new Pool({ connectionString });
  const db = drizzle(pool, { schema });

  const passwordHash = await bcrypt.hash("admin123", 10);

  console.log("Seeding super_admin...");
  await db.insert(schema.usersTable).values({
    username: "admin",
    passwordHash,
    roles: ["super_admin"],
    permissions: [],
    status: "active",
  });

  console.log(
    "Admin user created successfully! Username: admin | Password: admin123",
  );
  process.exit(0);
}

seedAdmin().catch((err) => {
  console.error("Failed to seed admin:", err);
  process.exit(1);
});
