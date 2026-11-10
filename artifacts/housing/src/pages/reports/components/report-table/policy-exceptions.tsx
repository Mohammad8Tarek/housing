// Report table columns — policy exceptions: header + row cells per report.
import { formatDate } from "@/lib/date-utils";
import { TableCell } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle, User } from "lucide-react";
import type { ReportTableCtx, ReportRowCtx } from "./context";

export function PolicyExceptionsHeader(c: ReportTableCtx) {
  const { ar, H, isVis } = c;
  return (
    <>
      {isVis("profileName") &&
        H("profileName", ar ? "اسم المقيم" : "Resident Name")}
      {isVis("profileCode") &&
        H("profileCode", ar ? "كود الموظف" : "Employee Code")}
      {isVis("nationalId") &&
        H("nationalId", ar ? "الرقم القومي" : "National ID")}
      {isVis("jobLevel") && H("jobLevel", ar ? "الدرجة الوظيفية" : "Job Level")}
      {isVis("department") && H("department", ar ? "القسم" : "Department")}
      {isVis("roomNumber") && H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
      {isVis("buildingName") && H("buildingName", ar ? "المبنى" : "Building")}
      {isVis("roomCapacity") &&
        H("roomCapacity", ar ? "سعة الغرفة" : "Capacity", "text-center")}
      {isVis("currentOccupancy") &&
        H(
          "currentOccupancy",
          ar ? "الإشغال الحالي" : "Occupancy",
          "text-center",
        )}
      {isVis("violationType") &&
        H("violationType", ar ? "نوع المخالفة" : "Violation Type")}
      {isVis("violationDetails") &&
        H(
          "violationDetails",
          ar ? "تفاصيل المخالفة والسياسة" : "Policy Details",
        )}
      {isVis("requestDate") &&
        H(
          "requestDate",
          ar ? "تاريخ الاستثناء" : "Exception Date",
          "text-center",
        )}
      {isVis("severity") &&
        H("severity", ar ? "مستوى الأهمية" : "Severity", "text-center")}
      {isVis("approvalStatus") &&
        H(
          "approvalStatus",
          ar ? "حالة الاعتماد" : "Approval Status",
          "text-center",
        )}
      {isVis("resolvedAt") &&
        H(
          "resolvedAt",
          ar ? "تاريخ المعالجة والتصحيح" : "Resolution Date",
          "text-center",
        )}
      {isVis("resolutionDetails") &&
        H(
          "resolutionDetails",
          ar ? "إجراء المعالجة والتصحيح" : "Resolution Action",
        )}
      {isVis("approvedBy") &&
        H("approvedBy", ar ? "المعتمد للطلب" : "Approved By")}
      {isVis("overrideReason") &&
        H("overrideReason", ar ? "سبب ومسوغات الاستثناء" : "Override Reason")}
    </>
  );
}

export function PolicyExceptionsCells(c: ReportRowCtx) {
  const { ar, isVis, row } = c;
  return (
    <>
      {isVis("profileName") && (
        <TableCell className="font-semibold text-foreground">
          <div className="flex items-center gap-1.5">
            <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
            <span>{row.profileName || "—"}</span>
          </div>
        </TableCell>
      )}
      {isVis("profileCode") && (
        <TableCell className="font-mono text-xs text-muted-foreground">
          {row.profileCode || "—"}
        </TableCell>
      )}
      {isVis("nationalId") && (
        <TableCell className="font-mono text-xs">
          {row.nationalId || "—"}
        </TableCell>
      )}
      {isVis("jobLevel") && (
        <TableCell className="text-xs font-medium">
          {row.jobLevel || "—"}
        </TableCell>
      )}
      {isVis("department") && (
        <TableCell className="text-xs">
          <Badge variant="outline" className="text-[11px] font-normal">
            {row.department || "—"}
          </Badge>
        </TableCell>
      )}
      {isVis("roomNumber") && (
        <TableCell className="font-semibold text-xs">
          {row.roomNumber || "—"}
        </TableCell>
      )}
      {isVis("buildingName") && (
        <TableCell className="text-xs text-muted-foreground">
          {row.buildingName || "—"}
        </TableCell>
      )}
      {isVis("roomCapacity") && (
        <TableCell className="text-center font-mono text-xs">
          {row.roomCapacity ?? "—"}
        </TableCell>
      )}
      {isVis("currentOccupancy") && (
        <TableCell className="text-center font-mono text-xs">
          {row.currentOccupancy ?? "—"}
        </TableCell>
      )}
      {isVis("violationType") && (
        <TableCell>
          <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
            <span>{row.violationType || "—"}</span>
          </div>
        </TableCell>
      )}
      {isVis("violationDetails") && (
        <TableCell
          className="text-xs text-muted-foreground max-w-[240px] truncate"
          title={row.violationDetails}
        >
          {row.violationDetails || "—"}
        </TableCell>
      )}
      {isVis("requestDate") && (
        <TableCell className="text-center font-mono text-xs text-muted-foreground whitespace-nowrap">
          {row.requestDate ? formatDate(row.requestDate) : "—"}
        </TableCell>
      )}
      {isVis("severity") && (
        <TableCell className="text-center">
          <Badge
            variant="outline"
            className={
              row.severity === "حرجة" || row.severity === "Critical"
                ? "bg-rose-50 text-rose-700 border-rose-300 text-xs font-bold dark:bg-rose-950/40 dark:text-rose-300"
                : row.severity === "مرتفعة" || row.severity === "High"
                  ? "bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold dark:bg-amber-950/40 dark:text-amber-300"
                  : "bg-blue-50 text-blue-700 border-blue-300 text-xs dark:bg-blue-950/40 dark:text-blue-300"
            }
          >
            {row.severity}
          </Badge>
        </TableCell>
      )}
      {isVis("approvalStatus") && (
        <TableCell className="text-center">
          <Badge
            variant="secondary"
            className={
              row.isResolved
                ? "bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-semibold dark:bg-emerald-950/40 dark:text-emerald-300"
                : row.isApproved ||
                    row.approvalStatus?.includes("معتمد") ||
                    row.approvalStatus?.includes("Approved")
                  ? "bg-blue-50 text-blue-700 border-blue-300 text-xs font-semibold dark:bg-blue-950/40 dark:text-blue-300"
                  : "bg-rose-50 text-rose-700 border-rose-300 text-xs font-semibold dark:bg-rose-950/40 dark:text-rose-300"
            }
          >
            {row.approvalStatus || (ar ? "قيد المراجعة" : "Pending")}
          </Badge>
        </TableCell>
      )}
      {isVis("resolvedAt") && (
        <TableCell className="text-center font-mono text-xs text-muted-foreground whitespace-nowrap">
          {row.resolvedAt ? formatDate(row.resolvedAt) : "—"}
        </TableCell>
      )}
      {isVis("resolutionDetails") && (
        <TableCell
          className="text-xs max-w-[220px] truncate"
          title={row.resolutionDetails}
        >
          {row.resolutionDetails ? (
            <span className="text-emerald-700 dark:text-emerald-400 font-medium">
              {row.resolutionDetails}
            </span>
          ) : (
            <span className="text-muted-foreground">—</span>
          )}
        </TableCell>
      )}
      {isVis("approvedBy") && (
        <TableCell className="text-xs font-medium">
          {row.approvedBy || "—"}
        </TableCell>
      )}
      {isVis("overrideReason") && (
        <TableCell
          className="text-xs text-muted-foreground max-w-[200px] truncate"
          title={row.overrideReason}
        >
          {row.overrideReason || "—"}
        </TableCell>
      )}
    </>
  );
}
