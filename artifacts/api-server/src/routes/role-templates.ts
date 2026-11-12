// Role templates: named permission sets stored in the database.
// - A user can be linked to a template; the template's permissions become the
//   user's permissions, and editing the template updates every linked user.
// - Editing a user's permissions by hand unlinks them (see users.ts), so a
//   later template change never overwrites individual adjustments.
// - Existing users start unlinked: nobody's access changes until an admin
//   links them.
import { Router } from "express";
import { z } from "zod";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { db, roleTemplatesTable, usersTable } from "@workspace/db";
import {
  ROLE_DEFAULT_PERMISSIONS,
  PERMISSION_MODULES,
  MODULE_ACTIONS,
  hasPermission,
  requirePermission,
} from "../middlewares/permissions.js";
import { validate } from "../middlewares/validate.js";
import { IdParams } from "../validation/schemas.js";
import { canActOnUser, isRootUser } from "../lib/user-access.js";
import { logActivity } from "../lib/activity-logger.js";

const router: Router = Router();

/** Templates every installation starts with (server role defaults). */
const SYSTEM_TEMPLATES: Array<{ key: string; nameAr: string; nameEn: string }> =
  [
    { key: "admin", nameAr: "مدير النظام (فندق)", nameEn: "Property Admin" },
    { key: "manager", nameAr: "مدير السكن", nameEn: "Housing Manager" },
    { key: "receptionist", nameAr: "موظف استقبال", nameEn: "Receptionist" },
    {
      key: "maintenance_staff",
      nameAr: "فني صيانة",
      nameEn: "Maintenance Staff",
    },
    {
      key: "housekeeping_staff",
      nameAr: "موظف نظافة",
      nameEn: "Housekeeping Staff",
    },
    { key: "hr_admin", nameAr: "الموارد البشرية", nameEn: "HR Admin" },
    { key: "portal_admin", nameAr: "مدير البوابة", nameEn: "Portal Admin" },
    { key: "security_staff", nameAr: "أمن البوابة", nameEn: "Security Staff" },
  ];

/** Every permission key the system knows ("module.action"). */
const KNOWN_PERMISSIONS = new Set(
  PERMISSION_MODULES.flatMap((m) =>
    (MODULE_ACTIONS[m] ?? []).map((a) => `${m}.${a}`),
  ),
);

const clean = (perms: string[]) =>
  [
    ...new Set(
      perms.map((p) => p.trim()).filter((p) => KNOWN_PERMISSIONS.has(p)),
    ),
  ].sort();

/** Read templates, seeding the system ones on first use. */
export async function listTemplates() {
  const rows = await db
    .select()
    .from(roleTemplatesTable)
    .orderBy(asc(roleTemplatesTable.id));
  const have = new Set(rows.map((r) => r.key));
  const missing = SYSTEM_TEMPLATES.filter((t) => !have.has(t.key));
  if (missing.length === 0) return rows;
  await db
    .insert(roleTemplatesTable)
    .values(
      missing.map((t) => ({
        ...t,
        permissions: clean(ROLE_DEFAULT_PERMISSIONS[t.key] ?? []),
        isSystem: true,
      })),
    )
    .onConflictDoNothing();
  return db
    .select()
    .from(roleTemplatesTable)
    .orderBy(asc(roleTemplatesTable.id));
}

const diff = (from: string[], to: string[]) => {
  const a = new Set(from);
  const b = new Set(to);
  return {
    added: [...b].filter((p) => !a.has(p)).sort(),
    removed: [...a].filter((p) => !b.has(p)).sort(),
  };
};

// GET /role-templates — templates with how many users are linked to each
router.get(
  "/role-templates",
  requirePermission("users", "view"),
  async (_req, res, next) => {
    try {
      const rows = await listTemplates();
      const counts = await db
        .select({
          id: usersTable.roleTemplateId,
          n: sql<number>`count(*)::int`,
        })
        .from(usersTable)
        .where(
          inArray(usersTable.roleTemplateId, rows.map((r) => r.id).concat(-1)),
        )
        .groupBy(usersTable.roleTemplateId);
      const byId = new Map(counts.map((c) => [c.id, Number(c.n)]));
      res.json({
        success: true,
        data: rows.map((r) => ({ ...r, linkedUsers: byId.get(r.id) ?? 0 })),
      });
    } catch (err) {
      next(err);
    }
  },
);

const TemplateBody = z.object({
  nameAr: z.string().trim().min(1).max(100),
  nameEn: z.string().trim().min(1).max(100),
  permissions: z.array(z.string().max(80)).max(500),
});

// POST /role-templates — custom template (system admins only)
router.post(
  "/role-templates",
  requirePermission("users", "manage_permissions"),
  validate({ body: TemplateBody }),
  async (req, res, next) => {
    try {
      const actor = (req as any).authUser;
      if (!isRootUser(actor)) {
        res.status(403).json({
          error: "قوالب الأدوار يديرها مدير النظام فقط",
          errorEn: "Only system admins manage role templates",
        });
        return;
      }
      const key = `custom_${Date.now().toString(36)}`;
      const [row] = await db
        .insert(roleTemplatesTable)
        .values({
          key,
          nameAr: req.body.nameAr,
          nameEn: req.body.nameEn,
          permissions: clean(req.body.permissions),
          isSystem: false,
        })
        .returning();
      res.status(201).json({ success: true, data: { ...row, linkedUsers: 0 } });
    } catch (err) {
      next(err);
    }
  },
);

// PUT /role-templates/:id — edit a template and update every linked user
router.put(
  "/role-templates/:id",
  requirePermission("users", "manage_permissions"),
  validate({ params: IdParams, body: TemplateBody }),
  async (req, res, next) => {
    try {
      const actor = (req as any).authUser;
      if (!isRootUser(actor)) {
        res.status(403).json({
          error: "قوالب الأدوار يديرها مدير النظام فقط",
          errorEn: "Only system admins manage role templates",
        });
        return;
      }
      const id = Number(req.params.id);
      const permissions = clean(req.body.permissions);
      const result = await db.transaction(async (tx) => {
        const [before] = await tx
          .select()
          .from(roleTemplatesTable)
          .where(eq(roleTemplatesTable.id, id))
          .limit(1);
        if (!before) return null;
        const [row] = await tx
          .update(roleTemplatesTable)
          .set({
            nameAr: req.body.nameAr,
            nameEn: req.body.nameEn,
            permissions,
            updatedAt: new Date(),
          })
          .where(eq(roleTemplatesTable.id, id))
          .returning();
        const linked = await tx
          .update(usersTable)
          .set({ permissions, updatedAt: new Date() } as any)
          .where(eq(usersTable.roleTemplateId, id))
          .returning({ id: usersTable.id });
        return { row, before, linkedUsers: linked.length };
      });
      if (!result) {
        res.status(404).json({ error: "Template not found" });
        return;
      }
      const change = diff(result.before.permissions ?? [], permissions);
      await logActivity({
        req,
        propertyId: 0,
        username: actor.username,
        userId: actor.id,
        userRole: actor.roles?.[0] ?? "admin",
        action: `تعديل قالب الدور "${result.row.nameAr}" وتحديث ${result.linkedUsers} مستخدم`,
        actionType: "UPDATE",
        module: "users",
        entityType: "role_template",
        entityId: id,
        details: { ...change, linkedUsers: result.linkedUsers },
      });
      res.json({
        success: true,
        data: { ...result.row, linkedUsers: result.linkedUsers },
        updatedUsers: result.linkedUsers,
        ...change,
      });
    } catch (err) {
      next(err);
    }
  },
);

const LinkBody = z.object({
  templateId: z.number().int().positive().nullable(),
  // true: only report what would change
  preview: z.boolean().optional(),
});

// POST /users/:id/role-template — link a user to a template (or unlink)
router.post(
  "/users/:id/role-template",
  requirePermission("users", "manage_permissions"),
  validate({ params: IdParams, body: LinkBody }),
  async (req, res, next) => {
    try {
      const actor = (req as any).authUser;
      const [target] = await db
        .select()
        .from(usersTable)
        .where(eq(usersTable.id, Number(req.params.id)))
        .limit(1);
      if (!target || !canActOnUser(actor, target, "manage")) {
        res.status(404).json({ error: "User not found" });
        return;
      }
      const { templateId, preview } = req.body;

      if (templateId === null) {
        if (!preview) {
          await db
            .update(usersTable)
            .set({ roleTemplateId: null } as any)
            .where(eq(usersTable.id, target.id));
        }
        res.json({ success: true, linked: null, added: [], removed: [] });
        return;
      }

      const [tpl] = await db
        .select()
        .from(roleTemplatesTable)
        .where(eq(roleTemplatesTable.id, templateId))
        .limit(1);
      if (!tpl) {
        res.status(404).json({ error: "Template not found" });
        return;
      }
      // No privilege escalation: a non-root actor can only hand out
      // permissions they hold themselves.
      if (!isRootUser(actor)) {
        const notHeld = (tpl.permissions ?? []).filter((p) => {
          const [m, a] = p.split(".");
          return !hasPermission(actor, m as any, a as any);
        });
        if (notHeld.length > 0) {
          res.status(403).json({
            error: "لا يمكنك منح صلاحيات لا تملكها",
            errorEn: "You cannot grant permissions you do not have",
            notHeld,
          });
          return;
        }
      }
      const change = diff(target.permissions ?? [], tpl.permissions ?? []);
      if (!preview) {
        await db
          .update(usersTable)
          .set({
            permissions: tpl.permissions ?? [],
            roleTemplateId: tpl.id,
            updatedAt: new Date(),
          } as any)
          .where(eq(usersTable.id, target.id));
        await logActivity({
          req,
          propertyId: target.propertyId ?? 0,
          username: actor.username,
          userId: actor.id,
          userRole: actor.roles?.[0] ?? "admin",
          action: `ربط المستخدم '${target.username}' بقالب "${tpl.nameAr}"`,
          actionType: "UPDATE",
          module: "users",
          entityType: "user",
          entityId: target.id,
          details: change,
        });
      }
      res.json({ success: true, linked: preview ? null : tpl.id, ...change });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
