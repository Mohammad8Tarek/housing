// Property scope for reports that can span properties (?propertyId=all|0|-1
// or no propertyId). A single requested property is already checked against
// the user's access by the auth middleware; "all" must still be limited to the
// properties the user may see, or a user scoped to one hotel reads every hotel.
import type { Request } from "express";
import { inArray, sql, type AnyColumn, type SQL } from "drizzle-orm";

const ALL_VALUES = new Set(["", "all", "-1", "0"]);

/**
 * SQL condition restricting `column` (a propertyId column) to what the
 * request may read, or undefined when no restriction applies (system admin
 * asking for every property).
 */
export function reportPropertyCondition(
  req: Request,
  column: AnyColumn,
): SQL | undefined {
  const raw = String(req.query.propertyId ?? "").trim();
  if (!ALL_VALUES.has(raw)) {
    const id = Number(raw);
    return Number.isFinite(id) ? inArray(column, [id]) : sql`false`;
  }

  const user = (req as any).authUser;
  const isSysAdmin =
    user?.isSystemAdmin ||
    user?.roles?.includes("super_admin") ||
    user?.roles?.includes("system_admin");
  if (isSysAdmin) return undefined;

  const ids: number[] = (user?.propertyIds ?? [])
    .map(Number)
    .filter((n: number) => Number.isFinite(n) && n > 0);
  return ids.length ? inArray(column, ids) : sql`false`;
}
