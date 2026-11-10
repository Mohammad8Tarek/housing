import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import { roomsTable, maintenanceTable, workersTable, buildingsTable, floorsTable, propertiesTable, propertyHousingRatingsTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";
import { requirePermission } from "../../middlewares/permissions.js";
import { validate } from "../../middlewares/validate.js";
import { RatingsReportQuery } from "../../validation/schemas.js";
import { getTenantId } from "../../lib/request-utils.js";
import { withTableFallback } from "../../lib/with-table-fallback.js";

const router: Router = Router();

router.get("/service-ratings", requirePermission("reports", "view"), validate({ query: RatingsReportQuery }), async (req, res, next): Promise<any> => {
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
router.get("/housing-ratings", requirePermission("reports", "view"), validate({ query: RatingsReportQuery }), async (req, res, next) => {
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

export default router;
