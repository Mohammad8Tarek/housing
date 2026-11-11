// Helpers shared by the assignments route modules.
import { pool } from "@workspace/db";

export function fmtAssignment(r: Record<string, any>) {
  const dateFields = [
    "checkInDate",
    "checkOutDate",
    "expectedCheckOutDate",
    "actualCheckOutDate",
    "transferDate",
    "createdAt",
    "updatedAt",
  ];
  const out: Record<string, any> = { ...r, notes: r.notes ?? "" };
  for (const f of dateFields) {
    if (out[f] instanceof Date && typeof out[f].toISOString === "function")
      out[f] = out[f].toISOString();
    else if (out[f] == null) out[f] = null;
  }
  return out;
}

export async function findPropertyByAssignmentId(
  assignmentId: number,
): Promise<number | null> {
  try {
    const props = await pool.query(
      "SELECT id, schema_name FROM public.properties",
    );
    for (const p of props.rows) {
      try {
        const check = await pool.query(
          `SELECT id FROM "${p.schema_name}".assignments WHERE id = $1 LIMIT 1`,
          [assignmentId],
        );
        if (check.rows.length > 0) return p.id;
      } catch {}
    }
  } catch {}
  return null;
}
