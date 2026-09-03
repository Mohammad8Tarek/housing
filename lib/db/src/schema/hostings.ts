import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";
import { roomsTable } from "./rooms";

export const hostingsTable = pgTable("hostings", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id")
    .notNull()
    .references(() => profilesTable.id, { onDelete: "cascade" }),
  hostingType: text("hosting_type").notNull().default("SAME_ROOM"),
  guestsCount: integer("guests_count").notNull().default(1),
  expectedFrom: text("expected_from").notNull(),
  expectedTo: text("expected_to").notNull(),
  actualCheckIn: text("actual_check_in"),
  actualCheckOut: text("actual_check_out"),
  roomId: integer("room_id").references(() => roomsTable.id, {
    onDelete: "set null",
  }),
  roomType: text("room_type"),
  status: text("status").notNull().default("PENDING"),
  notes: text("notes").notNull().default(""),
  createdBy: text("created_by").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_hostings_profile_id").on(table.profileId),
  index("idx_hostings_room_id").on(table.roomId),
  index("idx_hostings_status").on(table.status),
  index("idx_hostings_created_at").on(table.createdAt),
]);

export const insertHostingSchema = createInsertSchema(hostingsTable).omit({
  id: true,
  createdAt: true,
});
export type InsertHosting = z.infer<typeof insertHostingSchema>;
export type Hosting = typeof hostingsTable.$inferSelect;
