import {
  pgTable,
  integer,
  text,
  boolean,
  timestamp,
  bigint,
} from "drizzle-orm/pg-core";

// Two-step verification (TOTP) per admin user. Kept out of the users table
// on purpose: user rows are returned by several endpoints, this never is.
// Secrets are AES-256-GCM encrypted; recovery codes are stored as hashes.
export const userMfaTable = pgTable("user_mfa", {
  userId: integer("user_id").primaryKey(),
  secretEnc: text("secret_enc"),
  pendingSecretEnc: text("pending_secret_enc"),
  enabled: boolean("enabled").notNull().default(false),
  recoveryHashes: text("recovery_hashes").array().notNull().default([]),
  // Last TOTP time step accepted (a code can't be used twice)
  lastUsedStep: bigint("last_used_step", { mode: "number" }),
  enabledAt: timestamp("enabled_at", { withTimezone: true }),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export type UserMfa = typeof userMfaTable.$inferSelect;
