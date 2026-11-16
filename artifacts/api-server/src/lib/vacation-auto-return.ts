// Auto-close vacations whose end date has passed.
//
// A vacation (profile_vacations row, status ACTIVE) ends on its `end_date`.
// This cron runs hourly (Cairo) and, for every active vacation whose end date
// is in the past, returns the employee automatically: the vacation log is
// marked COMPLETED, the profile goes back to ACTIVE, and the room is restored
// from `occupied_vacation` to `occupied`. It covers vacations created by an
// admin as well as those pushed in by the HR sync, since both write the same
// profile_vacations / profile status.
//
// It is idempotent (only ACTIVE vacations past their end date are touched) and
// never shortens a vacation that HR later extended, because it reads the
// current end_date each pass.
import cron from "node-cron";
import { and, eq, lt } from "drizzle-orm";
import {
  db,
  propertiesTable,
  profilesTable,
  profileVacationsTable,
  assignmentsTable,
  roomsTable,
  withTenant,
} from "@workspace/db";
import { logActivity } from "./activity-logger.js";
import { broadcastToProperty } from "./websocket.js";
import { logger } from "./logger.js";
import { REPORT_TIME_ZONE } from "./maintenance-daily-report.js";

/** Today's date (YYYY-MM-DD) in the operational time zone. */
function cairoToday(now: Date = new Date()): string {
  // en-CA renders as ISO YYYY-MM-DD.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: REPORT_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** Auto-return every finished vacation for one property. */
export async function runVacationReturnsForProperty(
  propertyId: number,
  today: string = cairoToday(),
): Promise<{ returned: number }> {
  const due: any[] = await withTenant(propertyId, async (tenantDb) =>
    tenantDb
      .select()
      .from(profileVacationsTable)
      .where(
        and(
          eq(profileVacationsTable.status, "ACTIVE"),
          lt(profileVacationsTable.endDate, today),
        ),
      ),
  );
  if (due.length === 0) return { returned: 0 };

  let returned = 0;
  for (const v of due) {
    await withTenant(propertyId, async (tenantDb) => {
      // 1. Close the vacation log (keep an explicit return date).
      await tenantDb
        .update(profileVacationsTable)
        .set({
          status: "COMPLETED",
          actualReturnDate: v.actualReturnDate || v.endDate,
        })
        .where(eq(profileVacationsTable.id, v.id));

      // 2. Profile back to ACTIVE (only if still flagged on vacation).
      const [p] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, v.profileId));
      if (p && String(p.status || "").toUpperCase() === "VACATION") {
        await tenantDb
          .update(profilesTable)
          .set({
            status: "ACTIVE",
            vacationStartDate: null,
            vacationEndDate: null,
            vacationNotes: "",
          })
          .where(eq(profilesTable.id, v.profileId));
      }

      // 3. Restore the room from occupied_vacation → occupied.
      const [activeAssign] = await tenantDb
        .select({ roomId: assignmentsTable.roomId })
        .from(assignmentsTable)
        .where(
          and(
            eq(assignmentsTable.profileId, v.profileId),
            eq(assignmentsTable.status, "ACTIVE"),
          ),
        );
      if (activeAssign?.roomId) {
        const [room] = await tenantDb
          .select({ id: roomsTable.id, status: roomsTable.status })
          .from(roomsTable)
          .where(eq(roomsTable.id, activeAssign.roomId));
        if (room?.status === "occupied_vacation") {
          await tenantDb
            .update(roomsTable)
            .set({ status: "occupied" })
            .where(eq(roomsTable.id, room.id));
        }
      }
    });

    await logActivity({
      propertyId,
      username: "system",
      userRole: "system",
      action: `إنهاء إجازة تلقائياً وعودة الموظف #${v.profileId} إلى العمل (انتهت الإجازة في ${v.endDate})`,
      actionType: "UPDATE",
      module: "profiles",
      entityType: "profile",
      entityId: Number(v.profileId),
    });
    returned++;
  }

  if (returned > 0) {
    broadcastToProperty(propertyId, { module: "profiles", action: "updated" });
    broadcastToProperty(propertyId, { module: "assignments", action: "updated" });
    broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
    logger.info({ propertyId, returned }, "vacation auto-return");
  }
  return { returned };
}

/** Hourly (Cairo): auto-return finished vacations across every property. */
export function initVacationAutoReturnCron(): void {
  cron.schedule(
    "7 * * * *",
    async () => {
      const today = cairoToday();
      let props: { id: number }[] = [];
      try {
        props = await db
          .select({ id: propertiesTable.id })
          .from(propertiesTable);
      } catch (err: any) {
        logger.error(
          { err: err?.message },
          "vacation auto-return: cannot list properties",
        );
        return;
      }
      for (const p of props) {
        try {
          await runVacationReturnsForProperty(p.id, today);
        } catch (err: any) {
          logger.error(
            { propertyId: p.id, err: err?.message },
            "vacation auto-return failed",
          );
        }
      }
    },
    { timezone: REPORT_TIME_ZONE },
  );
  logger.info("Vacation auto-return dispatcher active (hourly)");
}
