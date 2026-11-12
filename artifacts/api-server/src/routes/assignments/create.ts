import { Router } from "express";
import {
  withTenant,
  assignmentsTable,
  roomsTable,
  profilesTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import {
  CreateAssignmentBody,
  GetAssignmentResponse,
} from "@workspace/api-zod";
import { logActivity } from "../../lib/activity-logger.js";
import {
  requirePermission,
  hasPermission,
} from "../../middlewares/permissions.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import {
  syncProfileAcrossProperties,
  closeSourceAssignmentOnTransfer,
  findProfileAcrossAllProperties,
  deleteSourceProfileOnTransfer,
} from "../../lib/cross-property-service.js";
import {
  sendCheckInWhatsAppNotification,
  sendWelcomeWhatsAppForAssignment,
} from "../../lib/whatsapp-engine.js";
import { fmtAssignment } from "./shared.js";
import {
  DUPLICATE_STAY_ERROR,
  decidePolicy,
  evaluatePlacementPolicy,
  exceptionColumns,
  isDuplicateActiveStay,
} from "../../lib/placement-policy.js";
import { validate } from "../../middlewares/validate.js";
import { IdParams, SendWhatsAppBody } from "../../validation/schemas.js";

const router: Router = Router();

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

    const isTemporaryVacationOverride = Boolean(
      (req.body as any)?.isTemporaryVacationOverride,
    );

    // ── Cross-Property Sync & Auto-Resolution ─────────────────────────────
    const rawSourcePropertyId = (req.body as any)?.sourcePropertyId;
    let sourcePropertyId = rawSourcePropertyId
      ? Number(rawSourcePropertyId)
      : null;
    const transferType =
      (req.body as any)?.transferType === "TASK_FORCE"
        ? "TASK_FORCE"
        : "PERMANENT";
    const archiveSourceProfile =
      (req.body as any)?.archiveSourceProfile !== undefined
        ? Boolean((req.body as any)?.archiveSourceProfile)
        : transferType === "PERMANENT";
    const checkoutPreviousAssignment = Boolean(
      (req.body as any)?.checkoutPreviousAssignment ?? true,
    );

    let resolvedProfileId = parsed.data.profileId;
    let crossPropertyNoteTag = "";
    let closeSourceAfterCreate: { targetName: string } | null = null;

    // Check if the profile exists locally in the target tenant schema
    const localProfile = await withTenant(propertyId, async (tenantDb) => {
      const [found] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, parsed.data.profileId))
        .limit(1);
      return found || null;
    }).catch(() => null);

    let effectiveSourcePropId = sourcePropertyId;

    // If profile does not exist in target property, auto-discover which property owns it
    if (!localProfile && !effectiveSourcePropId) {
      const foundSource = await findProfileAcrossAllProperties(
        parsed.data.profileId,
      );
      if (foundSource && foundSource.propertyId !== propertyId) {
        effectiveSourcePropId = foundSource.propertyId;
        console.log(
          `[assignments] Auto-discovered profile #${parsed.data.profileId} in source property #${foundSource.propertyId} (${foundSource.profile.firstName} ${foundSource.profile.lastName})`,
        );
      }
    }

    if (effectiveSourcePropId && effectiveSourcePropId !== propertyId) {
      try {
        const { targetProfile, targetName, srcName } =
          await syncProfileAcrossProperties({
            sourcePropertyId: effectiveSourcePropId,
            targetPropertyId: propertyId,
            sourceProfileId: parsed.data.profileId,
            transferType,
          });
        resolvedProfileId = targetProfile.id;
        crossPropertyNoteTag =
          transferType === "TASK_FORCE"
            ? `[انتداب مؤقت من ${srcName}]`
            : `[محوّل من ${srcName}]`;

        // The source stay is closed only after the new one is created
        // (below), so a refused placement never leaves the person homeless.
        if (checkoutPreviousAssignment || archiveSourceProfile) {
          closeSourceAfterCreate = { targetName };
        }
      } catch (syncErr: any) {
        console.error("[assignments] Cross-property sync failed:", syncErr);
        res.status(500).json({
          error: `فشل مزامنة الملف الشخصي عبر الفنادق: ${syncErr.message}`,
        });
        return;
      }
    } else if (!localProfile) {
      res.status(404).json({
        error: `الملف الشخصي #${parsed.data.profileId} غير مسجل في هذا الفندق ولا في أي فندق آخر.`,
      });
      return;
    }

    const inputPhone =
      typeof (req.body as any)?.phone === "string"
        ? (req.body as any).phone.trim()
        : "";
    if (inputPhone) {
      await withTenant(propertyId, async (tenantDb) => {
        await tenantDb
          .update(profilesTable)
          .set({ phone: inputPhone })
          .where(eq(profilesTable.id, resolvedProfileId));
      }).catch((e) =>
        console.warn("[assignments] could not update phone:", e?.message),
      );
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      // Lock the room row: two people cannot take its last bed at once.
      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, parsed.data.roomId))
        .for("update");
      if (!room)
        return { error: "Room not found", code: "ROOM_NOT_FOUND", status: 404 };

      // ── 0. Person and bed must be valid ────────────────────────────────────
      const [person] = await tenantDb
        .select({ status: profilesTable.status })
        .from(profilesTable)
        .where(eq(profilesTable.id, resolvedProfileId))
        .limit(1);
      if (
        person &&
        ["TRANSFERRED", "LEFT", "TERMINATED", "RESIGNED", "ARCHIVED"].includes(
          String(person.status ?? "").toUpperCase(),
        )
      ) {
        return {
          error: `لا يمكن تسكين هذا الموظف لأن حالته (${person.status}). حدّث حالته أولاً من ملفه الشخصي.`,
          errorEn: `This employee cannot be housed while their status is ${person.status}. Update their profile first.`,
          code: "PROFILE_NOT_ELIGIBLE",
          status: 409,
        };
      }
      const requestedBed = parsed.data.bedNumber;
      if (
        requestedBed != null &&
        (requestedBed < 1 || requestedBed > (room.capacity || 1))
      ) {
        return {
          error: `رقم السرير ${requestedBed} غير موجود في الغرفة (عدد الأسرة ${room.capacity}).`,
          errorEn: `Bed ${requestedBed} does not exist in this room (${room.capacity} beds).`,
          code: "INVALID_BED",
          status: 400,
        };
      }

      // ── 1. فحص صلاحية الغرفة للتسكين ──────────────────────────────────────
      const roomStatus = room.status?.toLowerCase() || "";
      if (
        [
          "maintenance",
          "out_of_service",
          "out_of_order",
          "oos",
          "ooo",
        ].includes(roomStatus)
      ) {
        return {
          error: `لا يمكن التسكين في هذه الغرفة لأنها غير صالحة للسكن حالياً (الحالة: ${room.status}). يرجى إنهاء أعمال الصيانة أو إعادة الغرفة للخدمة أولاً.`,
          code: "ROOM_NOT_ELIGIBLE",
          status: 400,
        };
      }

      // ── 1.1 فحص ما إذا كانت الغرفة مخصصة بالكامل لموظف آخر (استخدام فردي) ──
      const [existingEntireRoom] = await tenantDb
        .select({
          id: assignmentsTable.id,
          profileId: assignmentsTable.profileId,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
        })
        .from(assignmentsTable)
        .leftJoin(
          profilesTable,
          eq(assignmentsTable.profileId, profilesTable.id),
        )
        .where(
          and(
            eq(assignmentsTable.roomId, parsed.data.roomId),
            eq(assignmentsTable.status, "ACTIVE"),
            eq(assignmentsTable.isEntireRoom, true),
          ),
        );
      if (existingEntireRoom) {
        return {
          error: `هذه الغرفة مخصصة بالكامل للموظف (${existingEntireRoom.firstName} ${existingEntireRoom.lastName}) كغرفة خاصة/فردية بالكامل. لا يمكن تسكين أي شخص إضافي عليها مطلقاً.`,
          code: "ROOM_ENTIRE_OCCUPIED",
          status: 409,
        };
      }

      const isEntireRoomRequested = Boolean(
        (parsed.data as any).isEntireRoom ||
        (req.body as any)?.isEntireRoom ||
        (parsed.data.notes &&
          parsed.data.notes.includes("[حجز الغرفة بالكامل]")) ||
        (parsed.data.notes &&
          parsed.data.notes.includes("[تسكين الغرفة بالكامل]")),
      );

      if (isEntireRoomRequested && room.currentOccupancy > 0) {
        return {
          error: `لا يمكن تخصيص الغرفة بالكامل لوجود مقيمين حاليين بها (${room.currentOccupancy} مقيم). يجب أن تكون الغرفة شاغرة تماماً لتخصيصها كغرفة فردية بالكامل.`,
          code: "ROOM_NOT_EMPTY_FOR_ENTIRE",
          status: 409,
        };
      }

      // ── فحص التسكين في غرفة بها شخص بمفرده أو حجز غرفة كاملة ───────────
      const activeAssignmentsInRoom = await tenantDb
        .select({ id: assignmentsTable.id })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.roomId, parsed.data.roomId),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );

      const effectiveOccupancy = Math.max(
        room.currentOccupancy ?? 0,
        activeAssignmentsInRoom.length,
      );
      const authUser = (req as any).authUser || (req as any).user;
      const sInfo = su(req);
      const userRole = (
        authUser?.roles?.[0] ||
        sInfo.userRole ||
        ""
      ).toLowerCase();
      const userPerms: string[] = Array.isArray(authUser?.permissions)
        ? authUser.permissions
        : [];
      const hasOverridePerm =
        [
          "super_admin",
          "system_admin",
          "admin",
          "housing_manager",
          "manager",
        ].includes(userRole) ||
        userPerms.includes("accommodation.override_single_occupancy") ||
        userPerms.includes("reservations.override_single_occupancy") ||
        (authUser &&
          (hasPermission(
            authUser,
            "accommodation",
            "override_single_occupancy",
          ) ||
            hasPermission(
              authUser,
              "reservations",
              "override_single_occupancy",
            )));

      if (room.capacity > 1 && effectiveOccupancy === 1 && !hasOverridePerm) {
        return {
          error:
            "هذه الغرفة يشغلها شخص بمفرده وبها أسِرّة شاغرة. تسكين نزيل إضافي يتطلب صلاحية إدارية استثنائية (override_single_occupancy).",
          code: "PERMISSION_DENIED_SINGLE_OCCUPANCY",
          status: 403,
        };
      }

      if (isEntireRoomRequested && room.capacity > 1 && !hasOverridePerm) {
        return {
          error:
            "حجز غرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية (override_single_occupancy).",
          code: "PERMISSION_DENIED_ENTIRE_ROOM",
          status: 403,
        };
      }

      // ── 2. منع التسكين المزدوج لنفس الموظف ─────────────────────────────────
      const existingActive = await tenantDb
        .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, resolvedProfileId),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );
      if (existingActive.length > 0) {
        return {
          error: `الموظف مسكّن بالفعل في غرفة أخرى (#${existingActive[0].roomId}). لا يمكن تسكين نفس الشخص في أكثر من مكان؛ يجب تسجيل خروجه أولاً.`,
          code: "PROFILE_ALREADY_ASSIGNED",
          existingAssignmentId: existingActive[0].id,
          existingRoomId: existingActive[0].roomId,
          status: 409,
        };
      }

      // ── 3. فحص تعارض السرير واستثناء إجازة الموظف ──────────────────────────
      let vacationOccupantFound = false;
      if (parsed.data.bedNumber && !isEntireRoomRequested) {
        const existingBedAssignments = await tenantDb
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
          .leftJoin(
            profilesTable,
            eq(assignmentsTable.profileId, profilesTable.id),
          )
          .where(
            and(
              eq(assignmentsTable.roomId, parsed.data.roomId),
              eq(assignmentsTable.bedNumber, parsed.data.bedNumber),
              eq(assignmentsTable.status, "ACTIVE"),
            ),
          );

        if (existingBedAssignments.length > 0) {
          const primaryOccupant = existingBedAssignments[0];
          const isOccupantOnVacation =
            primaryOccupant.profileStatus?.toUpperCase() === "VACATION";

          if (!isOccupantOnVacation) {
            // المقيم موجود فعلياً بالسكن: ممنوع قطعياً تسكين شخص فوق شخص
            return {
              error: `السرير رقم ${parsed.data.bedNumber} مشغول حالياً بالموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو مقيم بالسكن. ممنوع منعاً باتاً تسكين شخص فوق شخص على نفس السرير.`,
              code: "BED_TAKEN",
              status: 409,
            };
          }

          // شاغل السرير في إجازة رسمية: يتطلب صلاحية مدير السكن أو الآدمن أو صلاحية الاستثناء التفصيلية
          const vacAuthUser = (req as any).authUser || (req as any).user;
          const vacUserRole = (
            vacAuthUser?.roles?.[0] ||
            su(req).userRole ||
            ""
          ).toLowerCase();
          const vacUserPerms: string[] = Array.isArray(vacAuthUser?.permissions)
            ? vacAuthUser.permissions
            : [];
          const isManagerOrAdmin =
            ["super_admin", "system_admin", "admin", "manager"].includes(
              vacUserRole,
            ) ||
            vacUserPerms.includes("accommodation.override_vacation") ||
            vacUserPerms.includes("accommodation.edit") ||
            (vacAuthUser &&
              (hasPermission(
                vacAuthUser,
                "accommodation",
                "override_vacation" as any,
              ) ||
                hasPermission(vacAuthUser, "accommodation", "edit")));

          if (!isManagerOrAdmin) {
            return {
              error: `السرير رقم ${parsed.data.bedNumber} محجوز للموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو في إجازة. تسكين شخص بديل مؤقت يتطلب صلاحية مدير السكن أو الآدمن أو صلاحية (accommodation.override_vacation).`,
              code: "PERMISSION_DENIED_VACATION_OVERRIDE",
              status: 403,
            };
          }

          if (!isTemporaryVacationOverride) {
            return {
              error: `السرير رقم ${parsed.data.bedNumber} مخصص للموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو في إجازة حالياً${
                primaryOccupant.vacationEndDate
                  ? ` حتى تاريخ ${primaryOccupant.vacationEndDate}`
                  : ""
              }. بصفتك مسؤول السكن، هل تريد تأكيد التسكين المؤقت كبديل خلال فترة الإجازة؟`,
              code: "BED_OCCUPANT_ON_VACATION",
              occupantName: `${primaryOccupant.firstName} ${primaryOccupant.lastName}`,
              vacationEndDate: primaryOccupant.vacationEndDate,
              canOverride: true,
              status: 409,
            };
          }

          if (
            !parsed.data.expectedCheckOutDate &&
            !(req.body as any)?.expectedCheckOutDate
          ) {
            return {
              error:
                "التسكين المؤقت كبديل لموظف في إجازة يستلزم تحديد تاريخ المغادرة المتوقع لضمان عدم التعارض مع عودة المقيم الأصلي.",
              code: "MISSING_TEMPORARY_CHECKOUT_DATE",
              status: 400,
            };
          }
          vacationOccupantFound = true;
        }
      }

      // The vacation-substitute flag only applies to a bed whose resident is
      // on vacation; on its own it must not let anyone overfill a room.
      if (isTemporaryVacationOverride && !vacationOccupantFound) {
        return {
          error:
            "التسكين كبديل إجازة متاح فقط على سرير موظف في إجازة. اختار السرير ده بالتحديد.",
          errorEn:
            "A vacation substitute can only take the bed of a resident who is on vacation. Pick that bed.",
          code: "VACATION_OVERRIDE_INVALID",
          status: 400,
        };
      }

      // ── 4. فحص استيعاب الغرفة ─────────────────────────────────────────────
      if (
        room.currentOccupancy >= room.capacity &&
        !isTemporaryVacationOverride
      ) {
        return {
          error: `الغرفة مكتملة العدد (${room.capacity}/${room.capacity} سرير). لا يمكن تجاوز الطاقة الاستيعابية للغرفة مطلقاً.`,
          code: "ROOM_FULL",
          status: 409,
        };
      }

      // ── 5. سياسة السكن (نفس قواعد الشاشات) ─────────────────────────────────
      const policy = decidePolicy(
        req,
        await evaluatePlacementPolicy(tenantDb, {
          profileId: resolvedProfileId,
          roomId: parsed.data.roomId,
          isEntireRoom: isEntireRoomRequested,
        }),
        req.body,
      );
      if (!policy.ok) {
        return { ...policy.body, status: policy.status };
      }

      const newOccupancy = isEntireRoomRequested
        ? room.capacity
        : isTemporaryVacationOverride
          ? room.currentOccupancy
          : room.currentOccupancy + 1;

      // A room that still needs cleaning stays flagged for housekeeping.
      const wasDirty = ["dirty", "occupied_dirty"].includes(
        String(room.status ?? "").toLowerCase(),
      );
      await tenantDb
        .update(roomsTable)
        .set({
          currentOccupancy: newOccupancy,
          // Workflow: Room with active guest becomes "occupied"
          status: wasDirty ? "occupied_dirty" : "occupied",
        })
        .where(eq(roomsTable.id, parsed.data.roomId));

      // Workflow: Checked-in profile becomes "ACTIVE" (ان هاوس)
      if (resolvedProfileId) {
        await tenantDb
          .update(profilesTable)
          .set({ status: "ACTIVE" })
          .where(eq(profilesTable.id, resolvedProfileId));
      }

      // Fallback: If no expected check-out date is given, pull contractEndDate for internal employees
      let expectedCheckOut = parsed.data.expectedCheckOutDate;
      if (!expectedCheckOut && resolvedProfileId) {
        const [prof] = await tenantDb
          .select({
            contractEndDate: profilesTable.contractEndDate,
            employmentType: profilesTable.employmentType,
          })
          .from(profilesTable)
          .where(eq(profilesTable.id, resolvedProfileId))
          .limit(1);
        if (prof?.contractEndDate && prof.employmentType !== "THIRD_PARTY") {
          try {
            expectedCheckOut = new Date(prof.contractEndDate).toISOString();
          } catch {
            expectedCheckOut = prof.contractEndDate;
          }
        }
      }

      const {
        hasPolicyException,
        policyExceptionReason,
        policyApprovedBy,
        notePrefix: policyNote,
      } = exceptionColumns(policy.exception);

      let finalNotes = parsed.data.notes || "";
      if (crossPropertyNoteTag) {
        finalNotes = `${crossPropertyNoteTag} ${finalNotes}`.trim();
      }
      if (isEntireRoomRequested) {
        finalNotes =
          `[تسكين الغرفة بالكامل - استخدام فردي] ${finalNotes}`.trim();
      }
      if (isTemporaryVacationOverride) {
        finalNotes =
          `[تسكين مؤقت بديل إجازة بتصريح الإدارة] ${finalNotes}`.trim();
      }
      if (policyNote) {
        finalNotes = `${policyNote} ${finalNotes}`.trim();
      }

      const [assignment] = await tenantDb
        .insert(assignmentsTable)
        .values({
          ...(parsed.data as any),
          profileId: resolvedProfileId,
          bedNumber: isEntireRoomRequested
            ? parsed.data.bedNumber || 1
            : (parsed.data.bedNumber ?? null),
          isEntireRoom: isEntireRoomRequested,
          hasPolicyException,
          policyExceptionReason,
          policyApprovedBy,
          notes: finalNotes,
          expectedCheckOutDate: expectedCheckOut || undefined,
          status: "ACTIVE",
        })
        .returning();

      return {
        assignment,
        room,
        policyException: policy.exception,
        policyWarnings: policy.warnings,
      };
    }).catch((err) => {
      // Two simultaneous check-ins of one person: the database keeps one.
      if (isDuplicateActiveStay(err)) {
        return { ...DUPLICATE_STAY_ERROR, status: 409 } as any;
      }
      throw err;
    });

    if (result.error) {
      res.status(result.status).json({
        error: result.error,
        errorEn: (result as any).errorEn,
        violations: (result as any).violations,
        code: result.code,
        existingAssignmentId: result.existingAssignmentId,
        existingRoomId: result.existingRoomId,
        occupantName: (result as any).occupantName,
        vacationEndDate: (result as any).vacationEndDate,
        canOverride: (result as any).canOverride,
      });
      return;
    }

    const s = su(req);
    const roomNum = result.room?.roomNumber ?? "";
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: isTemporaryVacationOverride
        ? `تسكين موظف في الغرفة رقم ${roomNum} سرير ${result.assignment!.bedNumber} (مؤقت بديل إجازة) - الموظف #${result.assignment!.profileId}`
        : `تسكين موظف في الغرفة رقم ${roomNum} سرير ${result.assignment!.bedNumber} - الموظف #${result.assignment!.profileId}`,
      actionType: "CREATE",
      module: "accommodation",
      entityType: "assignment",
      entityId: result.assignment!.id,
      details: {
        roomNumber: roomNum,
        roomId: result.room?.id,
        bedNumber: result.assignment!.bedNumber,
        profileId: result.assignment!.profileId,
        isTemporaryVacationOverride,
        assignedBy: s.username,
        assignedByRole: s.userRole,
        policyException: result.policyException ?? undefined,
        policyWarnings: result.policyWarnings?.length
          ? result.policyWarnings.map((v: any) => v.code)
          : undefined,
      },
    });

    // Cross-property: end the stay in the other hotel now that this one exists.
    if (closeSourceAfterCreate && effectiveSourcePropId) {
      await closeSourceAssignmentOnTransfer(
        effectiveSourcePropId,
        parsed.data.profileId,
        closeSourceAfterCreate.targetName,
        archiveSourceProfile,
      ).catch((e) =>
        console.error(
          "[assignments] closing the source stay after transfer failed:",
          e?.message,
        ),
      );
    }

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

    if (
      effectiveSourcePropId &&
      effectiveSourcePropId !== propertyId &&
      archiveSourceProfile
    ) {
      await deleteSourceProfileOnTransfer(
        effectiveSourcePropId,
        parsed.data.profileId,
        undefined,
        true,
      ).catch((delErr) => {
        console.warn(
          "[assignments] deleteSourceProfileOnTransfer in POST /assignments warning:",
          delErr?.message,
        );
      });
    }

    // ── WhatsApp Welcome & Check-in Notification ─────────────────────────
    sendCheckInWhatsAppNotification({
      propertyId,
      profileId: result.assignment!.profileId,
      roomId: result.assignment!.roomId,
      bedId: (result.assignment as any)?.bedId || null,
      startDate: result.assignment!.checkInDate,
    }).catch((err) => {
      console.error(
        "[WhatsApp Hook] Error sending check-in notification:",
        err,
      );
    });

    res.status(201).json(
      GetAssignmentResponse.parse({
        ...fmtAssignment(result.assignment!),
        propertyId,
      }),
    );
  },
);

// ─── POST /assignments/:id/send-whatsapp ─────────────────────────────────
router.post(
  "/assignments/:id/send-whatsapp",
  requirePermission("accommodation", "view"),
  validate({ params: IdParams }),
  validate({ body: SendWhatsAppBody }),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }
    const id = parseInt(String(req.params.id));
    if (isNaN(id)) {
      res.status(400).json({ error: "Invalid assignment id" });
      return;
    }
    const phoneOverride =
      typeof req.body?.phone === "string" ? req.body.phone.trim() : undefined;

    try {
      const result = await sendWelcomeWhatsAppForAssignment({
        propertyId,
        assignmentId: id,
        phoneOverride,
      });

      if (!result.success) {
        res.status(400).json({ error: result.error });
        return;
      }

      res.json({ success: true, message: result.message });
    } catch (err: any) {
      console.error("[assignments] send-whatsapp error:", err?.message || err);
      res
        .status(500)
        .json({ error: err?.message || "Failed to send WhatsApp message" });
    }
  },
);

export default router;
