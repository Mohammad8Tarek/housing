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
import { eq, and, sql, or, ilike } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { logActivity } from "../../lib/activity-logger.js";
import { ensureProfilePortalAccount } from "../../lib/portal-accounts.js";
import { portalLoginRateLimit } from "../../middlewares/rate-limit.js";
import {
  ChangePasswordSchema,
  toAsciiDigits,
  normalizeDateOnly,
  ForgotPasswordVerifySchema,
  ForgotPasswordResetSchema,
} from "./shared.js";

const router: Router = Router();

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

      const rawProfileId = (
        parsed.data.profileId ||
        parsed.data.employeeId ||
        ""
      ).trim();
      const profileId = toAsciiDigits(rawProfileId).trim();
      const { nationalId, roomNumber, dateOfBirth } = parsed.data;
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
              .where(
                or(
                  eq(profilesTable.profileId, profileId),
                  eq(profilesTable.profileId, rawProfileId),
                  ilike(profilesTable.profileId, profileId),
                ),
              )
              .limit(1);
            if (!emp) return null;
            const [acc] = await tenantDb
              .select()
              .from(profilePortalAccountsTable)
              .where(
                or(
                  eq(profilePortalAccountsTable.profileId, emp.profileId),
                  eq(profilePortalAccountsTable.profileId, profileId),
                  eq(profilePortalAccountsTable.profileId, rawProfileId),
                ),
              )
              .orderBy(sql`id DESC`)
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

      if (!profile || !targetPropertyId) {
        res.status(400).json({ success: false, message: genericErrorMsg });
        return;
      }

      if (!account) {
        await ensureProfilePortalAccount(targetPropertyId, profile.profileId);
        account = await withTenant(targetPropertyId, async (tenantDb) => {
          const [acc] = await tenantDb
            .select()
            .from(profilePortalAccountsTable)
            .where(eq(profilePortalAccountsTable.profileId, profile.profileId))
            .orderBy(sql`id DESC`)
            .limit(1);
          return acc;
        });
      }

      if (account?.resetLockedUntil && account.resetLockedUntil > new Date()) {
        res.status(429).json({
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

      const cleanInputNationalId = toAsciiDigits(nationalId).replace(/\D/g, "");
      const cleanDbNationalId = profile.nationalId
        ? toAsciiDigits(String(profile.nationalId)).replace(/\D/g, "")
        : "";
      const isNationalIdMatch = Boolean(
        cleanDbNationalId && cleanDbNationalId === cleanInputNationalId,
      );

      const cleanInputDob = normalizeDateOnly(dateOfBirth);
      const cleanDbDob = normalizeDateOnly(profile.dateOfBirth);
      const isDobMatch = Boolean(cleanDbDob && cleanDbDob === cleanInputDob);

      const cleanInputRoom = toAsciiDigits(roomNumber).trim().toLowerCase();
      const cleanDbRoom = assignment?.roomNumber
        ? toAsciiDigits(String(assignment.roomNumber)).trim().toLowerCase()
        : "";
      const isRoomMatch = Boolean(
        cleanDbRoom &&
        (cleanDbRoom === cleanInputRoom ||
          cleanDbRoom.replace(/^0+/, "") === cleanInputRoom.replace(/^0+/, "")),
      );

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

router.post(
  "/forgot-password/reset",
  portalLoginRateLimit,
  async (req, res): Promise<void> => {
    try {
      const parsed = ForgotPasswordResetSchema.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({
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
        res.status(400).json({
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
        res.status(400).json({
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
