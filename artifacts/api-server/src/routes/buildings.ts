import { Router } from "express";
import { db, withTenant, buildingsTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateBuildingBody,
  UpdateBuildingBody,
  UpdateBuildingParams,
  DeleteBuildingParams,
  ListBuildingsQueryParams,
  ListBuildingsResponse,
  UpdateBuildingResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requirePermission } from "../middlewares/permissions.js";

const router: Router = Router();

router.get(
  "/buildings",
  requirePermission("housing", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const buildings = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb.select().from(buildingsTable);
    });

    res.json(
      ListBuildingsResponse.parse(buildings.map((b) => ({ ...b, propertyId }))),
    );
  },
);

router.post(
  "/buildings",
  requirePermission("housing", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const parsed = CreateBuildingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate building name in same property ────────────────
    const existingBuilding = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select({ id: buildingsTable.id })
        .from(buildingsTable)
        .where(eq(buildingsTable.name, parsed.data.name));
    });
    if (existingBuilding.length > 0) {
      res.status(409).json({
        error: `Building "${parsed.data.name}" already exists in this property`,
        code: "BUILDING_DUPLICATE",
      });
      return;
    }

    const [building] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .insert(buildingsTable)
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
      action: `إضافة مبنى جديد: ${building.name}`,
      actionType: "CREATE",
      module: "housing",
      entityType: "building",
      entityId: building.id,
    });
    res.status(201).json({ ...building, propertyId });
  },
);

router.patch(
  "/buildings/:id",
  requirePermission("housing", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = UpdateBuildingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateBuildingBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate building name on update ─────────────────────────
    if (parsed.data.name) {
      const existingBuilding = await withTenant(
        propertyId,
        async (tenantDb) => {
          return await tenantDb
            .select({ id: buildingsTable.id })
            .from(buildingsTable)
            .where(eq(buildingsTable.name, parsed.data.name!));
        },
      );
      const conflict = existingBuilding.find((b) => b.id !== params.data.id);
      if (conflict) {
        res.status(409).json({
          error: `Building "${parsed.data.name}" already exists in this property`,
          code: "BUILDING_DUPLICATE",
        });
        return;
      }
    }

    const [updated] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(buildingsTable)
        .set(parsed.data as any)
        .where(eq(buildingsTable.id, params.data.id))
        .returning();
    });

    if (!updated) {
      res.status(404).json({ error: "Building not found" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تعديل مبنى: ${updated.name}`,
      actionType: "UPDATE",
      module: "housing",
      entityType: "building",
      entityId: updated.id,
    });
    res.json({ ...UpdateBuildingResponse.parse(updated), propertyId });
  },
);

router.delete(
  "/buildings/:id",
  requirePermission("housing", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = DeleteBuildingParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existing = await withTenant(propertyId, async (tenantDb) => {
      const [b] = await tenantDb
        .select()
        .from(buildingsTable)
        .where(eq(buildingsTable.id, params.data.id));
      if (b)
        await tenantDb
          .delete(buildingsTable)
          .where(eq(buildingsTable.id, params.data.id));
      return b;
    });

    if (existing) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف مبنى: ${existing.name}`,
        actionType: "DELETE",
        module: "housing",
        entityType: "building",
        entityId: existing.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);
  },
);

export default router;
