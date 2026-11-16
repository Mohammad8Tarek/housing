// Public, anonymous survey access via a shareable link / QR code.
//
// A survey template (evaluations row, survey_template_id IS NULL) can be made
// public with a random token. Anyone with the link/QR — no login — can open it
// while it is within its window (opens_at .. expires_at), pick a department,
// answer the questions and submit. Responses land in survey_item_responses with
// profile_id NULL and source='public', so the admin's existing reports read them.
import { Router } from "express";
import { randomBytes } from "node:crypto";
import {
  db,
  withTenant,
  propertiesTable,
  evaluationsTable,
  surveyItemsTable,
  surveyItemResponsesTable,
  profilesTable,
} from "@workspace/db";
import { eq, and, isNull, sql } from "drizzle-orm";
import { z } from "zod";

const router: Router = Router();

/** Find which property owns a public survey token (templates are per-tenant). */
async function resolveSurveyByToken(token: string): Promise<{
  propertyId: number;
  template: any;
} | null> {
  const properties = await db.select().from(propertiesTable);
  for (const p of properties) {
    try {
      const found = await withTenant(p.id, async (tenantDb) => {
        const [tpl] = await tenantDb
          .select()
          .from(evaluationsTable)
          .where(
            and(
              eq(evaluationsTable.publicToken, token),
              eq(evaluationsTable.isPublic, true),
              isNull(evaluationsTable.surveyTemplateId),
            ),
          )
          .limit(1);
        return tpl ?? null;
      });
      if (found) return { propertyId: p.id, template: found };
    } catch {
      /* table may not exist in a schema; keep searching */
    }
  }
  return null;
}

type WindowState = "open" | "not_started" | "closed";
function windowState(tpl: any, now = new Date()): WindowState {
  if (tpl.opensAt && new Date(tpl.opensAt).getTime() > now.getTime())
    return "not_started";
  if (tpl.expiresAt && new Date(tpl.expiresAt).getTime() < now.getTime())
    return "closed";
  return "open";
}

// ─── GET /api/public/surveys/:token ───────────────────────────────────────
router.get("/surveys/:token", async (req, res): Promise<void> => {
  const token = String(req.params.token || "").trim();
  if (!token) {
    res.status(400).json({ success: false, message: "Invalid link" });
    return;
  }
  const resolved = await resolveSurveyByToken(token);
  if (!resolved) {
    res.status(404).json({ success: false, message: "Survey not found" });
    return;
  }
  const { propertyId, template } = resolved;
  const state = windowState(template);

  const { items, departments } = await withTenant(
    propertyId,
    async (tenantDb) => {
      const items = await tenantDb
        .select()
        .from(surveyItemsTable)
        .where(eq(surveyItemsTable.templateId, template.id))
        .orderBy(surveyItemsTable.orderIndex, surveyItemsTable.id);
      const depRows = await tenantDb
        .select({ d: profilesTable.department })
        .from(profilesTable)
        .where(
          sql`${profilesTable.department} IS NOT NULL AND ${profilesTable.department} <> ''`,
        )
        .groupBy(profilesTable.department)
        .orderBy(profilesTable.department);
      return {
        items,
        departments: depRows.map((r) => r.d).filter(Boolean),
      };
    },
  );

  res.json({
    success: true,
    state,
    survey: {
      id: template.id,
      titleAr: template.titleAr,
      titleEn: template.titleEn,
      descriptionAr: template.descriptionAr,
      descriptionEn: template.descriptionEn,
      opensAt: template.opensAt,
      expiresAt: template.expiresAt,
      items: items.map((it: any) => ({
        id: it.id,
        titleAr: it.titleAr,
        titleEn: it.titleEn,
        type: it.type,
        required: it.required,
        allowNa: it.allowNa,
        sectionAr: it.sectionAr,
        sectionEn: it.sectionEn,
        orderIndex: it.orderIndex,
      })),
    },
    departments,
  });
});

const RespondBody = z.object({
  department: z.string().trim().max(200).optional(),
  respondentKey: z.string().trim().min(6).max(80),
  answers: z
    .array(
      z.object({
        itemId: z.coerce.number().int().positive(),
        rating: z.coerce.number().min(0).max(10).optional(),
        text: z.string().max(5000).optional(),
        na: z.boolean().optional(),
      }),
    )
    .min(1)
    .max(500),
});

// ─── POST /api/public/surveys/:token/respond ──────────────────────────────
router.post("/surveys/:token/respond", async (req, res): Promise<void> => {
  const token = String(req.params.token || "").trim();
  const parsed = RespondBody.safeParse(req.body);
  if (!parsed.success) {
    res
      .status(400)
      .json({ success: false, message: parsed.error.errors[0]?.message });
    return;
  }
  const resolved = await resolveSurveyByToken(token);
  if (!resolved) {
    res.status(404).json({ success: false, message: "Survey not found" });
    return;
  }
  const { propertyId, template } = resolved;
  if (windowState(template) !== "open") {
    res.status(410).json({
      success: false,
      message: "This survey is closed",
      code: "SURVEY_CLOSED",
    });
    return;
  }

  const { department, respondentKey, answers } = parsed.data;

  const result = await withTenant(propertyId, async (tenantDb) => {
    // One submission per respondent key.
    const [already] = await tenantDb
      .select({ id: surveyItemResponsesTable.id })
      .from(surveyItemResponsesTable)
      .where(
        and(
          eq(surveyItemResponsesTable.templateId, template.id),
          eq(surveyItemResponsesTable.respondentKey, respondentKey),
        ),
      )
      .limit(1);
    if (already) return { duplicate: true as const };

    // Only accept answers for items that belong to this template.
    const validItems = await tenantDb
      .select({ id: surveyItemsTable.id })
      .from(surveyItemsTable)
      .where(eq(surveyItemsTable.templateId, template.id));
    const validIds = new Set(validItems.map((i) => i.id));

    const rows = answers
      .filter((a) => validIds.has(a.itemId))
      .filter((a) => a.na || a.rating != null || (a.text && a.text.trim()))
      .map((a) => ({
        templateId: template.id,
        profileId: null,
        itemId: a.itemId,
        ratingValue: a.na ? null : a.rating != null ? a.rating : null,
        textValue: a.text?.trim() || null,
        source: "public",
        department: department || null,
        respondentKey,
        na: Boolean(a.na),
      }));

    if (rows.length === 0) return { empty: true as const };
    await tenantDb.insert(surveyItemResponsesTable).values(rows);
    return { inserted: rows.length };
  });

  if ("duplicate" in result) {
    res.status(409).json({
      success: false,
      message: "You have already submitted this survey",
      code: "ALREADY_SUBMITTED",
    });
    return;
  }
  if ("empty" in result) {
    res.status(400).json({ success: false, message: "No answers provided" });
    return;
  }
  res.json({ success: true, saved: result.inserted });
});

/** Generate a URL-safe public token. */
export function generateSurveyToken(): string {
  return randomBytes(18).toString("base64url");
}

export default router;
