// Report table columns — rooms: header + row cells per report.
import { TableCell } from "@/components/ui/table";
import { roomStatusBadge, getRoomStatusLabel } from "@/pages/housing/utils";
import type { ReportTableCtx, ReportRowCtx } from "./context";

export function HousingHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
      {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
      {H("roomType", ar ? "النوع" : "Type")}
      {H("capacity", ar ? "السعة" : "Capacity", "text-center")}
      {H("currentOccupancy", ar ? "المشغول" : "Occupied", "text-center")}
      {H("vacantBeds", ar ? "الشاغر" : "Vacant", "text-center")}
      {H(
        "occupancyRate",
        ar ? "نسبة الإشغال" : "Occupancy Rate",
        "text-center",
      )}
      {H("genderPolicy", ar ? "سياسة الجنس" : "Gender Policy")}
      {H("status", ar ? "الحالة" : "Status")}
    </>
  );
}

export function HousingCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell className="text-xs">
        {row.buildingName} • {row.floorName}
      </TableCell>
      <TableCell className="font-bold text-primary">{row.roomNumber}</TableCell>
      <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
      <TableCell className="text-center font-semibold">
        {row.capacity}
      </TableCell>
      <TableCell className="text-center">{row.currentOccupancy}</TableCell>
      <TableCell className="text-center">
        <span
          className={
            row.vacantBeds > 0
              ? "text-emerald-600 font-bold"
              : "text-muted-foreground"
          }
        >
          {row.vacantBeds}
        </span>
      </TableCell>
      <TableCell className="text-center font-mono font-bold text-xs">
        {row.occupancyRate}
      </TableCell>
      <TableCell className="text-xs capitalize">{row.genderPolicy}</TableCell>
      <TableCell>
        <span
          className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${roomStatusBadge(row.status)}`}
        >
          {getRoomStatusLabel(row.status, ar)}
        </span>
      </TableCell>
    </>
  );
}
