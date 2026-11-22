import { describe, expect, it, vi } from "vitest";

// permissions.ts only needs these symbols to import; the resolution logic is pure.
vi.mock("@workspace/db", () => ({ db: {}, usersTable: {} }));

const { effectivePermissions, hasPermission } = await import("../permissions");

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

describe("effectivePermissions — admin elevation", () => {
  it("grants the elevated admin role every module except the super-only properties module", () => {
    const perms = effectivePermissions(baseUser({ roles: ["admin"] }) as any);
    // A representative spread of modules the admin should reach
    expect(perms.has("maintenance.view")).toBe(true);
    expect(perms.has("users.delete")).toBe(true);
    expect(perms.has("reports.export")).toBe(true);
    expect(perms.has("housing.edit")).toBe(true);
    // ...but never the super-only properties module
    expect(perms.has("properties.view")).toBe(false);
    expect(perms.has("properties.create")).toBe(false);
    expect(perms.has("properties.edit")).toBe(false);
    expect(perms.has("properties.delete")).toBe(false);
  });

  it("includes the users.unlock grant for admin", () => {
    const perms = effectivePermissions(baseUser({ roles: ["admin"] }) as any);
    expect(perms.has("users.unlock")).toBe(true);
  });

  it("stores both dot and colon spellings for every granted permission", () => {
    const perms = effectivePermissions(
      baseUser({ permissions: ["maintenance.view"] }) as any,
    );
    expect(perms.has("maintenance.view")).toBe(true);
    expect(perms.has("maintenance:view")).toBe(true);
  });

  it("gives a purely organizational role nothing beyond its explicit list", () => {
    const perms = effectivePermissions(
      baseUser({ roles: ["reception"], permissions: ["profiles.view"] }) as any,
    );
    expect(perms.has("profiles.view")).toBe(true);
    // not elevated: no blanket access to another module
    expect(perms.has("users.delete")).toBe(false);
    expect(perms.has("properties.view")).toBe(false);
  });

  it("drops a 'none' sentinel permission", () => {
    const perms = effectivePermissions(
      baseUser({ permissions: ["none", "housing.view"] }) as any,
    );
    expect(perms.has("none")).toBe(false);
    expect(perms.has("housing.view")).toBe(true);
  });

  it("returns only the wildcard for super admin, regardless of stored list", () => {
    const perms = effectivePermissions(
      baseUser({
        roles: ["super_admin"],
        permissions: ["housing.view"],
      }) as any,
    );
    expect(perms.has("*")).toBe(true);
    // the stored fine-grained entries are not materialized — the wildcard covers them
    expect(perms.size).toBe(1);
  });
});

describe("hasPermission — resolution", () => {
  it("lets the wildcard satisfy any module/action", () => {
    const sa = baseUser({ roles: ["super_admin"] });
    expect(hasPermission(sa as any, "properties", "delete")).toBe(true);
    expect(hasPermission(sa as any, "maintenance", "view")).toBe(true);
  });

  it("resolves a dot-form grant for a colon lookup and vice-versa", () => {
    const u = baseUser({ permissions: ["reports:export"] });
    expect(hasPermission(u as any, "reports", "export")).toBe(true);
  });

  it("denies when the user holds no matching permission", () => {
    const u = baseUser({ permissions: ["profiles.view"] });
    expect(hasPermission(u as any, "maintenance", "edit")).toBe(false);
  });

  it("never lets the elevated admin reach the super-only properties module", () => {
    const admin = baseUser({ roles: ["admin"] });
    expect(hasPermission(admin as any, "properties", "create")).toBe(false);
    // but admin still passes on an ordinary module
    expect(hasPermission(admin as any, "users", "delete")).toBe(true);
  });

  it("respects an explicit deny through hasPermission", () => {
    const u = baseUser({
      roles: ["admin"],
      deniedPermissions: ["maintenance.edit"],
    });
    expect(hasPermission(u as any, "maintenance", "edit")).toBe(false);
    expect(hasPermission(u as any, "maintenance", "view")).toBe(true);
  });
});
