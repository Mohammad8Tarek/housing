// Helpers shared by the dashboard route modules.
import { sql } from "drizzle-orm";

// ─── Helper: safe count query ──────────────────────────────────────────────
export async function safeCount(
  queryFn: () => Promise<{ count: number }[]>,
): Promise<number> {
  try {
    const [row] = await queryFn();
    return Number(row?.count ?? 0);
  } catch {
    return 0;
  }
}

// ─── Helper: safe select query ─────────────────────────────────────────────
export async function safeSelect<T>(
  queryFn: () => Promise<T[]>,
  fallback: T[] = [],
): Promise<T[]> {
  try {
    return await queryFn();
  } catch {
    return fallback;
  }
}

export function statusEq(column: any, status: string) {
  return sql`lower(${column}) = ${status.toLowerCase()}`;
}
