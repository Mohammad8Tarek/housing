import { Router } from "express";
import { db, withTenant, buildingsTable } from "@workspace/db";
import { eq, and, ilike, sql, SQL } from "drizzle-orm";
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

    const conditions: SQL[] = [];
    let page = Math.max(1, parseInt(req.query.page as string) || 1);
    let limit = Math.min(1000, Math.max(1, parseInt(req.query.limit as string) || 25));
    const search = req.query.search as string;

    if (search) {
      conditions.push(ilike(buildingsTable.name, `%${search}%`));
    }

    const offset = (page - 1) * limit;

    const { data, total } = await withTenant(propertyId, async (tenantDb) => {
      let countQuery = tenantDb.select({ count: sql<number>`count(*)` }).from(buildingsTable) as any;
      if (conditions.length > 0) countQuery = countQuery.where(and(...conditions));
      const countResult = await countQuery;
      const totalCount = Number(countResult[0]?.count ?? 0);

      let baseQuery = tenantDb
        .select({
          id: buildingsTable.id,
          name: buildingsTable.name,
          location: buildingsTable.location,
          status: buildingsTable.status,
          capacity: buildingsTable.capacity,
          createdAt: buildingsTable.createdAt,
          floorsCount: sql<number>`(
            SELECT count(*)::int 
            FROM floors f 
            WHERE f.building_id = ${buildingsTable.id}
          )`,
          roomsCount: sql<number>`(
            SELECT count(*)::int 
            FROM rooms r 
            WHERE r.building_id = ${buildingsTable.id} AND r.is_active = true
          )`,
          totalCapacity: sql<number>`COALESCE((
            SELECT sum(r.capacity)::int 
            FROM rooms r 
            WHERE r.building_id = ${buildingsTable.id} AND r.is_active = true
          ), 0)`,
          currentOccupancy: sql<number>`COALESCE((
            SELECT sum(r.current_occupancy)::int 
            FROM rooms r 
            WHERE r.building_id = ${buildingsTable.id} AND r.is_active = true
          ), 0)`,
        })
        .from(buildingsTable)
        .limit(limit)
        .offset(offset) as any;
      if (conditions.length > 0) baseQuery = baseQuery.where(and(...conditions));

      const rows = await baseQuery;
      return { data: rows, total: totalCount };
    });

    res.json({
      data: data.map((b: any) => ({
        ...b,
        propertyId,
        floorsCount: Number(b.floorsCount || 0),
        roomsCount: Number(b.roomsCount || 0),
        totalCapacity: Number(b.totalCapacity || 0),
        currentOccupancy: Number(b.currentOccupancy || 0),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
        hasNextPage: page < Math.ceil(total / limit),
        hasPrevPage: page > 1,
      },
    });
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
    res.json(UpdateBuildingResponse.parse({ ...updated, propertyId }));
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

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [b] = await tenantDb
        .select()
        .from(buildingsTable)
        .where(eq(buildingsTable.id, params.data.id));
      if (!b) return { notFound: true };

      // Check if any room in this building has active assignments
      const activeOccupants = await tenantDb.execute(sql`
        SELECT count(*)::int as count 
        FROM assignments a
        JOIN rooms r ON r.id = a.room_id
        WHERE r.building_id = ${params.data.id} AND a.status = 'ACTIVE'
      `);
      const count = Number((activeOccupants.rows?.[0] as any)?.count ?? 0);
      if (count > 0) {
        return { hasActiveResidents: true, count, building: b };
      }

      await tenantDb
        .delete(buildingsTable)
        .where(eq(buildingsTable.id, params.data.id));
      return { success: true, building: b };
    });

    if (result.notFound) {
      res.status(404).json({ error: "Building not found" });
      return;
    }

    if (result.hasActiveResidents) {
      res.status(400).json({
        error: `لا يمكن حذف المبنى لوجود ${result.count} موظف مسكن به حالياً. يرجى نقل أو إخلاء الموظفين أولاً.`,
        code: "BUILDING_HAS_ACTIVE_RESIDENTS",
      });
      return;
    }

    if (result.building) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف مبنى: ${result.building.name}`,
        actionType: "DELETE",
        module: "housing",
        entityType: "building",
        entityId: result.building.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);
  },
);

export default router;
