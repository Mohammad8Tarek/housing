import { Router } from "express";
import {
  withTenant,
  evaluationsTable,
  surveyItemsTable,
  surveyItemResponsesTable,
  portalNotificationsTable,
  employeesTable,
} from "@workspace/db";
import { eq, desc, sql, isNull, and, inArray } from "drizzle-orm";
import { z } from "zod";
import { broadcastToProperty } from "../lib/websocket.js";
import { logActivity } from "../lib/activity-logger.js";
import { requirePermission } from "../middlewares/permissions.js";
import { withTableFallback } from "../lib/with-table-fallback.js";
import { getTenantId } from "../lib/request-utils.js";

const router: Router = Router();

// ─── Admin: Create evaluation template with optional items ───
const CreateEvaluationSchema = z.object({
  titleAr: z.string().optional(),
  titleEn: z.string().optional(),
  descriptionAr: z.string().optional(),
  descriptionEn: z.string().optional(),
  category: z.string().optional().default("general"),
  department: z.string().optional(),
  expiresAt: z.string().optional(),
  items: z
    .array(
      z.object({
        titleAr: z.string(),
        titleEn: z.string(),
        type: z.enum(["rating", "text", "yes_no"]).default("rating"),
        required: z.boolean().default(true),
      }),
    )
    .optional(),
});

// GET /api/evaluations - Admin: list all evaluation templates
// @ts-ignore
router.get(
  "/evaluations",
  requirePermission("employees", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const rows = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            const templates = await tenantDb
              .select()
              .from(evaluationsTable)
              .where(isNull(evaluationsTable.surveyTemplateId))
              .orderBy(desc(evaluationsTable.createdAt));

            // Fetch items for each template
            const templateIds = templates.map((t) => t.id);
            const allItems =
              templateIds.length > 0
                ? await tenantDb
                    .select()
                    .from(surveyItemsTable)
                    .where(inArray(surveyItemsTable.templateId, templateIds))
                : [];
            const itemsByTemplate: Record<number, any[]> = {};
            for (const item of allItems) {
              if (!itemsByTemplate[item.templateId])
                itemsByTemplate[item.templateId] = [];
              itemsByTemplate[item.templateId].push(item);
            }

            // Count responses per template
            const responseCounts =
              templateIds.length > 0
                ? await tenantDb
                    .select({
                      templateId: surveyItemResponsesTable.templateId,
                      count: sql<number>`count(distinct ${surveyItemResponsesTable.employeeId})::int`,
                    })
                    .from(surveyItemResponsesTable)
                    .where(
                      inArray(surveyItemResponsesTable.templateId, templateIds),
                    )
                    .groupBy(surveyItemResponsesTable.templateId)
                : [];
            const countMap = Object.fromEntries(
              responseCounts.map((r) => [r.templateId, r.count]),
            );

            return templates.map((t) => ({
              ...t,
              items: itemsByTemplate[t.id] || [],
              responseCount: countMap[t.id] || 0,
              submittedAt:
                t.submittedAt instanceof Date
                  ? t.submittedAt.toISOString()
                  : t.submittedAt,
              createdAt:
                t.createdAt instanceof Date
                  ? t.createdAt.toISOString()
                  : t.createdAt,
            }));
          }),
        [],
      );

      return res.json(rows);
    } catch (err) {
      return next(err);
    }
  },
);

// POST /api/evaluations - Admin: create evaluation template with items
// @ts-ignore
router.post(
  "/evaluations",
  requirePermission("employees", "create"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const parsed = CreateEvaluationSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({
            success: false,
            message: parsed.error.errors[0]?.message ?? "Invalid input",
          });

      const { items, ...templateData } = parsed.data;
      if (!templateData.titleAr && !templateData.titleEn) {
        templateData.titleAr = templateData.category;
        templateData.titleEn = templateData.category;
      }

      const insertTemplate: any = { ...templateData };
      if (insertTemplate.expiresAt) {
        insertTemplate.expiresAt = new Date(insertTemplate.expiresAt);
      } else {
        delete insertTemplate.expiresAt;
      }

      const result = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            const [template] = await tenantDb
              .insert(evaluationsTable)
              .values(insertTemplate)
              .returning();

            // Insert survey items if provided
            if (items && items.length > 0) {
              const itemValues = items.map((item, idx) => ({
                templateId: template.id,
                titleAr: item.titleAr,
                titleEn: item.titleEn,
                type: item.type,
                required: item.required,
                orderIndex: idx,
              }));
              await tenantDb.insert(surveyItemsTable).values(itemValues);
            }

            // Send notification
            await tenantDb.insert(portalNotificationsTable).values({
              propertyId,
              title: "New Survey / Evaluation",
              titleAr: "استبيان / تقييم جديد",
              message: template.titleEn
                ? `A new survey requires your attention: ${template.titleEn}`
                : "A new survey requires your attention.",
              messageAr: template.titleAr
                ? `هناك استبيان جديد يرجى المشاركة فيه: ${template.titleAr}`
                : "هناك استبيان جديد يرجى المشاركة فيه.",
              type: "evaluation",
              priority: "high",
              targetAll: !templateData.department,
              department: templateData.department || null,
            });

            return template;
          }),
        null,
      );

      if (!result) {
        return res
          .status(503)
          .json({
            success: false,
            message:
              "هذه الميزة غير متاحة بعد / This feature is not available yet",
          });
      }

      broadcastToProperty(propertyId, {
        type: "data_updated",
        module: "notifications",
        action: "created",
      });

      return res.status(201).json({
        ...result,
        items: items || [],
        submittedAt:
          result.submittedAt instanceof Date
            ? result.submittedAt.toISOString()
            : result.submittedAt,
        createdAt:
          result.createdAt instanceof Date
            ? result.createdAt.toISOString()
            : result.createdAt,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// PUT /api/evaluations/:id - Admin: update evaluation template items
const UpdateItemsSchema = z.object({
  items: z.array(
    z.object({
      id: z.number().optional(),
      titleAr: z.string(),
      titleEn: z.string(),
      type: z.enum(["rating", "text", "yes_no"]).default("rating"),
      required: z.boolean().default(true),
    }),
  ),
});

// @ts-ignore
router.put(
  "/evaluations/:id/items",
  requirePermission("employees", "edit"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const templateId = Number(req.params.id);
      if (!propertyId || !templateId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId and id required" });

      const parsed = UpdateItemsSchema.safeParse(req.body);
      if (!parsed.success)
        return res
          .status(400)
          .json({
            success: false,
            message: parsed.error.errors[0]?.message ?? "Invalid input",
          });

      await withTenant(propertyId, async (tenantDb) => {
        // Delete existing items and re-insert
        await tenantDb
          .delete(surveyItemsTable)
          .where(eq(surveyItemsTable.templateId, templateId));

        if (parsed.data.items.length > 0) {
          const itemValues = parsed.data.items.map((item, idx) => ({
            templateId,
            titleAr: item.titleAr,
            titleEn: item.titleEn,
            type: item.type,
            required: item.required,
            orderIndex: idx,
          }));
          await tenantDb.insert(surveyItemsTable).values(itemValues);
        }
      });

      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/evaluations/stats - Aggregate evaluation stats
// @ts-ignore
router.get(
  "/evaluations/stats",
  requirePermission("reports", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const stats = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            const templates = await tenantDb
              .select()
              .from(evaluationsTable)
              .where(isNull(evaluationsTable.surveyTemplateId));
            const templateIds = templates.map((t) => t.id);

            // Get all item responses
            const responses =
              templateIds.length > 0
                ? await tenantDb
                    .select()
                    .from(surveyItemResponsesTable)
                    .where(
                      inArray(surveyItemResponsesTable.templateId, templateIds),
                    )
                : [];

            // Get unique respondents
            const uniqueRespondents = new Set(
              responses.map((r) => r.employeeId),
            );

            // Rating stats (only from rating-type items)
            const ratingResponses = responses.filter(
              (r) => r.ratingValue != null,
            );
            const avgRating =
              ratingResponses.length > 0
                ? ratingResponses.reduce(
                    (sum, r) => sum + (r.ratingValue || 0),
                    0,
                  ) / ratingResponses.length
                : 0;

            // Per-template stats
            const templateStats = templates.map((t) => {
              const templateResponses = responses.filter(
                (r) => r.templateId === t.id,
              );
              const uniqueForTemplate = new Set(
                templateResponses.map((r) => r.employeeId),
              );
              const templateRatings = templateResponses.filter(
                (r) => r.ratingValue != null,
              );
              return {
                templateId: t.id,
                titleAr: t.titleAr,
                titleEn: t.titleEn,
                category: t.category,
                department: t.department,
                responseCount: uniqueForTemplate.size,
                avgRating:
                  templateRatings.length > 0
                    ? templateRatings.reduce(
                        (sum, r) => sum + (r.ratingValue || 0),
                        0,
                      ) / templateRatings.length
                    : 0,
              };
            });

            // Department breakdown
            const deptMap: Record<
              string,
              { count: number; totalRating: number; ratingCount: number }
            > = {};
            for (const ts of templateStats) {
              const dept = ts.department || "General";
              if (!deptMap[dept])
                deptMap[dept] = { count: 0, totalRating: 0, ratingCount: 0 };
              deptMap[dept].count += ts.responseCount;
              deptMap[dept].totalRating += ts.avgRating * ts.responseCount;
              deptMap[dept].ratingCount += ts.responseCount;
            }
            const departmentBreakdown = Object.entries(deptMap).map(
              ([dept, data]) => ({
                department: dept,
                responseCount: data.count,
                avgRating:
                  data.ratingCount > 0
                    ? data.totalRating / data.ratingCount
                    : 0,
              }),
            );

            // Category breakdown
            const catMap: Record<string, number> = {};
            for (const ts of templateStats) {
              catMap[ts.category] =
                (catMap[ts.category] || 0) + ts.responseCount;
            }
            const categoryBreakdown = Object.entries(catMap).map(
              ([category, count]) => ({ category, count }),
            );

            return {
              totalTemplates: templates.length,
              totalResponses: uniqueRespondents.size,
              averageRating: Math.round(avgRating * 10) / 10,
              positive: ratingResponses.filter((r) => (r.ratingValue || 0) >= 4)
                .length,
              negative: ratingResponses.filter((r) => (r.ratingValue || 0) <= 2)
                .length,
              templateStats,
              departmentBreakdown,
              categoryBreakdown,
            };
          }),
        {
          totalTemplates: 0,
          totalResponses: 0,
          averageRating: 0,
          positive: 0,
          negative: 0,
          templateStats: [],
          departmentBreakdown: [],
          categoryBreakdown: [],
        },
      );

      return res.json(stats);
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/evaluations/:id/responses - Admin: view individual responses for a template
// @ts-ignore
router.get(
  "/evaluations/:id/responses",
  requirePermission("employees", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const templateId = Number(req.params.id);
      if (!propertyId || !templateId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId and id required" });

      const result = await withTenant(propertyId, async (tenantDb) => {
        // Get template info
        const [template] = await tenantDb
          .select()
          .from(evaluationsTable)
          .where(eq(evaluationsTable.id, templateId))
          .limit(1);
        if (!template) return null;

        // Get items
        const items = await tenantDb
          .select()
          .from(surveyItemsTable)
          .where(eq(surveyItemsTable.templateId, templateId))
          .orderBy(surveyItemsTable.orderIndex);

        // Get all responses grouped by employeeId
        const responses = await tenantDb
          .select()
          .from(surveyItemResponsesTable)
          .where(eq(surveyItemResponsesTable.templateId, templateId));

        // Group by employeeId
        const employeeMap: Record<
          number,
          { employeeId: number; items: any[]; submittedAt: Date | null }
        > = {};
        for (const r of responses) {
          if (!employeeMap[r.employeeId]) {
            employeeMap[r.employeeId] = {
              employeeId: r.employeeId,
              items: [],
              submittedAt: r.createdAt,
            };
          }
          employeeMap[r.employeeId].items.push({
            itemId: r.itemId,
            ratingValue: r.ratingValue,
            textValue: r.textValue,
          });
          if (
            r.createdAt &&
            (!employeeMap[r.employeeId].submittedAt ||
              r.createdAt > employeeMap[r.employeeId].submittedAt!)
          ) {
            employeeMap[r.employeeId].submittedAt = r.createdAt;
          }
        }

        // Get employee names
        const employeeIds = Object.keys(employeeMap).map(Number);
        const employees =
          employeeIds.length > 0
            ? await tenantDb
                .select({
                  id: employeesTable.id,
                  firstName: employeesTable.firstName,
                  lastName: employeesTable.lastName,
                  employeeId: employeesTable.employeeId,
                })
                .from(employeesTable)
                .where(inArray(employeesTable.id, employeeIds))
            : [];
        const empMap = Object.fromEntries(employees.map((e) => [e.id, e]));

        return {
          template: {
            ...template,
            submittedAt:
              template.submittedAt instanceof Date
                ? template.submittedAt.toISOString()
                : template.submittedAt,
            createdAt:
              template.createdAt instanceof Date
                ? template.createdAt.toISOString()
                : template.createdAt,
          },
          items,
          responses: Object.values(employeeMap).map((r) => ({
            employeeId: r.employeeId,
            employeeName: empMap[r.employeeId]
              ? `${empMap[r.employeeId].firstName || ""} ${empMap[r.employeeId].lastName || ""}`.trim()
              : `Employee #${r.employeeId}`,
            employeeCode: empMap[r.employeeId]?.employeeId || null,
            items: r.items,
            submittedAt:
              r.submittedAt instanceof Date
                ? r.submittedAt.toISOString()
                : r.submittedAt,
          })),
          totalResponses: Object.keys(employeeMap).length,
        };
      });

      if (!result)
        return res
          .status(404)
          .json({ success: false, message: "Template not found" });
      return res.json(result);
    } catch (err) {
      return next(err);
    }
  },
);

// DELETE /api/evaluations/:id - Admin: delete evaluation template
// @ts-ignore
router.delete(
  "/evaluations/:id",
  requirePermission("employees", "delete"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      const id = Number(req.params.id);
      if (!propertyId || !id)
        return res
          .status(400)
          .json({ success: false, message: "propertyId and id required" });

      const deleted = await withTableFallback(
        async () =>
          withTenant(propertyId, async (tenantDb) => {
            const [existing] = await tenantDb
              .select({ id: evaluationsTable.id })
              .from(evaluationsTable)
              .where(eq(evaluationsTable.id, id))
              .limit(1);
            if (!existing) return false;
            await tenantDb
              .delete(evaluationsTable)
              .where(eq(evaluationsTable.id, id));
            return true;
          }),
        false,
      );

      if (!deleted) {
        return res
          .status(404)
          .json({ success: false, message: "Evaluation not found" });
      }

      await logActivity({
        req,
        propertyId,
        username: (req.session as any)?.username ?? "admin",
        userId: (req.session as any)?.userId,
        userRole: (req.session as any)?.userRole ?? "admin",
        action: `حذف استبيان #${id}`,
        actionType: "DELETE",
        module: "evaluations",
        entityType: "evaluation",
        entityId: id,
      });

      res.sendStatus(204);
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
