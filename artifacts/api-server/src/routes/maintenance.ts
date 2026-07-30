import { Router } from "express";
import { db, maintenanceTable, roomsTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";
import {
  CreateMaintenanceBody,
  GetMaintenanceParams, UpdateMaintenanceParams, DeleteMaintenanceParams,
  ListMaintenanceQueryParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";

const router: Router = Router();

async function getPropertyIdForRoom(roomId: number): Promise<number | undefined> {
  const [room] = await db.select({ buildingId: roomsTable.buildingId })
    .from(roomsTable)
    .where(eq(roomsTable.id, roomId))
    .limit(1);

  if (!room?.buildingId) return undefined;

  return room.buildingId;
}

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
 * وظيفة التنسيق دي بتحمي السيرفر من خطأ value.toISOString is not a function
 * لأنها بتفحص القيمة لو null أو غير صالحة قبل التحويل.
 */
function fmt(r: any) {
  if (!r) return null;
  
  const safeISO = (val: any) => {
    if (!val) return null; // لو القيمة null أو undefined لا يتم استدعاء toISOString
    // إذا كانت بالفعل Date object
    if (val instanceof Date) {
      return typeof val.toISOString === 'function' ? val.toISOString() : String(val);
    }
    // إذا كانت string بالفعل، تحقق إذا كانت صيغة ISO
    if (typeof val === 'string') {
      return val; // أرجع كما هي إذا كانت string
    }
    // في حالات أخرى، حاول تحويلها
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
    dueDate: safeISO(r.dueDate), // الحقل ده كان مسبب المشكلة في الـ 500
  };
}

// 1. جلب قائمة البلاغات مع الفلترة
router.get("/maintenance", async (req, res, next) => {
  try {
    const q = ListMaintenanceQueryParams.safeParse(req.query);
    const conditions: SQL[] = [];
    if (q.success) {
      if (q.data.status) conditions.push(eq(maintenanceTable.status, q.data.status));
      if (q.data.priority) conditions.push(eq(maintenanceTable.priority, q.data.priority));
    }
    const rows = await db.select()
      .from(maintenanceTable)
      .where(conditions.length ? and(...conditions) : undefined);
    
    res.json(rows.map(fmt));
  } catch (err) { 
    next(err); 
  }
});

// 2. إنشاء بلاغ صيانة جديد
router.post("/maintenance", async (req, res, next) => {
  try {
    const parsed = CreateMaintenanceBody.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ success: false, message: parsed.error.message });

    const [record] = await db
      .insert(maintenanceTable)
      .values({ ...parsed.data, status: "open" } as any)
      .returning();

    const s = session(req);
    const propertyId = await getPropertyIdForRoom(record.roomId);
    if (propertyId !== undefined) {
      logActivity({
        req, propertyId, username: s.username, userId: s.userId,
        userRole: s.userRole, action: `بلاغ صيانة جديد: ${record.description}`,
        actionType: "CREATE", module: "maintenance", entityType: "maintenance", entityId: record.id
      });

      // تحديث المتصفحات المتصلة فوراً عبر WebSocket
      broadcastToProperty(propertyId, { module: "maintenance", action: "sync" });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
    }

    return res.status(201).json(fmt(record));
  } catch (err) { 
    return next(err); 
  }
});

// 3. تحديث بلاغ موجود (مثل تغيير الحالة لـ resolved)
router.patch("/maintenance/:id", async (req, res, next) => {
  try {
    const p = UpdateMaintenanceParams.safeParse(req.params);
    if (!p.success) return res.status(400).json({ success: false, message: p.error.message });

    const [updated] = await db.update(maintenanceTable)
      .set(req.body as any)
      .where(eq(maintenanceTable.id, p.data.id))
      .returning();

    if (!updated) return res.status(404).json({ success: false, message: "البلاغ غير موجود" });

    const s = session(req);
    const propertyId = await getPropertyIdForRoom(updated.roomId);
    if (propertyId !== undefined) {
      logActivity({
        req, propertyId, username: s.username, userId: s.userId,
        userRole: s.userRole, action: `تحديث بلاغ #${updated.id} -> ${updated.status}`,
        actionType: "UPDATE", module: "maintenance", entityType: "maintenance", entityId: updated.id
      });

      broadcastToProperty(propertyId, { module: "maintenance", action: "sync" });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
    }

    return res.json(fmt(updated));
  } catch (err) { 
    return next(err); 
  }
});

// 4. حذف بلاغ صيانة
router.delete("/maintenance/:id", async (req, res, next) => {
  try {
    const p = DeleteMaintenanceParams.safeParse(req.params);
    if (!p.success) return res.status(400).json({ success: false, message: p.error.message });

    const [row] = await db.select().from(maintenanceTable).where(eq(maintenanceTable.id, p.data.id));
    if (!row) return res.status(404).json({ success: false, message: "البلاغ غير موجود" });

    await db.delete(maintenanceTable).where(eq(maintenanceTable.id, p.data.id));

    const s = session(req);
    const propertyId = await getPropertyIdForRoom(row.roomId);
    if (propertyId !== undefined) {
      logActivity({
        req, propertyId, username: s.username, userId: s.userId,
        userRole: s.userRole, action: `حذف بلاغ صيانة #${row.id}`,
        actionType: "DELETE", module: "maintenance", entityType: "maintenance", entityId: row.id
      });

      broadcastToProperty(propertyId, { module: "maintenance", action: "sync" });
      broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
    }

    return res.sendStatus(204);
  } catch (err) { 
    return next(err); 
  }
});

export default router;