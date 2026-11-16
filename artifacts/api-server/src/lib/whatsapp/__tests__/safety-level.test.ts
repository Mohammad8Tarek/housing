import { describe, it, expect } from "vitest";
import {
  normalizeSafetyLevel,
  safetyFactors,
  SAFETY_FACTORS,
} from "../quota.js";

describe("normalizeSafetyLevel", () => {
  it("accepts the three known levels", () => {
    expect(normalizeSafetyLevel("safe")).toBe("safe");
    expect(normalizeSafetyLevel("balanced")).toBe("balanced");
    expect(normalizeSafetyLevel("fast")).toBe("fast");
  });
  it("falls back to balanced for anything else", () => {
    expect(normalizeSafetyLevel(null)).toBe("balanced");
    expect(normalizeSafetyLevel("bogus")).toBe("balanced");
    expect(normalizeSafetyLevel(undefined)).toBe("balanced");
  });
});

describe("safetyFactors", () => {
  it("safe sends fewer, slower; fast sends more, quicker", () => {
    expect(SAFETY_FACTORS.safe.cap).toBeLessThan(SAFETY_FACTORS.balanced.cap);
    expect(SAFETY_FACTORS.fast.cap).toBeGreaterThan(
      SAFETY_FACTORS.balanced.cap,
    );
    // Gap is inverse: safe waits longer, fast waits less.
    expect(SAFETY_FACTORS.safe.gap).toBeGreaterThan(
      SAFETY_FACTORS.balanced.gap,
    );
    expect(SAFETY_FACTORS.fast.gap).toBeLessThan(SAFETY_FACTORS.balanced.gap);
  });
  it("resolves via safetyFactors()", () => {
    expect(safetyFactors("safe")).toEqual(SAFETY_FACTORS.safe);
    expect(safetyFactors("nope")).toEqual(SAFETY_FACTORS.balanced);
  });
});
