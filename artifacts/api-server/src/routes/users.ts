import { Router } from "express";
import { db, pool, usersTable } from "@workspace/db";
import { eq, and, SQL, sql } from "drizzle-orm";
import bcrypt from "bcryptjs";
import {
  CreateUserBody,
  UpdateUserBody,
  GetUserParams,
  UpdateUserParams,
  DeleteUserParams,
  ListUsersQueryParams,
  ListUsersResponse,
  GetUserResponse,
  UpdateUserResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { requireAuth } from "../middlewares/permissions.js";
import { requirePermission } from "../middlewares/permissions.js";
import { BCRYPT_ROUNDS } from "../lib/security-constants.js";
import { getPasswordPolicy, validatePassword } from "../lib/password-policy.js";

const router: Router = Router();

// ℹ️  Schema column 'property_ids' is managed via migration (scripts/add-missing-indexes.sql)
//    Do NOT run DDL here — it was removed to prevent startup delays and silent failures.

/** Returns true if the roles array contains a system-admin role */
function isSystemAdminRoles(roles: string[]): boolean {
  return roles.some((role) =>
    ["super_admin", "system_admin", "admin"].includes(
      String(role).trim().toLowerCase(),
    ),
  );
}

function requireUserUpdatePermission(req: any, res: any, next: any): void {
  const guards: any[] = [];
  if (
    Object.prototype.hasOwnProperty.call(req.body ?? {}, "permissions") ||
    Object.prototype.hasOwnProperty.call(req.body ?? {}, "roles")
  ) {
    guards.push(requirePermission("users", "manage_permissions"));
  }
  if (Object.prototype.hasOwnProperty.call(req.body ?? {}, "password")) {
    guards.push(requirePermission("users", "reset_password"));
  }
  if (guards.length === 0) {
    guards.push(requirePermission("users", "edit"));
  }

  let index = 0;
  const run = (err?: any) => {
    if (err) return next(err);
    const guard = guards[index++];
    if (!guard) return next();
    return guard(req, res, run);
  };
  run();
}

// 1. جلب المستخدمين مع دعم كامل للمصفوفة و Server-side Pagination
router.get(
  "/users",
  requirePermission("users", "view"),
  async (req, res): Promise<void> => {
    const isSystemAdmin = (req.session as any)?.isSystemAdmin;
    const sessionPropertyId = (req.session as any)?.propertyId;

    // Server-side pagination params
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      100,
      Math.max(1, parseInt(req.query.limit as string) || 50),
    );
    const offset = (page - 1) * limit;

    let rows: any;
    let totalRows: number;

    if (isSystemAdmin) {
      // Get total count for pagination
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM users`,
      );
      totalRows = parseInt(countResult.rows[0]?.count ?? 0);

      const result = await pool.query(
        `SELECT u.id, u.property_id, u.property_ids, u.username, u.email, u.phone, u.roles, u.permissions, u.status, u.created_at, u.failed_login_attempts, u.locked_until, u.job_title,
                CASE WHEN us.id IS NOT NULL THEN true ELSE false END AS has_signature
         FROM users u
         LEFT JOIN public.user_signatures us ON us.user_id = u.id
         ORDER BY u.id LIMIT $1 OFFSET $2`,
        [limit, offset],
      );
      rows = result.rows;
    } else {
      const countResult = await pool.query(
        `SELECT COUNT(*) as count FROM users
       WHERE property_id = $1
         AND NOT (($2 = ANY(roles)) OR ($3 = ANY(roles)) OR ($4 = ANY(roles)))`,
        [
          Number(sessionPropertyId),
          "super_admin",
          "system_admin",
          "SYSTEM_ADMIN",
        ],
      );
      totalRows = parseInt(countResult.rows[0]?.count ?? 0);

      const result = await pool.query(
        `SELECT u.id, u.property_id, u.property_ids, u.username, u.email, u.phone, u.roles, u.permissions, u.status, u.created_at, u.failed_login_attempts, u.locked_until, u.job_title,
                CASE WHEN us.id IS NOT NULL THEN true ELSE false END AS has_signature
         FROM users u
         LEFT JOIN public.user_signatures us ON us.user_id = u.id
       WHERE u.property_id = $1
         AND NOT (($2 = ANY(u.roles)) OR ($3 = ANY(u.roles)) OR ($4 = ANY(u.roles)))
       ORDER BY u.id LIMIT $5 OFFSET $6`,
        [
          Number(sessionPropertyId),
          "super_admin",
          "system_admin",
          "SYSTEM_ADMIN",
          limit,
          offset,
        ],
      );
      rows = result.rows;
    }

    const actualRows = rows || [];
    const safeUsers = actualRows.map((u: any) => ({
      id: u.id,
      propertyId: u.property_id,
      propertyIds: u.property_ids ?? [],
      username: u.username,
      email: u.email ?? null,
      phone: u.phone ?? null,
      jobTitle: u.job_title ?? null,
      roles: u.roles ?? [],
      permissions: u.permissions ?? [],
      hasSignature: !!u.has_signature,
      status:
        u.locked_until && new Date(u.locked_until) > new Date()
          ? "LOCKED"
          : u.status || "ACTIVE",
      createdAt: u.created_at,
    }));

    // Return paginated response with metadata
    res.json({
      data: safeUsers,
      pagination: {
        page,
        limit,
        total: totalRows,
        totalPages: Math.ceil(totalRows / limit),
      },
    });
  },
);

// 2. إنشاء مستخدم جديد
router.post(
  "/users",
  requirePermission("users", "create"),
  async (req, res): Promise<void> => {
    const parsed = CreateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }
    const { password, propertyIds, ...userData } = parsed.data as any;
    if (
      isSystemAdminRoles(userData.roles ?? []) &&
      !(req.session as any)?.isSystemAdmin
    ) {
      res
        .status(403)
        .json({ error: "Only system admins can create system admins" });
      return;
    }

    // ─── Validate password against policy ─────────────────────────────
    const policy = await getPasswordPolicy(userData.propertyId ?? 0);
    const pwdValidation = validatePassword(password, policy);
    if (!pwdValidation.valid) {
      res.status(400).json({ error: pwdValidation.errors.join("; ") });
      return;
    }

    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
    const pids: number[] =
      propertyIds ?? (userData.propertyId ? [userData.propertyId] : []);

    const [user] = await db.transaction(async (tx) => {
      const [created] = await tx
        .insert(usersTable)
        .values({
          ...userData,
          passwordHash,
          email: userData.email || null,
          phone: userData.phone || null,
          permissions: userData.permissions ?? [],
          propertyIds: pids,
        })
        .returning();

      return [created];
    });

    const actorUsername = (req.session as any)?.username ?? "system";
    await logActivity({
      req,
      propertyId: userData.propertyId ?? pids[0] ?? 0,
      username: actorUsername,
      action: `Created user '${userData.username}'`,
      actionType: "CREATE",
      module: "users",
      severity: "info",
      entityType: "user",
      entityId: user.id,
    });

    const { passwordHash: _, ...safeUser } = user;
    const safeUserAny = safeUser as any;
    res.status(201).json({
      ...safeUser,
      email: safeUserAny.email || null,
      phone: safeUserAny.phone || null,
      propertyIds: pids,
    });
  },
);

// 3. تحديث مستخدم (التعديل الجوهري هنا)
router.patch(
  "/users/:id",
  requireUserUpdatePermission,
  async (req, res): Promise<void> => {
    const params = UpdateUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id))
      .limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const requesterIsSystemAdmin = (req.session as any)?.isSystemAdmin;
    if (isSystemAdminRoles(targetUser.roles ?? []) && !requesterIsSystemAdmin) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    const parsed = UpdateUserBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const { password, propertyIds, ...updateData } = parsed.data as any;

    // تحقق من تغيير اسم المستخدم - يجب أن يكون فريداً
    if (updateData.username && updateData.username !== targetUser.username) {
      const [existingUser] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.username, updateData.username))
        .limit(1);
      if (existingUser) {
        res.status(400).json({ error: "Username already exists" });
        return;
      }
    }

    if (
      updateData.roles &&
      isSystemAdminRoles(updateData.roles) &&
      !requesterIsSystemAdmin
    ) {
      res
        .status(403)
        .json({ error: "Only system admins can grant system-admin roles" });
      return;
    }
    let extraData: any = {};
    if (password) {
      // ─── Validate password against policy ───────────────────────────
      const policy = await getPasswordPolicy(
        updateData.propertyId ?? targetUser.propertyId ?? 0,
      );
      const pwdValidation = validatePassword(password, policy);
      if (!pwdValidation.valid) {
        res.status(400).json({ error: pwdValidation.errors.join("; ") });
        return;
      }
      extraData.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);
      extraData.passwordChangedAt = new Date();
    }

    let updated: any;
    const hasFieldsToUpdate =
      Object.keys(updateData).length > 0 || Object.keys(extraData).length > 0;

    if (hasFieldsToUpdate) {
      const rows = await db
        .update(usersTable)
        .set({ ...updateData, ...extraData })
        .where(eq(usersTable.id, params.data.id))
        .returning();
      updated = rows[0];
    } else {
      updated = { ...targetUser };
    }

    // تحديث الـ Property IDs بشكل صحيح (سواء كانت مصفوفة جديدة أو فارغة)
    if (Array.isArray(propertyIds)) {
      const arrLiteral = `{${propertyIds.join(",")}}`;
      const primaryId =
        propertyIds.length > 0 ? propertyIds[0] : targetUser.propertyId;

      // تنفيذ التحديث مباشرة في الداتا بيز كـ Array
      await pool.query(
        `UPDATE users SET property_ids = $1, property_id = $2 WHERE id = $3`,
        [propertyIds, primaryId, params.data.id],
      );

      // تحديث الكائن الذي سيتم إرساله للفرونت إند ليعكس التغيير فوراً
      updated.property_ids = propertyIds;
      updated.property_id = primaryId;
    }

    // Activity log...
    const actorUsername2 = (req.session as any)?.username ?? "system";
    const oldRoles: string[] = targetUser.roles ?? [];
    const newRoles: string[] = updateData.roles ?? oldRoles;
    const oldPerms: string[] = targetUser.permissions ?? [];
    const newPerms: string[] = updateData.permissions ?? oldPerms;

    const rolesChanged = JSON.stringify(oldRoles) !== JSON.stringify(newRoles);
    const permsChanged = JSON.stringify(oldPerms) !== JSON.stringify(newPerms);

    let actionDetail = `Updated user '${targetUser.username}'`;
    if (rolesChanged)
      actionDetail += ` | Roles: [${oldRoles.join(",")}] → [${newRoles.join(",")}]`;
    if (permsChanged) {
      const added = newPerms.filter((p) => !oldPerms.includes(p));
      const removed = oldPerms.filter((p) => !newPerms.includes(p));
      if (added.length) actionDetail += ` | Perms added: [${added.join(",")}]`;
      if (removed.length)
        actionDetail += ` | Perms removed: [${removed.join(",")}]`;
    }

    await logActivity({
      req,
      propertyId: updated.property_id ?? 0,
      username: actorUsername2,
      action: actionDetail,
      actionType: "UPDATE",
      module: "users",
      severity: rolesChanged || permsChanged ? "warning" : "info",
      entityType: "user",
      entityId: params.data.id,
    });

    // إرجاع البيانات المعدلة مع التأكد من تسمية الحقول كما يتوقعها الفرونت إند
    res.json({
      id: updated.id,
      username: updated.username,
      email: updated.email || null,
      phone: updated.phone || null,
      propertyId: updated.property_id,
      propertyIds: updated.property_ids ?? propertyIds ?? [],
      roles: updated.roles,
      permissions: updated.permissions,
      status: updated.status,
    });
  },
);

// Unlock user account (reset failedLoginAttempts, clear lockedUntil)
router.post(
  "/users/:id/unlock",
  requirePermission("users", "unlock"),
  async (req, res): Promise<void> => {
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid user ID" });
      return;
    }

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, id))
      .limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    if (
      isSystemAdminRoles(targetUser.roles ?? []) &&
      !(req.session as any)?.isSystemAdmin
    ) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    await pool.query(
      `UPDATE users SET failed_login_attempts = 0, locked_until = NULL WHERE id = $1`,
      [id],
    );

    const actorUsername = (req.session as any)?.username ?? "system";
    await logActivity({
      req,
      propertyId: targetUser.propertyId ?? 0,
      username: actorUsername,
      action: `Unlocked user '${targetUser.username}' (was locked)`,
      actionType: "UPDATE",
      module: "users",
      severity: "info",
      entityType: "user",
      entityId: id,
    });

    res.json({
      success: true,
      message: `User '${targetUser.username}' unlocked`,
    });
  },
);

router.delete(
  "/users/:id",
  requirePermission("users", "delete"),
  async (req, res): Promise<void> => {
    const params = DeleteUserParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const [targetUser] = await db
      .select()
      .from(usersTable)
      .where(eq(usersTable.id, params.data.id))
      .limit(1);
    if (!targetUser) {
      res.status(404).json({ error: "User not found" });
      return;
    }

    const requesterIsSystemAdmin = (req.session as any)?.isSystemAdmin;
    if (isSystemAdminRoles(targetUser.roles ?? []) && !requesterIsSystemAdmin) {
      res.status(403).json({ error: "Permission denied" });
      return;
    }

    await db.delete(usersTable).where(eq(usersTable.id, params.data.id));
    res.sendStatus(204);
  },
);

// ─── PATCH /users/me/last-property ──────────────────────────────────────
router.patch(
  "/users/me/last-property",
  requireAuth,
  async (req, res): Promise<void> => {
    const userId = (req.session as any)?.userId;
    if (!userId) {
      res.status(401).json({ error: "Not authenticated" });
      return;
    }

    const { propertyId } = req.body as { propertyId?: number };
    if (propertyId == null || typeof propertyId !== "number") {
      res.status(400).json({ error: "propertyId (number) is required" });
      return;
    }

    await db
      .update(usersTable)
      .set({ lastPropertyId: propertyId } as any)
      .where(eq(usersTable.id, userId));
    res.json({ success: true });
  },
);

export default router;
