import { Router } from "express";
import { db, withTenant, profilesTable, profileDocumentsTable, assignmentsTable, roomsTable, buildingsTable, floorsTable, propertiesTable } from "@workspace/db";
import { eq, and, or, sql, SQL, asc, desc } from "drizzle-orm";
import { GetProfileParams, ListProfilesQueryParams, GetProfileResponse } from "@workspace/api-zod";
import {
  requirePermission,
  hasPermission,
} from "../../middlewares/permissions.js";
import { getTenantId } from "../../lib/request-utils.js";
import { buildProfileSearchConditions, buildAssignmentSearchConditions } from "../../lib/search-helper.js";
import { resolveProfileTenant, filterSensitive } from "./shared.js";

const router: Router = Router();

// ℹ️  Schema column 'photo_url' is managed via migration (scripts/db/add-missing-indexes.sql)
//    Do NOT run DDL here — it was removed to prevent startup delays and silent failures.

router.get(
  "/profiles",
  requirePermission("profiles", "view"),
  async (req, res) => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const query = ListProfilesQueryParams.safeParse(req.query);
    const conditions: SQL[] = [];

    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.min(
      5000,
      Math.max(1, parseInt(req.query.limit as string) || 25),
    );
    const offset = (page - 1) * limit;

    // Server-side sorting — strict allowlist, no raw column injection.
    const SORTABLE_PROFILE_COLUMNS: Record<string, any> = {
      profileId: profilesTable.profileId,
      firstName: profilesTable.firstName,
      lastName: profilesTable.lastName,
      thirdName: profilesTable.thirdName,
      fourthName: profilesTable.fourthName,
      nationalId: profilesTable.nationalId,
      department: profilesTable.department,
      jobTitle: profilesTable.jobTitle,
      status: profilesTable.status,
      hireDate: profilesTable.hireDate,
      contractEndDate: profilesTable.contractEndDate,
      dateOfBirth: profilesTable.dateOfBirth,
      address: profilesTable.address,
      phone: profilesTable.phone,
      employmentType: profilesTable.employmentType,
      companyName: profilesTable.companyName,
      level: profilesTable.level,
      gender: profilesTable.gender,
      nationality: profilesTable.nationality,
      createdAt: profilesTable.createdAt,
    };
    const sortByRaw = String(req.query.sortBy || "");
    const sortDir =
      String(req.query.sortDir || "asc").toLowerCase() === "desc"
        ? "desc"
        : "asc";
    const sortCol = SORTABLE_PROFILE_COLUMNS[sortByRaw];

    if (query.success) {
      if (query.data.search) {
        const searchCond = buildProfileSearchConditions(query.data.search, profilesTable);
        if (searchCond) {
          conditions.push(searchCond);
        }
      }
      if (query.data.status && query.data.status !== "ALL") {
        conditions.push(eq(profilesTable.status, query.data.status));
      } else {
        conditions.push(sql`upper(${profilesTable.status}) != 'TRANSFERRED'`);
      }
      if (query.data.department && query.data.department !== "ALL") {
        conditions.push(eq(profilesTable.department, query.data.department));
      }
    } else {
      conditions.push(sql`upper(${profilesTable.status}) != 'TRANSFERRED'`);
    }

    const { profiles, total } = await withTenant(
      propertyId,
      async (tenantDb) => {
        let countQuery = tenantDb
          .select({ count: sql<number>`count(*)` })
          .from(profilesTable) as any;
        if (conditions.length > 0)
          countQuery = countQuery.where(and(...conditions));
        const countResult = await countQuery;
        const totalCount = Number(countResult[0]?.count ?? 0);

        let baseQuery = tenantDb
          .select()
          .from(profilesTable)
          .limit(limit)
          .offset(offset) as any;
        if (conditions.length > 0)
          baseQuery = baseQuery.where(and(...conditions));
        if (sortByRaw === "fullName") {
          baseQuery = baseQuery.orderBy(
            sortDir === "desc"
              ? desc(profilesTable.firstName)
              : asc(profilesTable.firstName),
            sortDir === "desc"
              ? desc(profilesTable.lastName)
              : asc(profilesTable.lastName),
          );
        } else if (sortCol) {
          baseQuery = baseQuery.orderBy(
            sortDir === "desc" ? desc(sortCol) : asc(sortCol),
          );
        }

        const rows = await baseQuery;
        return { profiles: rows, total: totalCount };
      },
    );

    res.json({
      data: filterSensitive(
        profiles.map((e: any) => ({ ...e, propertyId })),
        req,
      ) as any[],
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

/* Cross-property profile search */
router.get(
  "/profiles/search",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const { q = "", propertyId } = req.query as Record<string, string>;
    const conditions: SQL[] = [];

    if (q.trim().length >= 1) {
      const searchCond = buildAssignmentSearchConditions(q, {
        profilesTable,
        roomsTable,
        buildingsTable,
        assignmentsTable,
      });
      if (searchCond) {
        conditions.push(searchCond);
      }
    }

    if (conditions.length === 0) {
      res.json([]);
      return;
    }

    const authUser = (req.session as any)?.user;
    const sessionPid = (req.session as any)?.propertyId || authUser?.propertyId;
    const userPropertyIds: number[] =
      authUser?.propertyIds ?? (sessionPid ? [Number(sessionPid)] : []);

    const properties = await db
      .select({ id: propertiesTable.id, name: propertiesTable.name })
      .from(propertiesTable);
    const propMap = Object.fromEntries(properties.map((p) => [p.id, p.name]));

    let targetPropertyIds: number[] = [];
    const requestedPid = Number(propertyId);

    if (requestedPid && !isNaN(requestedPid)) {
      targetPropertyIds = [requestedPid];
    } else {
      // If propertyId is omitted or "all", determine accessible properties
      if (
        (req.session as any)?.isSystemAdmin ||
        authUser?.isSystemAdmin ||
        hasPermission(authUser, "properties", "view") ||
        hasPermission(authUser, "dashboard", "audit")
      ) {
        targetPropertyIds = properties.map((p) => p.id);
      } else if (userPropertyIds.length > 0) {
        targetPropertyIds = userPropertyIds;
      } else if (sessionPid) {
        targetPropertyIds = [Number(sessionPid)];
      } else {
        targetPropertyIds = properties.map((p) => p.id);
      }
    }

    const aggregated: any[] = [];

    for (const pId of targetPropertyIds) {
      if (aggregated.length >= 30) break;
      try {
        const rows = await withTenant(pId, async (tenantDb) => {
          const queryResult = await tenantDb
            .select({
              profile: profilesTable,
              accommodationRoom: roomsTable.roomNumber,
              accommodationRoomType: roomsTable.roomType,
              accommodationBuilding: buildingsTable.name,
              accommodationFloor: floorsTable.floorNumber,
              accommodationBed: assignmentsTable.bedNumber,
            })
            .from(profilesTable)
            .leftJoin(
              assignmentsTable,
              and(
                eq(assignmentsTable.profileId, profilesTable.id),
                eq(assignmentsTable.status, "ACTIVE"),
              ),
            )
            .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
            .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
            .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
            .where(and(...conditions))
            .limit(30 - aggregated.length);

          return queryResult.map((r) => ({
            ...r.profile,
            accommodationRoom: r.accommodationRoom,
            accommodationRoomType: r.accommodationRoomType,
            accommodationBuilding: r.accommodationBuilding,
            accommodationFloor: r.accommodationFloor,
            accommodationBed: r.accommodationBed,
            propertyId: pId,
            propertyName: propMap[pId] ?? null,
          }));
        });
        aggregated.push(...rows);
      } catch (err) {
        console.warn(`[profiles/search] Error querying tenant ${pId}:`, err);
      }
    }

    res.json(filterSensitive(aggregated, req));
  },
);

/* Real-time duplicate check endpoint for profiles */
router.get(
  "/profiles/check-duplicate",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const { profileId, nationalId, phone, excludeId } = req.query as Record<string, string>;
    const excludeIdNum = excludeId ? Number(excludeId) : null;

    const trimmedProfileId = profileId?.trim();
    const trimmedNationalId = nationalId?.trim();
    const trimmedPhone = phone?.trim();

    const duplicates: Record<string, { exists: boolean; name: string; profileId: string; nationalId?: string; phone?: string }> = {};

    if (!trimmedProfileId && !trimmedNationalId && !trimmedPhone) {
      res.json({ duplicates });
      return;
    }

    await withTenant(propertyId, async (tenantDb) => {
      const orConditions: SQL[] = [];
      if (trimmedProfileId) {
        orConditions.push(eq(profilesTable.profileId, trimmedProfileId));
      }
      if (trimmedNationalId) {
        orConditions.push(eq(profilesTable.nationalId, trimmedNationalId));
      }
      if (trimmedPhone) {
        orConditions.push(eq(profilesTable.phone, trimmedPhone));
      }

      if (orConditions.length === 0) return;

      const rows = await tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          nationalId: profilesTable.nationalId,
          phone: profilesTable.phone,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          thirdName: profilesTable.thirdName,
          fourthName: profilesTable.fourthName,
        })
        .from(profilesTable)
        .where(or(...orConditions));

      for (const row of rows) {
        if (excludeIdNum && row.id === excludeIdNum) continue;

        const name = [row.firstName, row.lastName, row.thirdName, row.fourthName].filter(Boolean).join(" ");

        if (trimmedProfileId && row.profileId?.trim().toLowerCase() === trimmedProfileId.toLowerCase()) {
          duplicates.profileId = { exists: true, name, profileId: row.profileId };
        }
        if (trimmedNationalId && row.nationalId?.trim() === trimmedNationalId) {
          duplicates.nationalId = { exists: true, name, profileId: row.profileId, nationalId: row.nationalId };
        }
        if (trimmedPhone && row.phone?.trim() === trimmedPhone) {
          duplicates.phone = { exists: true, name, profileId: row.profileId, phone: row.phone };
        }
      }
    });

    res.json({ duplicates });
  }
);

/* Fast existing identifiers endpoint for Excel import duplicate & update detection */
router.get(
  "/profiles/existing-identifiers",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    try {
      const rows = await withTenant(propertyId, async (tenantDb) => {
        return tenantDb
          .select({
            id: profilesTable.id,
            profileId: profilesTable.profileId,
            nationalId: profilesTable.nationalId,
            phone: profilesTable.phone,
            firstName: profilesTable.firstName,
            lastName: profilesTable.lastName,
            thirdName: profilesTable.thirdName,
            fourthName: profilesTable.fourthName,
            firstNameAr: profilesTable.firstNameAr,
            lastNameAr: profilesTable.lastNameAr,
            thirdNameAr: profilesTable.thirdNameAr,
            fourthNameAr: profilesTable.fourthNameAr,
            department: profilesTable.department,
            departmentAr: profilesTable.departmentAr,
            jobTitle: profilesTable.jobTitle,
            jobTitleAr: profilesTable.jobTitleAr,
            level: profilesTable.level,
            nationality: profilesTable.nationality,
            gender: profilesTable.gender,
            employmentType: profilesTable.employmentType,
            companyName: profilesTable.companyName,
            email: profilesTable.email,
            emergencyContact: profilesTable.emergencyContact,
            dateOfBirth: profilesTable.dateOfBirth,
            hireDate: profilesTable.hireDate,
            contractEndDate: profilesTable.contractEndDate,
            address: profilesTable.address,
            status: profilesTable.status,
          })
          .from(profilesTable);
      });

      res.json({
        profiles: rows.map((r) => ({
          id: r.id,
          profileId: r.profileId?.trim() || "",
          nationalId: r.nationalId?.trim() || "",
          phone: r.phone?.trim() || "",
          firstName: r.firstName || "",
          lastName: r.lastName || "",
          thirdName: r.thirdName || "",
          fourthName: r.fourthName || "",
          department: r.department || "",
          jobTitle: r.jobTitle || "",
          level: r.level || "",
          nationality: r.nationality || "",
          gender: r.gender || "M",
          employmentType: r.employmentType || "INTERNAL",
          companyName: r.companyName || "",
          email: r.email || "",
          emergencyContact: r.emergencyContact || "",
          dateOfBirth: r.dateOfBirth || "",
          hireDate: r.hireDate || "",
          contractEndDate: r.contractEndDate || "",
          address: r.address || "",
          status: r.status || "UNASSIGNED",
          name: [r.firstName, r.lastName].filter(Boolean).join(" ").trim(),
        })),
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || "Failed to fetch existing identifiers" });
    }
  }
);

router.get(
  "/profiles/:id",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    const params = GetProfileParams.safeParse(req.params);
    if (!params.success) {
      res.status(400).json({ error: params.error.message });
      return;
    }

    let propertyId = getTenantId(req);
    let profile: any = null;

    if (propertyId) {
      try {
        const [found] = await withTenant(propertyId, async (tenantDb) => {
          return await tenantDb
            .select()
            .from(profilesTable)
            .where(eq(profilesTable.id, params.data.id));
        });
        if (found) profile = found;
      } catch {}
    }

    // Fallback: search across all active properties if not found yet or propertyId was 0 / not in session
    if (!profile) {
      const authUser = (req as any).authUser;
      const isSysAdmin =
        authUser?.isSystemAdmin ||
        authUser?.roles?.some((r: any) =>
          ["super_admin", "system_admin"].includes(String(r).toLowerCase()),
        );
      const allowedPids: number[] = Array.isArray(authUser?.propertyIds)
        ? authUser.propertyIds.map(Number).filter(Boolean)
        : (authUser?.propertyId ? [Number(authUser.propertyId)] : []);

      try {
        const props = await db.select({ id: propertiesTable.id }).from(propertiesTable);
        for (const p of props) {
          if (p.id === propertyId) continue;
          if (!isSysAdmin && !allowedPids.includes(p.id)) continue;
          try {
            const [found] = await withTenant(p.id, async (tenantDb) => {
              return await tenantDb
                .select()
                .from(profilesTable)
                .where(eq(profilesTable.id, params.data.id));
            });
            if (found) {
              profile = found;
              propertyId = p.id;
              break;
            }
          } catch {}
        }
      } catch {}
    }

    if (!profile) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }

    const photoRows = await withTenant(propertyId, async (tenantDb) => {
      const [row] = await tenantDb
        .select({ photoUrl: profilesTable.photoUrl })
        .from(profilesTable)
        .where(eq(profilesTable.id, params.data.id))
        .limit(1);
      return row;
    });

    const docRows = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb.select().from(profileDocumentsTable).where(eq(profileDocumentsTable.profileId, params.data.id));
    });

    const safeProfile = {
      ...profile,
      propertyId,
      profileId: profile.profileId ?? "",
      firstName: profile.firstName ?? "",
      lastName: profile.lastName ?? "",
      nationalId: profile.nationalId ?? "",
      nationality: profile.nationality ?? "",
      address: profile.address ?? "",
      jobTitle: profile.jobTitle ?? "",
      level: profile.level ?? "",
      phone: profile.phone ?? "",
      department: profile.department ?? "",
      status: profile.status ?? "UNASSIGNED",
      hireDate: profile.hireDate ?? "",
      gender: profile.gender ?? "M",
      employmentType: profile.employmentType ?? "INTERNAL",
      companyName: profile.companyName ?? null,
      contractEndDate: profile.contractEndDate ?? null,
      vacationStartDate: profile.vacationStartDate ?? null,
      vacationEndDate: profile.vacationEndDate ?? null,
      vacationNotes: profile.vacationNotes ?? null,
    };

    const parsedResult = GetProfileResponse.safeParse(safeProfile);
    const parsed = {
      ...(parsedResult.success ? parsedResult.data : safeProfile),
      photoUrl: photoRows?.photoUrl ?? null,
      idDocuments: docRows.map(d => ({
        id: d.id,
        fileName: d.fileName,
        fileType: d.fileType,
        fileData: d.fileData,
        uploadedAt: d.uploadedAt?.toISOString() ?? null,
      })),
    };
    res.json(filterSensitive(parsed, req));
  },
);

router.get(
  "/profiles/:id/photo",
  requirePermission("profiles", "view"),
  async (req, res): Promise<void> => {
    let propertyId = getTenantId(req);
    const id = Number(req.params.id);
    if (!id) {
      res.status(400).json({ error: "Invalid id" });
      return;
    }

    const resolved = await resolveProfileTenant(id, propertyId);
    if (!resolved) {
      res.status(404).json({ error: "Profile not found" });
      return;
    }
    propertyId = resolved.propertyId;

    const row = await withTenant(propertyId, async (tenantDb) => {
      const [r] = await tenantDb
        .select({ photoUrl: profilesTable.photoUrl })
        .from(profilesTable)
        .where(eq(profilesTable.id, id))
        .limit(1);
      return r;
    });

    res.json({ photoUrl: row?.photoUrl ?? null });
  },
);

export default router;
