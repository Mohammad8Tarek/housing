import type { MutableRefObject, RefObject } from "react";
import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText, Download, Printer, ChevronDown } from "lucide-react";
import { Tab } from "../types";
import { ColumnChooser, ColDef } from "@/components/ui/column-chooser";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface ExportToolbarProps {
  canExportReports: boolean;
  activeTab: Tab;
  ar: boolean;
  handleExportAnalyticsPDF: () => void;
  handleExportExcel: (scope?: "all" | "page") => void;
  handleExportPDF: (scope?: "all" | "page") => void;
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

  const handleExcelClick = (scope: "all" | "page" = "all") => {
    const custom = customExportRef?.current || customExportActions;
    if (custom?.exportExcel) {
      custom.exportExcel();
    } else if (hasSmartReport && handleSmartExportXlsx) {
      handleSmartExportXlsx();
    } else {
      handleExportExcel(scope);
    }
  };

  const handlePdfClick = (scope: "all" | "page" = "all") => {
    const custom = customExportRef?.current || customExportActions;
    if (activeTab === "analytics") {
      handleExportAnalyticsPDF();
    } else if (custom?.exportPDF) {
      custom.exportPDF();
    } else {
      handleExportPDF(scope);
    }
  };

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {columnChooserElement}

      {/* Unified Excel Split Button */}
      <div className="inline-flex rounded-lg shadow-xs overflow-hidden shrink-0">
        <Button
          variant="default"
          size="sm"
          onClick={() => handleExcelClick("all")}
          disabled={isSmartExportingXlsx}
          className="gap-2 bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-xs font-bold h-9 px-3.5 rounded-l-lg rtl:rounded-l-none rtl:rounded-r-lg rounded-r-none rtl:rounded-l-none border-0 transition-all cursor-pointer"
          title={ar ? "تصدير جميع النتائج كملف Excel (الافتراضي)" : "Export all results to Excel (.xlsx)"}
        >
          <FileSpreadsheet className="w-4 h-4 text-white shrink-0" />
          <span>
            {isSmartExportingXlsx
              ? (ar ? "جاري التصدير..." : "Exporting...")
              : (ar ? "تصدير Excel" : "Export Excel")}
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={isSmartExportingXlsx}
              className="bg-emerald-700 hover:bg-emerald-800 active:bg-emerald-900 text-white h-9 px-1.5 rounded-r-lg rtl:rounded-r-none rtl:rounded-l-lg rounded-l-none rtl:rounded-r-none border-0 border-l rtl:border-l-0 rtl:border-r border-emerald-500/40 transition-all cursor-pointer"
              title={ar ? "خيارات التصدير" : "Export options"}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={ar ? "start" : "end"} className="w-56">
            <DropdownMenuItem
              onClick={() => handleExcelClick("all")}
              className="text-xs font-medium cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 text-emerald-600" />
              <span>{ar ? "تصدير جميع النتائج (الافتراضي)" : "Export All Results (Default)"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handleExcelClick("page")}
              className="text-xs font-medium cursor-pointer"
            >
              <FileSpreadsheet className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 text-emerald-600" />
              <span>{ar ? "تصدير الصفحة الحالية فقط" : "Export Current Page Only"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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

      {/* Unified Print / PDF Report Split Button */}
      <div className="inline-flex rounded-lg shadow-xs overflow-hidden shrink-0">
        <Button
          variant="default"
          size="sm"
          onClick={() => handlePdfClick("all")}
          disabled={isSmartExportingPdf}
          className="gap-2 bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white text-xs font-bold h-9 px-3.5 rounded-l-lg rtl:rounded-l-none rtl:rounded-r-lg rounded-r-none rtl:rounded-l-none border-0 transition-all cursor-pointer"
          title={ar ? "طباعة التقرير كاملاً بصيغة PDF (الافتراضي)" : "Print complete report as PDF"}
        >
          <Printer className="w-4 h-4 text-white shrink-0" />
          <span>
            {isSmartExportingPdf
              ? (ar ? "جاري التجهيز..." : "Generating...")
              : (ar ? "طباعة تقرير PDF" : "Print PDF Report")}
          </span>
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="default"
              size="sm"
              disabled={isSmartExportingPdf}
              className="bg-rose-700 hover:bg-rose-800 active:bg-rose-900 text-white h-9 px-1.5 rounded-r-lg rtl:rounded-r-none rtl:rounded-l-lg rounded-l-none rtl:rounded-r-none border-0 border-l rtl:border-l-0 rtl:border-r border-rose-500/40 transition-all cursor-pointer"
              title={ar ? "خيارات الطباعة" : "Print options"}
            >
              <ChevronDown className="w-3.5 h-3.5" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align={ar ? "start" : "end"} className="w-56">
            <DropdownMenuItem
              onClick={() => handlePdfClick("all")}
              className="text-xs font-medium cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 text-rose-600" />
              <span>{ar ? "طباعة جميع النتائج (الافتراضي)" : "Print All Results (Default)"}</span>
            </DropdownMenuItem>
            <DropdownMenuItem
              onClick={() => handlePdfClick("page")}
              className="text-xs font-medium cursor-pointer"
            >
              <Printer className="w-4 h-4 mr-2 rtl:mr-0 rtl:ml-2 text-rose-600" />
              <span>{ar ? "طباعة الصفحة الحالية فقط" : "Print Current Page Only"}</span>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </div>
  );
}
