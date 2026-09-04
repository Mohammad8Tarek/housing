import { Router } from "express";
import { db, maintenanceTable, roomsTable, withTenant } from "@workspace/db";
import { eq, and, or, ilike, sql, SQL, desc } from "drizzle-orm";
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

      let page = 1;
      let limit = 1000;
      let search = "";
      if (req.query.page) page = parseInt(req.query.page as string) || 1;
      if (req.query.limit) limit = parseInt(req.query.limit as string) || 10;
      if (req.query.search) search = req.query.search as string;

      const q = ListMaintenanceQueryParams.safeParse(req.query);
      const conditions: SQL[] = [];
      if (q.success) {
        if (q.data.status && q.data.status !== "all")
          conditions.push(eq(maintenanceTable.status, q.data.status));
        if (q.data.priority)
          conditions.push(eq(maintenanceTable.priority, q.data.priority));
      }

      if (search) {
        conditions.push(
          or(
            ilike(maintenanceTable.description, `%${search}%`),
            ilike(maintenanceTable.problemType, `%${search}%`)
          )!
        );
      }

      const offset = (page - 1) * limit;

      const result = await withTenant(propertyId, async (tenantDb) => {
        const whereClause = conditions.length ? and(...conditions) : undefined;
        
        const [countResult] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(maintenanceTable)
          .where(whereClause);
          
        const rows = await tenantDb
          .select()
          .from(maintenanceTable)
          .where(whereClause)
          .orderBy(desc(maintenanceTable.reportedAt), desc(maintenanceTable.id))
          .limit(limit)
          .offset(offset);
          
        return { total: Number(countResult.count), rows };
      });

      res.json({
        data: result.rows.map(fmt),
        pagination: { total: result.total, page, limit }
      });
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

      const parentId = req.body.parentId ? parseInt(String(req.body.parentId)) : null;

      const [record] = await withTenant(propertyId, async (tenantDb) => {
        const inserted = await tenantDb
          .insert(maintenanceTable)
          .values({
            ...parsed.data,
            ...(parentId ? { parentId } : {}),
            status: "open",
          } as any)
          .returning();
          
        if (inserted[0]?.roomId) {
          await tenantDb
            .update(roomsTable)
            .set({ status: "out_of_service" })
            .where(eq(roomsTable.id, inserted[0].roomId));
        }
        
        return inserted;
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
      broadcastToProperty(propertyId, { module: "rooms", action: "sync" });

      return res.status(201).json(fmt(record));
    } catch (err) {
      return next(err);
    }
  },
);

// 3. تحديث بلاغ موجود
router.patch(
  "/maintenance/:id",
  requirePermission("maintenance", "edit"),
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
        const result = await tenantDb
          .update(maintenanceTable)
          .set(req.body as any)
          .where(eq(maintenanceTable.id, p.data.id))
          .returning();
          
        if (result[0]?.roomId && req.body.status) {
           const newStatus = req.body.status;
           if (newStatus === "resolved" || newStatus === "closed") {
             const [openTickets] = await tenantDb
               .select({ count: sql<number>`count(*)` })
               .from(maintenanceTable)
               .where(and(
                  eq(maintenanceTable.roomId, result[0].roomId),
                  or(eq(maintenanceTable.status, "open"), eq(maintenanceTable.status, "in_progress"))
               ));
               
             if (Number(openTickets?.count || 0) === 0) {
                // Determine if occupied to set to occupied_dirty or dirty
                const roomData = await tenantDb
                  .select({ currentOccupancy: roomsTable.currentOccupancy })
                  .from(roomsTable)
                  .where(eq(roomsTable.id, result[0].roomId))
                  .limit(1);
                  
                const isOccupied = (roomData[0]?.currentOccupancy || 0) > 0;
                await tenantDb
                  .update(roomsTable)
                  .set({ status: isOccupied ? "occupied_dirty" : "dirty" })
                  .where(eq(roomsTable.id, result[0].roomId));
             }
           } else if (newStatus === "open" || newStatus === "in_progress") {
             await tenantDb
               .update(roomsTable)
               .set({ status: "out_of_service" })
               .where(eq(roomsTable.id, result[0].roomId));
           }
        }
        
        return result;
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
      broadcastToProperty(propertyId, { module: "rooms", action: "sync" });

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

// 5. جلب التذاكر الفرعية لبلاغ صيانة
router.get(
  "/maintenance/:id/sub-tickets",
  requirePermission("maintenance", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const parentId = parseInt(String(req.params.id));
      if (isNaN(parentId)) {
        res.status(400).json({ error: "Invalid id" });
        return;
      }

      const subTickets = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select()
          .from(maintenanceTable)
          .where(eq(maintenanceTable.parentId, parentId))
          .orderBy(desc(maintenanceTable.reportedAt), desc(maintenanceTable.id));
      });

      return res.json(subTickets.map(fmt));
    } catch (err) {
      return next(err);
    }
  },
);

// 6. إضافة تذكرة فرعية لبلاغ صيانة
router.post(
  "/maintenance/:id/sub-tickets",
  requirePermission("maintenance", "create"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const parentId = parseInt(String(req.params.id));
      if (!propertyId || isNaN(parentId)) {
        res.status(400).json({ error: "Invalid request" });
        return;
      }

      const { problemType, description, priority, roomId } = req.body;
      const [record] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .insert(maintenanceTable)
          .values({
            roomId: roomId || 0,
            problemType: problemType || "General",
            description: description || "",
            priority: priority || "medium",
            parentId,
            status: "open",
          } as any)
          .returning();
      });

      broadcastToProperty(propertyId, { module: "maintenance", action: "sync" });
      return res.status(201).json(fmt(record));
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
