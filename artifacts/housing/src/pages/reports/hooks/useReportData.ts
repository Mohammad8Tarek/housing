import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  customFetch,
  getGetSettingsQueryKey,
  getListPropertiesQueryKey,
  useListProperties,
  useGetSettings,
} from "@workspace/api-client-react";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { buildReportMaps } from "@workspace/report-rows";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";

// Large lists the page itself still needs, per tab. Every other report table
// is built and paged by the API (SERVER_ROW_TABS), so these load on demand.
// "currentAssignments" = stays in progress only (bounded by bed capacity);
// "assignments" = full history, which grows forever.
type HeavyList =
  | "profiles" | "assignments" | "currentAssignments" | "reservations" | "maintenance"
  | "hostings" | "equipmentInventory" | "gateLogs" | "vacations";
const TAB_LISTS: Record<string, HeavyList[]> = {
  analytics: ["profiles", "currentAssignments", "maintenance", "reservations", "hostings"],
  manager_flash: ["profiles", "assignments", "maintenance", "reservations"],
  occupancy_forecast: ["currentAssignments", "reservations"],
  housing_map: ["profiles", "currentAssignments"],
  vacant_rooms: ["currentAssignments"], // occupancy matrix above the table
  maintenance: ["maintenance"], // dual-track ribbon above the table
};
const CURRENT_STATUSES = ["ACTIVE", "VACATION", "OCCUPIED_VACATION"];

const EMPTY: string[] = [];
const EMPTY_ROWS: any[] = [];

export function useReportData(
  filterProperty: string,
  activePropertyId?: number,
  _filterBuilding: string = "all",
  activeTab: string = "analytics",
) {
  // Same cache entry as PropertyContext, so the (logo-heavy) list loads once.
  const { data: properties = [] } = useListProperties({
    query: { queryKey: getListPropertiesQueryKey(), enabled: true },
  });

  const propId = useMemo(() => {
    if (filterProperty !== "all" && filterProperty !== "")
      return Number(filterProperty);
    if (activePropertyId) return activePropertyId;
    if (properties.length > 0) return properties[0].id;
    return undefined;
  }, [filterProperty, activePropertyId, properties]);

  const { data: settings } = useGetSettings(
    { propertyId: propId },
    // Same cache entry as AppLayout (default key), so settings load once.
    { query: { queryKey: getGetSettingsQueryKey({ propertyId: propId }), enabled: !!propId } },
  );

  // Every list is loaded completely (all pages), so reports never drop rows
  // once a property grows past the server's per-request limit.
  const needs = new Set<string>(TAB_LISTS[activeTab] ?? []);
  const useAll = (key: string, path: string, pageSize: number, extra: Record<string, string> = {}, need?: HeavyList) =>
    useQuery({
      queryKey: [key, propId, "report-all", extra],
      queryFn: () => fetchAllPages<any>(path, { propertyId: propId, ...extra }, pageSize),
      enabled: !!propId && (!need || needs.has(need)),
    });
  // Endpoints that used plain fetch before and treat failures as "no rows".
  const useAllOrEmpty = (key: string, path: string, pageSize: number, need: HeavyList) =>
    useQuery({
      queryKey: [key, propId, "report-all"],
      queryFn: () => fetchAllPages<any>(path, { propertyId: propId }, pageSize).catch(() => []),
      enabled: !!propId && needs.has(need),
    });

  const { data: buildings = [] } = useAll("buildings", "/api/buildings", 1000);
  const { data: floors = [] } = useAll("floors", "/api/floors", 5000);
  const { data: rooms = [], isLoading: roomLoad } = useAll("rooms", "/api/rooms", 5000);
  const { data: profiles = [], isLoading: empLoad } = useAll("profiles", "/api/profiles", 5000, {}, "profiles");
  const { data: history, isLoading: histLoad } = useAll("assignments", "/api/assignments", 5000, { status: "ALL" }, "assignments");
  // Same rows and order (id desc) as filtering the full history.
  const { data: current, isLoading: curLoad } = useQuery({
    queryKey: ["assignments", propId, "report-current"],
    queryFn: async () => {
      const lists = await Promise.all(
        CURRENT_STATUSES.map((status) => fetchAllPages<any>("/api/assignments", { propertyId: propId, status }, 5000)),
      );
      return lists.flat().sort((a: any, b: any) => Number(b.id) - Number(a.id));
    },
    enabled: !!propId && needs.has("currentAssignments") && !needs.has("assignments"),
  });
  const assignments: any[] = (needs.has("assignments") ? history : current) ?? EMPTY_ROWS;
  const assLoad = histLoad || curLoad;
  const { data: reservations = [], isLoading: resLoad } = useAll("reservations", "/api/reservations", 5000, {}, "reservations");
  const { data: maintenance = [], isLoading: mntLoad } = useAll("maintenance", "/api/maintenance", 5000, {}, "maintenance");
  const { data: hostings = [], isLoading: hostLoad } = useAll("hostings", "/api/hostings", 5000, {}, "hostings");
  const { data: equipmentInventory = [], isLoading: invLoad } = useAllOrEmpty("room-inventory", "/api/room-inventory", 5000, "equipmentInventory");
  const { data: gateLogs = [], isLoading: gateLoad } = useAllOrEmpty("gate-logs", "/api/gate/logs", 2000, "gateLogs");

  const { data: _vacData, isLoading: vacLoad } = useQuery({
    queryKey: ["report-vacations", propId],
    queryFn: async () => {
      if (!propId) return [];
      const res = await fetch(`/api/reports/vacations?propertyId=${propId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!propId && needs.has("vacations"),
  });
  const vacations: any[] = _vacData || [];

  const [evalStats, setEvalStats] = useState({
    total: 0,
    average: 0,
    positive: 0,
    negative: 0,
  });

  useEffect(() => {
    if (!propId) return;
    fetch(`/api/evaluations/stats?propertyId=${propId}`, {
      credentials: "include",
    })
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d) setEvalStats(d);
      })
      .catch(() => {
        toast.error("Failed to fetch evaluation stats");
      });
  }, [propId]);

  const isLoading =
    roomLoad || empLoad || assLoad || resLoad || mntLoad || hostLoad || invLoad || gateLoad || vacLoad;

  const { buildingMap, floorMap, roomMap, empMap } = useMemo(
    () => buildReportMaps({ buildings, floors, rooms, profiles }),
    [buildings, floors, rooms, profiles],
  );

  // Filter choices come from the API so table tabs need no profile list.
  const { data: filterOptions } = useQuery({
    queryKey: ["report-filter-options", propId],
    queryFn: () =>
      customFetch<{ departments: string[]; nationalities: string[] }>(
        `/api/reports/filter-options?propertyId=${propId}`,
      ),
    enabled: !!propId,
  });
  const departments = filterOptions?.departments ?? EMPTY;
  const nationalities = filterOptions?.nationalities ?? EMPTY;

  const { data: lookupRoomTypes = [] } = useLookupValues(
    propId,
    LOOKUP_CATEGORIES.ROOM_TYPE,
  );

  const { data: lookupClassifications = [] } = useLookupValues(
    propId,
    LOOKUP_CATEGORIES.ROOM_CLASSIFICATION,
  );

  const configuredRoomTypes = useMemo(() => {
    const list: string[] = [];
    (lookupRoomTypes || []).forEach((item: any) => {
      if (!item.disabled && item.value && String(item.value).trim()) {
        list.push(String(item.value).trim());
      }
    });
    (lookupClassifications || []).forEach((item: any) => {
      if (!item.disabled && item.value && String(item.value).trim()) {
        list.push(String(item.value).trim());
      }
    });
    return Array.from(new Set(list)).sort();
  }, [lookupRoomTypes, lookupClassifications]);

  return {
    properties,
    propId,
    settings,
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
    evalStats,
    isLoading,
    buildingMap,
    floorMap,
    roomMap,
    departments,
    nationalities,
    empMap,
    configuredRoomTypes,
    lookupRoomTypes,
    lookupClassifications,
  };
}
