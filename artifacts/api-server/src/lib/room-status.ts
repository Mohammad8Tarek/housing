// Pure room-status transition rules (AGENTS.md Rule 5: Room Lifecycle).
//
// These two transitions were duplicated inline across every check-in /
// checkout / transfer / reservation / hosting handler. Centralizing them here
// gives a single source of truth that is unit-tested in CI (the end-to-end
// lifecycle suite only runs against a live database, so it self-skips in CI).
//
// Status vocabulary (subset relevant here):
//   available        - vacant, ready
//   occupied         - has at least one active resident
//   dirty            - vacant, awaiting housekeeping
//   occupied_dirty   - still occupied AND awaiting housekeeping
//   occupied_vacation- occupied but every remaining resident is on vacation

/** Room statuses that mean "still needs cleaning". */
export const DIRTY_ROOM_STATES = ["dirty", "occupied_dirty"] as const;

/**
 * True when a room is flagged for housekeeping, regardless of case or
 * null/undefined. Mirrors the inline
 * `["dirty","occupied_dirty"].includes(String(status ?? "").toLowerCase())`
 * checks it replaces.
 */
export function isDirtyRoomStatus(status: string | null | undefined): boolean {
  const s = String(status ?? "").toLowerCase();
  return (DIRTY_ROOM_STATES as readonly string[]).includes(s);
}

/**
 * Status a room takes when an occupant leaves (checkout, transfer-out, vacate).
 * The room always needs cleaning afterwards: empty -> `dirty`, still occupied
 * -> `occupied_dirty`. Callers may still override to `occupied_vacation` when
 * the remaining residents are all on vacation.
 */
export function roomStatusAfterDeparture(
  remainingOccupancy: number,
): "dirty" | "occupied_dirty" {
  return remainingOccupancy <= 0 ? "dirty" : "occupied_dirty";
}

/**
 * Status a room takes when an occupant is placed into it (check-in, transfer-in,
 * reservation, hosting). A room awaiting cleaning keeps its dirty flag as
 * `occupied_dirty`; otherwise it becomes plain `occupied`.
 */
export function roomStatusAfterCheckIn(
  previousStatus: string | null | undefined,
): "occupied" | "occupied_dirty" {
  return isDirtyRoomStatus(previousStatus) ? "occupied_dirty" : "occupied";
}
