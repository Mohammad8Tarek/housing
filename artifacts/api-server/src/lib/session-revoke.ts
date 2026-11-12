// End a user's sessions (after a password change / reset or deletion), so a
// stolen or old session cannot keep working with the old password.
import type { Request } from "express";
import { pool } from "@workspace/db";

const SESSION_TABLE = process.env["SESSION_TABLE"] ?? "user_sessions";

/**
 * Destroy every session of `userId`, except `keepSid` (the caller's own
 * session when users change their own password). Returns how many ended.
 */
export async function revokeUserSessions(
  req: Request,
  userId: number,
  keepSid?: string,
): Promise<number> {
  let ended = 0;
  // PostgreSQL session store (SESSION_STORE=postgresql): one statement.
  if (/^[a-z_][a-z0-9_]*$/i.test(SESSION_TABLE)) {
    try {
      const res = await pool.query(
        `DELETE FROM "${SESSION_TABLE}"
         WHERE (sess->>'userId') = $1 AND ($2::text IS NULL OR sid <> $2)`,
        [String(userId), keepSid ?? null],
      );
      ended += res.rowCount ?? 0;
    } catch {
      // table missing: not a PostgreSQL store
    }
  }
  // Stores that can list their sessions (the in-memory store). Done as well
  // as the SQL above: the table can exist while another store is in use.
  const store: any = (req as any).sessionStore;
  if (!store?.all || !store?.destroy) return ended;
  const sessions: Record<string, any> = await new Promise((resolve) =>
    store.all((err: any, all: any) => resolve(err || !all ? {} : all)),
  );
  const sids = Object.entries(sessions)
    .filter(([sid, s]) => Number(s?.userId) === userId && sid !== keepSid)
    .map(([sid]) => sid);
  await Promise.all(
    sids.map(
      (sid) =>
        new Promise<void>((resolve) => store.destroy(sid, () => resolve())),
    ),
  );
  return ended + sids.length;
}
