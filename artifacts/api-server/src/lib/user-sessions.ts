// A user's signed-in sessions (devices): list them and end one. Works with
// the PostgreSQL session store and with stores that can list sessions (the
// in-memory store). Session ids never leave the server: each session is
// identified to the client by a short hash of its id.
import { createHash } from "node:crypto";
import type { Request } from "express";
import { pool } from "@workspace/db";

const SESSION_TABLE = process.env["SESSION_TABLE"] ?? "user_sessions";
const SAFE_TABLE = /^[a-z_][a-z0-9_]*$/i.test(SESSION_TABLE);

export interface SessionInfo {
  id: string;
  current: boolean;
  ip: string | null;
  device: string;
  userAgent: string | null;
  loginAt: string | null;
  lastSeenAt: string | null;
  expiresAt: string | null;
}

/** Stable public id for a session id (not reversible). */
export const publicSessionId = (sid: string) =>
  createHash("sha256").update(sid).digest("hex").slice(0, 16);

/** "Chrome on Windows", "Safari on iPhone", "Sunrise app on Android"… */
export function describeDevice(ua: string | null | undefined): string {
  const s = String(ua ?? "");
  if (!s) return "Unknown device";
  const os = /iPhone/.test(s)
    ? "iPhone"
    : /iPad/.test(s)
      ? "iPad"
      : /Android/.test(s)
        ? "Android"
        : /Windows/.test(s)
          ? "Windows"
          : /Mac OS X|Macintosh/.test(s)
            ? "Mac"
            : /Linux/.test(s)
              ? "Linux"
              : "";
  const browser = /Edg\//.test(s)
    ? "Edge"
    : /OPR\/|Opera/.test(s)
      ? "Opera"
      : /Firefox\//.test(s)
        ? "Firefox"
        : /Chrome\//.test(s)
          ? "Chrome"
          : /Safari\//.test(s)
            ? "Safari"
            : /okhttp|Dalvik|Capacitor/i.test(s)
              ? "App"
              : /curl|node|axios|python/i.test(s)
                ? "Script"
                : "Browser";
  return os ? `${browser} · ${os}` : browser;
}

type Raw = { sid: string; sess: any; expire: Date | null };

async function allSessionsOf(req: Request, userId: number): Promise<Raw[]> {
  const found = new Map<string, Raw>();
  if (SAFE_TABLE) {
    try {
      const res = await pool.query(
        `SELECT sid, sess, expire FROM "${SESSION_TABLE}"
         WHERE (sess->>'userId') = $1 AND expire > now()`,
        [String(userId)],
      );
      for (const r of res.rows) {
        found.set(r.sid, { sid: r.sid, sess: r.sess, expire: r.expire });
      }
    } catch {
      // table missing: not a PostgreSQL store
    }
  }
  const store: any = (req as any).sessionStore;
  if (store?.all) {
    const all: Record<string, any> = await new Promise((resolve) =>
      store.all((err: any, s: any) => resolve(err || !s ? {} : s)),
    );
    for (const [sid, sess] of Object.entries(all)) {
      if (Number(sess?.userId) !== userId || found.has(sid)) continue;
      const exp = sess?.cookie?.expires ? new Date(sess.cookie.expires) : null;
      if (exp && exp.getTime() < Date.now()) continue;
      found.set(sid, { sid, sess, expire: exp });
    }
  }
  return [...found.values()];
}

const iso = (v: unknown) => {
  if (v == null) return null;
  const d = new Date(v as any);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export async function listUserSessions(
  req: Request,
  userId: number,
): Promise<SessionInfo[]> {
  const rows = await allSessionsOf(req, userId);
  return rows
    .map(({ sid, sess, expire }) => ({
      id: publicSessionId(sid),
      current: sid === req.sessionID,
      ip: sess?.ip ?? null,
      device: describeDevice(sess?.userAgent),
      userAgent: sess?.userAgent ?? null,
      loginAt: iso(sess?.loginAt),
      lastSeenAt: iso(sess?.lastSeenAt ?? sess?.loginAt),
      expiresAt: iso(expire),
    }))
    .sort(
      (a, b) =>
        Number(b.current) - Number(a.current) ||
        String(b.lastSeenAt).localeCompare(String(a.lastSeenAt)),
    );
}

/** End one session of `userId` by its public id. Returns true if found. */
export async function endUserSession(
  req: Request,
  userId: number,
  publicId: string,
): Promise<boolean> {
  const target = (await allSessionsOf(req, userId)).find(
    (r) => publicSessionId(r.sid) === publicId,
  );
  if (!target) return false;
  if (SAFE_TABLE) {
    try {
      await pool.query(`DELETE FROM "${SESSION_TABLE}" WHERE sid = $1`, [
        target.sid,
      ]);
    } catch {
      // not a PostgreSQL store
    }
  }
  const store: any = (req as any).sessionStore;
  if (store?.destroy) {
    await new Promise<void>((resolve) =>
      store.destroy(target.sid, () => resolve()),
    );
  }
  return true;
}
