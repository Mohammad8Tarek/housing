// Signed-in devices.
// - Everyone: list their own sessions, end one, or end all others.
// - Admins (users.edit) on users they may manage: list a user's sessions,
//   end one, or sign the user out everywhere.
import { Router, type Request, type Response } from "express";
import { eq } from "drizzle-orm";
import { db, usersTable } from "@workspace/db";
import { requirePermission } from "../middlewares/permissions.js";
import { validate } from "../middlewares/validate.js";
import {
  IdParams,
  SessionIdParams,
  UserSessionParams,
} from "../validation/schemas.js";
import { endUserSession, listUserSessions } from "../lib/user-sessions.js";
import { revokeUserSessions } from "../lib/session-revoke.js";
import { canActOnUser } from "../lib/user-access.js";
import { logActivity } from "../lib/activity-logger.js";

const router: Router = Router();

const NOT_AUTH = { error: "غير مسجل الدخول / Not authenticated" };

function sessionUserId(req: Request, res: Response): number | null {
  const id = Number((req.session as any)?.userId);
  if (!id) {
    res.status(401).json(NOT_AUTH);
    return null;
  }
  return id;
}

// ── Own sessions ─────────────────────────────────────────────────────────────
router.get("/auth/sessions", async (req, res, next) => {
  try {
    const userId = sessionUserId(req, res);
    if (!userId) return;
    res.json({ success: true, data: await listUserSessions(req, userId) });
  } catch (err) {
    next(err);
  }
});

router.post(
  "/auth/sessions/:sid/end",
  validate({ params: SessionIdParams }),
  async (req, res, next) => {
    try {
      const userId = sessionUserId(req, res);
      if (!userId) return;
      const ok = await endUserSession(req, userId, String(req.params.sid));
      if (!ok) {
        res
          .status(404)
          .json({ error: "الجلسة غير موجودة / Session not found" });
        return;
      }
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post("/auth/sessions/end-others", async (req, res, next) => {
  try {
    const userId = sessionUserId(req, res);
    if (!userId) return;
    const ended = await revokeUserSessions(req, userId, req.sessionID);
    res.json({ success: true, ended });
  } catch (err) {
    next(err);
  }
});

// ── A user's sessions (admins) ───────────────────────────────────────────────
async function managedTarget(req: Request, res: Response) {
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

router.get(
  "/users/:id/sessions",
  requirePermission("users", "edit"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const t = await managedTarget(req, res);
      if (!t) return;
      res.json({
        success: true,
        data: await listUserSessions(req, t.target.id),
      });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/users/:id/sessions/:sid/end",
  requirePermission("users", "edit"),
  validate({ params: UserSessionParams }),
  async (req, res, next) => {
    try {
      const t = await managedTarget(req, res);
      if (!t) return;
      const ok = await endUserSession(req, t.target.id, String(req.params.sid));
      if (!ok) {
        res
          .status(404)
          .json({ error: "الجلسة غير موجودة / Session not found" });
        return;
      }
      await logActivity({
        req,
        propertyId: t.target.propertyId ?? 0,
        username: t.actor.username,
        userId: t.actor.id,
        userRole: t.actor.roles?.[0] ?? "admin",
        action: `إنهاء جلسة للمستخدم '${t.target.username}'`,
        actionType: "UPDATE",
        module: "users",
        entityType: "user",
        entityId: t.target.id,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/users/:id/sessions/end-all",
  requirePermission("users", "edit"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const t = await managedTarget(req, res);
      if (!t) return;
      // An admin signing themselves out everywhere keeps this session.
      const keep = t.target.id === t.actor.id ? req.sessionID : undefined;
      const ended = await revokeUserSessions(req, t.target.id, keep);
      await logActivity({
        req,
        propertyId: t.target.propertyId ?? 0,
        username: t.actor.username,
        userId: t.actor.id,
        userRole: t.actor.roles?.[0] ?? "admin",
        action: `تسجيل خروج المستخدم '${t.target.username}' من كل الأجهزة (${ended})`,
        actionType: "UPDATE",
        module: "users",
        entityType: "user",
        entityId: t.target.id,
      });
      res.json({ success: true, ended });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
