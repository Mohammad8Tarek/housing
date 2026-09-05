import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  roomsTable,
  assignmentsTable,
  profilesTable,
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
import { requirePermission, requireAnyPermission } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";

const router: Router = Router();

// ─── GET /rooms/:id/bed-status ─────────────────────────────────────────────
router.get(
  "/rooms/:id/bed-status",
  requirePermission("housing", "view"),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const roomId = parseInt(String(req.params.id), 10);
      if (!roomId || isNaN(roomId)) {
        res.status(400).json({ error: "Invalid roomId" });
        return;
      }

      const result = await withTenant(propertyId, async (tenantDb) => {
        const [room] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, roomId));
        if (!room) return null;

        const activeAssignments = await tenantDb
          .select({
            assignmentId: assignmentsTable.id,
            bedNumber: assignmentsTable.bedNumber,
            profileId: assignmentsTable.profileId,
            firstName: profilesTable.firstName,
            lastName: profilesTable.lastName,
            profileCode: profilesTable.profileId,
            profileStatus: profilesTable.status,
            vacationStartDate: profilesTable.vacationStartDate,
            vacationEndDate: profilesTable.vacationEndDate,
            jobTitle: profilesTable.jobTitle,
            department: profilesTable.department,
          })
          .from(assignmentsTable)
          .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
          .where(
            and(
              eq(assignmentsTable.roomId, roomId),
              eq(assignmentsTable.status, "ACTIVE"),
            ),
          );

        const capacity = room.capacity || 1;
        const beds = [];

        for (let b = 1; b <= capacity; b++) {
          const asgn = activeAssignments.find((a) => a.bedNumber === b);
          if (!asgn) {
            beds.push({
              bedNumber: b,
              status: "AVAILABLE",
              occupant: null,
            });
          } else {
            const isOnVacation = asgn.profileStatus?.toUpperCase() === "VACATION";
            beds.push({
              bedNumber: b,
              status: isOnVacation ? "VACATION" : "OCCUPIED",
              occupant: {
                assignmentId: asgn.assignmentId,
                profileId: asgn.profileId,
                name: `${asgn.firstName || ""} ${asgn.lastName || ""}`.trim(),
                profileCode: asgn.profileCode,
                status: asgn.profileStatus,
                isOnVacation,
                vacationStartDate: asgn.vacationStartDate,
                vacationEndDate: asgn.vacationEndDate,
                jobTitle: asgn.jobTitle,
                department: asgn.department,
              },
            });
          }
        }

        const isEligible = !["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(
          room.status?.toLowerCase() || "",
        );

        return {
          room: {
            id: room.id,
            roomNumber: room.roomNumber,
            capacity: room.capacity,
            currentOccupancy: room.currentOccupancy,
            status: room.status,
            roomType: room.roomType,
            genderPolicy: room.gender,
            isEligible,
          },
          beds,
        };
      });

      if (!result) {
        res.status(404).json({ error: "Room not found" });
        return;
      }

      res.json(result);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  },
);

router.get(
  "/rooms/by-number",
  requirePermission("housing", "view"),
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
  requirePermission("housing", "view"),
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
          .orderBy(sql`LENGTH(${roomsTable.roomNumber}), ${roomsTable.roomNumber}`)
          .limit(limit)
          .offset(offset) as any;
        if (conditions.length > 0)
          baseQuery = baseQuery.where(and(...conditions));

        const rows = await baseQuery;
        return {
          data: rows.map((room: any) => ({
            ...room,
            genderPolicy: room.gender,
          })),
          total: totalCount,
        };
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
  requirePermission("housing", "view"),
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
            profileId: assignmentsTable.profileId,
            checkInDate: assignmentsTable.checkInDate,
            checkOutDate: assignmentsTable.checkOutDate,
            status: assignmentsTable.status,
            notes: assignmentsTable.notes,
            empFirst: profilesTable.firstName,
            empLast: profilesTable.lastName,
            empEid: profilesTable.profileId,
            empDept: profilesTable.department,
            empJobTitle: profilesTable.jobTitle,
            empNationality: profilesTable.nationality,
          })
          .from(assignmentsTable)
          .leftJoin(
            profilesTable,
            eq(assignmentsTable.profileId, profilesTable.id),
          )
          .where(eq(assignmentsTable.roomId, id))
          .orderBy(desc(assignmentsTable.checkInDate));
      });

      const history = assignments.map((a) => ({
        id: a.id,
        profileId: a.profileId,
        profileName: `${a.empFirst ?? ""} ${a.empLast ?? ""}`.trim(),
        profileCode: a.empEid,
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
  requirePermission("housing", "create"),
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
        const conditions = [ilike(roomsTable.roomNumber, parsed.data.roomNumber.trim())];
        if (parsed.data.buildingId) {
          conditions.push(eq(roomsTable.buildingId, parsed.data.buildingId));
        }
        return await tenantDb
          .select({ id: roomsTable.id })
          .from(roomsTable)
          .where(and(...conditions));
      });
      if (existingRoom.length > 0) {
        res.status(409).json({
          error: `Room ${parsed.data.roomNumber} already exists in this building`,
          code: "ROOM_DUPLICATE",
        });
        return;
      }

      const {
        view,
        bedType,
        classification,
        separatorDoor,
        size,
        sizeSqm,
        features,
        featuresList,
        notes,
      } = req.body;

      const extraData: any = {};
      if (view !== undefined) extraData.view = view;
      if (bedType !== undefined) extraData.bedType = bedType;
      if (classification !== undefined) extraData.classification = classification;
      if (separatorDoor !== undefined) extraData.separatorDoor = Boolean(separatorDoor);
      if (size !== undefined) {
        extraData.size = size;
        const num = parseInt(String(size).replace(/[^0-9]/g, ""));
        if (!isNaN(num)) extraData.sizeSqm = num;
      }
      if (sizeSqm !== undefined) extraData.sizeSqm = Number(sizeSqm);
      if (features !== undefined) extraData.features = features;
      if (featuresList !== undefined) {
        extraData.featuresList = Array.isArray(featuresList)
          ? featuresList
          : String(featuresList).split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
      } else if (features !== undefined) {
        extraData.featuresList = String(features).split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
      }
      if (notes !== undefined) extraData.notes = notes;

      const [room] = await withTenant(propertyId, async (tenantDb) => {
        const { propertyId: _skip, ...roomData } = parsed.data as any;
        return await tenantDb
          .insert(roomsTable)
          .values({ ...roomData, ...extraData, currentOccupancy: 0 })
          .returning();
      });

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `إضافة غرفة جديدة: رقم ${room.roomNumber}`,
        actionType: "CREATE",
        module: "housing",
        entityType: "room",
        entityId: room.id,
        details: {
          roomNumber: room.roomNumber,
          roomId: room.id,
          capacity: room.capacity,
          roomType: room.roomType,
          buildingId: room.buildingId,
          floorId: room.floorId,
          gender: room.gender,
          status: room.status,
          user: s.username,
          role: s.userRole,
        },
      });
      res.status(201).json({ ...room, genderPolicy: room.gender, propertyId });
    } catch (err: any) {
      console.error("[rooms/create] Error:", err);
      // Check for Postgres Foreign Key constraint violation
      if (err.code === "23503") {
         res.status(400).json({ error: "Building or floor does not exist." });
         return;
      }
      res.status(500).json({ error: "Failed to create room: " + err.message });
    }
  },
);

router.get(
  "/rooms/:id",
  requirePermission("housing", "view"),
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
      res.json(GetRoomResponse.parse({ ...room, genderPolicy: room.gender, propertyId }));
    } catch (err: any) {
      console.error("[rooms/get] Error:", err.message);
      res.status(500).json({ error: "Failed to fetch room" });
    }
  },
);

router.patch(
  "/rooms/:id",
  requireAnyPermission(["housing", "edit"], ["housekeeping", "edit"]),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);

    const params = UpdateRoomParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByRoomId(params.data.id)) || 0;
    }

    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
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
          .where(ilike(roomsTable.roomNumber, parsed.data.roomNumber!.trim()));
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

    const {
      view,
      bedType,
      classification,
      separatorDoor,
      size,
      sizeSqm,
      features,
      featuresList,
      notes,
      buildingId,
      floorId,
    } = req.body;

    const extraData: any = {};
    if (buildingId !== undefined) extraData.buildingId = Number(buildingId);
    if (floorId !== undefined) extraData.floorId = Number(floorId);
    if (view !== undefined) extraData.view = view;
    if (bedType !== undefined) extraData.bedType = bedType;
    if (classification !== undefined) extraData.classification = classification;
    if (separatorDoor !== undefined) extraData.separatorDoor = Boolean(separatorDoor);
    if (size !== undefined) {
      extraData.size = size;
      const num = parseInt(String(size).replace(/[^0-9]/g, ""));
      if (!isNaN(num)) extraData.sizeSqm = num;
    }
    if (sizeSqm !== undefined) extraData.sizeSqm = Number(sizeSqm);
    if (features !== undefined) extraData.features = features;
    if (featuresList !== undefined) {
      extraData.featuresList = Array.isArray(featuresList)
        ? featuresList
        : String(featuresList).split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
    } else if (features !== undefined) {
      extraData.featuresList = String(features).split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
    }
    if (notes !== undefined) extraData.notes = notes;

    const [existingRoom] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, params.data.id));
    });

    const [updated] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(roomsTable)
        .set({ ...parsed.data, ...extraData })
        .where(eq(roomsTable.id, params.data.id))
        .returning();
    });

    if (!updated) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    const s = su(req);
    
    // Log specific status change if status was updated
    if (parsed.data.status) {
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تغيير حالة الغرفة رقم ${updated.roomNumber} من [${existingRoom?.status ?? "-"}] إلى [${parsed.data.status}]`,
        actionType: "UPDATE_STATUS",
        module: "housekeeping",
        entityType: "room",
        entityId: updated.id,
        details: {
          roomNumber: updated.roomNumber,
          roomId: updated.id,
          previousStatus: existingRoom?.status,
          newStatus: parsed.data.status,
          buildingId: updated.buildingId,
          floorId: updated.floorId,
          capacity: updated.capacity,
          user: s.username,
          role: s.userRole,
        },
      });
    } else {
      // General update log
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تعديل بيانات الغرفة رقم ${updated.roomNumber}`,
        actionType: "UPDATE",
        module: "housing",
        entityType: "room",
        entityId: updated.id,
        details: {
          roomNumber: updated.roomNumber,
          roomId: updated.id,
          updatedFields: Object.keys(parsed.data),
          buildingId: updated.buildingId,
          floorId: updated.floorId,
          capacity: updated.capacity,
          user: s.username,
          role: s.userRole,
        },
      });
    }
    
    broadcastToProperty(propertyId, {
      module: "housing",
      action: "updated",
      entityId: updated.id,
    });
    broadcastToProperty(propertyId, {
      module: "housekeeping",
      action: "updated",
      entityId: updated.id,
    });

    res.json({ ...updated, genderPolicy: updated.gender, propertyId });
  },
);

router.patch(
  "/rooms/:id/features",
  requirePermission("housing", "edit"),
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
      const { features, featuresList } = req.body;
      const list = Array.isArray(featuresList)
        ? featuresList
        : String(features ?? "").split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean);
      const rawText = features ?? list.join(", ");

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(roomsTable)
          .set({
            features: rawText,
            featuresList: list,
          })
          .where(eq(roomsTable.id, id))
          .returning();
      });

      if (!updated) {
        res.status(404).json({ error: "Room not found" });
        return;
      }

      res.json({ success: true, room: { ...updated, propertyId } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

router.patch(
  "/rooms/:id/status",
  async (req, res, next) => {
    // Custom permission check: allow if user has accommodation:edit OR housekeeping:edit
    try {
      const { loadAuthUser, hasPermission } = await import("../middlewares/permissions.js");
      const user = await loadAuthUser(req, res);
      if (!user) return;
      if (
        !hasPermission(user, "accommodation", "edit") &&
        !hasPermission(user, "housing", "edit") &&
        !hasPermission(user, "housekeeping", "edit")
      ) {
        res.status(403).json({ error: "Permission denied. Requires accommodation:edit, housing:edit, or housekeeping:edit" });
        return;
      }
      next();
    } catch (err) {
      next(err);
    }
  },
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
      const { status } = req.body;
      if (!status) {
        res.status(400).json({ error: "Status is required" });
        return;
      }

      const [updated] = await withTenant(propertyId, async (tenantDb) => {
        return await tenantDb
          .update(roomsTable)
          .set({ status })
          .where(eq(roomsTable.id, id))
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
        action: `تغيير حالة الغرفة رقم ${updated.roomNumber} إلى: ${status}`,
        actionType: "UPDATE_STATUS",
        module: "housekeeping",
        entityType: "room",
        entityId: updated.id,
        details: {
          roomNumber: updated.roomNumber,
          roomId: updated.id,
          newStatus: status,
          user: s.username,
          role: s.userRole,
        },
      });

      // Also trigger a property broadcast for realtime UI update
      const { broadcastToProperty } = await import("../lib/websocket.js");
      broadcastToProperty(propertyId, { module: "rooms", action: "sync" });

      res.json({ success: true, room: { ...updated, propertyId } });
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  },
);

async function findPropertyByRoomId(roomId: number): Promise<number | null> {
  try {
    const props = await pool.query("SELECT id, schema_name FROM properties");
    for (const p of props.rows) {
      try {
        const check = await pool.query(
          `SELECT id FROM "${p.schema_name}".rooms WHERE id = $1 LIMIT 1`,
          [roomId],
        );
        if (check.rows.length > 0) return p.id;
      } catch {}
    }
  } catch {}
  return null;
}

router.post(
  "/rooms/bulk-delete",
  requirePermission("housing", "delete"),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array of room IDs" });
      return;
    }

    const numIds = ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    if (numIds.length === 0) {
      res.status(400).json({ error: "No valid room IDs provided" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByRoomId(numIds[0])) || 0;
    }

    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const result = await withTenant(propertyId, async (tenantDb) => {
        // Find which rooms have active occupants
        const idListSql = sql.join(numIds.map((id) => sql`${id}`), sql`, `);
        const activeRows = await tenantDb.execute(sql`
          SELECT a.room_id, r.room_number, count(*)::int as count 
          FROM assignments a
          JOIN rooms r ON r.id = a.room_id
          WHERE a.room_id IN (${idListSql}) 
            AND a.status = 'ACTIVE'
          GROUP BY a.room_id, r.room_number
        `);

        const occupiedRoomIds = new Set<number>(
          (activeRows.rows || []).map((r: any) => Number(r.room_id)),
        );

        const deletableIds = numIds.filter((id) => !occupiedRoomIds.has(id));

        if (deletableIds.length > 0) {
          const deletableSql = sql.join(deletableIds.map((id) => sql`${id}`), sql`, `);

          // Clean up dependent child records to prevent foreign key errors
          try { await tenantDb.execute(sql`DELETE FROM room_beds WHERE room_id IN (${deletableSql})`); } catch {}
          try { await tenantDb.execute(sql`DELETE FROM room_keys WHERE room_id IN (${deletableSql})`); } catch {}
          try { await tenantDb.execute(sql`DELETE FROM room_locks WHERE room_id IN (${deletableSql})`); } catch {}
          try { await tenantDb.execute(sql`DELETE FROM reservations WHERE room_id IN (${deletableSql})`); } catch {}
          try { await tenantDb.execute(sql`DELETE FROM assignments WHERE room_id IN (${deletableSql}) AND status != 'ACTIVE'`); } catch {}
          try { await tenantDb.execute(sql`DELETE FROM hostings WHERE room_id IN (${deletableSql})`); } catch {}
          try { await tenantDb.execute(sql`DELETE FROM maintenance_requests WHERE room_id IN (${deletableSql})`); } catch {}

          await tenantDb
            .delete(roomsTable)
            .where(sql`${roomsTable.id} IN (${deletableSql})`);
        }

        return {
          deletedCount: deletableIds.length,
          deletedIds: deletableIds,
          skippedCount: occupiedRoomIds.size,
          skippedRooms: (activeRows.rows || []).map((r: any) => r.room_number),
        };
      });

      const s = su(req);
      if (result.deletedCount > 0) {
        await logActivity({
          req,
          propertyId,
          username: s.username,
          userId: s.userId,
          userRole: s.userRole,
          action: `حذف جماعي لـ ${result.deletedCount} غرفة`,
          actionType: "DELETE",
          module: "housing",
          entityType: "room",
          severity: "warning",
          details: {
            deletedCount: result.deletedCount,
            skippedCount: result.skippedCount,
            deletedIds: result.deletedIds,
          },
        });

        broadcastToProperty(propertyId, {
          module: "housing",
          action: "deleted",
          details: { count: result.deletedCount },
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to bulk delete rooms" });
    }
  },
);

router.delete(
  "/rooms/:id",
  requirePermission("housing", "delete"),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const roomId = parseInt(req.params.id, 10);
    if (isNaN(roomId)) {
      res.status(400).json({ error: "Invalid room ID" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByRoomId(roomId)) || 0;
    }

    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, roomId));
      if (!room) return { notFound: true };

      // Check active residents
      const activeOccupants = await tenantDb.execute(sql`
        SELECT count(*)::int as count 
        FROM assignments a
        WHERE a.room_id = ${roomId} AND a.status = 'ACTIVE'
      `);
      const count = Number((activeOccupants.rows?.[0] as any)?.count ?? 0);
      if (count > 0) {
        return { hasActiveResidents: true, count, room };
      }

      // Clean up dependent child records to prevent foreign key errors
      try { await tenantDb.execute(sql`DELETE FROM room_beds WHERE room_id = ${roomId}`); } catch {}
      try { await tenantDb.execute(sql`DELETE FROM room_keys WHERE room_id = ${roomId}`); } catch {}
      try { await tenantDb.execute(sql`DELETE FROM room_locks WHERE room_id = ${roomId}`); } catch {}
      try { await tenantDb.execute(sql`DELETE FROM reservations WHERE room_id = ${roomId}`); } catch {}
      try { await tenantDb.execute(sql`DELETE FROM assignments WHERE room_id = ${roomId} AND status != 'ACTIVE'`); } catch {}
      try { await tenantDb.execute(sql`DELETE FROM hostings WHERE room_id = ${roomId}`); } catch {}
      try { await tenantDb.execute(sql`DELETE FROM maintenance_requests WHERE room_id = ${roomId}`); } catch {}

      await tenantDb
        .delete(roomsTable)
        .where(eq(roomsTable.id, roomId));
      return { success: true, room };
    });

    if (result.notFound) {
      res.status(404).json({ error: "Room not found" });
      return;
    }

    if (result.hasActiveResidents) {
      res.status(400).json({
        error: `لا يمكن حذف الغرفة لوجود ${result.count} موظف مسكن بها حالياً. يرجى إخلاء أو نقل الموظف أولاً.`,
        code: "ROOM_HAS_ACTIVE_RESIDENTS",
      });
      return;
    }

    if (result.room) {
      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف الغرفة رقم ${result.room.roomNumber}`,
        actionType: "DELETE",
        module: "housing",
        entityType: "room",
        entityId: result.room.id,
        severity: "warning",
        details: {
          roomNumber: result.room.roomNumber,
          roomId: result.room.id,
          capacity: result.room.capacity,
          user: s.username,
          role: s.userRole,
        },
      });

      broadcastToProperty(propertyId, {
        module: "housing",
        action: "deleted",
        entityId: result.room.id,
      });
    }
    res.json({ success: true, id: roomId });
  },
);

export default router;
