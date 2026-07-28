import { pgTable, text, serial, timestamp } from "drizzle-orm/pg-core";

export const portalDocumentsTable = pgTable("portal_documents", {
  id: serial("id").primaryKey(),
  titleAr: text("title_ar").notNull(),
  titleEn: text("title_en"),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileData: text("file_data").notNull(),
  category: text("category").notNull().default("policy"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
});
