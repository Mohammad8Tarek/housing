import { db, withTenant, activityLogsTable } from "@workspace/db";
import type { Request } from "express";

export function getClientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export async function logActivity(opts: {
  req?: Request;
  propertyId?: number | null;
  username: string | any;
  userId?: number | null;
  userRole?: string | null;
  action: string;
  actionType?: string;
  module: string;
  severity?: string;
  entityType?: string;
  entityId?: number;
  details?: any;
  ipAddress?: string;
}) {
  try {
    const ip = opts.ipAddress ?? (opts.req ? getClientIp(opts.req) : "system");
    const ua = opts.req ? (opts.req.headers["user-agent"] ?? null) : null;

    // Normalize username in case an object like su(req) was passed by mistake
    const username =
      typeof opts.username === "string"
        ? opts.username
        : (opts.username?.username ?? "system");

    // Convert details to string if JSON or format object
    let detailsValue: string | null = null;
    if (opts.details) {
      if (typeof opts.details === "object") {
        try {
          detailsValue = JSON.stringify(opts.details);
        } catch {
          detailsValue = String(opts.details);
        }
      } else {
        detailsValue = String(opts.details);
      }
    }

    const targetPropertyId =
      typeof opts.propertyId === "number" && opts.propertyId > 0
        ? opts.propertyId
        : null;

    const logRecord = {
      propertyId: targetPropertyId ?? undefined,
      username,
      userId: opts.userId != null ? Number(opts.userId) : undefined,
      userRole: opts.userRole ?? undefined,
      action: opts.action,
      actionType: opts.actionType ?? "INFO",
      module: opts.module ?? "system",
      severity: opts.severity ?? "info",
      entityType: opts.entityType ?? undefined,
      entityId:
        opts.entityId != null &&
        opts.entityId <= 2147483647 &&
        opts.entityId >= -2147483648
          ? Number(opts.entityId)
          : undefined,
      ipAddress: ip,
      userAgent: ua ?? undefined,
      details: detailsValue ?? undefined,
    };

    // 1. Always record in master central audit trail (public.activity_logs)
    try {
      await db.insert(activityLogsTable).values(logRecord);
    } catch (pubErr) {
      console.error("[ActivityLogger] Failed to write to public master log:", pubErr);
    }

    // 2. If propertyId is a valid tenant property, also record in property tenant schema
    if (targetPropertyId) {
      try {
        await withTenant(targetPropertyId, async (tenantDb) => {
          await tenantDb.insert(activityLogsTable).values(logRecord);
        });
      } catch (tenantErr) {
        console.error(`[ActivityLogger] Failed to write to tenant ${targetPropertyId} log:`, tenantErr);
      }
    }
  } catch (err) {
    /* never crash system if logging fails */
    console.error("[ActivityLogger] Activity log failed:", err);
  }
}

