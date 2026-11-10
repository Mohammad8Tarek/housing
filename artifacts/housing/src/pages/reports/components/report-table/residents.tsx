// Report table columns — residents: header + row cells per report.
import { formatDate } from "@/lib/date-utils";
import { TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Bed } from "lucide-react";
import type { ReportTableCtx, ReportRowCtx } from "./context";

export function ProfilesHeader(c: ReportTableCtx) {
  const { ar, H, isVis } = c;
  return (
    <>
      {isVis("profileCode") &&
        H("profileCode", ar ? "كود الموظف" : "Employee Code")}
      {isVis("fullName") && H("fullName", ar ? "اسم الموظف" : "Employee Name")}
      {isVis("department") && H("department", ar ? "القسم" : "Department")}
      {isVis("jobTitle") && H("jobTitle", ar ? "الوظيفة" : "Job Title")}
      {isVis("level") && H("level", ar ? "الدرجة" : "Level", "text-center")}
      {isVis("assignedRoom") &&
        H("assignedRoom", ar ? "السكن الحالي" : "Housing")}
      {isVis("employmentType") &&
        H("employmentType", ar ? "نوع التوظيف" : "Employment")}
      {isVis("companyName") &&
        H("companyName", ar ? "الشركة / جهة العمل" : "Company")}
      {isVis("phone") && H("phone", ar ? "الهاتف" : "Phone")}
      {isVis("nationalId") &&
        H("nationalId", ar ? "الرقم القومي" : "National ID")}
      {isVis("nationality") && H("nationality", ar ? "الجنسية" : "Nationality")}
      {isVis("gender") && H("gender", ar ? "الجنس" : "Gender", "text-center")}
      {isVis("hireDate") && H("hireDate", ar ? "تاريخ التعيين" : "Hire Date")}
      {isVis("contractEndDate") &&
        H("contractEndDate", ar ? "انتهاء العقد" : "Contract End")}
      {isVis("status") &&
        H("status", ar ? "الحالة بالسكن" : "Status", "text-center")}
      {isVis("dateOfBirth") &&
        H("dateOfBirth", ar ? "تاريخ الميلاد" : "Date of Birth")}
      {isVis("address") && H("address", ar ? "العنوان" : "Address")}
      {isVis("email") && H("email", ar ? "البريد الإلكتروني" : "Email")}
      {isVis("emergencyContact") &&
        H("emergencyContact", ar ? "هاتف الطوارئ" : "Emergency Contact")}
    </>
  );
}

export function ProfilesCells(c: ReportRowCtx) {
  const { ar, isVis, row } = c;
  return (
    <>
      {isVis("profileCode") && (
        <TableCell className="font-mono text-xs font-bold text-primary">
          {row.profileCode}
        </TableCell>
      )}
      {isVis("fullName") && (
        <TableCell>
          <div className="font-bold text-sm text-foreground">
            {row.fullName}
          </div>
        </TableCell>
      )}
      {isVis("department") && (
        <TableCell className="text-xs font-medium">{row.department}</TableCell>
      )}
      {isVis("jobTitle") && (
        <TableCell className="text-xs text-muted-foreground">
          {row.jobTitle}
        </TableCell>
      )}
      {isVis("level") && (
        <TableCell className="text-xs text-center font-semibold">
          {row.level}
        </TableCell>
      )}
      {isVis("assignedRoom") && (
        <TableCell>
          {row.hasRoom ? (
            <span className="inline-flex items-center text-xs font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20">
              {row.assignedRoom}
            </span>
          ) : (
            <span className="inline-flex items-center text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
              {ar ? "غير مسكّن" : "Unassigned"}
            </span>
          )}
        </TableCell>
      )}
      {isVis("employmentType") && (
        <TableCell>
          {row.employmentType === "THIRD_PARTY" ? (
            <Badge
              variant="outline"
              className="bg-purple-50 text-purple-700 border-purple-200 text-xs"
            >
              {ar ? "طرف ثالث" : "Third Party"}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-blue-50 text-blue-700 border-blue-200 text-xs"
            >
              {ar ? "داخلي" : "Internal"}
            </Badge>
          )}
        </TableCell>
      )}
      {isVis("companyName") && (
        <TableCell className="text-xs text-muted-foreground">
          {row.companyName}
        </TableCell>
      )}
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
        <TableCell className="text-xs text-center">
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
      {isVis("hireDate") && (
        <TableCell className="text-xs font-mono">{row.hireDate}</TableCell>
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
      {isVis("status") && (
        <TableCell className="text-center">
          {row.rawStatus === "VACATION" ? (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold"
            >
              {ar ? "في إجازة" : "On Vacation"}
            </Badge>
          ) : row.rawStatus === "ACTIVE" ? (
            <Badge
              variant="outline"
              className="bg-green-50 text-green-700 border-green-200 text-xs font-semibold"
            >
              {ar ? "مقيم بالسكن" : "In-House"}
            </Badge>
          ) : row.rawStatus === "UNASSIGNED" ? (
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-700 border-slate-300 text-xs font-medium"
            >
              {ar ? "غير مسكّن" : "Unassigned"}
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs">
              {row.status}
            </Badge>
          )}
        </TableCell>
      )}
      {isVis("dateOfBirth") && (
        <TableCell className="text-xs font-mono">{row.dateOfBirth}</TableCell>
      )}
      {isVis("address") && (
        <TableCell
          className="text-xs max-w-[180px] truncate"
          title={row.address}
        >
          {row.address}
        </TableCell>
      )}
      {isVis("email") && (
        <TableCell className="text-xs font-mono">{row.email}</TableCell>
      )}
      {isVis("emergencyContact") && (
        <TableCell className="text-xs font-mono">
          {row.emergencyContact}
        </TableCell>
      )}
    </>
  );
}

export function ExpiringContractsHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("fullName", ar ? "الموظف" : "Employee")}
      {H("department", ar ? "القسم والوظيفة" : "Dept & Title")}
      {H("assignedRoom", ar ? "السكن الحالي" : "Current Housing")}
      {H("phone", ar ? "الهاتف" : "Phone")}
      {H("contractEndDate", ar ? "تاريخ انتهاء العقد" : "Contract End Date")}
      {H(
        "daysRemaining",
        ar ? "الأيام المتبقية" : "Days Remaining",
        "text-center",
      )}
      {H("expStatus", ar ? "حالة العقد" : "Contract Status")}
    </>
  );
}

export function ExpiringContractsCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell>
        <div>
          <p className="font-bold text-sm text-foreground">{row.fullName}</p>
          <p className="text-xs text-muted-foreground font-mono">
            {row.profileCode}
          </p>
        </div>
      </TableCell>
      <TableCell>
        <p className="text-xs font-medium">{row.department}</p>
        <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
      </TableCell>
      <TableCell className="text-xs font-medium">{row.assignedRoom}</TableCell>
      <TableCell className="text-xs font-mono">{row.phone}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className="bg-amber-50 text-amber-900 border-amber-400 font-mono font-bold text-xs"
        >
          {row.contractEndDate}
        </Badge>
      </TableCell>
      <TableCell className="text-center">
        <span
          className={`font-bold text-xs px-2 py-1 rounded-full ${
            row.daysRemaining < 0
              ? "bg-rose-100 text-rose-800"
              : row.daysRemaining <= 30
                ? "bg-amber-100 text-amber-800"
                : "bg-emerald-100 text-emerald-800"
          }`}
        >
          {row.daysRemaining < 0
            ? ar
              ? `منتهي منذ ${Math.abs(row.daysRemaining)} يوم`
              : `Expired ${Math.abs(row.daysRemaining)}d ago`
            : ar
              ? `متبقي ${row.daysRemaining} يوم`
              : `${row.daysRemaining} days left`}
        </span>
      </TableCell>
      <TableCell className="text-xs font-medium">{row.expStatus}</TableCell>
    </>
  );
}

export function ReservationsHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("guestName", ar ? "اسم الضيف" : "Guest Name")}
      {H("nationalId", ar ? "الرقم القومي والهاتف" : "ID & Phone")}
      {H("department", ar ? "القسم والوظيفة" : "Dept & Title")}
      {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
      {H("roomNumber", ar ? "الغرفة المحجوزة" : "Reserved Room")}
      {H("checkInDate", ar ? "تاريخ الوصول" : "Arrival Date")}
      {H("checkOutDate", ar ? "تاريخ المغادرة" : "Check-Out")}
      {H("status", ar ? "الحالة" : "Status")}
    </>
  );
}

export function ReservationsCells(c: ReportRowCtx) {
  const { ar, row } = c;
  return (
    <>
      <TableCell className="font-bold text-sm">{row.guestName}</TableCell>
      <TableCell className="text-xs font-mono">
        {row.nationalId} • {row.phone}
      </TableCell>
      <TableCell className="text-xs">
        {row.department} • {row.jobTitle}
      </TableCell>
      <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
      <TableCell className="text-xs font-semibold text-primary">
        {row.roomNumber}
      </TableCell>
      <TableCell className="text-xs">{row.checkInDate}</TableCell>
      <TableCell className="text-xs">{row.checkOutDate}</TableCell>
      <TableCell>
        <Badge
          variant="outline"
          className={
            row.status === "UPCOMING"
              ? "bg-amber-50 text-amber-800 border-amber-300"
              : row.status === "CHECKED_IN"
                ? "bg-green-50 text-green-800 border-green-300"
                : "bg-muted text-muted-foreground"
          }
        >
          {row.status === "UPCOMING"
            ? ar
              ? "حجز مستقبلي"
              : "Future"
            : row.status}
        </Badge>
      </TableCell>
    </>
  );
}

export function HostingsHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("hostEmployee", ar ? "الموظف المستضيف" : "Host Employee")}
      {H("guestName", ar ? "اسم الضيف والصلة" : "Guest & Relation")}
      {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
      {H("checkInDate", ar ? "من تاريخ" : "Check-In")}
      {H("checkOutDate", ar ? "إلى تاريخ" : "Check-Out")}
      {H("dailyRate", ar ? "سعر اليوم" : "Daily Rate")}
      {H("totalAmount", ar ? "الإجمالي" : "Total Fee")}
      {H("status", ar ? "الحالة" : "Status")}
    </>
  );
}

export function HostingsCells(c: ReportRowCtx) {
  const { row } = c;
  return (
    <>
      <TableCell>
        <p className="font-bold text-xs">{row.hostEmployee}</p>
        <p className="text-[11px] text-muted-foreground">{row.hostDept}</p>
      </TableCell>
      <TableCell>
        <p className="font-medium text-xs">{row.guestName}</p>
        <p className="text-[11px] text-muted-foreground">
          {row.relation} • {row.guestId}
        </p>
      </TableCell>
      <TableCell className="font-bold text-primary text-xs">
        {row.roomNumber}
      </TableCell>
      <TableCell className="text-xs">{row.checkInDate}</TableCell>
      <TableCell className="text-xs">{row.checkOutDate}</TableCell>
      <TableCell className="text-xs">{row.dailyRate}</TableCell>
      <TableCell className="text-xs font-bold text-emerald-600">
        {row.totalAmount}
      </TableCell>
      <TableCell>
        <Badge variant="outline" className="text-xs capitalize">
          {row.status}
        </Badge>
      </TableCell>
    </>
  );
}

export function VacationsHeader(c: ReportTableCtx) {
  const { ar, H, isVis } = c;
  return (
    <>
      {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Code")}
      {isVis("fullName") &&
        H("fullName", ar ? "الاسم بالكامل" : "Employee Name")}
      {isVis("department") && H("department", ar ? "القسم" : "Department")}
      {isVis("jobTitle") && H("jobTitle", ar ? "الوظيفة" : "Job Title")}
      {isVis("buildingName") && H("buildingName", ar ? "المبنى" : "Building")}
      {isVis("housingInfo") &&
        H("housingInfo", ar ? "الغرفة والسرير" : "Room & Bed")}
      {isVis("startDate") &&
        H("startDate", ar ? "بداية الإجازة" : "Start Date")}
      {isVis("endDate") &&
        H("endDate", ar ? "العودة المتوقعة" : "Expected Return")}
      {isVis("actualReturnDate") &&
        H("actualReturnDate", ar ? "العودة الفعلية" : "Actual Return")}
      {isVis("duration") &&
        H("duration", ar ? "المدة (أيام)" : "Duration", "text-center")}
      {isVis("status") &&
        H("status", ar ? "حالة الإجازة" : "Status", "text-center")}
      {isVis("notes") && H("notes", ar ? "ملاحظات" : "Notes")}
    </>
  );
}

export function VacationsCells(c: ReportRowCtx) {
  const { ar, isVis, row } = c;
  return (
    <>
      {isVis("profileCode") && (
        <TableCell className="font-mono text-xs font-semibold text-primary">
          {row.profileCode || "—"}
        </TableCell>
      )}
      {isVis("fullName") && (
        <TableCell className="font-semibold text-foreground">
          <div>{row.fullName}</div>
          {row.phone && (
            <div className="text-[11px] text-muted-foreground">{row.phone}</div>
          )}
        </TableCell>
      )}
      {isVis("department") && (
        <TableCell className="text-xs text-muted-foreground font-medium">
          {row.department || "—"}
        </TableCell>
      )}
      {isVis("jobTitle") && (
        <TableCell className="text-xs text-muted-foreground">
          {row.jobTitle || "—"}
        </TableCell>
      )}
      {isVis("buildingName") && (
        <TableCell className="text-xs text-muted-foreground">
          {row.buildingName || "—"}
        </TableCell>
      )}
      {isVis("housingInfo") && (
        <TableCell>
          <div className="flex items-center gap-1.5 text-xs">
            <Bed className="w-3.5 h-3.5 text-blue-500 shrink-0" />
            <span className="font-semibold">{row.roomNumber || "—"}</span>
            {row.bedNumber && row.bedNumber !== "—" && (
              <span className="text-muted-foreground text-[11px]">
                ({ar ? `سرير ${row.bedNumber}` : `Bed ${row.bedNumber}`})
              </span>
            )}
          </div>
        </TableCell>
      )}
      {isVis("startDate") && (
        <TableCell className="text-xs font-mono font-medium">
          {row.startDate ? formatDate(row.startDate) : "—"}
        </TableCell>
      )}
      {isVis("endDate") && (
        <TableCell className="text-xs font-mono">
          {row.endDate ? formatDate(row.endDate) : "—"}
        </TableCell>
      )}
      {isVis("actualReturnDate") && (
        <TableCell className="text-xs font-mono font-medium">
          {row.actualReturnDate && row.actualReturnDate !== "—" ? (
            <span className="text-emerald-600 font-semibold">
              {formatDate(row.actualReturnDate)}
            </span>
          ) : (
            <span className="text-muted-foreground/60">—</span>
          )}
        </TableCell>
      )}
      {isVis("duration") && (
        <TableCell className="text-center text-xs font-mono font-semibold">
          {row.duration ? `${row.duration} ${ar ? "يوم" : "d"}` : "—"}
        </TableCell>
      )}
      {isVis("status") && (
        <TableCell className="text-center">
          <Badge
            variant="outline"
            className={
              row.statusKey === "COMPLETED"
                ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                : row.statusKey === "OVERDUE"
                  ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold animate-pulse dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                  : "bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
            }
          >
            {row.status}
          </Badge>
        </TableCell>
      )}
      {isVis("notes") && (
        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
          {row.notes || "—"}
        </TableCell>
      )}
    </>
  );
}
