import type { NextFunction, Request, RequestHandler, Response } from "express";
import { db, usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export const PERMISSION_MODULES = [
  "dashboard",
  "housing",
  "housekeeping",
  "profiles",
  "accommodation",
  "reservations",
  "maintenance",
  "reports",
  "users",
  "settings",
  "activity_log",
  "properties",
  "documents",
  "billing",
  "communications",
  "evaluations",
  "surveys",
  "portal_content",
  "activities",
  "smart_locks",
  "hosting_requests",
  "guest_hosting",
] as const;

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "bulk_delete",
  "bulk_export",
  "assign",
  "checkin",
  "checkout",
  "approve",
  "transfer",
  "reset_password",
  "manage_permissions",
  "view_sensitive",
  "audit",
  "publish",
  "archive",
  "unlock",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

type AuthUser = {
  id: number;
  propertyId: number | null;
  propertyIds: number[];
  username: string;
  roles: string[];
  permissions: string[];
  isSystemAdmin: boolean;
};

const SYSTEM_ROLES = new Set(["super_admin", "system_admin"]);

const permissionKey = (module: PermissionModule, action: PermissionAction) =>
  `${module}.${action}`;

const allModulePerms = (module: PermissionModule) =>
  PERMISSION_ACTIONS.map((action) => permissionKey(module, action));

const crud = (module: PermissionModule) =>
  (["view", "create", "edit", "delete"] as PermissionAction[]).map((action) =>
    permissionKey(module, action),
  );

const readExport = (module: PermissionModule) =>
  (["view", "export"] as PermissionAction[]).map((action) =>
    permissionKey(module, action),
  );

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

const ROLE_DEFAULT_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSION_MODULES.flatMap((module) => allModulePerms(module)),
  system_admin: PERMISSION_MODULES.flatMap((module) => allModulePerms(module)),
  admin: [
    ...PERMISSION_MODULES.filter((module) => module !== "properties").flatMap(
      (module) => allModulePerms(module),
    ),
    "users.unlock",
  ],
  manager: [
    // Extra permissions manager has beyond receptionist:
    "dashboard.export",
    "housing.create",
    "housing.edit",
    "housing.delete",
    "housing.bulk_export",
    "housekeeping.view",
    "housekeeping.edit",
    "housekeeping.assign",
    "housekeeping.approve",
    "housekeeping.bulk_export",
    "profiles.create",
    "profiles.edit",
    "profiles.delete",
    "profiles.export",
    "accommodation.delete",
    "accommodation.transfer",
    "accommodation.bulk_delete",
    "accommodation.bulk_export",
    "accommodation.archive",
    "guest_hosting.view",
    "guest_hosting.create",
    "guest_hosting.edit",
    "guest_hosting.delete",
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.approve",
    "guest_hosting.transfer",
    "guest_hosting.bulk_delete",
    "guest_hosting.bulk_export",
    "reservations.delete",
    "reservations.bulk_export",
    "reservations.archive",
    "maintenance.delete",
    "maintenance.assign",
    "maintenance.approve",
    "maintenance.bulk_export",
    "maintenance.archive",
    "reports.audit",
    "users.view",
    "users.edit",
    "users.manage_permissions",
    "users.unlock",
    "settings.view",
    "settings.edit",
    "activity_log.export",
    "activity_log.audit",
    "documents.create",
    "documents.edit",
    "documents.delete",
    "documents.publish",
    "documents.archive",
    "billing.view",
    "billing.export",
    "communications.create",
  ],
  receptionist: [
    "dashboard.view",
    "housing.view",
    "housing.export",
    "housekeeping.view",
    "profiles.view",
    "accommodation.view",
    "accommodation.create",
    "accommodation.edit",
    "accommodation.assign",
    "accommodation.checkin",
    "accommodation.checkout",
    "accommodation.approve",
    "guest_hosting.view",
    "guest_hosting.create",
    "guest_hosting.edit",
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.approve",
    "guest_hosting.export",
    "reservations.view",
    "reservations.create",
    "reservations.edit",
    "reservations.checkin",
    "reservations.checkout",
    "reservations.approve",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "reports.view",
    "reports.export",
    "activity_log.view",
    "documents.view",
    "communications.view",
    "communications.create",
  ],
  maintenance_staff: [
    "dashboard.view",
    "housing.view",
    "housekeeping.view",
    "housekeeping.edit",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "maintenance.assign",
    "maintenance.approve",
    "profiles.view",
    "activity_log.view",
    "documents.view",
  ],
  hr_admin: [
    "dashboard.view",
    "dashboard.export",
    ...crud("profiles"),
    "profiles.export",
    ...crud("evaluations"),
    "evaluations.export",
    ...crud("surveys"),
    ...crud("activities"),
    "activities.publish",
    ...crud("documents"),
    ...crud("portal_content"),
    ...crud("communications"),
    "reports.view",
    "reports.export",
  ],
  portal_admin: [
    "dashboard.view",
    ...crud("activities"),
    "activities.publish",
    ...crud("documents"),
    ...crud("portal_content"),
    ...crud("communications"),
    "reports.view",
  ],
  security_staff: [
    "dashboard.view",
    "housing.view",
    "accommodation.view",
    ...crud("smart_locks"),
    "activities.view",
  ],
};

function normalize(value: unknown): string {
  return String(value ?? "")
    .trim()
    .toLowerCase();
}

function normalizeRoles(roles: unknown): string[] {
  if (Array.isArray(roles)) return roles.map(normalize).filter(Boolean);
  if (typeof roles === "string")
    return roles
      .split(",")
      .map(normalize)
      .filter(Boolean);
  return [];
}

function isSystemRole(role: unknown): boolean {
  return SYSTEM_ROLES.has(normalize(role));
}

function normalizePermissions(permissions: unknown): string[] {
  const list = Array.isArray(permissions)
    ? permissions
    : typeof permissions === "string"
      ? permissions.split(",")
      : [];
  return [...new Set(list.map(normalize).filter(Boolean))];
}

function permissionKeys(
  module: PermissionModule,
  action: PermissionAction,
): string[] {
  return [
    `${module}.${action}`.toLowerCase(),
    `${module}:${action}`.toLowerCase(),
  ];
}

function effectivePermissions(user: AuthUser): Set<string> {
  // 1. If explicit permissions are configured for this user:
  // STRICT MODE: We ONLY use explicit permissions. Do NOT add role defaults back!
  if (Array.isArray(user.permissions) && user.permissions.length > 0) {
    const permissions = new Set<string>();
    for (const permission of user.permissions) {
      if (permission === "none") continue;
      const norm = normalize(permission);
      if (norm) {
        permissions.add(norm);
        if (norm.includes(".")) permissions.add(norm.replace(".", ":"));
        if (norm.includes(":")) permissions.add(norm.replace(":", "."));
      }
    }
    return permissions;
  }

  // 2. If system admin (super_admin / system_admin) without explicit restrictions: grant all
  if (user.isSystemAdmin || user.roles.includes("super_admin")) {
    return new Set(["*"]);
  }

  const permissions = new Set<string>();

  // 3. Otherwise, fallback to role default permissions for uncustomized users:
  const resolvedRoles = resolveInheritedRoles(user.roles);
  for (const role of resolvedRoles) {
    for (const permission of ROLE_DEFAULT_PERMISSIONS[role] ?? []) {
      const norm = normalize(permission);
      if (norm) {
        permissions.add(norm);
        if (norm.includes(".")) permissions.add(norm.replace(".", ":"));
        if (norm.includes(":")) permissions.add(norm.replace(":", "."));
      }
    }
  }

  return permissions;
}

export function hasPermission(
  user: AuthUser,
  module: PermissionModule,
  action: PermissionAction,
): boolean {
  const permissions = effectivePermissions(user);
  if (permissions.has("*")) return true;
  if (permissionKeys(module, action).some((key) => permissions.has(key))) {
    return true;
  }
  // Cross-module fallback for room & housing entities: accommodation, housing, and housekeeping
  if (
    (action === "view" || action === "edit" || action === "delete" || action === "create") &&
    (module === "accommodation" || module === "housing" || module === "housekeeping")
  ) {
    const crossModules: PermissionModule[] = ["accommodation", "housing", "housekeeping"];
    for (const cross of crossModules) {
      if (permissionKeys(cross, action).some((key) => permissions.has(key))) {
        return true;
      }
    }
  }
  return false;
}

function requestedPropertyId(req: Request): number | null {
  const raw =
    (req.query?.propertyId as string | undefined) ??
    (req.body && typeof req.body === "object"
      ? (req.body as any).propertyId
      : undefined);
  const parsed = Number(raw);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

export async function loadAuthUser(
  req: Request,
  res: Response,
): Promise<AuthUser | null> {
  const existing = (req as any).authUser as AuthUser | undefined;
  if (existing) return existing;

  const session = req.session as any;
  const userId = Number(session?.userId);
  if (!userId) {
    res.status(401).json({ error: "Not authenticated" });
    return null;
  }

  const [userRow] = await db
    .select()
    .from(usersTable)
    .where(eq(usersTable.id, userId))
    .limit(1);

  if (!userRow) {
    req.session.destroy(() => {});
    res.status(401).json({ error: "User not found" });
    return null;
  }

  if (normalize((userRow as any).status) === "inactive") {
    req.session.destroy(() => {});
    res.status(403).json({ error: "Account disabled" });
    return null;
  }

  const roles = normalizeRoles((userRow as any).roles);
  const propertyIds =
    Array.isArray((userRow as any).propertyIds) &&
    (userRow as any).propertyIds.length > 0
      ? (userRow as any).propertyIds.map(Number).filter(Boolean)
      : (userRow as any).propertyId
        ? [Number((userRow as any).propertyId)]
        : [];
  const isSystemAdmin = roles.some(isSystemRole);

  const currentSessionPropertyId = Number(session?.propertyId);
  if (
    !isSystemAdmin &&
    currentSessionPropertyId &&
    !propertyIds.includes(currentSessionPropertyId)
  ) {
    session.propertyId = propertyIds[0] ?? null;
  }

  if (!session.propertyId && propertyIds[0]) {
    session.propertyId = propertyIds[0];
  }

  const requestedPid = requestedPropertyId(req);
  if (!isSystemAdmin && requestedPid && !propertyIds.includes(requestedPid)) {
    res.status(403).json({ error: "Access denied to this property" });
    return null;
  }

  session.isSystemAdmin = isSystemAdmin;
  session.username = (userRow as any).username;
  session.userRole = roles[0] ?? null;

  const authUser: AuthUser = {
    id: Number((userRow as any).id),
    propertyId: (userRow as any).propertyId
      ? Number((userRow as any).propertyId)
      : null,
    propertyIds,
    username: (userRow as any).username,
    roles,
    permissions: normalizePermissions((userRow as any).permissions),
    isSystemAdmin,
  };

  (req as any).authUser = authUser;
  return authUser;
}

export async function requireAuth(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const user = await loadAuthUser(req, res);
    if (!user) return;
    next();
  } catch (err) {
    next(err);
  }
}

export function requirePermission(
  module: PermissionModule,
  action: PermissionAction,
): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await loadAuthUser(req, res);
      if (!user) return;

      if (!hasPermission(user, module, action)) {
        res
          .status(403)
          .json({ error: `Permission denied: ${module}.${action}` });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

// inferAction + requireModulePermission removed — unused (all routes call requirePermission directly)
