import { pgTable, text, serial, integer, timestamp, jsonb } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { roomsTable } from "./rooms";
import { employeesTable } from "./employees";
import { assignmentsTable } from "./assignments";

export const roomLocksTable = pgTable("room_locks", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  lockNumber: text("lock_number").notNull(),
  protocol: text("protocol").notNull().default("mifare"),
  status: text("status").notNull().default("active"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const roomKeysTable = pgTable("room_keys", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  assignmentId: integer("assignment_id").references(() => assignmentsTable.id, { onDelete: "set null" }),
  roomId: integer("room_id").notNull().references(() => roomsTable.id, { onDelete: "cascade" }),
  lockId: integer("lock_id").references(() => roomLocksTable.id, { onDelete: "set null" }),
  employeeId: integer("employee_id").references(() => employeesTable.id, { onDelete: "set null" }),
  cardNumber: text("card_number"),
  cardType: text("card_type").notNull().default("guest"),
  issuedBy: integer("issued_by"),
  issuedAt: timestamp("issued_at", { withTimezone: true }).notNull().defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  revokedAt: timestamp("revoked_at", { withTimezone: true }),
  revokedBy: integer("revoked_by"),
  status: text("status").notNull().default("active"),
  notes: text("notes"),
});

export const keyAuditLogTable = pgTable("key_audit_log", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id").notNull(),
  keyId: integer("key_id").references(() => roomKeysTable.id, { onDelete: "set null" }),
  action: text("action").notNull(),
  performedBy: integer("performed_by"),
  cardNumber: text("card_number"),
  roomNumber: text("room_number"),
  details: jsonb("details"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const insertRoomLockSchema = createInsertSchema(roomLocksTable).omit({ id: true, createdAt: true });
export const insertRoomKeySchema = createInsertSchema(roomKeysTable).omit({ id: true, issuedAt: true, revokedAt: true });
export const insertKeyAuditLogSchema = createInsertSchema(keyAuditLogTable).omit({ id: true, createdAt: true });

export type InsertRoomLock = z.infer<typeof insertRoomLockSchema>;
export type RoomLock = typeof roomLocksTable.$inferSelect;
export type InsertRoomKey = z.infer<typeof insertRoomKeySchema>;
export type RoomKey = typeof roomKeysTable.$inferSelect;
export type InsertKeyAuditLog = z.infer<typeof insertKeyAuditLogSchema>;
export type KeyAuditLog = typeof keyAuditLogTable.$inferSelect;
