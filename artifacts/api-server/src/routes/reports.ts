import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import {
  roomsTable,
  profilesTable,
  assignmentsTable,
  maintenanceTable,
  reservationsTable,
  hostingsTable,
  hostingCompanionsTable,
  workersTable,
  profileVacationsTable,
  buildingsTable,
  floorsTable,
  customReportTemplatesTable,
  propertiesTable,
  propertyHousingRatingsTable,
  roomMovesTable,
} from "@workspace/db";
import { eq, and, or, ilike, desc, sql, count } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";
import { withTableFallback } from "../lib/with-table-fallback.js";

const router: Router = Router();

// @ts-ignore
router.get("/service-ratings", requirePermission("reports", "view"), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res.status(400).json({ success: false, message: "propertyId required" });

    const category = (req.query.category as string) || "all";
    const fromDate = req.query.fromDate as string;
    const toDate = req.query.toDate as string;

    const result = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          let conditions: any[] = [];
          
          if (category && category !== "all") {
            conditions.push(eq(maintenanceTable.category, category));
          }

          if (fromDate) {
            try {
              const d = new Date(fromDate);
              if (!isNaN(d.getTime())) {
                conditions.push(sql`${maintenanceTable.reportedAt} >= ${d.toISOString()}::timestamptz`);
              }
            } catch {}
          }

          if (toDate) {
            try {
              const d = new Date(toDate);
              if (!isNaN(d.getTime())) {
                d.setHours(23, 59, 59, 999);
                conditions.push(sql`${maintenanceTable.reportedAt} <= ${d.toISOString()}::timestamptz`);
              }
            } catch {}
          }

          const whereClause = conditions.length ? and(...conditions) : undefined;

          const rows = await tenantDb
            .select({
              id: maintenanceTable.id,
              roomId: maintenanceTable.roomId,
              roomNumber: roomsTable.roomNumber,
              buildingName: buildingsTable.name,
              floorNumber: floorsTable.floorNumber,
              category: maintenanceTable.category,
              problemType: maintenanceTable.problemType,
              description: maintenanceTable.description,
              status: maintenanceTable.status,
              priority: maintenanceTable.priority,
              reportedBy: maintenanceTable.reportedBy,
              assignedTo: maintenanceTable.assignedTo,
              workerId: maintenanceTable.workerId,
              workerName: workersTable.name,
              workerSpecialty: workersTable.specialty,
              reportedAt: maintenanceTable.reportedAt,
              resolvedAt: maintenanceTable.resolvedAt,
              rating: maintenanceTable.rating,
              ratingComment: maintenanceTable.ratingComment,
              ratedAt: maintenanceTable.ratedAt,
            })
            .from(maintenanceTable)
            .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
            .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
            .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
            .leftJoin(workersTable, eq(maintenanceTable.workerId, workersTable.id))
            .where(whereClause)
            .orderBy(desc(maintenanceTable.ratedAt), desc(maintenanceTable.id));

          const totalTickets = rows.length;
          const completedTickets = rows.filter(r => ["resolved", "closed", "completed"].includes((r.status || "").toLowerCase()));
          const ratedTickets = rows.filter(r => r.rating != null && r.rating > 0);
          const unratedTickets = completedTickets.filter(r => !r.rating);

          const sumRating = ratedTickets.reduce((acc, r) => acc + (r.rating || 0), 0);
          const averageRating = ratedTickets.length > 0 ? Number((sumRating / ratedTickets.length).toFixed(2)) : 0;

          const mntRated = ratedTickets.filter(r => r.category === "maintenance");
          const mntAvg = mntRated.length > 0 ? Number((mntRated.reduce((a, b) => a + (b.rating || 0), 0) / mntRated.length).toFixed(2)) : 0;

          const hskRated = ratedTickets.filter(r => r.category === "housekeeping");
          const hskAvg = hskRated.length > 0 ? Number((hskRated.reduce((a, b) => a + (b.rating || 0), 0) / hskRated.length).toFixed(2)) : 0;

          const satisfiedCount = ratedTickets.filter(r => (r.rating || 0) >= 4).length;
          const satisfactionRate = ratedTickets.length > 0 ? Math.round((satisfiedCount / ratedTickets.length) * 100) : 0;

          const starsBreakdown: Record<number, number> = { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 };
          ratedTickets.forEach(r => {
            const stars = Math.min(5, Math.max(1, Math.round(r.rating || 0)));
            starsBreakdown[stars] = (starsBreakdown[stars] || 0) + 1;
          });

          // Worker Leaderboard
          const workerMap = new Map<string, { workerId: number | null; workerName: string; specialty: string; totalRated: number; totalRating: number; satisfiedCount: number }>();
          ratedTickets.forEach(r => {
            const key = r.workerId ? String(r.workerId) : (r.workerName || "Unassigned");
            if (!workerMap.has(key)) {
              workerMap.set(key, {
                workerId: r.workerId,
                workerName: r.workerName || "غير معين",
                specialty: r.workerSpecialty || "عام",
                totalRated: 0,
                totalRating: 0,
                satisfiedCount: 0,
              });
            }
            const item = workerMap.get(key)!;
            item.totalRated += 1;
            item.totalRating += r.rating || 0;
            if ((r.rating || 0) >= 4) item.satisfiedCount += 1;
          });

          const workerLeaderboard = Array.from(workerMap.values())
            .map(w => ({
              ...w,
              averageRating: Number((w.totalRating / w.totalRated).toFixed(2)),
              satisfactionRate: Math.round((w.satisfiedCount / w.totalRated) * 100),
            }))
            .sort((a, b) => b.averageRating - a.averageRating || b.totalRated - a.totalRated);

          return {
            summary: {
              totalTickets,
              completedTicketsCount: completedTickets.length,
              totalRated: ratedTickets.length,
              unratedCount: unratedTickets.length,
              averageRating,
              maintenanceAvg: mntAvg,
              housekeepingAvg: hskAvg,
              satisfactionRate,
              starsBreakdown,
            },
            workerLeaderboard,
            ratedTickets,
          };
        }),
      {
        summary: {
          totalTickets: 0,
          completedTicketsCount: 0,
          totalRated: 0,
          unratedCount: 0,
          averageRating: 0,
          maintenanceAvg: 0,
          housekeepingAvg: 0,
          satisfactionRate: 0,
          starsBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
        },
        workerLeaderboard: [],
        ratedTickets: [],
      }
    );

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/housing-ratings (Automated 7-Day Property Housing Ratings) ───
// Strict Anonymity: profileId is NEVER exposed in the response
// @ts-ignore
router.get("/housing-ratings", requirePermission("reports", "view"), async (req, res, next) => {
  try {
    const rawProp = req.query.propertyId as string | undefined;
    const isAll = !rawProp || rawProp === "all" || rawProp === "-1" || rawProp === "0";
    const propertyId = isAll ? null : Number(rawProp);

    const fromDate = req.query.fromDate as string | undefined;
    const toDate = req.query.toDate as string | undefined;
    const ratingFilter = ((req.query.rating as string) || "all").toLowerCase();
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(100, Math.max(1, parseInt(req.query.limit as string, 10) || 20));
    const offset = (page - 1) * limit;

    let conditions: any[] = [];

    if (propertyId) {
      conditions.push(eq(propertyHousingRatingsTable.propertyId, propertyId));
    }

    if (ratingFilter && ratingFilter !== "all") {
      conditions.push(eq(propertyHousingRatingsTable.rating, ratingFilter));
    }

    if (fromDate) {
      const d = new Date(fromDate);
      if (!isNaN(d.getTime())) {
        conditions.push(sql`${propertyHousingRatingsTable.createdAt} >= ${d.toISOString()}::timestamptz`);
      }
    }

    if (toDate) {
      const d = new Date(toDate);
      if (!isNaN(d.getTime())) {
        d.setHours(23, 59, 59, 999);
        conditions.push(sql`${propertyHousingRatingsTable.createdAt} <= ${d.toISOString()}::timestamptz`);
      }
    }

    const whereClause = conditions.length ? and(...conditions) : undefined;

    // Fetch all ratings matching criteria for aggregation
    const allRows = await db
      .select({
        id: propertyHousingRatingsTable.id,
        propertyId: propertyHousingRatingsTable.propertyId,
        propertyName: propertiesTable.name,
        propertyDisplayName: propertiesTable.displayName,
        rating: propertyHousingRatingsTable.rating,
        score: propertyHousingRatingsTable.score,
        comment: propertyHousingRatingsTable.comment,
        createdAt: propertyHousingRatingsTable.createdAt,
      })
      .from(propertyHousingRatingsTable)
      .leftJoin(propertiesTable, eq(propertyHousingRatingsTable.propertyId, propertiesTable.id))
      .where(whereClause)
      .orderBy(desc(propertyHousingRatingsTable.createdAt));

    const totalRatings = allRows.length;
    const satisfiedRows = allRows.filter((r) => r.rating === "satisfied");
    const neutralRows = allRows.filter((r) => r.rating === "neutral");
    const dissatisfiedRows = allRows.filter((r) => r.rating === "dissatisfied");

    const satisfiedCount = satisfiedRows.length;
    const neutralCount = neutralRows.length;
    const dissatisfiedCount = dissatisfiedRows.length;

    const satisfactionRate = totalRatings > 0 ? Math.round((satisfiedCount / totalRatings) * 100) : 0;
    const sumScore = allRows.reduce((acc, r) => acc + (r.score || 0), 0);
    const averageScore = totalRatings > 0 ? Number((sumScore / totalRatings).toFixed(2)) : 0;

    // Property Breakdown
    const propMap = new Map<number, {
      propertyId: number;
      propertyName: string;
      total: number;
      satisfied: number;
      neutral: number;
      dissatisfied: number;
      satisfactionRate: number;
      averageScore: number;
      sumScore: number;
    }>();

    for (const r of allRows) {
      const pid = r.propertyId;
      const name = r.propertyDisplayName || r.propertyName || `Property #${pid}`;
      if (!propMap.has(pid)) {
        propMap.set(pid, {
          propertyId: pid,
          propertyName: name,
          total: 0,
          satisfied: 0,
          neutral: 0,
          dissatisfied: 0,
          satisfactionRate: 0,
          averageScore: 0,
          sumScore: 0,
        });
      }
      const entry = propMap.get(pid)!;
      entry.total++;
      entry.sumScore += r.score || 0;
      if (r.rating === "satisfied") entry.satisfied++;
      else if (r.rating === "neutral") entry.neutral++;
      else if (r.rating === "dissatisfied") entry.dissatisfied++;
    }

    const propertyBreakdown = Array.from(propMap.values()).map((p) => ({
      ...p,
      satisfactionRate: p.total > 0 ? Math.round((p.satisfied / p.total) * 100) : 0,
      averageScore: p.total > 0 ? Number((p.sumScore / p.total).toFixed(2)) : 0,
    }));

    // Comments feed (rows with comment text)
    const rowsWithComments = allRows.filter((r) => r.comment && r.comment.trim().length > 0);
    const paginatedComments = rowsWithComments.slice(offset, offset + limit).map((r) => ({
      id: r.id,
      propertyId: r.propertyId,
      propertyName: r.propertyDisplayName || r.propertyName || `Property #${r.propertyId}`,
      rating: r.rating,
      score: r.score,
      comment: r.comment,
      createdAt: r.createdAt,
    }));

    res.json({
      success: true,
      stats: {
        totalRatings,
        satisfiedCount,
        neutralCount,
        dissatisfiedCount,
        satisfiedPct: totalRatings > 0 ? Math.round((satisfiedCount / totalRatings) * 100) : 0,
        neutralPct: totalRatings > 0 ? Math.round((neutralCount / totalRatings) * 100) : 0,
        dissatisfiedPct: totalRatings > 0 ? Math.round((dissatisfiedCount / totalRatings) * 100) : 0,
        satisfactionRate,
        averageScore,
        commentsCount: rowsWithComments.length,
      },
      propertyBreakdown,
      comments: paginatedComments,
      allComments: rowsWithComments.map((r) => ({
        id: r.id,
        propertyId: r.propertyId,
        propertyName: r.propertyDisplayName || r.propertyName || `Property #${r.propertyId}`,
        rating: r.rating,
        score: r.score,
        comment: r.comment,
        createdAt: r.createdAt,
      })),
      pagination: {
        page,
        limit,
        total: rowsWithComments.length,
        totalPages: Math.ceil(rowsWithComments.length / limit) || 1,
      },
    });
  } catch (err) {
    next(err);
  }
});

// ─── GET /api/reports/room-moves (PMS Room Moves & Bed Transfers Report) ─────
// @ts-ignore
router.get("/room-moves", requirePermission("reports", "view"), async (req, res, next) => {
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

// @ts-ignore
router.get("/vacations", requirePermission("reports", "view"), async (req, res, next) => {
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

// @ts-ignore
router.get("/", requirePermission("reports", "view"), async (req, res, next) => {
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

// ─── CUSTOM REPORT BUILDER & CONFIGURATION ────────────────────────────────

// 1. GET /custom/templates - List saved templates
// @ts-ignore
router.get("/custom/templates", requirePermission("reports", "view"), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const result = await withTableFallback(
      async () => {
        if (propertyId) {
          return await withTenant(propertyId, async (tenantDb) => {
            return await tenantDb
              .select()
              .from(customReportTemplatesTable)
              .orderBy(desc(customReportTemplatesTable.updatedAt), desc(customReportTemplatesTable.id));
          });
        } else {
          return await db
            .select()
            .from(customReportTemplatesTable)
            .orderBy(desc(customReportTemplatesTable.updatedAt), desc(customReportTemplatesTable.id));
        }
      },
      []
    );
    res.json({ success: true, templates: result || [] });
  } catch (err) {
    next(err);
  }
});

// 2. POST /custom/templates - Create template
// @ts-ignore
router.post("/custom/templates", requirePermission("reports", "create"), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const { name, nameEn, dataSource, columns, filters, layoutOptions } = req.body;
    if (!name || !dataSource) {
      return res.status(400).json({ success: false, message: "Name and dataSource are required" });
    }

    const payload = {
      propertyId: propertyId ? Number(propertyId) : null,
      name,
      nameEn: nameEn || null,
      dataSource,
      columns: columns || [],
      filters: filters || {},
      layoutOptions: layoutOptions || {},
      createdBy: (req as any).user?.id || null,
    };

    const result = await withTableFallback(
      async () => {
        if (propertyId) {
          return await withTenant(propertyId, async (tenantDb) => {
            const [inserted] = await tenantDb
              .insert(customReportTemplatesTable)
              .values(payload)
              .returning();
            return inserted;
          });
        } else {
          const [inserted] = await db
            .insert(customReportTemplatesTable)
            .values(payload)
            .returning();
          return inserted;
        }
      },
      null
    );

    res.json({ success: true, template: result });
  } catch (err) {
    next(err);
  }
});

// 3. PUT /custom/templates/:id - Update template
// @ts-ignore
router.put("/custom/templates/:id", requirePermission("reports", "edit"), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);
    const { name, nameEn, dataSource, columns, filters, layoutOptions } = req.body;

    const payload: any = {
      updatedAt: new Date(),
    };
    if (name !== undefined) payload.name = name;
    if (nameEn !== undefined) payload.nameEn = nameEn;
    if (dataSource !== undefined) payload.dataSource = dataSource;
    if (columns !== undefined) payload.columns = columns;
    if (filters !== undefined) payload.filters = filters;
    if (layoutOptions !== undefined) payload.layoutOptions = layoutOptions;

    const result = await withTableFallback(
      async () => {
        if (propertyId) {
          return await withTenant(propertyId, async (tenantDb) => {
            const [updated] = await tenantDb
              .update(customReportTemplatesTable)
              .set(payload)
              .where(eq(customReportTemplatesTable.id, id))
              .returning();
            return updated;
          });
        } else {
          const [updated] = await db
            .update(customReportTemplatesTable)
            .set(payload)
            .where(eq(customReportTemplatesTable.id, id))
            .returning();
          return updated;
        }
      },
      null
    );

    res.json({ success: true, template: result });
  } catch (err) {
    next(err);
  }
});

// 4. DELETE /custom/templates/:id - Delete template
// @ts-ignore
router.delete("/custom/templates/:id", requirePermission("reports", "delete"), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const id = Number(req.params.id);

    await withTableFallback(
      async () => {
        if (propertyId) {
          await withTenant(propertyId, async (tenantDb) => {
            await tenantDb
              .delete(customReportTemplatesTable)
              .where(eq(customReportTemplatesTable.id, id));
          });
        } else {
          await db
            .delete(customReportTemplatesTable)
            .where(eq(customReportTemplatesTable.id, id));
        }
      },
      null
    );

    res.json({ success: true, message: "Template deleted" });
  } catch (err) {
    next(err);
  }
});

// 5. POST /custom/query - Dynamic Report Query Engine
// @ts-ignore
router.post("/custom/query", requirePermission("reports", "view"), async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      return res.status(400).json({ success: false, message: "propertyId required" });
    }

    const {
      dataSource = "in_house",
      columns = [],
      filters = {},
      page = 1,
      limit = 20,
      sortBy,
      sortOrder = "asc",
      fetchAll = false,
    } = req.body;

    const result = await withTableFallback(
      async () => {
        try {
          return await withTenant(propertyId, async (tenantDb) => {
            let rows: any[] = [];
          let totalCount = 0;
          let stats: any = {};

          const search = ((filters.search as string) || "").trim().toLowerCase();
          const buildingId = filters.buildingId && filters.buildingId !== "all" ? Number(filters.buildingId) : undefined;
          const floorId = filters.floorId && filters.floorId !== "all" ? Number(filters.floorId) : undefined;
          const department = filters.department && filters.department !== "all" ? String(filters.department).trim() : undefined;
          const jobLevel = filters.jobLevel && filters.jobLevel !== "all" ? String(filters.jobLevel).trim() : undefined;
          const gender = filters.gender && filters.gender !== "all" ? String(filters.gender).trim().toUpperCase() : undefined;
          const status = filters.status && filters.status !== "all" ? String(filters.status).trim() : undefined;
          const dateFrom = filters.dateFrom ? String(filters.dateFrom).trim() : undefined;
          const dateTo = filters.dateTo ? String(filters.dateTo).trim() : undefined;

          // ─── SOURCE: IN-HOUSE ───────────────────────────────────────────
          if (dataSource === "in_house") {
            const rawRows = await tenantDb
              .select({
                id: assignmentsTable.id,
                assignmentId: assignmentsTable.id,
                profileId: profilesTable.id,
                employeeId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                firstNameAr: profilesTable.firstNameAr,
                lastNameAr: profilesTable.lastNameAr,
                jobTitle: profilesTable.jobTitle,
                jobTitleAr: profilesTable.jobTitleAr,
                department: profilesTable.department,
                departmentAr: profilesTable.departmentAr,
                jobLevel: profilesTable.level,
                gender: profilesTable.gender,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
                company: profilesTable.companyName,
                nationality: profilesTable.nationality,
                profileStatus: profilesTable.status,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.floorNumber,
                roomId: roomsTable.id,
                roomNumber: roomsTable.roomNumber,
                roomType: roomsTable.roomType,
                bedNumber: assignmentsTable.bedNumber,
                isEntireRoom: assignmentsTable.isEntireRoom,
                status: assignmentsTable.status,
                checkInDate: assignmentsTable.checkInDate,
                expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
                checkOutDate: assignmentsTable.checkOutDate,
                notes: assignmentsTable.notes,
                createdAt: assignmentsTable.createdAt,
              })
              .from(assignmentsTable)
              .innerJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
              .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .orderBy(desc(assignmentsTable.id));

            let filtered = rawRows.filter((r) => {
              if (status && status !== "all") {
                if ((r.status || "").toUpperCase() !== status.toUpperCase()) return false;
              } else if (!filters.status || filters.status === "active") {
                if ((r.status || "").toUpperCase() !== "ACTIVE") return false;
              }
              if (buildingId && r.buildingId !== buildingId) return false;
              if (floorId && r.floorId !== floorId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (jobLevel && String(r.jobLevel ?? "").toLowerCase() !== String(jobLevel).toLowerCase()) return false;
              if (gender && (r.gender || "").toUpperCase() !== gender) return false;

              if (dateFrom) {
                const itemDate = r.checkInDate;
                if (itemDate && new Date(itemDate) < new Date(dateFrom)) return false;
              }
              if (dateTo) {
                const itemDate = r.checkInDate;
                if (itemDate && new Date(itemDate) > new Date(dateTo)) return false;
              }

              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  fullName,
                  r.firstNameAr,
                  r.lastNameAr,
                  r.employeeId,
                  r.nationalId,
                  r.phone,
                  r.roomNumber,
                  r.buildingName,
                  r.department,
                  r.jobTitle,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            // Map computed fields
            rows = filtered.map((r, idx) => {
              const checkIn = r.checkInDate;
              let days = 0;
              if (checkIn) {
                const start = new Date(checkIn).getTime();
                const end = r.checkOutDate || r.expectedCheckOutDate ? new Date(r.checkOutDate || r.expectedCheckOutDate).getTime() : Date.now();
                days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
              }
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...r,
                name: fullName,
                startDate: r.checkInDate,
                endDate: r.checkOutDate || r.expectedCheckOutDate,
                daysInHouse: days,
                stayDuration: `${days} يوم`,
              };
            });

            stats = {
              totalRecords: rows.length,
              activeCount: rows.filter((r) => r.status === "ACTIVE").length,
              distinctBuildings: new Set(rows.map((r) => r.buildingName).filter(Boolean)).size,
              distinctRooms: new Set(rows.map((r) => r.roomNumber).filter(Boolean)).size,
              distinctDepartments: new Set(rows.map((r) => r.department).filter(Boolean)).size,
            };
          }

          // ─── SOURCE: PROFILES ───────────────────────────────────────────
          else if (dataSource === "profiles") {
            const rawProfiles = await tenantDb
              .select({
                id: profilesTable.id,
                profileId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                firstNameAr: profilesTable.firstNameAr,
                lastNameAr: profilesTable.lastNameAr,
                jobTitle: profilesTable.jobTitle,
                jobTitleAr: profilesTable.jobTitleAr,
                department: profilesTable.department,
                departmentAr: profilesTable.departmentAr,
                level: profilesTable.level,
                gender: profilesTable.gender,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
                companyName: profilesTable.companyName,
                nationality: profilesTable.nationality,
                status: profilesTable.status,
                hireDate: profilesTable.hireDate,
                contractEndDate: profilesTable.contractEndDate,
                createdAt: profilesTable.createdAt,
              })
              .from(profilesTable)
              .orderBy(desc(profilesTable.id));

            // Fetch active assignments for profiles to display their room
            const activeAssignments = await tenantDb
              .select({
                profileId: assignmentsTable.profileId,
                roomNumber: roomsTable.roomNumber,
                buildingName: buildingsTable.name,
                buildingId: roomsTable.buildingId,
                floorId: roomsTable.floorId,
                bedNumber: assignmentsTable.bedNumber,
              })
              .from(assignmentsTable)
              .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .where(eq(assignmentsTable.status, "ACTIVE"));

            const assignmentMap = new Map<number, any>();
            activeAssignments.forEach((a) => {
              if (a.profileId) assignmentMap.set(a.profileId, a);
            });

            let filtered = rawProfiles.filter((p) => {
              const currentAssign = assignmentMap.get(p.id);
              if (status && status !== "all" && (p.status || "").toUpperCase() !== status.toUpperCase()) return false;
              if (department && (p.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (jobLevel && String(p.level ?? "").toLowerCase() !== String(jobLevel).toLowerCase()) return false;
              if (gender && (p.gender || "").toUpperCase() !== gender) return false;
              if (buildingId && currentAssign?.buildingId !== buildingId) return false;
              if (floorId && currentAssign?.floorId !== floorId) return false;

              const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  fullName,
                  p.firstNameAr,
                  p.lastNameAr,
                  p.profileId,
                  p.nationalId,
                  p.phone,
                  p.department,
                  p.jobTitle,
                  p.companyName,
                  currentAssign?.roomNumber,
                  currentAssign?.buildingName,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((p, idx) => {
              const currentAssign = assignmentMap.get(p.id);
              const fullName = [p.firstName, p.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...p,
                name: fullName,
                employeeId: p.profileId,
                jobLevel: p.level,
                company: p.companyName,
                roomNumber: currentAssign?.roomNumber || "غير مسكن",
                buildingName: currentAssign?.buildingName || "—",
                bedNumber: currentAssign?.bedNumber || "—",
                isHoused: !!currentAssign,
              };
            });

            stats = {
              totalRecords: rows.length,
              housedCount: rows.filter((r) => r.isHoused).length,
              unhousedCount: rows.filter((r) => !r.isHoused).length,
              distinctDepartments: new Set(rows.map((r) => r.department).filter(Boolean)).size,
            };
          }

          // ─── SOURCE: ROOMS (with In-House Occupants Mix Data) ───────────
          else if (dataSource === "rooms") {
            const rawRooms = await tenantDb
              .select({
                id: roomsTable.id,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.floorNumber,
                roomType: roomsTable.roomType,
                capacity: roomsTable.capacity,
                currentOccupancy: roomsTable.currentOccupancy,
                status: roomsTable.status,
                gender: roomsTable.gender,
                view: roomsTable.view,
                bedType: roomsTable.bedType,
                classification: roomsTable.classification,
                notes: roomsTable.notes,
              })
              .from(roomsTable)
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .orderBy(buildingsTable.name, roomsTable.roomNumber);

            // Fetch active assignments for in-house mix data
            const activeAssignments = await tenantDb
              .select({
                roomId: assignmentsTable.roomId,
                bedNumber: assignmentsTable.bedNumber,
                checkInDate: assignmentsTable.checkInDate,
                profileId: profilesTable.id,
                employeeId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                firstNameAr: profilesTable.firstNameAr,
                lastNameAr: profilesTable.lastNameAr,
                jobTitle: profilesTable.jobTitle,
                jobTitleAr: profilesTable.jobTitleAr,
                department: profilesTable.department,
                departmentAr: profilesTable.departmentAr,
                phone: profilesTable.phone,
                nationality: profilesTable.nationality,
              })
              .from(assignmentsTable)
              .innerJoin(profilesTable, eq(assignmentsTable.profileId, profilesTable.id))
              .where(eq(assignmentsTable.status, "ACTIVE"));

            const roomAssignMap = new Map<number, any[]>();
            activeAssignments.forEach((a) => {
              if (a.roomId) {
                if (!roomAssignMap.has(a.roomId)) roomAssignMap.set(a.roomId, []);
                roomAssignMap.get(a.roomId)!.push(a);
              }
            });

            let filtered = rawRooms.filter((r) => {
              const assigns = roomAssignMap.get(r.id) || [];
              if (buildingId && r.buildingId !== buildingId) return false;
              if (floorId && r.floorId !== floorId) return false;
              if (status && status !== "all" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (filters.gender && filters.gender !== "all" && (r.gender || "").toLowerCase() !== String(filters.gender).toLowerCase()) return false;
              if (filters.roomType && filters.roomType !== "all" && (r.roomType || "").toLowerCase() !== String(filters.roomType).toLowerCase()) return false;
              if (department && department !== "all") {
                const hasDept = assigns.some((a) => (a.department || "").toLowerCase() === department.toLowerCase());
                if (!hasDept) return false;
              }

              if (search) {
                const occNames = assigns.map((a) => [a.firstName, a.lastName].filter(Boolean).join(" ")).join(" ");
                const occDepts = assigns.map((a) => a.department || "").join(" ");
                const occJobs = assigns.map((a) => a.jobTitle || "").join(" ");
                const occIds = assigns.map((a) => a.employeeId || "").join(" ");
                const occPhones = assigns.map((a) => a.phone || "").join(" ");

                const haystack = [
                  r.roomNumber,
                  r.buildingName,
                  r.roomType,
                  r.status,
                  r.gender,
                  r.bedType,
                  r.view,
                  occNames,
                  occDepts,
                  occJobs,
                  occIds,
                  occPhones,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              const assigns = roomAssignMap.get(r.id) || [];
              const cap = r.capacity || 0;
              const occ = assigns.length || r.currentOccupancy || 0;
              const vac = Math.max(0, cap - occ);
              const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;

              const occupantNames = assigns
                .map((a) => [a.firstName, a.lastName].filter(Boolean).join(" "))
                .filter(Boolean)
                .join("، ") || "—";

              const occupantDetails = assigns
                .map((a) => {
                  const n = [a.firstName, a.lastName].filter(Boolean).join(" ");
                  return a.bedNumber ? `${n} (سرير ${a.bedNumber})` : n;
                })
                .filter(Boolean)
                .join(" | ") || "—";

              const occupantDepartments = Array.from(
                new Set(assigns.map((a) => a.department).filter(Boolean)),
              ).join("، ") || "—";

              const occupantJobTitles = Array.from(
                new Set(assigns.map((a) => a.jobTitle).filter(Boolean)),
              ).join("، ") || "—";

              const occupantEmployeeIds = assigns
                .map((a) => a.employeeId)
                .filter(Boolean)
                .join("، ") || "—";

              const occupantPhones = assigns
                .map((a) => a.phone)
                .filter(Boolean)
                .join("، ") || "—";

              const occupantNationalities = Array.from(
                new Set(assigns.map((a) => a.nationality).filter(Boolean)),
              ).join("، ") || "—";

              const formatDMYString = (d: any) => {
                if (!d) return "";
                try {
                  const dt = new Date(d);
                  if (isNaN(dt.getTime())) return String(d);
                  const day = String(dt.getDate()).padStart(2, "0");
                  const month = String(dt.getMonth() + 1).padStart(2, "0");
                  const year = dt.getFullYear();
                  return `${day}/${month}/${year}`;
                } catch {
                  return String(d);
                }
              };

              const occupantCheckInDates = assigns
                .map((a) => formatDMYString(a.checkInDate))
                .filter(Boolean)
                .join("، ") || "—";

              return {
                index: idx + 1,
                ...r,
                occupiedBeds: occ,
                vacantBeds: vac,
                occupancyPct: `${pct}%`,
                cleanlinessStatus: r.status === "dirty" ? "dirty" : "clean",
                genderPolicy: r.gender || "all",
                // Mixed Resident Data
                occupants: assigns,
                occupantCount: assigns.length,
                occupantNames,
                occupantDetails,
                occupantDepartments,
                occupantJobTitles,
                occupantEmployeeIds,
                occupantPhones,
                occupantNationalities,
                occupantCheckInDates,
              };
            });

            const totalCap = rows.reduce((acc, r) => acc + (r.capacity || 0), 0);
            const totalOcc = rows.reduce((acc, r) => acc + (r.occupiedBeds || 0), 0);
            const totalVac = rows.reduce((acc, r) => acc + (r.vacantBeds || 0), 0);

            stats = {
              totalRooms: rows.length,
              totalCapacity: totalCap,
              totalOccupied: totalOcc,
              totalVacant: totalVac,
              overallOccupancyPct: totalCap > 0 ? `${Math.round((totalOcc / totalCap) * 100)}%` : "0%",
              occupiedRoomsCount: rows.filter((r) => (r.occupiedBeds || 0) > 0).length,
              vacantRoomsCount: rows.filter((r) => (r.occupiedBeds || 0) === 0).length,
            };
          }

          // ─── SOURCE: RESERVATIONS ───────────────────────────────────────
          else if (dataSource === "reservations") {
            const rawRes = await tenantDb
              .select({
                id: reservationsTable.id,
                firstName: reservationsTable.firstName,
                lastName: reservationsTable.lastName,
                profileCode: reservationsTable.profileCode,
                guestIdCardNumber: reservationsTable.guestIdCardNumber,
                guestPhone: reservationsTable.guestPhone,
                department: reservationsTable.department,
                jobTitle: reservationsTable.jobTitle,
                level: reservationsTable.level,
                gender: reservationsTable.gender,
                nationality: reservationsTable.nationality,
                companyName: reservationsTable.companyName,
                checkInDate: reservationsTable.checkInDate,
                checkOutDate: reservationsTable.checkOutDate,
                status: reservationsTable.status,
                roomType: reservationsTable.roomType,
                bedNumber: reservationsTable.bedNumber,
                notes: reservationsTable.notes,
                roomId: reservationsTable.roomId,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                createdAt: reservationsTable.createdAt,
              })
              .from(reservationsTable)
              .leftJoin(roomsTable, eq(reservationsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .orderBy(desc(reservationsTable.id));

            let filtered = rawRes.filter((r) => {
              if (status && status !== "all" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.checkInDate && new Date(r.checkInDate) < new Date(dateFrom)) return false;
              if (dateTo && r.checkInDate && new Date(r.checkInDate) > new Date(dateTo)) return false;

              const guestName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  guestName,
                  r.profileCode,
                  r.department,
                  r.jobTitle,
                  r.guestPhone,
                  r.guestIdCardNumber,
                  r.roomNumber,
                  r.buildingName,
                  r.status,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              let nights = 0;
              if (r.checkInDate && r.checkOutDate) {
                const s = new Date(r.checkInDate).getTime();
                const e = new Date(r.checkOutDate).getTime();
                nights = Math.max(1, Math.round((e - s) / (1000 * 60 * 60 * 24)));
              }
              const guestName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...r,
                guestName,
                name: guestName,
                employeeId: r.profileCode,
                jobLevel: r.level,
                company: r.companyName,
                phone: r.guestPhone,
                nationalId: r.guestIdCardNumber,
                nights,
              };
            });

            stats = {
              totalReservations: rows.length,
              pendingCount: rows.filter((r) => (r.status || "").toLowerCase() === "pending").length,
              confirmedCount: rows.filter((r) => (r.status || "").toLowerCase() === "confirmed").length,
              cancelledCount: rows.filter((r) => (r.status || "").toLowerCase() === "cancelled").length,
            };
          }

          // ─── SOURCE: MAINTENANCE ────────────────────────────────────────
          else if (dataSource === "maintenance") {
            const rawMnt = await tenantDb
              .select({
                id: maintenanceTable.id,
                ticketNumber: maintenanceTable.id,
                category: maintenanceTable.category,
                problemType: maintenanceTable.problemType,
                description: maintenanceTable.description,
                status: maintenanceTable.status,
                priority: maintenanceTable.priority,
                reportedBy: maintenanceTable.reportedBy,
                reportedAt: maintenanceTable.reportedAt,
                assignedTo: maintenanceTable.assignedTo,
                workerId: maintenanceTable.workerId,
                workerName: workersTable.name,
                resolvedAt: maintenanceTable.resolvedAt,
                rating: maintenanceTable.rating,
                ratingComment: maintenanceTable.ratingComment,
                roomId: maintenanceTable.roomId,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
              })
              .from(maintenanceTable)
              .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(workersTable, eq(maintenanceTable.workerId, workersTable.id))
              .orderBy(desc(maintenanceTable.id));

            let filtered = rawMnt.filter((r) => {
              if (status && status !== "all" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (filters.priority && filters.priority !== "all" && (r.priority || "").toLowerCase() !== String(filters.priority).toLowerCase()) return false;
              if (filters.category && filters.category !== "all" && (r.category || "").toLowerCase() !== String(filters.category).toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (dateFrom && r.reportedAt && new Date(r.reportedAt) < new Date(dateFrom)) return false;
              if (dateTo && r.reportedAt && new Date(r.reportedAt) > new Date(dateTo)) return false;

              if (search) {
                const haystack = [
                  String(r.id),
                  r.problemType,
                  r.description,
                  r.category,
                  r.roomNumber,
                  r.buildingName,
                  r.reportedBy,
                  r.workerName,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => ({
              index: idx + 1,
              ...r,
            }));

            stats = {
              totalTickets: rows.length,
              pendingCount: rows.filter((r) => ["pending", "open", "in_progress"].includes((r.status || "").toLowerCase())).length,
              resolvedCount: rows.filter((r) => ["resolved", "closed", "completed"].includes((r.status || "").toLowerCase())).length,
              urgentCount: rows.filter((r) => (r.priority || "").toLowerCase() === "urgent").length,
            };
          }

          // ─── SOURCE: VACATIONS ──────────────────────────────────────────
          else if (dataSource === "vacations") {
            const rawVac = await tenantDb
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
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                department: profilesTable.department,
                jobTitle: profilesTable.jobTitle,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
              })
              .from(profileVacationsTable)
              .innerJoin(profilesTable, eq(profileVacationsTable.profileId, profilesTable.id))
              .orderBy(desc(profileVacationsTable.id));

            let filtered = rawVac.filter((r) => {
              if (status && status !== "all" && (r.status || "").toUpperCase() !== status.toUpperCase()) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.startDate && new Date(r.startDate) < new Date(dateFrom)) return false;
              if (dateTo && r.startDate && new Date(r.startDate) > new Date(dateTo)) return false;

              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              if (search) {
                const haystack = [
                  fullName,
                  r.employeeId,
                  r.department,
                  r.jobTitle,
                  r.phone,
                  r.status,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              const fullName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              return {
                index: idx + 1,
                ...r,
                name: fullName,
              };
            });

            stats = {
              totalVacations: rows.length,
              activeVacations: rows.filter((r) => (r.status || "").toUpperCase() === "ACTIVE").length,
              returnedVacations: rows.filter((r) => (r.status || "").toUpperCase() === "RETURNED").length,
              overdueVacations: rows.filter((r) => (r.status || "").toUpperCase() === "OVERDUE").length,
            };
          }

          // ─── SOURCE: HOSTINGS ───────────────────────────────────────────
          else if (dataSource === "hostings") {
            const rawHost = await tenantDb
              .select({
                id: hostingsTable.id,
                profileId: hostingsTable.profileId,
                hostingType: hostingsTable.hostingType,
                guestsCount: hostingsTable.guestsCount,
                startDate: hostingsTable.expectedFrom,
                endDate: hostingsTable.expectedTo,
                actualCheckIn: hostingsTable.actualCheckIn,
                actualCheckOut: hostingsTable.actualCheckOut,
                status: hostingsTable.status,
                notes: hostingsTable.notes,
                roomId: hostingsTable.roomId,
                roomNumber: roomsTable.roomNumber,
                buildingName: buildingsTable.name,
                buildingId: roomsTable.buildingId,
                employeeId: profilesTable.profileId,
                firstName: profilesTable.firstName,
                lastName: profilesTable.lastName,
                department: profilesTable.department,
                createdAt: hostingsTable.createdAt,
              })
              .from(hostingsTable)
              .leftJoin(profilesTable, eq(hostingsTable.profileId, profilesTable.id))
              .leftJoin(roomsTable, eq(hostingsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .orderBy(desc(hostingsTable.id));

            const companions = await tenantDb.select().from(hostingCompanionsTable);
            const compMap = new Map<number, any>();
            companions.forEach((c) => {
              if (!compMap.has(c.hostingId)) compMap.set(c.hostingId, c);
            });

            let filtered = rawHost.filter((r) => {
              if (status && status !== "all" && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.startDate && new Date(r.startDate) < new Date(dateFrom)) return false;
              if (dateTo && r.startDate && new Date(r.startDate) > new Date(dateTo)) return false;

              const hostName = [r.firstName, r.lastName].filter(Boolean).join(" ");
              const comp = compMap.get(r.id);
              if (search) {
                const haystack = [
                  comp?.name,
                  hostName,
                  r.employeeId,
                  comp?.idNumber,
                  comp?.relation,
                  r.roomNumber,
                  r.buildingName,
                  r.department,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              const comp = compMap.get(r.id);
              return {
                index: idx + 1,
                ...r,
                hostName: [r.firstName, r.lastName].filter(Boolean).join(" "),
                guestName: comp?.name || "ضيف",
                relation: comp?.relation || "—",
                nationalId: comp?.idNumber || "—",
              };
            });

            stats = {
              totalHostings: rows.length,
              activeCount: rows.filter((r) => (r.status || "").toLowerCase() === "active").length,
              approvedCount: rows.filter((r) => (r.status || "").toLowerCase() === "approved").length,
            };
          }

          // Optional sorting
          if (sortBy) {
            rows.sort((a, b) => {
              let valA = a[sortBy] ?? "";
              let valB = b[sortBy] ?? "";
              if (typeof valA === "string") valA = valA.toLowerCase();
              if (typeof valB === "string") valB = valB.toLowerCase();
              if (valA < valB) return sortOrder === "asc" ? -1 : 1;
              if (valA > valB) return sortOrder === "asc" ? 1 : -1;
              return 0;
            });
          }

          totalCount = rows.length;

          // Pagination
          let paginatedRows = rows;
          if (!fetchAll) {
            const offset = (Number(page) - 1) * Number(limit);
            paginatedRows = rows.slice(offset, offset + Number(limit));
          }

          return {
            success: true,
            data: paginatedRows,
            total: totalCount,
            page: Number(page),
            limit: Number(limit),
            totalPages: Math.ceil(totalCount / Number(limit)) || 1,
            stats,
          };
        });
      } catch (err) {
        console.error("[POST /api/reports/custom/query error]:", err);
        throw err;
      }
    },
      {
        success: false,
        data: [],
        total: 0,
        page: 1,
        limit: 20,
        totalPages: 1,
        stats: {},
      }
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

export default router;
