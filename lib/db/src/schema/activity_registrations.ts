import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityRegistrationsTable = pgTable("activity_registrations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull(),
  activityId: integer("activity_id").notNull(),
  badgeNumber: text("badge_number"),
  status: text("status").notNull().default("joined"), // joined | interested | cancelled
  attended: boolean("attended").notNull().default(false),
  attendedAt: timestamp("attended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_activity_registrations_profile_id").on(table.profileId),
  index("idx_activity_registrations_activity_id").on(table.activityId),
  uniqueIndex("uq_activity_registrations_profile_activity").on(table.profileId, table.activityId),
]);

export const insertActivityRegistrationSchema = createInsertSchema(
  activityRegistrationsTable,
).omit({ id: true, createdAt: true, attendedAt: true });
export type InsertActivityRegistration = z.infer<
  typeof insertActivityRegistrationSchema
>;
export type ActivityRegistration =
  typeof activityRegistrationsTable.$inferSelect;
