// Report row builders — operations. Split out of useReportDataProcessor; logic unchanged.
import { formatDate } from "@/lib/date-utils";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";
import {
  transliterateFullName,
  hasArabicCharacters,
} from "@/lib/bilingual-name-engine";
import { translateDepartment } from "@/lib/bilingual-hospitality-dict";
import { translateReservationStatus } from "../../utils/luxury-report-engine";
import type { ReportProcessorContext } from "./context";
import { comparableDate, matchesRoomType, matchesGender } from "./context";

// OPERA PMS: MANAGER FLASH REPORT (تقرير المدير الصباحي التنفيذي)
export function processManagerFlash(ctx: ReportProcessorContext): any[] {
  const { ar, buildings, rooms, applySearchAndDate } = ctx;
  // Building-by-building capacity matrix for table/export
  const buildingRows = buildings.map((b: any) => {
    const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
    const totalRooms = bRooms.length;
    const totalBeds = bRooms.reduce(
      (acc: number, r: any) => acc + (r.capacity || 1),
      0,
    );
    const occupiedBeds = bRooms.reduce(
      (acc: number, r: any) => acc + (r.currentOccupancy || 0),
      0,
    );
    const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
    const dirtyRooms = bRooms.filter(
      (r: any) => r.status === "dirty" || r.status === "occupied_dirty",
    ).length;
    const oooRooms = bRooms.filter((r: any) =>
      ["maintenance", "out_of_service", "out_of_order", "ooo", "oos"].includes(
        r.status?.toLowerCase(),
      ),
    ).length;
    const occRate =
      totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return {
      id: b.id,
      buildingName: b.name || `#${b.id}`,
      code: b.code || "—",
      totalRooms,
      totalBeds,
      occupiedBeds,
      vacantBeds,
      dirtyRooms,
      oooRooms,
      occupancyRate: `${occRate}%`,
      status:
        occRate >= 90
          ? ar
            ? "إشغال مرتفع"
            : "High Occupancy"
          : ar
            ? "طبيعي"
            : "Normal",
    };
  });

  return applySearchAndDate(buildingRows, undefined, (b) => [
    b.buildingName,
    b.code,
    b.status,
  ]);
}

// OPERA PMS: EXPECTED ARRIVALS MANIFEST (كشف المتوقع وصولهم)
export function processArrivalsManifest(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterDepartment,
    filterRoomType,
    reservations,
    buildingMap,
    floorMap,
    roomMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const list = reservations
    .filter((r: any) => {
      if (r.status?.toUpperCase() === "CANCELLED") return false;
      const room = r.roomId ? roomMap[r.roomId] : null;
      if (
        filterBuilding !== "all" &&
        room &&
        !filteredBuildingIds.has(room.buildingId)
      )
        return false;
      if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId))
        return false;
      if (filterDepartment !== "all" && r.department !== filterDepartment)
        return false;
      if (
        filterStatus !== "all" &&
        r.status?.toLowerCase() !== filterStatus.toLowerCase()
      )
        return false;
      if (filterRoomType !== "all") {
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
      const bName = room ? buildingMap[room.buildingId] || "—" : "—";
      const fName = room ? floorMap[room.floorId] || "—" : "—";
      const checkInD = comparableDate(r.checkInDate);
      const checkOutD = comparableDate(r.checkOutDate);
      let nights = 0;
      if (checkInD && checkOutD) {
        const diffTime = Math.abs(
          new Date(checkOutD).getTime() - new Date(checkInD).getTime(),
        );
        nights = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      }
      return {
        id: r.id,
        profileName: getProfileDisplayName(r, ar) || "—",
        profileId: r.guestIdCardNumber || `RES-${r.id}`,
        nationalId: r.guestIdCardNumber || "—",
        phone: r.guestPhone || "—",
        department: getProfileDisplayDepartment(r, ar) || "—",
        jobTitle: getProfileDisplayJobTitle(r, ar) || "—",
        roomNumber: room
          ? room.roomNumber
          : r.roomNumber || (ar ? "غير محدد" : "Unassigned"),
        buildingName: bName,
        floorName: fName,
        bedNumber: r.bedNumber || (ar ? "سرير 1" : "Bed 1"),
        checkInDate: formatDate(r.checkInDate, "—"),
        checkOutDate: formatDate(r.checkOutDate, "—"),
        nights: nights > 0 ? nights : "—",
        status: ar
          ? translateReservationStatus(r.status, true)
          : r.status || "CONFIRMED",
        vipStatus: r.isVip
          ? ar
            ? "هام (VIP)"
            : "VIP"
          : ar
            ? "عادي"
            : "Standard",
        notes: r.notes || "",
      };
    })
    .sort((a: any, b: any) => {
      const dA = comparableDate(a.checkInDate);
      const dB = comparableDate(b.checkInDate);
      return dA.localeCompare(dB);
    });

  return applySearchAndDate(list, "checkInDate", (r) => [
    r.profileName,
    r.profileId,
    r.nationalId,
    r.phone,
    r.department,
    r.jobTitle,
    r.roomNumber,
    r.buildingName,
    r.status,
    r.notes,
  ]);
}

// OPERA PMS: DUE OUT & DEPARTURES MANIFEST (كشف المغادرات والتصفيات)
export function processDeparturesManifest(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterDepartment,
    filterGender,
    filterNationality,
    filterRoomType,
    assignments,
    buildingMap,
    floorMap,
    roomMap,
    empMap,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  } = ctx;
  const todayStr = new Date().toISOString().split("T")[0];
  const list = assignments
    .filter((a: any) => {
      const emp = empMap[a.profileId] || {};
      const room = roomMap[a.roomId];
      if (
        filterBuilding !== "all" &&
        room &&
        !filteredBuildingIds.has(room.buildingId)
      )
        return false;
      if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId))
        return false;
      if (filterDepartment !== "all" && emp.department !== filterDepartment)
        return false;
      if (filterGender !== "all" && !matchesGender(emp.gender, filterGender))
        return false;
      if (
        filterNationality !== "all" &&
        emp.nationality?.toLowerCase() !== filterNationality.toLowerCase()
      )
        return false;
      if (
        filterRoomType !== "all" &&
        room &&
        !matchesRoomType(room, filterRoomType)
      )
        return false;

      if (a.status === "ACTIVE" || a.status === "CHECKED_OUT") return true;
      return false;
    })
    .map((a: any) => {
      const emp = empMap[a.profileId] || {};
      const room = roomMap[a.roomId] || {};
      const bName = buildingMap[room.buildingId] || "—";
      const fName = floorMap[room.floorId] || "—";
      const expCheckOut = a.checkOutDate || emp.contractEndDate;
      const isDueOut =
        a.status === "ACTIVE" &&
        expCheckOut &&
        comparableDate(expCheckOut) <= todayStr;
      const isCheckedOut = a.status === "CHECKED_OUT";
      const isHrClearance =
        (a.notes || "").toLowerCase().includes("hr departure") ||
        (a.notes || "").includes("تصفية");

      let departureCategory = ar ? "سكن مستمر" : "In-House";
      if (isCheckedOut) {
        departureCategory = isHrClearance
          ? ar
            ? "تمت التصفية (HR)"
            : "HR Departed"
          : ar
            ? "تمت المغادرة"
            : "Checked Out";
      } else if (isDueOut) {
        departureCategory = ar ? "مغادرة اليوم / مستحقة" : "Due Out Today";
      } else if (expCheckOut) {
        departureCategory = ar ? "مغادرة مجدولة" : "Scheduled Departure";
      }

      let displayReason = a.notes || "";
      if (displayReason) {
        displayReason = displayReason
          .replace(/^Auto checkout — HR departure \/ clearance:\s*/i, "")
          .replace(/^تصفية من الموارد البشرية \(HR Departure\):\s*/i, "")
          .trim();
      }
      if (!displayReason) {
        displayReason = isHrClearance
          ? ar
            ? "تصفية ومغادرة عمل من الموارد البشرية"
            : "HR Termination / Clearance"
          : ar
            ? "إخلاء عادي"
            : "Normal Departure";
      }

      return {
        id: a.id,
        profileName: getProfileDisplayName(emp, ar) || `#${a.profileId}`,
        profileId: emp.profileId || "—",
        nationalId: emp.nationalId || "—",
        phone: emp.phone || "—",
        department: getProfileDisplayDepartment(emp, ar) || "—",
        jobTitle: getProfileDisplayJobTitle(emp, ar) || "—",
        roomNumber: room.roomNumber || "—",
        buildingName: bName,
        floorName: fName,
        bedNumber: a.bedNumber || 1,
        checkInDate: formatDate(a.checkInDate, "—"),
        checkOutDate: formatDate(expCheckOut, "—"),
        status: a.status,
        departureCategory,
        reason: displayReason,
        roomStatusAfter:
          room.status === "dirty"
            ? ar
              ? "متسخة (تحتاج نظافة)"
              : "Dirty"
            : room.status || "—",
      };
    })
    .sort((a: any, b: any) => {
      const dA = comparableDate(a.checkOutDate);
      const dB = comparableDate(b.checkOutDate);
      return dB.localeCompare(dA);
    });

  return applySearchAndDate(list, "checkOutDate", (a) => [
    a.profileName,
    a.profileId,
    a.nationalId,
    a.phone,
    a.department,
    a.jobTitle,
    a.roomNumber,
    a.buildingName,
    a.departureCategory,
    a.reason,
  ]);
}

// OPERA PMS: HOUSEKEEPING ATTENDANT TASK SHEET (كشف مهام الهاوس كيبنج اليومي)
export function processHousekeepingSheet(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
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
  const todayStr = new Date().toISOString().split("T")[0];
  const rowsList = rooms
    .filter((room: any) => {
      if (filterBuilding !== "all" && !filteredBuildingIds.has(room.buildingId))
        return false;
      if (filterFloor !== "all" && !filteredFloorIds.has(room.floorId))
        return false;
      if (filterRoomType !== "all" && !matchesRoomType(room, filterRoomType))
        return false;
      if (
        filterStatus !== "all" &&
        room.status?.toLowerCase() !== filterStatus.toLowerCase()
      )
        return false;
      return true;
    })
    .map((room: any) => {
      const bName = buildingMap[room.buildingId] || "—";
      const fName = floorMap[room.floorId] || "—";

      // Find active assignments in this room
      const roomAssignments = assignments.filter(
        (a: any) =>
          a.roomId === room.id &&
          (a.status === "ACTIVE" || a.status === "VACATION"),
      );
      const activeCount = roomAssignments.length;
      const occupantNames = roomAssignments
        .map((a: any) => {
          const emp = empMap[a.profileId];
          if (!emp) return `#${a.profileId}`;
          const name = getProfileDisplayName(emp, ar);
          const deptVal = getProfileDisplayDepartment(emp, ar);
          const dept = deptVal ? ` (${deptVal})` : "";
          return `${name}${dept}`;
        })
        .join("، ");

      // Front office status:
      const foStatus =
        activeCount > 0 ? (ar ? "مشغول" : "Occupied") : ar ? "شاغر" : "Vacant";

      // Check if any resident is checking out today or due out
      const hasDueOut = roomAssignments.some((a: any) => {
        const exp = a.checkOutDate;
        return exp && comparableDate(exp) <= todayStr;
      });

      // Housekeeping status and task priority
      const rStatus = (room.status || "clean").toLowerCase();
      let taskType = ar ? "نظافة يومية" : "Stayover Clean";
      let taskPriority = 2; // 1 = High, 2 = Medium, 3 = Low
      let estimatedMins = 20;

      if (rStatus === "dirty" && activeCount === 0) {
        taskType = ar ? "تجهيز مغادرة (شامل)" : "Departure Turnover";
        taskPriority = 1;
        estimatedMins = 35;
      } else if (hasDueOut) {
        taskType = ar ? "مغادرة اليوم (Turnover)" : "Due Out Turnover";
        taskPriority = 1;
        estimatedMins = 35;
      } else if (activeCount > 0) {
        taskType =
          rStatus === "dirty" || rStatus === "occupied_dirty"
            ? ar
              ? "نظافة مقيم عاجلة"
              : "Occupied Dirty Service"
            : ar
              ? "نظافة يومية وتغيير ملايات"
              : "Daily Stayover";
        taskPriority =
          rStatus === "dirty" || rStatus === "occupied_dirty" ? 1 : 2;
        estimatedMins = 20;
      } else if (
        ["out_of_service", "out_of_order", "maintenance"].includes(rStatus)
      ) {
        taskType = ar ? "غرفة صيانة (معطلة)" : "Out of Order";
        taskPriority = 3;
        estimatedMins = 0;
      } else {
        taskType = ar ? "تفتيش وتجهيز شاغر" : "Vacant Refresh & Inspect";
        taskPriority = 3;
        estimatedMins = 10;
      }

      return {
        id: room.id,
        roomNumber: room.roomNumber,
        buildingName: bName,
        floorName: fName,
        roomType: room.roomType || "Standard",
        capacity: room.capacity || 1,
        activeCount,
        foStatus,
        hkStatus: room.status || "clean",
        taskType,
        taskPriority,
        estimatedMins:
          estimatedMins > 0 ? `${estimatedMins} ${ar ? "دقيقة" : "min"}` : "—",
        occupantNames: occupantNames || (ar ? "لا يوجد نزلاء" : "None"),
        linenCheck: "Pending",
        bathroomCheck: "Pending",
        acCheck: "Pending",
        supervisorSign: "—",
      };
    })
    .sort((a: any, b: any) => {
      if (a.taskPriority !== b.taskPriority)
        return a.taskPriority - b.taskPriority;
      return a.roomNumber.localeCompare(b.roomNumber, undefined, {
        numeric: true,
      });
    });

  return applySearchAndDate(rowsList, undefined, (r) => [
    r.roomNumber,
    r.buildingName,
    r.floorName,
    r.foStatus,
    r.hkStatus,
    r.taskType,
    r.occupantNames,
  ]);
}

// OPERA PMS: ROOM STATUS DISCREPANCY & AUDIT REPORT (تدقيق ومطابقة الغرف والتباينات)
export function processRoomDiscrepancy(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterFloor,
    filterStatus,
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
  const discrepancies: any[] = [];
  let idSeq = 1;

  rooms.forEach((room: any) => {
    if (filterBuilding !== "all" && !filteredBuildingIds.has(room.buildingId))
      return;
    if (filterFloor !== "all" && !filteredFloorIds.has(room.floorId)) return;
    if (filterRoomType !== "all" && !matchesRoomType(room, filterRoomType))
      return;

    const bName = buildingMap[room.buildingId] || "—";
    const fName = floorMap[room.floorId] || "—";
    const rStatus = (room.status || "clean").toLowerCase();

    // Active assignments in this room
    const roomAssignments = assignments.filter(
      (a: any) =>
        a.roomId === room.id &&
        (a.status === "ACTIVE" || a.status === "VACATION"),
    );
    const activeCount = roomAssignments.length;
    const capacity = room.capacity || 1;

    // 1. Sleep Discrepancy: FO says Vacant (0 occupants), but Room status is Occupied or Occupied Dirty
    if (
      activeCount === 0 &&
      (rStatus === "occupied" || rStatus === "occupied_dirty")
    ) {
      discrepancies.push({
        id: idSeq++,
        roomId: room.id,
        roomNumber: room.roomNumber,
        buildingName: bName,
        floorName: fName,
        type: "SLEEP",
        typeLabel: ar ? "نائم غير مسجل (Sleep)" : "Sleep Discrepancy",
        severity: "CRITICAL",
        severityLabel: ar ? "حرج" : "Critical",
        foStatus: ar ? "شاغر (0 نزلاء)" : "Vacant (0 In-House)",
        hkStatus: ar ? "مشغول ميدانياً" : "Occupied in HK",
        impactedResidents: ar
          ? "نزيل غير مسجل بالنظام"
          : "Unrecorded sleeper / Luggage present",
        recommendedAction: ar
          ? "تفتيش فوري وتسجيل التسكين أو تعديل حالة الغرفة"
          : "Inspect immediately, assign profile or set to vacant",
      });
    }

    // 2. Skip Discrepancy: FO says Occupied (>0), but room status is Available/Clean (vacant)
    if (activeCount > 0 && (rStatus === "available" || rStatus === "clean")) {
      discrepancies.push({
        id: idSeq++,
        roomId: room.id,
        roomNumber: room.roomNumber,
        buildingName: bName,
        floorName: fName,
        type: "SKIP",
        typeLabel: ar ? "غادر دون تسجيل (Skip)" : "Skip Discrepancy",
        severity: "CRITICAL",
        severityLabel: ar ? "حرج" : "Critical",
        foStatus: ar
          ? `مشغول (${activeCount} نزلاء)`
          : `Occupied (${activeCount})`,
        hkStatus: ar ? "شاغر / نظيف" : "Vacant / Clean",
        impactedResidents: roomAssignments
          .map((a: any) => {
            const emp = empMap[a.profileId];
            return emp ? getProfileDisplayName(emp, ar) : `#${a.profileId}`;
          })
          .join("، "),
        recommendedAction: ar
          ? "مراجعة المقيم وتسجيل المغادرة واستلام المفاتيح"
          : "Check resident whereabouts & execute checkout",
      });
    }

    // 3. Overcrowded / Capacity Exceeded
    if (activeCount > capacity) {
      discrepancies.push({
        id: idSeq++,
        roomId: room.id,
        roomNumber: room.roomNumber,
        buildingName: bName,
        floorName: fName,
        type: "OVERCROWDED",
        typeLabel: ar
          ? "تجاوز السعة الاستيعابية"
          : "Overcrowded / Bed Overflow",
        severity: "WARNING",
        severityLabel: ar ? "تحذير" : "Warning",
        foStatus: ar ? `${activeCount} نزيل مسكن` : `${activeCount} Assigned`,
        hkStatus: ar
          ? `سعة الغرفة ${capacity} أسرة`
          : `Capacity: ${capacity} Beds`,
        impactedResidents: roomAssignments
          .map((a: any) => {
            const emp = empMap[a.profileId];
            return emp ? getProfileDisplayName(emp, ar) : `#${a.profileId}`;
          })
          .join("، "),
        recommendedAction: ar
          ? "نقل المقيمين الزائدين لغرف أخرى شاغرة"
          : "Transfer extra resident(s) to vacant room",
      });
    }

    // 4. Out of Order / Out of Service with Active Inmates
    if (
      activeCount > 0 &&
      ["out_of_service", "out_of_order", "maintenance", "ooo", "oos"].includes(
        rStatus,
      )
    ) {
      discrepancies.push({
        id: idSeq++,
        roomId: room.id,
        roomNumber: room.roomNumber,
        buildingName: bName,
        floorName: fName,
        type: "OOO_OCCUPIED",
        typeLabel: ar ? "غرفة صيانة وبها مقيمون" : "OOO Room With Occupants",
        severity: "CRITICAL",
        severityLabel: ar ? "حرج" : "Critical",
        foStatus: ar ? `${activeCount} نزيل مسكن` : `${activeCount} Assigned`,
        hkStatus: ar ? "معطلة / خارج الخدمة" : "OOO / Out of Service",
        impactedResidents: roomAssignments
          .map((a: any) => {
            const emp = empMap[a.profileId];
            return emp ? getProfileDisplayName(emp, ar) : `#${a.profileId}`;
          })
          .join("، "),
        recommendedAction: ar
          ? "نقل النزلاء فوراً أو إلغاء الصيانة"
          : "Relocate occupants immediately or restore room",
      });
    }

    // 5. Stale Dirty Room (غرفة متسخة بدون تنظيف)
    if (rStatus === "dirty" && activeCount === 0) {
      discrepancies.push({
        id: idSeq++,
        roomId: room.id,
        roomNumber: room.roomNumber,
        buildingName: bName,
        floorName: fName,
        type: "STALE_DIRTY",
        typeLabel: ar
          ? "شاغرة متسخة بانتظار التجهيز"
          : "Vacant Dirty Turnover Pending",
        severity: "INFO",
        severityLabel: ar ? "تنبيه" : "Info",
        foStatus: ar ? "شاغر (0)" : "Vacant (0)",
        hkStatus: ar ? "متسخ (Dirty)" : "Dirty",
        impactedResidents: ar
          ? "لا يوجد (بانتظار تسكين جديد)"
          : "None (Pending Turnover)",
        recommendedAction: ar
          ? "توجيه فريق النظافة لتجهيز الغرفة للإشغال"
          : "Prioritize room turnover for incoming arrivals",
      });
    }
  });

  // Filter by status/severity if set
  const filteredDiscrepancies = discrepancies.filter((d: any) => {
    if (
      filterStatus !== "all" &&
      d.severity !== filterStatus &&
      d.type !== filterStatus
    )
      return false;
    return true;
  });

  return applySearchAndDate(filteredDiscrepancies, undefined, (d) => [
    d.roomNumber,
    d.buildingName,
    d.typeLabel,
    d.severityLabel,
    d.foStatus,
    d.hkStatus,
    d.impactedResidents,
    d.recommendedAction,
  ]);
}

// 11. DAILY MOVEMENT REPORT (تقرير الحركة اليومية)
export function processDailyMovement(ctx: ReportProcessorContext): any[] {
  const {
    ar,
    filterBuilding,
    filterDepartment,
    filterRoomType,
    assignments,
    reservations,
    buildingMap,
    roomMap,
    empMap,
    filteredBuildingIds,
    applySearchAndDate,
  } = ctx;
  const movements: any[] = [];
  let counter = 1;

  // A. Check-Ins from assignments
  assignments.forEach((a: any) => {
    const emp = empMap[a.profileId] || {};
    const room = roomMap[a.roomId] || {};
    if (
      filterBuilding !== "all" &&
      (!room || !filteredBuildingIds.has(room.buildingId))
    )
      return;
    if (filterDepartment !== "all" && emp?.department !== filterDepartment)
      return;
    if (
      filterRoomType !== "all" &&
      room &&
      !matchesRoomType(room, filterRoomType)
    )
      return;

    if (a.checkInDate) {
      movements.push({
        id: counter++,
        typeKey: "check_in",
        movementType: ar ? "تسكين جديد" : "New Check-In",
        date: formatDate(a.checkInDate, "—"),
        rawDate: a.checkInDate,
        profileName: getProfileDisplayName(emp, ar) || `#${a.profileId}`,
        profileCode: emp.profileId || `EMP-${a.profileId}`,
        department: getProfileDisplayDepartment(emp, ar) || "—",
        roomNumber: room.roomNumber || `#${a.roomId}`,
        bedNumber: a.bedNumber ? String(a.bedNumber) : "1",
        buildingName: buildingMap[room.buildingId] || "—",
        notes: a.notes || (ar ? "تسكين جديد بالسكن" : "New housing check-in"),
      });
    }

    // B. Check-Outs
    if (a.checkOutDate || a.status === "CHECKED_OUT" || a.status === "LEFT") {
      const outDate = a.checkOutDate || a.updatedAt || a.checkInDate;
      movements.push({
        id: counter++,
        typeKey: "check_out",
        movementType: ar ? "مغادرة / تصفية" : "Check-Out",
        date: formatDate(outDate, "—"),
        rawDate: outDate,
        profileName: getProfileDisplayName(emp, ar) || `#${a.profileId}`,
        profileCode: emp.profileId || `EMP-${a.profileId}`,
        department: getProfileDisplayDepartment(emp, ar) || "—",
        roomNumber: room.roomNumber || `#${a.roomId}`,
        bedNumber: a.bedNumber ? String(a.bedNumber) : "1",
        buildingName: buildingMap[room.buildingId] || "—",
        notes: a.reason || (ar ? "إنهاء تسكين ومغادرة" : "Check-out departure"),
      });
    }

    // C. Transfers
    if (a.status === "TRANSFERRED") {
      const transDate = a.updatedAt || a.checkInDate;
      movements.push({
        id: counter++,
        typeKey: "transfer",
        movementType: ar ? "نقل سرير / غرفة" : "Bed Transfer",
        date: formatDate(transDate, "—"),
        rawDate: transDate,
        profileName: getProfileDisplayName(emp, ar) || `#${a.profileId}`,
        profileCode: emp.profileId || `EMP-${a.profileId}`,
        department: getProfileDisplayDepartment(emp, ar) || "—",
        roomNumber: room.roomNumber || `#${a.roomId}`,
        bedNumber: a.bedNumber ? String(a.bedNumber) : "—",
        buildingName: buildingMap[room.buildingId] || "—",
        notes:
          a.notes ||
          (ar
            ? "تم نقل الموظف إلى غرفة أو سرير آخر"
            : "Transferred to another room/bed"),
      });
    }
  });

  // D. Expected Arrivals from reservations
  reservations.forEach((r: any) => {
    if (filterDepartment !== "all" && r.department !== filterDepartment) return;
    if (
      filterBuilding !== "all" &&
      r.buildingId &&
      !filteredBuildingIds.has(r.buildingId)
    )
      return;

    if (r.checkInDate) {
      movements.push({
        id: counter++,
        typeKey: "arrival_expected",
        movementType: ar ? "حجز وصول متوقع" : "Expected Arrival",
        date: formatDate(r.checkInDate, "—"),
        rawDate: r.checkInDate,
        profileName:
          getProfileDisplayName(r, ar) ||
          (r.guestName
            ? ar
              ? hasArabicCharacters(r.guestName)
                ? r.guestName
                : transliterateFullName(r.guestName, "ar")
              : r.guestName
            : "—"),
        profileCode: r.nationalId || `RES-${r.id}`,
        department:
          getProfileDisplayDepartment(r, ar) ||
          (r.department
            ? ar
              ? translateDepartment(r.department, "ar")
              : r.department
            : "—"),
        roomNumber:
          r.roomNumber ||
          (r.roomId ? roomMap[r.roomId]?.roomNumber : "—") ||
          "—",
        bedNumber: "—",
        buildingName: buildingMap[r.buildingId] || "—",
        notes:
          r.specialRequests ||
          r.notes ||
          (ar ? "حجز مؤكد بانتظار الوصول" : "Confirmed reservation"),
      });
    }
  });

  // Sort descending by rawDate
  movements.sort((a, b) => {
    const da = comparableDate(a.rawDate);
    const db = comparableDate(b.rawDate);
    return db.localeCompare(da);
  });

  return applySearchAndDate(movements, "rawDate", (item) => [
    item.movementType,
    item.profileName,
    item.profileCode,
    item.department,
    item.roomNumber,
    item.buildingName,
    item.notes,
  ]);
}
