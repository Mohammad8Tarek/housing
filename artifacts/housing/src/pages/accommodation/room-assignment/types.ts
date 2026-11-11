import type {
  recommendBestRooms,
  checkPolicyCompliance,
} from "@/lib/room-recommender";

/** Result of `recommendBestRooms` (null until a profile is selected and rooms are loaded). */
export type Recommendation = ReturnType<typeof recommendBestRooms> | null;

/** Result of `checkPolicyCompliance` (or the compliant fallback). */
export type PolicyCheckResult = ReturnType<typeof checkPolicyCompliance>;

/** Occupant info keyed by bed number / room id. */
export type OccupantInfo = { residentName: string };

/** Payload captured when the backend reports a bed whose occupant is on vacation. */
export type VacationPromptData = {
  occupantName: string;
  vacationEndDate?: string;
};

/** Floor lookup entry derived from the floors list. */
export type FloorInfo = { name: string; number: string };
