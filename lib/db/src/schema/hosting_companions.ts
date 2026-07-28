import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { hostingsTable } from "./hostings";

export const hostingCompanionsTable = pgTable("hosting_companions", {
  id: serial("id").primaryKey(),
  hostingId: integer("hosting_id")
    .notNull()
    .references(() => hostingsTable.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  idNumber: text("id_number"),
  documentType: text("document_type"),
  documentImage: text("document_image"),
  documentFileName: text("document_file_name"),
  relation: text("relation"),
  isChild: integer("is_child").notNull().default(0),
  age: integer("age"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertHostingCompanionSchema = createInsertSchema(
  hostingCompanionsTable,
).omit({ id: true, createdAt: true });
export type InsertHostingCompanion = z.infer<
  typeof insertHostingCompanionSchema
>;
export type HostingCompanion = typeof hostingCompanionsTable.$inferSelect;
