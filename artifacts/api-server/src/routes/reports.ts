import { Router } from "express";
import { db, withTenant } from "@workspace/db";
import {
  roomsTable,
  employeesTable,
  assignmentsTable,
  maintenanceTable,
  reservationsTable,
  hostingsTable,
} from "@workspace/db";
import { eq, and, or, ilike, desc, sql, count } from "drizzle-orm";
import { requireAuth } from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";
import { withTableFallback } from "../lib/with-table-fallback.js";

const router: Router = Router();

// @ts-ignore
router.get("/", requireAuth, async (req, res, next) => {
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
          } else if (tab === "employees") {
            const baseQuery = tenantDb.select().from(employeesTable);
            let conditions: any[] = [];
            if (search) {
              conditions.push(or(
                ilike(employeesTable.firstName, `%${search}%`),
                ilike(employeesTable.lastName, `%${search}%`),
                ilike(employeesTable.employeeId, `%${search}%`),
                ilike(employeesTable.department, `%${search}%`)
              ) as any);
            }
            
            const whereClause = and(...conditions);
            
            const [countRes] = await tenantDb
              .select({ count: count() })
              .from(employeesTable)
              .where(whereClause);
            
            totalCount = countRes.count;
            data = await tenantDb
              .select()
              .from(employeesTable)
              .where(whereClause)
              .limit(limit)
              .offset(offset)
              .orderBy(desc(employeesTable.createdAt));
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
