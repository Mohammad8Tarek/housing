import { Wrench, Sparkles, FileText } from "lucide-react";

export const CATEGORIES = ["maintenance", "housekeeping", "general"];
export const CATEGORIES_AR = {
  maintenance: "صيانة",
  housekeeping: "هاوس كيبنج",
  general: "عام",
};
export const CATEGORIES_EN: Record<string, string> = {
  maintenance: "Maintenance",
  housekeeping: "Housekeeping",
  general: "General",
};
export const CATEGORY_ICONS = {
  maintenance: <Wrench className="w-3.5 h-3.5" />,
  housekeeping: <Sparkles className="w-3.5 h-3.5" />,
  general: <FileText className="w-3.5 h-3.5" />,
};

export const MAINTENANCE_PROBLEM_TYPES = [
  { key: "Plumbing", labelEn: "Plumbing", labelAr: "سباكة" },
  { key: "Electrical", labelEn: "Electrical", labelAr: "كهرباء" },
  { key: "HVAC", labelEn: "HVAC & AC", labelAr: "تكييف وتبريد" },
  { key: "Furniture", labelEn: "Furniture & Woodwork", labelAr: "أثاث ونجارة" },
  { key: "Internet", labelEn: "Internet & Network", labelAr: "إنترنت وشبكات" },
  { key: "Appliances", labelEn: "Appliances", labelAr: "أجهزة كهربائية" },
  { key: "Other", labelEn: "Other Maintenance", labelAr: "أعطال أخرى" },
];

export const HOUSEKEEPING_ORDER_TYPES = [
  { key: "room_cleaning", labelEn: "Room Cleaning", labelAr: "تنظيف الغرفة" },
  { key: "bed_sheets", labelEn: "Bed Linen Change", labelAr: "تغيير المفارش والأسرة" },
  { key: "towels", labelEn: "Towels & Amenities", labelAr: "توفر مناشف ومستلزمات" },
  { key: "deep_cleaning", labelEn: "Deep Cleaning", labelAr: "تنظيف شامل وعميق" },
  { key: "waste_removal", labelEn: "Trash Removal", labelAr: "تفريغ المهملات" },
  { key: "sanitization", labelEn: "Sanitization & Disinfection", labelAr: "تعقيم وتطهير" },
  { key: "turnover", labelEn: "Turnover Preparation", labelAr: "تجهيز لنزيل جديد" },
  { key: "other", labelEn: "Special / Other Request", labelAr: "طلب نظافة آخر" },
];

export const GENERAL_PROBLEM_TYPES = [
  { key: "general_inquiry", labelEn: "General Inquiry", labelAr: "استفسار عام" },
  { key: "inspection", labelEn: "Room Inspection", labelAr: "فحص ومعاينة" },
  { key: "pest_control", labelEn: "Pest Control", labelAr: "مكافحة حشرات" },
  { key: "other", labelEn: "Other", labelAr: "أخرى" },
];

export const PROBLEM_TYPES_MAP: Record<string, { labelEn: string; labelAr: string }> = {
  Plumbing: { labelEn: "Plumbing", labelAr: "سباكة" },
  Electrical: { labelEn: "Electrical", labelAr: "كهرباء" },
  HVAC: { labelEn: "HVAC & AC", labelAr: "تكييف وتبريد" },
  Furniture: { labelEn: "Furniture & Woodwork", labelAr: "أثاث ونجارة" },
  Internet: { labelEn: "Internet & Network", labelAr: "إنترنت وشبكات" },
  Appliances: { labelEn: "Appliances", labelAr: "أجهزة كهربائية" },
  Cleaning: { labelEn: "Cleaning", labelAr: "نظافة" },
  Other: { labelEn: "Other", labelAr: "أعطال أخرى" },
  room_cleaning: { labelEn: "Room Cleaning", labelAr: "تنظيف الغرفة" },
  bed_sheets: { labelEn: "Bed Linen Change", labelAr: "تغيير المفارش والأسرة" },
  towels: { labelEn: "Towels & Amenities", labelAr: "مناشف ومستلزمات" },
  deep_cleaning: { labelEn: "Deep Cleaning", labelAr: "تنظيف شامل وعميق" },
  waste_removal: { labelEn: "Trash Removal", labelAr: "تفريغ المهملات" },
  sanitization: { labelEn: "Sanitization & Disinfection", labelAr: "تعقيم وتطهير" },
  turnover: { labelEn: "Turnover Preparation", labelAr: "تجهيز لنزيل جديد" },
  general_inquiry: { labelEn: "General Inquiry", labelAr: "استفسار عام" },
  inspection: { labelEn: "Room Inspection", labelAr: "فحص ومعاينة" },
  pest_control: { labelEn: "Pest Control", labelAr: "مكافحة حشرات" },
  other: { labelEn: "Other", labelAr: "طلب آخر" },
};

export const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
export const PRIORITY_AR: Record<string, string> = {
  LOW: "منخفضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
};

export const priorityColor = (p: string) => {
  switch ((p || "").toLowerCase()) {
    case "urgent":
      return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800";
    case "high":
      return "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800";
    case "medium":
      return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
    case "low":
      return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
    default:
      return "bg-slate-100 text-slate-700";
  }
};

export const statusColor = (s: string) => {
  switch ((s || "").toLowerCase()) {
    case "open":
      return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800";
    case "in_progress":
      return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "resolved":
      return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
    case "closed":
      return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export const categoryColor = (c: string) => {
  switch (c) {
    case "maintenance":
      return "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
    case "housekeeping":
      return "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800";
    case "general":
      return "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
    default:
      return "bg-slate-100 text-slate-600";
  }
};

export const TICKET_COLS = [
  { key: "id", label: "ID", labelAr: "رقم", defaultVisible: true },
  { key: "building_floor", label: "BUILDING & FLOOR", labelAr: "المبنى والدور", defaultVisible: true },
  { key: "room", label: "ROOM", labelAr: "رقم الغرفة", defaultVisible: true },
  { key: "requester", label: "REQUESTER / RESIDENT", labelAr: "مقدم الطلب / المقيم", defaultVisible: true },
  { key: "property", label: "PROPERTY / HOUSING", labelAr: "الفندق / السكن", defaultVisible: false },
  { key: "problem", label: "PROBLEM", labelAr: "المشكلة والوصف", defaultVisible: true },
  { key: "department", label: "DEPARTMENT", labelAr: "القسم والخدمة", defaultVisible: false },
  { key: "status", label: "STATUS", labelAr: "الحالة", defaultVisible: true },
  { key: "priority", label: "PRIORITY", labelAr: "الأولوية", defaultVisible: true },
  { key: "assigned_to", label: "ASSIGNED TO", labelAr: "المسند إليه / الفني", defaultVisible: true },
  { key: "at", label: "REPORTED AT", labelAr: "تاريخ البدء", defaultVisible: false },
  { key: "duration", label: "DURATION", labelAr: "المدة", defaultVisible: false },
  { key: "rating", label: "RATING", labelAr: "التقييم", defaultVisible: false },
  { key: "actions", label: "ACTIONS", labelAr: "إجراءات", defaultVisible: true, fixed: true },
];
