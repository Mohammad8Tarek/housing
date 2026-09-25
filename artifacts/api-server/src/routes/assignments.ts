import { Router } from "express";
import { db, pool, withTenant, assignmentsTable, roomsTable, profilesTable, buildingsTable, floorsTable, roomMovesTable } from "@workspace/db";
import { eq, and, or, ilike, sql, SQL, desc, not, count } from "drizzle-orm";
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
import { requirePermission, requireAnyPermission, hasPermission } from "../middlewares/permissions.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { getTenantId, su } from "../lib/request-utils.js";
import {
  syncProfileAcrossProperties,
  closeSourceAssignmentOnTransfer,
  executeCrossPropertyTransfer,
  findProfileAcrossAllProperties,
  findAssignmentAcrossAllProperties,
  deleteSourceProfileOnTransfer,
} from "../lib/cross-property-service.js";
import { sendCheckInWhatsAppNotification, sendWelcomeWhatsAppForAssignment } from "../lib/whatsapp-engine.js";

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
  const out: Record<string, any> = { ...r, notes: r.notes ?? "" };
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

    const conditions: SQL[] = [];

    if (query.status && String(query.status).toUpperCase() !== "ALL") {
      conditions.push(eq(assignmentsTable.status, query.status));
    } else if (!query.status) {
      conditions.push(eq(assignmentsTable.status, "ACTIVE"));
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
          ilike(profilesTable.firstNameAr, q),
          ilike(profilesTable.lastNameAr, q),
          ilike(profilesTable.profileId, q),
          ilike(profilesTable.department, q),
          ilike(profilesTable.departmentAr, q),
          ilike(profilesTable.jobTitle, q),
          ilike(profilesTable.jobTitleAr, q),
          ilike(profilesTable.nationality, q),
          ilike(roomsTable.roomNumber, q),
          ilike(buildingsTable.name, q)
        )!
      );
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const baseQuery = tenantDb
        .select({
          id: assignmentsTable.id,
          assignment: assignmentsTable,
          profileStatus: profilesTable.status,
          vacationStartDate: profilesTable.vacationStartDate,
          vacationEndDate: profilesTable.vacationEndDate,
          profileFirstName: profilesTable.firstName,
          profileLastName: profilesTable.lastName,
          profileFirstNameAr: profilesTable.firstNameAr,
          profileLastNameAr: profilesTable.lastNameAr,
          profileThirdNameAr: profilesTable.thirdNameAr,
          profileFourthNameAr: profilesTable.fourthNameAr,
          profileCode: profilesTable.profileId,
          profileGender: profilesTable.gender,
          profileNationality: profilesTable.nationality,
          profileDepartment: profilesTable.department,
          profileDepartmentAr: profilesTable.departmentAr,
          profileJobTitle: profilesTable.jobTitle,
          profileJobTitleAr: profilesTable.jobTitleAr,
          profilePhotoUrl: profilesTable.photoUrl,
          roomNumber: roomsTable.roomNumber,
          roomType: roomsTable.roomType,
          buildingId: roomsTable.buildingId,
          floorId: roomsTable.floorId,
          buildingName: buildingsTable.name,
          floorNumber: floorsTable.floorNumber,
        })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
        .where(and(...conditions));

      const countResult = await tenantDb
        .select({ count: sql<number>`count(*)` })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .where(and(...conditions));

      const total = Number(countResult[0]?.count || 0);

      const items = await baseQuery
        .orderBy(desc(assignmentsTable.createdAt))
        .limit(limit)
        .offset(offset);

      return {
        total,
        data: items.map(i => ({
          ...i.assignment,
          profileStatus: i.profileStatus,
          vacationStartDate: i.vacationStartDate,
          vacationEndDate: i.vacationEndDate,
          profileFirstName: i.profileFirstName,
          profileLastName: i.profileLastName,
          profileFirstNameAr: i.profileFirstNameAr,
          profileLastNameAr: i.profileLastNameAr,
          profileThirdNameAr: i.profileThirdNameAr,
          profileFourthNameAr: i.profileFourthNameAr,
          profileCode: i.profileCode,
          profileGender: i.profileGender,
          gender: i.profileGender,
          profileNationality: i.profileNationality,
          profileDepartment: i.profileDepartment,
          profileDepartmentAr: i.profileDepartmentAr,
          profileJobTitle: i.profileJobTitle,
          profileJobTitleAr: i.profileJobTitleAr,
          profilePhotoUrl: i.profilePhotoUrl,
          roomNumber: i.roomNumber,
          roomType: i.roomType,
          buildingId: i.buildingId,
          floorId: i.floorId,
          buildingName: i.buildingName,
          floorNumber: i.floorNumber,
        })),
      };
    });

    // Resilient fallback: Enrich any assignment whose profile data is missing locally
    for (const item of result.data) {
      if (!item.profileFirstName && item.profileId) {
        const found = await findProfileAcrossAllProperties(item.profileId);
        if (found?.profile) {
          item.profileFirstName = found.profile.firstName;
          item.profileLastName = found.profile.lastName;
          item.profileFirstNameAr = found.profile.firstNameAr;
          item.profileLastNameAr = found.profile.lastNameAr;
          item.profileThirdNameAr = found.profile.thirdNameAr;
          item.profileFourthNameAr = found.profile.fourthNameAr;
          item.profileCode = found.profile.profileId;
          item.profileNationality = found.profile.nationality;
          item.profileDepartment = found.profile.department;
          item.profileDepartmentAr = found.profile.departmentAr;
          item.profileJobTitle = found.profile.jobTitle;
          item.profileJobTitleAr = found.profile.jobTitleAr;
          item.profilePhotoUrl = found.profile.photoUrl;
          item.profileStatus = found.profile.status;
        }
      }
    }

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

    const conditions: SQL[] = [sql`upper(${assignmentsTable.status}) != 'ACTIVE'`];

    if (query.status && query.status !== "ALL") {
      const s = String(query.status).toUpperCase();
      if (s === "ENDED" || s === "CHECKED_OUT") {
        conditions.push(
          or(
            eq(assignmentsTable.status, "CHECKED_OUT"),
            eq(assignmentsTable.status, "ENDED"),
          )!,
        );
      } else {
        conditions.push(eq(assignmentsTable.status, s));
      }
    }

    if (query.search) {
      const q = `%${query.search}%`;
      conditions.push(
        or(
          ilike(profilesTable.firstName, q),
          ilike(profilesTable.lastName, q),
          ilike(profilesTable.firstNameAr, q),
          ilike(profilesTable.lastNameAr, q),
          ilike(profilesTable.profileId, q),
          ilike(profilesTable.nationalId, q),
          ilike(profilesTable.department, q),
          ilike(profilesTable.departmentAr, q),
          ilike(profilesTable.jobTitle, q),
          ilike(profilesTable.jobTitleAr, q),
          ilike(roomsTable.roomNumber, q),
          ilike(buildingsTable.name, q),
        )!,
      );
    }

    const result = await withTenant(propertyId, async (tenantDb) => {
      const baseQuery = tenantDb
        .select({
          id: assignmentsTable.id,
          assignment: assignmentsTable,
          profileFirstName: profilesTable.firstName,
          profileLastName: profilesTable.lastName,
          profileFirstNameAr: profilesTable.firstNameAr,
          profileLastNameAr: profilesTable.lastNameAr,
          profileThirdNameAr: profilesTable.thirdNameAr,
          profileFourthNameAr: profilesTable.fourthNameAr,
          profileCode: profilesTable.profileId,
          profileNationalId: profilesTable.nationalId,
          profileNationality: profilesTable.nationality,
          profileDepartment: profilesTable.department,
          profileDepartmentAr: profilesTable.departmentAr,
          profileJobTitle: profilesTable.jobTitle,
          profileJobTitleAr: profilesTable.jobTitleAr,
          profilePhotoUrl: profilesTable.photoUrl,
          roomNumber: roomsTable.roomNumber,
          roomType: roomsTable.roomType,
          buildingId: roomsTable.buildingId,
          floorId: roomsTable.floorId,
          buildingName: buildingsTable.name,
          floorNumber: floorsTable.floorNumber,
        })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
        .where(and(...conditions));

      const countResult = await tenantDb
        .select({ count: sql<number>`count(*)` })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
        .where(and(...conditions));

      const total = Number(countResult[0]?.count || 0);

      const items = await baseQuery
        .orderBy(desc(sql`COALESCE(${assignmentsTable.checkOutDate}, ${assignmentsTable.createdAt}::text)`))
        .limit(limit)
        .offset(offset);

      return {
        total,
        data: items.map((i) => ({
          ...i.assignment,
          profileFirstName: i.profileFirstName,
          profileLastName: i.profileLastName,
          profileFirstNameAr: i.profileFirstNameAr,
          profileLastNameAr: i.profileLastNameAr,
          profileThirdNameAr: i.profileThirdNameAr,
          profileFourthNameAr: i.profileFourthNameAr,
          profileCode: i.profileCode,
          profileNationalId: i.profileNationalId,
          profileNationality: i.profileNationality,
          profileDepartment: i.profileDepartment,
          profileDepartmentAr: i.profileDepartmentAr,
          profileJobTitle: i.profileJobTitle,
          profileJobTitleAr: i.profileJobTitleAr,
          profilePhotoUrl: i.profilePhotoUrl,
          roomNumber: i.roomNumber,
          roomType: i.roomType,
          buildingId: i.buildingId,
          floorId: i.floorId,
          buildingName: i.buildingName,
          floorNumber: i.floorNumber,
        })),
      };
    });

    // Resilient fallback: Enrich any history record whose profile data is missing locally
    for (const item of result.data) {
      if (!item.profileFirstName && item.profileId) {
        const found = await findProfileAcrossAllProperties(item.profileId);
        if (found?.profile) {
          item.profileFirstName = found.profile.firstName;
          item.profileLastName = found.profile.lastName;
          item.profileFirstNameAr = found.profile.firstNameAr;
          item.profileLastNameAr = found.profile.lastNameAr;
          item.profileThirdNameAr = found.profile.thirdNameAr;
          item.profileFourthNameAr = found.profile.fourthNameAr;
          item.profileCode = found.profile.profileId;
          item.profileNationalId = found.profile.nationalId;
          item.profileNationality = found.profile.nationality;
          item.profileDepartment = found.profile.department;
          item.profileDepartmentAr = found.profile.departmentAr;
          item.profileJobTitle = found.profile.jobTitle;
          item.profileJobTitleAr = found.profile.jobTitleAr;
          item.profilePhotoUrl = found.profile.photoUrl;
        }
      }
    }

    res.json({
      data: result.data.map((a) => fmtAssignment({ ...a, propertyId })),
      pagination: {
        total: result.total,
        page,
        limit,
      },
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
      if (query.data.status && String(query.data.status).toUpperCase() !== "ALL")
        conditions.push(eq(assignmentsTable.status, query.data.status));
      if (query.data.profileId)
        conditions.push(eq(assignmentsTable.profileId, query.data.profileId));
      if (query.data.roomId)
        conditions.push(eq(assignmentsTable.roomId, query.data.roomId));
    }

    const assignments = await withTenant(propertyId, async (tenantDb) => {
      const base = tenantDb
        .select({
          id: assignmentsTable.id,
          profileId: assignmentsTable.profileId,
          roomId: assignmentsTable.roomId,
          bedNumber: assignmentsTable.bedNumber,
          isEntireRoom: assignmentsTable.isEntireRoom,
          checkInDate: assignmentsTable.checkInDate,
          expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
          checkOutDate: assignmentsTable.checkOutDate,
          notes: assignmentsTable.notes,
          status: assignmentsTable.status,
          createdAt: assignmentsTable.createdAt,
          roomNumber: roomsTable.roomNumber,
          buildingId: roomsTable.buildingId,
          floorId: roomsTable.floorId,
          buildingName: buildingsTable.name,
          floorNumber: floorsTable.floorNumber,
          profileFirstName: profilesTable.firstName,
          profileLastName: profilesTable.lastName,
          profileFirstNameAr: profilesTable.firstNameAr,
          profileLastNameAr: profilesTable.lastNameAr,
          profileCode: profilesTable.profileId,
          profileGender: profilesTable.gender,
          gender: profilesTable.gender,
          profileDepartment: profilesTable.department,
          profileDepartmentAr: profilesTable.departmentAr,
          profileJobTitle: profilesTable.jobTitle,
          profileJobTitleAr: profilesTable.jobTitleAr,
          profileNationality: profilesTable.nationality,
        })
        .from(assignmentsTable)
        .leftJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
        .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id));

      return conditions.length > 0
        ? await base.where(and(...conditions)).orderBy(desc(assignmentsTable.id))
        : await base.orderBy(desc(assignmentsTable.id));
    });

    const mapped = assignments.map((a) => ({
      ...fmtAssignment({ ...a, propertyId }),
      roomNumber: a.roomNumber ?? null,
      buildingId: a.buildingId ?? null,
      floorId: a.floorId ?? null,
      buildingName: a.buildingName ?? null,
      floorNumber: a.floorNumber ?? null,
      profileFirstName: a.profileFirstName ?? null,
      profileLastName: a.profileLastName ?? null,
      profileFirstNameAr: a.profileFirstNameAr ?? null,
      profileLastNameAr: a.profileLastNameAr ?? null,
      profileCode: a.profileCode ?? null,
      profileGender: a.profileGender ?? null,
      gender: a.gender ?? a.profileGender ?? null,
      profileDepartment: a.profileDepartment ?? null,
      profileDepartmentAr: a.profileDepartmentAr ?? null,
      profileJobTitle: a.profileJobTitle ?? null,
      profileJobTitleAr: a.profileJobTitleAr ?? null,
      profileNationality: a.profileNationality ?? null,
    }));

    const parsed = ListAssignmentsResponse.safeParse(mapped);
    res.json(parsed.success ? parsed.data : mapped);
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

    // ── Cross-Property Sync & Auto-Resolution ─────────────────────────────
    const rawSourcePropertyId = (req.body as any)?.sourcePropertyId;
    let sourcePropertyId = rawSourcePropertyId ? Number(rawSourcePropertyId) : null;
    const transferType = (req.body as any)?.transferType === "TASK_FORCE" ? "TASK_FORCE" : "PERMANENT";
    const archiveSourceProfile = (req.body as any)?.archiveSourceProfile !== undefined
      ? Boolean((req.body as any)?.archiveSourceProfile)
      : (transferType === "PERMANENT");
    const checkoutPreviousAssignment = Boolean(
      (req.body as any)?.checkoutPreviousAssignment ?? true
    );

    let resolvedProfileId = parsed.data.profileId;
    let crossPropertyNoteTag = "";

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
      const foundSource = await findProfileAcrossAllProperties(parsed.data.profileId);
      if (foundSource && foundSource.propertyId !== propertyId) {
        effectiveSourcePropId = foundSource.propertyId;
        console.log(`[assignments] Auto-discovered profile #${parsed.data.profileId} in source property #${foundSource.propertyId} (${foundSource.profile.firstName} ${foundSource.profile.lastName})`);
      }
    }

    if (effectiveSourcePropId && effectiveSourcePropId !== propertyId) {
      try {
        const { targetProfile, targetName, srcName } = await syncProfileAcrossProperties({
          sourcePropertyId: effectiveSourcePropId,
          targetPropertyId: propertyId,
          sourceProfileId: parsed.data.profileId,
          transferType,
        });
        resolvedProfileId = targetProfile.id;
        crossPropertyNoteTag = transferType === "TASK_FORCE"
          ? `[انتداب مؤقت من ${srcName}]`
          : `[محوّل من ${srcName}]`;

        if (checkoutPreviousAssignment || archiveSourceProfile) {
          await closeSourceAssignmentOnTransfer(
            effectiveSourcePropId,
            parsed.data.profileId,
            targetName,
            archiveSourceProfile,
          );
        }
      } catch (syncErr: any) {
        console.error("[assignments] Cross-property sync failed:", syncErr);
        res.status(500).json({ error: `فشل مزامنة الملف الشخصي عبر الفنادق: ${syncErr.message}` });
        return;
      }
    } else if (!localProfile) {
      res.status(404).json({ error: `الملف الشخصي #${parsed.data.profileId} غير مسجل في هذا الفندق ولا في أي فندق آخر.` });
      return;
    }

    const inputPhone = typeof (req.body as any)?.phone === "string" ? (req.body as any).phone.trim() : "";
    if (inputPhone) {
      await withTenant(propertyId, async (tenantDb) => {
        await tenantDb
          .update(profilesTable)
          .set({ phone: inputPhone })
          .where(eq(profilesTable.id, resolvedProfileId));
      }).catch((e) => console.warn("[assignments] could not update phone:", e?.message));
    }

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

      // ── 1.1 فحص ما إذا كانت الغرفة مخصصة بالكامل لموظف آخر (استخدام فردي) ──
      const [existingEntireRoom] = await tenantDb
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
        (parsed.data.notes && parsed.data.notes.includes("[حجز الغرفة بالكامل]")) ||
        (parsed.data.notes && parsed.data.notes.includes("[تسكين الغرفة بالكامل]"))
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

      const effectiveOccupancy = Math.max(room.currentOccupancy ?? 0, activeAssignmentsInRoom.length);
      const authUser = (req as any).authUser || (req as any).user;
      const sInfo = su(req);
      const userRole = (authUser?.roles?.[0] || sInfo.userRole || "").toLowerCase();
      const userPerms: string[] = Array.isArray(authUser?.permissions) ? authUser.permissions : [];
      const hasOverridePerm =
        ["super_admin", "system_admin", "admin", "housing_manager", "manager"].includes(userRole) ||
        userPerms.includes("accommodation.override_single_occupancy") ||
        userPerms.includes("reservations.override_single_occupancy") ||
        (authUser && (hasPermission(authUser, "accommodation", "override_single_occupancy") || hasPermission(authUser, "reservations", "override_single_occupancy")));

      if (room.capacity > 1 && effectiveOccupancy === 1 && !hasOverridePerm) {
        return {
          error: "هذه الغرفة يشغلها شخص بمفرده وبها أسِرّة شاغرة. تسكين نزيل إضافي يتطلب صلاحية إدارية استثنائية (override_single_occupancy).",
          code: "PERMISSION_DENIED_SINGLE_OCCUPANCY",
          status: 403,
        };
      }

      if (isEntireRoomRequested && room.capacity > 1 && !hasOverridePerm) {
        return {
          error: "حجز غرفة متعددة الأسِرّة بالكامل لشخص واحد يتطلب صلاحية إدارية استثنائية (override_single_occupancy).",
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

          // شاغل السرير في إجازة رسمية: يتطلب صلاحية مدير السكن أو الآدمن أو صلاحية الاستثناء التفصيلية
          const vacAuthUser = (req as any).authUser || (req as any).user;
          const vacUserRole = (vacAuthUser?.roles?.[0] || su(req).userRole || "").toLowerCase();
          const vacUserPerms: string[] = Array.isArray(vacAuthUser?.permissions) ? vacAuthUser.permissions : [];
          const isManagerOrAdmin =
            ["super_admin", "system_admin", "admin", "manager"].includes(vacUserRole) ||
            vacUserPerms.includes("accommodation.override_vacation") ||
            vacUserPerms.includes("accommodation.edit") ||
            (vacAuthUser && (hasPermission(vacAuthUser, "accommodation", "override_vacation" as any) || hasPermission(vacAuthUser, "accommodation", "edit")));

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

      const newOccupancy = isEntireRoomRequested
        ? room.capacity
        : isTemporaryVacationOverride
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
          .select({ contractEndDate: profilesTable.contractEndDate, employmentType: profilesTable.employmentType })
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

      const hasPolicyException = Boolean((req.body as any)?.hasPolicyException);
      const policyExceptionReason = typeof (req.body as any)?.policyExceptionReason === "string" ? (req.body as any).policyExceptionReason.trim() : null;
      const policyApprovedBy = typeof (req.body as any)?.policyApprovedBy === "string" ? (req.body as any).policyApprovedBy.trim() : null;

      let finalNotes = parsed.data.notes || "";
      if (crossPropertyNoteTag) {
        finalNotes = `${crossPropertyNoteTag} ${finalNotes}`.trim();
      }
      if (isEntireRoomRequested) {
        finalNotes = `[تسكين الغرفة بالكامل - استخدام فردي] ${finalNotes}`.trim();
      }
      if (isTemporaryVacationOverride) {
        finalNotes = `[تسكين مؤقت بديل إجازة بتصريح الإدارة] ${finalNotes}`.trim();
      }
      if (hasPolicyException) {
        finalNotes = `[استثناء سياسة السكن معتمد من: ${policyApprovedBy || "الإدارة"}] ${policyExceptionReason ? `(المبرر: ${policyExceptionReason})` : ""} ${finalNotes}`.trim();
      }

      const [assignment] = await tenantDb
        .insert(assignmentsTable)
        .values({
          ...(parsed.data as any),
          profileId: resolvedProfileId,
          bedNumber: isEntireRoomRequested ? (parsed.data.bedNumber || 1) : (parsed.data.bedNumber ?? null),
          isEntireRoom: isEntireRoomRequested,
          hasPolicyException,
          policyExceptionReason,
          policyApprovedBy,
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
      },
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

    if (effectiveSourcePropId && effectiveSourcePropId !== propertyId && archiveSourceProfile) {
      await deleteSourceProfileOnTransfer(effectiveSourcePropId, parsed.data.profileId, undefined, true).catch((delErr) => {
        console.warn("[assignments] deleteSourceProfileOnTransfer in POST /assignments warning:", delErr?.message);
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
      console.error("[WhatsApp Hook] Error sending check-in notification:", err);
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
    const phoneOverride = typeof req.body?.phone === "string" ? req.body.phone.trim() : undefined;

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
      res.status(500).json({ error: err?.message || "Failed to send WhatsApp message" });
    }
  }
);

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

// ─── PATCH /assignments/:id ───────────────────────────────────────────────
router.patch(
  "/assignments/:id",
  requireAnyPermission(["accommodation", "edit"], ["accommodation", "create"]),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);

    const params = UpdateAssignmentParams.safeParse(req.params);
    const parsed = UpdateAssignmentBody.safeParse(req.body);
    if (!params.success || !parsed.success) {
      res.status(400).json({ error: "Invalid request" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByAssignmentId(params.data.id)) || 0;
    }

    let updated: any = null;
    if (propertyId) {
      try {
        [updated] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .update(assignmentsTable)
            .set(parsed.data as any)
            .where(eq(assignmentsTable.id, params.data.id))
            .returning();
        });
      } catch (err) {
        // Fall through
      }
    }

    if (!updated) {
      const autoPid = await findPropertyByAssignmentId(params.data.id);
      if (autoPid && autoPid !== propertyId) {
        propertyId = autoPid;
        [updated] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .update(assignmentsTable)
            .set(parsed.data as any)
            .where(eq(assignmentsTable.id, params.data.id))
            .returning();
        });
      }
    }

    if (!updated) {
      res.status(404).json({ error: "Assignment not found" });
      return;
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: parsed.data.expectedCheckOutDate
        ? `تمديد إقامة الموظف #${updated.profileId} حتى ${parsed.data.expectedCheckOutDate}`
        : `تحديث بيانات الإقامة #${updated.id}`,
      actionType: "UPDATE",
      module: "accommodation",
      entityType: "assignment",
      entityId: updated.id,
    });

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

async function findPropertyByAssignmentId(assignmentId: number): Promise<number | null> {
  try {
    const props = await pool.query("SELECT id, schema_name FROM public.properties");
    for (const p of props.rows) {
      try {
        const check = await pool.query(
          `SELECT id FROM "${p.schema_name}".assignments WHERE id = $1 LIMIT 1`,
          [assignmentId],
        );
        if (check.rows.length > 0) return p.id;
      } catch {}
    }
  } catch {}
  return null;
}

// ─── DELETE /assignments/:id ──────────────────────────────────────────────────
router.delete(
  "/assignments/:id",
  requirePermission("accommodation", "delete"),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const assignmentId = parseInt(String(req.params.id), 10);
    if (isNaN(assignmentId)) {
      res.status(400).json({ error: "Invalid assignment ID" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByAssignmentId(assignmentId)) || 0;
    }

    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const result = await withTenant(propertyId, async (tenantDb) => {
        const [assignment] = await tenantDb
          .select()
          .from(assignmentsTable)
          .where(eq(assignmentsTable.id, assignmentId));

        if (!assignment) return { notFound: true };

        // Prevent deleting active assignments
        if (assignment.status === "ACTIVE") {
          return {
            isActive: true,
            error: "لا يمكن حذف إقامة نشطة حالياً. يجب تسجيل الخروج (Check-out) أولاً.",
          };
        }

        await tenantDb
          .delete(assignmentsTable)
          .where(eq(assignmentsTable.id, assignmentId));

        return { success: true, assignment };
      });

      if (result.notFound) {
        res.status(404).json({ error: "Assignment not found" });
        return;
      }

      if (result.isActive) {
        res.status(400).json({ error: result.error });
        return;
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `حذف سجل تسكين سابق #${assignmentId}`,
        actionType: "DELETE",
        module: "accommodation",
        entityType: "assignment",
        entityId: assignmentId,
        severity: "warning",
      });

      broadcastToProperty(propertyId, {
        module: "accommodation",
        action: "deleted",
        entityId: assignmentId,
      });

      res.json({ success: true, id: assignmentId });
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to delete assignment" });
    }
  },
);

// ─── POST /assignments/bulk-delete ────────────────────────────────────────────
router.post(
  "/assignments/bulk-delete",
  requirePermission("accommodation", "delete"),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const { ids } = req.body || {};
    if (!Array.isArray(ids) || ids.length === 0) {
      res.status(400).json({ error: "ids must be a non-empty array of assignment IDs" });
      return;
    }

    const numIds = ids.map((id: any) => Number(id)).filter((id: number) => !isNaN(id) && id > 0);
    if (numIds.length === 0) {
      res.status(400).json({ error: "No valid assignment IDs provided" });
      return;
    }

    if (!propertyId) {
      propertyId = (await findPropertyByAssignmentId(numIds[0])) || 0;
    }

    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const result = await withTenant(propertyId, async (tenantDb) => {
        const idListSql = sql.join(numIds.map((id) => sql`${id}`), sql`, `);

        // Find which assignments are ACTIVE
        const activeRows = await tenantDb.execute(sql`
          SELECT id FROM assignments 
          WHERE id IN (${idListSql}) 
            AND status = 'ACTIVE'
        `);

        const activeIds = new Set<number>((activeRows.rows || []).map((r: any) => Number(r.id)));
        const deletableIds = numIds.filter((id) => !activeIds.has(id));

        if (deletableIds.length > 0) {
          const deletableSql = sql.join(deletableIds.map((id) => sql`${id}`), sql`, `);
          await tenantDb
            .delete(assignmentsTable)
            .where(sql`${assignmentsTable.id} IN (${deletableSql})`);
        }

        return {
          deletedCount: deletableIds.length,
          skippedCount: activeIds.size,
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
          action: `حذف جماعي لـ ${result.deletedCount} سجل من تاريخ التسكين`,
          actionType: "DELETE",
          module: "accommodation",
          entityType: "assignment",
          severity: "warning",
        });

        broadcastToProperty(propertyId, {
          module: "accommodation",
          action: "deleted",
          data: { count: result.deletedCount },
        });
      }

      res.json(result);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to bulk delete assignments" });
    }
  },
);

export default router;
