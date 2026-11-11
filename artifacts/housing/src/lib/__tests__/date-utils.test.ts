import { afterEach, describe, expect, it, vi } from "vitest";
import { formatDate, getExportFileName } from "../date-utils";

// AGENTS.md rule 7: dates are always Day/Month/Year.
describe("date formatting (DD/MM/YYYY)", () => {
  afterEach(() => vi.useRealTimers());

  it("formats as day/month/year", () => {
    expect(formatDate("2026-03-04")).toBe("04/03/2026");
    expect(formatDate(new Date(2026, 11, 25))).toBe("25/12/2026");
  });

  it("uses the fallback for empty or invalid input", () => {
    expect(formatDate(null)).toBe("—");
    expect(formatDate("", "-")).toBe("-");
    expect(formatDate("not a date")).toBe("—");
  });

  it("names export files prefix_DD-MM-YYYY.ext", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 0, 9, 12));
    expect(getExportFileName("Rooms Report")).toBe(
      "Rooms_Report_09-01-2026.xlsx",
    );
    expect(getExportFileName("a/b", "pdf")).toBe("a_b_09-01-2026.pdf");
  });
});
