import { Router } from "express";
import { withTenant, maintenanceTable, employeesTable } from "@workspace/db";
import { eq, and, SQL, sql } from "drizzle-orm";
import {
  UpdateMaintenanceParams,
  DeleteMaintenanceParams,
  ListMaintenanceQueryParams,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requirePermission } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";

const router: Router = Router();

function fmt(r: any) {
  if (!r) return null;
  const safeISO = (val: any) => {
    if (!val) return null;
    if (val instanceof Date)
      return typeof val.toISOString === "function"
        ? val.toISOString()
        : String(val);
    if (typeof val === "string") return val;
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

async function fetchAssignedEmployees(
  tenantDb: any,
  rows: any[],
): Promise<Map<number, { id: number; firstName: string; lastName: string }>> {
  const empIds = rows.filter((r) => r.assignedTo).map((r) => r.assignedTo);
  if (empIds.length === 0) return new Map();
  const uniqueIds = [...new Set(empIds)];
  const emps = await tenantDb
    .select({
      id: employeesTable.id,
      firstName: employeesTable.firstName,
      lastName: employeesTable.lastName,
    })
    .from(employeesTable)
    .where(and(...uniqueIds.map((id) => eq(employeesTable.id, id))));
  const map = new Map<number, any>();
  emps.forEach((e: any) => map.set(e.id, e));
  return map;
}

async function attachAssignee(tenantDb: any, rows: any[]) {
  const empMap = await fetchAssignedEmployees(tenantDb, rows);
  return rows.map((r) => ({
    ...r,
    assignedToName:
      r.assignedTo && empMap.has(r.assignedTo)
        ? `${empMap.get(r.assignedTo)!.firstName} ${empMap.get(r.assignedTo)!.lastName}`
        : null,
  }));
}

const VALID_CATEGORIES = ["maintenance", "housekeeping", "general"];

// @ts-ignore
router.get(
  "/maintenance",
  requirePermission("maintenance", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId is required" });

      const q = ListMaintenanceQueryParams.safeParse(req.query);
      const conditions: SQL[] = [];
      const page = Math.max(1, parseInt(req.query.page as string) || 1);
      const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string) || 25));
      const offset = (page - 1) * limit;

      if (q.success) {
        if (q.data.status)
          conditions.push(eq(maintenanceTable.status, q.data.status));
        if (q.data.priority)
          conditions.push(eq(maintenanceTable.priority, q.data.priority));
      }
      if (
        req.query.category &&
        VALID_CATEGORIES.includes(req.query.category as string)
      ) {
        conditions.push(
          eq(maintenanceTable.category, req.query.category as string),
        );
      }
      if (req.query.assignedTo) {
        conditions.push(
          eq(maintenanceTable.assignedTo, Number(req.query.assignedTo)),
        );
      }

      const { data, total } = await withTenant(propertyId, async (tenantDb) => {
        let countQuery = tenantDb.select({ count: sql<number>`count(*)` }).from(maintenanceTable) as any;
        if (conditions.length > 0) countQuery = countQuery.where(and(...conditions));
        const countResult = await countQuery;
        const totalCount = Number(countResult[0]?.count ?? 0);

        let baseQuery = tenantDb.select().from(maintenanceTable).limit(limit).offset(offset) as any;
        if (conditions.length > 0) baseQuery = baseQuery.where(and(...conditions));
        
        const result = await baseQuery;
        const withAssignees = await attachAssignee(tenantDb, result);
        return { data: withAssignees, total: totalCount };
      });

      return res.json({
        data: data.map((r) => fmt({ ...r, propertyId })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1
        }
      });
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.post(
  "/maintenance",
  requirePermission("maintenance", "create"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId is required" });

      const { assignedTo, propertyId: _pid, ...safeBody } = req.body;
      if (!safeBody.roomId || !safeBody.problemType) {
        return res
          .status(400)
          .json({
            success: false,
            message: "roomId and problemType are required",
          });
      }
      const body = {
        ...safeBody,
        category: safeBody.category || "maintenance",
      };
      if (!VALID_CATEGORIES.includes(body.category)) {
        return res
          .status(400)
          .json({
            success: false,
            message: `Invalid category. Must be one of: ${VALID_CATEGORIES.join(", ")}`,
          });
      }

      const [record] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .insert(maintenanceTable)
          .values({ ...body, status: "open" } as any)
          .returning();
      });

      const s = su(req);
      const action = body.parentId
        ? `تذكرة فرعية (#${body.parentId}): ${record.description}`
        : `بلاغ جديد (${body.category}): ${record.description}`;
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action,
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

      return res.status(201).json({ ...fmt(record), propertyId });
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.get(
  "/maintenance/:id/sub-tickets",
  requirePermission("maintenance", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId is required" });

      const parentId = Number(req.params.id);
      if (!parentId)
        return res.status(400).json({ success: false, message: "id required" });

      const subTickets = await withTenant(propertyId, async (tenantDb) => {
        const result = await tenantDb
          .select()
          .from(maintenanceTable)
          .where(eq(maintenanceTable.parentId, parentId));
        return attachAssignee(tenantDb, result);
      });

      return res.json(subTickets.map((r) => fmt({ ...r, propertyId })));
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.patch(
  "/maintenance/:id",
  requirePermission("maintenance", "edit"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId is required" });

      const p = UpdateMaintenanceParams.safeParse(req.params);
      if (!p.success)
        return res
          .status(400)
          .json({ success: false, message: p.error.message });

      const updateData: Record<string, any> = {};
      const allowed = [
        "status",
        "priority",
        "category",
        "description",
        "problemType",
        "assignedTo",
        "notes",
        "startedAt",
        "resolvedAt",
      ] as const;
      for (const key of allowed) {
        if (req.body[key] !== undefined) updateData[key] = req.body[key];
      }
      if (
        updateData.category &&
        !VALID_CATEGORIES.includes(updateData.category)
      ) {
        return res
          .status(400)
          .json({ success: false, message: `Invalid category` });
      }
      if (Object.keys(updateData).length === 0) {
        return res
          .status(400)
          .json({ success: false, message: "No valid fields to update" });
      }

      if (updateData.status === "in_progress" && !updateData.startedAt) {
        updateData.startedAt = new Date().toISOString();
      }
      if (
        (updateData.status === "resolved" || updateData.status === "closed") &&
        !updateData.resolvedAt
      ) {
        updateData.resolvedAt = new Date().toISOString();
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(maintenanceTable)
          .set(updateData)
          .where(eq(maintenanceTable.id, p.data.id))
          .returning();
      });

      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "البلاغ غير موجود" });

      const s = su(req);
      await logActivity({
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

      const [withName] = await withTenant(propertyId, (tenantDb) =>
        attachAssignee(tenantDb, [updated]),
      );
      return res.json({ ...fmt(withName), propertyId });
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.post(
  "/maintenance/:id/assign",
  requirePermission("maintenance", "edit"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId is required" });

      const id = Number(req.params.id);
      if (!id)
        return res.status(400).json({ success: false, message: "id required" });

      const employeeId = req.body.employeeId
        ? Number(req.body.employeeId)
        : null;

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(maintenanceTable)
          .set({ assignedTo: employeeId } as any)
          .where(eq(maintenanceTable.id, id))
          .returning();
      });

      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "البلاغ غير موجود" });

      const empName = employeeId ? "employee #" + employeeId : "unassigned";
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تعيين بلاغ #${updated.id} -> ${empName}`,
        actionType: "UPDATE",
        module: "maintenance",
        entityType: "maintenance",
        entityId: updated.id,
      });

      broadcastToProperty(propertyId, {
        module: "maintenance",
        action: "sync",
      });

      const [withName] = await withTenant(propertyId, (tenantDb) =>
        attachAssignee(tenantDb, [updated]),
      );
      return res.json({ ...fmt(withName), propertyId });
    } catch (err) {
      return next(err);
    }
  },
);

// @ts-ignore
router.delete(
  "/maintenance/:id",
  requirePermission("maintenance", "delete"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId is required" });
      const p = DeleteMaintenanceParams.safeParse(req.params);
      if (!p.success)
        return res
          .status(400)
          .json({ success: false, message: p.error.message });
      const row = await withTenant(propertyId, async (tenantDb) => {
        const [r] = await tenantDb
          .select()
          .from(maintenanceTable)
          .where(eq(maintenanceTable.id, p.data.id));
        if (r)
          await tenantDb
            .delete(maintenanceTable)
            .where(eq(maintenanceTable.id, p.data.id));
        return r;
      });
      if (!row)
        return res
          .status(404)
          .json({ success: false, message: "البلاغ غير موجود" });
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف بلاغ #${row.id}`,
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
