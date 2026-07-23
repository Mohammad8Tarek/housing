import { describe, expect, it } from "vitest";
import { getPermissionsForRoles } from "./permissions";

describe("getPermissionsForRoles", () => {
  it("returns the default permissions for a single role", () => {
    const perms = getPermissionsForRoles(["manager"]);

    expect(perms).toContain("users.manage_permissions");
    expect(perms).toContain("dashboard.view");
    expect(perms).toContain("maintenance.approve");
  });

  it("merges the defaults from multiple roles", () => {
    const perms = getPermissionsForRoles(["receptionist", "maintenance_staff"]);

    expect(perms).toContain("communications.create");
    expect(perms).toContain("maintenance.assign");
    expect(perms).toContain("documents.view");
  });
});
