import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
  uniqueIndex,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";
import { profilesTable } from "./profiles";
import { workersTable } from "./workers";

export const maintenanceTable = pgTable(
  "maintenance",
  {
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
    workerId: integer("worker_id").references(() => workersTable.id, {
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
    rating: integer("rating"),
    ratingComment: text("rating_comment"),
    ratedAt: timestamp("rated_at", { withTimezone: true }),
    // Where the request came from: portal | admin | qr | system
    source: text("source"),
    // First time a technician / staff member was assigned
    assignedAt: timestamp("assigned_at", { withTimezone: true }),
    ratedByProfileId: integer("rated_by_profile_id").references(
      () => profilesTable.id,
      {
        onDelete: "set null",
      },
    ),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_maintenance_room_id").on(table.roomId),
    index("idx_maintenance_status").on(table.status),
    index("idx_maintenance_priority").on(table.priority),
    index("idx_maintenance_assigned_to").on(table.assignedTo),
    index("idx_maintenance_worker_id").on(table.workerId),
    index("idx_maintenance_parent_id").on(table.parentId),
    index("idx_maintenance_status_priority").on(table.status, table.priority),
    index("idx_maintenance_rating").on(table.rating),
    index("idx_maintenance_rated_at").on(table.ratedAt),
  ],
);

// Ticket history: status changes, assignments, priority changes and comments.
export const maintenanceEventsTable = pgTable(
  "maintenance_events",
  {
    id: serial("id").primaryKey(),
    ticketId: integer("ticket_id")
      .notNull()
      .references(() => maintenanceTable.id, { onDelete: "cascade" }),
    // created | status | assigned | priority | comment
    type: text("type").notNull(),
    fromValue: text("from_value"),
    toValue: text("to_value"),
    comment: text("comment"),
    actorName: text("actor_name"),
    actorUserId: integer("actor_user_id"),
    actorProfileId: integer("actor_profile_id"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_maintenance_events_ticket").on(table.ticketId, table.createdAt),
  ],
);
export type MaintenanceEvent = typeof maintenanceEventsTable.$inferSelect;

// Each property's service catalogue (problem types): names, department and
// target time. Seeded with the defaults on first use; deactivated, never deleted.
export const maintenanceServicesTable = pgTable(
  "maintenance_services",
  {
    id: serial("id").primaryKey(),
    category: text("category").notNull().default("maintenance"), // maintenance | housekeeping | general
    key: text("key").notNull(),
    labelAr: text("label_ar").notNull(),
    labelEn: text("label_en").notNull(),
    targetMinutes: integer("target_minutes").notNull().default(240),
    active: boolean("active").notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    uniqueIndex("uq_maintenance_services_category_key").on(
      table.category,
      table.key,
    ),
  ],
);
export type MaintenanceService = typeof maintenanceServicesTable.$inferSelect;

export const insertMaintenanceSchema = createInsertSchema(
  maintenanceTable,
).omit({ id: true, createdAt: true, reportedAt: true, assignedTo: true });
export type InsertMaintenance = z.infer<typeof insertMaintenanceSchema>;
export type MaintenanceRequest = typeof maintenanceTable.$inferSelect;
