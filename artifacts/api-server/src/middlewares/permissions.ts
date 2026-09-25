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
  "hosting_requests",
  "guest_hosting",
  "maintenance",
  "reports",
  "users",
  "settings",
  "activity_log",
  "properties",
  "documents",
  "evaluations",
  "portal_content",
  "activities",
  "smart_locks",
  "whatsapp",
  "inventory",
  "workers",
  "hr_sync",
  "portal_notifications",
  "gate",
] as const;

export const PERMISSION_ACTIONS = [
  "view",
  "create",
  "edit",
  "delete",
  "export",
  "checkin",
  "checkout",
  "approve",
  "transfer",
  "reset_password",
  "manage_permissions",
  "view_sensitive",
  "audit",
  "publish",
  "unlock",
  "override_single_occupancy",
  "view_maintenance",
  "view_housekeeping",
  "assign",
  "manage_policies",
  "manage_organization",
  "manage_room_types",
  "manage_security",
  "manage_email",
  "config",
] as const;

export type PermissionModule = (typeof PERMISSION_MODULES)[number];
export type PermissionAction = (typeof PERMISSION_ACTIONS)[number];

export const MODULE_ACTIONS: Record<PermissionModule, PermissionAction[]> = {
  dashboard: ["view"],
  housing: ["view", "create", "edit", "delete", "export"],
  housekeeping: ["view", "create", "edit", "delete", "export"],
  profiles: [
    "view",
    "create",
    "edit",
    "delete",
    "export",
    "reset_password",
    "view_sensitive",
  ],
  accommodation: [
    "view",
    "create",
    "edit",
    "delete",
    "checkout",
    "transfer",
    "export",
    "override_single_occupancy",
  ],
  reservations: [
    "view",
    "create",
    "edit",
    "checkin",
    "delete",
    "export",
    "override_single_occupancy",
  ],
  hosting_requests: ["view", "create", "edit", "delete", "approve"],
  guest_hosting: [
    "view",
    "create",
    "edit",
    "approve",
    "checkin",
    "checkout",
    "delete",
    "export",
  ],
  maintenance: [
    "view",
    "view_maintenance",
    "view_housekeeping",
    "create",
    "edit",
    "assign",
    "delete",
    "export",
  ],
  reports: ["view", "export", "create", "edit", "delete", "config", "audit"],
  users: [
    "view",
    "create",
    "edit",
    "delete",
    "export",
    "manage_permissions",
    "reset_password",
    "unlock",
  ],
  settings: [
    "view",
    "create",
    "edit",
    "export",
    "manage_policies",
    "manage_organization",
    "manage_room_types",
    "manage_security",
    "manage_email",
    "delete",
  ],
  activity_log: ["view", "export"],
  properties: ["view", "create", "edit", "delete"],
  documents: ["view", "create", "delete"],
  evaluations: ["view", "create", "edit", "delete", "export"],
  portal_content: ["view", "create", "edit", "delete"],
  activities: ["view", "create", "edit", "delete", "publish"],
  smart_locks: ["view", "create", "edit", "delete", "unlock"],
  whatsapp: ["view", "create", "edit", "export"],
  inventory: ["view", "create", "edit", "delete", "export"],
  workers: ["view", "create", "edit", "delete", "export"],
  hr_sync: ["view", "edit", "export"],
  portal_notifications: ["view", "create", "delete"],
  gate: ["view", "create", "export"],
};

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
  (MODULE_ACTIONS[module] ?? []).map((action) => permissionKey(module, action));

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
    // Dashboard
    "dashboard.view",
    // Housing
    ...allModulePerms("housing"),
    // Housekeeping
    ...allModulePerms("housekeeping"),
    // Profiles
    ...allModulePerms("profiles"),
    // Accommodation
    ...allModulePerms("accommodation"),
    // Reservations
    ...allModulePerms("reservations"),
    // Hosting Requests
    ...allModulePerms("hosting_requests"),
    // Guest Hosting
    ...allModulePerms("guest_hosting"),
    // Maintenance
    ...allModulePerms("maintenance"),
    // Reports
    ...allModulePerms("reports"),
    // Users
    "users.view",
    "users.edit",
    "users.export",
    "users.manage_permissions",
    "users.unlock",
    // Settings
    ...allModulePerms("settings"),
    // Activity Log
    ...allModulePerms("activity_log"),
    // Documents
    ...allModulePerms("documents"),
    // Evaluations
    ...allModulePerms("evaluations"),
    // Portal Content
    ...allModulePerms("portal_content"),
    // Activities
    ...allModulePerms("activities"),
    // Smart Locks
    ...allModulePerms("smart_locks"),
    // WhatsApp
    ...allModulePerms("whatsapp"),
    // Inventory
    ...allModulePerms("inventory"),
    // Workers
    ...allModulePerms("workers"),
    // HR Sync
    ...allModulePerms("hr_sync"),
    // Portal Notifications
    ...allModulePerms("portal_notifications"),
    // Gate Scanner
    ...allModulePerms("gate"),
  ],
  receptionist: [
    "dashboard.view",
    "housing.view",
    "housing.export",
    "housekeeping.view",
    "housekeeping.edit",
    "housekeeping.export",
    "profiles.view",
    "accommodation.view",
    "accommodation.create",
    "accommodation.edit",
    "accommodation.checkout",
    "accommodation.transfer",
    "accommodation.export",
    "reservations.view",
    "reservations.create",
    "reservations.edit",
    "reservations.checkin",
    "reservations.delete",
    "reservations.export",
    "hosting_requests.view",
    "hosting_requests.create",
    "hosting_requests.edit",
    "guest_hosting.view",
    "guest_hosting.create",
    "guest_hosting.edit",
    "guest_hosting.checkin",
    "guest_hosting.checkout",
    "guest_hosting.export",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "reports.view",
    "reports.export",
    "activity_log.view",
    "documents.view",
    "whatsapp.view",
    "whatsapp.create",
    "inventory.view",
    "inventory.export",
    "workers.view",
    "gate.view",
    "gate.create",
  ],
  maintenance_staff: [
    "dashboard.view",
    "housing.view",
    "maintenance.view",
    "maintenance.create",
    "maintenance.edit",
    "maintenance.delete",
    "maintenance.export",
    "inventory.view",
    "inventory.edit",
    "workers.view",
    "workers.edit",
    "profiles.view",
    "activity_log.view",
    "documents.view",
  ],
  housekeeping_staff: [
    "dashboard.view",
    "housing.view",
    "housekeeping.view",
    "housekeeping.edit",
    "housekeeping.export",
    "inventory.view",
    "inventory.edit",
    "workers.view",
    "activity_log.view",
    "documents.view",
  ],
  hr_admin: [
    "dashboard.view",
    ...allModulePerms("profiles"),
    ...allModulePerms("evaluations"),
    ...allModulePerms("activities"),
    ...allModulePerms("documents"),
    ...allModulePerms("hosting_requests"),
    ...allModulePerms("guest_hosting"),
    ...allModulePerms("hr_sync"),
    ...allModulePerms("portal_notifications"),
    "whatsapp.view",
    "whatsapp.create",
    "whatsapp.export",
    "reports.view",
    "reports.export",
    "reports.create",
    "reports.edit",
    "reports.delete",
    "reports.config",
  ],
  portal_admin: [
    "dashboard.view",
    ...allModulePerms("portal_content"),
    ...allModulePerms("activities"),
    ...allModulePerms("evaluations"),
    ...allModulePerms("documents"),
    ...allModulePerms("portal_notifications"),
    "reports.view",
  ],
  security_staff: [
    "dashboard.view",
    "housing.view",
    "accommodation.view",
    ...allModulePerms("smart_locks"),
    ...allModulePerms("gate"),
    "activities.view",
  ],
};

function normalize(value: unknown): string {
  let val = String(value ?? "")
    .trim()
    .toLowerCase();
  // Legacy aliases: employees -> profiles
  if (val.startsWith("employees.")) val = val.replace("employees.", "profiles.");
  if (val.startsWith("employees:")) val = val.replace("employees:", "profiles:");
  if (val.startsWith("communications.")) val = val.replace("communications.", "whatsapp.");
  if (val.startsWith("communications:")) val = val.replace("communications:", "whatsapp:");
  if (val.startsWith("surveys.")) val = val.replace("surveys.", "evaluations.");
  if (val.startsWith("surveys:")) val = val.replace("surveys:", "evaluations:");
  if (val.endsWith(".bulk_export")) val = val.replace(".bulk_export", ".export");
  if (val.endsWith(":bulk_export")) val = val.replace(":bulk_export", ":export");
  if (val.endsWith(".bulk_delete")) val = val.replace(".bulk_delete", ".delete");
  if (val.endsWith(":bulk_delete")) val = val.replace(":bulk_delete", ":delete");
  if (val.endsWith(".archive")) val = val.replace(".archive", ".checkout");
  if (val.endsWith(":archive")) val = val.replace(":archive", ":checkout");
  return val;
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

export function normalizePermission(value: unknown): string {
  return normalize(value);
}

export function effectivePermissions(user: AuthUser): Set<string> {
  // 1. Super admin / system admin root access (emergency self-lockout prevention)
  if (
    user.isSystemAdmin ||
    user.roles.includes("super_admin") ||
    user.roles.includes("system_admin")
  ) {
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
      permissions.add("users.view");
      permissions.add("users:view");
      permissions.add("users.manage_permissions");
      permissions.add("users:manage_permissions");
      return permissions;
    }
    return new Set(["*"]);
  }

  // 2. Pure Discretionary Fine-Grained Permissions (100% Decoupled from Roles)
  // user.permissions is the EXCLUSIVE source of truth.
  // NO automatic fallback to ROLE_DEFAULT_PERMISSIONS. Roles are purely organizational.
  const permissions = new Set<string>();
  if (Array.isArray(user.permissions)) {
    for (const permission of user.permissions) {
      if (permission === "none") continue;
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
  return permissionKeys(module, action).some((key) => permissions.has(key));
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

import { getRedisConnection } from "@workspace/queue";

// ─── Fast In-Memory L1 + Redis L2 User & Permissions Cache ──────────────────
interface CachedUserData {
  id: number;
  username: string;
  status: string;
  roles: string[];
  permissions: string[];
  propertyId: number | null;
  propertyIds: number[];
  isSystemAdmin: boolean;
  cachedAt: number;
}

const userMemoryCache = new Map<number, CachedUserData>();
const USER_CACHE_TTL_MS = 60_000; // 60s in-memory TTL

export function invalidateAuthUserCache(userId?: number | number[]): void {
  if (typeof userId === "number") {
    userMemoryCache.delete(userId);
    try {
      const redis = getRedisConnection();
      if (redis) redis.del(`auth:user:${userId}`).catch(() => {});
    } catch {}
  } else if (Array.isArray(userId)) {
    for (const id of userId) {
      userMemoryCache.delete(id);
      try {
        const redis = getRedisConnection();
        if (redis) redis.del(`auth:user:${id}`).catch(() => {});
      } catch {}
    }
  } else {
    userMemoryCache.clear();
  }
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

  const now = Date.now();
  let cached = userMemoryCache.get(userId);
  if (cached && now - cached.cachedAt > USER_CACHE_TTL_MS) {
    userMemoryCache.delete(userId);
    cached = undefined;
  }

  // Try Redis L2 if L1 missed
  if (!cached) {
    try {
      const redis = getRedisConnection();
      if (redis) {
        const raw = await redis.get(`auth:user:${userId}`);
        if (raw) {
          cached = JSON.parse(raw);
          if (cached) userMemoryCache.set(userId, cached);
        }
      }
    } catch {}
  }

  // Load from database if cache miss
  if (!cached) {
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

    const roles = normalizeRoles((userRow as any).roles);
    const propertyIds =
      Array.isArray((userRow as any).propertyIds) &&
      (userRow as any).propertyIds.length > 0
        ? (userRow as any).propertyIds.map(Number).filter(Boolean)
        : (userRow as any).propertyId
          ? [Number((userRow as any).propertyId)]
          : [];
    const isSystemAdmin = roles.some(isSystemRole);

    cached = {
      id: Number(userRow.id),
      username: String(userRow.username),
      status: normalize((userRow as any).status),
      roles,
      permissions: normalizePermissions((userRow as any).permissions),
      propertyId: (userRow as any).propertyId
        ? Number((userRow as any).propertyId)
        : null,
      propertyIds,
      isSystemAdmin,
      cachedAt: now,
    };

    userMemoryCache.set(userId, cached);
    try {
      const redis = getRedisConnection();
      if (redis) {
        redis.setex(`auth:user:${userId}`, 300, JSON.stringify(cached)).catch(() => {});
      }
    } catch {}
  }

  if (cached.status === "inactive" || cached.status === "locked") {
    userMemoryCache.delete(userId);
    req.session.destroy(() => {});
    res.status(403).json({ error: "Account disabled or locked" });
    return null;
  }

  const roles = cached.roles;
  const propertyIds = cached.propertyIds;
  const isSystemAdmin = cached.isSystemAdmin;

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
  session.username = cached.username;
  session.userRole = roles[0] ?? null;

  const authUser: AuthUser = {
    id: cached.id,
    propertyId: cached.propertyId,
    propertyIds,
    username: cached.username,
    roles,
    permissions: cached.permissions,
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

export function requireAnyPermission(
  ...checks: [PermissionModule, PermissionAction][]
): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await loadAuthUser(req, res);
      if (!user) return;

      const allowed = checks.some(([module, action]) =>
        hasPermission(user, module, action),
      );

      if (!allowed) {
        res.status(403).json({
          error: `Permission denied. Requires one of: ${checks
            .map(([m, a]) => `${m}.${a}`)
            .join(", ")}`,
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

export function requireSuperAdmin(): RequestHandler {
  return async (req, res, next) => {
    try {
      const user = await loadAuthUser(req, res);
      if (!user) return;

      const isSuper =
        Boolean(user.isSystemAdmin) ||
        user.roles.some((r) =>
          ["super_admin", "system_admin"].includes(String(r).toLowerCase()),
        );

      if (!isSuper) {
        res.status(403).json({
          error: "This operation is strictly restricted to System Super Admin only",
          code: "SUPER_ADMIN_REQUIRED",
        });
        return;
      }

      next();
    } catch (err) {
      next(err);
    }
  };
}

