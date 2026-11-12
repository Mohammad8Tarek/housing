// Open tickets measured against their target time: what is already late,
// what is about to be, and who / which department holds them. Feeds the
// dashboard's "Late tickets" card.
import { sql } from "drizzle-orm";
import { withTenant } from "@workspace/db";
import { ticketNumber, ticketSla } from "./maintenance-tickets.js";
import { loadServiceCatalogue } from "./maintenance-services.js";
import { SERVICE_LABELS } from "./maintenance-daily-report.js";

const OPEN_STATUSES = ["open", "pending", "in_progress"];
/** "Due soon": less than this share of the target time left (min 30 minutes). */
const DUE_SOON_SHARE = 0.25;
const DUE_SOON_MIN_MINUTES = 30;

export type SlaState = "overdue" | "due_soon" | "on_track";

export interface SlaWatchTicket {
  id: number;
  ticketNo: string;
  category: string;
  serviceAr: string;
  serviceEn: string;
  priority: string;
  status: string;
  location: string;
  technician: string | null;
  reportedAt: string | null;
  dueAt: string;
  /** Negative = minutes late; positive = minutes left. */
  minutesLeft: number;
  state: SlaState;
}

export interface SlaGroup {
  key: string;
  open: number;
  overdue: number;
  dueSoon: number;
}

export interface SlaWatch {
  open: number;
  overdue: number;
  dueSoon: number;
  onTrack: number;
  byDepartment: SlaGroup[];
  byTechnician: SlaGroup[];
  /** Late first (most late at the top), then due soon (least time left first). */
  tickets: SlaWatchTicket[];
}

export function classify(minutesLeft: number, slaMinutes: number): SlaState {
  if (minutesLeft < 0) return "overdue";
  const soon = Math.max(DUE_SOON_MIN_MINUTES, slaMinutes * DUE_SOON_SHARE);
  return minutesLeft <= soon ? "due_soon" : "on_track";
}

function group(
  tickets: SlaWatchTicket[],
  keyOf: (t: SlaWatchTicket) => string,
) {
  const map = new Map<string, SlaGroup>();
  for (const t of tickets) {
    const key = keyOf(t);
    const g = map.get(key) ?? { key, open: 0, overdue: 0, dueSoon: 0 };
    g.open++;
    if (t.state === "overdue") g.overdue++;
    if (t.state === "due_soon") g.dueSoon++;
    map.set(key, g);
  }
  return [...map.values()].sort(
    (a, b) => b.overdue - a.overdue || b.dueSoon - a.dueSoon || b.open - a.open,
  );
}

export function summarise(all: SlaWatchTicket[], limit = 20): SlaWatch {
  const late = all
    .filter((t) => t.state === "overdue")
    .sort((a, b) => a.minutesLeft - b.minutesLeft);
  const soon = all
    .filter((t) => t.state === "due_soon")
    .sort((a, b) => a.minutesLeft - b.minutesLeft);
  return {
    open: all.length,
    overdue: late.length,
    dueSoon: soon.length,
    onTrack: all.length - late.length - soon.length,
    byDepartment: group(all, (t) => t.category),
    byTechnician: group(
      all.filter((t) => t.technician),
      (t) => t.technician as string,
    ),
    tickets: [...late, ...soon].slice(0, limit),
  };
}

export async function buildSlaWatch(
  propertyId: number,
  now: Date = new Date(),
): Promise<SlaWatch> {
  const rows: any[] = await withTenant(propertyId, async (tenantDb) => {
    const res = await tenantDb.execute(sql`
      SELECT m.id, m.category, m.problem_type, m.status, m.priority,
             m.reported_at, m.due_date,
             r.room_number, b.name AS building_name, w.name AS worker_name,
             nullif(trim(coalesce(p.first_name, '') || ' ' || coalesce(p.last_name, '')), '') AS assignee_name
      FROM maintenance m
      LEFT JOIN rooms r ON r.id = m.room_id
      LEFT JOIN buildings b ON b.id = r.building_id
      LEFT JOIN workers w ON w.id = m.worker_id
      LEFT JOIN profiles p ON p.id = m.assigned_to
      WHERE m.status IN (${sql.join(
        OPEN_STATUSES.map((s) => sql`${s}`),
        sql`, `,
      )})
    `);
    return (res as any).rows ?? res;
  });

  const catalogue = await loadServiceCatalogue(propertyId);
  const tickets: SlaWatchTicket[] = [];
  for (const r of rows) {
    const reportedAt = r.reported_at ? new Date(r.reported_at) : null;
    const own = catalogue.get(r.problem_type);
    const sla = ticketSla(
      {
        problemType: r.problem_type,
        priority: r.priority,
        status: r.status,
        reportedAt,
        dueDate: r.due_date,
      },
      own?.targetMinutes,
    );
    if (!sla.dueAt) continue;
    const minutesLeft = Math.round(
      (new Date(sla.dueAt).getTime() - now.getTime()) / 60_000,
    );
    const label = own
      ? { ar: own.labelAr, en: own.labelEn }
      : (SERVICE_LABELS[r.problem_type] ?? {
          ar: String(r.problem_type ?? "—"),
          en: String(r.problem_type ?? "—"),
        });
    tickets.push({
      id: Number(r.id),
      ticketNo: ticketNumber({ id: r.id, category: r.category, reportedAt }),
      category: r.category || "maintenance",
      serviceAr: label.ar,
      serviceEn: label.en,
      priority: r.priority || "medium",
      status: r.status,
      location: r.room_number
        ? `${r.room_number}${r.building_name ? ` · ${r.building_name}` : ""}`
        : r.building_name || "—",
      technician: r.worker_name || r.assignee_name || null,
      reportedAt: reportedAt ? reportedAt.toISOString() : null,
      dueAt: sla.dueAt,
      minutesLeft,
      state: classify(minutesLeft, sla.slaMinutes),
    });
  }
  return summarise(tickets);
}
