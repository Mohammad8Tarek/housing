import { pgTable, text, serial, integer, timestamp, index } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const employeesTable = pgTable("employees", {
  id: serial("id").primaryKey(),
  employeeId: text("employee_id").notNull(),
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
  idImage: text("id_image"),
  photoUrl: text("photo_url"),
  email: text("email").notNull().default(""),
  emergencyContact: text("emergency_contact").notNull().default(""),
  dateOfBirth: text("date_of_birth").notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true })
    .notNull()
    .defaultNow(),
}, (table) => [
  index("idx_employees_employee_id").on(table.employeeId),
  index("idx_employees_national_id").on(table.nationalId),
  index("idx_employees_department").on(table.department),
  index("idx_employees_status").on(table.status),
  index("idx_employees_phone").on(table.phone),
]);

export const insertEmployeeSchema = createInsertSchema(employeesTable).omit({
  id: true,
  createdAt: true,
});
export type InsertEmployee = z.infer<typeof insertEmployeeSchema>;
export type Employee = typeof employeesTable.$inferSelect;
