import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { buildingsTable } from "./buildings";

export const floorsTable = pgTable("floors", {
  id: serial("id").primaryKey(),
  buildingId: integer("building_id")
    .notNull()
    .references(() => buildingsTable.id, { onDelete: "cascade" }),
  floorNumber: text("floor_number").notNull(),
  description: text("description").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_floors_building_id").on(table.buildingId),
]);

export const insertFloorSchema = createInsertSchema(floorsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertFloor = z.infer<typeof insertFloorSchema>;
export type Floor = typeof floorsTable.$inferSelect;
