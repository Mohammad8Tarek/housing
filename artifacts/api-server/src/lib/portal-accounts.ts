import { profilePortalAccountsTable, withTenant } from "@workspace/db";
import { eq } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { randomBytes } from "node:crypto";

export type PortalAccountSyncResult = {
  profileId: string;
  created: boolean;
  moved?: boolean;
  deactivatedPrevious?: boolean;
  temporaryPassword?: string;
};

export function defaultProfilePortalPassword(): string {
  const env = process.env["DEFAULT_PROFILE_PORTAL_PASSWORD"];
  if (!env) {
    const generated = randomBytes(12).toString("hex");
    console.error(
      "[WARN] DEFAULT_PROFILE_PORTAL_PASSWORD not set — generated random password. " +
        "Set this env var to avoid unexpected passwords between restarts.",
    );
    return generated;
  }
  return env;
}

function normalizeProfileId(profileId: string | null | undefined): string {
  return String(profileId ?? "").trim();
}

async function createAccount(
  tenantDb: any,
  profileId: string,
): Promise<PortalAccountSyncResult> {
  const temporaryPassword = defaultProfilePortalPassword();
  const passwordHash = await bcrypt.hash(temporaryPassword, 12);

  await tenantDb.insert(profilePortalAccountsTable).values({
    profileId,
    passwordHash,
    mustChangePassword: true,
    isActive: true,
    failedAttempts: 0,
    lockedUntil: null,
  } as any);

  return { profileId, created: true, temporaryPassword };
}

export async function ensureProfilePortalAccount(
  propertyId: number,
  profileId: string | null | undefined,
): Promise<PortalAccountSyncResult> {
  const normalizedProfileId = normalizeProfileId(profileId);
  if (!normalizedProfileId) {
    throw new Error("profileId is required to create portal account");
  }

  return await withTenant(propertyId, async (tenantDb) => {
    // Use INSERT ... ON CONFLICT to avoid TOCTOU race between SELECT and INSERT
    const temporaryPassword = defaultProfilePortalPassword();
    const passwordHash = await bcrypt.hash(temporaryPassword, 12);

    try {
      await tenantDb.insert(profilePortalAccountsTable).values({
        profileId: normalizedProfileId,
        passwordHash,
        mustChangePassword: true,
        isActive: true,
        failedAttempts: 0,
        lockedUntil: null,
      } as any);
      return {
        profileId: normalizedProfileId,
        created: true,
        temporaryPassword,
      };
    } catch {
      // If insert fails (unique violation), account already exists
      return { profileId: normalizedProfileId, created: false };
    }
  });
}

export async function moveOrEnsureProfilePortalAccount(
  propertyId: number,
  previousProfileId: string | null | undefined,
  nextProfileId: string | null | undefined,
): Promise<PortalAccountSyncResult> {
  const previous = normalizeProfileId(previousProfileId);
  const next = normalizeProfileId(nextProfileId);
  if (!next) {
    throw new Error("profileId is required to create portal account");
  }
  if (!previous || previous === next) {
    return await ensureProfilePortalAccount(propertyId, next);
  }

  return await withTenant(propertyId, async (tenantDb) => {
    const [nextAccount] = await tenantDb
      .select({ id: profilePortalAccountsTable.id })
      .from(profilePortalAccountsTable)
      .where(eq(profilePortalAccountsTable.profileId, next))
      .limit(1);

    const [previousAccount] = await tenantDb
      .select({ id: profilePortalAccountsTable.id })
      .from(profilePortalAccountsTable)
      .where(eq(profilePortalAccountsTable.profileId, previous))
      .limit(1);

    if (nextAccount) {
      if (previousAccount) {
        await tenantDb
          .update(profilePortalAccountsTable)
          .set({ isActive: false, updatedAt: new Date() })
          .where(eq(profilePortalAccountsTable.id, previousAccount.id));
      }
      return {
        profileId: next,
        created: false,
        deactivatedPrevious: Boolean(previousAccount),
      };
    }

    if (previousAccount) {
      await tenantDb
        .update(profilePortalAccountsTable)
        .set({ profileId: next, updatedAt: new Date() })
        .where(eq(profilePortalAccountsTable.id, previousAccount.id));
      return { profileId: next, created: false, moved: true };
    }

    return await createAccount(tenantDb, next);
  });
}
