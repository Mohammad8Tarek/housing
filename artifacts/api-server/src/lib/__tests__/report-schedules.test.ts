import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({}));
vi.mock("../email-service.js", () => ({}));
vi.mock("../maintenance-daily-report.js", () => ({
  REPORT_TIME_ZONE: "Africa/Cairo",
  parseRecipients: (s: string) => s.split(","),
}));
vi.mock("../report-rows-server.js", () => ({}));
vi.mock("../session-store-ref.js", () => ({}));

const { cairoParts, isDue, renderCsv, reportColumns } =
  await import("../report-schedules");

// 2026-11-12 is a Thursday; Cairo is UTC+2 in November.
const at = (iso: string) => new Date(iso);
const base = {
  enabled: true,
  frequency: "daily",
  dayOfWeek: null,
  dayOfMonth: null,
  hour: 8,
  lastRunAt: null,
} as any;

describe("cairoParts", () => {
  it("uses Cairo time", () => {
    expect(cairoParts(at("2026-11-12T22:30:00Z"))).toMatchObject({
      date: "2026-11-13",
      hour: 0,
      weekday: 5,
    });
  });
});

describe("isDue", () => {
  it("daily: from the hour on, once a day", () => {
    expect(isDue(base, at("2026-11-12T05:59:00Z"))).toBe(false); // 07:59 Cairo
    expect(isDue(base, at("2026-11-12T06:00:00Z"))).toBe(true); // 08:00
    expect(
      isDue(
        { ...base, lastRunAt: at("2026-11-12T06:05:00Z") },
        at("2026-11-12T15:00:00Z"),
      ),
    ).toBe(false);
    expect(
      isDue(
        { ...base, lastRunAt: at("2026-11-11T06:05:00Z") },
        at("2026-11-12T15:00:00Z"),
      ),
    ).toBe(true);
  });
  it("weekly and monthly only on their day", () => {
    const thu = at("2026-11-12T09:00:00Z");
    expect(isDue({ ...base, frequency: "weekly", dayOfWeek: 4 }, thu)).toBe(
      true,
    );
    expect(isDue({ ...base, frequency: "weekly", dayOfWeek: 0 }, thu)).toBe(
      false,
    );
    expect(isDue({ ...base, frequency: "monthly", dayOfMonth: 12 }, thu)).toBe(
      true,
    );
    expect(isDue({ ...base, frequency: "monthly", dayOfMonth: 1 }, thu)).toBe(
      false,
    );
  });
  it("never when disabled", () => {
    expect(isDue({ ...base, enabled: false }, at("2026-11-12T09:00:00Z"))).toBe(
      false,
    );
  });
});

describe("CSV", () => {
  it("escapes, starts with a BOM and uses the report's columns", () => {
    const cols = reportColumns("manager_flash", [], true);
    expect(cols[0]).toEqual({ key: "buildingName", label: "المبنى والكود" });
    const csv = renderCsv(
      [
        { key: "a", label: "A" },
        { key: "b", label: "B" },
      ],
      [{ a: 'x, "y"', b: 3 }],
    );
    expect(csv.startsWith("﻿")).toBe(true);
    expect(csv).toContain('"x, ""y""",3');
  });
  it("falls back to row keys without internal ones", () => {
    const cols = reportColumns(
      "unknown",
      [{ id: 1, rawStatus: "x", name: "n" }],
      false,
    );
    expect(cols.map((c) => c.key)).toEqual(["name"]);
  });
});
