import { Router } from "express";
import {
  db,
  withTenant,
  evaluationsTable,
  surveyItemsTable,
  surveyItemResponsesTable,
} from "@workspace/db";
import {
  profilesTable,
  propertyHousingRatingsTable,
  propertyHousingPulseConfigTable,
} from "@workspace/db";
import {
  eq,
  and,
  desc,
  sql,
  inArray,
  or,
  isNull,
  gte,
  isNotNull,
} from "drizzle-orm";
import { portalSession } from "../portal-auth/shared.js";
import { logActivity } from "../../lib/activity-logger.js";
import { validate } from "../../middlewares/validate.js";
import {
  IdParams,
  EvaluationRespondBody,
  HousingRatingBody,
} from "../../validation/schemas.js";

const router: Router = Router();

// ─── Portal Evaluations ──────────────────────────────────────
// Profiles see evaluations that are: no department set, or match their department
router.get("/my-evaluations", async (req, res): Promise<void> => {
  try {
    const sess = portalSession(req)!;
    if (!sess) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const [profile] = await withTenant(sess.propertyId, async (tenantDb) => {
      return await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.id, sess.profileDbId))
        .limit(1);
    });

    const profileDept = profile?.department || null;

    const rows = await withTenant(sess.propertyId, async (tenantDb) => {
      const templates = await tenantDb
        .select()
        .from(evaluationsTable)
        .where(
          and(
            isNull(evaluationsTable.surveyTemplateId),
            or(
              isNull(evaluationsTable.department),
              eq(evaluationsTable.department, ""),
              profileDept
                ? eq(evaluationsTable.department, profileDept)
                : sql`false`,
            ),
            or(
              isNull(evaluationsTable.expiresAt),
              gte(evaluationsTable.expiresAt, new Date()),
            ),
          ),
        )
        .orderBy(desc(evaluationsTable.createdAt));

      const templateIds = templates.map((t) => t.id);

      // Fetch items for each template
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

      // Check if profile has responded via survey_item_responses
      const respondedTemplateIds: Set<number> = new Set();
      if (templateIds.length > 0) {
        const myResponses = await tenantDb
          .select({
            templateId: surveyItemResponsesTable.templateId,
          })
          .from(surveyItemResponsesTable)
          .where(
            and(
              eq(surveyItemResponsesTable.profileId, sess.profileDbId),
              inArray(surveyItemResponsesTable.templateId, templateIds),
            ),
          )
          .groupBy(surveyItemResponsesTable.templateId);
        for (const r of myResponses) respondedTemplateIds.add(r.templateId);
      }

      // Also check old-style responses (profileRating in evaluations table)
      const oldResponses = await tenantDb
        .select()
        .from(evaluationsTable)
        .where(
          and(
            isNotNull(evaluationsTable.surveyTemplateId),
            eq(evaluationsTable.profileId, sess.profileDbId),
          ),
        );
      const oldResponseByTemplate = Object.fromEntries(
        oldResponses.map((r) => [r.surveyTemplateId!, r]),
      );

      return templates.map((template) => {
        const hasItemResponses = respondedTemplateIds.has(template.id);
        const oldResp = oldResponseByTemplate[template.id];
        const _hasResponded =
          hasItemResponses ||
          Boolean(
            oldResp?.profileRating != null ||
            (oldResp?.profileResponse &&
              String(oldResp.profileResponse).trim()),
          );
        return {
          ...template,
          items: itemsByTemplate[template.id] || [],
          profileRating: oldResp?.profileRating ?? template.profileRating,
          profileResponse: oldResp?.profileResponse ?? template.profileResponse,
          _hasResponded,
          _responseId: oldResp?.id ?? null,
        };
      });
    });

    res.json(
      rows.map((r) => ({
        ...r,
        submittedAt:
          r.submittedAt instanceof Date
            ? r.submittedAt.toISOString()
            : r.submittedAt,
        createdAt:
          r.createdAt instanceof Date ? r.createdAt.toISOString() : r.createdAt,
      })),
    );
  } catch (err) {
    console.error("GET /my-evaluations error:", err);
    res
      .status(500)
      .json({ success: false, message: "Failed to fetch evaluations" });
  }
});

// Profile submits multi-item responses to an evaluation
router.post(
  "/my-evaluations/:id/respond",
  validate({ params: IdParams }),
  validate({ body: EvaluationRespondBody }),
  async (req, res): Promise<void> => {
    try {
      const sess = portalSession(req)!;
      if (!sess) {
        res.status(401).json({ success: false, message: "Not authenticated" });
        return;
      }
      const evaluationId = Number(req.params.id);
      const rawRating =
        req.body?.profileRating !== undefined
          ? req.body.profileRating
          : req.body?.employeeRating;
      const rawResponse =
        req.body?.profileResponse !== undefined
          ? req.body.profileResponse
          : req.body?.employeeResponse;
      const itemResponses =
        (req.body?.itemResponses as Array<{
          itemId: number;
          ratingValue?: number;
          textValue?: string;
        }>) || [];

      if (!evaluationId) {
        res
          .status(400)
          .json({ success: false, message: "Evaluation ID required" });
        return;
      }

      const [template] = await withTenant(sess.propertyId, async (tenantDb) => {
        return await tenantDb
          .select()
          .from(evaluationsTable)
          .where(
            and(
              eq(evaluationsTable.id, evaluationId),
              isNull(evaluationsTable.surveyTemplateId),
            ),
          );
      });

      if (!template) {
        res
          .status(404)
          .json({ success: false, message: "Evaluation not found" });
        return;
      }

      // Save multi-item responses if provided
      if (itemResponses && itemResponses.length > 0) {
        await withTenant(sess.propertyId, async (tenantDb) => {
          // Delete existing responses for this profile+template
          await tenantDb
            .delete(surveyItemResponsesTable)
            .where(
              and(
                eq(surveyItemResponsesTable.templateId, evaluationId),
                eq(surveyItemResponsesTable.profileId, sess.profileDbId),
              ),
            );

          // Insert new responses
          const values = itemResponses.map((ir) => ({
            templateId: evaluationId,
            profileId: sess.profileDbId,
            itemId: ir.itemId,
            ratingValue: ir.ratingValue ?? null,
            textValue: ir.textValue ?? null,
          }));
          await tenantDb.insert(surveyItemResponsesTable).values(values);
        });
      }

      // Save rating/response (support both profileRating and employeeRating)
      const updateData: Record<string, unknown> = {};
      if (rawRating !== undefined && rawRating !== null && rawRating !== "") {
        const r = Number(rawRating);
        if (!isNaN(r) && r >= 1 && r <= 5) {
          updateData.profileRating = r;
        }
      }
      if (
        rawResponse &&
        typeof rawResponse === "string" &&
        rawResponse.trim()
      ) {
        updateData.profileResponse = rawResponse.trim();
      }

      if (
        Object.keys(updateData).length > 0 ||
        (itemResponses && itemResponses.length > 0)
      ) {
        await withTenant(sess.propertyId, async (tenantDb) => {
          const [existing] = await tenantDb
            .select()
            .from(evaluationsTable)
            .where(
              and(
                eq(evaluationsTable.surveyTemplateId, evaluationId),
                eq(evaluationsTable.profileId, sess.profileDbId),
              ),
            );

          if (existing) {
            await tenantDb
              .update(evaluationsTable)
              .set({
                ...updateData,
                status: "completed",
                submittedAt: new Date(),
              })
              .where(eq(evaluationsTable.id, existing.id));
          } else {
            await tenantDb.insert(evaluationsTable).values({
              surveyTemplateId: evaluationId,
              profileId: sess.profileDbId,
              category: template.category,
              titleAr: template.titleAr,
              titleEn: template.titleEn,
              descriptionAr: template.descriptionAr,
              descriptionEn: template.descriptionEn,
              department: template.department,
              expiresAt: template.expiresAt,
              status: "completed",
              submittedAt: new Date(),
              ...updateData,
            } as any);
          }
        });
      }

      await logActivity({
        req,
        propertyId: sess.propertyId,
        username: sess.fullName,
        userRole: "profile",
        action: `تقييم موظف: ${template.titleAr || template.titleEn || template.category}`,
        actionType: "UPDATE",
        module: "evaluations",
        entityType: "evaluation",
        entityId: evaluationId,
      });

      res.json({ success: true, message: "Evaluation response saved" });
    } catch (err) {
      console.error("POST /my-evaluations/:id/respond error:", err);
      res.status(500).json({
        success: false,
        message: "Failed to submit evaluation response",
      });
    }
  },
);

// ─── GET /api/portal-data/housing-rating-status (Check cooldown & load config) ─
router.get("/housing-rating-status", async (req, res): Promise<void> => {
  const sess = portalSession(req);
  if (!sess) {
    res.status(401).json({ success: false, message: "Not authenticated" });
    return;
  }

  try {
    const profileId = sess.profileDbId;
    const propertyId = sess.propertyId;

    // Load property pulse configuration
    let [config] = await db
      .select()
      .from(propertyHousingPulseConfigTable)
      .where(eq(propertyHousingPulseConfigTable.propertyId, propertyId))
      .limit(1);

    if (!config) {
      config = {
        id: 0,
        propertyId,
        enabled: true,
        ratingType: "faces",
        allowComment: true,
        commentRequired: false,
        cooldownDays: 7,
        titleAr: "استطلاع جودة السكن الأسبوعي",
        titleEn: "Weekly Housing Quality Pulse",
        questionAr: "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟",
        questionEn:
          "How satisfied are you with housing conditions, cleanliness & services this week?",
        forcePromptAfter: null,
        lastPushedAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
    }

    const configData = {
      ratingType: config.ratingType || "faces",
      allowComment: config.allowComment ?? true,
      commentRequired: config.commentRequired ?? false,
      titleAr: config.titleAr,
      titleEn: config.titleEn,
      questionAr: config.questionAr,
      questionEn: config.questionEn,
    };

    if (!config.enabled) {
      res.json({
        success: true,
        eligible: false,
        disabled: true,
        config: configData,
      });
      return;
    }

    const cooldownDays = config.cooldownDays || 7;

    const [latestRating] = await db
      .select({
        id: propertyHousingRatingsTable.id,
        createdAt: propertyHousingRatingsTable.createdAt,
      })
      .from(propertyHousingRatingsTable)
      .where(eq(propertyHousingRatingsTable.profileId, profileId))
      .orderBy(desc(propertyHousingRatingsTable.createdAt))
      .limit(1);

    if (!latestRating) {
      res.json({
        success: true,
        eligible: true,
        lastRatedAt: null,
        config: configData,
      });
      return;
    }

    const lastDate = new Date(latestRating.createdAt);
    const now = new Date();

    // Check if admin pushed a fresh pulse after user's last rating!
    if (
      config.forcePromptAfter &&
      new Date(config.forcePromptAfter) > lastDate
    ) {
      res.json({
        success: true,
        eligible: true,
        forced: true,
        lastRatedAt: lastDate.toISOString(),
        config: configData,
      });
      return;
    }

    const diffMs = now.getTime() - lastDate.getTime();
    const diffDays = diffMs / (1000 * 60 * 60 * 24);

    if (diffDays >= cooldownDays) {
      res.json({
        success: true,
        eligible: true,
        lastRatedAt: lastDate.toISOString(),
        daysSinceLastRating: Math.floor(diffDays),
        config: configData,
      });
    } else {
      const nextEligibleDate = new Date(
        lastDate.getTime() + cooldownDays * 86400000,
      );
      const daysRemaining = Math.max(1, Math.ceil(cooldownDays - diffDays));
      res.json({
        success: true,
        eligible: false,
        lastRatedAt: lastDate.toISOString(),
        nextEligibleDate: nextEligibleDate.toISOString(),
        daysRemaining,
        config: configData,
      });
    }
  } catch (err: any) {
    console.error("Failed to check housing rating status:", err);
    res.status(500).json({ success: false, message: "Failed to check status" });
  }
});

// ─── POST /api/portal-data/housing-rating (Submit anonymous pulse rating) ────
router.post(
  "/housing-rating",
  validate({ body: HousingRatingBody }),
  async (req, res): Promise<void> => {
    const sess = portalSession(req);
    if (!sess) {
      res.status(401).json({ success: false, message: "Not authenticated" });
      return;
    }

    const {
      rating,
      score: rawScore,
      comment,
    } = req.body as {
      rating?: string;
      score?: number;
      comment?: string;
    };

    let normalizedRating = String(rating || "")
      .trim()
      .toLowerCase();
    let score: number = 3;

    if (rawScore != null && !isNaN(Number(rawScore))) {
      const num = Math.max(1, Math.min(5, Math.round(Number(rawScore))));
      score = num;
      if (
        !normalizedRating ||
        !["satisfied", "neutral", "dissatisfied"].includes(normalizedRating)
      ) {
        normalizedRating =
          num >= 4 ? "satisfied" : num === 3 ? "neutral" : "dissatisfied";
      }
    } else if (normalizedRating) {
      const scoreMap: Record<string, number> = {
        satisfied: 5,
        neutral: 3,
        dissatisfied: 1,
      };
      score = scoreMap[normalizedRating] ?? 3;
    } else {
      res.status(400).json({
        success: false,
        message:
          "يرجى تحديد التقييم (راضي أو متوسط أو غير راضي) أو اختيار عدد النجوم من 1 إلى 5",
      });
      return;
    }

    try {
      const profileId = sess.profileDbId;
      const propertyId = sess.propertyId;

      // Load property pulse configuration
      const [config] = await db
        .select()
        .from(propertyHousingPulseConfigTable)
        .where(eq(propertyHousingPulseConfigTable.propertyId, propertyId))
        .limit(1);

      const cooldownDays = config?.cooldownDays || 7;

      // Server-side enforcement of the required-comment policy
      // (client also blocks, but the API must not trust it).
      if (config?.commentRequired && !String(comment || "").trim()) {
        res.status(400).json({
          success: false,
          message: "التعليق مطلوب مع هذا التقييم",
        });
        return;
      }

      // Check cooldown
      const [latestRating] = await db
        .select({
          id: propertyHousingRatingsTable.id,
          createdAt: propertyHousingRatingsTable.createdAt,
        })
        .from(propertyHousingRatingsTable)
        .where(eq(propertyHousingRatingsTable.profileId, profileId))
        .orderBy(desc(propertyHousingRatingsTable.createdAt))
        .limit(1);

      if (latestRating) {
        const lastDate = new Date(latestRating.createdAt);
        const isForced =
          config?.forcePromptAfter &&
          new Date(config.forcePromptAfter) > lastDate;
        if (!isForced) {
          const diffDays =
            (Date.now() - lastDate.getTime()) / (1000 * 60 * 60 * 24);
          if (diffDays < cooldownDays) {
            const daysRemaining = Math.max(
              1,
              Math.ceil(cooldownDays - diffDays),
            );
            res.status(429).json({
              success: false,
              message: `يمكنك إرسال التقييم مرة واحدة كل ${cooldownDays} أيام. متبقي ${daysRemaining} يوم/أيام.`,
              daysRemaining,
            });
            return;
          }
        }
      }

      // Insert new anonymous rating record
      await db.insert(propertyHousingRatingsTable).values({
        propertyId,
        profileId,
        rating: normalizedRating,
        score,
        comment: comment ? String(comment).trim().slice(0, 1000) : null,
        category: "general",
      });

      res.json({
        success: true,
        message:
          "تم تسجيل تقييمك بنجاح وبسرية تامة! شكراً لمشاركتك في تحسين جودة السكن.",
      });
    } catch (err: any) {
      console.error("Failed to submit housing rating:", err);
      res.status(500).json({ success: false, message: "فشل إرسال التقييم" });
    }
  },
);

export default router;
