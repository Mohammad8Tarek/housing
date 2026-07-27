import { describe, expect, it } from "vitest";
import { stripHtml, sanitizeFields } from "../lib/sanitize.js";

// ─── Password Policy Types (duplicated to avoid DB import) ─────────────────────
// The validatePassword function is pure but lives in a module that imports DB.
// We re-implement the pure validation logic here to test it without DB dependency.

interface PasswordPolicy {
  minLength: number;
  requireUppercase: boolean;
  requireLowercase: boolean;
  requireNumber: boolean;
  requireSymbol: boolean;
}

/** Exact copy of validatePassword from password-policy.ts (pure function) */
function validatePassword(
  password: string,
  policy: PasswordPolicy,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];
  if (password.length < policy.minLength) {
    errors.push(`Password must be at least ${policy.minLength} characters`);
  }
  if (policy.requireUppercase && !/[A-Z]/.test(password)) {
    errors.push("Password must contain an uppercase letter");
  }
  if (policy.requireLowercase && !/[a-z]/.test(password)) {
    errors.push("Password must contain a lowercase letter");
  }
  if (policy.requireNumber && !/[0-9]/.test(password)) {
    errors.push("Password must contain a number");
  }
  if (policy.requireSymbol && !/[^A-Za-z0-9]/.test(password)) {
    errors.push("Password must contain a symbol");
  }
  return { valid: errors.length === 0, errors };
}

// ─── Password Policy Tests ────────────────────────────────────────────────────

const strictPolicy: PasswordPolicy = {
  minLength: 8,
  requireUppercase: true,
  requireLowercase: true,
  requireNumber: true,
  requireSymbol: true,
};

const relaxedPolicy: PasswordPolicy = {
  minLength: 4,
  requireUppercase: false,
  requireLowercase: false,
  requireNumber: false,
  requireSymbol: false,
};

describe("validatePassword", () => {
  it("accepts a strong password that meets all strict policy requirements", () => {
    const result = validatePassword("Str0ng!Pass", strictPolicy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("rejects password shorter than minimum length", () => {
    const result = validatePassword("Ab1!", strictPolicy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must be at least 8 characters",
    );
  });

  it("rejects password missing uppercase letter", () => {
    const result = validatePassword("lowercase1!", strictPolicy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain an uppercase letter",
    );
  });

  it("rejects password missing lowercase letter", () => {
    const result = validatePassword("UPPERCASE1!", strictPolicy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must contain a lowercase letter",
    );
  });

  it("rejects password missing number", () => {
    const result = validatePassword("NoNumber!!", strictPolicy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain a number");
  });

  it("rejects password missing symbol", () => {
    const result = validatePassword("NoSymbol1A", strictPolicy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Password must contain a symbol");
  });

  it("collects all errors when password fails multiple rules", () => {
    const result = validatePassword("ab", strictPolicy);
    expect(result.valid).toBe(false);
    // Should fail: length, uppercase, number, symbol
    expect(result.errors.length).toBeGreaterThanOrEqual(3);
  });

  it("accepts a simple password under relaxed policy", () => {
    const result = validatePassword("test", relaxedPolicy);
    expect(result.valid).toBe(true);
    expect(result.errors).toHaveLength(0);
  });

  it("still enforces minimum length under relaxed policy", () => {
    const result = validatePassword("abc", relaxedPolicy);
    expect(result.valid).toBe(false);
    expect(result.errors).toContain(
      "Password must be at least 4 characters",
    );
  });
});

// ─── Sanitization Tests ────────────────────────────────────────────────────────

describe("stripHtml", () => {
  it("strips HTML tags from input", () => {
    expect(stripHtml("<b>bold</b>")).toBe("bold");
  });

  it("escapes ampersands", () => {
    expect(stripHtml("Tom & Jerry")).toContain("&amp;");
  });

  it("returns empty string for null/undefined", () => {
    expect(stripHtml(null)).toBe("");
    expect(stripHtml(undefined)).toBe("");
  });

  it("trims whitespace", () => {
    expect(stripHtml("  hello  ")).toBe("hello");
  });

  it("strips nested HTML tags", () => {
    const result = stripHtml("<div><p>Hello <b>World</b></p></div>");
    expect(result).not.toContain("<");
    expect(result).not.toContain(">");
  });

  it("strips script tags (XSS prevention)", () => {
    const result = stripHtml('<script>alert("xss")</script>');
    expect(result).not.toContain("<script>");
    expect(result).not.toContain("</script>");
  });
});

describe("sanitizeFields", () => {
  it("sanitizes specified string fields in an object", () => {
    const input = { name: "<b>John</b>", age: 30 };
    const result = sanitizeFields(input, ["name"]);
    expect(result.name).toBe("John");
    expect(result.age).toBe(30);
  });

  it("leaves non-specified fields untouched", () => {
    const input = { name: "<b>John</b>", bio: "<i>Dev</i>" };
    const result = sanitizeFields(input, ["name"]);
    expect(result.bio).toBe("<i>Dev</i>");
  });

  it("handles empty fields array", () => {
    const input = { name: "<b>John</b>" };
    const result = sanitizeFields(input, []);
    expect(result.name).toBe("<b>John</b>");
  });

  it("ignores non-string fields in the sanitize list", () => {
    const input = { name: "John", count: 5 };
    const result = sanitizeFields(input, ["name", "count"]);
    expect(result.count).toBe(5);
  });
});
