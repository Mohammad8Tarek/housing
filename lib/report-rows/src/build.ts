// Build the rows of one report from raw datasets. Used by the Reports page in
// the browser and by GET /api/reports/rows on the server, so both produce
// identical rows.
import { matchesSearch } from "./search-utils";
import {
  comparableDate,
  type ReportProcessorContext,
} from "./processors/context";
import { REPORT_PROCESSORS } from "./processors";

/** Raw lists, exactly as the list endpoints return them. */
export interface ReportDatasets {
  buildings: any[];
  floors: any[];
  rooms: any[];
  profiles: any[];
  assignments: any[];
  reservations: any[];
  maintenance: any[];
  hostings: any[];
  equipmentInventory: any[];
  gateLogs: any[];
  vacations: any[];
  settings: any;
}

export interface ReportMaps {
  buildingMap: Record<number, string>;
  floorMap: Record<number, string>;
  roomMap: Record<number, any>;
  empMap: Record<number, any>;
}

/** Report filters as held by the Reports page. */
export interface ReportFilters {
  ar: boolean;
  activeTab: string;
  filterBuilding: string;
  filterFloor: string;
  filterStatus: string;
  filterCategory: string;
  inventoryViewMode: string;
  filterDepartment: string;
  filterGender: string;
  filterNationality: string;
  filterRoomType: string;
  filterEmploymentType: string;
  waterSortMode: string;
  search: string;
  dateFrom: string;
  dateTo: string;
  /** IANA zone for times shown in rows; the browser's own zone when omitted. */
  timeZone?: string;
}

export function buildReportMaps(
  d: Pick<ReportDatasets, "buildings" | "floors" | "rooms" | "profiles">,
): ReportMaps {
  const buildingMap: Record<number, string> = {};
  d.buildings.forEach((b: any) => (buildingMap[b.id] = b.name));
  const floorMap: Record<number, string> = {};
  d.floors.forEach(
    (f: any) =>
      (floorMap[f.id] = f.floorNumber
        ? `Floor ${f.floorNumber}`
        : `Floor ${f.id}`),
  );
  const roomMap: Record<number, any> = {};
  d.rooms.forEach((r: any) => (roomMap[r.id] = r));
  const empMap: Record<number, any> = {};
  d.profiles.forEach((e: any) => (empMap[e.id] = e));
  return { buildingMap, floorMap, roomMap, empMap };
}

export function buildReportRows(
  f: ReportFilters,
  d: ReportDatasets,
  maps: ReportMaps,
): any[] {
  const process = REPORT_PROCESSORS[f.activeTab];
  if (!process) return [];

  const filteredBuildingIds = new Set(
    f.filterBuilding === "all" || !f.filterBuilding
      ? d.buildings.map((b: any) => Number(b.id))
      : [Number(f.filterBuilding)],
  );
  const filteredFloorIds = new Set(
    d.floors
      .filter((fl: any) => {
        if (!filteredBuildingIds.has(Number(fl.buildingId))) return false;
        if (
          f.filterFloor !== "all" &&
          f.filterFloor &&
          Number(fl.id) !== Number(f.filterFloor)
        )
          return false;
        return true;
      })
      .map((fl: any) => Number(fl.id)),
  );

  // Generic search & date-range filter
  const applySearchAndDate: ReportProcessorContext["applySearchAndDate"] = (
    data,
    dateField,
    searchFields,
  ) =>
    data.filter((item) => {
      if (f.search && f.search.trim()) {
        const fields = searchFields
          ? searchFields(item)
          : (Object.values(item) as (string | number | null | undefined)[]);
        if (!matchesSearch(fields, f.search)) return false;
      }
      if (dateField && (f.dateFrom || f.dateTo)) {
        const rawDate = item[dateField];
        if (!rawDate) return true;
        const dt = comparableDate(rawDate);
        if (!dt) return true;
        if (f.dateFrom && dt < f.dateFrom) return false;
        if (f.dateTo && dt > f.dateTo) return false;
      }
      return true;
    });

  return process({
    ...f,
    ...d,
    settings: d.settings ?? {},
    ...maps,
    filteredBuildingIds,
    filteredFloorIds,
    applySearchAndDate,
  });
}

/** Group In-House rows by room (the "grouped" view pages over rooms). */
export function groupRowsByRoom(rows: any[]): [string, any[]][] {
  const map = new Map<string, any[]>();
  rows.forEach((a: any) => {
    const key = String(a.roomId || a.roomNumber || "unassigned");
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(a);
  });
  return Array.from(map.entries());
}
