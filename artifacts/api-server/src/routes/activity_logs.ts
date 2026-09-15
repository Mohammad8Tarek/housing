import { Router } from "express";
import { db, withTenant, activityLogsTable, propertiesTable } from "@workspace/db";
import { eq, desc, ilike, or, and, SQL, sql } from "drizzle-orm";
import {
  ListActivityLogsQueryParams,
  ListActivityLogsResponse,
} from "@workspace/api-zod";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";

const router: Router = Router();

router.get(
  "/activity-logs",
  requirePermission("activity_log", "view"),
  async (req, res): Promise<void> => {
    try {
      const rawPropertyId = req.query.propertyId as string | undefined;
      const isAll = !rawPropertyId || rawPropertyId === "all" || rawPropertyId === "-1" || rawPropertyId === "0";
      const numericPropertyId = isAll ? null : Number(rawPropertyId);

      const page = Math.max(1, Number(req.query.page) || 1);
      const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);
      const offset = (page - 1) * limit;

      const moduleFilter = req.query.module as string | undefined;
      const actionFilter = req.query.action as string | undefined;
      const severityFilter = req.query.severity as string | undefined;
      const searchFilter = req.query.search as string | undefined;
      const dateFrom = req.query.dateFrom as string | undefined;
      const dateTo = req.query.dateTo as string | undefined;

      // Get property map for friendly names
      const allProps = await db.select().from(propertiesTable);
      const propertyMap = new Map<number, { name: string; displayName?: string | null }>();
      for (const p of allProps) {
        propertyMap.set(p.id, { name: p.name, displayName: p.displayName });
      }

      const buildConditions = () => {
        const conditions: SQL[] = [];

        if (moduleFilter && moduleFilter !== "all") {
          conditions.push(eq(activityLogsTable.module, moduleFilter));
        }

        if (actionFilter && actionFilter !== "all") {
          conditions.push(
            or(
              eq(activityLogsTable.action, actionFilter),
              eq(activityLogsTable.actionType, actionFilter)
            )!
          );
        }

        if (severityFilter && severityFilter !== "all") {
          conditions.push(eq(activityLogsTable.severity, severityFilter.toLowerCase()));
        }

        if (dateFrom) {
          try {
            const fromDate = new Date(`${dateFrom}T00:00:00`);
            if (!isNaN(fromDate.getTime())) {
              conditions.push(sql`${activityLogsTable.timestamp} >= ${fromDate}`);
            }
          } catch {}
        }

        if (dateTo) {
          try {
            const toDate = new Date(`${dateTo}T23:59:59.999`);
            if (!isNaN(toDate.getTime())) {
              conditions.push(sql`${activityLogsTable.timestamp} <= ${toDate}`);
            }
          } catch {}
        }

        if (searchFilter && searchFilter.trim()) {
          const searchPattern = `%${searchFilter.trim()}%`;
          conditions.push(
            sql`${activityLogsTable.username} ILIKE ${searchPattern} OR ${activityLogsTable.action} ILIKE ${searchPattern} OR ${activityLogsTable.details}::text ILIKE ${searchPattern} OR ${activityLogsTable.ipAddress} ILIKE ${searchPattern} OR ${activityLogsTable.entityType} ILIKE ${searchPattern} OR ${activityLogsTable.userRole} ILIKE ${searchPattern}`
          );
        }

        return conditions;
      };

      let result: any[] = [];
      let total = 0;

      // If viewing a specific tenant property, query that tenant database schema
      if (numericPropertyId && numericPropertyId > 0) {
        const tenantRes = await withTenant(numericPropertyId, async (tenantDb) => {
          const conditions = buildConditions();
          const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

          const [countResult] = await tenantDb
            .select({ count: sql`count(*)`.mapWith(Number) })
            .from(activityLogsTable)
            .where(whereClause);

          const count = countResult?.count || 0;

          const queryBuilder = tenantDb
            .select({
              id: activityLogsTable.id,
              propertyId: activityLogsTable.propertyId,
              username: activityLogsTable.username,
              userId: activityLogsTable.userId,
              userRole: activityLogsTable.userRole,
              action: activityLogsTable.action,
              actionType: activityLogsTable.actionType,
              module: activityLogsTable.module,
              severity: activityLogsTable.severity,
              entityType: activityLogsTable.entityType,
              entityId: activityLogsTable.entityId,
              ipAddress: activityLogsTable.ipAddress,
              userAgent: activityLogsTable.userAgent,
              details: activityLogsTable.details,
              timestamp: activityLogsTable.timestamp,
            })
            .from(activityLogsTable)
            .orderBy(desc(activityLogsTable.timestamp))
            .limit(limit)
            .offset(offset);

          if (whereClause) {
            queryBuilder.where(whereClause);
          }

          const data = await queryBuilder;
          return { data, total: count };
        });

        result = tenantRes.data;
        total = tenantRes.total;
      } else {
        // Query master public audit log (for "all" properties and global system events)
        const conditions = buildConditions();
        const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

        const [countResult] = await db
          .select({ count: sql`count(*)`.mapWith(Number) })
          .from(activityLogsTable)
          .where(whereClause);

        total = countResult?.count || 0;

        const queryBuilder = db
          .select({
            id: activityLogsTable.id,
            propertyId: activityLogsTable.propertyId,
            username: activityLogsTable.username,
            userId: activityLogsTable.userId,
            userRole: activityLogsTable.userRole,
            action: activityLogsTable.action,
            actionType: activityLogsTable.actionType,
            module: activityLogsTable.module,
            severity: activityLogsTable.severity,
            entityType: activityLogsTable.entityType,
            entityId: activityLogsTable.entityId,
            ipAddress: activityLogsTable.ipAddress,
            userAgent: activityLogsTable.userAgent,
            details: activityLogsTable.details,
            timestamp: activityLogsTable.timestamp,
          })
          .from(activityLogsTable)
          .orderBy(desc(activityLogsTable.timestamp))
          .limit(limit)
          .offset(offset);

        if (whereClause) {
          queryBuilder.where(whereClause);
        }

        result = await queryBuilder;
      }

      const formatted = result.map((l: any) => {
        const pId = l.propertyId ? Number(l.propertyId) : (numericPropertyId || null);
        const propInfo = pId ? propertyMap.get(pId) : null;
        return {
          id: Number(l.id),
          propertyId: pId,
          propertyName: propInfo?.displayName || propInfo?.name || (pId ? `Property #${pId}` : "نظام عام / Global"),
          username: l.username ?? "",
          userId: l.userId ? Number(l.userId) : null,
          userRole: l.userRole ?? null,
          action: l.action ?? "",
          actionType: l.actionType ?? "INFO",
          module: l.module ?? "system",
          severity: l.severity ?? "info",
          entityType: l.entityType ?? null,
          entityId: l.entityId ? Number(l.entityId) : null,
          ipAddress: l.ipAddress ?? null,
          userAgent: l.userAgent ?? null,
          details: l.details ?? null,
          timestamp:
            l.timestamp instanceof Date &&
            typeof l.timestamp.toISOString === "function"
              ? l.timestamp.toISOString()
              : String(l.timestamp),
        };
      });

      res.json({
        data: formatted,
        pagination: {
          total,
          page,
          limit,
        },
      });
    } catch (err: any) {
      console.error("[ActivityLogs] Error fetching logs:", err);
      res.status(500).json({ error: "Failed to fetch activity logs", details: err?.message });
    }
  },
);

// ─── GET /activity-logs/security ──────────────────────────────────────────
// Convenience endpoint for security audit (login attempts, lockouts, property switches)
router.get(
  "/activity-logs/security",
  requirePermission("activity_log", "view"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const limit = Math.min(Number(req.query.limit) || 200, 1000);

    const result = await withTenant(propertyId, async (tenantDb) => {
      return await tenantDb
        .select({
          id: activityLogsTable.id,
          username: activityLogsTable.username,
          userId: activityLogsTable.userId,
          userRole: activityLogsTable.userRole,
          action: activityLogsTable.action,
          actionType: activityLogsTable.actionType,
          module: activityLogsTable.module,
          severity: activityLogsTable.severity,
          ipAddress: activityLogsTable.ipAddress,
          details: activityLogsTable.details,
          timestamp: activityLogsTable.timestamp,
        })
        .from(activityLogsTable)
        .where(
          and(
            eq(activityLogsTable.module, "auth"),
            eq(activityLogsTable.severity, "warning"),
          ),
        )
        .orderBy(desc(activityLogsTable.timestamp))
        .limit(limit);
    });

    const formatted = (result as any[]).map((l: any) => ({
      id: Number(l.id),
      propertyId,
      username: l.username ?? "",
      userId: l.userId ? Number(l.userId) : null,
      userRole: l.userRole ?? null,
      action: l.action ?? "",
      actionType: l.actionType ?? "INFO",
      module: l.module ?? "system",
      severity: l.severity ?? "info",
      ipAddress: l.ipAddress ?? null,
      details: l.details ?? null,
      timestamp:
        l.timestamp instanceof Date &&
        typeof l.timestamp.toISOString === "function"
          ? l.timestamp.toISOString()
          : String(l.timestamp),
    }));

    res.json(formatted);
  },
);

export default router;
