import { Router } from "express";
import { db, withTenant, floorsTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import {
  CreateFloorBody,
  UpdateFloorBody,
  UpdateFloorParams,
  DeleteFloorParams,
  ListFloorsQueryParams,
  ListFloorsResponse,
  UpdateFloorResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permissions.js";

const router: Router = Router();

router.get(
  "/floors",
  requireAnyPermission(
    ["housing", "view"],
    ["accommodation", "view"],
    ["housekeeping", "view"],
    ["reservations", "view"],
    ["maintenance", "view"],
    ["reports", "view"],
  ),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = ListFloorsQueryParams.safeParse(req.query);
    const floors = await withTenant(propertyId, async (tenantDb) => {
      if (query.success && query.data.buildingId) {
        return await tenantDb
          .select()
          .from(floorsTable)
          .where(eq(floorsTable.buildingId, query.data.buildingId));
      }
      return await tenantDb.select().from(floorsTable);
    });

    res.json(
      ListFloorsResponse.parse(floors.map((f) => ({ ...f, propertyId }))),
    );
  },
);

router.post(
  "/floors",
  requirePermission("housing", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const parsed = CreateFloorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate floor number in same building ─────────────────
    const existingFloor = await withTenant(propertyId, async (tenantDb) => {
      const conditions = [eq(floorsTable.floorNumber, parsed.data.floorNumber)];
      if (parsed.data.buildingId) {
        conditions.push(eq(floorsTable.buildingId, parsed.data.buildingId));
      }
      return await tenantDb
        .select({ id: floorsTable.id })
        .from(floorsTable)
        .where(and(...conditions));
    });
    if (existingFloor.length > 0) {
      res.status(409).json({
        error: `Floor ${parsed.data.floorNumber} already exists in this building`,
        code: "FLOOR_DUPLICATE",
      });
      return;
    }

    const [floor] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(floorsTable)
        .values(parsed.data as any)
        .returning();
    });

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `إضافة دور جديد: ${floor.floorNumber}`,
      actionType: "CREATE",
      module: "housing",
      entityType: "floor",
      entityId: floor.id,
    });
    res.status(201).json({ ...floor, propertyId });
  },
);

router.patch(
  "/floors/:id",
  requirePermission("housing", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = UpdateFloorParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateFloorBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate floor number on update ──────────────────────────
    if (parsed.data.floorNumber) {
      const currentFloor = await withTenant(propertyId, async (tenantDb) => {
        const [f] = await tenantDb
          .select()
          .from(floorsTable)
          .where(eq(floorsTable.id, params.data.id))
          .limit(1);
        return f;
      });
      const targetBuildingId = (parsed.data as any).buildingId || currentFloor?.buildingId;
      const existingFloor = await withTenant(propertyId, async (tenantDb) => {
        const conditions = [eq(floorsTable.floorNumber, parsed.data.floorNumber!)];
        if (targetBuildingId) {
          conditions.push(eq(floorsTable.buildingId, targetBuildingId));
        }
        return await tenantDb
          .select({ id: floorsTable.id })
          .from(floorsTable)
          .where(and(...conditions));
      });
      const conflict = existingFloor.find((f) => f.id !== params.data.id);
      if (conflict) {
        res.status(409).json({
          error: `Floor ${parsed.data.floorNumber} already exists in this building`,
          code: "FLOOR_DUPLICATE",
        });
        return;
      }
    }

    const [updated] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(floorsTable)
        .set(parsed.data as any)
        .where(eq(floorsTable.id, params.data.id))
        .returning();
    });

    if (!updated) {
      res.status(404).json({ error: "Floor not found" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تعديل دور: ${updated.floorNumber}`,
      actionType: "UPDATE",
      module: "housing",
      entityType: "floor",
      entityId: updated.id,
    });
    res.json(UpdateFloorResponse.parse({ ...updated, propertyId }));
  },
);

router.delete(
  "/floors/:id",
  requirePermission("housing", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = DeleteFloorParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [f] = await tenantDb
        .select()
        .from(floorsTable)
        .where(eq(floorsTable.id, params.data.id));
      if (!f) return { notFound: true };

      // Check active residents
      const activeOccupants = await tenantDb.execute(sql`
        SELECT count(*)::int as count 
        FROM assignments a
        JOIN rooms r ON r.id = a.room_id
        WHERE r.floor_id = ${params.data.id} AND a.status = 'ACTIVE'
      `);
      const count = Number((activeOccupants.rows?.[0] as any)?.count ?? 0);
      if (count > 0) {
        return { hasActiveResidents: true, count, floor: f };
      }

      await tenantDb
        .delete(floorsTable)
        .where(eq(floorsTable.id, params.data.id));
      return { success: true, floor: f };
    });

    if (result.notFound) {
      res.status(404).json({ error: "Floor not found" });
      return;
    }

    if (result.hasActiveResidents) {
      res.status(400).json({
        error: `لا يمكن حذف الطابق لوجود ${result.count} موظف مسكن به حالياً. يرجى نقل أو إخلاء الموظفين أولاً.`,
        code: "FLOOR_HAS_ACTIVE_RESIDENTS",
      });
      return;
    }

    if (result.floor) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف دور: ${result.floor.floorNumber}`,
        actionType: "DELETE",
        module: "housing",
        entityType: "floor",
        entityId: result.floor.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);
  },
);

export default router;
