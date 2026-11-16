import { useAuth } from "@/context/AuthContext";
import { type Module, type Action } from "@/lib/permissions";

const normalize = (value: unknown): string => {
  let val = String(value ?? "")
    .trim()
    .toLowerCase();
  if (val.startsWith("employees."))
    val = val.replace("employees.", "profiles.");
  if (val.startsWith("employees:"))
    val = val.replace("employees:", "profiles:");
  return val;
};

// Role hierarchy: child roles inherit all permissions from parent roles
const ROLE_INHERITANCE: Record<string, string[]> = {
  super_admin: [],
  system_admin: [],
  admin: [],
  manager: ["receptionist"],
  hr_admin: [],
  portal_admin: [],
  security_staff: [],
  receptionist: [],
  maintenance_staff: [],
  housekeeping_staff: [],
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

  const isSuperAdmin = !!user?.roles?.some((r) =>
    ["super_admin"].includes(normalize(r)),
  );

  const isAdmin =
    isSuperAdmin ||
    isSystemAdmin ||
    !!user?.roles?.some((r) =>
      ["admin", "system_admin"].includes(normalize(r)),
    );

  const hasRole = (role: string): boolean => {
    if (!user) return false;
    const target = normalize(role);
    if (target === "super_admin" && (isSuperAdmin || isSystemAdmin))
      return true;
    if (target === "admin" && isAdmin) return true;
    if (user.roles && Array.isArray(user.roles)) {
      if (user.roles.some((r) => normalize(r) === target)) return true;
    }
    if ((user as any).role && normalize((user as any).role) === target)
      return true;
    return false;
  };

  const effectivePermissions = (): Set<string> => {
    if (!user) return new Set();

    const explicit = (user as any).permissions as string[] | undefined;

    // 1. Super admin / system admin: always full access (mirrors the API's effectivePermissions).
    if (isSuperAdmin || isSystemAdmin) {
      return new Set(["*"]);
    }

    // 2. Pure Discretionary Fine-Grained Permissions (100% Decoupled from Roles)
    // user.permissions is the EXCLUSIVE source of truth.
    // NO automatic fallback to ROLE_DEFAULT_PERMISSIONS. Roles are purely organizational.
    const combined = new Set<string>();
    if (Array.isArray(explicit)) {
      for (const permission of explicit) {
        if (permission === "none") continue;
        const normalized = normalize(permission);
        if (normalized) {
          combined.add(normalized);
          if (normalized.includes("."))
            combined.add(normalized.replace(".", ":"));
          if (normalized.includes(":"))
            combined.add(normalized.replace(":", "."));
        }
      }
    }

    return combined;
  };

  const perms = effectivePermissions();

  // Explicit deny list: these permissions are blocked even when a role, the
  // admin elevation, or the stored list would grant them (deny wins). Super
  // and system admins returned "*" above, so a root account is never denied.
  const deniedSet = (): Set<string> => {
    const denied = new Set<string>();
    if (isSuperAdmin || isSystemAdmin) return denied;
    const list = (user as any)?.deniedPermissions as string[] | undefined;
    if (Array.isArray(list)) {
      for (const permission of list) {
        if (!permission || permission === "none") continue;
        const normalized = normalize(permission);
        if (!normalized) continue;
        denied.add(normalized);
        if (normalized.includes(".")) denied.add(normalized.replace(".", ":"));
        if (normalized.includes(":")) denied.add(normalized.replace(":", "."));
      }
    }
    return denied;
  };

  const denied = deniedSet();

  // Per-permission property scope (mirrors the API). A scoped permission only
  // applies in its listed properties. We read the active property from the
  // same localStorage key PropertyContext persists, to avoid import coupling.
  const scopes = (user as any)?.permissionScopes as
    | Record<string, number[]>
    | undefined;
  const activeProperty = ((): number | "all" | null => {
    if (isSuperAdmin || isSystemAdmin) return "all";
    try {
      const raw = localStorage.getItem("activePropertyId");
      if (!raw || raw === "all") return "all";
      const n = Number(raw);
      return Number.isFinite(n) && n > 0 ? n : null;
    } catch {
      return null;
    }
  })();

  const scopeAllows = (dotKey: string, colonKey: string): boolean => {
    if (isSuperAdmin || isSystemAdmin) return true;
    const scope = scopes?.[dotKey] ?? scopes?.[colonKey];
    if (!scope || scope.length === 0) return true;
    // When viewing "all" properties we don't hide a scoped action — the server
    // still enforces it per request. Only a specific out-of-scope property hides it.
    if (activeProperty === "all" || activeProperty == null) return true;
    return scope.includes(activeProperty);
  };

  const can = (module: Module, action: Action): boolean => {
    if (!user) return false;
    if (perms.has("*")) return true;

    // Check module.action with dot or colon format
    const dotKey = `${module}.${action}`.toLowerCase();
    const colonKey = `${module}:${action}`.toLowerCase();

    // Explicit deny wins over every grant below (role elevation included).
    if (denied.has(dotKey) || denied.has(colonKey)) return false;

    // Property scope narrows access: a permission scoped to other properties
    // is not available in the active one.
    if (!scopeAllows(dotKey, colonKey)) return false;

    // The `admin` role is elevated: every module except the super-only
    // `properties` module. Mirrors the API's effectivePermissions.
    if (isAdmin && module !== "properties") return true;

    return perms.has(dotKey) || perms.has(colonKey);
  };

  const canAny = (module: Module, actions: Action[]): boolean =>
    actions.some((a) => can(module, a));

  const canView = (m: Module) => {
    if (m === "maintenance") {
      return (
        can(m, "view") ||
        can(m, "view_maintenance") ||
        can(m, "view_housekeeping")
      );
    }
    return can(m, "view");
  };
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
    hasRole,
    perms,
    denied,
  };
}
