import { Router } from "express";
import { db, withTenant, activityLogsTable } from "@workspace/db";
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
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(Math.max(1, Number(req.query.limit) || 20), 100);
    const offset = (page - 1) * limit;

    const moduleFilter = req.query.module as string | undefined;
    const actionFilter = req.query.action as string | undefined;
    const searchFilter = req.query.search as string | undefined;

    const { data: result, total } = await withTenant(propertyId, async (tenantDb) => {
      const conditions: SQL[] = [];
      
      if (moduleFilter && moduleFilter !== "all") {
        conditions.push(eq(activityLogsTable.module, moduleFilter));
      }
      if (actionFilter && actionFilter !== "all") {
        conditions.push(eq(activityLogsTable.action, actionFilter));
      }
      
      if (searchFilter) {
        const searchPattern = `%${searchFilter}%`;
        conditions.push(
          sql`${activityLogsTable.username} ILIKE ${searchPattern} OR ${activityLogsTable.action} ILIKE ${searchPattern} OR ${activityLogsTable.details}::text ILIKE ${searchPattern} OR ${activityLogsTable.ipAddress} ILIKE ${searchPattern} OR ${activityLogsTable.entityType} ILIKE ${searchPattern}`
        );
      }

      const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

      const [countResult] = await tenantDb
        .select({ count: sql`count(*)`.mapWith(Number) })
        .from(activityLogsTable)
        .where(whereClause);
        
      const total = countResult?.count || 0;

      const queryBuilder = tenantDb
        .select({
          id: activityLogsTable.id,
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
      return { data, total };
    });

    const formatted = result.map((l: any) => {
      return {
        id: Number(l.id),
        propertyId: propertyId,
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
