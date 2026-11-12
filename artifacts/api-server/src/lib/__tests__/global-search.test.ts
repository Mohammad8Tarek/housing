import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({}));
vi.mock("@workspace/queue", () => ({ getRedisConnection: () => null }));

const { ticketIdFrom } = await import("../../routes/global-search");

describe("ticketIdFrom", () => {
  it("reads ticket numbers in the forms people type", () => {
    for (const q of [
      "MNT-2026-0037",
      "hk-2026-37",
      "gen-37",
      "#37",
      "37",
      " 0037 ",
    ]) {
      expect(ticketIdFrom(q)).toBe(37);
    }
  });
  it("ignores other text", () => {
    for (const q of ["ahmed", "MNT", "A-12", "12a", ""]) {
      expect(ticketIdFrom(q)).toBeNull();
    }
  });
});
