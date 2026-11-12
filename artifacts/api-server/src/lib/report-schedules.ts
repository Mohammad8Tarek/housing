// Scheduled report emails. Every 10 minutes each property's enabled schedules
// are checked; a due one is built with the same code as the Reports page and
// emailed as an HTML summary + CSV (opens in Excel, Arabic intact).
//
// The report runs AS ITS CREATOR: a short-lived internal session for that
// user reads the data through the normal API, so their current permissions
// and properties apply. If the creator is deleted or disabled, the schedule
// fails instead of sending.
import { randomBytes } from "node:crypto";
import type { Request } from "express";
import cron from "node-cron";
import { eq } from "drizzle-orm";
import {
  db,
  pool,
  propertiesTable,
  reportSchedulesTable,
  settingsTable,
  usersTable,
  withTenant,
  type ReportSchedule,
} from "@workspace/db";
import { REPORT_COLUMNS, REPORT_TITLES } from "@workspace/report-rows";
import { createTransporter, isSmtpConfigured } from "./email-service.js";
import {
  REPORT_TIME_ZONE,
  parseRecipients,
} from "./maintenance-daily-report.js";
import {
  buildServerReportRows,
  type ServerReport,
} from "./report-rows-server.js";
import { getSessionStore } from "./session-store-ref.js";
import { logger } from "./logger.js";

const SESSION_TABLE = process.env["SESSION_TABLE"] ?? "user_sessions";
const PREVIEW_ROWS = 30;

/** Cairo calendar parts of an instant. */
export function cairoParts(d: Date) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: REPORT_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      hourCycle: "h23",
      weekday: "short",
    })
      .formatToParts(d)
      .map((p) => [p.type, p.value]),
  );
  const weekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(
    parts.weekday,
  );
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    day: Number(parts.day),
    hour: Number(parts.hour),
    weekday,
  };
}

/**
 * Due when today matches the schedule's day, the hour has come (Cairo), and
 * it has not run yet today — so a run missed during a restart still goes out
 * later the same day.
 */
export function isDue(
  s: Pick<
    ReportSchedule,
    "enabled" | "frequency" | "dayOfWeek" | "dayOfMonth" | "hour" | "lastRunAt"
  >,
  now: Date = new Date(),
): boolean {
  if (!s.enabled) return false;
  const t = cairoParts(now);
  if (t.hour < s.hour) return false;
  if (s.frequency === "weekly" && t.weekday !== (s.dayOfWeek ?? 0))
    return false;
  if (s.frequency === "monthly" && t.day !== (s.dayOfMonth ?? 1)) return false;
  if (!s.lastRunAt) return true;
  return cairoParts(new Date(s.lastRunAt)).date !== t.date;
}

// ── CSV / HTML ───────────────────────────────────────────────────────────────

const HIDDEN = /^(id|raw[A-Z].*|.*Id|is[A-Z].*|has[A-Z].*|rooms(Set|List))$/;

/** Columns for a report: its defined columns, else the row's own keys. */
export function reportColumns(
  report: string,
  rows: any[],
  ar: boolean,
): Array<{ key: string; label: string }> {
  const defined = REPORT_COLUMNS[report];
  if (defined?.length) {
    return defined.map((c) => ({
      key: c.key,
      label: ar ? c.labelAr || c.label : c.label,
    }));
  }
  const keys = new Set<string>();
  for (const r of rows.slice(0, 50))
    Object.keys(r ?? {}).forEach((k) => keys.add(k));
  return [...keys]
    .filter((k) => !HIDDEN.test(k))
    .map((k) => ({ key: k, label: k }));
}

const cell = (v: unknown): string => {
  if (v == null) return "";
  if (Array.isArray(v)) return v.map(cell).join(", ");
  if (typeof v === "object") return "";
  return String(v);
};

export function renderCsv(
  cols: Array<{ key: string; label: string }>,
  rows: any[],
): string {
  const esc = (s: string) =>
    /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  const lines = [
    cols.map((c) => esc(c.label)).join(","),
    ...rows.map((r) => cols.map((c) => esc(cell(r?.[c.key]))).join(",")),
  ];
  return "﻿" + lines.join("\r\n"); // BOM: Excel reads UTF-8 Arabic
}

const html = (s: string) =>
  s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

export function renderEmailHtml(opts: {
  ar: boolean;
  title: string;
  propertyName: string;
  dateLabel: string;
  cols: Array<{ key: string; label: string }>;
  rows: any[];
  scheduledBy: string;
}): string {
  const { ar, cols, rows } = opts;
  const dir = ar ? "rtl" : "ltr";
  const preview = rows.slice(0, PREVIEW_ROWS);
  const th = cols
    .map(
      (c) =>
        `<th style="background:#2AA8AB;color:#fff;padding:6px 8px;font-size:12px;text-align:${ar ? "right" : "left"}">${html(c.label)}</th>`,
    )
    .join("");
  const trs = preview
    .map(
      (r, i) =>
        `<tr style="background:${i % 2 ? "#E8F6F6" : "#fff"}">${cols
          .map(
            (c) =>
              `<td style="padding:5px 8px;font-size:12px;border-bottom:1px solid #D9E3E3">${html(cell(r?.[c.key]))}</td>`,
          )
          .join("")}</tr>`,
    )
    .join("");
  const more =
    rows.length > PREVIEW_ROWS
      ? `<p style="font-size:12px;color:#555">${
          ar
            ? `أول ${PREVIEW_ROWS} صف من ${rows.length}. الملف المرفق فيه كل الصفوف.`
            : `First ${PREVIEW_ROWS} of ${rows.length} rows. The attached file has all of them.`
        }</p>`
      : "";
  return `<!doctype html><html dir="${dir}"><body style="font-family:Tahoma,Arial,sans-serif;color:#1E2A2B;direction:${dir}">
<h2 style="color:#2AA8AB;margin:0 0 4px">${html(opts.title)}</h2>
<p style="margin:0 0 12px;font-size:13px">${html(opts.propertyName)} · ${html(opts.dateLabel)} · ${
    ar ? `${rows.length} صف` : `${rows.length} rows`
  }</p>
${
  rows.length === 0
    ? `<p>${ar ? "لا توجد بيانات في التقرير اليوم." : "The report has no rows today."}</p>`
    : `<table cellspacing="0" style="border-collapse:collapse;width:100%">${`<tr>${th}</tr>`}${trs}</table>${more}`
}
<p style="font-size:11px;color:#888;margin-top:16px">${
    ar
      ? `تقرير مجدول أنشأه ${html(opts.scheduledBy)} — نظام سكن الموظفين Sunrise. لإيقافه: التقارير ← التقارير المجدولة.`
      : `Scheduled by ${html(opts.scheduledBy)} — Sunrise Staff Housing. To stop it: Reports → Scheduled reports.`
  }</p>
</body></html>`;
}

// ── Running a schedule ───────────────────────────────────────────────────────

/** Remove every session created for one scheduler run (and its copies). */
async function purgeRunSessions(runId: string): Promise<void> {
  if (/^[a-z_][a-z0-9_]*$/i.test(SESSION_TABLE)) {
    try {
      await pool.query(
        `DELETE FROM "${SESSION_TABLE}" WHERE (sess->>'internalRun') = $1`,
        [runId],
      );
    } catch {
      // not a PostgreSQL store
    }
  }
  const store: any = getSessionStore();
  if (!store?.all || !store?.destroy) return;
  const all: Record<string, any> = await new Promise((resolve) =>
    store.all((err: any, s: any) => resolve(err || !s ? {} : s)),
  );
  await Promise.all(
    Object.entries(all)
      .filter(([, s]) => s?.internalRun === runId)
      .map(
        ([sid]) =>
          new Promise<void>((resolve) => store.destroy(sid, () => resolve())),
      ),
  );
}

/** Build the schedule's rows while signed in as its creator. */
async function rowsAsCreator(
  propertyId: number,
  s: ReportSchedule,
): Promise<{ rows: any[]; creatorName: string }> {
  const [creator] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, s.createdBy))
    .limit(1);
  if (!creator) throw new Error("Creator account no longer exists");
  if (String(creator.status ?? "active").toLowerCase() !== "active") {
    throw new Error("Creator account is not active");
  }
  const store = getSessionStore();
  if (!store) throw new Error("Session store not ready");

  const runId = randomBytes(24).toString("hex");
  const roles = (creator.roles ?? []).map((r) => String(r).toLowerCase());
  await new Promise<void>((resolve, reject) =>
    store.set(
      runId,
      {
        cookie: {
          originalMaxAge: 5 * 60_000,
          expires: new Date(Date.now() + 5 * 60_000),
          httpOnly: true,
          path: "/",
        },
        userId: creator.id,
        propertyId,
        username: creator.username,
        isSystemAdmin:
          roles.includes("super_admin") || roles.includes("system_admin"),
        loginAt: Date.now(),
        internalRun: runId,
      } as any,
      (err) => (err ? reject(err) : resolve()),
    ),
  );
  try {
    const req = {
      headers: {
        "x-session-id": runId,
        "user-agent": "Sunrise report scheduler",
      },
    } as unknown as Request;
    const filters = (s.filters ?? {}) as Record<string, string | undefined>;
    const rows = await buildServerReportRows(
      req,
      propertyId,
      s.reportKey as ServerReport,
      { ...filters, lang: s.lang, tz: REPORT_TIME_ZONE },
    );
    return { rows, creatorName: creator.username };
  } finally {
    await purgeRunSessions(runId);
  }
}

export async function runSchedule(
  propertyId: number,
  s: ReportSchedule,
): Promise<{ status: "sent" | "failed"; rows: number; error?: string }> {
  let result: { status: "sent" | "failed"; rows: number; error?: string };
  try {
    const recipients = parseRecipients(s.recipients);
    if (recipients.length === 0) throw new Error("No recipients");
    const settings: any = await withTenant(propertyId, async (tenantDb) => {
      const [row] = await tenantDb.select().from(settingsTable).limit(1);
      return row;
    });
    const smtp = {
      smtpHost: settings?.smtpHost,
      smtpPort: settings?.smtpPort,
      smtpSecure: settings?.smtpSecure,
      smtpUser: settings?.smtpUser,
      smtpPass: settings?.smtpPass,
      smtpFrom: settings?.smtpFrom,
    };
    if (!isSmtpConfigured(smtp)) throw new Error("SMTP not configured");

    const [prop] = await db
      .select({
        name: propertiesTable.name,
        displayName: propertiesTable.displayName,
      })
      .from(propertiesTable)
      .where(eq(propertiesTable.id, propertyId))
      .limit(1);
    const { rows, creatorName } = await rowsAsCreator(propertyId, s);
    const ar = s.lang !== "en";
    const cols = reportColumns(s.reportKey, rows, ar);
    const titles = REPORT_TITLES[s.reportKey] ?? {
      ar: s.reportKey,
      en: s.reportKey,
    };
    const title = ar ? titles.ar : titles.en;
    const today = cairoParts(new Date()).date;
    const [y, m, d] = today.split("-");
    const propertyName = prop?.displayName || prop?.name || "";
    await createTransporter(smtp).sendMail({
      from:
        smtp.smtpFrom ||
        process.env.SMTP_FROM ||
        `"SUNRISE Housing" <${smtp.smtpUser || process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`,
      to: recipients.join(", "),
      subject: `${title} — ${propertyName} — ${d}/${m}/${y}`,
      html: renderEmailHtml({
        ar,
        title,
        propertyName,
        dateLabel: `${d}/${m}/${y}`,
        cols,
        rows,
        scheduledBy: creatorName,
      }),
      attachments: [
        {
          filename: `${s.reportKey}_${d}-${m}-${y}.csv`,
          content: renderCsv(cols, rows),
          contentType: "text/csv; charset=utf-8",
        },
      ],
    });
    result = { status: "sent", rows: rows.length };
  } catch (err: any) {
    result = {
      status: "failed",
      rows: 0,
      error: String(err?.message ?? err).slice(0, 300),
    };
  }
  await withTenant(propertyId, (tenantDb) =>
    tenantDb
      .update(reportSchedulesTable)
      .set({
        lastRunAt: new Date(),
        lastStatus: result.status,
        lastError: result.error ?? null,
      })
      .where(eq(reportSchedulesTable.id, s.id)),
  );
  return result;
}

let running = false;

export async function runDueSchedules(now: Date = new Date()): Promise<void> {
  if (running) return;
  running = true;
  try {
    const props = await db
      .select({ id: propertiesTable.id })
      .from(propertiesTable);
    for (const p of props) {
      let schedules: ReportSchedule[] = [];
      try {
        schedules = await withTenant(p.id, (tenantDb) =>
          tenantDb
            .select()
            .from(reportSchedulesTable)
            .where(eq(reportSchedulesTable.enabled, true)),
        );
      } catch {
        continue; // table not migrated yet for this property
      }
      for (const s of schedules.filter((x) => isDue(x, now))) {
        const r = await runSchedule(p.id, s);
        logger.info(
          { propertyId: p.id, scheduleId: s.id, report: s.reportKey, ...r },
          "scheduled report",
        );
      }
    }
  } catch (err: any) {
    logger.error({ err: err?.message }, "scheduled reports run failed");
  } finally {
    running = false;
  }
}

export function initReportScheduleCron(): void {
  cron.schedule("*/10 * * * *", () => void runDueSchedules(), {
    timezone: REPORT_TIME_ZONE,
  });
}
