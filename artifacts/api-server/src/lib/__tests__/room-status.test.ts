import { describe, expect, it } from "vitest";
import {
  DIRTY_ROOM_STATES,
  isDirtyRoomStatus,
  roomStatusAfterDeparture,
  roomStatusAfterCheckIn,
} from "../room-status";

describe("isDirtyRoomStatus", () => {
  it("recognizes the dirty states", () => {
    expect(isDirtyRoomStatus("dirty")).toBe(true);
    expect(isDirtyRoomStatus("occupied_dirty")).toBe(true);
  });

  it("is case-insensitive and tolerates whitespace-free variants", () => {
    expect(isDirtyRoomStatus("DIRTY")).toBe(true);
    expect(isDirtyRoomStatus("Occupied_Dirty")).toBe(true);
  });

  it("returns false for clean / other states and for null/undefined", () => {
    expect(isDirtyRoomStatus("available")).toBe(false);
    expect(isDirtyRoomStatus("occupied")).toBe(false);
    expect(isDirtyRoomStatus("occupied_vacation")).toBe(false);
    expect(isDirtyRoomStatus("out_of_service")).toBe(false);
    expect(isDirtyRoomStatus(null)).toBe(false);
    expect(isDirtyRoomStatus(undefined)).toBe(false);
    expect(isDirtyRoomStatus("")).toBe(false);
  });

  it("exposes the dirty state list", () => {
    expect([...DIRTY_ROOM_STATES]).toEqual(["dirty", "occupied_dirty"]);
  });
});

describe("roomStatusAfterDeparture — Rule 5 checkout/transfer-out", () => {
  it("becomes dirty when the room empties out", () => {
    expect(roomStatusAfterDeparture(0)).toBe("dirty");
  });

  it("stays occupied_dirty while residents remain", () => {
    expect(roomStatusAfterDeparture(1)).toBe("occupied_dirty");
    expect(roomStatusAfterDeparture(3)).toBe("occupied_dirty");
  });

  it("treats a non-positive count as empty (defensive)", () => {
    expect(roomStatusAfterDeparture(-1)).toBe("dirty");
  });
});

describe("roomStatusAfterCheckIn — Rule 5 check-in/transfer-in", () => {
  it("becomes plain occupied from a clean room", () => {
    expect(roomStatusAfterCheckIn("available")).toBe("occupied");
    expect(roomStatusAfterCheckIn("occupied")).toBe("occupied");
    expect(roomStatusAfterCheckIn(null)).toBe("occupied");
    expect(roomStatusAfterCheckIn(undefined)).toBe("occupied");
  });

  it("preserves the dirty flag as occupied_dirty when the room awaited cleaning", () => {
    expect(roomStatusAfterCheckIn("dirty")).toBe("occupied_dirty");
    expect(roomStatusAfterCheckIn("occupied_dirty")).toBe("occupied_dirty");
    expect(roomStatusAfterCheckIn("DIRTY")).toBe("occupied_dirty");
  });

  it("matches the exact behavior of the inline check it replaced", () => {
    // old: wasDirty = ["dirty","occupied_dirty"].includes(String(s ?? "").toLowerCase());
    //      status = wasDirty ? "occupied_dirty" : "occupied";
    const cases = [
      "available",
      "occupied",
      "dirty",
      "occupied_dirty",
      "occupied_vacation",
      "",
      null,
      undefined,
    ] as const;
    for (const s of cases) {
      const wasDirty = ["dirty", "occupied_dirty"].includes(
        String(s ?? "").toLowerCase(),
      );
      expect(roomStatusAfterCheckIn(s)).toBe(
        wasDirty ? "occupied_dirty" : "occupied",
      );
    }
  });
});
