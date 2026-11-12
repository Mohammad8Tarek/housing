// Builds a server-paged report's rows exactly as the Reports page does
// (@workspace/report-rows), from the lists the caller may read. Used by
// GET /reports/rows/:report and by scheduled report emails.
import type { Request } from "express";
import {
  buildReportMaps,
  buildReportRows,
  sortReportRows,
  type ReportFilters,
} from "@workspace/report-rows";
import { SERVER_REPORTS } from "../validation/schemas.js";
import {
  loadReportDatasets,
  type ReportDatasetKey,
} from "./report-datasets.js";

export type ServerReport = (typeof SERVER_REPORTS)[number];

// Lists each server-paged report is built from (buildings/floors/rooms are
// small and feed the building/floor/room lookups every report uses).
const BASE = ["buildings", "floors", "rooms"] as const;
export const REPORT_SOURCES: Record<
  (typeof SERVER_REPORTS)[number],
  readonly ReportDatasetKey[]
> = {
  manager_flash: [...BASE, "maintenance"],
  occupancy_forecast: [...BASE, "assignments", "reservations"],
  housing_map: [...BASE, "assignments", "profiles"],
  arrivals_manifest: [...BASE, "reservations"],
  departures_manifest: [...BASE, "assignments", "profiles"],
  housekeeping_sheet: [...BASE, "assignments", "maintenance", "profiles"],
  room_discrepancy: [...BASE, "assignments", "maintenance", "profiles"],
  daily_movement: [...BASE, "assignments", "reservations", "profiles"],
  assignments: [...BASE, "assignments", "profiles"],
  vacant_rooms: [...BASE, "assignments", "maintenance", "profiles"],
  housing: [...BASE, "assignments", "maintenance", "profiles"],
  department_occupancy: [...BASE, "assignments", "profiles"],
  profiles: [...BASE, "profiles", "assignments"],
  expiring_contracts: [...BASE, "profiles", "assignments"],
  hostings: [...BASE, "hostings", "profiles"],
  vacations: [...BASE, "vacations", "profiles"],
  maintenance: [...BASE, "maintenance"],
  equipment_inventory: [...BASE, "equipmentInventory"],
  water_distribution: [...BASE, "assignments", "profiles"],
  gate_logs: [...BASE, "gateLogs"],
  police_report: [...BASE, "assignments", "profiles"],
  policy_exceptions: [
    ...BASE,
    "assignments",
    "hostings",
    "profiles",
    "settings",
  ],
};

export function validTimeZone(tz: string | undefined): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

/** Report rows for `report`, filtered and sorted like the Reports page. */
export async function buildServerReportRows(
  req: Request,
  propertyId: number,
  report: ServerReport,
  q: Record<string, string | undefined>,
): Promise<any[]> {
  const datasets = await loadReportDatasets(
    req,
    propertyId,
    REPORT_SOURCES[report],
  );
  const maps = buildReportMaps(datasets);
  const filters: ReportFilters = {
    ar: q.lang !== "en",
    activeTab: report,
    filterBuilding: q.filterBuilding || "all",
    filterFloor: q.filterFloor || "all",
    filterStatus: q.filterStatus || "all",
    filterCategory: q.filterCategory || "all",
    inventoryViewMode: q.inventoryViewMode || "summary",
    filterDepartment: q.filterDepartment || "all",
    filterGender: q.filterGender || "all",
    filterNationality: q.filterNationality || "all",
    filterRoomType: q.filterRoomType || "all",
    filterEmploymentType: q.filterEmploymentType || "all",
    waterSortMode: q.waterSortMode || "room",
    search: q.search || "",
    dateFrom: q.dateFrom || "",
    dateTo: q.dateTo || "",
    timeZone: validTimeZone(q.tz),
  };
  const sort = q.sortKey
    ? {
        key: q.sortKey,
        dir: q.sortDir === "desc" ? ("desc" as const) : ("asc" as const),
      }
    : null;
  return sortReportRows(buildReportRows(filters, datasets, maps), sort);
}
