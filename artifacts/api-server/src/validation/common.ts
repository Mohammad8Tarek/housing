import { z } from "zod";

/** Positive integer coming from a path/query/body as string or number. */
export const zId = z.coerce.number().int().positive();

/** Optional positive integer; empty string / null become undefined. */
export const zOptionalId = z.preprocess(
  (v) => (v === "" || v === null || v === undefined || v === "all" ? undefined : v),
  z.coerce.number().int().positive().optional(),
);

/** Trimmed string with a max length. */
export const zText = (max = 255) => z.string().trim().max(max);

/** Optional trimmed string; null/empty become null. */
export const zNullableText = (max = 255) =>
  z.preprocess(
    (v) => (v === "" || v === null || v === undefined ? null : v),
    z.string().trim().max(max).nullable(),
  );

/** Boolean that also accepts "true"/"false"/1/0. */
export const zBool = z.preprocess((v) => {
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1") return true;
    if (s === "false" || s === "0" || s === "") return false;
  }
  if (typeof v === "number") return v !== 0;
  return v;
}, z.boolean());

/** YYYY-MM-DD or full ISO timestamp. */
/** Accepts ISO (YYYY-MM-DD / timestamp) or DD/MM/YYYY / DD-MM-YYYY. */
export const zDateString = z
  .string()
  .trim()
  .max(40)
  .refine(
    (v) => /^\d{1,2}[\/-]\d{1,2}[\/-]\d{4}$/.test(v) || !Number.isNaN(Date.parse(v)),
    "Invalid date format",
  );

export const zOptionalDateString = z.preprocess(
  (v) => (v === "" || v === null ? undefined : v),
  zDateString.optional(),
);

export const IdParams = z.object({ id: zId });

/** Standard pagination query: page >= 1, limit capped. */
export const paginationQuery = (maxLimit = 500, defaultLimit = 20) =>
  z.object({
    page: z.coerce.number().int().min(1).default(1),
    limit: z.coerce.number().int().min(1).max(maxLimit).default(defaultLimit),
  });
