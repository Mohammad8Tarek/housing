// Report row builders — occupancy. Split out of useReportDataProcessor; logic unchanged.
import { formatDate } from "../date-utils";
import { calendarDay } from "../calendar";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "../profile-display-utils";
import { formatNationality } from "../countries";
import { translateRoomType } from "../value-translators";
import type { ReportProcessorContext } from "./context";
import { matchesRoomType, matchesGender } from "./context";

// OPERA PMS: 7/14/30-DAY OCCUPANCY & AVAILABILITY FORECAST (توقعات الإشغال المستقبلية)
export function processOccupancyForecast(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    rooms,
    assignments,
    reservations,
    applySearchAndDate,
    timeZone,
  } = ctx;
  const horizon = 14;

  const fRooms =
    filterBuilding === "all" || !filterBuilding
      ? rooms
      : rooms.filter((r: any) => r.buildingId === Number(filterBuilding));

  const totalBeds = fRooms.reduce(
    (acc: number, r: any) => acc + (r.capacity || 1),
    0,
  );
  const fRoomIds = new Set(fRooms.map((r: any) => r.id));

  const activeAssignments = assignments.filter(
    (a: any) =>
      fRoomIds.has(a.roomId) &&
      (a.status === "ACTIVE" || a.status === "VACATION"),
  );

  let runningInHouse = activeAssignments.length;
  const dailyRows = [];

  for (let i = 0; i < horizon; i++) {
    // Calendar day i after today in the user's zone (the browser's own zone
    // when timeZone is omitted), matching the label shown for the row.
    const { iso: dIso, display: dateDisplay, dayName } = calendarDay(i, ar, timeZone);

    const dayArrivals = reservations.filter((r: any) => {
      if (r.status?.toUpperCase() === "CANCELLED") return false;
      if (r.roomId && !fRoomIds.has(r.roomId)) return false;
      if (!r.checkInDate) return false;
      return r.checkInDate.slice(0, 10) === dIso;
    }).length;

    const dayDepartures = assignments.filter((a: any) => {
      if (!fRoomIds.has(a.roomId)) return false;
      if (a.status !== "ACTIVE" && a.status !== "VACATION") return false;
      if (!a.checkOutDate) return false;
      return a.checkOutDate.slice(0, 10) === dIso;
    }).length;

    const netShift = dayArrivals - dayDepartures;
    if (i > 0) {
      runningInHouse = Math.max(0, runningInHouse + netShift);
    }
    const projectedOccupied = Math.min(totalBeds, runningInHouse);
    const projectedVacant = Math.max(0, totalBeds - projectedOccupied);
    const occRate =
      totalBeds > 0 ? Math.round((projectedOccupied / totalBeds) * 100) : 0;

    dailyRows.push({
      id: i + 1,
      dateIso: dIso,
      dateDisplay,
      dayName,
      dayArrivals,
      dayDepartures,
      netShift: netShift > 0 ? `+${netShift}` : `${netShift}`,
      projectedOccupied,
      projectedVacant,
      totalBeds,
      occupancyRate: `${occRate}%`,
      demandLevel:
        occRate >= 90
          ? ar
            ? "ذروة إشغال"
            : "Peak"
          : occRate >= 75
            ? ar
              ? "إشغال مرتفع"
              : "High"
            : ar
              ? "طبيعي"
              : "Normal",
    });
  }

  return applySearchAndDate(dailyRows, undefined, (d) => [
    d.dateDisplay,
    d.dayName,
    d.demandLevel,
    d.occupancyRate,
  ]);
}

// 1. IN-HOUSE & ASSIGNMENTS REPORT (المقيمين والتسكين)
export function processAssignments(ctx: ReportProcessorContext): any[] {
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

      // Status filter:
      // "all" / default: Only currently residing occupants (ACTIVE & VACATION)
      // "ACTIVE": Only Active
      // "VACATION": Only on Vacation
      // "CHECKED_OUT": Only checked-out records
      // "ALL_HISTORY": Show all including checked out
      if (filterStatus === "all" || !filterStatus) {
        if (isCheckedOut) return false;
      } else if (filterStatus === "ACTIVE") {
        if (effectiveStatus !== "ACTIVE") return false;
      } else if (filterStatus === "VACATION") {
        if (effectiveStatus !== "VACATION") return false;
      } else if (filterStatus === "CHECKED_OUT") {
        if (effectiveStatus !== "CHECKED_OUT") return false;
      } else if (filterStatus === "TRANSFERRED") {
        if (a.status?.toUpperCase() !== "TRANSFERRED") return false;
      } else if (filterStatus === "ALL_HISTORY") {
        // include all
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
        phone: emp.phone || "—",
        department: getProfileDisplayDepartment(emp, ar) || "—",
        jobTitle: getProfileDisplayJobTitle(emp, ar) || "—",
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
        roomId: a.roomId,
        roomNumber: room.roomNumber || `#${a.roomId}`,
        roomType: ar
          ? translateRoomType(room.roomType, true)
          : room.roomType || "—",
        capacity: room.capacity || 1,
        bedNumber: bedNum ? String(bedNum) : "—",
        isEntireRoom: isEntire,
        buildingName: buildingMap[room.buildingId] || "—",
        floorName: floorMap[room.floorId] || "—",
        rawCheckInDate: a.checkInDate,
        checkInDate: formatDate(a.checkInDate, "—"),
        contractEndDate: formatDate(emp.contractEndDate, "—"),
        expectedCheckOutDate: a.expectedCheckOutDate
          ? formatDate(a.expectedCheckOutDate, "—")
          : emp.contractEndDate
            ? formatDate(emp.contractEndDate, "—")
            : "—",
        checkOutDate: formatDate(a.checkOutDate, "—"),
        status: effectiveStatus,
        gender: emp.gender || "—",
        dateOfBirth: formatDate(emp.dateOfBirth, "—"),
        address: emp.address || "—",
        hireDate: formatDate(emp.hireDate, "—"),
        email: emp.email || "—",
        emergencyContact: emp.emergencyContact || "—",
        vacationStartDate: emp.vacationStartDate || a.vacationStartDate || null,
        vacationEndDate: emp.vacationEndDate || a.vacationEndDate || null,
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
    i.roomType,
    i.department,
    i.companyName,
    i.jobTitle,
    i.status,
  ]);
}

// 2. VACANT ROOMS & AVAILABLE BEDS REPORT (الغرف والأسرة الشاغرة)
export function processVacantRooms(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterGender,
    filterRoomType,
    rooms,
    assignments,
    buildingMap,
    floorMap,
    empMap,
    applySearchAndDate,
  } = ctx;
  const activeAssByRoom = new Map<number, Set<number>>();
  const roomHasFullLock = new Map<number, boolean>();
  const occupantGendersByRoom = new Map<number, Set<string>>();

  assignments
    .filter((a: any) => a.status?.toLowerCase() === "active")
    .forEach((a: any) => {
      if (!activeAssByRoom.has(a.roomId))
        activeAssByRoom.set(a.roomId, new Set());
      const isFullLock = Boolean(
        a.isEntireRoom ||
        a.is_entire_room ||
        a.notes?.includes("[حجز الغرفة بالكامل]") ||
        a.notes?.includes("[تسكين الغرفة بالكامل]"),
      );
      if (isFullLock) roomHasFullLock.set(a.roomId, true);
      if (a.bedNumber != null) activeAssByRoom.get(a.roomId)!.add(a.bedNumber);

      const emp = empMap[a.profileId] || {};
      const g = String(emp.gender || a.profileGender || a.gender || "")
        .toUpperCase()
        .trim();
      if (g === "M" || g === "F") {
        if (!occupantGendersByRoom.has(a.roomId))
          occupantGendersByRoom.set(a.roomId, new Set());
        occupantGendersByRoom.get(a.roomId)!.add(g);
      }
    });

  const list = rooms
    .filter((r: any) => {
      const rawStatus = String(r.status || "")
        .toLowerCase()
        .trim();
      const isOutOfOrder = [
        "maintenance",
        "out_of_service",
        "out_of_order",
        "oos",
        "ooo",
      ].includes(rawStatus);
      if (isOutOfOrder) return false;
      if (roomHasFullLock.get(r.id)) return false; // Full Lock: no vacant beds
      const cap = r.capacity || 1;
      const assignedCount = activeAssByRoom.get(r.id)?.size ?? 0;
      const occ = Math.max(r.currentOccupancy || 0, assignedCount);
      const vacantBeds = Math.max(0, cap - occ);
      if (vacantBeds <= 0) return false; // Only rooms with available space

      if (
        filterBuilding &&
        filterBuilding !== "all" &&
        String(r.buildingId) !== String(filterBuilding)
      )
        return false;
      if (
        filterFloor &&
        filterFloor !== "all" &&
        String(r.floorId) !== String(filterFloor)
      )
        return false;
      if (
        filterRoomType &&
        filterRoomType !== "all" &&
        !matchesRoomType(r, filterRoomType)
      )
        return false;
      if (filterStatus && filterStatus !== "all") {
        const fs = filterStatus.toLowerCase();
        if (
          (fs === "room_vacant" || fs === "available" || fs === "vacant") &&
          occ > 0
        )
          return false;
        if (
          (fs === "bed_vacant" || fs === "partially" || fs === "vacant_beds") &&
          (occ === 0 || occ >= cap)
        )
          return false;
        if ((fs === "room_and_bed_vacant" || fs === "both") && vacantBeds <= 0)
          return false;
        if (fs === "dirty" && rawStatus !== "dirty") return false;
      }
      if (filterGender && filterGender !== "all") {
        const fg = filterGender.toUpperCase().trim();
        const rawGen = String(r.gender || r.genderPolicy || "")
          .trim()
          .toLowerCase();
        const isMalePolicy =
          (rawGen.includes("male") && !rawGen.includes("fe")) ||
          rawGen === "m" ||
          rawGen.includes("ذكور") ||
          rawGen.includes("ذكر");
        const isFemalePolicy =
          rawGen.includes("female") ||
          rawGen === "f" ||
          rawGen.includes("إناث") ||
          rawGen.includes("انثى") ||
          rawGen.includes("بنات") ||
          rawGen.includes("أنثى");
        const occGenders = occupantGendersByRoom.get(r.id);
        const hasMaleOcc = occGenders?.has("M");
        const hasFemaleOcc = occGenders?.has("F");

        if (fg === "M") {
          if (isFemalePolicy || hasFemaleOcc) return false;
        } else if (fg === "F") {
          if (isMalePolicy || hasMaleOcc) return false;
        }
      }
      return true;
    })
    .map((r: any) => {
      const cap = r.capacity || 1;
      const occupiedBeds = activeAssByRoom.get(r.id) || new Set();
      const occ = Math.min(
        cap,
        Math.max(r.currentOccupancy || 0, occupiedBeds.size),
      );
      const vacantBedsCount = Math.max(0, cap - occ);
      const availableBedNumbers: number[] = [];
      for (let b = 1; b <= cap; b++) {
        if (!occupiedBeds.has(b)) availableBedNumbers.push(b);
      }

      const rawGen = String(r.gender || r.genderPolicy || "")
        .trim()
        .toLowerCase();
      const isMalePolicy =
        (rawGen.includes("male") && !rawGen.includes("fe")) ||
        rawGen === "m" ||
        rawGen.includes("ذكور") ||
        rawGen.includes("ذكر");
      const isFemalePolicy =
        rawGen.includes("female") ||
        rawGen === "f" ||
        rawGen.includes("إناث") ||
        rawGen.includes("انثى") ||
        rawGen.includes("بنات") ||
        rawGen.includes("أنثى");
      const occGenders = occupantGendersByRoom.get(r.id);
      const hasMaleOcc = occGenders?.has("M");
      const hasFemaleOcc = occGenders?.has("F");

      let genderPolicyLabel: string;
      if (isFemalePolicy) {
        genderPolicyLabel = ar ? "إناث فقط" : "Female";
      } else if (isMalePolicy) {
        genderPolicyLabel = ar ? "ذكور فقط" : "Male";
      } else if (hasFemaleOcc && !hasMaleOcc) {
        genderPolicyLabel = ar ? "إناث (إشغال)" : "Female (Occupied)";
      } else if (hasMaleOcc && !hasFemaleOcc) {
        genderPolicyLabel = ar ? "ذكور (إشغال)" : "Male (Occupied)";
      } else {
        genderPolicyLabel = ar ? "متاح للجميع / مختلط" : "Any / Mixed";
      }

      return {
        id: r.id,
        roomNumber: r.roomNumber,
        buildingName: buildingMap[r.buildingId] || "—",
        floorName: floorMap[r.floorId] || "—",
        roomType: ar
          ? translateRoomType(r.roomType, true)
          : r.roomType || "Standard",
        capacity: cap,
        currentOccupancy: occ,
        vacantBedsCount,
        availableBedsText:
          availableBedNumbers
            .map((b) => (ar ? `سرير ${b}` : `Bed ${b}`))
            .join(", ") || (ar ? "أي سرير" : "Any Bed"),
        genderPolicy: genderPolicyLabel,
        status: r.status || "available",
        isFullyVacant: occ === 0,
      };
    })
    .sort(
      (a: { vacantBedsCount: number }, b: { vacantBedsCount: number }) =>
        b.vacantBedsCount - a.vacantBedsCount,
    );

  return applySearchAndDate(list, undefined, (r) => [
    r.roomNumber,
    r.buildingName,
    r.floorName,
    r.roomType,
    r.status,
    r.genderPolicy,
    r.availableBedsText,
  ]);
}

// 12. DEPARTMENT OCCUPANCY REPORT (إشغال الأقسام)
export function processDepartmentOccupancy(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterDepartment,
    filterGender,
    filterNationality,
    assignments,
    buildingMap,
    roomMap,
    empMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const deptMap: Record<
    string,
    {
      department: string;
      residentCount: number;
      maleCount: number;
      femaleCount: number;
      roomsSet: Set<string>;
      buildingsSet: Set<string>;
    }
  > = {};

  let totalActiveResidents = 0;

  const activeAssignments = (assignments || []).filter((a: any) => {
    const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT";
    return !isCheckedOut;
  });

  activeAssignments.forEach((a: any) => {
    const pId = a.profileId ?? a.profile_id;
    const rId = a.roomId ?? a.room_id;
    const emp = empMap[Number(pId)] || empMap[pId] || {};
    const room = roomMap[Number(rId)] || roomMap[rId] || {};

    const bId = room.buildingId ?? a.buildingId;
    const fId = room.floorId ?? a.floorId;

    if (filterBuilding !== "all" && (!bId || !filteredBuildingIds.has(bId)))
      return;
    if (filterFloor !== "all" && (!fId || !filteredFloorIds.has(fId))) return;
    const empDept = emp.department || a.profileDepartment || "";
    const empDeptAr = emp.departmentAr || a.profileDepartmentAr || "";
    if (filterDepartment !== "all" && filterDepartment) {
      if (empDept !== filterDepartment && empDeptAr !== filterDepartment)
        return;
    }

    const genderRaw = emp.gender || a.profileGender || a.gender || "";
    const isFemale =
      genderRaw.toLowerCase() === "female" ||
      genderRaw === "أنثى" ||
      genderRaw === "انثى" ||
      genderRaw.toUpperCase() === "F";
    const isMale =
      genderRaw.toLowerCase() === "male" ||
      genderRaw === "ذكر" ||
      genderRaw.toUpperCase() === "M";

    if (filterGender !== "all" && filterGender) {
      const wantFemale =
        filterGender.toLowerCase() === "f" ||
        filterGender.toLowerCase() === "female" ||
        filterGender === "أنثى" ||
        filterGender === "انثى";
      const wantMale =
        filterGender.toLowerCase() === "m" ||
        filterGender.toLowerCase() === "male" ||
        filterGender === "ذكر";
      if (wantFemale && !isFemale) return;
      if (wantMale && !isMale) return;
    }

    const natVal = emp.nationality || a.profileNationality || "";
    if (
      filterNationality !== "all" &&
      filterNationality &&
      natVal !== filterNationality
    )
      return;

    const effectiveEmp = emp.department
      ? emp
      : {
          department: a.profileDepartment,
          departmentAr: a.profileDepartmentAr,
        };
    const deptName =
      getProfileDisplayDepartment(effectiveEmp, ar) ||
      (ar
        ? a.profileDepartmentAr || a.profileDepartment
        : a.profileDepartment || a.profileDepartmentAr) ||
      (ar ? "غير محدد" : "Unspecified");

    if (!deptMap[deptName]) {
      deptMap[deptName] = {
        department: deptName,
        residentCount: 0,
        maleCount: 0,
        femaleCount: 0,
        roomsSet: new Set(),
        buildingsSet: new Set(),
      };
    }

    deptMap[deptName].residentCount += 1;
    totalActiveResidents += 1;

    if (isFemale) {
      deptMap[deptName].femaleCount += 1;
    } else if (isMale) {
      deptMap[deptName].maleCount += 1;
    } else {
      deptMap[deptName].maleCount += 1;
    }

    const rNum = room.roomNumber || a.roomNumber;
    if (rNum) {
      deptMap[deptName].roomsSet.add(rNum);
    }
    const bName = buildingMap[bId] || a.buildingName;
    if (bName) {
      deptMap[deptName].buildingsSet.add(bName);
    }
  });

  const list = Object.values(deptMap).map((d, idx) => ({
    id: idx + 1,
    index: idx + 1,
    department: d.department,
    residentCount: d.residentCount,
    inHouse: d.residentCount,
    maleCount: d.maleCount,
    femaleCount: d.femaleCount,
    roomsCount: d.roomsSet.size,
    assignedRooms: d.roomsSet.size,
    shareOfHousing:
      totalActiveResidents > 0
        ? `${((d.residentCount / totalActiveResidents) * 100).toFixed(1)}%`
        : "0.0%",
    occupancyPct:
      totalActiveResidents > 0
        ? Number(((d.residentCount / totalActiveResidents) * 100).toFixed(1))
        : 0,
    buildingsList: Array.from(d.buildingsSet).join(ar ? "، " : ", ") || "—",
  }));

  list.sort((a, b) => b.residentCount - a.residentCount);

  return applySearchAndDate(list, undefined, (item) => [
    item.department,
    item.buildingsList,
    item.residentCount,
    item.roomsCount,
  ]);
}
