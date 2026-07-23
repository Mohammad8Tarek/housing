/**
 * portal-feedback.ts — Full DB-backed implementation
 * Tables: portal_feedback, portal_comments, portal_comment_likes
 */
import { Router } from "express";
import {
  withTenant,
  portalFeedbackTable,
  portalCommentsTable,
  portalCommentLikesTable,
  employeesTable,
} from "@workspace/db";
import { eq, and, desc, sql, isNull, isNotNull, inArray } from "drizzle-orm";
import { z } from "zod";
import { requirePortalAuth, portalSession } from "./portal-auth.js";
import { broadcastToProperty } from "../lib/websocket.js";
import { stripHtml, sanitizeFields } from "../lib/sanitize.js";

const router: Router = Router();

// All portal-feedback routes require portal auth
router.use(requirePortalAuth);

const CommentSchema = z.object({
  contentType: z.enum([
    "activity",
    "evaluation",
    "document",
    "accommodation",
    "services",
  ]),
  contentId: z.number().int().nonnegative(),
  text: z.string().min(1).max(1000),
  parentCommentId: z.number().int().optional(),
});

const FeedbackSchema = z.object({
  contentType: z.enum([
    "activity",
    "evaluation",
    "document",
    "accommodation",
    "services",
  ]),
  contentId: z.number().int().nonnegative(),
  rating: z.number().min(1).max(5).optional(),
  comment: z.string().max(2000).optional(),
  helpful: z
    .union([z.enum(["yes", "no"]), z.boolean()])
    .optional()
    .transform((v) => (typeof v === "boolean" ? (v ? "yes" : "no") : v)),
});

// ─── GET /:contentType/:contentId — جلب كل التعليقات والتقييم لمحتوى ─────
// @ts-ignore
router.get("/:contentType/:contentId", async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const { contentType, contentId } = req.params;
    const cid = Number(contentId);

    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      // Get feedback/rating summary
      const feedbackRows = await tenantDb
        .select()
        .from(portalFeedbackTable)
        .where(
          and(
            eq(portalFeedbackTable.contentType, contentType),
            eq(portalFeedbackTable.contentId, cid),
          ),
        );

      const ratedRows = feedbackRows.filter((f) => f.rating != null);
      const avgRating =
        ratedRows.length > 0
          ? ratedRows.reduce((s, f) => s + (f.rating || 0), 0) /
            ratedRows.length
          : 0;

      const myFeedback =
        feedbackRows.find((f) => f.employeeId === sess.employeeDbId) || null;

      // Get top-level comments with author names
      const comments = await tenantDb
        .select({
          id: portalCommentsTable.id,
          text: portalCommentsTable.text,
          employeeId: portalCommentsTable.employeeId,
          parentCommentId: portalCommentsTable.parentCommentId,
          likesCount: portalCommentsTable.likesCount,
          createdAt: portalCommentsTable.createdAt,
          firstName: employeesTable.firstName,
          lastName: employeesTable.lastName,
        })
        .from(portalCommentsTable)
        .leftJoin(
          employeesTable,
          eq(portalCommentsTable.employeeId, employeesTable.id),
        )
        .where(
          and(
            eq(portalCommentsTable.contentType, contentType),
            eq(portalCommentsTable.contentId, cid),
            isNull(portalCommentsTable.parentCommentId),
          ),
        )
        .orderBy(desc(portalCommentsTable.createdAt))
        .limit(100);

      // Get replies
      const replies = await tenantDb
        .select({
          id: portalCommentsTable.id,
          text: portalCommentsTable.text,
          employeeId: portalCommentsTable.employeeId,
          parentCommentId: portalCommentsTable.parentCommentId,
          likesCount: portalCommentsTable.likesCount,
          createdAt: portalCommentsTable.createdAt,
          firstName: employeesTable.firstName,
          lastName: employeesTable.lastName,
        })
        .from(portalCommentsTable)
        .leftJoin(
          employeesTable,
          eq(portalCommentsTable.employeeId, employeesTable.id),
        )
        .where(
          and(
            eq(portalCommentsTable.contentType, contentType),
            eq(portalCommentsTable.contentId, cid),
            isNotNull(portalCommentsTable.parentCommentId),
          ),
        )
        .orderBy(desc(portalCommentsTable.createdAt));

      // Get my liked comment IDs
      const myLikes = await tenantDb
        .select({ commentId: portalCommentLikesTable.commentId })
        .from(portalCommentLikesTable)
        .where(eq(portalCommentLikesTable.employeeId, sess.employeeDbId));
      const myLikedSet = new Set(myLikes.map((l) => l.commentId));

      // Build comment tree
      const commentMap: Record<number, any> = {};
      comments.forEach((c) => {
        commentMap[c.id] = {
          ...c,
          authorName: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
          isOwn: c.employeeId === sess.employeeDbId,
          isLiked: myLikedSet.has(c.id),
          replies: [],
        };
      });

      replies.forEach((r) => {
        if (r.parentCommentId && commentMap[r.parentCommentId]) {
          commentMap[r.parentCommentId].replies.push({
            ...r,
            authorName: `${r.firstName || ""} ${r.lastName || ""}`.trim(),
            isOwn: r.employeeId === sess.employeeDbId,
            isLiked: myLikedSet.has(r.id),
          });
        }
      });

      return {
        totalFeedback: feedbackRows.length,
        avgRating: Math.round(avgRating * 10) / 10,
        helpfulCount: feedbackRows.filter((f) => f.helpful === "yes").length,
        myFeedback,
        comments: Object.values(commentMap),
      };
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── POST /feedback — إضافة/تحديث تقييم ─────────────────────────────────
// @ts-ignore
router.post("/feedback", async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const validated = FeedbackSchema.parse(req.body);

    const feedback = await withTenant(sess.propertyId, async (tenantDb) => {
      // Upsert feedback (one per employee per content)
      const existing = await tenantDb
        .select()
        .from(portalFeedbackTable)
        .where(
          and(
            eq(portalFeedbackTable.contentType, validated.contentType),
            eq(portalFeedbackTable.contentId, validated.contentId),
            eq(portalFeedbackTable.employeeId, sess.employeeDbId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        const [updated] = await tenantDb
          .update(portalFeedbackTable)
          .set({
            rating: validated.rating ?? existing[0].rating,
            comment: validated.comment
              ? stripHtml(validated.comment)
              : existing[0].comment,
            helpful: validated.helpful ?? existing[0].helpful,
            updatedAt: new Date(),
          })
          .where(eq(portalFeedbackTable.id, existing[0].id))
          .returning();
        return updated;
      } else {
        const [created] = await tenantDb
          .insert(portalFeedbackTable)
          .values({
            contentType: validated.contentType,
            contentId: validated.contentId,
            employeeId: sess.employeeDbId,
            rating: validated.rating ?? null,
            comment: validated.comment ? stripHtml(validated.comment) : null,
            helpful: validated.helpful ?? null,
          })
          .returning();
        return created;
      }
    });

    broadcastToProperty(sess.propertyId, {
      module: "notifications",
      action: "created",
      data: {
        event: "feedback_submitted",
        contentType: validated.contentType,
        contentId: validated.contentId,
      },
    });

    res.json({ success: true, feedback });
  } catch (err) {
    next(err);
  }
});

// ─── POST /comments — إضافة تعليق ────────────────────────────────────────
// @ts-ignore
router.post("/comments", async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const validated = CommentSchema.parse(req.body);

    const comment = await withTenant(sess.propertyId, async (tenantDb) => {
      const [created] = await tenantDb
        .insert(portalCommentsTable)
        .values({
          contentType: validated.contentType,
          contentId: validated.contentId,
          employeeId: sess.employeeDbId,
          text: stripHtml(validated.text),
          parentCommentId: validated.parentCommentId ?? null,
        })
        .returning();

      // Get author name
      const [emp] = await tenantDb
        .select({
          firstName: employeesTable.firstName,
          lastName: employeesTable.lastName,
        })
        .from(employeesTable)
        .where(eq(employeesTable.id, sess.employeeDbId))
        .limit(1);

      return {
        ...created,
        authorName: emp
          ? `${emp.firstName} ${emp.lastName}`.trim()
          : sess.fullName,
        isOwn: true,
        isLiked: false,
        replies: [],
      };
    });

    broadcastToProperty(sess.propertyId, {
      module: "notifications",
      action: "created",
      data: { event: "comment_added", comment },
    });

    res.json({ success: true, comment });
  } catch (err) {
    next(err);
  }
});

// ─── DELETE /comments/:id — حذف تعليق ───────────────────────────────────
// @ts-ignore
router.delete("/comments/:id", async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const id = Number(req.params.id);

    await withTenant(sess.propertyId, async (tenantDb) => {
      // Only owner can delete
      const [comment] = await tenantDb
        .select()
        .from(portalCommentsTable)
        .where(
          and(
            eq(portalCommentsTable.id, id),
            eq(portalCommentsTable.employeeId, sess.employeeDbId),
          ),
        )
        .limit(1);

      if (!comment)
        throw Object.assign(new Error("Not found or not authorized"), {
          status: 403,
        });

      // Delete likes for child comments
      const childComments = await tenantDb
        .select({ id: portalCommentsTable.id })
        .from(portalCommentsTable)
        .where(eq(portalCommentsTable.parentCommentId, id));
      if (childComments.length > 0) {
        const childIds = childComments.map((c) => c.id);
        await tenantDb
          .delete(portalCommentLikesTable)
          .where(inArray(portalCommentLikesTable.commentId, childIds));
      }
      // Delete child comments
      await tenantDb
        .delete(portalCommentsTable)
        .where(eq(portalCommentsTable.parentCommentId, id));

      // Delete likes for parent comment
      await tenantDb
        .delete(portalCommentLikesTable)
        .where(eq(portalCommentLikesTable.commentId, id));
      // Delete parent comment
      await tenantDb
        .delete(portalCommentsTable)
        .where(eq(portalCommentsTable.id, id));
    });

    res.json({ success: true });
  } catch (err: any) {
    if (err.status === 403)
      return res.status(403).json({ success: false, message: err.message });
    next(err);
  }
});

// ─── POST /comments/:id/like — إعجاب/إلغاء إعجاب ────────────────────────
// @ts-ignore
router.post("/comments/:id/like", async (req, res, next) => {
  try {
    const sess = portalSession(req)!;
    const id = Number(req.params.id);

    const result = await withTenant(sess.propertyId, async (tenantDb) => {
      // Toggle like
      const existing = await tenantDb
        .select()
        .from(portalCommentLikesTable)
        .where(
          and(
            eq(portalCommentLikesTable.commentId, id),
            eq(portalCommentLikesTable.employeeId, sess.employeeDbId),
          ),
        )
        .limit(1);

      if (existing.length > 0) {
        // Unlike
        await tenantDb
          .delete(portalCommentLikesTable)
          .where(eq(portalCommentLikesTable.id, existing[0].id));
        await tenantDb.execute(sql`
          UPDATE portal_comments SET likes_count = GREATEST(likes_count - 1, 0) WHERE id = ${id}
        `);
        return { liked: false };
      } else {
        // Like
        await tenantDb.insert(portalCommentLikesTable).values({
          commentId: id,
          employeeId: sess.employeeDbId,
        });
        await tenantDb.execute(sql`
          UPDATE portal_comments SET likes_count = likes_count + 1 WHERE id = ${id}
        `);
        return { liked: true };
      }
    });

    res.json({ success: true, ...result });
  } catch (err) {
    next(err);
  }
});

// ─── GET /stats — إحصائيات (للأدمن) ─────────────────────────────────────
// @ts-ignore
router.get("/stats", async (req, res, next) => {
  try {
    const sess = portalSession(req)!;

    const stats = await withTenant(sess.propertyId, async (tenantDb) => {
      const allFeedback = await tenantDb.select().from(portalFeedbackTable);
      const allComments = await tenantDb.select().from(portalCommentsTable);
      const rated = allFeedback.filter((f) => f.rating != null);
      const avgRating =
        rated.length > 0
          ? rated.reduce((s, f) => s + (f.rating || 0), 0) / rated.length
          : 0;

      return {
        totalFeedback: allFeedback.length,
        totalComments: allComments.length,
        avgRating: Math.round(avgRating * 10) / 10,
        helpfulCount: allFeedback.filter((f) => f.helpful === "yes").length,
      };
    });

    res.json({ success: true, ...stats });
  } catch (err) {
    next(err);
  }
});

export default router;
