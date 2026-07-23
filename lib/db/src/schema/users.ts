import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),

  propertyId: integer("property_id")
    .references(() => propertiesTable.id, { onDelete: "set null" }),

  username: text("username").notNull().unique(),
  email: text("email"),
  phone: text("phone"),
  department: text("department"),
  jobTitle: text("job_title"),
  passwordHash: text("password_hash").notNull(),
  passwordChangedAt: timestamp("password_changed_at", { withTimezone: true }),
  roles: text("roles").array().notNull().default([]),
  permissions: text("permissions").array().notNull().default([]),
  status: text("status").notNull().default("active"),

  propertyIds: integer("property_ids").array().notNull().default([]),
  lastPropertyId: integer("last_property_id"),

  // ─── Account Lockout ──────────────────────────────────────────────
  failedLoginAttempts: integer("failed_login_attempts").notNull().default(0),
  lockedUntil: timestamp("locked_until", { withTimezone: true }),

  lastLoginAt: timestamp("last_login_at", { withTimezone: true }),
  createdAt:   timestamp("created_at",    { withTimezone: true }).notNull().defaultNow(),
  updatedAt:   timestamp("updated_at",    { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = insertUserSchema.partial() as any;

export type InsertUser = typeof usersTable.$inferInsert;
export type User       = typeof usersTable.$inferSelect;
