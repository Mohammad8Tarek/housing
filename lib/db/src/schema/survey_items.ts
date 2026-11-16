import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  real,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { evaluationsTable } from "./evaluations";

export const surveyItemsTable = pgTable(
  "survey_items",
  {
    id: serial("id").primaryKey(),
    templateId: integer("template_id")
      .notNull()
      .references(() => evaluationsTable.id, { onDelete: "cascade" }),
    titleAr: text("title_ar").notNull(),
    titleEn: text("title_en").notNull(),
    type: text("type").notNull().default("rating"), // rating | text | yes_no
    required: boolean("required").notNull().default(true),
    // Dimension / section the question belongs to (e.g. Engagement, Management).
    sectionAr: text("section_ar"),
    sectionEn: text("section_en"),
    // Offer a "Not applicable" choice on a rating question.
    allowNa: boolean("allow_na").notNull().default(false),
    orderIndex: integer("order_index").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [index("idx_survey_items_template_id").on(table.templateId)],
);

export const surveyItemResponsesTable = pgTable("survey_item_responses", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => evaluationsTable.id, { onDelete: "cascade" }),
  // Nullable: a public/anonymous respondent has no portal profile.
  profileId: integer("profile_id"),
  itemId: integer("item_id")
    .notNull()
    .references(() => surveyItemsTable.id, { onDelete: "cascade" }),
  ratingValue: real("rating_value"),
  textValue: text("text_value"),
  // 'portal' (logged-in resident) or 'public' (anonymous link/QR).
  source: text("source").notNull().default("portal"),
  // Department the respondent selected (for per-department reporting).
  department: text("department"),
  // Groups one anonymous submission's answers together; also used for dedup.
  respondentKey: text("respondent_key"),
  // Respondent chose "Not applicable" for this rating item.
  na: boolean("na").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertSurveyItemSchema = createInsertSchema(surveyItemsTable).omit(
  { id: true, createdAt: true },
);
export const insertSurveyItemResponseSchema = createInsertSchema(
  surveyItemResponsesTable,
).omit({ id: true, createdAt: true });
export type InsertSurveyItem = z.infer<typeof insertSurveyItemSchema>;
export type SurveyItem = typeof surveyItemsTable.$inferSelect;
export type InsertSurveyItemResponse = z.infer<
  typeof insertSurveyItemResponseSchema
>;
export type SurveyItemResponse = typeof surveyItemResponsesTable.$inferSelect;
