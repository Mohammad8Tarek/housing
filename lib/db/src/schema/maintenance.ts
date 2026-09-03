import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";
import { profilesTable } from "./profiles";

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
  assignedTo: integer("assigned_to").references(() => profilesTable.id, {
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
}, (table) => [
  index("idx_maintenance_room_id").on(table.roomId),
  index("idx_maintenance_status").on(table.status),
  index("idx_maintenance_priority").on(table.priority),
  index("idx_maintenance_assigned_to").on(table.assignedTo),
  index("idx_maintenance_parent_id").on(table.parentId),
  index("idx_maintenance_status_priority").on(table.status, table.priority),
]);

export const insertMaintenanceSchema = createInsertSchema(
  maintenanceTable,
).omit({ id: true, createdAt: true, reportedAt: true, assignedTo: true });
export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type MaintenanceRequest = typeof maintenanceTable.$inferSelect;
