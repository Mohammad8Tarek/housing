import { describe, expect, it } from "vitest";
import { DEFAULT_SERVICES, serviceKeyFrom } from "../maintenance-services";
import { targetMinutes, ticketSla } from "../maintenance-tickets";

describe("service catalogue", () => {
  it("builds keys from English names", () => {
    expect(serviceKeyFrom("Water Heater")).toBe("water_heater");
    expect(serviceKeyFrom("  A/C & Fridge!! ")).toBe("a_c_fridge");
    expect(serviceKeyFrom("مياه")).toMatch(/^service_/);
  });

  it("defaults are unique per department and carry target times", () => {
    const keys = DEFAULT_SERVICES.map((s) => `${s.category}:${s.key}`);
    expect(new Set(keys).size).toBe(keys.length);
    expect(
      DEFAULT_SERVICES.find((s) => s.key === "Plumbing")?.targetMinutes,
    ).toBe(60);
  });

  it("a property's own target overrides the default", () => {
    expect(targetMinutes("Plumbing", "medium", 30)).toBe(30);
    expect(targetMinutes("Plumbing", "urgent", 30)).toBe(15);
    expect(targetMinutes("Plumbing", "medium", null)).toBe(60);
    const sla = ticketSla(
      {
        problemType: "Plumbing",
        priority: "medium",
        status: "open",
        reportedAt: "2026-01-01T10:00:00Z",
      },
      30,
    );
    expect(sla.slaMinutes).toBe(30);
    expect(sla.dueAt).toBe("2026-01-01T10:30:00.000Z");
  });
});
