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
  floorsTable,
  customReportTemplatesTable,
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
              floorNumber: floorsTable.number,
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
      async () =>
        withTenant(propertyId, async (tenantDb) => {
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
                employeeId: profilesTable.employeeId,
                name: profilesTable.name,
                firstNameAr: profilesTable.firstNameAr,
                lastNameAr: profilesTable.lastNameAr,
                jobTitle: profilesTable.jobTitle,
                jobTitleAr: profilesTable.jobTitleAr,
                department: profilesTable.department,
                departmentAr: profilesTable.departmentAr,
                jobLevel: profilesTable.jobLevel,
                gender: profilesTable.gender,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
                company: profilesTable.company,
                nationality: profilesTable.nationality,
                profileStatus: profilesTable.status,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.number,
                roomId: roomsTable.id,
                roomNumber: roomsTable.roomNumber,
                roomType: roomsTable.roomType,
                bedNumber: assignmentsTable.bedNumber,
                isEntireRoom: assignmentsTable.isEntireRoom,
                status: assignmentsTable.status,
                startDate: assignmentsTable.startDate,
                endDate: assignmentsTable.endDate,
                checkInDate: assignmentsTable.checkInDate,
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
              if (status) {
                if ((r.status || "").toUpperCase() !== status.toUpperCase()) return false;
              } else {
                // Default to ACTIVE
                if ((r.status || "").toUpperCase() !== "ACTIVE") return false;
              }
              if (buildingId && r.buildingId !== buildingId) return false;
              if (floorId && r.floorId !== floorId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (jobLevel && String(r.jobLevel ?? "") !== String(jobLevel)) return false;
              if (gender && (r.gender || "").toUpperCase() !== gender) return false;

              if (dateFrom) {
                const itemDate = r.checkInDate || r.startDate;
                if (itemDate && new Date(itemDate) < new Date(dateFrom)) return false;
              }
              if (dateTo) {
                const itemDate = r.checkInDate || r.startDate;
                if (itemDate && new Date(itemDate) > new Date(dateTo)) return false;
              }

              if (search) {
                const haystack = [
                  r.name,
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
              const checkIn = r.checkInDate || r.startDate;
              let days = 0;
              if (checkIn) {
                const start = new Date(checkIn).getTime();
                const end = r.checkOutDate || r.endDate ? new Date(r.checkOutDate || r.endDate).getTime() : Date.now();
                days = Math.max(0, Math.floor((end - start) / (1000 * 60 * 60 * 24)));
              }
              return {
                index: idx + 1,
                ...r,
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
              .select()
              .from(profilesTable)
              .orderBy(profilesTable.employeeId);

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
              if (status && (p.status || "").toUpperCase() !== status.toUpperCase()) return false;
              if (department && (p.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (jobLevel && String(p.jobLevel ?? "") !== String(jobLevel)) return false;
              if (gender && (p.gender || "").toUpperCase() !== gender) return false;
              if (buildingId && currentAssign?.buildingId !== buildingId) return false;
              if (floorId && currentAssign?.floorId !== floorId) return false;

              if (search) {
                const haystack = [
                  p.name,
                  p.firstNameAr,
                  p.lastNameAr,
                  p.employeeId,
                  p.nationalId,
                  p.phone,
                  p.department,
                  p.jobTitle,
                  p.company,
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
              return {
                index: idx + 1,
                ...p,
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

          // ─── SOURCE: ROOMS ──────────────────────────────────────────────
          else if (dataSource === "rooms") {
            const rawRooms = await tenantDb
              .select({
                id: roomsTable.id,
                roomNumber: roomsTable.roomNumber,
                buildingId: roomsTable.buildingId,
                buildingName: buildingsTable.name,
                floorId: roomsTable.floorId,
                floorNumber: floorsTable.number,
                roomType: roomsTable.roomType,
                capacity: roomsTable.capacity,
                occupiedBeds: roomsTable.occupiedBeds,
                status: roomsTable.status,
                cleanlinessStatus: roomsTable.cleanlinessStatus,
                genderPolicy: roomsTable.genderPolicy,
                notes: roomsTable.notes,
              })
              .from(roomsTable)
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .leftJoin(floorsTable, eq(roomsTable.floorId, floorsTable.id))
              .orderBy(buildingsTable.name, roomsTable.roomNumber);

            let filtered = rawRooms.filter((r) => {
              if (buildingId && r.buildingId !== buildingId) return false;
              if (floorId && r.floorId !== floorId) return false;
              if (status && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (filters.cleanlinessStatus && filters.cleanlinessStatus !== "all" && (r.cleanlinessStatus || "").toLowerCase() !== String(filters.cleanlinessStatus).toLowerCase()) return false;
              if (filters.roomType && filters.roomType !== "all" && (r.roomType || "").toLowerCase() !== String(filters.roomType).toLowerCase()) return false;

              if (search) {
                const haystack = [
                  r.roomNumber,
                  r.buildingName,
                  r.roomType,
                  r.status,
                  r.cleanlinessStatus,
                ]
                  .filter(Boolean)
                  .join(" ")
                  .toLowerCase();
                if (!haystack.includes(search)) return false;
              }
              return true;
            });

            rows = filtered.map((r, idx) => {
              const cap = r.capacity || 0;
              const occ = r.occupiedBeds || 0;
              const vac = Math.max(0, cap - occ);
              const pct = cap > 0 ? Math.round((occ / cap) * 100) : 0;
              return {
                index: idx + 1,
                ...r,
                vacantBeds: vac,
                occupancyPct: `${pct}%`,
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
            };
          }

          // ─── SOURCE: RESERVATIONS ───────────────────────────────────────
          else if (dataSource === "reservations") {
            const rawRes = await tenantDb
              .select({
                id: reservationsTable.id,
                guestName: reservationsTable.guestName,
                employeeId: reservationsTable.employeeId,
                department: reservationsTable.department,
                jobTitle: reservationsTable.jobTitle,
                checkInDate: reservationsTable.checkInDate,
                checkOutDate: reservationsTable.checkOutDate,
                status: reservationsTable.status,
                roomType: reservationsTable.roomType,
                bookingSource: reservationsTable.bookingSource,
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
              if (status && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.checkInDate && new Date(r.checkInDate) < new Date(dateFrom)) return false;
              if (dateTo && r.checkInDate && new Date(r.checkInDate) > new Date(dateTo)) return false;

              if (search) {
                const haystack = [
                  r.guestName,
                  r.employeeId,
                  r.department,
                  r.jobTitle,
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
              return {
                index: idx + 1,
                ...r,
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
              if (status && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
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
                employeeId: profilesTable.employeeId,
                name: profilesTable.name,
                department: profilesTable.department,
                jobTitle: profilesTable.jobTitle,
                phone: profilesTable.phone,
                nationalId: profilesTable.nationalId,
              })
              .from(profileVacationsTable)
              .innerJoin(profilesTable, eq(profileVacationsTable.profileId, profilesTable.id))
              .orderBy(desc(profileVacationsTable.id));

            let filtered = rawVac.filter((r) => {
              if (status && (r.status || "").toUpperCase() !== status.toUpperCase()) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.startDate && new Date(r.startDate) < new Date(dateFrom)) return false;
              if (dateTo && r.startDate && new Date(r.startDate) > new Date(dateTo)) return false;

              if (search) {
                const haystack = [
                  r.name,
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

            rows = filtered.map((r, idx) => ({
              index: idx + 1,
              ...r,
            }));

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
                guestName: hostingsTable.guestName,
                relation: hostingsTable.relation,
                nationalId: hostingsTable.nationalId,
                startDate: hostingsTable.startDate,
                endDate: hostingsTable.endDate,
                status: hostingsTable.status,
                hostingType: hostingsTable.hostingType,
                roomId: hostingsTable.roomId,
                roomNumber: roomsTable.roomNumber,
                buildingName: buildingsTable.name,
                buildingId: roomsTable.buildingId,
                employeeId: profilesTable.employeeId,
                hostName: profilesTable.name,
                department: profilesTable.department,
                createdAt: hostingsTable.createdAt,
              })
              .from(hostingsTable)
              .leftJoin(profilesTable, eq(hostingsTable.profileId, profilesTable.id))
              .leftJoin(roomsTable, eq(hostingsTable.roomId, roomsTable.id))
              .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
              .orderBy(desc(hostingsTable.id));

            let filtered = rawHost.filter((r) => {
              if (status && (r.status || "").toLowerCase() !== status.toLowerCase()) return false;
              if (buildingId && r.buildingId !== buildingId) return false;
              if (department && (r.department || "").toLowerCase() !== department.toLowerCase()) return false;
              if (dateFrom && r.startDate && new Date(r.startDate) < new Date(dateFrom)) return false;
              if (dateTo && r.startDate && new Date(r.startDate) > new Date(dateTo)) return false;

              if (search) {
                const haystack = [
                  r.guestName,
                  r.hostName,
                  r.employeeId,
                  r.nationalId,
                  r.relation,
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

            rows = filtered.map((r, idx) => ({
              index: idx + 1,
              ...r,
            }));

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
        }),
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
