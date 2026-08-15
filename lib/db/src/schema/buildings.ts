import { pgTable, text, serial, timestamp, integer, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const buildingsTable = pgTable("buildings", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  location: text("location").notNull().default(""),
  capacity: integer("capacity").notNull().default(0),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_buildings_status").on(table.status),
]);

export const insertBuildingSchema = createInsertSchema(buildingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertBuilding = z.infer<typeof insertBuildingSchema>;
export type Building = typeof buildingsTable.$inferSelect;
