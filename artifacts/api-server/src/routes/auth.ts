import { Router } from "express";
import { db, usersTable } from "@workspace/db";
import { eq, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import { LoginBody, ChangePasswordBody } from "@workspace/api-zod";
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
  const roles = (user.roles ?? []).map(normalizeRole);
  const isSystemAdmin =
    roles.includes("super_admin") ||
    roles.includes("system_admin") ||
    roles.includes("admin");

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

  // ✅ Direct session assignment (PostgreSQL store handles persistence)
  Object.assign(req.session, sessionData);

  // Save session with timeout protection
  const savePromise = new Promise<void>((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error("Session save timeout"));
    }, 5000); // 5 second timeout

    req.session.save((err: any) => {
      clearTimeout(timeout);
      if (err) reject(err);
      else resolve();
    });
  });

  try {
    await savePromise;

    if (user.propertyId) {
      await logActivity({
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
      });
    }

    const { passwordHash: _, ...safeUser } = user;
    res.json({
      user: {
        ...safeUser,
        isSystemAdmin: sessionData.isSystemAdmin,
        passwordExpired,
      },
    });
  } catch (sessionErr) {
    console.error("[auth/login] Session error:", sessionErr);
    res.status(500).json({ error: "Session operation failed" });
  }
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

  req.session.destroy((err) => {
    // Always clear cookie and respond, even if session store is unreachable
    // (e.g., Redis/PG down). Otherwise, the client hangs indefinitely.
    if (err) {
      console.error("Session destroy error:", err.message);
    }
    res.clearCookie("sunrise.sid");
    res.json({ message: "Logged out" });
  });
});

// ─── GET /auth/me ─────────────────────────────────────────────────────────
router.get("/auth/me", async (req, res): Promise<void> => {
  const userId = (req.session as any)?.userId;
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
    roles.includes("system_admin") ||
    roles.includes("admin");

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

  await new Promise<void>((resolve, reject) =>
    req.session.save((err: any) => (err ? reject(err) : resolve())),
  );

  if (oldPropertyId !== newPropertyId) {
    await logActivity({
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
    });
  }

  res.json({ success: true, propertyId: newPropertyId });
});

export default router;
