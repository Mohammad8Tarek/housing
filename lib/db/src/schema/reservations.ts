import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";

export const reservationsTable = pgTable("reservations", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").references(() => roomsTable.id, {
    onDelete: "set null",
  }),
  roomType: text("room_type"),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  checkInDate: text("check_in_date").notNull(),
  checkOutDate: text("check_out_date"),
  notes: text("notes").notNull().default(""),
  guestIdCardNumber: text("guest_id_card_number").notNull().default(""),
  guestPhone: text("guest_phone").notNull().default(""),
  jobTitle: text("job_title").notNull().default(""),
  department: text("department").notNull().default(""),
  status: text("status").notNull().default("UPCOMING"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_reservations_room_id").on(table.roomId),
  index("idx_reservations_status").on(table.status),
  index("idx_reservations_check_in_date").on(table.checkInDate),
]);

export const insertReservationSchema = createInsertSchema(
  reservationsTable,
).omit({ id: true, createdAt: true });
export type InsertReservation = z.infer<typeof insertReservationSchema>;
export type Reservation = typeof reservationsTable.$inferSelect;
