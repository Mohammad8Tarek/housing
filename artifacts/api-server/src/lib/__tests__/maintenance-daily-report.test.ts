import { describe, expect, it } from "vitest";
import {
  cairoToday,
  fmtDuration,
  parseRecipients,
  renderDailyReportCsv,
  renderDailyReportHtml,
  type DailyReport,
} from "../maintenance-daily-report";

const report: DailyReport = {
  propertyName: "Test <Hotel>",
  date: "2026-11-11",
  rows: [
    {
      ticketNo: "MNT-2026-0001",
      location: "101 · B1",
      department: { ar: "الصيانة", en: "Engineering" },
      service: { ar: "سباكة", en: "Plumbing" },
      status: { ar: "مغلق", en: "Closed" },
      source: "resident",
      technician: 'Ali "the fixer"',
      start: "11/11/2026, 09:00",
      end: "11/11/2026, 09:21",
      durationMinutes: 21,
      overdue: false,
    },
  ],
  summary: {
    total: 1,
    completed: 1,
    overdue: 0,
    openBacklog: 3,
    avgMinutes: 21,
    byDepartment: [
      {
        department: { ar: "الصيانة", en: "Engineering" },
        resident: 1,
        internal: 0,
        completed: 1,
      },
    ],
  },
};

describe("daily report helpers", () => {
  it("formats durations as H:M", () => {
    expect(fmtDuration(21)).toBe("00:21");
    expect(fmtDuration(135)).toBe("02:15");
    expect(fmtDuration(null)).toBe("—");
  });

  it("keeps only valid, unique recipient emails", () => {
    expect(
      parseRecipients("GM@hotel.com, gm@hotel.com; bad, eng@hotel.com\nx@y"),
    ).toEqual(["gm@hotel.com", "eng@hotel.com"]);
    expect(parseRecipients(null)).toEqual([]);
  });

  it("CSV has a BOM, a header and quoted cells", () => {
    const csv = renderDailyReportCsv(report);
    expect(csv.startsWith("﻿")).toBe(true);
    const lines = csv.slice(1).split("\r\n");
    expect(lines).toHaveLength(2);
    expect(lines[1]).toContain('"Ali ""the fixer"""');
    expect(lines[1]).toContain('"00:21"');
  });

  it("defaults to English and renders Arabic when asked", () => {
    const en = renderDailyReportHtml(report);
    expect(en).toContain("Daily Maintenance &amp; Housekeeping Report");
    expect(en).toContain("Engineering");
    expect(en).toContain("Plumbing");
    expect(en).not.toContain("الصيانة");

    const ar = renderDailyReportHtml(report, "ar");
    expect(ar).toContain("تقرير الصيانة والنظافة اليومي");
    expect(ar).toContain("الصيانة");
    expect(ar).toContain('dir="rtl"');

    const csvEn = renderDailyReportCsv(report);
    expect(csvEn).toContain("Plumbing");
    expect(csvEn).not.toContain("سباكة");
    const csvAr = renderDailyReportCsv(report, "ar");
    expect(csvAr).toContain("سباكة");
  });

  it("HTML escapes values and shows the date as DD/MM/YYYY", () => {
    const html = renderDailyReportHtml(report);
    expect(html).toContain("Test &lt;Hotel&gt;");
    expect(html).not.toContain("Test <Hotel>");
    expect(html).toContain("11/11/2026");
    expect(html).toContain("MNT-2026-0001");
  });

  it("cairoToday is YYYY-MM-DD", () => {
    expect(cairoToday(new Date("2026-11-11T23:30:00Z"))).toBe("2026-11-12");
  });
});
