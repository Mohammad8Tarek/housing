// Two-step verification management.
// - Your own account: status, set up (QR + secret), enable with a code
//   (returns one-time recovery codes), new recovery codes, disable (password
//   + code).
// - Admins (users.edit, on users they may manage): see whether a user has it
//   and reset it when the user lost their phone.
import { Router, type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import { eq } from "drizzle-orm";
import { db, userMfaTable, usersTable } from "@workspace/db";
import { requirePermission } from "../middlewares/permissions.js";
import { validate } from "../middlewares/validate.js";
import {
  IdParams,
  TwoFactorCodeBody,
  TwoFactorDisableBody,
} from "../validation/schemas.js";
import {
  decryptSecret,
  encryptSecret,
  hashRecoveryCode,
  matchRecoveryCode,
  newRecoveryCodes,
  newSecret,
  otpauthUrl,
  qrDataUrl,
  verifyTotp,
} from "../lib/mfa.js";
import { canActOnUser } from "../lib/user-access.js";
import { logActivity, getClientIp } from "../lib/activity-logger.js";
import { revokeUserSessions } from "../lib/session-revoke.js";
import { getPasswordPolicy } from "../lib/password-policy.js";

const router: Router = Router();

async function me(req: Request, res: Response) {
  const userId = Number((req.session as any)?.userId);
  if (!userId) {
    res.status(401).json({ error: "غير مسجل الدخول / Not authenticated" });
    return null;
  }
  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) {
    res.status(401).json({ error: "غير مسجل الدخول / Not authenticated" });
    return null;
  }
  const [mfa] = await db
    .select()
    .from(userMfaTable)
    .where(eq(userMfaTable.userId, userId))
    .limit(1);
  return { user, mfa };
}

async function upsert(
  userId: number,
  values: Partial<typeof userMfaTable.$inferInsert>,
) {
  await db
    .insert(userMfaTable)
    .values({ userId, ...values, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: userMfaTable.userId,
      set: { ...values, updatedAt: new Date() },
    });
}

const log = (
  req: Request,
  user: {
    id: number;
    username: string;
    roles?: string[] | null;
    propertyId?: number | null;
  },
  action: string,
  details: string,
  actor?: { id: number; username: string },
) =>
  logActivity({
    req,
    propertyId: user.propertyId ?? 0,
    username: actor?.username ?? user.username,
    userId: actor?.id ?? user.id,
    userRole: user.roles?.[0],
    action,
    actionType: "SECURITY",
    module: "auth",
    severity: "info",
    details,
    ipAddress: getClientIp(req),
  });

const WRONG_CODE = {
  error: "الكود غير صحيح / Wrong code",
  code: "TWO_FACTOR_INVALID",
};

// GET /auth/2fa — your status
router.get("/auth/2fa", async (req, res, next) => {
  try {
    const ctx = await me(req, res);
    if (!ctx) return;
    res.json({
      enabled: Boolean(ctx.mfa?.enabled),
      enabledAt: ctx.mfa?.enabledAt ?? null,
      recoveryCodesLeft: ctx.mfa?.enabled
        ? (ctx.mfa.recoveryHashes ?? []).length
        : 0,
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/2fa/setup — new secret (not active until confirmed with a code)
router.post("/auth/2fa/setup", async (req, res, next) => {
  try {
    const ctx = await me(req, res);
    if (!ctx) return;
    if (ctx.mfa?.enabled) {
      res.status(409).json({
        error:
          "التحقق بخطوتين مفعّل بالفعل / Two-step verification is already on",
        code: "TWO_FACTOR_ALREADY_ON",
      });
      return;
    }
    const secret = newSecret();
    await upsert(ctx.user.id, { pendingSecretEnc: encryptSecret(secret) });
    const url = otpauthUrl(secret, ctx.user.username);
    res.json({
      secret: secret.replace(/(.{4})/g, "$1 ").trim(),
      otpauthUrl: url,
      qr: await qrDataUrl(url),
    });
  } catch (err) {
    next(err);
  }
});

// POST /auth/2fa/enable { code } — confirm the app works; returns recovery codes
router.post(
  "/auth/2fa/enable",
  validate({ body: TwoFactorCodeBody }),
  async (req, res, next) => {
    try {
      const ctx = await me(req, res);
      if (!ctx) return;
      if (!ctx.mfa?.pendingSecretEnc) {
        res.status(400).json({
          error: "ابدأ الإعداد أولاً / Start the setup first",
          code: "TWO_FACTOR_NOT_SET_UP",
        });
        return;
      }
      const secret = decryptSecret(ctx.mfa.pendingSecretEnc);
      const step = verifyTotp(secret, req.body.code, null);
      if (step == null) {
        res.status(400).json(WRONG_CODE);
        return;
      }
      const codes = newRecoveryCodes();
      await upsert(ctx.user.id, {
        secretEnc: ctx.mfa.pendingSecretEnc,
        pendingSecretEnc: null,
        enabled: true,
        recoveryHashes: codes.map(hashRecoveryCode),
        lastUsedStep: step,
        enabledAt: new Date(),
      });
      await log(
        req,
        ctx.user,
        "2FA_ENABLED",
        "Two-step verification turned on",
      );
      delete (req.session as any).mfaSetupRequired;
      res.json({ enabled: true, recoveryCodes: codes });
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/2fa/recovery-codes { code } — replace the recovery codes
router.post(
  "/auth/2fa/recovery-codes",
  validate({ body: TwoFactorCodeBody }),
  async (req, res, next) => {
    try {
      const ctx = await me(req, res);
      if (!ctx) return;
      if (!ctx.mfa?.enabled || !ctx.mfa.secretEnc) {
        res
          .status(400)
          .json({ error: "التحقق بخطوتين غير مفعّل / Not enabled" });
        return;
      }
      const step = verifyTotp(
        decryptSecret(ctx.mfa.secretEnc),
        req.body.code,
        ctx.mfa.lastUsedStep,
      );
      if (step == null) {
        res.status(400).json(WRONG_CODE);
        return;
      }
      const codes = newRecoveryCodes();
      await upsert(ctx.user.id, {
        recoveryHashes: codes.map(hashRecoveryCode),
        lastUsedStep: step,
      });
      await log(
        req,
        ctx.user,
        "2FA_RECOVERY_CODES_RENEWED",
        "New recovery codes created",
      );
      res.json({ recoveryCodes: codes });
    } catch (err) {
      next(err);
    }
  },
);

// POST /auth/2fa/disable { password, code }
router.post(
  "/auth/2fa/disable",
  validate({ body: TwoFactorDisableBody }),
  async (req, res, next) => {
    try {
      const ctx = await me(req, res);
      if (!ctx) return;
      if (!ctx.mfa?.enabled || !ctx.mfa.secretEnc) {
        res.json({ enabled: false });
        return;
      }
      const passOk = await bcrypt.compare(
        req.body.password,
        ctx.user.passwordHash,
      );
      const codeOk =
        verifyTotp(
          decryptSecret(ctx.mfa.secretEnc),
          req.body.code,
          ctx.mfa.lastUsedStep,
        ) != null ||
        matchRecoveryCode(req.body.code, ctx.mfa.recoveryHashes ?? []) >= 0;
      if (!passOk || !codeOk) {
        res.status(400).json({
          error: "كلمة المرور أو الكود غير صحيح / Wrong password or code",
          code: "TWO_FACTOR_INVALID",
        });
        return;
      }
      // A role that must have it cannot switch it off.
      const policy = await getPasswordPolicy(ctx.user.propertyId ?? 0);
      if (
        (ctx.user.roles ?? []).some((r) =>
          policy.requireTwoFactorRoles.includes(String(r).toLowerCase()),
        )
      ) {
        res.status(403).json({
          error:
            "التحقق بخطوتين إجباري لدورك ولا يمكن إيقافه / Two-step verification is mandatory for your role",
          code: "TWO_FACTOR_MANDATORY",
        });
        return;
      }
      await db.delete(userMfaTable).where(eq(userMfaTable.userId, ctx.user.id));
      await log(
        req,
        ctx.user,
        "2FA_DISABLED",
        "Two-step verification turned off",
      );
      res.json({ enabled: false });
    } catch (err) {
      next(err);
    }
  },
);

// ── Admins ───────────────────────────────────────────────────────────────────
async function managed(req: Request, res: Response) {
  const actor = (req as any).authUser;
  const [target] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, Number(req.params.id)))
    .limit(1);
  if (!target || !canActOnUser(actor, target, "manage")) {
    res.status(404).json({ error: "User not found" });
    return null;
  }
  return { actor, target };
}

// GET /users/:id/2fa — whether the user has two-step verification
router.get(
  "/users/:id/2fa",
  requirePermission("users", "view"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const actor = (req as any).authUser;
      const [target] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, Number(req.params.id)))
        .limit(1);
      if (!target || !canActOnUser(actor, target, "view")) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const [mfa] = await db
        .select({
          enabled: userMfaTable.enabled,
          enabledAt: userMfaTable.enabledAt,
        })
        .from(userMfaTable)
        .where(eq(userMfaTable.userId, target.id))
        .limit(1);
      res.json({
        enabled: Boolean(mfa?.enabled),
        enabledAt: mfa?.enabledAt ?? null,
      });
    } catch (err) {
      next(err);
    }
  },
);

// POST /users/:id/2fa/reset — turn it off for a user who lost their device
// (they set it up again after signing in; their other sessions end).
router.post(
  "/users/:id/2fa/reset",
  requirePermission("users", "edit"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const t = await managed(req, res);
      if (!t) return;
      await db.delete(userMfaTable).where(eq(userMfaTable.userId, t.target.id));
      const ended = await revokeUserSessions(
        req,
        t.target.id,
        t.target.id === t.actor.id ? req.sessionID : undefined,
      );
      await log(
        req,
        t.target,
        "2FA_RESET_BY_ADMIN",
        `Two-step verification reset for '${t.target.username}' by '${t.actor.username}' (${ended} session(s) ended)`,
        t.actor,
      );
      res.json({ success: true, enabled: false });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
