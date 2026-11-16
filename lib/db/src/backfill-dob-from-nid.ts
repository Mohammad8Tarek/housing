/**
 * Back-fill profiles.date_of_birth from the Egyptian national ID.
 *
 * Portal password recovery matches on date of birth, but many imported profiles
 * never had one stored — so recovery always failed. An Egyptian national ID
 * encodes the birth date, so we derive it for every profile that is missing one.
 *
 * Idempotent: only fills rows where date_of_birth is NULL/empty and the national
 * ID is a structurally valid 14-digit NID with a real, non-future birth date.
 *
 * SAFE BY DEFAULT: runs as a dry-run (reports what it would change) unless
 * APPLY=1 is set.
 *
 *   # preview
 *   DATABASE_URL=... npx tsx src/backfill-dob-from-nid.ts
 *   # write
 *   APPLY=1 DATABASE_URL=... npx tsx src/backfill-dob-from-nid.ts
 *
 * The derivation mirrors artifacts/api-server/src/lib/national-id.ts so a
 * back-filled row matches what HR Sync would now produce.
 */
import { pool } from "./index.js";

const toAsciiDigits = (s: string): string =>
  s
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660))
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0));

function egyptianNidToDob(nationalId: unknown): string | null {
  if (nationalId == null) return null;
  const nid = toAsciiDigits(String(nationalId)).replace(/\D/g, "");
  if (nid.length !== 14) return null;
  const c = Number(nid[0]);
  const base = c === 1 ? 1800 : c === 2 ? 1900 : c === 3 ? 2000 : null;
  if (base === null) return null;
  const year = base + Number(nid.slice(1, 3));
  const month = Number(nid.slice(3, 5));
  const day = Number(nid.slice(5, 7));
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const d = new Date(Date.UTC(year, month - 1, day));
  if (
    d.getUTCFullYear() !== year ||
    d.getUTCMonth() !== month - 1 ||
    d.getUTCDate() !== day
  )
    return null;
  if (d.getTime() > Date.now()) return null;
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const APPLY = process.env.APPLY === "1";

async function run() {
  const client = await pool.connect();
  let totalFilled = 0;
  let totalSkipped = 0;
  try {
    const { rows: props } = await client.query<{ schema_name: string | null }>(
      "SELECT schema_name FROM public.properties WHERE schema_name IS NOT NULL",
    );
    const schemas = [
      "public",
      ...props
        .map((p) => (p.schema_name ?? "").trim())
        .filter((s) => /^[a-z_][a-z0-9_]*$/.test(s)),
    ];
    // De-dupe while preserving order.
    const seen = new Set<string>();
    const targetSchemas = schemas.filter((s) =>
      seen.has(s) ? false : (seen.add(s), true),
    );

    console.log(
      `🔎 ${APPLY ? "APPLYING" : "DRY-RUN"} — back-filling date_of_birth from national_id across: ${targetSchemas.join(", ")}\n`,
    );

    for (const schema of targetSchemas) {
      let candidates: { id: number; national_id: string | null }[];
      try {
        const res = await client.query<{
          id: number;
          national_id: string | null;
        }>(
          `SELECT id, national_id FROM "${schema}".profiles
             WHERE (date_of_birth IS NULL OR date_of_birth = '')
               AND national_id IS NOT NULL AND national_id <> ''`,
        );
        candidates = res.rows;
      } catch (err: any) {
        console.log(`  • ${schema}: skipped (${err.message})`);
        continue;
      }

      let filled = 0;
      let skipped = 0;
      for (const row of candidates) {
        const dob = egyptianNidToDob(row.national_id);
        if (!dob) {
          skipped += 1;
          continue;
        }
        if (APPLY) {
          await client.query(
            `UPDATE "${schema}".profiles
               SET date_of_birth = $1
               WHERE id = $2 AND (date_of_birth IS NULL OR date_of_birth = '')`,
            [dob, row.id],
          );
        }
        filled += 1;
      }
      totalFilled += filled;
      totalSkipped += skipped;
      console.log(
        `  • ${schema}: ${candidates.length} missing DOB → ${filled} ${APPLY ? "filled" : "fillable"}, ${skipped} unparseable NID`,
      );
    }

    console.log(
      `\n${APPLY ? "✅ Applied" : "📝 Dry-run"}: ${totalFilled} profiles ${APPLY ? "updated" : "would be updated"}, ${totalSkipped} left (NID not a valid Egyptian 14-digit ID).`,
    );
    if (!APPLY && totalFilled > 0) {
      console.log("   Re-run with APPLY=1 to write these changes.");
    }
  } catch (err: any) {
    console.error("❌ Back-fill failed:", err.message);
    process.exitCode = 1;
  } finally {
    client.release();
    await pool.end();
  }
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
