import { describe, it, expect } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join, relative } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// App-wide guard-presence invariant for the ADMIN surface.
//
// Every state-changing route (POST/PATCH/PUT/DELETE) in an admin-facing router
// must be protected by an RBAC guard — requirePermission / requireAnyPermission
// / requireSuperAdmin — so nothing in the admin app can be modified without the
// matching permission. The test reads route source directly (no DB) and fails
// if a write route is missing its guard, catching a guard dropped in a later
// edit.
//
// Two groups are deliberately out of scope, each with its own auth model:
//   • EXCLUDED_FILES/DIRS — public auth flows, self-service, and the resident
//     portal (requirePortalAuth / token / api-key), audited separately.
//   • ALLOWLIST — admin routes whose guard is applied by a *custom* middleware
//     wrapper, a router-level `router.use`, or an in-handler permission+ownership
//     check rather than an inline require* call. Each entry was verified by hand;
//     a new unguarded route will NOT match these and will fail.
// ─────────────────────────────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = join(here, "..");

// Routers with a non-admin auth model (public, self-service, or portal).
const EXCLUDED = new Set([
  "index.ts",
  "health.ts",
  "auth.ts", // public login / 2fa / forgot-password
  "mfa.ts", // self-service MFA, session-gated
  "gate.ts", // dual portal/admin auth, handled in-router
  "public-surveys.ts", // public, token-authenticated
  "room-service-public.ts", // public room QR
  "push-notifications.ts", // per-viewer device tokens
  "portal-chat.ts",
  "portal-food-transport.ts",
  "portal-notifications.ts",
  "portal-schedule.ts",
  "portal-feedback.ts",
  "portal-reports.ts",
  "portal-categories.ts",
  "portal-contacts.ts",
  "portal-analytics.ts",
]);
const EXCLUDED_DIRS = new Set(["__tests__", "portal-auth", "portal-data"]);

// Admin write routes whose guard is a verified custom wrapper / router-level /
// in-handler check (see the audit). Keyed "relativePath :: METHOD path".
const ALLOWLIST = new Set([
  "users.ts :: PATCH /users/:id", // requireUserUpdatePermission wrapper
  "users.ts :: PATCH /users/me/last-property", // requireAuth, self only
  "rooms.ts :: PATCH /rooms/:id/status", // custom accommodation/housekeeping middleware
  "user-signature.ts :: POST /users/me/signature", // session gate, self
  "user-signature.ts :: POST /users/:id/signature", // in-handler users.edit + scope
  "user-signature.ts :: DELETE /users/me/signature", // session gate, self
  "user-signature.ts :: DELETE /users/:id/signature", // in-handler users.edit + scope
  "user-sessions.ts :: POST /auth/sessions/:sid/end", // self-service (own sessions)
  "user-sessions.ts :: POST /auth/sessions/end-others", // self-service (own sessions)
  "hr-sync.ts :: POST /receive", // x-api-key webhook
  "hr-sync.ts :: POST /notify-vacation", // x-api-key webhook
  "hr-sync.ts :: POST /notify-departure", // x-api-key webhook
  "gate.ts :: POST /gate/device/event", // x-device-key authenticated terminal
]);

const PERM_GUARD = /require(Permission|AnyPermission|SuperAdmin)\s*\(/;
const WRITE_METHOD_RE = /router\.(post|patch|put|delete)\s*\(/g;

function handlerStart(src: string, from: number): number {
  const c = [
    src.indexOf("async (", from),
    src.indexOf("async(", from),
    src.indexOf("(req", from),
  ].filter((i) => i >= 0);
  return c.length ? Math.min(...c) : from + 500;
}
function firstPath(src: string, from: number, to: number): string {
  const m = src.slice(from, to).match(/["'`]([^"'`]+)["'`]/);
  return m ? m[1] : "(unknown)";
}
function walk(dir: string): string[] {
  let out: string[] = [];
  for (const e of readdirSync(dir)) {
    const p = join(dir, e);
    if (statSync(p).isDirectory()) {
      if (EXCLUDED_DIRS.has(e)) continue;
      out = out.concat(walk(p));
    } else if (e.endsWith(".ts") && !EXCLUDED.has(e)) {
      out.push(p);
    }
  }
  return out;
}

const adminRouteFiles = walk(routesDir);

describe("Admin RBAC — every write route is permission-guarded", () => {
  it("discovers a realistic set of admin route files (sanity)", () => {
    expect(adminRouteFiles.length).toBeGreaterThan(20);
  });

  for (const file of adminRouteFiles) {
    const rel = relative(routesDir, file);
    it(`${rel}: all write routes guarded or allowlisted`, () => {
      const src = readFileSync(file, "utf8");
      const unguarded: string[] = [];

      WRITE_METHOD_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WRITE_METHOD_RE.exec(src))) {
        const method = m[1].toUpperCase();
        const open = m.index;
        const hStart = handlerStart(src, open);
        const head = src.slice(open, hStart);
        const path = firstPath(src, open, hStart);
        const key = `${rel} :: ${method} ${path}`;

        if (PERM_GUARD.test(head)) continue;
        if (ALLOWLIST.has(key)) continue;
        unguarded.push(key);
      }

      expect(
        unguarded,
        `Unguarded admin write route(s):\n  ${unguarded.join("\n  ")}\n` +
          `If one is intentionally guarded another way, verify it and add it to ALLOWLIST.`,
      ).toEqual([]);
    });
  }
});
