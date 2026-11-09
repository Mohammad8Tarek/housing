// Report table columns — operations: header + row cells per report.
import { TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Building, AlertTriangle } from "lucide-react";
import { getRoomStatusLabel } from "@/pages/housing/utils";
import type { ReportTableCtx, ReportRowCtx } from "./context";

export function ManagerFlashHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("buildingName", ar ? "المبنى والكود" : "Building & Code")}
      {H("totalRooms", ar ? "إجمالي الغرف" : "Total Rooms", "text-center")}
      {H("totalBeds", ar ? "إجمالي الأسرة" : "Total Beds", "text-center")}
      {H("occupiedBeds", ar ? "المشغول" : "Occupied", "text-center")}
      {H("vacantBeds", ar ? "الشاغر" : "Vacant", "text-center")}
      {H("dirtyRooms", ar ? "متسخ" : "Dirty", "text-center")}
      {H("oooRooms", ar ? "صيانة OOO" : "OOO", "text-center")}
      {H(
        "occupancyRate",
        ar ? "نسبة الإشغال" : "Occupancy Rate",
        "text-center",
      )}
      {H("status", ar ? "الحالة التشغيلية" : "Operational Status")}
    </>
  );
}

export function ManagerFlashCells(c: ReportRowCtx) {
  const { row } = c;
  return (
    <>
      <TableCell>
        <div className="flex items-center gap-1.5 font-semibold text-foreground">
          <Building className="w-3.5 h-3.5 text-muted-foreground" />
          <span>{row.buildingName}</span>
          {row.code !== "—" && (
            <span className="text-[10px] text-muted-foreground font-mono">
              ({row.code})
            </span>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center font-mono">{row.totalRooms}</TableCell>
      <TableCell className="text-center font-mono font-semibold">
        {row.totalBeds}
      </TableCell>
      <TableCell className="text-center font-mono text-emerald-600 font-semibold">
        {row.occupiedBeds}
      </TableCell>
      <TableCell className="text-center font-mono text-sky-600 font-semibold">
        {row.vacantBeds}
      </TableCell>
      <TableCell className="text-center font-mono text-rose-600 font-semibold">
        {row.dirtyRooms}
      </TableCell>
      <TableCell className="text-center font-mono text-amber-600 font-semibold">
        {row.oooRooms}
      </TableCell>
      <TableCell className="text-center font-mono font-bold text-amber-600">
        {row.occupancyRate}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
        >
          {row.status}
        </Badge>
      </TableCell>
    </>
  );
}

export function ArrivalsManifestHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("profileName", ar ? "اسم النزيل / الحجز" : "Guest / Profile")}
      {H("department", ar ? "القسم والمسمى" : "Dept & Title")}
      {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
      {H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
      {H("checkInDate", ar ? "تاريخ الوصول (Due In)" : "Arrival (Due In)")}
      {H("checkOutDate", ar ? "تاريخ المغادرة" : "Check-Out")}
      {H("nights", ar ? "الليالي" : "Nights", "text-center")}
      {H("vipStatus", ar ? "الفئة" : "Category")}
      {H("status", ar ? "حالة الحجز" : "Reservation Status")}
    </>
  );
}

export function ArrivalsManifestCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell>
        <div>
          <p className="font-bold text-sm text-foreground">{row.profileName}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.profileId}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <p className="font-medium text-xs text-foreground">{row.department}</p>
        <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
      </TableCell>
      <TableCell>
        <p className="text-xs font-medium text-foreground">
          {row.buildingName}
        </p>
        <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="font-mono bg-blue-50 text-blue-700 border-blue-200"
        >
          {ar
            ? `غرفة ${row.roomNumber} (${row.bedNumber})`
            : `Room ${row.roomNumber} (${row.bedNumber})`}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className="font-mono text-emerald-700 bg-emerald-50 border-emerald-200"
        >
          {row.checkInDate}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {row.checkOutDate}
      </TableCell>
      <TableCell className="text-center font-mono font-semibold">
        {row.nights}
      </TableCell>
      <TableCell>
        <Badge
          variant={row.vipStatus === "VIP" ? "default" : "outline"}
          className="text-xs"
        >
          {row.vipStatus}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs"
        >
          {row.status}
        </Badge>
      </TableCell>
    </>
  );
}

export function DeparturesManifestHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("profileName", ar ? "الموظف / النزيل" : "Resident / Profile")}
      {H("department", ar ? "القسم والمسمى" : "Dept & Title")}
      {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
      {H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
      {H("checkInDate", ar ? "تاريخ التسكين" : "Check-In")}
      {H("checkOutDate", ar ? "المغادرة المستحقة (Due Out)" : "Due Out Date")}
      {H("departureCategory", ar ? "نوع المغادرة" : "Departure Type")}
      {H("reason", ar ? "السبب / ملاحظات HR" : "Reason / Notes")}
      {H("roomStatusAfter", ar ? "حالة الغرفة" : "Room Status")}
    </>
  );
}

export function DeparturesManifestCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell>
        <div>
          <p className="font-bold text-sm text-foreground">{row.profileName}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.profileId}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <p className="font-medium text-xs text-foreground">{row.department}</p>
        <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
      </TableCell>
      <TableCell>
        <p className="text-xs font-medium text-foreground">
          {row.buildingName}
        </p>
        <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="font-mono bg-slate-50 text-slate-700 border-slate-200"
        >
          {ar
            ? `غرفة ${row.roomNumber} (سرير ${row.bedNumber})`
            : `Room ${row.roomNumber} (Bed ${row.bedNumber})`}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground">
        {row.checkInDate}
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className="font-mono text-rose-700 bg-rose-50 border-rose-200 font-bold"
        >
          {row.checkOutDate}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.departureCategory?.includes("تصفية") ||
            row.departureCategory?.includes("Departed")
              ? "bg-red-100 text-red-800 border-red-200 font-semibold"
              : row.departureCategory?.includes("Due Out") ||
                  row.departureCategory?.includes("اليوم")
                ? "bg-amber-100 text-amber-800 border-amber-200 font-semibold"
                : "bg-blue-50 text-blue-700 border-blue-200"
          }
        >
          {row.departureCategory}
        </Badge>
      </TableCell>
      <TableCell
        className="text-xs max-w-[200px] truncate text-muted-foreground"
        title={row.reason}
      >
        {row.reason}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs">
          {row.roomStatusAfter}
        </Badge>
      </TableCell>
    </>
  );
}

export function HousekeepingSheetHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
      {H("roomNumber", ar ? "الغرفة" : "Room")}
      {H("foStatus", ar ? "حالة الإشغال (FO)" : "FO Status", "text-center")}
      {H("hkStatus", ar ? "حالة النظافة (HK)" : "HK Status")}
      {H("taskType", ar ? "نوع المهمة المطلوبة" : "Task Assignment")}
      {H("occupantNames", ar ? "النزلاء الحاليون" : "Current Occupants")}
      {H("linenCheck", ar ? "فحص المفروشات" : "Linen", "text-center w-28")}
      {H("amenitiesCheck", ar ? "فحص العهد" : "Amenities", "text-center w-28")}
      {H(
        "signature",
        ar ? "التوقيع والوقت" : "Attendant Sign",
        "text-center w-32",
      )}
    </>
  );
}

export function HousekeepingSheetCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell>
        <p className="text-xs font-medium text-foreground">
          {row.buildingName}
        </p>
        <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <span className="font-bold text-base font-mono text-foreground">
            {row.roomNumber}
          </span>
          <Badge
            variant="outline"
            className="text-[10px] px-1.5 py-0 font-normal"
          >
            {row.roomType}
          </Badge>
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={
            row.foStatus === "مشغول" || row.foStatus === "Occupied"
              ? "bg-blue-50 text-blue-700 border-blue-200"
              : "bg-emerald-50 text-emerald-700 border-emerald-200"
          }
        >
          {row.foStatus} ({row.activeCount}/{row.capacity})
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="secondary"
          className={
            row.hkStatus === "dirty" || row.hkStatus === "occupied_dirty"
              ? "bg-rose-100 text-rose-800 border-rose-200"
              : row.hkStatus === "clean" || row.hkStatus === "inspected"
                ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                : "bg-amber-100 text-amber-800 border-amber-200"
          }
        >
          {getRoomStatusLabel(row.hkStatus, ar)}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.taskPriority === 1
              ? "bg-red-50 text-red-700 border-red-300 font-semibold"
              : row.taskPriority === 2
                ? "bg-blue-50 text-blue-700 border-blue-300"
                : "bg-slate-50 text-slate-600 border-slate-200"
          }
        >
          {row.taskType}
        </Badge>
      </TableCell>
      <TableCell
        className="max-w-[240px] truncate text-xs text-foreground"
        title={row.occupantNames}
      >
        {row.occupantNames}
      </TableCell>
      <TableCell className="text-center font-mono text-xs text-muted-foreground">
        {row.estimatedMins}
      </TableCell>
      <TableCell className="text-center">
        <div className="inline-flex items-center justify-center w-5 h-5 rounded border border-muted-foreground/40 bg-white" />
      </TableCell>
      <TableCell className="text-center">
        <div className="inline-flex items-center justify-center w-5 h-5 rounded border border-muted-foreground/40 bg-white" />
      </TableCell>
      <TableCell className="text-center">
        <span className="text-xs text-muted-foreground font-mono">
          ___________
        </span>
      </TableCell>
    </>
  );
}

export function RoomDiscrepancyHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("severity", ar ? "الخطورة" : "Severity", "text-center")}
      {H("type", ar ? "نوع التباين والفحص الميداني" : "Discrepancy Type")}
      {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
      {H("roomNumber", ar ? "الغرفة" : "Room")}
      {H("foStatus", ar ? "حالة الاستقبال (Front Office)" : "Front Office")}
      {H("hkStatus", ar ? "حالة النظافة الميدانية (HK)" : "Housekeeping")}
      {H(
        "impactedResidents",
        ar ? "النزلاء المعنيون / الملاحظات" : "Impacted Residents / Details",
      )}
      {H(
        "recommendedAction",
        ar ? "الإجراء الفندقي الموصى به" : "Recommended Action",
      )}
    </>
  );
}

export function RoomDiscrepancyCells(c: ReportRowCtx) {
  const { row } = c;
  return (
    <>
      <TableCell className="text-center">
        <Badge
          variant="default"
          className={
            row.severity === "CRITICAL"
              ? "bg-rose-600 hover:bg-rose-600 text-white font-bold"
              : row.severity === "WARNING"
                ? "bg-amber-500 hover:bg-amber-500 text-white font-semibold"
                : "bg-sky-500 hover:bg-sky-500 text-white"
          }
        >
          {row.severityLabel}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5">
          <AlertTriangle
            className={
              row.severity === "CRITICAL"
                ? "w-4 h-4 text-rose-600 shrink-0"
                : "w-4 h-4 text-amber-500 shrink-0"
            }
          />
          <span className="font-bold text-sm text-foreground">
            {row.typeLabel}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-xs font-medium text-foreground">
          {row.buildingName}
        </p>
        <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
      </TableCell>
      <TableCell>
        <span className="font-bold text-base font-mono text-foreground">
          {row.roomNumber}
        </span>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
        >
          {row.foStatus}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-700 border-amber-200 text-xs"
        >
          {row.hkStatus}
        </Badge>
      </TableCell>
      <TableCell
        className="max-w-[200px] truncate text-xs text-foreground"
        title={row.impactedResidents}
      >
        {row.impactedResidents}
      </TableCell>
      <TableCell>
        <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/50">
          {row.recommendedAction}
        </p>
      </TableCell>
    </>
  );
}

export function DailyMovementHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("movementType", ar ? "نوع الحركة" : "Movement Type")}
      {H("date", ar ? "التاريخ والوقت" : "Date & Time")}
      {H("profileName", ar ? "المقيم / النزيل" : "Resident / Profile")}
      {H("department", ar ? "القسم" : "Department")}
      {H("buildingName", ar ? "المبنى" : "Building")}
      {H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
      {H("notes", ar ? "التفاصيل والملاحظات" : "Details & Notes")}
    </>
  );
}

export function DailyMovementCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.typeKey === "check_in"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
              : row.typeKey === "check_out"
                ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold"
                : row.typeKey === "transfer"
                  ? "bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold"
                  : "bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold"
          }
        >
          {row.movementType}
        </Badge>
      </TableCell>
      <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
        {row.date}
      </TableCell>
      <TableCell>
        <div className="font-semibold text-foreground">{row.profileName}</div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {row.profileCode}
        </div>
      </TableCell>
      <TableCell className="text-xs">{row.department}</TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.buildingName}
      </TableCell>
      <TableCell>
        <Badge variant="secondary" className="font-mono text-xs">
          {ar ? "غرفة" : "Room"} {row.roomNumber}
        </Badge>
        {row.bedNumber && row.bedNumber !== "—" && (
          <span className="text-[11px] text-muted-foreground ms-1">
            ({ar ? "سرير" : "Bed"} {row.bedNumber})
          </span>
        )}
      </TableCell>
      <TableCell
        className="text-xs text-muted-foreground max-w-[200px] truncate"
        title={row.notes}
      >
        {row.notes}
      </TableCell>
    </>
  );
}
