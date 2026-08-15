import {
  pgTable,
  text,
  serial,
  integer,
  real,
  timestamp,
  index,
  uniqueIndex,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

// Feedback & Comments on Portal Content (activities, evaluations, documents)
export const portalFeedbackTable = pgTable("portal_feedback", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(), // activity | evaluation | document
  contentId: integer("content_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  rating: real("rating"), // 1-5 optional star rating
  comment: text("comment"),
  helpful: text("helpful"), // yes | no | null
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_portal_feedback_employee_id").on(table.employeeId),
  index("idx_portal_feedback_content").on(table.contentType, table.contentId),
]);

// Threaded comments on Portal Content
export const portalCommentsTable = pgTable("portal_comments", {
  id: serial("id").primaryKey(),
  contentType: text("content_type").notNull(), // activity | evaluation | document
  contentId: integer("content_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  text: text("text").notNull(),
  parentCommentId: integer("parent_comment_id"), // for replies
  likesCount: integer("likes_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_portal_comments_content").on(table.contentType, table.contentId),
  index("idx_portal_comments_employee_id").on(table.employeeId),
]);

// Comment likes
export const portalCommentLikesTable = pgTable("portal_comment_likes", {
  id: serial("id").primaryKey(),
  commentId: integer("comment_id").notNull(),
  employeeId: integer("employee_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  uniqueIndex("uq_portal_comment_likes_comment_employee").on(table.commentId, table.employeeId),
]);

export const insertPortalFeedbackSchema = createInsertSchema(
  portalFeedbackTable,
).omit({ id: true, createdAt: true, updatedAt: true });
export const insertPortalCommentSchema = createInsertSchema(
  portalCommentsTable,
).omit({ id: true, createdAt: true, likesCount: true });
export type InsertPortalFeedback = z.infer<typeof insertPortalFeedbackSchema>;
export type InsertPortalComment = z.infer<typeof insertPortalCommentSchema>;
export type PortalFeedback = typeof portalFeedbackTable.$inferSelect;
export type PortalComment = typeof portalCommentsTable.$inferSelect;
