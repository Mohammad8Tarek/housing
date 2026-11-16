import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, usersTable: {} }));

const { scopeAllowsProperty } = await import("../permissions");

const user = (over: any = {}) => ({
  id: 1,
  username: "u",
  propertyId: 1,
  propertyIds: [1, 2, 7],
  roles: [] as string[],
  permissions: [] as string[],
  deniedPermissions: [] as string[],
  permissionScopes: {} as Record<string, number[]>,
  isSystemAdmin: false,
  ...over,
});

describe("scopeAllowsProperty — per-property permission scope", () => {
  it("is unrestricted when the permission has no scope entry", () => {
    const u = user();
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 7)).toBe(true);
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 0)).toBe(true);
  });

  it("allows only the scoped properties", () => {
    const u = user({ permissionScopes: { "maintenance.edit": [2] } });
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 2)).toBe(true);
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 7)).toBe(false);
  });

  it("matches the colon spelling of a scope key", () => {
    const u = user({ permissionScopes: { "reports:export": [1] } });
    expect(scopeAllowsProperty(u as any, "reports", "export", 1)).toBe(true);
    expect(scopeAllowsProperty(u as any, "reports", "export", 2)).toBe(false);
  });

  it("denies a scoped permission when no property is resolvable", () => {
    const u = user({ permissionScopes: { "maintenance.edit": [2] } });
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 0)).toBe(false);
  });

  it("never scopes a system admin", () => {
    const u = user({
      isSystemAdmin: true,
      permissionScopes: { "maintenance.edit": [2] },
    });
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 7)).toBe(true);
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 0)).toBe(true);
  });

  it("treats an empty scope list as unrestricted", () => {
    const u = user({ permissionScopes: { "maintenance.edit": [] } });
    expect(scopeAllowsProperty(u as any, "maintenance", "edit", 99)).toBe(true);
  });
});
