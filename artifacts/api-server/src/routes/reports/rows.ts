import { Router } from "express";
import {
  buildReportMaps,
  computeManagerFlash,
  computeOccupancyForecast,
  computeReportAnalytics,
  filterAnalyticsScope,
  buildReportRows,
  groupRowsByRoom,
  sortReportRows,
  type ReportFilters,
} from "@workspace/report-rows";
import { requirePermission } from "../../middlewares/permissions.js";
import { validate } from "../../middlewares/validate.js";
import {
  ManagerFlashQuery,
  OccupancyForecastQuery,
  ReportAnalyticsQuery,
  ReportFilterOptionsQuery,
  ReportRowsParams,
  ReportRowsQuery,
  SERVER_REPORTS,
} from "../../validation/schemas.js";
import {
  REPORT_SOURCES,
  buildServerReportRows,
  validTimeZone,
} from "../../lib/report-rows-server.js";
import { loadReportDatasets } from "../../lib/report-datasets.js";

const router: Router = Router();

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

      const rows = await buildServerReportRows(req, propertyId, report, q);
      const grouped = q.groupBy === "room" && report === "assignments";

      if (q.all === "1") {
        res.json({ data: rows, totalRows: rows.length });
        return;
      }

      const requested = Number(q.limit) || 25;
      const limit = ALLOWED_PAGE_SIZES.has(requested) ? requested : 25;
      const units: any[][] = grouped
        ? groupRowsByRoom(rows).map(([, list]) => list)
        : rows.map((r) => [r]);
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
      const d = await loadReportDatasets(req, propertyId, [
        "profiles",
        "reservations",
      ]);
      const departments = new Set<string>();
      d.profiles.forEach(
        (e: any) =>
          e.department && departments.add(String(e.department).trim()),
      );
      d.reservations.forEach(
        (r: any) =>
          r.department && departments.add(String(r.department).trim()),
      );
      const nationalities = new Set<string>();
      d.profiles.forEach(
        (e: any) =>
          e.nationality && nationalities.add(String(e.nationality).trim()),
      );
      res.json({
        departments: Array.from(departments).sort(),
        nationalities: Array.from(nationalities).sort(),
      });
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/reports/analytics ──────────────────────────────────────────────
// KPI tiles and breakdowns for the Analytics tab and its PDF, computed here so
// the page does not download every profile, stay, ticket and reservation.
// Building/floor filters scope rooms and stays exactly as the page did.
router.get(
  "/analytics",
  requirePermission("reports", "view"),
  validate({ query: ReportAnalyticsQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const propertyId = Number(q.propertyId);
      const d = await loadReportDatasets(req, propertyId, [
        "buildings",
        "floors",
        "rooms",
        "profiles",
        "assignments",
        "maintenance",
        "reservations",
        "hostings",
      ]);
      const { roomMap } = buildReportMaps(d);
      const scope = filterAnalyticsScope(
        d.rooms,
        d.assignments,
        q.filterBuilding || "all",
        q.filterFloor || "all",
        roomMap,
      );
      res.json(
        computeReportAnalytics({
          ar: q.lang !== "en",
          rooms: scope.rooms,
          assignments: scope.assignments,
          profiles: d.profiles,
          buildings: d.buildings,
          floors: d.floors,
          maintenance: d.maintenance,
          reservations: d.reservations,
          hostings: d.hostings,
          timeZone: validTimeZone(q.tz),
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/reports/manager-flash ──────────────────────────────────────────
// Morning Operations figures for one date (rooms, movements, buildings, top
// departments and nationalities), so the tab needs no stay history or profiles.
router.get(
  "/manager-flash",
  requirePermission("reports", "view"),
  validate({ query: ManagerFlashQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const d = await loadReportDatasets(req, Number(q.propertyId), [
        "buildings",
        "floors",
        "rooms",
        "assignments",
        "reservations",
        "maintenance",
        "profiles",
      ]);
      res.json(
        computeManagerFlash({
          ar: q.lang !== "en",
          reportDate: q.date!,
          rooms: d.rooms,
          buildings: d.buildings,
          floors: d.floors,
          assignments: d.assignments,
          reservations: d.reservations,
          maintenance: d.maintenance,
          profiles: d.profiles,
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

// ─── GET /api/reports/occupancy-forecast ─────────────────────────────────────
// Day-by-day projection for the next 7/14/30 days in the user's time zone,
// so the Occupancy Forecast tab needs no stay or reservation lists.
router.get(
  "/occupancy-forecast",
  requirePermission("reports", "view"),
  validate({ query: OccupancyForecastQuery }),
  async (req, res, next) => {
    try {
      const q = req.query as Record<string, string | undefined>;
      const d = await loadReportDatasets(req, Number(q.propertyId), [
        "rooms",
        "assignments",
        "reservations",
      ]);
      res.json(
        computeOccupancyForecast({
          ar: q.lang !== "en",
          rooms: d.rooms,
          assignments: d.assignments,
          reservations: d.reservations,
          horizonDays: Number(q.horizon),
          buildingId: q.buildingId || "all",
          timeZone: validTimeZone(q.tz),
        }),
      );
    } catch (err) {
      next(err);
    }
  },
);

export default router;
