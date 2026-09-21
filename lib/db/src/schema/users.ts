import { pgTable, text, serial, integer, timestamp, index, uniqueIndex, boolean } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),

  propertyId: integer("property_id").references(() => propertiesTable.id, {
    onDelete: "set null",
  }),

  username: text("username").notNull().unique(),
  email: text("email"),
  phone: text("phone"),
  department: text("department"),
  jobTitle: text("job_title"),
  nationalId: text("national_id"),
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
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow()
    .$onUpdate(() => new Date()),
}, (table) => [
  uniqueIndex("uq_users_username").on(table.username),
  index("idx_users_role").on(table.roles),
  index("idx_users_is_active").on(table.status),
  index("idx_users_active_role").on(table.status, table.roles),
]);

export const insertUserSchema = createInsertSchema(usersTable).omit({
  id: true,
  createdAt: true,
  updatedAt: true,
});

export const updateUserSchema = insertUserSchema.partial() as any;

export type InsertUser = typeof usersTable.$inferInsert;
export type User = typeof usersTable.$inferSelect;

export const userPasswordResetOtpsTable = pgTable("user_password_reset_otps", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").references(() => usersTable.id, { onDelete: "cascade" }).notNull(),
  identifier: text("identifier").notNull(),
  otpHash: text("otp_hash").notNull(),
  tokenHash: text("token_hash"),
  attempts: integer("attempts").notNull().default(0),
  maxAttempts: integer("max_attempts").notNull().default(5),
  isVerified: boolean("is_verified").notNull().default(false),
  resendCount: integer("resend_count").notNull().default(0),
  lastResendAt: timestamp("last_resend_at", { withTimezone: true }),
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_user_otps_user").on(table.userId),
  index("idx_user_otps_identifier").on(table.identifier),
  index("idx_user_otps_expires").on(table.expiresAt),
]);

export type UserPasswordResetOtp = typeof userPasswordResetOtpsTable.$inferSelect;
export type InsertUserPasswordResetOtp = typeof userPasswordResetOtpsTable.$inferInsert;

