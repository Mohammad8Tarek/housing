import { Router } from "express";
import { db, withTenant, assignmentsTable, roomsTable, profilesTable } from "@workspace/db";
import { eq, and, or, ilike, sql, SQL, desc, not } from "drizzle-orm";
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

// ─── GET /assignments/in-house ────────────────────────────────────────────────
router.get(
  "/assignments/in-house",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = req.query as any;
    const page = Math.max(1, parseInt(query.page || "1"));
    const limit = Math.max(1, parseInt(query.limit || "10"));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [eq(assignmentsTable.status, "ACTIVE")];

    if (query.status) {
      conditions.push(eq(assignmentsTable.status, query.status));
    }
    if (query.buildingId) {
      conditions.push(eq(roomsTable.buildingId, parseInt(query.buildingId)));
    }
    if (query.floorId) {
      conditions.push(eq(roomsTable.floorId, parseInt(query.floorId)));
    }
    if (query.search) {
      const q = `%${query.search}%`;
      conditions.push(
        or(
          ilike(profilesTable.firstName, q),
          ilike(profilesTable.lastName, q),
          ilike(profilesTable.profileId, q),
          ilike(roomsTable.roomNumber, q)
        )!
      );
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const baseQuery = tenantDb
        .select({
          id: assignmentsTable.id,
          assignment: assignmentsTable
        })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .where(and(...conditions));

      const countResult = await tenantDb
        .select({ count: sql<number>`count(*)` })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .where(and(...conditions));

      const total = Number(countResult[0]?.count || 0);

      const items = await baseQuery
        .orderBy(desc(assignmentsTable.createdAt))
        .limit(limit)
        .offset(offset);

      return { total, data: items.map(i => i.assignment) };
    });

    res.json({
      data: result.data.map((a) => fmtAssignment({ ...a, propertyId })),
      pagination: {
        total: result.total,
        page,
        limit
      }
    });
  },
);

// ─── GET /assignments/history ────────────────────────────────────────────────
router.get(
  "/assignments/history",
  requirePermission("accommodation", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = req.query as any;
    const page = Math.max(1, parseInt(query.page || "1"));
    const limit = Math.max(1, parseInt(query.limit || "20"));
    const offset = (page - 1) * limit;

    const conditions: SQL[] = [sql`${assignmentsTable.status} != 'ACTIVE'`];

    if (query.status && query.status !== "ALL") {
      conditions.push(eq(assignmentsTable.status, query.status));
    }
    if (query.search) {
      const q = `%${query.search}%`;
      conditions.push(
        or(
          ilike(profilesTable.firstName, q),
          ilike(profilesTable.lastName, q),
          ilike(profilesTable.profileId, q),
          ilike(roomsTable.roomNumber, q)
        )!
      );
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const baseQuery = tenantDb
        .select({
          id: assignmentsTable.id,
          assignment: assignmentsTable
        })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .where(and(...conditions));

      const countResult = await tenantDb
        .select({ count: sql<number>`count(*)` })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .where(and(...conditions));

      const total = Number(countResult[0]?.count || 0);

      const items = await baseQuery
        .orderBy(desc(assignmentsTable.createdAt))
        .limit(limit)
        .offset(offset);

      return { total, data: items.map(i => i.assignment) };
    });

    res.json({
      data: result.data.map((a) => fmtAssignment({ ...a, propertyId })),
      pagination: {
        total: result.total,
        page,
        limit
      }
    });
  },
);


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
      if (query.data.profileId)
        conditions.push(eq(assignmentsTable.profileId, query.data.profileId));
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

    const isTemporaryVacationOverride = Boolean((req.body as any)?.isTemporaryVacationOverride);

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [room] = await tenantDb
        .select()
        .from(roomsTable)
        .where(eq(roomsTable.id, parsed.data.roomId));
      if (!room)
        return { error: "Room not found", code: "ROOM_NOT_FOUND", status: 404 };

      // ── 1. فحص صلاحية الغرفة للتسكين ──────────────────────────────────────
      const roomStatus = room.status?.toLowerCase() || "";
      if (["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(roomStatus)) {
        return {
          error: `لا يمكن التسكين في هذه الغرفة لأنها غير صالحة للسكن حالياً (الحالة: ${room.status}). يرجى إنهاء أعمال الصيانة أو إعادة الغرفة للخدمة أولاً.`,
          code: "ROOM_NOT_ELIGIBLE",
          status: 400,
        };
      }

      // ── 2. منع التسكين المزدوج لنفس الموظف ─────────────────────────────────
      const existingActive = await tenantDb
        .select({ id: assignmentsTable.id, roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, parsed.data.profileId),
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
      if (parsed.data.bedNumber) {
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
          .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
          .where(
            and(
              eq(assignmentsTable.roomId, parsed.data.roomId),
              eq(assignmentsTable.bedNumber, parsed.data.bedNumber),
              eq(assignmentsTable.status, "ACTIVE"),
            ),
          );

        if (existingBedAssignments.length > 0) {
          const primaryOccupant = existingBedAssignments[0];
          const isOccupantOnVacation = primaryOccupant.profileStatus?.toUpperCase() === "VACATION";

          if (!isOccupantOnVacation) {
            // المقيم موجود فعلياً بالسكن: ممنوع قطعياً تسكين شخص فوق شخص
            return {
              error: `السرير رقم ${parsed.data.bedNumber} مشغول حالياً بالموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو مقيم بالسكن. ممنوع منعاً باتاً تسكين شخص فوق شخص على نفس السرير.`,
              code: "BED_TAKEN",
              status: 409,
            };
          }

          // شاغل السرير في إجازة رسمية: يتطلب صلاحية مدير السكن أو الآدمن
          const isManagerOrAdmin = ["super_admin", "system_admin", "admin", "manager"].includes(
            su(req).userRole?.toLowerCase() || "",
          );

          if (!isManagerOrAdmin) {
            return {
              error: `السرير رقم ${parsed.data.bedNumber} محجوز للموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو في إجازة. تسكين شخص بديل مؤقت يتطلب صلاحية مدير السكن أو الآدمن فقط.`,
              code: "PERMISSION_DENIED_VACATION_OVERRIDE",
              status: 403,
            };
          }

          if (!isTemporaryVacationOverride) {
            return {
              error: `السرير رقم ${parsed.data.bedNumber} مخصص للموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو في إجازة حالياً${
                primaryOccupant.vacationEndDate ? ` حتى تاريخ ${primaryOccupant.vacationEndDate}` : ""
              }. بصفتك مسؤول السكن، هل تريد تأكيد التسكين المؤقت كبديل خلال فترة الإجازة؟`,
              code: "BED_OCCUPANT_ON_VACATION",
              occupantName: `${primaryOccupant.firstName} ${primaryOccupant.lastName}`,
              vacationEndDate: primaryOccupant.vacationEndDate,
              canOverride: true,
              status: 409,
            };
          }

          if (!parsed.data.expectedCheckOutDate && !(req.body as any)?.expectedCheckOutDate) {
            return {
              error: "التسكين المؤقت كبديل لموظف في إجازة يستلزم تحديد تاريخ المغادرة المتوقع لضمان عدم التعارض مع عودة المقيم الأصلي.",
              code: "MISSING_TEMPORARY_CHECKOUT_DATE",
              status: 400,
            };
          }
        }
      }

      // ── 4. فحص استيعاب الغرفة ─────────────────────────────────────────────
      if (room.currentOccupancy >= room.capacity && !isTemporaryVacationOverride) {
        return {
          error: `الغرفة مكتملة العدد (${room.capacity}/${room.capacity} سرير). لا يمكن تجاوز الطاقة الاستيعابية للغرفة مطلقاً.`,
          code: "ROOM_FULL",
          status: 409,
        };
      }

      const newOccupancy = isTemporaryVacationOverride
        ? room.currentOccupancy
        : room.currentOccupancy + 1;

      await tenantDb
        .update(roomsTable)
        .set({
          currentOccupancy: newOccupancy,
          // Workflow: Room with active guest becomes "occupied"
          status: "occupied",
        })
        .where(eq(roomsTable.id, parsed.data.roomId));

      // Workflow: Checked-in profile becomes "ACTIVE" (ان هاوس)
      if (parsed.data.profileId) {
        await tenantDb
          .update(profilesTable)
          .set({ status: "ACTIVE" })
          .where(eq(profilesTable.id, parsed.data.profileId));
      }

      // Fallback: If no expected check-out date is given, pull contractEndDate for internal employees
      let expectedCheckOut = parsed.data.expectedCheckOutDate;
      if (!expectedCheckOut && parsed.data.profileId) {
        const [prof] = await tenantDb
          .select({ contractEndDate: profilesTable.contractEndDate, employmentType: profilesTable.employmentType })
          .from(profilesTable)
          .where(eq(profilesTable.id, parsed.data.profileId))
          .limit(1);
        if (prof?.contractEndDate && prof.employmentType !== "THIRD_PARTY") {
          try {
            expectedCheckOut = new Date(prof.contractEndDate).toISOString();
          } catch {
            expectedCheckOut = prof.contractEndDate;
          }
        }
      }

      let finalNotes = parsed.data.notes || "";
      if (isTemporaryVacationOverride) {
        finalNotes = `[تسكين مؤقت بديل إجازة بتصريح الإدارة] ${finalNotes}`.trim();
      }

      const [assignment] = await tenantDb
        .insert(assignmentsTable)
        .values({
          ...(parsed.data as any),
          notes: finalNotes,
          expectedCheckOutDate: expectedCheckOut || undefined,
          status: "ACTIVE",
        })
        .returning();

      return { assignment, room };
    });

    if (result.error) {
      res.status(result.status).json({
        error: result.error,
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
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: isTemporaryVacationOverride
        ? `تسكين موظف #${result.assignment!.profileId} (مؤقت بديل إجازة) في غرفة ${result.room!.roomNumber} سرير ${result.assignment!.bedNumber}`
        : `تسكين موظف #${result.assignment!.profileId} في غرفة ${result.room!.roomNumber}`,
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

    res.status(201).json(
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
                eq(assignmentsTable.status, "ACTIVE"),
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
      action: `مغادرة موظف #${result.assignment!.profileId}`,
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

    const isTemporaryVacationOverride = Boolean((req.body as any)?.isTemporaryVacationOverride);

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

      // ── فحص صلاحية الغرفة الجديدة ─────────────────────────────────────────
      const newRoomStatus = newRoom.status?.toLowerCase() || "";
      if (["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(newRoomStatus)) {
        return {
          error: `لا يمكن نقل الموظف إلى هذه الغرفة لأنها غير صالحة للسكن حالياً (الحالة: ${newRoom.status}). يرجى إنهاء أعمال الصيانة أولاً.`,
          code: "ROOM_NOT_ELIGIBLE",
          status: 400,
        };
      }

      // ── فحص السرير في الغرفة الجديدة ───────────────────────────────────────
      if (parsed.data.newBedNumber) {
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

          const isManagerOrAdmin = ["super_admin", "system_admin", "admin", "manager"].includes(
            su(req).userRole?.toLowerCase() || "",
          );

          if (!isManagerOrAdmin) {
            return {
              error: `السرير رقم ${parsed.data.newBedNumber} محجوز للموظف (${primaryOccupant.firstName} ${primaryOccupant.lastName}) وهو في إجازة. النقل المؤقت كبديل يتطلب صلاحية مدير السكن أو الآدمن.`,
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
        const oldOcc = Math.max(0, oldRoom.currentOccupancy - 1);
        await tenantDb
          .update(roomsTable)
          .set({
            currentOccupancy: oldOcc,
            status: oldOcc === 0 ? "dirty" : "occupied_dirty",
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
      action: `نقل موظف #${result.updated!.profileId} من ${result.oldRoom?.roomNumber ?? "?"} إلى ${result.newRoom!.roomNumber}`,
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
