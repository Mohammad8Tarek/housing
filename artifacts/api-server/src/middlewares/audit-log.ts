import type { Request, Response, NextFunction } from "express";
import { logActivity } from "../lib/activity-logger.js";

const MUTATING = new Set(["POST", "PATCH", "PUT", "DELETE"]);

const SKIP_PATTERNS = [
  /^\/api\/activity-logs/,
  /^\/api\/notifications/,
  /^\/api\/health/,
  /^\/api\/portal-reports/,
  /^\/api\/portal-categories/,
];

function sanitize(obj: any, depth = 0): any {
  if (depth > 6 || obj == null) return obj;
  if (typeof obj !== "object") return obj;
  if (Array.isArray(obj)) {
    return obj.slice(0, 30).map((item) => sanitize(item, depth + 1));
  }

  const SENSITIVE_KEYS = new Set([
    "password",
    "passwordhash",
    "token",
    "secret",
    "newpassword",
    "currentpassword",
    "refreshtoken",
    "apikey",
    "authorization",
    "cookie",
  ]);

  const clean: Record<string, any> = {};
  for (const [k, v] of Object.entries(obj)) {
    if (SENSITIVE_KEYS.has(k.toLowerCase())) {
      clean[k] = "[REDACTED]";
    } else if (typeof v === "object" && v !== null) {
      clean[k] = sanitize(v, depth + 1);
    } else {
      clean[k] = v;
    }
  }
  return clean;
}

function extractPropertyId(req: Request, resBody: any): number {
  const candidates = [
    req.query?.propertyId,
    req.headers["x-property-id"],
    (req as any).authUser?.propertyId,
    (req as any).authUser?.lastPropertyId,
    (req.session as any)?.propertyId,
    resBody?.propertyId,
    req.body?.propertyId,
  ];
  for (const c of candidates) {
    const num = Number(c);
    if (Number.isFinite(num) && num > 0) return num;
  }
  return 1;
}

function inferModule(path: string): string {
  const p = path.toLowerCase();
  if (p.includes("assignments") || p.includes("in-house")) return "accommodation";
  if (p.includes("reservations")) return "reservations";
  if (p.includes("hostings") || p.includes("hosting-requests")) return "accommodation";
  if (p.includes("profiles") || p.includes("employees")) return "profiles";
  if (p.includes("rooms")) return "housing";
  if (p.includes("buildings")) return "housing";
  if (p.includes("floors")) return "housing";
  if (p.includes("housekeeping")) return "housekeeping";
  if (p.includes("maintenance")) return "maintenance";
  if (p.includes("users")) return "users";
  if (p.includes("settings") || p.includes("lookup-values")) return "settings";
  if (p.includes("properties")) return "properties";
  if (p.includes("documents")) return "documents";
  if (p.includes("evaluations")) return "evaluations";
  if (p.includes("surveys")) return "surveys";
  if (p.includes("smart-locks") || p.includes("keys") || p.includes("room-keys")) return "smart_locks";
  if (p.includes("auth")) return "auth";
  if (p.includes("hr-sync")) return "hr_sync";
  return "system";
}

function analyzeMutation(
  method: string,
  path: string,
  reqBody: any,
  resBody: any,
  params: any
): {
  action: string;
  actionType: string;
  module: string;
  entityType?: string;
  entityId?: number;
  summary: string;
} {
  const module = inferModule(path);
  const p = path.toLowerCase();
  const idFromUrl = Number(params?.id || p.match(/\/(\d+)(?:\/|$)/)?.[1]) || undefined;
  const entityId = resBody?.id ? Number(resBody.id) : idFromUrl;

  let actionType = "UPDATE";
  let action = `${method} ${module}`;
  let summary = "";
  let entityType = module.replace(/s$/, "");

  // Specific Actions
  if (p.includes("/checkout")) {
    actionType = "CHECKOUT";
    entityType = "assignment";
    action = `تسجيل مغادرة (Check-out) للمقيم #${entityId || ""}`;
    summary = `تم إنهاء التسكين وتسجيل مغادرة للمقيم #${entityId || ""}`;
  } else if (p.includes("/checkin")) {
    actionType = "CHECKIN";
    entityType = "reservation";
    action = `تسجيل وصول وتسكين (Check-in) للحجز #${entityId || ""}`;
    summary = `تم تحويل الحجز #${entityId || ""} إلى تسكين نشط بنجاح`;
  } else if (p.includes("/transfer") || p.includes("/move")) {
    actionType = "TRANSFER";
    entityType = "assignment";
    action = `نقل غرفة (Room Transfer) للتسكين #${entityId || ""}`;
    summary = `تم نقل المقيم للتسكين #${entityId || ""} إلى غرفة جديدة ${reqBody?.toRoomNumber || reqBody?.toRoomId || ""}`;
  } else if (p.includes("/issue") || p.includes("/keys")) {
    actionType = "ISSUE_KEY";
    entityType = "room_key";
    action = `إصدار كرت غرفة ${reqBody?.roomNumber || ""}`;
    summary = `تم إصدار كرت/مفتاح جديد للغرفة ${reqBody?.roomNumber || ""}`;
  } else if (p.includes("/revoke")) {
    actionType = "REVOKE_KEY";
    entityType = "room_key";
    action = `إلغاء كرت غرفة #${entityId || ""}`;
    summary = `تم إلغاء صلاحية الكرت #${entityId || ""}`;
  } else if (p.includes("/approve")) {
    actionType = "APPROVE";
    action = `اعتماد طلب في ${module} #${entityId || ""}`;
    summary = `تم اعتماد الطلب #${entityId || ""}`;
  } else if (method === "DELETE") {
    actionType = "DELETE";
    action = `حذف عنصر من ${module} #${entityId || ""}`;
    summary = `تم حذف السجل #${entityId || ""} من موديول ${module}`;
  } else if (method === "POST") {
    actionType = "CREATE";
    if (module === "housing" && p.includes("room")) {
      entityType = "room";
      action = `إضافة غرفة جديدة ${reqBody?.roomNumber ? `رقم ${reqBody.roomNumber}` : ""}`;
      summary = `تم إنشاء غرفة جديدة ${reqBody?.roomNumber || ""} بسعة ${reqBody?.capacity || 1}`;
    } else if (module === "profiles") {
      entityType = "profile";
      const name = `${reqBody?.firstName || ""} ${reqBody?.lastName || ""}`.trim();
      action = `إضافة موظف/بروفايل جديد: ${name}`;
      summary = `تم تسجيل ملف موظف جديد: ${name} برقم وظيفي: ${reqBody?.employeeId || ""}`;
    } else if (module === "reservations") {
      entityType = "reservation";
      const name = `${reqBody?.firstName || ""} ${reqBody?.lastName || ""}`.trim();
      action = `إنشاء حجز جديد: ${name}`;
      summary = `تم إنشاء حجز جديد للضيف ${name} من ${reqBody?.checkInDate || ""} إلى ${reqBody?.checkOutDate || ""}`;
    } else if (module === "maintenance") {
      entityType = "maintenance";
      action = `إنشاء بلاغ صيانة جديد: ${reqBody?.title || reqBody?.description?.slice(0, 30) || ""}`;
      summary = `تم فتح بلاغ صيانة في الغرفة ${reqBody?.roomNumber || reqBody?.roomId || ""} بأولوية ${reqBody?.priority || "عادية"}`;
    } else if (module === "users") {
      entityType = "user";
      action = `إضافة مستخدم جديد: ${reqBody?.username || ""}`;
      summary = `تم إنشاء حساب مستخدم جديد ${reqBody?.username || ""} بأدوار: ${Array.isArray(reqBody?.roles) ? reqBody.roles.join(", ") : ""}`;
    } else {
      action = `إضافة عنصر جديد في ${module}`;
      summary = `تم إنشاء سجل جديد في موديول ${module}`;
    }
  } else if (method === "PATCH" || method === "PUT") {
    actionType = "UPDATE";
    if (module === "users" && reqBody?.permissions) {
      actionType = "PERMISSIONS_CHANGE";
      entityType = "user";
      action = `تعديل صلاحيات المستخدم #${entityId || ""}`;
      summary = `تم تحديث مصفوفة الصلاحيات للمستخدم #${entityId || ""} وإعادة ضبط ${reqBody.permissions.length} صلاحية`;
    } else if (module === "housing" && reqBody?.status) {
      actionType = "STATUS_CHANGE";
      entityType = "room";
      action = `تغيير حالة الغرفة #${entityId || ""} إلى: ${reqBody.status}`;
      summary = `تم تحديث حالة الغرفة #${entityId || ""} إلى ${reqBody.status}`;
    } else {
      action = `تعديل في ${module} #${entityId || ""}`;
      const changedKeys = Object.keys(reqBody || {}).filter(
        (k) => !["id", "createdAt", "updatedAt"].includes(k)
      );
      summary = `تم تعديل الحقول: [${changedKeys.join(", ")}] في السجل #${entityId || ""}`;
    }
  }

  return { action, actionType, module, entityType, entityId, summary };
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

  const originalJson = res.json.bind(res);

  res.json = (body: any) => {
    if (res.statusCode >= 200 && res.statusCode < 300) {
      try {
        const authUser = (req as any).authUser;
        const session = req.session as any;
        const userId = authUser?.id ?? session?.userId ?? undefined;
        const username = authUser?.username ?? session?.username ?? "system";
        const userRole = (authUser?.roles && authUser.roles[0]) ?? session?.userRole ?? undefined;
        const propertyId = extractPropertyId(req, body);

        const analysis = analyzeMutation(
          req.method,
          req.originalUrl || req.path,
          req.body,
          body,
          req.params
        );

        const sanitizedReqBody = sanitize(req.body);
        const sanitizedResBody = sanitize(body);

        const detailsObj = {
          summary: analysis.summary,
          method: req.method,
          endpoint: req.originalUrl || req.url,
          params: req.params,
          query: req.query,
          requestPayload: sanitizedReqBody,
          responsePayload: sanitizedResBody,
          changedFields: req.body && typeof req.body === "object" ? Object.keys(req.body) : [],
        };

        logActivity({
          req,
          propertyId,
          username,
          userId,
          userRole,
          action: analysis.action,
          actionType: analysis.actionType,
          module: analysis.module,
          entityType: analysis.entityType,
          entityId: analysis.entityId,
          details: detailsObj,
          severity:
            analysis.actionType === "DELETE"
              ? "warning"
              : analysis.actionType === "PERMISSIONS_CHANGE"
              ? "warning"
              : "info",
        }).catch((err) => {
          console.error("[auditLogMiddleware] Error logging activity:", err);
        });
      } catch (err) {
        console.error("[auditLogMiddleware] Failed to process audit log:", err);
      }
    }
    return originalJson(body);
  };

  next();
}
