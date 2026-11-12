import { describe, expect, it } from "vitest";
import { normalizePhoneNumber } from "../templates";
import { isStartReply, isStopReply } from "../opt-out";

describe("normalizePhoneNumber", () => {
  it.each([
    ["01012345678", "201012345678"],
    ["+20 101 234 5678", "201012345678"],
    ["+20 010 1234 5678", "201012345678"],
    ["0020 1012345678", "201012345678"],
    ["1012345678", "201012345678"],
    ["٠١٠١٢٣٤٥٦٧٨", "201012345678"],
    ["+966 50 123 4567", "966501234567"],
  ])("%s -> %s", (input, expected) => {
    expect(normalizePhoneNumber(input)).toBe(expected);
  });
});

describe("opt-out replies", () => {
  it("recognises stop words in Arabic and English", () => {
    for (const t of [
      "0",
      " ٠ ",
      "STOP",
      "Stop.",
      "إلغاء",
      "الغاء",
      "unsubscribe",
    ]) {
      expect(isStopReply(t)).toBe(true);
    }
    for (const t of ["01", "شكرا", "stop it now", "ok"]) {
      expect(isStopReply(t)).toBe(false);
    }
  });
  it("recognises re-subscribe words", () => {
    expect(isStartReply("START")).toBe(true);
    expect(isStartReply("اشتراك")).toBe(true);
    expect(isStartReply("0")).toBe(false);
  });
});
