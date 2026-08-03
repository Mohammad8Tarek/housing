import { Router } from "express";
import { db, maintenanceTable, roomsTable, withTenant } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";
import {
  CreateMaintenanceBody,
  GetMaintenanceParams,
  UpdateMaintenanceParams,
  DeleteMaintenanceParams,
  ListMaintenanceQueryParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();

/**
 * استخلاص بيانات الجلسة بأمان للنشاط (Activity Log)
 */
function session(req: any) {
  return {
    username: (req.session as any)?.username ?? "system",
    userId: (req.session as any)?.userId,
    userRole: (req.session as any)?.userRole,
  };
}

/**
 * ✅ Safe Formatter (fmt)
 */
function fmt(r: any) {
  if (!r) return null;

  const safeISO = (val: any) => {
    if (!val) return null;
    if (val instanceof Date) {
      return typeof val.toISOString === "function"
        ? val.toISOString()
        : String(val);
    }
    if (typeof val === "string") {
      return val;
    }
    try {
      const d = new Date(val);
      return isNaN(d.getTime()) ? val : d.toISOString();
    } catch {
      return val;
    }
  };

  return {
    ...r,
    reportedAt: safeISO(r.reportedAt),
    startedAt: safeISO(r.startedAt),
    resolvedAt: safeISO(r.resolvedAt),
    createdAt: safeISO(r.createdAt),
    dueDate: safeISO(r.dueDate),
  };
}

// 1. جلب قائمة البلاغات مع الفلترة
router.get(
  "/maintenance",
  requirePermission("maintenance", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const q = ListMaintenanceQueryParams.safeParse(req.query);
      const conditions: SQL[] = [];
      if (q.success) {
        if (q.data.status)
          conditions.push(eq(maintenanceTable.status, q.data.status));
        if (q.data.priority)
          conditions.push(eq(maintenanceTable.priority, q.data.priority));
      }

      const rows = await withTenant(propertyId, async (tenantDb) => {
        return tenantDb
          .select()
          .from(maintenanceTable)
          .where(conditions.length ? and(...conditions) : undefined);
      });

      res.json(rows.map(fmt));
    } catch (err) {
      next(err);
    }
  },
);

// 2. إنشاء بلاغ صيانة جديد
router.post(
  "/maintenance",
  requirePermission("maintenance", "create"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const parsed = CreateMaintenanceBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ success: false, message: parsed.error.message });
        return;
      }

      const [record] = await withTenant(propertyId, async (tenantDb) => {
        return tenantDb
          .insert(maintenanceTable)
          .values({ ...parsed.data, status: "open" } as any)
          .returning();
      });

      const s = session(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `بلاغ صيانة جديد: ${record.description}`,
        actionType: "CREATE",
        module: "maintenance",
        entityType: "maintenance",
        entityId: record.id,
      });

      broadcastToProperty(propertyId, {
        module: "maintenance",
        action: "sync",
      });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

      return res.status(201).json(fmt(record));
    } catch (err) {
      return next(err);
    }
  },
);

// 3. تحديث بلاغ موجود
router.patch(
  "/maintenance/:id",
  requirePermission("maintenance", "update"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const p = UpdateMaintenanceParams.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ success: false, message: p.error.message });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return tenantDb
          .update(maintenanceTable)
          .set(req.body as any)
          .where(eq(maintenanceTable.id, p.data.id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ success: false, message: "البلاغ غير موجود" });
        return;
      }

      const s = session(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تحديث بلاغ #${updated.id} -> ${updated.status}`,
        actionType: "UPDATE",
        module: "maintenance",
        entityType: "maintenance",
        entityId: updated.id,
      });

      broadcastToProperty(propertyId, {
        module: "maintenance",
        action: "sync",
      });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

      return res.json(fmt(updated));
    } catch (err) {
      return next(err);
    }
  },
);

// 4. حذف بلاغ صيانة
router.delete(
  "/maintenance/:id",
  requirePermission("maintenance", "delete"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const p = DeleteMaintenanceParams.safeParse(req.params);
      if (!p.success) {
        res.status(400).json({ success: false, message: p.error.message });
        return;
      }

      const row = await withTenant(propertyId, async (tenantDb) => {
        const [existing] = await tenantDb
          .select()
          .from(maintenanceTable)
          .where(eq(maintenanceTable.id, p.data.id));
        if (existing) {
          await tenantDb
            .delete(maintenanceTable)
            .where(eq(maintenanceTable.id, p.data.id));
        }
        return existing;
      });

      if (!row) {
        res.status(404).json({ success: false, message: "البلاغ غير موجود" });
        return;
      }

      const s = session(req);
      logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف بلاغ صيانة #${row.id}`,
        actionType: "DELETE",
        module: "maintenance",
        entityType: "maintenance",
        entityId: row.id,
      });

      broadcastToProperty(propertyId, {
        module: "maintenance",
        action: "sync",
      });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

      return res.sendStatus(204);
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
