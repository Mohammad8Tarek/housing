import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { profilesTable } from "./profiles";

export const workersTable = pgTable("workers", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  phone: text("phone").notNull().default(""),
  nationalId: text("national_id").default(""),
  specialty: text("specialty").notNull().default("general"), // electrical, plumbing, hvac, carpentry, housekeeping, painting, general
  status: text("status").notNull().default("available"), // available, busy, on_leave, inactive
  workerType: text("worker_type").notNull().default("internal"), // internal, contractor
  companyName: text("company_name").default(""),
  dailyRate: integer("daily_rate").default(0),
  notes: text("notes").default(""),
  profileId: integer("profile_id").references(() => profilesTable.id, { onDelete: "set null" }),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
}, (table) => [
  index("idx_workers_specialty").on(table.specialty),
  index("idx_workers_status").on(table.status),
  index("idx_workers_type").on(table.workerType),
  index("idx_workers_profile_id").on(table.profileId),
]);

export const insertWorkerSchema = createInsertSchema(workersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export type InsertWorker = z.infer<typeof insertWorkerSchema>;
export type Worker = typeof workersTable.$inferSelect;
