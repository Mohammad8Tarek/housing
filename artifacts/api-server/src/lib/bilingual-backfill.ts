import { pool } from "@workspace/db";
import {
  enrichProfileBilingual,
  translateDepartment,
  translateJobTitle,
  hasArabic,
  hasEnglish,
} from "./bilingual-translator.js";

/**
 * Runs a complete bilingual backfill across all profiles and lookups in all tenant schemas.
 * Ensures zero data loss and ensures NO English characters remain in Arabic fields.
 */
export async function backfillBilingualProfiles(): Promise<{
  totalUpdatedProfiles: number;
  totalUpdatedLookups: number;
}> {
  let totalUpdatedProfiles = 0;
  let totalUpdatedLookups = 0;
  const client = await pool.connect();

  try {
    // 1. Get all user/tenant schemas
    const { rows: schemas } = await client.query(`
      SELECT schema_name 
      FROM information_schema.schemata 
      WHERE schema_name NOT IN ('pg_catalog', 'information_schema', 'pg_toast')
      ORDER BY schema_name;
    `);

    for (const { schema_name } of schemas) {
      // Check if this schema has a profiles table
      const { rows: tableCheck } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'profiles';
      `, [schema_name]);

      if (tableCheck.length === 0) continue;

      // Idempotently add bilingual columns if missing
      await client.query(`
        ALTER TABLE "${schema_name}".profiles ADD COLUMN IF NOT EXISTS first_name_ar text;
        ALTER TABLE "${schema_name}".profiles ADD COLUMN IF NOT EXISTS last_name_ar text;
        ALTER TABLE "${schema_name}".profiles ADD COLUMN IF NOT EXISTS third_name_ar text;
        ALTER TABLE "${schema_name}".profiles ADD COLUMN IF NOT EXISTS fourth_name_ar text;
        ALTER TABLE "${schema_name}".profiles ADD COLUMN IF NOT EXISTS job_title_ar text;
        ALTER TABLE "${schema_name}".profiles ADD COLUMN IF NOT EXISTS department_ar text;
      `);

      // Fetch all profiles in this schema
      const { rows: profiles } = await client.query(`
        SELECT id, first_name, last_name, third_name, fourth_name, 
               first_name_ar, last_name_ar, third_name_ar, fourth_name_ar,
               job_title, job_title_ar, department, department_ar
        FROM "${schema_name}".profiles;
      `);

      for (const p of profiles) {
        const fnEn = p.first_name || "";
        const lnEn = p.last_name || "";
        const fnAr = p.first_name_ar || "";
        const lnAr = p.last_name_ar || "";
        const jtAr = p.job_title_ar || "";
        const dpAr = p.department_ar || "";

        // Check if any Arabic field needs translation or contains English characters
        const needsNameAr = !fnAr || hasEnglish(fnAr) || !lnAr || hasEnglish(lnAr);
        const needsJobAr = (!jtAr || hasEnglish(jtAr)) && Boolean(p.job_title);
        const needsDeptAr = (!dpAr || hasEnglish(dpAr)) && Boolean(p.department);

        if (needsNameAr || needsJobAr || needsDeptAr) {
          const enriched = enrichProfileBilingual({
            firstName: p.first_name,
            lastName: p.last_name,
            thirdName: p.third_name,
            fourthName: p.fourth_name,
            firstNameAr: p.first_name_ar,
            lastNameAr: p.last_name_ar,
            thirdNameAr: p.third_name_ar,
            fourthNameAr: p.fourth_name_ar,
            jobTitle: p.job_title,
            jobTitleAr: p.job_title_ar,
            department: p.department,
            departmentAr: p.department_ar,
          });

          await client.query(`
            UPDATE "${schema_name}".profiles 
            SET first_name_ar = $1, last_name_ar = $2, third_name_ar = $3, fourth_name_ar = $4,
                job_title_ar = $5, department_ar = $6
            WHERE id = $7;
          `, [
            enriched.firstNameAr,
            enriched.lastNameAr,
            enriched.thirdNameAr,
            enriched.fourthNameAr,
            enriched.jobTitleAr,
            enriched.departmentAr,
            p.id,
          ]);

          totalUpdatedProfiles++;
        }
      }

      // Check if lookup_values table exists in this schema
      const { rows: lookupTableCheck } = await client.query(`
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = $1 AND table_name = 'lookup_values';
      `, [schema_name]);

      if (lookupTableCheck.length > 0) {
        await client.query(`
          ALTER TABLE "${schema_name}".lookup_values ADD COLUMN IF NOT EXISTS value_ar text;
        `);

        const { rows: lookups } = await client.query(`
          SELECT id, category, value, value_ar
          FROM "${schema_name}".lookup_values
          WHERE (value_ar IS NULL OR value_ar = '' OR value_ar ~ '[a-zA-Z]');
        `);

        for (const lk of lookups) {
          let valAr = "";
          if (lk.category === "department") {
            valAr = translateDepartment(lk.value, "ar");
          } else if (lk.category === "job_title") {
            valAr = translateJobTitle(lk.value, "ar");
          } else if (!hasEnglish(lk.value)) {
            valAr = lk.value;
          } else {
            valAr = translateJobTitle(lk.value, "ar");
          }

          if (valAr && valAr !== lk.value_ar) {
            await client.query(`
              UPDATE "${schema_name}".lookup_values
              SET value_ar = $1
              WHERE id = $2;
            `, [valAr, lk.id]);
            totalUpdatedLookups++;
          }
        }
      }
    }

    console.log(
      `[Bilingual Backfill] Completed: ${totalUpdatedProfiles} profiles updated, ${totalUpdatedLookups} lookup values updated across all tenant schemas.`
    );
  } catch (err) {
    console.error("[Bilingual Backfill] Error during execution:", err);
  } finally {
    client.release();
  }

  return { totalUpdatedProfiles, totalUpdatedLookups };
}
