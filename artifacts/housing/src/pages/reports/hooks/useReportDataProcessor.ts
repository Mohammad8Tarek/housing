import { useMemo } from "react";
import { matchesSearch } from "@/lib/search-utils";
import type { Tab } from "../types";
import { REPORT_PROCESSORS } from "./processors";
import { comparableDate } from "./processors/context";

// Row builders per report live in ./processors (one file per report group).
export { matchesRoomType, matchesGender } from "./processors";

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
        ? buildings.map((b: any) => Number(b.id))
        : [Number(filterBuilding)],
    );
  }, [filterBuilding, buildings]);

  const filteredFloorIds = useMemo(() => {
    return new Set(
      floors
        .filter((f: any) => {
          if (!filteredBuildingIds.has(Number(f.buildingId))) return false;
          if (
            filterFloor !== "all" &&
            filterFloor &&
            Number(f.id) !== Number(filterFloor)
          )
            return false;
          return true;
        })
        .map((f: any) => Number(f.id)),
    );
  }, [floors, filteredBuildingIds, filterFloor]);

  // Generic Search & Date Range Filter helper
  const applySearchAndDate = (
    data: any[],
    dateField?: string,
    searchFields?: (item: any) => (string | number | null | undefined)[],
  ): any[] => {
    return data.filter((item) => {
      if (search && search.trim()) {
        const fields = searchFields
          ? searchFields(item)
          : (Object.values(item) as (string | number | null | undefined)[]);
        if (!matchesSearch(fields, search)) return false;
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
    const process = REPORT_PROCESSORS[activeTab as Tab];
    if (!process) return [];
    return process({
      ar,
      activeTab,
      filterBuilding,
      filterFloor,
      filterStatus,
      filterCategory,
      inventoryViewMode,
      filterDepartment,
      filterGender,
      filterNationality,
      filterRoomType,
      filterEmploymentType,
      waterSortMode,
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
      equipmentInventory,
      gateLogs,
      vacations,
      buildingMap,
      floorMap,
      roomMap,
      empMap,
      settings,
      filteredBuildingIds,
      filteredFloorIds,
      applySearchAndDate,
    });
  };

  return { currentData };
}
