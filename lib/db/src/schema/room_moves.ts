import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const roomMovesTable = pgTable("room_moves", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id")
    .notNull()
    .references(() => propertiesTable.id, { onDelete: "cascade" }),
  assignmentId: integer("assignment_id"),
  profileId: integer("profile_id").notNull(),
  employeeId: text("employee_id"),
  residentName: text("resident_name").notNull(),
  residentNameEn: text("resident_name_en"),
  department: text("department"),
  jobTitle: text("job_title"),
  oldRoomId: integer("old_room_id"),
  oldRoomNumber: text("old_room_number").notNull(),
  oldBedNumber: integer("old_bed_number"),
  oldBuildingName: text("old_building_name"),
  oldRoomType: text("old_room_type"),
  newRoomId: integer("new_room_id").notNull(),
  newRoomNumber: text("new_room_number").notNull(),
  newBedNumber: integer("new_bed_number"),
  newBuildingName: text("new_building_name"),
  newRoomType: text("new_room_type"),
  moveReason: text("move_reason"),
  reasonCode: text("reason_code").default("GENERAL"),
  actionByUserId: integer("action_by_user_id"),
  actionByUsername: text("action_by_username").notNull().default("System"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_room_moves_property_id").on(table.propertyId),
  index("idx_room_moves_profile_id").on(table.profileId),
  index("idx_room_moves_created_at").on(table.createdAt),
]);

export const insertRoomMoveSchema = createInsertSchema(roomMovesTable).omit({
  id: true,
  createdAt: true,
});

export type InsertRoomMove = z.infer<typeof insertRoomMoveSchema>;
export type RoomMove = typeof roomMovesTable.$inferSelect;
