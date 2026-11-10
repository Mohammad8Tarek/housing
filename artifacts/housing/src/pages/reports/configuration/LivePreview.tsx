// Live data preview table.
import { FileSpreadsheet, Printer, Info, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "@/components/DataPagination";
import { formatDate } from "@/lib/date-utils";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderLivePreview(s: ReportConfigurationPageState) {
  const { ar, page, setPage, limit, setLimit, isLoading, isFetching, reportRows, totalCount, activeColumns, resetFilters, handleExportExcel, isFetchingStudio, handleExportPDF } = s;
  return (
<div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                5
              </span>
              {ar ? "المعاينة الحية للتقرير (Live Data Preview)" : "Live Data Preview"}
            </h2>
            {isFetching && (
              <span className="text-xs text-primary font-semibold animate-pulse flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {ar ? "جاري التحديث..." : "Updating..."}
              </span>
            )}
          </div>

          {/* Export Toolbar */}
          <PermissionGate module="reports" action="export">
            <div className="flex items-center gap-2">
              <Button
                onClick={handleExportPDF}
                disabled={isLoading || isFetchingStudio || !reportRows.length}
                size="sm"
                className="bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white rounded-xl shadow-xs flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                <span>{ar ? "استوديو الطباعة و PDF" : "Print Studio & PDF"}</span>
              </Button>

              <Button
                onClick={handleExportExcel}
                disabled={isLoading || !reportRows.length}
                size="sm"
                className="bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white rounded-xl shadow-xs font-bold flex items-center gap-1.5 border-0"
              >
                <FileSpreadsheet className="w-4 h-4 text-white" />
                <span>{ar ? "تصدير إكسيل" : "Export Excel (.xlsx)"}</span>
              </Button>
            </div>
          </PermissionGate>
        </div>

        {/* Live Table Container */}
        <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="bg-muted/70 border-b border-border/80 text-muted-foreground font-bold">
                  <th className="py-3 px-3 text-center w-12 border-e border-border/50">#</th>
                  {activeColumns.map((col) => (
                    <th key={col.key} className="py-3 px-3.5 text-start font-extrabold text-foreground border-e border-border/50 whitespace-nowrap">
                      {ar ? col.labelAr : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, rIdx) => (
                    <tr key={rIdx} className="animate-pulse">
                      <td className="py-3 px-3 text-center border-e">
                        <div className="h-4 w-5 bg-muted rounded mx-auto" />
                      </td>
                      {activeColumns.map((col) => (
                        <td key={col.key} className="py-3 px-3.5 border-e">
                          <div className="h-4 w-24 bg-muted rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length + 1} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Info className="w-8 h-8 text-muted-foreground/50" />
                        <span className="text-sm font-semibold">
                          {ar ? "لا توجد سجلات مطابقة للفلاتر المحددة" : "No records match the current filters"}
                        </span>
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-primary">
                          {ar ? "تصفير الفلاتر" : "Reset Filters"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row: any, rIdx: number) => {
                    const rowSeq = (page - 1) * limit + rIdx + 1;
                    return (
                      <tr key={row.id || rIdx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-muted-foreground border-e border-border/50">
                          {rowSeq}
                        </td>
                        {activeColumns.map((col) => {
                          const val = row[col.key];
                          return (
                            <td key={col.key} className="py-2.5 px-3.5 border-e border-border/50 whitespace-nowrap">
                              {col.key === "occupantDetails" ? (
                                val && val !== "—" ? (
                                  <div className="flex flex-wrap items-center gap-1.5 min-w-[200px] max-w-[380px] whitespace-normal">
                                    {String(val).split(" | ").map((item, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300/40 shadow-xs"
                                      >
                                        <Users className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>{item}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground/70 bg-muted/20 font-normal">
                                    {ar ? "شاغرة (بدون ساكن)" : "Vacant"}
                                  </Badge>
                                )
                              ) : col.type === "badge" ? (
                                <Badge variant="outline" className="text-[11px] font-semibold bg-background">
                                  {val || "—"}
                                </Badge>
                              ) : col.type === "date" ? (
                                <span className="font-mono text-xs">{val ? formatDate(val) : "—"}</span>
                              ) : col.type === "status" ? (
                                <Badge
                                  className={`text-[11px] font-bold ${
                                    String(val).toLowerCase().includes("active") || String(val).toLowerCase().includes("available") || String(val).toLowerCase().includes("resolved")
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                                      : String(val).toLowerCase().includes("vacation") || String(val).toLowerCase().includes("pending")
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                  variant="outline"
                                >
                                  {val || "—"}
                                </Badge>
                              ) : col.type === "boolean" ? (
                                <span>{val ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}</span>
                              ) : (
                                <span className={col.type === "id" ? "font-mono font-bold" : ""}>
                                  {val !== undefined && val !== null && val !== "" ? (
                                    typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val) ? formatDate(val) : String(val)
                                  ) : "—"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t bg-muted/20">
            <DataPagination
              total={totalCount}
              pageSize={limit}
              currentPage={page}
              onPageChange={setPage}
              onPageSizeChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>
  );
}
