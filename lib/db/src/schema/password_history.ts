import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";

export const passwordHistoryTable = pgTable("password_history", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  passwordHash: text("password_hash").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_password_history_user_id").on(table.userId),
]);

export type PasswordHistory = typeof passwordHistoryTable.$inferSelect;
