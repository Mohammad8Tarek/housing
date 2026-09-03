import {
  pgTable,
  text,
  serial,
  integer,
  timestamp,
  boolean,
  index,
} from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const lookupValuesTable = pgTable("lookup_values", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  value: text("value").notNull(),
  parentValue: text("parent_value"),
  extraValue: text("extra_value"),
  sortOrder: integer("sort_order").notNull().default(0),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_lookup_values_category").on(table.category),
  index("idx_lookup_values_category_disabled").on(table.category, table.disabled),
]);

export const insertLookupValueSchema = createInsertSchema(
  lookupValuesTable,
).omit({ id: true, createdAt: true });
export type InsertLookupValue = z.infer<typeof insertLookupValueSchema>;
export type LookupValue = typeof lookupValuesTable.$inferSelect;
