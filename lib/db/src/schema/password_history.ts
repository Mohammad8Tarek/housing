import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";

export const passwordHistoryTable = pgTable("password_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export type PasswordHistory = typeof passwordHistoryTable.$inferSelect;
