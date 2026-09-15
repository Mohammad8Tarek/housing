import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const gateLogsTable = pgTable("gate_logs", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id"),
  profileId: integer("profile_id"),
  employeeId: varchar("employee_id", { length: 50 }).notNull(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  department: varchar("department", { length: 100 }),
  jobTitle: varchar("job_title", { length: 100 }),
  roomNumber: varchar("room_number", { length: 50 }),
  buildingName: varchar("building_name", { length: 100 }),
  direction: varchar("direction", { length: 10 }).notNull().default("IN"), // 'IN' | 'OUT'
  status: varchar("status", { length: 20 }).notNull().default("GRANTED"), // 'GRANTED' | 'DENIED' | 'WARNING'
  reason: text("reason"),
  scannedBy: varchar("scanned_by", { length: 100 }).notNull().default("Security Officer"),
  scanMethod: varchar("scan_method", { length: 50 }).notNull().default("QR_SCAN"), // 'QR_SCAN' | 'BARCODE_GUN' | 'MANUAL'
  notes: text("notes"),
  scannedAt: timestamp("scanned_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_gate_logs_property_id").on(table.propertyId),
  index("idx_gate_logs_profile_id").on(table.profileId),
  index("idx_gate_logs_employee_id").on(table.employeeId),
  index("idx_gate_logs_direction").on(table.direction),
  index("idx_gate_logs_status").on(table.status),
  index("idx_gate_logs_scanned_at").on(table.scannedAt),
]);

export const insertGateLogSchema = createInsertSchema(gateLogsTable);
export type InsertGateLog = z.infer<typeof insertGateLogSchema>;
export type GateLog = typeof gateLogsTable.$inferSelect;
