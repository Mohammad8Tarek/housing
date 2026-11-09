import type { Room, Assignment } from "@workspace/api-client-react";
import { matchesSearch } from "@/lib/search-utils";
import type { OccupantInfo, Recommendation } from "../types";

/** Active assignments indexed by roomId. */
export function buildRoomActiveAssignmentsMap(allAssignments: Assignment[]): Map<number, any[]> {
  const map = new Map<number, any[]>();
  for (const a of allAssignments) {
    if (a.status === "ACTIVE") {
      const rId = Number(a.roomId);
      if (!map.has(rId)) map.set(rId, []);
      map.get(rId)!.push(a);
    }
  }
  return map;
}

/** Set of rooms occupied entirely by a single resident. */
export function buildEntireRoomOccupiedSet(allAssignments: Assignment[]): Set<number> {
  const set = new Set<number>();
  allAssignments
    .filter(
      (a: any) =>
        a.status === "ACTIVE" &&
        (a.isEntireRoom || a.is_entire_room),
    )
    .forEach((a: any) => set.add(Number(a.roomId)));
  return set;
}

/** Single occupant rooms: capacity > 1 and currently occupied by exactly 1 person. */
export function buildSingleOccupantRoomsMap(
  rooms: Room[],
  roomActiveAssignmentsMap: Map<number, any[]>,
  entireRoomOccupiedSet: Set<number>,
  ar: boolean,
): Map<number, OccupantInfo> {
  const map = new Map<number, OccupantInfo>();
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
}

/** Bed occupants map for the currently selected room. */
export function buildSelectedRoomBedMap(
  selectedRoomId: string,
  rooms: Room[],
  roomActiveAssignmentsMap: Map<number, any[]>,
  entireRoomOccupiedSet: Set<number>,
  ar: boolean,
): Map<number, OccupantInfo> {
  const map = new Map<number, OccupantInfo>();
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
}

/** استبعاد الغرف غير الصالحة للسكن (صيانة، خارج الخدمة، خارج النظام) — full rooms sorted last. */
export function getAvailableRooms(rooms: Room[]): Room[] {
  return rooms
    .filter((r) => {
      const s = r.status?.toLowerCase() || "";
      return !["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(s);
    })
    .sort((a, b) => {
      const aFull = a.currentOccupancy >= a.capacity;
      const bFull = b.currentOccupancy >= b.capacity;
      if (aFull && !bFull) return 1;
      if (!aFull && bFull) return -1;
      return 0;
    });
}

/** الغرف بعد تطبيق الفلاتر */
export function filterRooms(
  availableRooms: Room[],
  searchBuilding: string,
  searchFloor: string,
  searchRoomNumber: string,
): Room[] {
  return availableRooms.filter((r) => {
    const bId = r.buildingId ?? (r as any).building_id;
    const fId = r.floorId ?? (r as any).floor_id;
    if (searchBuilding !== "all" && String(bId) !== String(searchBuilding))
      return false;
    if (searchFloor !== "all" && String(fId) !== String(searchFloor))
      return false;
    if (searchRoomNumber.trim()) {
      if (!matchesSearch([r.roomNumber, r.roomType, r.bedType, r.features], searchRoomNumber)) {
        return false;
      }
    }
    return true;
  });
}

/** Pre-sort filtered rooms so recommended ones appear first. */
export function sortRoomsByRecommendation(filteredRooms: Room[], recommendation: Recommendation): Room[] {
  if (!recommendation) return filteredRooms;
  return [...filteredRooms].sort((a, b) => {
    const isRecA = recommendation.recommendedMap[a.id]?.levelMatch ? 1 : 0;
    const isRecB = recommendation.recommendedMap[b.id]?.levelMatch ? 1 : 0;
    if (isRecA !== isRecB) return isRecB - isRecA;
    const scoreA = recommendation.recommendedMap[a.id]?.score ?? 0;
    const scoreB = recommendation.recommendedMap[b.id]?.score ?? 0;
    return scoreB - scoreA;
  });
}

/** Returns the first bed in a room that has no active occupant (undefined when none). */
export function findFirstFreeBed(room: Room, allAssignments: Assignment[]): number | undefined {
  const bCap = room.capacity || 1;
  const curOccs = (allAssignments || []).filter(
    (a: any) => a.status === "ACTIVE" && a.roomId === room.id && a.bedNumber != null
  ).map((a: any) => a.bedNumber);
  return Array.from({ length: bCap }, (_, i) => i + 1).find(b => !curOccs.includes(b));
}
