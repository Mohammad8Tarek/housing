// Ticket-system helpers for maintenance / housekeeping requests:
// readable ticket numbers, target (SLA) times per service, and the
// per-ticket history log (maintenance_events).
import { maintenanceEventsTable } from "@workspace/db";

/** MNT-2026-0037 / HK-2026-0012 / GEN-2026-0003 (from the ticket id and year). */
export function ticketNumber(t: {
  id: number;
  category?: string | null;
  reportedAt?: Date | string | null;
  createdAt?: Date | string | null;
}): string {
  const prefix =
    t.category === "housekeeping"
      ? "HK"
      : t.category === "general"
        ? "GEN"
        : "MNT";
  const when = new Date((t.reportedAt ?? t.createdAt ?? Date.now()) as any);
  const year = Number.isNaN(when.getTime())
    ? new Date().getFullYear()
    : when.getFullYear();
  return `${prefix}-${year}-${String(t.id).padStart(4, "0")}`;
}

/** Target minutes to finish each service (problem type) at normal priority. */
export const SERVICE_TARGET_MINUTES: Record<string, number> = {
  // maintenance
  Plumbing: 60,
  Electrical: 60,
  HVAC: 120,
  Furniture: 240,
  Internet: 120,
  Appliances: 120,
  Cleaning: 60,
  Other: 240,
  // housekeeping
  room_cleaning: 60,
  bed_sheets: 45,
  towels: 30,
  deep_cleaning: 240,
  waste_removal: 30,
  sanitization: 120,
  turnover: 120,
  // general
  general_inquiry: 1440,
  inspection: 1440,
  pest_control: 1440,
  other: 240,
};
const DEFAULT_TARGET_MINUTES = 240;

/** Urgent work is due sooner, low priority later. */
const PRIORITY_FACTOR: Record<string, number> = {
  urgent: 0.5,
  high: 0.75,
  medium: 1,
  normal: 1,
  low: 2,
};

export function targetMinutes(
  problemType?: string | null,
  priority?: string | null,
): number {
  const base =
    SERVICE_TARGET_MINUTES[String(problemType ?? "")] ?? DEFAULT_TARGET_MINUTES;
  const factor = PRIORITY_FACTOR[String(priority ?? "").toLowerCase()] ?? 1;
  return Math.max(15, Math.round(base * factor));
}

const DONE = new Set(["resolved", "closed", "completed", "done"]);

/**
 * Due time and whether the ticket is overdue. An explicit dueDate on the
 * ticket wins; otherwise reportedAt + the service's target time.
 */
export function ticketSla(t: {
  problemType?: string | null;
  priority?: string | null;
  status?: string | null;
  reportedAt?: Date | string | null;
  resolvedAt?: Date | string | null;
  dueDate?: string | null;
}): { dueAt: string | null; slaMinutes: number; isOverdue: boolean } {
  const slaMinutes = targetMinutes(t.problemType, t.priority);
  let due: Date | null = null;
  if (t.dueDate) {
    const d = new Date(t.dueDate);
    if (!Number.isNaN(d.getTime())) due = d;
  }
  if (!due && t.reportedAt) {
    const r = new Date(t.reportedAt as any);
    if (!Number.isNaN(r.getTime()))
      due = new Date(r.getTime() + slaMinutes * 60_000);
  }
  if (!due) return { dueAt: null, slaMinutes, isOverdue: false };
  const done = DONE.has(String(t.status ?? "").toLowerCase());
  const finishedAt =
    done && t.resolvedAt ? new Date(t.resolvedAt as any) : null;
  // Open ticket past due, or finished after its due time.
  const isOverdue = done
    ? !!finishedAt && finishedAt.getTime() > due.getTime()
    : Date.now() > due.getTime();
  return { dueAt: due.toISOString(), slaMinutes, isOverdue };
}

export type TicketEventType =
  | "created"
  | "status"
  | "assigned"
  | "priority"
  | "comment";

/** Add entries to a ticket's history (inside the property's tenant db). */
export async function recordTicketEvents(
  tenantDb: any,
  ticketId: number,
  actor: {
    name?: string | null;
    userId?: number | null;
    profileId?: number | null;
  },
  events: Array<{
    type: TicketEventType;
    fromValue?: string | null;
    toValue?: string | null;
    comment?: string | null;
  }>,
): Promise<void> {
  if (events.length === 0) return;
  try {
    await tenantDb.insert(maintenanceEventsTable).values(
      events.map((e) => ({
        ticketId,
        type: e.type,
        fromValue: e.fromValue ?? null,
        toValue: e.toValue ?? null,
        comment: e.comment ?? null,
        actorName: actor.name ?? null,
        actorUserId: actor.userId ?? null,
        actorProfileId: actor.profileId ?? null,
      })),
    );
  } catch (err: any) {
    // History must never block the ticket change itself (e.g. table not yet
    // migrated on a tenant).
    console.warn("[maintenance] could not record ticket events:", err?.message);
  }
}
