// Report table columns — occupancy: header + row cells per report.
import { formatDate } from "@/lib/date-utils";
import { TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { roomStatusBadge, getRoomStatusLabel } from "@/pages/housing/utils";
import type { ReportTableCtx, ReportRowCtx } from "./context";

export function OccupancyForecastHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("dateDisplay", ar ? "التاريخ واليوم" : "Date & Day")}
      {H("dayArrivals", ar ? "الوصول المتوقع" : "Arrivals", "text-center")}
      {H(
        "dayDepartures",
        ar ? "المغادرة المتوقعة" : "Departures",
        "text-center",
      )}
      {H("netShift", ar ? "صافي الحركة" : "Net Shift", "text-center")}
      {H(
        "projectedOccupied",
        ar ? "الأسرة المشغولة" : "Projected Occupied",
        "text-center",
      )}
      {H(
        "projectedVacant",
        ar ? "الأسرة الشاغرة" : "Projected Vacant",
        "text-center",
      )}
      {H(
        "occupancyRate",
        ar ? "نسبة الإشغال" : "Occupancy Rate",
        "text-center",
      )}
      {H("demandLevel", ar ? "مستوى الضغط" : "Demand Level", "text-center")}
    </>
  );
}

export function OccupancyForecastCells(c: ReportRowCtx) {
  const { row } = c;
  return (
    <>
      <TableCell>
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 flex flex-col items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
            <span>{row.dateDisplay?.slice(0, 2)}</span>
          </div>
          <div>
            <p className="font-bold text-sm text-foreground">{row.dayName}</p>
            <p className="text-xs text-muted-foreground font-mono">
              {row.dateDisplay}
            </p>
          </div>
        </div>
      </TableCell>
      <TableCell className="text-center font-mono">
        <Badge
          variant="secondary"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
        >
          +{row.dayArrivals}
        </Badge>
      </TableCell>
      <TableCell className="text-center font-mono">
        <Badge
          variant="secondary"
          className="bg-rose-50 text-rose-700 border-rose-200 font-bold"
        >
          -{row.dayDepartures}
        </Badge>
      </TableCell>
      <TableCell className="text-center font-mono font-bold text-xs">
        {row.netShift}
      </TableCell>
      <TableCell className="text-center font-mono font-bold text-sm">
        {row.projectedOccupied}
      </TableCell>
      <TableCell className="text-center font-mono font-semibold text-emerald-600">
        {row.projectedVacant}
      </TableCell>
      <TableCell className="text-center font-mono font-bold text-xs">
        {row.occupancyRate}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="outline" className="text-xs">
          {row.demandLevel}
        </Badge>
      </TableCell>
    </>
  );
}

export function AssignmentsHeader(c: ReportTableCtx) {
  const { ar, H, isVis } = c;
  return (
    <>
      {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Code")}
      {isVis("fullName") &&
        H("fullName", ar ? "الموظف / المقيم" : "Occupant / Profile")}
      {isVis("employmentType") &&
        H("employmentType", ar ? "نوع التوظيف" : "Employment")}
      {isVis("buildingName") &&
        H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
      {isVis("roomNumber") &&
        H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
      {isVis("department") &&
        H("department", ar ? "القسم والمسمى" : "Dept & Title")}
      {isVis("level") && H("level", ar ? "الدرجة" : "Level")}
      {isVis("phone") && H("phone", ar ? "الهاتف" : "Phone")}
      {isVis("nationalId") &&
        H("nationalId", ar ? "الرقم القومي" : "National ID")}
      {isVis("nationality") && H("nationality", ar ? "الجنسية" : "Nationality")}
      {isVis("gender") && H("gender", ar ? "الجنس" : "Gender")}
      {isVis("dateOfBirth") &&
        H("dateOfBirth", ar ? "تاريخ الميلاد" : "Date of Birth")}
      {isVis("address") && H("address", ar ? "العنوان" : "Address")}
      {isVis("hireDate") && H("hireDate", ar ? "تاريخ التعيين" : "Hire Date")}
      {isVis("checkInDate") &&
        H("checkInDate", ar ? "تاريخ التسكين" : "Check-In")}
      {isVis("contractEndDate") &&
        H("contractEndDate", ar ? "انتهاء العقد" : "Contract End")}
      {isVis("expectedCheckOutDate") &&
        H("expectedCheckOutDate", ar ? "المغادرة المتوقعة" : "Expected Out")}
      {isVis("email") && H("email", ar ? "البريد الإلكتروني" : "Email")}
      {isVis("emergencyContact") &&
        H("emergencyContact", ar ? "هاتف الطوارئ" : "Emergency Contact")}
      {isVis("status") && H("status", ar ? "الحالة" : "Status")}
    </>
  );
}

export function AssignmentsCells(c: ReportRowCtx) {
  const { ar, isVis, row } = c;
  return (
    <>
      {isVis("profileCode") && (
        <TableCell className="font-mono text-xs font-semibold text-muted-foreground whitespace-nowrap">
          {row.profileCode}
        </TableCell>
      )}
      {isVis("fullName") && (
        <TableCell>
          <p className="font-bold text-sm text-foreground">{row.fullName}</p>
        </TableCell>
      )}
      {isVis("employmentType") && (
        <TableCell>
          {row.employmentType === "THIRD_PARTY" ? (
            <Badge
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
            >
              {row.companyName || (ar ? "طرف ثالث" : "Third Party")}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
            >
              {ar ? "موظف داخلي" : "Internal"}
            </Badge>
          )}
        </TableCell>
      )}
      {isVis("buildingName") && (
        <TableCell className="text-xs text-muted-foreground">
          {row.buildingName} • {row.floorName}
        </TableCell>
      )}
      {isVis("roomNumber") && (
        <TableCell>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="font-bold text-primary">{row.roomNumber}</span>
            {row.bedNumber !== "—" && (
              <Badge
                variant="secondary"
                className="text-[11px] h-5 px-1.5 font-medium"
              >
                {ar ? `سرير ${row.bedNumber}` : `Bed ${row.bedNumber}`}
              </Badge>
            )}
            {row.roomType && row.roomType !== "—" && (
              <Badge
                variant="outline"
                className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-muted/30"
              >
                {row.roomType}
                {row.capacity
                  ? ` (${row.capacity} ${ar ? "أسرة" : "beds"})`
                  : ""}
              </Badge>
            )}
            {row.isEntireRoom && (
              <Badge
                variant="outline"
                className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 text-[10px] h-5 px-1.5 font-medium"
              >
                {ar ? "غرفة كاملة" : "Full Lock"}
              </Badge>
            )}
          </div>
        </TableCell>
      )}
      {isVis("department") && (
        <TableCell>
          <p className="text-xs font-medium">{row.department}</p>
          <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
        </TableCell>
      )}
      {isVis("level") && <TableCell className="text-xs">{row.level}</TableCell>}
      {isVis("phone") && (
        <TableCell className="text-xs font-mono">{row.phone}</TableCell>
      )}
      {isVis("nationalId") && (
        <TableCell className="text-xs font-mono">{row.nationalId}</TableCell>
      )}
      {isVis("nationality") && (
        <TableCell className="text-xs">{row.nationality}</TableCell>
      )}
      {isVis("gender") && (
        <TableCell className="text-xs">
          {row.gender === "M"
            ? ar
              ? "ذكر"
              : "Male"
            : row.gender === "F"
              ? ar
                ? "أنثى"
                : "Female"
              : row.gender}
        </TableCell>
      )}
      {isVis("dateOfBirth") && (
        <TableCell className="text-xs">{row.dateOfBirth}</TableCell>
      )}
      {isVis("address") && (
        <TableCell
          className="text-xs max-w-[180px] truncate"
          title={row.address}
        >
          {row.address}
        </TableCell>
      )}
      {isVis("hireDate") && (
        <TableCell className="text-xs">{row.hireDate}</TableCell>
      )}
      {isVis("checkInDate") && (
        <TableCell className="text-xs">{row.checkInDate}</TableCell>
      )}
      {isVis("contractEndDate") && (
        <TableCell>
          {row.contractEndDate !== "—" ? (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-mono"
            >
              {row.contractEndDate}
            </Badge>
          ) : (
            <span className="text-muted-foreground text-xs">—</span>
          )}
        </TableCell>
      )}
      {isVis("expectedCheckOutDate") && (
        <TableCell className="text-xs">{row.expectedCheckOutDate}</TableCell>
      )}
      {isVis("email") && (
        <TableCell className="text-xs font-mono">{row.email}</TableCell>
      )}
      {isVis("emergencyContact") && (
        <TableCell className="text-xs font-mono">
          {row.emergencyContact}
        </TableCell>
      )}
      {isVis("status") && (
        <TableCell>
          {row.status === "VACATION" ? (
            <div className="flex flex-col gap-0.5 items-start">
              <Badge
                variant="outline"
                className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold"
              >
                {ar ? "في إجازة" : "On Vacation"}
              </Badge>
              {row.vacationEndDate && (
                <span className="text-[10px] text-muted-foreground font-mono">
                  {ar
                    ? `حتى ${formatDate(row.vacationEndDate)}`
                    : `Till ${formatDate(row.vacationEndDate)}`}
                </span>
              )}
            </div>
          ) : row.status === "CHECKED_OUT" || row.status === "LEFT" ? (
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium"
            >
              {ar ? "تمت المغادرة" : "Checked Out"}
            </Badge>
          ) : row.status === "TRANSFERRED" ? (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
            >
              {ar ? "تم النقل" : "Transferred"}
            </Badge>
          ) : (
            <div className="flex flex-wrap items-center gap-1">
              <Badge
                variant="outline"
                className="bg-green-50 text-green-700 border-green-200 text-xs font-semibold"
              >
                {ar ? "مقيم بالسكن" : "In-House"}
              </Badge>
              {row.isEntireRoom && (
                <Badge
                  variant="outline"
                  className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] px-1 py-0 font-medium"
                >
                  {ar ? "غرفة كاملة" : "Entire Room"}
                </Badge>
              )}
            </div>
          )}
        </TableCell>
      )}
    </>
  );
}

export function VacantRoomsHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
      {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
      {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
      {H("capacity", ar ? "السعة" : "Capacity", "text-center")}
      {H("currentOccupancy", ar ? "المشغول" : "Occupied", "text-center")}
      {H(
        "vacantBedsCount",
        ar ? "الأسرة الشاغرة" : "Vacant Beds",
        "text-center",
      )}
      {H("availableBedsText", ar ? "أرقام الأسرة المتاحة" : "Available Beds")}
      {H("genderPolicy", ar ? "سياسة الجنس" : "Gender Policy")}
      {H("status", ar ? "حالة الغرفة" : "Room Status")}
    </>
  );
}

export function VacantRoomsCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell className="text-xs">
        {row.buildingName} • {row.floorName}
      </TableCell>
      <TableCell className="font-bold text-base text-primary">
        {row.roomNumber}
      </TableCell>
      <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
      <TableCell className="text-center font-semibold">
        {row.capacity}
      </TableCell>
      <TableCell className="text-center text-muted-foreground">
        {row.currentOccupancy}
      </TableCell>
      <TableCell className="text-center">
        <Badge className="bg-emerald-600 text-white font-bold text-xs">
          {row.vacantBedsCount} {ar ? "سرير شاغر" : "beds free"}
        </Badge>
      </TableCell>
      <TableCell>
        <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
          {row.availableBedsText}
        </span>
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

export function DepartmentOccupancyHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("department", ar ? "القسم الإداري" : "Department")}
      {H(
        "residentCount",
        ar ? "إجمالي المقيمين" : "Total Residents",
        "text-center",
      )}
      {H("maleCount", ar ? "ذكور" : "Males", "text-center")}
      {H("femaleCount", ar ? "إناث" : "Females", "text-center")}
      {H("roomsCount", ar ? "الغرف المشغولة" : "Rooms Occupied", "text-center")}
      {H(
        "shareOfHousing",
        ar ? "نسبة الإشغال بالسكن" : "Share of Housing",
        "text-center",
      )}
      {H("buildingsList", ar ? "المباني المسكن بها" : "Assigned Buildings")}
    </>
  );
}

export function DepartmentOccupancyCells(c: ReportRowCtx) {
  const { row } = c;
  return (
    <>
      <TableCell className="font-bold text-foreground">
        {row.department}
      </TableCell>
      <TableCell className="text-center">
        <Badge variant="secondary" className="text-xs font-bold px-2.5 py-0.5">
          {row.residentCount}
        </Badge>
      </TableCell>
      <TableCell className="text-center font-mono text-xs text-blue-600 font-semibold">
        {row.maleCount}
      </TableCell>
      <TableCell className="text-center font-mono text-xs text-pink-600 font-semibold">
        {row.femaleCount}
      </TableCell>
      <TableCell className="text-center font-mono text-xs font-semibold">
        {row.roomsCount}
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold"
        >
          {row.shareOfHousing}
        </Badge>
      </TableCell>
      <TableCell
        className="text-xs text-muted-foreground max-w-[250px] truncate"
        title={row.buildingsList}
      >
        {row.buildingsList}
      </TableCell>
    </>
  );
}
