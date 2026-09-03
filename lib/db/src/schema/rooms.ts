import { pgTable, text, serial, integer, timestamp, index, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { buildingsTable } from "./buildings";
import { floorsTable } from "./floors";

export const roomsTable = pgTable("rooms", {
  id: serial("id").primaryKey(),
  buildingId: integer("building_id")
    .notNull()
    .references(() => buildingsTable.id, { onDelete: "cascade" }),
  floorId: integer("floor_id")
    .notNull()
    .references(() => floorsTable.id, { onDelete: "cascade" }),
  roomNumber: text("room_number").notNull(),
  roomType: text("room_type").notNull().default("single"),
  capacity: integer("capacity").notNull().default(1),
  currentOccupancy: integer("current_occupancy").notNull().default(0),
  status: text("status").notNull().default("available"),
  gender: text("gender"),
  view: text("view"),
  bedType: text("bed_type"),
  classification: text("classification"),
  separatorDoor: boolean("separator_door").notNull().default(false),
  size: text("size"),
  sizeSqm: integer("size_sqm"),
  features: text("features"),
  featuresList: jsonb("features_list").$type<string[]>().default([]),
  notes: text("notes").default(""),
  isActive: boolean("is_active").notNull().default(true),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_rooms_building_id").on(table.buildingId),
  index("idx_rooms_floor_id").on(table.floorId),
  index("idx_rooms_status").on(table.status),
  index("idx_rooms_building_status").on(table.buildingId, table.status),
  index("idx_rooms_is_active").on(table.isActive),
]);

export const insertRoomSchema = createInsertSchema(roomsTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
  currentOccupancy: true,
});
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
