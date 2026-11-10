import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import { roomsTable, profilesTable, assignmentsTable, maintenanceTable, reservationsTable, hostingsTable, profileVacationsTable, buildingsTable, propertiesTable, roomMovesTable } from "@workspace/db";
import { eq, and, or, ilike, desc, sql, count } from "drizzle-orm";
import { requirePermission } from "../../middlewares/permissions.js";
import { validate } from "../../middlewares/validate.js";
import { ReportsListQuery, RoomMovesReportQuery, VacationsReportQuery } from "../../validation/schemas.js";
import { getTenantId } from "../../lib/request-utils.js";
import { withTableFallback } from "../../lib/with-table-fallback.js";

const router: Router = Router();

// ─── GET /api/reports/room-moves (PMS Room Moves & Bed Transfers Report) ─────
router.get("/room-moves", requirePermission("reports", "view"), validate({ query: RoomMovesReportQuery }), async (req, res, next) => {
  try {
    const rawProp = req.query.propertyId as string | undefined;
    const isAll = !rawProp || rawProp === "all" || rawProp === "-1" || rawProp === "0";
    const propertyId = isAll ? null : Number(rawProp);

    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const reasonCode = (req.query.reasonCode as string) || "all";
    const buildingName = (req.query.building as string) || "all";
    const search = ((req.query.search as string) || "").trim().toLowerCase();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    let conditions: any[] = [];

    if (propertyId) {
      conditions.push(eq(roomMovesTable.propertyId, propertyId));
    }

    if (reasonCode && reasonCode !== "all") {
      conditions.push(eq(roomMovesTable.reasonCode, reasonCode));
    }

    if (buildingName && buildingName !== "all") {
      conditions.push(
        or(
          eq(roomMovesTable.oldBuildingName, buildingName),
          eq(roomMovesTable.newBuildingName, buildingName)
        )
      );
    }

    if (fromDate) {
      const d = new Date(fromDate);
      if (!isNaN(d.getTime())) {
        conditions.push(sql`${roomMovesTable.createdAt} >= ${d.toISOString()}::timestamptz`);
      }
    }

    if (toDate) {
      const d = new Date(toDate);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        conditions.push(sql`${roomMovesTable.createdAt} <= ${d.toISOString()}::timestamptz`);
      }
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    const allRows = await db
      .select({
        id: roomMovesTable.id,
        propertyId: roomMovesTable.propertyId,
        propertyName: propertiesTable.name,
        propertyDisplayName: propertiesTable.displayName,
        assignmentId: roomMovesTable.assignmentId,
        profileId: roomMovesTable.profileId,
        employeeId: roomMovesTable.employeeId,
        residentName: roomMovesTable.residentName,
        residentNameEn: roomMovesTable.residentNameEn,
        department: roomMovesTable.department,
        jobTitle: roomMovesTable.jobTitle,
        oldRoomId: roomMovesTable.oldRoomId,
        oldRoomNumber: roomMovesTable.oldRoomNumber,
        oldBedNumber: roomMovesTable.oldBedNumber,
        oldBuildingName: roomMovesTable.oldBuildingName,
        oldRoomType: roomMovesTable.oldRoomType,
        newRoomId: roomMovesTable.newRoomId,
        newRoomNumber: roomMovesTable.newRoomNumber,
        newBedNumber: roomMovesTable.newBedNumber,
        newBuildingName: roomMovesTable.newBuildingName,
        newRoomType: roomMovesTable.newRoomType,
        moveReason: roomMovesTable.moveReason,
        reasonCode: roomMovesTable.reasonCode,
        actionByUserId: roomMovesTable.actionByUserId,
        actionByUsername: roomMovesTable.actionByUsername,
        createdAt: roomMovesTable.createdAt,
      })
      .from(roomMovesTable)
      .leftJoin(propertiesTable, eq(roomMovesTable.propertyId, propertiesTable.id))
      .where(whereClause)
      .orderBy(desc(roomMovesTable.createdAt));

    // Search filter
    const filteredRows = search
      ? allRows.filter((r) => {
          const s = search;
          return (
            (r.residentName && r.residentName.toLowerCase().includes(s)) ||
            (r.residentNameEn && r.residentNameEn.toLowerCase().includes(s)) ||
            (r.employeeId && r.employeeId.toLowerCase().includes(s)) ||
            (r.oldRoomNumber && r.oldRoomNumber.toLowerCase().includes(s)) ||
            (r.newRoomNumber && r.newRoomNumber.toLowerCase().includes(s)) ||
            (r.actionByUsername && r.actionByUsername.toLowerCase().includes(s)) ||
            (r.department && r.department.toLowerCase().includes(s)) ||
            (r.moveReason && r.moveReason.toLowerCase().includes(s))
          );
        })
      : allRows;

    // Aggregations
    const todayStr = new Date().toISOString().split("T")[0];
    const todayMoves = filteredRows.filter((r) => {
      const dStr = new Date(r.createdAt).toISOString().split("T")[0];
      return dStr === todayStr;
    }).length;

    const reasonsMap: Record<string, number> = {};
    const usersMap: Record<string, number> = {};
    for (const r of filteredRows) {
      const code = r.reasonCode || "GENERAL";
      reasonsMap[code] = (reasonsMap[code] || 0) + 1;
      const u = r.actionByUsername || "System";
      usersMap[u] = (usersMap[u] || 0) + 1;
    }

    const paginatedMoves = filteredRows.slice(offset, offset + limit);

    res.json({
      success: true,
      stats: {
        totalMoves: filteredRows.length,
        todayMoves,
        reasonsBreakdown: reasonsMap,
        usersBreakdown: usersMap,
      },
      moves: paginatedMoves,
      allMoves: filteredRows,
      pagination: {
        page,
        limit,
        total: filteredRows.length,
        totalPages: Math.ceil(filteredRows.length / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

router.get("/vacations", requirePermission("reports", "view"), validate({ query: VacationsReportQuery }), async (req, res, next): Promise<any> => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res.status(400).json({ success: false, message: "propertyId required" });

    const search = ((req.query.search as string) || "").trim().toLowerCase();
    const status = (req.query.status as string) || "ALL";
    const department = (req.query.department as string) || "";
    const buildingId = req.query.buildingId ? Number(req.query.buildingId) : undefined;
    const dateFrom = (req.query.dateFrom as string) || "";
    const dateTo = (req.query.dateTo as string) || "";

    const result = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          const vacationRows = await tenantDb
            .select({
              id: profileVacationsTable.id,
              profileId: profileVacationsTable.profileId,
              startDate: profileVacationsTable.startDate,
              endDate: profileVacationsTable.endDate,
              actualReturnDate: profileVacationsTable.actualReturnDate,
              notes: profileVacationsTable.notes,
              status: profileVacationsTable.status,
              createdAt: profileVacationsTable.createdAt,
              employeeId: profilesTable.profileId,
              name: sql<string>`concat(${profilesTable.firstName}, ' ', ${profilesTable.lastName})`,
              department: profilesTable.department,
              jobTitle: profilesTable.jobTitle,
              phone: profilesTable.phone,
              nationalId: profilesTable.nationalId,
              gender: profilesTable.gender,
              nationality: profilesTable.nationality,
              employmentType: profilesTable.employmentType,
              profileStatus: profilesTable.status,
            })
            .from(profileVacationsTable)
            .innerJoin(profilesTable, eq(profileVacationsTable.profileId, profilesTable.id))
            .orderBy(desc(profileVacationsTable.startDate), desc(profileVacationsTable.id));

          const assignments = await tenantDb
            .select({
              profileId: assignmentsTable.profileId,
              roomId: assignmentsTable.roomId,
              bedNumber: assignmentsTable.bedNumber,
              isEntireRoom: assignmentsTable.isEntireRoom,
              status: assignmentsTable.status,
              roomNumber: roomsTable.roomNumber,
              roomType: roomsTable.roomType,
              capacity: roomsTable.capacity,
              floorId: roomsTable.floorId,
              buildingId: roomsTable.buildingId,
              buildingName: buildingsTable.name,
            })
            .from(assignmentsTable)
            .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
            .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id));

          const profileAssignmentMap = new Map<number, any>();
          for (const a of assignments) {
            if (a.profileId == null) continue;
            const existing = profileAssignmentMap.get(a.profileId);
            if (!existing || (a.status === "ACTIVE" && existing.status !== "ACTIVE")) {
              profileAssignmentMap.set(a.profileId, a);
            }
          }

          const todayStr = new Date().toISOString().slice(0, 10);

          const data = vacationRows
            .map((v) => {
              const ass = profileAssignmentMap.get(v.profileId);

              let computedStatus = "ACTIVE";
              if (v.actualReturnDate) {
                computedStatus = "COMPLETED";
              } else if (v.endDate && v.endDate < todayStr) {
                computedStatus = "OVERDUE";
              }

              const start = new Date(v.startDate);
              const end = new Date(v.actualReturnDate || v.endDate);
              let duration = 0;
              if (!isNaN(start.getTime()) && !isNaN(end.getTime())) {
                duration = Math.max(1, Math.round((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
              }

              return {
                id: v.id,
                profileId: v.profileId,
                profileCode: v.employeeId || `EMP-${v.profileId}`,
                fullName: v.name || "—",
                department: v.department || "—",
                jobTitle: v.jobTitle || "—",
                phone: v.phone || "",
                nationalId: v.nationalId || "",
                gender: v.gender || "",
                nationality: v.nationality || "",
                employmentType: v.employmentType || "",
                startDate: v.startDate,
                endDate: v.endDate,
                actualReturnDate: v.actualReturnDate || null,
                duration,
                statusKey: computedStatus,
                rawStatus: v.status,
                notes: v.notes || "",
                createdAt: v.createdAt,
                roomId: ass?.roomId || null,
                roomNumber: ass?.roomNumber || "—",
                roomType: ass?.roomType || "",
                capacity: ass?.capacity || 1,
                floorId: ass?.floorId || null,
                bedNumber: ass?.bedNumber || "—",
                isEntireRoom: ass?.isEntireRoom || false,
                buildingId: ass?.buildingId || null,
                buildingName: ass?.buildingName || "—",
              };
            })
            .filter((item) => {
              if (status && status !== "ALL") {
                if (item.statusKey !== status) return false;
              }

              if (department && department !== "all" && item.department !== department) {
                return false;
              }

              if (buildingId && item.buildingId !== buildingId) {
                return false;
              }

              // Historical Date Query: [dateFrom, dateTo]
              const vStart = item.startDate;
              const vEnd = item.actualReturnDate || item.endDate || "9999-12-31";

              if (dateFrom && vEnd < dateFrom) {
                return false;
              }
              if (dateTo && vStart > dateTo) {
                return false;
              }

              if (search) {
                const q = search.toLowerCase();
                const match =
                  item.fullName.toLowerCase().includes(q) ||
                  item.profileCode.toLowerCase().includes(q) ||
                  item.department.toLowerCase().includes(q) ||
                  item.jobTitle.toLowerCase().includes(q) ||
                  String(item.roomNumber).toLowerCase().includes(q) ||
                  String(item.buildingName).toLowerCase().includes(q) ||
                  item.notes.toLowerCase().includes(q);
                if (!match) return false;
              }

              return true;
            });

          return data;
        }),
      []
    );

    res.json({ success: true, data: result });
  } catch (err) {
    next(err);
  }
});

router.get("/", requirePermission("reports", "view"), validate({ query: ReportsListQuery }), async (req, res, next): Promise<any> => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res.status(400).json({ success: false, message: "propertyId required" });

    const page = parseInt(req.query.page as string) || 1;
    const limit = parseInt(req.query.limit as string) || 10;
    const offset = (page - 1) * limit;
    const search = (req.query.search as string) || "";
    const tab = (req.query.tab as string) || "housing";

    const result = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          let data: any[] = [];
          let totalCount = 0;

          if (tab === "housing") {
            const baseQuery = tenantDb.select().from(roomsTable);
            let conditions: any[] = [];
            if (search) {
              conditions.push(or(
                ilike(roomsTable.roomNumber, `%${search}%`),
                ilike(roomsTable.roomType, `%${search}%`),
                ilike(roomsTable.status, `%${search}%`)
              ) as any);
            }
            
            const whereClause = and(...conditions);
            
            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(roomsTable)
              .where(whereClause);
            
            totalCount = countRes.count;
            data = await tenantDb
              .select()
              .from(roomsTable)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(roomsTable.createdAt));
          } else if (tab === "profiles") {
            const baseQuery = tenantDb.select().from(profilesTable);
            let conditions: any[] = [];
            if (search) {
              conditions.push(or(
                ilike(profilesTable.firstName, `%${search}%`),
                ilike(profilesTable.lastName, `%${search}%`),
                ilike(profilesTable.profileId, `%${search}%`),
                ilike(profilesTable.department, `%${search}%`)
              ) as any);
            }
            
            const whereClause = and(...conditions);
            
            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(profilesTable)
              .where(whereClause);
            
            totalCount = countRes.count;
            data = await tenantDb
              .select()
              .from(profilesTable)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(profilesTable.createdAt));
          } else if (tab === "assignments") {
            let conditions: any[] = [];
            if (search) {
              conditions.push(or(
                ilike(assignmentsTable.status, `%${search}%`)
              ) as any);
            }
            
            const whereClause = and(...conditions);
            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(assignmentsTable)
              .where(whereClause);
              
            totalCount = countRes.count;
            data = await tenantDb
              .select()
              .from(assignmentsTable)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(assignmentsTable.createdAt));
          } else if (tab === "maintenance") {
            let conditions: any[] = [];
            if (search) {
              conditions.push(or(
                ilike(maintenanceTable.category, `%${search}%`),
                ilike(maintenanceTable.problemType, `%${search}%`),
                ilike(maintenanceTable.status, `%${search}%`)
              ) as any);
            }
            
            const whereClause = and(...conditions);
            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(maintenanceTable)
              .where(whereClause);
              
            totalCount = countRes.count;
            data = await tenantDb
              .select()
              .from(maintenanceTable)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(maintenanceTable.reportedAt));
          } else if (tab === "hostings") {
            let conditions: any[] = [];
            if (search) {
              conditions.push(or(
                ilike(hostingsTable.status, `%${search}%`),
                ilike(hostingsTable.hostingType, `%${search}%`)
              ) as any);
            }
            
            const whereClause = and(...conditions);
            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(hostingsTable)
              .where(whereClause);
              
            totalCount = countRes.count;
            data = await tenantDb
              .select()
              .from(hostingsTable)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(hostingsTable.createdAt));
          } else if (tab === "reservations") {
            let conditions: any[] = [];
            if (search) {
              conditions.push(or(
                ilike(reservationsTable.firstName, `%${search}%`),
                ilike(reservationsTable.lastName, `%${search}%`),
                ilike(reservationsTable.department, `%${search}%`),
                ilike(reservationsTable.status, `%${search}%`)
              ) as any);
            }
            
            const whereClause = and(...conditions);
            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(reservationsTable)
              .where(whereClause);
              
            totalCount = countRes.count;
            data = await tenantDb
              .select()
              .from(reservationsTable)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(reservationsTable.createdAt));
          }

          return {
            data,
            pagination: {
              total: totalCount,
              page,
              limit,
            },
          };
        }),
      { data: [], pagination: { total: 0, page, limit } }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
