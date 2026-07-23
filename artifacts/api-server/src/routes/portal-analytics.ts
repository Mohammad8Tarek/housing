import { Router } from "express";
import {
  withTenant,
  evaluationsTable,
  activitiesTable,
  portalDocumentsTable,
  employeesTable,
} from "@workspace/db";
import { desc, sql, and, gte, isNull, isNotNull } from "drizzle-orm";
import { getCategoryLabel } from "../lib/portal-catalog.js";
import { requireAuth } from "../middlewares/permissions.js";
import { withTableFallback } from "../lib/with-table-fallback.js";
import { getTenantId } from "../lib/request-utils.js";

const router: Router = Router();

// GET / - لوحة تحليلات البورتال
// @ts-ignore
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const stats = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          // إجمالي الاستبيانات والاستجابات
          const templates = await tenantDb
            .select()
            .from(evaluationsTable)
            .where(isNull(evaluationsTable.surveyTemplateId));
          const responses = await tenantDb
            .select()
            .from(evaluationsTable)
            .where(isNotNull(evaluationsTable.surveyTemplateId));
          const totalEvaluations = templates.length;

          const employees = await tenantDb
            .select({
              id: employeesTable.id,
              department: employeesTable.department,
            })
            .from(employeesTable);
          let expectedResponses = 0;
          for (const t of templates) {
            if (t.department) {
              expectedResponses += employees.filter(
                (e) => e.department === t.department,
              ).length;
            } else {
              expectedResponses += employees.length;
            }
          }

          const respondedEvals = responses.filter(
            (e) =>
              e.employeeRating != null ||
              (e.employeeResponse && e.employeeResponse.trim()),
          ).length;
          const ratedEvals = responses.filter((e) => e.employeeRating != null);
          const avgRating =
            ratedEvals.length > 0
              ? (
                  ratedEvals.reduce(
                    (sum: number, e: any) => sum + (e.employeeRating || 0),
                    0,
                  ) / ratedEvals.length
                ).toFixed(2)
              : 0;

          // الفعاليات والمشاركة
          const activities = await tenantDb.select().from(activitiesTable);
          const totalActivities = activities.length;
          const upcomingActivities = activities.filter(
            (a) => new Date(a.startDate) > new Date(),
          ).length;
          const pastActivities = activities.filter(
            (a) => new Date(a.startDate) <= new Date(),
          ).length;

          // المستندات
          const documents = await tenantDb.select().from(portalDocumentsTable);
          const totalDocuments = documents.length;

          // توزيع الاستبيانات حسب التصنيف
          const evaluationsByCategory = templates.reduce((acc: any, e: any) => {
            const cat = getCategoryLabel(e.category || "general", true);
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {});

          // توزيع الفعاليات حسب التصنيف
          const activitiesByCategory = activities.reduce((acc: any, a: any) => {
            const cat = getCategoryLabel(a.category || "social", true);
            acc[cat] = (acc[cat] || 0) + 1;
            return acc;
          }, {});

          return {
            evaluations: {
              total: totalEvaluations,
              responded: respondedEvals,
              responseRate:
                expectedResponses > 0
                  ? ((respondedEvals / expectedResponses) * 100).toFixed(1)
                  : 0,
              avgRating: parseFloat(String(avgRating)),
              byCategory: evaluationsByCategory,
            },
            activities: {
              total: totalActivities,
              upcoming: upcomingActivities,
              past: pastActivities,
              byCategory: activitiesByCategory,
            },
            documents: {
              total: totalDocuments,
            },
            overview: {
              totalEngagement:
                totalEvaluations + totalActivities + totalDocuments,
              activeContent: upcomingActivities + totalDocuments,
            },
          };
        }),
      {
        evaluations: {
          total: 0,
          responded: 0,
          responseRate: 0,
          avgRating: 0,
          byCategory: {},
        },
        activities: { total: 0, upcoming: 0, past: 0, byCategory: {} },
        documents: { total: 0 },
        overview: { totalEngagement: 0, activeContent: 0 },
      },
    );

    res.json(stats);
  } catch (err) {
    next(err);
  }
});

// GET /trends - اتجاهات البوابة
// @ts-ignore
router.get("/trends", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const days = parseInt(req.query.days as string) || 30;
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const trends = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          const fromDate = new Date();
          fromDate.setDate(fromDate.getDate() - days);

          const recentEvaluations = await tenantDb
            .select()
            .from(evaluationsTable)
            .where(gte(evaluationsTable.submittedAt, fromDate));

          const recentActivities = await tenantDb
            .select()
            .from(activitiesTable)
            .where(gte(activitiesTable.createdAt, fromDate));

          const groupByDate = (items: any[], dateField: string) => {
            const grouped: any = {};
            items.forEach((item) => {
              const date = new Date(item[dateField])
                .toISOString()
                .split("T")[0];
              grouped[date] = (grouped[date] || 0) + 1;
            });
            return Object.entries(grouped)
              .map(([date, count]) => ({ date, count }))
              .sort((a: any, b: any) => a.date.localeCompare(b.date));
          };

          return {
            evaluations: groupByDate(recentEvaluations, "submittedAt"),
            activities: groupByDate(recentActivities, "createdAt"),
          };
        }),
      { evaluations: [], activities: [] },
    );

    res.json(trends);
  } catch (err) {
    next(err);
  }
});

// GET /content-performance - أداء المحتوى
// @ts-ignore
router.get("/content-performance", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const performance = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          const evaluations = await tenantDb.select().from(evaluationsTable);
          const activities = await tenantDb.select().from(activitiesTable);

          const topEvaluations = evaluations
            .filter((e) => e.employeeRating)
            .sort((a: any, b: any) => b.employeeRating - a.employeeRating)
            .slice(0, 5)
            .map((e) => ({
              id: e.id,
              title: e.titleAr || e.titleEn,
              rating: e.employeeRating,
              category: e.category,
            }));

          const recentActivities = activities
            .sort(
              (a: any, b: any) =>
                new Date(b.startDate).getTime() -
                new Date(a.startDate).getTime(),
            )
            .slice(0, 5)
            .map((a) => ({
              id: a.id,
              title: a.titleAr || a.titleEn,
              date: a.startDate,
              category: a.category,
            }));

          return {
            topRatedEvaluations: topEvaluations,
            recentActivities,
          };
        }),
      { topRatedEvaluations: [], recentActivities: [] },
    );

    res.json(performance);
  } catch (err) {
    next(err);
  }
});

export default router;
