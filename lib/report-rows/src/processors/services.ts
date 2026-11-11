// Report row builders — services. Split out of useReportDataProcessor; logic unchanged.
import { formatDate } from "../date-utils";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "../profile-display-utils";
import {
  transliterateFullName,
  hasArabicCharacters,
} from "../bilingual-name-engine";
import {
  translateRoomType,
  translateGenderPolicy,
  translateMaintenanceCategory,
  translateMaintenancePriority,
  translateMaintenanceStatus,
} from "../value-translators";
import type { ReportProcessorContext } from "./context";
import { normalizeItemName, matchesRoomType, matchesGender } from "./context";

// 8. MAINTENANCE (الصيانة)
export function processMaintenance(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterCategory,
    maintenance,
    buildingMap,
    floorMap,
    roomMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const list = maintenance
    .filter((m: any) => {
      const room = roomMap[m.roomId];
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
        m.status?.toLowerCase() !== filterStatus.toLowerCase()
      )
        return false;
      if (
        filterCategory !== "all" &&
        m.category?.toLowerCase() !== filterCategory.toLowerCase()
      )
        return false;
      return true;
    })
    .map((m: any) => {
      const room = roomMap[m.roomId] || {};
      const bName = m.buildingName || buildingMap[room.buildingId] || "—";
      const fNum =
        m.floorNumber || (room.floorId ? floorMap[room.floorId] : null);
      const fName = fNum
        ? String(fNum).toLowerCase().includes("floor") ||
          String(fNum).includes("دور")
          ? fNum
          : ar
            ? `الدور ${fNum}`
            : `Floor ${fNum}`
        : "—";
      const reporter = m.reportedBy
        ? ar
          ? hasArabicCharacters(m.reportedBy)
            ? m.reportedBy
            : transliterateFullName(m.reportedBy, "ar")
          : m.reportedBy
        : ar
          ? "غير محدد"
          : "Unspecified";

      return {
        id: m.id,
        issueId: m.id,
        roomNumber: m.roomNumber || room.roomNumber || `#${m.roomId}`,
        location: `${m.roomNumber || room.roomNumber || `#${m.roomId}`} (${bName})`,
        building: bName,
        buildingName: bName,
        floor: fName,
        floorName: fName,
        category: ar
          ? translateMaintenanceCategory(m.category, true)
          : m.category || "General",
        rawCategory: m.category || "maintenance",
        problemType: m.problemType || "—",
        issueDescription: m.problemType || "—",
        priority: ar
          ? translateMaintenancePriority(m.priority, true)
          : m.priority || "Normal",
        rawPriority: m.priority || "Normal",
        reportedBy: reporter,
        assignedTo:
          m.workerName || m.assignedToName
            ? ar
              ? hasArabicCharacters(m.workerName || m.assignedToName)
                ? m.workerName || m.assignedToName
                : transliterateFullName(m.workerName || m.assignedToName, "ar")
              : m.workerName || m.assignedToName
            : m.assignedTo || "—",
        reportedAt: formatDate(m.reportedAt, "—"),
        rawReportedAt: m.reportedAt,
        resolvedAt: m.resolvedAt
          ? formatDate(m.resolvedAt, "—")
          : m.status === "completed" || m.status === "resolved"
            ? formatDate(m.updatedAt || m.reportedAt, "—")
            : "—",
        status: ar
          ? translateMaintenanceStatus(m.status, true)
          : m.status || "open",
        resolutionStatus: ar
          ? translateMaintenanceStatus(m.status, true)
          : m.status || "open",
        rawStatus: m.status || "open",
        rating: m.rating != null ? Number(m.rating) : null,
        ratingComment: m.ratingComment || null,
        cost: m.cost ? `${m.cost} EGP` : "—",
      };
    });

  return applySearchAndDate(list, "reportedAt", (m) => [
    m.roomNumber,
    m.buildingName,
    m.floorName,
    m.reportedBy,
    m.category,
    m.problemType,
    m.priority,
    m.assignedTo,
    m.status,
    m.ratingComment || "",
  ]);
}

// 9. HOUSEKEEPING REPORT (هاوس كيبنج — حالة الغرف النظافة والصيانة)
export function processHousekeeping(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterGender,
    filterRoomType,
    rooms,
    maintenance,
    buildingMap,
    floorMap,
    applySearchAndDate,
  } = ctx;
  const list = rooms
    .filter((r: any) => {
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
        if (fg === "M" && isFemalePolicy) return false;
        if (fg === "F" && isMalePolicy) return false;
      }
      // Status filter: map housekeeping-relevant statuses
      if (filterStatus !== "all") {
        const s = r.status?.toLowerCase();
        if (filterStatus === "dirty" && s !== "dirty") return false;
        if (filterStatus === "occupied_dirty" && s !== "occupied_dirty")
          return false;
        if (filterStatus === "available" && s !== "available") return false;
        if (filterStatus === "occupied" && s !== "occupied") return false;
        if (filterStatus === "maintenance" && s !== "maintenance") return false;
        if (
          filterStatus === "out_of_service" &&
          !["out_of_service", "oos"].includes(s)
        )
          return false;
        if (
          filterStatus === "out_of_order" &&
          !["out_of_order", "ooo"].includes(s)
        )
          return false;
      }
      return true;
    })
    .map((r: any) => {
      const cap = r.capacity || 1;
      const occ = r.currentOccupancy || 0;
      const s = r.status?.toLowerCase();
      // Housekeeping priority based on status
      const hkPriority =
        s === "dirty"
          ? "high"
          : s === "occupied_dirty"
            ? "high"
            : s === "occupied"
              ? "low"
              : s === "available"
                ? "none"
                : s === "maintenance"
                  ? "maintenance"
                  : "normal";

      const hkAction =
        s === "dirty"
          ? ar
            ? "تنظيف فوري"
            : "Immediate Cleaning"
          : s === "occupied_dirty"
            ? ar
              ? "تنظيف عند الخروج"
              : "Clean on Checkout"
            : s === "available"
              ? ar
                ? "جاهزة"
                : "Ready"
              : s === "occupied"
                ? ar
                  ? "مشغولة — لا تزعج"
                  : "Occupied — DND"
                : s === "maintenance"
                  ? ar
                    ? "صيانة"
                    : "Under Maintenance"
                  : ar
                    ? "مراجعة"
                    : "Review";

      // Count open housekeeping tickets for this room
      const hkTickets = maintenance.filter(
        (m: any) =>
          m.roomId === r.id &&
          m.category?.toLowerCase() === "housekeeping" &&
          !["resolved", "closed", "cancelled"].includes(
            m.status?.toLowerCase(),
          ),
      ).length;

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
        vacantBeds: Math.max(0, cap - occ),
        genderPolicy: ar
          ? translateGenderPolicy(r.genderPolicy, true)
          : r.genderPolicy || "—",
        status: r.status || "available",
        hkPriority: ar
          ? hkPriority === "high"
            ? "مرتفعة"
            : hkPriority === "maintenance"
              ? "صيانة"
              : hkPriority === "low"
                ? "منخفضة"
                : hkPriority === "none"
                  ? "لا يوجد"
                  : "عادية"
          : hkPriority,
        hkAction,
        openHkTickets: hkTickets,
        lastCleaned: formatDate(r.lastCleanedAt, "—"),
      };
    })
    // Sort: dirty first, then occupied_dirty, then maintenance, then rest
    .sort((a: any, b: any) => {
      const order: Record<string, number> = {
        high: 0,
        maintenance: 1,
        normal: 2,
        low: 3,
        none: 4,
      };
      return (order[a.hkPriority] ?? 5) - (order[b.hkPriority] ?? 5);
    });

  return applySearchAndDate(list, undefined, (r) => [
    r.roomNumber,
    r.buildingName,
    r.floorName,
    r.roomType,
    r.status,
    r.hkAction,
    r.genderPolicy,
  ]);
}

export function processEquipmentInventory(ctx: ReportProcessorContext): any[] {
  const {
    filterBuilding,
    filterFloor,
    filterStatus,
    filterCategory,
    inventoryViewMode,
    equipmentInventory,
    buildingMap,
    floorMap,
    roomMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const rawFiltered = (
    Array.isArray(equipmentInventory) ? equipmentInventory : []
  ).filter((item: any) => {
    const bId = item.buildingId || roomMap[item.roomId]?.buildingId;
    const fId = item.floorId || roomMap[item.roomId]?.floorId;
    if (filterBuilding !== "all" && bId && !filteredBuildingIds.has(bId))
      return false;
    if (filterFloor !== "all" && fId && !filteredFloorIds.has(fId))
      return false;
    if (
      filterStatus !== "all" &&
      item.condition?.toLowerCase() !== filterStatus.toLowerCase()
    )
      return false;
    if (
      filterCategory !== "all" &&
      item.category?.toLowerCase() !== filterCategory.toLowerCase()
    )
      return false;
    return true;
  });

  if (inventoryViewMode === "summary") {
    const map = new Map<string, any>();

    for (const item of rawFiltered) {
      const room = roomMap[item.roomId];
      const roomNum =
        item.roomNumber ||
        room?.roomNumber ||
        (item.roomId ? `#${item.roomId}` : "—");
      const bName =
        item.buildingName || (room ? buildingMap[room.buildingId] : "—") || "—";
      const fName =
        item.floorName || (room ? floorMap[room.floorId] : "—") || "—";
      const normName = normalizeItemName(item.itemName);
      const normCat = (item.category || "other").toLowerCase();
      const key = `${normName}:::${normCat}`;

      if (!map.has(key)) {
        map.set(key, {
          id: key,
          itemName: item.itemName.trim(),
          category: item.category || "other",
          totalQuantity: 0,
          goodCount: 0,
          needsRepairCount: 0,
          damagedCount: 0,
          missingCount: 0,
          roomsSet: new Set<number>(),
          roomsList: [],
        });
      }

      const entry = map.get(key);
      const qty = Number(item.quantity) || 1;
      entry.totalQuantity += qty;

      const cond = (item.condition || "good").toLowerCase();
      if (cond === "good" || cond === "fair") {
        entry.goodCount += qty;
      } else if (cond === "needs_repair") {
        entry.needsRepairCount += qty;
      } else if (cond === "damaged") {
        entry.damagedCount += qty;
      } else if (cond === "missing") {
        entry.missingCount += qty;
      } else {
        entry.goodCount += qty;
      }

      if (item.roomId) {
        entry.roomsSet.add(item.roomId);
        entry.roomsList.push({
          roomId: item.roomId,
          roomNumber: roomNum,
          buildingName: bName,
          floorName: fName,
          quantity: qty,
          condition: item.condition || "good",
          serialNumber: item.serialNumber || "",
          barcode: item.barcode || "",
          notes: item.notes || "",
        });
      }
    }

    const aggregatedList = Array.from(map.values()).map((item) => {
      const uniqueRoomNumbers = Array.from(
        new Set(item.roomsList.map((r: any) => r.roomNumber)),
      );
      return {
        ...item,
        roomsCount: item.roomsSet.size,
        roomsSummary: uniqueRoomNumbers.join(", "),
      };
    });

    // Sort by total quantity descending
    aggregatedList.sort((a, b) => b.totalQuantity - a.totalQuantity);

    return applySearchAndDate(aggregatedList, undefined, (item) => [
      item.itemName,
      item.category,
      item.roomsSummary,
      ...item.roomsList.map((r: any) => r.roomNumber),
    ]);
  }

  // Detailed View Mode
  const list = rawFiltered.map((item: any) => {
    const room = roomMap[item.roomId];
    return {
      id: item.id,
      roomId: item.roomId,
      roomNumber: item.roomNumber || room?.roomNumber || "—",
      buildingName:
        item.buildingName || (room ? buildingMap[room.buildingId] : "—") || "—",
      floorName: item.floorName || (room ? floorMap[room.floorId] : "—") || "—",
      itemName: item.itemName,
      category: item.category || "electronics",
      quantity: item.quantity || 1,
      condition: item.condition || "good",
      barcode: item.barcode || "—",
      serialNumber: item.serialNumber || "—",
      modelNumber: item.modelNumber || "—",
      lastInspectedAt: formatDate(item.lastInspectedAt, "—"),
      inspectedBy: item.inspectedBy || "—",
      notes: item.notes || "",
      createdAt: formatDate(item.createdAt, "—"),
    };
  });

  return applySearchAndDate(list, undefined, (item) => [
    item.roomNumber,
    item.buildingName,
    item.floorName,
    item.itemName,
    item.category,
    item.condition,
    item.serialNumber,
    item.barcode,
    item.modelNumber,
    item.inspectedBy,
    item.notes,
  ]);
}

export function processWaterDistribution(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterDepartment,
    filterGender,
    filterNationality,
    filterEmploymentType,
    waterSortMode,
    floors,
    assignments,
    buildingMap,
    floorMap,
    roomMap,
    empMap,
    applySearchAndDate,
  } = ctx;
  const list = (assignments || [])
    .filter((a: any) => {
      const pId = a.profileId ?? a.profile_id;
      const rId = a.roomId ?? a.room_id;
      const room = roomMap[Number(rId)] || roomMap[rId] || {};
      const emp = empMap[Number(pId)] || empMap[pId] || {};
      const floor = floors.find(
        (f: any) => String(f.id) === String(room.floorId ?? a.floorId),
      );

      // Only active accommodation or vacation records
      if (a.status && a.status !== "ACTIVE" && a.status !== "VACATION")
        return false;

      const isCheckedOut =
        a.status === "CHECKED_OUT" ||
        a.status === "LEFT" ||
        emp.status === "LEFT" ||
        emp.status === "CHECKED_OUT" ||
        a.profileStatus === "LEFT" ||
        a.profileStatus === "CHECKED_OUT";
      if (isCheckedOut) return false;

      const bId = room.buildingId ?? a.buildingId ?? floor?.buildingId;
      const fId = room.floorId ?? a.floorId ?? floor?.id;

      if (filterBuilding && filterBuilding !== "all") {
        if (!bId || String(bId) !== String(filterBuilding)) return false;
      }
      if (filterFloor && filterFloor !== "all") {
        if (!fId || String(fId) !== String(filterFloor)) return false;
      }

      const dept = emp.department || a.profileDepartment;
      if (filterDepartment !== "all" && dept !== filterDepartment) return false;
      const gen = emp.gender || a.profileGender;
      if (filterGender !== "all" && !matchesGender(gen, filterGender))
        return false;
      const nat = emp.nationality || a.profileNationality;
      if (filterNationality !== "all" && nat !== filterNationality)
        return false;

      if (filterEmploymentType && filterEmploymentType !== "all") {
        const empType = String(
          emp.employmentType || a.employmentType || "INTERNAL",
        ).toUpperCase();
        if (filterEmploymentType === "INTERNAL" && empType !== "INTERNAL")
          return false;
        if (filterEmploymentType === "THIRD_PARTY" && empType !== "THIRD_PARTY")
          return false;
      }

      return true;
    })
    .map((a: any) => {
      const pId = a.profileId ?? a.profile_id;
      const rId = a.roomId ?? a.room_id;
      const emp = empMap[Number(pId)] || empMap[pId] || {};
      const room = roomMap[Number(rId)] || roomMap[rId] || {};
      const floor = floors.find(
        (f: any) => String(f.id) === String(room.floorId ?? a.floorId),
      );
      const isEntire = Boolean(
        a.isEntireRoom ||
        a.is_entire_room ||
        a.notes?.includes("[حجز الغرفة بالكامل]") ||
        a.notes?.includes("[تسكين الغرفة بالكامل]"),
      );
      const bedNum = a.bedNumber ?? (isEntire ? 1 : null);
      const bId = room.buildingId ?? a.buildingId ?? floor?.buildingId;
      const fId = room.floorId ?? a.floorId ?? floor?.id;

      const pCode = emp.profileId || a.profileCode || `EMP-${pId}`;
      const fName =
        getProfileDisplayName(
          emp.firstName || emp.firstNameAr
            ? emp
            : {
                firstName: a.profileFirstName,
                lastName: a.profileLastName,
                firstNameAr: a.profileFirstNameAr,
                lastNameAr: a.profileLastNameAr,
                thirdNameAr: a.profileThirdNameAr,
                fourthNameAr: a.profileFourthNameAr,
              },
          ar,
        ) ||
        (ar
          ? a.profileFirstNameAr
            ? `${a.profileFirstNameAr} ${a.profileLastNameAr || ""}`.trim()
            : a.profileFirstName || `Resident #${pId}`
          : a.profileFirstName
            ? `${a.profileFirstName} ${a.profileLastName || ""}`.trim()
            : a.profileFirstNameAr || `Resident #${pId}`);

      const effectiveEmpDept = emp.department
        ? emp
        : {
            department: a.profileDepartment,
            departmentAr: a.profileDepartmentAr,
          };
      const dName =
        getProfileDisplayDepartment(effectiveEmpDept, ar) ||
        (ar
          ? a.profileDepartmentAr || a.profileDepartment
          : a.profileDepartment || a.profileDepartmentAr) ||
        "—";

      const effectiveEmpJob = emp.jobTitle
        ? emp
        : { jobTitle: a.profileJobTitle, jobTitleAr: a.profileJobTitleAr };
      const jTitle =
        getProfileDisplayJobTitle(effectiveEmpJob, ar) ||
        (ar
          ? a.profileJobTitleAr || a.profileJobTitle
          : a.profileJobTitle || a.profileJobTitleAr) ||
        "—";

      const rNum = room.roomNumber || a.roomNumber || `#${rId}`;
      const bName = buildingMap[bId] || a.buildingName || "—";
      const fNum = floor?.floorNumber ?? a.floorNumber;
      const fNameStr =
        fNum !== undefined && fNum !== null
          ? ar
            ? `الدور ${fNum}`
            : `Floor ${fNum}`
          : floorMap[fId]
            ? ar
              ? String(floorMap[fId]).replace(/^Floor\s*/i, "الدور ")
              : String(floorMap[fId]).replace(/^الدور\s*/i, "Floor ")
            : "—";

      return {
        id: a.id,
        profileId: emp.id || pId,
        profileCode: pCode,
        fullName: fName,
        department: dName,
        jobTitle: jTitle,
        roomId: rId,
        roomNumber: rNum,
        bedNumber: bedNum ? String(bedNum) : "—",
        buildingId: bId,
        buildingName: bName,
        floorId: fId,
        floorNumber: fNum,
        floorName: fNameStr,
        waterIssue1: false,
        waterIssue2: false,
        signature: "",
      };
    });

  const sorted = [...list].sort((x: any, y: any) => {
    if (waterSortMode === "department") {
      const deptDiff = (x.department || "").localeCompare(
        y.department || "",
        ar ? "ar" : "en",
      );
      if (deptDiff !== 0) return deptDiff;
      const bldDiff = (x.buildingName || "").localeCompare(
        y.buildingName || "",
        ar ? "ar" : "en",
      );
      if (bldDiff !== 0) return bldDiff;
      const roomDiff = String(x.roomNumber).localeCompare(
        String(y.roomNumber),
        undefined,
        { numeric: true },
      );
      if (roomDiff !== 0) return roomDiff;
      return (x.fullName || "").localeCompare(
        y.fullName || "",
        ar ? "ar" : "en",
      );
    } else {
      const bldDiff = (x.buildingName || "").localeCompare(
        y.buildingName || "",
        ar ? "ar" : "en",
      );
      if (bldDiff !== 0) return bldDiff;
      const floorDiff =
        (Number(x.floorNumber) || 0) - (Number(y.floorNumber) || 0);
      if (floorDiff !== 0) return floorDiff;
      const roomDiff = String(x.roomNumber).localeCompare(
        String(y.roomNumber),
        undefined,
        { numeric: true },
      );
      if (roomDiff !== 0) return roomDiff;
      const bedDiff = String(x.bedNumber).localeCompare(
        String(y.bedNumber),
        undefined,
        { numeric: true },
      );
      if (bedDiff !== 0) return bedDiff;
      return (x.fullName || "").localeCompare(
        y.fullName || "",
        ar ? "ar" : "en",
      );
    }
  });

  return applySearchAndDate(sorted, "", (i) => [
    i.fullName,
    i.profileCode,
    i.department,
    i.roomNumber,
    i.bedNumber,
    i.buildingName,
    i.floorName,
  ]);
}
