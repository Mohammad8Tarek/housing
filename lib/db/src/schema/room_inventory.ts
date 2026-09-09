import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";

export const roomInventoryTable = pgTable(
  "room_inventory",
  {
    id: serial("id").primaryKey(),
    roomId: integer("room_id")
      .notNull()
      .references(() => roomsTable.id, { onDelete: "cascade" }),
    itemName: text("item_name").notNull(),
    category: text("category").notNull().default("electronics"),
    quantity: integer("quantity").notNull().default(1),
    condition: text("condition").notNull().default("good"),
    barcode: text("barcode"),
    serialNumber: text("serial_number"),
    modelNumber: text("model_number"),
    lastInspectedAt: timestamp("last_inspected_at", { withTimezone: true }),
    inspectedBy: text("inspected_by"),
    notes: text("notes"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_room_inventory_room_id").on(table.roomId),
    index("idx_room_inventory_condition").on(table.condition),
    index("idx_room_inventory_category").on(table.category),
    index("idx_room_inventory_room_category").on(table.roomId, table.category),
  ]
);

export const insertRoomInventorySchema = createInsertSchema(
  roomInventoryTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertRoomInventory = z.infer<typeof insertRoomInventorySchema>;
export type RoomInventoryItem = typeof roomInventoryTable.$inferSelect;
