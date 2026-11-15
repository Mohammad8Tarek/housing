import { describe, it, expect } from "vitest";
import {
  decideEscalation,
  raisePriority,
  MAX_ESCALATION_LEVEL,
} from "../maintenance-escalation.js";

const now = new Date("2026-02-01T12:00:00Z");

describe("raisePriority", () => {
  it("raises below-floor priorities up to the floor", () => {
    expect(raisePriority("low", "high")).toBe("high");
    expect(raisePriority("medium", "high")).toBe("high");
  });
  it("never lowers an already-higher priority", () => {
    expect(raisePriority("urgent", "high")).toBe("urgent");
    expect(raisePriority("high", "high")).toBe("high");
  });
});

describe("decideEscalation", () => {
  it("does nothing for tickets that are not overdue", () => {
    expect(
      decideEscalation(
        { priority: "medium", escalationLevel: 0, escalatedAt: null, isOverdue: false },
        12,
        now,
      ),
    ).toBeNull();
  });

  it("escalates a fresh overdue ticket to level 1 / high", () => {
    const d = decideEscalation(
      { priority: "medium", escalationLevel: 0, escalatedAt: null, isOverdue: true },
      12,
      now,
    );
    expect(d).toEqual({ level: 1, priority: "high" });
  });

  it("holds at level 1 until the configured gap has passed", () => {
    const twoHoursAgo = new Date(now.getTime() - 2 * 3_600_000).toISOString();
    expect(
      decideEscalation(
        { priority: "high", escalationLevel: 1, escalatedAt: twoHoursAgo, isOverdue: true },
        12,
        now,
      ),
    ).toBeNull();
  });

  it("re-escalates to level 2 / urgent after the gap", () => {
    const thirteenHoursAgo = new Date(
      now.getTime() - 13 * 3_600_000,
    ).toISOString();
    const d = decideEscalation(
      { priority: "high", escalationLevel: 1, escalatedAt: thirteenHoursAgo, isOverdue: true },
      12,
      now,
    );
    expect(d).toEqual({ level: 2, priority: "urgent" });
  });

  it("stops at the maximum level", () => {
    const longAgo = new Date(now.getTime() - 999 * 3_600_000).toISOString();
    expect(
      decideEscalation(
        {
          priority: "urgent",
          escalationLevel: MAX_ESCALATION_LEVEL,
          escalatedAt: longAgo,
          isOverdue: true,
        },
        12,
        now,
      ),
    ).toBeNull();
  });
});
