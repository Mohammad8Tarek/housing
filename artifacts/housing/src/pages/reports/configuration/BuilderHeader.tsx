// Custom report builder: header and template actions.
import {
  SlidersHorizontal,
  BookmarkPlus,
  FolderOpen,
  RotateCcw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderBuilderHeader(s: ReportConfigurationPageState) {
  const {
    ar,
    setIsSaveModalOpen,
    setIsLoadModalOpen,
    setTemplateName,
    templates,
    resetFilters,
    currentSourceDef,
  } = s;
  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
      <div className="flex items-center gap-3">
        <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
          <SlidersHorizontal className="w-6 h-6 text-primary" />
          {ar
            ? "كستم ريبورت (مُنشئ التقارير المخصصة)"
            : "Custom Reports (Custom Builder)"}
        </h1>
        <Badge
          variant="outline"
          className="bg-primary/10 text-primary border-primary/20 text-xs font-bold"
        >
          {ar ? "تحكم كامل" : "Full Control"}
        </Badge>
      </div>
      <div className="flex gap-2 flex-wrap items-center">
        <Button
          variant="outline"
          size="sm"
          onClick={() => setIsLoadModalOpen(true)}
          className="flex items-center gap-2 rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
        >
          <FolderOpen className="w-4 h-4 text-amber-600" />
          <span>{ar ? "النماذج المحفوظة" : "Saved Templates"}</span>
          {templates.length > 0 && (
            <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center">
              {templates.length}
            </span>
          )}
        </Button>

        <PermissionGate module="reports" action="create">
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTemplateName(
                ar
                  ? `تقرير ${currentSourceDef.labelAr} المخصص`
                  : `${currentSourceDef.label} Custom`,
              );
              setIsSaveModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>{ar ? "حفظ كنموذج" : "Save as Template"}</span>
          </Button>
        </PermissionGate>

        <Button
          variant="ghost"
          size="sm"
          onClick={resetFilters}
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground rounded-xl"
          title={ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
        >
          <RotateCcw className="w-4 h-4" />
          <span className="text-xs">{ar ? "تصفير" : "Reset"}</span>
        </Button>
      </div>
    </div>
  );
}
