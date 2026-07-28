import { pgTable, text, serial, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const portalContactsTable = pgTable("portal_contacts", {
  id: serial("id").primaryKey(),
  propertyId: integer("property_id"),
  nameAr: text("name_ar").notNull(),
  nameEn: text("name_en").notNull(),
  roleAr: text("role_ar"),
  roleEn: text("role_en"),
  email: text("email"),
  phone: text("phone"),
  extension: text("extension"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});

export const insertPortalContactSchema = createInsertSchema(
  portalContactsTable,
).omit({ id: true, createdAt: true });
export type InsertPortalContact = z.infer<typeof insertPortalContactSchema>;
export type PortalContact = typeof portalContactsTable.$inferSelect;
