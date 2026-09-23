import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { propertiesTable } from "./properties";

/**
 * Property Housing Ratings (تقييمات جودة السكن الأسبوعية)
 * Automated recurring 7-day employee satisfaction pulse.
 * 
 * Strict Anonymity Rule:
 * `profileId` is stored ONLY for throttling / 7-day cooldown enforcement.
 * Management reports and APIs strictly omit profileId, employee names, and identifiable details.
 */
export const propertyHousingRatingsTable = pgTable(
  "property_housing_ratings",
  {
    id: serial("id").primaryKey(),
    propertyId: integer("property_id")
      .notNull()
      .references(() => propertiesTable.id, { onDelete: "cascade" }),
    profileId: integer("profile_id").notNull(),
    rating: text("rating").notNull(), // 'satisfied' | 'neutral' | 'dissatisfied'
    score: integer("score").notNull(), // 5 for satisfied, 3 for neutral, 1 for dissatisfied
    comment: text("comment"),
    category: text("category").notNull().default("general"),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (table) => [
    index("idx_prop_housing_ratings_cooldown").on(table.profileId, table.createdAt),
    index("idx_prop_housing_ratings_prop").on(table.propertyId, table.createdAt),
  ]
);

export const insertPropertyHousingRatingSchema = createInsertSchema(
  propertyHousingRatingsTable
).omit({ id: true, createdAt: true });

export type InsertPropertyHousingRating = z.infer<
  typeof insertPropertyHousingRatingSchema
>;
export type PropertyHousingRating =
  typeof propertyHousingRatingsTable.$inferSelect;
