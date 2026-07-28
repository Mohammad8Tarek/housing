import {
  pgTable,
  text,
  serial,
  integer,
  boolean,
  timestamp,
  real,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { evaluationsTable } from "./evaluations";

export const surveyItemsTable = pgTable("survey_items", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => evaluationsTable.id, { onDelete: "cascade" }),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en").notNull(),
  type: text("type").notNull().default("rating"), // rating | text | yes_no
  required: boolean("required").notNull().default(true),
  orderIndex: integer("order_index").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const surveyItemResponsesTable = pgTable("survey_item_responses", {
  id: serial("id").primaryKey(),
  templateId: integer("template_id")
    .notNull()
    .references(() => evaluationsTable.id, { onDelete: "cascade" }),
  employeeId: integer("employee_id").notNull(),
  itemId: integer("item_id")
    .notNull()
    .references(() => surveyItemsTable.id, { onDelete: "cascade" }),
  ratingValue: real("rating_value"),
  textValue: text("text_value"),
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
