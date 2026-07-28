import { employeePortalAccountsTable, withTenant } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export type PortalAccountSyncResult = {
  employeeId: string;
  created: boolean;
  moved?: boolean;
  deactivatedPrevious?: boolean;
  temporaryPassword?: string;
};

export function defaultEmployeePortalPassword(): string {
  const env = process.env["DEFAULT_EMPLOYEE_PORTAL_PASSWORD"];
  if (!env) {
    const generated = randomBytes(12).toString("hex");
    console.error(
      "[WARN] DEFAULT_EMPLOYEE_PORTAL_PASSWORD not set — generated random password. " +
        "Set this env var to avoid unexpected passwords between restarts.",
    );
    return generated;
  }
  return env;
}

function normalizeEmployeeId(employeeId: string | null | undefined): string {
  return String(employeeId ?? "").trim();
}

async function createAccount(
  tenantDb: any,
  employeeId: string,
): Promise<PortalAccountSyncResult> {
  const temporaryPassword = defaultEmployeePortalPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await tenantDb.insert(employeePortalAccountsTable).values({
    employeeId,
    passwordHash,
    mustChangePassword: true,
    isActive: true,
    failedAttempts: 0,
    lockedUntil: null,
  } as any);

  return { employeeId, created: true, temporaryPassword };
}

export async function ensureEmployeePortalAccount(
  propertyId: number,
  employeeId: string | null | undefined,
): Promise<PortalAccountSyncResult> {
  const normalizedEmployeeId = normalizeEmployeeId(employeeId);
  if (!normalizedEmployeeId) {
    throw new Error("employeeId is required to create portal account");
  }

  return await withTenant(propertyId, async (tenantDb) => {
    // Use INSERT ... ON CONFLICT to avoid TOCTOU race between SELECT and INSERT
    const temporaryPassword = defaultEmployeePortalPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    try {
      await tenantDb.insert(employeePortalAccountsTable).values({
        employeeId: normalizedEmployeeId,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      } as any);
      return {
        employeeId: normalizedEmployeeId,
        created: true,
        temporaryPassword,
      };
    } catch {
      // If insert fails (unique violation), account already exists
      return { employeeId: normalizedEmployeeId, created: false };
    }
  });
}

export async function moveOrEnsureEmployeePortalAccount(
  propertyId: number,
  previousEmployeeId: string | null | undefined,
  nextEmployeeId: string | null | undefined,
): Promise<PortalAccountSyncResult> {
  const previous = normalizeEmployeeId(previousEmployeeId);
  const next = normalizeEmployeeId(nextEmployeeId);
  if (!next) {
    throw new Error("employeeId is required to create portal account");
  }
  if (!previous || previous === next) {
    return await ensureEmployeePortalAccount(propertyId, next);
  }

  return await withTenant(propertyId, async (tenantDb) => {
    const [nextAccount] = await tenantDb
      .select({ id: employeePortalAccountsTable.id })
      .from(employeePortalAccountsTable)
      .where(eq(employeePortalAccountsTable.employeeId, next))
      .limit(1);

    const [previousAccount] = await tenantDb
      .select({ id: employeePortalAccountsTable.id })
      .from(employeePortalAccountsTable)
      .where(eq(employeePortalAccountsTable.employeeId, previous))
      .limit(1);

    if (nextAccount) {
      if (previousAccount) {
        await tenantDb
          .update(employeePortalAccountsTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(employeePortalAccountsTable.id, previousAccount.id));
      }
      return {
        employeeId: next,
        created: false,
        deactivatedPrevious: Boolean(previousAccount),
      };
    }

    if (previousAccount) {
      await tenantDb
        .update(employeePortalAccountsTable)
        .set({ employeeId: next, updatedAt: new Date() })
        .where(eq(employeePortalAccountsTable.id, previousAccount.id));
      return { employeeId: next, created: false, moved: true };
    }

    return await createAccount(tenantDb, next);
  });
}
