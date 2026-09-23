import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Download } from "lucide-react";
import { Tab } from "../types";
import { ColumnChooser, ColDef } from "@/components/ui/column-chooser";

interface ExportToolbarProps {
  canExportReports: boolean;
  activeTab: Tab;
  ar: boolean;
  handleExportAnalyticsPDF: () => void;
  handleExportExcel: () => void;
  handleExportPDF: () => void;
  cols?: ColDef[];
  visible?: Set<string>;
  onToggle?: (key: string, checked: boolean) => void;
  onShowAll?: () => void;
  onHideAll?: () => void;
  // Smart report export props (jsPDF + AutoTable system)
  handleSmartExportPdf?: () => void;
  handleSmartExportCsv?: () => void;
  handleSmartExportXlsx?: () => void;
  isSmartExportingPdf?: boolean;
  isSmartExportingCsv?: boolean;
  isSmartExportingXlsx?: boolean;
  hasSmartReport?: boolean;
}

export function ExportToolbar({
  canExportReports,
  activeTab,
  ar,
  handleExportAnalyticsPDF,
  handleExportExcel,
  handleExportPDF,
  cols,
  visible,
  onToggle,
  onShowAll,
  onHideAll,
  handleSmartExportPdf,
  handleSmartExportCsv,
  handleSmartExportXlsx,
  isSmartExportingPdf,
  isSmartExportingCsv,
  isSmartExportingXlsx,
  hasSmartReport,
}: ExportToolbarProps) {
  if (!canExportReports) return null;

  const columnChooserElement = cols && cols.length > 0 && visible && onToggle ? (
    <ColumnChooser
      cols={cols}
      visible={visible}
      onToggle={onToggle}
      onShowAll={onShowAll}
      onHideAll={onHideAll}
      ar={ar}
    />
  ) : null;

  // Tabs that have their own self-contained toolbar/actions (prevent duplicate print & export buttons)
  if (
    activeTab === "manager_flash" ||
    activeTab === "service_ratings" ||
    activeTab === "housing_map" ||
    activeTab === "occupancy_forecast" ||
    activeTab === "analytics" ||
    activeTab === "housing_ratings" ||
    activeTab === "room_moves"
  ) {
    return null;
  }

  if (activeTab === "housekeeping_sheet") {
    return (
      <div className="flex items-center gap-2">
        {columnChooserElement}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {ar ? "تصدير المهام Excel" : "Task Sheet Excel"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleExportPDF}
          className="gap-2 bg-sky-600 hover:bg-sky-700 text-white text-xs shadow-xs"
        >
          <FileText className="w-4 h-4" />
          {ar ? "طباعة كشف المهام الميداني PDF" : "Print Task Sheet PDF"}
        </Button>
      </div>
    );
  }

  if (activeTab === "room_discrepancy") {
    return (
      <div className="flex items-center gap-2">
        {columnChooserElement}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {ar ? "تصدير تدقيق الغرف Excel" : "Discrepancy Excel"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleExportPDF}
          className="gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-xs"
        >
          <FileText className="w-4 h-4" />
          {ar ? "تقرير التدقيق والمطابقة PDF" : "Discrepancy Audit PDF"}
        </Button>
      </div>
    );
  }

  if ((activeTab as string) === "occupancy_forecast") {
    return (
      <div className="flex items-center gap-2">
        {columnChooserElement}
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {ar ? "تصدير التوقعات Excel" : "Forecast Excel"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleExportPDF}
          className="gap-2 bg-violet-600 hover:bg-violet-700 text-white text-xs shadow-xs"
        >
          <FileText className="w-4 h-4" />
          {ar ? "تقرير التوقعات PDF" : "Forecast PDF"}
        </Button>
      </div>
    );
  }

  if ((activeTab as string) === "analytics") {
    return (
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportAnalyticsPDF}
        className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
      >
        <FileText className="w-4 h-4" />
        {ar ? "طباعة التحليلات PDF" : "Print Analytics PDF"}
      </Button>
    );
  }

  // ── Unified Luxury Report Toolbar for all tabs ──
  return (
    <div className="flex items-center gap-2">
      {columnChooserElement}
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportExcel}
        className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs font-semibold"
      >
        <FileSpreadsheet className="w-4 h-4" />
        {ar ? "تصدير Excel" : "Excel"}
      </Button>
      {hasSmartReport && handleSmartExportCsv && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSmartExportCsv}
          disabled={isSmartExportingCsv}
          className="gap-2 text-slate-700 border-slate-200 hover:bg-slate-50 text-xs font-semibold"
        >
          <Download className="w-4 h-4" />
          {isSmartExportingCsv
            ? (ar ? "جاري التصدير..." : "Exporting...")
            : "CSV"}
        </Button>
      )}
      <Button
        variant="default"
        size="sm"
        onClick={handleExportPDF}
        className="gap-2 bg-rose-600 hover:bg-rose-700 text-white text-xs shadow-xs font-semibold"
      >
        <FileText className="w-4 h-4" />
        {ar ? "طباعة تقرير PDF" : "Print PDF"}
      </Button>
    </div>
  );
}
