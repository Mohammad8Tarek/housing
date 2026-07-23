import { pgTable, serial, integer, text, boolean, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const propertyHotekServersTable = pgTable("property_hotek_servers", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  host: text("host").notNull(),
  port: integer("port").notNull(),
  protocol: text("protocol").notNull().default("fidelio"),
  workstation: text("workstation").notNull().default("WS1"),
  serverCode: text("server_code"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastSuccessAt: timestamp("last_success_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  propertyIdx: index("idx_property_hotek_servers_property").on(table.propertyId),
  activeIdx: index("idx_property_hotek_servers_active").on(table.propertyId, table.isActive),
}));

export const propertyHotekEncodersTable = pgTable("property_hotek_encoders", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull().references(() => propertiesTable.id, { onDelete: "cascade" }),
  serverId: integer("server_id").notNull().references(() => propertyHotekServersTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  encoderCode: text("encoder_code").notNull(),
  deskName: text("desk_name"),
  ipAddress: text("ip_address"),
  isActive: boolean("is_active").notNull().default(true),
  isDefault: boolean("is_default").notNull().default(false),
  lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
  lastError: text("last_error"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  propertyIdx: index("idx_property_hotek_encoders_property").on(table.propertyId),
  serverIdx: index("idx_property_hotek_encoders_server").on(table.serverId),
  activeIdx: index("idx_property_hotek_encoders_active").on(table.propertyId, table.isActive),
}));

export const insertPropertyHotekServerSchema = createInsertSchema(propertyHotekServersTable)
  .omit({ id: true, createdAt: true, updatedAt: true, lastSeenAt: true, lastSuccessAt: true, lastError: true });

export const insertPropertyHotekEncoderSchema = createInsertSchema(propertyHotekEncodersTable)
  .omit({ id: true, createdAt: true, updatedAt: true, lastSeenAt: true, lastError: true });

export type InsertPropertyHotekServer = z.infer<typeof insertPropertyHotekServerSchema>;
export type PropertyHotekServer = typeof propertyHotekServersTable.$inferSelect;
export type InsertPropertyHotekEncoder = z.infer<typeof insertPropertyHotekEncoderSchema>;
export type PropertyHotekEncoder = typeof propertyHotekEncodersTable.$inferSelect;
