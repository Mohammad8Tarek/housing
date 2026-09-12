import { useMemo } from "react";
import { Tab } from "../types";
import { formatDate, parseDMY } from "@/lib/date-utils";

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
  buildingMap,
  floorMap,
  roomMap,
  empMap,
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
              profileName: `${r.firstName || ""} ${r.lastName || ""}`.trim() || "—",
              profileId: r.guestIdCardNumber || `RES-${r.id}`,
              nationalId: r.guestIdCardNumber || "—",
              phone: r.guestPhone || "—",
              department: r.department || "—",
              jobTitle: r.jobTitle || "—",
              roomNumber: room ? room.roomNumber : (r.roomNumber || (ar ? "غير محدد" : "Unassigned")),
              buildingName: bName,
              floorName: fName,
              bedNumber: r.bedNumber || (ar ? "سرير 1" : "Bed 1"),
              checkInDate: formatDate(r.checkInDate, "—"),
              checkOutDate: formatDate(r.checkOutDate, "—"),
              nights: nights > 0 ? nights : "—",
              status: r.status || "CONFIRMED",
              vipStatus: r.isVip ? "VIP" : "Standard",
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

            return {
              id: a.id,
              profileName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || `#${a.profileId}`,
              profileId: emp.profileId || "—",
              nationalId: emp.nationalId || "—",
              phone: emp.phone || "—",
              department: emp.department || "—",
              jobTitle: emp.jobTitle || "—",
              roomNumber: room.roomNumber || "—",
              buildingName: bName,
              floorName: fName,
              bedNumber: a.bedNumber || 1,
              checkInDate: formatDate(a.checkInDate, "—"),
              checkOutDate: formatDate(expCheckOut, "—"),
              status: a.status,
              departureCategory,
              reason: isHrClearance ? (ar ? "تصفية ومغادرة عمل من الموارد البشرية" : "HR Termination / Clearance") : (a.notes || (ar ? "إخلاء عادي" : "Normal Departure")),
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
            if (filterRoomType !== "all" && room.roomType?.toLowerCase() !== filterRoomType.toLowerCase()) return false;
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
                const name = `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || emp.name;
                const dept = emp.department ? ` (${emp.department})` : "";
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
                  return emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : `#${a.profileId}`;
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
                  return emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : `#${a.profileId}`;
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
                  return emp ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim() : `#${a.profileId}`;
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
            if (filterRoomType !== "all" && room?.roomType?.toLowerCase() !== filterRoomType.toLowerCase()) return false;
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
              firstName: emp.firstName || "—",
              lastName: emp.lastName || "",
              fullName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || `#${a.profileId}`,
              nationalId: emp.nationalId || "—",
              nationality: emp.nationality || "—",
              phone: emp.phone || "—",
              department: emp.department || "—",
              jobTitle: emp.jobTitle || "—",
              level: emp.level || "—",
              employmentType: emp.employmentType || "INTERNAL",
              companyName: emp.companyName || (emp.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : (ar ? "الفندق" : "Hotel")),
              roomId: a.roomId,
              roomNumber: room.roomNumber || `#${a.roomId}`,
              roomType: room.roomType || "—",
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
            if (filterRoomType !== "all" && r.roomType?.toLowerCase() !== filterRoomType.toLowerCase()) return false;
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
              roomType: r.roomType || "Standard",
              capacity: cap,
              currentOccupancy: occ,
              vacantBedsCount,
              availableBedsText: availableBedNumbers.map((b) => (ar ? `سرير ${b}` : `Bed ${b}`)).join(", ") || (ar ? "أي سرير" : "Any Bed"),
              genderPolicy: r.genderPolicy || "Any",
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
            if (filterRoomType !== "all" && r.roomType?.toLowerCase() !== filterRoomType.toLowerCase()) return false;
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
              roomType: r.roomType || "Standard",
              capacity: cap,
              currentOccupancy: occ,
              vacantBeds,
              occupancyRate: `${rate}%`,
              genderPolicy: r.genderPolicy || "—",
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
              firstName: e.firstName,
              lastName: e.lastName,
              fullName: `${e.firstName || ""} ${e.lastName || ""}`.trim(),
              nationalId: e.nationalId || "—",
              nationality: e.nationality || "—",
              phone: e.phone || "—",
              gender: e.gender || "M",
              dateOfBirth: formatDate(e.dateOfBirth, "—"),
              department: e.department || "—",
              jobTitle: e.jobTitle || "—",
              level: e.level || "—",
              employmentType: e.employmentType || "INTERNAL",
              companyName: e.companyName || (e.employmentType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : (ar ? "الفندق" : "Hotel")),
              hireDate: formatDate(e.hireDate, "—"),
              contractEndDate: formatDate(e.contractEndDate, "—"),
              address: e.address || "—",
              status: e.status || "ACTIVE",
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
              fullName: `${p.firstName || ""} ${p.lastName || ""}`.trim(),
              nationalId: p.nationalId || "—",
              phone: p.phone || "—",
              department: p.department || "—",
              jobTitle: p.jobTitle || "—",
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
            if (filterRoomType !== "all" && r.roomType?.toLowerCase() !== filterRoomType.toLowerCase()) return false;
            return true;
          })
          .map((r: any) => {
            const room = r.roomId ? roomMap[r.roomId] : null;
            return {
              id: r.id,
              guestName: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
              nationalId: r.guestIdCardNumber || "—",
              phone: r.guestPhone || "—",
              department: r.department || "—",
              jobTitle: r.jobTitle || "—",
              roomType: r.roomType || "—",
              roomNumber: room ? room.roomNumber : "—",
              checkInDate: formatDate(r.checkInDate, "—"),
              checkOutDate: formatDate(r.checkOutDate, "—"),
              status: r.status || "UPCOMING",
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
              hostEmployee: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || `#${h.profileId}`,
              hostDept: emp.department || "—",
              guestName: h.guestName || "—",
              relation: h.relationship || "—",
              guestId: h.guestNationalId || "—",
              roomNumber: room ? room.roomNumber : "—",
              checkInDate: formatDate(h.expectedFrom, "—"),
              checkOutDate: formatDate(h.expectedTo, "—"),
              dailyRate: h.dailyRate ? `${h.dailyRate} EGP` : "—",
              totalAmount: h.totalAmount ? `${h.totalAmount} EGP` : "—",
              status: h.status || "pending",
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
            return {
              id: m.id,
              roomNumber: room.roomNumber || `#${m.roomId}`,
              buildingName: buildingMap[room.buildingId] || "—",
              category: m.category || "General",
              problemType: m.problemType || "—",
              priority: m.priority || "Normal",
              reportedBy: m.reportedBy || "—",
              assignedTo: m.assignedToName || "—",
              reportedAt: formatDate(m.reportedAt, "—"),
              status: m.status || "open",
              cost: m.cost ? `${m.cost} EGP` : "—",
            };
          });

        return applySearchAndDate(list, "reportedAt", (m) => [
          m.roomNumber,
          m.buildingName,
          m.category,
          m.problemType,
          m.priority,
          m.assignedTo,
          m.status,
        ]);
      }

      // 9. HOUSEKEEPING REPORT (هاوس كيبنج — حالة الغرف النظافة والصيانة)
      case "housekeeping": {
        const list = rooms
          .filter((r: any) => {
            if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId)) return false;
            if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
            if (filterRoomType !== "all" && r.roomType?.toLowerCase() !== filterRoomType.toLowerCase()) return false;
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
              roomType: r.roomType || "Standard",
              capacity: cap,
              currentOccupancy: occ,
              vacantBeds: Math.max(0, cap - occ),
              genderPolicy: r.genderPolicy || "—",
              status: r.status || "available",
              hkPriority,
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

      default:
        return [];
    }
  };

  return { currentData };
}
