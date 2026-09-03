import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { roomsTable } from "./rooms";

export const assignmentsTable = pgTable("assignments", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  roomId: integer("room_id")
    .notNull()
    .references(() => roomsTable.id, { onDelete: "cascade" }),
  bedNumber: integer("bed_number"),
  checkInDate: text("check_in_date").notNull(),
  expectedCheckOutDate: text("expected_check_out_date"),
  checkOutDate: text("check_out_date"),
  notes: text("notes").notNull().default(""),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_assignments_profile_id").on(table.profileId),
  index("idx_assignments_room_id").on(table.roomId),
  index("idx_assignments_status").on(table.status),
  index("idx_assignments_room_status").on(table.roomId, table.status),
  index("idx_assignments_profile_status").on(table.profileId, table.status),
]);

export const insertAssignmentSchema = createInsertSchema(assignmentsTable).omit(
  { id: true, createdAt: true },
);
export type InsertAssignment = z.infer<typeof insertAssignmentSchema>;
export type Assignment = typeof assignmentsTable.$inferSelect;
