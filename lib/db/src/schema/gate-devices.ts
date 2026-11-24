import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  index,
  varchar,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Physical access-control devices registered at a property's gate: biometric
// terminals (fingerprint / face), card readers and turnstile controllers. The
// device authenticates to the event-ingestion endpoint with an API key whose
// hash is stored here (the raw key is shown once, on creation).
export const gateDevicesTable = pgTable(
  "gate_devices",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id").notNull(),
    name: varchar("name", { length: 120 }).notNull(),
    // BIOMETRIC | TURNSTILE | HYBRID
    deviceType: varchar("device_type", { length: 30 })
      .notNull()
      .default("BIOMETRIC"),
    // ZKTECO | HIKVISION | SUPREMA | GENERIC
    vendor: varchar("vendor", { length: 40 }).notNull().default("GENERIC"),
    serialNumber: varchar("serial_number", { length: 120 }),
    ipAddress: varchar("ip_address", { length: 64 }),
    port: integer("port"),
    // IN | OUT | BOTH — the direction events from this device default to
    direction: varchar("direction", { length: 10 }).notNull().default("IN"),
    apiKeyHash: text("api_key_hash").notNull(),
    apiKeyPrefix: varchar("api_key_prefix", { length: 16 }),
    enabled: boolean("enabled").notNull().default(true),
    lastSeenAt: timestamp("last_seen_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_gate_devices_property_id").on(table.propertyId),
    index("idx_gate_devices_serial_number").on(table.serialNumber),
    index("idx_gate_devices_enabled").on(table.enabled),
  ],
);

export const insertGateDeviceSchema = createInsertSchema(gateDevicesTable);
export type InsertGateDevice = z.infer<typeof insertGateDeviceSchema>;
export type GateDevice = typeof gateDevicesTable.$inferSelect;
