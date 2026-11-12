import { describe, expect, it, vi } from "vitest";

vi.mock("@workspace/db", () => ({ db: {}, usersTable: {} }));
vi.mock("@workspace/queue", () => ({ getRedisConnection: () => null }));

const { ALL_PERMISSIONS, grantedPermissions } =
  await import("../access-review");

const user = (roles: string[], permissions: string[]) => ({
  id: 1,
  username: "u",
  roles,
  permissions,
  propertyId: 1,
  propertyIds: [1],
});

describe("grantedPermissions", () => {
  it("gives system admins every permission regardless of the stored list", () => {
    const r = grantedPermissions(user(["Super_Admin"], ["dashboard.view"]));
    expect(r.root).toBe(true);
    expect(r.granted).toEqual(ALL_PERMISSIONS);
  });

  it("uses only the stored permissions for other roles (no role defaults)", () => {
    const r = grantedPermissions(user(["admin"], ["maintenance.view"]));
    expect(r.root).toBe(false);
    expect(r.granted).toEqual(["maintenance.view"]);
  });

  it("accepts the legacy colon form and drops unknown keys", () => {
    const r = grantedPermissions(
      user(["manager"], ["maintenance:delete", "made.up", "none"]),
    );
    expect(r.granted).toEqual(["maintenance.delete"]);
  });

  it("handles missing arrays", () => {
    const r = grantedPermissions({
      ...user([], []),
      roles: null,
      permissions: null,
      propertyIds: null,
    });
    expect(r.granted).toEqual([]);
  });
});
