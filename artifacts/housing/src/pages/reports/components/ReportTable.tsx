import { useState } from "react";
import { cn } from "@/lib/utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Building } from "lucide-react";
import { SortableHead } from "@/components/ui/sortable-head";
import type { Tab } from "../types";
import { REPORT_TABLE_COLUMNS, type ReportTableCtx } from "./report-table";
import { EquipmentRoomsDialog } from "./report-table/EquipmentRoomsDialog";

export function ReportTable({
  isLoading,
  allData,
  paginatedData,
  selectedRows,
  setSelectedRows,
  activeTab,
  inventoryViewMode = "summary",
  ar,
  sort,
  onSortToggle,
  floorMap,
  buildingMap,
  empMap,
  roomMap,
  visibleCols,
  waterCheckState: externalWaterCheckState,
  onToggleWaterCheck: externalToggleWaterCheck,
}: any) {
  const isVis = (k: string) => !visibleCols || visibleCols.has(k);
  const [selectedItemRooms, setSelectedItemRooms] = useState<any | null>(null);
  const [internalWaterCheckState, setInternalWaterCheckState] = useState<
    Record<string, boolean>
  >(() => {
    try {
      const saved = localStorage.getItem("water_distribution_checks");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const waterCheckState = externalWaterCheckState ?? internalWaterCheckState;

  const toggleWaterCheck = (key: string, val: boolean) => {
    if (externalToggleWaterCheck) {
      externalToggleWaterCheck(key, val);
      return;
    }
    setInternalWaterCheckState((prev) => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem("water_distribution_checks", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const H = (sortKey: string, label: React.ReactNode, className?: string) => (
    <SortableHead
      label={label}
      sortKey={sortKey}
      activeKey={sort?.key ?? null}
      dir={sort?.dir ?? "asc"}
      onToggle={onSortToggle ?? (() => {})}
      className={className}
    />
  );
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!paginatedData || paginatedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <Building className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold text-base">
          {ar
            ? "لا توجد سجلات مطابقة للفلاتر المحددة"
            : "No records found matching filters"}
        </p>
        <p className="text-xs mt-1">
          {ar
            ? "جرب تغيير خيارات الفلترة أو البحث"
            : "Try adjusting your filter options or search query"}
        </p>
      </div>
    );
  }

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((r: any) => selectedRows.has(r.id));

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedRows);
      paginatedData.forEach((r: any) => next.add(r.id));
      setSelectedRows(next);
    } else {
      const next = new Set(selectedRows);
      paginatedData.forEach((r: any) => next.delete(r.id));
      setSelectedRows(next);
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  // Per-report header + cell renderers live in ./report-table (one file per report group).
  const columns = REPORT_TABLE_COLUMNS[activeTab as Tab];
  const tableCtx: ReportTableCtx = {
    ar,
    H,
    isVis,
    activeTab,
    inventoryViewMode,
    floorMap,
    buildingMap,
    empMap,
    roomMap,
    waterCheckState,
    toggleWaterCheck,
    setSelectedItemRooms,
    selectedRows,
    allData,
    paginatedData,
    sort,
    visibleCols,
  };

  const isWideTab = [
    "police_report",
    "assignments",
    "profiles",
    "water_distribution",
    "policy_exceptions",
    "expiring_contracts",
  ].includes(activeTab);

  return (
    <div className="overflow-x-auto rounded-xl border border-border/70 bg-card shadow-xs">
      <Table className={cn("w-full", isWideTab && "w-max min-w-full")}>
        <TableHeader>
          <TableRow className="bg-[#0F2A44] hover:bg-[#0F2A44] text-white">
            <TableHead className="w-10 px-3 text-white">
              <Checkbox
                className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#0F2A44]"
                checked={isAllSelected}
                onCheckedChange={toggleAll}
              />
            </TableHead>

            {columns?.header(tableCtx)}
          </TableRow>
        </TableHeader>

        <TableBody>
          {paginatedData.map((row: any, idx: number) => {
            const isSelected = selectedRows.has(row.id);

            return (
              <TableRow
                key={`${activeTab}-${row.id ?? "row"}-${idx}`}
                className={`hover:bg-muted/50 transition-colors ${
                  isSelected ? "bg-primary/5" : ""
                }`}
              >
                <TableCell className="px-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(row.id)}
                  />
                </TableCell>

                {columns?.cells({ ...tableCtx, row, idx, isSelected })}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Drill-down: rooms that hold the selected inventory item */}
      <EquipmentRoomsDialog
        item={selectedItemRooms}
        onClose={() => setSelectedItemRooms(null)}
        ar={ar}
      />
    </div>
  );
}
