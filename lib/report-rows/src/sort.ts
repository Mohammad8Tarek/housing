// Column sorting for report rows — shared so server-side pages sort exactly
// like the browser did.
import { parseDMY } from "@workspace/dates";

export type SortDir = "asc" | "desc";
export type ReportSort = { key: string; dir: SortDir } | null;

const EMPTY_VALUES = new Set(["", "—", "-", "N/A", null, undefined]);

function norm(v: unknown): string {
  if (v == null) return "";
  return String(v).trim();
}

/** Smart compare: empties last, DD/MM/YYYY dates, numbers, then locale text. */
export function compareReportValues(a: unknown, b: unknown, dir: SortDir): number {
  const sa = norm(a);
  const sb = norm(b);
  const aEmpty = EMPTY_VALUES.has(sa);
  const bEmpty = EMPTY_VALUES.has(sb);
  if (aEmpty && bEmpty) return 0;
  if (aEmpty) return 1;
  if (bEmpty) return -1;

  // Dates in system display format DD/MM/YYYY
  const aIso = parseDMY(sa);
  const bIso = parseDMY(sb);
  if (aIso && bIso) {
    if (aIso === bIso) return 0;
    return (aIso < bIso ? -1 : 1) * (dir === "asc" ? 1 : -1);
  }
  if (aIso) return dir === "asc" ? -1 : 1;
  if (bIso) return dir === "asc" ? 1 : -1;

  // Numbers (handles "1,200", "95%", "12 days left" partially via parseFloat)
  const na = parseFloat(sa.replace(/,/g, ""));
  const nb = parseFloat(sb.replace(/,/g, ""));
  if (Number.isFinite(na) && Number.isFinite(nb) && (sa.match(/^-?[\d.,%]+$/) || sb.match(/^-?[\d.,%]+$/))) {
    if (na === nb) return sa.localeCompare(sb, undefined, { numeric: true });
    return (na < nb ? -1 : 1) * (dir === "asc" ? 1 : -1);
  }

  const cmp = sa.localeCompare(sb, undefined, { numeric: true, sensitivity: "base" });
  return dir === "asc" ? cmp : -cmp;
}

export function sortReportRows<T extends Record<string, any>>(
  rows: T[],
  sort: ReportSort,
): T[] {
  if (!sort) return rows;
  return [...rows].sort((ra, rb) => {
    let va = ra?.[sort.key];
    let vb = rb?.[sort.key];
    if ((va == null || va === "") && (sort.key === "roomNumber" || sort.key === "room")) {
      va = ra?.roomNumber ?? ra?.room ?? ra?.roomId ?? ra?.room_number ?? "";
    }
    if ((vb == null || vb === "") && (sort.key === "roomNumber" || sort.key === "room")) {
      vb = rb?.roomNumber ?? rb?.room ?? rb?.roomId ?? rb?.room_number ?? "";
    }
    return compareReportValues(va, vb, sort.dir);
  });
}
