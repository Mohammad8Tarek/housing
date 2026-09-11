import { hasPermission, Module, Action } from "./permissions";

export type PolicySubject =
  | "Ticket"
  | "Room"
  | "Building"
  | "Profile"
  | "Reservation"
  | "User"
  | "Setting"
  | "Report"
  | "all";

export type PolicyAction =
  | "view"
  | "create"
  | "edit"
  | "delete"
  | "export"
  | "assign"
  | "approve"
  | "manage";

export interface PolicyRule {
  action: PolicyAction;
  subject: PolicySubject;
  conditions?: (resource?: any) => boolean;
}

export interface AppAbility {
  can: (action: PolicyAction, subject: PolicySubject, resource?: any) => boolean;
  cannot: (action: PolicyAction, subject: PolicySubject, resource?: any) => boolean;
  rules: PolicyRule[];
}

/**
 * Maps CASL Subject names to primary Permission Modules in Frontend
 */
export function mapSubjectToModule(subject: PolicySubject, resource?: any): Module {
  switch (subject) {
    case "Ticket":
      if (resource?.category === "housekeeping") return "housekeeping";
      return "maintenance";
    case "Room":
    case "Building":
      return "housing";
    case "Profile":
      return "profiles";
    case "Reservation":
      return "reservations";
    case "User":
      return "users";
    case "Setting":
      return "settings";
    case "Report":
      return "reports";
    default:
      return "dashboard";
  }
}

/**
 * Builds a CASL-style ability instance for the given user in React
 */
export function defineAbilityFor(user: any): AppAbility {
  const isSuperAdmin =
    user?.isSystemAdmin ||
    (user?.roles ?? []).some((r: string) =>
      ["super_admin", "system_admin"].includes(String(r).toLowerCase()),
    );

  const rules: PolicyRule[] = [];

  if (isSuperAdmin) {
    rules.push({
      action: "manage",
      subject: "all",
      conditions: () => true,
    });

    return {
      can: () => true,
      cannot: () => false,
      rules,
    };
  }

  const userPropertyIds: number[] = Array.isArray(user?.propertyIds)
    ? user.propertyIds
    : user?.propertyId
      ? [user.propertyId]
      : [];

  const can = (
    action: PolicyAction,
    subject: PolicySubject,
    resource?: any,
  ): boolean => {
    if (action === "manage" || subject === "all") {
      return isSuperAdmin;
    }

    // Property / Tenant Scope Check (ABAC attribute isolation)
    if (
      resource &&
      resource.propertyId !== undefined &&
      resource.propertyId !== "all" &&
      resource.propertyId !== null
    ) {
      const pId = Number(resource.propertyId);
      if (!isNaN(pId) && userPropertyIds.length > 0 && !userPropertyIds.includes(pId)) {
        return false;
      }
    }

    // Ticket category isolation check
    if (subject === "Ticket") {
      const category = resource?.category || "maintenance";
      const targetModule: Module =
        category === "housekeeping" ? "housekeeping" : "maintenance";

      const mappedAction = (action === "manage" ? "edit" : action) as Action;
      return hasPermission(user, targetModule, mappedAction);
    }

    // Standard module resolution
    const module = mapSubjectToModule(subject, resource);
    const mappedAction = (action === "manage" ? "edit" : action) as Action;
    return hasPermission(user, module, mappedAction);
  };

  const cannot = (
    action: PolicyAction,
    subject: PolicySubject,
    resource?: any,
  ): boolean => !can(action, subject, resource);

  return {
    can,
    cannot,
    rules,
  };
}