// Auto-escalation of overdue maintenance tickets (opt-in per property).
//
// When a property enables it (settings.maintenance_escalation_enabled), a cron
// periodically raises the priority of open tickets that have blown their SLA /
// due date and re-escalates them every `maintenance_escalation_hours` they stay
// overdue, up to MAX_ESCALATION_LEVEL. Each escalation bumps the priority,
// stamps escalation_level / escalated_at, appends a note, logs an activity and
// broadcasts a WebSocket update so the dashboard reflects it live.
//
// It never touches resolved/closed tickets and never lowers a priority.
import cron from "node-cron";
import { sql } from "drizzle-orm";
import { db, propertiesTable, settingsTable, withTenant } from "@workspace/db";
import { ticketSla } from "./maintenance-tickets.js";
import { loadServiceCatalogue } from "./maintenance-services.js";
import { logActivity } from "./activity-logger.js";
import { broadcastToProperty } from "./websocket.js";
import { logger } from "./logger.js";
import { REPORT_TIME_ZONE } from "./maintenance-daily-report.js";

const OPEN_STATUSES = ["open", "pending", "in_progress"];
export const MAX_ESCALATION_LEVEL = 2;

const PRIORITY_RANK: Record<string, number> = {
  low: 0,
  medium: 1,
  high: 2,
  urgent: 3,
};
// The minimum priority each escalation level guarantees.
const LEVEL_FLOOR: Record<number, string> = { 1: "high", 2: "urgent" };

/** Raise `current` to at least `floor`; never lowers an already-higher priority. */
export function raisePriority(current: string, floor: string): string {
  const cur = PRIORITY_RANK[String(current).toLowerCase()] ?? 1;
  const flr = PRIORITY_RANK[floor] ?? cur;
  return cur >= flr ? String(current).toLowerCase() : floor;
}

export interface EscalationCandidate {
  priority: string;
  escalationLevel: number;
  escalatedAt: Date | string | null;
  isOverdue: boolean;
}

/**
 * Pure decision: should this ticket escalate now, and to what?
 * Returns null when no action is due.
 */
export function decideEscalation(
  t: EscalationCandidate,
  escalationHours: number,
  now: Date = new Date(),
): { level: number; priority: string } | null {
  if (!t.isOverdue) return null;
  const level = Number(t.escalationLevel ?? 0);
  if (level >= MAX_ESCALATION_LEVEL) return null;

  if (level >= 1) {
    // Re-escalate only after it has stayed overdue for the configured gap.
    const last = t.escalatedAt ? new Date(t.escalatedAt).getTime() : NaN;
    const hoursSince = Number.isFinite(last)
      ? (now.getTime() - last) / 3_600_000
      : Infinity;
    if (hoursSince < Math.max(1, escalationHours)) return null;
  }

  const next = level + 1;
  return {
    level: next,
    priority: raisePriority(t.priority, LEVEL_FLOOR[next] ?? "urgent"),
  };
}

/** Run one escalation pass for a single property. Returns how many escalated. */
export async function runEscalationForProperty(
  propertyId: number,
  now: Date = new Date(),
): Promise<{ escalated: number }> {
  const settings: any = await withTenant(propertyId, async (tenantDb) => {
    const [s] = await tenantDb.select().from(settingsTable).limit(1);
    return s;
  });
  if (!settings?.maintenanceEscalationEnabled) return { escalated: 0 };
  const hours = Number(settings.maintenanceEscalationHours ?? 12) || 12;

  const rows: any[] = await withTenant(propertyId, async (tenantDb) => {
    const res = await tenantDb.execute(sql`
      SELECT m.id, m.category, m.problem_type, m.status, m.priority,
             m.reported_at, m.due_date, m.notes,
             m.escalation_level, m.escalated_at
      FROM maintenance m
      WHERE m.status IN (${sql.join(
        OPEN_STATUSES.map((s) => sql`${s}`),
        sql`, `,
      )})
    `);
    return (res as any).rows ?? res;
  });
  if (rows.length === 0) return { escalated: 0 };

  const catalogue = await loadServiceCatalogue(propertyId);
  let escalated = 0;

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
    const isOverdue = new Date(sla.dueAt).getTime() < now.getTime();

    const decision = decideEscalation(
      {
        priority: r.priority || "medium",
        escalationLevel: Number(r.escalation_level ?? 0),
        escalatedAt: r.escalated_at ?? null,
        isOverdue,
      },
      hours,
      now,
    );
    if (!decision) continue;

    const note = `[تصعيد تلقائي / Auto-escalation] المستوى ${decision.level} — تجاوز الوقت المحدد (الأولوية: ${decision.priority})`;
    await withTenant(propertyId, async (tenantDb) => {
      await tenantDb.execute(sql`
        UPDATE maintenance
        SET priority = ${decision.priority},
            escalation_level = ${decision.level},
            escalated_at = ${now.toISOString()},
            notes = CASE
              WHEN notes IS NULL OR notes = '' THEN ${note}
              ELSE notes || ' | ' || ${note}
            END
        WHERE id = ${r.id}
      `);
    });

    await logActivity({
      propertyId,
      username: "system",
      userRole: "system",
      action: `تصعيد تلقائي للتذكرة #${r.id} إلى المستوى ${decision.level} (الأولوية ${decision.priority}) لتجاوزها الوقت المحدد`,
      actionType: "UPDATE",
      module: "maintenance",
      entityType: "maintenance",
      entityId: Number(r.id),
      severity: "warning",
    });
    escalated++;
  }

  if (escalated > 0) {
    broadcastToProperty(propertyId, { module: "maintenance", action: "updated" });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
    logger.info({ propertyId, escalated }, "maintenance auto-escalation");
  }
  return { escalated };
}

/** Every 15 minutes (Cairo): escalate overdue tickets for enabled properties. */
export function initMaintenanceEscalationCron(): void {
  cron.schedule(
    "*/15 * * * *",
    async () => {
      const now = new Date();
      let props: { id: number }[] = [];
      try {
        props = await db
          .select({ id: propertiesTable.id })
          .from(propertiesTable);
      } catch (err: any) {
        logger.error(
          { err: err?.message },
          "maintenance escalation: cannot list properties",
        );
        return;
      }
      for (const p of props) {
        try {
          await runEscalationForProperty(p.id, now);
        } catch (err: any) {
          logger.error(
            { propertyId: p.id, err: err?.message },
            "maintenance escalation failed",
          );
        }
      }
    },
    { timezone: REPORT_TIME_ZONE },
  );
  logger.info("Maintenance auto-escalation dispatcher active (every 15 min)");
}
