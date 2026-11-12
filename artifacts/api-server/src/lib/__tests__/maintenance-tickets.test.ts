import { afterEach, describe, expect, it, vi } from "vitest";
import { targetMinutes, ticketNumber, ticketSla } from "../maintenance-tickets";

describe("ticketNumber", () => {
  it("prefixes by category with the report year", () => {
    const reportedAt = "2026-03-04T10:00:00Z";
    expect(ticketNumber({ id: 37, category: "maintenance", reportedAt })).toBe(
      "MNT-2026-0037",
    );
    expect(ticketNumber({ id: 5, category: "housekeeping", reportedAt })).toBe(
      "HK-2026-0005",
    );
    expect(ticketNumber({ id: 12345, category: "general", reportedAt })).toBe(
      "GEN-2026-12345",
    );
  });
});

describe("targetMinutes", () => {
  it("uses the service target scaled by priority", () => {
    expect(targetMinutes("Plumbing", "MEDIUM")).toBe(60);
    expect(targetMinutes("Plumbing", "urgent")).toBe(30);
    expect(targetMinutes("Plumbing", "LOW")).toBe(120);
    expect(targetMinutes("unknown-service", "medium")).toBe(240);
    expect(targetMinutes("towels", "urgent")).toBe(15); // never below 15
  });
});

describe("ticketSla", () => {
  afterEach(() => vi.useRealTimers());

  it("open ticket past its target is overdue", () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-03-04T12:00:00Z"));
    const r = ticketSla({
      problemType: "Plumbing",
      priority: "medium",
      status: "open",
      reportedAt: "2026-03-04T10:00:00Z",
    });
    expect(r.dueAt).toBe("2026-03-04T11:00:00.000Z");
    expect(r.isOverdue).toBe(true);
  });

  it("resolved ticket is overdue only if it finished late", () => {
    const base = {
      problemType: "Plumbing",
      priority: "medium",
      status: "resolved",
      reportedAt: "2026-03-04T10:00:00Z",
    };
    expect(
      ticketSla({ ...base, resolvedAt: "2026-03-04T10:45:00Z" }).isOverdue,
    ).toBe(false);
    expect(
      ticketSla({ ...base, resolvedAt: "2026-03-04T11:30:00Z" }).isOverdue,
    ).toBe(true);
  });

  it("an explicit due date wins", () => {
    const r = ticketSla({
      problemType: "Plumbing",
      status: "open",
      reportedAt: "2026-03-04T10:00:00Z",
      dueDate: "2099-01-01T00:00:00Z",
    });
    expect(r.dueAt).toBe("2099-01-01T00:00:00.000Z");
    expect(r.isOverdue).toBe(false);
  });
});
