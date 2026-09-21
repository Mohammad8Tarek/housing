import { pgTable, text, serial, timestamp, boolean, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const propertiesTable = pgTable("properties", {
  id: serial("id").primaryKey(),
  name: text("name").notNull(),
  schemaName: text("schema_name"),
  code: text("code").notNull().unique(),
  displayName: text("display_name"),
  logo: text("logo"),
  primaryColor: text("primary_color").notNull().default("#0F2A44"),
  defaultLanguage: text("default_language").notNull().default("en"),
  status: text("status").notNull().default("active"),
  // HR & Housing Management Contacts
  hrContact1Name: text("hr_contact_1_name"),
  hrContact1Title: text("hr_contact_1_title"),
  hrContact1Phone: text("hr_contact_1_phone"),
  hrContact1Email: text("hr_contact_1_email"),
  hrContact2Name: text("hr_contact_2_name"),
  hrContact2Title: text("hr_contact_2_title"),
  hrContact2Phone: text("hr_contact_2_phone"),
  hrContact2Email: text("hr_contact_2_email"),
  housingManager1Name: text("housing_manager_1_name"),
  housingManager1Title: text("housing_manager_1_title"),
  housingManager1Phone: text("housing_manager_1_phone"),
  housingManager1Email: text("housing_manager_1_email"),
  housingManager2Name: text("housing_manager_2_name"),
  housingManager2Title: text("housing_manager_2_title"),
  housingManager2Phone: text("housing_manager_2_phone"),
  housingManager2Email: text("housing_manager_2_email"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_properties_status").on(table.status),
]);

export const insertPropertySchema = createInsertSchema(propertiesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProperty = z.infer<typeof insertPropertySchema>;
export type Property = typeof propertiesTable.$inferSelect;
