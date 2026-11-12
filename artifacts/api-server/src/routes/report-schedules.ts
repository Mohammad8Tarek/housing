// Scheduled report emails, per property.
// - Anyone with reports.view sees the property's schedules.
// - reports.export creates a schedule; it runs with the creator's permissions.
// - The creator, or anyone with reports.config, edits / deletes / sends now.
//   When someone else edits a schedule it becomes theirs (runs as them), so
//   nobody can redirect another user's data to new recipients.
import { Router, type Request, type Response } from "express";
import { asc, eq } from "drizzle-orm";
import { reportSchedulesTable, withTenant } from "@workspace/db";
import {
  hasPermission,
  requirePermission,
} from "../middlewares/permissions.js";
import { validate } from "../middlewares/validate.js";
import {
  CreateReportScheduleBody,
  IdParams,
  UpdateReportScheduleBody,
} from "../validation/schemas.js";
import { getTenantId } from "../lib/request-utils.js";
import { runSchedule } from "../lib/report-schedules.js";
import { parseRecipients } from "../lib/maintenance-daily-report.js";
import { logActivity } from "../lib/activity-logger.js";

const router: Router = Router();

const normRecipients = (raw: string) => parseRecipients(raw).join(", ");

function dayFields(body: any) {
  return {
    dayOfWeek: body.frequency === "weekly" ? (body.dayOfWeek ?? 0) : null,
    dayOfMonth: body.frequency === "monthly" ? (body.dayOfMonth ?? 1) : null,
  };
}

function property(req: Request, res: Response): number | null {
  const id = getTenantId(req);
  if (!id) {
    res.status(400).json({ error: "propertyId is required" });
    return null;
  }
  return id;
}

async function loadOwned(req: Request, res: Response, propertyId: number) {
  const actor = (req as any).authUser;
  const [row] = await withTenant(propertyId, (tenantDb) =>
    tenantDb
      .select()
      .from(reportSchedulesTable)
      .where(eq(reportSchedulesTable.id, Number(req.params.id)))
      .limit(1),
  );
  if (!row) {
    res.status(404).json({ error: "التقرير المجدول غير موجود / Not found" });
    return null;
  }
  if (
    row.createdBy !== actor.id &&
    !hasPermission(actor, "reports", "config")
  ) {
    res.status(403).json({
      error: "يمكنك تعديل تقاريرك المجدولة فقط",
      errorEn: "You can only change your own scheduled reports",
    });
    return null;
  }
  return { actor, row };
}

router.get(
  "/report-schedules",
  requirePermission("reports", "view"),
  async (req, res, next) => {
    try {
      const propertyId = property(req, res);
      if (!propertyId) return;
      const rows = await withTenant(propertyId, (tenantDb) =>
        tenantDb
          .select()
          .from(reportSchedulesTable)
          .orderBy(asc(reportSchedulesTable.id)),
      );
      res.json({ success: true, data: rows });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/report-schedules",
  requirePermission("reports", "export"),
  validate({ body: CreateReportScheduleBody }),
  async (req, res, next) => {
    try {
      const propertyId = property(req, res);
      if (!propertyId) return;
      const actor = (req as any).authUser;
      const b = req.body;
      const [row] = await withTenant(propertyId, (tenantDb) =>
        tenantDb
          .insert(reportSchedulesTable)
          .values({
            reportKey: b.reportKey,
            frequency: b.frequency,
            ...dayFields(b),
            hour: b.hour,
            recipients: normRecipients(b.recipients),
            lang: b.lang,
            filters: b.filters ?? {},
            enabled: true,
            createdBy: actor.id,
            createdByName: actor.username,
          })
          .returning(),
      );
      await logActivity({
        req,
        propertyId,
        username: actor.username,
        userId: actor.id,
        userRole: actor.roles?.[0] ?? "user",
        action: `جدولة إرسال تقرير '${b.reportKey}' إلى ${row.recipients}`,
        actionType: "CREATE",
        module: "reports",
        entityType: "report_schedule",
        entityId: row.id,
      });
      res.status(201).json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

router.patch(
  "/report-schedules/:id",
  requirePermission("reports", "export"),
  validate({ params: IdParams, body: UpdateReportScheduleBody }),
  async (req, res, next) => {
    try {
      const propertyId = property(req, res);
      if (!propertyId) return;
      const owned = await loadOwned(req, res, propertyId);
      if (!owned) return;
      const b = req.body;
      const frequency = b.frequency ?? owned.row.frequency;
      const set: Record<string, unknown> = { ...b, updatedAt: new Date() };
      if (b.recipients !== undefined)
        set.recipients = normRecipients(b.recipients);
      if (
        b.frequency !== undefined ||
        b.dayOfWeek !== undefined ||
        b.dayOfMonth !== undefined
      ) {
        Object.assign(
          set,
          dayFields({
            frequency,
            dayOfWeek: b.dayOfWeek ?? owned.row.dayOfWeek,
            dayOfMonth: b.dayOfMonth ?? owned.row.dayOfMonth,
          }),
        );
      }
      // Changing anything but on/off makes the editor the owner.
      const onlyToggle = Object.keys(b).every((k) => k === "enabled");
      if (!onlyToggle && owned.row.createdBy !== owned.actor.id) {
        set.createdBy = owned.actor.id;
        set.createdByName = owned.actor.username;
      }
      const [row] = await withTenant(propertyId, (tenantDb) =>
        tenantDb
          .update(reportSchedulesTable)
          .set(set as any)
          .where(eq(reportSchedulesTable.id, owned.row.id))
          .returning(),
      );
      res.json({ success: true, data: row });
    } catch (err) {
      next(err);
    }
  },
);

router.delete(
  "/report-schedules/:id",
  requirePermission("reports", "export"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const propertyId = property(req, res);
      if (!propertyId) return;
      const owned = await loadOwned(req, res, propertyId);
      if (!owned) return;
      await withTenant(propertyId, (tenantDb) =>
        tenantDb
          .delete(reportSchedulesTable)
          .where(eq(reportSchedulesTable.id, owned.row.id)),
      );
      await logActivity({
        req,
        propertyId,
        username: owned.actor.username,
        userId: owned.actor.id,
        userRole: owned.actor.roles?.[0] ?? "user",
        action: `إلغاء جدولة تقرير '${owned.row.reportKey}'`,
        actionType: "DELETE",
        module: "reports",
        entityType: "report_schedule",
        entityId: owned.row.id,
      });
      res.json({ success: true });
    } catch (err) {
      next(err);
    }
  },
);

router.post(
  "/report-schedules/:id/send-now",
  requirePermission("reports", "export"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const propertyId = property(req, res);
      if (!propertyId) return;
      const owned = await loadOwned(req, res, propertyId);
      if (!owned) return;
      const r = await runSchedule(propertyId, owned.row);
      res
        .status(r.status === "sent" ? 200 : 422)
        .json({ success: r.status === "sent", ...r });
    } catch (err) {
      next(err);
    }
  },
);

export default router;
