import { Router } from "express";
import {
  withTenant,
  activitiesTable,
  evaluationsTable,
  profilesTable,
  surveyItemsTable,
  surveyItemResponsesTable,
  activityRegistrationsTable,
} from "@workspace/db";
import { eq, inArray, isNull } from "drizzle-orm";
import { z } from "zod";
import { requireAuth } from "../middlewares/permissions.js";
import { logActivity } from "../lib/activity-logger.js";
import { withTableFallback } from "../lib/with-table-fallback.js";
import { getTenantId, su } from "../lib/request-utils.js";

const router: Router = Router();

const ReportSchema = z.object({
  type: z.enum(["evaluations", "activities", "engagement", "custom"]),
  format: z.enum(["json", "pdf", "excel"]).default("json"),
  dateRange: z
    .object({
      from: z.string().datetime().optional(),
      to: z.string().datetime().optional(),
    })
    .optional(),
  filters: z.record(z.any()).optional(),
  includeCharts: z.boolean().default(true),
});

// ═══════════════════════════════════════════════════════════════
// GET / - Report cards with live stats
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.get("/", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const result = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          const evaluations = await tenantDb.select().from(evaluationsTable);
          const activities = await tenantDb.select().from(activitiesTable);
          const profiles = await tenantDb.select().from(profilesTable);
          const registrations = await tenantDb
            .select()
            .from(activityRegistrationsTable);

          const templateEvals = evaluations.filter((e) => !e.surveyTemplateId);
          const responses = evaluations.filter((e) => e.surveyTemplateId);
          const avgRating =
            responses.filter((e) => e.profileRating).length > 0
              ? (
                  responses.reduce(
                    (sum, e) => sum + (e.profileRating || 0),
                    0,
                  ) / responses.filter((e) => e.profileRating).length
                ).toFixed(1)
              : "0.0";
          const totalRegistered = registrations.length;
          const totalAttended = registrations.filter((r) => r.attended).length;

          return [
            {
              id: 1,
              name: "Evaluations Summary",
              nameAr: "ملخص الاستبيانات",
              type: "evaluations",
              lastGenerated: new Date().toISOString(),
              generatedBy: "System",
              stats: {
                templates: templateEvals.length,
                responses: responses.length,
                avgRating,
              },
            },
            {
              id: 2,
              name: "Activities Engagement",
              nameAr: "مشاركة الفعاليات",
              type: "activities",
              lastGenerated: new Date().toISOString(),
              generatedBy: "System",
              stats: {
                total: activities.length,
                upcoming: activities.filter(
                  (a) => new Date(a.startDate) > new Date(),
                ).length,
                registered: totalRegistered,
                attended: totalAttended,
              },
            },
            {
              id: 3,
              name: "Portal Engagement Report",
              nameAr: "تقرير المشاركة",
              type: "engagement",
              lastGenerated: new Date().toISOString(),
              generatedBy: "System",
              stats: {
                evaluations: responses.length,
                activities: activities.length,
                profiles: profiles.length,
                registrations: totalRegistered,
              },
            },
          ];
        }),
      [],
    );

    res.json(result);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// POST /generate - Generate report by type
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.post("/generate", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    const userId = (req.session as any)?.userId;
    if (!propertyId || !userId)
      return res
        .status(400)
        .json({ success: false, message: "Missing required fields" });

    const validated = ReportSchema.parse(req.body);
    const { type, format, dateRange, filters, includeCharts } = validated;

    const report = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          const fromDate = dateRange?.from
            ? new Date(dateRange.from)
            : new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
          const toDate = dateRange?.to ? new Date(dateRange.to) : new Date();
          const departmentFilter = filters?.department as string | undefined;

          if (type === "evaluations") {
            return await buildEvaluationsReport(
              tenantDb,
              fromDate,
              toDate,
              departmentFilter,
              includeCharts,
            );
          } else if (type === "activities") {
            return await buildActivitiesReport(
              tenantDb,
              fromDate,
              toDate,
              departmentFilter,
              includeCharts,
            );
          } else if (type === "engagement") {
            return await buildEngagementReport(
              tenantDb,
              fromDate,
              toDate,
              departmentFilter,
              includeCharts,
            );
          } else if (type === "custom") {
            const modules = (filters?.modules as string[]) || [
              "evaluations",
              "activities",
            ];
            return await buildCustomReport(
              tenantDb,
              fromDate,
              toDate,
              departmentFilter,
              modules,
              includeCharts,
            );
          }
          return {};
        }),
      {},
    );

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `Generated ${type} report`,
      actionType: "CREATE",
      module: "reports",
    });

    const fullReport = {
      id: Date.now(),
      ...report,
      format,
      generatedAt: new Date().toISOString(),
      generatedBy: userId,
      propertyId,
    };

    if (format === "excel") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="report-${Date.now()}.csv"`,
      );
      return res.send(generateCSV(fullReport));
    }
    res.json(fullReport);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// ENHANCED EVALUATION REPORT
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.get("/evaluations-report", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to as string) : new Date();
    const department = req.query.department as string | undefined;

    const report = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          return await buildEvaluationsReport(
            tenantDb,
            fromDate,
            toDate,
            department,
            true,
          );
        }),
      null,
    );

    if (!report) {
      res.json({
        summary: { totalTemplates: 0, totalResponses: 0 },
        templates: [],
      });
      return;
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// ENHANCED ACTIVITY REGISTRATION REPORT
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.get("/activities-report", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to as string) : new Date();
    const department = req.query.department as string | undefined;

    const report = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          return await buildActivitiesReport(
            tenantDb,
            fromDate,
            toDate,
            department,
            true,
          );
        }),
      null,
    );

    if (!report) {
      res.json({ summary: { totalActivities: 0 }, activities: [] });
      return;
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// ENGAGEMENT REPORT
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.get("/engagement-report", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to as string) : new Date();
    const department = req.query.department as string | undefined;

    const report = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          return await buildEngagementReport(
            tenantDb,
            fromDate,
            toDate,
            department,
            true,
          );
        }),
      null,
    );

    if (!report) {
      res.json({
        summary: { totalProfiles: 0, engagedProfiles: 0 },
        mostActive: [],
        departmentEngagement: [],
        nonEngaged: [],
        trend: [],
      });
      return;
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// CUSTOM REPORT
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.get("/custom-report", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const fromDate = req.query.from
      ? new Date(req.query.from as string)
      : new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
    const toDate = req.query.to ? new Date(req.query.to as string) : new Date();
    const department = req.query.department as string | undefined;
    const modules = (
      (req.query.modules as string) || "evaluations,activities"
    ).split(",");

    const report = await withTableFallback(
      async () =>
        withTenant(propertyId, async (tenantDb) => {
          return await buildCustomReport(
            tenantDb,
            fromDate,
            toDate,
            department,
            modules,
            true,
          );
        }),
      null,
    );

    if (!report) {
      res.json({ summary: { modulesGenerated: 0 }, sections: [] });
      return;
    }
    res.json(report);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// REPORT TEMPLATES
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.get("/templates/list", requireAuth, async (req, res, next) => {
  try {
    const templates = [
      {
        id: "monthly_summary",
        name: "Monthly Summary",
        nameAr: "الملخص الشهري",
        description: "Complete monthly summary",
        descriptionAr: "ملخص شامل للشهر",
        type: "evaluations",
        icon: "📊",
      },
      {
        id: "performance_report",
        name: "Performance Report",
        nameAr: "تقرير الأداء",
        description: "Performance evaluation",
        descriptionAr: "تقييم الأداء",
        type: "evaluations",
        icon: "📈",
      },
      {
        id: "engagement_analysis",
        name: "Engagement Analysis",
        nameAr: "تحليل المشاركة",
        description: "Profile engagement analysis",
        descriptionAr: "تحليل مشاركة الموظفين",
        type: "engagement",
        icon: "👥",
      },
      {
        id: "priority_report",
        name: "Priority Report",
        nameAr: "تقرير الأولويات",
        description: "Priority items and tasks",
        descriptionAr: "العناصر والمهام ذات الأولوية",
        type: "activities",
        icon: "⚡",
      },
    ];
    res.json(templates);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// DEPARTMENTS LIST (for filter dropdown)
// ═══════════════════════════════════════════════════════════════
// @ts-ignore
router.get("/departments", requireAuth, async (req, res, next) => {
  try {
    const propertyId = getTenantId(req);
    if (!propertyId)
      return res
        .status(400)
        .json({ success: false, message: "propertyId required" });

    const departments = await withTenant(propertyId, async (tenantDb) => {
      const profiles = await tenantDb
        .select({ department: profilesTable.department })
        .from(profilesTable);
      return [
        ...new Set(profiles.map((e) => e.department).filter(Boolean)),
      ].sort();
    });

    res.json(departments);
  } catch (err) {
    next(err);
  }
});

// ═══════════════════════════════════════════════════════════════
// BUILD FUNCTIONS
// ═══════════════════════════════════════════════════════════════

async function buildEvaluationsReport(
  tenantDb: any,
  fromDate: Date,
  toDate: Date,
  departmentFilter?: string,
  includeCharts = true,
) {
  const templates = await tenantDb
    .select()
    .from(evaluationsTable)
    .where(isNull(evaluationsTable.surveyTemplateId));
  const templateIds = templates.map((t: any) => t.id);

  const allItems =
    templateIds.length > 0
      ? await tenantDb
          .select()
          .from(surveyItemsTable)
          .where(inArray(surveyItemsTable.templateId, templateIds))
      : [];

  const allResponses =
    templateIds.length > 0
      ? await tenantDb
          .select()
          .from(surveyItemResponsesTable)
          .where(inArray(surveyItemResponsesTable.templateId, templateIds))
      : [];

  const allProfiles = await tenantDb.select().from(profilesTable);
  const totalProfiles = allProfiles.length;
  const departmentCounts: Record<string, number> = {};
  allProfiles.forEach((e: any) => {
    const dept = e.department || "General";
    departmentCounts[dept] = (departmentCounts[dept] || 0) + 1;
  });

  const profileIds = [
    ...new Set(allResponses.map((r: any) => r.profileId as number)),
  ] as number[];
  const profiles =
    profileIds.length > 0
      ? await tenantDb
          .select()
          .from(profilesTable)
          .where(inArray(profilesTable.id, profileIds))
      : [];
  const empMap = Object.fromEntries(profiles.map((e: any) => [e.id, e]));

  // Per-template report
  const templateReport = templates.map((template: any) => {
    const items = allItems.filter((i: any) => i.templateId === template.id);
    const responses = allResponses.filter(
      (r: any) => r.templateId === template.id,
    );
    const uniqueProfiles = [
      ...new Set(responses.map((r: any) => r.profileId)),
    ];

    const itemBreakdown = items.map((item: any) => {
      const itemResponses = responses.filter((r: any) => r.itemId === item.id);
      const ratingResponses = itemResponses.filter(
        (r: any) => r.ratingValue != null,
      );
      const avgRating =
        ratingResponses.length > 0
          ? ratingResponses.reduce(
              (sum: number, r: any) => sum + (r.ratingValue || 0),
              0,
            ) / ratingResponses.length
          : 0;
      const distribution = [0, 0, 0, 0, 0];
      ratingResponses.forEach((r: any) => {
        const rounded = Math.round(r.ratingValue || 0);
        if (rounded >= 1 && rounded <= 5) distribution[rounded - 1]++;
      });

      return {
        itemId: item.id,
        titleAr: item.titleAr,
        titleEn: item.titleEn,
        type: item.type,
        required: item.required,
        responseCount: itemResponses.length,
        responseRate:
          totalProfiles > 0
            ? Math.round((itemResponses.length / totalProfiles) * 100)
            : 0,
        avgRating: Math.round(avgRating * 10) / 10,
        distribution,
        textResponses:
          item.type === "text"
            ? itemResponses
                .filter((r: any) => r.textValue)
                .map((r: any) => r.textValue)
            : undefined,
        yesNoCounts:
          item.type === "yes_no"
            ? {
                yes: itemResponses.filter(
                  (r: any) => r.textValue === "yes" || r.textValue === "true",
                ).length,
                no: itemResponses.filter(
                  (r: any) => r.textValue === "no" || r.textValue === "false",
                ).length,
              }
            : undefined,
      };
    });

    // Department breakdown
    const deptMap: Record<
      string,
      { count: number; avgRating: number; profiles: number }
    > = {};
    for (const resp of responses) {
      const emp = empMap[resp.profileId];
      const dept = emp?.department || "General";
      if (!deptMap[dept])
        deptMap[dept] = {
          count: 0,
          avgRating: 0,
          profiles: departmentCounts[dept] || 0,
        };
      deptMap[dept].count++;
      if (resp.ratingValue) deptMap[dept].avgRating += resp.ratingValue;
    }
    const departmentBreakdown = Object.entries(deptMap).map(([dept, data]) => ({
      department: dept,
      responseCount: data.count,
      profiles: data.profiles,
      responseRate:
        data.profiles > 0
          ? Math.round((data.count / data.profiles) * 100)
          : 0,
      avgRating:
        data.count > 0
          ? Math.round((data.avgRating / data.count) * 10) / 10
          : 0,
    }));

    const allRatings = responses.filter((r: any) => r.ratingValue != null);
    const overallAvg =
      allRatings.length > 0
        ? allRatings.reduce(
            (sum: number, r: any) => sum + (r.ratingValue || 0),
            0,
          ) / allRatings.length
        : 0;

    // Star distribution for this template
    const starDist = [0, 0, 0, 0, 0];
    allRatings.forEach((r: any) => {
      const rounded = Math.round(r.ratingValue || 0);
      if (rounded >= 1 && rounded <= 5) starDist[rounded - 1]++;
    });

    // Written text responses
    const textResponses = itemBreakdown
      .filter((i: any) => i.textResponses && i.textResponses.length > 0)
      .flatMap((i: any) =>
        i.textResponses!.map((t: string) => ({
          question: i.titleEn || i.titleAr,
          text: t,
        })),
      );

    return {
      templateId: template.id,
      titleAr: template.titleAr,
      titleEn: template.titleEn,
      category: template.category,
      department: template.department,
      descriptionAr: template.descriptionAr,
      descriptionEn: template.descriptionEn,
      expiresAt: template.expiresAt,
      createdAt: template.createdAt,
      totalResponses: uniqueProfiles.length,
      responseRate:
        totalProfiles > 0
          ? Math.round((uniqueProfiles.length / totalProfiles) * 100)
          : 0,
      overallAvgRating: Math.round(overallAvg * 10) / 10,
      starDistribution: starDist,
      items: itemBreakdown,
      departmentBreakdown,
      textResponses,
    };
  });

  // Global stats
  const totalResponses = allResponses.length;
  const uniqueRespondents = new Set(allResponses.map((r: any) => r.profileId))
    .size;
  const allRatingValues = allResponses
    .filter((r: any) => r.ratingValue != null)
    .map((r: any) => r.ratingValue || 0);
  const globalAvg =
    allRatingValues.length > 0
      ? allRatingValues.reduce((a: number, b: number) => a + b, 0) /
        allRatingValues.length
      : 0;

  // Global star distribution
  const globalStarDist = [0, 0, 0, 0, 0];
  allRatingValues.forEach((v: number) => {
    const rounded = Math.round(v);
    if (rounded >= 1 && rounded <= 5) globalStarDist[rounded - 1]++;
  });

  // Category breakdown
  const catMap: Record<
    string,
    { templates: number; responses: number; avgRating: number }
  > = {};
  for (const tr of templateReport) {
    const cat = tr.category || "General";
    if (!catMap[cat])
      catMap[cat] = { templates: 0, responses: 0, avgRating: 0 };
    catMap[cat].templates++;
    catMap[cat].responses += tr.totalResponses;
    catMap[cat].avgRating += tr.overallAvgRating;
  }
  const categoryBreakdown = Object.entries(catMap).map(([category, data]) => ({
    category,
    templates: data.templates,
    responses: data.responses,
    avgRating:
      data.templates > 0
        ? Math.round((data.avgRating / data.templates) * 10) / 10
        : 0,
  }));

  // Trend (responses per month)
  const trendMap: Record<string, number> = {};
  allResponses.forEach((r: any) => {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap[key] = (trendMap[key] || 0) + 1;
  });
  const trend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  // Top performing items (highest avg rating)
  const allItemStats = templateReport.flatMap((t: any) => t.items);
  const topItems = allItemStats
    .filter((i: any) => i.type === "rating" && i.responseCount > 0)
    .sort((a: any, b: any) => b.avgRating - a.avgRating)
    .slice(0, 5);

  // Lowest performing items
  const lowestItems = allItemStats
    .filter((i: any) => i.type === "rating" && i.responseCount > 0)
    .sort((a: any, b: any) => a.avgRating - b.avgRating)
    .slice(0, 5);

  // Department ranking
  const deptRanking = Object.entries(departmentCounts)
    .map(([dept, empCount]) => {
      const deptResponses = allResponses.filter((r: any) => {
        const emp = empMap[r.profileId];
        return (emp?.department || "General") === dept;
      });
      const deptRatings = deptResponses.filter(
        (r: any) => r.ratingValue != null,
      );
      const avg =
        deptRatings.length > 0
          ? deptRatings.reduce(
              (sum: number, r: any) => sum + (r.ratingValue || 0),
              0,
            ) / deptRatings.length
          : 0;
      return {
        department: dept,
        totalProfiles: empCount,
        responses: deptResponses.length,
        responseRate:
          empCount > 0
            ? Math.round((deptResponses.length / empCount) * 100)
            : 0,
        avgRating: Math.round(avg * 10) / 10,
      };
    })
    .sort((a, b) => b.avgRating - a.avgRating);

  return {
    title: "Evaluations & Surveys Report",
    titleAr: "تقرير الاستبيانات والتقييمات",
    type: "evaluations",
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    summary: {
      totalTemplates: templates.length,
      totalResponses,
      uniqueRespondents,
      responseRate:
        totalProfiles > 0
          ? Math.round((uniqueRespondents / totalProfiles) * 100)
          : 0,
      globalAvgRating: Math.round(globalAvg * 10) / 10,
      totalProfiles,
    },
    starDistribution: globalStarDist,
    categoryBreakdown,
    departmentRanking: deptRanking,
    trend,
    topItems,
    lowestItems,
    templates: templateReport,
    charts: includeCharts
      ? {
          ratingDistribution: globalStarDist,
          categoryBreakdown: Object.fromEntries(
            categoryBreakdown.map((c) => [c.category, c.responses]),
          ),
          monthlyTrend: Object.fromEntries(
            trend.map((t) => [t.month, t.count]),
          ),
        }
      : undefined,
  };
}

async function buildActivitiesReport(
  tenantDb: any,
  fromDate: Date,
  toDate: Date,
  departmentFilter?: string,
  includeCharts = true,
) {
  const activities = await tenantDb.select().from(activitiesTable);
  const filtered = activities.filter((a: any) => {
    const date = new Date(a.startDate);
    return date >= fromDate && date <= toDate;
  });

  const allActivityIds = activities.map((a: any) => a.id);
  const registrations =
    allActivityIds.length > 0
      ? await tenantDb
          .select()
          .from(activityRegistrationsTable)
          .where(inArray(activityRegistrationsTable.activityId, allActivityIds))
      : [];

  const regProfileIds = [
    ...new Set(registrations.map((r: any) => r.profileId)),
  ] as number[];
  const profiles =
    regProfileIds.length > 0
      ? await tenantDb
          .select()
          .from(profilesTable)
          .where(inArray(profilesTable.id, regProfileIds))
      : [];
  const empMap = Object.fromEntries(profiles.map((e: any) => [e.id, e]));

  const allProfiles = await tenantDb.select().from(profilesTable);
  const totalProfiles = allProfiles.length;

  const activityReport = filtered.map((activity: any) => {
    const actRegistrations = registrations.filter(
      (r: any) => r.activityId === activity.id,
    );
    const joined = actRegistrations.filter((r: any) => r.status === "joined");
    const interested = actRegistrations.filter(
      (r: any) => r.status === "interested",
    );
    const attended = actRegistrations.filter((r: any) => r.attended);

    const deptMap: Record<
      string,
      { registered: number; attended: number; profiles: number }
    > = {};
    for (const reg of actRegistrations) {
      const emp = empMap[reg.profileId];
      const dept = emp?.department || "General";
      if (!deptMap[dept])
        deptMap[dept] = { registered: 0, attended: 0, profiles: 0 };
      deptMap[dept].registered++;
      if (reg.attended) deptMap[dept].attended++;
    }

    return {
      activityId: activity.id,
      titleAr: activity.titleAr,
      titleEn: activity.titleEn,
      category: activity.category,
      startDate: activity.startDate,
      endDate: activity.endDate,
      status: activity.status,
      maxParticipants: activity.maxParticipants,
      totalRegistered: actRegistrations.length,
      joinedCount: joined.length,
      interestedCount: interested.length,
      attendedCount: attended.length,
      attendanceRate:
        joined.length > 0
          ? Math.round((attended.length / joined.length) * 100)
          : 0,
      fillRate: activity.maxParticipants
        ? Math.round((joined.length / activity.maxParticipants) * 100)
        : 0,
      departmentBreakdown: Object.entries(deptMap).map(([dept, data]) => ({
        department: dept,
        ...data,
      })),
    };
  });

  // Sort by most registered
  const topActivities = [...activityReport]
    .sort((a, b) => b.totalRegistered - a.totalRegistered)
    .slice(0, 5);

  // Activities with zero registrations
  const emptyActivities = activityReport.filter(
    (a: any) => a.totalRegistered === 0,
  );

  // Category breakdown
  const catMap: Record<
    string,
    { activities: number; registrations: number; attended: number }
  > = {};
  for (const ar of activityReport) {
    const cat = ar.category || "General";
    if (!catMap[cat])
      catMap[cat] = { activities: 0, registrations: 0, attended: 0 };
    catMap[cat].activities++;
    catMap[cat].registrations += ar.totalRegistered;
    catMap[cat].attended += ar.attendedCount;
  }

  // Global department summary
  const globalDeptMap: Record<
    string,
    { registered: number; attended: number; profiles: number }
  > = {};
  for (const ar of activityReport) {
    for (const dept of ar.departmentBreakdown) {
      if (!globalDeptMap[dept.department])
        globalDeptMap[dept.department] = {
          registered: 0,
          attended: 0,
          profiles: 0,
        };
      globalDeptMap[dept.department].registered += dept.registered;
      globalDeptMap[dept.department].attended += dept.attended;
    }
  }
  // Add profile counts
  allProfiles.forEach((e: any) => {
    const dept = e.department || "General";
    if (globalDeptMap[dept]) globalDeptMap[dept].profiles++;
  });

  const totalRegistrations = registrations.length;
  const totalJoined = registrations.filter(
    (r: any) => r.status === "joined",
  ).length;
  const totalAttended = registrations.filter((r: any) => r.attended).length;
  const totalInterested = registrations.filter(
    (r: any) => r.status === "interested",
  ).length;

  // Monthly trend
  const trendMap: Record<string, number> = {};
  filtered.forEach((a: any) => {
    const d = new Date(a.startDate);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    trendMap[key] = (trendMap[key] || 0) + 1;
  });
  const trend = Object.entries(trendMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, count]) => ({ month, count }));

  return {
    title: "Activities Report",
    titleAr: "تقرير الفعاليات",
    type: "activities",
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    summary: {
      totalActivities: filtered.length,
      totalRegistrations,
      totalJoined,
      totalInterested,
      totalAttended,
      overallAttendanceRate:
        totalJoined > 0 ? Math.round((totalAttended / totalJoined) * 100) : 0,
      participationRate:
        totalProfiles > 0
          ? Math.round(
              (new Set(registrations.map((r: any) => r.profileId)).size /
                totalProfiles) *
                100,
            )
          : 0,
      totalProfiles,
    },
    topActivities,
    emptyActivities,
    categoryBreakdown: Object.entries(catMap).map(([category, data]) => ({
      category,
      ...data,
    })),
    departmentSummary: Object.entries(globalDeptMap).map(
      ([department, data]) => ({
        department,
        ...data,
        attendanceRate:
          data.registered > 0
            ? Math.round((data.attended / data.registered) * 100)
            : 0,
        participationRate:
          data.profiles > 0
            ? Math.round((data.registered / data.profiles) * 100)
            : 0,
      }),
    ),
    trend,
    activities: activityReport,
    charts: includeCharts
      ? {
          categoryBreakdown: Object.fromEntries(
            Object.entries(catMap).map(([k, v]) => [k, v.registrations]),
          ),
          monthlyTrend: Object.fromEntries(
            trend.map((t) => [t.month, t.count]),
          ),
        }
      : undefined,
  };
}

async function buildEngagementReport(
  tenantDb: any,
  fromDate: Date,
  toDate: Date,
  departmentFilter?: string,
  includeCharts = true,
) {
  const allProfiles = await tenantDb.select().from(profilesTable);
  const totalProfiles = allProfiles.length;

  // Evaluations data
  const templates = await tenantDb
    .select()
    .from(evaluationsTable)
    .where(isNull(evaluationsTable.surveyTemplateId));
  const templateIds = templates.map((t: any) => t.id);
  const allResponses =
    templateIds.length > 0
      ? await tenantDb
          .select()
          .from(surveyItemResponsesTable)
          .where(inArray(surveyItemResponsesTable.templateId, templateIds))
      : [];
  const uniqueRespondents = new Set(allResponses.map((r: any) => r.profileId))
    .size;

  // Activities data
  const activities = await tenantDb.select().from(activitiesTable);
  const allActivityIds = activities.map((a: any) => a.id);
  const registrations =
    allActivityIds.length > 0
      ? await tenantDb
          .select()
          .from(activityRegistrationsTable)
          .where(inArray(activityRegistrationsTable.activityId, allActivityIds))
      : [];
  const uniqueParticipants = new Set(
    registrations.map((r: any) => r.profileId),
  ).size;
  const totalAttended = registrations.filter((r: any) => r.attended).length;

  // Profile engagement map
  const empEngagement: Record<
    number,
    { evaluations: number; activities: number; attended: number }
  > = {};
  allProfiles.forEach((e: any) => {
    empEngagement[e.id] = { evaluations: 0, activities: 0, attended: 0 };
  });
  allResponses.forEach((r: any) => {
    if (empEngagement[r.profileId]) empEngagement[r.profileId].evaluations++;
  });
  registrations.forEach((r: any) => {
    if (empEngagement[r.profileId]) {
      empEngagement[r.profileId].activities++;
      if (r.attended) empEngagement[r.profileId].attended++;
    }
  });

  // Most active profiles
  const mostActive = allProfiles
    .map((e: any) => ({
      profileId: e.profileId,
      name: `${e.firstName} ${e.lastName}`.trim(),
      department: e.department || "General",
      evaluations: empEngagement[e.id]?.evaluations || 0,
      activities: empEngagement[e.id]?.activities || 0,
      attended: empEngagement[e.id]?.attended || 0,
      totalEngagement:
        (empEngagement[e.id]?.evaluations || 0) +
        (empEngagement[e.id]?.activities || 0),
    }))
    .sort((a: any, b: any) => b.totalEngagement - a.totalEngagement)
    .slice(0, 10);

  // Department engagement
  const deptMap: Record<
    string,
    {
      profiles: number;
      evaluators: number;
      participants: number;
      attended: number;
    }
  > = {};
  allProfiles.forEach((e: any) => {
    const dept = e.department || "General";
    if (!deptMap[dept])
      deptMap[dept] = {
        profiles: 0,
        evaluators: 0,
        participants: 0,
        attended: 0,
      };
    deptMap[dept].profiles++;
    if (empEngagement[e.id]?.evaluations) deptMap[dept].evaluators++;
    if (empEngagement[e.id]?.activities) deptMap[dept].participants++;
    if (empEngagement[e.id]?.attended) deptMap[dept].attended++;
  });
  const departmentEngagement = Object.entries(deptMap)
    .map(([dept, data]) => ({
      department: dept,
      ...data,
      evaluationRate:
        data.profiles > 0
          ? Math.round((data.evaluators / data.profiles) * 100)
          : 0,
      participationRate:
        data.profiles > 0
          ? Math.round((data.participants / data.profiles) * 100)
          : 0,
      attendanceRate:
        data.participants > 0
          ? Math.round((data.attended / data.participants) * 100)
          : 0,
      overallScore:
        data.profiles > 0
          ? Math.round(
              ((data.evaluators + data.participants) / (data.profiles * 2)) *
                100,
            )
          : 0,
    }))
    .sort((a, b) => b.overallScore - a.overallScore);

  // Monthly trend
  const evalTrend: Record<string, number> = {};
  allResponses.forEach((r: any) => {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    evalTrend[key] = (evalTrend[key] || 0) + 1;
  });
  const actTrend: Record<string, number> = {};
  registrations.forEach((r: any) => {
    const d = new Date(r.createdAt);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    actTrend[key] = (actTrend[key] || 0) + 1;
  });
  const allMonths = [
    ...new Set([...Object.keys(evalTrend), ...Object.keys(actTrend)]),
  ].sort();
  const trend = allMonths.map((month) => ({
    month,
    evaluations: evalTrend[month] || 0,
    activities: actTrend[month] || 0,
    total: (evalTrend[month] || 0) + (actTrend[month] || 0),
  }));

  // Non-engaged profiles
  const nonEngaged = allProfiles
    .filter(
      (e: any) =>
        !empEngagement[e.id]?.evaluations && !empEngagement[e.id]?.activities,
    )
    .map((e: any) => ({
      profileId: e.profileId,
      name: `${e.firstName} ${e.lastName}`.trim(),
      department: e.department || "General",
    }));

  // Overall engagement score
  const engagedProfiles = new Set([
    ...allResponses.map((r: any) => r.profileId),
    ...registrations.map((r: any) => r.profileId),
  ]).size;
  const overallScore =
    totalProfiles > 0
      ? Math.round((engagedProfiles / totalProfiles) * 100)
      : 0;

  return {
    title: "Portal Engagement Report",
    titleAr: "تقرير المشاركة في البوابة",
    type: "engagement",
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    summary: {
      totalProfiles,
      engagedProfiles,
      nonEngagedProfiles: totalProfiles - engagedProfiles,
      overallScore,
      evaluationRate:
        totalProfiles > 0
          ? Math.round((uniqueRespondents / totalProfiles) * 100)
          : 0,
      participationRate:
        totalProfiles > 0
          ? Math.round((uniqueParticipants / totalProfiles) * 100)
          : 0,
      attendanceRate:
        registrations.length > 0
          ? Math.round((totalAttended / registrations.length) * 100)
          : 0,
    },
    mostActive,
    departmentEngagement,
    nonEngaged,
    trend,
    charts: includeCharts
      ? {
          departmentScores: Object.fromEntries(
            departmentEngagement.map((d) => [d.department, d.overallScore]),
          ),
          monthlyTrend: Object.fromEntries(
            trend.map((t) => [t.month, t.total]),
          ),
        }
      : undefined,
  };
}

async function buildCustomReport(
  tenantDb: any,
  fromDate: Date,
  toDate: Date,
  departmentFilter?: string,
  modules: string[] = ["evaluations", "activities"],
  includeCharts = true,
) {
  const sections: any[] = [];

  if (modules.includes("evaluations")) {
    const evalReport = await buildEvaluationsReport(
      tenantDb,
      fromDate,
      toDate,
      departmentFilter,
      false,
    );
    sections.push({
      title: "Evaluations",
      titleAr: "التقييمات",
      summary: evalReport.summary,
      departmentRanking: evalReport.departmentRanking,
      topItems: evalReport.topItems,
      data: evalReport.templates,
    });
  }

  if (modules.includes("activities")) {
    const actReport = await buildActivitiesReport(
      tenantDb,
      fromDate,
      toDate,
      departmentFilter,
      false,
    );
    sections.push({
      title: "Activities",
      titleAr: "الفعاليات",
      summary: actReport.summary,
      departmentSummary: actReport.departmentSummary,
      topActivities: actReport.topActivities,
      data: actReport.activities,
    });
  }

  if (modules.includes("engagement")) {
    const engReport = await buildEngagementReport(
      tenantDb,
      fromDate,
      toDate,
      departmentFilter,
      false,
    );
    sections.push({
      title: "Engagement",
      titleAr: "المشاركة",
      summary: engReport.summary,
      departmentEngagement: engReport.departmentEngagement,
      mostActive: engReport.mostActive,
    });
  }

  return {
    title: "Custom Report",
    titleAr: "تقرير مخصص",
    type: "custom",
    period: { from: fromDate.toISOString(), to: toDate.toISOString() },
    summary: {
      modulesGenerated: sections.length,
      modules: modules.join(", "),
    },
    sections,
    charts: includeCharts ? undefined : undefined,
  };
}

// ═══════════════════════════════════════════════════════════════
// CSV GENERATOR
// ═══════════════════════════════════════════════════════════════
function generateCSV(report: any): string {
  let csv = "\uFEFF";
  csv += `${report.title || report.titleAr || "Report"}\n`;
  csv += `Period: ${report.period?.from || ""} to ${report.period?.to || ""}\n\n`;

  if (report.summary) {
    csv += "Summary\n";
    for (const [k, v] of Object.entries(report.summary)) {
      csv += `${k},${v}\n`;
    }
    csv += "\n";
  }

  const addArrayToCSV = (arr: any[]) => {
    if (!arr || arr.length === 0) return;
    const keys = Object.keys(arr[0]);
    csv += keys.join(",") + "\n";
    arr.forEach((row: any) => {
      csv +=
        keys
          .map((k) => `"${String(row[k] ?? "").replace(/"/g, '""')}"`)
          .join(",") + "\n";
    });
  };

  // Handle sections (custom report)
  if (report.sections) {
    for (const section of report.sections) {
      csv += `\n=== ${section.title || section.titleAr} ===\n`;
      if (section.summary) {
        for (const [k, v] of Object.entries(section.summary)) {
          csv += `${k},${v}\n`;
        }
        csv += "\n";
      }
      if (section.data) addArrayToCSV(section.data);
      if (section.departmentRanking) {
        csv += "\nDepartment Ranking\n";
        addArrayToCSV(section.departmentRanking);
      }
      if (section.departmentSummary) {
        csv += "\nDepartment Summary\n";
        addArrayToCSV(section.departmentSummary);
      }
      if (section.departmentEngagement) {
        csv += "\nDepartment Engagement\n";
        addArrayToCSV(section.departmentEngagement);
      }
      if (section.topItems) {
        csv += "\nTop Items\n";
        addArrayToCSV(section.topItems);
      }
      if (section.topActivities) {
        csv += "\nTop Activities\n";
        addArrayToCSV(section.topActivities);
      }
      if (section.mostActive) {
        csv += "\nMost Active Profiles\n";
        addArrayToCSV(section.mostActive);
      }
    }
  } else {
    if (report.templates) addArrayToCSV(report.templates);
    if (report.activities) addArrayToCSV(report.activities);
    if (report.departmentRanking) {
      csv += "\nDepartment Ranking\n";
      addArrayToCSV(report.departmentRanking);
    }
    if (report.departmentSummary) {
      csv += "\nDepartment Summary\n";
      addArrayToCSV(report.departmentSummary);
    }
    if (report.departmentEngagement) {
      csv += "\nDepartment Engagement\n";
      addArrayToCSV(report.departmentEngagement);
    }
    if (report.mostActive) {
      csv += "\nMost Active Profiles\n";
      addArrayToCSV(report.mostActive);
    }
    if (report.nonEngaged) {
      csv += "\nNon-Engaged Profiles\n";
      addArrayToCSV(report.nonEngaged);
    }
    if (Array.isArray(report.data) && report.data.length > 0) {
      addArrayToCSV(report.data);
    } else if (report.data && typeof report.data === "object") {
      for (const [key, val] of Object.entries(report.data)) {
        if (Array.isArray(val) && val.length > 0) {
          csv += `\n${key}\n`;
          addArrayToCSV(val);
        }
      }
    }
  }

  return csv;
}

export default router;
