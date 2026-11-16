import { Router } from "express";
import {
  db,
  withTenant,
  evaluationsTable,
  surveyItemsTable,
  surveyItemResponsesTable,
  portalNotificationsTable,
  profilesTable,
  assignmentsTable,
  propertyHousingPulseConfigTable,
} from "@workspace/db";
import { eq, and, desc, sql, isNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { broadcastToProperty, broadcastSyncAll } from "../lib/websocket.js";
import { logActivity } from "../lib/activity-logger.js";
import { requirePermission } from "../middlewares/permissions.js";
import { withTableFallback } from "../lib/with-table-fallback.js";
import { getTenantId } from "../lib/request-utils.js";
import { validate } from "../middlewares/validate.js";
import { IdParams, HousingPulseConfigBody } from "../validation/schemas.js";
import { generateSurveyToken } from "./public-surveys.js";
import QRCode from "qrcode";

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
  opensAt: z.string().optional(),
  items: z
    .array(
      z.object({
        titleAr: z.string(),
        titleEn: z.string(),
        type: z.enum(["rating", "text", "yes_no"]).default("rating"),
        required: z.boolean().default(true),
        sectionAr: z.string().optional(),
        sectionEn: z.string().optional(),
        allowNa: z.boolean().optional().default(false),
      }),
    )
    .optional(),
});

// GET /api/evaluations - Admin: list all evaluation templates
router.get(
  "/evaluations",
  requirePermission("evaluations", "view"),
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
                      count: sql<number>`count(distinct ${surveyItemResponsesTable.profileId})::int`,
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
router.post(
  "/evaluations",
  requirePermission("evaluations", "create"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });

      const parsed = CreateEvaluationSchema.safeParse(req.body);
      if (!parsed.success)
        return res.status(400).json({
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
      if (insertTemplate.opensAt) {
        insertTemplate.opensAt = new Date(insertTemplate.opensAt);
      } else {
        delete insertTemplate.opensAt;
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
                sectionAr: (item as any).sectionAr ?? null,
                sectionEn: (item as any).sectionEn ?? null,
                allowNa: Boolean((item as any).allowNa),
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
        return res.status(503).json({
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

router.put(
  "/evaluations/:id/items",
  requirePermission("evaluations", "edit"),
  validate({ params: IdParams }),
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
        return res.status(400).json({
          success: false,
          message: parsed.error.errors[0]?.message ?? "Invalid input",
        });

      const outcome = await withTenant(propertyId, async (tenantDb) => {
        // Must be a survey template (not a resident's response row).
        const [template] = await tenantDb
          .select({ id: evaluationsTable.id })
          .from(evaluationsTable)
          .where(
            and(
              eq(evaluationsTable.id, templateId),
              isNull(evaluationsTable.surveyTemplateId),
            ),
          )
          .limit(1);
        if (!template) return "not_found" as const;

        // Update questions in place instead of delete + re-insert: answers
        // reference the question id (ON DELETE CASCADE), so re-creating every
        // question wiped all responses collected so far. Only questions the
        // admin removed are deleted (with their answers).
        const existing = await tenantDb
          .select({ id: surveyItemsTable.id })
          .from(surveyItemsTable)
          .where(eq(surveyItemsTable.templateId, templateId));
        const existingIds = new Set(existing.map((r: any) => Number(r.id)));
        const keptIds = new Set<number>();

        for (const [idx, item] of parsed.data.items.entries()) {
          const values = {
            titleAr: item.titleAr,
            titleEn: item.titleEn,
            type: item.type,
            required: item.required,
            orderIndex: idx,
          };
          if (item.id && existingIds.has(item.id)) {
            keptIds.add(item.id);
            await tenantDb
              .update(surveyItemsTable)
              .set(values)
              .where(eq(surveyItemsTable.id, item.id));
          } else {
            await tenantDb
              .insert(surveyItemsTable)
              .values({ templateId, ...values });
          }
        }
        const removed = [...existingIds].filter((id) => !keptIds.has(id));
        if (removed.length > 0) {
          await tenantDb
            .delete(surveyItemsTable)
            .where(inArray(surveyItemsTable.id, removed));
        }
        return "ok" as const;
      });

      if (outcome === "not_found") {
        return res
          .status(404)
          .json({ success: false, message: "Survey template not found" });
      }

      return res.json({ success: true });
    } catch (err) {
      return next(err);
    }
  },
);

// GET /api/evaluations/stats - Aggregate evaluation stats
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
              responses.map((r) => r.profileId),
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
                templateResponses.map((r) => r.profileId),
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
                ratingCount: templateRatings.length,
                ratingSum: templateRatings.reduce(
                  (sum, r) => sum + (r.ratingValue || 0),
                  0,
                ),
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
              // Average of the department's actual ratings: surveys with no
              // ratings no longer pull it toward 0, and a survey weighs by
              // how many ratings it has, not how many people answered.
              deptMap[dept].totalRating += ts.ratingSum;
              deptMap[dept].ratingCount += ts.ratingCount;
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
router.get(
  "/evaluations/:id/responses",
  requirePermission("evaluations", "view"),
  validate({ params: IdParams }),
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

        // Get all responses grouped by profileId
        const responses = await tenantDb
          .select()
          .from(surveyItemResponsesTable)
          .where(eq(surveyItemResponsesTable.templateId, templateId));

        // Group by respondent: a logged-in profile (profile_id) or an anonymous
        // public submission (respondent_key).
        const profileMap: Record<
          string,
          {
            profileId: number | null;
            respondentKey: string | null;
            department: string | null;
            source: string;
            items: any[];
            submittedAt: Date | null;
          }
        > = {};
        for (const r of responses) {
          const key =
            r.profileId != null
              ? `p:${r.profileId}`
              : `k:${(r as any).respondentKey ?? "anon"}`;
          if (!profileMap[key]) {
            profileMap[key] = {
              profileId: r.profileId ?? null,
              respondentKey: (r as any).respondentKey ?? null,
              department: (r as any).department ?? null,
              source: (r as any).source ?? "portal",
              items: [],
              submittedAt: r.createdAt,
            };
          }
          profileMap[key].items.push({
            itemId: r.itemId,
            ratingValue: r.ratingValue,
            textValue: r.textValue,
            na: (r as any).na ?? false,
          });
          if (
            r.createdAt &&
            (!profileMap[key].submittedAt ||
              r.createdAt > profileMap[key].submittedAt!)
          ) {
            profileMap[key].submittedAt = r.createdAt;
          }
        }

        // Get names only for logged-in profiles; public respondents are anonymous.
        const profileIds = Object.values(profileMap)
          .map((r) => r.profileId)
          .filter((id): id is number => id != null);
        const profiles =
          profileIds.length > 0
            ? await tenantDb
                .select({
                  id: profilesTable.id,
                  firstName: profilesTable.firstName,
                  lastName: profilesTable.lastName,
                  profileId: profilesTable.profileId,
                })
                .from(profilesTable)
                .where(inArray(profilesTable.id, profileIds))
            : [];
        const empMap = Object.fromEntries(profiles.map((e) => [e.id, e]));

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
          responses: Object.values(profileMap).map((r) => {
            const emp = r.profileId != null ? empMap[r.profileId] : null;
            return {
              profileId: r.profileId,
              source: r.source,
              department: r.department,
              profileName: emp
                ? `${emp.firstName || ""} ${emp.lastName || ""}`.trim()
                : r.source === "public"
                  ? "مجهول / Anonymous"
                  : `Profile #${r.profileId}`,
              profileCode: emp?.profileId || null,
              items: r.items,
              submittedAt:
                r.submittedAt instanceof Date
                  ? r.submittedAt.toISOString()
                  : r.submittedAt,
            };
          }),
          totalResponses: Object.keys(profileMap).length,
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
router.delete(
  "/evaluations/:id",
  requirePermission("evaluations", "delete"),
  validate({ params: IdParams }),
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

// ─── Housing Pulse (7-Day Survey) Admin Management ──────────────────────────

// GET /api/evaluations/housing-pulse - Get configuration
router.get(
  "/evaluations/housing-pulse",
  requirePermission("evaluations", "view"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });
      }

      let [config] = await db
        .select()
        .from(propertyHousingPulseConfigTable)
        .where(eq(propertyHousingPulseConfigTable.propertyId, propertyId))
        .limit(1);

      if (!config) {
        const [inserted] = await db
          .insert(propertyHousingPulseConfigTable)
          .values({
            propertyId,
            enabled: true,
            ratingType: "faces",
            allowComment: true,
            commentRequired: false,
            cooldownDays: 7,
            titleAr: "استطلاع جودة السكن الأسبوعي",
            titleEn: "Weekly Housing Quality Pulse",
            questionAr:
              "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟",
            questionEn:
              "How satisfied are you with housing conditions, cleanliness & services this week?",
          })
          .returning();
        config = inserted;
      }

      return res.json({ success: true, config });
    } catch (err) {
      return next(err);
    }
  },
);

// PUT /api/evaluations/housing-pulse - Update configuration
router.put(
  "/evaluations/housing-pulse",
  requirePermission("evaluations", "edit"),
  validate({ body: HousingPulseConfigBody }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });
      }

      const {
        enabled,
        ratingType,
        allowComment,
        commentRequired,
        cooldownDays,
        titleAr,
        titleEn,
        questionAr,
        questionEn,
      } = req.body;

      const normalizedType = ratingType === "stars" ? "stars" : "faces";

      const [existing] = await db
        .select({ id: propertyHousingPulseConfigTable.id })
        .from(propertyHousingPulseConfigTable)
        .where(eq(propertyHousingPulseConfigTable.propertyId, propertyId))
        .limit(1);

      let updatedConfig;
      if (existing) {
        const [u] = await db
          .update(propertyHousingPulseConfigTable)
          .set({
            enabled: typeof enabled === "boolean" ? enabled : true,
            ratingType: normalizedType,
            allowComment:
              typeof allowComment === "boolean" ? allowComment : true,
            commentRequired:
              typeof commentRequired === "boolean" ? commentRequired : false,
            cooldownDays: Math.max(
              1,
              Math.min(365, parseInt(cooldownDays, 10) || 7),
            ),
            titleAr: titleAr
              ? String(titleAr).trim()
              : "استطلاع جودة السكن الأسبوعي",
            titleEn: titleEn
              ? String(titleEn).trim()
              : "Weekly Housing Quality Pulse",
            questionAr: questionAr
              ? String(questionAr).trim()
              : "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟",
            questionEn: questionEn
              ? String(questionEn).trim()
              : "How satisfied are you with housing conditions, cleanliness & services this week?",
            updatedAt: new Date(),
          })
          .where(eq(propertyHousingPulseConfigTable.propertyId, propertyId))
          .returning();
        updatedConfig = u;
      } else {
        const [inserted] = await db
          .insert(propertyHousingPulseConfigTable)
          .values({
            propertyId,
            enabled: typeof enabled === "boolean" ? enabled : true,
            ratingType: normalizedType,
            allowComment:
              typeof allowComment === "boolean" ? allowComment : true,
            commentRequired:
              typeof commentRequired === "boolean" ? commentRequired : false,
            cooldownDays: Math.max(
              1,
              Math.min(365, parseInt(cooldownDays, 10) || 7),
            ),
            titleAr: titleAr
              ? String(titleAr).trim()
              : "استطلاع جودة السكن الأسبوعي",
            titleEn: titleEn
              ? String(titleEn).trim()
              : "Weekly Housing Quality Pulse",
            questionAr: questionAr
              ? String(questionAr).trim()
              : "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟",
            questionEn: questionEn
              ? String(questionEn).trim()
              : "How satisfied are you with housing conditions, cleanliness & services this week?",
          })
          .returning();
        updatedConfig = inserted;
      }

      await logActivity({
        req,
        propertyId,
        username: (req.session as any)?.username ?? "admin",
        userId: (req.session as any)?.userId,
        userRole: (req.session as any)?.userRole ?? "admin",
        action: "تحديث إعدادات استطلاع جودة السكن (Housing Pulse Config)",
        actionType: "UPDATE",
        module: "evaluations",
        entityType: "housing_pulse_config",
        entityId: updatedConfig.id,
      });

      return res.json({
        success: true,
        config: updatedConfig,
        message: "تم حفظ إعدادات الاستبيان بنجاح",
      });
    } catch (err) {
      return next(err);
    }
  },
);

// POST /api/evaluations/housing-pulse/push - Push Survey Now to all active residents ("لو عايز أبوشه النهارده")
router.post(
  "/evaluations/housing-pulse/push",
  requirePermission("evaluations", "edit"),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });
      }

      const now = new Date();

      // Upsert pulse config with forcePromptAfter = now
      const [existing] = await db
        .select({ id: propertyHousingPulseConfigTable.id })
        .from(propertyHousingPulseConfigTable)
        .where(eq(propertyHousingPulseConfigTable.propertyId, propertyId))
        .limit(1);

      let config;
      if (existing) {
        const [u] = await db
          .update(propertyHousingPulseConfigTable)
          .set({
            forcePromptAfter: now,
            lastPushedAt: now,
            enabled: true,
            updatedAt: now,
          })
          .where(eq(propertyHousingPulseConfigTable.propertyId, propertyId))
          .returning();
        config = u;
      } else {
        const [ins] = await db
          .insert(propertyHousingPulseConfigTable)
          .values({
            propertyId,
            enabled: true,
            forcePromptAfter: now,
            lastPushedAt: now,
          })
          .returning();
        config = ins;
      }

      // Count eligible in-house residents and notify
      let inHouseCount = 0;
      try {
        await withTenant(propertyId, async (tenantDb) => {
          const resCount = await tenantDb
            .select({
              count: sql<number>`count(distinct ${assignmentsTable.profileId})::int`,
            })
            .from(assignmentsTable)
            .where(eq(assignmentsTable.status, "ACTIVE"));
          inHouseCount = resCount[0]?.count || 0;

          // Insert a broadcast notification into portalNotificationsTable for active residents
          await tenantDb.insert(portalNotificationsTable).values({
            propertyId,
            title:
              config.questionEn ||
              "Housing Quality Survey: Share Your Feedback",
            titleAr: "استطلاع رأي: شاركنا رأيك في جودة السكن",
            message:
              config.questionEn ||
              "How satisfied are you with housing conditions, cleanliness & services this week?",
            messageAr:
              config.questionAr ||
              "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟",
            type: "evaluation",
            priority: "high",
            targetAll: true,
          });
        });
      } catch (errTenant) {
        console.warn(
          "[housing-pulse-push] notification broadcast warning:",
          errTenant,
        );
      }

      // Broadcast WebSocket event
      try {
        broadcastToProperty(propertyId, {
          type: "data_updated",
          module: "evaluations",
          action: "rate",
          data: { forced: true, timestamp: now.toISOString() },
        });
        broadcastSyncAll(propertyId);
      } catch (wsErr) {
        console.warn("[housing-pulse-push] WebSocket broadcast error:", wsErr);
      }

      await logActivity({
        req,
        propertyId,
        username: (req.session as any)?.username ?? "admin",
        userId: (req.session as any)?.userId,
        userRole: (req.session as any)?.userRole ?? "admin",
        action: `إرسال وتفعيل استطلاع جودة السكن الآن لجميع المقيمين (${inHouseCount} مقيم)`,
        actionType: "CREATE",
        module: "evaluations",
        entityType: "housing_pulse_push",
      });

      return res.json({
        success: true,
        message: `تم إرسال وتفعيل الاستبيان الآن بنجاح لجميع المقيمين (${inHouseCount} مقيم بالسكن)`,
        inHouseCount,
        lastPushedAt: now.toISOString(),
      });
    } catch (err) {
      return next(err);
    }
  },
);

// POST /api/evaluations/:id/share - Admin: make a template public, return link token
router.post(
  "/evaluations/:id/share",
  requirePermission("evaluations", "edit"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });
      const templateId = Number(req.params.id);

      const updated = await withTenant(propertyId, async (tenantDb) => {
        const [tpl] = await tenantDb
          .select()
          .from(evaluationsTable)
          .where(
            and(
              eq(evaluationsTable.id, templateId),
              isNull(evaluationsTable.surveyTemplateId),
            ),
          )
          .limit(1);
        if (!tpl) return null;
        const token = (tpl as any).publicToken || generateSurveyToken();
        const [row] = await tenantDb
          .update(evaluationsTable)
          .set({ isPublic: true, publicToken: token } as any)
          .where(eq(evaluationsTable.id, templateId))
          .returning();
        return row;
      });

      if (!updated)
        return res
          .status(404)
          .json({ success: false, message: "Survey template not found" });

      const token = (updated as any).publicToken;
      // Build the link against the resident PORTAL (where /s/:token lives), not
      // the admin origin. QR is rendered server-side so it never depends on a
      // browser library.
      const portalBase = (
        process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/"
      ).replace(/\/+$/, "");
      const url = `${portalBase}/s/${token}`;
      let qr: string | null = null;
      try {
        qr = await QRCode.toDataURL(url, {
          width: 320,
          margin: 2,
          color: { dark: "#0F2A44", light: "#ffffff" },
        });
      } catch {
        /* QR generation best-effort */
      }
      return res.json({
        success: true,
        token,
        url,
        qr,
        path: `/s/${token}`,
        isPublic: true,
        expiresAt: (updated as any).expiresAt ?? null,
        opensAt: (updated as any).opensAt ?? null,
      });
    } catch (err) {
      return next(err);
    }
  },
);

// POST /api/evaluations/:id/unshare - Admin: disable the public link
router.post(
  "/evaluations/:id/unshare",
  requirePermission("evaluations", "edit"),
  validate({ params: IdParams }),
  async (req, res, next) => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId)
        return res
          .status(400)
          .json({ success: false, message: "propertyId required" });
      const templateId = Number(req.params.id);
      await withTenant(propertyId, async (tenantDb) => {
        await tenantDb
          .update(evaluationsTable)
          .set({ isPublic: false } as any)
          .where(eq(evaluationsTable.id, templateId));
      });
      return res.json({ success: true, isPublic: false });
    } catch (err) {
      return next(err);
    }
  },
);

export default router;
