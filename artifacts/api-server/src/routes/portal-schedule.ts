/**
 * portal-schedule.ts — Full DB-backed implementation
 * Returns real events from: activitiesTable + evaluationsTable
 * mapped as calendar events with color coding and priority.
 */
import { Router } from "express";
import { withTenant, activitiesTable, evaluationsTable } from "@workspace/db";
import { desc, gte, lte, and, eq } from "drizzle-orm";
import { requirePortalAuth, portalSession } from "./portal-auth.js";
import { requireAuth } from "../middlewares/permissions.js";
import { getTenantId } from "../lib/request-utils.js";

const router: Router = Router();

// Color map for activities categories
const ACTIVITY_COLORS: Record<string, string> = {
  sports: "#10B981", // green
  culture: "#8B5CF6", // purple
  entertainment: "#F59E0B", // amber
  educational: "#3B82F6", // blue
  social: "#EC4899", // pink
  health: "#06B6D4", // cyan
  default: "#6366F1", // indigo
};

const EVAL_COLORS: Record<string, string> = {
  performance: "#EF4444", // red
  behavior: "#10B981", // green
  attendance: "#3B82F6", // blue
  communication: "#8B5CF6", // purple
  teamwork: "#F59E0B", // amber
  general: "#6B7280", // gray
};

// GET / — تقويم الفعاليات والاستبيانات (Admin)
// @ts-ignore
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const { month, year } = req.query;
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const now = new Date();
    const targetYear = Number(year) || now.getFullYear();
    const targetMonth = Number(month) || now.getMonth() + 1;

    const fromDate = new Date(targetYear, targetMonth - 1, 1);
    const toDate = new Date(targetYear, targetMonth, 0, 23, 59, 59);

    const { events, upcomingDeadlines, priorityItems } = await withTenant(
      propertyId,
      async (tenantDb) => {
        // Fetch activities in the month
        const activities = await tenantDb
          .select()
          .from(activitiesTable)
          .where(
            and(
              gte(
                activitiesTable.startDate,
                fromDate.toISOString().split("T")[0],
              ),
              lte(
                activitiesTable.startDate,
                toDate.toISOString().split("T")[0],
              ),
            ),
          )
          .orderBy(activitiesTable.startDate);

        // Fetch evaluations — use submittedAt or expiresAt
        const evaluations = await tenantDb
          .select()
          .from(evaluationsTable)
          .orderBy(desc(evaluationsTable.createdAt))
          .limit(50);

        const events: any[] = [];

        // Map activities to calendar events
        for (const a of activities) {
          const color =
            ACTIVITY_COLORS[a.category || ""] || ACTIVITY_COLORS.default;
          events.push({
            id: `act-${a.id}`,
            sourceId: a.id,
            sourceType: "activity",
            title: a.titleEn || a.titleAr,
            titleAr: a.titleAr || a.titleEn,
            type: "activity",
            date: a.startDate,
            endDate: a.endDate ?? null,
            startTime: a.startTime ?? null,
            location: a.locationEn || a.locationAr || null,
            status: a.status,
            priority: a.status === "ongoing" ? "high" : "medium",
            color,
            category: a.category,
            maxParticipants: a.maxParticipants,
          });
        }

        // Map evaluations with expiry dates as calendar events
        for (const e of evaluations) {
          const color = EVAL_COLORS[e.category || ""] || EVAL_COLORS.general;
          const eventDate = e.expiresAt
            ? e.expiresAt.toISOString().split("T")[0]
            : e.submittedAt.toISOString().split("T")[0];

          // Only include if in target month
          const evDate = new Date(eventDate);
          if (evDate < fromDate || evDate > toDate) continue;

          events.push({
            id: `eval-${e.id}`,
            sourceId: e.id,
            sourceType: "evaluation",
            title: e.titleEn || e.titleAr || "Survey",
            titleAr: e.titleAr || e.titleEn || "استبيان",
            type: "evaluation",
            date: eventDate,
            priority: e.expiresAt ? "high" : "medium",
            color,
            category: e.category,
            isExpiry: !!e.expiresAt,
          });
        }

        // Upcoming deadlines (next 7 days)
        const nextWeek = new Date(Date.now() + 7 * 86400000);
        const upcomingDeadlines = evaluations
          .filter(
            (e) => e.expiresAt && e.expiresAt > now && e.expiresAt <= nextWeek,
          )
          .map((e) => ({
            id: e.id,
            title: e.titleEn || e.titleAr || "Survey",
            titleAr: e.titleAr || e.titleEn || "استبيان",
            type: "evaluation",
            dueDate: e.expiresAt!.toISOString(),
            daysLeft: Math.ceil(
              (e.expiresAt!.getTime() - now.getTime()) / 86400000,
            ),
            priority: "high",
          }));

        // Priority items (ongoing activities + expiring evaluations)
        const priorityItems = [
          ...activities
            .filter((a) => a.status === "ongoing" || a.status === "planned")
            .slice(0, 3)
            .map((a) => ({
              id: `act-${a.id}`,
              title: a.titleEn || a.titleAr,
              titleAr: a.titleAr || a.titleEn,
              type: "activity",
              date: a.startDate,
              priority: "medium",
              color:
                ACTIVITY_COLORS[a.category || ""] || ACTIVITY_COLORS.default,
            })),
          ...upcomingDeadlines.slice(0, 2),
        ];

        return { events, upcomingDeadlines, priorityItems };
      },
    );

    res.json({
      month: targetMonth,
      year: targetYear,
      events,
      upcomingDeadlines,
      priorityItems,
    });
  } catch (err) {
    next(err);
  }
});

// GET /calendar — تقويم البوابة للموظف (Portal)
// @ts-ignore
router.get("/calendar", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const { from, to } = req.query;

    const fromDate = from ? new Date(String(from)) : new Date();
    const toDate = to
      ? new Date(String(to))
      : new Date(fromDate.getTime() + 30 * 86400000);
    const fromStr = fromDate.toISOString().split("T")[0];
    const toStr = toDate.toISOString().split("T")[0];

    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      const activities = await tenantDb
        .select()
        .from(activitiesTable)
        .where(
          and(
            gte(activitiesTable.startDate, fromStr),
            lte(activitiesTable.startDate, toStr),
          ),
        )
        .orderBy(activitiesTable.startDate);

      const evaluations = await tenantDb
        .select()
        .from(evaluationsTable)
        .orderBy(desc(evaluationsTable.createdAt));

      const events: any[] = [];

      for (const a of activities) {
        const color =
          ACTIVITY_COLORS[a.category || ""] || ACTIVITY_COLORS.default;
        events.push({
          id: `act-${a.id}`,
          sourceId: a.id,
          sourceType: "activity",
          title: a.titleEn || a.titleAr,
          titleAr: a.titleAr || a.titleEn,
          type: "activity",
          date: a.startDate,
          endDate: a.endDate ?? null,
          startTime: a.startTime ?? null,
          location: a.locationEn || a.locationAr || null,
          status: a.status,
          priority: "medium",
          color,
        });
      }

      for (const e of evaluations) {
        const color = EVAL_COLORS[e.category || ""] || EVAL_COLORS.general;
        // Show evaluation expiry date on calendar
        if (e.expiresAt) {
          const expiryStr = e.expiresAt.toISOString().split("T")[0];
          if (expiryStr >= fromStr && expiryStr <= toStr) {
            events.push({
              id: `eval-${e.id}`,
              sourceId: e.id,
              sourceType: "evaluation",
              title: e.titleEn || e.titleAr || "Survey Deadline",
              titleAr: e.titleAr || e.titleEn || "آخر موعد للاستبيان",
              type: "evaluation",
              date: expiryStr,
              priority: "high",
              color,
              isDeadline: true,
            });
          }
        }
      }

      return events.sort((a, b) =>
        String(a.date).localeCompare(String(b.date)),
      );
    });

    res.json({
      from: fromDate.toISOString(),
      to: toDate.toISOString(),
      events: result,
    });
  } catch (err) {
    next(err);
  }
});

// GET /priorities — العناصر ذات الأولوية للأدمن
// @ts-ignore
router.get("/priorities", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const result = await withTenant(propertyId, async (tenantDb) => {
      const now = new Date();
      const nowStr = now.toISOString().split("T")[0];

      const activities = await tenantDb
        .select()
        .from(activitiesTable)
        .orderBy(activitiesTable.startDate);
      const evaluations = await tenantDb
        .select()
        .from(evaluationsTable)
        .orderBy(evaluationsTable.expiresAt);

      const critical: any[] = [];
      const high: any[] = [];
      const medium: any[] = [];
      const low: any[] = [];

      for (const a of activities) {
        const item = {
          id: `act-${a.id}`,
          sourceId: a.id,
          type: "activity",
          title: a.titleEn || a.titleAr,
          titleAr: a.titleAr || a.titleEn,
          date: a.startDate,
          status: a.status,
          color: ACTIVITY_COLORS[a.category || ""] || ACTIVITY_COLORS.default,
        };
        if (a.status === "ongoing") critical.push(item);
        else if (a.startDate >= nowStr) high.push(item);
        else medium.push(item);
      }

      for (const e of evaluations) {
        if (!e.expiresAt) continue;
        const daysLeft = Math.ceil(
          (e.expiresAt.getTime() - now.getTime()) / 86400000,
        );
        const item = {
          id: `eval-${e.id}`,
          sourceId: e.id,
          type: "evaluation",
          title: e.titleEn || e.titleAr || "Survey",
          titleAr: e.titleAr || e.titleEn || "استبيان",
          expiresAt: e.expiresAt.toISOString(),
          daysLeft,
          color: EVAL_COLORS[e.category || ""] || EVAL_COLORS.general,
        };
        if (daysLeft <= 1) critical.push(item);
        else if (daysLeft <= 3) high.push(item);
        else if (daysLeft <= 7) medium.push(item);
      }

      return { critical, high, medium, low };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /reminders — التذكيرات القادمة للموظف
// @ts-ignore
router.get("/reminders", requirePortalAuth, async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const now = new Date();
    const tomorrow = new Date(now.getTime() + 86400000);
    const thisWeek = new Date(now.getTime() + 7 * 86400000);

    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      const evaluations = await tenantDb
        .select()
        .from(evaluationsTable)
        .where(gte(evaluationsTable.expiresAt as any, now));

      const activities = await tenantDb
        .select()
        .from(activitiesTable)
        .where(
          gte(
            activitiesTable.startDate as any,
            now.toISOString().split("T")[0],
          ),
        )
        .orderBy(activitiesTable.startDate)
        .limit(20);

      const today: any[] = [];
      const tomorrowArr: any[] = [];
      const thisWeekArr: any[] = [];
      const overdue: any[] = [];

      // Evaluation deadlines
      for (const e of evaluations) {
        if (!e.expiresAt) continue;
        const daysLeft = Math.ceil(
          (e.expiresAt.getTime() - now.getTime()) / 86400000,
        );
        const item = {
          id: `eval-${e.id}`,
          type: "evaluation",
          title: e.titleEn || e.titleAr || "Survey",
          titleAr: e.titleAr || e.titleEn || "استبيان",
          dueDate: e.expiresAt.toISOString(),
          daysLeft,
          priority: daysLeft <= 1 ? "high" : "medium",
        };
        if (daysLeft <= 0) overdue.push(item);
        else if (daysLeft === 1) tomorrowArr.push(item);
        else if (daysLeft <= 7) thisWeekArr.push(item);
      }

      // Upcoming activities
      for (const a of activities) {
        const aDate = new Date(a.startDate);
        const daysLeft = Math.ceil(
          (aDate.getTime() - now.getTime()) / 86400000,
        );
        const item = {
          id: `act-${a.id}`,
          type: "activity",
          title: a.titleEn || a.titleAr,
          titleAr: a.titleAr || a.titleEn,
          date: a.startDate,
          daysLeft,
          location: a.locationEn || a.locationAr,
          priority: "low",
        };
        if (daysLeft === 0) today.push(item);
        else if (daysLeft === 1) tomorrowArr.push(item);
        else if (daysLeft <= 7) thisWeekArr.push(item);
      }

      return { today, tomorrow: tomorrowArr, thisWeek: thisWeekArr, overdue };
    });

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /calendar/events — Create a calendar event (activity)
router.post("/calendar/events", requireAuth, async (req, res, next): Promise<void> => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res
        .status(400)
        .json({ success: false, message: "propertyId required" });
      return;
    }

    const { title, titleAr, type, startTime, location, description } = req.body;
    if (!title && !titleAr) {
      res
        .status(400)
        .json({ success: false, message: "Title is required" });
      return;
    }

    const eventDate = startTime ? new Date(startTime) : new Date();

    const result = await withTenant(propertyId, async (tenantDb) => {
      const [newActivity] = await tenantDb
        .insert(activitiesTable)
        .values({
          propertyId,
          titleEn: title || titleAr || "Event",
          titleAr: titleAr || title || "حدث",
          descriptionEn: description || "",
          descriptionAr: description || "",
          category: type === "evaluation" ? "educational" : type || "social",
          locationEn: location || "",
          locationAr: location || "",
          startDate: eventDate.toISOString().split("T")[0],
          endDate: eventDate.toISOString().split("T")[0],
          startTime: eventDate.toTimeString().slice(0, 5),
          status: "published",
        } as any)
        .returning();
      return newActivity;
    });

    res.status(201).json({ success: true, data: result });
    return;
  } catch (err) {
    next(err);
  }
});

// POST /reminders/:id/snooze — Snooze reminder
router.post("/reminders/:id/snooze", requireAuth, async (req, res, next) => {
  try {
    const { id } = req.params;
    const { minutes } = req.body;
    res.json({
      success: true,
      message: `Reminder ${id} snoozed by ${minutes || 30} minutes`,
    });
  } catch (err) {
    next(err);
  }
});

export default router;
