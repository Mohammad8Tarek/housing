import { useMemo, useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { toast } from "sonner";
import { useListProperties, useGetSettings } from "@workspace/api-client-react";
import { fetchAllPages } from "@/lib/fetch-all-pages";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";

export function useReportData(
  filterProperty: string,
  activePropertyId?: number,
  filterBuilding: string = "all",
) {
  const { data: properties = [] } = useListProperties({
    query: { queryKey: ["properties"], enabled: true },
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
    { query: { queryKey: ["settings", propId], enabled: !!propId } },
  );

  // Every list is loaded completely (all pages), so reports never drop rows
  // once a property grows past the server's per-request limit.
  const useAll = (key: string, path: string, pageSize: number, extra: Record<string, string> = {}) =>
    useQuery({
      queryKey: [key, propId, "report-all", extra],
      queryFn: () => fetchAllPages<any>(path, { propertyId: propId, ...extra }, pageSize),
      enabled: !!propId,
    });
  // Endpoints that used plain fetch before and treat failures as "no rows".
  const useAllOrEmpty = (key: string, path: string, pageSize: number) =>
    useQuery({
      queryKey: [key, propId, "report-all"],
      queryFn: () => fetchAllPages<any>(path, { propertyId: propId }, pageSize).catch(() => []),
      enabled: !!propId,
    });

  const { data: buildings = [] } = useAll("buildings", "/api/buildings", 1000);
  const { data: floors = [] } = useAll("floors", "/api/floors", 5000);
  const { data: rooms = [], isLoading: roomLoad } = useAll("rooms", "/api/rooms", 5000);
  const { data: profiles = [], isLoading: empLoad } = useAll("profiles", "/api/profiles", 5000);
  const { data: assignments = [], isLoading: assLoad } = useAll("assignments", "/api/assignments", 5000, { status: "ALL" });
  const { data: reservations = [], isLoading: resLoad } = useAll("reservations", "/api/reservations", 5000);
  const { data: maintenance = [], isLoading: mntLoad } = useAll("maintenance", "/api/maintenance", 5000);
  const { data: hostings = [], isLoading: hostLoad } = useAll("hostings", "/api/hostings", 5000);
  const { data: equipmentInventory = [], isLoading: invLoad } = useAllOrEmpty("room-inventory", "/api/room-inventory", 5000);
  const { data: gateLogs = [], isLoading: gateLoad } = useAllOrEmpty("gate-logs", "/api/gate/logs", 2000);

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
    enabled: !!propId,
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

  const buildingMap = useMemo(() => {
    const m: Record<number, string> = {};
    buildings.forEach((b: any) => (m[b.id] = b.name));
    return m;
  }, [buildings]);

  const floorMap = useMemo(() => {
    const m: Record<number, string> = {};
    floors.forEach(
      (f: any) =>
        (m[f.id] = f.floorNumber ? `Floor ${f.floorNumber}` : `Floor ${f.id}`),
    );
    return m;
  }, [floors]);

  const roomMap = useMemo(() => {
    const m: Record<number, any> = {};
    rooms.forEach((r: any) => (m[r.id] = r));
    return m;
  }, [rooms]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((e: any) => {
      if (e.department) set.add(e.department.trim());
    });
    reservations.forEach((r: any) => {
      if (r.department) set.add(r.department.trim());
    });
    return Array.from(set).sort();
  }, [profiles, reservations]);

  const nationalities = useMemo(() => {
    const set = new Set<string>();
    profiles.forEach((e: any) => {
      if (e.nationality) set.add(e.nationality.trim());
    });
    return Array.from(set).sort();
  }, [profiles]);

  const empMap = useMemo(() => {
    const m: Record<number, any> = {};
    profiles.forEach((e: any) => (m[e.id] = e));
    return m;
  }, [profiles]);

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
