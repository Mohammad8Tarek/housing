import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const profilesTable = pgTable("profiles", {
  id: serial("id").primaryKey(),
  profileId: text("profile_id").notNull(),
  firstName: text("first_name").notNull(),
  lastName: text("last_name").notNull(),
  thirdName: text("third_name").notNull().default(""),
  fourthName: text("fourth_name").notNull().default(""),
  nationalId: text("national_id").notNull(),
  nationality: text("nationality").notNull().default(""),
  address: text("address").notNull().default(""),
  jobTitle: text("job_title").notNull().default(""),
  level: text("level").notNull().default(""),
  phone: text("phone").notNull().default(""),
  department: text("department").notNull().default(""),
  status: text("status").notNull().default("active"),
  hireDate: text("hire_date").notNull(),
  gender: text("gender").notNull().default("male"),
  employmentType: text("employment_type").notNull().default("INTERNAL"),
  companyName: text("company_name").default(""),
  idImage: text("id_image"),
  photoUrl: text("photo_url"),
  email: text("email").notNull().default(""),
  emergencyContact: text("emergency_contact").notNull().default(""),
  dateOfBirth: text("date_of_birth").notNull().default(""),
  vacationStartDate: text("vacation_start_date"),
  vacationEndDate: text("vacation_end_date"),
  vacationNotes: text("vacation_notes").default(""),
  contractEndDate: text("contract_end_date"),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_profiles_profile_id").on(table.profileId),
  index("idx_profiles_national_id").on(table.nationalId),
  index("idx_profiles_department").on(table.department),
  index("idx_profiles_status").on(table.status),
  index("idx_profiles_phone").on(table.phone),
]);

export const insertProfileSchema = createInsertSchema(profilesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertProfile = z.infer<typeof insertProfileSchema>;
export type Profile = typeof profilesTable.$inferSelect;


export const profileDocumentsTable = pgTable("profile_documents", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  fileName: text("file_name").notNull(),
  fileType: text("file_type").notNull(),
  fileData: text("file_data").notNull(),
  uploadedAt: timestamp("uploaded_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_profile_documents_profile_id").on(table.profileId),
]);

export const profileVacationsTable = pgTable("profile_vacations", {
  id: serial("id").primaryKey(),
  profileId: integer("profile_id").notNull().references(() => profilesTable.id, { onDelete: "cascade" }),
  startDate: text("start_date").notNull(),
  endDate: text("end_date").notNull(),
  actualReturnDate: text("actual_return_date"),
  notes: text("notes").default(""),
  status: text("status").notNull().default("ACTIVE"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (table) => [
  index("idx_profile_vacations_profile_id").on(table.profileId),
]);

