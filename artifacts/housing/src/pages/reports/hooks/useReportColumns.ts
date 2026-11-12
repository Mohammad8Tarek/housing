import { useState, useMemo, useEffect } from "react";
import { ColDef } from "@/components/ui/column-chooser";
import { REPORT_COLUMNS } from "@workspace/report-rows";

export const REPORT_TAB_COLUMNS: Record<string, ColDef[]> = REPORT_COLUMNS;

export const DEFAULT_VISIBLE_KEYS: Partial<Record<string, string[]>> = {
  profiles: [
    "profileCode",
    "fullName",
    "department",
    "jobTitle",
    "level",
    "assignedRoom",
    "employmentType",
    "phone",
    "nationalId",
    "nationality",
    "status",
  ],
  assignments: [
    "profileCode",
    "fullName",
    "employmentType",
    "buildingName",
    "roomNumber",
    "department",
    "level",
    "phone",
    "checkInDate",
    "status",
  ],
  police_report: [
    "profileCode",
    "fullName",
    "nationalId",
    "nationality",
    "jobTitle",
    "department",
    "buildingName",
    "roomNumber",
    "bedNumber",
    "checkInDate",
    "status",
  ],
  policy_exceptions: [
    "profileName",
    "profileCode",
    "jobLevel",
    "department",
    "roomNumber",
    "violationType",
    "severity",
    "approvalStatus",
    "requestDate",
    "resolvedAt",
  ],
  vacations: [
    "profileCode",
    "fullName",
    "department",
    "jobTitle",
    "buildingName",
    "housingInfo",
    "startDate",
    "endDate",
    "actualReturnDate",
    "duration",
    "status",
  ],
};

export function useReportColumns(activeTab: string, ar: boolean) {
  const allCols = useMemo<ColDef[]>(() => {
    return REPORT_TAB_COLUMNS[activeTab] || [];
  }, [activeTab]);

  const storageKey = `report_cols_${activeTab}`;

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    const def = DEFAULT_VISIBLE_KEYS[activeTab] || allCols.map((c) => c.key);
    return new Set(def);
  });

  // Re-sync when tab changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`report_cols_${activeTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleKeys(new Set(parsed));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    const def =
      DEFAULT_VISIBLE_KEYS[activeTab] ||
      (REPORT_TAB_COLUMNS[activeTab] || []).map((c) => c.key);
    setVisibleKeys(new Set(def));
  }, [activeTab]);

  const toggle = (key: string, checked: boolean) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else {
        // Keep at least 1 column
        if (next.size > 1) next.delete(key);
      }
      try {
        localStorage.setItem(
          `report_cols_${activeTab}`,
          JSON.stringify(Array.from(next)),
        );
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const showAll = () => {
    const next = new Set(allCols.map((c) => c.key));
    setVisibleKeys(next);
    try {
      localStorage.setItem(
        `report_cols_${activeTab}`,
        JSON.stringify(Array.from(next)),
      );
    } catch {
      /* ignore */
    }
  };

  const hideAll = () => {
    const next = new Set(allCols.filter((c) => c.fixed).map((c) => c.key));
    if (next.size === 0 && allCols.length > 0) {
      next.add(allCols[0].key);
    }
    setVisibleKeys(next);
    try {
      localStorage.setItem(
        `report_cols_${activeTab}`,
        JSON.stringify(Array.from(next)),
      );
    } catch {
      /* ignore */
    }
  };

  const isVisible = (key: string) => visibleKeys.has(key);

  /** Filter row object by visible keys (maps either raw key or translated label) */
  const filterRow = (row: Record<string, any>): Record<string, any> => {
    if (allCols.length === 0) return row;
    const filtered: Record<string, any> = {};

    for (const [colKey, val] of Object.entries(row)) {
      // Find matching col definition
      const matchedCol = allCols.find(
        (c) => c.key === colKey || c.label === colKey || c.labelAr === colKey,
      );

      if (matchedCol) {
        if (visibleKeys.has(matchedCol.key)) {
          filtered[colKey] = val;
        }
      } else {
        filtered[colKey] = val;
      }
    }

    return filtered;
  };

  return {
    cols: allCols,
    visible: visibleKeys,
    toggle,
    showAll,
    hideAll,
    isVisible,
    filterRow,
  };
}
