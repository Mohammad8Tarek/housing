// Report row builders — room inventory & housing map. Split out of useReportDataProcessor; logic unchanged.
import { translateRoomType } from "../../utils/luxury-report-engine";
import type { ReportProcessorContext } from "./context";
import { matchesRoomType } from "./context";

// 3. COMPLETE ROOM INVENTORY REPORT (جرد وحالة الغرف بالكامل)
export function processHousing(ctx: ReportProcessorContext): any[] {
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
  const activeAssByRoom = new Map<number, number>();
  const roomHasFullLock = new Map<number, boolean>();
  const occupantGendersByRoom = new Map<number, Set<string>>();

  assignments
    .filter((a: any) => a.status?.toLowerCase() === "active")
    .forEach((a: any) => {
      activeAssByRoom.set(a.roomId, (activeAssByRoom.get(a.roomId) || 0) + 1);
      if (
        a.isEntireRoom ||
        a.is_entire_room ||
        a.notes?.includes("[حجز الغرفة بالكامل]") ||
        a.notes?.includes("[تسكين الغرفة بالكامل]")
      ) {
        roomHasFullLock.set(a.roomId, true);
      }
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
      // 1. Building & Floor filter
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

      // 2. Room Type filter
      if (
        filterRoomType &&
        filterRoomType !== "all" &&
        !matchesRoomType(r, filterRoomType)
      )
        return false;

      const cap = r.capacity || 1;
      const isFullLock = !!roomHasFullLock.get(r.id);
      const occ = isFullLock
        ? cap
        : Math.min(
            cap,
            Math.max(r.currentOccupancy || 0, activeAssByRoom.get(r.id) || 0),
          );
      const vacantBeds = Math.max(0, cap - occ);
      const rawStatus = String(r.status || "")
        .toLowerCase()
        .trim();
      const isOOS = ["out_of_service", "oos"].includes(rawStatus);
      const isOOO = ["out_of_order", "ooo"].includes(rawStatus);
      const isMaint = isOOS || isOOO || rawStatus === "maintenance";
      const isOccupied = isFullLock || occ >= cap || rawStatus === "occupied";
      const isDirty = rawStatus === "dirty" || rawStatus === "occupied_dirty";
      // Fully vacant only: 0 occupants AND available/clean status!
      const isFullyVacant =
        !isMaint &&
        !isDirty &&
        occ === 0 &&
        (rawStatus === "available" ||
          rawStatus === "vacant" ||
          rawStatus === "room_vacant");
      // Has vacant beds / partially occupied:
      const hasVacantBeds =
        !isMaint && !isFullLock && occ > 0 && vacantBeds > 0;
      // Room & Bed Vacant: any available capacity (not maint or dirty)
      const hasAnyVacancy =
        !isMaint && !isDirty && !isFullLock && vacantBeds > 0;

      // 3. Status filter
      if (filterStatus && filterStatus !== "all") {
        const fs = filterStatus.toLowerCase().trim();
        if (fs === "room_and_bed_vacant" || fs === "both") {
          if (!hasAnyVacancy) return false;
        } else if (
          fs === "room_vacant" ||
          fs === "available" ||
          fs === "vacant"
        ) {
          if (!isFullyVacant) return false;
        } else if (
          fs === "bed_vacant" ||
          fs === "vacant_beds" ||
          fs === "partially"
        ) {
          if (!hasVacantBeds) return false;
        } else if (fs === "occupied") {
          if (!isOccupied && occ === 0) return false;
        } else if (fs === "dirty") {
          if (!isDirty) return false;
        } else if (fs === "occupied_dirty") {
          if (!isOccupied || !isDirty) return false;
        } else if (fs === "maintenance") {
          if (!isMaint) return false;
        } else if (fs === "out_of_service") {
          if (!isOOS && rawStatus !== "maintenance") return false;
        } else if (fs === "out_of_order") {
          if (!isOOO) return false;
        } else {
          if (rawStatus !== fs) return false;
        }
      }

      // 4. Gender Policy filter
      if (filterGender && filterGender !== "all") {
        const fg = filterGender.toUpperCase().trim(); // "M" or "F"
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
          // Must be male policy OR occupied by males (and NOT female policy/female occupied)
          if (isFemalePolicy || hasFemaleOcc) return false;
          if (!isMalePolicy && !hasMaleOcc && occ > 0) return false;
        } else if (fg === "F") {
          // Must be female policy OR occupied by females (and NOT male policy/male occupied)
          if (isMalePolicy || hasMaleOcc) return false;
          if (!isFemalePolicy && !hasFemaleOcc && occ > 0) return false;
        }
      }

      return true;
    })
    .map((r: any) => {
      const cap = r.capacity || 1;
      const isFullLock = !!roomHasFullLock.get(r.id);
      const occ = isFullLock
        ? cap
        : Math.min(
            cap,
            Math.max(r.currentOccupancy || 0, activeAssByRoom.get(r.id) || 0),
          );
      const vacantBeds = Math.max(0, cap - occ);
      const rate = cap > 0 ? Math.round((occ / cap) * 100) : 0;

      const rawStatus = String(r.status || "")
        .toLowerCase()
        .trim();
      const isOOS = ["out_of_service", "oos"].includes(rawStatus);
      const isOOO = ["out_of_order", "ooo"].includes(rawStatus);
      const isOccupied =
        isFullLock ||
        occ > 0 ||
        rawStatus === "occupied" ||
        rawStatus === "occupied_dirty";
      const isDirty = rawStatus === "dirty" || rawStatus === "occupied_dirty";

      let effectiveStatus = "available";
      if (isOOO) {
        effectiveStatus = "out_of_order";
      } else if (isOOS || rawStatus === "maintenance") {
        effectiveStatus = "out_of_service";
      } else if (isOccupied && isDirty) {
        effectiveStatus = "occupied_dirty";
      } else if (isOccupied) {
        effectiveStatus = "occupied";
      } else if (isDirty) {
        effectiveStatus = "dirty";
      } else {
        effectiveStatus = "available";
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
        vacantBeds,
        occupancyRate: `${rate}%`,
        genderPolicy: genderPolicyLabel,
        status: effectiveStatus,
      };
    });

  return applySearchAndDate(list, undefined, (r) => [
    r.roomNumber,
    r.buildingName,
    r.floorName,
    r.roomType,
    r.status,
    r.genderPolicy,
  ]);
}

// 23. HOUSING MAP & STRUCTURE REPORT (خريطة وتفصيل السكن والمباني)
export function processHousingMap(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterRoomType,
    rooms,
    assignments,
    buildingMap,
    floorMap,
    empMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const list = rooms
    .filter((r: any) => {
      if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId))
        return false;
      if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId))
        return false;
      if (filterRoomType !== "all" && !matchesRoomType(r, filterRoomType))
        return false;
      return true;
    })
    .map((r: any) => {
      const bName = buildingMap[r.buildingId] || "—";
      const fNum = r.floorNumber ?? (r.floorId ? floorMap[r.floorId] : null);
      const fName = fNum
        ? String(fNum).toLowerCase().includes("floor") ||
          String(fNum).includes("دور")
          ? fNum
          : ar
            ? `الدور ${fNum}`
            : `Floor ${fNum}`
        : r.floorId
          ? floorMap[r.floorId] || "—"
          : "—";
      const roomAssigns = assignments.filter(
        (a: any) =>
          a.roomId === r.id &&
          ["ACTIVE", "VACATION", "OCCUPIED_VACATION"].includes(
            String(a.status).toUpperCase(),
          ),
      );
      const occupantsList = roomAssigns.map((a: any, idx: number) => {
        const p = empMap[a.profileId] || {};
        const pName =
          p.fullName || a.employeeName || (ar ? "مقيم" : "Resident");
        const pCode = p.profileCode || a.employeeCode || "—";
        const pDept = p.department || a.department || "—";
        const bed = a.bedNumber || idx + 1;
        return `${pName}${pCode !== "—" ? ` [${pCode}]` : ""}${pDept !== "—" ? ` (${pDept})` : ""} - سرير #${bed}`;
      });
      const occupantsSummary =
        occupantsList.length > 0
          ? occupantsList.join(" | ")
          : ar
            ? "شاغرة بالكامل"
            : "Vacant";
      const cap = Number(r.capacity) || 1;
      const occ = roomAssigns.length;
      const avail = Math.max(0, cap - occ);

      let stText = ar ? "شاغرة" : "Vacant";
      if (occ >= cap) stText = ar ? "مشغولة" : "Occupied";
      else if (occ > 0) stText = ar ? "إشغال جزئي" : "Partial";

      return {
        id: r.id,
        roomNumber: r.roomNumber,
        building: bName,
        buildingName: bName,
        floor: fName,
        floorName: fName,
        roomType: ar
          ? translateRoomType(r.roomType, true)
          : r.roomType || "Standard",
        totalCapacity: cap,
        capacity: cap,
        currentOccupants: occ,
        occupiedCount: occ,
        vacantBeds: avail,
        availableBeds: avail,
        status: stText,
        occupancyStatus: stText,
        occupantsSummary,
        residentsSummary: occupantsSummary,
        residents: roomAssigns.map((a: any, idx: number) => {
          const p = empMap[a.profileId] || {};
          return {
            name: p.fullName || a.employeeName || (ar ? "مقيم" : "Resident"),
            code: p.profileCode || a.employeeCode || "-",
            dept: p.department || a.department || "-",
            job: p.jobTitle || a.jobTitle || "-",
            gender: p.gender || a.gender || "-",
            nationality: p.nationality || a.nationality || "-",
            bedNumber: a.bedNumber ? String(a.bedNumber) : String(idx + 1),
          };
        }),
      };
    });

  return applySearchAndDate(list, undefined, (r) => [
    r.roomNumber,
    r.buildingName,
    r.floorName,
    r.roomType,
    r.status,
    r.occupantsSummary,
  ]);
}
