import { Router } from "express";
import { withTenant, assignmentsTable, roomsTable, maintenanceTable, activityLogsTable, buildingsTable } from "@workspace/db";
import { eq, desc } from "drizzle-orm";
import { requirePermission } from "../../middlewares/permissions.js";
import { validate } from "../../middlewares/validate.js";
import { DashboardActivityQuery } from "../../validation/schemas.js";
import { getTenantId } from "../../lib/request-utils.js";
import { safeSelect, statusEq } from "./shared.js";

const router: Router = Router();

// ─── GET /dashboard/tickets-overview (Dual-track Maintenance & Housekeeping with Ratings) ─
router.get(
  "/dashboard/tickets-overview",
  requirePermission("dashboard", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ success: false, message: "propertyId is required" });
      return;
    }

    try {
      const data = await withTenant(propertyId, async (tenantDb) => {
        // Fetch all tickets with room and building info
        const allTickets = await safeSelect(() =>
          tenantDb
            .select({
              id: maintenanceTable.id,
              roomId: maintenanceTable.roomId,
              category: maintenanceTable.category,
              problemType: maintenanceTable.problemType,
              description: maintenanceTable.description,
              status: maintenanceTable.status,
              priority: maintenanceTable.priority,
              reportedBy: maintenanceTable.reportedBy,
              reportedAt: maintenanceTable.reportedAt,
              resolvedAt: maintenanceTable.resolvedAt,
              rating: maintenanceTable.rating,
              ratingComment: maintenanceTable.ratingComment,
              ratedAt: maintenanceTable.ratedAt,
              roomNumber: roomsTable.roomNumber,
              buildingName: buildingsTable.name,
            })
            .from(maintenanceTable)
            .leftJoin(roomsTable, eq(maintenanceTable.roomId, roomsTable.id))
            .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
            .orderBy(desc(maintenanceTable.reportedAt))
        );

        const mntTickets = allTickets.filter(
          (t) => (t.category || "maintenance").toLowerCase() !== "housekeeping"
        );
        const hskTickets = allTickets.filter(
          (t) => (t.category || "").toLowerCase() === "housekeeping"
        );

        function calcTrackStats(tickets: typeof allTickets) {
          const total = tickets.length;
          let open = 0;
          let approved = 0;
          let done = 0;
          let urgent = 0;
          let sumRating = 0;
          let ratedCount = 0;
          let satisfiedCount = 0;

          for (const t of tickets) {
            const st = (t.status || "open").toLowerCase();
            const pr = (t.priority || "medium").toLowerCase();

            if (st === "open") open++;
            else if (st === "in_progress" || st === "pending") approved++;
            else if (st === "resolved" || st === "closed" || st === "completed") done++;

            if (pr === "urgent" && st !== "closed" && st !== "resolved" && st !== "completed") urgent++;

            if (typeof t.rating === "number" && t.rating > 0) {
              sumRating += t.rating;
              ratedCount++;
              if (t.rating >= 4) satisfiedCount++;
            }
          }

          const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
          const avgRating = ratedCount > 0 ? Math.round((sumRating / ratedCount) * 10) / 10 : 0;
          const satisfactionRate = ratedCount > 0 ? Math.round((satisfiedCount / ratedCount) * 100) : 0;

          return {
            total,
            open,
            approved,
            done,
            urgent,
            completionRate,
            ratingStats: {
              avgRating,
              totalRated: ratedCount,
              satisfactionRate,
            },
          };
        }

        return {
          maintenance: calcTrackStats(mntTickets),
          housekeeping: calcTrackStats(hskTickets),
          recentMaintenance: mntTickets.slice(0, 8),
          recentHousekeeping: hskTickets.slice(0, 8),
        };
      });

      res.json({ success: true, data });
    } catch (err: any) {
      console.error("[DashboardTicketsOverview] Error:", err);
      res.status(500).json({ success: false, message: err.message || "Failed to load tickets overview" });
    }
  },
);

// ─── GET /dashboard/recent-activity ──────────────────────────────────────
router.get(
  "/dashboard/recent-activity",
  requirePermission("dashboard", "view"),
  validate({ query: DashboardActivityQuery }),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
      return;
    }

    const limit = Math.min(
      50,
      parseInt((req.query.limit as string) ?? "20", 10),
    );

    const logs = await withTenant(propertyId, async (tenantDb) => {
      return await safeSelect(() =>
        tenantDb
          .select()
          .from(activityLogsTable)
          .orderBy(desc(activityLogsTable.timestamp))
          .limit(limit),
      );
    });

    res.json(
      logs.map((l) => ({
        ...l,
        timestamp:
          l.timestamp instanceof Date ? l.timestamp.toISOString() : l.timestamp,
      })),
    );
  },
);

// ─── GET /dashboard/occupancy-by-building ────────────────────────────────
router.get(
  "/dashboard/occupancy-by-building",
  requirePermission("dashboard", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
      return;
    }

    const { buildings, rooms, activeAssignments } = await withTenant(
      propertyId,
      async (tenantDb) => {
        return {
          buildings: await safeSelect(() =>
            tenantDb.select().from(buildingsTable),
          ),
          rooms: await safeSelect(() => tenantDb.select().from(roomsTable)),
          activeAssignments: await safeSelect(() =>
            tenantDb
              .select()
              .from(assignmentsTable)
              .where(statusEq(assignmentsTable.status, "active")),
          ),
        };
      },
    );

    const result = buildings.map((b) => {
      const bRooms = rooms.filter((r) => r.buildingId === b.id);
      const bRoomIds = new Set(bRooms.map((r) => r.id));
      const bActiveAssignments = activeAssignments.filter(
        (a) => a.roomId && bRoomIds.has(a.roomId),
      );
      const occupiedRoomIds = new Set(bActiveAssignments.map((a) => a.roomId));
      const total = bRooms.length;
      const occupied = occupiedRoomIds.size;
      const capacity = bRooms.reduce((s, r) => s + (r.capacity ?? 0), 0);

      let bOccupiedBeds = 0;
      for (const a of bActiveAssignments) {
        if (a.isEntireRoom) {
          const roomObj = bRooms.find((r) => r.id === a.roomId);
          bOccupiedBeds += Number(roomObj?.capacity) || 1;
        } else {
          bOccupiedBeds += 1;
        }
      }

      const availableBeds = Math.max(0, capacity - bOccupiedBeds);
      const occupancyRate =
        capacity > 0 ? Math.round((bOccupiedBeds / capacity) * 1000) / 10 : 0;
      const roomOccupancyRate =
        total > 0 ? Math.round((occupied / total) * 1000) / 10 : 0;

      return {
        buildingId: b.id,
        buildingName: b.name,
        totalRooms: total,
        occupiedRooms: occupied,
        availableRooms: Math.max(0, total - occupied),
        totalCapacity: capacity,
        totalOccupancy: bOccupiedBeds,
        occupiedBeds: bOccupiedBeds,
        availableBeds,
        occupancyRate,
        roomOccupancyRate,
      };
    });

    res.json(result);
  },
);

export default router;
