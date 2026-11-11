import { exportExcel as exportExcelUtil } from "@/pages/reports/utils/export";
import { formatDate } from "@/lib/date-utils";
import { formatDuration, STATUS_AR } from "./ticket-duration";
import {
  CATEGORIES_AR,
  PROBLEM_TYPES_MAP,
  PRIORITY_AR,
} from "./ticket-constants";

export interface TicketExportContext {
  ar: boolean;
  properties: any[];
  roomMap: Record<number, string>;
  roomOccupantMap: Record<number, string>;
}

export function exportTicketsExcel(
  filtered: any[],
  { ar, properties, roomMap, roomOccupantMap }: TicketExportContext,
) {
  const rows = filtered.map((req: any) => ({
    [ar ? "رقم الطلب" : "ID"]: req.id,
    [ar ? "Resident" : "Resident"]:
      req.propertyName ||
      properties?.find((p: any) => p.id === req.propertyId)?.name ||
      "—",
    [ar ? "الغرفة" : "Room"]:
      `${ar ? "الغرفة" : "Room"} ${req.roomNumber || (roomMap[req.roomId] ?? req.roomId)}`,
    [ar ? "المبنى" : "Building"]: req.buildingName || "—",
    [ar ? "الدور" : "Floor"]: req.floorNumber
      ? `${ar ? "الدور " : "Floor "}${req.floorNumber}`
      : "—",
    [ar ? "مقدم البلاغ" : "Reported By"]: req.reportedBy || "—",
    [ar ? "النزيل المقيم" : "Occupant"]: roomOccupantMap[req.roomId] || "—",
    [ar ? "القسم / النوع" : "Type"]: ar
      ? ((CATEGORIES_AR as Record<string, string>)[req.category] ??
        req.category)
      : req.category,
    [ar ? "نوع المشكلة / الخدمة" : "Problem / Service"]: ar
      ? PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType
      : PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType,
    [ar ? "الفني المعين" : "Assigned Worker"]: req.workerName || "—",
    [ar ? "الوصف" : "Description"]: req.description,
    [ar ? "الأولوية" : "Priority"]: ar
      ? (PRIORITY_AR[req.priority?.toUpperCase()] ?? req.priority)
      : req.priority,
    [ar ? "الحالة" : "Status"]: ar
      ? (STATUS_AR[req.status?.toLowerCase()] ?? req.status)
      : req.status,
    [ar ? "تاريخ الإبلاغ" : "Reported (Date)"]: formatDate(req.reportedAt, ""),
    [ar ? "المدة" : "Duration"]: formatDuration(
      req.startedAt,
      req.resolvedAt,
      req.reportedAt,
    ),
    [ar ? "التقييم" : "Rating"]: req.rating
      ? `${req.rating}/5`
      : ["resolved", "closed"].includes(req.status)
        ? ar
          ? "بانتظار التقييم"
          : "Pending"
        : "—",
    [ar ? "ملاحظات التقييم" : "Rating Comment"]: req.ratingComment || "—",
  }));
  exportExcelUtil("Tickets_Hub", rows, {
    sheetName: ar ? "التذاكر" : "Tickets",
    orientation: "landscape",
  });
}

export function exportSelectedTicketsExcel(
  allTickets: any[],
  selectedTicketIds: Set<number>,
  { ar, properties, roomMap }: TicketExportContext,
) {
  const target =
    selectedTicketIds.size > 0
      ? allTickets.filter((t: any) => selectedTicketIds.has(t.id))
      : allTickets;
  if (target.length === 0) return;
  const rows = target.map((req: any) => ({
    [ar ? "رقم الطلب" : "Ticket #"]: req.id,
    [ar ? "Resident" : "Resident"]:
      req.propertyName ||
      properties?.find((p: any) => p.id === req.propertyId)?.name ||
      "—",
    [ar ? "الغرفة" : "Room"]:
      req.roomNumber || (roomMap[req.roomId] ?? req.roomId),
    [ar ? "المبنى" : "Building"]: req.buildingName || "—",
    [ar ? "الدور" : "Floor"]: req.floorNumber
      ? `${ar ? "الدور " : "Floor "}${req.floorNumber}`
      : "—",
    [ar ? "مقدم البلاغ" : "Reported By"]: req.reportedBy || "—",
    [ar ? "النوع" : "Category"]: ar
      ? ((CATEGORIES_AR as Record<string, string>)[req.category] ??
        req.category)
      : req.category,
    [ar ? "المشكلة" : "Problem Type"]: ar
      ? PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType
      : PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType,
    [ar ? "الفني المعين" : "Assigned Worker"]: req.workerName || "—",
    [ar ? "الوصف" : "Description"]: req.description,
    [ar ? "الأولوية" : "Priority"]: ar
      ? (PRIORITY_AR[req.priority?.toUpperCase()] ?? req.priority)
      : req.priority,
    [ar ? "الحالة" : "Status"]: ar
      ? (STATUS_AR[req.status?.toLowerCase()] ?? req.status)
      : req.status,
    [ar ? "تاريخ الإبلاغ" : "Reported"]: formatDate(req.reportedAt, ""),
    [ar ? "المدة" : "Duration"]: formatDuration(
      req.startedAt,
      req.resolvedAt,
      req.reportedAt,
    ),
    [ar ? "التقييم" : "Rating"]: req.rating
      ? `${req.rating}/5`
      : ["resolved", "closed"].includes(req.status)
        ? ar
          ? "بانتظار التقييم"
          : "Pending"
        : "—",
    [ar ? "ملاحظات التقييم" : "Rating Comment"]: req.ratingComment || "—",
  }));
  exportExcelUtil("Selected_Tickets", rows, {
    sheetName: ar ? "التذاكر المحددة" : "Selected Tickets",
    orientation: "landscape",
  });
}
