import { describe, expect, it } from "vitest";
import { MIGRATIONS } from "../public-migrations";
import { TENANT_MIGRATIONS } from "../tenant-migrations";

// These guard the production deploy path: the app runs MIGRATIONS on every
// boot, so a column that leaves this list silently stops being created on
// live databases. They also assert the whole set stays idempotent and
// non-destructive, which is what makes an unattended deploy safe on real data.

const q = (m: { q?: string; query?: string }) => m.q ?? (m as any).query ?? "";

describe("public MIGRATIONS — deploy safety", () => {
  it("registers the users.denied_permissions column, idempotently", () => {
    const m = MIGRATIONS.find((x) => x.name === "users.denied_permissions");
    expect(m, "denied_permissions migration must exist").toBeTruthy();
    expect(m!.q).toMatch(/ADD COLUMN IF NOT EXISTS\s+denied_permissions/i);
    expect(m!.q).toMatch(/DEFAULT/i);
  });

  it("registers the users.permission_scopes column, idempotently", () => {
    const m = MIGRATIONS.find((x) => x.name === "users.permission_scopes");
    expect(m, "permission_scopes migration must exist").toBeTruthy();
    expect(m!.q).toMatch(/ADD COLUMN IF NOT EXISTS\s+permission_scopes/i);
    expect(m!.q).toMatch(/jsonb/i);
    expect(m!.q).toMatch(/DEFAULT/i);
  });

  it("every ADD COLUMN in the set uses IF NOT EXISTS (idempotent)", () => {
    for (const m of MIGRATIONS) {
      const sql = q(m);
      if (/\bADD COLUMN\b/i.test(sql)) {
        expect(
          /ADD COLUMN IF NOT EXISTS/i.test(sql),
          `migration "${m.name}" adds a column without IF NOT EXISTS`,
        ).toBe(true);
      }
    }
  });

  it("every CREATE TABLE in the set uses IF NOT EXISTS (idempotent)", () => {
    for (const m of [...MIGRATIONS, ...TENANT_MIGRATIONS]) {
      const sql = q(m);
      if (/\bCREATE TABLE\b/i.test(sql)) {
        expect(
          /CREATE TABLE IF NOT EXISTS/i.test(sql),
          `migration "${m.name}" creates a table without IF NOT EXISTS`,
        ).toBe(true);
      }
    }
  });

  it("contains no unguarded destructive statements (no DROP TABLE/TRUNCATE)", () => {
    for (const m of [...MIGRATIONS, ...TENANT_MIGRATIONS]) {
      const sql = q(m);
      expect(/\bDROP TABLE\b/i.test(sql), `"${m.name}" drops a table`).toBe(
        false,
      );
      expect(/\bTRUNCATE\b/i.test(sql), `"${m.name}" truncates a table`).toBe(
        false,
      );
      // A bare DROP COLUMN (without IF EXISTS) would be both destructive and
      // non-idempotent; guarded DROP COLUMN IF EXISTS on provisioning is fine.
      if (/\bDROP COLUMN\b/i.test(sql)) {
        expect(
          /DROP COLUMN IF EXISTS/i.test(sql),
          `"${m.name}" drops a column without IF EXISTS`,
        ).toBe(true);
      }
    }
  });
});
