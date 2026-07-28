import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Portal Notifications — stored per-tenant (inside withTenant schema)
export const portalNotificationsTable = pgTable("portal_notifications", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  title: text("title").notNull(),
  titleAr: text("title_ar"),
  message: text("message").notNull(),
  messageAr: text("message_ar"),
  type: text("type").notNull().default("announcement"), // activity | evaluation | document | announcement
  priority: text("priority").notNull().default("medium"), // low | medium | high
  targetAll: boolean("target_all").notNull().default(true),
  department: text("department"), // null = all departments
  createdBy: integer("created_by"), // admin userId
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
});

// Read receipts — which employees read which notification
export const portalNotificationReadsTable = pgTable(
  "portal_notification_reads",
  {
    id: serial("id").primaryKey(),
    notificationId: integer("notification_id").notNull(),
    employeeId: integer("employee_id").notNull(),
    readAt: timestamp("read_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    uniqueIndex("uq_portal_notification_reads").on(
      t.notificationId,
      t.employeeId,
    ),
  ],
);

// Push Subscriptions — Web Push notification subscriptions
export const pushSubscriptionsTable = pgTable(
  "push_subscriptions",
  {
    id: serial("id").primaryKey(),
    employeeId: integer("employee_id").notNull(),
    propertyId: integer("property_id").notNull(),
    endpoint: text("endpoint").notNull(),
    p256dhKey: text("p256dh_key").notNull(),
    authKey: text("auth_key").notNull(),
    userAgent: text("user_agent"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    lastUsedAt: timestamp("last_used_at", { withTimezone: true }),
  },
  (t) => [uniqueIndex("uq_push_subscriptions").on(t.endpoint)],
);

export const insertPortalNotificationSchema = createInsertSchema(
  portalNotificationsTable,
).omit({ id: true, createdAt: true });
export type InsertPortalNotification = z.infer<
  typeof insertPortalNotificationSchema
>;
export type PortalNotification = typeof portalNotificationsTable.$inferSelect;
