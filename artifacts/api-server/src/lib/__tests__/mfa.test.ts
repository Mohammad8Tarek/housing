import { describe, expect, it } from "vitest";
import {
  base32Decode,
  base32Encode,
  decryptSecret,
  encryptSecret,
  hashRecoveryCode,
  hotp,
  matchRecoveryCode,
  newRecoveryCodes,
  newSecret,
  otpauthUrl,
  verifyTotp,
} from "../mfa";

// RFC 6238 appendix B, SHA-1 secret "12345678901234567890".
const RFC_SECRET = base32Encode(Buffer.from("12345678901234567890"));

describe("TOTP", () => {
  it("matches the RFC 6238 test vectors (last 6 digits)", () => {
    const key = base32Decode(RFC_SECRET);
    expect(hotp(key, Math.floor(59 / 30))).toBe("287082");
    expect(hotp(key, Math.floor(1111111109 / 30))).toBe("081804");
    expect(hotp(key, Math.floor(2000000000 / 30))).toBe("279037");
  });
  it("accepts the current code and the neighbouring steps, once", () => {
    const now = 1111111109 * 1000;
    expect(verifyTotp(RFC_SECRET, "081804", null, now)).toBe(37037036);
    const prev = hotp(base32Decode(RFC_SECRET), 37037035);
    expect(verifyTotp(RFC_SECRET, prev, null, now)).toBe(37037035);
    // replay of an already used step is refused
    expect(verifyTotp(RFC_SECRET, "081804", 37037036, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "000000", null, now)).toBeNull();
    expect(verifyTotp(RFC_SECRET, "abc", null, now)).toBeNull();
  });
  it("base32 round-trips and builds an authenticator URL", () => {
    const s = newSecret();
    expect(base32Encode(base32Decode(s))).toBe(s);
    expect(otpauthUrl(s, "admin")).toMatch(
      /^otpauth:\/\/totp\/Sunrise%20Housing%3Aadmin\?secret=[A-Z2-7]+&issuer=Sunrise\+Housing/,
    );
  });
});

describe("secrets and recovery codes", () => {
  it("encrypts secrets (different every time) and decrypts them", () => {
    const a = encryptSecret("JBSWY3DPEHPK3PXP");
    expect(a).not.toContain("JBSWY3DP");
    expect(a).not.toBe(encryptSecret("JBSWY3DPEHPK3PXP"));
    expect(decryptSecret(a)).toBe("JBSWY3DPEHPK3PXP");
  });
  it("recovery codes match once regardless of case/dash", () => {
    const codes = newRecoveryCodes();
    expect(codes).toHaveLength(10);
    expect(new Set(codes).size).toBe(10);
    const hashes = codes.map(hashRecoveryCode);
    expect(
      matchRecoveryCode(codes[3].toUpperCase().replace("-", ""), hashes),
    ).toBe(3);
    expect(matchRecoveryCode("zzzz-zzzz", hashes)).toBe(-1);
  });
});
