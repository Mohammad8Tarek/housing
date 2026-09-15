import { Router } from "express";
import crypto from "node:crypto";
import { db, usersTable, userPasswordResetOtpsTable } from "@workspace/db";
import { eq, sql, desc, and, or } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";
import { sendOtpEmail } from "../lib/email-service.js";
import { logActivity, getClientIp } from "../lib/activity-logger.js";
import {
  loginRateLimit,
  changePasswordRateLimit,
  resetLoginAttempts,
} from "../middlewares/rate-limit.js";
import {
  getPasswordPolicy,
  validatePassword,
  checkPasswordHistory,
  recordPasswordHistory,
  cleanupOldPasswordHistory,
  isPasswordExpired,
  PasswordPolicy,
} from "../lib/password-policy.js";
import { BCRYPT_ROUNDS } from "../lib/security-constants.js";
import { formatZodError } from "../utils/error-response.js";
import { createWsAuthToken } from "../lib/ws-auth-token.js";

const router: Router = Router();

const normalizeRole = (role: unknown): string =>
  String(role ?? "")
    .trim()
    .toLowerCase();

// ─── POST /auth/login ─────────────────────────────────────────────────────
router.post("/auth/login", async (req, res): Promise<void> => {
  const parsed = LoginBody.safeParse(req.body);
  if (!parsed.success) {
    const ar = (req.headers["accept-language"] ?? "")
      .toLowerCase()
      .startsWith("ar");
    res
      .status(400)
      .json({ success: false, message: formatZodError(parsed.error, ar) });
    return;
  }

  const { username, password } = parsed.data;
  const ip = getClientIp(req);

  const [user] = await db
    .select()
    .from(usersTable)
    .where(sql`lower(${usersTable.username}) = lower(${username.trim()})`)
    .limit(1);

  if (!user) {
    await logActivity({
      req,
      propertyId: null,
      username: username.trim(),
      action: "LOGIN_FAILED_UNKNOWN_USER",
      actionType: "SECURITY",
      module: "auth",
      severity: "warning",
      details: `Failed login attempt with non-existent username "${username.trim()}" from ${ip}`,
      ipAddress: ip,
    });
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const propertyId = user.propertyId ?? 0;
  const policy = propertyId
    ? await getPasswordPolicy(propertyId)
    : await getPasswordPolicy(0);

  // ─── Account Lockout Check ──────────────────────────────────────────
  if (user.lockedUntil && new Date(user.lockedUntil) > new Date()) {
    const remaining = Math.ceil(
      (new Date(user.lockedUntil).getTime() - Date.now()) / 60000,
    );
    await logActivity({
      req,
      propertyId,
      username,
      userId: user.id,
      userRole: user.roles?.[0],
      action: "LOGIN_BLOCKED_LOCKED",
      actionType: "SECURITY",
      module: "auth",
      severity: "warning",
      details: `Blocked login attempt from ${ip} — account locked for ${remaining} more minutes`,
      ipAddress: ip,
    });
    res.status(423).json({
      error: `الحساب مقفل. حاول مرة أخرى بعد ${remaining} دقيقة`,
      code: "ACCOUNT_LOCKED",
      retryAfterMinutes: remaining,
    });
    return;
  }

  const valid = await bcrypt.compare(password, user.passwordHash);
  if (!valid) {
    const threshold = policy.lockoutThreshold ?? 5;

    // Atomic SQL increment to prevent race-condition undercounting
    // Two parallel failed requests could each read the same count and write count+1,
    // both bypassing the lockout threshold. SET x = x + 1 eliminates the read-modify-write gap.
    await db
      .update(usersTable)
      .set({
        failedLoginAttempts: sql`${usersTable.failedLoginAttempts} + 1`,
        lockedUntil: sql`CASE
          WHEN ${usersTable.failedLoginAttempts} + 1 >= ${threshold}
          THEN NOW() + INTERVAL '1 minute' * ${policy.lockoutDurationMinutes ?? 15}
          ELSE NULL
        END`,
      })
      .where(eq(usersTable.id, user.id));

    // Re-fetch the post-update row to get the accurate count and lockout state
    const [updated] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, user.id))
      .limit(1);

    const newCount = updated.failedLoginAttempts ?? 0;
    const lockedUntil = updated.lockedUntil;
    const remainingBeforeLock = Math.max(0, threshold - newCount);

    if (lockedUntil && new Date(lockedUntil) > new Date()) {
      const lockMinutes = policy.lockoutDurationMinutes ?? 15;

      await logActivity({
        req,
        propertyId,
        username,
        userId: user.id,
        userRole: user.roles?.[0],
        action: "ACCOUNT_LOCKED",
        actionType: "SECURITY",
        module: "auth",
        severity: "high",
        details: `Account locked for ${lockMinutes} minutes after ${newCount} failed attempts from ${ip}`,
        ipAddress: ip,
      });

      res.status(423).json({
        error: `تم قفل الحساب. حاول مرة أخرى بعد ${lockMinutes} دقيقة`,
        code: "ACCOUNT_LOCKED",
        lockedUntil: lockedUntil.toISOString(),
        retryAfterMinutes: lockMinutes,
      });
      return;
    }

    await logActivity({
      req,
      propertyId,
      username,
      userId: user.id,
      userRole: user.roles?.[0],
      action: "LOGIN_FAILED",
      actionType: "SECURITY",
      module: "auth",
      severity: "warning",
      details: `Failed login attempt ${newCount}/${threshold} from ${ip}`,
      ipAddress: ip,
    });

    res.status(401).json({
      error: `بيانات الدخول غير صحيحة. متبقي ${remainingBeforeLock} محاولات قبل قفل الحساب`,
      code: "INVALID_CREDENTIALS",
      failedAttempts: newCount,
      maxAttempts: threshold,
      remainingAttempts: remainingBeforeLock,
    });
    return;
  }

  if (user.status?.toLowerCase() === "inactive") {
    res.status(401).json({ error: "Account disabled" });
    return;
  }

  // ─── Reset lockout counters on success ──────────────────────────────
  await db
    .update(usersTable)
    .set({
      failedLoginAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
    })
    .where(eq(usersTable.id, user.id));

  // ✅ إعادة تعيين عداد rate limit بعد نجاح الدخول
  resetLoginAttempts(req);

  // ─── Check password expiry ──────────────────────────────────────────
  const passwordExpired = await isPasswordExpired(user, policy);

  // ✅ Session Regeneration — prevents Session Fixation Attack
  // Also prevents 502 when browser sends a stale/destroyed session cookie
  const roles = (user.roles ?? []).map(normalizeRole);
  const isSystemAdmin =
    roles.includes("super_admin") ||
    roles.includes("system_admin");

  const sessionData = {
    userId: user.id,
    propertyId: user.propertyId,
    isSystemAdmin,
    username: user.username,
    userRole: user.roles?.[0] ?? null,
    jobTitle: user.jobTitle ?? null,
    loginAt: Date.now(),
    passwordExpired,
  };

  // ✅ Regenerate session to get a fresh session ID (prevents stale cookie issues)
  req.session.regenerate((regenErr: any) => {
    if (regenErr) {
      console.error("[auth/login] Session regenerate error:", regenErr.message);
      // Fallback: assign directly if regenerate fails
      Object.assign(req.session, sessionData);
    } else {
      Object.assign(req.session, sessionData);
    }

    // Explicitly save the session before responding
    req.session.save((saveErr: any) => {
      if (saveErr) {
        console.error("[auth/login] Session save error:", saveErr.message);
      }

      if (user.propertyId) {
        logActivity({
          req,
          propertyId: user.propertyId ?? 0,
          username: user.username,
          userId: user.id,
          userRole: user.roles?.[0],
          action: "LOGIN",
          actionType: "AUTH",
          module: "auth",
          severity: "info",
          details: `User logged in from ${ip}${passwordExpired ? " (password expired)" : ""}`,
          ipAddress: ip,
        }).catch((err) => {
          console.error("[auth/login] Activity log error:", err);
        });
      }

      const { passwordHash: _, ...safeUser } = user;
      res.json({
        user: {
          ...safeUser,
          isSystemAdmin: sessionData.isSystemAdmin,
          passwordExpired,
        },
        token: req.sessionID || "session_active",
        sessionId: req.sessionID,
      });
    });
  });
});

router.get("/auth/ws-token", (req, res): void => {
  const session = req.session as any;
  const userId = Number(session?.userId);
  const sessionPropertyId = Number(session?.propertyId);
  const requestedPropertyId = Number(req.query["propertyId"] ?? 0);
  const isSystemAdmin = Boolean(session?.isSystemAdmin);
  const propertyId = requestedPropertyId || sessionPropertyId;

  if (!userId || !sessionPropertyId || !propertyId) {
    res.status(401).json({ success: false, message: "Unauthorized" });
    return;
  }

  if (!isSystemAdmin && propertyId !== sessionPropertyId) {
    res.status(403).json({ success: false, message: "Access denied" });
    return;
  }

  const token = createWsAuthToken({
    userId,
    propertyId,
    username: String(session?.username ?? "unknown"),
    isSystemAdmin,
  });

  res.json({ token, expiresIn: 60 });
});

// ─── POST /auth/logout ────────────────────────────────────────────────────
router.post("/auth/logout", async (req, res): Promise<void> => {
  const session = req.session as any;
  const userId = session?.userId;
  const propertyId = session?.propertyId;

  if (userId && propertyId) {
    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (user) {
      await logActivity({
        req,
        propertyId,
        username: user.username,
        userId: user.id,
        userRole: user.roles?.[0],
        action: "LOGOUT",
        actionType: "AUTH",
        module: "auth",
        severity: "info",
        details: "User logged out",
        ipAddress: getClientIp(req),
      });
    }
  }

  // ✅ Clear cookie BEFORE sending response so the browser removes it
  res.clearCookie("sunrise.sid", {
    httpOnly: true,
    secure: process.env["NODE_ENV"] === "production",
    sameSite: process.env["NODE_ENV"] === "production" ? "none" : "lax",
  });

  req.session.destroy((err) => {
    if (err) {
      console.error("Session destroy error:", err.message);
    }
    // Respond inside the callback to guarantee destroy completes first
    res.json({ message: "Logged out" });
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
  console.log(`[AUTH_ME_ROUTE] userId=${userId}, sessionID=${req.sessionID}, cookie=${req.headers.cookie}, xSid=${req.headers["x-session-id"]}`);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return;
  }

  const roles = (user.roles ?? []).map(normalizeRole);
  const isSystemAdmin =
    roles.includes("super_admin") ||
    roles.includes("system_admin");

  const session = req.session as any;
  const passwordExpired = session?.passwordExpired ?? false;

  const { passwordHash: _, ...safeUser } = user;
  res.json({ ...safeUser, isSystemAdmin, passwordExpired });
});

// ─── POST /auth/change-password ───────────────────────────────────────────
router.post(
  "/auth/change-password",
  changePasswordRateLimit,
  async (req, res): Promise<void> => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const parsed = ChangePasswordBody.safeParse(req.body);
    if (!parsed.success) {
      const ar = (req.headers["accept-language"] ?? "")
        .toLowerCase()
        .startsWith("ar");
      res
        .status(400)
        .json({ success: false, message: formatZodError(parsed.error, ar) });
      return;
    }

    const [user] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, userId))
      .limit(1);
    if (!user) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      res.status(401).json({ error: "Current password is incorrect" });
      return;
    }

    const propertyId = user.propertyId ?? 0;
    const policy = propertyId
      ? await getPasswordPolicy(propertyId)
      : await getPasswordPolicy(0);

    // ─── Validate new password against policy ───────────────────────────
    const validation = validatePassword(parsed.data.newPassword, policy);
    if (!validation.valid) {
      res.status(400).json({ error: validation.errors.join("; ") });
      return;
    }

    // ─── Check password history (reuse prevention) ──────────────────────
    const historyError = await checkPasswordHistory(
      userId,
      parsed.data.newPassword,
      policy.historyCount,
    );
    if (historyError) {
      res.status(400).json({ error: historyError });
      return;
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, BCRYPT_ROUNDS);

    await db
      .update(usersTable)
      .set({
        passwordHash: newHash,
        passwordChangedAt: new Date(),
      })
      .where(eq(usersTable.id, userId));

    // ─── Record password history ────────────────────────────────────────
    await recordPasswordHistory(userId, newHash);
    await cleanupOldPasswordHistory(userId, policy.historyCount);

    // Clear passwordExpired flag from session
    const session = req.session as any;
    if (session) {
      session.passwordExpired = false;
    }

    const ip = getClientIp(req);
    await logActivity({
      req,
      propertyId: user.propertyId ?? 0,
      username: user.username,
      userId: user.id,
      userRole: user.roles?.[0],
      action: "PASSWORD_CHANGED",
      actionType: "SECURITY",
      module: "auth",
      severity: "info",
      ipAddress: ip,
    });

    res.json({ message: "Password changed successfully" });
  },
);

// ─── POST /auth/switch-property ───────────────────────────────────────────
router.post("/auth/switch-property", async (req, res): Promise<void> => {
  const session = req.session as any;
  const userId = session?.userId;
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return;
  }

  const newPropertyId = Number(req.body?.propertyId);
  // Guard against NaN, zero, negative values that could slip past DB constraints
  if (!Number.isFinite(newPropertyId) || newPropertyId <= 0) {
    res.status(400).json({ error: "A valid positive propertyId is required" });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  // Use normalizeRole (defined above) for consistent case-insensitive role matching
  // Previously used `user.roles.includes("SYSTEM_ADMIN")` — that (uppercase) never matched
  // the lowercase-stored roles, silently denying system admins the bypass they should have.
  const isSystemAdmin =
    (user.roles ?? []).map(normalizeRole).includes("super_admin") ||
    (user.roles ?? []).map(normalizeRole).includes("system_admin");

  if (!isSystemAdmin) {
    const allowedIds: number[] = (user as any).propertyIds?.length
      ? (user as any).propertyIds
      : user.propertyId
        ? [user.propertyId]
        : [];
    if (!allowedIds.includes(newPropertyId)) {
      // Log denied attempts — could indicate privilege escalation probing
      await logActivity({
        req,
        propertyId: newPropertyId,
        username: user.username,
        userId: user.id,
        userRole: user.roles?.[0],
        action: "PROPERTY_SWITCH_DENIED",
        actionType: "SECURITY",
        module: "auth",
        severity: "warning",
        details: `Access denied switching to property ${newPropertyId} (allowed: ${JSON.stringify(allowedIds)})`,
        ipAddress: getClientIp(req),
      });
      res.status(403).json({ error: "Access denied to this property" });
      return;
    }
  }

  const oldPropertyId = session.propertyId;
  session.propertyId = newPropertyId;

  // Respond immediately, express-session will save in background
  if (oldPropertyId !== newPropertyId) {
    logActivity({
      req,
      propertyId: newPropertyId,
      username: user.username,
      userId: user.id,
      userRole: user.roles?.[0],
      action: "PROPERTY_SWITCH",
      actionType: "UPDATE",
      module: "auth",
      severity: "info",
      details: `Switched from property ${oldPropertyId ?? "none"} to ${newPropertyId}`,
      ipAddress: getClientIp(req),
    }).catch((err) => {
      console.error("[auth/property-switch] Activity log error:", err);
    });
  }

  res.json({ success: true, propertyId: newPropertyId });
});

// ─── HELPER: Mask Email ──────────────────────────────────────────────────
function maskEmail(email: string): string {
  const parts = email.split("@");
  if (parts.length !== 2) return email;
  const [name, domain] = parts;
  if (name.length <= 2) {
    return `${name[0]}*@${domain}`;
  }
  const first = name.slice(0, 2);
  const last = name.slice(-1);
  return `${first}${"*".repeat(Math.max(name.length - 3, 2))}${last}@${domain}`;
}

// ─── POST /auth/forgot-password/request-otp ──────────────────────────────
router.post("/auth/forgot-password/request-otp", async (req, res): Promise<void> => {
  const identifier = String(req.body?.identifier || "").trim();
  if (!identifier) {
    res.status(400).json({
      error: "يرجى إدخال اسم المستخدم أو البريد الإلكتروني / Username or email is required",
    });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      or(
        sql`lower(${usersTable.username}) = lower(${identifier})`,
        sql`lower(${usersTable.email}) = lower(${identifier})`,
      ),
    )
    .limit(1);

  if (!user) {
    res.status(404).json({
      error: "اسم المستخدم أو البريد الإلكتروني غير مسجل في النظام / User account not found",
    });
    return;
  }

  if (user.status && user.status.toLowerCase() !== "active") {
    res.status(403).json({
      error: "هذا الحساب غير نشط أو تم تعطيله / This account is inactive or disabled",
    });
    return;
  }

  if (!user.email || !user.email.includes("@")) {
    res.status(400).json({
      error:
        "هذا الحساب ليس لديه بريد إلكتروني مسجل. يرجى التواصل مع مسؤول النظام لتحديث بياناتك / No email address registered for this account. Please contact system administrator.",
    });
    return;
  }

  // Rate Limiting & Progressive Cooldown
  const [latestOtp] = await db
    .select()
    .from(userPasswordResetOtpsTable)
    .where(eq(userPasswordResetOtpsTable.userId, user.id))
    .orderBy(desc(userPasswordResetOtpsTable.createdAt))
    .limit(1);

  let resendCount = 0;
  if (latestOtp) {
    const lastActionTime = latestOtp.lastResendAt || latestOtp.createdAt;
    const secondsSinceLast = Math.floor(
      (Date.now() - new Date(lastActionTime).getTime()) / 1000,
    );

    // Cooldown progression:
    // 0 resends -> 60s
    // 1 resend  -> 120s
    // 2+ resends -> 300s (5 minutes)
    const requiredCooldown =
      latestOtp.resendCount === 0
        ? 60
        : latestOtp.resendCount === 1
          ? 120
          : 300;

    if (secondsSinceLast < requiredCooldown && secondsSinceLast < 1800) {
      const remainingCooldown = requiredCooldown - secondsSinceLast;
      res.status(429).json({
        error: `يرجى الانتظار ${remainingCooldown} ثانية قبل إعادة إرسال رمز جديد / Please wait ${remainingCooldown}s before requesting a new code`,
        cooldownSeconds: remainingCooldown,
        retryAfterSeconds: remainingCooldown,
      });
      return;
    }

    resendCount = secondsSinceLast > 1800 ? 0 : latestOtp.resendCount + 1;
  }

  // Generate 6-digit cryptographically secure OTP
  const otpCode = crypto.randomInt(100000, 999999).toString();
  const otpHash = await bcrypt.hash(otpCode, 10);
  const TTL_SECONDS = 120; // Exactly 2 minutes per requirements
  const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000);

  // Invalidate older OTP records for this user
  await db
    .delete(userPasswordResetOtpsTable)
    .where(eq(userPasswordResetOtpsTable.userId, user.id));

  // Insert fresh OTP record
  await db.insert(userPasswordResetOtpsTable).values({
    userId: user.id,
    identifier: user.username,
    otpHash,
    attempts: 0,
    maxAttempts: 5,
    isVerified: false,
    resendCount,
    lastResendAt: new Date(),
    expiresAt,
  });

  const nextCooldownSeconds =
    resendCount === 0 ? 60 : resendCount === 1 ? 120 : 300;

  // Retrieve tenant SMTP config from database settings if configured
  let smtpConfig: any = undefined;
  if (user.propertyId && Number(user.propertyId) > 0) {
    try {
      const tenantSettings = await withTenant(Number(user.propertyId), async (tenantDb) => {
        const [s] = await tenantDb.select().from(settingsTable).limit(1);
        return s;
      });
      if (tenantSettings?.smtpHost && tenantSettings?.smtpUser && tenantSettings?.smtpPass) {
        smtpConfig = {
          smtpHost: tenantSettings.smtpHost,
          smtpPort: tenantSettings.smtpPort,
          smtpSecure: tenantSettings.smtpSecure,
          smtpUser: tenantSettings.smtpUser,
          smtpPass: tenantSettings.smtpPass,
          smtpFrom: tenantSettings.smtpFrom,
        };
      }
    } catch (e: any) {
      console.warn("[auth/request-otp] Could not load tenant SMTP config:", e?.message);
    }
  }

  // Send Email (SMTP from DB or environment with console fallback)
  await sendOtpEmail({
    toEmail: user.email,
    recipientName: user.username,
    otpCode,
    expiresInSeconds: TTL_SECONDS,
    config: smtpConfig,
  });

  await logActivity({
    req,
    propertyId: user.propertyId ?? 0,
    username: user.username,
    userId: user.id,
    userRole: user.roles?.[0],
    action: "PASSWORD_RESET_OTP_REQUESTED",
    actionType: "SECURITY",
    module: "auth",
    severity: "info",
    details: `Password reset OTP generated for ${user.username} (sent to ${maskEmail(user.email)})`,
    ipAddress: getClientIp(req),
  });

  res.json({
    success: true,
    message:
      "تم إرسال رمز التحقق إلى بريدك الإلكتروني بنجاح / Verification code sent to your email",
    maskedEmail: maskEmail(user.email),
    expiresInSeconds: TTL_SECONDS,
    cooldownSeconds: nextCooldownSeconds,
    resendCount,
    debugOtp: process.env.NODE_ENV !== "production" ? otpCode : undefined,
  });
});

// ─── POST /auth/forgot-password/verify-otp ───────────────────────────────
router.post("/auth/forgot-password/verify-otp", async (req, res): Promise<void> => {
  const identifier = String(req.body?.identifier || "").trim();
  const otp = String(req.body?.otp || "").trim();

  if (!identifier || !otp) {
    res.status(400).json({
      error:
        "اسم المستخدم ورمز التحقق مطلوبان / Username and OTP code are required",
    });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      or(
        sql`lower(${usersTable.username}) = lower(${identifier})`,
        sql`lower(${usersTable.email}) = lower(${identifier})`,
      ),
    )
    .limit(1);

  if (!user) {
    res.status(404).json({
      error: "الحساب غير موجود / User account not found",
    });
    return;
  }

  const [otpRecord] = await db
    .select()
    .from(userPasswordResetOtpsTable)
    .where(
      and(
        eq(userPasswordResetOtpsTable.userId, user.id),
        eq(userPasswordResetOtpsTable.isVerified, false),
      ),
    )
    .orderBy(desc(userPasswordResetOtpsTable.createdAt))
    .limit(1);

  if (!otpRecord) {
    res.status(400).json({
      error:
        "لم يتم العثور على طلب استعادة نشط. يرجى طلب رمز جديد / No active reset request found. Please request a new code.",
    });
    return;
  }

  // Check expiration (Strict 120s / 2 mins)
  if (new Date() > new Date(otpRecord.expiresAt)) {
    res.status(400).json({
      error:
        "انتهت صلاحية رمز التحقق (أكثر من دقيقتين). يرجى طلب رمز جديد / Verification code has expired. Please request a new code.",
      code: "OTP_EXPIRED",
    });
    return;
  }

  // Check attempt limit
  if (otpRecord.attempts >= otpRecord.maxAttempts) {
    res.status(400).json({
      error:
        "تم استنفاد الحد الأقصى لمحاولات إدخال الرمز (5 محاولات). يرجى طلب رمز جديد / Maximum attempts reached. Please request a new code.",
      code: "MAX_ATTEMPTS_EXCEEDED",
    });
    return;
  }

  // Verify OTP code hash
  const isValid = await bcrypt.compare(otp, otpRecord.otpHash);
  if (!isValid) {
    const newAttempts = otpRecord.attempts + 1;
    await db
      .update(userPasswordResetOtpsTable)
      .set({ attempts: newAttempts })
      .where(eq(userPasswordResetOtpsTable.id, otpRecord.id));

    const remaining = Math.max(0, otpRecord.maxAttempts - newAttempts);
    res.status(400).json({
      error: `رمز التحقق غير صحيح. المحاولات المتبقية: ${remaining} / Invalid verification code. Remaining attempts: ${remaining}`,
      remainingAttempts: remaining,
    });
    return;
  }

  // OTP is verified! Generate secure reset token
  const resetToken = crypto.randomBytes(32).toString("hex");
  const tokenHash = await bcrypt.hash(resetToken, 10);

  // Mark record as verified, grant 10 minutes to submit new password
  await db
    .update(userPasswordResetOtpsTable)
    .set({
      isVerified: true,
      tokenHash,
      expiresAt: new Date(Date.now() + 600 * 1000),
    })
    .where(eq(userPasswordResetOtpsTable.id, otpRecord.id));

  res.json({
    success: true,
    message: "تم التحقق من الرمز بنجاح / Verification successful",
    resetToken,
  });
});

// ─── POST /auth/forgot-password/reset-password ───────────────────────────
router.post("/auth/forgot-password/reset-password", async (req, res): Promise<void> => {
  const identifier = String(req.body?.identifier || "").trim();
  const resetToken = String(req.body?.resetToken || "").trim();
  const newPassword = String(req.body?.newPassword || "").trim();

  if (!identifier || !resetToken || !newPassword) {
    res.status(400).json({
      error: "جميع الحقول مطلوبة / All fields are required",
    });
    return;
  }

  const [user] = await db
    .select()
    .from(usersTable)
    .where(
      or(
        sql`lower(${usersTable.username}) = lower(${identifier})`,
        sql`lower(${usersTable.email}) = lower(${identifier})`,
      ),
    )
    .limit(1);

  if (!user) {
    res.status(404).json({ error: "الحساب غير موجود / User not found" });
    return;
  }

  // Find verified OTP session
  const [otpRecord] = await db
    .select()
    .from(userPasswordResetOtpsTable)
    .where(
      and(
        eq(userPasswordResetOtpsTable.userId, user.id),
        eq(userPasswordResetOtpsTable.isVerified, true),
      ),
    )
    .orderBy(desc(userPasswordResetOtpsTable.createdAt))
    .limit(1);

  if (!otpRecord || !otpRecord.tokenHash) {
    res.status(400).json({
      error:
        "جلسة التحقق غير صالحة. يرجى إعادة المحاولة من البداية / Invalid reset session. Please start over.",
    });
    return;
  }

  if (new Date() > new Date(otpRecord.expiresAt)) {
    res.status(400).json({
      error:
        "انتهت مهلة جلسة تغيير كلمة المرور. يرجى إعادة طلب رمز التحقق / Reset session expired. Please request a new OTP.",
    });
    return;
  }

  const isTokenValid = await bcrypt.compare(resetToken, otpRecord.tokenHash);
  if (!isTokenValid) {
    res.status(403).json({
      error: "رمز المصادقة غير صالح / Invalid reset token",
    });
    return;
  }

  // Enforce Password Policy
  const propertyId = user.propertyId ?? 0;
  const policy = await getPasswordPolicy(propertyId);
  const validation = validatePassword(newPassword, policy);
  if (!validation.valid) {
    res.status(400).json({
      error: validation.errors.join(". "),
      errors: validation.errors,
    });
    return;
  }

  // Enforce Password History
  const historyError = await checkPasswordHistory(
    user.id,
    newPassword,
    policy.historyCount,
  );
  if (historyError) {
    res.status(400).json({ error: historyError });
    return;
  }

  // Hash new password and update user account
  const passwordHash = await bcrypt.hash(newPassword, BCRYPT_ROUNDS);

  await db
    .update(usersTable)
    .set({
      passwordHash,
      passwordChangedAt: new Date(),
      failedLoginAttempts: 0,
      lockedUntil: null,
    })
    .where(eq(usersTable.id, user.id));

  // Record into password history and cleanup
  await recordPasswordHistory(user.id, passwordHash);
  await cleanupOldPasswordHistory(user.id, policy.historyCount);

  // Remove the consumed OTP record
  await db
    .delete(userPasswordResetOtpsTable)
    .where(eq(userPasswordResetOtpsTable.id, otpRecord.id));

  // Log security event
  await logActivity({
    req,
    propertyId: user.propertyId ?? 0,
    username: user.username,
    userId: user.id,
    userRole: user.roles?.[0],
    action: "PASSWORD_RESET_SUCCESS",
    actionType: "SECURITY",
    module: "auth",
    severity: "info",
    details: `Password successfully reset via verified OTP for user ${user.username}`,
    ipAddress: getClientIp(req),
  });

  res.json({
    success: true,
    message:
      "تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة / Password reset successfully! You can now log in.",
  });
});

export default router;
