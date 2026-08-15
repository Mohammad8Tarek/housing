import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  date,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const activitiesTable = pgTable("activities", {
  id: serial("id").primaryKey(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  category: text("category").notNull().default("general"), // general, sports, training, social
  locationAr: text("location_ar"),
  locationEn: text("location_en"),
  startDate: date("start_date").notNull(),
  endDate: date("end_date"),
  startTime: text("start_time"),
  maxParticipants: integer("max_participants"),
  status: text("status").notNull().default("planned"), // planned, ongoing, completed, cancelled
  coverImage: text("cover_image"),
  isPublished: boolean("is_published").notNull().default(false),
  targetDepartments: text("target_departments").array().notNull().default([]),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_activities_status").on(table.status),
  index("idx_activities_is_published").on(table.isPublished),
  index("idx_activities_start_date").on(table.startDate),
]);

export const insertActivitySchema = createInsertSchema(activitiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertActivity = z.infer<typeof insertActivitySchema>;
export type Activity = typeof activitiesTable.$inferSelect;
