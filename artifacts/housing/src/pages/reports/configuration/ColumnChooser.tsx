// Choose report columns.
import { CheckSquare, Square } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderColumnChooser(s: ReportConfigurationPageState) {
  const { ar, selectedColumnKeys, allColumnsForSource, categorizedColumns, toggleColumn, selectAllColumns, resetToDefaultColumns } = s;
  return (
<div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
              2
            </span>
            {ar ? "تحديد واختيار الأعمدة المطلوبة في التقرير (Column Chooser)" : "Choose Columns to Display"}
          </h2>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
              {ar
                ? `${selectedColumnKeys.length} من أصل ${allColumnsForSource.length} أعمدة مختارة`
                : `${selectedColumnKeys.length} of ${allColumnsForSource.length} columns selected`}
            </Badge>
            <Button variant="ghost" size="sm" onClick={selectAllColumns} className="h-7 text-xs px-2">
              {ar ? "تحديد الكل" : "Select All"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetToDefaultColumns} className="h-7 text-xs px-2 text-muted-foreground">
              {ar ? "الافتراضي" : "Default"}
            </Button>
          </div>
        </div>

        {/* Categorized Column Chooser */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-card border rounded-2xl p-4">
          {categorizedColumns.map((cat, idx) => (
            <div key={idx} className="space-y-2.5 bg-muted/20 border border-muted/50 rounded-xl p-3">
              <div className="text-xs font-extrabold text-foreground/80 flex items-center justify-between border-b pb-1.5">
                <span>{ar ? cat.titleAr : cat.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({cat.cols.filter((c) => selectedColumnKeys.includes(c.key)).length}/{cat.cols.length})
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {cat.cols.map((col) => {
                  const checked = selectedColumnKeys.includes(col.key);
                  return (
                    <label
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                        checked
                          ? "bg-primary/10 border-primary/30 text-foreground font-semibold"
                          : "bg-background/80 border-transparent hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                        )}
                        <span>{ar ? col.labelAr : col.label}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 opacity-70">
                        {col.type}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>
  );
}
