import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

// ─────────────────────────────────────────────────────────────────────────────
// Guard-presence invariant for the Settings surface.
//
// Every state-changing route (POST/PATCH/PUT/DELETE) in a settings-domain
// router MUST be protected by one of the RBAC middlewares — requirePermission,
// requireAnyPermission or requireSuperAdmin — so that nothing under the Settings
// page can be modified without the matching permission. This test reads the
// route source directly (no DB needed) and fails if any write route is missing
// its guard, which stops a guard from being silently dropped in a later edit.
//
// The only allowed exceptions are the external HR-integration webhooks, which
// authenticate machine-to-machine with the x-api-key header (and fail safe in
// production) instead of a user session. They are listed explicitly below.
// ─────────────────────────────────────────────────────────────────────────────

const here = dirname(fileURLToPath(import.meta.url));
const routesDir = join(here, "..");

// Settings-domain routers whose write routes must all be permission-guarded.
const SETTINGS_ROUTE_FILES = [
  "settings.ts",
  "lookup_values.ts",
  "hotek-config.ts",
  "smart-lock.ts",
  "hr-sync.ts",
  "whatsapp.ts",
  "workers.ts",
];

// Routes intentionally authenticated by x-api-key (external HR webhooks), not a
// user session. Keyed by the route path exactly as written in the source.
const API_KEY_WEBHOOK_PATHS = new Set([
  "/receive",
  "/notify-vacation",
  "/notify-departure",
]);

const GUARD_RE =
  /require(Permission|AnyPermission|SuperAdmin)\s*\(|requireSuperAdmin\b/;
const WRITE_METHOD_RE = /router\.(post|patch|put|delete)\s*\(/g;

/** Find the index where the route's final async handler begins. */
function handlerStart(src: string, from: number): number {
  const candidates = [
    src.indexOf("async (", from),
    src.indexOf("async(", from),
    src.indexOf("(req", from),
  ].filter((i) => i >= 0);
  return candidates.length ? Math.min(...candidates) : from + 400;
}

/** Extract the first string-literal argument (the route path) after `from`. */
function firstPath(src: string, from: number, to: number): string {
  const slice = src.slice(from, to);
  const m = slice.match(/["'`]([^"'`]+)["'`]/);
  return m ? m[1] : "(unknown)";
}

describe("Settings RBAC — every write route is permission-guarded", () => {
  for (const file of SETTINGS_ROUTE_FILES) {
    it(`${file}: all POST/PATCH/PUT/DELETE routes carry an RBAC guard`, () => {
      const src = readFileSync(join(routesDir, file), "utf8");
      const unguarded: string[] = [];

      WRITE_METHOD_RE.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = WRITE_METHOD_RE.exec(src))) {
        const method = m[1].toUpperCase();
        const openIdx = m.index;
        const hStart = handlerStart(src, openIdx);
        // The middleware list lives between `router.method(` and the handler.
        const head = src.slice(openIdx, hStart);
        const path = firstPath(src, openIdx, hStart);

        if (API_KEY_WEBHOOK_PATHS.has(path)) continue; // x-api-key authenticated
        if (GUARD_RE.test(head)) continue; // has an RBAC guard

        unguarded.push(`${method} ${path} (offset ${openIdx})`);
      }

      expect(
        unguarded,
        `Unguarded write route(s) in ${file}:\n  ${unguarded.join("\n  ")}`,
      ).toEqual([]);
    });
  }

  it("covers a non-trivial number of write routes (sanity)", () => {
    let total = 0;
    for (const file of SETTINGS_ROUTE_FILES) {
      const src = readFileSync(join(routesDir, file), "utf8");
      total += (src.match(WRITE_METHOD_RE) || []).length;
    }
    // Guards against the regex silently matching nothing (which would make the
    // suite pass vacuously).
    expect(total).toBeGreaterThan(15);
  });
});
