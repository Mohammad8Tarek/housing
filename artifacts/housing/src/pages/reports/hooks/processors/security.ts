// Report row builders — security. Split out of useReportDataProcessor; logic unchanged.
import { formatDate } from "@/lib/date-utils";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";
import { formatNationality } from "@/lib/countries";
import {
  transliterateFullName,
  hasArabicCharacters,
} from "@/lib/bilingual-name-engine";
import {
  translateDepartment,
  translateJobTitle,
} from "@/lib/bilingual-hospitality-dict";
import {
  translateRoomType,
  translateProfileStatus,
} from "../../utils/luxury-report-engine";
import type { ReportProcessorContext } from "./context";
import { matchesRoomType, matchesGender } from "./context";

// 13. GATE LOGS REPORT (سجل البوابة والأمن)
export function processGateLogs(ctx: ReportProcessorContext): any[] {
  const { ar, filterDepartment, gateLogs, applySearchAndDate } = ctx;
  const list = gateLogs
    .filter((g: any) => {
      if (filterDepartment !== "all" && g.department !== filterDepartment)
        return false;
      return true;
    })
    .map((g: any) => {
      const rawDate = g.scannedAt ? String(g.scannedAt).slice(0, 10) : "";
      const isExit = g.direction === "exit" || g.direction === "OUT";
      const isValid =
        g.status === "valid" ||
        g.status === "APPROVED" ||
        g.status === "success";

      return {
        id: g.id,
        scannedAt: g.scannedAt
          ? new Date(g.scannedAt).toLocaleString(ar ? "ar-EG" : "en-US", {
              hour12: true,
              month: "short",
              day: "numeric",
              hour: "2-digit",
              minute: "2-digit",
            })
          : "—",
        rawDate,
        action: isExit ? (ar ? "خروج" : "Exit") : ar ? "دخول" : "Entry",
        direction: g.direction,
        profileName: ar
          ? hasArabicCharacters(g.fullName)
            ? g.fullName
            : transliterateFullName(g.fullName, "ar")
          : g.fullName || "—",
        profileCode: g.employeeId || "—",
        department: ar
          ? translateDepartment(g.department, "ar")
          : g.department || "—",
        jobTitle: ar ? translateJobTitle(g.jobTitle, "ar") : g.jobTitle || "—",
        roomNumber: g.roomNumber || "—",
        buildingName: g.buildingName || "—",
        guardName: g.scannedBy || (ar ? "مسؤول الأمن" : "Security Officer"),
        status: isValid
          ? ar
            ? "تصريح ساري ومطابق"
            : "Valid & Approved"
          : ar
            ? "مرفوض / غير صالح"
            : "Invalid / Denied",
        isValid,
        notes: g.notes || g.reason || "—",
      };
    });

  return applySearchAndDate(list, "rawDate", (item) => [
    item.profileName,
    item.profileCode,
    item.department,
    item.roomNumber,
    item.buildingName,
    item.guardName,
    item.action,
    item.status,
    item.notes,
  ]);
}

// 18. TOURISM POLICE & MINISTRY OF TOURISM REPORT (كشف شرطة ووزارة السياحة)
export function processPoliceReport(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterDepartment,
    filterGender,
    filterNationality,
    filterRoomType,
    filterEmploymentType,
    assignments,
    buildingMap,
    floorMap,
    roomMap,
    empMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const list = assignments
    .filter((a: any) => {
      const room = roomMap[a.roomId];
      const emp = empMap[a.profileId] || {};
      const isVacation =
        (emp.status || a.profileStatus || "").toUpperCase() === "VACATION";
      const isCheckedOut =
        a.status === "CHECKED_OUT" ||
        a.status === "LEFT" ||
        emp.status === "LEFT" ||
        emp.status === "CHECKED_OUT";
      const effectiveStatus = isCheckedOut
        ? "CHECKED_OUT"
        : isVacation
          ? "VACATION"
          : a.status || "ACTIVE";

      if (
        filterBuilding !== "all" &&
        (!room || !filteredBuildingIds.has(room.buildingId))
      )
        return false;
      if (
        filterFloor !== "all" &&
        (!room || !filteredFloorIds.has(room.floorId))
      )
        return false;
      if (filterStatus === "all" || !filterStatus) {
        if (isCheckedOut) return false;
      } else if (filterStatus === "ACTIVE") {
        if (effectiveStatus !== "ACTIVE") return false;
      } else if (filterStatus === "VACATION") {
        if (effectiveStatus !== "VACATION") return false;
      } else if (filterStatus === "CHECKED_OUT") {
        if (effectiveStatus !== "CHECKED_OUT") return false;
      }

      if (filterDepartment !== "all" && emp?.department !== filterDepartment)
        return false;
      if (filterGender !== "all" && !matchesGender(emp?.gender, filterGender))
        return false;
      if (filterNationality !== "all" && emp?.nationality !== filterNationality)
        return false;
      if (filterRoomType !== "all" && !matchesRoomType(room, filterRoomType))
        return false;
      if (filterEmploymentType !== "all") {
        const et = emp?.employmentType || "INTERNAL";
        if (et.toLowerCase() !== filterEmploymentType.toLowerCase())
          return false;
      }
      return true;
    })
    .map((a: any) => {
      const emp = empMap[a.profileId] || {};
      const room = roomMap[a.roomId] || {};
      const isVacation =
        (emp.status || a.profileStatus || "").toUpperCase() === "VACATION";
      const isCheckedOut =
        a.status === "CHECKED_OUT" ||
        a.status === "LEFT" ||
        emp.status === "LEFT" ||
        emp.status === "CHECKED_OUT";
      const effectiveStatus = isCheckedOut
        ? "CHECKED_OUT"
        : isVacation
          ? "VACATION"
          : a.status || "ACTIVE";
      const isEntire = Boolean(
        a.isEntireRoom ||
        a.is_entire_room ||
        a.notes?.includes("[حجز الغرفة بالكامل]") ||
        a.notes?.includes("[تسكين الغرفة بالكامل]"),
      );
      const bedNum = a.bedNumber ?? (isEntire ? 1 : null);

      return {
        id: a.id,
        profileId: emp.id,
        profileCode: emp.profileId || `EMP-${a.profileId}`,
        firstName: ar
          ? emp.firstNameAr || emp.firstName || "—"
          : emp.firstName || "—",
        lastName: ar
          ? emp.lastNameAr || emp.lastName || ""
          : emp.lastName || "",
        thirdName: ar
          ? emp.thirdNameAr || emp.thirdName || "—"
          : emp.thirdName || "—",
        fourthName: ar
          ? emp.fourthNameAr || emp.fourthName || "—"
          : emp.fourthName || "—",
        fullName: getProfileDisplayName(emp, ar) || `#${a.profileId}`,
        nationalId: emp.nationalId || "—",
        nationality: ar
          ? formatNationality(emp.nationality, ar, false)
          : emp.nationality || "—",
        dateOfBirth: formatDate(emp.dateOfBirth, "—"),
        gender: emp.gender || "M",
        jobTitle: getProfileDisplayJobTitle(emp, ar) || "—",
        department: getProfileDisplayDepartment(emp, ar) || "—",
        level: emp.level || "—",
        employmentType: emp.employmentType || "INTERNAL",
        companyName:
          emp.companyName ||
          (emp.employmentType === "THIRD_PARTY"
            ? ar
              ? "طرف ثالث"
              : "Third Party"
            : ar
              ? "الفندق"
              : "Hotel"),
        address: emp.address || "—",
        phone: emp.phone || "—",
        roomId: a.roomId,
        roomNumber: room.roomNumber || `#${a.roomId}`,
        bedNumber: bedNum ? String(bedNum) : "—",
        roomType: ar
          ? translateRoomType(room.roomType, true)
          : room.roomType || "Standard",
        isEntireRoom: isEntire,
        buildingName: buildingMap[room.buildingId] || "—",
        floorName: floorMap[room.floorId] || "—",
        rawCheckInDate: a.checkInDate,
        checkInDate: formatDate(a.checkInDate, "—"),
        hireDate: formatDate(emp.hireDate, "—"),
        contractEndDate: formatDate(emp.contractEndDate, "—"),
        email: emp.email || "—",
        emergencyContact: emp.emergencyContact || "—",
        status: ar
          ? translateProfileStatus(effectiveStatus, true)
          : effectiveStatus,
      };
    });

  return applySearchAndDate(list, "rawCheckInDate", (i) => [
    i.fullName,
    i.profileCode,
    i.nationalId,
    i.nationality,
    i.phone,
    i.roomNumber,
    i.bedNumber,
    i.buildingName,
    i.floorName,
    i.department,
    i.companyName,
    i.jobTitle,
    i.address,
  ]);
}
