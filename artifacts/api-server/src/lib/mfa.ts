// Two-step verification with authenticator apps (TOTP, RFC 6238: SHA-1,
// 6 digits, 30-second steps), built on node:crypto only.
// - Secrets are encrypted at rest (AES-256-GCM; key from MFA_ENC_KEY, else
//   derived from SESSION_SECRET).
// - Recovery codes are random and stored as SHA-256 hashes; each works once.
// - A code is accepted once: the last used time step is remembered.
import {
  createCipheriv,
  createDecipheriv,
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";
import QRCode from "qrcode";

const STEP_SECONDS = 30;
const DIGITS = 6;
const WINDOW = 1; // accept the previous and next step (clock drift)
const ISSUER = "Sunrise Housing";

// ── Base32 (RFC 4648, no padding) ────────────────────────────────────────────
const ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";

export function base32Encode(buf: Buffer): string {
  let bits = 0;
  let value = 0;
  let out = "";
  for (const byte of buf) {
    value = (value << 8) | byte;
    bits += 8;
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31];
      bits -= 5;
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31];
  return out;
}

export function base32Decode(s: string): Buffer {
  const clean = s.toUpperCase().replace(/[\s=-]/g, "");
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const idx = ALPHABET.indexOf(ch);
    if (idx < 0) throw new Error("Invalid base32");
    value = (value << 5) | idx;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255);
      bits -= 8;
    }
  }
  return Buffer.from(out);
}

// ── TOTP ─────────────────────────────────────────────────────────────────────
export function hotp(secret: Buffer, counter: number): string {
  const msg = Buffer.alloc(8);
  msg.writeBigUInt64BE(BigInt(counter));
  const mac = createHmac("sha1", secret).update(msg).digest();
  const offset = mac[mac.length - 1] & 0x0f;
  const bin =
    ((mac[offset] & 0x7f) << 24) |
    (mac[offset + 1] << 16) |
    (mac[offset + 2] << 8) |
    mac[offset + 3];
  return String(bin % 10 ** DIGITS).padStart(DIGITS, "0");
}

export const currentStep = (now = Date.now()) =>
  Math.floor(now / 1000 / STEP_SECONDS);

/**
 * The time step a 6-digit `code` matches (within ±1 step of now), or null.
 * Steps at or before `lastUsedStep` are refused (no replay).
 */
export function verifyTotp(
  secretBase32: string,
  code: string,
  lastUsedStep: number | null | undefined,
  now = Date.now(),
): number | null {
  const digits = String(code ?? "").replace(/\s/g, "");
  if (!/^\d{6}$/.test(digits)) return null;
  const secret = base32Decode(secretBase32);
  const step = currentStep(now);
  for (let d = -WINDOW; d <= WINDOW; d++) {
    const s = step + d;
    if (lastUsedStep != null && s <= lastUsedStep) continue;
    const expected = Buffer.from(hotp(secret, s));
    if (timingSafeEqual(expected, Buffer.from(digits))) return s;
  }
  return null;
}

export const newSecret = () => base32Encode(randomBytes(20));

export function otpauthUrl(secretBase32: string, account: string): string {
  const label = encodeURIComponent(`${ISSUER}:${account}`);
  const q = new URLSearchParams({
    secret: secretBase32,
    issuer: ISSUER,
    algorithm: "SHA1",
    digits: String(DIGITS),
    period: String(STEP_SECONDS),
  });
  return `otpauth://totp/${label}?${q}`;
}

export const qrDataUrl = (url: string) =>
  QRCode.toDataURL(url, { margin: 1, width: 220 });

// ── Encryption at rest ───────────────────────────────────────────────────────
function key(): Buffer {
  const material =
    process.env["MFA_ENC_KEY"] ||
    process.env["SESSION_SECRET"] ||
    "sunrise-dev-secret";
  return createHash("sha256").update(`mfa:${material}`).digest();
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key(), iv);
  const enc = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return [iv, c.getAuthTag(), enc].map((b) => b.toString("base64")).join(".");
}

export function decryptSecret(stored: string): string {
  const [iv, tag, enc] = stored.split(".").map((p) => Buffer.from(p, "base64"));
  const d = createDecipheriv("aes-256-gcm", key(), iv);
  d.setAuthTag(tag);
  return Buffer.concat([d.update(enc), d.final()]).toString("utf8");
}

// ── Recovery codes ───────────────────────────────────────────────────────────
const normCode = (c: string) => c.toLowerCase().replace(/[^a-z0-9]/g, "");
export const hashRecoveryCode = (c: string) =>
  createHash("sha256")
    .update(`recovery:${normCode(c)}`)
    .digest("hex");

/** Ten one-time codes like "k7m2-9xq4" (shown once, stored hashed). */
export function newRecoveryCodes(n = 10): string[] {
  const alphabet = "abcdefghjkmnpqrstuvwxyz23456789";
  return Array.from({ length: n }, () => {
    const b = randomBytes(8);
    const s = Array.from(b, (x) => alphabet[x % alphabet.length]).join("");
    return `${s.slice(0, 4)}-${s.slice(4)}`;
  });
}

/** Index of the matching unused recovery code, or -1. */
export function matchRecoveryCode(code: string, hashes: string[]): number {
  if (normCode(code).length !== 8) return -1;
  const h = hashRecoveryCode(code);
  return hashes.findIndex((x) => x === h);
}
