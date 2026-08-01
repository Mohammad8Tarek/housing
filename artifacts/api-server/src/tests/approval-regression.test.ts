import { describe, it, expect } from "vitest";
import {
  userMatchesApprovalRole,
  canAccessProperty,
  STEP_ROLES,
} from "../routes/hosting-requests";

describe("Approval Regression Tests", () => {
  describe("userMatchesApprovalRole", () => {
    it("should match exact job title", () => {
      const user = { jobTitle: "Housing Manager", roles: [] } as any;
      expect(userMatchesApprovalRole(user, "housing_manager")).toBe(true);
    });

    it("should match roles array", () => {
      const user = { jobTitle: "Employee", roles: ["housing_manager"] } as any;
      expect(userMatchesApprovalRole(user, "housing_manager")).toBe(true);
    });

    it("should be case and whitespace insensitive", () => {
      const user = { jobTitle: " HR  Manager ", roles: [] } as any;
      expect(userMatchesApprovalRole(user, "hr_manager")).toBe(true);
    });

    it("should fail if no match", () => {
      const user = { jobTitle: "Employee", roles: ["some_other_role"] } as any;
      expect(userMatchesApprovalRole(user, "housing_manager")).toBe(false);
    });

    it("should validate all defined STEP_ROLES correctly", () => {
      const user = { jobTitle: "Accounts Manager", roles: [] } as any;
      expect(userMatchesApprovalRole(user, STEP_ROLES[3])).toBe(true);
    });
  });

  describe("canAccessProperty", () => {
    it("should allow system admins unconditionally", () => {
      expect(canAccessProperty(1, [], true)).toBe(true);
      expect(canAccessProperty(5, [2, 3], true)).toBe(true);
    });

    it("should allow if request property is in user propertyIds", () => {
      expect(canAccessProperty(1, [1, 2, 3], false)).toBe(true);
      expect(canAccessProperty(2, [1, 2, 3], false)).toBe(true);
    });

    it("should deny if request property is NOT in user propertyIds", () => {
      expect(canAccessProperty(4, [1, 2, 3], false)).toBe(false);
      expect(canAccessProperty(1, [], false)).toBe(false);
    });
  });
});
