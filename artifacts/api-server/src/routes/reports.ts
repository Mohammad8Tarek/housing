import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import {
  roomsTable,
  profilesTable,
  assignmentsTable,
  maintenanceTable,
  reservationsTable,
  hostingsTable,
  workersTable,
  profileVacationsTable,
  buildingsTable,
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
              employeeId: profilesTable.employeeId,
              name: profilesTable.name,
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

export default router;
