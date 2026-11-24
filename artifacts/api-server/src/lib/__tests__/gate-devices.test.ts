import { describe, it, expect } from "vitest";
import {
  generateDeviceKey,
  hashDeviceKey,
  devicePrefix,
  verifyDeviceKey,
} from "../gate-devices";

describe("gate device keys", () => {
  it("generates a key with a matching hash and prefix", () => {
    const { key, hash, prefix } = generateDeviceKey();
    expect(key.length).toBeGreaterThan(20);
    expect(hash).toBe(hashDeviceKey(key));
    expect(prefix).toBe(key.slice(0, 8));
    expect(hash).toMatch(/^[0-9a-f]{64}$/); // sha-256 hex
  });

  it("produces distinct keys each call", () => {
    const a = generateDeviceKey();
    const b = generateDeviceKey();
    expect(a.key).not.toBe(b.key);
    expect(a.hash).not.toBe(b.hash);
  });

  it("verifies a correct key and rejects a wrong one", () => {
    const { key, hash } = generateDeviceKey();
    expect(verifyDeviceKey(key, hash)).toBe(true);
    expect(verifyDeviceKey(key + "x", hash)).toBe(false);
    expect(verifyDeviceKey("totally-wrong", hash)).toBe(false);
  });

  it("rejects empty / null inputs without throwing", () => {
    const { hash } = generateDeviceKey();
    expect(verifyDeviceKey("", hash)).toBe(false);
    expect(verifyDeviceKey(undefined, hash)).toBe(false);
    expect(verifyDeviceKey(null, hash)).toBe(false);
    expect(verifyDeviceKey("anything", "")).toBe(false);
    expect(verifyDeviceKey("anything", null)).toBe(false);
  });

  it("rejects a malformed stored hash instead of crashing", () => {
    expect(verifyDeviceKey("some-key", "short")).toBe(false);
  });

  it("hashing is stable for the same input", () => {
    expect(hashDeviceKey("abc")).toBe(hashDeviceKey("abc"));
    expect(devicePrefix("abcdefghijkl")).toBe("abcdefgh");
  });
});
