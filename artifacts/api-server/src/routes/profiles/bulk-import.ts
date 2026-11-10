import { Router } from "express";
import { withTenant, profilesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { logActivity } from "../../lib/activity-logger.js";
import { requirePermission } from "../../middlewares/permissions.js";
import { ensureProfilePortalAccount } from "../../lib/portal-accounts.js";
import { getTenantId, su } from "../../lib/request-utils.js";
import { broadcastToProperty } from "../../lib/websocket.js";
import { enrichProfileBilingual } from "../../lib/bilingual-translator.js";

const router: Router = Router();

router.post(
  "/profiles/bulk",
  requirePermission("profiles", "create"),
  async (req, res): Promise<void> => {
    const propertyId = getTenantId(req);
    if (!propertyId) {
      res.status(400).json({ error: "propertyId is required" });
      return;
    }

    const { profiles: rawProfiles } = req.body;
    if (!Array.isArray(rawProfiles) || rawProfiles.length === 0) {
      res.status(400).json({ error: "profiles array is required and must not be empty" });
      return;
    }

    const maxBulkLimit = 5000;
    const toProcess = rawProfiles.slice(0, maxBulkLimit);

    const result = await withTenant(propertyId, async (tenantDb) => {
      // 1. Fetch all existing profiles in this tenant for duplicate & update detection
      const existing = await tenantDb
        .select({
          id: profilesTable.id,
          profileId: profilesTable.profileId,
          nationalId: profilesTable.nationalId,
          phone: profilesTable.phone,
          firstName: profilesTable.firstName,
          lastName: profilesTable.lastName,
          thirdName: profilesTable.thirdName,
          fourthName: profilesTable.fourthName,
          firstNameAr: profilesTable.firstNameAr,
          lastNameAr: profilesTable.lastNameAr,
          thirdNameAr: profilesTable.thirdNameAr,
          fourthNameAr: profilesTable.fourthNameAr,
          department: profilesTable.department,
          departmentAr: profilesTable.departmentAr,
          jobTitle: profilesTable.jobTitle,
          jobTitleAr: profilesTable.jobTitleAr,
          level: profilesTable.level,
          nationality: profilesTable.nationality,
          gender: profilesTable.gender,
          employmentType: profilesTable.employmentType,
          companyName: profilesTable.companyName,
          email: profilesTable.email,
          emergencyContact: profilesTable.emergencyContact,
          dateOfBirth: profilesTable.dateOfBirth,
          hireDate: profilesTable.hireDate,
          contractEndDate: profilesTable.contractEndDate,
          address: profilesTable.address,
          status: profilesTable.status,
        })
        .from(profilesTable);

      const dbByProfileId = new Map<string, (typeof existing)[0]>();
      const dbByNationalId = new Map<string, (typeof existing)[0]>();
      for (const e of existing) {
        if (e.profileId) dbByProfileId.set(e.profileId.trim().toLowerCase(), e);
        if (e.nationalId) dbByNationalId.set(e.nationalId.trim(), e);
      }

      // Tracking sets for duplicates within current batch
      const batchSeenProfileIds = new Set<string>();
      const batchSeenNationalIds = new Set<string>();

      const rowsToInsert: any[] = [];
      const rowsToUpdate: Array<{ id: number; profileId: string; updates: Record<string, any>; diffSummary: string[] }> = [];
      const skippedItems: Array<{
        profileId: string;
        name: string;
        nationalId: string;
        phone: string;
        reason: string;
      }> = [];

      for (let i = 0; i < toProcess.length; i++) {
        const p = toProcess[i];
        const pId = String(p.profileId || "").trim();
        const nid = String(p.nationalId || "").trim();
        const ph = String(p.phone || "").trim();
        const pName = [p.firstName, p.lastName, p.thirdName, p.fourthName].filter(Boolean).join(" ").trim() || pId || `Row ${i + 1}`;
        const lowerPid = pId.toLowerCase();

        // 1. Check duplicate within current file batch
        if (lowerPid && batchSeenProfileIds.has(lowerPid)) {
          skippedItems.push({
            profileId: pId,
            name: pName,
            nationalId: nid,
            phone: ph,
            reason: `كود الموظف مكرر داخل نفس ملف الإكسل (${pId})`,
          });
          continue;
        }
        if (nid && batchSeenNationalIds.has(nid)) {
          skippedItems.push({
            profileId: pId,
            name: pName,
            nationalId: nid,
            phone: ph,
            reason: `الرقم القومي مكرر داخل نفس ملف الإكسل (${nid})`,
          });
          continue;
        }

        // Register in seen sets
        if (lowerPid) batchSeenProfileIds.add(lowerPid);
        if (nid) batchSeenNationalIds.add(nid);

        // 2. Find existing record by profileId or nationalId
        const existingRecord = (lowerPid ? dbByProfileId.get(lowerPid) : null) || (nid ? dbByNationalId.get(nid) : null);

        if (existingRecord) {
          // Employee exists! Check for updates
          const updates: Record<string, any> = {};
          const diffSummary: string[] = [];

          const checkField = (field: string, incomingVal: any, existingVal: any, label: string) => {
            const inc = incomingVal !== undefined && incomingVal !== null ? String(incomingVal).trim() : "";
            const ext = existingVal !== undefined && existingVal !== null ? String(existingVal).trim() : "";
            // Only update if incoming is provided, not empty, not placeholder, and differs from existing
            if (inc && inc !== "—" && inc !== ext) {
              updates[field] = inc;
              diffSummary.push(`${label}: ${ext || "—"} ➔ ${inc}`);
            }
          };

          checkField("firstName", p.firstName, existingRecord.firstName, "الاسم الأول");
          if (p.firstNameAr) checkField("firstNameAr", p.firstNameAr, existingRecord.firstNameAr, "الاسم الأول (عربي)");
          checkField("lastName", p.lastName, existingRecord.lastName, "اسم العائلة");
          if (p.lastNameAr) checkField("lastNameAr", p.lastNameAr, existingRecord.lastNameAr, "اسم العائلة (عربي)");
          checkField("thirdName", p.thirdName, existingRecord.thirdName, "الاسم الثالث");
          if (p.thirdNameAr) checkField("thirdNameAr", p.thirdNameAr, existingRecord.thirdNameAr, "الاسم الثالث (عربي)");
          checkField("fourthName", p.fourthName, existingRecord.fourthName, "الاسم الرابع");
          if (p.fourthNameAr) checkField("fourthNameAr", p.fourthNameAr, existingRecord.fourthNameAr, "الاسم الرابع (عربي)");
          checkField("department", p.department, existingRecord.department, "القسم");
          if (p.departmentAr) checkField("departmentAr", p.departmentAr, existingRecord.departmentAr, "القسم (عربي)");
          checkField("jobTitle", p.jobTitle, existingRecord.jobTitle, "الوظيفة");
          if (p.jobTitleAr) checkField("jobTitleAr", p.jobTitleAr, existingRecord.jobTitleAr, "الوظيفة (عربي)");
          checkField("level", p.level, existingRecord.level, "الدرجة");
          checkField("nationality", p.nationality, existingRecord.nationality, "الجنسية");
          if (p.gender && (p.gender === "M" || p.gender === "F") && p.gender !== existingRecord.gender) {
            updates.gender = p.gender;
            diffSummary.push(`النوع: ${existingRecord.gender} ➔ ${p.gender}`);
          }
          checkField("phone", p.phone, existingRecord.phone, "الهاتف");
          checkField("email", p.email, existingRecord.email, "البريد الإلكتروني");
          checkField("emergencyContact", p.emergencyContact, existingRecord.emergencyContact, "طوارئ");
          checkField("companyName", p.companyName, existingRecord.companyName, "الشركة");
          checkField("employmentType", p.employmentType, existingRecord.employmentType, "نوع التوظيف");
          checkField("hireDate", p.hireDate, existingRecord.hireDate, "تاريخ التعيين");
          checkField("contractEndDate", p.contractEndDate, existingRecord.contractEndDate, "انتهاء العقد");
          checkField("dateOfBirth", p.dateOfBirth, existingRecord.dateOfBirth, "تاريخ الميلاد");
          checkField("address", p.address, existingRecord.address, "العنوان");

          // Also check nationalId if matched by profileId
          if (nid && nid !== existingRecord.nationalId) {
            const conflict = dbByNationalId.get(nid);
            if (!conflict || conflict.id === existingRecord.id) {
              updates.nationalId = nid;
              diffSummary.push(`الرقم القومي: ${existingRecord.nationalId} ➔ ${nid}`);
            }
          }

          if (Object.keys(updates).length > 0) {
            const merged = {
              firstName: updates.firstName ?? existingRecord.firstName,
              lastName: updates.lastName ?? existingRecord.lastName,
              thirdName: updates.thirdName ?? existingRecord.thirdName,
              fourthName: updates.fourthName ?? existingRecord.fourthName,
              department: updates.department ?? existingRecord.department,
              jobTitle: updates.jobTitle ?? existingRecord.jobTitle,
              firstNameAr: updates.firstNameAr ?? existingRecord.firstNameAr,
              lastNameAr: updates.lastNameAr ?? existingRecord.lastNameAr,
              thirdNameAr: updates.thirdNameAr ?? existingRecord.thirdNameAr,
              fourthNameAr: updates.fourthNameAr ?? existingRecord.fourthNameAr,
              departmentAr: updates.departmentAr ?? existingRecord.departmentAr,
              jobTitleAr: updates.jobTitleAr ?? existingRecord.jobTitleAr,
            };
            const enrichedMerged = enrichProfileBilingual(merged);
            if (!updates.firstNameAr && !existingRecord.firstNameAr && enrichedMerged.firstNameAr) updates.firstNameAr = enrichedMerged.firstNameAr;
            if (!updates.lastNameAr && !existingRecord.lastNameAr && enrichedMerged.lastNameAr) updates.lastNameAr = enrichedMerged.lastNameAr;
            if (!updates.thirdNameAr && !existingRecord.thirdNameAr && enrichedMerged.thirdNameAr) updates.thirdNameAr = enrichedMerged.thirdNameAr;
            if (!updates.fourthNameAr && !existingRecord.fourthNameAr && enrichedMerged.fourthNameAr) updates.fourthNameAr = enrichedMerged.fourthNameAr;
            if (!updates.departmentAr && !existingRecord.departmentAr && enrichedMerged.departmentAr) updates.departmentAr = enrichedMerged.departmentAr;
            if (!updates.jobTitleAr && !existingRecord.jobTitleAr && enrichedMerged.jobTitleAr) updates.jobTitleAr = enrichedMerged.jobTitleAr;

            rowsToUpdate.push({
              id: existingRecord.id,
              profileId: existingRecord.profileId,
              updates,
              diffSummary,
            });
          } else {
            // 100% identical duplicate with zero changes -> Skip safely without re-inserting or touching!
            skippedItems.push({
              profileId: existingRecord.profileId,
              name: pName,
              nationalId: nid || existingRecord.nationalId,
              phone: ph || existingRecord.phone,
              reason: "سجل مكرر ومطابق تماماً في النظام (تم التخطي بدون تعديل)",
            });
          }
        } else {
          // New employee -> Insert with full bilingual auto-translation!
          const rawItem = {
            profileId: pId || `EMP-${Date.now().toString().slice(-6)}${i + 1}`,
            firstName: String(p.firstName || "—").trim(),
            lastName: String(p.lastName || "—").trim(),
            thirdName: String(p.thirdName || "").trim(),
            fourthName: String(p.fourthName || "").trim(),
            firstNameAr: String(p.firstNameAr || "").trim(),
            lastNameAr: String(p.lastNameAr || "").trim(),
            thirdNameAr: String(p.thirdNameAr || "").trim(),
            fourthNameAr: String(p.fourthNameAr || "").trim(),
            nationalId: nid,
            nationality: String(p.nationality || "").trim(),
            address: String(p.address || "").trim(),
            jobTitle: String(p.jobTitle || "").trim(),
            jobTitleAr: String(p.jobTitleAr || "").trim(),
            level: String(p.level || "—").trim(),
            phone: ph,
            department: String(p.department || "").trim(),
            departmentAr: String(p.departmentAr || "").trim(),
            status: "UNASSIGNED",
            hireDate: p.hireDate || new Date().toISOString().split("T")[0],
            gender: p.gender === "F" ? "F" : "M",
            employmentType: p.employmentType || "INTERNAL",
            companyName: p.companyName || "",
            contractEndDate: p.contractEndDate || null,
            dateOfBirth: p.dateOfBirth || "",
            email: String(p.email || "").trim(),
            emergencyContact: String(p.emergencyContact || "").trim(),
          };
          rowsToInsert.push(enrichProfileBilingual(rawItem));
        }
      }

      // Execute Inserts in chunks of 100
      const CHUNK_SIZE = 100;
      let insertedCount = 0;
      for (let i = 0; i < rowsToInsert.length; i += CHUNK_SIZE) {
        const chunk = rowsToInsert.slice(i, i + CHUNK_SIZE);
        const inserted = await tenantDb
          .insert(profilesTable)
          .values(chunk)
          .returning({ id: profilesTable.id, profileId: profilesTable.profileId });
        insertedCount += inserted.length;
        for (const ins of inserted) {
          ensureProfilePortalAccount(propertyId, ins.profileId).catch(() => {});
        }
      }

      // Execute Updates
      let updatedCount = 0;
      for (const item of rowsToUpdate) {
        await tenantDb
          .update(profilesTable)
          .set(item.updates)
          .where(eq(profilesTable.id, item.id));
        updatedCount++;
        ensureProfilePortalAccount(propertyId, item.profileId).catch(() => {});
      }

      return {
        total: toProcess.length,
        success: insertedCount + updatedCount,
        created: insertedCount,
        updated: updatedCount,
        skipped: skippedItems.length,
        skippedItems,
        updatedItems: rowsToUpdate.map((u) => ({
          profileId: u.profileId,
          diff: u.diffSummary.join(", "),
        })),
      };
    });

    const s = su(req);
    await logActivity({
      req,
      propertyId,
      username: s.username,
      userId: s.userId,
      userRole: s.userRole,
      action: `استيراد ذكي للملفات الشخصية: تم إضافة ${result.created}، تحديث ${result.updated}، وتخطي ${result.skipped} سجل مكرر`,
      actionType: result.updated > 0 && result.created === 0 ? "UPDATE" : "CREATE",
      module: "profiles",
      entityType: "profile",
      details: `Total: ${result.total}, Created: ${result.created}, Updated: ${result.updated}, Skipped: ${result.skipped}`,
    });

    broadcastToProperty(propertyId, {
      module: "profiles",
      action: "updated",
      data: { created: result.created, updated: result.updated, count: result.success },
    });

    res.status(200).json(result);
  },
);

export default router;
