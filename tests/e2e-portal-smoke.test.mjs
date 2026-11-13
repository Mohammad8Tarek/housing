// ============================================================================
// Employee Portal — browser smoke suite (Playwright + node:test)
//
// Logs in as a resident on a phone-sized viewport and walks every tab,
// asserting each one renders without runtime errors and shows its key
// content. Also checks the cached-data behaviour introduced with the
// TanStack Query layer: switching tabs must not re-request the same endpoint.
//
// Usage:
//   PORTAL_URL=http://localhost:10000 PORTAL_USER=EMP-001 PORTAL_PASS=secret \
//     node --test tests/e2e-portal-smoke.test.mjs
//
// Self-skips when Playwright is not installed or the portal is unreachable,
// so it is safe in CI jobs without a browser.
// ============================================================================
import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const PORTAL_URL = (process.env.PORTAL_URL || "http://localhost:10000").replace(/\/+$/, "");
const PORTAL_USER = process.env.PORTAL_USER || "";
const PORTAL_PASS = process.env.PORTAL_PASS || "";

let pw = null;
let browser = null;
let page = null;
let ready = false;
const pageErrors = [];
const apiCalls = [];

function loadPlaywright() {
  const req = createRequire(import.meta.url);
  const candidates = [
    "playwright",
    process.env.PLAYWRIGHT_PATH,
    "/opt/node-tools/node_modules/playwright/index.js",
  ].filter(Boolean);
  for (const c of candidates) {
    try {
      return req(c);
    } catch {
      /* try next */
    }
  }
  return null;
}

before(async () => {
  pw = loadPlaywright();
  if (!pw) {
    console.log("[portal-smoke] playwright not available — skipping");
    return;
  }
  if (!PORTAL_USER || !PORTAL_PASS) {
    console.log("[portal-smoke] PORTAL_USER / PORTAL_PASS not set — skipping");
    return;
  }
  const up = await fetch(PORTAL_URL + "/login").then((r) => r.ok).catch(() => false);
  if (!up) {
    console.log(`[portal-smoke] portal not reachable at ${PORTAL_URL} — skipping`);
    return;
  }

  browser = await pw.chromium.launch();
  const ctx = await browser.newContext({ ...pw.devices["iPhone 13"], locale: "ar-EG" });
  page = await ctx.newPage();
  page.on("pageerror", (e) => pageErrors.push(e.message));
  page.on("request", (r) => {
    if (r.url().includes("/api/")) apiCalls.push(new URL(r.url()).pathname);
  });

  await page.goto(PORTAL_URL + "/login", { waitUntil: "domcontentloaded" });
  await page.waitForSelector('input[name="username"]', { timeout: 15_000 });
  await page.fill('input[name="username"]', PORTAL_USER);
  await page.fill('input[name="password"]', PORTAL_PASS);
  await page.keyboard.press("Enter");
  await page.waitForURL(/\/dashboard/, { timeout: 20_000 });
  await page.waitForTimeout(3000);
  ready = true;
});

after(async () => {
  await browser?.close();
});

const skipUnlessReady = (t) => (!ready ? (t.skip("portal not ready"), true) : false);

async function openTab(tab) {
  await page.goto(`${PORTAL_URL}/dashboard?tab=${tab}`, { waitUntil: "commit" }).catch(() => {});
  await page.waitForTimeout(2500);
  return page.locator("body").innerText();
}

test("login lands on the dashboard with the resident pass", async (t) => {
  if (skipUnlessReady(t)) return;
  const txt = await page.locator("body").innerText();
  assert.match(txt, /RESIDENT PASS/i, "overview must show the resident pass card");
  assert.equal(pageErrors.length, 0, `runtime errors: ${pageErrors.join(" | ")}`);
});

test("every tab renders without runtime errors", async (t) => {
  if (skipUnlessReady(t)) return;
  const tabs = [
    ["requests", /طلبات|Requests/],
    ["notifications", /الإشعارات|Notifications/],
    ["my-room", /غرفتي|My Room/],
    ["roommates", /زملاء|Roommates/],
    ["food", /الطعام|Food/],
    ["transport", /النقل|Transport/],
    ["activities", /الفعاليات|Activities/],
    ["evaluations", /التقييم|Evaluation/],
    ["documents", /المستندات|Documents/],
    ["profile", /الملف|Profile|بياناتي|الشخصي/],
    ["portal-settings", /الإعدادات|Settings/],
    ["chat", /محادثات|Chat/],
  ];
  for (const [tab, re] of tabs) {
    const before = pageErrors.length;
    const txt = await openTab(tab);
    assert.match(txt, re, `tab "${tab}" did not render its heading`);
    assert.equal(pageErrors.length, before, `tab "${tab}" threw: ${pageErrors.slice(before).join(" | ")}`);
  }
});

test("My Room shows the allocation (room number or the unassigned state)", async (t) => {
  if (skipUnlessReady(t)) return;
  const txt = await openTab("my-room");
  assert.ok(
    /غرفة|Room|لم يتم تخصيص|No room assigned/.test(txt),
    "my-room must show a room or the unassigned message",
  );
});

test("switching tabs reuses the cache instead of re-fetching the same endpoint", async (t) => {
  if (skipUnlessReady(t)) return;
  await openTab("overview");
  await page.waitForTimeout(1500);
  apiCalls.length = 0;
  for (const tab of ["requests", "notifications", "overview", "requests"]) {
    await page.locator("nav").locator("button, a").filter({ hasText: tab === "requests" ? /طلباتي|Requests/ : tab === "notifications" ? /الإشعارات|Notifications/ : /الرئيسية|Home/ }).first().click().catch(() => {});
    await page.waitForTimeout(1200);
  }
  const counts = {};
  for (const p of apiCalls) counts[p] = (counts[p] || 0) + 1;
  const repeated = Object.entries(counts).filter(([p, n]) => n > 1 && !p.includes("/portal-chat/"));
  assert.deepEqual(repeated, [], `endpoints fetched more than once during tab switches: ${JSON.stringify(counts)}`);
});

test("notifications tab lists items and 'mark all read' clears the badge", async (t) => {
  if (skipUnlessReady(t)) return;
  await openTab("notifications");
  const markAll = page.locator("button").filter({ hasText: /تحديد الكل كمقروء|Mark all/ }).first();
  if ((await markAll.count()) === 0) return t.skip("no unread notifications to clear");
  await markAll.click();
  await page.waitForTimeout(1500);
  const badge = await page.evaluate(() => {
    const el = [...document.querySelectorAll("nav button")].find((b) => /الإشعارات|Notifications/.test(b.textContent || ""));
    return el ? el.textContent.replace(/\D/g, "") : "";
  });
  assert.equal(badge, "", "badge should be empty after marking all as read");
});
