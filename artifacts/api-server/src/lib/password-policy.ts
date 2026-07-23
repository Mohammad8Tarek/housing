import {
  db,
  pool,
  withTenant,
  settingsTable,
  passwordHistoryTable,
} from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import bcrypt from "bcryptjs";

export interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
  expiryDays: number;
  historyCount: number;
  lockoutThreshold: number;
  lockoutDurationMinutes: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

const DEFAULT_POLICY: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: false,
  expiryDays: 90,
  historyCount: 5,
  lockoutThreshold: 5,
  lockoutDurationMinutes: 15,
};

export async function getPasswordPolicy(
  propertyId: number,
): Promise<PasswordPolicy> {
  try {
    const settings = await withTenant(propertyId, async (tenantDb) => {
      const [s] = await tenantDb.select().from(settingsTable).limit(1);
      return s;
    });
    if (!settings) return DEFAULT_POLICY;
    return {
      minLength: settings.passwordMinLength ?? DEFAULT_POLICY.minLength,
      requireUppercase:
        settings.passwordRequireUppercase ?? DEFAULT_POLICY.requireUppercase,
      requireLowercase:
        settings.passwordRequireLowercase ?? DEFAULT_POLICY.requireLowercase,
      requireNumber:
        settings.passwordRequireNumber ?? DEFAULT_POLICY.requireNumber,
      requireSymbol:
        settings.passwordRequireSymbol ?? DEFAULT_POLICY.requireSymbol,
      expiryDays: settings.passwordExpiryDays ?? DEFAULT_POLICY.expiryDays,
      historyCount:
        settings.passwordHistoryCount ?? DEFAULT_POLICY.historyCount,
      lockoutThreshold:
        settings.lockoutThreshold ?? DEFAULT_POLICY.lockoutThreshold,
      lockoutDurationMinutes:
        settings.lockoutDurationMinutes ??
        DEFAULT_POLICY.lockoutDurationMinutes,
    };
  } catch {
    return DEFAULT_POLICY;
  }
}

export function validatePassword(
  password: string,
  policy: PasswordPolicy,
): ValidationResult {
  const errors: string[] = [];
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter");
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain a number");
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain a symbol");
  }
  return { valid: errors.length === 0, errors };
}

export async function checkPasswordHistory(
  userId: number,
  newPassword: string,
  historyCount: number,
): Promise<string | null> {
  const result = await pool.query(
    `SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2`,
    [userId, historyCount],
  );
  for (const row of result.rows) {
    const match = await bcrypt.compare(newPassword, row.password_hash);
    if (match) return "Cannot reuse a recent password";
  }
  return null;
}

export async function recordPasswordHistory(
  userId: number,
  passwordHash: string,
): Promise<void> {
  await pool.query(
    `INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)`,
    [userId, passwordHash],
  );
}

export async function cleanupOldPasswordHistory(
  userId: number,
  keepCount: number,
): Promise<void> {
  await pool.query(
    `DELETE FROM password_history WHERE id IN (
      SELECT id FROM password_history WHERE user_id = $1 ORDER BY created_at DESC OFFSET $2
    )`,
    [userId, keepCount],
  );
}

export async function isPasswordExpired(
  user: any,
  policy: PasswordPolicy,
): Promise<boolean> {
  if (!policy.expiryDays || policy.expiryDays <= 0) return false;
  const changedAt = user.passwordChangedAt ?? user.createdAt;
  if (!changedAt) return false;
  const diff = Date.now() - new Date(changedAt).getTime();
  return diff > policy.expiryDays * 24 * 60 * 60 * 1000;
}
