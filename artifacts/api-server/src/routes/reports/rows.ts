import { Router } from "express";
import {
  buildReportMaps,
  buildReportRows,
  groupRowsByRoom,
  sortReportRows,
  type ReportFilters,
} from "@workspace/report-rows";
import { requirePermission } from "../../middlewares/permissions.js";
import { validate } from "../../middlewares/validate.js";
import { ReportFilterOptionsQuery, ReportRowsParams, ReportRowsQuery, SERVER_REPORTS } from "../../validation/schemas.js";
import { loadReportDatasets, type ReportDatasetKey } from "../../lib/report-datasets.js";

const router: Router = Router();

// Lists each server-paged report is built from (buildings/floors/rooms are
// small and feed the building/floor/room lookups every report uses).
const BASE = ["buildings", "floors", "rooms"] as const;
const REPORT_SOURCES: Record<(typeof SERVER_REPORTS)[number], readonly ReportDatasetKey[]> = {
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
  policy_exceptions: [...BASE, "assignments", "hostings", "profiles", "settings"],
};

function validTimeZone(tz: string | undefined): string | undefined {
  if (!tz) return undefined;
  try {
    new Intl.DateTimeFormat("en", { timeZone: tz });
    return tz;
  } catch {
    return undefined;
  }
}

const ALLOWED_PAGE_SIZES = new Set([10, 15, 20, 25, 50, 100]);

// ─── GET /api/reports/rows/:report ───────────────────────────────────────────
// One page of a report's rows, built with the same code as the Reports page
// (@workspace/report-rows): filters, search, sort and pagination run here.
// `all=1` returns every row (exports/print). `groupBy=room` pages over rooms.
router.get(
  "/rows/:report",
  requirePermission("reports", "view"),
  validate({ params: ReportRowsParams, query: ReportRowsQuery }),
  async (req, res, next) => {
    try {
      const report = req.params.report as (typeof SERVER_REPORTS)[number];
      const q = req.query as Record<string, string | undefined>;
      const propertyId = Number(q.propertyId);

      const datasets = await loadReportDatasets(req, propertyId, REPORT_SOURCES[report]);
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

      const sort = q.sortKey ? { key: q.sortKey, dir: q.sortDir === "desc" ? "desc" as const : "asc" as const } : null;
      const rows = sortReportRows(buildReportRows(filters, datasets, maps), sort);
      const grouped = q.groupBy === "room" && report === "assignments";

      if (q.all === "1") {
        res.json({ data: rows, totalRows: rows.length });
        return;
      }

      const requested = Number(q.limit) || 25;
      const limit = ALLOWED_PAGE_SIZES.has(requested) ? requested : 25;
      const units: any[][] = grouped ? groupRowsByRoom(rows).map(([, list]) => list) : rows.map((r) => [r]);
      const total = units.length;
      const totalPages = Math.max(1, Math.ceil(total / limit));
      const page = Math.min(Math.max(1, Number(q.page) || 1), totalPages);
      const data = units.slice((page - 1) * limit, page * limit).flat();

      res.json({
        data,
        totalRows: rows.length,
        pagination: { page, limit, total, totalPages },
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/reports/filter-options ─────────────────────────────────────────
// Department / nationality choices for the report filters, so the page does
// not need every profile and reservation just to fill two dropdowns.
router.get(
  "/filter-options",
  requirePermission("reports", "view"),
  validate({ query: ReportFilterOptionsQuery }),
  async (req, res, next) => {
    try {
      const propertyId = Number(req.query.propertyId);
      const d = await loadReportDatasets(req, propertyId, ["profiles", "reservations"]);
      const departments = new Set<string>();
      d.profiles.forEach((e: any) => e.department && departments.add(String(e.department).trim()));
      d.reservations.forEach((r: any) => r.department && departments.add(String(r.department).trim()));
      const nationalities = new Set<string>();
      d.profiles.forEach((e: any) => e.nationality && nationalities.add(String(e.nationality).trim()));
      res.json({
        departments: Array.from(departments).sort(),
        nationalities: Array.from(nationalities).sort(),
      });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
