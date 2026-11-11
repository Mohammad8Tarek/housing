// Helpers shared by the portal-auth route modules.
import { withTenant } from "@workspace/db";
import { profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { z } from "zod";

export const MAX_FAILED = 5;

export const LOCK_MINUTES = 15;

export function generateTemporaryPassword(): string {
  return "1234";
}

export const BLOCKED_PROFILE_STATUSES = new Set([
  "LEFT",
  "DEPARTED",
  "TERMINATED",
  "SUSPENDED",
  "INACTIVE",
]);

export function isProfileActiveForPortal(
  status: string | null | undefined,
): boolean {
  if (!status) return true;
  return !BLOCKED_PROFILE_STATUSES.has(status.trim().toUpperCase());
}

export function portalSession(req: any) {
  return req.session?.portal as
    | {
        profileDbId: number;
        profileId: string;
        propertyId: number;
        fullName: string;
      }
    | undefined;
}

export async function requirePortalAuth(req: any, res: any, next: any) {
  const sess = portalSession(req);
  if (!sess) {
    // Native app fallback: restore session from X-Session-Id header
    const xSid = req.headers["x-session-id"] as string | undefined;

    // DEBUG: log why auth failed
    const debugInfo: any = {
      sessionID: req.sessionID,
      hasCookie: !!req.headers["cookie"],
      portalInSession: !!(req.session as any)?.portal,
    };

    if (!xSid) {
      console.warn(
        "[portal-auth] 401 — no portal session, no X-Session-Id",
        debugInfo,
      );
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    req.sessionStore.get(xSid, (err: any, storedSess: any) => {
      debugInfo.xSid = xSid;
      debugInfo.storeError = err?.message;
      debugInfo.storeFound = !!storedSess;
      debugInfo.storeHasPortal = !!storedSess?.portal;
      console.warn("[portal-auth] 401 — X-Session-Id fallback", debugInfo);
      if (err || !storedSess) {
        res.status(401).json({ success: false, message: "Not authenticated" });
        return;
      }
      if (storedSess.portal) {
        req.session.portal = storedSess.portal;
        req.sessionID = xSid;
        checkProfileIsActive(req, res, next);
      } else {
        res.status(401).json({ success: false, message: "Not authenticated" });
      }
    });
    return;
  }

  checkProfileIsActive(req, res, next);
}

export async function checkProfileIsActive(req: any, res: any, next: any) {
  const sess = portalSession(req);
  if (!sess) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  try {
    const [emp] = await withTenant(sess.propertyId, async (tenantDb) => {
      return tenantDb
        .select({ status: profilesTable.status })
        .from(profilesTable)
        .where(eq(profilesTable.id, sess.profileDbId))
        .limit(1);
    });

    if (emp && !isProfileActiveForPortal(emp.status)) {
      req.session.destroy(() => {});
      res.status(403).json({
        success: false,
        message: "ليس لديك صلاحية الدخول إلى البوابة",
      });
      return;
    }
  } catch {
    // If DB is unreachable, fail open: let the request through rather than locking everyone out.
    // This is consistent with the rest of the app's error handling.
  }

  next();
}

export const LoginSchema = z
  .object({
    profileId: z.string().min(1).optional(),
    employeeId: z.string().min(1).optional(),
    password: z.string().min(1),
  })
  .refine((d) => Boolean(d.profileId || d.employeeId), {
    message: "profileId or employeeId is required",
  });

export const ChangePasswordSchema = z
  .object({
    currentPassword: z.string().min(1),
    newPassword: z.string().min(6, "Password must be at least 6 characters"),
    confirmPassword: z.string().min(1),
  })
  .refine((d) => d.newPassword === d.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export function toAsciiDigits(str: string): string {
  return (str ?? "").replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
}

export function normalizeDateOnly(val: unknown): string {
  if (!val) return "";
  if (val instanceof Date) {
    const pad = (n: number) => String(n).padStart(2, "0");
    const y = val.getFullYear();
    const m = pad(val.getMonth() + 1);
    const d = pad(val.getDate());
    return `${y}-${m}-${d}`;
  }
  let str = toAsciiDigits(String(val)).trim();
  // YYYY-MM-DD or YYYY/MM/DD
  const ymd = /^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/.exec(str);
  if (ymd) {
    return `${ymd[1]}-${ymd[2].padStart(2, "0")}-${ymd[3].padStart(2, "0")}`;
  }
  // DD/MM/YYYY or DD-MM-YYYY
  const dmy = /^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/.exec(str);
  if (dmy) {
    return `${dmy[3]}-${dmy[2].padStart(2, "0")}-${dmy[1].padStart(2, "0")}`;
  }
  return str;
}

export const ForgotPasswordVerifySchema = z
  .object({
    profileId: z.string().optional(),
    employeeId: z.string().optional(),
    nationalId: z.string().min(1, "National ID is required"),
    roomNumber: z.string().min(1, "Room number is required"),
    dateOfBirth: z.string().min(1, "Date of birth is required"),
  })
  .refine((data) => Boolean((data.profileId || data.employeeId || "").trim()), {
    message: "Missing required fields",
  });

export const ForgotPasswordResetSchema = z.object({
  token: z.string().min(1),
  newPassword: z.string().min(6, "Password must be at least 6 characters"),
  confirmPassword: z.string().min(1),
});
