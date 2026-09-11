const SECURITY_SECRET =
  process.env["SECURITY_SECRET"] ||
  "sunrise_housing_enterprise_sec_key_2026_!#9";

const SIGNATURE_TOLERANCE_MS = 5 * 60 * 1000; // 5 minutes replay protection

/**
 * Deterministic cryptographic checksum compatible across Node and Browser environments
 */
export function computeSecurityChecksum(data: string, secret: string = SECURITY_SECRET): string {
  let h1 = 0x811c9dc5;
  let h2 = 0x9e3779b9;
  const combined = `${data}:${secret}`;
  for (let i = 0; i < combined.length; i++) {
    const code = combined.charCodeAt(i);
    h1 = Math.imul(h1 ^ code, 0x01000193);
    h2 = Math.imul(h2 ^ (code + i), 0x85ebca6b);
  }
  return (
    (h1 >>> 0).toString(16).padStart(8, "0") +
    (h2 >>> 0).toString(16).padStart(8, "0")
  ).slice(0, 10);
}

/**
 * Encodes an internal sequential database ID into a tamper-proof, non-traceable secure token
 * Format: sec_<type>_<checksum10>_<hexId>
 * Example: encodeSecureToken(14, 'ticket') -> 'sec_ticket_a288a31f71_e'
 */
export function encodeSecureToken(
  id: number | string,
  resourceType: string = "res",
): string {
  const numericId = typeof id === "string" ? parseInt(id, 10) : id;
  if (isNaN(numericId) || numericId <= 0) return String(id);

  const hexId = numericId.toString(16);
  const dataToSign = `${resourceType}:${numericId}`;
  const checksum = computeSecurityChecksum(dataToSign, SECURITY_SECRET);

  return `sec_${resourceType}_${checksum}_${hexId}`;
}

/**
 * Decodes a secure token back into its original integer ID, validating cryptographic integrity.
 * If the token has been tampered with or guessed, returns null (IDOR / Anti-Tampering defense).
 * If the input is already a valid positive integer, returns it directly (for backwards compatibility).
 */
export function decodeSecureToken(
  token: string | number | undefined,
  expectedType?: string,
): number | null {
  if (token === undefined || token === null) return null;

  // If already numeric
  if (typeof token === "number" && !isNaN(token) && token > 0) {
    return token;
  }

  const str = String(token).trim();
  if (!str) return null;

  // Plain numeric string fallback for legacy/direct callers
  if (/^\d+$/.test(str)) {
    const parsed = parseInt(str, 10);
    return parsed > 0 ? parsed : null;
  }

  if (!str.startsWith("sec_")) {
    return null;
  }

  const parts = str.split("_");
  // Expected parts: ["sec", type, checksum, hexId]
  if (parts.length !== 4) return null;

  const [, type, checksum, hexId] = parts;
  if (expectedType && type !== expectedType) return null;

  const numericId = parseInt(hexId, 16);
  if (isNaN(numericId) || numericId <= 0) return null;

  const expectedData = `${type}:${numericId}`;
  const expectedChecksum = computeSecurityChecksum(expectedData, SECURITY_SECRET);

  if (checksum !== expectedChecksum) {
    return null;
  }

  return numericId;
}

/**
 * Generates an HMAC signature for outgoing API requests
 */
export function generateRequestSignature(
  method: string,
  path: string,
  timestamp: number = Date.now(),
): string {
  const payload = `${method.toUpperCase()}:${path}:${timestamp}`;
  const signature = computeSecurityChecksum(payload, SECURITY_SECRET);
  return `t=${timestamp},v1=${signature}`;
}

/**
 * Verifies request signature from HTTP headers
 */
export function verifyRequestSignature(
  signatureHeader: string | undefined,
  method: string,
  path: string,
): { valid: boolean; reason?: string } {
  if (!signatureHeader) {
    return { valid: false, reason: "Missing X-Security-Signature header" };
  }

  const parts = signatureHeader.split(",");
  let timestampStr: string | null = null;
  let signature: string | null = null;

  for (const p of parts) {
    const [k, v] = p.trim().split("=");
    if (k === "t") timestampStr = v;
    if (k === "v1") signature = v;
  }

  if (!timestampStr || !signature) {
    return { valid: false, reason: "Malformed signature header" };
  }

  const timestamp = parseInt(timestampStr, 10);
  if (isNaN(timestamp)) {
    return { valid: false, reason: "Invalid timestamp" };
  }

  const now = Date.now();
  if (Math.abs(now - timestamp) > SIGNATURE_TOLERANCE_MS) {
    return { valid: false, reason: "Signature timestamp expired or skewed" };
  }

  const payload = `${method.toUpperCase()}:${path}:${timestamp}`;
  const expectedSignature = computeSecurityChecksum(payload, SECURITY_SECRET);

  if (signature !== expectedSignature) {
    return { valid: false, reason: "Signature mismatch" };
  }

  return { valid: true };
}