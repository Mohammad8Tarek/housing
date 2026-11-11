/**
 * hr-sync/lookups.ts — Auto-registration of departments, job titles, levels and companies as lookup values.
 */
import { lookupValuesTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { broadcastToProperty } from "../websocket.js";
import {
  translateDepartment,
  translateJobTitle,
  hasArabic,
} from "../bilingual-translator.js";

// ============================================================================
// Helper: Auto-register unique departments, job titles, levels, companies
// ============================================================================
export async function autoRegisterLookups(
  tenantDb: any,
  rawEmployees: any[],
  propertyId: number,
): Promise<{ added: number; updated: number }> {
  let added = 0;
  let updated = 0;
  try {
    const existing = await tenantDb.select().from(lookupValuesTable);

    // Build lookup maps by category
    const deptByVal = new Map<string, any>();
    const deptByValAr = new Map<string, any>();
    const jobTitleByVal = new Map<string, any>();
    const jobTitleByValAr = new Map<string, any>();
    const jobLevelByVal = new Map<string, any>();
    const companyByVal = new Map<string, any>();

    for (const item of existing) {
      const cat = String(item.category || "")
        .trim()
        .toLowerCase();
      const val = String(item.value || "")
        .trim()
        .toLowerCase();
      const valAr = String(item.valueAr || "")
        .trim()
        .toLowerCase();

      if (cat === "department") {
        if (val) deptByVal.set(val, item);
        if (valAr) deptByValAr.set(valAr, item);
      } else if (cat === "job_title") {
        if (val) jobTitleByVal.set(val, item);
        if (valAr) jobTitleByValAr.set(valAr, item);
      } else if (cat === "job_level") {
        if (val) jobLevelByVal.set(val, item);
      } else if (cat === "company") {
        if (val) companyByVal.set(val, item);
      }
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

      if (dept) {
        const deptKey = dept.toLowerCase();
        const deptArKey = deptAr.toLowerCase();
        const existingDept =
          deptByVal.get(deptKey) ||
          (deptArKey ? deptByValAr.get(deptArKey) : undefined);

        if (existingDept) {
          // If existing lookup has missing or non-Arabic valueAr, update it!
          if (
            deptAr &&
            (!existingDept.valueAr || !hasArabic(existingDept.valueAr))
          ) {
            try {
              await tenantDb
                .update(lookupValuesTable)
                .set({ valueAr: deptAr })
                .where(eq(lookupValuesTable.id, existingDept.id));
              existingDept.valueAr = deptAr;
              updated++;
            } catch {}
          }
        } else {
          try {
            const [newDept] = await tenantDb
              .insert(lookupValuesTable)
              .values({
                category: "department",
                value: dept,
                valueAr: deptAr || dept,
                parentValue: null,
                sortOrder: 0,
                disabled: false,
              })
              .returning();
            const rec = newDept || {
              id: 0,
              category: "department",
              value: dept,
              valueAr: deptAr || dept,
            };
            deptByVal.set(deptKey, rec);
            if (deptArKey) deptByValAr.set(deptArKey, rec);
            added++;
          } catch {}
        }
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
      const empLevel =
        emp.level !== undefined &&
        emp.level !== null &&
        String(emp.level).trim() !== ""
          ? String(emp.level).trim()
          : null;

      if (title) {
        const titleKey = title.toLowerCase();
        const titleArKey = titleAr.toLowerCase();
        const existingJob =
          jobTitleByVal.get(titleKey) ||
          (titleArKey ? jobTitleByValAr.get(titleArKey) : undefined);

        if (existingJob) {
          // Check if parent department, level, or Arabic title need correcting/updating
          const updateFields: any = {};
          if (
            titleAr &&
            (!existingJob.valueAr || !hasArabic(existingJob.valueAr))
          ) {
            updateFields.valueAr = titleAr;
            existingJob.valueAr = titleAr;
          }
          if (
            parentDept &&
            (!existingJob.parentValue || existingJob.parentValue !== parentDept)
          ) {
            updateFields.parentValue = parentDept;
            existingJob.parentValue = parentDept;
          }
          if (
            empLevel &&
            (!existingJob.extraValue || existingJob.extraValue !== empLevel)
          ) {
            updateFields.extraValue = empLevel;
            existingJob.extraValue = empLevel;
          }

          if (Object.keys(updateFields).length > 0) {
            try {
              await tenantDb
                .update(lookupValuesTable)
                .set(updateFields)
                .where(eq(lookupValuesTable.id, existingJob.id));
              updated++;
            } catch {}
          }
        } else {
          try {
            const [newJob] = await tenantDb
              .insert(lookupValuesTable)
              .values({
                category: "job_title",
                value: title,
                valueAr: titleAr || title,
                parentValue: parentDept,
                extraValue: empLevel,
                sortOrder: 0,
                disabled: false,
              })
              .returning();
            const rec = newJob || {
              id: 0,
              category: "job_title",
              value: title,
              valueAr: titleAr || title,
              parentValue: parentDept,
              extraValue: empLevel,
            };
            jobTitleByVal.set(titleKey, rec);
            if (titleArKey) jobTitleByValAr.set(titleArKey, rec);
            added++;
          } catch {}
        }
      }

      // 3. Level
      const lvl =
        emp.level !== undefined && emp.level !== null
          ? String(emp.level).trim()
          : "";
      if (lvl) {
        const lvlKey = lvl.toLowerCase();
        const existingLvl = jobLevelByVal.get(lvlKey);
        if (!existingLvl) {
          try {
            const [newLvl] = await tenantDb
              .insert(lookupValuesTable)
              .values({
                category: "job_level",
                value: lvl,
                valueAr: hasArabic(lvl) ? lvl : `المستوى ${lvl}`,
                parentValue: null,
                sortOrder: parseInt(lvl.replace(/\D/g, ""), 10) || 0,
                disabled: false,
              })
              .returning();
            jobLevelByVal.set(
              lvlKey,
              newLvl || { id: 0, category: "job_level", value: lvl },
            );
            added++;
          } catch {}
        }
      }

      // 4. Company
      const comp = String(emp.companyName || "").trim();
      if (comp) {
        const compKey = comp.toLowerCase();
        if (!companyByVal.has(compKey)) {
          try {
            const [newComp] = await tenantDb
              .insert(lookupValuesTable)
              .values({
                category: "company",
                value: comp,
                valueAr: comp,
                parentValue: null,
                sortOrder: 0,
                disabled: false,
              })
              .returning();
            companyByVal.set(
              compKey,
              newComp || { id: 0, category: "company", value: comp },
            );
            added++;
          } catch {}
        }
      }
    }

    if (added > 0 || updated > 0) {
      broadcastToProperty(propertyId, {
        module: "settings",
        action: "updated",
      });
    }
  } catch (err: any) {
    console.warn("[HrSync] autoRegisterLookups notice:", err?.message);
  }
  return { added, updated };
}
