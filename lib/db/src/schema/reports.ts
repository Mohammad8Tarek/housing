import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  jsonb,
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

export const insertCustomReportTemplateSchema = createInsertSchema(customReportTemplatesTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertCustomReportTemplate = z.infer<typeof insertCustomReportTemplateSchema>;
export type CustomReportTemplate = typeof customReportTemplatesTable.$inferSelect;
