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
import { ReportRowsParams, ReportRowsQuery } from "../../validation/schemas.js";
import { loadReportDatasets } from "../../lib/report-datasets.js";

const router: Router = Router();

// Lists each server-paged report is built from.
const REPORT_SOURCES = {
  assignments: ["buildings", "floors", "rooms", "profiles", "assignments"],
  profiles: ["buildings", "floors", "rooms", "profiles", "assignments"],
} as const;

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
      const report = req.params.report as keyof typeof REPORT_SOURCES;
      const q = req.query as Record<string, string | undefined>;
      const propertyId = Number(q.propertyId);

      const datasets = await loadReportDatasets(req, propertyId, [...REPORT_SOURCES[report]]);
      const maps = buildReportMaps(datasets);
      const filters: ReportFilters = {
        ar: q.lang !== "en",
        activeTab: report,
        filterBuilding: q.filterBuilding || "all",
        filterFloor: q.filterFloor || "all",
        filterStatus: q.filterStatus || "all",
        filterCategory: q.filterCategory || "all",
        inventoryViewMode: "summary",
        filterDepartment: q.filterDepartment || "all",
        filterGender: q.filterGender || "all",
        filterNationality: q.filterNationality || "all",
        filterRoomType: q.filterRoomType || "all",
        filterEmploymentType: q.filterEmploymentType || "all",
        waterSortMode: "room",
        search: q.search || "",
        dateFrom: q.dateFrom || "",
        dateTo: q.dateTo || "",
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

export default router;
