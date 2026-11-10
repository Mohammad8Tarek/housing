// Report table columns — services: header + row cells per report.
import { TableCell, TableHead } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Eye,
  PackageCheck,
  DoorClosed,
  Building2,
  Layers,
  User,
  Star,
} from "lucide-react";
import type { ReportTableCtx, ReportRowCtx } from "./context";

export function MaintenanceHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
      {H("roomNumber", ar ? "الغرفة" : "Room No")}
      {H("reportedBy", ar ? "مقدم البلاغ (الطالب)" : "Reported By")}
      {H("category", ar ? "الفئة" : "Category")}
      {H("problemType", ar ? "نوع المشكلة" : "Problem Details")}
      {H("priority", ar ? "الأولوية" : "Priority")}
      {H("assignedTo", ar ? "الفني المعين" : "Assigned To")}
      {H("reportedAt", ar ? "تاريخ البلاغ" : "Reported At")}
      {H("rating", ar ? "التقييم (الريت)" : "Rating & Feedback")}
      {H("status", ar ? "الحالة" : "Status")}
    </>
  );
}

export function MaintenanceCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell>
        <div className="flex flex-col gap-0.5">
          <span className="text-xs font-semibold text-foreground flex items-center gap-1">
            <Building2 className="w-3 h-3 text-sky-600 shrink-0" />
            {row.buildingName}
          </span>
          <span className="text-[11px] text-muted-foreground flex items-center gap-1">
            <Layers className="w-3 h-3 text-amber-600 shrink-0" />
            {row.floorName}
          </span>
        </div>
      </TableCell>
      <TableCell>
        <span className="font-bold text-primary flex items-center gap-1">
          <DoorClosed className="w-3.5 h-3.5 text-primary shrink-0" />
          {row.roomNumber}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
          <User className="w-3.5 h-3.5 text-primary shrink-0" />
          <span className="truncate max-w-[160px]" title={row.reportedBy}>
            {row.reportedBy}
          </span>
        </div>
      </TableCell>
      <TableCell className="text-xs font-semibold capitalize">
        <span
          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
            row.rawCategory === "housekeeping" ||
            String(row.category).includes("نظافة")
              ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200"
              : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200"
          }`}
        >
          {row.category}
        </span>
      </TableCell>
      <TableCell className="text-xs max-w-xs truncate" title={row.problemType}>
        {row.problemType}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.priority === "Urgent" ||
            row.priority === "عاجلة" ||
            row.rawPriority?.toLowerCase() === "urgent"
              ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
              : row.priority === "High" || row.priority === "عالية"
                ? "bg-orange-50 text-orange-700 border-orange-200 text-xs font-semibold"
                : "text-xs"
          }
        >
          {row.priority}
        </Badge>
      </TableCell>
      <TableCell className="text-xs font-medium">{row.assignedTo}</TableCell>
      <TableCell className="text-xs font-mono text-muted-foreground">
        {row.reportedAt}
      </TableCell>
      <TableCell>
        {row.rating != null && row.rating > 0 ? (
          <div className="flex flex-col gap-0.5">
            <div className="flex items-center gap-1">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`w-3.5 h-3.5 ${
                      star <= row.rating
                        ? "text-amber-500 fill-amber-500"
                        : "text-slate-200 dark:text-slate-700"
                    }`}
                  />
                ))}
              </div>
              <span className="text-xs font-bold text-foreground font-mono">
                {row.rating}/5
              </span>
            </div>
            {row.ratingComment && (
              <p
                className="text-[10px] text-muted-foreground italic truncate max-w-[150px]"
                title={row.ratingComment}
              >
                "{row.ratingComment}"
              </p>
            )}
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground italic">
            {ar ? "لم يتم التقييم" : "Not rated"}
          </span>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize font-medium">
          {row.status}
        </Badge>
      </TableCell>
    </>
  );
}

export function HousekeepingHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
      {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
      {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
      {H("capacity", ar ? "السعة" : "Cap", "text-center")}
      {H("currentOccupancy", ar ? "المشغول" : "Occ", "text-center")}
      {H("vacantBeds", ar ? "الأسرة الشاغرة" : "Vacant", "text-center")}
      {H("status", ar ? "حالة الغرفة" : "Room Status")}
      {H("hkPriority", ar ? "الإجراء المطلوب" : "HK Action")}
      {H("openHkTickets", ar ? "تذاكر مفتوحة" : "Open Tickets", "text-center")}
    </>
  );
}

export function HousekeepingCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell>
        <p className="text-xs font-medium">{row.buildingName}</p>
        <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
      </TableCell>
      <TableCell>
        <span className="font-bold text-primary">{row.roomNumber}</span>
      </TableCell>
      <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
      <TableCell className="text-center text-xs font-semibold">
        {row.capacity}
      </TableCell>
      <TableCell className="text-center text-xs">
        {row.currentOccupancy}
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={
            row.vacantBeds === 0
              ? "bg-red-50 text-red-700 border-red-200 text-xs"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
          }
        >
          {row.vacantBeds}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.status?.toLowerCase() === "dirty"
              ? "bg-orange-50 text-orange-700 border-orange-200 text-xs"
              : row.status?.toLowerCase() === "occupied_dirty"
                ? "bg-red-50 text-red-700 border-red-200 text-xs"
                : row.status?.toLowerCase() === "available"
                  ? "bg-green-50 text-green-700 border-green-200 text-xs"
                  : row.status?.toLowerCase() === "occupied"
                    ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                    : row.status?.toLowerCase() === "maintenance"
                      ? "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                      : "text-xs"
          }
        >
          {row.status}
        </Badge>
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.hkPriority === "high"
              ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
              : row.hkPriority === "none"
                ? "bg-green-50 text-green-700 border-green-200 text-xs"
                : row.hkPriority === "maintenance"
                  ? "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                  : "text-xs"
          }
        >
          {ar
            ? row.status?.toLowerCase() === "dirty"
              ? "تنظيف فوري 🧹"
              : row.status?.toLowerCase() === "occupied_dirty"
                ? "تنظيف عند الخروج"
                : row.status?.toLowerCase() === "available"
                  ? "✅ جاهزة"
                  : row.status?.toLowerCase() === "occupied"
                    ? "مشغولة — لا تزعج"
                    : row.status?.toLowerCase() === "maintenance"
                      ? "🔧 صيانة"
                      : "مراجعة"
            : row.status?.toLowerCase() === "dirty"
              ? "Immediate Clean 🧹"
              : row.status?.toLowerCase() === "occupied_dirty"
                ? "Clean on Checkout"
                : row.status?.toLowerCase() === "available"
                  ? "✅ Ready"
                  : row.status?.toLowerCase() === "occupied"
                    ? "Occupied — DND"
                    : row.status?.toLowerCase() === "maintenance"
                      ? "🔧 Maintenance"
                      : "Review"}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        {row.openHkTickets > 0 ? (
          <Badge
            variant="outline"
            className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
          >
            {row.openHkTickets}
          </Badge>
        ) : (
          <span className="text-xs text-muted-foreground">—</span>
        )}
      </TableCell>
    </>
  );
}

export function EquipmentInventoryHeader(c: ReportTableCtx) {
  const { ar, H, inventoryViewMode } = c;
  return inventoryViewMode === "summary" ? (
    <>
      {H("itemName", ar ? "اسم العهدة / المعدة" : "Equipment / Item")}
      {H("category", ar ? "التصنيف" : "Category")}
      {H(
        "totalQuantity",
        ar ? "إجمالي الكمية بالسكن" : "Total in Housing",
        "text-center",
      )}
      <TableHead className="text-start">
        {ar ? "الحالة التشغيلية" : "Condition Breakdown"}
      </TableHead>
      {H("roomsCount", ar ? "عدد الغرف" : "Rooms Count", "text-center")}
      <TableHead className="text-start">
        {ar ? "تفاصيل وتوزيع الغرف" : "Rooms Breakdown"}
      </TableHead>
    </>
  ) : (
    <>
      {H("buildingName", ar ? "المبنى والموقع" : "Building & Location")}
      {H("roomNumber", ar ? "الغرفة" : "Room")}
      {H("itemName", ar ? "اسم المعدة / القطعة" : "Equipment / Item")}
      {H("category", ar ? "التصنيف" : "Category")}
      {H("quantity", ar ? "العدد" : "Qty", "text-center")}
      {H("condition", ar ? "الحالة" : "Condition")}
      {H("serialNumber", ar ? "الرقم التسلسلي / الكود" : "Serial / Asset Tag")}
      {H("lastInspectedAt", ar ? "تاريخ الفحص" : "Last Inspected")}
      {H("notes", ar ? "ملاحظات" : "Notes")}
    </>
  );
}

export function EquipmentInventoryCells(c: ReportRowCtx) {
  const { ar, inventoryViewMode, setSelectedItemRooms, row } = c;
  return inventoryViewMode === "summary" ? (
    <>
      <TableCell>
        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
          <PackageCheck className="w-4 h-4 text-cyan-600 shrink-0" />
          <span>{row.itemName}</span>
        </div>
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize font-medium">
          {ar
            ? row.category === "appliances"
              ? "كهربائية وتكييف (Electric)"
              : row.category === "other"
                ? "أخرى (Other)"
                : row.category === "electronics"
                  ? "إلكترونيات (Electronics)"
                  : row.category === "furniture"
                    ? "أثاث (Furniture)"
                    : row.category === "fixtures"
                      ? "مرافق (Fixtures)"
                      : row.category === "linen"
                        ? "مفروشات (Linen)"
                        : "أخرى (Other)"
            : row.category === "appliances"
              ? "Electric / Appliances"
              : row.category}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <span className="inline-flex items-center justify-center min-w-[38px] px-2.5 py-1 text-sm font-bold rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 shadow-xs">
          {row.totalQuantity}
        </span>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-1.5 flex-wrap">
          {row.goodCount > 0 && (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold"
            >
              {ar ? "سليم" : "Good"}: {row.goodCount}
            </Badge>
          )}
          {row.needsRepairCount > 0 && (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-bold"
            >
              {ar ? "صيانة" : "Repair"}: {row.needsRepairCount}
            </Badge>
          )}
          {row.damagedCount > 0 && (
            <Badge
              variant="outline"
              className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-bold"
            >
              {ar ? "تالف" : "Damaged"}: {row.damagedCount}
            </Badge>
          )}
          {row.missingCount > 0 && (
            <Badge
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-bold"
            >
              {ar ? "مفقود" : "Missing"}: {row.missingCount}
            </Badge>
          )}
        </div>
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className="text-xs font-semibold">
          {row.roomsCount} {ar ? "غرفة" : "rooms"}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="h-7 text-xs gap-1.5 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
            onClick={() => setSelectedItemRooms(row)}
          >
            <Eye className="w-3.5 h-3.5" />
            {ar ? "استعراض الغرف" : "View Rooms"}
            <span className="text-[10px] text-muted-foreground font-mono">
              ({row.roomsCount})
            </span>
          </Button>
          <span
            className="text-[11px] text-muted-foreground truncate max-w-[140px]"
            title={row.roomsSummary}
          >
            {row.roomsSummary}
          </span>
        </div>
      </TableCell>
    </>
  ) : (
    <>
      <TableCell>
        <div className="text-xs font-medium text-foreground">
          {row.buildingName}
        </div>
        <div className="text-[11px] text-muted-foreground">{row.floorName}</div>
      </TableCell>
      <TableCell>
        <span className="font-bold text-primary text-sm">
          {ar ? "غرفة" : "Room"} {row.roomNumber}
        </span>
      </TableCell>
      <TableCell>
        <div className="font-medium text-sm text-foreground flex items-center gap-1.5">
          <span>{row.itemName}</span>
        </div>
        {row.modelNumber && row.modelNumber !== "—" && (
          <div className="text-[11px] text-muted-foreground">
            {row.modelNumber}
          </div>
        )}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize font-medium">
          {ar
            ? row.category === "appliances"
              ? "كهربائية وتكييف (Electric)"
              : row.category === "other"
                ? "أخرى (Other)"
                : row.category === "electronics"
                  ? "إلكترونيات (Electronics)"
                  : row.category === "furniture"
                    ? "أثاث (Furniture)"
                    : row.category === "fixtures"
                      ? "مرافق (Fixtures)"
                      : row.category === "linen"
                        ? "مفروشات (Linen)"
                        : "أخرى (Other)"
            : row.category === "appliances"
              ? "Electric / Appliances"
              : row.category}
        </Badge>
      </TableCell>
      <TableCell className="text-center font-bold text-sm">
        {row.quantity || 1}
      </TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.condition === "good"
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
              : row.condition === "fair"
                ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                : row.condition === "needs_repair"
                  ? "bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold"
                  : row.condition === "damaged"
                    ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                    : "bg-purple-50 text-purple-700 border-purple-200 text-xs font-bold"
          }
        >
          {ar
            ? row.condition === "good"
              ? "ممتاز / سليم"
              : row.condition === "fair"
                ? "مقبول / يعمل"
                : row.condition === "needs_repair"
                  ? "بحاجة لصيانة"
                  : row.condition === "damaged"
                    ? "تالف / معطل"
                    : row.condition === "missing"
                      ? "مفقود"
                      : row.condition
            : row.condition === "good"
              ? "Good / OK"
              : row.condition === "fair"
                ? "Fair"
                : row.condition === "needs_repair"
                  ? "Needs Repair"
                  : row.condition === "damaged"
                    ? "Damaged"
                    : row.condition === "missing"
                      ? "Missing"
                      : row.condition}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="text-xs font-mono text-foreground">
          {row.serialNumber && row.serialNumber !== "—"
            ? row.serialNumber
            : row.barcode || "—"}
        </div>
        {row.barcode &&
          row.barcode !== "—" &&
          row.serialNumber &&
          row.serialNumber !== "—" && (
            <div className="text-[10px] text-muted-foreground font-mono">
              Tag: {row.barcode}
            </div>
          )}
      </TableCell>
      <TableCell>
        <div className="text-xs text-muted-foreground">
          {row.lastInspectedAt || "—"}
        </div>
        {row.inspectedBy && row.inspectedBy !== "—" && (
          <div className="text-[10px] text-muted-foreground">
            {row.inspectedBy}
          </div>
        )}
      </TableCell>
      <TableCell
        className="max-w-[160px] truncate text-xs text-muted-foreground"
        title={row.notes}
      >
        {row.notes || "—"}
      </TableCell>
    </>
  );
}

export function WaterDistributionHeader(c: ReportTableCtx) {
  const { ar, H, isVis } = c;
  return (
    <>
      {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Code")}
      {isVis("fullName") && H("fullName", ar ? "الاسم بالكامل" : "Full Name")}
      {isVis("department") && H("department", ar ? "القسم" : "Department")}
      {isVis("buildingName") && H("buildingName", ar ? "المبنى" : "Building")}
      {isVis("floorName") && H("floorName", ar ? "الدور" : "Floor")}
      {isVis("roomNumber") && H("roomNumber", ar ? "الغرفة" : "Room No")}
      {isVis("bedNumber") && H("bedNumber", ar ? "السرير" : "Bed No")}
      {isVis("waterIssue1") && (
        <TableHead className="text-center min-w-[110px] font-bold text-xs bg-cyan-500/10 text-cyan-800 dark:text-cyan-300">
          <div className="flex flex-col items-center justify-center">
            <span>{ar ? "الصرف الأول" : "1st Issue"}</span>
            <span className="text-[10px] font-normal opacity-75">
              {ar ? "(نصف أول)" : "(1st Half)"}
            </span>
          </div>
        </TableHead>
      )}
      {isVis("waterIssue2") && (
        <TableHead className="text-center min-w-[110px] font-bold text-xs bg-sky-500/10 text-sky-800 dark:text-sky-300">
          <div className="flex flex-col items-center justify-center">
            <span>{ar ? "الصرف الثاني" : "2nd Issue"}</span>
            <span className="text-[10px] font-normal opacity-75">
              {ar ? "(نصف ثاني)" : "(2nd Half)"}
            </span>
          </div>
        </TableHead>
      )}
      {isVis("signature") && (
        <TableHead className="text-center min-w-[120px] font-semibold text-xs">
          {ar ? "توقيع المستلم" : "Signature"}
        </TableHead>
      )}
    </>
  );
}

export function WaterDistributionCells(c: ReportRowCtx) {
  const { isVis, waterCheckState, toggleWaterCheck, row } = c;
  return (
    <>
      {isVis("profileCode") && (
        <TableCell className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
          {row.profileCode}
        </TableCell>
      )}
      {isVis("fullName") && (
        <TableCell className="font-bold text-xs text-foreground whitespace-nowrap">
          {row.fullName}
        </TableCell>
      )}
      {isVis("department") && (
        <TableCell className="text-xs">
          <Badge variant="outline" className="text-[11px] font-medium">
            {row.department}
          </Badge>
        </TableCell>
      )}
      {isVis("buildingName") && (
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {row.buildingName}
        </TableCell>
      )}
      {isVis("floorName") && (
        <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
          {row.floorName}
        </TableCell>
      )}
      {isVis("roomNumber") && (
        <TableCell className="text-xs font-bold text-primary">
          {row.roomNumber}
        </TableCell>
      )}
      {isVis("bedNumber") && (
        <TableCell className="text-xs text-center">
          {row.bedNumber !== "—" ? (
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              {row.bedNumber}
            </Badge>
          ) : (
            "—"
          )}
        </TableCell>
      )}
      {isVis("waterIssue1") && (
        <TableCell className="text-center bg-cyan-50/25 dark:bg-cyan-950/10">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={Boolean(waterCheckState[`${row.id}_1`])}
              onCheckedChange={(checked) =>
                toggleWaterCheck(`${row.id}_1`, Boolean(checked))
              }
              className="h-4 w-4 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
            />
          </div>
        </TableCell>
      )}
      {isVis("waterIssue2") && (
        <TableCell className="text-center bg-sky-50/25 dark:bg-sky-950/10">
          <div className="flex items-center justify-center">
            <Checkbox
              checked={Boolean(waterCheckState[`${row.id}_2`])}
              onCheckedChange={(checked) =>
                toggleWaterCheck(`${row.id}_2`, Boolean(checked))
              }
              className="h-4 w-4 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600"
            />
          </div>
        </TableCell>
      )}
      {isVis("signature") && (
        <TableCell className="text-center text-xs text-muted-foreground/40 font-mono">
          ....................
        </TableCell>
      )}
    </>
  );
}
