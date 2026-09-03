import { pgTable, text, serial, integer, timestamp, index, boolean, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";

export const roomImportHistoryTable = pgTable("room_import_history", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  buildingId: integer("building_id"),
  fileName: text("file_name").notNull(),
  uploadedBy: integer("uploaded_by"),
  uploadedByName: text("uploaded_by_name"),
  uploadDate: timestamp("upload_date", { withTimezone: true }).notNull().defaultNow(),
  importMode: text("import_mode").notNull().default("create_update"),
  totalRows: integer("total_rows").notNull().default(0),
  createdRows: integer("created_rows").notNull().default(0),
  updatedRows: integer("updated_rows").notNull().default(0),
  failedRows: integer("failed_rows").notNull().default(0),
  status: text("status").notNull().default("COMPLETED"),
  errors: jsonb("errors").$type<any[]>().default([]),
  warnings: jsonb("warnings").$type<any[]>().default([]),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_room_import_property_id").on(table.propertyId),
  index("idx_room_import_created_at").on(table.createdAt),
]);

export const roomImportTemplatesTable = pgTable("room_import_templates", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id"),
  name: text("name").notNull(),
  description: text("description"),
  columnMapping: jsonb("column_mapping").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_room_import_templates_prop").on(table.propertyId),
]);

export const roomBedsTable = pgTable("room_beds", {
  id: serial("id").primaryKey(),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  bedNumber: integer("bed_number").notNull(),
  bedType: text("bed_type"),
  status: text("status").notNull().default("AVAILABLE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_room_beds_room_id").on(table.roomId),
  index("idx_room_beds_status").on(table.status),
]);

export type RoomImportHistory = typeof roomImportHistoryTable.$inferSelect;
export type RoomImportTemplate = typeof roomImportTemplatesTable.$inferSelect;
export type RoomBed = typeof roomBedsTable.$inferSelect;
