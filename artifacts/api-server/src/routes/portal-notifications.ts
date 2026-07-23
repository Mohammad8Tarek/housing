/**
 * portal-notifications.ts — Full DB-backed implementation
 * Tables: portal_notifications, portal_notification_reads
 */
import { Router } from "express";
import { withTenant, portalNotificationsTable, portalNotificationReadsTable } from "@workspace/db";
import { eq, and, desc, or, isNull, gt, inArray, sql } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { requirePortalAuth, portalSession } from "./portal-auth.js";
import { logActivity } from "../lib/activity-logger.js";

const router: Router = Router();

function getTenantId(req: any): number {
  return Number(req.query?.propertyId) || Number(req.body?.propertyId) || Number((req.session as any)?.propertyId) || 0;
}

function su(req: any) {
  return {
    username: (req.session as any)?.username ?? "system",
    userId: (req.session as any)?.userId,
    userRole: (req.session as any)?.userRole,
  };
}

const NotificationSchema = z.object({
  title:      z.string().min(1),
  titleAr:    z.string().optional(),
  message:    z.string().min(1),
  messageAr:  z.string().optional(),
  type:       z.enum(["activity", "evaluation", "document", "announcement"]).default("announcement"),
  priority:   z.enum(["low", "medium", "high"]).default("medium"),
  targetAll:  z.boolean().default(true),
  department: z.string().optional(),
  expiresAt:  z.string().optional(),
});

// ─── PORTAL (employee-facing) routes ──────────────────────────────────────

// GET /portal-notifications/my — إشعارات الموظف الحالي
// @ts-ignore
router.get("/my", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;

    const notifications = await withTenant(sess.propertyId, async (tenantDb) => {
      // Get all active notifications for this property/department
      const now = new Date();
      const rows = await tenantDb
        .select()
        .from(portalNotificationsTable)
        .where(
          and(
            eq(portalNotificationsTable.propertyId, sess.propertyId),
            or(
              isNull(portalNotificationsTable.expiresAt),
              gt(portalNotificationsTable.expiresAt, now)
            ),
            or(
              eq(portalNotificationsTable.targetAll, true),
              isNull(portalNotificationsTable.department)
            )
          )
        )
        .orderBy(desc(portalNotificationsTable.createdAt))
        .limit(50);

      if (rows.length === 0) return [];

      // Get read receipts for this employee
      const notifIds = rows.map(n => n.id);
      const reads = await tenantDb
        .select({ notificationId: portalNotificationReadsTable.notificationId })
        .from(portalNotificationReadsTable)
        .where(
          and(
            eq(portalNotificationReadsTable.employeeId, sess.employeeDbId),
            inArray(portalNotificationReadsTable.notificationId, notifIds)
          )
        );

      const readSet = new Set(reads.map(r => r.notificationId));

      return rows.map(n => ({
        ...n,
        isRead: readSet.has(n.id),
      }));
    });

    const unreadCount = notifications.filter((n: any) => !n.isRead).length;
    res.json({ success: true, notifications, unreadCount });
  } catch (err) { next(err); }
});

// PUT /portal-notifications/read/:id — تحديد إشعار كمقروء
// @ts-ignore
router.put("/read/:id", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const notifId = Number(req.params.id);

    await withTenant(sess.propertyId, async (tenantDb) => {
      // Upsert read receipt
      await tenantDb.execute(sql`
        INSERT INTO portal_notification_reads (notification_id, employee_id)
        VALUES (${notifId}, ${sess.employeeDbId})
        ON CONFLICT (notification_id, employee_id) DO NOTHING
      `);
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// PUT /portal-notifications/read-all — تحديد كل الإشعارات كمقروءة
// @ts-ignore
router.put("/read-all", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;

    await withTenant(sess.propertyId, async (tenantDb) => {
      const rows = await tenantDb
        .select({ id: portalNotificationsTable.id })
        .from(portalNotificationsTable)
        .where(eq(portalNotificationsTable.propertyId, sess.propertyId));

      for (const row of rows) {
        await tenantDb.execute(sql`
          INSERT INTO portal_notification_reads (notification_id, employee_id)
          VALUES (${row.id}, ${sess.employeeDbId})
          ON CONFLICT (notification_id, employee_id) DO NOTHING
        `);
      }
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// ─── ADMIN routes (create / list / delete) ─────────────────────────────────

// GET / — قائمة الإشعارات للأدمن
// @ts-ignore
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) return res.status(400).json({ success: false, message: "propertyId required" });

    const notifications = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(portalNotificationsTable)
        .where(eq(portalNotificationsTable.propertyId, propertyId))
        .orderBy(desc(portalNotificationsTable.createdAt));
    });

    res.json({ success: true, notifications });
  } catch (err) { next(err); }
});

// POST / — إنشاء إشعار جديد (أدمن)
// @ts-ignore
router.post("/", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const userId = (req.session as any)?.userId;
    if (!propertyId || !userId) return res.status(400).json({ success: false, message: "Missing required fields" });

    const validated = NotificationSchema.parse(req.body);

    const [notification] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb.insert(portalNotificationsTable).values({
        propertyId,
        title:      validated.title,
        titleAr:    validated.titleAr ?? null,
        message:    validated.message,
        messageAr:  validated.messageAr ?? null,
        type:       validated.type,
        priority:   validated.priority,
        targetAll:  validated.targetAll,
        department: validated.department ?? null,
        createdBy:  userId,
        expiresAt:  validated.expiresAt ? new Date(validated.expiresAt) : null,
      }).returning();
    });

    await broadcastToProperty(propertyId, {
      type: "notification",
      module: "notifications",
      action: "created",
      data: { notification },
    });
    const s = su(req);
    await logActivity({ req, propertyId, username: s.username, userId: s.userId, userRole: s.userRole, action: `إنشاء إشعار: ${validated.title}`, actionType: "CREATE", module: "portal_notifications" });

    res.json({ success: true, notification });
  } catch (err) { next(err); }
});

// DELETE /:id — حذف إشعار
// @ts-ignore
router.delete("/:id", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const userId = (req.session as any)?.userId;
    const id = Number(req.params.id);
    if (!propertyId || !userId || !id) return res.status(400).json({ success: false, message: "Missing required fields" });

    await withTenant(propertyId, async (tenantDb) => {
      // Delete reads first
      await tenantDb.delete(portalNotificationReadsTable)
        .where(eq(portalNotificationReadsTable.notificationId, id));
      // Delete notification
      await tenantDb.delete(portalNotificationsTable)
        .where(and(eq(portalNotificationsTable.id, id), eq(portalNotificationsTable.propertyId, propertyId)));
    });

    res.json({ success: true });
  } catch (err) { next(err); }
});

// GET /stats — إحصائيات الإشعارات
// @ts-ignore
router.get("/stats", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) return res.status(400).json({ success: false, message: "propertyId required" });

    const stats = await withTenant(propertyId, async (tenantDb) => {
      const all = await tenantDb
        .select()
        .from(portalNotificationsTable)
        .where(eq(portalNotificationsTable.propertyId, propertyId));

      const byType: Record<string, number> = { activity: 0, evaluation: 0, document: 0, announcement: 0 };
      const byPriority: Record<string, number> = { low: 0, medium: 0, high: 0 };

      for (const n of all) {
        byType[n.type] = (byType[n.type] || 0) + 1;
        byPriority[n.priority] = (byPriority[n.priority] || 0) + 1;
      }

      return { total: all.length, byType, byPriority };
    });

    res.json(stats);
  } catch (err) { next(err); }
});

export default router;
