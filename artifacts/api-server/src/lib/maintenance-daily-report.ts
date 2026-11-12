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

const SERVICE_LABELS: Record<string, { ar: string; en: string }> = {
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

export interface DailyReportRow {
  ticketNo: string;
  location: string;
  department: string;
  service: string;
  status: string;
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
      department: string;
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
      department: `${dept.ar} / ${dept.en}`,
      service: service
        ? `${service.ar} - ${service.en}`
        : String(r.problem_type ?? "—"),
      status: `${status.ar} / ${status.en}`,
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
    { resident: number; internal: number; completed: number }
  >();
  for (const r of out) {
    const d = byDept.get(r.department) ?? {
      resident: 0,
      internal: 0,
      completed: 0,
    };
    d[r.source]++;
    if (r.durationMinutes != null) d.completed++;
    byDept.set(r.department, d);
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
      byDepartment: [...byDept.entries()].map(([department, v]) => ({
        department,
        ...v,
      })),
    },
  };
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function renderDailyReportHtml(r: DailyReport): string {
  const [y, m, d] = r.date.split("-");
  const dmy = `${d}/${m}/${y}`;
  const card = (
    labelAr: string,
    labelEn: string,
    value: string | number,
    color = "#0F2A44",
  ) =>
    `<td style="padding:10px 14px;border:1px solid #e5e7eb;border-radius:8px;text-align:center;background:#fff">
       <div style="font-size:22px;font-weight:bold;color:${color}">${esc(value)}</div>
       <div style="font-size:12px;color:#6b7280">${labelAr}<br/>${labelEn}</div></td>`;
  const deptRows = r.summary.byDepartment
    .map(
      (x) => `<tr>
        <td style="padding:6px 10px;border-bottom:1px solid #eee">${esc(x.department)}</td>
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
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${esc(x.department)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${esc(x.service)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${esc(x.status)}${x.overdue ? ' <b style="color:#dc2626">⚠</b>' : ""}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${x.source === "resident" ? "ساكن / Resident" : "داخلي / Internal"}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${esc(x.technician)}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;white-space:nowrap">${esc(x.start ?? "—")}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;white-space:nowrap">${esc(x.end ?? "—")}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee;text-align:center;font-family:monospace">${fmtDuration(x.durationMinutes)}</td></tr>`,
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Tahoma,Arial,sans-serif;color:#111827">
  <div style="max-width:1100px;margin:0 auto;padding:20px">
    <div style="background:#0F2A44;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <div style="font-size:18px;font-weight:bold">تقرير الصيانة والنظافة اليومي — Daily Maintenance &amp; Housekeeping Report</div>
      <div style="font-size:14px;margin-top:4px">${esc(r.propertyName)} · ${dmy}</div>
    </div>
    <div style="background:#fff;padding:16px 20px;border-radius:0 0 10px 10px">
      <table style="border-collapse:separate;border-spacing:8px;width:100%"><tr>
        ${card("إجمالي البلاغات", "Total tickets", r.summary.total)}
        ${card("تم التنفيذ", "Completed", r.summary.completed, "#059669")}
        ${card("متأخر عن الوقت المستهدف", "Over target time", r.summary.overdue, "#dc2626")}
        ${card("متوسط وقت التنفيذ", "Average time (H:M)", fmtDuration(r.summary.avgMinutes))}
        ${card("مفتوح حالياً (كل الأيام)", "Open backlog (all days)", r.summary.openBacklog, "#d97706")}
      </tr></table>
      <h3 style="font-size:14px;margin:18px 0 6px">حسب القسم — By department</h3>
      <table style="border-collapse:collapse;font-size:13px;min-width:420px">
        <tr style="background:#f9fafb"><th style="padding:6px 10px;text-align:start">القسم / Department</th>
          <th style="padding:6px 10px">طلبات السكان<br/>Resident</th><th style="padding:6px 10px">داخلي<br/>Internal</th>
          <th style="padding:6px 10px">تم التنفيذ<br/>Completed</th></tr>
        ${deptRows || '<tr><td colspan="4" style="padding:8px 10px;color:#6b7280">لا توجد بلاغات / No tickets</td></tr>'}
      </table>
      <h3 style="font-size:14px;margin:18px 0 6px">تفاصيل البلاغات — Tickets</h3>
      <table style="border-collapse:collapse;font-size:12px;width:100%">
        <tr style="background:#f9fafb">
          <th style="padding:6px 8px;text-align:start">رقم التذكرة<br/>Ticket</th><th style="padding:6px 8px;text-align:start">المكان<br/>Location</th>
          <th style="padding:6px 8px;text-align:start">القسم<br/>Department</th><th style="padding:6px 8px;text-align:start">الخدمة<br/>Service</th>
          <th style="padding:6px 8px;text-align:start">الحالة<br/>Status</th><th style="padding:6px 8px;text-align:start">المصدر<br/>Source</th>
          <th style="padding:6px 8px;text-align:start">الفني<br/>Technician</th><th style="padding:6px 8px;text-align:start">البداية<br/>Start</th>
          <th style="padding:6px 8px;text-align:start">النهاية<br/>End</th><th style="padding:6px 8px">المدة<br/>H:M</th></tr>
        ${rows || '<tr><td colspan="10" style="padding:10px;color:#6b7280">لا توجد بلاغات في هذا اليوم / No tickets on this day</td></tr>'}
      </table>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px">⚠ = تجاوز الوقت المستهدف للخدمة / exceeded the service's target time · Sunrise Staff Housing</p>
    </div>
  </div></body></html>`;
}

export function renderDailyReportCsv(r: DailyReport): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Ticket",
    "Location",
    "Department",
    "Service",
    "Status",
    "Source",
    "Technician",
    "Start",
    "End",
    "Duration (H:M)",
    "Over target",
  ];
  const lines = r.rows.map((x) =>
    [
      x.ticketNo,
      x.location,
      x.department,
      x.service,
      x.status,
      x.source === "resident" ? "Resident" : "Internal",
      x.technician,
      x.start ?? "",
      x.end ?? "",
      fmtDuration(x.durationMinutes),
      x.overdue ? "Yes" : "No",
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
    subject: `Maintenance Daily ${d}-${m}-${y} — ${report.propertyName}`,
    html: renderDailyReportHtml(report),
    attachments: [
      {
        filename: `Maintenance_Daily_${d}-${m}-${y}.csv`,
        content: renderDailyReportCsv(report),
        contentType: "text/csv; charset=utf-8",
      },
    ],
  });
  return { sent: true, recipients, tickets: report.rows.length };
}

/** Every night at 22:00 Cairo time, for properties that enabled the report. */
export function initMaintenanceReportCron(): void {
  cron.schedule(
    "0 22 * * *",
    async () => {
      const date = cairoToday();
      const props = await db
        .select({ id: propertiesTable.id })
        .from(propertiesTable);
      for (const p of props) {
        try {
          const enabled = await withTenant(p.id, async (tenantDb) => {
            const [s] = await tenantDb.select().from(settingsTable).limit(1);
            return !!(s as any)?.maintenanceReportEnabled;
          });
          if (!enabled) continue;
          const r = await sendDailyReport(p.id, date);
          logger.info(
            {
              propertyId: p.id,
              date,
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
  logger.info("Maintenance daily report scheduled for 22:00 Africa/Cairo");
}
