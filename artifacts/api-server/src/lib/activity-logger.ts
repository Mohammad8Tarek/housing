import { db, withTenant, activityLogsTable } from "@workspace/db";
import { auditQueue } from "@workspace/queue";
import type { Request } from "express";

export function getClientIp(req: Request): string {
  return req.ip ?? req.socket?.remoteAddress ?? "unknown";
}

export interface ActivityLogOptions {
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
  sync?: boolean; // When true, await database write (e.g. critical security audit)
}

interface PreparedLogRecord {
  propertyId?: number;
  username: string;
  userId?: number;
  userRole?: string;
  action: string;
  actionType: string;
  module: string;
  severity: string;
  entityType?: string;
  entityId?: number;
  ipAddress: string;
  userAgent?: string;
  details?: string;
}

/**
 * Low-level worker that writes the prepared log record to both public.activity_logs
 * and the specific property tenant schema.
 */
async function writeLogToDb(
  logRecord: PreparedLogRecord,
  targetPropertyId: number | null,
): Promise<void> {
  // 1. Always record in master central audit trail (public.activity_logs)
  try {
    await db.insert(activityLogsTable).values(logRecord);
  } catch (pubErr) {
    console.error("[ActivityLogger] Failed to write to public master log:", pubErr);
  }

  // 2. If propertyId is a valid tenant property, also record in property tenant schema
  if (targetPropertyId && targetPropertyId > 0) {
    try {
      await withTenant(targetPropertyId, async (tenantDb) => {
        await tenantDb.insert(activityLogsTable).values(logRecord);
      });
    } catch (tenantErr) {
      console.error(`[ActivityLogger] Failed to write to tenant ${targetPropertyId} log:`, tenantErr);
    }
  }
}

/**
 * Extracts and prepares raw log record synchronously from express request context
 * so that request termination doesn't discard IP, headers, or body.
 */
function prepareLogRecord(opts: ActivityLogOptions): {
  logRecord: PreparedLogRecord;
  targetPropertyId: number | null;
} {
  const ip = opts.ipAddress ?? (opts.req ? getClientIp(opts.req) : "system");
  const ua = opts.req ? (opts.req.headers["user-agent"] ?? null) : null;

  // Normalize username in case an object was passed
  const username =
    typeof opts.username === "string"
      ? opts.username
      : (opts.username?.username ?? "system");

  // Convert details to string safely
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

  const logRecord: PreparedLogRecord = {
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

  return { logRecord, targetPropertyId };
}

/**
 * Dispatches log record to BullMQ (if Redis available) or In-Memory async microtask.
 * Never blocks the HTTP event loop.
 */
function dispatchLogAsync(
  logRecord: PreparedLogRecord,
  targetPropertyId: number | null,
): void {
  if (auditQueue) {
    auditQueue
      .add(
        "log",
        { logRecord, targetPropertyId },
        {
          removeOnComplete: 100,
          removeOnFail: 50,
          attempts: 2,
        },
      )
      .catch((err) => {
        // Fallback to in-memory write if BullMQ enqueue fails
        setImmediate(() => {
          writeLogToDb(logRecord, targetPropertyId).catch((e) =>
            console.error("[ActivityLogger] In-memory write error:", e),
          );
        });
      });
  } else {
    // In-memory non-blocking execution via setImmediate
    setImmediate(() => {
      writeLogToDb(logRecord, targetPropertyId).catch((err) =>
        console.error("[ActivityLogger] In-memory write error:", err),
      );
    });
  }
}

/**
 * queueActivity: Pure fire-and-forget void function.
 * Use when you want to explicitly declare non-blocking activity logging.
 */
export function queueActivity(opts: ActivityLogOptions): void {
  try {
    const { logRecord, targetPropertyId } = prepareLogRecord(opts);
    dispatchLogAsync(logRecord, targetPropertyId);
  } catch (err) {
    console.error("[ActivityLogger] queueActivity error:", err);
  }
}

/**
 * logActivity: Main logging function.
 * By default, dispatches asynchronously to background worker so that
 * HTTP routes awaiting logActivity(...) complete immediately (0ms latency penalty).
 * Set `sync: true` in opts if synchronous persistence is strictly required.
 */
export async function logActivity(opts: ActivityLogOptions): Promise<void> {
  try {
    const { logRecord, targetPropertyId } = prepareLogRecord(opts);

    if (opts.sync) {
      await writeLogToDb(logRecord, targetPropertyId);
      return;
    }

    // Default: Dispatch asynchronously
    dispatchLogAsync(logRecord, targetPropertyId);
  } catch (err) {
    /* never crash system if logging fails */
    console.error("[ActivityLogger] Activity log failed:", err);
  }
}
