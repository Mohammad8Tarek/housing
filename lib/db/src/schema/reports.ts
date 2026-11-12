import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  jsonb,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const customReportTemplatesTable = pgTable("custom_report_templates", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id"),
  name: text("name").notNull(),
  nameEn: text("name_en"),
  dataSource: text("data_source").notNull().default("in_house"), // 'in_house' | 'profiles' | 'rooms' | 'reservations' | 'maintenance' | 'vacations' | 'hostings'
  columns: jsonb("columns").notNull().default([]), // array of column keys string[]
  filters: jsonb("filters").notNull().default({}), // filter object: { buildingId, floorId, department, jobLevel, gender, status, dateFrom, dateTo }
  layoutOptions: jsonb("layout_options").notNull().default({}), // { orientation: 'landscape'|'portrait', showStats: boolean, showSignatures: boolean, titleAr: string, titleEn: string, notes: string }
  createdBy: integer("created_by"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export const insertCustomReportTemplateSchema = createInsertSchema(
  customReportTemplatesTable,
).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomReportTemplate = z.infer<
  typeof insertCustomReportTemplateSchema
>;
export type CustomReportTemplate =
  typeof customReportTemplatesTable.$inferSelect;

// Reports emailed on a schedule (per property). The report runs with the
// permissions of the user who created the schedule.
export const reportSchedulesTable = pgTable("report_schedules", {
  id: serial("id").primaryKey(),
  reportKey: text("report_key").notNull(),
  // daily | weekly | monthly
  frequency: text("frequency").notNull().default("daily"),
  // weekly: 0 = Sunday … 6 = Saturday; monthly: 1 … 28
  dayOfWeek: integer("day_of_week"),
  dayOfMonth: integer("day_of_month"),
  // Hour of day in Africa/Cairo (0-23)
  hour: integer("hour").notNull().default(8),
  recipients: text("recipients").notNull(), // comma separated
  lang: text("lang").notNull().default("ar"),
  filters: jsonb("filters").notNull().default({}),
  enabled: boolean("enabled").notNull().default(true),
  createdBy: integer("created_by").notNull(),
  createdByName: text("created_by_name"),
  lastRunAt: timestamp("last_run_at", { withTimezone: true }),
  lastStatus: text("last_status"), // sent | failed | empty
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
});

export type ReportSchedule = typeof reportSchedulesTable.$inferSelect;
