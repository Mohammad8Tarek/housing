import { Router } from "express";
import { randomBytes, createHash } from "node:crypto";
import { db, withTenant } from "@workspace/db";
import {
  profilesTable,
  profilePortalAccountsTable,
  propertiesTable,
  settingsTable,
  assignmentsTable,
  roomsTable,
  passwordResetTokensTable,
} from "@workspace/db";
import { eq, and, not, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { logActivity } from "../lib/activity-logger.js";
import {
  defaultProfilePortalPassword,
  ensureProfilePortalAccount,
} from "../lib/portal-accounts.js";
import { requirePermission } from "../middlewares/permissions.js";
import { portalLoginRateLimit } from "../middlewares/rate-limit.js";

const router: Router = Router();

router.get("/ping", (req, res) => {
  res.json({ success: true, message: "pong_deployed" });
});

const MAX_FAILED = 5;
const LOCK_MINUTES = 15;

function generateTemporaryPassword(): string {
  return defaultProfilePortalPassword();
}

export function portalSession(req: any) {
  return req.session?.portal as
    | {
        profileDbId: number;
        profileId: string;
        propertyId: number;
        fullName: string;
      }
    | undefined;
}

export async function requirePortalAuth(req: any, res: any, next: any) {
  const sess = portalSession(req);
  if (!sess) {
    // Native app fallback: restore session from X-Session-Id header
    const xSid = req.headers["x-session-id"] as string | undefined;

    // DEBUG: log why auth failed
    const debugInfo: any = {
      sessionID: req.sessionID,
      hasCookie: !!req.headers["cookie"],
      portalInSession: !!(req.session as any)?.portal,
    };

    if (!xSid) {
      console.warn(
        "[portal-auth] 401 — no portal session, no X-Session-Id",
        debugInfo,
      );
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    req.sessionStore.get(xSid, (err: any, storedSess: any) => {
      debugInfo.xSid = xSid;
      debugInfo.storeError = err?.message;
      debugInfo.storeFound = !!storedSess;
      debugInfo.storeHasPortal = !!storedSess?.portal;
      console.warn("[portal-auth] 401 — X-Session-Id fallback", debugInfo);
      if (err || !storedSess) {
        res.status(401).json({ success: false, message: "Not authenticated" });
        return;
      }
      if (storedSess.portal) {
        req.session.portal = storedSess.portal;
        req.sessionID = xSid;
        checkProfileIsActive(req, res, next);
      } else {
        res.status(401).json({ success: false, message: "Not authenticated" });
      }
    });
    return;
  }

  checkProfileIsActive(req, res, next);
}

async function checkProfileIsActive(req: any, res: any, next: any) {
  const sess = portalSession(req);
  if (!sess) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  try {
    const [emp] = await withTenant(sess.propertyId, async (tenantDb) => {
      return tenantDb
        .select({ status: profilesTable.status })
        .from(profilesTable)
        .where(eq(profilesTable.id, sess.profileDbId))
        .limit(1);
    });

    if (!emp || emp.status?.toUpperCase() !== "ACTIVE") {
      req.session.destroy(() => {});
      res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية الدخول إلى البوابة",
      });
      return;
    }
  } catch {
    // If DB is unreachable, fail open: let the request through rather than locking everyone out.
    // This is consistent with the rest of the app's error handling.
  }

  next();
}

const LoginSchema = z.object({
  profileId: z.string().min(1),
  password: z.string().min(1),
});

router.post("/login", portalLoginRateLimit, async (req, res): Promise<void> => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "profileId and password are required",
      });
      return;
    }

    const { profileId, password } = parsed.data;

    // Cross-Tenant Search to find the profile (parallelized)
    const properties = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable);

    const results = await Promise.all(
      properties.map(async (p) => {
        try {
          return await withTenant(p.id, async (tenantDb) => {
            const [emp] = await tenantDb
              .select()
              .from(profilesTable)
              .where(eq(profilesTable.profileId, profileId.trim()))
              .limit(1);
            if (!emp) return null;
            // ✅ Always pick the most recent account (DESC) to avoid stale duplicates
            const [acc] = await tenantDb
              .select()
              .from(profilePortalAccountsTable)
              .where(
                eq(profilePortalAccountsTable.profileId, profileId.trim()),
              )
              .orderBy(sql`id DESC`)
              .limit(1);
            return { emp, acc, propertyId: p.id };
          });
        } catch (error: any) {
          console.warn(
            `[Portal Login] Skipping property ${p.id} due to error:`,
            error.message,
          );
          return null;
        }
      }),
    );

    let profile: any = null;
    let account: any = null;
    let targetPropertyId: number | null = null;

    for (const found of results) {
      if (!found?.emp) continue;
      if (!profile) {
        profile = found.emp;
        account = found.acc;
        targetPropertyId = found.propertyId;
      }
      if (found.acc?.isActive) {
        profile = found.emp;
        account = found.acc;
        targetPropertyId = found.propertyId;
        break;
      }
    }

    if (!profile) {
      res
        .status(401)
        .json({ success: false, message: "Invalid profile ID or password" });
      return;
    }

    // Block non-active profiles (e.g. SUSPENDED, DEPARTED, INACTIVE)
    if (profile.status?.toUpperCase() !== "ACTIVE") {
      res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية الدخول إلى البوابة",
      });
      return;
    }

    if (!account || !account.isActive) {
      res.status(401).json({
        success: false,
        message: "Portal access not enabled for this profile",
      });
      return;
    }

    if (account.lockedUntil && account.lockedUntil > new Date()) {
      const minutes = Math.ceil(
        (account.lockedUntil.getTime() - Date.now()) / 60000,
      );
      res.status(429).json({
        success: false,
        message: `Account locked. Try again in ${minutes} minute(s).`,
      });
      return;
    }

    const valid = await bcrypt.compare(password, account.passwordHash);
    if (!valid) {
      // Atomic SQL increment to prevent race-condition undercounting on parallel failed logins
      const [updatedAcc] = await withTenant(
        targetPropertyId!,
        async (tenantDb) => {
          await tenantDb
            .update(profilePortalAccountsTable)
            .set({
              failedAttempts: sql`${profilePortalAccountsTable.failedAttempts} + 1`,
              lockedUntil: sql`CASE
              WHEN ${profilePortalAccountsTable.failedAttempts} + 1 >= ${MAX_FAILED}
              THEN NOW() + INTERVAL '1 minute' * ${LOCK_MINUTES}
              ELSE NULL
            END`,
              updatedAt: new Date(),
            })
            .where(eq(profilePortalAccountsTable.id, account.id));

          return tenantDb
            .select()
            .from(profilePortalAccountsTable)
            .where(eq(profilePortalAccountsTable.id, account.id))
            .limit(1);
        },
      );

      const isLocked =
        updatedAcc.lockedUntil && new Date(updatedAcc.lockedUntil) > new Date();

      await logActivity({
        req,
        propertyId: targetPropertyId!,
        username: profileId,
        userRole: "profile",
        action: `محاولة دخول فاشلة - معرف الموظف: ${profileId}`,
        actionType: "LOGIN_FAILED",
        module: "profiles",
        entityType: "profile",
        entityId: profile.id,
        severity: "warning",
      });

      res.status(401).json({
        success: false,
        message: isLocked
          ? `Too many failed attempts. Account locked for ${LOCK_MINUTES} minutes.`
          : "Invalid profile ID or password",
      });
      return;
    }

    await withTenant(targetPropertyId!, async (tenantDb) => {
      await tenantDb
        .update(profilePortalAccountsTable)
        .set({
          failedAttempts: 0,
          lockedUntil: null,
          lastLoginAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profilePortalAccountsTable.id, account.id));
    });

    await logActivity({
      req,
      propertyId: targetPropertyId!,
      username: profileId,
      userRole: "profile",
      action: `دخول الموظف: ${profile.firstName} ${profile.lastName}`,
      actionType: "LOGIN",
      module: "profiles",
      entityType: "profile",
      entityId: profile.id,
    });
    (req.session as any).portal = {
      profileDbId: profile.id,
      profileId: profile.profileId,
      propertyId: targetPropertyId,
      fullName: `${profile.firstName} ${profile.lastName}`,
    };

    res.json({
      success: true,
      sessionId: req.sessionID,
      mustChangePassword: account.mustChangePassword,
      profile: {
        id: profile.id,
        profileId: profile.profileId,
        firstName: profile.firstName,
        lastName: profile.lastName,
        fullName: `${profile.firstName} ${profile.lastName}`,
        email: profile.email,
        phone: profile.phone,
        position: profile.position,
        department: profile.department,
      },
    });
  } catch (error: any) {
    console.error("Portal login error:", error);
    res
      .status(500)
      .json({ success: false, message: `Server error: ${error.message}` });
  }
});

// GET /profiles — دليل الموظفين (للمحادثة)
// @ts-ignore
router.get("/profiles", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const search = ((req.query.search as string) || "").trim().toLowerCase();
    const profiles = await withTenant(sess.propertyId, async (tenantDb) => {
      let query = tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          department: profilesTable.department,
          jobTitle: profilesTable.jobTitle,
          photoUrl: profilesTable.photoUrl,
        })
        .from(profilesTable)
        .where(
          and(
            eq(profilesTable.status, "ACTIVE"),
            not(eq(profilesTable.id, sess.profileDbId)),
          ),
        )
        .orderBy(profilesTable.firstName)
        .limit(50);

      return await query;
    });

    if (search) {
      return res.json({
        success: true,
        profiles: profiles.filter(
          (e) =>
            e.firstName?.toLowerCase().includes(search) ||
            e.lastName?.toLowerCase().includes(search) ||
            e.profileId?.toLowerCase().includes(search) ||
            e.department?.toLowerCase().includes(search),
        ),
      });
    }

    res.json({ success: true, profiles });
  } catch (err) {
    next(err);
  }
});

router.get("/me", requirePortalAuth, async (req, res): Promise<void> => {
  try {
    const sess = portalSession(req)!;

    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      const [profile] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, sess.profileDbId))
        .limit(1);
      if (!profile) return null;
      const [account] = await tenantDb
        .select()
        .from(profilePortalAccountsTable)
        .where(eq(profilePortalAccountsTable.profileId, profile.profileId))
        .limit(1);
      return { profile, account };
    });

    if (!result) {
      res.status(404).json({ success: false, message: "Profile not found" });
      return;
    }

    // Block if profile was suspended/departed after login
    if (result.profile.status?.toUpperCase() !== "ACTIVE") {
      req.session.destroy(() => {});
      res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية الدخول إلى البوابة",
      });
      return;
    }

    res.json({
      success: true,
      profile: {
        id: result.profile.id,
        profileId: result.profile.profileId,
        fullName: `${result.profile.firstName} ${result.profile.lastName}`,
        firstName: result.profile.firstName,
        lastName: result.profile.lastName,
        jobTitle: result.profile.jobTitle,
        department: result.profile.department,
        nationality: result.profile.nationality,
        phone: result.profile.phone,
        gender: result.profile.gender,
        hireDate: result.profile.hireDate,
        address: result.profile.address,
        level: result.profile.level,
        status: result.profile.status,
        propertyId: sess.propertyId,
      },
      mustChangePassword: result.account?.mustChangePassword ?? false,
    });
  } catch (error: any) {
    console.error("Portal /me error:", error);
    res
      .status(500)
      .json({ success: false, message: `Server error: ${error.message}` });
  }
});

const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

router.post(
  "/change-password",
  requirePortalAuth,
  async (req, res): Promise<void> => {
    const sess = portalSession(req)!;
    const parsed = ChangePasswordSchema.safeParse(req.body);

    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message ?? "Invalid input",
      });
      return;
    }

    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      const [account] = await tenantDb
        .select()
        .from(profilePortalAccountsTable)
        .where(eq(profilePortalAccountsTable.profileId, sess.profileId))
        .limit(1);
      if (!account) return { status: 404, message: "Account not found" };

      const valid = await bcrypt.compare(
        parsed.data.currentPassword,
        account.passwordHash,
      );
      if (!valid)
        return { status: 401, message: "Current password is incorrect" };

      if (parsed.data.newPassword === parsed.data.currentPassword) {
        return {
          status: 400,
          message: "New password must be different from current password",
        };
      }

      const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
      await tenantDb
        .update(profilePortalAccountsTable)
        .set({
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profilePortalAccountsTable.id, account.id));

      const [profile] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, sess.profileId))
        .limit(1);
      return { profile };
    });

    if (result.status) {
      res
        .status(result.status)
        .json({ success: false, message: result.message });
      return;
    }

    if (result.profile) {
      await logActivity({
        req,
        propertyId: sess.propertyId,
        username: sess.profileId,
        userRole: "profile",
        action: `تغيير كلمة المرور - ${result.profile.firstName} ${result.profile.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: result.profile.id,
      });
    }

    res.json({ success: true, message: "Password changed successfully" });
  },
);

/**
 * Specifically for first-time login where the profile doesn't need to re-enter the temp password
 */
router.post(
  "/first-login-reset",
  requirePortalAuth,
  async (req, res): Promise<void> => {
    const sess = portalSession(req)!;
    const parsed = z
      .object({ newPassword: z.string().min(6) })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: parsed.error.errors[0]?.message || "Invalid input",
      });
      return;
    }
    const { newPassword } = parsed.data;

    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      const [account] = await tenantDb
        .select()
        .from(profilePortalAccountsTable)
        .where(eq(profilePortalAccountsTable.profileId, sess.profileId))
        .limit(1);
      if (!account) return { status: 404, message: "Account not found" };

      if (!account.mustChangePassword) {
        return {
          status: 400,
          message: "Password reset not required or already completed",
        };
      }

      const newHash = await bcrypt.hash(newPassword, 12);
      await tenantDb
        .update(profilePortalAccountsTable)
        .set({
          passwordHash: newHash,
          mustChangePassword: false,
          passwordChangedAt: new Date(),
          updatedAt: new Date(),
        })
        .where(eq(profilePortalAccountsTable.id, account.id));

      const [profile] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, sess.profileId))
        .limit(1);
      return { profile };
    });

    if (result.status) {
      res
        .status(result.status)
        .json({ success: false, message: result.message });
      return;
    }

    if (result.profile) {
      await logActivity({
        req,
        propertyId: sess.propertyId,
        username: sess.profileId,
        userRole: "profile",
        action: `تحديث كلمة المرور لأول مرة - ${result.profile.firstName} ${result.profile.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: result.profile.id,
      });
    }

    res.json({ success: true, message: "Password updated successfully" });
  },
);

router.post("/logout", async (req, res): Promise<void> => {
  const sess = portalSession(req);
  if (sess) {
    try {
      await logActivity({
        req,
        propertyId: sess.propertyId,
        username: sess.profileId,
        userRole: "profile",
        action: `تسجيل الخروج - ${sess.fullName}`,
        actionType: "LOGOUT",
        module: "profiles",
        entityType: "profile",
        entityId: sess.profileDbId,
      });
    } catch {
      /* log failure is non-critical */
    }
  }
  req.session.destroy(() => {
    // Clear the correct session cookie name (app.ts:308 sets `name: "sunrise.sid"`)
    res.clearCookie("sunrise.sid");
    res.json({ success: true, message: "Logged out" });
  });
});

router.post(
  "/reset-password",
  requirePermission("profiles", "reset_password"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const parsed = z
      .object({
        profileId: z.string().min(1),
        propertyId: z.number().int().positive(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid input" });
      return;
    }
    const { profileId, propertyId } = parsed.data;
    const temporaryPassword = generateTemporaryPassword();

    const profile = await withTenant(propertyId, async (tenantDb) => {
      const [account] = await tenantDb
        .select()
        .from(profilePortalAccountsTable)
        .where(eq(profilePortalAccountsTable.profileId, profileId))
        .limit(1);
      const temporaryHash = await bcrypt.hash(temporaryPassword, 12);

      if (!account) {
        await tenantDb.insert(profilePortalAccountsTable).values({
          profileId,
          passwordHash: temporaryHash,
          mustChangePassword: true,
        } as any);
      } else {
        await tenantDb
          .update(profilePortalAccountsTable)
          .set({
            passwordHash: temporaryHash,
            mustChangePassword: true,
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(profilePortalAccountsTable.id, account.id));
      }
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, profileId))
        .limit(1);
      return emp;
    });

    if (profile) {
      await logActivity({
        req,
        propertyId,
        username: (req.session as any)?.username ?? "admin",
        userId: adminUserId,
        userRole: (req.session as any)?.userRole ?? "admin",
        action: `إعادة تعيين كلمة مرور الموظف: ${profile.firstName} ${profile.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: profile.id,
        details: "Temporary profile portal password generated",
      });
    }

    res.json({
      success: true,
      message: "Temporary password generated",
      temporaryPassword,
    });
  },
);

router.post(
  "/set-password",
  requirePermission("profiles", "reset_password"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const parsed = z
      .object({
        profileId: z.string().min(1),
        propertyId: z.number().int().positive(),
        newPassword: z.string().min(6),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid input" });
      return;
    }
    const { profileId, propertyId, newPassword } = parsed.data;

    const profile = await withTenant(propertyId, async (tenantDb) => {
      const [account] = await tenantDb
        .select()
        .from(profilePortalAccountsTable)
        .where(eq(profilePortalAccountsTable.profileId, profileId))
        .limit(1);
      const newHash = await bcrypt.hash(newPassword, 12);

      if (!account) {
        await tenantDb.insert(profilePortalAccountsTable).values({
          profileId,
          passwordHash: newHash,
          mustChangePassword: false,
          isActive: true,
          failedAttempts: 0,
          lockedUntil: null,
          passwordChangedAt: new Date(),
        } as any);
      } else {
        await tenantDb
          .update(profilePortalAccountsTable)
          .set({
            passwordHash: newHash,
            mustChangePassword: false,
            failedAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(profilePortalAccountsTable.id, account.id));
      }
      const [emp] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, profileId))
        .limit(1);
      return emp;
    });

    if (profile) {
      await logActivity({
        req,
        propertyId,
        username: (req.session as any)?.username ?? "admin",
        userId: adminUserId,
        userRole: (req.session as any)?.userRole ?? "admin",
        action: `تعيين كلمة مرور جديدة للموظف: ${profile.firstName} ${profile.lastName}`,
        actionType: "UPDATE",
        module: "profiles",
        entityType: "profile",
        entityId: profile.id,
      });
    }

    res.json({ success: true, message: "Password set successfully" });
  },
);

// ─── GET /accounts — Admin: list all portal accounts with profile info ───────
router.get(
  "/accounts",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const propertyId =
      Number(req.query?.propertyId) || Number((req.session as any)?.propertyId);
    if (!propertyId) {
      res.status(400).json({ success: false, message: "propertyId required" });
      return;
    }

    const accounts = await withTenant(propertyId, async (tenantDb) => {
      const rows = await tenantDb
        .select({
          profileId: profilesTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          department: profilesTable.department,
          jobTitle: profilesTable.jobTitle,
          status: profilesTable.status,
          isActive: profilePortalAccountsTable.isActive,
          lastLoginAt: profilePortalAccountsTable.lastLoginAt,
          mustChangePassword: profilePortalAccountsTable.mustChangePassword,
          failedAttempts: profilePortalAccountsTable.failedAttempts,
          lockedUntil: profilePortalAccountsTable.lockedUntil,
          hasAccount: profilePortalAccountsTable.id,
        })
        .from(profilesTable)
        .leftJoin(
          profilePortalAccountsTable,
          eq(profilesTable.profileId, profilePortalAccountsTable.profileId),
        )
        .orderBy(profilesTable.firstName, profilesTable.lastName);

      return rows.map((r) => ({
        profileId: r.profileId,
        profileName:
          r.firstName && r.lastName
            ? `${r.firstName} ${r.lastName}`
            : r.profileId,
        department: r.department ?? "",
        jobTitle: r.jobTitle ?? "",
        profileStatus: r.status ?? "",
        hasAccount: Boolean(r.hasAccount),
        isActive: r.hasAccount ? (r.isActive ?? false) : false,
        lastLoginAt:
          r.lastLoginAt instanceof Date
            ? r.lastLoginAt.toISOString()
            : (r.lastLoginAt ?? null),
        mustChangePassword: r.mustChangePassword ?? false,
        failedAttempts: r.failedAttempts ?? 0,
        isLocked: r.lockedUntil ? new Date(r.lockedUntil) > new Date() : false,
      }));
    });

    res.json(accounts);
  },
);

// ─── POST /toggle-access — Admin: enable or disable an profile's portal access ─
router.post(
  "/toggle-access",
  requirePermission("profiles", "edit"),
  async (req, res): Promise<void> => {
    const adminUserId = (req.session as any)?.userId;
    if (!adminUserId) {
      res
        .status(401)
        .json({ success: false, message: "Admin authentication required" });
      return;
    }

    const parsed = z
      .object({
        profileId: z.string().min(1),
        isActive: z.boolean(),
        propertyId: z.number().int().positive(),
      })
      .safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ success: false, message: "Invalid input" });
      return;
    }
    const { profileId, isActive, propertyId: bodyPropertyId } = parsed.data;

    const propertyId =
      bodyPropertyId || Number((req.session as any)?.propertyId);

    if (isActive) {
      await ensureProfilePortalAccount(propertyId, profileId);
    }

    const [account] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(profilePortalAccountsTable)
        .set({ isActive, updatedAt: new Date() })
        .where(eq(profilePortalAccountsTable.profileId, profileId))
        .returning();
    });

    if (!account) {
      res
        .status(404)
        .json({ success: false, message: "Portal account not found" });
      return;
    }

    await logActivity({
      req,
      propertyId,
      username: (req.session as any)?.username ?? "admin",
      userId: adminUserId,
      userRole: (req.session as any)?.userRole ?? "admin",
      action: `${isActive ? "تفعيل" : "تعطيل"} صلاحية بوابة الموظف: ${profileId}`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: account.id,
    });

    res.json({ success: true, isActive, profileId });
  },
);

const ForgotPasswordVerifySchema = z.object({
  profileId: z.string().min(1),
  nationalId: z.string().min(1),
  roomNumber: z.string().min(1),
  dateOfBirth: z.string().min(1),
});

router.post(
  "/forgot-password/verify",
  portalLoginRateLimit,
  async (req, res): Promise<void> => {
    try {
      const parsed = ForgotPasswordVerifySchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({ success: false, message: "Missing required fields" });
        return;
      }

      const { profileId, nationalId, roomNumber, dateOfBirth } = parsed.data;
      const properties = await db.select().from(propertiesTable);

      let profile: any = null;
      let account: any = null;
      let targetPropertyId: number | null = null;
      let settings: any = null;

      for (const p of properties) {
        try {
          const result = await withTenant(p.id, async (tenantDb) => {
            const [emp] = await tenantDb
              .select()
              .from(profilesTable)
              .where(eq(profilesTable.profileId, profileId.trim()))
              .limit(1);
            if (!emp) return null;
            const [acc] = await tenantDb
              .select()
              .from(profilePortalAccountsTable)
              .where(
                eq(profilePortalAccountsTable.profileId, profileId.trim()),
              )
              .limit(1);
            const [st] = await tenantDb.select().from(settingsTable).limit(1);
            return { emp, acc, propertyId: p.id, st };
          });
          if (result?.emp) {
            profile = result.emp;
            account = result.acc;
            targetPropertyId = result.propertyId;
            settings = result.st;
            if (result.acc?.isActive) break;
          }
        } catch {}
      }

      const genericErrorMsg = "المعلومات المدخلة غير صحيحة";

      if (!profile || !account || !targetPropertyId) {
        res.status(400).json({ success: false, message: genericErrorMsg });
        return;
      }

      if (account.resetLockedUntil && account.resetLockedUntil > new Date()) {
        res
          .status(429)
          .json({
            success: false,
            message: "لقد تجاوزت الحد المسموح للمحاولات، يرجى المحاولة لاحقاً",
          });
        return;
      }

      const lockoutThreshold = settings?.lockoutThreshold ?? 5;
      const lockoutDurationMinutes = settings?.lockoutDurationMinutes ?? 15;

      const [assignment] = await withTenant(
        targetPropertyId,
        async (tenantDb) => {
          return tenantDb
            .select({ roomNumber: roomsTable.roomNumber })
            .from(assignmentsTable)
            .innerJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
            .where(
              and(
                eq(assignmentsTable.profileId, profile.id),
                eq(assignmentsTable.status, "ACTIVE"),
              ),
            )
            .limit(1);
        },
      );

      const isNationalIdMatch =
        profile.nationalId &&
        profile.nationalId.trim().toLowerCase() ===
          nationalId.trim().toLowerCase();

      const empDobStr = profile.dateOfBirth ? String(profile.dateOfBirth).trim() : "";
      const isDobMatch = empDobStr && empDobStr === dateOfBirth.trim();
      const isRoomMatch =
        assignment && assignment.roomNumber === roomNumber.trim();

      if (!isNationalIdMatch || !isDobMatch || !isRoomMatch) {
        await withTenant(targetPropertyId, async (tenantDb) => {
          await tenantDb
            .update(profilePortalAccountsTable)
            .set({
              failedAttempts: sql`${profilePortalAccountsTable.failedAttempts} + 1`,
              lockedUntil: sql`CASE
              WHEN ${profilePortalAccountsTable.failedAttempts} + 1 >= ${lockoutThreshold}
              THEN NOW() + INTERVAL '1 minute' * ${lockoutDurationMinutes}
              ELSE NULL
            END`,
              updatedAt: new Date(),
            })
            .where(eq(profilePortalAccountsTable.id, account.id));
        });
        await logActivity({
          req,
          propertyId: targetPropertyId,
          username: profile.profileId,
          userRole: "profile",
          action: "محاولة استعادة كلمة المرور فاشلة",
          actionType: "LOGIN_FAILED",
          module: "portal_auth",
          severity: "warning",
        });
        res.status(400).json({ success: false, message: genericErrorMsg });
        return;
      }

      const rawToken = randomBytes(32).toString("hex");
      const tokenHash = createHash("sha256").update(rawToken).digest("hex");
      const expiresAt = new Date(Date.now() + 15 * 60 * 1000);

      await withTenant(targetPropertyId, async (tenantDb) => {
        await tenantDb.insert(passwordResetTokensTable).values({
          profileId: profile.profileId,
          propertyId: targetPropertyId,
          tokenHash,
          expiresAt,
        });
        await tenantDb
          .update(profilePortalAccountsTable)
          .set({
            failedAttempts: 0,
            lockedUntil: null,
            updatedAt: new Date(),
          })
          .where(eq(profilePortalAccountsTable.id, account.id));
      });

      await logActivity({
        req,
        propertyId: targetPropertyId,
        username: profile.profileId,
        userRole: "profile",
        action: "بدء استعادة كلمة المرور",
        actionType: "UPDATE",
        module: "portal_auth",
        severity: "info",
      });

      res.json({ success: true, token: rawToken });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Internal error" });
    }
  },
);

const ForgotPasswordResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1),
});

router.post(
  "/forgot-password/reset",
  portalLoginRateLimit,
  async (req, res): Promise<void> => {
    try {
      const parsed = ForgotPasswordResetSchema.safeParse(req.body);
      if (!parsed.success) {
        res
          .status(400)
          .json({
            success: false,
            message: parsed.error.errors[0]?.message || "Missing fields",
          });
        return;
      }
      const { token, newPassword, confirmPassword } = parsed.data;

      const pwdParsed = ChangePasswordSchema.safeParse({
        currentPassword: "dummy",
        newPassword,
        confirmPassword,
      });
      if (!pwdParsed.success) {
        res
          .status(400)
          .json({
            success: false,
            message: pwdParsed.error.errors[0]?.message || "Invalid password",
          });
        return;
      }

      const tokenHash = createHash("sha256").update(token).digest("hex");
      const properties = await db.select().from(propertiesTable);

      let validToken: any = null;
      let targetPropertyId: number | null = null;
      let account: any = null;

      for (const p of properties) {
        try {
          const result = await withTenant(p.id, async (tenantDb) => {
            const [tok] = await tenantDb
              .select()
              .from(passwordResetTokensTable)
              .where(
                and(
                  eq(passwordResetTokensTable.tokenHash, tokenHash),
                  sql`${passwordResetTokensTable.usedAt} IS NULL`,
                  sql`${passwordResetTokensTable.expiresAt} > NOW()`,
                ),
              )
              .limit(1);
            if (!tok) return null;
            const [acc] = await tenantDb
              .select()
              .from(profilePortalAccountsTable)
              .where(eq(profilePortalAccountsTable.profileId, tok.profileId))
              .limit(1);
            return { tok, acc, propertyId: p.id };
          });
          if (result?.tok) {
            validToken = result.tok;
            account = result.acc;
            targetPropertyId = result.propertyId;
            break;
          }
        } catch {}
      }

      if (!validToken || !account || !targetPropertyId) {
        res
          .status(400)
          .json({
            success: false,
            message: "رابط استعادة كلمة المرور غير صالح أو منتهي الصلاحية",
          });
        return;
      }

      const hashedNew = await bcrypt.hash(newPassword, 12);

      await withTenant(targetPropertyId, async (tenantDb) => {
        await tenantDb
          .update(passwordResetTokensTable)
          .set({ usedAt: new Date() })
          .where(eq(passwordResetTokensTable.id, validToken.id));

        await tenantDb
          .update(profilePortalAccountsTable)
          .set({
            passwordHash: hashedNew,
            mustChangePassword: false,
            failedAttempts: 0,
            lockedUntil: null,
            passwordChangedAt: new Date(),
            updatedAt: new Date(),
          })
          .where(eq(profilePortalAccountsTable.id, account.id));
      });

      await logActivity({
        req,
        propertyId: targetPropertyId,
        username: account.profileId,
        userRole: "profile",
        action: "تمت استعادة كلمة المرور بنجاح",
        actionType: "UPDATE",
        module: "portal_auth",
        severity: "info",
      });

      res.json({ success: true, message: "تم تغيير كلمة المرور بنجاح" });
    } catch (err: any) {
      res.status(500).json({ success: false, message: "Internal error" });
    }
  },
);

export default router;
