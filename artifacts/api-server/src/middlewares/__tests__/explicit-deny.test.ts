import { describe, expect, it, vi } from "vitest";

// permissions.ts only needs these symbols to import; the deny logic is pure.
vi.mock("@workspace/db", () => ({ db: {}, usersTable: {} }));

const { effectivePermissions } = await import("../permissions");

const baseUser = (over: any = {}) => ({
  id: 1,
  username: "u",
  roles: [] as string[],
  permissions: [] as string[],
  deniedPermissions: [] as string[],
  propertyIds: [] as number[],
  isSystemAdmin: false,
  ...over,
});

describe("effectivePermissions — explicit deny", () => {
  it("removes a granted permission that is explicitly denied (deny wins)", () => {
    const perms = effectivePermissions(
      baseUser({
        permissions: ["maintenance.view", "maintenance.edit"],
        deniedPermissions: ["maintenance.edit"],
      }) as any,
    );
    expect(perms.has("maintenance.view")).toBe(true);
    expect(perms.has("maintenance.edit")).toBe(false);
    // colon variant is dropped too
    expect(perms.has("maintenance:edit")).toBe(false);
  });

  it("deny overrides the elevated admin grant", () => {
    const perms = effectivePermissions(
      baseUser({
        roles: ["admin"],
        deniedPermissions: ["users.delete"],
      }) as any,
    );
    // admin is elevated, but the denied action is blocked
    expect(perms.has("users.delete")).toBe(false);
    // other admin-granted actions remain
    expect(perms.has("users.view")).toBe(true);
  });

  it("never denies a super admin (returns full access)", () => {
    const perms = effectivePermissions(
      baseUser({
        roles: ["super_admin"],
        deniedPermissions: ["maintenance.view", "users.delete"],
      }) as any,
    );
    expect(perms.has("*")).toBe(true);
  });

  it("never denies a system admin either", () => {
    const perms = effectivePermissions(
      baseUser({
        isSystemAdmin: true,
        deniedPermissions: ["users.edit"],
      }) as any,
    );
    expect(perms.has("*")).toBe(true);
  });

  it("accepts colon-form denies against dot-form grants", () => {
    const perms = effectivePermissions(
      baseUser({
        permissions: ["reports.export"],
        deniedPermissions: ["reports:export"],
      }) as any,
    );
    expect(perms.has("reports.export")).toBe(false);
    expect(perms.has("reports:export")).toBe(false);
  });

  it("ignores empty / none deny entries", () => {
    const perms = effectivePermissions(
      baseUser({
        permissions: ["housing.view"],
        deniedPermissions: ["", "none"],
      }) as any,
    );
    expect(perms.has("housing.view")).toBe(true);
  });
});
