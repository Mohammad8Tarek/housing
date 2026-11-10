import { Router } from "express";
import { db, withTenant, assignmentsTable, roomsTable, profilesTable, buildingsTable, roomMovesTable } from "@workspace/db";
import { eq, and, sql, not, count } from "drizzle-orm";
import { TransferAssignmentBody, TransferAssignmentParams, TransferAssignmentResponse } from "@workspace/api-zod";
import { logActivity } from "../../lib/activity-logger.js";
import { requireAnyPermission, hasPermission } from "../../middlewares/permissions.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import { executeCrossPropertyTransfer, findAssignmentAcrossAllProperties } from "../../lib/cross-property-service.js";
import { fmtAssignment } from "./shared.js";

const router: Router = Router();

// ─── POST /assignments/:id/transfer ──────────────────────────────────────
router.post(
  "/assignments/:id/transfer",
  requireAnyPermission(["accommodation", "transfer"], ["accommodation", "edit"]),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);

    const params = TransferAssignmentParams.safeParse(req.params);
    const parsed = TransferAssignmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
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
        // Fall through
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

    const asgnStatusUpper = String(assignment.status || "").toUpperCase();
    if (!["ACTIVE", "VACATION", "OCCUPIED_VACATION"].includes(asgnStatusUpper)) {
      res.status(409).json({ 
        error: `لا يمكن نقل الموظف لأن حالة الإقامة الحالية هي (${assignment.status}). النقل متاح فقط للتسكين النشط أو المقيمين في إجازة.` 
      });
      return;
    }

    const isTemporaryVacationOverride = Boolean((req.body as any)?.isTemporaryVacationOverride);

    const rawTargetPropertyId = (req.body as any)?.targetPropertyId;
    const targetPropertyId = rawTargetPropertyId ? Number(rawTargetPropertyId) : null;

    if (targetPropertyId && targetPropertyId !== propertyId) {
      const crossResult = await executeCrossPropertyTransfer({
        sourcePropertyId: propertyId,
        targetPropertyId,
        assignmentId: params.data.id,
        newRoomId: parsed.data.newRoomId,
        newBedNumber: parsed.data.newBedNumber,
        transferReason: parsed.data.transferReason,
        isEntireRoom: Boolean((req.body as any)?.isEntireRoom),
        isTemporaryVacationOverride,
        hasPolicyException: Boolean((req.body as any)?.hasPolicyException),
        policyExceptionReason: (req.body as any)?.policyExceptionReason || null,
        policyApprovedBy: (req.body as any)?.policyApprovedBy || null,
        archiveSourceProfile: (req.body as any)?.archiveSourceProfile !== undefined
          ? Boolean((req.body as any)?.archiveSourceProfile)
          : true,
        req,
      });

      if ("error" in crossResult) {
        res.status(crossResult.status || 400).json(crossResult);
        return;
      }

      res.json(
        TransferAssignmentResponse.parse({
          ...fmtAssignment((crossResult as any).updated),
          propertyId: targetPropertyId,
        })
      );
      return;
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
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

      // ── فحص صلاحية الغرفة الجديدة ─────────────────────────────────────────
      const newRoomStatus = newRoom.status?.toLowerCase() || "";
      if (["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(newRoomStatus)) {
        return {
          error: `لا يمكن نقل الموظف إلى هذه الغرفة لأنها غير صالحة للسكن حالياً (الحالة: ${newRoom.status}). يرجى إنهاء أعمال الصيانة أولاً.`,
          code: "ROOM_NOT_ELIGIBLE",
          status: 400,
        };
      }

      // ── فحص ما إذا كانت الغرفة الجديدة محجوزة بالكامل لموظف آخر (استخدام فردي) ──
      const [existingEntireRoomInNew] = await tenantDb
        .select({
          id: assignmentsTable.id,
          profileId: assignmentsTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
        })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .where(
          and(
            eq(assignmentsTable.roomId, parsed.data.newRoomId),
            eq(assignmentsTable.status, "ACTIVE"),
            eq(assignmentsTable.isEntireRoom, true),
          ),
        );
      if (existingEntireRoomInNew) {
        return {
          error: `الغرفة الجديدة مخصصة بالكامل لموظف آخر (${existingEntireRoomInNew.firstName} ${existingEntireRoomInNew.lastName}) كغرفة خاصة/فردية بالكامل. لا يمكن النقل إليها.`,
          code: "ROOM_ENTIRE_OCCUPIED",
          status: 409,
        };
      }

      const isEntireRoomRequested = Boolean(
        (req.body as any)?.isEntireRoom || (assignment.isEntireRoom && newRoom.currentOccupancy === 0)
      );

      if (isEntireRoomRequested && newRoom.currentOccupancy > 0) {
        return {
          error: `لا يمكن تخصيص الغرفة الجديدة بالكامل لوجود مقيمين حاليين بها (${newRoom.currentOccupancy} مقيم). يجب أن تكون الغرفة شاغرة تماماً لتخصيصها كغرفة فردية بالكامل.`,
          code: "ROOM_NOT_EMPTY_FOR_ENTIRE",
          status: 409,
        };
      }

      // ── فحص السرير في الغرفة الجديدة ───────────────────────────────────────
      if (parsed.data.newBedNumber && !isEntireRoomRequested) {
        const takenBeds = await tenantDb
          .select({
            id: assignmentsTable.id,
            profileId: assignmentsTable.profileId,
            firstName: profilesTable.firstName,
            lastName: profilesTable.lastName,
            profileStatus: profilesTable.status,
            vacationStartDate: profilesTable.vacationStartDate,
            vacationEndDate: profilesTable.vacationEndDate,
          })
          .from(assignmentsTable)
          .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
          .where(
            and(
              eq(assignmentsTable.roomId, parsed.data.newRoomId),
              eq(assignmentsTable.bedNumber, parsed.data.newBedNumber),
              eq(assignmentsTable.status, "ACTIVE"),
            ),
          );

        if (takenBeds.length > 0) {
          const primaryOccupant = takenBeds[0];
          const isOccupantOnVacation = primaryOccupant.profileStatus?.toUpperCase() === "VACATION";

          if (!isOccupantOnVacation) {
            return {
              error: `السرير رقم ${parsed.data.newBedNumber} في الغرفة الجديدة مشغول حالياً بالموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}). لا يمكن نقل موظف فوق موظف على نفس السرير.`,
              code: "BED_TAKEN",
              status: 409,
            };
          }

          const transAuthUser = (req as any).authUser || (req as any).user;
          const transUserRole = (transAuthUser?.roles?.[0] || su(req).userRole || "").toLowerCase();
          const transUserPerms: string[] = Array.isArray(transAuthUser?.permissions) ? transAuthUser.permissions : [];
          const isManagerOrAdmin =
            ["super_admin", "system_admin", "admin", "manager"].includes(transUserRole) ||
            transUserPerms.includes("accommodation.override_vacation") ||
            transUserPerms.includes("accommodation.transfer") ||
            transUserPerms.includes("accommodation.edit") ||
            (transAuthUser && (hasPermission(transAuthUser, "accommodation", "transfer") || hasPermission(transAuthUser, "accommodation", "edit")));

          if (!isManagerOrAdmin) {
            return {
              error: `السرير رقم ${parsed.data.newBedNumber} محجوز للموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو في إجازة. النقل المؤقت كبديل يتطلب صلاحية مدير السكن أو الآدمن أو صلاحية (accommodation.transfer).`,
              code: "PERMISSION_DENIED_VACATION_OVERRIDE",
              status: 403,
            };
          }

          if (!isTemporaryVacationOverride) {
            return {
              error: `السرير رقم ${parsed.data.newBedNumber} محجوز للموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو حالياً في إجازة${
                primaryOccupant.vacationEndDate ? ` حتى تاريخ ${primaryOccupant.vacationEndDate}` : ""
              }. هل ترغب في تأكيد النقل المؤقت كبديل خلال فترة الإجازة؟`,
              code: "BED_OCCUPANT_ON_VACATION",
              occupantName: `${primaryOccupant.firstName} ${primaryOccupant.lastName}`,
              vacationEndDate: primaryOccupant.vacationEndDate,
              canOverride: true,
              status: 409,
            };
          }
        }
      }

      if (newRoom.currentOccupancy >= newRoom.capacity && !isTemporaryVacationOverride) {
        return {
          error: `الغرفة الجديدة ممتلئة تماماً (${newRoom.capacity}/${newRoom.capacity} سرير). لا يمكن تجاوز الطاقة الاستيعابية.`,
          code: "ROOM_FULL",
          status: 409,
        };
      }

      const [oldRoom] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, assignment.roomId));
      if (oldRoom) {
        const [oldRemaining] = await tenantDb
          .select({ count: count() })
          .from(assignmentsTable)
          .where(
            and(
              eq(assignmentsTable.roomId, oldRoom.id),
              sql`upper(${assignmentsTable.status}) IN ('ACTIVE', 'VACATION', 'OCCUPIED_VACATION')`,
              not(eq(assignmentsTable.id, assignment.id)),
            ),
          );
        const oldOcc = assignment.isEntireRoom
          ? 0
          : Number(oldRemaining?.count ?? 0);
        await tenantDb
          .update(roomsTable)
          .set({
            currentOccupancy: oldOcc,
            status: oldOcc === 0 ? "dirty" : "occupied_dirty",
          })
          .where(eq(roomsTable.id, oldRoom.id));
      }

      const [newRemaining] = await tenantDb
        .select({ count: count() })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.roomId, newRoom.id),
            sql`upper(${assignmentsTable.status}) IN ('ACTIVE', 'VACATION', 'OCCUPIED_VACATION')`,
          ),
        );
      const newOcc = isEntireRoomRequested
        ? newRoom.capacity
        : (isTemporaryVacationOverride ? Number(newRemaining?.count ?? 0) : Number(newRemaining?.count ?? 0) + 1);

      await tenantDb
        .update(roomsTable)
        .set({
          currentOccupancy: newOcc,
          status: newOcc > 0 ? "occupied" : "available",
        })
        .where(eq(roomsTable.id, newRoom.id));

      // Archive previous stay in old room to history as TRANSFERRED
      const nowStr = new Date().toISOString();
      await tenantDb.insert(assignmentsTable).values({
        profileId: assignment.profileId,
        roomId: assignment.roomId,
        bedNumber: assignment.bedNumber,
        isEntireRoom: assignment.isEntireRoom,
        checkInDate: assignment.checkInDate,
        expectedCheckOutDate: assignment.expectedCheckOutDate,
        checkOutDate: nowStr,
        notes: assignment.notes
          ? `${assignment.notes} | تم النقل إلى الغرفة ${newRoom.roomNumber}`
          : `تم النقل إلى الغرفة ${newRoom.roomNumber}`,
        status: "TRANSFERRED",
      });

      const [updated] = await tenantDb
        .update(assignmentsTable)
        .set({
          roomId: parsed.data.newRoomId,
          bedNumber: isEntireRoomRequested ? (parsed.data.newBedNumber || 1) : (parsed.data.newBedNumber ?? null),
          isEntireRoom: isEntireRoomRequested,
          checkInDate: nowStr,
          hasPolicyException: (req.body as any)?.hasPolicyException !== undefined
            ? Boolean((req.body as any)?.hasPolicyException)
            : assignment.hasPolicyException,
          policyExceptionReason: (req.body as any)?.policyExceptionReason || assignment.policyExceptionReason || null,
          policyApprovedBy: (req.body as any)?.policyApprovedBy || assignment.policyApprovedBy || null,
          notes: [
            assignment.notes,
            `تم النقل من الغرفة ${oldRoom?.roomNumber || assignment.roomId} إلى الغرفة ${newRoom.roomNumber}`,
            parsed.data.transferReason
              ? `السبب: ${parsed.data.transferReason}`
              : null,
          ].filter(Boolean).join(" | "),
        })
        .where(eq(assignmentsTable.id, params.data.id))
        .returning();

      const [prof] = await tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          firstNameAr: profilesTable.firstNameAr,
          lastNameAr: profilesTable.lastNameAr,
          department: profilesTable.department,
          jobTitle: profilesTable.jobTitle,
        })
        .from(profilesTable)
        .where(eq(profilesTable.id, assignment.profileId));

      const [oldBld] = oldRoom?.buildingId
        ? await tenantDb.select().from(buildingsTable).where(eq(buildingsTable.id, oldRoom.buildingId))
        : [null];
      const [newBld] = newRoom.buildingId
        ? await tenantDb.select().from(buildingsTable).where(eq(buildingsTable.id, newRoom.buildingId))
        : [null];

      return { error: undefined, updated, oldRoom, newRoom, prof, oldBld, newBld, oldBedNumber: assignment.bedNumber };
    });

    if (result.error) {
      res
        .status((result as any).status || 400)
        .json({ error: result.error, code: (result as any).code });
      return;
    }

    const transferData = result as {
      updated: any;
      oldRoom: any;
      newRoom: any;
      prof: any;
      oldBld: any;
      newBld: any;
      oldBedNumber: any;
    };

    const s = su(req);
    const oldRoomNum = transferData.oldRoom?.roomNumber ?? "?";
    const newRoomNum = transferData.newRoom?.roomNumber ?? "?";
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `نقل موظف #${transferData.updated?.profileId} من الغرفة رقم ${oldRoomNum} إلى الغرفة رقم ${newRoomNum}`,
      actionType: "TRANSFER",
      module: "accommodation",
      entityType: "assignment",
      entityId: transferData.updated?.id,
      details: {
        fromRoomNumber: oldRoomNum,
        toRoomNumber: newRoomNum,
        fromRoomId: transferData.oldRoom?.id,
        toRoomId: transferData.newRoom?.id,
        profileId: transferData.updated?.profileId,
        transferredBy: s.username,
        transferredByRole: s.userRole,
      },
    });

    // ── Record in Room Moves Log ──
    try {
      const p = transferData.prof;
      const residentName = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : `Profile #${transferData.updated?.profileId}`;
      const residentNameEn = p ? `${p.firstName || ""} ${p.lastName || ""}`.trim() : null;
      const residentNameAr = p?.firstNameAr || p?.lastNameAr ? `${p.firstNameAr || ""} ${p.lastNameAr || ""}`.trim() : residentName;

      await db.insert(roomMovesTable).values({
        propertyId,
        assignmentId: transferData.updated?.id,
        profileId: transferData.updated?.profileId,
        employeeId: p?.profileId || null,
        residentName: residentNameAr,
        residentNameEn: residentNameEn,
        department: p?.department || null,
        jobTitle: p?.jobTitle || null,
        oldRoomId: transferData.oldRoom?.id || null,
        oldRoomNumber: oldRoomNum,
        oldBedNumber: transferData.oldBedNumber || null,
        oldBuildingName: transferData.oldBld?.name || null,
        oldRoomType: transferData.oldRoom?.roomType || null,
        newRoomId: transferData.newRoom?.id || parsed.data.newRoomId,
        newRoomNumber: newRoomNum,
        newBedNumber: transferData.updated?.bedNumber || null,
        newBuildingName: transferData.newBld?.name || null,
        newRoomType: transferData.newRoom?.roomType || null,
        moveReason: parsed.data.transferReason || "نقل سرير / غرفة",
        reasonCode: parsed.data.transferReason ? "REASON_SPECIFIED" : "GENERAL",
        actionByUserId: s.userId || null,
        actionByUsername: s.username || "System",
      });
    } catch (moveErr) {
      console.warn("Failed to insert into room_moves:", moveErr);
    }

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

export default router;
