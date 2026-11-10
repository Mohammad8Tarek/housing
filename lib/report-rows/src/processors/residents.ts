// Report row builders — residents. Split out of useReportDataProcessor; logic unchanged.
import { formatDate } from "../date-utils";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "../profile-display-utils";
import { formatNationality } from "../countries";
import {
  transliterateFullName,
  hasArabicCharacters,
} from "../bilingual-name-engine";
import {
  translateDepartment,
  translateJobTitle,
} from "../bilingual-hospitality-dict";
import {
  translateRoomType,
  translateReservationStatus,
  translateHostingStatus,
  translateHostingRelation,
} from "../value-translators";
import type { ReportProcessorContext } from "./context";
import { matchesRoomType, matchesGender } from "./context";

// 4. PROFILES DIRECTORY REPORT (دليل البروفايلات)
export function processProfiles(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterDepartment,
    filterGender,
    filterNationality,
    filterEmploymentType,
    profiles,
    assignments,
    buildingMap,
    roomMap,
    applySearchAndDate,
  } = ctx;
  const activeAssByProfile = new Map<number, any>();
  assignments
    .filter((a: any) => {
      const st = String(a.status || "").toLowerCase();
      return st === "active" || st === "vacation";
    })
    .forEach((a: any) => activeAssByProfile.set(a.profileId, a));

  const list = profiles
    .filter((e: any) => {
      const asgn = activeAssByProfile.get(e.id);
      const room = asgn ? roomMap[asgn.roomId] : null;
      const hasRoom = !!room;
      const isVacation =
        (e.status || "").toUpperCase() === "VACATION" ||
        (asgn?.status || "").toUpperCase() === "VACATION";

      if (
        filterBuilding !== "all" &&
        filterBuilding &&
        (!room || String(room.buildingId) !== String(filterBuilding))
      )
        return false;
      if (
        filterFloor !== "all" &&
        filterFloor &&
        (!room || String(room.floorId) !== String(filterFloor))
      )
        return false;

      if (filterStatus !== "all") {
        const fs = filterStatus.toUpperCase();
        if (fs === "ACTIVE" && (!hasRoom || isVacation)) return false;
        if (fs === "VACATION" && !isVacation) return false;
        if ((fs === "NO_ROOM" || fs === "UNASSIGNED") && hasRoom) return false;
        if (
          fs === "CHECKED_OUT" &&
          (hasRoom || (e.status !== "CHECKED_OUT" && e.status !== "LEFT"))
        )
          return false;
        if (fs === "INACTIVE" && e.status !== "INACTIVE") return false;
      }

      if (filterDepartment !== "all" && e.department !== filterDepartment)
        return false;
      if (filterGender !== "all" && !matchesGender(e.gender, filterGender))
        return false;
      if (filterNationality !== "all" && e.nationality !== filterNationality)
        return false;
      if (filterEmploymentType !== "all") {
        const et = e.employmentType || "INTERNAL";
        if (et.toLowerCase() !== filterEmploymentType.toLowerCase())
          return false;
      }
      return true;
    })
    .map((e: any) => {
      const asgn = activeAssByProfile.get(e.id);
      const room = asgn ? roomMap[asgn.roomId] : null;
      // NOTE: buildingMap/floorMap values are plain name strings (see useReportData).
      const bldName = room ? buildingMap[room.buildingId] || "" : "";
      const hasRoom = !!room;
      const isVacation =
        (e.status || "").toUpperCase() === "VACATION" ||
        (asgn?.status || "").toUpperCase() === "VACATION";
      const rawStatus = isVacation
        ? "VACATION"
        : hasRoom
          ? "ACTIVE"
          : e.status === "INACTIVE"
            ? "INACTIVE"
            : "UNASSIGNED";
      const statusLabel = ar
        ? rawStatus === "ACTIVE"
          ? "مقيم بالسكن"
          : rawStatus === "VACATION"
            ? "في إجازة"
            : rawStatus === "UNASSIGNED"
              ? "غير مسكّن"
              : "غير نشط"
        : rawStatus === "ACTIVE"
          ? "In-House"
          : rawStatus === "VACATION"
            ? "Vacation"
            : rawStatus === "UNASSIGNED"
              ? "Unassigned"
              : "Inactive";

      const assignedRoom = room
        ? `${bldName ? bldName + " • " : ""}${room.roomNumber}${asgn?.bedNumber ? ` (${ar ? `سرير ${asgn.bedNumber}` : `Bed ${asgn.bedNumber}`})` : ""}`
        : ar
          ? "بدون غرفة"
          : "No Room";

      return {
        id: e.id,
        profileCode: e.profileId || `EMP-${e.id}`,
        fullName: getProfileDisplayName(e, ar),
        nationalId: e.nationalId || "—",
        nationality: ar
          ? formatNationality(e.nationality, ar, false)
          : e.nationality || "—",
        phone: e.phone || "—",
        gender: e.gender || "M",
        dateOfBirth: formatDate(e.dateOfBirth, "—"),
        department: getProfileDisplayDepartment(e, ar) || "—",
        jobTitle: getProfileDisplayJobTitle(e, ar) || "—",
        level: e.level || "—",
        employmentType: e.employmentType || "INTERNAL",
        companyName:
          e.companyName ||
          (e.employmentType === "THIRD_PARTY"
            ? ar
              ? "طرف ثالث"
              : "Third Party"
            : ar
              ? "الفندق"
              : "Hotel"),
        hireDate: formatDate(e.hireDate, "—"),
        contractEndDate: formatDate(e.contractEndDate, "—"),
        address: e.address || "—",
        email: e.email || "—",
        emergencyContact: e.emergencyContact || "—",
        rawStatus,
        hasRoom,
        status: statusLabel,
        assignedRoom,
      };
    });

  return applySearchAndDate(list, "hireDate", (e) => [
    e.fullName,
    e.profileCode,
    e.nationalId,
    e.phone,
    e.department,
    e.jobTitle,
    e.nationality,
    e.companyName,
    e.assignedRoom,
    e.status,
  ]);
}

// 5. CONTRACT EXPIRATIONS REPORT (تقرير انتهاء العقود)
export function processExpiringContracts(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterStatus,
    filterDepartment,
    filterGender,
    filterNationality,
    profiles,
    assignments,
    buildingMap,
    roomMap,
    applySearchAndDate,
  } = ctx;
  const now = new Date();
  const activeAssByProfile = new Map<number, any>();
  assignments
    .filter((a: any) => a.status?.toLowerCase() === "active")
    .forEach((a: any) => activeAssByProfile.set(a.profileId, a));

  const list = profiles
    .filter((p: any) => {
      if (p.employmentType === "THIRD_PARTY" || !p.contractEndDate)
        return false;
      if (filterDepartment !== "all" && p.department !== filterDepartment)
        return false;
      if (filterGender !== "all" && !matchesGender(p.gender, filterGender))
        return false;
      if (filterNationality !== "all" && p.nationality !== filterNationality)
        return false;

      const exp = new Date(p.contractEndDate);
      const diffDays = Math.ceil(
        (exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24),
      );
      if (filterStatus === "expired" && diffDays >= 0) return false;
      if (filterStatus === "expiring_30" && (diffDays < 0 || diffDays > 30))
        return false;
      if (filterStatus === "active" && diffDays < 0) return false;

      return true;
    })
    .map((p: any) => {
      const exp = new Date(p.contractEndDate);
      const diffTime = exp.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const asgn = activeAssByProfile.get(p.id);
      const room = asgn ? roomMap[asgn.roomId] : null;

      return {
        id: p.id,
        profileCode: p.profileId || `EMP-${p.id}`,
        fullName: getProfileDisplayName(p, ar),
        nationalId: p.nationalId || "—",
        phone: p.phone || "—",
        department: getProfileDisplayDepartment(p, ar) || "—",
        jobTitle: getProfileDisplayJobTitle(p, ar) || "—",
        contractEndDate: formatDate(p.contractEndDate, "—"),
        daysRemaining: diffDays,
        expStatus:
          diffDays < 0
            ? ar
              ? "منتهي"
              : "Expired"
            : diffDays <= 30
              ? ar
                ? "ينتهي قريباً"
                : "Expiring Soon"
              : ar
                ? "ساري"
                : "Active",
        assignedRoom: room
          ? ar
            ? `غرفة ${room.roomNumber} (${buildingMap[room.buildingId] || ""})`
            : `Room ${room.roomNumber} (${buildingMap[room.buildingId] || ""})`
          : ar
            ? "بدون غرفة"
            : "No Room",
      };
    })
    .sort((a: any, b: any) => a.daysRemaining - b.daysRemaining);

  return applySearchAndDate(list, "contractEndDate", (i) => [
    i.fullName,
    i.profileCode,
    i.nationalId,
    i.phone,
    i.department,
    i.jobTitle,
    i.assignedRoom,
    i.contractEndDate,
    i.expStatus,
  ]);
}

// 6. RESERVATIONS & ARRIVALS (الحجوزات والوصول)
export function processReservations(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterStatus,
    filterDepartment,
    filterRoomType,
    reservations,
    roomMap,
    applySearchAndDate,
  } = ctx;
  const list = reservations
    .filter((r: any) => {
      if (
        filterStatus !== "all" &&
        r.status?.toLowerCase() !== filterStatus.toLowerCase()
      )
        return false;
      if (filterDepartment !== "all" && r.department !== filterDepartment)
        return false;
      if (filterRoomType !== "all") {
        const room = r.roomId ? roomMap[r.roomId] : null;
        const matchObj = {
          roomType: r.roomType || room?.roomType,
          capacity: r.bedsCount || room?.capacity,
        };
        if (!matchesRoomType(matchObj, filterRoomType)) return false;
      }
      return true;
    })
    .map((r: any) => {
      const room = r.roomId ? roomMap[r.roomId] : null;
      return {
        id: r.id,
        guestName:
          getProfileDisplayName(r, ar) ||
          (r.guestName
            ? ar
              ? hasArabicCharacters(r.guestName)
                ? r.guestName
                : transliterateFullName(r.guestName, "ar")
              : r.guestName
            : "—"),
        nationalId: r.guestIdCardNumber || "—",
        phone: r.guestPhone || "—",
        department: getProfileDisplayDepartment(r, ar) || "—",
        jobTitle: getProfileDisplayJobTitle(r, ar) || "—",
        roomType: ar ? translateRoomType(r.roomType, true) : r.roomType || "—",
        roomNumber: room ? room.roomNumber : "—",
        checkInDate: formatDate(r.checkInDate, "—"),
        checkOutDate: formatDate(r.checkOutDate, "—"),
        status: ar
          ? translateReservationStatus(r.status, true)
          : r.status || "UPCOMING",
        notes: r.notes || "—",
      };
    });

  return applySearchAndDate(list, "checkInDate", (r) => [
    r.guestName,
    r.nationalId,
    r.phone,
    r.department,
    r.roomType,
    r.roomNumber,
    r.status,
  ]);
}

// 7. GUEST HOSTINGS (الاستضافات والزوار)
export function processHostings(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterDepartment,
    hostings,
    roomMap,
    empMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const list = hostings
    .filter((h: any) => {
      const room = h.roomId ? roomMap[h.roomId] : null;
      if (
        filterBuilding !== "all" &&
        room &&
        !filteredBuildingIds.has(room.buildingId)
      )
        return false;
      if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId))
        return false;
      if (
        filterStatus !== "all" &&
        h.status?.toLowerCase() !== filterStatus.toLowerCase()
      )
        return false;
      if (filterDepartment !== "all") {
        const emp = empMap[h.profileId];
        if (emp?.department !== filterDepartment) return false;
      }
      return true;
    })
    .map((h: any) => {
      const emp = empMap[h.profileId] || {};
      const room = h.roomId ? roomMap[h.roomId] : null;
      return {
        id: h.id,
        hostEmployee: getProfileDisplayName(emp, ar) || `#${h.profileId}`,
        hostDept: getProfileDisplayDepartment(emp, ar) || "—",
        guestName: ar
          ? hasArabicCharacters(h.guestName)
            ? h.guestName
            : transliterateFullName(h.guestName, "ar")
          : h.guestName || "—",
        relation: ar
          ? translateHostingRelation(h.relationship, true)
          : h.relationship || "—",
        guestId: h.guestNationalId || "—",
        roomNumber: room ? room.roomNumber : "—",
        checkInDate: formatDate(h.expectedFrom, "—"),
        checkOutDate: formatDate(h.expectedTo, "—"),
        dailyRate: h.dailyRate ? `${h.dailyRate} EGP` : "—",
        totalAmount: h.totalAmount ? `${h.totalAmount} EGP` : "—",
        status: ar
          ? translateHostingStatus(h.status, true)
          : h.status || "pending",
      };
    });

  return applySearchAndDate(list, "checkInDate", (h) => [
    h.hostEmployee,
    h.guestName,
    h.guestId,
    h.relation,
    h.roomNumber,
    h.hostDept,
    h.status,
  ]);
}

export function processVacations(ctx: ReportProcessorContext): any[] {
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
    dateFrom,
    dateTo,
    vacations,
    floorMap,
    roomMap,
    empMap,
    applySearchAndDate,
  } = ctx;
  const list = (vacations || [])
    .filter((v: any) => {
      const vRoom = v.roomId ? roomMap[v.roomId] : null;
      const vBuildingId = v.buildingId ?? vRoom?.buildingId;
      const vFloorId = v.floorId ?? vRoom?.floorId;
      const vRoomType = v.roomType || vRoom?.roomType || "";
      const vCapacity = v.capacity || vRoom?.capacity || 1;
      const vEmp = empMap[v.profileId] || {};
      const vGender = v.gender || vEmp.gender || "";
      const vNationality = v.nationality || vEmp.nationality || "";
      const vEmploymentType = v.employmentType || vEmp.employmentType || "";

      if (filterBuilding !== "all" && filterBuilding) {
        if (vBuildingId !== Number(filterBuilding)) return false;
      }
      if (filterFloor !== "all" && filterFloor) {
        if (vFloorId !== Number(filterFloor)) return false;
      }
      if (filterDepartment !== "all" && filterDepartment) {
        if (v.department !== filterDepartment) return false;
      }
      if (filterStatus !== "all" && filterStatus) {
        if (v.statusKey !== filterStatus.toUpperCase()) return false;
      }
      if (filterGender !== "all" && filterGender) {
        if (vGender !== filterGender) return false;
      }
      if (filterNationality !== "all" && filterNationality) {
        if (vNationality !== filterNationality) return false;
      }
      if (filterEmploymentType !== "all" && filterEmploymentType) {
        if (vEmploymentType !== filterEmploymentType) return false;
      }
      if (filterRoomType !== "all" && filterRoomType) {
        const dummyRoom = { roomType: vRoomType, capacity: vCapacity };
        if (!matchesRoomType(dummyRoom, filterRoomType)) return false;
      }

      // Historical Date Overlap Query: [dateFrom, dateTo]
      const vStart = v.startDate;
      const vEnd = v.actualReturnDate || v.endDate || "9999-12-31";

      if (dateFrom && vEnd < dateFrom) return false;
      if (dateTo && vStart > dateTo) return false;

      return true;
    })
    .map((v: any) => {
      const vRoom = v.roomId ? roomMap[v.roomId] : null;
      const vEmp = empMap[v.profileId] || {};
      const genderVal = v.gender || vEmp.gender || "";
      const natVal = v.nationality || vEmp.nationality || "";
      const roomTypeVal = v.roomType || vRoom?.roomType || "";
      const floorIdVal = v.floorId ?? vRoom?.floorId;
      const floorNameVal = floorIdVal
        ? floorMap[floorIdVal] || `Floor ${floorIdVal}`
        : "—";

      let statusBadge = ar ? "في إجازة حالياً" : "On Vacation";
      if (v.statusKey === "COMPLETED") {
        statusBadge = ar ? "عاد للعمل" : "Returned";
      } else if (v.statusKey === "OVERDUE") {
        statusBadge = ar ? "متأخر عن العودة" : "Overdue";
      }

      const housingDisplay =
        v.roomNumber && v.roomNumber !== "—"
          ? `${v.roomNumber}${v.bedNumber && v.bedNumber !== "—" ? ` (${ar ? `سرير ${v.bedNumber}` : `Bed ${v.bedNumber}`})` : ""}`
          : "—";

      // Unified profile context for bilingual resolution
      const effectiveEmp = {
        ...vEmp,
        fullName: vEmp.fullName || v.fullName,
        department: vEmp.department || v.department,
        jobTitle: vEmp.jobTitle || v.jobTitle,
      };

      const resolvedFullName =
        getProfileDisplayName(effectiveEmp, ar) ||
        (ar ? v.fullName : transliterateFullName(v.fullName, "en"));
      const resolvedDepartment =
        getProfileDisplayDepartment(effectiveEmp, ar) ||
        (ar ? v.department : translateDepartment(v.department, "en"));
      const resolvedJobTitle =
        getProfileDisplayJobTitle(effectiveEmp, ar) ||
        (ar ? v.jobTitle : translateJobTitle(v.jobTitle, "en"));

      return {
        id: v.id,
        profileId: v.profileId,
        profileCode: v.profileCode,
        fullName: resolvedFullName,
        department: resolvedDepartment,
        jobTitle: resolvedJobTitle,
        phone: v.phone || vEmp.phone || "",
        nationalId: v.nationalId || vEmp.nationalId || "",
        gender: genderVal,
        genderLabel:
          genderVal === "M"
            ? ar
              ? "ذكر"
              : "Male"
            : genderVal === "F"
              ? ar
                ? "أنثى"
                : "Female"
              : genderVal,
        nationality: natVal,
        nationalityLabel: ar
          ? formatNationality(natVal, true, false)
          : natVal || "—",
        employmentType: v.employmentType || vEmp.employmentType || "",
        roomNumber: v.roomNumber,
        bedNumber: v.bedNumber,
        roomType: roomTypeVal
          ? ar
            ? translateRoomType(roomTypeVal, true)
            : roomTypeVal
          : "—",
        floorName: floorNameVal,
        floorId: floorIdVal,
        housingInfo: housingDisplay,
        buildingName: v.buildingName,
        buildingId: v.buildingId,
        startDate: formatDate(v.startDate),
        endDate: formatDate(v.endDate),
        actualReturnDate:
          v.actualReturnDate && v.actualReturnDate !== "—"
            ? formatDate(v.actualReturnDate)
            : "—",
        duration: v.duration,
        status: statusBadge,
        statusKey: v.statusKey,
        notes: v.notes || "—",
      };
    });

  return applySearchAndDate(list, undefined, (v) => [
    v.profileCode,
    v.fullName,
    v.department,
    v.jobTitle,
    v.roomNumber,
    v.buildingName,
    v.floorName,
    v.genderLabel,
    v.nationalityLabel,
    v.roomType,
    v.startDate,
    v.endDate,
    v.actualReturnDate,
    v.status,
    v.notes,
  ]);
}
