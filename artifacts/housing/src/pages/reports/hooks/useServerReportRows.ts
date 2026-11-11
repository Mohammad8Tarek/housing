// Server-side pages for reports whose rows the API builds
// (GET /api/reports/rows/:report). Filters, search, sort and pagination run on
// the server; exports/print fetch every row on demand with `all=1`.
import { useCallback, useMemo, useRef, useState } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import type { ReportSort } from "./useReportSort";

/** Reports served page-by-page from the API (biggest, ever-growing lists first). */
export const SERVER_ROW_TABS = new Set([
  "manager_flash",
  "occupancy_forecast",
  "housing_map",
  "arrivals_manifest",
  "departures_manifest",
  "housekeeping_sheet",
  "room_discrepancy",
  "daily_movement",
  "assignments",
  "vacant_rooms",
  "housing",
  "department_occupancy",
  "profiles",
  "expiring_contracts",
  "hostings",
  "vacations",
  "maintenance",
  "equipment_inventory",
  "water_distribution",
  "gate_logs",
  "police_report",
  "policy_exceptions",
]);

/** Server-row tabs that render their own view instead of the report table. */
export const OWN_VIEW_TABS = new Set([
  "manager_flash",
  "occupancy_forecast",
  "housing_map",
]);

const BROWSER_TIME_ZONE = (() => {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone || "";
  } catch {
    return "";
  }
})();

type RowsPage = {
  data: any[];
  totalRows: number;
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };
};

const FILTER_KEYS = [
  "filterBuilding",
  "filterFloor",
  "filterStatus",
  "filterCategory",
  "filterDepartment",
  "filterGender",
  "filterNationality",
  "filterRoomType",
  "filterEmploymentType",
  "dateFrom",
  "dateTo",
  "inventoryViewMode",
  "waterSortMode",
] as const;

export function useServerReportRows({
  enabled,
  report,
  propId,
  ar,
  filters,
  search,
  sort,
  page,
  pageSize,
  groupByRoom,
}: {
  enabled: boolean;
  report: string;
  propId: number | undefined;
  ar: boolean;
  filters: Record<string, any>;
  search: string;
  sort: ReportSort;
  page: number;
  pageSize: number;
  groupByRoom: boolean;
}) {
  // Everything but the page: identifies the full row set.
  const baseQuery = useMemo(() => {
    const qs = new URLSearchParams({
      propertyId: String(propId ?? ""),
      lang: ar ? "ar" : "en",
    });
    for (const k of FILTER_KEYS) {
      const v = filters[k];
      if (v && v !== "all") qs.set(k, String(v));
    }
    if (search.trim()) qs.set("search", search);
    if (sort) {
      qs.set("sortKey", sort.key);
      qs.set("sortDir", sort.dir);
    }
    if (groupByRoom) qs.set("groupBy", "room");
    if (BROWSER_TIME_ZONE) qs.set("tz", BROWSER_TIME_ZONE);
    return qs.toString();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    propId,
    ar,
    search,
    sort,
    groupByRoom,
    ...FILTER_KEYS.map((k) => filters[k]),
  ]);

  const pageQuery = useQuery({
    queryKey: ["report-rows", report, baseQuery, page, pageSize],
    queryFn: () =>
      customFetch<RowsPage>(
        `/api/reports/rows/${report}?${baseQuery}&page=${page}&limit=${pageSize}`,
      ),
    enabled: enabled && !!propId,
    placeholderData: keepPreviousData,
  });

  // Full row set for exports/print, loaded only when asked for.
  const fullRowsRef = useRef<{ key: string; rows: any[] } | null>(null);
  const [fullRowsVersion, setFullRowsVersion] = useState(0);
  const fullKey = `${report}?${baseQuery}`;

  // Always fetched fresh: exports must reflect the latest data.
  const loadAllRows = useCallback(async (): Promise<any[]> => {
    const res = await customFetch<RowsPage>(
      `/api/reports/rows/${report}?${baseQuery}&all=1`,
    );
    const rows = res.data ?? [];
    fullRowsRef.current = { key: fullKey, rows };
    setFullRowsVersion((v) => v + 1);
    return rows;
  }, [report, baseQuery, fullKey]);

  const allRows = useCallback(
    () =>
      fullRowsRef.current?.key === fullKey ? fullRowsRef.current.rows : [],
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [fullKey, fullRowsVersion],
  );

  return {
    pageRows: pageQuery.data?.data ?? [],
    total: pageQuery.data?.pagination?.total ?? 0,
    isLoading: pageQuery.isLoading,
    isError: pageQuery.isError,
    loadAllRows,
    allRows,
  };
}
