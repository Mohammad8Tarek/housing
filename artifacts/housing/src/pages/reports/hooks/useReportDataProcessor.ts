import { useMemo } from "react";
import { Tab } from "../types";
import { formatDate, parseDMY } from "@/lib/date-utils";
import {
  getProfileDisplayName,
  getProfileDisplayJobTitle,
  getProfileDisplayDepartment,
} from "@/lib/profile-display-utils";
import { formatNationality } from "@/lib/countries";
import { transliterateFullName, hasArabicCharacters } from "@/lib/bilingual-name-engine";
import { translateDepartment, translateJobTitle } from "@/lib/bilingual-hospitality-dict";
import {
  translateRoomType,
  translateGenderPolicy,
  translateProfileStatus,
  translateReservationStatus,
  translateMaintenanceCategory,
  translateMaintenancePriority,
  translateMaintenanceStatus,
  translateHostingStatus,
  translateHostingRelation,
} from "../utils/luxury-report-engine";

// Normalizes either "YYYY-MM-DD" or display "DD/MM/YYYY" (or "—"/"-")
// to a comparable "YYYY-MM-DD" string for range filtering.
function comparableDate(v: unknown): string {
  const s = String(v ?? "").trim();
  if (!s || s === "—" || s === "-") return "";
  const fromDisplay = parseDMY(s);
  if (fromDisplay) return fromDisplay;
  return s.slice(0, 10);
}

function normalizeItemName(name: string): string {
  if (!name) return "";
  let s = name.trim().toLowerCase();
  s = s.replace(/[إأآا]/g, "ا");
  s = s.replace(/ة/g, "ه");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/\s+/g, " ");
  return s;
}

/**
 * Intelligent room type and capacity matching for reports.
 * Matches bed capacity (1, 2, 3, 4, 5, 6+) as well as specific room type strings (Deluxe, Suite, Single, Double, Triple, Quad, etc.)
 */
export function matchesRoomType(room: any, filterValue: string): boolean {
  if (!filterValue || filterValue === "all") return true;
  if (!room) return false;

  const rType = String(room.roomType || room.room_type || "").trim().toLowerCase();
  const cap = Number(room.capacity || room.bedCapacity || room.bedsCount || 0);
  const fVal = String(filterValue).trim().toLowerCase();

  // 1. Single / 1 Bed
  if (fVal === "1" || fVal === "single" || fVal === "cap:1") {
    return cap === 1 || rType.includes("single") || rType.includes("فردي");
  }

  // 2. Double / 2 Beds
  if (fVal === "2" || fVal === "double" || fVal === "cap:2") {
    return (
      cap === 2 ||
      rType.includes("double") ||
      rType.includes("دوبل") ||
      rType.includes("مزدوج") ||
      rType.includes("ثنائي")
    );
  }

  // 3. Triple / 3 Beds
  if (fVal === "3" || fVal === "triple" || fVal === "trible" || fVal === "cap:3") {
    return (
      cap === 3 ||
      rType.includes("triple") ||
      rType.includes("trible") ||
      rType.includes("تريبل") ||
      rType.includes("ثلاثي")
    );
  }

  // 4. Quad / 4 Beds
  if (fVal === "4" || fVal === "quad" || fVal === "quadruple" || fVal === "cap:4") {
    return (
      cap === 4 ||
      rType.includes("quad") ||
      rType.includes("رباعي") ||
      rType.includes("كوادروبل")
    );
  }

  // 5. 5 Beds
  if (fVal === "5" || fVal === "cap:5") {
    return cap === 5 || rType.includes("خماسي") || rType.includes("5");
  }

  // 6. 6+ Beds
  if (fVal === "6+" || fVal === "cap:6+" || fVal === "6") {
    return cap >= 6 || rType.includes("سداسي");
  }

  // 7. Specific Room Type Name matching (e.g. "Deluxe Room", "Family Suite", "Superior Room")
  if (rType === fVal) return true;
  if (rType && fVal && (rType.includes(fVal) || fVal.includes(rType))) return true;

  return false;
}

export function useReportDataProcessor({
  ar = true,
  activeTab,
  filterBuilding,
  filterFloor,
  filterStatus,
  filterCategory,
  inventoryViewMode = "summary",
  filterDepartment,
  filterGender,
  filterNationality,
  filterRoomType,
  filterEmploymentType,
  waterSortMode = "room",
  search,
  dateFrom,
  dateTo,
  buildings,
  floors,
  rooms,
  profiles,
  assignments,
  reservations,
  maintenance,
  hostings,
  equipmentInventory = [],
  gateLogs = [],
  vacations = [],
  buildingMap,
  floorMap,
  roomMap,
  empMap,
  settings = {},
}: any) {
  const filteredBuildingIds = useMemo(() => {
    return new Set(
      filterBuilding === "all" || !filterBuilding
        ? buildings.map((b: any) => b.id)
        : [Number(filterBuilding)],
    );
  }, [filterBuilding, buildings]);

  const filteredFloorIds = useMemo(() => {
    return new Set(
      floors
        .filter((f: any) => {
          if (!filteredBuildingIds.has(f.buildingId)) return false;
          if (filterFloor !== "all" && filterFloor && f.id !== Number(filterFloor)) return false;
          return true;
        })
        .map((f: any) => f.id),
    );
  }, [floors, filteredBuildingIds, filterFloor]);

  // Generic Search & Date Range Filter helper
  const applySearchAndDate = (
    data: any[],
    dateField?: string,
    searchFields?: (item: any) => (string | number | null | undefined)[],
  ): any[] => {
    return data.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const fields = searchFields
          ? searchFields(item)
          : Object.values(item);
        const match = fields.some((f) =>
          f != null && String(f).toLowerCase().includes(q),
        );
        if (!match) return false;
      }
      if (dateField && (dateFrom || dateTo)) {
        const rawDate = item[dateField];
        if (!rawDate) return true;
        const d = comparableDate(rawDate);
        if (!d) return true;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  };

  const currentData = (): any[] => {
    switch (activeTab) {
      // OPERA PMS: MANAGER FLASH REPORT (تقرير المدير الصباحي التنفيذي)
      case "manager_flash": {
        // Building-by-building capacity matrix for table/export
        const buildingRows = buildings.map((b: any) => {
          const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
          const totalRooms = bRooms.length;
          const totalBeds = bRooms.reduce((acc: number, r: any) => acc + (r.capacity || 1), 0);
          const occupiedBeds = bRooms.reduce((acc: number, r: any) => acc + (r.currentOccupancy || 0), 0);
          const vacantBeds = Math.max(0, totalBeds - occupiedBeds);
          const dirtyRooms = bRooms.filter((r: any) => r.status === "dirty" || r.status === "occupied_dirty").length;
          const oooRooms = bRooms.filter((r: any) => ["maintenance", "out_of_service", "out_of_order", "ooo", "oos"].includes(r.status?.toLowerCase())).length;
          const occRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

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
            status: occRate >= 90 ? (ar ? "إشغال مرتفع" : "High Occupancy") : (ar ? "طبيعي" : "Normal"),
          };
        });

        return applySearchAndDate(buildingRows, undefined, (b) => [
          b.buildingName,
          b.code,
          b.status,
        ]);
      }

      // OPERA PMS: EXPECTED ARRIVALS MANIFEST (كشف المتوقع وصولهم)
      case "arrivals_manifest": {
        const list = reservations
          .filter((r: any) => {
            if (r.status?.toUpperCase() === "CANCELLED") return false;
            const room = r.roomId ? roomMap[r.roomId] : null;
            if (filterBuilding !== "all" && room && !filteredBuildingIds.has(room.buildingId)) return false;
            if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId)) return false;
            if (filterDepartment !== "all" && r.department !== filterDepartment) return false;
            if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
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
              const diffTime = Math.abs(new Date(checkOutD).getTime() - new Date(checkInD).getTime());
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
              roomNumber: room ? room.roomNumber : (r.roomNumber || (ar ? "غير محدد" : "Unassigned")),
              buildingName: bName,
              floorName: fName,
              bedNumber: r.bedNumber || (ar ? "سرير 1" : "Bed 1"),
              checkInDate: formatDate(r.checkInDate, "—"),
              checkOutDate: formatDate(r.checkOutDate, "—"),
              nights: nights > 0 ? nights : "—",
              status: ar ? translateReservationStatus(r.status, true) : (r.status || "CONFIRMED"),
              vipStatus: r.isVip ? (ar ? "هام (VIP)" : "VIP") : (ar ? "عادي" : "Standard"),
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
      case "departures_manifest": {
        const todayStr = new Date().toISOString().split("T")[0];
        const list = assignments
          .filter((a: any) => {
            const emp = empMap[a.profileId] || {};
            const room = roomMap[a.roomId];
            if (filterBuilding !== "all" && room && !filteredBuildingIds.has(room.buildingId)) return false;
            if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId)) return false;
            if (filterDepartment !== "all" && emp.department !== filterDepartment) return false;
            if (filterGender !== "all" && emp.gender?.toLowerCase() !== filterGender.toLowerCase()) return false;
            if (filterNationality !== "all" && emp.nationality?.toLowerCase() !== filterNationality.toLowerCase()) return false;
            if (filterRoomType !== "all" && room && !matchesRoomType(room, filterRoomType)) return false;

            if (a.status === "ACTIVE" || a.status === "CHECKED_OUT") return true;
            return false;
          })
          .map((a: any) => {
            const emp = empMap[a.profileId] || {};
            const room = roomMap[a.roomId] || {};
            const bName = buildingMap[room.buildingId] || "—";
            const fName = floorMap[room.floorId] || "—";
            const expCheckOut = a.checkOutDate || emp.contractEndDate;
            const isDueOut = a.status === "ACTIVE" && expCheckOut && comparableDate(expCheckOut) <= todayStr;
            const isCheckedOut = a.status === "CHECKED_OUT";
            const isHrClearance = (a.notes || "").toLowerCase().includes("hr departure") || (a.notes || "").includes("تصفية");

            let departureCategory = ar ? "سكن مستمر" : "In-House";
            if (isCheckedOut) {
              departureCategory = isHrClearance ? (ar ? "تمت التصفية (HR)" : "HR Departed") : (ar ? "تمت المغادرة" : "Checked Out");
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
                ? (ar ? "تصفية ومغادرة عمل من الموارد البشرية" : "HR Termination / Clearance")
                : (ar ? "إخلاء عادي" : "Normal Departure");
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
              roomStatusAfter: room.status === "dirty" ? (ar ? "متسخة (تحتاج نظافة)" : "Dirty") : (room.status || "—"),
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
      case "housekeeping_sheet": {
        const todayStr = new Date().toISOString().split("T")[0];
        const rowsList = rooms
          .filter((room: any) => {
            if (filterBuilding !== "all" && !filteredBuildingIds.has(room.buildingId)) return false;
            if (filterFloor !== "all" && !filteredFloorIds.has(room.floorId)) return false;
            if (filterRoomType !== "all" && !matchesRoomType(room, filterRoomType)) return false;
            if (filterStatus !== "all" && room.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
            return true;
          })
          .map((room: any) => {
            const bName = buildingMap[room.buildingId] || "—";
            const fName = floorMap[room.floorId] || "—";
            
            // Find active assignments in this room
            const roomAssignments = assignments.filter(
              (a: any) => a.roomId === room.id && (a.status === "ACTIVE" || a.status === "VACATION")
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
            const foStatus = activeCount > 0 ? (ar ? "مشغول" : "Occupied") : (ar ? "شاغر" : "Vacant");

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
              taskType = rStatus === "dirty" || rStatus === "occupied_dirty"
                ? (ar ? "نظافة مقيم عاجلة" : "Occupied Dirty Service")
                : (ar ? "نظافة يومية وتغيير ملايات" : "Daily Stayover");
              taskPriority = rStatus === "dirty" || rStatus === "occupied_dirty" ? 1 : 2;
              estimatedMins = 20;
            } else if (["out_of_service", "out_of_order", "maintenance"].includes(rStatus)) {
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
              estimatedMins: estimatedMins > 0 ? `${estimatedMins} ${ar ? "دقيقة" : "min"}` : "—",
              occupantNames: occupantNames || (ar ? "لا يوجد نزلاء" : "None"),
              linenCheck: "Pending",
              bathroomCheck: "Pending",
              acCheck: "Pending",
              supervisorSign: "—",
            };
          })
          .sort((a: any, b: any) => {
            if (a.taskPriority !== b.taskPriority) return a.taskPriority - b.taskPriority;
            return a.roomNumber.localeCompare(b.roomNumber, undefined, { numeric: true });
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
      case "room_discrepancy": {
        const discrepancies: any[] = [];
        let idSeq = 1;

        rooms.forEach((room: any) => {
          if (filterBuilding !== "all" && !filteredBuildingIds.has(room.buildingId)) return;
          if (filterFloor !== "all" && !filteredFloorIds.has(room.floorId)) return;
          if (filterRoomType !== "all" && !matchesRoomType(room, filterRoomType)) return;

          const bName = buildingMap[room.buildingId] || "—";
          const fName = floorMap[room.floorId] || "—";
          const rStatus = (room.status || "clean").toLowerCase();

          // Active assignments in this room
          const roomAssignments = assignments.filter(
            (a: any) => a.roomId === room.id && (a.status === "ACTIVE" || a.status === "VACATION")
          );
          const activeCount = roomAssignments.length;
          const capacity = room.capacity || 1;

          // 1. Sleep Discrepancy: FO says Vacant (0 occupants), but Room status is Occupied or Occupied Dirty
          if (activeCount === 0 && (rStatus === "occupied" || rStatus === "occupied_dirty")) {
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
              impactedResidents: ar ? "نزيل غير مسجل بالنظام" : "Unrecorded sleeper / Luggage present",
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
              foStatus: ar ? `مشغول (${activeCount} نزلاء)` : `Occupied (${activeCount})`,
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
              typeLabel: ar ? "تجاوز السعة الاستيعابية" : "Overcrowded / Bed Overflow",
              severity: "WARNING",
              severityLabel: ar ? "تحذير" : "Warning",
              foStatus: ar ? `${activeCount} نزيل مسكن` : `${activeCount} Assigned`,
              hkStatus: ar ? `سعة الغرفة ${capacity} أسرة` : `Capacity: ${capacity} Beds`,
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
          if (activeCount > 0 && ["out_of_service", "out_of_order", "maintenance", "ooo", "oos"].includes(rStatus)) {
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
              typeLabel: ar ? "شاغرة متسخة بانتظار التجهيز" : "Vacant Dirty Turnover Pending",
              severity: "INFO",
              severityLabel: ar ? "تنبيه" : "Info",
              foStatus: ar ? "شاغر (0)" : "Vacant (0)",
              hkStatus: ar ? "متسخ (Dirty)" : "Dirty",
              impactedResidents: ar ? "لا يوجد (بانتظار تسكين جديد)" : "None (Pending Turnover)",
              recommendedAction: ar
                ? "توجيه فريق النظافة لتجهيز الغرفة للإشغال"
                : "Prioritize room turnover for incoming arrivals",
            });
          }
        });

        // Filter by status/severity if set
        const filteredDiscrepancies = discrepancies.filter((d: any) => {
          if (filterStatus !== "all" && d.severity !== filterStatus && d.type !== filterStatus) return false;
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

      // OPERA PMS: 7/14/30-DAY OCCUPANCY & AVAILABILITY FORECAST (توقعات الإشغال المستقبلية)
      case "occupancy_forecast": {
        const horizon = 14;
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const fRooms = filterBuilding === "all" || !filterBuilding
          ? rooms
          : rooms.filter((r: any) => r.buildingId === Number(filterBuilding));
        
        const totalBeds = fRooms.reduce((acc: number, r: any) => acc + (r.capacity || 1), 0);
        const fRoomIds = new Set(fRooms.map((r: any) => r.id));

        const activeAssignments = assignments.filter(
          (a: any) => fRoomIds.has(a.roomId) && (a.status === "ACTIVE" || a.status === "VACATION")
        );

        let runningInHouse = activeAssignments.length;
        const dailyRows = [];

        for (let i = 0; i < horizon; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() + i);
          const dIso = d.toISOString().split("T")[0];

          const dayNameAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][d.getDay()];
          const dayNameEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
          const dayName = ar ? dayNameAr : dayNameEn;

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
          const occRate = totalBeds > 0 ? Math.round((projectedOccupied / totalBeds) * 100) : 0;

          dailyRows.push({
            id: i + 1,
            dateIso: dIso,
            dateDisplay: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`,
            dayName,
            dayArrivals,
            dayDepartures,
            netShift: netShift > 0 ? `+${netShift}` : `${netShift}`,
            projectedOccupied,
            projectedVacant,
            totalBeds,
            occupancyRate: `${occRate}%`,
            demandLevel: occRate >= 90 ? (ar ? "ذروة إشغال" : "Peak") : occRate >= 75 ? (ar ? "إشغال مرتفع" : "High") : (ar ? "طبيعي" : "Normal"),
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
      case "assignments": {
        const list = assignments
          .filter((a: any) => {
            const room = roomMap[a.roomId];
            const emp = empMap[a.profileId] || {};
            const isVacation = (emp.status || a.profileStatus || "").toUpperCase() === "VACATION";
            const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT" || emp.status === "LEFT" || emp.status === "CHECKED_OUT";
            const effectiveStatus = isCheckedOut ? "CHECKED_OUT" : (isVacation ? "VACATION" : (a.status || "ACTIVE"));

            if (filterBuilding !== "all" && (!room || !filteredBuildingIds.has(room.buildingId))) return false;
            if (filterFloor !== "all" && (!room || !filteredFloorIds.has(room.floorId))) return false;
            
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

            if (filterDepartment !== "all" && emp?.department !== filterDepartment) return false;
            if (filterGender !== "all" && emp?.gender?.toLowerCase() !== filterGender.toLowerCase()) return false;
            if (filterNationality !== "all" && emp?.nationality !== filterNationality) return false;
            if (filterRoomType !== "all" && !matchesRoomType(room, filterRoomType)) return false;
            if (filterEmploymentType !== "all") {
              const et = emp?.employmentType || "INTERNAL";
              if (et.toLowerCase() !== filterEmploymentType.toLowerCase()) return false;
            }
            return true;
          })
          .map((a: any) => {
            const emp = empMap[a.profileId] || {};
            const room = roomMap[a.roomId] || {};
            const isVacation = (emp.status || a.profileStatus || "").toUpperCase() === "VACATION";
            const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT" || emp.status === "LEFT" || emp.status === "CHECKED_OUT";
            const effectiveStatus = isCheckedOut ? "CHECKED_OUT" : (isVacation ? "VACATION" : (a.status || "ACTIVE"));
            const isEntire = Boolean(
              a.isEntireRoom ||
              a.is_entire_room ||
              a.notes?.includes("[حجز الغرفة بالكامل]") ||
              a.notes?.includes("[تسكين الغرفة بالكامل]")
            );
            const bedNum = a.bedNumber ?? (isEntire ? 1 : null);

            return {
              id: a.id,
              profileId: emp.id,
              profileCode: emp.profileId || `EMP-${a.profileId}`,
              firstName: ar ? (emp.firstNameAr || emp.firstName || "—") : (emp.firstName || "—"),
              lastName: ar ? (emp.lastNameAr || emp.lastName || "") : (emp.lastName || ""),
              thirdName: ar ? (emp.thirdNameAr || emp.thirdName || "—") : (emp.thirdName || "—"),
              fourthName: ar ? (emp.fourthNameAr || emp.fourthName || "—") : (emp.fourthName || "—"),
              fullName: getProfileDisplayName(emp, ar) || `#${a.profileId}`,
              nationalId: emp.nationalId || "—",
              nationality: ar ? formatNationality(emp.nationality, ar, false) : (emp.nationality || "—"),
              phone: emp.phone || "—",
              department: getProfileDisplayDepartment(emp, ar) || "—",
              jobTitle: getProfileDisplayJobTitle(emp, ar) || "—",
              level: emp.level || "—",
              employmentType: emp.employmentType || "INTERNAL",
              companyName: emp.companyName || (emp.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : (ar ? "الفندق" : "Hotel")),
              roomId: a.roomId,
              roomNumber: room.roomNumber || `#${a.roomId}`,
              roomType: ar ? translateRoomType(room.roomType, true) : (room.roomType || "—"),
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
      case "vacant_rooms": {
        const activeAssByRoom = new Map<number, Set<number>>();
        const roomHasFullLock = new Map<number, boolean>();
        assignments
          .filter((a: any) => a.status?.toLowerCase() === "active")
          .forEach((a: any) => {
            if (!activeAssByRoom.has(a.roomId)) activeAssByRoom.set(a.roomId, new Set());
            const isFullLock = Boolean(
              a.isEntireRoom ||
              a.is_entire_room ||
              a.notes?.includes("[حجز الغرفة بالكامل]") ||
              a.notes?.includes("[تسكين الغرفة بالكامل]")
            );
            if (isFullLock) roomHasFullLock.set(a.roomId, true);
            if (a.bedNumber != null) activeAssByRoom.get(a.roomId)!.add(a.bedNumber);
          });

        const list = rooms
          .filter((r: any) => {
            const isOutOfOrder = ["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(r.status?.toLowerCase());
            if (isOutOfOrder) return false;
            if (roomHasFullLock.get(r.id)) return false; // Full Lock: no vacant beds
            const cap = r.capacity || 1;
            const assignedCount = activeAssByRoom.get(r.id)?.size ?? 0;
            const occ = Math.max(r.currentOccupancy || 0, assignedCount);
            const vacantBeds = Math.max(0, cap - occ);
            if (vacantBeds <= 0) return false; // Only rooms with available space

            if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId)) return false;
            if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
            if (filterRoomType !== "all" && !matchesRoomType(r, filterRoomType)) return false;
            if (filterStatus !== "all") {
              const fs = filterStatus.toLowerCase();
              if (fs === "available" && occ > 0) return false;
              if (fs === "partially" && (occ === 0 || occ >= cap)) return false;
              if (fs === "dirty" && r.status?.toLowerCase() !== "dirty") return false;
            }
            if (filterGender !== "all" && r.genderPolicy?.toLowerCase() !== filterGender.toLowerCase()) return false;
            return true;
          })
          .map((r: any) => {
            const cap = r.capacity || 1;
            const occupiedBeds = activeAssByRoom.get(r.id) || new Set();
            const occ = Math.min(cap, Math.max(r.currentOccupancy || 0, occupiedBeds.size));
            const vacantBedsCount = Math.max(0, cap - occ);
            const availableBedNumbers: number[] = [];
            for (let b = 1; b <= cap; b++) {
              if (!occupiedBeds.has(b)) availableBedNumbers.push(b);
            }

            return {
              id: r.id,
              roomNumber: r.roomNumber,
              buildingName: buildingMap[r.buildingId] || "—",
              floorName: floorMap[r.floorId] || "—",
              roomType: ar ? translateRoomType(r.roomType, true) : (r.roomType || "Standard"),
              capacity: cap,
              currentOccupancy: occ,
              vacantBedsCount,
              availableBedsText: availableBedNumbers.map((b) => (ar ? `سرير ${b}` : `Bed ${b}`)).join(", ") || (ar ? "أي سرير" : "Any Bed"),
              genderPolicy: ar ? translateGenderPolicy(r.genderPolicy, true) : (r.genderPolicy || "Any"),
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

      // 3. COMPLETE ROOM INVENTORY REPORT (جرد وحالة الغرف بالكامل)
      case "housing": {
        const activeAssByRoom = new Map<number, number>();
        const roomHasFullLock = new Map<number, boolean>();
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
          });

        const list = rooms
          .filter((r: any) => {
            if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId)) return false;
            if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
            if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
            if (filterRoomType !== "all" && !matchesRoomType(r, filterRoomType)) return false;
            if (filterGender !== "all" && r.genderPolicy?.toLowerCase() !== filterGender.toLowerCase()) return false;
            return true;
          })
          .map((r: any) => {
            const cap = r.capacity || 1;
            const isFullLock = roomHasFullLock.get(r.id);
            const occ = isFullLock ? cap : Math.min(cap, Math.max(r.currentOccupancy || 0, activeAssByRoom.get(r.id) || 0));
            const vacantBeds = Math.max(0, cap - occ);
            const rate = cap > 0 ? Math.round((occ / cap) * 100) : 0;
            return {
              id: r.id,
              roomNumber: r.roomNumber,
              buildingName: buildingMap[r.buildingId] || "—",
              floorName: floorMap[r.floorId] || "—",
              roomType: ar ? translateRoomType(r.roomType, true) : (r.roomType || "Standard"),
              capacity: cap,
              currentOccupancy: occ,
              vacantBeds,
              occupancyRate: `${rate}%`,
              genderPolicy: ar ? translateGenderPolicy(r.genderPolicy, true) : (r.genderPolicy || "—"),
              status: isFullLock ? "occupied" : (r.status || "available"),
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

      // 4. PROFILES DIRECTORY REPORT (دليل البروفايلات)
      case "profiles": {
        const activeAssByProfile = new Map<number, any>();
        assignments
          .filter((a: any) => a.status?.toLowerCase() === "active")
          .forEach((a: any) => activeAssByProfile.set(a.profileId, a));

        const list = profiles
          .filter((e: any) => {
            if (filterStatus !== "all" && e.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
            if (filterDepartment !== "all" && e.department !== filterDepartment) return false;
            if (filterGender !== "all" && e.gender?.toLowerCase() !== filterGender.toLowerCase()) return false;
            if (filterNationality !== "all" && e.nationality !== filterNationality) return false;
            if (filterEmploymentType !== "all") {
              const et = e.employmentType || "INTERNAL";
              if (et.toLowerCase() !== filterEmploymentType.toLowerCase()) return false;
            }
            return true;
          })
          .map((e: any) => {
            const asgn = activeAssByProfile.get(e.id);
            const room = asgn ? roomMap[asgn.roomId] : null;
            return {
              id: e.id,
              profileCode: e.profileId || `EMP-${e.id}`,
              firstName: ar ? (e.firstNameAr || e.firstName) : e.firstName,
              lastName: ar ? (e.lastNameAr || e.lastName) : e.lastName,
              thirdName: ar ? (e.thirdNameAr || e.thirdName || "—") : (e.thirdName || "—"),
              fourthName: ar ? (e.fourthNameAr || e.fourthName || "—") : (e.fourthName || "—"),
              fullName: getProfileDisplayName(e, ar),
              nationalId: e.nationalId || "—",
              nationality: ar ? formatNationality(e.nationality, ar, false) : (e.nationality || "—"),
              phone: e.phone || "—",
              gender: e.gender || "M",
              dateOfBirth: formatDate(e.dateOfBirth, "—"),
              department: getProfileDisplayDepartment(e, ar) || "—",
              jobTitle: getProfileDisplayJobTitle(e, ar) || "—",
              level: e.level || "—",
              employmentType: e.employmentType || "INTERNAL",
              companyName: e.companyName || (e.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : (ar ? "الفندق" : "Hotel")),
              hireDate: formatDate(e.hireDate, "—"),
              contractEndDate: formatDate(e.contractEndDate, "—"),
              address: e.address || "—",
              email: e.email || "—",
              emergencyContact: e.emergencyContact || "—",
              status: ar ? translateProfileStatus(e.status, true) : (e.status || "ACTIVE"),
              assignedRoom: room
                ? `${room.roomNumber} (${asgn?.bedNumber ? (ar ? `سرير ${asgn.bedNumber}` : `Bed ${asgn.bedNumber}`) : ""})`
                : (ar ? "غير مسكن" : "Unassigned"),
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
      case "expiring_contracts": {
        const now = new Date();
        const activeAssByProfile = new Map<number, any>();
        assignments
          .filter((a: any) => a.status?.toLowerCase() === "active")
          .forEach((a: any) => activeAssByProfile.set(a.profileId, a));

        const list = profiles
          .filter((p: any) => {
            if (p.employmentType === "THIRD_PARTY" || !p.contractEndDate) return false;
            if (filterDepartment !== "all" && p.department !== filterDepartment) return false;
            if (filterGender !== "all" && p.gender?.toLowerCase() !== filterGender.toLowerCase()) return false;
            if (filterNationality !== "all" && p.nationality !== filterNationality) return false;
            
            const exp = new Date(p.contractEndDate);
            const diffDays = Math.ceil((exp.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
            if (filterStatus === "expired" && diffDays >= 0) return false;
            if (filterStatus === "expiring_30" && (diffDays < 0 || diffDays > 30)) return false;
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
                  ? (ar ? "منتهي" : "Expired")
                  : diffDays <= 30
                  ? (ar ? "ينتهي قريباً" : "Expiring Soon")
                  : (ar ? "ساري" : "Active"),
              assignedRoom: room
                ? (ar ? `غرفة ${room.roomNumber} (${buildingMap[room.buildingId] || ""})` : `Room ${room.roomNumber} (${buildingMap[room.buildingId] || ""})`)
                : (ar ? "غير مسكن" : "Unassigned"),
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
      case "reservations": {
        const list = reservations
          .filter((r: any) => {
            if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
            if (filterDepartment !== "all" && r.department !== filterDepartment) return false;
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
              guestName: getProfileDisplayName(r, ar) || (r.guestName ? (ar ? (hasArabicCharacters(r.guestName) ? r.guestName : transliterateFullName(r.guestName, "ar")) : r.guestName) : "—"),
              nationalId: r.guestIdCardNumber || "—",
              phone: r.guestPhone || "—",
              department: getProfileDisplayDepartment(r, ar) || "—",
              jobTitle: getProfileDisplayJobTitle(r, ar) || "—",
              roomType: ar ? translateRoomType(r.roomType, true) : (r.roomType || "—"),
              roomNumber: room ? room.roomNumber : "—",
              checkInDate: formatDate(r.checkInDate, "—"),
              checkOutDate: formatDate(r.checkOutDate, "—"),
              status: ar ? translateReservationStatus(r.status, true) : (r.status || "UPCOMING"),
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
      case "hostings": {
        const list = hostings
          .filter((h: any) => {
            const room = h.roomId ? roomMap[h.roomId] : null;
            if (filterBuilding !== "all" && room && !filteredBuildingIds.has(room.buildingId)) return false;
            if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId)) return false;
            if (filterStatus !== "all" && h.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
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
              guestName: ar ? (hasArabicCharacters(h.guestName) ? h.guestName : transliterateFullName(h.guestName, "ar")) : (h.guestName || "—"),
              relation: ar ? translateHostingRelation(h.relationship, true) : (h.relationship || "—"),
              guestId: h.guestNationalId || "—",
              roomNumber: room ? room.roomNumber : "—",
              checkInDate: formatDate(h.expectedFrom, "—"),
              checkOutDate: formatDate(h.expectedTo, "—"),
              dailyRate: h.dailyRate ? `${h.dailyRate} EGP` : "—",
              totalAmount: h.totalAmount ? `${h.totalAmount} EGP` : "—",
              status: ar ? translateHostingStatus(h.status, true) : (h.status || "pending"),
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

      // 8. MAINTENANCE (الصيانة)
      case "maintenance": {
        const list = maintenance
          .filter((m: any) => {
            const room = roomMap[m.roomId];
            if (filterBuilding !== "all" && room && !filteredBuildingIds.has(room.buildingId)) return false;
            if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId)) return false;
            if (filterStatus !== "all" && m.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
            if (filterCategory !== "all" && m.category?.toLowerCase() !== filterCategory.toLowerCase()) return false;
            return true;
          })
          .map((m: any) => {
            const room = roomMap[m.roomId] || {};
            const bName = m.buildingName || buildingMap[room.buildingId] || "—";
            const fNum = m.floorNumber || (room.floorId ? floorMap[room.floorId] : null);
            const fName = fNum ? (String(fNum).toLowerCase().includes("floor") || String(fNum).includes("دور") ? fNum : (ar ? `الدور ${fNum}` : `Floor ${fNum}`)) : "—";
            const reporter = m.reportedBy ? (ar ? (hasArabicCharacters(m.reportedBy) ? m.reportedBy : transliterateFullName(m.reportedBy, "ar")) : m.reportedBy) : (ar ? "غير محدد" : "Unspecified");

            return {
              id: m.id,
              issueId: m.id,
              roomNumber: m.roomNumber || room.roomNumber || `#${m.roomId}`,
              location: `${m.roomNumber || room.roomNumber || `#${m.roomId}`} (${bName})`,
              building: bName,
              buildingName: bName,
              floor: fName,
              floorName: fName,
              category: ar ? translateMaintenanceCategory(m.category, true) : (m.category || "General"),
              rawCategory: m.category || "maintenance",
              problemType: m.problemType || "—",
              issueDescription: m.problemType || "—",
              priority: ar ? translateMaintenancePriority(m.priority, true) : (m.priority || "Normal"),
              rawPriority: m.priority || "Normal",
              reportedBy: reporter,
              assignedTo: m.workerName || m.assignedToName ? (ar ? (hasArabicCharacters(m.workerName || m.assignedToName) ? (m.workerName || m.assignedToName) : transliterateFullName(m.workerName || m.assignedToName, "ar")) : (m.workerName || m.assignedToName)) : (m.assignedTo || "—"),
              reportedAt: formatDate(m.reportedAt, "—"),
              rawReportedAt: m.reportedAt,
              resolvedAt: m.resolvedAt ? formatDate(m.resolvedAt, "—") : (m.status === "completed" || m.status === "resolved" ? formatDate(m.updatedAt || m.reportedAt, "—") : "—"),
              status: ar ? translateMaintenanceStatus(m.status, true) : (m.status || "open"),
              resolutionStatus: ar ? translateMaintenanceStatus(m.status, true) : (m.status || "open"),
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
      case "housekeeping": {
        const list = rooms
          .filter((r: any) => {
            if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId)) return false;
            if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
            if (filterRoomType !== "all" && !matchesRoomType(r, filterRoomType)) return false;
            if (filterGender !== "all" && r.genderPolicy?.toLowerCase() !== filterGender.toLowerCase()) return false;
            // Status filter: map housekeeping-relevant statuses
            if (filterStatus !== "all") {
              const s = r.status?.toLowerCase();
              if (filterStatus === "dirty" && s !== "dirty") return false;
              if (filterStatus === "occupied_dirty" && s !== "occupied_dirty") return false;
              if (filterStatus === "available" && s !== "available") return false;
              if (filterStatus === "occupied" && s !== "occupied") return false;
              if (filterStatus === "maintenance" && s !== "maintenance") return false;
              if (filterStatus === "out_of_service" && !["out_of_service", "oos"].includes(s)) return false;
              if (filterStatus === "out_of_order" && !["out_of_order", "ooo"].includes(s)) return false;
            }
            return true;
          })
          .map((r: any) => {
            const cap = r.capacity || 1;
            const occ = r.currentOccupancy || 0;
            const s = r.status?.toLowerCase();
            // Housekeeping priority based on status
            const hkPriority =
              s === "dirty" ? "high" :
              s === "occupied_dirty" ? "high" :
              s === "occupied" ? "low" :
              s === "available" ? "none" :
              s === "maintenance" ? "maintenance" :
              "normal";

            const hkAction =
              s === "dirty" ? (ar ? "تنظيف فوري" : "Immediate Cleaning") :
              s === "occupied_dirty" ? (ar ? "تنظيف عند الخروج" : "Clean on Checkout") :
              s === "available" ? (ar ? "جاهزة" : "Ready") :
              s === "occupied" ? (ar ? "مشغولة — لا تزعج" : "Occupied — DND") :
              s === "maintenance" ? (ar ? "صيانة" : "Under Maintenance") :
              (ar ? "مراجعة" : "Review");

            // Count open housekeeping tickets for this room
            const hkTickets = maintenance.filter(
              (m: any) =>
                m.roomId === r.id &&
                m.category?.toLowerCase() === "housekeeping" &&
                !["resolved", "closed", "cancelled"].includes(m.status?.toLowerCase()),
            ).length;

            return {
              id: r.id,
              roomNumber: r.roomNumber,
              buildingName: buildingMap[r.buildingId] || "—",
              floorName: floorMap[r.floorId] || "—",
              roomType: ar ? translateRoomType(r.roomType, true) : (r.roomType || "Standard"),
              capacity: cap,
              currentOccupancy: occ,
              vacantBeds: Math.max(0, cap - occ),
              genderPolicy: ar ? translateGenderPolicy(r.genderPolicy, true) : (r.genderPolicy || "—"),
              status: r.status || "available",
              hkPriority: ar ? (hkPriority === "high" ? "مرتفعة" : hkPriority === "maintenance" ? "صيانة" : hkPriority === "low" ? "منخفضة" : hkPriority === "none" ? "لا يوجد" : "عادية") : hkPriority,
              hkAction,
              openHkTickets: hkTickets,
              lastCleaned: formatDate(r.lastCleanedAt, "—"),
            };
          })
          // Sort: dirty first, then occupied_dirty, then maintenance, then rest
          .sort((a: any, b: any) => {
            const order: Record<string, number> = { high: 0, maintenance: 1, normal: 2, low: 3, none: 4 };
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

      case "equipment_inventory": {
        const rawFiltered = (Array.isArray(equipmentInventory) ? equipmentInventory : [])
          .filter((item: any) => {
            const bId = item.buildingId || (roomMap[item.roomId]?.buildingId);
            const fId = item.floorId || (roomMap[item.roomId]?.floorId);
            if (filterBuilding !== "all" && bId && !filteredBuildingIds.has(bId)) return false;
            if (filterFloor !== "all" && fId && !filteredFloorIds.has(fId)) return false;
            if (filterStatus !== "all" && item.condition?.toLowerCase() !== filterStatus.toLowerCase()) return false;
            if (filterCategory !== "all" && item.category?.toLowerCase() !== filterCategory.toLowerCase()) return false;
            return true;
          });

        if (inventoryViewMode === "summary") {
          const map = new Map<string, any>();

          for (const item of rawFiltered) {
            const room = roomMap[item.roomId];
            const roomNum = item.roomNumber || room?.roomNumber || (item.roomId ? `#${item.roomId}` : "—");
            const bName = item.buildingName || (room ? buildingMap[room.buildingId] : "—") || "—";
            const fName = item.floorName || (room ? floorMap[room.floorId] : "—") || "—";
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
              new Set(item.roomsList.map((r: any) => r.roomNumber))
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
            buildingName: item.buildingName || (room ? buildingMap[room.buildingId] : "—") || "—",
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

      // 11. DAILY MOVEMENT REPORT (تقرير الحركة اليومية)
      case "daily_movement": {
        const movements: any[] = [];
        let counter = 1;

        // A. Check-Ins from assignments
        assignments.forEach((a: any) => {
          const emp = empMap[a.profileId] || {};
          const room = roomMap[a.roomId] || {};
          if (filterBuilding !== "all" && (!room || !filteredBuildingIds.has(room.buildingId))) return;
          if (filterDepartment !== "all" && emp?.department !== filterDepartment) return;
          if (filterRoomType !== "all" && room && !matchesRoomType(room, filterRoomType)) return;

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
              notes: a.notes || (ar ? "تم نقل الموظف إلى غرفة أو سرير آخر" : "Transferred to another room/bed"),
            });
          }
        });

        // D. Expected Arrivals from reservations
        reservations.forEach((r: any) => {
          if (filterDepartment !== "all" && r.department !== filterDepartment) return;
          if (filterBuilding !== "all" && r.buildingId && !filteredBuildingIds.has(r.buildingId)) return;

          if (r.checkInDate) {
            movements.push({
              id: counter++,
              typeKey: "arrival_expected",
              movementType: ar ? "حجز وصول متوقع" : "Expected Arrival",
              date: formatDate(r.checkInDate, "—"),
              rawDate: r.checkInDate,
              profileName: getProfileDisplayName(r, ar) || (r.guestName ? (ar ? (hasArabicCharacters(r.guestName) ? r.guestName : transliterateFullName(r.guestName, "ar")) : r.guestName) : "—"),
              profileCode: r.nationalId || `RES-${r.id}`,
              department: getProfileDisplayDepartment(r, ar) || (r.department ? (ar ? translateDepartment(r.department, "ar") : r.department) : "—"),
              roomNumber: r.roomNumber || (r.roomId ? roomMap[r.roomId]?.roomNumber : "—") || "—",
              bedNumber: "—",
              buildingName: buildingMap[r.buildingId] || "—",
              notes: r.specialRequests || r.notes || (ar ? "حجز مؤكد بانتظار الوصول" : "Confirmed reservation"),
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

      // 12. DEPARTMENT OCCUPANCY REPORT (إشغال الأقسام)
      case "department_occupancy": {
        const deptMap: Record<string, {
          department: string;
          residentCount: number;
          maleCount: number;
          femaleCount: number;
          roomsSet: Set<string>;
          buildingsSet: Set<string>;
        }> = {};

        let totalActiveResidents = 0;

        assignments.forEach((a: any) => {
          const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT";
          if (isCheckedOut) return;

          const emp = empMap[a.profileId] || {};
          const room = roomMap[a.roomId] || {};

          if (filterBuilding !== "all" && (!room || !filteredBuildingIds.has(room.buildingId))) return;
          if (filterFloor !== "all" && (!room || !filteredFloorIds.has(room.floorId))) return;
          if (filterDepartment !== "all" && emp?.department !== filterDepartment) return;

          const deptName = getProfileDisplayDepartment(emp, ar) || (ar ? "غير محدد" : "Unspecified");

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

          const genderStr = (emp.gender || "").toLowerCase();
          if (genderStr === "female" || emp.gender === "أنثى") {
            deptMap[deptName].femaleCount += 1;
          } else {
            deptMap[deptName].maleCount += 1;
          }

          if (room.roomNumber) {
            deptMap[deptName].roomsSet.add(room.roomNumber);
          }
          const bName = buildingMap[room.buildingId];
          if (bName) {
            deptMap[deptName].buildingsSet.add(bName);
          }
        });

        const list = Object.values(deptMap).map((d, idx) => ({
          id: idx + 1,
          department: d.department,
          residentCount: d.residentCount,
          maleCount: d.maleCount,
          femaleCount: d.femaleCount,
          roomsCount: d.roomsSet.size,
          shareOfHousing:
            totalActiveResidents > 0
              ? `${((d.residentCount / totalActiveResidents) * 100).toFixed(1)}%`
              : "0.0%",
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

      // 13. GATE LOGS REPORT (سجل البوابة والأمن)
      case "gate_logs": {
        const list = gateLogs
          .filter((g: any) => {
            if (filterDepartment !== "all" && g.department !== filterDepartment) return false;
            return true;
          })
          .map((g: any) => {
            const rawDate = g.scannedAt ? String(g.scannedAt).slice(0, 10) : "";
            const isExit = g.direction === "exit" || g.direction === "OUT";
            const isValid = g.status === "valid" || g.status === "APPROVED" || g.status === "success";

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
              action: isExit ? (ar ? "خروج" : "Exit") : (ar ? "دخول" : "Entry"),
              direction: g.direction,
              profileName: ar ? (hasArabicCharacters(g.fullName) ? g.fullName : transliterateFullName(g.fullName, "ar")) : (g.fullName || "—"),
              profileCode: g.employeeId || "—",
              department: ar ? translateDepartment(g.department, "ar") : (g.department || "—"),
              jobTitle: ar ? translateJobTitle(g.jobTitle, "ar") : (g.jobTitle || "—"),
              roomNumber: g.roomNumber || "—",
              buildingName: g.buildingName || "—",
              guardName: g.scannedBy || (ar ? "مسؤول الأمن" : "Security Officer"),
              status: isValid
                ? (ar ? "تصريح ساري ومطابق" : "Valid & Approved")
                : (ar ? "مرفوض / غير صالح" : "Invalid / Denied"),
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
      case "police_report": {
        const list = assignments
          .filter((a: any) => {
            const room = roomMap[a.roomId];
            const emp = empMap[a.profileId] || {};
            const isVacation = (emp.status || a.profileStatus || "").toUpperCase() === "VACATION";
            const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT" || emp.status === "LEFT" || emp.status === "CHECKED_OUT";
            const effectiveStatus = isCheckedOut ? "CHECKED_OUT" : (isVacation ? "VACATION" : (a.status || "ACTIVE"));

            if (filterBuilding !== "all" && (!room || !filteredBuildingIds.has(room.buildingId))) return false;
            if (filterFloor !== "all" && (!room || !filteredFloorIds.has(room.floorId))) return false;
            if (filterStatus === "all" || !filterStatus) {
              if (isCheckedOut) return false;
            } else if (filterStatus === "ACTIVE") {
              if (effectiveStatus !== "ACTIVE") return false;
            } else if (filterStatus === "VACATION") {
              if (effectiveStatus !== "VACATION") return false;
            } else if (filterStatus === "CHECKED_OUT") {
              if (effectiveStatus !== "CHECKED_OUT") return false;
            }

            if (filterDepartment !== "all" && emp?.department !== filterDepartment) return false;
            if (filterGender !== "all" && emp?.gender?.toLowerCase() !== filterGender.toLowerCase()) return false;
            if (filterNationality !== "all" && emp?.nationality !== filterNationality) return false;
            if (filterRoomType !== "all" && !matchesRoomType(room, filterRoomType)) return false;
            if (filterEmploymentType !== "all") {
              const et = emp?.employmentType || "INTERNAL";
              if (et.toLowerCase() !== filterEmploymentType.toLowerCase()) return false;
            }
            return true;
          })
          .map((a: any) => {
            const emp = empMap[a.profileId] || {};
            const room = roomMap[a.roomId] || {};
            const isVacation = (emp.status || a.profileStatus || "").toUpperCase() === "VACATION";
            const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT" || emp.status === "LEFT" || emp.status === "CHECKED_OUT";
            const effectiveStatus = isCheckedOut ? "CHECKED_OUT" : (isVacation ? "VACATION" : (a.status || "ACTIVE"));
            const isEntire = Boolean(
              a.isEntireRoom ||
              a.is_entire_room ||
              a.notes?.includes("[حجز الغرفة بالكامل]") ||
              a.notes?.includes("[تسكين الغرفة بالكامل]")
            );
            const bedNum = a.bedNumber ?? (isEntire ? 1 : null);

            return {
              id: a.id,
              profileId: emp.id,
              profileCode: emp.profileId || `EMP-${a.profileId}`,
              firstName: ar ? (emp.firstNameAr || emp.firstName || "—") : (emp.firstName || "—"),
              lastName: ar ? (emp.lastNameAr || emp.lastName || "") : (emp.lastName || ""),
              thirdName: ar ? (emp.thirdNameAr || emp.thirdName || "—") : (emp.thirdName || "—"),
              fourthName: ar ? (emp.fourthNameAr || emp.fourthName || "—") : (emp.fourthName || "—"),
              fullName: getProfileDisplayName(emp, ar) || `#${a.profileId}`,
              nationalId: emp.nationalId || "—",
              nationality: ar ? formatNationality(emp.nationality, ar, false) : (emp.nationality || "—"),
              dateOfBirth: formatDate(emp.dateOfBirth, "—"),
              gender: emp.gender || "M",
              jobTitle: getProfileDisplayJobTitle(emp, ar) || "—",
              department: getProfileDisplayDepartment(emp, ar) || "—",
              level: emp.level || "—",
              employmentType: emp.employmentType || "INTERNAL",
              companyName: emp.companyName || (emp.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : (ar ? "الفندق" : "Hotel")),
              address: emp.address || "—",
              phone: emp.phone || "—",
              roomId: a.roomId,
              roomNumber: room.roomNumber || `#${a.roomId}`,
              bedNumber: bedNum ? String(bedNum) : "—",
              isEntireRoom: isEntire,
              buildingName: buildingMap[room.buildingId] || "—",
              floorName: floorMap[room.floorId] || "—",
              rawCheckInDate: a.checkInDate,
              checkInDate: formatDate(a.checkInDate, "—"),
              hireDate: formatDate(emp.hireDate, "—"),
              contractEndDate: formatDate(emp.contractEndDate, "—"),
              email: emp.email || "—",
              emergencyContact: emp.emergencyContact || "—",
              status: ar ? translateProfileStatus(effectiveStatus, true) : effectiveStatus,
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

      case "water_distribution": {
        const list = assignments
          .filter((a: any) => {
            const room = roomMap[a.roomId];
            const emp = empMap[a.profileId] || {};
            const isCheckedOut = a.status === "CHECKED_OUT" || a.status === "LEFT" || emp.status === "LEFT" || emp.status === "CHECKED_OUT";
            if (isCheckedOut) return false;

            if (filterBuilding !== "all" && (!room || !filteredBuildingIds.has(room.buildingId))) return false;
            if (filterFloor !== "all" && (!room || !filteredFloorIds.has(room.floorId))) return false;
            if (filterDepartment !== "all" && emp?.department !== filterDepartment) return false;
            if (filterGender !== "all" && emp?.gender?.toLowerCase() !== filterGender.toLowerCase()) return false;
            if (filterNationality !== "all" && emp?.nationality !== filterNationality) return false;
            return true;
          })
          .map((a: any) => {
            const emp = empMap[a.profileId] || {};
            const room = roomMap[a.roomId] || {};
            const floor = floors.find((f: any) => f.id === room.floorId);
            const isEntire = Boolean(
              a.isEntireRoom ||
              a.is_entire_room ||
              a.notes?.includes("[حجز الغرفة بالكامل]") ||
              a.notes?.includes("[تسكين الغرفة بالكامل]")
            );
            const bedNum = a.bedNumber ?? (isEntire ? 1 : null);

            return {
              id: a.id,
              profileId: emp.id,
              profileCode: emp.profileId || `EMP-${a.profileId}`,
              fullName: getProfileDisplayName(emp, ar),
              department: getProfileDisplayDepartment(emp, ar) || "—",
              jobTitle: getProfileDisplayJobTitle(emp, ar) || "—",
              roomId: a.roomId,
              roomNumber: room.roomNumber || `#${a.roomId}`,
              bedNumber: bedNum ? String(bedNum) : "—",
              buildingId: room.buildingId,
              buildingName: buildingMap[room.buildingId] || "—",
              floorId: room.floorId,
              floorNumber: floor?.floorNumber ?? 0,
              floorName: floorMap[room.floorId] || (floor?.floorNumber !== undefined ? `${ar ? "الدور" : "Floor"} ${floor.floorNumber}` : "—"),
              waterIssue1: false,
              waterIssue2: false,
              signature: "",
            };
          });

        const sorted = [...list].sort((x: any, y: any) => {
          if (waterSortMode === "department") {
            const deptDiff = (x.department || "").localeCompare(y.department || "", ar ? "ar" : "en");
            if (deptDiff !== 0) return deptDiff;
            const bldDiff = (x.buildingName || "").localeCompare(y.buildingName || "", ar ? "ar" : "en");
            if (bldDiff !== 0) return bldDiff;
            const roomDiff = String(x.roomNumber).localeCompare(String(y.roomNumber), undefined, { numeric: true });
            if (roomDiff !== 0) return roomDiff;
            return (x.fullName || "").localeCompare(y.fullName || "", ar ? "ar" : "en");
          } else {
            const bldDiff = (x.buildingName || "").localeCompare(y.buildingName || "", ar ? "ar" : "en");
            if (bldDiff !== 0) return bldDiff;
            const floorDiff = (Number(x.floorNumber) || 0) - (Number(y.floorNumber) || 0);
            if (floorDiff !== 0) return floorDiff;
            const roomDiff = String(x.roomNumber).localeCompare(String(y.roomNumber), undefined, { numeric: true });
            if (roomDiff !== 0) return roomDiff;
            const bedDiff = String(x.bedNumber).localeCompare(String(y.bedNumber), undefined, { numeric: true });
            if (bedDiff !== 0) return bedDiff;
            return (x.fullName || "").localeCompare(y.fullName || "", ar ? "ar" : "en");
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

      // POLICY EXCEPTIONS & LEVEL AUDIT REPORT (تقرير استثناءات ومخالفات السياسة والدرجات الوظيفية)
      case "policy_exceptions": {
        const exceptions: any[] = [];
        const policySettings = settings || {};

        const l0Cap = Number(policySettings?.policyLevel0Capacity) || 1;
        const l1Cap = Number(policySettings?.policyLevel1Capacity) || 1;
        const l2Cap = Number(policySettings?.policyLevel2Capacity) || 2;
        const l3Cap = Number(policySettings?.policyLevel3Capacity) || 3;
        const l4Cap = Number(policySettings?.policyLevel4Capacity) || 4;
        const l5Cap = Number(policySettings?.policyLevel5Capacity) || 5;
        const l6Cap = Number(policySettings?.policyLevel6Capacity) || 6;
        const customRules: any[] = Array.isArray(policySettings?.customLevelRules) ? policySettings.customLevelRules : [];
        const jobPolicies: any[] = Array.isArray(policySettings?.jobLevelPolicies) ? policySettings.jobLevelPolicies : [];
        const clusterEnabled = policySettings?.policyDepartmentClustering ?? true;
        const strictSegregation = policySettings?.policyStrictDepartmentSegregation ?? false;

        // Group active assignments by room
        const activeByRoom = new Map<number, any[]>();
        for (const a of assignments) {
          if (a.status === "ACTIVE" || a.status === "VACATION") {
            const list = activeByRoom.get(a.roomId) || [];
            list.push(a);
            activeByRoom.set(a.roomId, list);
          }
        }

        const todayStr = new Date().toISOString().split("T")[0];

        // 1. Audit active occupants
        for (const a of assignments) {
          if (a.status !== "ACTIVE" && a.status !== "VACATION") continue;
          const room = roomMap[a.roomId];
          const emp = empMap[a.profileId];
          if (!emp || !room) continue;

          if (filterBuilding !== "all" && !filteredBuildingIds.has(room.buildingId)) continue;
          if (filterFloor !== "all" && !filteredFloorIds.has(room.floorId)) continue;
          if (filterDepartment !== "all" && emp.department !== filterDepartment) continue;

          const bName = buildingMap[room.buildingId] || "—";
          const roomCap = room.capacity || 1;
          const roomOcc = activeByRoom.get(room.id)?.length || 1;
          const lvl = String(emp.level || "").trim().toLowerCase();
          const profileDept = (emp.department || "").trim().toLowerCase();

          let maxAllowedCap = l4Cap;
          let allowedCapacities: number[] | null = null;
          let allowEntireConfigured: boolean | null = null;
          let levelCategory = ar ? "الدرجة الرابعة (عمال/خدمات)" : "Level 4 (General Staff)";

          const matchedJob = jobPolicies.length > 0 ? jobPolicies.find((jp: any) => {
            const key = String(jp.levelKey ?? "").trim().toLowerCase();
            const name = String(jp.name ?? "").trim().toLowerCase();
            const nameAr = String(jp.nameAr ?? "").trim().toLowerCase();
            const id = String(jp.id ?? "").trim().toLowerCase();

            if (key && (lvl === key || lvl === `level ${key}` || lvl === `level_${key}`)) return true;
            if (id && (lvl === id || lvl === `level_${id}`)) return true;
            if (name && (lvl === name || lvl.includes(name) || name.includes(lvl))) return true;
            if (nameAr && (lvl === nameAr || lvl.includes(nameAr) || nameAr.includes(lvl))) return true;

            if (key === "0" && (lvl === "vip" || lvl.includes("قيادات") || lvl.includes("عليا") || lvl.includes("إدارة عليا") || lvl.includes("chief") || lvl.includes("director") || lvl.includes("gm"))) return true;
            if (key === "1" && (lvl.includes("مدير إدارة") || lvl.includes("مدير قسم") || lvl.includes("مدير فندق") || lvl.includes("head") || lvl.includes("hod"))) return true;
            if (key === "2" && (lvl.includes("إشراف") || lvl.includes("مشرف") || lvl.includes("supervisor") || lvl.includes("نائب"))) return true;
            if (key === "3" && (lvl.includes("فني") || lvl.includes("technician") || lvl.includes("senior") || lvl.includes("officer") || lvl.includes("موظف"))) return true;
            if (key === "4" && (lvl.includes("عامل") || lvl.includes("worker") || lvl.includes("سائق") || lvl.includes("خدمات"))) return true;
            return false;
          }) : null;

          if (matchedJob) {
            allowedCapacities = Array.isArray(matchedJob.allowedCapacities) && matchedJob.allowedCapacities.length > 0
              ? matchedJob.allowedCapacities.map(Number).filter((n: number) => !isNaN(n) && n > 0)
              : [1];
            maxAllowedCap = Math.max(...(allowedCapacities ?? [1]));
            allowEntireConfigured = Boolean(matchedJob.allowEntire);
            levelCategory = ar ? (matchedJob.nameAr || matchedJob.name) : (matchedJob.name || matchedJob.nameAr);
          } else {
            const matchedCustom = customRules.find((cr: any) => {
              const crName = String(cr.name || "").trim().toLowerCase();
              const crNameAr = String(cr.nameAr || "").trim().toLowerCase();
              return (crName && lvl === crName) || (crNameAr && lvl === crNameAr) || (crName && lvl.includes(crName));
            });

            if (matchedCustom) {
              maxAllowedCap = Number(matchedCustom.capacity) || 4;
              allowedCapacities = [maxAllowedCap];
              allowEntireConfigured = Boolean(matchedCustom.allowEntire);
              levelCategory = ar ? (matchedCustom.nameAr || matchedCustom.name) : (matchedCustom.name || matchedCustom.nameAr);
            } else if (
              lvl === "0" ||
              lvl === "level 0" ||
              lvl === "vip" ||
              lvl.includes("قيادات") ||
              lvl.includes("عليا") ||
              lvl.includes("إدارة عليا") ||
              lvl.includes("chief") ||
              lvl.includes("controller") ||
              lvl.includes("gm") ||
              lvl.includes("director")
            ) {
              maxAllowedCap = l0Cap;
              allowedCapacities = [l0Cap];
              allowEntireConfigured = policySettings?.policyLevel0AllowEntire ?? true;
              levelCategory = ar ? "الدرجة صفر (إدارة عليا / قيادات)" : "Level 0 (Top Executive / VIP)";
            } else if (lvl === "1" || lvl === "level 1" || lvl.includes("مدير قسم") || lvl.includes("مدير إدارة") || lvl.includes("head") || lvl.includes("hod")) {
              maxAllowedCap = l1Cap;
              allowedCapacities = [l1Cap];
              allowEntireConfigured = policySettings?.policyLevel1AllowEntire ?? true;
              levelCategory = ar ? "الدرجة الأولى (مدراء أقسام)" : "Level 1 (Department Heads)";
            } else if (lvl === "2" || lvl === "level 2" || lvl.includes("مشرف") || lvl.includes("supervisor") || lvl.includes("manager")) {
              maxAllowedCap = l2Cap;
              allowedCapacities = [l2Cap];
              allowEntireConfigured = policySettings?.policyLevel2AllowEntire ?? false;
              levelCategory = ar ? "الدرجة الثانية (إشرافي/مساعدين)" : "Level 2 (Supervisory)";
            } else if (lvl === "3" || lvl === "level 3" || lvl.includes("فني") || lvl.includes("specialist") || lvl.includes("senior")) {
              maxAllowedCap = l3Cap;
              allowedCapacities = [l3Cap];
              allowEntireConfigured = false;
              levelCategory = ar ? "الدرجة الثالثة (فني/تخصصي)" : "Level 3 (Senior/Staff)";
            } else if (lvl === "5" || lvl === "level 5" || lvl.includes("خامس") || lvl.includes("level 5") || lvl.includes("5")) {
              maxAllowedCap = l5Cap;
              allowedCapacities = [l5Cap];
              allowEntireConfigured = policySettings?.policyLevel5AllowEntire ?? false;
              levelCategory = ar ? "الدرجة الخامسة (عمال معاونون)" : "Level 5 (Support Staff)";
            } else if (lvl === "6" || lvl === "level 6" || lvl.includes("سادس") || lvl.includes("level 6") || lvl.includes("6")) {
              maxAllowedCap = l6Cap;
              allowedCapacities = [l6Cap];
              allowEntireConfigured = policySettings?.policyLevel6AllowEntire ?? false;
              levelCategory = ar ? "الدرجة السادسة (تسكين مكثف)" : "Level 6 (Intensive Shared)";
            } else {
              allowedCapacities = [l4Cap];
              allowEntireConfigured = false;
            }
          }

          const itemDate = a.startDate || a.createdAt || (a as any).policyExceptionDate || (a as any).updatedAt || "";
          const isApprovedException = Boolean(
            (a as any).hasPolicyException ||
            (a.notes && (a.notes.includes("استثناء") || a.notes.includes("override")))
          );
          const exceptionApprover =
            (a as any).policyApprovedBy ||
            (a.notes?.match(/المعتمد:\s*([^\]|]+)/)?.[1]?.trim()) ||
            (isApprovedException ? (ar ? "إدارة السكن" : "Housing Admin") : "—");
          const exceptionReasonText =
            (a as any).policyExceptionReason ||
            a.notes ||
            (ar ? "لا يوجد تصريح مسجل" : "No override noted");
          const approvalStatusText = isApprovedException
            ? (ar ? "معتمد رسمياً" : "Approved")
            : (ar ? "غير معتمد / مخالفة" : "Unapproved");

          // Check A: Capacity Exceeded or Mismatched
          const isCapViolated = allowedCapacities && allowedCapacities.length > 0
            ? !allowedCapacities.includes(roomCap)
            : roomCap > maxAllowedCap;

          if (isCapViolated) {
            exceptions.push({
              id: `cap_${a.id}`,
              categoryKey: "capacity",
              requestDate: itemDate,
              profileName: getProfileDisplayName(emp, ar) || "—",
              profileCode: emp.profileId || emp.code || "—",
              nationalId: emp.nationalId || "—",
              jobLevel: emp.level || levelCategory,
              department: getProfileDisplayDepartment(emp, ar) || "—",
              roomNumber: room.roomNumber || "—",
              buildingName: bName,
              roomCapacity: roomCap,
              currentOccupancy: roomOcc,
              violationType: ar ? "تجاوز سعة الدرجة الوظيفية" : "Level Capacity Exceeded",
              violationDetails: ar
                ? `المقيم من ${levelCategory} ومسكن بغرفة سعتها (${roomCap} أفراد) والسعات المعتمدة للسياسة (${(allowedCapacities || [maxAllowedCap]).join(" أو ")} سرير)`
                : `Resident is ${levelCategory} in a room of ${roomCap} beds (policy allowed: ${(allowedCapacities || [maxAllowedCap]).join(", ")})`,
              severity: ar ? "مرتفعة" : "High",
              approvalStatus: approvalStatusText,
              approvedBy: exceptionApprover,
              overrideReason: exceptionReasonText,
            });
          }

          // Check B: Department Segregation / Mixing
          const roommates = (activeByRoom.get(room.id) || [])
            .filter((x: any) => x.id !== a.id)
            .map((x: any) => empMap[x.profileId])
            .filter(Boolean);

          if (profileDept && roommates.length > 0) {
            const diffDeptRoommates = roommates.filter(
              (rm: any) => (rm.department || "").trim().toLowerCase() !== profileDept && (rm.department || "").trim() !== ""
            );
            if ((strictSegregation || clusterEnabled) && diffDeptRoommates.length > 0) {
              exceptions.push({
                id: `dept_${a.id}`,
                categoryKey: "department",
                requestDate: itemDate,
                profileName: getProfileDisplayName(emp, ar) || "—",
                profileCode: emp.profileId || emp.code || "—",
                nationalId: emp.nationalId || "—",
                jobLevel: emp.level || levelCategory,
                department: getProfileDisplayDepartment(emp, ar) || "—",
                roomNumber: room.roomNumber || "—",
                buildingName: bName,
                roomCapacity: roomCap,
                currentOccupancy: roomOcc,
                violationType: strictSegregation
                  ? (ar ? "مخالفة صارمة لفصل الأقسام" : "Strict Department Mixing Violation")
                  : (ar ? "خلط أقسام مختلفة بالغرفة" : "Cross-Department Clustering Exception"),
                violationDetails: ar
                  ? `الغرفة تضم أقساماً مختلفة: قسم (${emp.department}) مع قسم (${diffDeptRoommates.map((d: any) => d.department).join(", ")})`
                  : `Room contains mixed departments: (${emp.department}) with (${diffDeptRoommates.map((d: any) => d.department).join(", ")})`,
                severity: strictSegregation ? (ar ? "حرجة" : "Critical") : (ar ? "متوسطة" : "Medium"),
                approvalStatus: approvalStatusText,
                approvedBy: exceptionApprover,
                overrideReason: exceptionReasonText,
              });
            }
          }

          // Check C: Unauthorized Entire Room Booking
          if (a.isEntireRoom && roomCap > 1) {
            const isL0 =
              lvl === "0" ||
              lvl === "level 0" ||
              lvl === "vip" ||
              lvl.includes("قيادات") ||
              lvl.includes("عليا") ||
              lvl.includes("إدارة عليا") ||
              lvl.includes("chief") ||
              lvl.includes("controller") ||
              lvl.includes("gm") ||
              lvl.includes("director");
            const isL1 = !isL0 && (lvl === "1" || lvl === "level 1" || lvl.includes("مدير"));
            const isL2 = !isL0 && !isL1 && (lvl === "2" || lvl === "level 2" || lvl.includes("مشرف") || lvl.includes("supervisor"));
            const allowEntire = allowEntireConfigured != null
              ? allowEntireConfigured
              : (isL0
                ? (policySettings?.policyLevel0AllowEntire ?? true)
                : isL1
                ? (policySettings?.policyLevel1AllowEntire ?? true)
                : isL2
                ? (policySettings?.policyLevel2AllowEntire ?? false)
                : false);
            if (!allowEntire) {
              exceptions.push({
                id: `entire_${a.id}`,
                categoryKey: "entire_room",
                requestDate: itemDate,
                profileName: getProfileDisplayName(emp, ar) || "—",
                profileCode: emp.profileId || emp.code || "—",
                nationalId: emp.nationalId || "—",
                jobLevel: emp.level || levelCategory,
                department: getProfileDisplayDepartment(emp, ar) || "—",
                roomNumber: room.roomNumber || "—",
                buildingName: bName,
                roomCapacity: roomCap,
                currentOccupancy: roomOcc,
                violationType: ar ? "حجز غرفة كاملة غير مصرح" : "Unauthorized Entire Room",
                violationDetails: ar
                  ? `حجز غرفة متعددة الأسرة (${roomCap} سرير) بالكامل لشخص واحد غير مصرح له في السياسة`
                  : `Entire multi-bed room (${roomCap} beds) reserved by a single occupant not entitled in policy`,
                severity: ar ? "مرتفعة" : "High",
                approvalStatus: approvalStatusText,
                approvedBy: exceptionApprover,
                overrideReason: exceptionReasonText,
              });
            }
          }

          // Check D: Strict Gender Segregation Check
          const strictGender = policySettings?.policyStrictGenderSegregation !== false;
          const empGender = (emp.gender || "").trim().toLowerCase();
          const roomGender = (room.gender || "").trim().toLowerCase();
          if (strictGender && empGender) {
            let genderViolation = false;
            let genderDetails = "";
            if (roomGender && roomGender !== "any" && roomGender !== "all" && roomGender !== empGender) {
              genderViolation = true;
              genderDetails = ar
                ? `المقيم (${empGender === "female" ? "أنثى" : "ذكر"}) مسكن بغرفة مخصصة لـ (${roomGender === "female" ? "الإناث" : "الذكور"})`
                : `Resident (${empGender}) assigned to (${roomGender}) room`;
            }
            const conflictingRoommates = roommates.filter((rm: any) => {
              const g = (rm.gender || "").trim().toLowerCase();
              return g && g !== empGender;
            });
            if (conflictingRoommates.length > 0) {
              genderViolation = true;
              genderDetails = ar
                ? `تسكين مشترك مختلط: تضم الغرفة ذكوراً وإناثاً (${conflictingRoommates.map((r: any) => r.firstName || r.name).join(", ")})`
                : `Mixed gender sharing: Room houses opposite genders`;
            }

            if (genderViolation) {
              exceptions.push({
                id: `gender_${a.id}`,
                categoryKey: "gender",
                requestDate: itemDate,
                profileName: getProfileDisplayName(emp, ar) || "—",
                profileCode: emp.profileId || emp.code || "—",
                nationalId: emp.nationalId || "—",
                jobLevel: emp.level || levelCategory,
                department: getProfileDisplayDepartment(emp, ar) || "—",
                roomNumber: room.roomNumber || "—",
                buildingName: bName,
                roomCapacity: roomCap,
                currentOccupancy: roomOcc,
                violationType: ar ? "مخالفة فصل الجنسين الصارمة" : "Strict Gender Mixing Violation",
                violationDetails: genderDetails,
                severity: ar ? "حرجة" : "Critical",
                approvalStatus: approvalStatusText,
                approvedBy: exceptionApprover,
                overrideReason: exceptionReasonText,
              });
            }
          }

          // Check E: Strict Family Segregation Check
          const strictFamily = policySettings?.policyStrictFamilySegregation !== false;
          if (strictFamily) {
            const roomCls = (room.classification || room.roomType || "").toLowerCase();
            const isFamilyRoom =
              roomCls.includes("family") ||
              roomCls.includes("عائل") ||
              roomCls.includes("suite");
            const isFamilyEmp = Boolean(
              emp.isFamily === true ||
              (emp.guestType || "").toLowerCase() === "family" ||
              (emp.jobTitle || emp.title || "").toLowerCase().includes("عائل")
            );

            if (!isFamilyEmp && isFamilyRoom && !a.isEntireRoom) {
              exceptions.push({
                id: `family_${a.id}`,
                categoryKey: "family",
                requestDate: itemDate,
                profileName: getProfileDisplayName(emp, ar) || "—",
                profileCode: emp.profileId || emp.code || "—",
                nationalId: emp.nationalId || "—",
                jobLevel: emp.level || levelCategory,
                department: getProfileDisplayDepartment(emp, ar) || "—",
                roomNumber: room.roomNumber || "—",
                buildingName: bName,
                roomCapacity: roomCap,
                currentOccupancy: roomOcc,
                violationType: ar ? "مخالفة سكن العائلات الصارمة" : "Strict Family Room Violation",
                violationDetails: ar
                  ? "تسكين موظف فردي (أعزب) في جناح مخصص للعائلات بدون استثناء إداري مصرح"
                  : "Single resident assigned to family suite without approved exception",
                severity: ar ? "مرتفعة" : "High",
                approvalStatus: approvalStatusText,
                approvedBy: exceptionApprover,
              });
            }
          }

          // Check F: Contract Expiry Overstay Alert (انتهاء عقد العمل مع استمرار الإقامة)
          if (emp.contractEndDate && a.status === "ACTIVE") {
            const cEnd = comparableDate(emp.contractEndDate);
            if (cEnd && cEnd < todayStr) {
              exceptions.push({
                id: `contract_${a.id}`,
                categoryKey: "contract",
                requestDate: itemDate,
                profileName: getProfileDisplayName(emp, ar) || "—",
                profileCode: emp.profileId || emp.code || "—",
                nationalId: emp.nationalId || "—",
                jobLevel: emp.level || levelCategory,
                department: getProfileDisplayDepartment(emp, ar) || "—",
                roomNumber: room.roomNumber || "—",
                buildingName: bName,
                roomCapacity: roomCap,
                currentOccupancy: roomOcc,
                violationType: ar ? "إقامة بعد انتهاء عقد العمل" : "Contract Expiry Overstay",
                violationDetails: ar
                  ? `المقيم مستمر في السكن رغم انتهاء عقد العمل بتاريخ ${formatDate(emp.contractEndDate)} دون تجديد رسمي معتمد من الموارد البشرية`
                  : `Resident continuing in housing after contract expired on ${formatDate(emp.contractEndDate)} without approved HR renewal`,
                severity: ar ? "مرتفعة" : "High",
                approvalStatus: approvalStatusText,
                approvedBy: exceptionApprover,
                overrideReason: exceptionReasonText,
              });
            }
          }

          // Check G: Smoking Preference Conflict (تعارض سياسة التدخين)
          const empSmoker = Boolean(
            (emp as any).isSmoking === true ||
            String(emp.notes || "").includes("مدخن") ||
            String((emp as any).smokingPreference || "").toLowerCase() === "smoker"
          );
          const roomNonSmoking = Boolean(
            (room as any).isNonSmoking === true ||
            String(room.notes || "").includes("غير مدخن") ||
            String(room.notes || "").toLowerCase().includes("non-smoking")
          );
          if (empSmoker && roomNonSmoking) {
            exceptions.push({
              id: `smoke_${a.id}`,
              categoryKey: "smoking",
              requestDate: itemDate,
              profileName: getProfileDisplayName(emp, ar) || "—",
              profileCode: emp.profileId || emp.code || "—",
              nationalId: emp.nationalId || "—",
              jobLevel: emp.level || levelCategory,
              department: getProfileDisplayDepartment(emp, ar) || "—",
              roomNumber: room.roomNumber || "—",
              buildingName: bName,
              roomCapacity: roomCap,
              currentOccupancy: roomOcc,
              violationType: ar ? "مخالفة سياسة التدخين" : "Smoking Policy Mismatch",
              violationDetails: ar
                ? `المقيم مسجل كمدخن في غرفة مخصصة لغير المدخنين`
                : `Resident is marked as smoker in a designated Non-Smoking room`,
              severity: ar ? "متوسطة" : "Medium",
              approvalStatus: approvalStatusText,
              approvedBy: exceptionApprover,
              overrideReason: exceptionReasonText,
            });
          }

          // Check H: Do Not Room Together / Mutual Exclusion (حظر الجمع بين نزلاء)
          if (roommates.length > 0) {
            const pNotes = String(emp.notes || "").toLowerCase();
            for (const rm of roommates) {
              const rmCode = String(rm.profileId || rm.code || "").toLowerCase();
              const rmNotes = String(rm.notes || "").toLowerCase();
              const myCode = String(emp.profileId || emp.code || "").toLowerCase();
              const isBlacklisted =
                (rmCode && pNotes.includes("عدم التسكين مع") && pNotes.includes(rmCode)) ||
                (myCode && rmNotes.includes("عدم التسكين مع") && rmNotes.includes(myCode));
              if (isBlacklisted) {
                exceptions.push({
                  id: `dnr_${a.id}_${rm.id}`,
                  categoryKey: "dnr",
                  requestDate: itemDate,
                  profileName: getProfileDisplayName(emp, ar) || "—",
                  profileCode: emp.profileId || emp.code || "—",
                  nationalId: emp.nationalId || "—",
                  jobLevel: emp.level || levelCategory,
                  department: getProfileDisplayDepartment(emp, ar) || "—",
                  roomNumber: room.roomNumber || "—",
                  buildingName: bName,
                  roomCapacity: roomCap,
                  currentOccupancy: roomOcc,
                  violationType: ar ? "مخالفة عدم الجمع بين نزلاء" : "Do Not Room Together Violation",
                  violationDetails: ar
                    ? `توجد موانع إدارية أو خلافات سابقة تحظر تسكين المقيم مع (${rm.firstName || ""} ${rm.lastName || ""} #${rm.profileId || rm.code}) في نفس الغرفة`
                    : `Administrative restrictions prohibit housing resident with (${rm.firstName || ""} ${rm.lastName || ""} #${rm.profileId || rm.code}) in the same room`,
                  severity: ar ? "حرجة" : "Critical",
                  approvalStatus: approvalStatusText,
                  approvedBy: exceptionApprover,
                  overrideReason: exceptionReasonText,
                });
              }
            }
          }
        }

        // 2. Audit Family Visits overstay
        const maxNights = Number(policySettings?.visitMaxNights) || 7;
        for (const h of (hostings || [])) {
          if (h.status === "ACTIVE" || h.status === "APPROVED") {
            const start = new Date(h.startDate || h.checkInDate || h.createdAt);
            const end = h.endDate || h.checkOutDate ? new Date(h.endDate || h.checkOutDate) : new Date();
            const days = Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
            if (days > maxNights) {
              const hostEmp = empMap[h.profileId];
              exceptions.push({
                id: `host_${h.id}`,
                categoryKey: "visit",
                requestDate: h.startDate || h.checkInDate || h.createdAt || "",
                profileName: h.guestName || (ar ? "ضيف عائلي" : "Family Guest"),
                profileCode: hostEmp?.profileId || `Host #${h.profileId}`,
                nationalId: h.nationalId || h.guestId || "—",
                jobLevel: ar ? "زيارة عائلية" : "Family Visit",
                department: hostEmp ? getProfileDisplayDepartment(hostEmp, ar) : "—",
                roomNumber: h.roomNumber || (h.roomId ? roomMap[h.roomId]?.roomNumber : "—") || "—",
                buildingName: h.roomId && roomMap[h.roomId] ? (buildingMap[roomMap[h.roomId].buildingId] || "—") : "—",
                roomCapacity: 1,
                currentOccupancy: 1,
                violationType: ar ? "تجاوز الحد الأقصى لليالي الزيارة" : "Visit Duration Exceeded",
                violationDetails: ar
                  ? `مدة الزيارة (${days} ليالٍ) تجاوزت الحد الأقصى المسموح (${maxNights} ليالٍ)`
                  : `Visit length (${days} nights) exceeded max allowed (${maxNights} nights)`,
                severity: ar ? "مرتفعة" : "High",
                approvalStatus: ar ? "معتمد (تجاوز مدة)" : "Approved (Overstay)",
                approvedBy: h.approvedBy || "—",
                overrideReason: h.notes || (ar ? "طلب استضافة معتمد" : "Approved hosting request"),
              });
            }
          }
        }

        // 3. Filter by Category (Policy / Violation Type)
        let filteredExceptions = exceptions;
        if (filterCategory && filterCategory !== "all") {
          filteredExceptions = filteredExceptions.filter((item) => item.categoryKey === filterCategory);
        }

        // 4. Filter by Status (Approval Status or Severity / Risk Level)
        if (filterStatus && filterStatus !== "all") {
          filteredExceptions = filteredExceptions.filter((item) => {
            const fs = filterStatus.toUpperCase();
            if (fs === "APPROVED") {
              return item.approvalStatus?.includes("معتمد") || item.approvalStatus?.includes("Approved");
            }
            if (fs === "UNAPPROVED") {
              return !item.approvalStatus?.includes("معتمد") && !item.approvalStatus?.includes("Approved");
            }
            if (fs === "CRITICAL") {
              return item.severity === "حرجة" || item.severity === "Critical";
            }
            if (fs === "HIGH") {
              return item.severity === "مرتفعة" || item.severity === "High";
            }
            if (fs === "MEDIUM") {
              return item.severity === "متوسطة" || item.severity === "Medium";
            }
            return true;
          });
        }

        return applySearchAndDate(filteredExceptions, "requestDate", (i) => [
          i.profileName,
          i.profileCode,
          i.nationalId,
          i.department,
          i.roomNumber,
          i.buildingName,
          i.violationType,
          i.violationDetails,
          i.approvedBy,
          i.approvalStatus,
          i.overrideReason,
          i.severity,
          i.requestDate,
        ]);
      }

      case "vacations": {
        const list = (vacations || [])
          .filter((v: any) => {
            if (filterBuilding !== "all" && filterBuilding) {
              if (v.buildingId !== Number(filterBuilding)) return false;
            }
            if (filterDepartment !== "all" && filterDepartment) {
              if (v.department !== filterDepartment) return false;
            }
            if (filterStatus !== "all" && filterStatus) {
              if (v.statusKey !== filterStatus.toUpperCase()) return false;
            }

            // Historical Date Overlap Query: [dateFrom, dateTo]
            const vStart = v.startDate;
            const vEnd = v.actualReturnDate || v.endDate || "9999-12-31";

            if (dateFrom && vEnd < dateFrom) return false;
            if (dateTo && vStart > dateTo) return false;

            return true;
          })
          .map((v: any) => {
            let statusBadge = ar ? "في إجازة حالياً" : "On Vacation";
            if (v.statusKey === "COMPLETED") {
              statusBadge = ar ? "عاد للعمل" : "Returned";
            } else if (v.statusKey === "OVERDUE") {
              statusBadge = ar ? "متأخر عن العودة" : "Overdue";
            }

            const housingDisplay = v.roomNumber && v.roomNumber !== "—"
              ? `${v.roomNumber}${v.bedNumber && v.bedNumber !== "—" ? ` (${ar ? `سرير ${v.bedNumber}` : `Bed ${v.bedNumber}`})` : ""}`
              : "—";

            return {
              id: v.id,
              profileId: v.profileId,
              profileCode: v.profileCode,
              fullName: v.fullName,
              department: v.department,
              jobTitle: v.jobTitle,
              phone: v.phone,
              nationalId: v.nationalId,
              roomNumber: v.roomNumber,
              bedNumber: v.bedNumber,
              housingInfo: housingDisplay,
              buildingName: v.buildingName,
              buildingId: v.buildingId,
              startDate: v.startDate,
              endDate: v.endDate,
              actualReturnDate: v.actualReturnDate || "—",
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
          v.startDate,
          v.endDate,
          v.actualReturnDate,
          v.status,
          v.notes,
        ]);
      }

      // 23. HOUSING MAP & STRUCTURE REPORT (خريطة وتفصيل السكن والمباني)
      case "housing_map": {
        const list = rooms
          .filter((r: any) => {
            if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId)) return false;
            if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
            if (filterRoomType !== "all" && !matchesRoomType(r, filterRoomType)) return false;
            return true;
          })
          .map((r: any) => {
            const bName = buildingMap[r.buildingId] || "—";
            const fNum = r.floorNumber ?? (r.floorId ? floorMap[r.floorId] : null);
            const fName = fNum ? (String(fNum).toLowerCase().includes("floor") || String(fNum).includes("دور") ? fNum : (ar ? `الدور ${fNum}` : `Floor ${fNum}`)) : (r.floorId ? (floorMap[r.floorId] || "—") : "—");
            const roomAssigns = assignments.filter((a: any) => a.roomId === r.id && ["ACTIVE", "VACATION", "OCCUPIED_VACATION"].includes(String(a.status).toUpperCase()));
            const occupantsList = roomAssigns.map((a: any, idx: number) => {
              const p = empMap[a.profileId] || {};
              const pName = p.fullName || a.employeeName || (ar ? "مقيم" : "Resident");
              const pCode = p.profileCode || a.employeeCode || "—";
              const pDept = p.department || a.department || "—";
              const bed = a.bedNumber || (idx + 1);
              return `${pName}${pCode !== "—" ? ` [${pCode}]` : ""}${pDept !== "—" ? ` (${pDept})` : ""} - سرير #${bed}`;
            });
            const occupantsSummary = occupantsList.length > 0 ? occupantsList.join(" | ") : (ar ? "شاغرة بالكامل" : "Vacant");
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
              roomType: ar ? translateRoomType(r.roomType, true) : (r.roomType || "Standard"),
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

      default:
        return [];
    }
  };


  return { currentData };
}
