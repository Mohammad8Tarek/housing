import { Router } from "express";
import { db, withTenant, activityLogsTable } from "@workspace/db";
import { eq, and, desc, SQL } from "drizzle-orm";
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

    const query = ListActivityLogsQueryParams.safeParse(req.query);
    const limit =
      query.success && query.data.limit
        ? Math.min(query.data.limit, 1000)
        : 500;

    // Support extra filters not in the generated schema
    const actionTypeFilter = req.query.actionType as string | undefined;
    const actionFilter = req.query.action as string | undefined;

    const result = await withTenant(propertyId, async (tenantDb) => {
      const conditions: SQL[] = [];
      if (query.success && query.data.module) {
        conditions.push(eq(activityLogsTable.module, query.data.module));
      }
      if (actionTypeFilter) {
        conditions.push(eq(activityLogsTable.actionType, actionTypeFilter));
      }
      if (actionFilter) {
        conditions.push(eq(activityLogsTable.action, actionFilter));
      }

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
        .limit(limit);

      if (conditions.length > 0) {
        return await queryBuilder.where(and(...conditions));
      }
      return await queryBuilder;
    });

    const formatted = (result as any[]).map((l: any) => {
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

    res.json(formatted);
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
