import { useMemo, useState } from "react";
import { sortReportRows, type ReportSort } from "@workspace/report-rows";

// Sorting lives in @workspace/report-rows so server-side pages sort identically.
export { sortReportRows };
export type { ReportSort };

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
