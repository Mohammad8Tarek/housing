import { useMemo } from "react";
import { Tab } from "../types";

export function useReportDataProcessor({
  activeTab,
  filterBuilding,
  filterFloor,
  filterStatus,
  filterCategory,
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
        const d = String(rawDate).slice(0, 10);
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  };

  const currentData = (): any[] => {
    switch (activeTab) {
      // 1. IN-HOUSE & ASSIGNMENTS REPORT (المقيمين والتسكين)
      case "assignments": {
        const list = assignments
          .filter((a: any) => {
            const room = roomMap[a.roomId];
            const emp = empMap[a.profileId];
            if (filterBuilding !== "all" && room && !filteredBuildingIds.has(room.buildingId)) return false;
            if (filterFloor !== "all" && room && !filteredFloorIds.has(room.floorId)) return false;
            if (filterStatus !== "all" && a.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
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
            return {
              id: a.id,
              profileId: emp.id,
              profileCode: emp.profileId || `EMP-${a.profileId}`,
              firstName: emp.firstName || "—",
              lastName: emp.lastName || "",
              fullName: `${emp.firstName || ""} ${emp.lastName || ""}`.trim() || `#${a.profileId}`,
              nationalId: emp.nationalId || "—",
              phone: emp.phone || "—",
              department: emp.department || "—",
              jobTitle: emp.jobTitle || "—",
              level: emp.level || "—",
              employmentType: emp.employmentType || "INTERNAL",
              companyName: emp.companyName || (emp.employmentType === "THIRD_PARTY" ? "طرف ثالث" : "الفندق"),
              roomId: a.roomId,
              roomNumber: room.roomNumber || `#${a.roomId}`,
              roomType: room.roomType || "—",
              bedNumber: a.bedNumber ? String(a.bedNumber) : "—",
              buildingName: buildingMap[room.buildingId] || "—",
              floorName: floorMap[room.floorId] || "—",
              checkInDate: a.checkInDate ? a.checkInDate.slice(0, 10) : "—",
              contractEndDate: emp.contractEndDate ? emp.contractEndDate.slice(0, 10) : "—",
              expectedCheckOutDate: a.expectedCheckOutDate ? a.expectedCheckOutDate.slice(0, 10) : (emp.contractEndDate ? emp.contractEndDate.slice(0, 10) : "—"),
              checkOutDate: a.checkOutDate ? a.checkOutDate.slice(0, 10) : "—",
              status: a.status || "ACTIVE",
            };
          });

        return applySearchAndDate(list, "checkInDate", (i) => [
          i.fullName,
          i.profileCode,
          i.nationalId,
          i.phone,
          i.roomNumber,
          i.bedNumber,
          i.buildingName,
          i.department,
          i.companyName,
          i.jobTitle,
          i.status,
        ]);
      }

      // 2. VACANT ROOMS & AVAILABLE BEDS REPORT (الغرف والأسرة الشاغرة)
      case "vacant_rooms": {
        const activeAssByRoom = new Map<number, Set<number>>();
        assignments
          .filter((a: any) => a.status?.toLowerCase() === "active")
          .forEach((a: any) => {
            if (!activeAssByRoom.has(a.roomId)) activeAssByRoom.set(a.roomId, new Set());
            if (a.bedNumber != null) activeAssByRoom.get(a.roomId)!.add(a.bedNumber);
          });

        const list = rooms
          .filter((r: any) => {
            const isOutOfOrder = ["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(r.status?.toLowerCase());
            if (isOutOfOrder) return false;
            const cap = r.capacity || 1;
            const occ = r.currentOccupancy || 0;
            const vacantBeds = cap - occ;
            if (vacantBeds <= 0) return false; // Only rooms with available space

            if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId)) return false;
            if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
            if (filterRoomType !== "all" && r.roomType?.toLowerCase() !== filterRoomType.toLowerCase()) return false;
            if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus.toLowerCase()) return false;
            if (filterGender !== "all" && r.genderPolicy?.toLowerCase() !== filterGender.toLowerCase()) return false;
            return true;
          })
          .map((r: any) => {
            const cap = r.capacity || 1;
            const occ = r.currentOccupancy || 0;
            const vacantBedsCount = Math.max(0, cap - occ);
            const occupiedBeds = activeAssByRoom.get(r.id) || new Set();
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
              availableBedsText: availableBedNumbers.map((b) => `سرير ${b}`).join(", ") || "أي سرير",
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
            const occ = r.currentOccupancy || 0;
            const rate = cap > 0 ? Math.round((occ / cap) * 100) : 0;
            return {
              id: r.id,
              roomNumber: r.roomNumber,
              buildingName: buildingMap[r.buildingId] || "—",
              floorName: floorMap[r.floorId] || "—",
              roomType: r.roomType || "Standard",
              capacity: cap,
              currentOccupancy: occ,
              vacantBeds: Math.max(0, cap - occ),
              occupancyRate: `${rate}%`,
              genderPolicy: r.genderPolicy || "—",
              status: r.status || "available",
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
              dateOfBirth: e.dateOfBirth ? e.dateOfBirth.slice(0, 10) : "—",
              department: e.department || "—",
              jobTitle: e.jobTitle || "—",
              level: e.level || "—",
              employmentType: e.employmentType || "INTERNAL",
              companyName: e.companyName || (e.employmentType === "THIRD_PARTY" ? "طرف ثالث" : "الفندق"),
              hireDate: e.hireDate ? e.hireDate.slice(0, 10) : "—",
              contractEndDate: e.contractEndDate ? e.contractEndDate.slice(0, 10) : "—",
              address: e.address || "—",
              status: e.status || "ACTIVE",
              assignedRoom: room ? `${room.roomNumber} (${asgn.bedNumber ? `سرير ${asgn.bedNumber}` : ""})` : "غير مسكن",
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
              contractEndDate: p.contractEndDate.slice(0, 10),
              daysRemaining: diffDays,
              expStatus: diffDays < 0 ? "منتهي (Expired)" : diffDays <= 30 ? "ينتهي قريباً (Expiring Soon)" : "ساري (Active)",
              assignedRoom: room ? `غرفة ${room.roomNumber} (${buildingMap[room.buildingId] || ""})` : "غير مسكن",
            };
          })
          .sort(
            (a: { daysRemaining: number }, b: { daysRemaining: number }) =>
              a.daysRemaining - b.daysRemaining,
          );

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
              checkInDate: r.checkInDate ? r.checkInDate.slice(0, 10) : "—",
              checkOutDate: r.checkOutDate ? r.checkOutDate.slice(0, 10) : "—",
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
              checkInDate: h.expectedFrom ? h.expectedFrom.slice(0, 10) : "—",
              checkOutDate: h.expectedTo ? h.expectedTo.slice(0, 10) : "—",
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
              reportedAt: m.reportedAt ? m.reportedAt.slice(0, 10) : "—",
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
              s === "dirty" ? (r.language === "ar" ? "تنظيف فوري" : "Immediate Cleaning") :
              s === "occupied_dirty" ? (r.language === "ar" ? "تنظيف عند الخروج" : "Clean on Checkout") :
              s === "available" ? (r.language === "ar" ? "جاهزة" : "Ready") :
              s === "occupied" ? (r.language === "ar" ? "مشغولة — لا تزعج" : "Occupied — DND") :
              s === "maintenance" ? (r.language === "ar" ? "صيانة" : "Under Maintenance") :
              (r.language === "ar" ? "مراجعة" : "Review");

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
              lastCleaned: r.lastCleanedAt ? r.lastCleanedAt.slice(0, 10) : "—",
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

      default:
        return [];
    }
  };

  return { currentData };
}
