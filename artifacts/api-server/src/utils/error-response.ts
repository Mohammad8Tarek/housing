import type { Request, Response } from "express";
import { ZodError } from "zod";

export function isArabic(req: Request): boolean {
  return (req.headers["accept-language"] ?? "").toLowerCase().startsWith("ar");
}

const FIELD_LABELS: Record<string, { en: string; ar: string }> = {
  username: { en: "Username", ar: "اسم المستخدم" },
  password: { en: "Password", ar: "كلمة المرور" },
  email: { en: "Email", ar: "البريد الإلكتروني" },
  phone: { en: "Phone", ar: "الهاتف" },
  nationalId: { en: "National ID", ar: "الرقم القومي" },
  firstName: { en: "First name", ar: "الاسم الأول" },
  lastName: { en: "Last name", ar: "اسم العائلة" },
  name: { en: "Name", ar: "الاسم" },
  role: { en: "Role", ar: "الدور" },
  roomId: { en: "Room", ar: "الغرفة" },
  buildingId: { en: "Building", ar: "المبنى" },
  floorId: { en: "Floor", ar: "الدور" },
  propertyId: { en: "Property", ar: "الفرع" },
  employeeId: { en: "Employee", ar: "الموظف" },
  status: { en: "Status", ar: "الحالة" },
  date: { en: "Date", ar: "التاريخ" },
  startDate: { en: "Start date", ar: "تاريخ البداية" },
  endDate: { en: "End date", ar: "تاريخ النهاية" },
  description: { en: "Description", ar: "الوصف" },
  title: { en: "Title", ar: "العنوان" },
  content: { en: "Content", ar: "المحتوى" },
};

export function fieldLabel(field: string, ar: boolean): string {
  return FIELD_LABELS[field]?.[ar ? "ar" : "en"] ?? field;
}

export function formatZodError(error: ZodError, ar: boolean): string {
  const first = error.errors[0];
  if (!first) return ar ? "بيانات غير صالحة" : "Invalid input";

  const label = fieldLabel(first.path.join("."), ar);

  switch (first.code) {
    case "invalid_type":
      if (first.received === "undefined") {
        return ar ? `${label} مطلوب` : `${label} is required`;
      }
      return ar ? `${label} غير صالح` : `Invalid ${label}`;
    case "too_small":
      if (first.type === "string") {
        return ar
          ? `${label} يجب أن يكون ${(first as any).minimum} أحرف على الأقل`
          : `${label} must be at least ${(first as any).minimum} characters`;
      }
      return ar ? `قيمة ${label} صغيرة جداً` : `${label} value is too small`;
    case "too_big":
      return ar
        ? `${label} يجب أن يكون ${(first as any).maximum} أحرف كحد أقصى`
        : `${label} must be at most ${(first as any).maximum} characters`;
    case "invalid_string":
      if (first.validation === "email") {
        return ar ? "البريد الإلكتروني غير صالح" : "Invalid email address";
      }
      return ar ? `${label} غير صالح` : `Invalid ${label}`;
    case "invalid_enum_value":
      return ar ? `${label} غير مسموح به` : `Invalid ${label} value`;
    default:
      return first.message || (ar ? `خطأ في ${label}` : `Error in ${label}`);
  }
}

export function sendError(
  res: Response,
  status: number,
  message: string,
  extra?: Record<string, unknown>,
): void {
  res.status(status).json({ success: false, message, ...extra });
}
