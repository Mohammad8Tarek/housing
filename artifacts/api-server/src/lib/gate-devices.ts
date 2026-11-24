import { randomBytes, createHash, timingSafeEqual } from "node:crypto";

// Device API-key handling for gate/biometric terminals.
//
// Keys are high-entropy random secrets (not user passwords), so a single SHA-256
// is an appropriate, fast digest. Keys are shown once on creation; only the hash
// and a short non-secret prefix are stored. Verification is constant-time.

const KEY_BYTES = 24; // 192 bits of entropy

/** Generate a fresh device key. Returns the raw key (show once) + its hash/prefix. */
export function generateDeviceKey(): {
  key: string;
  hash: string;
  prefix: string;
} {
  // URL/base64url-safe, no padding.
  const key = randomBytes(KEY_BYTES).toString("base64url");
  return { key, hash: hashDeviceKey(key), prefix: devicePrefix(key) };
}

/** SHA-256 hex digest of a device key. */
export function hashDeviceKey(key: string): string {
  return createHash("sha256").update(String(key), "utf8").digest("hex");
}

/** First 8 chars of the key — a non-secret label for the UI ("ab12cd34…"). */
export function devicePrefix(key: string): string {
  return String(key).slice(0, 8);
}

/** Constant-time check of a presented key against a stored hash. */
export function verifyDeviceKey(
  presentedKey: string | undefined | null,
  storedHash: string | undefined | null,
): boolean {
  if (!presentedKey || !storedHash) return false;
  const a = Buffer.from(hashDeviceKey(presentedKey), "utf8");
  const b = Buffer.from(String(storedHash), "utf8");
  // timingSafeEqual throws on length mismatch; both are fixed-length hex here,
  // but guard anyway so a malformed stored hash can't crash the request.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

export const GATE_DEVICE_TYPES = ["BIOMETRIC", "TURNSTILE", "HYBRID"] as const;
export const GATE_DEVICE_VENDORS = [
  "ZKTECO",
  "HIKVISION",
  "SUPREMA",
  "GENERIC",
] as const;
export const GATE_DEVICE_DIRECTIONS = ["IN", "OUT", "BOTH"] as const;
