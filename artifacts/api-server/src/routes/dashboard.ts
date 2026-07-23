import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  assignmentsTable,
  reservationsTable,
  roomsTable,
  employeesTable,
  maintenanceTable,
  activityLogsTable,
  buildingsTable,
} from "@workspace/db";
import { eq, and, lte, gte, count, desc, sql, gt } from "drizzle-orm";
import { requireAuth, requirePermission } from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";

const router: Router = Router();

// ─── Helper: safe count query ──────────────────────────────────────────────
async function safeCount(
  queryFn: () => Promise<{ count: number }[]>,
): Promise<number> {
  try {
    const [row] = await queryFn();
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

// ─── Helper: safe select query ─────────────────────────────────────────────
async function safeSelect<T>(
  queryFn: () => Promise<T[]>,
  fallback: T[] = [],
): Promise<T[]> {
  try {
    return await queryFn();
  } catch {
    return fallback;
  }
}

function statusEq(column: any, status: string) {
  return sql`lower(${column}) = ${status.toLowerCase()}`;
}

// ─── GET /dashboard/all-stats (aggregated across all properties) ───────
router.get(
  "/dashboard/all-stats",
  requireAuth,
  async (req, res): Promise<void> => {
    if (!(req.session as any)?.isSystemAdmin) {
      res.status(403).json({ success: false, message: "Access denied" });
      return;
    }

    const result = await pool.query(
      "SELECT id, name, code FROM properties ORDER BY id",
    );
    const allProperties = result.rows.map((r: any) => ({
      id: r.id as number,
      name: r.name as string,
      code: r.code as string,
    }));

    const perProperty = await Promise.all(
      allProperties.map(
        async (p: { id: number; name: string; code: string }) => {
          try {
            const stats = await withTenant(p.id, async (tenantDb) => {
              const [
                totalRooms,
                occupiedRooms,
                totalEmployees,
                activeAssignments,
                openMaintenance,
                upcomingReservations,
                totalBuildings,
              ] = await Promise.all([
                safeCount(() =>
                  tenantDb.select({ count: count() }).from(roomsTable),
                ),
                safeCount(() =>
                  tenantDb
                    .select({ count: count() })
                    .from(roomsTable)
                    .where(gt(roomsTable.currentOccupancy, 0)),
                ),
                safeCount(() =>
                  tenantDb
                    .select({ count: count() })
                    .from(employeesTable)
                    .where(statusEq(employeesTable.status, "active")),
                ),
                safeCount(() =>
                  tenantDb
                    .select({ count: count() })
                    .from(assignmentsTable)
                    .where(statusEq(assignmentsTable.status, "active")),
                ),
                safeCount(() =>
                  tenantDb
                    .select({ count: count() })
                    .from(maintenanceTable)
                    .where(statusEq(maintenanceTable.status, "open")),
                ),
                safeCount(() =>
                  tenantDb
                    .select({ count: count() })
                    .from(reservationsTable)
                    .where(statusEq(reservationsTable.status, "upcoming")),
                ),
                safeCount(() =>
                  tenantDb.select({ count: count() }).from(buildingsTable),
                ),
              ]);
              const occupancyRate =
                totalRooms > 0
                  ? Math.round((occupiedRooms / totalRooms) * 1000) / 10
                  : 0;
              return {
                totalRooms,
                occupiedRooms,
                totalEmployees,
                activeAssignments,
                openMaintenance,
                upcomingReservations,
                totalBuildings,
                occupancyRate,
              };
            });
            return { ...p, ...stats };
          } catch {
            return {
              ...p,
              totalRooms: 0,
              occupiedRooms: 0,
              totalEmployees: 0,
              activeAssignments: 0,
              openMaintenance: 0,
              upcomingReservations: 0,
              totalBuildings: 0,
              occupancyRate: 0,
            };
          }
        },
      ),
    );

    const totals = perProperty.reduce(
      (acc: any, p: any) => ({
        totalRooms: acc.totalRooms + p.totalRooms,
        totalEmployees: acc.totalEmployees + p.totalEmployees,
        activeAssignments: acc.activeAssignments + p.activeAssignments,
        openMaintenance: acc.openMaintenance + p.openMaintenance,
        upcomingReservations: acc.upcomingReservations + p.upcomingReservations,
        totalBuildings: acc.totalBuildings + p.totalBuildings,
      }),
      {
        totalRooms: 0,
        totalEmployees: 0,
        activeAssignments: 0,
        openMaintenance: 0,
        upcomingReservations: 0,
        totalBuildings: 0,
      },
    );

    res.json({ totals, perProperty });
  },
);

// ─── GET /dashboard/stats ─────────────────────────────────────────────────
router.get(
  "/dashboard/stats",
  requirePermission("dashboard", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res
        .status(400)
        .json({ success: false, message: "propertyId is required" });
      return;
    }

    // ✅ استخدام withTenant للاتصال بالسكيما المعزولة
    // ✅ التنفيذ متسلسل (Sequential) للحفاظ على الـ Connection Pool
    const stats = await withTenant(propertyId, async (tenantDb) => {
      const [
        totalRooms,
        occupiedRooms,
        availableRooms,
        totalEmployees,
        activeAssignments,
        openMaintenance,
        inProgressMaint,
        upcomingReservations,
        totalReservations,
        totalBuildings,
      ] = await Promise.all([
        safeCount(() => tenantDb.select({ count: count() }).from(roomsTable)),
        safeCount(() =>
          tenantDb
            .select({ count: count() })
            .from(roomsTable)
            .where(gt(roomsTable.currentOccupancy, 0)),
        ),
        safeCount(() =>
          tenantDb
            .select({ count: count() })
            .from(roomsTable)
            .where(
              sql`${roomsTable.currentOccupancy} < ${roomsTable.capacity}`,
            ),
        ),
        safeCount(() =>
          tenantDb
            .select({ count: count() })
            .from(employeesTable)
            .where(statusEq(employeesTable.status, "active")),
        ),
        safeCount(() =>
          tenantDb
            .select({ count: count() })
            .from(assignmentsTable)
            .where(statusEq(assignmentsTable.status, "active")),
        ),
        safeCount(() =>
          tenantDb
            .select({ count: count() })
            .from(maintenanceTable)
            .where(statusEq(maintenanceTable.status, "open")),
        ),
        safeCount(() =>
          tenantDb
            .select({ count: count() })
            .from(maintenanceTable)
            .where(statusEq(maintenanceTable.status, "in_progress")),
        ),
        safeCount(() =>
          tenantDb
            .select({ count: count() })
            .from(reservationsTable)
            .where(statusEq(reservationsTable.status, "upcoming")),
        ),
        safeCount(() =>
          tenantDb.select({ count: count() }).from(reservationsTable),
        ),
        safeCount(() =>
          tenantDb.select({ count: count() }).from(buildingsTable),
        ),
      ]);
      return {
        totalRooms,
        occupiedRooms,
        availableRooms,
        totalEmployees,
        activeAssignments,
        openMaintenance,
        inProgressMaint,
        upcomingReservations,
        totalReservations,
        totalBuildings,
      };
    });

    const {
      totalRooms,
      occupiedRooms,
      availableRooms,
      totalEmployees,
      activeAssignments,
      openMaintenance,
      inProgressMaint,
      upcomingReservations,
      totalReservations,
      totalBuildings,
    } = stats;

    const occupancyRate =
      totalRooms > 0 ? Math.round((occupiedRooms / totalRooms) * 1000) / 10 : 0;
    const unhousedEmployees = Math.max(0, totalEmployees - activeAssignments);
    const pendingMaintenance = openMaintenance + inProgressMaint;

    res.json({
      totalEmployees,
      occupancyRate,
      pendingMaintenance,
      activeEmployees: totalEmployees,
      unhousedEmployees,
      totalRooms,
      occupiedRooms,
      availableRooms,
      totalBuildings,
      openMaintenance,
      overdueMaintenance: inProgressMaint,
      upcomingReservations,
      totalReservations,
      activeAssignments,
    });
  },
);

// ─── GET /dashboard/pending ────────────────────────────────────────────────
router.get(
  "/dashboard/pending",
  requirePermission("dashboard", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ success: false, message: "propertyId is required" });
      return;
    }

    const today = new Date().toISOString().split("T")[0]!;
    const future = new Date(Date.now() + 3 * 86_400_000).toISOString().split("T")[0]!;

    const result = await withTenant(propertyId, async (tenantDb) => {
      const checkOuts = await safeSelect(() =>
        tenantDb.select({
          assignment: assignmentsTable,
          employee: employeesTable,
          room: roomsTable,
        })
        .from(assignmentsTable)
        .leftJoin(employeesTable, eq(assignmentsTable.employeeId, employeesTable.id))
        .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
        .where(
          and(
            statusEq(assignmentsTable.status, "active"),
            gte(assignmentsTable.expectedCheckOutDate, today),
            lte(assignmentsTable.expectedCheckOutDate, future),
          ),
        )
        .limit(20)
      );

      const checkIns = await safeSelect(() =>
        tenantDb.select()
        .from(reservationsTable)
        .where(
          and(
            statusEq(reservationsTable.status, "upcoming"),
            gte(reservationsTable.checkInDate, today),
            lte(reservationsTable.checkInDate, future),
          ),
        )
        .limit(20)
      );

      const maintenanceRequests = await safeSelect(() =>
        tenantDb.select()
        .from(maintenanceTable)
        .where(statusEq(maintenanceTable.status, "open"))
        .limit(20)
      );

      return { checkOuts, checkIns, maintenanceRequests };
    });

    res.json({
      checkOuts: result.checkOuts.map(r => ({ ...r.assignment, employeeName: r.employee?.firstName, roomNumber: r.room?.roomNumber })),
      checkIns: result.checkIns,
      maintenanceRequests: result.maintenanceRequests
    });
  }
);

// ─── GET /dashboard/recent-activity ──────────────────────────────────────
router.get(
  "/dashboard/recent-activity",
  requirePermission("dashboard", "view"),
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

    const { buildings, rooms } = await withTenant(
      propertyId,
      async (tenantDb) => {
        return {
          buildings: await safeSelect(() =>
            tenantDb.select().from(buildingsTable),
          ),
          rooms: await safeSelect(() => tenantDb.select().from(roomsTable)),
        };
      },
    );

    const result = buildings.map((b) => {
      const bRooms = rooms.filter((r) => r.buildingId === b.id);
      const total = bRooms.length;
      const occupied = bRooms.filter(
        (r) => (r.currentOccupancy ?? 0) > 0,
      ).length;
      const capacity = bRooms.reduce((s, r) => s + (r.capacity ?? 0), 0);
      const occupancy = bRooms.reduce(
        (s, r) => s + (r.currentOccupancy ?? 0),
        0,
      );

      return {
        buildingId: b.id,
        buildingName: b.name,
        totalRooms: total,
        occupiedRooms: occupied,
        availableRooms: total - occupied,
        totalCapacity: capacity,
        totalOccupancy: occupancy,
        occupancyRate:
          capacity > 0 ? Math.round((occupancy / capacity) * 1000) / 10 : 0,
      };
    });

    res.json(result);
  },
);

export default router;
