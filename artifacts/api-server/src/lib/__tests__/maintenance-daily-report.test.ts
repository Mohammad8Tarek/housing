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
      department: "الصيانة / Engineering",
      service: "سباكة - Plumbing",
      status: "مغلق / Closed",
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
        department: "الصيانة / Engineering",
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
