import { useMemo } from "react";

interface UseRoomOccupancyArgs {
  rooms: any[];
  allAssignments: any[];
  selectedRoomId: string;
  ar: boolean;
}

/** Derived occupancy maps (active assignments, entire-room locks, single occupants, bed map). */
export function useRoomOccupancy({ rooms, allAssignments, selectedRoomId, ar }: UseRoomOccupancyArgs) {
  // Active assignments indexed by roomId
  const roomActiveAssignmentsMap = useMemo(() => {
    const map = new Map<number, any[]>();
    for (const a of allAssignments) {
      if (a.status === "ACTIVE") {
        const rId = Number(a.roomId);
        if (!map.has(rId)) map.set(rId, []);
        map.get(rId)!.push(a);
      }
    }
    return map;
  }, [allAssignments]);

  const entireRoomOccupiedSet = useMemo(() => {
    const set = new Set<number>();
    allAssignments
      .filter((a: any) => a.status === "ACTIVE" && (a.isEntireRoom || a.is_entire_room))
      .forEach((a: any) => set.add(Number(a.roomId)));
    return set;
  }, [allAssignments]);

  // Single occupant rooms: capacity > 1 and currently occupied by exactly 1 person
  const singleOccupantRoomsMap = useMemo(() => {
    const map = new Map<number, { residentName: string }>();
    for (const room of rooms) {
      const cap = room.capacity ?? 1;
      if (cap <= 1) continue;
      const rId = Number(room.id);
      const activeList = roomActiveAssignmentsMap.get(rId) || [];
      const occ = room.currentOccupancy ?? 0;
      const effectiveOcc = Math.max(occ, activeList.length);
      const isEntire = entireRoomOccupiedSet.has(rId);

      if (effectiveOcc === 1 || (isEntire && cap > 1)) {
        const first = activeList[0];
        const name = first
          ? [first.profileFirstName || first.firstName, first.profileLastName || first.lastName].filter(Boolean).join(" ") || first.employeeName || first.profileName || (ar ? "نزيل مسكن" : "Resident")
          : (ar ? "نزيل بمفرده" : "Single Resident");
        map.set(rId, { residentName: name });
      }
    }
    return map;
  }, [rooms, roomActiveAssignmentsMap, entireRoomOccupiedSet, ar]);

  // Bed occupants map for currently selected room
  const selectedRoomBedMap = useMemo(() => {
    const map = new Map<number, { residentName: string }>();
    if (!selectedRoomId) return map;
    const rId = parseInt(selectedRoomId);
    const room = rooms.find((r: any) => r.id === rId);
    const cap = room?.capacity ?? 1;
    const activeList = roomActiveAssignmentsMap.get(rId) || [];
    const isEntire = entireRoomOccupiedSet.has(rId);

    if (isEntire) {
      for (let b = 1; b <= cap; b++) {
        map.set(b, { residentName: ar ? "محجوز (غرفة كاملة)" : "Occupied (Full Room)" });
      }
      return map;
    }

    const unassigned: string[] = [];
    for (const a of activeList) {
      const name = [a.profileFirstName || a.firstName, a.profileLastName || a.lastName].filter(Boolean).join(" ") || a.employeeName || a.profileName || (ar ? "نزيل مسكن" : "Resident");
      if (a.bedNumber != null && Number(a.bedNumber) > 0) {
        map.set(Number(a.bedNumber), { residentName: name });
      } else {
        unassigned.push(name);
      }
    }

    let nextBed = 1;
    for (const name of unassigned) {
      while (nextBed <= cap && map.has(nextBed)) {
        nextBed++;
      }
      if (nextBed <= cap) {
        map.set(nextBed, { residentName: name });
        nextBed++;
      }
    }

    return map;
  }, [selectedRoomId, rooms, roomActiveAssignmentsMap, entireRoomOccupiedSet, ar]);

  const occupiedBeds = useMemo(() => {
    return new Set<number>(Array.from(selectedRoomBedMap.keys()));
  }, [selectedRoomBedMap]);

  return { roomActiveAssignmentsMap, entireRoomOccupiedSet, singleOccupantRoomsMap, selectedRoomBedMap, occupiedBeds };
}
