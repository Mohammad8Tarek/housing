import type { Request, Response, NextFunction } from "express";
import { logActivity } from "../lib/activity-logger";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);
const SKIP_PATTERNS = [
  /^\/api\/auth\//,
  /^\/api\/activity-logs/,
  /^\/api\/notifications/,
  /^\/api\/health/,
  /^\/api\/hr-sync/,
  /^\/api\/portal-reports/,
  /^\/api\/portal-categories/,
];

function inferAction(method: string, url: string): string {
  if (method === "DELETE") return "DELETE";
  if (method === "POST" && url.includes("/checkout")) return "CHECKOUT";
  if (method === "POST" && url.includes("/transfer")) return "TRANSFER";
  if (method === "POST" && url.includes("/checkin")) return "CHECKIN";
  if (method === "POST") return "CREATE";
  return "UPDATE";
}

function inferModule(url: string): string {
  const map: Record<string, string> = {
    assignments: "assignments",
    employees: "employees",
    rooms: "rooms",
    buildings: "buildings",
    floors: "floors",
    maintenance: "maintenance",
    reservations: "reservations",
    hostings: "hostings",
    users: "users",
    properties: "properties",
    settings: "settings",
    "lookup-values": "settings",
  };
  for (const [key, val] of Object.entries(map)) {
    if (url.includes(key)) return val;
  }
  return "system";
}

export function auditLogMiddleware(
  req: Request,
  res: Response,
  next: NextFunction,
): void {
  if (!MUTATING.has(req.method)) {
    next();
    return;
  }
  if (SKIP_PATTERNS.some((p) => p.test(req.path))) {
    next();
    return;
  }
  const session = req.session as any;
  if (!session?.userId) {
    next();
    return;
  }

  const originalJson = res.json.bind(res);
  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      const module = inferModule(req.path);
      const action = inferAction(req.method, req.path);
      const propertyId =
        session.propertyId ?? body?.propertyId ?? req.body?.propertyId;
      if (propertyId) {
        logActivity({
          req,
          propertyId,
          username: session.username ?? "system",
          userId: session.userId,
          userRole: session.userRole,
          action: `${action} ${module}`,
          actionType: action as any,
          module,
          entityType: module.replace(/s$/, ""),
          entityId:
            body?.id ?? parseInt(String(req.params?.id ?? "0")) ?? undefined,
          severity: action === "DELETE" ? "warning" : "info",
        }).catch(() => {});
      }
    }
    return originalJson(body);
  };
  next();
}
