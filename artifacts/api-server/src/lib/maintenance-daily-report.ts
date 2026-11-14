// Nightly maintenance / housekeeping report per property, in the spirit of
// the company's GSC daily report: counts per department and source, then
// every ticket of the day with start / end time and duration. Sent as an HTML
// email (renders Arabic correctly in Outlook and on phones) with a CSV
// attachment that opens in Excel.
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db, propertiesTable, settingsTable, withTenant } from "@workspace/db";
import { eq } from "drizzle-orm";
import { createTransporter, isSmtpConfigured } from "./email-service.js";
import { ticketNumber, ticketSla } from "./maintenance-tickets.js";
import { logger } from "./logger.js";
import { loadServiceCatalogue } from "./maintenance-services.js";

export const REPORT_TIME_ZONE = "Africa/Cairo";

export const SERVICE_LABELS: Record<string, { ar: string; en: string }> = {
  Plumbing: { ar: "سباكة", en: "Plumbing" },
  Electrical: { ar: "كهرباء", en: "Electrical" },
  HVAC: { ar: "تكييف وتبريد", en: "HVAC & AC" },
  Furniture: { ar: "أثاث ونجارة", en: "Furniture & Woodwork" },
  Internet: { ar: "إنترنت وشبكات", en: "Internet & Network" },
  Appliances: { ar: "أجهزة كهربائية", en: "Appliances" },
  Cleaning: { ar: "نظافة", en: "Cleaning" },
  Other: { ar: "أعطال أخرى", en: "Other" },
  room_cleaning: { ar: "تنظيف الغرفة", en: "Room Cleaning" },
  bed_sheets: { ar: "تغيير المفارش", en: "Bed Linen Change" },
  towels: { ar: "مناشف ومستلزمات", en: "Towels & Amenities" },
  deep_cleaning: { ar: "تنظيف شامل", en: "Deep Cleaning" },
  waste_removal: { ar: "تفريغ المهملات", en: "Trash Removal" },
  sanitization: { ar: "تعقيم وتطهير", en: "Sanitization" },
  turnover: { ar: "تجهيز لنزيل جديد", en: "Turnover" },
  general_inquiry: { ar: "استفسار عام", en: "General Inquiry" },
  inspection: { ar: "فحص ومعاينة", en: "Inspection" },
  pest_control: { ar: "مكافحة حشرات", en: "Pest Control" },
  other: { ar: "طلب آخر", en: "Other" },
  out_of_order: { ar: "غرفة معطّلة", en: "Out of order" },
  out_of_service: { ar: "غرفة خارج الخدمة", en: "Out of service" },
};
const DEPT: Record<string, { ar: string; en: string }> = {
  maintenance: { ar: "الصيانة", en: "Engineering" },
  housekeeping: { ar: "النظافة", en: "Housekeeping" },
  general: { ar: "عام", en: "General" },
};
const STATUS: Record<string, { ar: string; en: string }> = {
  open: { ar: "مفتوح", en: "Open" },
  pending: { ar: "معلق", en: "Pending" },
  in_progress: { ar: "قيد التنفيذ", en: "In progress" },
  resolved: { ar: "تم الحل", en: "Resolved" },
  closed: { ar: "مغلق", en: "Closed" },
};

/** A label available in both languages so the report can render in either. */
export interface Bilingual {
  ar: string;
  en: string;
}

export type ReportLang = "ar" | "en";

export interface DailyReportRow {
  ticketNo: string;
  location: string;
  department: Bilingual;
  service: Bilingual;
  status: Bilingual;
  source: "resident" | "internal";
  technician: string;
  start: string | null;
  end: string | null;
  durationMinutes: number | null;
  overdue: boolean;
}

export interface DailyReport {
  propertyName: string;
  date: string; // YYYY-MM-DD (Cairo)
  rows: DailyReportRow[];
  summary: {
    total: number;
    completed: number;
    overdue: number;
    openBacklog: number;
    avgMinutes: number | null;
    byDepartment: Array<{
      department: Bilingual;
      resident: number;
      internal: number;
      completed: number;
    }>;
  };
}

const fmtTime = (d: Date | null) =>
  d
    ? new Intl.DateTimeFormat("en-GB", {
        timeZone: REPORT_TIME_ZONE,
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }).format(d)
    : null;

export const fmtDuration = (m: number | null) =>
  m == null
    ? "—"
    : `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;

/** Today's date in Cairo as YYYY-MM-DD. */
export function cairoToday(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
  }).format(now);
}

/** Cairo wall-clock parts: date (YYYY-MM-DD), hour (0-23), minute (0-59). */
export function cairoNow(now = new Date()): {
  date: string;
  hour: number;
  minute: number;
} {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat("en-GB", {
      timeZone: REPORT_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(now)
      .map((p) => [p.type, p.value]),
  );
  return {
    date: cairoToday(now),
    hour: Number(parts.hour),
    minute: Number(parts.minute),
  };
}

/**
 * A once-a-day scheduled send is due when the configured Cairo time has passed
 * and it has not already been sent today — so a run missed during a restart
 * still goes out later the same day, and never twice.
 */
export function reportDueNow(
  cfg: { hour: number; minute: number; lastSent?: string | null },
  now = new Date(),
): boolean {
  const t = cairoNow(now);
  if (t.hour * 60 + t.minute < cfg.hour * 60 + cfg.minute) return false;
  return cfg.lastSent !== t.date;
}

/** Normalize a stored report language to 'ar' | 'en' (default 'en'). */
export function reportLang(raw: unknown): ReportLang {
  return raw === "ar" ? "ar" : "en";
}

/** Tickets reported or finished on `date` (Cairo), with day totals. */
export async function buildDailyReport(
  propertyId: number,
  date: string,
): Promise<DailyReport> {
  const [prop] = await db
    .select({
      name: propertiesTable.name,
      displayName: propertiesTable.displayName,
    })
    .from(propertiesTable)
    .where(eq(propertiesTable.id, propertyId))
    .limit(1);

  const { rows, openBacklog } = await withTenant(
    propertyId,
    async (tenantDb) => {
      const res = await tenantDb.execute(sql`
      SELECT m.id, m.category, m.problem_type, m.status, m.priority, m.source,
             m.reported_by, m.reported_at, m.started_at, m.resolved_at, m.due_date,
             r.room_number, b.name AS building_name, w.name AS worker_name,
             trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')) AS assignee_name
      FROM maintenance m
      LEFT JOIN rooms r ON r.id = m.room_id
      LEFT JOIN buildings b ON b.id = r.building_id
      LEFT JOIN workers w ON w.id = m.worker_id
      LEFT JOIN profiles p ON p.id = m.assigned_to
      WHERE (m.reported_at AT TIME ZONE ${REPORT_TIME_ZONE})::date = ${date}::date
         OR (m.resolved_at AT TIME ZONE ${REPORT_TIME_ZONE})::date = ${date}::date
      ORDER BY m.reported_at ASC, m.id ASC
    `);
      const backlog = await tenantDb.execute(sql`
      SELECT count(*)::int AS n FROM maintenance
      WHERE status IN ('open', 'pending', 'in_progress')
    `);
      return {
        rows: (res as any).rows ?? res,
        openBacklog: Number(((backlog as any).rows ?? backlog)[0]?.n ?? 0),
      };
    },
  );

  const catalogue = await loadServiceCatalogue(propertyId);
  const out: DailyReportRow[] = rows.map((r: any) => {
    const reportedAt = r.reported_at ? new Date(r.reported_at) : null;
    const startedAt = r.started_at ? new Date(r.started_at) : reportedAt;
    const resolvedAt = r.resolved_at ? new Date(r.resolved_at) : null;
    const durationMinutes =
      startedAt && resolvedAt
        ? Math.max(
            0,
            Math.round((resolvedAt.getTime() - startedAt.getTime()) / 60000),
          )
        : null;
    const own = catalogue.get(r.problem_type);
    const service = own
      ? { ar: own.labelAr, en: own.labelEn }
      : SERVICE_LABELS[r.problem_type];
    const dept = DEPT[r.category] ?? DEPT.maintenance;
    const status = STATUS[r.status] ?? { ar: r.status, en: r.status };
    const sla = ticketSla(
      {
        problemType: r.problem_type,
        priority: r.priority,
        status: r.status,
        reportedAt,
        resolvedAt,
        dueDate: r.due_date,
      },
      own?.targetMinutes,
    );
    return {
      ticketNo: ticketNumber({ id: r.id, category: r.category, reportedAt }),
      location: r.room_number
        ? `${r.room_number}${r.building_name ? ` · ${r.building_name}` : ""}`
        : r.building_name || "—",
      department: { ar: dept.ar, en: dept.en },
      service: service
        ? { ar: service.ar, en: service.en }
        : {
            ar: String(r.problem_type ?? "—"),
            en: String(r.problem_type ?? "—"),
          },
      status: { ar: status.ar, en: status.en },
      source:
        r.source === "portal" || r.source === "qr" ? "resident" : "internal",
      technician: r.worker_name || r.assignee_name || "—",
      start: fmtTime(startedAt),
      end: fmtTime(resolvedAt),
      durationMinutes,
      overdue: sla.isOverdue,
    };
  });

  const done = out.filter((r) => r.durationMinutes != null);
  const byDept = new Map<
    string,
    {
      department: Bilingual;
      resident: number;
      internal: number;
      completed: number;
    }
  >();
  for (const r of out) {
    const d = byDept.get(r.department.en) ?? {
      department: r.department,
      resident: 0,
      internal: 0,
      completed: 0,
    };
    d[r.source]++;
    if (r.durationMinutes != null) d.completed++;
    byDept.set(r.department.en, d);
  }

  return {
    propertyName: prop?.displayName || prop?.name || `Property ${propertyId}`,
    date,
    rows: out,
    summary: {
      total: out.length,
      completed: done.length,
      overdue: out.filter((r) => r.overdue).length,
      openBacklog,
      avgMinutes: done.length
        ? Math.round(
            done.reduce((s, r) => s + (r.durationMinutes ?? 0), 0) /
              done.length,
          )
        : null,
      byDepartment: [...byDept.values()].map((v) => ({ ...v })),
    },
  };
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

// Static labels for the maintenance report, in both languages.
const MNT_T = {
  reportTitle: {
    ar: "تقرير الصيانة والنظافة اليومي",
    en: "Daily Maintenance & Housekeeping Report",
  },
  totalTickets: { ar: "إجمالي البلاغات", en: "Total tickets" },
  completed: { ar: "تم التنفيذ", en: "Completed" },
  overTarget: { ar: "متأخر عن الوقت المستهدف", en: "Over target time" },
  avgTime: { ar: "متوسط وقت التنفيذ", en: "Average time (H:M)" },
  openBacklog: {
    ar: "مفتوح حالياً (كل الأيام)",
    en: "Open backlog (all days)",
  },
  byDepartment: { ar: "حسب القسم", en: "By department" },
  department: { ar: "القسم", en: "Department" },
  resident: { ar: "طلبات السكان", en: "Resident" },
  internal: { ar: "داخلي", en: "Internal" },
  tickets: { ar: "تفاصيل البلاغات", en: "Tickets" },
  ticket: { ar: "رقم التذكرة", en: "Ticket" },
  location: { ar: "المكان", en: "Location" },
  service: { ar: "الخدمة", en: "Service" },
  status: { ar: "الحالة", en: "Status" },
  source: { ar: "المصدر", en: "Source" },
  technician: { ar: "الفني", en: "Technician" },
  start: { ar: "البداية", en: "Start" },
  end: { ar: "النهاية", en: "End" },
  duration: { ar: "المدة (س:د)", en: "Duration (H:M)" },
  noTickets: { ar: "لا توجد بلاغات", en: "No tickets" },
  noTicketsDay: {
    ar: "لا توجد بلاغات في هذا اليوم",
    en: "No tickets on this day",
  },
  overTargetNote: {
    ar: "⚠ = تجاوز الوقت المستهدف للخدمة",
    en: "⚠ = exceeded the service's target time",
  },
  residentVal: { ar: "ساكن", en: "Resident" },
  internalVal: { ar: "داخلي", en: "Internal" },
} as const;

export function renderDailyReportHtml(
  r: DailyReport,
  lang: ReportLang = "en",
): string {
  const ar = lang === "ar";
  const t = (k: keyof typeof MNT_T) => esc(MNT_T[k][lang]);
  const bi = (b: Bilingual) => esc(b[lang]);
  const [y, m, d] = r.date.split("-");
  const dmy = `${d}/${m}/${y}`;
  const dir = ar ? "rtl" : "ltr";
  const align = ar ? "right" : "left";
  const card = (
    label: keyof typeof MNT_T,
    value: string | number,
    color = "#0F2A44",
  ) =>
    `<td style="padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;background:#fff">
       <div style="font-size:22px;font-weight:bold;color:${color}">${esc(value)}</div>
       <div style="font-size:12px;color:#6b7280">${t(label)}</div></td>`;
  const deptRows = r.summary.byDepartment
    .map(
      (x) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${bi(x.department)}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${x.resident}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${x.internal}</td>
        <td style="padding:6px 10px;border-bottom:1px solid #eee;text-align:center">${x.completed}</td></tr>`,
    )
    .join("");
  const rows = r.rows
    .map(
      (x) => `<tr style="${x.overdue ? "background:#fef2f2" : ""}">
        <td style="padding:5px 8px;border-bottom:1px solid #eee;font-family:monospace;white-space:nowrap">${esc(x.ticketNo)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${esc(x.location)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${bi(x.department)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${bi(x.service)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${bi(x.status)}${x.overdue ? ' <b style="color:#dc2626">⚠</b>' : ""}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${x.source === "resident" ? t("residentVal") : t("internalVal")}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${esc(x.technician)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;white-space:nowrap">${esc(x.start ?? "—")}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;white-space:nowrap">${esc(x.end ?? "—")}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;font-family:monospace">${fmtDuration(x.durationMinutes)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html dir="${dir}"><body style="margin:0;background:#f3f4f6;font-family:Tahoma,Arial,sans-serif;color:#111827;direction:${dir}">
  <div style="max-width:1100px;margin:0 auto;padding:20px">
    <div style="background:#0F2A44;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <div style="font-size:18px;font-weight:bold">${t("reportTitle")}</div>
      <div style="font-size:14px;margin-top:4px">${esc(r.propertyName)} · ${dmy}</div>
    </div>
    <div style="background:#fff;padding:16px 20px;border-radius:0 0 10px 10px">
      <table style="border-collapse:separate;border-spacing:8px;width:100%"><tr>
        ${card("totalTickets", r.summary.total)}
        ${card("completed", r.summary.completed, "#059669")}
        ${card("overTarget", r.summary.overdue, "#dc2626")}
        ${card("avgTime", fmtDuration(r.summary.avgMinutes))}
        ${card("openBacklog", r.summary.openBacklog, "#d97706")}
      </tr></table>
      <h3 style="font-size:14px;margin:18px 0 6px">${t("byDepartment")}</h3>
      <table style="border-collapse:collapse;font-size:13px;min-width:420px">
        <tr style="background:#f9fafb"><th style="padding:6px 10px;text-align:${align}">${t("department")}</th>
          <th style="padding:6px 10px">${t("resident")}</th><th style="padding:6px 10px">${t("internal")}</th>
          <th style="padding:6px 10px">${t("completed")}</th></tr>
        ${deptRows || `<tr><td colspan="4" style="padding:8px 10px;color:#6b7280">${t("noTickets")}</td></tr>`}
      </table>
      <h3 style="font-size:14px;margin:18px 0 6px">${t("tickets")}</h3>
      <table style="border-collapse:collapse;font-size:12px;width:100%">
        <tr style="background:#f9fafb">
          <th style="padding:6px 8px;text-align:${align}">${t("ticket")}</th><th style="padding:6px 8px;text-align:${align}">${t("location")}</th>
          <th style="padding:6px 8px;text-align:${align}">${t("department")}</th><th style="padding:6px 8px;text-align:${align}">${t("service")}</th>
          <th style="padding:6px 8px;text-align:${align}">${t("status")}</th><th style="padding:6px 8px;text-align:${align}">${t("source")}</th>
          <th style="padding:6px 8px;text-align:${align}">${t("technician")}</th><th style="padding:6px 8px;text-align:${align}">${t("start")}</th>
          <th style="padding:6px 8px;text-align:${align}">${t("end")}</th><th style="padding:6px 8px">${t("duration")}</th></tr>
        ${rows || `<tr><td colspan="10" style="padding:10px;color:#6b7280">${t("noTicketsDay")}</td></tr>`}
      </table>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px">${t("overTargetNote")} · Sunrise Staff Housing</p>
    </div>
  </div></body></html>`;
}

export function renderDailyReportCsv(
  r: DailyReport,
  lang: ReportLang = "en",
): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const L = (k: keyof typeof MNT_T) => MNT_T[k][lang];
  const header = [
    L("ticket"),
    L("location"),
    L("department"),
    L("service"),
    L("status"),
    L("source"),
    L("technician"),
    L("start"),
    L("end"),
    L("duration"),
    L("overTarget"),
  ];
  const yesNo = lang === "ar" ? ["نعم", "لا"] : ["Yes", "No"];
  const lines = r.rows.map((x) =>
    [
      x.ticketNo,
      x.location,
      x.department[lang],
      x.service[lang],
      x.status[lang],
      x.source === "resident"
        ? MNT_T.residentVal[lang]
        : MNT_T.internalVal[lang],
      x.technician,
      x.start ?? "",
      x.end ?? "",
      fmtDuration(x.durationMinutes),
      x.overdue ? yesNo[0] : yesNo[1],
    ]
      .map(cell)
      .join(","),
  );
  // BOM so Excel opens the Arabic text as UTF-8.
  return "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
}

/** Recipients configured for the property's nightly report (validated emails). */
export function parseRecipients(raw?: string | null): string[] {
  return [
    ...new Set(
      String(raw ?? "")
        .split(/[,;\s]+/)
        .map((e) => e.trim().toLowerCase())
        .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)),
    ),
  ].slice(0, 50);
}

/** Build and email the report for one property. */
export async function sendDailyReport(
  propertyId: number,
  date: string,
  recipientsOverride?: string[],
  langOverride?: ReportLang,
): Promise<{
  sent: boolean;
  recipients: string[];
  reason?: string;
  tickets: number;
}> {
  const settings = await withTenant(propertyId, async (tenantDb) => {
    const [s] = await tenantDb.select().from(settingsTable).limit(1);
    return s as any;
  });
  const lang = langOverride ?? reportLang(settings?.maintenanceReportLang);
  const recipients =
    recipientsOverride ?? parseRecipients(settings?.maintenanceReportEmails);
  const report = await buildDailyReport(propertyId, date);
  if (recipients.length === 0) {
    return {
      sent: false,
      recipients,
      reason: "No recipients",
      tickets: report.rows.length,
    };
  }
  const smtp = {
    smtpHost: settings?.smtpHost,
    smtpPort: settings?.smtpPort,
    smtpSecure: settings?.smtpSecure,
    smtpUser: settings?.smtpUser,
    smtpPass: settings?.smtpPass,
    smtpFrom: settings?.smtpFrom,
  };
  if (!isSmtpConfigured(smtp)) {
    return {
      sent: false,
      recipients,
      reason: "SMTP not configured",
      tickets: report.rows.length,
    };
  }
  const [y, m, d] = date.split("-");
  const transporter = createTransporter(smtp);
  await transporter.sendMail({
    from:
      smtp.smtpFrom ||
      process.env.SMTP_FROM ||
      `"SUNRISE Housing" <${smtp.smtpUser || process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`,
    to: recipients.join(", "),
    subject:
      lang === "ar"
        ? `تقرير الصيانة والنظافة ${d}-${m}-${y} — ${report.propertyName}`
        : `Maintenance Daily ${d}-${m}-${y} — ${report.propertyName}`,
    html: renderDailyReportHtml(report, lang),
    attachments: [
      {
        filename: `Maintenance_Daily_${d}-${m}-${y}.csv`,
        content: renderDailyReportCsv(report, lang),
        contentType: "text/csv; charset=utf-8",
      },
    ],
  });
  return { sent: true, recipients, tickets: report.rows.length };
}

/**
 * Checked every few minutes (Cairo): each property that enabled the report and
 * has reached its configured send time, and hasn't been sent today, gets it —
 * so the admin picks the time and a missed run still goes out the same day.
 */
export function initMaintenanceReportCron(): void {
  cron.schedule(
    "*/5 * * * *",
    async () => {
      const now = new Date();
      const today = cairoToday(now);
      const props = await db
        .select({ id: propertiesTable.id })
        .from(propertiesTable);
      for (const p of props) {
        try {
          const s: any = await withTenant(p.id, async (tenantDb) => {
            const [row] = await tenantDb.select().from(settingsTable).limit(1);
            return row;
          });
          if (!s?.maintenanceReportEnabled) continue;
          if (
            !reportDueNow(
              {
                hour: s.maintenanceReportHour ?? 22,
                minute: s.maintenanceReportMinute ?? 0,
                lastSent: s.maintenanceReportLastSent,
              },
              now,
            )
          )
            continue;
          // Stamp first so a slow send can't double-fire on the next tick.
          await withTenant(p.id, (tenantDb) =>
            tenantDb
              .update(settingsTable)
              .set({ maintenanceReportLastSent: today } as any),
          );
          const r = await sendDailyReport(p.id, today);
          logger.info(
            {
              propertyId: p.id,
              date: today,
              sent: r.sent,
              reason: r.reason,
              tickets: r.tickets,
            },
            "maintenance daily report",
          );
        } catch (err: any) {
          logger.error(
            { propertyId: p.id, err: err?.message },
            "maintenance daily report failed",
          );
        }
      }
    },
    { timezone: REPORT_TIME_ZONE },
  );
  logger.info(
    "Maintenance daily report dispatcher active (checks every 5 min)",
  );
}
