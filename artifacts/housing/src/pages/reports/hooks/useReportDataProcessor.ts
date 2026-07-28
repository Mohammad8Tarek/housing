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
  search,
  dateFrom,
  dateTo,
  buildings,
  floors,
  rooms,
  employees,
  assignments,
  reservations,
  maintenance,
  hostings,
  buildingMap,
  floorMap,
  roomMap,
  empMap,
}: any) {
  const filteredBuildingIds = new Set(
    filterBuilding === "all"
      ? buildings.map((b: any) => b.id)
      : [Number(filterBuilding)],
  );

  const filteredFloorIds = new Set(
    floors
      .filter((f: any) => {
        if (!filteredBuildingIds.has(f.buildingId)) return false;
        if (filterFloor !== "all" && f.id !== Number(filterFloor)) return false;
        return true;
      })
      .map((f: any) => f.id),
  );

  const filteredRooms = rooms.filter((r: any) => {
    if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId))
      return false;
    if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
    if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus)
      return false;
    if (
      filterGender !== "all" &&
      r.genderPolicy?.toLowerCase() !== filterGender
    )
      return false;
    return true;
  });
  const filteredRoomIds = new Set(filteredRooms.map((r: any) => r.id));

  const filteredEmployees = employees.filter((e: any) => {
    if (filterStatus !== "all" && e.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all" && e.department !== filterDepartment)
      return false;
    if (filterGender !== "all" && e.gender?.toLowerCase() !== filterGender)
      return false;
    if (filterNationality !== "all" && e.nationality !== filterNationality)
      return false;
    return true;
  });

  const filteredAssignments = assignments.filter((a: any) => {
    if (
      (filterBuilding !== "all" || filterFloor !== "all") &&
      !filteredRoomIds.has(a.roomId)
    )
      return false;
    if (filterStatus !== "all" && a.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all") {
      const emp = empMap[a.employeeId];
      if (emp?.department !== filterDepartment) return false;
    }
    if (filterGender !== "all") {
      const emp = empMap[a.employeeId];
      if (emp?.gender?.toLowerCase() !== filterGender) return false;
    }
    return true;
  });

  const filteredMaintenance = maintenance.filter((m: any) => {
    if (
      (filterBuilding !== "all" || filterFloor !== "all") &&
      !filteredRoomIds.has(m.roomId)
    )
      return false;
    if (filterStatus !== "all" && m.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterCategory !== "all" && m.category !== filterCategory) return false;
    return true;
  });

  const filteredReservations = reservations.filter((r: any) => {
    if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all" && r.department !== filterDepartment)
      return false;
    return true;
  });

  const filteredHostings = hostings.filter((h: any) => {
    if (
      (filterBuilding !== "all" || filterFloor !== "all") &&
      h.roomId &&
      !filteredRoomIds.has(h.roomId)
    )
      return false;
    if (filterStatus !== "all" && h.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all") {
      const emp = empMap[h.employeeId];
      if (emp?.department !== filterDepartment) return false;
    }
    return true;
  });

  const applySearchAndDate = (
    data: any[],
    dateField?: string,
    searchFields?: (item: any) => string[],
  ): any[] => {
    return data.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const fields = searchFields
          ? searchFields(item)
          : [JSON.stringify(item)];
        if (!fields.some((f) => f?.toLowerCase().includes(q))) return false;
      }
      if (dateField && (dateFrom || dateTo)) {
        const d = item[dateField]?.slice(0, 10);
        if (!d) return true;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  };

  const currentData = (): any[] => {
    switch (activeTab) {
      case "housing":
        return applySearchAndDate(filteredRooms, "createdAt", (r) => [
          r.roomNumber,
          r.roomType,
          buildingMap[r.buildingId],
          r.status,
        ]);
      case "employees":
        return applySearchAndDate(filteredEmployees, "hireDate", (e) => [
          e.firstName,
          e.lastName,
          e.employeeCode,
          e.department,
          e.nationality,
          e.jobTitle,
        ]);
      case "assignments":
        return applySearchAndDate(filteredAssignments, "checkInDate", (a) => {
          const emp = empMap[a.employeeId];
          const room = roomMap[a.roomId];
          return [
            emp?.firstName,
            emp?.lastName,
            emp?.employeeId,
            room?.roomNumber,
            a.status,
          ];
        });
      case "maintenance":
        return applySearchAndDate(filteredMaintenance, "reportedAt", (m) => {
          const room = roomMap[m.roomId];
          return [
            room?.roomNumber,
            m.category,
            m.problemType,
            m.priority,
            m.status,
            m.reportedBy,
            m.assignedToName,
          ];
        });
      case "hostings":
        return applySearchAndDate(filteredHostings, "expectedFrom", (h) => {
          const emp = empMap[h.employeeId];
          const room = h.roomId ? roomMap[h.roomId] : undefined;
          return [
            emp?.firstName,
            emp?.lastName,
            emp?.employeeId,
            room?.roomNumber,
            h.status,
            h.hostingType,
          ];
        });
      case "reservations":
        return applySearchAndDate(filteredReservations, "checkInDate", (r) => [
          r.firstName,
          r.lastName,
          r.department,
          r.roomType,
          r.status,
        ]);
      default:
        return [];
    }
  };

  return { currentData };
}
