import { describe, it, expect } from "vitest";
import {
  normalizeDirection,
  parseZktecoAttlogLine,
  parseZktecoAttlog,
  decideGateAccess,
} from "../gate-access";

describe("normalizeDirection", () => {
  it("maps common IN/OUT spellings", () => {
    expect(normalizeDirection("OUT")).toBe("OUT");
    expect(normalizeDirection("exit")).toBe("OUT");
    expect(normalizeDirection("1")).toBe("OUT");
    expect(normalizeDirection("IN")).toBe("IN");
    expect(normalizeDirection("entry")).toBe("IN");
    expect(normalizeDirection("0")).toBe("IN");
  });
  it("falls back when unknown", () => {
    expect(normalizeDirection("", "OUT")).toBe("OUT");
    expect(normalizeDirection(undefined)).toBe("IN");
    expect(normalizeDirection("banana", "OUT")).toBe("OUT");
  });
});

describe("parseZktecoAttlogLine", () => {
  it("parses a fingerprint check-in record", () => {
    const e = parseZktecoAttlogLine("1023\t2026-11-24 08:30:00\t0\t1\t0");
    expect(e).toMatchObject({
      userRef: "1023",
      direction: "IN",
      method: "FINGERPRINT",
    });
    expect(e?.at).toBe(new Date("2026-11-24T08:30:00").toISOString());
  });

  it("maps check-out status to OUT and face verify to FACE", () => {
    const e = parseZktecoAttlogLine("1023\t2026-11-24 18:00:00\t1\t15");
    expect(e?.direction).toBe("OUT");
    expect(e?.method).toBe("FACE");
  });

  it("maps card verify codes to CARD", () => {
    expect(parseZktecoAttlogLine("7\t2026-11-24 09:00:00\t0\t4")?.method).toBe(
      "CARD",
    );
  });

  it("honors an explicit outStatuses override", () => {
    const e = parseZktecoAttlogLine("5\t2026-11-24 09:00:00\t2\t1", {
      outStatuses: [2],
    });
    expect(e?.direction).toBe("OUT");
  });

  it("falls back to OTHER for an unknown verify code", () => {
    expect(parseZktecoAttlogLine("5\t2026-11-24 09:00:00\t0\t99")?.method).toBe(
      "OTHER",
    );
  });

  it("returns null for empty / PIN-less lines", () => {
    expect(parseZktecoAttlogLine("")).toBeNull();
    expect(parseZktecoAttlogLine("\t2026-11-24 09:00:00\t0\t1")).toBeNull();
  });

  it("omits timestamp when unparseable", () => {
    const e = parseZktecoAttlogLine("1023\tnot-a-date\t0\t1");
    expect(e?.userRef).toBe("1023");
    expect(e?.at).toBeUndefined();
  });
});

describe("parseZktecoAttlog (multi-line)", () => {
  it("parses several records and skips blanks", () => {
    const body = [
      "1\t2026-11-24 08:00:00\t0\t1",
      "",
      "2\t2026-11-24 08:01:00\t1\t15",
    ].join("\n");
    const events = parseZktecoAttlog(body);
    expect(events).toHaveLength(2);
    expect(events[0].direction).toBe("IN");
    expect(events[1].direction).toBe("OUT");
  });
});

describe("decideGateAccess", () => {
  it("grants an active resident", () => {
    const d = decideGateAccess({
      profile: { status: "ACTIVE" },
      hasActiveAssignment: true,
    });
    expect(d.decision).toBe("GRANT");
    expect(d.status).toBe("GRANTED");
    expect(d.reason).toBeNull();
  });

  it("denies an unknown resident", () => {
    const d = decideGateAccess({ profile: null, hasActiveAssignment: false });
    expect(d.decision).toBe("DENY");
    expect(d.reason).toMatch(/not found/i);
  });

  it("denies a resident without an active accommodation", () => {
    const d = decideGateAccess({
      profile: { status: "ACTIVE" },
      hasActiveAssignment: false,
    });
    expect(d.decision).toBe("DENY");
    expect(d.reason).toMatch(/accommodation/i);
  });
});
