import { Router } from "express";
import { withTenant, assignmentsTable, roomsTable, profilesTable } from "@workspace/db";
import { eq, and, sql, not, count } from "drizzle-orm";
import { CheckoutAssignmentBody, CheckoutAssignmentParams, CheckoutAssignmentResponse } from "@workspace/api-zod";
import { logActivity } from "../../lib/activity-logger.js";
import { requireAnyPermission } from "../../middlewares/permissions.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import { findAssignmentAcrossAllProperties } from "../../lib/cross-property-service.js";
import { fmtAssignment } from "./shared.js";

const router: Router = Router();

// ─── POST /assignments/:id/checkout ──────────────────────────────────────
router.post(
  "/assignments/:id/checkout",
  requireAnyPermission(["accommodation", "checkout"], ["accommodation", "edit"]),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);

    const params = CheckoutAssignmentParams.safeParse(req.params);
    const parsed = CheckoutAssignmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    const rawReason = String((req.body as any)?.checkOutReason || (req.body as any)?.reason || "").trim();
    if (!rawReason) {
      res.status(400).json({ error: "سبب تسجيل الخروج والمغادرة إلزامي (Check-out reason is mandatory)" });
      return;
    }

    // Try finding assignment in propertyId first
    let assignment: any = null;
    if (propertyId) {
      try {
        [assignment] = await withTenant(propertyId, async (tenantDb) => {
          return tenantDb
            .select()
            .from(assignmentsTable)
            .where(eq(assignmentsTable.id, params.data.id))
            .limit(1);
        });
      } catch (e) {
        // Fall through to cross-property search
      }
    }

    // If not found in propertyId or propertyId wasn't passed, search all properties
    if (!assignment) {
      const crossFound = await findAssignmentAcrossAllProperties(params.data.id);
      if (crossFound) {
        propertyId = crossFound.propertyId;
        assignment = crossFound.assignment;
      }
    }

    if (!assignment) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const authUser = (req as any).authUser;
    if (authUser && !authUser.isSystemAdmin && Array.isArray(authUser.propertyIds) && authUser.propertyIds.length > 0 && !authUser.propertyIds.includes(propertyId)) {
      res.status(403).json({ error: "Access denied to the hotel where this resident is housed" });
      return;
    }

    const statusUpper = String(assignment.status || "").toUpperCase();
    if (!["ACTIVE", "VACATION", "OCCUPIED_VACATION"].includes(statusUpper)) {
      res.status(409).json({
        error: `لا يمكن تسجيل مغادرة للتسكين رقم #${assignment.id} لأن حالته الحالية هي (${assignment.status}). تسجيل الخروج متاح فقط للتسكين النشط أو المقيمين في إجازة.`,
      });
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const nowStr = new Date().toISOString();
      const checkoutDateStr = parsed.data.checkOutDate || nowStr;
      const combinedNotes = parsed.data.notes
        ? `${assignment.notes ? `${assignment.notes} | ` : ""}${parsed.data.notes}`
        : (assignment.notes || "");

      const [updated] = await tenantDb
        .update(assignmentsTable)
        .set({
          status: "CHECKED_OUT",
          checkOutDate: checkoutDateStr,
          checkOutReason: rawReason,
          notes: combinedNotes,
        })
        .where(eq(assignmentsTable.id, params.data.id))
        .returning();

      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, assignment.roomId));
      if (room) {
        const [remainingCount] = await tenantDb
          .select({ count: count() })
          .from(assignmentsTable)
          .where(
            and(
              eq(assignmentsTable.roomId, room.id),
              sql`upper(${assignmentsTable.status}) IN ('ACTIVE', 'VACATION', 'OCCUPIED_VACATION')`,
              not(eq(assignmentsTable.id, params.data.id)),
            ),
          );
        const newOcc = assignment.isEntireRoom
          ? 0
          : Number(remainingCount?.count ?? 0);
        let nextRoomStatus = newOcc === 0 ? "dirty" : "occupied_dirty";

        if (newOcc > 0) {
          // Check if remaining occupants in this room are on vacation
          const remaining = await tenantDb
            .select({
              profileId: assignmentsTable.profileId,
              status: profilesTable.status,
            })
            .from(assignmentsTable)
            .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
            .where(
              and(
                eq(assignmentsTable.roomId, room.id),
                sql`upper(${assignmentsTable.status}) IN ('ACTIVE', 'VACATION', 'OCCUPIED_VACATION')`,
                not(eq(assignmentsTable.id, params.data.id))
              )
            );
          if (remaining.length > 0 && remaining.every((r) => r.status?.toUpperCase() === "VACATION")) {
            nextRoomStatus = "occupied_vacation";
          }
        }

        await tenantDb
          .update(roomsTable)
          .set({
            currentOccupancy: newOcc,
            status: nextRoomStatus,
          })
          .where(eq(roomsTable.id, room.id));
      }

      // Workflow: Checked-out profile becomes "LEFT" (شيكاوت)
      if (assignment.profileId) {
        await tenantDb
          .update(profilesTable)
          .set({ status: "LEFT" })
          .where(eq(profilesTable.id, assignment.profileId));
      }

      return { assignment: updated, room };
    });

    const s = su(req);
    const roomNum = result.room?.roomNumber ?? "";
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تسجيل مغادرة من الغرفة رقم ${roomNum} - الموظف #${result.assignment!.profileId} (السبب: ${rawReason})`,
      actionType: "CHECKOUT",
      module: "accommodation",
      entityType: "assignment",
      entityId: result.assignment!.id,
      details: {
        roomNumber: roomNum,
        roomId: result.room?.id,
        profileId: result.assignment!.profileId,
        checkoutDate: new Date().toISOString(),
        checkoutReason: rawReason,
        performedBy: s.username,
        performedByRole: s.userRole,
      },
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

export default router;
