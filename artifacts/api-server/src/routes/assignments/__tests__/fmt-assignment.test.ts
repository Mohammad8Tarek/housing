import { describe, expect, it, vi } from "vitest";

// shared.ts imports `pool` from the db package at module load; the formatter
// itself is pure and needs no database.
vi.mock("@workspace/db", () => ({ pool: { query: vi.fn() } }));

const { fmtAssignment } = await import("../shared");

describe("fmtAssignment — assignment response contract", () => {
  it("serializes Date fields to ISO strings", () => {
    const checkIn = new Date("2026-03-01T08:30:00.000Z");
    const out = fmtAssignment({ id: 5, checkInDate: checkIn });
    expect(out.checkInDate).toBe("2026-03-01T08:30:00.000Z");
    expect(typeof out.checkInDate).toBe("string");
  });

  it("keeps null date fields as null", () => {
    const out = fmtAssignment({
      id: 5,
      actualCheckOutDate: null,
      transferDate: undefined,
    });
    expect(out.actualCheckOutDate).toBeNull();
    // an undefined field is normalized to null too
    expect(out.transferDate).toBeNull();
  });

  it("defaults missing notes to an empty string", () => {
    expect(fmtAssignment({ id: 1 }).notes).toBe("");
    expect(fmtAssignment({ id: 1, notes: null }).notes).toBe("");
    expect(fmtAssignment({ id: 1, notes: "hi" }).notes).toBe("hi");
  });

  it("passes through non-date fields untouched", () => {
    const out = fmtAssignment({
      id: 7,
      profileId: 42,
      roomId: 100,
      isEntireRoom: true,
      status: "active",
    });
    expect(out).toMatchObject({
      id: 7,
      profileId: 42,
      roomId: 100,
      isEntireRoom: true,
      status: "active",
    });
  });

  it("leaves an already-stringified date value as-is (only Date instances convert)", () => {
    const out = fmtAssignment({
      id: 9,
      checkInDate: "2026-01-01",
    });
    expect(out.checkInDate).toBe("2026-01-01");
  });

  it("does not mutate the input record", () => {
    const input: Record<string, any> = {
      id: 3,
      checkInDate: new Date("2026-05-05T00:00:00.000Z"),
    };
    const snapshot = input.checkInDate;
    fmtAssignment(input);
    expect(input.checkInDate).toBe(snapshot);
    expect(input.checkInDate instanceof Date).toBe(true);
  });
});
