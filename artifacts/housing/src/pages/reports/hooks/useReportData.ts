import { useMemo, useEffect, useState } from "react";
import { toast } from "sonner";
import {
  useListRooms,
  useListBuildings,
  useListFloors,
  useListProfiles,
  useListAssignments,
  useListReservations,
  useListMaintenance,
  useListHostings,
  useListProperties,
  useGetSettings,
} from "@workspace/api-client-react";

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

  const { data: _bData } = useListBuildings({ propertyId: propId, limit: 5000 } as any, {
    query: { queryKey: ["buildings", propId, 5000], enabled: !!propId },
  });
  const buildings: any[] = (_bData as any)?.data || _bData || [];

  const { data: _fData } = useListFloors(
    { propertyId: propId, limit: 5000 } as any,
    { query: { queryKey: ["floors", propId, 5000], enabled: !!propId } },
  );
  const floors: any[] = (_fData as any)?.data || _fData || [];

  const { data: _rData, isLoading: roomLoad } = useListRooms(
    { propertyId: propId, limit: 5000 } as any,
    { query: { queryKey: ["rooms", propId, 5000], enabled: !!propId } },
  );
  const rooms: any[] = (_rData as any)?.data || _rData || [];

  const { data: _eData, isLoading: empLoad } = useListProfiles(
    { propertyId: propId, limit: 5000 } as any,
    { query: { queryKey: ["profiles", propId, 5000], enabled: !!propId } },
  );
  const profiles: any[] = (_eData as any)?.data || _eData || [];

  const { data: _aData, isLoading: assLoad } = useListAssignments(
    { propertyId: propId, limit: 5000 } as any,
    { query: { queryKey: ["assignments", propId, 5000], enabled: !!propId } },
  );
  const assignments: any[] = (_aData as any)?.data || _aData || [];

  const { data: _resData, isLoading: resLoad } = useListReservations(
    { propertyId: propId, limit: 5000 } as any,
    { query: { queryKey: ["reservations", propId, 5000], enabled: !!propId } },
  );
  const reservations: any[] = (_resData as any)?.data || _resData || [];

  const { data: _mntData, isLoading: mntLoad } = useListMaintenance(
    { propertyId: propId, limit: 5000 } as any,
    { query: { queryKey: ["maintenance", propId, 5000], enabled: !!propId } },
  );
  const maintenance: any[] = (_mntData as any)?.data || _mntData || [];

  const { data: _hData, isLoading: hostLoad } = useListHostings(
    { propertyId: propId, limit: 5000 } as any,
    { query: { queryKey: ["hostings", propId, 5000], enabled: !!propId } },
  );
  const hostings: any[] = (_hData as any)?.data || _hData || [];

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
    roomLoad || empLoad || assLoad || resLoad || mntLoad || hostLoad;

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
    evalStats,
    isLoading,
    buildingMap,
    floorMap,
    roomMap,
    departments,
    nationalities,
    empMap,
  };
}
