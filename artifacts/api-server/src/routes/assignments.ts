import { Router } from "express";
import { db, withTenant, assignmentsTable, roomsTable } from "@workspace/db";
import { eq, and, SQL } from "drizzle-orm";
import {
  CreateAssignmentBody,
  UpdateAssignmentBody,
  CheckoutAssignmentBody,
  TransferAssignmentBody,
  GetAssignmentParams,
  UpdateAssignmentParams,
  CheckoutAssignmentParams,
  TransferAssignmentParams,
  ListAssignmentsQueryParams,
  ListAssignmentsResponse,
  GetAssignmentResponse,
  UpdateAssignmentResponse,
  CheckoutAssignmentResponse,
  TransferAssignmentResponse,
} from "@workspace/api-zod";
import { logActivity } from "../lib/activity-logger.js";
import { requirePermission } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();

function fmtAssignment(r: Record<string, any>) {
  const dateFields = [
    "checkInDate",
    "checkOutDate",
    "expectedCheckOutDate",
    "actualCheckOutDate",
    "transferDate",
    "createdAt",
    "updatedAt",
  ];
  const out: Record<string, any> = { ...r };
  for (const f of dateFields) {
    if (out[f] instanceof Date && typeof out[f].toISOString === "function")
      out[f] = out[f].toISOString();
    else if (out[f] == null) out[f] = null;
  }
  return out;
}

// ─── GET /assignments ─────────────────────────────────────────────────────
router.get(
  "/assignments",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = ListAssignmentsQueryParams.safeParse(req.query);
    const conditions: SQL[] = [];

    if (query.success) {
      if (query.data.status)
        conditions.push(eq(assignmentsTable.status, query.data.status));
      if (query.data.employeeId)
        conditions.push(eq(assignmentsTable.employeeId, query.data.employeeId));
      if (query.data.roomId)
        conditions.push(eq(assignmentsTable.roomId, query.data.roomId));
    }

    const assignments = await withTenant(propertyId, async (tenantDb) => {
      return conditions.length > 0
        ? await tenantDb
            .select()
            .from(assignmentsTable)
            .where(and(...conditions))
        : await tenantDb.select().from(assignmentsTable);
    });

    res.json(
      ListAssignmentsResponse.parse(
        assignments.map((a) => fmtAssignment({ ...a, propertyId })),
      ),
    );
  },
);

// ─── POST /assignments ────────────────────────────────────────────────────
router.post(
  "/assignments",
  requirePermission("accommodation", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const parsed = CreateAssignmentBody.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: parsed.error.message });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, parsed.data.roomId));
      if (!room)
        return { error: "Room not found", code: "ROOM_NOT_FOUND", status: 404 };
      if (room.currentOccupancy >= room.capacity)
        return {
          error: `Room is full (${room.capacity})`,
          code: "ROOM_FULL",
          status: 409,
        };

      // ── Prevent duplicate active assignment for the same employee ──────────
      const existingActive = await tenantDb
        .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.employeeId, parsed.data.employeeId),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );
      if (existingActive.length > 0) {
        return {
          error: `Employee #${parsed.data.employeeId} already has an active assignment (assignment #${existingActive[0].id}). Checkout the existing assignment first.`,
          code: "EMPLOYEE_ALREADY_ASSIGNED",
          existingAssignmentId: existingActive[0].id,
          existingRoomId: existingActive[0].roomId,
          status: 409,
        };
      }

      // ── Bed conflict check ────────────────────────────────────────────────
      if (parsed.data.bedNumber) {
        const takenBeds = await tenantDb
          .select({ id: assignmentsTable.id })
          .from(assignmentsTable)
          .where(
            and(
              eq(assignmentsTable.roomId, parsed.data.roomId),
              eq(assignmentsTable.bedNumber, parsed.data.bedNumber),
              eq(assignmentsTable.status, "ACTIVE"),
            ),
          );
        if (takenBeds.length > 0) {
          return {
            error: `Bed ${parsed.data.bedNumber} in this room is already occupied`,
            code: "BED_TAKEN",
            status: 409,
          };
        }
      }

      const newOccupancy = room.currentOccupancy + 1;
      await tenantDb
        .update(roomsTable)
        .set({
          currentOccupancy: newOccupancy,
          status: newOccupancy >= room.capacity ? "occupied" : "available",
        })
        .where(eq(roomsTable.id, parsed.data.roomId));

      const [assignment] = await tenantDb
        .insert(assignmentsTable)
        .values({ ...(parsed.data as any), status: "ACTIVE" })
        .returning();

      return { assignment, room };
    });

    if (result.error) {
      res
        .status(result.status)
        .json({
          error: result.error,
          code: result.code,
          existingAssignmentId: result.existingAssignmentId,
          existingRoomId: result.existingRoomId,
        });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تسكين موظف #${result.assignment!.employeeId} في غرفة ${result.room!.roomNumber}`,
      actionType: "CREATE",
      module: "accommodation",
      entityType: "assignment",
      entityId: result.assignment!.id,
    });

    broadcastToProperty(propertyId, {
      module: "accommodation",
      action: "created",
      entityId: result.assignment!.id,
    });
    broadcastToProperty(propertyId, {
      module: "housing",
      action: "updated",
      entityId: result.room!.id,
    });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

    res
      .status(201)
      .json(
        GetAssignmentResponse.parse({
          ...fmtAssignment(result.assignment!),
          propertyId,
        }),
      );
  },
);

// ─── POST /assignments/:id/checkout ──────────────────────────────────────
router.post(
  "/assignments/:id/checkout",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = CheckoutAssignmentParams.safeParse(req.params);
    const parsed = CheckoutAssignmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [assignment] = await tenantDb
        .select()
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, params.data.id));
      if (!assignment) return { error: "Assignment not found", status: 404 };
      if (assignment.status !== "ACTIVE")
        return { error: "Assignment is not active", status: 409 };

      const [updated] = await tenantDb
        .update(assignmentsTable)
        .set({ status: "CHECKED_OUT", checkOutDate: parsed.data.checkOutDate })
        .where(eq(assignmentsTable.id, params.data.id))
        .returning();

      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, assignment.roomId));
      if (room) {
        const newOcc = Math.max(0, room.currentOccupancy - 1);
        await tenantDb
          .update(roomsTable)
          .set({
            currentOccupancy: newOcc,
            status: newOcc === 0 ? "available" : "occupied",
          })
          .where(eq(roomsTable.id, room.id));
      }

      return { assignment: updated, room };
    });

    if (result.error) {
      res.status(result.status).json({ error: result.error });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `مغادرة موظف #${result.assignment!.employeeId}`,
      actionType: "UPDATE",
      module: "accommodation",
      entityType: "assignment",
      entityId: result.assignment!.id,
    });

    broadcastToProperty(propertyId, {
      module: "accommodation",
      action: "checkout",
      entityId: result.assignment!.id,
    });
    if (result.room)
      broadcastToProperty(propertyId, {
        module: "housing",
        action: "updated",
        entityId: result.room.id,
      });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

    res.json(
      CheckoutAssignmentResponse.parse({
        ...fmtAssignment(result.assignment!),
        propertyId,
      }),
    );
  },
);

// ─── POST /assignments/:id/transfer ──────────────────────────────────────
router.post(
  "/assignments/:id/transfer",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = TransferAssignmentParams.safeParse(req.params);
    const parsed = TransferAssignmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [assignment] = await tenantDb
        .select()
        .from(assignmentsTable)
        .where(eq(assignmentsTable.id, params.data.id));
      if (!assignment) return { error: "Assignment not found", status: 404 };

      const [newRoom] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, parsed.data.newRoomId));
      if (!newRoom)
        return {
          error: "New room not found",
          code: "ROOM_NOT_FOUND",
          status: 404,
        };
      if (newRoom.currentOccupancy >= newRoom.capacity)
        return {
          error: `New room is full (${newRoom.capacity})`,
          code: "ROOM_FULL",
          status: 409,
        };

      // ── Bed conflict check on transfer ───────────────────────────────────
      if (parsed.data.newBedNumber) {
        const takenBeds = await tenantDb
          .select({ id: assignmentsTable.id })
          .from(assignmentsTable)
          .where(
            and(
              eq(assignmentsTable.roomId, parsed.data.newRoomId),
              eq(assignmentsTable.bedNumber, parsed.data.newBedNumber),
              eq(assignmentsTable.status, "ACTIVE"),
            ),
          );
        if (takenBeds.length > 0) {
          return {
            error: `Bed ${parsed.data.newBedNumber} in this room is already occupied`,
            code: "BED_TAKEN",
            status: 409,
          };
        }
      }

      const [oldRoom] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, assignment.roomId));
      if (oldRoom) {
        const oldOcc = Math.max(0, oldRoom.currentOccupancy - 1);
        await tenantDb
          .update(roomsTable)
          .set({
            currentOccupancy: oldOcc,
            status: oldOcc === 0 ? "available" : "occupied",
          })
          .where(eq(roomsTable.id, oldRoom.id));
      }

      const newOcc = newRoom.currentOccupancy + 1;
      await tenantDb
        .update(roomsTable)
        .set({
          currentOccupancy: newOcc,
          status: newOcc >= newRoom.capacity ? "occupied" : "available",
        })
        .where(eq(roomsTable.id, newRoom.id));

      const [updated] = await tenantDb
        .update(assignmentsTable)
        .set({
          roomId: parsed.data.newRoomId,
          bedNumber: parsed.data.newBedNumber ?? null,
        })
        .where(eq(assignmentsTable.id, params.data.id))
        .returning();

      return { updated, oldRoom, newRoom };
    });

    if (result.error) {
      res
        .status(result.status)
        .json({ error: result.error, code: result.code });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `نقل موظف #${result.updated!.employeeId} من ${result.oldRoom?.roomNumber ?? "?"} إلى ${result.newRoom!.roomNumber}`,
      actionType: "UPDATE",
      module: "accommodation",
      entityType: "assignment",
      entityId: result.updated!.id,
    });

    broadcastToProperty(propertyId, {
      module: "accommodation",
      action: "transfer",
      entityId: result.updated!.id,
    });
    broadcastToProperty(propertyId, { module: "housing", action: "updated" });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

    res.json(
      TransferAssignmentResponse.parse({
        ...fmtAssignment(result.updated!),
        propertyId,
      }),
    );
  },
);

// ─── PATCH /assignments/:id ───────────────────────────────────────────────
router.patch(
  "/assignments/:id",
  requirePermission("accommodation", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const params = UpdateAssignmentParams.safeParse(req.params);
    const parsed = UpdateAssignmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const [updated] = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .update(assignmentsTable)
        .set(parsed.data as any)
        .where(eq(assignmentsTable.id, params.data.id))
        .returning();
    });

    if (!updated) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    broadcastToProperty(propertyId, {
      module: "accommodation",
      action: "updated",
      entityId: updated.id,
    });

    res.json(
      UpdateAssignmentResponse.parse({ ...fmtAssignment(updated), propertyId }),
    );
  },
);

export default router;
