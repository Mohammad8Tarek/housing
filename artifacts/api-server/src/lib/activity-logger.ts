import { withTenant } from "@workspace/db";
import { activityLogsTable } from "@workspace/db";
import type { Request } from "express";

export function getClientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export async function logActivity(opts: {
  req?: Request;
  propertyId: number;
  username: string;
  userId?: number;
  userRole?: string;
  action: string;
  actionType?: string;
  module: string;
  severity?: string;
  entityType?: string;
  entityId?: number;
  details?: any; // ✅ يقبل JSON أو نص
  ipAddress?: string;
}) {
  try {
    const ip = opts.ipAddress ?? (opts.req ? getClientIp(opts.req) : "system");

    const ua = opts.req ? (opts.req.headers["user-agent"] ?? null) : null;

    /* convert details to string if JSON */
    let detailsValue: string | null = null;

    if (opts.details) {
      if (typeof opts.details === "object") {
        detailsValue = JSON.stringify(opts.details);
      } else {
        detailsValue = String(opts.details);
      }
    }

    await withTenant(opts.propertyId, async (tenantDb) => {
      await tenantDb.insert(activityLogsTable).values({
        username: opts.username,
        userId: opts.userId ?? undefined,
        userRole: opts.userRole ?? undefined,
        action: opts.action,
        actionType: opts.actionType ?? "INFO",
        module: opts.module,
        severity: opts.severity ?? "info",
        entityType: opts.entityType ?? undefined,
        entityId:
          opts.entityId != null &&
          opts.entityId <= 2147483647 &&
          opts.entityId >= -2147483648
            ? opts.entityId
            : undefined,
        ipAddress: ip,
        userAgent: ua ?? undefined,
        details: detailsValue ?? undefined,
      });
    });
  } catch (err) {
    /* never crash system if logging fails */
    console.error("Activity log failed:", err);
  }
}
