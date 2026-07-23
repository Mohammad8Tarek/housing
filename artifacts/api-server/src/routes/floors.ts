import { Router } from "express";
import { db, withTenant, floorsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
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
import { requirePermission } from "../middlewares/permissions.js";

const router: Router = Router();

router.get(
  "/floors",
  requirePermission("housing", "view"),
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

    // ── Prevent duplicate floor number in same property ─────────────────
    const existingFloor = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select({ id: floorsTable.id })
        .from(floorsTable)
        .where(eq(floorsTable.floorNumber, parsed.data.floorNumber));
    });
    if (existingFloor.length > 0) {
      res
        .status(409)
        .json({
          error: `Floor ${parsed.data.floorNumber} already exists in this property`,
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
      const existingFloor = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select({ id: floorsTable.id })
          .from(floorsTable)
          .where(eq(floorsTable.floorNumber, parsed.data.floorNumber!));
      });
      const conflict = existingFloor.find((f) => f.id !== params.data.id);
      if (conflict) {
        res
          .status(409)
          .json({
            error: `Floor ${parsed.data.floorNumber} already exists in this property`,
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
    res.json({ ...UpdateFloorResponse.parse(updated), propertyId });
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

    const existing = await withTenant(propertyId, async (tenantDb) => {
      const [f] = await tenantDb
        .select()
        .from(floorsTable)
        .where(eq(floorsTable.id, params.data.id));
      if (f)
        await tenantDb
          .delete(floorsTable)
          .where(eq(floorsTable.id, params.data.id));
      return f;
    });

    if (existing) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف دور: ${existing.floorNumber}`,
        actionType: "DELETE",
        module: "housing",
        entityType: "floor",
        entityId: existing.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);
  },
);

export default router;
