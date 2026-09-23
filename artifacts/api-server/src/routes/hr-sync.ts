import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  profilesTable,
  profileDocumentsTable,
  profileVacationsTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
  propertiesTable,
  lookupValuesTable,
  profilePortalAccountsTable,
} from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { logActivity } from "../lib/activity-logger.js";
import { ensureProfilePortalAccount } from "../lib/portal-accounts.js";
import { requirePermission, requireAnyPermission } from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";
import {
  enrichProfileBilingual,
  translateDepartment,
  translateJobTitle,
  hasArabic,
} from "../lib/bilingual-translator.js";
import { broadcastToProperty } from "../lib/websocket.js";
import {
  getEsignConfig,
  getEsignConfigs,
  getEsignConfigById,
  testEsignConnection,
  fetchEmployeeByCode,
  fetchEmployeeFromAllSources,
  SunriseEsignConfig,
} from "../lib/sunrise-esign-service.js";

export interface HrSourceConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey?: string;
  targetPropertyIds?: number[];
  syncProfiles?: boolean;
  allowedLevels?: string[];
  allowedDepartments?: string[];
  housingEligibleOnly?: boolean;
  autoCheckoutOnDeparture?: boolean;
  autoVacationSync?: boolean;
  isActive?: boolean;
  lastSyncAt?: string | null;
}

const HrSourceConfigSchema = z.object({
  id: z.string(),
  name: z.string(),
  apiUrl: z.string(),
  apiKey: z.string().optional().nullable(),
  targetPropertyIds: z.array(z.number()).optional().default([]),
  syncProfiles: z.boolean().optional().default(true),
  allowedLevels: z.array(z.string()).optional().default([]),
  allowedDepartments: z.array(z.string()).optional().default([]),
  housingEligibleOnly: z.boolean().optional().default(false),
  autoCheckoutOnDeparture: z.boolean().optional().default(true),
  autoVacationSync: z.boolean().optional().default(true),
  isActive: z.boolean().optional().default(true),
  lastSyncAt: z.string().optional().nullable(),
});

const HrSyncConfigSchema = z.object({
  apiUrl: z.string().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  fieldMapping: z.record(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
  autoCheckoutOnDeparture: z.boolean().optional(),
  autoVacationSync: z.boolean().optional(),
  targetPropertyIds: z.array(z.number()).optional().default([]),
  sources: z.array(HrSourceConfigSchema).optional().default([]),
  esignConfig: z.record(z.any()).optional().nullable(),
});

const router: Router = Router();

// ============================================================================
// Helper: Status Normalization
// ============================================================================
export function normalizeHrStatus(
  rawStatus?: string | null,
): "ACTIVE" | "VACATION" | "DEPARTED" | "UNASSIGNED" {
  if (!rawStatus) return "ACTIVE";
  const s = String(rawStatus).trim().toLowerCase();

  // Vacation / Leave
  if (
    s === "vacation" ||
    s === "on_leave" ||
    s === "on-leave" ||
    s === "leave" ||
    s === "annual_leave" ||
    s === "sick_leave" ||
    s.includes("إجازة") ||
    s.includes("اجازة")
  ) {
    return "VACATION";
  }

  // Departed / Terminated / Left / Resigned / Clearance
  if (
    s === "departed" ||
    s === "terminated" ||
    s === "resigned" ||
    s === "inactive" ||
    s === "left" ||
    s === "fired" ||
    s === "ended" ||
    s.includes("تصفية") ||
    s.includes("مستقيل") ||
    s.includes("مفصول") ||
    s.includes("إنهاء") ||
    s.includes("انهاء") ||
    s.includes("استقالة")
  ) {
    return "DEPARTED";
  }

  if (s === "unassigned") return "UNASSIGNED";

  return "ACTIVE";
}

// ============================================================================
// Helper: Extract and map all profile fields
// ============================================================================
export function extractProfileFields(
  raw: any,
  mapping: Record<string, string> = {},
) {
  const getVal = (targetField: string, fallbacks: string[] = []): any => {
    if (
      mapping &&
      mapping[targetField] &&
      raw[mapping[targetField]] !== undefined
    ) {
      return raw[mapping[targetField]];
    }
    if (raw[targetField] !== undefined) return raw[targetField];
    for (const fb of fallbacks) {
      if (raw[fb] !== undefined) return raw[fb];
    }
    return undefined;
  };

  const rawProfileId = getVal("profileId", [
    "employeeId",
    "employee_id",
    "emp_id",
    "empCode",
    "employeeCode",
    "employee_code",
    "clockNumber",
    "clock_number",
    "code",
    "id",
    "كود_الموظف",
    "كود الموظف",
    "رقم_الملف",
  ]);
  const profileId = rawProfileId ? String(rawProfileId).trim() : "";

  const firstName = getVal("firstName", ["first_name", "first", "firstNameEn", "first_name_en"]) ?? "";
  const lastName = getVal("lastName", ["last_name", "last", "lastNameEn", "last_name_en"]) ?? "";
  const thirdName =
    getVal("thirdName", ["third_name", "father_name", "middle_name", "thirdNameEn"]) ?? "";
  const fourthName =
    getVal("fourthName", ["fourth_name", "family_name", "grand_father", "fourthNameEn"]) ?? "";

  const firstNameAr = getVal("firstNameAr", ["first_name_ar", "firstName_ar", "الاسم_الأول", "الاسم الاول", "الاسم"]) ?? "";
  const lastNameAr = getVal("lastNameAr", ["last_name_ar", "lastName_ar", "اسم_العائلة", "اسم العائلة", "اللقب"]) ?? "";
  const thirdNameAr = getVal("thirdNameAr", ["third_name_ar", "thirdName_ar", "اسم_الأب", "اسم الاب", "الاسم الثالث"]) ?? "";
  const fourthNameAr = getVal("fourthNameAr", ["fourth_name_ar", "fourthName_ar", "اسم_الجد", "اسم الجد", "الاسم الرابع"]) ?? "";

  const nationalId =
    getVal("nationalId", ["national_id", "iqama", "ssn", "nid", "الرقم_القومي", "الرقم القومي", "الهوية"]) ?? "";
  const nationality = getVal("nationality", ["country", "الجنسية"]) ?? "";
  const address = getVal("address", ["street", "residence", "العنوان"]) ?? "";

  const jobTitle =
    getVal("jobTitle", ["job_title", "position", "title", "role", "job_title_en", "jobTitleEn", "jobTitle_en", "position_en", "positionEn"]) ?? "";
  const jobTitleAr =
    getVal("jobTitleAr", [
      "job_title_ar",
      "jobTitle_ar",
      "jobTitleAr",
      "position_ar",
      "positionAr",
      "title_ar",
      "titleAr",
      "الوظيفة",
      "المسمى_الوظيفي",
      "المسمى الوظيفي",
      "الوظيفه",
      "المهنة",
    ]) ?? "";

  const level = getVal("level", ["grade", "job_level", "jobLevel", "الدرجة", "المستوى"]) ?? "";
  const phone =
    getVal("phone", ["mobile", "telephone", "phone_number", "phoneNumber", "الهاتف", "الجوال", "الموبايل"]) ??
    "";

  const department = getVal("department", ["dept", "section", "department_en", "departmentEn", "dept_en", "deptEn", "section_en"]) ?? "";
  const departmentAr = getVal("departmentAr", [
    "department_ar",
    "departmentAr",
    "dept_ar",
    "deptAr",
    "section_ar",
    "sectionAr",
    "القسم",
    "الإدارة",
    "الادارة",
    "القسم_بالعربية",
    "الاداره",
  ]) ?? "";

  const hireDate =
    getVal("hireDate", ["hire_date", "joining_date", "hired_at", "تاريخ_التعيين"]) ??
    new Date().toISOString().split("T")[0];
  const dateOfBirth =
    getVal("dateOfBirth", ["date_of_birth", "birth_date", "dob", "تاريخ_الميلاد"]) ?? "";
  const email = getVal("email", ["mail", "email_address"]) ?? "";
  const emergencyContact =
    getVal("emergencyContact", [
      "emergency_contact",
      "emergency_phone",
      "emergencyPhone",
    ]) ?? "";
  const contractEndDate =
    getVal("contractEndDate", [
      "contract_end_date",
      "contractEnd",
      "contract_expiry",
    ]) ?? null;
  const employmentType =
    getVal("employmentType", ["employment_type", "type"]) ?? "INTERNAL";
  const companyName =
    getVal("companyName", [
      "company_name",
      "company",
      "vendor",
      "contractor",
    ]) ?? "";
  const photoUrl =
    getVal("photoUrl", ["photo_url", "photo", "avatar", "image"]) ?? null;
  const idImage =
    getVal("idImage", ["id_image", "national_id_image", "iqama_image"]) ??
    null;

  // Gender normalization
  const rawGender = String(
    getVal("gender", ["sex"]) ?? "M",
  ).trim().toUpperCase();
  const gender =
    rawGender.startsWith("F") || rawGender === "أنثى" || rawGender === "FEMALE"
      ? "F"
      : "M";

  // Vacation fields
  const vacationStartDate =
    getVal("vacationStartDate", [
      "vacation_start_date",
      "leave_start",
      "leaveStartDate",
    ]) ?? null;
  const vacationEndDate =
    getVal("vacationEndDate", [
      "vacation_end_date",
      "leave_end",
      "leaveEndDate",
    ]) ?? null;
  const vacationNotes =
    getVal("vacationNotes", ["vacation_notes", "leave_reason", "leaveNotes"]) ??
    "";

  // Status normalization
  const rawStatus = getVal("status", ["employee_status", "emp_status", "state"]);
  let normalizedStatus = normalizeHrStatus(rawStatus);

  // If vacation dates are provided and status is active, check if currently on vacation
  if (vacationStartDate && vacationEndDate && normalizedStatus === "ACTIVE") {
    const today = new Date().toISOString().split("T")[0];
    if (vacationStartDate <= today && vacationEndDate >= today) {
      normalizedStatus = "VACATION";
    }
  }

  // Documents / Attachments from HR
  const rawDocs = getVal("documents", ["idDocuments", "attachments", "files", "docs"]) || [];
  const documents: Array<{ fileName: string; fileType: string; fileData: string }> = [];
  if (Array.isArray(rawDocs)) {
    for (const d of rawDocs) {
      if (d && (d.fileName || d.name) && (d.fileData || d.data || d.url)) {
        documents.push({
          fileName: String(d.fileName || d.name || "document").trim(),
          fileType: String(d.fileType || d.type || "application/pdf").trim(),
          fileData: String(d.fileData || d.data || d.url).trim(),
        });
      }
    }
  }
  const passportDoc = getVal("passportImage", ["passport_image", "passport", "passportDoc"]);
  if (passportDoc && typeof passportDoc === "string" && passportDoc.trim()) {
    documents.push({
      fileName: "Passport Copy",
      fileType: "image/jpeg",
      fileData: passportDoc.trim(),
    });
  }
  const contractDoc = getVal("contractDocument", ["contract_doc", "contract_file", "contractFile", "contract_pdf"]);
  if (contractDoc && typeof contractDoc === "string" && contractDoc.trim()) {
    documents.push({
      fileName: "Employment Contract",
      fileType: "application/pdf",
      fileData: contractDoc.trim(),
    });
  }

  return {
    profileId,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    thirdName: String(thirdName).trim(),
    fourthName: String(fourthName).trim(),
    firstNameAr: String(firstNameAr).trim(),
    lastNameAr: String(lastNameAr).trim(),
    thirdNameAr: String(thirdNameAr).trim(),
    fourthNameAr: String(fourthNameAr).trim(),
    nationalId: String(nationalId).trim(),
    nationality: String(nationality).trim(),
    address: String(address).trim(),
    jobTitle: String(jobTitle).trim(),
    jobTitleAr: String(jobTitleAr).trim(),
    level: String(level).trim(),
    phone: String(phone).trim(),
    department: String(department).trim(),
    departmentAr: String(departmentAr).trim(),
    hireDate: String(hireDate).trim(),
    dateOfBirth: String(dateOfBirth).trim(),
    email: String(email).trim(),
    emergencyContact: String(emergencyContact).trim(),
    contractEndDate: contractEndDate ? String(contractEndDate).trim() : null,
    employmentType:
      String(employmentType).trim().toUpperCase() === "EXTERNAL"
        ? "EXTERNAL"
        : "INTERNAL",
    companyName: String(companyName).trim(),
    photoUrl: photoUrl ? String(photoUrl).trim() : null,
    idImage: idImage ? String(idImage).trim() : null,
    vacationStartDate: vacationStartDate
      ? String(vacationStartDate).trim()
      : null,
    vacationEndDate: vacationEndDate ? String(vacationEndDate).trim() : null,
    vacationNotes: vacationNotes ? String(vacationNotes).trim() : "",
    status: normalizedStatus,
    documents,
  };
}

// ============================================================================
// Helper: Sync accommodation and room lifecycle for an employee
// ============================================================================
async function syncEmployeeAccommodationLifecycle({
  tenantDb,
  propertyId,
  profile,
  previousStatus,
  newStatus,
  autoCheckoutOnDeparture = true,
  autoVacationSync = true,
  departureDate,
  departureReason,
  vacationStartDate,
  vacationEndDate,
  vacationNotes,
  req,
}: {
  tenantDb: any;
  propertyId: number;
  profile: any;
  previousStatus: string;
  newStatus: "ACTIVE" | "VACATION" | "DEPARTED" | "UNASSIGNED";
  autoCheckoutOnDeparture?: boolean;
  autoVacationSync?: boolean;
  departureDate?: string;
  departureReason?: string;
  vacationStartDate?: string | null;
  vacationEndDate?: string | null;
  vacationNotes?: string;
  req?: any;
}) {
  let checkoutResult: any = null;

  try {
    // 1. Find active assignment if any
    const [activeAssign] = await tenantDb
      .select()
      .from(assignmentsTable)
      .where(
        and(
          eq(assignmentsTable.profileId, profile.id),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    // ========================================================================
    // Case A: Employee Departed / Terminated / Left (تصفية / مغادرة)
    // ========================================================================
    if (newStatus === "DEPARTED") {
      if (activeAssign && autoCheckoutOnDeparture) {
        const checkOutDate =
          departureDate || new Date().toISOString().split("T")[0];
        const notes = departureReason
          ? `تصفية من الموارد البشرية (HR Departure): ${departureReason}`
          : "تصفية من الموارد البشرية (HR Departure) — إنهاء خدمة / استقالة";

        await tenantDb
          .update(assignmentsTable)
          .set({
            status: "CHECKED_OUT",
            checkOutDate,
            notes,
          })
          .where(eq(assignmentsTable.id, activeAssign.id));

        // Fetch Room & Update status to DIRTY (Rule 5!)
        const [room] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, activeAssign.roomId));

        if (room) {
          const newOcc = Math.max(0, room.currentOccupancy - 1);
          const newRoomStatus = newOcc === 0 ? "dirty" : "occupied_dirty";

          await tenantDb
            .update(roomsTable)
            .set({
              currentOccupancy: newOcc,
              status: newRoomStatus,
            })
            .where(eq(roomsTable.id, room.id));

          checkoutResult = {
            assignmentId: activeAssign.id,
            roomId: room.id,
            roomNumber: room.roomNumber,
            bedNumber: activeAssign.bedNumber,
            checkOutDate,
          };

          // Broadcast HIGH-PRIORITY ALARM via WebSocket
          broadcastToProperty(propertyId, {
            module: "accommodation",
            action: "hr_departure_alarm",
            data: {
              priority: "high",
              title: "إنذار تصفية موظف من الموارد البشرية",
              message: `تم تسجيل مغادرة/تصفية الموظف ${profile.firstName} ${profile.lastName} (${profile.profileId}) من الموارد البشرية وإخلاء غرفته رقم ${room.roomNumber} (سرير ${activeAssign.bedNumber}). يرجى فحص وتنظيف الغرفة.`,
              profileId: profile.profileId,
              profileName: `${profile.firstName} ${profile.lastName}`,
              roomId: room.id,
              roomNumber: room.roomNumber,
              bedNumber: activeAssign.bedNumber,
              assignmentId: activeAssign.id,
            },
          });

          broadcastToProperty(propertyId, {
            module: "housing",
            action: "updated",
            entityId: room.id,
          });
        }

        broadcastToProperty(propertyId, {
          module: "accommodation",
          action: "checkout",
          entityId: activeAssign.id,
        });
        broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });

        // Activity log
        await logActivity({
          req: req || null,
          propertyId,
          username: "hr-sync",
          userId: 0,
          userRole: "system",
          action: `تصفية موظف من الموارد البشرية (HR) — إنهاء سكن الموظف #${profile.profileId} (${profile.firstName} ${profile.lastName}) وإخلاء السرير: ${departureReason || "تصفية عمل"}`,
          actionType: "UPDATE",
          module: "hr_sync",
          entityType: "assignment",
          entityId: activeAssign.id,
          details: {
            profileId: profile.profileId,
            roomId: room?.id,
            roomNumber: room?.roomNumber,
            bedNumber: activeAssign.bedNumber,
            departureReason: departureReason || "تصفية عمل من HR",
            checkOutDate,
            source: "HR Sync",
          },
        });
      }
    }

    // ========================================================================
    // Case B: Employee On Vacation (إجازة)
    // ========================================================================
    else if (newStatus === "VACATION" && autoVacationSync) {
      // Record in profile_vacations if dates provided
      if (vacationStartDate && vacationEndDate) {
        const [existingVac] = await tenantDb
          .select()
          .from(profileVacationsTable)
          .where(
            and(
              eq(profileVacationsTable.profileId, profile.id),
              eq(profileVacationsTable.startDate, vacationStartDate),
              eq(profileVacationsTable.endDate, vacationEndDate),
            ),
          );

        if (!existingVac) {
          await tenantDb.insert(profileVacationsTable).values({
            profileId: profile.id,
            startDate: vacationStartDate,
            endDate: vacationEndDate,
            notes: vacationNotes || "إجازة مسجلة من نظام الموارد البشرية (HR Sync)",
            status: "ACTIVE",
          });
        }
      }

      // If active assignment, check if room should be marked occupied_vacation
      if (activeAssign && activeAssign.roomId) {
        const [room] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, activeAssign.roomId));

        if (room) {
          const roomAssignments = await tenantDb
            .select({
              profileId: assignmentsTable.profileId,
              status: profilesTable.status,
            })
            .from(assignmentsTable)
            .leftJoin(
              profilesTable,
              eq(assignmentsTable.profileId, profilesTable.id),
            )
            .where(
              and(
                eq(assignmentsTable.roomId, room.id),
                eq(assignmentsTable.status, "ACTIVE"),
              ),
            );

          const allOnVacation = roomAssignments.every((ra: any) =>
            ra.profileId === profile.id
              ? true
              : String(ra.status).toUpperCase() === "VACATION",
          );

          if (allOnVacation) {
            await tenantDb
              .update(roomsTable)
              .set({ status: "occupied_vacation" })
              .where(eq(roomsTable.id, room.id));

            broadcastToProperty(propertyId, {
              module: "housing",
              action: "updated",
              entityId: room.id,
            });
          }

          broadcastToProperty(propertyId, {
            module: "accommodation",
            action: "vacation_start",
            entityId: activeAssign.id,
            data: { profileId: profile.profileId },
          });
          broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
        }
      }

      await logActivity({
        req: req || null,
        propertyId,
        username: "hr-sync",
        userId: 0,
        userRole: "system",
        action: `تسجيل إجازة للموظف #${profile.profileId} (${profile.firstName} ${profile.lastName}) من الموارد البشرية (HR)${vacationStartDate ? ` من ${vacationStartDate}` : ""}${vacationEndDate ? ` إلى ${vacationEndDate}` : ""}`,
        actionType: "UPDATE",
        module: "hr_sync",
        entityType: "profile",
        entityId: profile.id,
        details: {
          profileId: profile.profileId,
          vacationStartDate,
          vacationEndDate,
          vacationNotes: vacationNotes || "إجازة مسجلة من HR",
          source: "HR Sync",
        },
      });
    }

    // ========================================================================
    // Case C: Return from Vacation to Active (عودة من الإجازة)
    // ========================================================================
    else if (
      newStatus === "ACTIVE" &&
      previousStatus?.toUpperCase() === "VACATION" &&
      autoVacationSync
    ) {
      // Close active vacation records
      const returnDate = new Date().toISOString().split("T")[0];
      await tenantDb
        .update(profileVacationsTable)
        .set({
          status: "COMPLETED",
          actualReturnDate: returnDate,
        })
        .where(
          and(
            eq(profileVacationsTable.profileId, profile.id),
            eq(profileVacationsTable.status, "ACTIVE"),
          ),
        );

      // If active room was occupied_vacation, set back to occupied
      if (activeAssign && activeAssign.roomId) {
        const [room] = await tenantDb
          .select()
          .from(roomsTable)
          .where(eq(roomsTable.id, activeAssign.roomId));

        if (room && room.status === "occupied_vacation") {
          await tenantDb
            .update(roomsTable)
            .set({ status: "occupied" })
            .where(eq(roomsTable.id, room.id));

          broadcastToProperty(propertyId, {
            module: "housing",
            action: "updated",
            entityId: room.id,
          });
        }

        broadcastToProperty(propertyId, {
          module: "accommodation",
          action: "vacation_return",
          entityId: activeAssign.id,
          data: { profileId: profile.profileId },
        });
        broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
      }

      await logActivity({
        req: req || null,
        propertyId,
        username: "hr-sync",
        userId: 0,
        userRole: "system",
        action: `تسجيل عودة الموظف #${profile.profileId} (${profile.firstName} ${profile.lastName}) من الإجازة ومباشرة العمل عبر HR`,
        actionType: "UPDATE",
        module: "hr_sync",
        entityType: "profile",
        entityId: profile.id,
        details: {
          profileId: profile.profileId,
          actualReturnDate: returnDate,
          source: "HR Sync",
        },
      });
    }
  } catch (err) {
    console.error("[HrSync] Error in syncEmployeeAccommodationLifecycle:", err);
  }

  return checkoutResult;
}

// ============================================================================
// Helper: Auto-register unique departments, job titles, levels, companies
// ============================================================================
export async function autoRegisterLookups(
  tenantDb: any,
  rawEmployees: any[],
  propertyId: number,
): Promise<{ added: number }> {
  let added = 0;
  try {
    const existing = await tenantDb.select().from(lookupValuesTable);
    const existingSet = new Set<string>();
    for (const item of existing) {
      const cat = String(item.category || "").trim().toLowerCase();
      const val = String(item.value || "").trim().toLowerCase();
      const pVal = String(item.parentValue || "").trim().toLowerCase();
      existingSet.add(`${cat}:${val}:${pVal}`);
      existingSet.add(`${cat}:${val}`);
    }

    for (const emp of rawEmployees) {
      // 1. Department bilingual resolution
      let dept = String(emp.department || "").trim();
      let deptAr = String(emp.departmentAr || "").trim();

      if (hasArabic(dept) && !deptAr) {
        deptAr = dept;
        dept = translateDepartment(deptAr, "en");
      } else if (!dept && deptAr) {
        dept = translateDepartment(deptAr, "en");
      } else if (!deptAr && dept) {
        deptAr = translateDepartment(dept, "ar");
      }

      if (dept && !existingSet.has(`department:${dept.toLowerCase()}`)) {
        existingSet.add(`department:${dept.toLowerCase()}`);
        try {
          await tenantDb.insert(lookupValuesTable).values({
            category: "department",
            value: dept,
            valueAr: deptAr || dept,
            parentValue: null,
            sortOrder: 0,
            disabled: false,
          });
          added++;
        } catch {}
      }

      // 2. Job Title bilingual resolution
      let title = String(emp.jobTitle || "").trim();
      let titleAr = String(emp.jobTitleAr || "").trim();

      if (hasArabic(title) && !titleAr) {
        titleAr = title;
        title = translateJobTitle(titleAr, "en");
      } else if (!title && titleAr) {
        title = translateJobTitle(titleAr, "en");
      } else if (!titleAr && title) {
        titleAr = translateJobTitle(title, "ar");
      }

      const parentDept = dept || null;
      const titleKey = `job_title:${title.toLowerCase()}:${(parentDept || "").toLowerCase()}`;
      if (title && !existingSet.has(titleKey) && !existingSet.has(`job_title:${title.toLowerCase()}`)) {
        existingSet.add(titleKey);
        existingSet.add(`job_title:${title.toLowerCase()}`);
        try {
          await tenantDb.insert(lookupValuesTable).values({
            category: "job_title",
            value: title,
            valueAr: titleAr || title,
            parentValue: parentDept,
            extraValue: emp.level ? String(emp.level).trim() : null,
            sortOrder: 0,
            disabled: false,
          });
          added++;
        } catch {}
      }

      // 3. Level
      const lvl = emp.level !== undefined && emp.level !== null ? String(emp.level).trim() : "";
      if (lvl && !existingSet.has(`job_level:${lvl.toLowerCase()}`)) {
        existingSet.add(`job_level:${lvl.toLowerCase()}`);
        try {
          await tenantDb.insert(lookupValuesTable).values({
            category: "job_level",
            value: lvl,
            valueAr: `المستوى ${lvl}`,
            parentValue: null,
            sortOrder: parseInt(lvl, 10) || 0,
            disabled: false,
          });
          added++;
        } catch {}
      }

      // 4. Company
      const comp = String(emp.companyName || "").trim();
      if (comp && !existingSet.has(`company:${comp.toLowerCase()}`)) {
        existingSet.add(`company:${comp.toLowerCase()}`);
        try {
          await tenantDb.insert(lookupValuesTable).values({
            category: "company",
            value: comp,
            valueAr: comp,
            parentValue: null,
            sortOrder: 0,
            disabled: false,
          });
          added++;
        } catch {}
      }
    }

    if (added > 0) {
      broadcastToProperty(propertyId, { module: "settings", action: "updated" });
    }
  } catch (err: any) {
    console.warn("[HrSync] autoRegisterLookups notice:", err?.message);
  }
  return { added };
}

// ============================================================================
// Core batch processor for receive/sync
// ============================================================================
export async function processReceive(
  propertyId: number,
  profiles: any[],
  req?: any,
  mapping: Record<string, string> = {},
  options: {
    syncProfiles?: boolean;
    allowedLevels?: string[];
    allowedDepartments?: string[];
    housingEligibleOnly?: boolean;
    scope?: "full" | "movements_only" | "lookups_only";
    sourceName?: string;
  } = {},
) {
  let created = 0,
    updated = 0,
    departedAutoCheckouts = 0,
    casualUpgrades = 0,
    lookupsAdded = 0,
    errors: string[] = [];

  // Fetch sync config options
  const configRes = await pool.query(
    `SELECT auto_checkout_on_departure, auto_vacation_sync FROM public.hr_sync_config WHERE property_id = $1`,
    [propertyId],
  );
  const autoCheckoutOnDeparture =
    configRes?.rows?.[0]?.auto_checkout_on_departure ?? true;
  const autoVacationSync = configRes?.rows?.[0]?.auto_vacation_sync ?? true;

  const rawProfiles = Array.isArray(profiles) ? profiles : [];

  await withTenant(propertyId, async (tenantDb) => {
    // 1. Initial field mapping and normalization
    let normalizedProfiles = rawProfiles
      .map((p) => extractProfileFields(p, mapping))
      .filter((p) => Boolean(p.profileId));

    // 2. Housing eligible filter
    if (options.housingEligibleOnly) {
      normalizedProfiles = normalizedProfiles.filter((p) => {
        const raw = rawProfiles.find((rp: any) =>
          String(rp.profileId || rp.employeeId || rp.emp_id || rp.id || "").trim() === p.profileId
        );
        if (!raw) return true;
        if (raw.housingEligible === false || raw.isHousingEligible === false || raw.housing_eligible === false) {
          return false;
        }
        return true;
      });
    }

    // 3. Allowed Levels filter (e.g. only Levels 0, 1, 2 for executive housing)
    if (options.allowedLevels && options.allowedLevels.length > 0) {
      const allowedSet = new Set(options.allowedLevels.map((l) => String(l).trim()));
      normalizedProfiles = normalizedProfiles.filter((p) => allowedSet.has(String(p.level).trim()));
    }

    // 4. Allowed Departments filter
    if (options.allowedDepartments && options.allowedDepartments.length > 0) {
      const deptSet = new Set(options.allowedDepartments.map((d) => String(d).trim().toLowerCase()));
      normalizedProfiles = normalizedProfiles.filter((p) => deptSet.has(String(p.department).trim().toLowerCase()));
    }

    // 5. Auto-register lookup values (departments, job titles, levels, companies)
    const lookupRes = await autoRegisterLookups(tenantDb, normalizedProfiles, propertyId);
    lookupsAdded = lookupRes.added;

    // If scope is lookups_only, return immediately after autoRegisterLookups
    if (options.scope === "lookups_only") {
      return;
    }

    const syncProfiles = options.syncProfiles !== false && options.scope !== "movements_only";

    // 6. Query existing profiles by profileId
    const empIds = normalizedProfiles.map((p) => p.profileId);
    const existingRows =
      empIds.length > 0
        ? await tenantDb
            .select()
            .from(profilesTable)
            .where(inArray(profilesTable.profileId, empIds))
        : [];
    const existingMap = new Map(
      existingRows.map((e: any) => [e.profileId, e]),
    );

    // 7. For profiles not found by profileId, query by nationalId (Casual -> Permanent transition)
    const unmatchedNationalIds = normalizedProfiles
      .filter((p) => Boolean(p.nationalId) && !existingMap.has(p.profileId))
      .map((p) => p.nationalId);

    const existingByNidMap = new Map<string, any>();
    if (unmatchedNationalIds.length > 0) {
      const byNidRows = await tenantDb
        .select()
        .from(profilesTable)
        .where(inArray(profilesTable.nationalId, unmatchedNationalIds));
      for (const row of byNidRows) {
        if (row.nationalId) {
          existingByNidMap.set(String(row.nationalId).trim(), row);
        }
      }
    }

    for (const emp of normalizedProfiles) {
      try {
        let existing = existingMap.get(emp.profileId);
        let isCasualUpgrade = false;
        let oldProfileId = "";

        // Check if existing profile matches by nationalId (Casual to Permanent transition)
        if (!existing && emp.nationalId) {
          const matchedByNid = existingByNidMap.get(emp.nationalId);
          if (matchedByNid) {
            existing = matchedByNid;
            isCasualUpgrade = true;
            oldProfileId = matchedByNid.profileId;
          }
        }

        if (existing) {
          const previousStatus = existing.status;

          // If syncProfiles is enabled OR this is a casual-to-permanent upgrade:
          if (syncProfiles || isCasualUpgrade) {
            const enrichedUpdate = enrichProfileBilingual({
              firstName: emp.firstName || existing.firstName,
              lastName: emp.lastName || existing.lastName,
              thirdName: emp.thirdName || existing.thirdName,
              fourthName: emp.fourthName || existing.fourthName,
              firstNameAr: emp.firstNameAr || existing.firstNameAr,
              lastNameAr: emp.lastNameAr || existing.lastNameAr,
              thirdNameAr: emp.thirdNameAr || existing.thirdNameAr,
              fourthNameAr: emp.fourthNameAr || existing.fourthNameAr,
              department: emp.department || existing.department,
              departmentAr: emp.departmentAr || existing.departmentAr,
              jobTitle: emp.jobTitle || existing.jobTitle,
              jobTitleAr: emp.jobTitleAr || existing.jobTitleAr,
            });

            const changedFields: string[] = [];
            const checkDiff = (labelAr: string, newVal: any, oldVal: any) => {
              if (newVal !== undefined && newVal !== null && String(newVal).trim() !== "" && String(newVal).trim() !== String(oldVal ?? "").trim()) {
                changedFields.push(labelAr);
              }
            };
            checkDiff("الاسم", emp.firstName, existing.firstName);
            checkDiff("الرقم القومي", emp.nationalId, existing.nationalId);
            checkDiff("الجنسية", emp.nationality, existing.nationality);
            checkDiff("العنوان", emp.address, existing.address);
            checkDiff("الهاتف", emp.phone, existing.phone);
            checkDiff("القسم", emp.department, existing.department);
            checkDiff("المسمى الوظيفي", emp.jobTitle, existing.jobTitle);
            checkDiff("الدرجة", emp.level, existing.level);
            checkDiff("الحالة", emp.status, existing.status);
            checkDiff("انتهاء العقد", emp.contractEndDate, existing.contractEndDate);
            checkDiff("الصورة", emp.photoUrl, existing.photoUrl);
            checkDiff("صورة البطاقة", emp.idImage, existing.idImage);

            const updateData: any = {
              firstName: emp.firstName !== undefined && emp.firstName !== "" ? emp.firstName : existing.firstName,
              lastName: emp.lastName !== undefined && emp.lastName !== "" ? emp.lastName : existing.lastName,
              thirdName: emp.thirdName !== undefined ? emp.thirdName : existing.thirdName,
              fourthName: emp.fourthName !== undefined ? emp.fourthName : existing.fourthName,
              firstNameAr: enrichedUpdate.firstNameAr || existing.firstNameAr,
              lastNameAr: enrichedUpdate.lastNameAr || existing.lastNameAr,
              thirdNameAr: enrichedUpdate.thirdNameAr || existing.thirdNameAr,
              fourthNameAr: enrichedUpdate.fourthNameAr || existing.fourthNameAr,
              nationalId: emp.nationalId !== undefined && emp.nationalId !== "" ? emp.nationalId : existing.nationalId,
              nationality: emp.nationality !== undefined && emp.nationality !== "" ? emp.nationality : existing.nationality,
              jobTitle: enrichedUpdate.jobTitle || emp.jobTitle || existing.jobTitle,
              jobTitleAr: enrichedUpdate.jobTitleAr || existing.jobTitleAr,
              department: enrichedUpdate.department || emp.department || existing.department,
              departmentAr: enrichedUpdate.departmentAr || existing.departmentAr,
              phone: emp.phone !== undefined && emp.phone !== "" ? emp.phone : existing.phone,
              address: emp.address !== undefined && emp.address !== "" ? emp.address : existing.address,
              status: emp.status || existing.status,
              gender: (emp as any).gender || existing.gender,
              level: emp.level !== undefined && emp.level !== "" ? emp.level : existing.level,
              hireDate: emp.hireDate || existing.hireDate,
              dateOfBirth: emp.dateOfBirth !== undefined && emp.dateOfBirth !== "" ? emp.dateOfBirth : existing.dateOfBirth,
              email: emp.email !== undefined && emp.email !== "" ? emp.email : existing.email,
              emergencyContact: emp.emergencyContact !== undefined && emp.emergencyContact !== "" ? emp.emergencyContact : existing.emergencyContact,
              contractEndDate: emp.contractEndDate !== undefined ? emp.contractEndDate : existing.contractEndDate,
              employmentType: emp.employmentType || (isCasualUpgrade ? "INTERNAL" : existing.employmentType),
              companyName: emp.companyName !== undefined && emp.companyName !== "" ? emp.companyName : existing.companyName,
              photoUrl: emp.photoUrl !== undefined ? emp.photoUrl : existing.photoUrl,
              idImage: emp.idImage !== undefined ? emp.idImage : existing.idImage,
              vacationStartDate:
                emp.vacationStartDate !== undefined
                  ? emp.vacationStartDate
                  : existing.vacationStartDate,
              vacationEndDate:
                emp.vacationEndDate !== undefined
                  ? emp.vacationEndDate
                  : existing.vacationEndDate,
              vacationNotes:
                emp.vacationNotes !== undefined
                  ? emp.vacationNotes
                  : existing.vacationNotes,
            };

            // Sync document attachments into profileDocumentsTable
            if (emp.documents && Array.isArray(emp.documents) && emp.documents.length > 0) {
              try {
                const existingDocs = await tenantDb
                  .select({ fileName: profileDocumentsTable.fileName })
                  .from(profileDocumentsTable)
                  .where(eq(profileDocumentsTable.profileId, existing.id));
                const existingNames = new Set(existingDocs.map((d: any) => d.fileName));
                const newDocs = emp.documents.filter((d: any) => !existingNames.has(d.fileName));
                if (newDocs.length > 0) {
                  await tenantDb.insert(profileDocumentsTable).values(
                    newDocs.map((d: any) => ({
                      profileId: existing.id,
                      fileName: d.fileName,
                      fileType: d.fileType || "application/octet-stream",
                      fileData: d.fileData,
                    }))
                  );
                  changedFields.push(`مستندات (${newDocs.length} ملف جديد)`);
                }
              } catch (docErr) {
                console.warn(`[HrSync] Error inserting documents for profile ${existing.id}`, docErr);
              }
            }

            // If Casual -> Permanent transition:
            if (isCasualUpgrade) {
              updateData.profileId = emp.profileId;
              updateData.previousProfileId = oldProfileId;
              casualUpgrades++;

              // Update portal account with new employee code if exists
              try {
                await tenantDb
                  .update(profilePortalAccountsTable)
                  .set({ profileId: emp.profileId })
                  .where(eq(profilePortalAccountsTable.profileId, oldProfileId));
              } catch {}

              const s = su(req);
              await logActivity({
                req,
                propertyId,
                username: s?.username || "hr-sync",
                userId: s?.userId || 0,
                userRole: s?.userRole || "system",
                action: `ترقية موظف من عمالة مؤقتة / Casual (${oldProfileId}) إلى كود دائم (${emp.profileId}) برقم قومي ${emp.nationalId} مع الحفاظ الكامل على التسكين والغرفة الحالية`,
                actionType: "UPDATE",
                module: "hr_sync",
                entityType: "profile",
                entityId: existing.id,
              });
            } else if (changedFields.length > 0) {
              const s = su(req);
              await logActivity({
                req,
                propertyId,
                username: s?.username || "hr-sync",
                userId: s?.userId || 0,
                userRole: s?.userRole || "system",
                action: `تحديث بيانات الموظف #${emp.profileId} (${emp.firstName || existing.firstName} ${emp.lastName || existing.lastName}) آلياً من نظام HR — تم تحديث: ${changedFields.join("، ")}`,
                actionType: "UPDATE",
                module: "hr_sync",
                entityType: "profile",
                entityId: existing.id,
                details: {
                  profileId: emp.profileId,
                  modifiedFields: changedFields,
                  source: "HR Sync",
                },
              });
            }

            await tenantDb
              .update(profilesTable)
              .set(updateData)
              .where(eq(profilesTable.id, existing.id));

            updated++;
          }

          // Run accommodation & vacation/departure lifecycle
          const checkout = await syncEmployeeAccommodationLifecycle({
            tenantDb,
            propertyId,
            profile: existing,
            previousStatus,
            newStatus: emp.status,
            autoCheckoutOnDeparture,
            autoVacationSync,
            vacationStartDate: emp.vacationStartDate,
            vacationEndDate: emp.vacationEndDate,
            vacationNotes: emp.vacationNotes,
            req,
          });

          if (checkout) departedAutoCheckouts++;
        } else if (syncProfiles) {
          // Insert new profile with all fields and full bilingual auto-translation
          const rawInsert = {
            profileId: emp.profileId,
            firstName: emp.firstName || "",
            lastName: emp.lastName || "",
            thirdName: emp.thirdName || "",
            fourthName: emp.fourthName || "",
            firstNameAr: emp.firstNameAr || "",
            lastNameAr: emp.lastNameAr || "",
            thirdNameAr: emp.thirdNameAr || "",
            fourthNameAr: emp.fourthNameAr || "",
            nationalId: emp.nationalId || "",
            nationality: emp.nationality || "",
            jobTitle: emp.jobTitle || "",
            jobTitleAr: emp.jobTitleAr || "",
            department: emp.department || "",
            departmentAr: emp.departmentAr || "",
            phone: emp.phone || "",
            address: emp.address || "",
            status: emp.status || "UNASSIGNED",
            gender: (emp as any).gender || "M",
            level: emp.level || "",
            hireDate: emp.hireDate || new Date().toISOString().split("T")[0],
            dateOfBirth: emp.dateOfBirth || "",
            email: emp.email || "",
            emergencyContact: emp.emergencyContact || "",
            contractEndDate: emp.contractEndDate,
            employmentType: emp.employmentType || "INTERNAL",
            companyName: emp.companyName || "",
            photoUrl: emp.photoUrl,
            idImage: emp.idImage,
            vacationStartDate: emp.vacationStartDate,
            vacationEndDate: emp.vacationEndDate,
            vacationNotes: emp.vacationNotes,
          };
          const enrichedInsert = enrichProfileBilingual(rawInsert);

          const [inserted] = await tenantDb
            .insert(profilesTable)
            .values(enrichedInsert as any)
            .returning();

          if (
            emp.status === "VACATION" &&
            autoVacationSync &&
            emp.vacationStartDate
          ) {
            await tenantDb.insert(profileVacationsTable).values({
              profileId: inserted.id,
              startDate: emp.vacationStartDate,
              endDate: emp.vacationEndDate || null,
              notes: emp.vacationNotes || "Synced from HR system",
              status: "ACTIVE",
            }).catch(() => {});
          }

          if (inserted && inserted.profileId) {
            await ensureProfilePortalAccount(propertyId, inserted.profileId, inserted.id).catch(() => {});
          }

          // Insert documents for new profile from HR
          if (emp.documents && Array.isArray(emp.documents) && emp.documents.length > 0 && inserted?.id) {
            try {
              await tenantDb.insert(profileDocumentsTable).values(
                emp.documents.map((d: any) => ({
                  profileId: inserted.id,
                  fileName: d.fileName,
                  fileType: d.fileType || "application/octet-stream",
                  fileData: d.fileData,
                }))
              );
            } catch (docErr) {
              console.warn(`[HrSync] Error inserting documents for new profile ${inserted.id}`, docErr);
            }
          }

          await logActivity({
            req,
            propertyId,
            username: "hr-sync",
            userId: 0,
            userRole: "system",
            action: `إضافة موظف جديد #${inserted.profileId} (${inserted.firstName} ${inserted.lastName}) آلياً من نظام HR (القسم: ${inserted.department || "—"})`,
            actionType: "CREATE",
            module: "hr_sync",
            entityType: "profile",
            entityId: inserted.id,
            details: {
              profileId: inserted.profileId,
              nationalId: inserted.nationalId,
              department: inserted.department,
              documentsCount: emp.documents?.length || 0,
              source: "HR Sync",
            },
          });

          created++;
        }
      } catch (err: any) {
        errors.push(`${emp.profileId || "unknown"}: ${err.message || "sync error"}`);
      }
    }
  });

  return {
    success: true,
    stats: {
      received: rawProfiles.length,
      created,
      updated,
      departedAutoCheckouts,
      casualUpgrades,
      lookupsAdded,
      errors: errors.length,
    },
    errors: errors.length > 0 ? errors : undefined,
  };
}

// ============================================================================
// GET /api/hr-sync/config — Get HR sync config for current property
// ============================================================================
router.get(
  "/config",
  requireAnyPermission(["hr_sync", "view"], ["settings", "view"]),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const configRes = await pool.query(
      `SELECT * FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );
    if (!configRes?.rows?.[0]) {
      res.json({
        success: true,
        config: {
          apiUrl: "",
          apiKey: "",
          fieldMapping: {},
          isActive: false,
          autoCheckoutOnDeparture: true,
          autoVacationSync: true,
          targetPropertyIds: [propertyId],
          sources: [],
          esignConfig: null,
          esignConfigs: [],
          lastSyncAt: null,
        },
      });
      return;
    }
    const row = configRes.rows[0];
    const rawSources: HrSourceConfig[] = Array.isArray(row.sources) ? row.sources : [];
    const safeSources = rawSources.map((s) => ({
      ...s,
      apiKey: s.apiKey ? "••••••" : "",
    }));

    // Multi-source esign: normalize raw to array and mask passwords
    const rawEsignData = row.esign_config;
    let esignArr: SunriseEsignConfig[] = [];
    if (Array.isArray(rawEsignData)) {
      esignArr = rawEsignData;
    } else if (rawEsignData && typeof rawEsignData === "object" && (rawEsignData.username || rawEsignData.hotelCode)) {
      esignArr = [{ id: "default", label: "Default", ...rawEsignData }];
    }

    const safeEsignConfigs = esignArr.map((c: any) => ({
      ...c,
      password: c.password ? "••••••••" : "",
    }));

    // Backward compat: esignConfig = first source (masked)
    const safeEsign = safeEsignConfigs.length > 0 ? safeEsignConfigs[0] : null;

    res.json({
      success: true,
      config: {
        id: row.id,
        apiUrl: row.api_url || "",
        apiKey: row.api_key ? "••••••" : "",
        fieldMapping: row.field_mapping || {},
        isActive: row.is_active || false,
        autoCheckoutOnDeparture: row.auto_checkout_on_departure ?? true,
        autoVacationSync: row.auto_vacation_sync ?? true,
        targetPropertyIds: Array.isArray(row.target_property_ids) && row.target_property_ids.length > 0 ? row.target_property_ids : [propertyId],
        sources: safeSources,
        esignConfig: safeEsign,
        esignConfigs: safeEsignConfigs,
        lastSyncAt: row.last_sync_at,
        createdAt: row.created_at,
        updatedAt: row.updated_at,
      },
    });
  },
);

// ============================================================================
// PUT /api/hr-sync/config — Upsert HR sync config
// ============================================================================
router.put(
  "/config",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const parsed = HrSyncConfigSchema.safeParse(req.body);
    if (!parsed.success) {
      res
        .status(400)
        .json({ error: parsed.error.errors[0]?.message ?? "Invalid input" });
      return;
    }

    const {
      apiUrl,
      apiKey,
      fieldMapping,
      isActive,
      autoCheckoutOnDeparture,
      autoVacationSync,
      targetPropertyIds,
      sources,
      esignConfig,
    } = parsed.data;

    const existingRes = await pool.query(
      `SELECT id, api_key, sources, esign_config FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );
    const existing = existingRes?.rows?.[0];

    let finalApiKey = apiKey;
    if (apiKey === "••••••" || (apiKey && apiKey.startsWith("•••"))) {
      finalApiKey = existing?.api_key || "";
    }

    const existingSources: HrSourceConfig[] = Array.isArray(existing?.sources) ? existing.sources : [];
    const existingKeyMap = new Map(existingSources.map((s) => [s.id, s.apiKey || ""]));

    const finalSources = (sources || []).map((s: HrSourceConfig) => {
      let key = s.apiKey;
      if (key === "••••••" || (key && key.startsWith("•••"))) {
        key = existingKeyMap.get(s.id) || "";
      }
      return {
        ...s,
        apiKey: key,
      };
    });

    // Multi-source esign: accept esignConfigs (array) or esignConfig (single, backward compat)
    const incomingEsignConfigs: SunriseEsignConfig[] | undefined = Array.isArray(req.body.esignConfigs)
      ? req.body.esignConfigs
      : undefined;

    // Load existing esign data for password preservation
    let existingEsignArr: SunriseEsignConfig[] = [];
    if (existing?.esign_config) {
      if (Array.isArray(existing.esign_config)) {
        existingEsignArr = existing.esign_config;
      } else if (typeof existing.esign_config === "object" && (existing.esign_config.username || existing.esign_config.hotelCode)) {
        existingEsignArr = [{ id: "default", label: "Default", ...existing.esign_config }];
      }
    }
    const existingPwdMap = new Map(existingEsignArr.map((c: any) => [c.id || "default", c.password || ""]));

    let finalEsignConfig: any;

    if (incomingEsignConfigs) {
      // New array format: preserve masked passwords per source
      finalEsignConfig = incomingEsignConfigs.map((c: any) => {
        let pwd = c.password;
        if (pwd === "••••••••" || (typeof pwd === "string" && pwd.startsWith("•••"))) {
          pwd = existingPwdMap.get(c.id || "default") || "";
        }
        return { ...c, password: pwd };
      });
    } else if (esignConfig && typeof esignConfig === "object") {
      // Legacy single object format
      const existingEsign = existingEsignArr[0] || {};
      let pwd = esignConfig.password;
      if (pwd === "••••••••" || (typeof pwd === "string" && pwd.startsWith("•••"))) {
        pwd = (existingEsign as any).password || "";
      }
      finalEsignConfig = [{
        id: "default",
        label: "Default",
        ...existingEsign,
        ...esignConfig,
        password: pwd,
      }];
    }

    if (existing) {
      const updates: any = { updated_at: new Date() };
      if (apiUrl !== undefined) updates.api_url = apiUrl;
      if (finalApiKey !== undefined) updates.api_key = finalApiKey;
      if (fieldMapping !== undefined) updates.field_mapping = JSON.stringify(fieldMapping);
      if (isActive !== undefined) updates.is_active = isActive;
      if (autoCheckoutOnDeparture !== undefined) updates.auto_checkout_on_departure = autoCheckoutOnDeparture;
      if (autoVacationSync !== undefined) updates.auto_vacation_sync = autoVacationSync;
      if (targetPropertyIds !== undefined) updates.target_property_ids = JSON.stringify(targetPropertyIds);
      if (sources !== undefined) updates.sources = JSON.stringify(finalSources);
      if (finalEsignConfig !== undefined) updates.esign_config = JSON.stringify(finalEsignConfig);

      const setClauses = Object.entries(updates)
        .map(([k, v], i) => `${k} = $${i + 2}`)
        .join(", ");
      const values = [propertyId, ...Object.values(updates)];
      await pool.query(
        `UPDATE public.hr_sync_config SET ${setClauses} WHERE property_id = $1`,
        values,
      );
    } else {
      await pool.query(
        `INSERT INTO public.hr_sync_config (
           property_id, api_url, api_key, field_mapping, is_active, 
           auto_checkout_on_departure, auto_vacation_sync, target_property_ids, sources, esign_config, updated_at
         )
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, NOW())`,
        [
          propertyId,
          apiUrl || "",
          finalApiKey || "",
          JSON.stringify(fieldMapping || {}),
          isActive || false,
          autoCheckoutOnDeparture ?? true,
          autoVacationSync ?? true,
          JSON.stringify(targetPropertyIds || [propertyId]),
          JSON.stringify(finalSources),
          JSON.stringify(finalEsignConfig || {}),
        ],
      );
    }

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `تحديث إعدادات ربط HR والمصادر المتعددة`,
      actionType: "UPDATE",
      module: "hr_sync",
      entityType: "hr_sync_config",
      entityId: propertyId,
    });

    res.json({ success: true, message: "HR sync config updated" });
  },
);

// ============================================================================
// POST /api/hr-sync/receive — Receive profile data pushed from HR system
// Body: { propertyId, profiles: [...], mapping?: {...}, ...options }
// ============================================================================
router.post("/receive", async (req, res): Promise<void> => {
  const expectedKey = (process.env["HR_SYNC_API_KEY"] || "").trim();
  const providedKey = String(req.headers["x-api-key"] || "").trim();
  const isAdmin = Boolean((req as any).session?.userId);
  if (!isAdmin) {
    if (expectedKey) {
      if (providedKey !== expectedKey) {
        console.warn("[HR_SYNC_AUTH_FAIL]", { expectedKey, providedKey });
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        error: "HR_SYNC_API_KEY not configured — webhook access denied in production",
      });
      return;
    }
  }

  const propertyId =
    Number(req.body?.propertyId) || Number(req.query?.propertyId);
  if (!propertyId) {
    res.status(400).json({ error: "propertyId required" });
    return;
  }

  const profiles =
    req.body?.profiles || req.body?.employees || req.body?.data || req.body;
  if (!Array.isArray(profiles) || profiles.length === 0) {
    res
      .status(400)
      .json({ error: "profiles array required (e.g. { profiles: [...] })" });
    return;
  }

  const mapping = req.body?.mapping || {};
  const options = {
    syncProfiles: req.body?.syncProfiles !== false,
    allowedLevels: req.body?.allowedLevels || [],
    allowedDepartments: req.body?.allowedDepartments || [],
    housingEligibleOnly: req.body?.housingEligibleOnly || false,
    scope: req.body?.scope || "full",
  };

  const result = await processReceive(propertyId, profiles, req, mapping, options);

  const s = su(req);
  await logActivity({
    req,
    propertyId,
    username: s?.username || "hr-webhook",
    userId: s?.userId || 0,
    userRole: s?.userRole || "system",
    action: `استقبال بيانات موظفين من HR (Push) — تم إنشاء ${result.stats.created} وتحديث ${result.stats.updated} وترقية ${result.stats.casualUpgrades} مؤقتين وإخلاء ${result.stats.departedAutoCheckouts} وتسجيل ${result.stats.lookupsAdded} مسميات`,
    actionType: "SYNC",
    module: "hr_sync",
    entityType: "profile",
    entityId: propertyId,
  });

  res.json(result);
});

// ============================================================================
// POST /api/hr-sync/sync — Pull profiles from external HR API
// ============================================================================
router.post(
  "/sync",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const { sourceId, scope = "full" } = req.body || {};

    const configResult = await pool.query(
      `SELECT * FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );
    const config = configResult?.rows?.[0];
    if (!config) {
      res.status(400).json({
        error: "HR sync not configured for this property",
      });
      return;
    }

    const configuredSources: HrSourceConfig[] = Array.isArray(config.sources) ? config.sources : [];

    let sourcesToRun: HrSourceConfig[] = [];
    if (sourceId) {
      const found = configuredSources.find((s) => s.id === sourceId);
      if (found) {
        sourcesToRun = [found];
      } else {
        res.status(404).json({ error: `المصدر المحدد '${sourceId}' غير مسجل في النظام` });
        return;
      }
    } else if (configuredSources.length > 0) {
      sourcesToRun = configuredSources.filter((s) => {
        if (!s.isActive) return false;
        if (!s.targetPropertyIds || s.targetPropertyIds.length === 0) return true;
        return s.targetPropertyIds.includes(propertyId);
      });
    } else if (config.api_url && config.is_active) {
      sourcesToRun = [
        {
          id: "default",
          name: "Default HR API",
          apiUrl: config.api_url,
          apiKey: config.api_key,
          syncProfiles: true,
          autoCheckoutOnDeparture: config.auto_checkout_on_departure ?? true,
          autoVacationSync: config.auto_vacation_sync ?? true,
          isActive: true,
        },
      ];
    }

    if (sourcesToRun.length === 0) {
      res.status(400).json({
        error: "لا توجد مصادر HR نشطة مخصصة لهذا السكن حالياً",
      });
      return;
    }

    const logEntry = await pool.query(
      `INSERT INTO public.hr_sync_log (property_id, sync_type, status, started_at)
       VALUES ($1, $2, 'in_progress', NOW()) RETURNING id`,
      [propertyId, scope === "lookups_only" ? "lookups" : scope === "movements_only" ? "movements" : "pull"],
    );
    const logId = logEntry?.rows?.[0]?.id;

    let totalReceived = 0;
    let totalCreated = 0;
    let totalUpdated = 0;
    let totalDepartedCheckouts = 0;
    let totalCasualUpgrades = 0;
    let totalLookupsAdded = 0;
    let errors: string[] = [];
    let sourceResults: any[] = [];

    const port = process.env.PORT || 4000;

    for (const source of sourcesToRun) {
      try {
        let fetchUrl = source.apiUrl.trim();
        if (fetchUrl.startsWith("/")) {
          fetchUrl = `http://localhost:${port}${fetchUrl}`;
        }

        const headers: Record<string, string> = {
          "Content-Type": "application/json",
        };
        if (source.apiKey && !source.apiKey.startsWith("•••")) {
          headers["Authorization"] = `Bearer ${source.apiKey}`;
          headers["x-api-key"] = source.apiKey;
        }

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), 45000);
        const response = await fetch(fetchUrl, {
          headers,
          signal: controller.signal as any,
        });
        clearTimeout(timeoutId);

        if (!response.ok) {
          throw new Error(`[${source.name}] HR API returned ${response.status}: ${response.statusText}`);
        }

        const data = (await response.json()) as any;
        const profiles = Array.isArray(data)
          ? data
          : data.profiles || data.employees || data.data || [];

        const mapping = config.field_mapping || {};
        const sourceRes = await processReceive(
          propertyId,
          profiles,
          req,
          mapping,
          {
            syncProfiles: source.syncProfiles !== false,
            allowedLevels: source.allowedLevels || [],
            allowedDepartments: source.allowedDepartments || [],
            housingEligibleOnly: source.housingEligibleOnly || false,
            scope,
            sourceName: source.name,
          },
        );

        totalReceived += sourceRes.stats?.received || 0;
        totalCreated += sourceRes.stats?.created || 0;
        totalUpdated += sourceRes.stats?.updated || 0;
        totalDepartedCheckouts += sourceRes.stats?.departedAutoCheckouts || 0;
        totalCasualUpgrades += sourceRes.stats?.casualUpgrades || 0;
        totalLookupsAdded += sourceRes.stats?.lookupsAdded || 0;
        if (sourceRes.errors && sourceRes.errors.length > 0) {
          errors.push(...sourceRes.errors);
        }

        sourceResults.push({
          sourceId: source.id,
          sourceName: source.name,
          stats: sourceRes.stats,
        });

        source.lastSyncAt = new Date().toISOString();
      } catch (err: any) {
        errors.push(`[${source.name}] ${err.message}`);
        sourceResults.push({
          sourceId: source.id,
          sourceName: source.name,
          error: err.message,
        });
      }
    }

    if (configuredSources.length > 0) {
      await pool.query(
        `UPDATE public.hr_sync_config SET sources = $1, last_sync_at = NOW(), updated_at = NOW() WHERE property_id = $2`,
        [JSON.stringify(configuredSources), propertyId],
      );
    } else {
      await pool.query(
        `UPDATE public.hr_sync_config SET last_sync_at = NOW(), updated_at = NOW() WHERE property_id = $1`,
        [propertyId],
      );
    }

    await pool.query(
      `UPDATE public.hr_sync_log 
       SET status = $1, records_processed = $2, records_created = $3, records_updated = $4, errors = $5, completed_at = NOW()
       WHERE id = $6`,
      [
        errors.length > 0 ? (totalReceived > 0 ? "completed_with_errors" : "failed") : "completed",
        totalReceived,
        totalCreated,
        totalUpdated,
        errors.slice(0, 10).join("; ") || null,
        logId,
      ],
    );

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s?.username || "hr-sync",
      userId: s?.userId || 0,
      userRole: s?.userRole || "system",
      action: `مزامنة HR (${scope}) لـ ${sourcesToRun.length} مصادر — تم إنشاء ${totalCreated}، وتحديث ${totalUpdated}، وترقية ${totalCasualUpgrades} عمالة مؤقتة، وإخلاء ${totalDepartedCheckouts}، وتسجيل ${totalLookupsAdded} مسميات وأقسام`,
      actionType: "SYNC",
      module: "hr_sync",
      entityType: "profile",
      entityId: propertyId,
    });

    res.json({
      success: true,
      stats: {
        sourcesRun: sourcesToRun.length,
        received: totalReceived,
        created: totalCreated,
        updated: totalUpdated,
        departedAutoCheckouts: totalDepartedCheckouts,
        casualUpgrades: totalCasualUpgrades,
        lookupsAdded: totalLookupsAdded,
        errors: errors.length,
      },
      sourceResults,
      errors: errors.length > 0 ? errors : undefined,
    });
  },
);

// ============================================================================
// POST /api/hr-sync/test-connection — Test reachability & sample payload of an HR URL
// ============================================================================
router.post(
  "/test-connection",
  requireAnyPermission(["hr_sync", "view"], ["settings", "view"]),
  async (req, res): Promise<void> => {
    const { apiUrl, apiKey } = req.body || {};
    if (!apiUrl) {
      res.status(400).json({ success: false, error: "apiUrl مطلوب لاختبار الرابط" });
      return;
    }

    const startTime = Date.now();
    try {
      const port = process.env.PORT || 4000;
      let targetUrl = String(apiUrl).trim();
      if (targetUrl.startsWith("/")) {
        targetUrl = `http://localhost:${port}${targetUrl}`;
      }

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (apiKey && !apiKey.startsWith("•••")) {
        headers["Authorization"] = `Bearer ${apiKey}`;
        headers["x-api-key"] = apiKey;
      }

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(targetUrl, {
        headers,
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);
      const latencyMs = Date.now() - startTime;

      if (!response.ok) {
        res.status(400).json({
          success: false,
          error: `استجابة غير صالحة من الـ API: HTTP ${response.status} ${response.statusText}`,
          latencyMs,
        });
        return;
      }

      const data = (await response.json()) as any;
      const rawList = Array.isArray(data)
        ? data
        : data.profiles || data.employees || data.data || [];

      res.json({
        success: true,
        latencyMs,
        count: Array.isArray(rawList) ? rawList.length : 0,
        sample: Array.isArray(rawList) ? rawList.slice(0, 3) : [],
        message: `الاتصال ناجح (${latencyMs}ms) — تم العثور على ${Array.isArray(rawList) ? rawList.length : 0} سجل موظف`,
      });
    } catch (err: any) {
      res.status(400).json({
        success: false,
        error: err.name === "AbortError" ? "انتهت مهلة الاتصال (Timeout 15s)" : err.message,
        latencyMs: Date.now() - startTime,
      });
    }
  },
);

// ============================================================================
// GET /api/hr-sync/mock-feed — Realistic Mock API feed for testing multi-hotel sync
// ============================================================================
router.get("/mock-feed", (req, res): void => {
  const hotel = String(req.query.hotel || "all").toLowerCase();
  const testUpgrade = req.query.test_casual_upgrade === "true";

  const allRecords = [
    // --- فندق التاج (Al-Taj Hotel - Property 1) ---
    {
      profileId: "TAJ-101",
      firstName: "طارق",
      lastName: "السيد",
      nationalId: "28503120102345",
      nationality: "مصري",
      department: "الإدارة العامة",
      jobTitle: "مدير عام الفندق",
      level: "0",
      phone: "01011112222",
      address: "شرم الشيخ",
      gender: "M",
      hireDate: "2019-01-15",
      employmentType: "INTERNAL",
      companyName: "فندق التاج",
      hotel: "al_taj",
      status: "ACTIVE",
      housingEligible: true,
    },
    {
      profileId: "TAJ-204",
      firstName: "سارة",
      lastName: "منصور",
      nationalId: "29107150109876",
      nationality: "مصرية",
      department: "الموارد البشرية",
      jobTitle: "مدير الموارد البشرية",
      level: "1",
      phone: "01022223333",
      address: "شرم الشيخ",
      gender: "F",
      hireDate: "2020-05-10",
      employmentType: "INTERNAL",
      companyName: "فندق التاج",
      hotel: "al_taj",
      status: "ACTIVE",
      housingEligible: true,
    },
    {
      profileId: "TAJ-305",
      firstName: "حسام",
      lastName: "إبراهيم",
      nationalId: "29206140107788",
      nationality: "مصري",
      department: "المكاتب الأمامية",
      jobTitle: "مشرف مكاتب أمامية",
      level: "2",
      phone: "01033334444",
      address: "شرم الشيخ",
      gender: "M",
      hireDate: "2021-08-01",
      employmentType: "INTERNAL",
      companyName: "فندق التاج",
      hotel: "al_taj",
      status: "ACTIVE",
      housingEligible: true,
    },
    // Casual / Temporary worker (which will become permanent when testUpgrade is true)
    testUpgrade
      ? {
          profileId: "EMP-8802",
          firstName: "محمود",
          lastName: "فتحي",
          nationalId: "29604101402233",
          nationality: "مصري",
          department: "الأغذية والمشروبات",
          jobTitle: "مضيف أغذية ومشروبات دائم",
          level: "2",
          phone: "01044445555",
          address: "شرم الشيخ",
          gender: "M",
          hireDate: "2026-09-01",
          employmentType: "INTERNAL",
          companyName: "فندق التاج",
          hotel: "al_taj",
          status: "ACTIVE",
          housingEligible: true,
        }
      : {
          profileId: "CAS-1042",
          firstName: "محمود",
          lastName: "فتحي",
          nationalId: "29604101402233",
          nationality: "مصري",
          department: "الأغذية والمشروبات",
          jobTitle: "عامل خدمات مؤقت (Casual)",
          level: "4",
          phone: "01044445555",
          address: "شرم الشيخ",
          gender: "M",
          hireDate: "2026-06-01",
          employmentType: "CASUAL",
          companyName: "فندق التاج",
          hotel: "al_taj",
          status: "ACTIVE",
          housingEligible: true,
        },

    // --- فندق وايت هيلز (White Hills Hotel) ---
    {
      profileId: "WH-201",
      firstName: "رشا",
      lastName: "كمال",
      nationalId: "28911050106655",
      nationality: "مصرية",
      department: "الإشراف الداخلي",
      jobTitle: "مدير الإشراف الداخلي",
      level: "1",
      phone: "01155556666",
      address: "شرم الشيخ",
      gender: "F",
      hireDate: "2018-11-20",
      employmentType: "INTERNAL",
      companyName: "فندق وايت هيلز",
      hotel: "white_hills",
      status: "ACTIVE",
      housingEligible: true,
    },
    {
      profileId: "WH-305",
      firstName: "كريم",
      lastName: "عادل",
      nationalId: "29302190105544",
      nationality: "مصري",
      department: "الأمن والحراسة",
      jobTitle: "مشرف أمن أول",
      level: "2",
      phone: "01166667777",
      address: "شرم الشيخ",
      gender: "M",
      hireDate: "2022-03-15",
      employmentType: "INTERNAL",
      companyName: "فندق وايت هيلز",
      hotel: "white_hills",
      status: "VACATION",
      vacationStartDate: "2026-09-20",
      vacationEndDate: "2026-09-30",
      vacationNotes: "إجازة سنوية اعتيادية",
      housingEligible: true,
    },

    // --- فندق المرافئ (Al-Marafe Hotel) ---
    {
      profileId: "MAR-301",
      firstName: "أشرف",
      lastName: "سليمان",
      nationalId: "28807180103322",
      nationality: "مصري",
      department: "المطبخ والأغذية",
      jobTitle: "رئيس طهاة تنفيذي",
      level: "1",
      phone: "01277778888",
      address: "شرم الشيخ",
      gender: "M",
      hireDate: "2017-04-10",
      employmentType: "INTERNAL",
      companyName: "فندق المرافئ",
      hotel: "al_marafe",
      status: "ACTIVE",
      housingEligible: true,
    },
    {
      profileId: "MAR-410",
      firstName: "هشام",
      lastName: "خالد",
      nationalId: "29408220106677",
      nationality: "مصري",
      department: "الصيانة والهندسة",
      jobTitle: "فني تكييف وتبريد",
      level: "3",
      phone: "01288889999",
      address: "شرم الشيخ",
      gender: "M",
      hireDate: "2023-01-10",
      employmentType: "INTERNAL",
      companyName: "فندق المرافئ",
      hotel: "al_marafe",
      status: "DEPARTED",
      departureDate: "2026-09-22",
      departureReason: "إنهاء تعاقد وتصفية مستحقات من الـ HR",
      housingEligible: true,
    },
  ];

  let filtered = allRecords;
  if (hotel === "al_taj") {
    filtered = allRecords.filter((r) => r.hotel === "al_taj");
  } else if (hotel === "white_hills") {
    filtered = allRecords.filter((r) => r.hotel === "white_hills");
  } else if (hotel === "al_marafe") {
    filtered = allRecords.filter((r) => r.hotel === "al_marafe");
  }

  res.json(filtered);
});

// ============================================================================
// POST /api/hr-sync/notify-vacation — Direct Vacation Start or Return Webhook
// Body: { propertyId, profileId, type: "START"|"RETURN", startDate?, endDate?, notes? }
// ============================================================================
router.post("/notify-vacation", async (req, res): Promise<void> => {
  const expectedKey = (process.env["HR_SYNC_API_KEY"] || "").trim();
  const providedKey = String(req.headers["x-api-key"] || "").trim();
  if (expectedKey) {
    if (providedKey !== expectedKey) {
      console.warn("[HR_SYNC_AUTH_FAIL_VACATION]", { expectedKey, providedKey });
      res.status(401).json({ success: false, error: "Unauthorized" });
      return;
    }
  } else if (process.env.NODE_ENV === "production") {
    res.status(403).json({
      error: "HR_SYNC_API_KEY not configured — webhook access denied in production",
    });
    return;
  }

  const propertyId =
    Number(req.body?.propertyId) || Number(req.query?.propertyId);
  if (!propertyId) {
    res.status(400).json({ error: "propertyId required" });
    return;
  }

  const {
    profileId,
    employeeId,
    type = "START",
    startDate,
    endDate,
    notes,
  } = req.body as any;

  const targetId = profileId || employeeId;
  if (!targetId) {
    res.status(400).json({ error: "profileId or employeeId required" });
    return;
  }

  const isReturn =
    String(type).toUpperCase() === "RETURN" ||
    String(type).toUpperCase() === "END";

  let updatedProfile: any = null;

  await withTenant(propertyId, async (tenantDb) => {
    const [profile] = await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.profileId, String(targetId)));

    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    if (isReturn) {
      // Return from vacation -> status ACTIVE
      const [emp] = await tenantDb
        .update(profilesTable)
        .set({
          status: "ACTIVE",
          vacationStartDate: null,
          vacationEndDate: null,
          vacationNotes: "",
        })
        .where(eq(profilesTable.id, profile.id))
        .returning();
      updatedProfile = emp;

      await syncEmployeeAccommodationLifecycle({
        tenantDb,
        propertyId,
        profile,
        previousStatus: "VACATION",
        newStatus: "ACTIVE",
        autoVacationSync: true,
        req,
      });
    } else {
      // Start vacation -> status VACATION
      const [emp] = await tenantDb
        .update(profilesTable)
        .set({
          status: "VACATION",
          vacationStartDate:
            startDate || new Date().toISOString().split("T")[0],
          vacationEndDate: endDate || null,
          vacationNotes: notes || "إجازة مسجلة من HR",
        })
        .where(eq(profilesTable.id, profile.id))
        .returning();
      updatedProfile = emp;

      await syncEmployeeAccommodationLifecycle({
        tenantDb,
        propertyId,
        profile,
        previousStatus: profile.status,
        newStatus: "VACATION",
        autoVacationSync: true,
        vacationStartDate: startDate || new Date().toISOString().split("T")[0],
        vacationEndDate: endDate || null,
        vacationNotes: notes || "إجازة مسجلة من HR",
        req,
      });
    }
  });

  if (res.headersSent) return;

  const s = su(req);
  await logActivity({
    req,
    propertyId,
    username: s?.username || "hr-sync",
    userId: s?.userId || 0,
    userRole: s?.userRole || "system",
    action: isReturn
      ? `عودة موظف #${targetId} من الإجازة عبر HR`
      : `خروج موظف #${targetId} في إجازة عبر HR`,
    actionType: "UPDATE",
    module: "hr_sync",
    entityType: "profile",
    entityId: targetId,
  });

  res.json({
    success: true,
    message: isReturn
      ? "Employee returned from vacation successfully"
      : "Employee vacation recorded successfully",
    profile: updatedProfile,
  });
});

// ============================================================================
// POST /api/hr-sync/notify-departure — HR system notifies termination/departure
// Body: { propertyId, profileId, departureDate?, reason? }
// ============================================================================
router.post("/notify-departure", async (req, res): Promise<void> => {
  try {
    const expectedKey = (process.env["HR_SYNC_API_KEY"] || "").trim();
    const providedKey = String(req.headers["x-api-key"] || "").trim();
    if (expectedKey) {
      if (providedKey !== expectedKey) {
        console.warn("[HR_SYNC_AUTH_FAIL_DEP]", { expectedKey, providedKey });
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        error: "HR_SYNC_API_KEY not configured — webhook access denied in production",
      });
      return;
    }

    const propertyId =
      Number(req.body?.propertyId) || Number(req.query?.propertyId);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const {
      profileId,
      employeeId,
      departureDate,
      reason = "Resigned / Terminated from HR",
    } = req.body as any;

    const targetId = profileId || employeeId;
    if (!targetId) {
      res.status(400).json({ error: "profileId or employeeId required" });
      return;
    }

    let checkoutResult: any = null;
    let updatedProfile: any = null;

    await withTenant(propertyId, async (tenantDb) => {
      const [profile] = await tenantDb
        .select()
        .from(profilesTable)
        .where(eq(profilesTable.profileId, String(targetId)));

      if (!profile) {
        res.status(404).json({ success: false, error: "Profile not found" });
        return;
      }

      // Update profile status to departed
      const [emp] = await tenantDb
        .update(profilesTable)
        .set({ status: "DEPARTED" })
        .where(eq(profilesTable.profileId, String(targetId)))
        .returning();
      updatedProfile = emp;

      // Run accommodation checkout & room status transition
      checkoutResult = await syncEmployeeAccommodationLifecycle({
        tenantDb,
        propertyId,
        profile,
        previousStatus: profile.status,
        newStatus: "DEPARTED",
        autoCheckoutOnDeparture: true,
        departureDate,
        departureReason: reason,
        req,
      });
    });

    if (res.headersSent) return;

    // Log activity
    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s?.username || "hr-sync",
      userId: s?.userId || 0,
      userRole: s?.userRole || "system",
      action:
        `تصفية ومغادرة تلقائية للموظف #${targetId} من HR` +
        (checkoutResult
          ? ` — تم إنهاء السكن وإخلاء الغرفة ${checkoutResult.roomNumber}`
          : ""),
      actionType: "UPDATE",
      module: "hr_sync",
      entityType: "profile",
      entityId: typeof targetId === "number" ? targetId : undefined,
    });

    // Sync log
    await pool.query(
      `INSERT INTO public.hr_sync_log (property_id, sync_type, status, records_processed, records_created, records_updated, errors, started_at, completed_at)
       VALUES ($1, 'departure', 'completed', 1, 0, 1, NULL, NOW() - interval '1 second', NOW())`,
      [propertyId],
    );

    res.json({
      success: true,
      message:
        "Profile marked as departed" +
        (checkoutResult
          ? ` and automatically checked out from Room ${checkoutResult.roomNumber}`
          : ""),
      profile: updatedProfile,
      autoCheckout: checkoutResult,
    });
  } catch (err: any) {
    console.error("[NOTIFY_DEPARTURE_ERROR]", err);
    if (!res.headersSent) {
      res.status(500).json({ success: false, error: err.message, stack: err.stack });
    }
  }
});

// ============================================================================
// GET /api/hr-sync/logs — Get sync history for current property
// ============================================================================
router.get(
  "/logs",
  requireAnyPermission(["hr_sync", "view"], ["settings", "view"]),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const limit = Math.min(Number(req.query?.limit) || 20, 100);
    const result = await pool.query(
      `SELECT * FROM public.hr_sync_log WHERE property_id = $1 ORDER BY started_at DESC LIMIT $2`,
      [propertyId],
      );

    res.json({ success: true, logs: result?.rows || [] });
  },
);

// ============================================================================
// GET /api/hr-sync/profiles/:profileId — Full profile data for HR system
// ============================================================================
router.get("/profiles/:profileId", async (req, res): Promise<void> => {
  const expectedKey = process.env["HR_SYNC_API_KEY"];
  const providedKey = req.headers["x-api-key"];
  const isAdmin = Boolean((req as any).session?.userId);
  if (!isAdmin) {
    if (expectedKey) {
      if (providedKey !== expectedKey) {
        res.status(401).json({ success: false, error: "Unauthorized" });
        return;
      }
    } else if (process.env.NODE_ENV === "production") {
      res.status(403).json({
        error: "HR_SYNC_API_KEY not configured — access denied in production",
      });
      return;
    }
  }

  const propertyId = getTenantId(req);
  if (!propertyId) {
    res.status(400).json({ error: "propertyId required" });
    return;
  }

  const { profileId } = req.params;
  if (!profileId) {
    res.status(400).json({ error: "profileId required" });
    return;
  }

  await withTenant(propertyId, async (tenantDb) => {
    const [profile] = await tenantDb
      .select()
      .from(profilesTable)
      .where(eq(profilesTable.profileId, profileId));

    if (!profile) {
      res.status(404).json({ success: false, error: "Profile not found" });
      return;
    }

    const [assignment] = await tenantDb
      .select({
        id: assignmentsTable.id,
        bedNumber: assignmentsTable.bedNumber,
        checkInDate: assignmentsTable.checkInDate,
        expectedCheckOutDate: assignmentsTable.expectedCheckOutDate,
        checkOutDate: assignmentsTable.checkOutDate,
        notes: assignmentsTable.notes,
        status: assignmentsTable.status,
        roomNumber: roomsTable.roomNumber,
        roomType: roomsTable.roomType,
        capacity: roomsTable.capacity,
        buildingName: buildingsTable.name,
      })
      .from(assignmentsTable)
      .leftJoin(roomsTable, eq(assignmentsTable.roomId, roomsTable.id))
      .leftJoin(buildingsTable, eq(roomsTable.buildingId, buildingsTable.id))
      .where(
        and(
          eq(assignmentsTable.profileId, profile.id),
          eq(assignmentsTable.status, "ACTIVE"),
        ),
      );

    res.json({
      success: true,
      profile,
      currentAssignment: assignment || null,
    });
  });
});

// ============================================================================
// Sunrise e-Signature Integration Endpoints (Zero-Hardcode HR Synchronization)
// ============================================================================

// POST /api/hr-sync/esign/test — Test credentials and connectivity
router.post(
  "/esign/test",
  requireAnyPermission(["hr_sync", "view"], ["hr_sync", "edit"], ["settings", "edit"]),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const incoming = req.body || {};
      let config: SunriseEsignConfig | null = null;

      if (incoming.username && incoming.password && incoming.password !== "••••••••") {
        config = {
          baseUrl: incoming.baseUrl,
          username: incoming.username,
          password: incoming.password,
          hotelCode: incoming.hotelCode,
        };
      } else {
        const saved = await getEsignConfig(propertyId);
        config = {
          baseUrl: incoming.baseUrl || saved?.baseUrl,
          username: incoming.username || saved?.username,
          password: (incoming.password && incoming.password !== "••••••••") ? incoming.password : saved?.password,
          hotelCode: incoming.hotelCode || saved?.hotelCode,
        };
      }

      if (!config?.username || !config?.password) {
        res.status(400).json({ success: false, error: "بيانات تسجيل الدخول (اسم المستخدم وكلمة المرور) غير متوفرة" });
        return;
      }
      if (!config?.hotelCode) {
        res.status(400).json({ success: false, error: "كود الفندق (Hotel Code) مطلوب لاختبار الاتصال" });
        return;
      }

      const result = await testEsignConnection(config);
      res.json(result);
    } catch (err: any) {
      console.error("[Esign Test Error]", err);
      res.status(400).json({ success: false, error: err?.message || "فشل الاتصال بسيرفر Sunrise e-Signature" });
    }
  },
);

// GET /api/hr-sync/esign/lookup — Fetch single employee by Employee Code / Clock Number
router.get(
  "/esign/lookup",
  requireAnyPermission(
    ["profiles", "create"],
    ["profiles", "edit"],
    ["profiles", "view"],
    ["hr_sync", "view"],
    ["hr_sync", "edit"],
    ["accommodation", "create"],
  ),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      const clockNo = String(req.query.clockNo || req.query.code || "").trim();
      const hotelCodeOverride = req.query.hotelCode ? String(req.query.hotelCode).trim() : undefined;

      if (!clockNo) {
        res.status(400).json({ success: false, error: "يرجى إدخال الرقم الوظيفي / كود الموظف (clock number)" });
        return;
      }

      const sourceId = req.query.sourceId ? String(req.query.sourceId).trim() : undefined;

      if (sourceId) {
        // Specific source requested
        const config = await getEsignConfigById(propertyId!, sourceId);
        if (!config || !config.username || !config.password) {
          res.status(400).json({
            success: false,
            error: `مصدر الربط "${sourceId}" غير موجود أو غير مكتمل البيانات`,
          });
          return;
        }
        const employee = await fetchEmployeeByCode(config, clockNo, hotelCodeOverride);
        if (!employee) {
          res.json({
            success: false,
            notFound: true,
            message: `لم يتم العثور على أي موظف يحمل الكود (${clockNo}) في المصدر "${config.label || sourceId}"`,
          });
          return;
        }
        res.json({ success: true, employee, sourceId });
      } else {
        // Search ALL active sources
        const { employee, sourceId: foundSourceId } = await fetchEmployeeFromAllSources(propertyId!, clockNo);
        if (!employee) {
          res.json({
            success: false,
            notFound: true,
            message: `لم يتم العثور على أي موظف يحمل الكود (${clockNo}) في أي مصدر من مصادر الربط المتاحة`,
          });
          return;
        }
        res.json({ success: true, employee, sourceId: foundSourceId });
      }
    } catch (err: any) {
      console.error("[Esign Lookup Error]", err);
      res.status(400).json({ success: false, error: err?.message || "فشل جلب بيانات الموظف من HR" });
    }
  },
);

// POST /api/hr-sync/esign/range-sync — Bulk range import/update (fromClockNo -> toClockNo)
router.post(
  "/esign/range-sync",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, error: "propertyId required" });
        return;
      }

      const fromClockNo = parseInt(String(req.body.fromClockNo || req.body.from || ""), 10);
      const toClockNo = parseInt(String(req.body.toClockNo || req.body.to || ""), 10);
      const hotelCodeOverride = req.body.hotelCode ? String(req.body.hotelCode).trim() : undefined;

      if (isNaN(fromClockNo) || isNaN(toClockNo)) {
        res.status(400).json({ success: false, error: "يرجى إدخال نطاق أرقام وظيفية صالح (من كود إلى كود)" });
        return;
      }

      if (fromClockNo > toClockNo) {
        res.status(400).json({ success: false, error: "بداية النطاق يجب أن تكون أقل من أو تساوي نهاية النطاق" });
        return;
      }

      const count = toClockNo - fromClockNo + 1;
      if (count > 2000) {
        res.status(400).json({
          success: false,
          error: "الحد الأقصى للنطاق في المرة الواحدة هو 2000 موظف لمنع الضغط الزائد على الخادم",
        });
        return;
      }

      const sourceId = req.body.sourceId ? String(req.body.sourceId).trim() : undefined;

      let config: SunriseEsignConfig | null = null;
      if (sourceId) {
        config = await getEsignConfigById(propertyId, sourceId);
        if (!config) {
          res.status(400).json({ success: false, error: `مصدر الربط "${sourceId}" غير موجود` });
          return;
        }
      } else {
        config = await getEsignConfig(propertyId);
      }
      if (!config || !config.username || !config.password) {
        res.status(400).json({
          success: false,
          error: "إعدادات الربط مع سيرفر الموارد البشرية غير مهيأة. يرجى إدخال بيانات الربط وحفظها أولاً.",
        });
        return;
      }

      const foundEmployees: any[] = [];
      const notFoundCodes: number[] = [];

      for (let code = fromClockNo; code <= toClockNo; code++) {
        try {
          const emp = await fetchEmployeeByCode(config, code, hotelCodeOverride);
          if (emp) {
            foundEmployees.push(emp);
          } else {
            notFoundCodes.push(code);
          }
        } catch (fetchErr: any) {
          console.warn(`[Esign Range Sync] Error fetching code ${code}:`, fetchErr?.message);
        }
        if (count > 10) {
          await new Promise((r) => setTimeout(r, 30));
        }
      }

      let syncResult = {
        stats: { totalReceived: 0, created: 0, updated: 0, departedAutoCheckouts: 0, casualUpgrades: 0, lookupsAdded: 0, errors: [] as string[] },
      };

      if (foundEmployees.length > 0) {
        syncResult = await processReceive(propertyId, foundEmployees, req, {}, {
          sourceName: "Sunrise e-Signature Range Sync",
        });
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `استيراد بالنطاق من HR (${fromClockNo} إلى ${toClockNo}) — تم فحص ${count} رقم وظيفي، وُجد ${foundEmployees.length} موظف، تم إنشاء ${syncResult.stats.created}، وتحديث ${syncResult.stats.updated}`,
        actionType: "SYNC",
        module: "hr_sync",
        entityType: "profile",
        entityId: propertyId,
      });

      res.json({
        success: true,
        scannedCount: count,
        foundCount: foundEmployees.length,
        notFoundCount: notFoundCodes.length,
        stats: syncResult.stats,
      });
    } catch (err: any) {
      console.error("[Esign Range Sync Error]", err);
      res.status(500).json({ success: false, error: err?.message || "حدث خطأ أثناء الاستيراد بالنطاق" });
    }
  },
);

// POST /api/hr-sync/esign/refresh-existing — Batch refresh & correct current profiles from HR
router.post(
  "/esign/refresh-existing",
  requireAnyPermission(["hr_sync", "edit"], ["settings", "edit"]),
  async (req, res): Promise<void> => {
    try {
      const propertyId = getTenantId(req);
      if (!propertyId) {
        res.status(400).json({ success: false, error: "propertyId required" });
        return;
      }

      const sourceId = req.body.sourceId ? String(req.body.sourceId).trim() : undefined;

      let config: SunriseEsignConfig | null = null;
      if (sourceId) {
        config = await getEsignConfigById(propertyId, sourceId);
        if (!config) {
          res.status(400).json({ success: false, error: `مصدر الربط "${sourceId}" غير موجود` });
          return;
        }
      } else {
        config = await getEsignConfig(propertyId);
      }
      if (!config || !config.username || !config.password) {
        res.status(400).json({
          success: false,
          error: "إعدادات الربط مع سيرفر الموارد البشرية غير مهيأة. يرجى تهيئتها أولاً.",
        });
        return;
      }

      // Query all profiles in the current property that have a profileId
      let existingProfiles: any[] = [];
      await withTenant(propertyId, async (tenantDb) => {
        existingProfiles = await tenantDb
          .select({
            id: profilesTable.id,
            profileId: profilesTable.profileId,
            firstName: profilesTable.firstName,
            lastName: profilesTable.lastName,
          })
          .from(profilesTable);
      });

      const validProfiles = existingProfiles.filter((p) => p.profileId && String(p.profileId).trim() !== "");
      const foundEmployees: any[] = [];
      let checked = 0;
      let notFoundInHr = 0;

      for (const p of validProfiles) {
        checked++;
        try {
          const emp = await fetchEmployeeByCode(config, p.profileId);
          if (emp) {
            foundEmployees.push(emp);
          } else {
            notFoundInHr++;
          }
        } catch (fetchErr: any) {
          console.warn(`[Esign Batch Refresh] Error checking profile ${p.profileId}:`, fetchErr?.message);
        }
        if (validProfiles.length > 20) {
          await new Promise((r) => setTimeout(r, 30));
        }
      }

      let syncResult = {
        stats: { totalReceived: 0, created: 0, updated: 0, departedAutoCheckouts: 0, casualUpgrades: 0, lookupsAdded: 0, errors: [] as string[] },
      };

      if (foundEmployees.length > 0) {
        syncResult = await processReceive(propertyId, foundEmployees, req, {}, {
          sourceName: "Sunrise e-Signature Batch Refresh",
        });
      }

      const s = su(req);
      await logActivity({
        req,
        propertyId,
        username: s.username,
        userId: s.userId,
        userRole: s.userRole,
        action: `تحديث وتصحيح بيانات موظفي السكن الحاليين من HR — تم فحص ${checked} ملف، تحديث ${syncResult.stats.updated}، وإضافة ${syncResult.stats.lookupsAdded} مسميات`,
        actionType: "UPDATE",
        module: "hr_sync",
        entityType: "profile",
        entityId: propertyId,
      });

      res.json({
        success: true,
        totalChecked: checked,
        updatedCount: syncResult.stats.updated,
        notFoundInHr,
        stats: syncResult.stats,
      });
    } catch (err: any) {
      console.error("[Esign Batch Refresh Error]", err);
      res.status(500).json({ success: false, error: err?.message || "حدث خطأ أثناء تحديث بيانات الموظفين" });
    }
  },
);

export default router;
