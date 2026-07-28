import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";
import { employeesTable } from "./employees";

export const maintenanceTable = pgTable("maintenance", {
  id: serial("id").primaryKey(),
  parentId: integer("parent_id").references((): any => maintenanceTable.id, {
    onDelete: "cascade",
  }),
  roomId: integer("room_id")
    .notNull()
    .references(() => roomsTable.id, { onDelete: "cascade" }),
  category: text("category").notNull().default("maintenance"),
  problemType: text("problem_type").notNull(),
  description: text("description").notNull().default(""),
  status: text("status").notNull().default("open"),
  priority: text("priority").notNull().default("medium"),
  reportedBy: text("reported_by"),
  assignedTo: integer("assigned_to").references(() => employeesTable.id, {
    onDelete: "set null",
  }),
  reportedAt: timestamp("reported_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  startedAt: timestamp("started_at", { withTimezone: true }),
  resolvedAt: timestamp("resolved_at", { withTimezone: true }),
  dueDate: text("due_date"),
  notes: text("notes"),
  photoUrl: text("photo_url"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertMaintenanceSchema = createInsertSchema(
  maintenanceTable,
).omit({ id: true, createdAt: true, reportedAt: true, assignedTo: true });
export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type MaintenanceRequest = typeof maintenanceTable.$inferSelect;
