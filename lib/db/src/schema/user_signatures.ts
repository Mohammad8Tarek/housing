import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { usersTable } from "./users";

export const userSignaturesTable = pgTable("user_signatures", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id).unique(),
  signatureImageUrl: text("signature_image_url").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow().$onUpdate(() => new Date()),
});

export const insertUserSignatureSchema = createInsertSchema(userSignaturesTable).omit({
  id: true,
  uploadedAt: true,
  updatedAt: true,
});

export type InsertUserSignature = typeof userSignaturesTable.$inferInsert;
export type UserSignature = typeof userSignaturesTable.$inferSelect;