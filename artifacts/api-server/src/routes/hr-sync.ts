import { Router } from "express";
import {
  db,
  pool,
  withTenant,
  profilesTable,
  profileVacationsTable,
  assignmentsTable,
  roomsTable,
  buildingsTable,
  propertiesTable,
} from "@workspace/db";
import { eq, and, inArray, desc } from "drizzle-orm";
import { z } from "zod";
import { logActivity } from "../lib/activity-logger.js";
import { ensureProfilePortalAccount } from "../lib/portal-accounts.js";
import { requirePermission } from "../middlewares/permissions.js";
import { getTenantId, su } from "../lib/request-utils.js";
import { broadcastToProperty } from "../lib/websocket.js";

const HrSyncConfigSchema = z.object({
  apiUrl: z.string().url().optional().nullable(),
  apiKey: z.string().optional().nullable(),
  fieldMapping: z.record(z.string()).optional().nullable(),
  isActive: z.boolean().optional(),
  autoCheckoutOnDeparture: z.boolean().optional(),
  autoVacationSync: z.boolean().optional(),
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
    "emp_id",
    "empCode",
    "code",
    "id",
  ]);
  const profileId = rawProfileId ? String(rawProfileId).trim() : "";

  const firstName = getVal("firstName", ["first_name", "first"]) ?? "";
  const lastName = getVal("lastName", ["last_name", "last"]) ?? "";
  const thirdName =
    getVal("thirdName", ["third_name", "father_name", "middle_name"]) ?? "";
  const fourthName =
    getVal("fourthName", ["fourth_name", "family_name", "grand_father"]) ?? "";
  const nationalId =
    getVal("nationalId", ["national_id", "iqama", "ssn", "nid"]) ?? "";
  const nationality = getVal("nationality", ["country"]) ?? "";
  const address = getVal("address", ["street", "residence"]) ?? "";
  const jobTitle =
    getVal("jobTitle", ["job_title", "position", "title", "role"]) ?? "";
  const level = getVal("level", ["grade", "job_level", "jobLevel"]) ?? "";
  const phone =
    getVal("phone", ["mobile", "telephone", "phone_number", "phoneNumber"]) ??
    "";
  const department = getVal("department", ["dept", "section"]) ?? "";
  const hireDate =
    getVal("hireDate", ["hire_date", "joining_date", "hired_at"]) ??
    new Date().toISOString().split("T")[0];
  const dateOfBirth =
    getVal("dateOfBirth", ["date_of_birth", "birth_date", "dob"]) ?? "";
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

  return {
    profileId,
    firstName: String(firstName).trim(),
    lastName: String(lastName).trim(),
    thirdName: String(thirdName).trim(),
    fourthName: String(fourthName).trim(),
    nationalId: String(nationalId).trim(),
    nationality: String(nationality).trim(),
    address: String(address).trim(),
    jobTitle: String(jobTitle).trim(),
    level: String(level).trim(),
    phone: String(phone).trim(),
    department: String(department).trim(),
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
          ? `Auto checkout — HR departure / clearance: ${departureReason}`
          : "Auto checkout — HR departure / clearance notification";

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
            priority: "high",
            title: "إنذار تصفية موظف من الموارد البشرية",
            message: `تم تسجيل مغادرة/تصفية الموظف ${profile.firstName} ${profile.lastName} (${profile.profileId}) من الموارد البشرية وإخلاء غرفته رقم ${room.roomNumber} (سرير ${activeAssign.bedNumber}). يرجى فحص وتنظيف الغرفة.`,
            profileId: profile.profileId,
            profileName: `${profile.firstName} ${profile.lastName}`,
            roomId: room.id,
            roomNumber: room.roomNumber,
            bedNumber: activeAssign.bedNumber,
            assignmentId: activeAssign.id,
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
        const s = req ? su(req) : null;
        await logActivity({
          req: req || null,
          propertyId,
          username: s?.username || "hr-sync",
          userId: s?.userId || 0,
          userRole: s?.userRole || "system",
          action: `تصفية موظف من الموارد البشرية (HR) — إنهاء سكن الموظف #${profile.profileId} (${profile.firstName} ${profile.lastName}) وإخلاء السرير`,
          actionType: "UPDATE",
          module: "hr_sync",
          entityType: "assignment",
          entityId: activeAssign.id,
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
            profileId: profile.profileId,
          });
          broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
        }
      }
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
      await tenantDb
        .update(profileVacationsTable)
        .set({
          status: "COMPLETED",
          actualReturnDate: new Date().toISOString().split("T")[0],
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
          profileId: profile.profileId,
        });
        broadcastToProperty(propertyId, { module: "dashboard", action: "sync" });
      }
    }
  } catch (err) {
    console.error("[HrSync] Error in syncEmployeeAccommodationLifecycle:", err);
  }

  return checkoutResult;
}

// ============================================================================
// Core batch processor for receive/sync
// ============================================================================
async function processReceive(
  propertyId: number,
  profiles: any[],
  req?: any,
  mapping: Record<string, string> = {},
) {
  let created = 0,
    updated = 0,
    departedAutoCheckouts = 0,
    errors: string[] = [];

  // Fetch sync config options
  const configRes = await pool.query(
    `SELECT auto_checkout_on_departure, auto_vacation_sync FROM public.hr_sync_config WHERE property_id = $1`,
    [propertyId],
  );
  const autoCheckoutOnDeparture =
    configRes?.rows?.[0]?.auto_checkout_on_departure ?? true;
  const autoVacationSync = configRes?.rows?.[0]?.auto_vacation_sync ?? true;

  await withTenant(propertyId, async (tenantDb) => {
    // Extract & normalize all incoming employee objects
    const normalizedProfiles = profiles
      .map((p) => extractProfileFields(p, mapping))
      .filter((p) => Boolean(p.profileId));

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

    for (const emp of normalizedProfiles) {
      try {
        const existing = existingMap.get(emp.profileId);

        if (existing) {
          const previousStatus = existing.status;

          // Update profile with all fields
          await tenantDb
            .update(profilesTable)
            .set({
              firstName: emp.firstName || existing.firstName,
              lastName: emp.lastName || existing.lastName,
              thirdName: emp.thirdName || existing.thirdName,
              fourthName: emp.fourthName || existing.fourthName,
              nationalId: emp.nationalId || existing.nationalId,
              nationality: emp.nationality || existing.nationality,
              jobTitle: emp.jobTitle || existing.jobTitle,
              department: emp.department || existing.department,
              phone: emp.phone || existing.phone,
              address: emp.address || existing.address,
              status: emp.status || existing.status,
              gender: emp.gender || existing.gender,
              level: emp.level || existing.level,
              hireDate: emp.hireDate || existing.hireDate,
              dateOfBirth: emp.dateOfBirth || existing.dateOfBirth,
              email: emp.email || existing.email,
              emergencyContact:
                emp.emergencyContact || existing.emergencyContact,
              contractEndDate: emp.contractEndDate ?? existing.contractEndDate,
              employmentType: emp.employmentType || existing.employmentType,
              companyName: emp.companyName || existing.companyName,
              photoUrl: emp.photoUrl || existing.photoUrl,
              idImage: emp.idImage || existing.idImage,
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
            })
            .where(eq(profilesTable.profileId, emp.profileId));

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
          updated++;
        } else {
          // Insert new profile with all fields
          const [inserted] = await tenantDb
            .insert(profilesTable)
            .values({
              profileId: emp.profileId,
              firstName: emp.firstName || "",
              lastName: emp.lastName || "",
              thirdName: emp.thirdName || "",
              fourthName: emp.fourthName || "",
              nationalId: emp.nationalId || "",
              nationality: emp.nationality || "",
              jobTitle: emp.jobTitle || "",
              department: emp.department || "",
              phone: emp.phone || "",
              address: emp.address || "",
              status: emp.status || "UNASSIGNED",
              gender: emp.gender || "M",
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
            })
            .returning();

          if (
            emp.status === "VACATION" &&
            emp.vacationStartDate &&
            emp.vacationEndDate
          ) {
            await tenantDb.insert(profileVacationsTable).values({
              profileId: inserted.id,
              startDate: emp.vacationStartDate,
              endDate: emp.vacationEndDate,
              notes: emp.vacationNotes || "Synced from HR system",
              status: "ACTIVE",
            });
          }

          created++;
        }
      } catch (err: any) {
        errors.push(`${emp.profileId || "unknown"}: ${err.message || "sync error"}`);
      }
    }
  });

  // Ensure portal accounts
  for (const emp of profiles) {
    const pId = emp.profileId || emp.employeeId || emp.emp_id;
    if (pId) {
      try {
        await ensureProfilePortalAccount(propertyId, String(pId));
      } catch {}
    }
  }

  // Log sync result
  await pool.query(
    `INSERT INTO public.hr_sync_log (property_id, sync_type, status, records_processed, records_created, records_updated, errors, started_at, completed_at)
     VALUES ($1, 'push', $2, $3, $4, $5, $6, NOW() - interval '1 second', NOW())`,
    [
      propertyId,
      errors.length > 0 ? "completed_with_errors" : "completed",
      profiles.length,
      created,
      updated,
      errors.length > 0 ? errors.slice(0, 10).join("; ") : null,
    ],
  );

  return {
    success: true,
    stats: {
      received: profiles.length,
      created,
      updated,
      departedAutoCheckouts,
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
  requirePermission("settings", "view"),
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
          lastSyncAt: null,
        },
      });
      return;
    }
    const row = configRes.rows[0];
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
  requirePermission("settings", "edit"),
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
    } = parsed.data;

    const existing = await pool.query(
      `SELECT id FROM public.hr_sync_config WHERE property_id = $1`,
      [propertyId],
    );

    if (existing?.rows?.[0]) {
      const updates: any = { updated_at: new Date() };
      if (apiUrl !== undefined) updates.api_url = apiUrl;
      if (apiKey !== undefined) updates.api_key = apiKey;
      if (fieldMapping !== undefined)
        updates.field_mapping = JSON.stringify(fieldMapping);
      if (isActive !== undefined) updates.is_active = isActive;
      if (autoCheckoutOnDeparture !== undefined)
        updates.auto_checkout_on_departure = autoCheckoutOnDeparture;
      if (autoVacationSync !== undefined)
        updates.auto_vacation_sync = autoVacationSync;

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
        `INSERT INTO public.hr_sync_config (property_id, api_url, api_key, field_mapping, is_active, auto_checkout_on_departure, auto_vacation_sync, updated_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          propertyId,
          apiUrl || "",
          apiKey || "",
          JSON.stringify(fieldMapping || {}),
          isActive || false,
          autoCheckoutOnDeparture ?? true,
          autoVacationSync ?? true,
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
      action: `تحديث إعدادات ربط HR`,
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
// Body: { propertyId, profiles: [...] }
// ============================================================================
router.post("/receive", async (req, res): Promise<void> => {
  const expectedKey = (process.env["HR_SYNC_API_KEY"] || "").trim();
  const providedKey = String(req.headers["x-api-key"] || "").trim();
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

  const result = await processReceive(propertyId, profiles, req);

  const s = su(req);
  await logActivity({
    req,
    propertyId,
    username: s?.username || "hr-webhook",
    userId: s?.userId || 0,
    userRole: s?.userRole || "system",
    action: `استقبال بيانات موظفين من HR (Push) — تم إنشاء ${result.stats.created} وتحديث ${result.stats.updated} وإخلاء ${result.stats.departedAutoCheckouts}`,
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
  requirePermission("settings", "edit"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId required" });
      return;
    }

    const configResult = await pool.query(
      `SELECT * FROM public.hr_sync_config WHERE property_id = $1 AND is_active = true`,
      [propertyId],
    );
    const config = configResult?.rows?.[0];
    if (!config) {
      res.status(400).json({
        error: "HR sync not configured or not active for this property",
      });
      return;
    }

    if (!config.api_url) {
      res.status(400).json({ error: "API URL not configured" });
      return;
    }

    const logEntry = await pool.query(
      `INSERT INTO public.hr_sync_log (property_id, sync_type, status, started_at)
     VALUES ($1, 'pull', 'in_progress', NOW()) RETURNING id`,
      [propertyId],
    );
    const logId = logEntry?.rows?.[0]?.id;

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (config.api_key) headers["Authorization"] = `Bearer ${config.api_key}`;

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 45000);
      const response = await fetch(config.api_url, {
        headers,
        signal: controller.signal as any,
      });
      clearTimeout(timeoutId);

      if (!response.ok)
        throw new Error(
          `HR API returned ${response.status}: ${response.statusText}`,
        );

      const data = (await response.json()) as any;
      const profiles = Array.isArray(data)
        ? data
        : data.profiles || data.employees || data.data || [];

      if (!Array.isArray(profiles) || profiles.length === 0) {
        throw new Error("No profiles data received from HR API");
      }

      const mapping = config.field_mapping || {};
      const receiveRes = await processReceive(
        propertyId,
        profiles,
        req,
        mapping,
      );

      // Update sync log
      await pool.query(
        `UPDATE public.hr_sync_log SET status = $1, records_processed = $2, records_created = $3, records_updated = $4, errors = $5, completed_at = NOW()
       WHERE id = $6`,
        [
          receiveRes.errors?.length > 0 ? "completed_with_errors" : "completed",
          receiveRes.stats?.received || 0,
          receiveRes.stats?.created || 0,
          receiveRes.stats?.updated || 0,
          receiveRes.errors?.slice(0, 10).join("; ") || null,
          logId,
        ],
      );

      // Update last sync timestamp
      await pool.query(
        `UPDATE public.hr_sync_config SET last_sync_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [config.id],
      );

      res.json(receiveRes);
    } catch (err: any) {
      await pool.query(
        `UPDATE public.hr_sync_log SET status = 'failed', errors = $1, completed_at = NOW() WHERE id = $2`,
        [err.message, logId],
      );
      res.status(500).json({ success: false, error: "Sync failed: " + err.message });
    }
  },
);

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
  requirePermission("settings", "view"),
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
  if (expectedKey) {
    const providedKey = req.headers["x-api-key"];
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

export default router;
