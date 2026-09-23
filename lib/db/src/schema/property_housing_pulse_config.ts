import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

export const propertyHousingPulseConfigTable = pgTable(
  "property_housing_pulse_config",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => propertiesTable.id, { onDelete: "cascade" }),
    enabled: boolean("enabled").notNull().default(true),
    ratingType: text("rating_type").notNull().default("faces"), // 'faces' | 'stars'
    allowComment: boolean("allow_comment").notNull().default(true),
    commentRequired: boolean("comment_required").notNull().default(false),
    cooldownDays: integer("cooldown_days").notNull().default(7),
    titleAr: text("title_ar").notNull().default("استطلاع جودة السكن الأسبوعي"),
    titleEn: text("title_en").notNull().default("Weekly Housing Quality Pulse"),
    questionAr: text("question_ar").notNull().default("ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟"),
    questionEn: text("question_en").notNull().default("How satisfied are you with housing conditions, cleanliness & services this week?"),
    forcePromptAfter: timestamp("force_prompt_after", { withTimezone: true }),
    lastPushedAt: timestamp("last_pushed_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  }
);

export const insertPropertyHousingPulseConfigSchema = createInsertSchema(
  propertyHousingPulseConfigTable
).omit({ id: true, createdAt: true, updatedAt: true });

export type InsertPropertyHousingPulseConfig = z.infer<
  typeof insertPropertyHousingPulseConfigSchema
>;
export type PropertyHousingPulseConfig =
  typeof propertyHousingPulseConfigTable.$inferSelect;
