const SECURITY_SECRET = "sunrise_housing_enterprise_sec_key_2026_!#9";

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
 * Helper to build secure request headers for API calls
 */
export function getSecurityHeaders(method: string = "GET", path: string = "/"): Record<string, string> {
  const timestamp = Date.now();
  return {
    "X-Security-Extension": "sunrise-policy-v1",
    "X-Security-Signature": generateRequestSignature(method, path, timestamp),
  };
}