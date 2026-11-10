import { Link } from "wouter";
import { SlidersHorizontal, ArrowLeft, ArrowRight, FileBarChart2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/date-utils";
import { ReportPrintStudioModal } from "./components/ReportPrintStudioModal";
import { useReportConfigurationPageState } from "./configuration/useReportConfigurationPageState";
import { renderBuilderHeader } from "./configuration/BuilderHeader";
import { renderDataSourcePicker } from "./configuration/DataSourcePicker";
import { renderColumnChooser } from "./configuration/ColumnChooser";
import { renderFiltersPanel } from "./configuration/FiltersPanel";
import { renderOutputOptionsBar } from "./configuration/OutputOptionsBar";
import { renderLivePreview } from "./configuration/LivePreview";
import { renderSaveTemplateDialog } from "./configuration/SaveTemplateDialog";
import { renderSavedTemplatesDialog } from "./configuration/SavedTemplatesDialog";

export default function ReportConfigurationPage() {
  const s = useReportConfigurationPageState();
  const { propertySlug, ar, canAccessConfig, settings, searchTerm, filterStatus, dateFrom, dateTo, customReportTitleAr, customReportTitleEn, customNotes, isStudioOpen, setIsStudioOpen, activePropObj, studioColumns, studioFormattedRows, studioCurrentPageRows, studioKpis, currentSourceDef } = s;


  // Permission gate placed after every hook (it used to return before most hooks, which
  // breaks the Rules of Hooks if the permission changes between renders).
  if (!canAccessConfig) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center p-6">
        <div className="w-16 h-16 rounded-2xl bg-destructive/10 border border-destructive/20 flex items-center justify-center">
          <ShieldAlert className="w-8 h-8 text-destructive" />
        </div>
        <div className="space-y-1 max-w-md">
          <h2 className="text-xl font-bold">{ar ? "غير مصرح بالدخول (403)" : "Access Denied (403)"}</h2>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "ليس لديك صلاحية لاستخدام منشئ ومخصص التقارير (reports.config). يرجى مراجعة مسؤول النظام."
              : "You do not have permission to access the Custom Report Configuration Generator (reports.config). Contact your administrator."}
          </p>
        </div>
        <Link href={`/${propertySlug || "all"}/reports`}>
          <Button variant="outline" className="gap-2">
            {ar ? <ArrowRight className="w-4 h-4" /> : <ArrowLeft className="w-4 h-4" />}
            {ar ? "العودة لمركز التقارير" : "Back to Reports"}
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ─── Header — matches Reports page style ──────────────────────── */}
      {renderBuilderHeader(s)}

      {/* ─── Navigation Tabs — matching Reports page TabsNav ────────────── */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 flex-wrap">
        <Link href={`/${propertySlug || "all"}/reports`}>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-background/50"
          >
            <FileBarChart2 className="w-4 h-4 text-amber-500" />
            {ar ? "مركز التقارير الشاملة" : "All Reports"}
          </button>
        </Link>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all bg-background text-foreground shadow-sm border"
        >
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          {ar ? "كستم ريبورت" : "Custom Reports"}
        </button>
      </div>

      {/* ─── Step 1: Select Data Source (7 Core Engines) ───────────────────── */}
      {renderDataSourcePicker(s)}

      {/* ─── Step 2: Choose Columns Dynamically ───────────────────────────── */}
      {renderColumnChooser(s)}

      {/* ─── Step 3: Multi-Criteria Filter Engine ─────────────────────────── */}
      {renderFiltersPanel(s)}

      {/* ─── Step 4: Layout & Print Output Customizer ─────────────────────── */}
      {renderOutputOptionsBar(s)}

      {/* ─── Step 5: Live Interactive Data Grid & Action Toolbar ──────────── */}
      {renderLivePreview(s)}

      {/* ─── Modal: Save Current Setup as Named Template ───────────────────── */}
      {renderSaveTemplateDialog(s)}

      {/* ─── Modal: Load Saved Templates ───────────────────────────────────── */}
      {renderSavedTemplatesDialog(s)}

      {/* Unified Report Print Studio Modal */}
      <ReportPrintStudioModal
        open={isStudioOpen}
        onOpenChange={setIsStudioOpen}
        title={customReportTitleEn || currentSourceDef?.label || "Custom Configured Report"}
        titleAr={customReportTitleAr || (ar ? currentSourceDef?.labelAr : currentSourceDef?.label) || "تقرير مخصص"}
        subtitle={customNotes || (ar ? "تقرير مخصص من إدارة السكن" : "Staff Housing Configured Report")}
        subtitleAr={customNotes || (ar ? "تقرير مخصص من إدارة السكن" : "Staff Housing Configured Report")}
        propertyName={activePropObj?.displayName || activePropObj?.name || undefined}
        propertyCode={activePropObj?.code || undefined}
        systemLogoUrl={(settings as any)?.systemLogo || undefined}
        propertyLogoUrl={(activePropObj as any)?.logo || undefined}
        filtersSummary={{
          [ar ? "مصدر البيانات" : "Data Source"]: ar ? currentSourceDef?.labelAr : currentSourceDef?.label,
          ...(searchTerm ? { [ar ? "بحث" : "Search"]: searchTerm } : {}),
          ...(filterStatus !== "all" ? { [ar ? "الحالة" : "Status"]: filterStatus } : {}),
          ...(dateFrom ? { [ar ? "من تاريخ" : "From"]: formatDate(dateFrom) } : {}),
          ...(dateTo ? { [ar ? "إلى تاريخ" : "To"]: formatDate(dateTo) } : {}),
        }}
        kpis={studioKpis}
        availableColumns={studioColumns}
        allRows={studioFormattedRows}
        currentPageRows={studioCurrentPageRows}
        initialLanguage={ar ? "ar" : "en"}
      />
    </div>
  );
}
