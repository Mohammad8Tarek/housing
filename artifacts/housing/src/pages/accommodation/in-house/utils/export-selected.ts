import { exportExcel } from "@/pages/reports/utils/export";
import { printLuxuryReport } from "@/lib/pdf-utils";
import { formatDate } from "@/lib/date-utils";
import { formatNationality } from "@/lib/countries";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";
import { buildProfileObj, type LookupMaps } from "./profile-helpers";

type ExportContext = LookupMaps & {
  assignments: any[];
  selectedRows: Set<number>;
  ar: boolean;
};

export function exportSelectedExcel({
  assignments,
  selectedRows,
  ar,
  empMap,
  roomMap,
  buildingMap,
  floorMap,
}: ExportContext) {
  const target = assignments.filter((a) => selectedRows.has(a.id));
  if (target.length === 0) return;
  const rows = target.map((a: any) => {
    const emp = empMap[a.profileId];
    const room = roomMap[a.roomId];
    const bName = a.buildingName || (room ? buildingMap[room.buildingId] : "");
    const fNum = a.floorNumber ?? (room ? floorMap[room.floorId]?.number : "");
    const rNum = a.roomNumber || room?.roomNumber || a.roomId || "";

    const profileObj = buildProfileObj(a, emp);

    const fullName =
      getProfileDisplayName(profileObj, ar) || (ar ? "بدون اسم" : "Unknown");
    const code = a.profileCode || emp?.profileId || a.profileId;
    const dept = getProfileDisplayDepartment(profileObj, ar);
    const job = getProfileDisplayJobTitle(profileObj, ar);
    const nat = formatNationality(
      a.profileNationality || (emp as any)?.nationality,
      ar,
    );

    if (ar) {
      return {
        "كود الموظف": code,
        الاسم: fullName,
        "رقم الغرفة": rNum,
        المبنى: bName,
        الطابق: fNum != null ? fNum : "",
        السرير:
          a.bedNumber || a.isEntireRoom
            ? `سرير ${a.bedNumber || 1}${a.isEntireRoom ? " (غرفة كاملة)" : ""}`
            : "",
        "تاريخ التسكين": formatDate(a.checkInDate, ""),
        "تاريخ المغادرة المتوقع": formatDate(a.expectedCheckOutDate, ""),
        الجنسية: nat,
        الهاتف: emp?.phone || (a as any).phone || "",
        الوظيفة: job,
        القسم: dept,
        الحالة:
          (a as any).profileStatus === "VACATION" || emp?.status === "VACATION"
            ? "في إجازة"
            : (a as any).profileStatus === "LEFT" || emp?.status === "LEFT"
              ? "تمت المغادرة"
              : "مقيم بالسكن",
      };
    }

    return {
      Code: code,
      Name: fullName,
      "Room Number": rNum,
      Building: bName,
      Floor: fNum != null ? fNum : "",
      Bed:
        a.bedNumber || a.isEntireRoom
          ? `Bed ${a.bedNumber || 1}${a.isEntireRoom ? " (Entire Room)" : ""}`
          : "",
      "Check-In Date": formatDate(a.checkInDate, ""),
      "Expected Check-Out": formatDate(a.expectedCheckOutDate, ""),
      Nationality: nat,
      Phone: emp?.phone || (a as any).phone || "",
      "Job Title": job,
      Department: dept,
      Status: (a as any).profileStatus || emp?.status || a.status || "",
    };
  });
  exportExcel(ar ? "المقيمون_بالسكن" : "InHouse_Selected", rows, {
    sheetName: ar ? "المقيمون بالسكن" : "In-House",
    orientation: "landscape",
  });
}

export async function exportSelectedPdf({
  assignments,
  selectedRows,
  ar,
  empMap,
  roomMap,
  buildingMap,
  floorMap,
  allProperties,
  numericPropertyId,
  settings,
}: ExportContext & {
  allProperties: any[];
  numericPropertyId: number | undefined;
  settings: any;
}) {
  const target = assignments.filter((a) => selectedRows.has(a.id));
  if (target.length === 0) return;
  const rows = target.map((a: any) => {
    const emp = empMap[a.profileId];
    const room = roomMap[a.roomId];
    const bName = a.buildingName || (room ? buildingMap[room.buildingId] : "");
    const fNum = a.floorNumber ?? (room ? floorMap[room.floorId]?.number : "");
    const rNum = a.roomNumber || room?.roomNumber || a.roomId || "";

    const profileObj = buildProfileObj(a, emp);

    const fullName =
      getProfileDisplayName(profileObj, ar) || (ar ? "بدون اسم" : "Unknown");
    const code = a.profileCode || emp?.profileId || a.profileId;
    const dept = getProfileDisplayDepartment(profileObj, ar);
    const job = getProfileDisplayJobTitle(profileObj, ar);
    const nat = formatNationality(
      a.profileNationality || (emp as any)?.nationality,
      ar,
    );

    return {
      [ar ? "كود الموظف" : "Code"]: code,
      [ar ? "الاسم" : "Name"]: fullName,
      [ar ? "رقم الغرفة" : "Room"]: rNum,
      [ar ? "المبنى" : "Building"]: bName,
      [ar ? "الطابق" : "Floor"]: fNum != null ? fNum : "",
      [ar ? "السرير" : "Bed"]:
        a.bedNumber || a.isEntireRoom
          ? `${ar ? "سرير " : "Bed "}${a.bedNumber || 1}${a.isEntireRoom ? (ar ? " (غرفة كاملة)" : " (Full)") : ""}`
          : "—",
      [ar ? "تاريخ التسكين" : "Check-in"]: formatDate(a.checkInDate, ""),
      [ar ? "المغادرة المتوقعة" : "Expected Out"]: formatDate(
        a.expectedCheckOutDate,
        "",
      ),
      [ar ? "الجنسية" : "Nationality"]: nat,
      [ar ? "الهاتف" : "Phone"]: emp?.phone || (a as any).phone || "—",
      [ar ? "الوظيفة" : "Job Title"]: job,
      [ar ? "القسم" : "Department"]: dept,
      [ar ? "الحالة" : "Status"]:
        (a as any).profileStatus === "VACATION" || emp?.status === "VACATION"
          ? ar
            ? "في إجازة"
            : "Vacation"
          : (a as any).profileStatus === "LEFT" || emp?.status === "LEFT"
            ? ar
              ? "تمت المغادرة"
              : "Checked Out"
            : ar
              ? "مقيم بالسكن"
              : "In-House",
    };
  });

  await printLuxuryReport({
    activeTab: "assignments",
    title: ar
      ? "كشف المقيمين بالسكن — الموظفون المحددون"
      : "In-House Selected Residents Report",
    language: ar ? "ar" : "en",
    properties: allProperties,
    activePropertyId: numericPropertyId,
    settings,
    rows,
    orientation: "landscape",
  });
}
