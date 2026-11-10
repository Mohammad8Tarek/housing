// Report table columns — security: header + row cells per report.
import { TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import type { ReportTableCtx, ReportRowCtx } from "./context";

export function GateLogsHeader(c: ReportTableCtx) {
  const { ar, H } = c;
  return (
    <>
      {H("scannedAt", ar ? "وقت المسح" : "Scan Time")}
      {H("action", ar ? "الحركة" : "Action / Direction", "text-center")}
      {H("profileName", ar ? "الموظف / النزيل" : "Name & ID")}
      {H("department", ar ? "القسم" : "Department")}
      {H("roomNumber", ar ? "الغرفة والمبنى" : "Room & Building")}
      {H("guardName", ar ? "مسؤول الأمن" : "Security Officer")}
      {H("status", ar ? "حالة التصريح" : "Pass Status", "text-center")}
      {H("notes", ar ? "ملاحظات" : "Notes")}
    </>
  );
}

export function GateLogsCells(c: ReportRowCtx) {
  const { row } = c;
  return (
    <>
      <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
        {row.scannedAt}
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={
            row.direction === "exit" || row.direction === "OUT"
              ? "bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold"
              : "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold"
          }
        >
          {row.action}
        </Badge>
      </TableCell>
      <TableCell>
        <div className="font-semibold text-foreground">{row.profileName}</div>
        <div className="text-[11px] text-muted-foreground font-mono">
          {row.profileCode}
        </div>
      </TableCell>
      <TableCell className="text-xs">{row.department}</TableCell>
      <TableCell>
        <span className="font-semibold text-xs">{row.roomNumber}</span>
        <span className="text-[11px] text-muted-foreground ms-1">
          ({row.buildingName})
        </span>
      </TableCell>
      <TableCell className="text-xs text-muted-foreground">
        {row.guardName}
      </TableCell>
      <TableCell className="text-center">
        <Badge
          variant="outline"
          className={
            row.isValid
              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
              : "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
          }
        >
          {row.status}
        </Badge>
      </TableCell>
      <TableCell
        className="text-xs text-muted-foreground max-w-[160px] truncate"
        title={row.notes}
      >
        {row.notes}
      </TableCell>
    </>
  );
}

export function PoliceReportHeader(c: ReportTableCtx) {
  const { ar, H, isVis } = c;
  return (
    <>
      {isVis("profileCode") &&
        H(
          "profileCode",
          ar ? "كود الموظف" : "Code",
          "min-w-[100px] text-center whitespace-nowrap",
        )}
      {isVis("fullName") &&
        H(
          "fullName",
          ar ? "الاسم بالكامل" : "Full Name",
          "min-w-[210px] whitespace-nowrap",
        )}
      {isVis("nationalId") &&
        H(
          "nationalId",
          ar ? "الرقم القومي" : "National ID",
          "min-w-[160px] text-center whitespace-nowrap",
        )}
      {isVis("nationality") &&
        H(
          "nationality",
          ar ? "الجنسية" : "Nationality",
          "min-w-[110px] whitespace-nowrap",
        )}
      {isVis("dateOfBirth") &&
        H(
          "dateOfBirth",
          ar ? "تاريخ الميلاد" : "Date of Birth",
          "min-w-[115px] text-center whitespace-nowrap",
        )}
      {isVis("gender") &&
        H(
          "gender",
          ar ? "الجنس" : "Gender",
          "min-w-[80px] text-center whitespace-nowrap",
        )}
      {isVis("jobTitle") &&
        H(
          "jobTitle",
          ar ? "الوظيفة" : "Job Title",
          "min-w-[150px] whitespace-nowrap",
        )}
      {isVis("department") &&
        H(
          "department",
          ar ? "القسم" : "Department",
          "min-w-[140px] whitespace-nowrap",
        )}
      {isVis("level") &&
        H(
          "level",
          ar ? "الدرجة" : "Level",
          "min-w-[80px] text-center whitespace-nowrap",
        )}
      {isVis("employmentType") &&
        H(
          "employmentType",
          ar ? "نوع التوظيف" : "Employment",
          "min-w-[120px] text-center whitespace-nowrap",
        )}
      {isVis("companyName") &&
        H(
          "companyName",
          ar ? "الشركة" : "Company",
          "min-w-[140px] whitespace-nowrap",
        )}
      {isVis("address") &&
        H(
          "address",
          ar ? "العنوان بالبطاقة" : "Address",
          "min-w-[220px] whitespace-nowrap",
        )}
      {isVis("phone") &&
        H(
          "phone",
          ar ? "الهاتف" : "Phone",
          "min-w-[130px] text-center whitespace-nowrap",
        )}
      {isVis("buildingName") &&
        H(
          "buildingName",
          ar ? "المبنى" : "Building",
          "min-w-[120px] whitespace-nowrap",
        )}
      {isVis("floorName") &&
        H(
          "floorName",
          ar ? "الطابق" : "Floor",
          "min-w-[90px] text-center whitespace-nowrap",
        )}
      {isVis("roomNumber") &&
        H(
          "roomNumber",
          ar ? "رقم الغرفة" : "Room No",
          "min-w-[100px] text-center whitespace-nowrap",
        )}
      {isVis("bedNumber") &&
        H(
          "bedNumber",
          ar ? "السرير" : "Bed No",
          "min-w-[90px] text-center whitespace-nowrap",
        )}
      {isVis("roomType") &&
        H(
          "roomType",
          ar ? "نوع الغرفة" : "Room Type",
          "min-w-[110px] whitespace-nowrap",
        )}
      {isVis("checkInDate") &&
        H(
          "checkInDate",
          ar ? "تاريخ التسكين" : "Check-In",
          "min-w-[115px] text-center whitespace-nowrap",
        )}
      {isVis("hireDate") &&
        H(
          "hireDate",
          ar ? "تاريخ التعيين" : "Hire Date",
          "min-w-[115px] text-center whitespace-nowrap",
        )}
      {isVis("contractEndDate") &&
        H(
          "contractEndDate",
          ar ? "انتهاء العقد" : "Contract End",
          "min-w-[115px] text-center whitespace-nowrap",
        )}
      {isVis("email") &&
        H(
          "email",
          ar ? "البريد الإلكتروني" : "Email",
          "min-w-[160px] whitespace-nowrap",
        )}
      {isVis("emergencyContact") &&
        H(
          "emergencyContact",
          ar ? "هاتف الطوارئ" : "Emergency Contact",
          "min-w-[135px] text-center whitespace-nowrap",
        )}
      {isVis("status") &&
        H(
          "status",
          ar ? "الحالة بالسكن" : "Status",
          "min-w-[115px] text-center whitespace-nowrap",
        )}
    </>
  );
}

export function PoliceReportCells(c: ReportRowCtx) {
  const { ar, isVis, row } = c;
  return (
    <>
      {isVis("profileCode") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono font-bold text-primary text-center">
          {row.profileCode}
        </TableCell>
      )}
      {isVis("fullName") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-bold text-foreground">
          {row.fullName}
        </TableCell>
      )}
      {isVis("nationalId") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono tracking-wider font-semibold text-slate-800 dark:text-slate-200 text-center">
          {row.nationalId}
        </TableCell>
      )}
      {isVis("nationality") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs">
          {row.nationality}
        </TableCell>
      )}
      {isVis("dateOfBirth") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono text-center">
          {row.dateOfBirth}
        </TableCell>
      )}
      {isVis("gender") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-center">
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
      {isVis("jobTitle") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-medium">
          {row.jobTitle}
        </TableCell>
      )}
      {isVis("department") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
          {row.department}
        </TableCell>
      )}
      {isVis("level") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-center">
          {row.level}
        </TableCell>
      )}
      {isVis("employmentType") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-center">
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
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
          {row.companyName}
        </TableCell>
      )}
      {isVis("address") && (
        <TableCell
          className="whitespace-nowrap px-3 py-2 text-xs max-w-[260px] truncate"
          title={row.address}
        >
          {row.address}
        </TableCell>
      )}
      {isVis("phone") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono text-center">
          {row.phone}
        </TableCell>
      )}
      {isVis("buildingName") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground">
          {row.buildingName}
        </TableCell>
      )}
      {isVis("floorName") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-muted-foreground text-center">
          {row.floorName}
        </TableCell>
      )}
      {isVis("roomNumber") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-bold text-primary text-center">
          {row.roomNumber}
        </TableCell>
      )}
      {isVis("bedNumber") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs text-center">
          {row.bedNumber !== "—" ? (
            <Badge
              variant="secondary"
              className="text-[11px] h-5 px-1.5 font-medium"
            >
              {ar ? `سرير ${row.bedNumber}` : `Bed ${row.bedNumber}`}
            </Badge>
          ) : (
            "—"
          )}
        </TableCell>
      )}
      {isVis("roomType") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs capitalize">
          {row.roomType}
        </TableCell>
      )}
      {isVis("checkInDate") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono text-center">
          {row.checkInDate}
        </TableCell>
      )}
      {isVis("hireDate") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono text-center">
          {row.hireDate}
        </TableCell>
      )}
      {isVis("contractEndDate") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono text-center">
          {row.contractEndDate}
        </TableCell>
      )}
      {isVis("email") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono">
          {row.email}
        </TableCell>
      )}
      {isVis("emergencyContact") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-xs font-mono text-center">
          {row.emergencyContact}
        </TableCell>
      )}
      {isVis("status") && (
        <TableCell className="whitespace-nowrap px-3 py-2 text-center">
          {row.status === "VACATION" || row.status === "في إجازة" ? (
            <Badge
              variant="outline"
              className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-semibold"
            >
              {ar ? "في إجازة" : "Vacation"}
            </Badge>
          ) : row.status === "CHECKED_OUT" || row.status === "مغادر" ? (
            <Badge
              variant="outline"
              className="bg-slate-100 text-slate-700 border-slate-300 text-xs"
            >
              {ar ? "مغادر" : "Checked Out"}
            </Badge>
          ) : (
            <Badge
              variant="outline"
              className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-medium"
            >
              {ar ? "مقيم بالسكن" : "In-House"}
            </Badge>
          )}
        </TableCell>
      )}
    </>
  );
}
