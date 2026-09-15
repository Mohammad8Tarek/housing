import { Router, Request, Response } from "express";
import {
  db,
  workersTable,
  maintenanceTable,
  withTenant,
} from "@workspace/db";
import { eq, and, or, ilike, sql, desc, inArray } from "drizzle-orm";
import { logActivity } from "../lib/activity-logger.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();

// ==========================================
// 1. GET /api/workers — جلب قائمة العمال والفنيين
// ==========================================
router.get(
  "/workers",
  requireAnyPermission(
    ["workers", "view"],
    ["maintenance", "view"],
    ["housekeeping", "view"]
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, message: "Property ID is required" });
        return;
      }

      const search = req.query.search ? String(req.query.search).trim() : "";
      const specialty = req.query.specialty ? String(req.query.specialty).trim() : "all";
      const status = req.query.status ? String(req.query.status).trim() : "all";
      const workerType = req.query.workerType ? String(req.query.workerType).trim() : "all";

      let page = 1;
      let limit = 50;
      if (req.query.page) page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
      if (req.query.limit) limit = Math.min(500, Math.max(1, parseInt(req.query.limit as string, 10) || 50));
      const offset = (page - 1) * limit;

      const result = await withTenant(propertyId, async (tenantDb) => {
        const conditions = [];

        if (specialty !== "all" && specialty !== "") {
          conditions.push(eq(workersTable.specialty, specialty));
        }

        if (status !== "all" && status !== "") {
          conditions.push(eq(workersTable.status, status));
        }

        if (workerType !== "all" && workerType !== "") {
          conditions.push(eq(workersTable.workerType, workerType));
        }

        if (search) {
          conditions.push(
            or(
              ilike(workersTable.name, `%${search}%`),
              ilike(workersTable.phone, `%${search}%`),
              ilike(workersTable.nationalId, `%${search}%`),
              ilike(workersTable.companyName, `%${search}%`)
            )
          );
        }

        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        // Total count
        const [countRow] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(workersTable)
          .where(whereClause);

        const total = Number(countRow?.count || 0);

        // Fetch workers
        const rows = await tenantDb
          .select({
            id: workersTable.id,
            name: workersTable.name,
            phone: workersTable.phone,
            nationalId: workersTable.nationalId,
            specialty: workersTable.specialty,
            status: workersTable.status,
            workerType: workersTable.workerType,
            companyName: workersTable.companyName,
            dailyRate: workersTable.dailyRate,
            notes: workersTable.notes,
            profileId: workersTable.profileId,
            createdAt: workersTable.createdAt,
            updatedAt: workersTable.updatedAt,
            // Calculate active and total maintenance tasks
            activeTasksCount: sql<number>`(
              SELECT COUNT(*) FROM maintenance m
              WHERE m.worker_id = workers.id AND m.status IN ('open', 'in_progress')
            )`,
            totalTasksCount: sql<number>`(
              SELECT COUNT(*) FROM maintenance m
              WHERE m.worker_id = workers.id
            )`,
          })
          .from(workersTable)
          .where(whereClause)
          .orderBy(desc(workersTable.createdAt))
          .limit(limit)
          .offset(offset);

        return { rows, total };
      });

      res.json({
        success: true,
        data: result.rows.map(w => ({
          ...w,
          activeTasksCount: Number(w.activeTasksCount || 0),
          totalTasksCount: Number(w.totalTasksCount || 0),
        })),
        pagination: {
          total: result.total,
          page,
          limit,
          totalPages: Math.ceil(result.total / limit),
        },
      });
    } catch (err: any) {
      console.error("[Workers Route] Error listing workers:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to list workers" });
    }
  }
);

// ==========================================
// 2. POST /api/workers — إضافة عامل جديد
// ==========================================
router.post(
  "/workers",
  requireAnyPermission(
    ["workers", "create"],
    ["maintenance", "create"],
    ["housekeeping", "create"],
    ["maintenance", "edit"]
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, message: "Property ID is required" });
        return;
      }

      const {
        name,
        phone,
        nationalId,
        specialty,
        status,
        workerType,
        companyName,
        dailyRate,
        notes,
        profileId,
      } = req.body;

      if (!name || !String(name).trim()) {
        res.status(400).json({ success: false, message: "Worker name is required" });
        return;
      }

      const created = await withTenant(propertyId, async (tenantDb) => {
        const [row] = await tenantDb
          .insert(workersTable)
          .values({
            name: String(name).trim(),
            phone: phone ? String(phone).trim() : "",
            nationalId: nationalId ? String(nationalId).trim() : "",
            specialty: specialty || "general",
            status: status || "available",
            workerType: workerType || "internal",
            companyName: companyName ? String(companyName).trim() : "",
            dailyRate: dailyRate ? Number(dailyRate) : 0,
            notes: notes ? String(notes).trim() : "",
            profileId: profileId ? Number(profileId) : null,
          })
          .returning();
        return row;
      });

      // Log Activity
      const currentUser = su(req);
      await logActivity({
        req,
        propertyId,
        username: currentUser.username,
        userId: currentUser.userId,
        userRole: currentUser.userRole || "admin",
        action: "CREATE",
        module: "workers",
        severity: "info",
        entityType: "worker",
        entityId: created.id,
        details: `Created worker "${created.name}" with specialty "${created.specialty}"`,
      });

      broadcastToProperty(propertyId, "workers", "created", created);

      res.status(201).json({ success: true, data: created });
    } catch (err: any) {
      console.error("[Workers Route] Error creating worker:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to create worker" });
    }
  }
);

// ==========================================
// 3. GET /api/workers/:id — تفاصيل عامل ومهامه
// ==========================================
router.get(
  "/workers/:id",
  requireAnyPermission(
    ["workers", "view"],
    ["maintenance", "view"],
    ["housekeeping", "view"]
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const workerId = parseInt(req.params.id, 10);
      if (!propertyId || isNaN(workerId)) {
        res.status(400).json({ success: false, message: "Valid property ID and worker ID are required" });
        return;
      }

      const result = await withTenant(propertyId, async (tenantDb) => {
        const [worker] = await tenantDb
          .select()
          .from(workersTable)
          .where(eq(workersTable.id, workerId))
          .limit(1);

        if (!worker) return null;

        const tasks = await tenantDb
          .select()
          .from(maintenanceTable)
          .where(eq(maintenanceTable.workerId, workerId))
          .orderBy(desc(maintenanceTable.createdAt))
          .limit(20);

        return { worker, tasks };
      });

      if (!result) {
        res.status(404).json({ success: false, message: "Worker not found" });
        return;
      }

      res.json({ success: true, data: result });
    } catch (err: any) {
      console.error("[Workers Route] Error getting worker:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to get worker" });
    }
  }
);

// ==========================================
// 4. PUT /api/workers/:id — تعديل بيانات العامل
// ==========================================
router.put(
  "/workers/:id",
  requireAnyPermission(
    ["workers", "edit"],
    ["maintenance", "edit"],
    ["housekeeping", "edit"]
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const workerId = parseInt(req.params.id, 10);
      if (!propertyId || isNaN(workerId)) {
        res.status(400).json({ success: false, message: "Valid property ID and worker ID are required" });
        return;
      }

      const updateData: any = {};
      const {
        name,
        phone,
        nationalId,
        specialty,
        status,
        workerType,
        companyName,
        dailyRate,
        notes,
        profileId,
      } = req.body;

      if (name !== undefined) updateData.name = String(name).trim();
      if (phone !== undefined) updateData.phone = String(phone).trim();
      if (nationalId !== undefined) updateData.nationalId = String(nationalId).trim();
      if (specialty !== undefined) updateData.specialty = specialty;
      if (status !== undefined) updateData.status = status;
      if (workerType !== undefined) updateData.workerType = workerType;
      if (companyName !== undefined) updateData.companyName = String(companyName).trim();
      if (dailyRate !== undefined) updateData.dailyRate = Number(dailyRate);
      if (notes !== undefined) updateData.notes = String(notes).trim();
      if (profileId !== undefined) updateData.profileId = profileId ? Number(profileId) : null;
      updateData.updatedAt = new Date();

      const updated = await withTenant(propertyId, async (tenantDb) => {
        const [row] = await tenantDb
          .update(workersTable)
          .set(updateData)
          .where(eq(workersTable.id, workerId))
          .returning();
        return row;
      });

      if (!updated) {
        res.status(404).json({ success: false, message: "Worker not found" });
        return;
      }

      // Log Activity
      const currentUser = su(req);
      await logActivity({
        req,
        propertyId,
        username: currentUser.username,
        userId: currentUser.userId,
        userRole: currentUser.userRole || "admin",
        action: "UPDATE",
        module: "workers",
        severity: "info",
        entityType: "worker",
        entityId: updated.id,
        details: `Updated worker "${updated.name}" (${updated.specialty}, ${updated.status})`,
      });

      broadcastToProperty(propertyId, "workers", "updated", updated);

      res.json({ success: true, data: updated });
    } catch (err: any) {
      console.error("[Workers Route] Error updating worker:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to update worker" });
    }
  }
);

// ==========================================
// 5. DELETE /api/workers/:id — حذف العامل
// ==========================================
router.delete(
  "/workers/:id",
  requireAnyPermission(
    ["workers", "delete"],
    ["maintenance", "delete"],
    ["housekeeping", "delete"]
  ),
  async (req: Request, res: Response): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const workerId = parseInt(req.params.id, 10);
      if (!propertyId || isNaN(workerId)) {
        res.status(400).json({ success: false, message: "Valid property ID and worker ID are required" });
        return;
      }

      const deleted = await withTenant(propertyId, async (tenantDb) => {
        // Check active tasks
        const [activeTasks] = await tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(maintenanceTable)
          .where(
            and(
              eq(maintenanceTable.workerId, workerId),
              inArray(maintenanceTable.status, ["open", "in_progress"])
            )
          );

        if (Number(activeTasks?.count || 0) > 0) {
          throw new Error("Cannot delete worker with active maintenance tasks. Set status to inactive instead.");
        }

        const [row] = await tenantDb
          .delete(workersTable)
          .where(eq(workersTable.id, workerId))
          .returning();
        return row;
      });

      if (!deleted) {
        res.status(404).json({ success: false, message: "Worker not found" });
        return;
      }

      // Log Activity
      const currentUser = su(req);
      await logActivity({
        req,
        propertyId,
        username: currentUser.username,
        userId: currentUser.userId,
        userRole: currentUser.userRole || "admin",
        action: "DELETE",
        module: "workers",
        severity: "warning",
        entityType: "worker",
        entityId: deleted.id,
        details: `Deleted worker "${deleted.name}"`,
      });

      broadcastToProperty(propertyId, "workers", "deleted", { id: workerId });

      res.json({ success: true, message: "Worker deleted successfully" });
    } catch (err: any) {
      console.error("[Workers Route] Error deleting worker:", err);
      res.status(400).json({ success: false, message: err.message || "Failed to delete worker" });
    }
  }
);

export default router;
