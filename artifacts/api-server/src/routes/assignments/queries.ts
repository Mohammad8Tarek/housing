import { Router } from "express";
import { withTenant, assignmentsTable, roomsTable, profilesTable, buildingsTable, floorsTable } from "@workspace/db";
import { eq, and, or, sql, SQL, desc } from "drizzle-orm";
import { ListAssignmentsQueryParams, ListAssignmentsResponse } from "@workspace/api-zod";
import { requirePermission } from "../../middlewares/permissions.js";
import { getTenantId } from "../../lib/request-utils.js";
import { findProfileAcrossAllProperties } from "../../lib/cross-property-service.js";
import { buildAssignmentSearchConditions } from "../../lib/search-helper.js";
import { fmtAssignment } from "./shared.js";
import { validate } from "../../middlewares/validate.js";
import { CommonListQuery } from "../../validation/schemas.js";

const router: Router = Router();

// ─── GET /assignments/in-house ────────────────────────────────────────────────
router.get(
  "/assignments/in-house",
  requirePermission("accommodation", "view"),
  validate({ query: CommonListQuery }),
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
      const searchCond = buildAssignmentSearchConditions(query.search, {
        profilesTable,
        roomsTable,
        buildingsTable,
        assignmentsTable,
      });
      if (searchCond) {
        conditions.push(searchCond);
      }
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
  validate({ query: CommonListQuery }),
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
      const searchCond = buildAssignmentSearchConditions(query.search, {
        profilesTable,
        roomsTable,
        buildingsTable,
        assignmentsTable,
      });
      if (searchCond) {
        conditions.push(searchCond);
      }
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
  validate({ query: CommonListQuery }),
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

export default router;
