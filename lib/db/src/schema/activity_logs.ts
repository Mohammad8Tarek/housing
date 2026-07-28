import {
  pgTable,
  text,
  serial,
  integer,
  bigint,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityLogsTable = pgTable("activity_logs", {
  id: serial("id").primaryKey(),
  username: text("username").notNull(),
  userId: integer("user_id"),
  userRole: text("user_role"),
  action: text("action").notNull(),
  actionType: text("action_type").notNull().default("INFO"),
  module: text("module").notNull().default("system"),
  severity: text("severity").notNull().default("info"),
  entityType: text("entity_type"),
  entityId: bigint("entity_id", { mode: "number" }),
  ipAddress: text("ip_address"),
  userAgent: text("user_agent"),
  details: text("details"),
  timestamp: timestamp("timestamp", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertActivityLogSchema = createInsertSchema(
  activityLogsTable,
).omit({ id: true, timestamp: true });
export type InsertActivityLog = z.infer<typeof insertActivityLogSchema>;
export type ActivityLog = typeof activityLogsTable.$inferSelect;
