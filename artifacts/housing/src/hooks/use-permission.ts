// @ts-nocheck
import { useAuth } from "@/context/AuthContext";
import {
  permKey,
  ROLE_DEFAULT_PERMISSIONS,
  type Module,
  type Action,
} from "@/lib/permissions";

const normalize = (value: unknown): string =>
  String(value ?? "")
    .trim()
    .toLowerCase();

// Role hierarchy: child roles inherit all permissions from parent roles
const ROLE_INHERITANCE = {
  super_admin: [],
  system_admin: [],
  admin: [],
  manager: ["receptionist"],
  hr_admin: [],
  portal_admin: [],
  security_staff: [],
  receptionist: [],
  maintenance_staff: [],
};

function resolveInheritedRoles(roles: string[]): string[] {
  const resolved = new Set<string>();
  const visit = (role: string) => {
    if (resolved.has(role)) return;
    resolved.add(role);
    for (const parent of ROLE_INHERITANCE[role] ?? []) visit(parent);
  };
  for (const role of roles) visit(normalize(role));
  return [...resolved];
}

export function usePermission() {
  const { user, isSystemAdmin } = useAuth();

  const isSuperAdmin =
    !!user?.roles?.some((r) =>
      ["super_admin"].includes(normalize(r)),
    );

  const isAdmin =
    isSuperAdmin ||
    isSystemAdmin ||
    !!user?.roles?.some((r) =>
      ["admin", "system_admin"].includes(normalize(r)),
    );

  const effectivePermissions = (): Set<string> => {
    if (!user) return new Set();

    // 1. Super admin / system admin always gets full access
    if (isSuperAdmin || isSystemAdmin) return new Set(["*"]);

    const explicit = (user as any).permissions as string[] | undefined;

    // 2. If explicit permissions are configured for this user:
    // STRICT MODE: We ONLY use explicit permissions. Do NOT add role defaults back!
    if (Array.isArray(explicit) && explicit.length > 0) {
      const combined = new Set<string>();
      for (const permission of explicit) {
        if (permission === "none") continue;
        const normalized = normalize(permission);
        if (normalized) {
          combined.add(normalized);
          if (normalized.includes(".")) combined.add(normalized.replace(".", ":"));
          if (normalized.includes(":")) combined.add(normalized.replace(":", "."));
        }
      }
      return combined;
    }

    // 3. Default fallback ONLY for fresh users whose permissions were never customized:
    const combined = new Set<string>();
    const resolvedRoles = resolveInheritedRoles(user.roles ?? []);
    for (const role of resolvedRoles) {
      const defaults = ROLE_DEFAULT_PERMISSIONS[normalize(role)] ?? [];
      defaults.forEach((p) => {
        const norm = normalize(p);
        combined.add(norm);
        if (norm.includes(".")) combined.add(norm.replace(".", ":"));
        if (norm.includes(":")) combined.add(norm.replace(":", "."));
      });
    }

    return combined;
  };

  const perms = effectivePermissions();

  const can = (module: Module, action: Action): boolean => {
    if (!user) return false;
    if (perms.has("*")) return true;

    // Check module.action with dot or colon format
    const dotKey = `${module}.${action}`.toLowerCase();
    const colonKey = `${module}:${action}`.toLowerCase();

    if (perms.has(dotKey) || perms.has(colonKey)) return true;

    // Cross-module fallback for guest hosting and hosting requests <-> accommodation
    if (module === "guest_hosting" || module === "hosting_requests") {
      const fallbacks = ["accommodation", "guest_hosting", "hosting_requests"];
      for (const fb of fallbacks) {
        if (perms.has(`${fb}.${action}`.toLowerCase()) || perms.has(`${fb}:${action}`.toLowerCase())) {
          return true;
        }
      }
    }

    // Cross-module fallback for room & housing entities: accommodation, housing, housekeeping
    if (
      (action === "view" || action === "edit" || action === "delete" || action === "create") &&
      (module === "accommodation" || module === "housing" || module === "housekeeping")
    ) {
      const crossModules = ["accommodation", "housing", "housekeeping"];
      for (const cross of crossModules) {
        if (perms.has(`${cross}.${action}`.toLowerCase()) || perms.has(`${cross}:${action}`.toLowerCase())) {
          return true;
        }
      }
    }

    return false;
  };

  const canAny = (module: Module, actions: Action[]): boolean =>
    actions.some((a) => can(module, a));

  const canView = (m: Module) => can(m, "view");
  const canCreate = (m: Module) => can(m, "create");
  const canEdit = (m: Module) => can(m, "edit");
  const canDelete = (m: Module) => can(m, "delete");
  const canExport = (m: Module) => can(m, "export");

  return {
    can,
    canAny,
    canView,
    canCreate,
    canEdit,
    canDelete,
    canExport,
    isAdmin,
    isSuperAdmin,
    perms,
  };
}
