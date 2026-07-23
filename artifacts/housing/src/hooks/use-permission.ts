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

  const isAdmin =
    isSystemAdmin ||
    !!user?.roles?.some((r) =>
      ["super_admin", "system_admin"].includes(normalize(r)),
    );

  const effectivePermissions = (): Set<string> => {
    if (!user) return new Set();
    if (isAdmin) return new Set(["*"]);

    const combined = new Set<string>();
    const resolvedRoles = resolveInheritedRoles(user.roles ?? []);

    const explicit = (user as any).permissions as string[] | undefined;
    if (explicit) {
      for (const permission of explicit) {
        const normalized = normalize(permission);
        if (normalized) combined.add(normalized);
      }
    }

    for (const role of resolvedRoles) {
      const defaults = ROLE_DEFAULT_PERMISSIONS[normalize(role)] ?? [];
      defaults.forEach((p) => combined.add(p));
    }

    return combined;
  };

  const perms = effectivePermissions();

  const can = (module: Module, action: Action): boolean => {
    if (!user) return false;
    if (isAdmin) return true;
    if (perms.has("*")) return true;
    if (perms.has(permKey(module, action))) return true;
    if (
      module === "reservations" &&
      perms.has(permKey("accommodation" as Module, action))
    )
      return true;
    return false;
  };

  const canAny = (module: Module, actions: Action[]): boolean =>
    actions.some((a) => can(module, a));

  const canView = (m: Module) => can(m, "view");
  const canCreate = (m: Module) => can(m, "create");
  const canEdit = (m: Module) => can(m, "edit");
  const canDelete = (m: Module) => can(m, "delete");

  return {
    can,
    canAny,
    canView,
    canCreate,
    canEdit,
    canDelete,
    isAdmin,
    perms,
  };
}
