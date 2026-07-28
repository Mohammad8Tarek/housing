import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activityRegistrationsTable = pgTable("activity_registrations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id").notNull(),
  activityId: integer("activity_id").notNull(),
  badgeNumber: text("badge_number"),
  status: text("status").notNull().default("joined"), // joined | interested | cancelled
  attended: boolean("attended").notNull().default(false),
  attendedAt: timestamp("attended_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertActivityRegistrationSchema = createInsertSchema(
  activityRegistrationsTable,
).omit({ id: true, createdAt: true, attendedAt: true });
export type InsertActivityRegistration = z.infer<
  typeof insertActivityRegistrationSchema
>;
export type ActivityRegistration =
  typeof activityRegistrationsTable.$inferSelect;
