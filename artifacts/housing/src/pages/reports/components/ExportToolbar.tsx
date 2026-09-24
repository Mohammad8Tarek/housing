import type { MutableRefObject, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Download, Printer } from "lucide-react";
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
  // Custom tab export handlers (for self-contained tabs like room_moves, housing_map, etc.)
  customExportActions?: {
    exportExcel?: () => void;
    exportPDF?: () => void;
  };
  customExportRef?:
    | MutableRefObject<{
        exportExcel?: () => void;
        exportPDF?: () => void;
      } | undefined>
    | RefObject<{
        exportExcel?: () => void;
        exportPDF?: () => void;
      } | undefined>;
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
  customExportActions,
  customExportRef,
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

  const handleExcelClick = () => {
    const custom = customExportRef?.current || customExportActions;
    if (custom?.exportExcel) {
      custom.exportExcel();
    } else if (hasSmartReport && handleSmartExportXlsx) {
      handleSmartExportXlsx();
    } else {
      handleExportExcel();
    }
  };

  const handlePdfClick = () => {
    const custom = customExportRef?.current || customExportActions;
    if (activeTab === "analytics") {
      handleExportAnalyticsPDF();
    } else if (custom?.exportPDF) {
      custom.exportPDF();
    } else if (hasSmartReport && handleSmartExportPdf) {
      handleSmartExportPdf();
    } else {
      handleExportPDF();
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {columnChooserElement}

      {/* Unified Excel Button */}
      <Button
        variant="default"
        size="sm"
        onClick={handleExcelClick}
        disabled={isSmartExportingXlsx}
        className="gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs shadow-xs font-bold h-9 px-3.5 rounded-lg border-0 transition-all shrink-0 cursor-pointer"
        title={ar ? "تصدير البيانات الحالية كملف Excel" : "Export current dataset to Excel (.xlsx)"}
      >
        <FileSpreadsheet className="w-4 h-4 text-white shrink-0" />
        <span>
          {isSmartExportingXlsx
            ? (ar ? "جاري التصدير..." : "Exporting...")
            : (ar ? "تصدير Excel" : "Export Excel")}
        </span>
      </Button>

      {/* Smart CSV Button (when applicable) */}
      {hasSmartReport && handleSmartExportCsv && (
        <Button
          variant="outline"
          size="sm"
          onClick={handleSmartExportCsv}
          disabled={isSmartExportingCsv}
          className="gap-2 text-slate-700 dark:text-slate-300 border-slate-300 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-900 text-xs font-semibold h-9 px-3 rounded-lg shrink-0 cursor-pointer"
          title={ar ? "تصدير كملف CSV" : "Export as CSV"}
        >
          <Download className="w-4 h-4 shrink-0" />
          <span>
            {isSmartExportingCsv
              ? (ar ? "جاري التصدير..." : "Exporting...")
              : "CSV"}
          </span>
        </Button>
      )}

      {/* Unified Print / PDF Report Button */}
      <Button
        variant="default"
        size="sm"
        onClick={handlePdfClick}
        disabled={isSmartExportingPdf}
        className="gap-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs shadow-xs font-bold h-9 px-3.5 rounded-lg border-0 transition-all shrink-0 cursor-pointer"
        title={ar ? "معاينة وطباعة التقرير الفاخر بصيغة PDF" : "Print luxury report as PDF"}
      >
        <Printer className="w-4 h-4 text-white shrink-0" />
        <span>
          {isSmartExportingPdf
            ? (ar ? "جاري التجهيز..." : "Generating...")
            : (ar ? "طباعة تقرير PDF" : "Print PDF Report")}
        </span>
      </Button>
    </div>
  );
}
