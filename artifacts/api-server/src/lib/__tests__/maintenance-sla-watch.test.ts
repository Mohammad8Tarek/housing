import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ withTenant: vi.fn() }));
vi.mock("../maintenance-services.js", () => ({
  loadServiceCatalogue: vi.fn(async () => new Map()),
}));
vi.mock("../maintenance-daily-report.js", () => ({ SERVICE_LABELS: {} }));

const { classify, summarise } = await import("../maintenance-sla-watch");

const t = (id: number, minutesLeft: number, extra: any = {}) => ({
  id,
  ticketNo: `MNT-${id}`,
  category: "maintenance",
  serviceAr: "",
  serviceEn: "",
  priority: "medium",
  status: "open",
  location: "—",
  technician: null,
  reportedAt: null,
  dueAt: "",
  minutesLeft,
  state: classify(minutesLeft, 240),
  ...extra,
});

describe("classify", () => {
  it("late when past due", () => expect(classify(-1, 240)).toBe("overdue"));
  it("due soon within a quarter of the target", () => {
    expect(classify(60, 240)).toBe("due_soon");
    expect(classify(61, 240)).toBe("on_track");
  });
  it("due soon is at least 30 minutes", () => {
    expect(classify(30, 60)).toBe("due_soon");
    expect(classify(31, 60)).toBe("on_track");
  });
});

describe("summarise", () => {
  it("counts states, lists most late first then least time left", () => {
    const s = summarise([
      t(1, -10),
      t(2, 500),
      t(3, -300, { technician: "Ali", category: "housekeeping" }),
      t(4, 20, { technician: "Ali" }),
    ]);
    expect([s.open, s.overdue, s.dueSoon, s.onTrack]).toEqual([4, 2, 1, 1]);
    expect(s.tickets.map((x) => x.id)).toEqual([3, 1, 4]);
    expect(s.byTechnician).toEqual([
      { key: "Ali", open: 2, overdue: 1, dueSoon: 1 },
    ]);
    expect(
      s.byDepartment.map((g) => [g.key, g.open, g.overdue, g.dueSoon]),
    ).toEqual([
      ["maintenance", 3, 1, 1],
      ["housekeeping", 1, 1, 0],
    ]);
  });
});
