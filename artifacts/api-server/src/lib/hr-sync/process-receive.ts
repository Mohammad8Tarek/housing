/**
 * hr-sync/process-receive.ts — Core batch processor for /receive and /sync.
 */
import {
  pool,
  withTenant,
  profilesTable,
  profileDocumentsTable,
  profileVacationsTable,
  profilePortalAccountsTable,
} from "@workspace/db";
import { eq } from "drizzle-orm";
import { logActivity } from "../activity-logger.js";
import { ensureProfilePortalAccount } from "../portal-accounts.js";
import { su } from "../request-utils.js";
import {
  enrichProfileBilingual,
  translateDepartment,
  translateJobTitle,
} from "../bilingual-translator.js";
import { extractProfileFields } from "./profile-fields.js";
import { syncEmployeeAccommodationLifecycle } from "./lifecycle.js";
import { autoRegisterLookups } from "./lookups.js";

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
        const raw = rawProfiles.find(
          (rp: any) =>
            String(
              rp.profileId || rp.employeeId || rp.emp_id || rp.id || "",
            ).trim() === p.profileId,
        );
        if (!raw) return true;
        if (
          raw.housingEligible === false ||
          raw.isHousingEligible === false ||
          raw.housing_eligible === false
        ) {
          return false;
        }
        return true;
      });
    }

    // 3. Allowed Levels filter (e.g. only Levels 0, 1, 2 for executive housing)
    if (options.allowedLevels && options.allowedLevels.length > 0) {
      const allowedSet = new Set(
        options.allowedLevels.map((l) => String(l).trim()),
      );
      normalizedProfiles = normalizedProfiles.filter((p) =>
        allowedSet.has(String(p.level).trim()),
      );
    }

    // 4. Allowed Departments filter
    if (options.allowedDepartments && options.allowedDepartments.length > 0) {
      const deptSet = new Set(
        options.allowedDepartments.map((d) => String(d).trim().toLowerCase()),
      );
      normalizedProfiles = normalizedProfiles.filter((p) =>
        deptSet.has(String(p.department).trim().toLowerCase()),
      );
    }

    // 5. Auto-register lookup values (departments, job titles, levels, companies)
    const lookupRes = await autoRegisterLookups(
      tenantDb,
      normalizedProfiles,
      propertyId,
    );
    lookupsAdded = lookupRes.added;

    // If scope is lookups_only, return immediately after autoRegisterLookups
    if (options.scope === "lookups_only") {
      return;
    }

    const syncProfiles =
      options.syncProfiles !== false && options.scope !== "movements_only";

    // 6. Query all existing profiles in current property for ultra-reliable matching
    const allExistingProfiles = await tenantDb.select().from(profilesTable);

    const byExactProfileId = new Map<string, any>();
    const byUnpaddedCode = new Map<string, any>();
    const byNationalId = new Map<string, any>();

    const normKey = (v: any) =>
      String(v ?? "")
        .trim()
        .toLowerCase();
    const stripZeros = (v: any) => {
      const s = normKey(v);
      const stripped = s.replace(/^0+/, "");
      return stripped || s;
    };

    for (const p of allExistingProfiles) {
      const pId = normKey(p.profileId);
      if (pId) {
        byExactProfileId.set(pId, p);
        const unpadded = stripZeros(p.profileId);
        if (unpadded) byUnpaddedCode.set(unpadded, p);
      }
      const nid = normKey(p.nationalId);
      if (nid) {
        byNationalId.set(nid, p);
      }
    }

    for (const emp of normalizedProfiles) {
      try {
        const empCode = normKey(emp.profileId);
        const empUnpadded = stripZeros(emp.profileId);
        const empNid = normKey(emp.nationalId);

        let existing =
          (empCode ? byExactProfileId.get(empCode) : undefined) ||
          (empUnpadded ? byUnpaddedCode.get(empUnpadded) : undefined) ||
          (empNid ? byNationalId.get(empNid) : undefined);

        let isCasualUpgrade = false;
        let oldProfileId = "";

        // Check if existing profile matches by nationalId (Casual to Permanent transition)
        if (
          existing &&
          empNid &&
          byNationalId.get(empNid) === existing &&
          empCode &&
          normKey(existing.profileId) !== empCode
        ) {
          isCasualUpgrade = true;
          oldProfileId = existing.profileId;
        }

        if (existing) {
          const previousStatus = existing.status;

          // If syncProfiles is enabled OR this is a casual-to-permanent upgrade:
          if (syncProfiles || isCasualUpgrade) {
            const deptChanged = Boolean(
              emp.department &&
              emp.department.trim() !== "" &&
              emp.department.trim().toLowerCase() !==
                String(existing.department || "")
                  .trim()
                  .toLowerCase(),
            );
            const titleChanged = Boolean(
              emp.jobTitle &&
              emp.jobTitle.trim() !== "" &&
              emp.jobTitle.trim().toLowerCase() !==
                String(existing.jobTitle || "")
                  .trim()
                  .toLowerCase(),
            );

            // Compute target department and bilingual translation
            const targetDept = deptChanged
              ? emp.department.trim()
              : emp.department || existing.department || "";
            const targetDeptAr = deptChanged
              ? emp.departmentAr
                ? emp.departmentAr.trim()
                : translateDepartment(targetDept, "ar")
              : emp.departmentAr ||
                existing.departmentAr ||
                translateDepartment(targetDept, "ar");

            // Compute target job title and bilingual translation
            const targetTitle = titleChanged
              ? emp.jobTitle.trim()
              : emp.jobTitle || existing.jobTitle || "";
            const targetTitleAr = titleChanged
              ? emp.jobTitleAr
                ? emp.jobTitleAr.trim()
                : translateJobTitle(targetTitle, "ar")
              : emp.jobTitleAr ||
                existing.jobTitleAr ||
                translateJobTitle(targetTitle, "ar");

            // Compute target level
            const targetLevel =
              emp.level !== undefined &&
              emp.level !== null &&
              String(emp.level).trim() !== ""
                ? String(emp.level).trim()
                : existing.level || "";

            const enrichedUpdate = enrichProfileBilingual({
              firstName: emp.firstName || existing.firstName,
              lastName: emp.lastName || existing.lastName,
              thirdName: emp.thirdName || existing.thirdName,
              fourthName: emp.fourthName || existing.fourthName,
              firstNameAr: emp.firstNameAr || existing.firstNameAr,
              lastNameAr: emp.lastNameAr || existing.lastNameAr,
              thirdNameAr: emp.thirdNameAr || existing.thirdNameAr,
              fourthNameAr: emp.fourthNameAr || existing.fourthNameAr,
              department: targetDept,
              departmentAr: targetDeptAr,
              jobTitle: targetTitle,
              jobTitleAr: targetTitleAr,
            });

            const changedFields: string[] = [];
            const checkDiff = (labelAr: string, newVal: any, oldVal: any) => {
              if (
                newVal !== undefined &&
                newVal !== null &&
                String(newVal).trim() !== "" &&
                String(newVal).trim() !== String(oldVal ?? "").trim()
              ) {
                changedFields.push(labelAr);
              }
            };
            checkDiff("الاسم الأول", emp.firstName, existing.firstName);
            checkDiff("الاسم الثاني", emp.lastName, existing.lastName);
            checkDiff("الاسم الثالث", emp.thirdName, existing.thirdName);
            checkDiff("الاسم الرابع", emp.fourthName, existing.fourthName);
            checkDiff("الرقم القومي", emp.nationalId, existing.nationalId);
            checkDiff("الجنسية", emp.nationality, existing.nationality);
            checkDiff("العنوان", emp.address, existing.address);
            checkDiff("الهاتف", emp.phone, existing.phone);
            checkDiff("القسم", targetDept, existing.department);
            checkDiff("المسمى الوظيفي", targetTitle, existing.jobTitle);
            checkDiff("الدرجة", targetLevel, existing.level);
            checkDiff("الحالة", emp.status, existing.status);
            checkDiff(
              "انتهاء العقد",
              emp.contractEndDate,
              existing.contractEndDate,
            );
            checkDiff("الصورة", emp.photoUrl, existing.photoUrl);
            checkDiff("صورة البطاقة", emp.idImage, existing.idImage);

            const updateData: any = {
              firstName:
                emp.firstName !== undefined && emp.firstName !== ""
                  ? emp.firstName
                  : existing.firstName,
              lastName:
                emp.lastName !== undefined && emp.lastName !== ""
                  ? emp.lastName
                  : existing.lastName,
              thirdName:
                emp.thirdName !== undefined
                  ? emp.thirdName
                  : existing.thirdName,
              fourthName:
                emp.fourthName !== undefined
                  ? emp.fourthName
                  : existing.fourthName,
              firstNameAr: enrichedUpdate.firstNameAr ?? existing.firstNameAr,
              lastNameAr: enrichedUpdate.lastNameAr ?? existing.lastNameAr,
              thirdNameAr: enrichedUpdate.thirdNameAr ?? existing.thirdNameAr,
              fourthNameAr:
                enrichedUpdate.fourthNameAr ?? existing.fourthNameAr,
              nationalId:
                emp.nationalId !== undefined && emp.nationalId !== ""
                  ? emp.nationalId
                  : existing.nationalId,
              nationality:
                emp.nationality !== undefined && emp.nationality !== ""
                  ? emp.nationality
                  : existing.nationality,
              jobTitle: enrichedUpdate.jobTitle || targetTitle,
              jobTitleAr: enrichedUpdate.jobTitleAr || targetTitleAr,
              department: enrichedUpdate.department || targetDept,
              departmentAr: enrichedUpdate.departmentAr || targetDeptAr,
              phone:
                emp.phone !== undefined && emp.phone !== ""
                  ? emp.phone
                  : existing.phone,
              address:
                emp.address !== undefined && emp.address !== ""
                  ? emp.address
                  : existing.address,
              status: emp.status || existing.status,
              gender: (emp as any).gender || existing.gender,
              level: targetLevel,
              hireDate: emp.hireDate || existing.hireDate,
              dateOfBirth:
                emp.dateOfBirth !== undefined && emp.dateOfBirth !== ""
                  ? emp.dateOfBirth
                  : existing.dateOfBirth,
              email:
                emp.email !== undefined && emp.email !== ""
                  ? emp.email
                  : existing.email,
              emergencyContact:
                emp.emergencyContact !== undefined &&
                emp.emergencyContact !== ""
                  ? emp.emergencyContact
                  : existing.emergencyContact,
              contractEndDate:
                emp.contractEndDate !== undefined
                  ? emp.contractEndDate
                  : existing.contractEndDate,
              employmentType:
                emp.employmentType ||
                (isCasualUpgrade ? "INTERNAL" : existing.employmentType),
              companyName:
                emp.companyName !== undefined && emp.companyName !== ""
                  ? emp.companyName
                  : existing.companyName,
              photoUrl:
                emp.photoUrl !== undefined ? emp.photoUrl : existing.photoUrl,
              idImage:
                emp.idImage !== undefined ? emp.idImage : existing.idImage,
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
            if (
              emp.documents &&
              Array.isArray(emp.documents) &&
              emp.documents.length > 0
            ) {
              try {
                const existingDocs = await tenantDb
                  .select({ fileName: profileDocumentsTable.fileName })
                  .from(profileDocumentsTable)
                  .where(eq(profileDocumentsTable.profileId, existing.id));
                const existingNames = new Set(
                  existingDocs.map((d: any) => d.fileName),
                );
                const newDocs = emp.documents.filter(
                  (d: any) => !existingNames.has(d.fileName),
                );
                if (newDocs.length > 0) {
                  await tenantDb.insert(profileDocumentsTable).values(
                    newDocs.map((d: any) => ({
                      profileId: existing.id,
                      fileName: d.fileName,
                      fileType: d.fileType || "application/octet-stream",
                      fileData: d.fileData,
                    })),
                  );
                  changedFields.push(`مستندات (${newDocs.length} ملف جديد)`);
                }
              } catch (docErr) {
                console.warn(
                  `[HrSync] Error inserting documents for profile ${existing.id}`,
                  docErr,
                );
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
                  .where(
                    eq(profilePortalAccountsTable.profileId, oldProfileId),
                  );
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

            Object.assign(existing, updateData);
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

          if (inserted) {
            const insCode = normKey(inserted.profileId);
            if (insCode) {
              byExactProfileId.set(insCode, inserted);
              const insUnpadded = stripZeros(inserted.profileId);
              if (insUnpadded) byUnpaddedCode.set(insUnpadded, inserted);
            }
            const insNid = normKey(inserted.nationalId);
            if (insNid) byNationalId.set(insNid, inserted);
          }

          if (
            emp.status === "VACATION" &&
            autoVacationSync &&
            emp.vacationStartDate
          ) {
            await tenantDb
              .insert(profileVacationsTable)
              .values({
                profileId: inserted.id,
                startDate: emp.vacationStartDate,
                endDate: emp.vacationEndDate || emp.vacationStartDate,
                notes: emp.vacationNotes || "Synced from HR system",
                status: "ACTIVE",
              })
              .catch(() => {});
          }

          if (inserted && inserted.profileId) {
            await ensureProfilePortalAccount(
              propertyId,
              inserted.profileId,
            ).catch(() => {});
          }

          // Insert documents for new profile from HR
          if (
            emp.documents &&
            Array.isArray(emp.documents) &&
            emp.documents.length > 0 &&
            inserted?.id
          ) {
            try {
              await tenantDb.insert(profileDocumentsTable).values(
                emp.documents.map((d: any) => ({
                  profileId: inserted.id,
                  fileName: d.fileName,
                  fileType: d.fileType || "application/octet-stream",
                  fileData: d.fileData,
                })),
              );
            } catch (docErr) {
              console.warn(
                `[HrSync] Error inserting documents for new profile ${inserted.id}`,
                docErr,
              );
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
        errors.push(
          `${emp.profileId || "unknown"}: ${err.message || "sync error"}`,
        );
      }
    }
  });

  return {
    success: true,
    stats: {
      received: rawProfiles.length,
      totalReceived: rawProfiles.length,
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
