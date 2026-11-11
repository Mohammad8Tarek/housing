import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import {
  profilesTable,
  profilePortalAccountsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { logActivity } from "../../lib/activity-logger.js";
import { portalLoginRateLimit } from "../../middlewares/rate-limit.js";
import {
  MAX_FAILED,
  LOCK_MINUTES,
  isProfileActiveForPortal,
  portalSession,
  requirePortalAuth,
  LoginSchema,
  ChangePasswordSchema,
} from "./shared.js";

const router: Router = Router();

router.get("/ping", (req, res) => {
  res.json({ success: true, message: "pong_deployed" });
});

router.post("/login", portalLoginRateLimit, async (req, res): Promise<void> => {
  try {
    const parsed = LoginSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({
        success: false,
        message: "profileId or employeeId and password are required",
      });
      return;
    }

    const profileId = (
      parsed.data.profileId ||
      parsed.data.employeeId ||
      ""
    ).trim();
    const { password } = parsed.data;

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
              .where(eq(profilePortalAccountsTable.profileId, profileId.trim()))
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
    if (!isProfileActiveForPortal(profile.status)) {
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

    const userObj = {
      id: profile.id,
      profileId: profile.profileId,
      employeeId: profile.profileId,
      firstName: profile.firstName,
      lastName: profile.lastName,
      fullName: `${profile.firstName} ${profile.lastName}`,
      jobTitle: profile.jobTitle || profile.position || "",
      position: profile.jobTitle || profile.position || "",
      department: profile.department || "",
      email: profile.email || "",
      phone: profile.phone || "",
      photoUrl: profile.photoUrl || null,
      nationalId: profile.nationalId || null,
      emergencyContact: profile.emergencyContact || null,
      hireDate: profile.hireDate || null,
      address: profile.address || null,
      nationality: profile.nationality || null,
      status: profile.status || "active",
      propertyId: targetPropertyId,
    };

    await new Promise<void>((resolve) => {
      req.session.save((err: any) => {
        if (err) console.error("[portal-login] session save error:", err);
        resolve();
      });
    });

    res.json({
      success: true,
      sessionId: req.sessionID,
      mustChangePassword: account.mustChangePassword,
      profile: userObj,
      employee: userObj,
    });
  } catch (error: any) {
    console.error("Portal login error:", error);
    res
      .status(500)
      .json({ success: false, message: `Server error: ${error.message}` });
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
    if (!isProfileActiveForPortal(result.profile.status)) {
      req.session.destroy(() => {});
      res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية الدخول إلى البوابة",
      });
      return;
    }

    const userObj = {
      id: result.profile.id,
      profileId: result.profile.profileId,
      employeeId: result.profile.profileId,
      fullName: `${result.profile.firstName} ${result.profile.lastName}`,
      firstName: result.profile.firstName,
      lastName: result.profile.lastName,
      jobTitle:
        result.profile.jobTitle || (result.profile as any).position || "",
      position:
        result.profile.jobTitle || (result.profile as any).position || "",
      department: result.profile.department || "",
      nationality: result.profile.nationality || null,
      phone: result.profile.phone || "",
      email: result.profile.email || "",
      photoUrl: result.profile.photoUrl || null,
      nationalId: result.profile.nationalId || null,
      emergencyContact: result.profile.emergencyContact || null,
      gender: result.profile.gender || null,
      hireDate: result.profile.hireDate || null,
      address: result.profile.address || null,
      level: result.profile.level || null,
      status: result.profile.status || "active",
      propertyId: sess.propertyId,
    };

    res.json({
      success: true,
      profile: userObj,
      employee: userObj,
      mustChangePassword: result.account?.mustChangePassword ?? false,
      lastLoginAt:
        result.account?.lastLoginAt instanceof Date
          ? result.account.lastLoginAt.toISOString()
          : ((result.account?.lastLoginAt as unknown as string) ?? null),
    });
  } catch (error: any) {
    console.error("Portal /me error:", error);
    res
      .status(500)
      .json({ success: false, message: `Server error: ${error.message}` });
  }
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

export default router;
