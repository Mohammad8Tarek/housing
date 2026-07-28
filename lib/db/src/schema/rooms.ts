import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertRoomSchema = createInsertSchema(roomsTable).omit({
  id: true,
  createdAt: true,
  currentOccupancy: true,
});
export type InsertRoom = z.infer<typeof insertRoomSchema>;
export type Room = typeof roomsTable.$inferSelect;
