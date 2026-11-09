import {
  useListRooms,
  useListBuildings,
  useListFloors,
  useListAssignments,
  useListProfiles,
  useGetSettings,
} from "@workspace/api-client-react";
import type { ListRoomsParams } from "@workspace/api-client-react";
import type {
  Room,
  Building,
  Floor,
  Assignment,
} from "@workspace/api-client-react";

/**
 * Tenant-scoped reference data for the smart room assignment wizard:
 * settings, profiles, rooms, buildings, floors and assignments of the
 * target property. Query keys / staleTimes are unchanged from the page.
 */
export function useRoomAssignmentQueries({
  activePropertyId,
  effectiveTargetPropId,
}: {
  activePropertyId: number | "all" | null | undefined;
  effectiveTargetPropId: number;
}) {
  const { data: settings } = useGetSettings(undefined, {
    query: {
      queryKey: ["/api/settings"],
      enabled: !!activePropertyId,
    },
  });

  const { data: allProfilesData } = useListProfiles(
    { propertyId: effectiveTargetPropId, limit: 1000 } as any,
    { query: { queryKey: ["/api/profiles", effectiveTargetPropId], enabled: !!effectiveTargetPropId } as any }
  );
  const profilesList = (allProfilesData as any)?.profiles || (allProfilesData as any)?.data || [];

  // NOTE: backend reads `limit` from the query string even though the
  // generated ListRoomsParams type omits it — keep it via cast (no runtime change).
  const roomsQuery = {
    propertyId: effectiveTargetPropId,
    limit: 1000,
  } as ListRoomsParams;
  const { data: _rData } = useListRooms(roomsQuery, {
    query: {
      queryKey: ["/api/rooms", roomsQuery],
      enabled: !!effectiveTargetPropId,
      staleTime: 30000,
    },
  });
  // NOTE: /api/rooms returns a { data, pagination } envelope (not a bare
  // array), so unwrap .data first. Runtime shape verified in routes/rooms.ts.
  const rooms: Room[] = Array.isArray(_rData)
    ? _rData
    : (((_rData as unknown as { data?: Room[] })?.data as Room[] | undefined) || []);

  const { data: _bData } = useListBuildings(
    { propertyId: effectiveTargetPropId },
    {
      query: {
        queryKey: ["/api/buildings", effectiveTargetPropId],
        enabled: !!effectiveTargetPropId,
        staleTime: 300000,
      },
    },
  );
  const buildings: Building[] = Array.isArray(_bData)
    ? _bData
    : (((_bData as any)?.data as Building[] | undefined) || []);
  const { data: _fData } = useListFloors(
    { propertyId: effectiveTargetPropId },
    {
      query: {
        queryKey: ["/api/floors", effectiveTargetPropId],
        enabled: !!effectiveTargetPropId,
        staleTime: 300000,
      },
    },
  );
  const floors: Floor[] = Array.isArray(_fData)
    ? _fData
    : (((_fData as any)?.data as Floor[] | undefined) || []);

  const { data: _aData } = useListAssignments(
    { propertyId: effectiveTargetPropId, limit: 5000 } as any,
    {
      query: {
        queryKey: ["/api/assignments", effectiveTargetPropId, 5000],
        enabled: !!effectiveTargetPropId,
        staleTime: 30000,
      },
    },
  );
  // NOTE: /api/assignments returns a { data, pagination } envelope.
  const allAssignments: Assignment[] = Array.isArray(_aData)
    ? _aData
    : (((_aData as unknown as { data?: Assignment[] })?.data as Assignment[] | undefined) || []);

  return { settings, profilesList, roomsQuery, rooms, buildings, floors, allAssignments };
}
