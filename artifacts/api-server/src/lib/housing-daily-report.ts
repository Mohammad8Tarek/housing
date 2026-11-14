// Nightly housing operations report per property: what happened in the
// accommodation today — who was housed (check-ins), who was moved (room
// transfers), who checked out — plus everyone currently living in breach of
// the housing policy (same engine the screens use), flagging whether each
// breach has an approved exception, and stays kept past their expected
// check-out date. Sent as a bilingual HTML email with a CSV attachment.
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db, propertiesTable, settingsTable, withTenant } from "@workspace/db";
import { checkPolicyCompliance } from "@workspace/report-rows";
import { createTransporter, isSmtpConfigured } from "./email-service.js";
import {
  REPORT_TIME_ZONE,
  cairoToday,
  parseRecipients,
} from "./maintenance-daily-report.js";
import { logger } from "./logger.js";

export interface MovementRow {
  name: string;
  nameEn: string;
  code: string;
  room: string;
  building: string;
  detail: string; // bed / reason / from→to
  by: string;
}

export interface ViolationRow {
  name: string;
  nameEn: string;
  code: string;
  room: string;
  building: string;
  violations: { code: string; messageAr: string; messageEn: string }[];
  approved: boolean;
  approvedBy: string | null;
}

export interface HousingDailyReport {
  propertyName: string;
  date: string; // YYYY-MM-DD (Cairo)
  checkIns: MovementRow[];
  transfers: MovementRow[];
  checkOuts: MovementRow[];
  violations: ViolationRow[];
  summary: {
    checkIns: number;
    transfers: number;
    checkOuts: number;
    occupied: number; // residents currently in-house
    violations: number;
    unapprovedViolations: number;
  };
}

const rows = (res: any): any[] => (res as any)?.rows ?? res ?? [];
const fullName = (ar?: string, en?: string) => (ar || en || "").trim() || "—";
/** Cairo date of a text column that may be ISO or a bare YYYY-MM-DD. */
const cairoDate = (col: any) =>
  sql`(nullif(${col}, '')::timestamptz AT TIME ZONE ${REPORT_TIME_ZONE})::date`;

/** Build today's housing operations report for one property (Cairo date). */
export async function buildHousingDailyReport(
  propertyId: number,
  date: string,
): Promise<HousingDailyReport> {
  const [prop] = await db
    .select({
      name: propertiesTable.name,
      displayName: propertiesTable.displayName,
    })
    .from(propertiesTable)
    .where(sql`${propertiesTable.id} = ${propertyId}`)
    .limit(1);

  const data = await withTenant(propertyId, async (tenantDb) => {
    // Check-ins today: assignments created today that are currently housed
    // (a transfer updates the existing row, so it is not double-counted here).
    const checkIns = rows(
      await tenantDb.execute(sql`
      SELECT a.bed_number, a.is_entire_room,
             p.profile_id AS code, p.first_name, p.last_name,
             p.first_name_ar, p.last_name_ar, p.department,
             r.room_number, b.name AS building_name
      FROM assignments a
      JOIN profiles p ON p.id = a.profile_id
      JOIN rooms r ON r.id = a.room_id
      LEFT JOIN buildings b ON b.id = r.building_id
      WHERE upper(a.status) IN ('ACTIVE','VACATION','OCCUPIED_VACATION')
        AND (a.created_at AT TIME ZONE ${REPORT_TIME_ZONE})::date = ${date}::date
      ORDER BY a.created_at ASC`),
    );

    // Room moves today.
    const transfers = rows(
      await tenantDb.execute(sql`
      SELECT resident_name, resident_name_en, employee_id AS code, department,
             old_room_number, old_bed_number, old_building_name,
             new_room_number, new_bed_number, new_building_name,
             move_reason, action_by_username
      FROM room_moves
      WHERE (created_at AT TIME ZONE ${REPORT_TIME_ZONE})::date = ${date}::date
      ORDER BY created_at ASC`),
    );

    // Real departures today (transfers keep their own TRANSFERRED history row,
    // excluded here so a move is not also counted as a check-out).
    const checkOuts = rows(
      await tenantDb.execute(sql`
      SELECT p.profile_id AS code, p.first_name, p.last_name,
             p.first_name_ar, p.last_name_ar, a.check_out_reason,
             r.room_number, b.name AS building_name
      FROM assignments a
      JOIN profiles p ON p.id = a.profile_id
      JOIN rooms r ON r.id = a.room_id
      LEFT JOIN buildings b ON b.id = r.building_id
      WHERE nullif(a.check_out_date, '') IS NOT NULL
        AND upper(a.status) NOT IN ('ACTIVE','TRANSFERRED','VACATION','OCCUPIED_VACATION')
        AND ${cairoDate(sql`a.check_out_date`)} = ${date}::date
      ORDER BY a.check_out_date ASC`),
    );

    // Everyone currently in-house, for the live policy check.
    const active = rows(
      await tenantDb.execute(sql`
      SELECT a.id, a.room_id, a.bed_number, a.is_entire_room,
             a.has_policy_exception, a.policy_approved_by,
             a.expected_check_out_date,
             p.id AS profile_id, p.profile_id AS code,
             p.first_name, p.last_name, p.first_name_ar, p.last_name_ar,
             p.level, p.gender, p.department, p.job_title,
             p.contract_end_date, p.vacation_notes AS profile_notes,
             r.room_number, r.capacity, r.gender AS room_gender,
             r.room_type, r.classification, r.notes AS room_notes,
             b.name AS building_name
      FROM assignments a
      JOIN profiles p ON p.id = a.profile_id
      JOIN rooms r ON r.id = a.room_id
      LEFT JOIN buildings b ON b.id = r.building_id
      WHERE upper(a.status) IN ('ACTIVE','VACATION','OCCUPIED_VACATION')`),
    );

    const [settings] = (await tenantDb
      .select()
      .from(settingsTable)
      .limit(1)) as any[];

    return { checkIns, transfers, checkOuts, active, settings };
  });

  // Shared shapes for the policy engine (built once).
  const allAssignments = data.active.map((r: any) => ({
    id: r.id,
    roomId: r.room_id,
    status: "ACTIVE",
    profileId: r.profile_id,
  }));
  const allProfiles = data.active.map((r: any) => ({
    id: r.profile_id,
    profileId: r.code,
    firstName: r.first_name,
    lastName: r.last_name,
    level: r.level,
    gender: r.gender,
    department: r.department,
    jobTitle: r.job_title,
    contractEndDate: r.contract_end_date,
    notes: r.profile_notes,
  }));

  const OVERSTAY = {
    code: "OVERSTAY",
    messageAr: "تجاوز تاريخ المغادرة المتوقع ولا يزال مقيماً",
    messageEn: "Past expected check-out date and still in-house",
  };

  const violations: ViolationRow[] = [];
  for (const r of data.active) {
    const profile = {
      id: r.profile_id,
      profileId: r.code,
      firstName: r.first_name,
      lastName: r.last_name,
      level: r.level,
      gender: r.gender,
      department: r.department,
      jobTitle: r.job_title,
      contractEndDate: r.contract_end_date,
      notes: r.profile_notes,
    };
    const room = {
      id: r.room_id,
      capacity: r.capacity,
      gender: r.room_gender,
      classification: r.classification,
      roomType: r.room_type,
      notes: r.room_notes,
    };
    const { violations: found } = checkPolicyCompliance({
      profile,
      room,
      assignments: allAssignments,
      profiles: allProfiles,
      policySettings: data.settings ?? {},
      isEntireRoom: Boolean(r.is_entire_room),
    });
    const list = [...found];
    const exp = String(r.expected_check_out_date ?? "").slice(0, 10);
    if (exp && exp < date) list.push(OVERSTAY);
    if (list.length === 0) continue;
    violations.push({
      name: fullName(
        `${r.first_name_ar ?? ""} ${r.last_name_ar ?? ""}`,
        `${r.first_name ?? ""} ${r.last_name ?? ""}`,
      ),
      nameEn: fullName(`${r.first_name ?? ""} ${r.last_name ?? ""}`),
      code: r.code ?? "",
      room: r.room_number ?? "—",
      building: r.building_name ?? "",
      violations: list,
      approved: Boolean(r.has_policy_exception),
      approvedBy: r.policy_approved_by ?? null,
    });
  }
  // Unapproved breaches first, then by room.
  violations.sort(
    (a, b) =>
      Number(a.approved) - Number(b.approved) ||
      String(a.room).localeCompare(String(b.room), undefined, {
        numeric: true,
      }),
  );

  const toCheckIn = (r: any): MovementRow => ({
    name: fullName(
      `${r.first_name_ar ?? ""} ${r.last_name_ar ?? ""}`,
      `${r.first_name ?? ""} ${r.last_name ?? ""}`,
    ),
    nameEn: fullName(`${r.first_name ?? ""} ${r.last_name ?? ""}`),
    code: r.code ?? "",
    room: r.room_number ?? "—",
    building: r.building_name ?? "",
    detail: r.is_entire_room
      ? "غرفة كاملة / Entire room"
      : r.bed_number
        ? `سرير / Bed ${r.bed_number}`
        : "",
    by: "",
  });

  return {
    propertyName: prop?.displayName || prop?.name || `Property ${propertyId}`,
    date,
    checkIns: data.checkIns.map(toCheckIn),
    transfers: data.transfers.map((r: any) => ({
      name: fullName(r.resident_name, r.resident_name_en),
      nameEn: fullName(r.resident_name_en, r.resident_name),
      code: r.code ?? "",
      room: `${r.old_room_number ?? "?"} ← → ${r.new_room_number ?? "?"}`,
      building:
        r.new_building_name && r.new_building_name !== r.old_building_name
          ? `${r.old_building_name ?? ""} → ${r.new_building_name ?? ""}`
          : (r.new_building_name ?? r.old_building_name ?? ""),
      detail: r.move_reason ?? "",
      by: r.action_by_username ?? "",
    })),
    checkOuts: data.checkOuts.map((r: any) => ({
      name: fullName(
        `${r.first_name_ar ?? ""} ${r.last_name_ar ?? ""}`,
        `${r.first_name ?? ""} ${r.last_name ?? ""}`,
      ),
      nameEn: fullName(`${r.first_name ?? ""} ${r.last_name ?? ""}`),
      code: r.code ?? "",
      room: r.room_number ?? "—",
      building: r.building_name ?? "",
      detail: r.check_out_reason ?? "",
      by: "",
    })),
    violations,
    summary: {
      checkIns: data.checkIns.length,
      transfers: data.transfers.length,
      checkOuts: data.checkOuts.length,
      occupied: data.active.length,
      violations: violations.length,
      unapprovedViolations: violations.filter((v) => !v.approved).length,
    },
  };
}

const esc = (s: unknown) =>
  String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");

export function renderHousingDailyHtml(r: HousingDailyReport): string {
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
  const th = (t: string) =>
    `<th style="padding:6px 8px;text-align:start;background:#f9fafb">${t}</th>`;
  const td = (t: unknown) =>
    `<td style="padding:5px 8px;border-bottom:1px solid #eee">${esc(t)}</td>`;

  const moveTable = (
    list: MovementRow[],
    detailAr: string,
    detailEn: string,
    showBy: boolean,
    emptyAr: string,
  ) =>
    `<table style="border-collapse:collapse;font-size:12px;width:100%;margin-bottom:8px">
      <tr>${th("الاسم<br/>Name")}${th("الكود<br/>Code")}${th("الغرفة<br/>Room")}${th("المبنى<br/>Building")}${th(`${detailAr}<br/>${detailEn}`)}${showBy ? th("بواسطة<br/>By") : ""}</tr>
      ${
        list.length
          ? list
              .map(
                (x) =>
                  `<tr>${td(x.name)}${td(x.code)}${td(x.room)}${td(x.building)}${td(x.detail || "—")}${showBy ? td(x.by || "—") : ""}</tr>`,
              )
              .join("")
          : `<tr><td colspan="${showBy ? 6 : 5}" style="padding:10px;color:#6b7280">${emptyAr}</td></tr>`
      }
    </table>`;

  const violRows = r.violations.length
    ? r.violations
        .map(
          (v) => `<tr style="${v.approved ? "" : "background:#fef2f2"}">
        ${td(v.name)}${td(v.code)}${td(v.room)}${td(v.building)}
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${v.violations.map((x) => esc(x.messageAr)).join("<br/>")}</td>
        <td style="padding:5px 8px;border-bottom:1px solid #eee">${
          v.approved
            ? `<span style="color:#059669">معتمد / Approved${v.approvedBy ? ` — ${esc(v.approvedBy)}` : ""}</span>`
            : '<b style="color:#dc2626">بدون اعتماد / Not approved</b>'
        }</td></tr>`,
        )
        .join("")
    : `<tr><td colspan="6" style="padding:10px;color:#6b7280">لا توجد مخالفات حالية / No current violations 🎉</td></tr>`;

  return `<!doctype html><html><body style="margin:0;background:#f3f4f6;font-family:Tahoma,Arial,sans-serif;color:#111827">
  <div style="max-width:1100px;margin:0 auto;padding:20px">
    <div style="background:#0F2A44;color:#fff;padding:16px 20px;border-radius:10px 10px 0 0">
      <div style="font-size:18px;font-weight:bold">تقرير عمليات السكن اليومي — Daily Housing Operations Report</div>
      <div style="font-size:14px;margin-top:4px">${esc(r.propertyName)} · ${dmy}</div>
    </div>
    <div style="background:#fff;padding:16px 20px;border-radius:0 0 10px 10px">
      <table style="border-collapse:separate;border-spacing:8px;width:100%"><tr>
        ${card("تسكين اليوم", "Checked in", r.summary.checkIns, "#059669")}
        ${card("نقل اليوم", "Transfers", r.summary.transfers)}
        ${card("مغادرة اليوم", "Checked out", r.summary.checkOuts, "#d97706")}
        ${card("المقيمون حالياً", "Currently in-house", r.summary.occupied)}
        ${card("مخالفات حالية", "Policy violations", r.summary.violations, r.summary.violations ? "#dc2626" : "#059669")}
        ${card("مخالفات بدون اعتماد", "Not approved", r.summary.unapprovedViolations, r.summary.unapprovedViolations ? "#dc2626" : "#059669")}
      </tr></table>

      <h3 style="font-size:14px;margin:18px 0 6px">🟢 تسكين اليوم — Checked in today</h3>
      ${moveTable(r.checkIns, "السرير", "Bed", false, "لا يوجد تسكين اليوم / No check-ins today")}

      <h3 style="font-size:14px;margin:18px 0 6px">🔄 عمليات النقل — Room transfers today</h3>
      ${moveTable(r.transfers, "السبب", "Reason", true, "لا يوجد نقل اليوم / No transfers today")}

      <h3 style="font-size:14px;margin:18px 0 6px">🟠 المغادرة — Checked out today</h3>
      ${moveTable(r.checkOuts, "السبب", "Reason", false, "لا توجد مغادرة اليوم / No check-outs today")}

      <h3 style="font-size:14px;margin:18px 0 6px">⚠ مخالفات سياسة السكن الحالية — Current policy violations</h3>
      <table style="border-collapse:collapse;font-size:12px;width:100%">
        <tr>${th("الاسم<br/>Name")}${th("الكود<br/>Code")}${th("الغرفة<br/>Room")}${th("المبنى<br/>Building")}${th("المخالفة<br/>Violation")}${th("الاعتماد<br/>Exception")}</tr>
        ${violRows}
      </table>
      <p style="font-size:11px;color:#9ca3af;margin-top:16px">المخالفات غير المعتمدة بالأحمر — تحتاج اعتماد استثناء أو تصحيح. Sunrise Staff Housing.</p>
    </div>
  </div></body></html>`;
}

export function renderHousingDailyCsv(r: HousingDailyReport): string {
  const cell = (v: unknown) => `"${String(v ?? "").replace(/"/g, '""')}"`;
  const header = [
    "Type",
    "Name",
    "Code",
    "Room",
    "Building",
    "Detail",
    "By / Approval",
  ];
  const lines: string[] = [];
  for (const x of r.checkIns)
    lines.push(
      ["Check-in", x.nameEn, x.code, x.room, x.building, x.detail, ""]
        .map(cell)
        .join(","),
    );
  for (const x of r.transfers)
    lines.push(
      ["Transfer", x.nameEn, x.code, x.room, x.building, x.detail, x.by]
        .map(cell)
        .join(","),
    );
  for (const x of r.checkOuts)
    lines.push(
      ["Check-out", x.nameEn, x.code, x.room, x.building, x.detail, ""]
        .map(cell)
        .join(","),
    );
  for (const v of r.violations)
    lines.push(
      [
        "Violation",
        v.nameEn,
        v.code,
        v.room,
        v.building,
        v.violations.map((x) => x.messageEn).join("; "),
        v.approved
          ? `Approved${v.approvedBy ? ` by ${v.approvedBy}` : ""}`
          : "NOT APPROVED",
      ]
        .map(cell)
        .join(","),
    );
  // BOM so Excel reads the Arabic as UTF-8.
  return "﻿" + [header.map(cell).join(","), ...lines].join("\r\n");
}

/** Build and email the housing report for one property. */
export async function sendHousingDailyReport(
  propertyId: number,
  date: string,
  recipientsOverride?: string[],
): Promise<{
  sent: boolean;
  recipients: string[];
  reason?: string;
  violations: number;
}> {
  const settings = await withTenant(propertyId, async (tenantDb) => {
    const [s] = await tenantDb.select().from(settingsTable).limit(1);
    return s as any;
  });
  const recipients =
    recipientsOverride ?? parseRecipients(settings?.housingReportEmails);
  const report = await buildHousingDailyReport(propertyId, date);
  if (recipients.length === 0) {
    return {
      sent: false,
      recipients,
      reason: "No recipients",
      violations: report.violations.length,
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
      violations: report.violations.length,
    };
  }
  const [y, m, d] = date.split("-");
  await createTransporter(smtp).sendMail({
    from:
      smtp.smtpFrom ||
      process.env.SMTP_FROM ||
      `"SUNRISE Housing" <${smtp.smtpUser || process.env.SMTP_USER || "noreply@sunrise-resorts.com"}>`,
    to: recipients.join(", "),
    subject: `Housing Daily ${d}-${m}-${y} — ${report.propertyName}`,
    html: renderHousingDailyHtml(report),
    attachments: [
      {
        filename: `Housing_Daily_${d}-${m}-${y}.csv`,
        content: renderHousingDailyCsv(report),
        contentType: "text/csv; charset=utf-8",
      },
    ],
  });
  return { sent: true, recipients, violations: report.violations.length };
}

/** Every night at 21:30 Cairo, for properties that enabled the housing report. */
export function initHousingReportCron(): void {
  cron.schedule(
    "30 21 * * *",
    async () => {
      const date = cairoToday();
      const props = await db
        .select({ id: propertiesTable.id })
        .from(propertiesTable);
      for (const p of props) {
        try {
          const enabled = await withTenant(p.id, async (tenantDb) => {
            const [s] = await tenantDb.select().from(settingsTable).limit(1);
            return !!(s as any)?.housingReportEnabled;
          });
          if (!enabled) continue;
          const r = await sendHousingDailyReport(p.id, date);
          logger.info(
            { propertyId: p.id, date, sent: r.sent, reason: r.reason },
            "housing daily report",
          );
        } catch (err: any) {
          logger.error(
            { propertyId: p.id, err: err?.message },
            "housing daily report failed",
          );
        }
      }
    },
    { timezone: REPORT_TIME_ZONE },
  );
  logger.info("Housing daily report scheduled for 21:30 Africa/Cairo");
}
