/**
 * Shared types/helpers for the accommodation wizards (reservations, smart room
 * assignment). Previously duplicated in ReservationsPage.tsx and room-assignment.tsx.
 */

/** A profile row as returned by the profile search endpoints. */
export type ProfileResult = {
  id: number;
  propertyId: number;
  propertyName: string | null;
  profileId: string;
  firstName: string;
  lastName: string;
  thirdName?: string;
  fourthName?: string;
  nationalId: string;
  jobTitle: string | null;
  department: string | null;
  nationality: string | null;
  phone: string | null;
  level: string | null;
  status: string;
  gender: string | null;
  employmentType?: string | null;
  companyName?: string | null;
  contractEndDate?: string | null;
  accommodationRoom?: string | null;
  accommodationRoomType?: string | null;
  accommodationBuilding?: string | null;
  accommodationFloor?: string | null;
  photoUrl?: string | null;
};

export const roomTypeCapacity: Record<string, number> = {
  single: 1,
  double: 2,
  triple: 3,
  quad: 4,
};

/** Bed numbers selectable for a room: by room type first, then by its stored capacity. */
export function getBedOptions(
  roomType?: string | null,
  capacity?: number | null,
): number[] {
  const max =
    roomTypeCapacity[roomType?.toLowerCase() || ""] ?? (capacity || 1);
  return Array.from({ length: max }, (_, i) => i + 1);
}
