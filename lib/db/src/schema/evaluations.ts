import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  real,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const evaluationsTable = pgTable("evaluations", {
  id: serial("id").primaryKey(),
  employeeId: integer("employee_id"),
  employeeResponse: text("employee_response"),
  employeeRating: real("employee_rating"),
  category: text("category").notNull().default("general"),
  titleAr: text("title_ar"),
  titleEn: text("title_en"),
  descriptionAr: text("description_ar"),
  descriptionEn: text("description_en"),
  department: text("department"),
  /** null = admin survey template; set = employee response linked to template id */
  surveyTemplateId: integer("survey_template_id"),
  status: text("status").notNull().default("pending"),
  submittedAt: timestamp("submitted_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
  expiresAt: timestamp("expires_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_evaluations_employee_id").on(table.employeeId),
  index("idx_evaluations_status").on(table.status),
  index("idx_evaluations_category").on(table.category),
]);

export const insertEvaluationSchema = createInsertSchema(evaluationsTable).omit(
  { id: true, createdAt: true, submittedAt: true },
);
export type InsertEvaluation = z.infer<typeof insertEvaluationSchema>;
export type Evaluation = typeof evaluationsTable.$inferSelect;
