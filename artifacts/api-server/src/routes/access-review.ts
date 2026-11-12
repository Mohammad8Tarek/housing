// Access review: what each user can actually do.
// GET /users/access-review returns, for the users the requester may see, the
// permissions the server will really grant them (system admins: everything),
// optionally filtered to holders of one permission ("who can delete tickets?").
// Mounted before the users router so "/users/access-review" is not read as
// "/users/:id".
import { Router } from "express";
import { z } from "zod";
import { asc, inArray } from "drizzle-orm";
import { db, roleTemplatesTable, usersTable } from "@workspace/db";
import { requirePermission } from "../middlewares/permissions.js";
import { ALL_PERMISSIONS, grantedPermissions } from "../lib/access-review.js";
import { validate } from "../middlewares/validate.js";
import { AccessReviewQuery } from "../validation/schemas.js";
import { canActOnUser, isRootUser } from "../lib/user-access.js";

const router: Router = Router();

const KNOWN = new Set(ALL_PERMISSIONS);

type UserRow = {
  id: number;
  username: string;
  email: string | null;
  department: string | null;
  jobTitle: string | null;
  roles: string[];
  permissions: string[];
  roleTemplateId: number | null;
  status: string;
  propertyId: number | null;
  propertyIds: number[];
  lockedUntil: Date | null;
};

const isActive = (u: UserRow) =>
  String(u.status ?? "active").toLowerCase() === "active" &&
  !(u.lockedUntil && u.lockedUntil.getTime() > Date.now());

router.get(
  "/users/access-review",
  requirePermission("users", "view"),
  validate({ query: AccessReviewQuery }),
  async (req, res, next) => {
    try {
      const actor = (req as any).authUser;
      const q = req.query as z.infer<typeof AccessReviewQuery>;
      const page = Math.max(1, Number(q.page) || 1);
      const limit = Math.min(100, Math.max(1, Number(q.limit) || 20));
      const search = (q.search ?? "").toLowerCase();
      const status = q.status ?? "all";
      if (q.permission && !KNOWN.has(q.permission)) {
        res.status(400).json({
          error: "صلاحية غير معروفة",
          errorEn: "Unknown permission",
        });
        return;
      }

      const rows = (await db
        .select({
          id: usersTable.id,
          username: usersTable.username,
          email: usersTable.email,
          department: usersTable.department,
          jobTitle: usersTable.jobTitle,
          roles: usersTable.roles,
          permissions: usersTable.permissions,
          roleTemplateId: usersTable.roleTemplateId,
          status: usersTable.status,
          propertyId: usersTable.propertyId,
          propertyIds: usersTable.propertyIds,
          lockedUntil: usersTable.lockedUntil,
        })
        .from(usersTable)
        .orderBy(asc(usersTable.username))) as UserRow[];

      // Users this requester may see, with what the server grants each one.
      const visible = rows
        .filter((u) => canActOnUser(actor, u, "view"))
        .filter((u) => !isRootUser(u) || isRootUser(actor))
        .map((u) => ({ u, ...grantedPermissions(u) }));

      const statusFiltered = visible.filter(({ u }) =>
        status === "all"
          ? true
          : status === "active"
            ? isActive(u)
            : !isActive(u),
      );

      // How many (status-filtered) users hold each permission, for the picker.
      const permissionCounts: Record<string, number> = {};
      for (const p of ALL_PERMISSIONS) permissionCounts[p] = 0;
      for (const v of statusFiltered) {
        for (const p of v.granted) permissionCounts[p]++;
      }

      const filtered = statusFiltered.filter(({ u, granted }) => {
        if (q.permission && !granted.includes(q.permission)) return false;
        if (!search) return true;
        return [u.username, u.email, u.department, u.jobTitle]
          .filter(Boolean)
          .some((s) => String(s).toLowerCase().includes(search));
      });

      const total = filtered.length;
      const pageRows = filtered.slice((page - 1) * limit, page * limit);

      const templateIds = [
        ...new Set(
          pageRows
            .map((v) => v.u.roleTemplateId)
            .filter((id): id is number => id != null),
        ),
      ];
      const templates = templateIds.length
        ? await db
            .select({
              id: roleTemplatesTable.id,
              nameAr: roleTemplatesTable.nameAr,
              nameEn: roleTemplatesTable.nameEn,
            })
            .from(roleTemplatesTable)
            .where(inArray(roleTemplatesTable.id, templateIds))
        : [];
      const templateById = new Map(templates.map((t) => [t.id, t]));

      res.json({
        success: true,
        data: pageRows.map(({ u, root, granted }) => ({
          id: u.id,
          username: u.username,
          email: u.email,
          department: u.department,
          jobTitle: u.jobTitle,
          roles: u.roles ?? [],
          active: isActive(u),
          status: u.status,
          isRoot: root,
          template: u.roleTemplateId
            ? (templateById.get(u.roleTemplateId) ?? null)
            : null,
          permissions: granted,
        })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.max(1, Math.ceil(total / limit)),
        },
        totalUsers: statusFiltered.length,
        totalPermissions: ALL_PERMISSIONS.length,
        permissionCounts,
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
