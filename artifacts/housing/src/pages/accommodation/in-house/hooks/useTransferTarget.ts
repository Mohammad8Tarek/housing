import { useMemo, useEffect } from "react";
import {
  useListRooms,
  useListBuildings,
  useListAssignments,
} from "@workspace/api-client-react";
import { useQuery } from "@tanstack/react-query";
import { recommendBestRooms } from "@/lib/room-recommender";
import { getProfileDisplayName } from "@/lib/profile-display-utils";

type Params = {
  transferPropertyId: string;
  activePropertyId: any;
  numericPropertyId: number | undefined;
  transferRoomId: string;
  transferOpen: boolean;
  transferEmp: any;
  selectedTransferBed: string;
  setSelectedTransferBed: (v: string) => void;
  roomSearch: string;
  profiles: any[];
  settings: any;
  ar: boolean;
};

/**
 * Loads rooms/buildings/assignments of the transfer target property and
 * derives bed availability, occupant names, AI recommendations and the
 * filtered/sorted room list for the Room Move dialog.
 */
export function useTransferTarget({
  transferPropertyId,
  activePropertyId,
  numericPropertyId,
  transferRoomId,
  transferOpen,
  transferEmp,
  selectedTransferBed,
  setSelectedTransferBed,
  roomSearch,
  profiles,
  settings,
  ar,
}: Params) {
  // For cross-property transfer: load rooms from selected target property
  const targetPropId =
    transferPropertyId && transferPropertyId !== String(activePropertyId)
      ? Number(transferPropertyId)
      : numericPropertyId;
  const { data: _targetRoomsWrapper } = useListRooms(
    { propertyId: targetPropId, limit: 1000 } as any,
    { query: { queryKey: ["listRooms", targetPropId], enabled: !!targetPropId } as any },
  );
  const targetRooms: any[] = Array.isArray(_targetRoomsWrapper)
    ? _targetRoomsWrapper
    : (((_targetRoomsWrapper as any)?.data as any[]) || []);
  const { data: _tbData } = useListBuildings(
    { propertyId: targetPropId } as any,
    { query: { queryKey: ["listBuildings", targetPropId], enabled: !!targetPropId } as any },
  );
  const targetBuildings: any[] = Array.isArray(_tbData)
    ? _tbData
    : (((_tbData as any)?.data as any[]) || []);
  const { data: _taData } = useListAssignments(
    { propertyId: targetPropId } as any,
    {
      query: {
        queryKey: ["listAssignments", targetPropId],
        enabled: !!targetPropId,
        staleTime: 30000,
      },
    },
  );
  const targetAssignments: any[] = Array.isArray(_taData)
    ? _taData
    : (((_taData as any)?.data as any[]) || []);

  // Fetch real-time bed occupancy for the selected target room
  const { data: roomBedOccupancy } = useQuery({
    queryKey: ["/api/rooms", transferRoomId, "bed-occupancy", targetPropId],
    queryFn: async () => {
      if (!transferRoomId) return null;
      const res = await fetch(`/api/rooms/${transferRoomId}/bed-occupancy`, {
        headers: targetPropId ? { "X-Property-Id": String(targetPropId) } : {},
      });
      if (!res.ok) return null;
      return res.json();
    },
    enabled: !!transferRoomId && !!transferOpen,
    staleTime: 5000,
  });

  // Compute occupied beds for transfer target room
  const targetOccupiedBeds = useMemo(() => {
    const set = new Set<number>();
    const selRoomId = parseInt(transferRoomId);
    if (!selRoomId) return set;

    const currentRoom = targetRooms.find((r: any) => r.id === selRoomId);
    const capacity = currentRoom?.capacity ?? 1;

    // 1. From real-time bed-occupancy endpoint
    if (roomBedOccupancy?.beds && Array.isArray(roomBedOccupancy.beds)) {
      for (const b of roomBedOccupancy.beds) {
        if (b.status === "OCCUPIED" || b.status === "VACATION") {
          set.add(Number(b.bedNumber));
        }
      }
    }

    // 2. Cross-check with targetAssignments (handling entire room and normal assignments)
    for (const a of targetAssignments) {
      const aStatus = String(a.status || "").toUpperCase();
      if (aStatus === "ACTIVE" && Number(a.roomId) === selRoomId) {
        if (a.isEntireRoom) {
          for (let i = 1; i <= capacity; i++) {
            set.add(i);
          }
        } else if (a.bedNumber != null) {
          set.add(Number(a.bedNumber));
        }
      }
    }

    return set;
  }, [transferRoomId, roomBedOccupancy, targetAssignments, targetRooms]);

  // Occupants map by bed number
  const bedOccupantsMap = useMemo(() => {
    const map = new Map<number, { name: string; isOnVacation?: boolean }>();
    const selRoomId = parseInt(transferRoomId);
    if (!selRoomId) return map;

    if (roomBedOccupancy?.beds && Array.isArray(roomBedOccupancy.beds)) {
      for (const b of roomBedOccupancy.beds) {
        if (b.occupant?.name) {
          map.set(Number(b.bedNumber), {
            name: b.occupant.name,
            isOnVacation: b.occupant.isOnVacation,
          });
        }
      }
    }

    for (const a of targetAssignments) {
      const aStatus = String(a.status || "").toUpperCase();
      if (aStatus === "ACTIVE" && Number(a.roomId) === selRoomId && a.bedNumber != null) {
        const bedNum = Number(a.bedNumber);
        if (!map.has(bedNum)) {
          const empObj = profiles.find((p: any) => p.id === a.profileId);
          const fullName = empObj
            ? getProfileDisplayName(empObj, ar)
            : a.profileFirstName
              ? `${a.profileFirstName} ${a.profileLastName || ""}`.trim()
              : (a.profileName || (ar ? "نزيل آخر" : "Resident"));
          map.set(bedNum, {
            name: fullName,
            isOnVacation: (a as any).profileStatus === "VACATION",
          });
        }
      }
    }

    return map;
  }, [transferRoomId, roomBedOccupancy, targetAssignments, profiles, ar]);

  const selectedTargetRoom = targetRooms.find(
    (r: any) => r.id === parseInt(transferRoomId),
  );
  const transferRoomCapacity = selectedTargetRoom?.capacity ?? 0;
  const bedOptions = Array.from(
    { length: transferRoomCapacity },
    (_, i) => i + 1,
  );

  // Auto-select first available bed when target room changes or occupied beds update
  useEffect(() => {
    if (!transferRoomId || bedOptions.length === 0) return;
    const isCurrentBedOccupied = selectedTransferBed && targetOccupiedBeds.has(Number(selectedTransferBed));
    if (!selectedTransferBed || isCurrentBedOccupied) {
      const firstFree = bedOptions.find((b) => !targetOccupiedBeds.has(b));
      if (firstFree != null) {
        setSelectedTransferBed(String(firstFree));
      } else {
        setSelectedTransferBed("");
      }
    }
  }, [transferRoomId, targetOccupiedBeds, bedOptions, selectedTransferBed]);

  const targetBuildingMap = Object.fromEntries(
    targetBuildings.map((b: any) => [b.id, b.name]),
  );

  const transferRecommendations = useMemo(() => {
    if (!transferOpen || !transferEmp || targetRooms.length === 0) {
      return { bestRoom: null, scoredRooms: [], recommendedMap: {} as Record<number, any> };
    }
    return recommendBestRooms({
      profile: transferEmp,
      rooms: targetRooms,
      assignments: targetAssignments,
      profiles: [],
      policySettings: settings || {},
    });
  }, [transferOpen, transferEmp, targetRooms, targetAssignments, settings]);

  const transferableRooms = targetRooms.filter(
    (r: any) =>
      r.status?.toLowerCase() !== "maintenance" &&
      (r.currentOccupancy ?? 0) < (r.capacity ?? 1),
  );

  const filteredTransferRooms = useMemo(() => {
    const list = transferableRooms.filter((r: any) => {
      if (!roomSearch.trim()) return true;
      const q = roomSearch.toLowerCase();
      const b = targetBuildingMap[r.buildingId] ?? "";
      return (
        r.roomNumber?.toLowerCase().includes(q) ||
        b.toLowerCase().includes(q) ||
        r.roomType?.toLowerCase().includes(q)
      );
    });

    // Sort by AI recommender score descending so highest matching rooms appear first
    return list.sort((a: any, b: any) => {
      const scoreA = transferRecommendations.recommendedMap[a.id]?.score ?? 0;
      const scoreB = transferRecommendations.recommendedMap[b.id]?.score ?? 0;
      return scoreB - scoreA;
    });
  }, [transferableRooms, roomSearch, targetBuildingMap, transferRecommendations]);

  return {
    targetRooms,
    targetAssignments,
    targetBuildingMap,
    targetOccupiedBeds,
    bedOccupantsMap,
    selectedTargetRoom,
    bedOptions,
    transferRecommendations,
    filteredTransferRooms,
  };
}
