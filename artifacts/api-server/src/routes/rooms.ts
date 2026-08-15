import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  roomsTable,
  assignmentsTable,
  employeesTable,
  buildingsTable,
  floorsTable,
  hostingsTable,
  reservationsTable,
} from "@workspace/db";
import { eq, and, desc, SQL, sql, ilike } from "drizzle-orm";
import {
  CreateRoomBody,
  UpdateRoomBody,
  GetRoomParams,
  UpdateRoomParams,
  DeleteRoomParams,
  ListRoomsQueryParams,
  ListRoomsResponse,
  GetRoomResponse,
  UpdateRoomResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { requirePermission } from "../middlewares/permissions.js";

const router: Router = Router();

router.get(
  "/rooms/by-number",
  requirePermission("accommodation", "view"),
  async (req, res) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const { number } = req.query;
    if (!number || typeof number !== "string") {
      res.status(400).json({ error: "number query parameter is required" });
      return;
    }

    const roomDetails = await withTenant(propertyId, async (tenantDb) => {
      const rows = await tenantDb
        .select({
          id: roomsTable.id,
          roomNumber: roomsTable.roomNumber,
          roomType: roomsTable.roomType,
          building: buildingsTable.name,
          floor: floorsTable.floorNumber,
        })
        .from(roomsTable)
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
        .where(eq(roomsTable.roomNumber, number.trim()))
        .limit(1);
      const room = rows[0];
      if (!room) return null;

      const assignmentsList = await tenantDb
        .select({ id: assignmentsTable.id })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.roomId, room.id),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        )
        .limit(1);

      const hostingsList = await tenantDb
        .select({ id: hostingsTable.id })
        .from(hostingsTable)
        .where(
          and(
            eq(hostingsTable.roomId, room.id),
            eq(hostingsTable.status, "ACTIVE"),
          ),
        )
        .limit(1);

      const reservationsList = await tenantDb
        .select({ id: reservationsTable.id })
        .from(reservationsTable)
        .where(
          and(
            eq(reservationsTable.roomId, room.id),
            eq(reservationsTable.status, "UPCOMING"),
          ),
        )
        .limit(1);

      // Check if there are any pending or approved hosting requests for this room
      const pendingHostingRequests = await pool.query(
        `SELECT id FROM public.hosting_requests 
         WHERE assigned_room_id = $1 
         AND status IN ('in_signing', 'approved', 'pending')
         LIMIT 1`,
        [room.id],
      );

      return {
        ...room,
        isOccupied: assignmentsList.length > 0 || hostingsList.length > 0,
        isReserved: reservationsList.length > 0,
        hasPendingRequest: pendingHostingRequests.rows.length > 0,
      };
    });

    if (!roomDetails) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    res.json(roomDetails);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

router.get(
  "/rooms",
  requirePermission("accommodation", "view"),
  async (req, res) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const query = ListRoomsQueryParams.safeParse(req.query);
      const conditions: SQL[] = [];
      let page = Math.max(1, parseInt(req.query.page as string) || 1);
      let limit = Math.min(
        1000,
        Math.max(1, parseInt(req.query.limit as string) || 25),
      );
      const search = req.query.search as string;

      if (search) {
        conditions.push(ilike(roomsTable.roomNumber, `%${search}%`));
      }

      if (query.success) {
        if (query.data.buildingId)
          conditions.push(eq(roomsTable.buildingId, query.data.buildingId));
        if (query.data.floorId)
          conditions.push(eq(roomsTable.floorId, query.data.floorId));
        if (query.data.status)
          conditions.push(eq(roomsTable.status, query.data.status));
      }

      const offset = (page - 1) * limit;

      const { data, total } = await withTenant(propertyId, async (tenantDb) => {
        let countQuery = tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(roomsTable) as any;
        if (conditions.length > 0)
          countQuery = countQuery.where(and(...conditions));
        const countResult = await countQuery;
        const totalCount = Number(countResult[0]?.count ?? 0);

        let baseQuery = tenantDb
          .select()
          .from(roomsTable)
          .limit(limit)
          .offset(offset) as any;
        if (conditions.length > 0)
          baseQuery = baseQuery.where(and(...conditions));

        const rows = await baseQuery;
        return { data: rows, total: totalCount };
      });

      res.json({
        data: data.map((r: any) => ({ ...r, propertyId })),
        pagination: {
          page,
          limit,
          total,
          totalPages: Math.ceil(total / limit),
          hasNextPage: page < Math.ceil(total / limit),
          hasPrevPage: page > 1,
        },
      });
    } catch (err: any) {
      console.error("[rooms/list] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch rooms" });
    }
  },
);

/* Room History Timeline */
router.get(
  "/rooms/:id/history",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const id = parseInt(req.params.id as string);
      if (isNaN(id)) {
        res.status(400).json({ error: "Invalid room id" });
        return;
      }

      const [room] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, id));
      });

      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }

      const [building] = await withTenant(propertyId, async (tenantDb) => {
        return room.buildingId
          ? await tenantDb
              .select()
              .from(buildingsTable)
              .where(eq(buildingsTable.id, room.buildingId))
          : [null];
      });

      const [floor] = await withTenant(propertyId, async (tenantDb) => {
        return room.floorId
          ? await tenantDb
              .select()
              .from(floorsTable)
              .where(eq(floorsTable.id, room.floorId))
          : [null];
      });

      const assignments = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select({
            id: assignmentsTable.id,
            employeeId: assignmentsTable.employeeId,
            checkInDate: assignmentsTable.checkInDate,
            checkOutDate: assignmentsTable.checkOutDate,
            status: assignmentsTable.status,
            notes: assignmentsTable.notes,
            empFirst: employeesTable.firstName,
            empLast: employeesTable.lastName,
            empEid: employeesTable.employeeId,
            empDept: employeesTable.department,
            empJobTitle: employeesTable.jobTitle,
            empNationality: employeesTable.nationality,
          })
          .from(assignmentsTable)
          .leftJoin(
            employeesTable,
            eq(assignmentsTable.employeeId, employeesTable.id),
          )
          .where(eq(assignmentsTable.roomId, id))
          .orderBy(desc(assignmentsTable.checkInDate));
      });

      const history = assignments.map((a) => ({
        id: a.id,
        employeeId: a.employeeId,
        employeeName: `${a.empFirst ?? ""} ${a.empLast ?? ""}`.trim(),
        employeeCode: a.empEid,
        department: a.empDept,
        jobTitle: a.empJobTitle,
        nationality: a.empNationality,
        checkInDate:
          (a.checkInDate as unknown) instanceof Date
            ? (a.checkInDate as unknown as Date).toISOString()
            : String(a.checkInDate),
        checkOutDate: a.checkOutDate
          ? (a.checkOutDate as unknown) instanceof Date
            ? (a.checkOutDate as unknown as Date).toISOString()
            : String(a.checkOutDate)
          : null,
        status: a.status,
        notes: a.notes,
      }));

      res.json({
        room: {
          ...room,
          propertyId,
          createdAt:
            room.createdAt instanceof Date
              ? room.createdAt.toISOString()
              : room.createdAt,
          buildingName: (building as any)?.name ?? null,
          floorName: (floor as any)?.name ?? null,
          floorNumber: (floor as any)?.floorNumber ?? null,
        },
        history,
      });
    } catch (err: any) {
      console.error("[rooms/history] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch room history" });
    }
  },
);

router.post(
  "/rooms",
  requirePermission("accommodation", "create"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const parsed = CreateRoomBody.safeParse(req.body);
      if (!parsed.success) {
        res.status(400).json({ error: parsed.error.message });
        return;
      }

      const existingRoom = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select({ id: roomsTable.id })
          .from(roomsTable)
          .where(eq(roomsTable.roomNumber, parsed.data.roomNumber));
      });
      if (existingRoom.length > 0) {
        res.status(409).json({
          error: `Room ${parsed.data.roomNumber} already exists in this property`,
          code: "ROOM_DUPLICATE",
        });
        return;
      }

      const [room] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .insert(roomsTable)
          .values({ ...(parsed.data as any), currentOccupancy: 0 })
          .returning();
      });

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `إضافة غرفة جديدة: ${room.roomNumber}`,
        actionType: "CREATE",
        module: "housing",
        entityType: "room",
        entityId: room.id,
        details: `Capacity: ${room.capacity}, Type: ${room.roomType}`,
      });
      res.status(201).json({ ...GetRoomResponse.parse(room), propertyId });
    } catch (err: any) {
      console.error("[rooms/create] Error:", err.message);
      res.status(500).json({ error: "Failed to create room" });
    }
  },
);

router.get(
  "/rooms/:id",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ error: "propertyId is required" });
        return;
      }

      const params = GetRoomParams.safeParse(req.params);
      if (!params.success) {
        res.status(400).json({ error: params.error.message });
        return;
      }

      const [room] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, params.data.id));
      });

      if (!room) {
        res.status(404).json({ error: "Room not found" });
        return;
      }
      res.json({ ...GetRoomResponse.parse(room), propertyId });
    } catch (err: any) {
      console.error("[rooms/get] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch room" });
    }
  },
);

router.patch(
  "/rooms/:id",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = UpdateRoomParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const parsed = UpdateRoomBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    // ── Prevent duplicate room number on update ───────────────────────────
    if (parsed.data.roomNumber) {
      const existingRoom = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .select({ id: roomsTable.id })
          .from(roomsTable)
          .where(eq(roomsTable.roomNumber, parsed.data.roomNumber!));
      });
      const conflict = existingRoom.find((r) => r.id !== params.data.id);
      if (conflict) {
        res.status(409).json({
          error: `Room ${parsed.data.roomNumber} already exists in this property`,
          code: "ROOM_DUPLICATE",
        });
        return;
      }
    }

    const [updated] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(roomsTable)
        .set(parsed.data as any)
        .where(eq(roomsTable.id, params.data.id))
        .returning();
    });

    if (!updated) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تعديل غرفة: ${updated.roomNumber}`,
      actionType: "UPDATE",
      module: "housing",
      entityType: "room",
      entityId: updated.id,
    });
    res.json({ ...UpdateRoomResponse.parse(updated), propertyId });
  },
);

router.delete(
  "/rooms/:id",
  requirePermission("accommodation", "delete"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = DeleteRoomParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    const existing = await withTenant(propertyId, async (tenantDb) => {
      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, params.data.id));
      if (room)
        await tenantDb
          .delete(roomsTable)
          .where(eq(roomsTable.id, params.data.id));
      return room;
    });

    if (existing) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف غرفة: ${existing.roomNumber}`,
        actionType: "DELETE",
        module: "housing",
        entityType: "room",
        entityId: existing.id,
        severity: "warning",
      });
    }
    res.sendStatus(204);
  },
);

export default router;
