import { useMemo, useState } from "react";
import { parseDMY } from "@/lib/date-utils";
import type { SortDir } from "@/components/ui/sortable-head";

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
  return [...rows].sort((ra, rb) =>
    compareReportValues(ra?.[sort.key], rb?.[sort.key], sort.dir),
  );
}

/** Click cycles asc → desc → off. Changing tabs resets via `resetKey`. */
export function useReportSort(resetKey: unknown) {
  const [sort, setSort] = useState<ReportSort>(null);
  const [lastReset, setLastReset] = useState(resetKey);

  if (resetKey !== lastReset) {
    setLastReset(resetKey);
    setSort(null);
  }

  const toggle = (key: string) => {
    setSort((prev) => {
      if (!prev || prev.key !== key) return { key, dir: "asc" };
      if (prev.dir === "asc") return { key, dir: "desc" };
      return null;
    });
  };

  return useMemo(() => ({ sort, toggle }), [sort]);
}
