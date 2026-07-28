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

export const lookupValuesTable = pgTable("lookup_values", {
  id: serial("id").primaryKey(),
  category: text("category").notNull(),
  value: text("value").notNull(),
  parentValue: text("parent_value"),
  sortOrder: integer("sort_order").notNull().default(0),
  disabled: boolean("disabled").notNull().default(false),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertLookupValueSchema = createInsertSchema(
  lookupValuesTable,
).omit({ id: true, createdAt: true });
export type InsertLookupValue = z.infer<typeof insertLookupValueSchema>;
export type LookupValue = typeof lookupValuesTable.$inferSelect;
