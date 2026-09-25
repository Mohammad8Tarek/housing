import React, { useState, useRef, useMemo } from "react";
import { useReactToPrint } from "react-to-print";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Printer,
  FileSpreadsheet,
  Columns3,
  ZoomIn,
  ZoomOut,
  Maximize2,
  RotateCw,
  Languages,
  Check,
  Type,
  FileText,
  PenTool,
  BarChart2,
  X,
} from "lucide-react";
import * as XLSX from "xlsx";
import { getExportFileName, formatDate } from "@/lib/date-utils";
import {
  PrintableReportDocument,
  type ReportColumnConfig,
  type ReportKpiItem,
} from "./PrintableReportDocument";

export interface ReportPrintStudioModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  titleAr?: string;
  subtitle?: string;
  subtitleAr?: string;
  propertyName?: string;
  propertyCode?: string;
  systemLogoUrl?: string;
  propertyLogoUrl?: string;
  generatedBy?: string;
  filtersSummary?: Record<string, string>;
  kpis?: ReportKpiItem[];
  availableColumns: ReportColumnConfig[];
  allRows: Record<string, any>[];
  currentPageRows?: Record<string, any>[];
  initialLanguage?: "ar" | "en";
}

export function ReportPrintStudioModal({
  open,
  onOpenChange,
  title,
  titleAr,
  subtitle,
  subtitleAr,
  propertyName,
  propertyCode,
  systemLogoUrl,
  propertyLogoUrl,
  generatedBy,
  filtersSummary,
  kpis = [],
  availableColumns,
  allRows,
  currentPageRows,
  initialLanguage = "ar",
}: ReportPrintStudioModalProps) {
  // Document orientation
  const autoOrientation = availableColumns.length > 7 ? "landscape" : "portrait";
  const [orientation, setOrientation] = useState<"portrait" | "landscape">(autoOrientation);

  // Document language
  const [language, setLanguage] = useState<"ar" | "en">(initialLanguage);
  const isAr = language === "ar";

  // Typography scale
  const [fontSize, setFontSize] = useState<"compact" | "standard" | "large">(
    availableColumns.length > 9 ? "compact" : "standard"
  );

  // Section visibility toggles
  const [showKpis, setShowKpis] = useState(kpis.length > 0);
  const [showSignatures, setShowSignatures] = useState(true);

  // Data scope (all vs current page)
  const [dataScope, setDataScope] = useState<"all" | "page">("all");

  // Column visibility
  const [visibleColumnKeys, setVisibleColumnKeys] = useState<Set<string>>(
    () => new Set(availableColumns.map((c) => c.key))
  );

  // Zoom level for on-screen preview
  const [zoom, setZoom] = useState<number>(100);

  // Printable ref
  const printRef = useRef<HTMLDivElement>(null);

  // Filter columns based on selection
  const activeColumns = useMemo(() => {
    return availableColumns.filter((c) => visibleColumnKeys.has(c.key));
  }, [availableColumns, visibleColumnKeys]);

  // Active rows based on scope
  const activeRows = useMemo(() => {
    if (dataScope === "page" && currentPageRows && currentPageRows.length > 0) {
      return currentPageRows;
    }
    return allRows;
  }, [dataScope, currentPageRows, allRows]);

  // Column toggling
  const toggleColumn = (key: string) => {
    setVisibleColumnKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  const selectAllColumns = () => {
    setVisibleColumnKeys(new Set(availableColumns.map((c) => c.key)));
  };

  // React to print setup
  const docTitle = useMemo(() => {
    const raw = isAr ? titleAr || title : title;
    return `${raw.replace(/\s+/g, "_")}_${formatDate(new Date())}`;
  }, [title, titleAr, isAr]);

  const handlePrint = useReactToPrint({
    contentRef: printRef,
    documentTitle: docTitle,
    pageStyle: `@page { size: ${orientation === "landscape" ? "A4 landscape" : "A4 portrait"}; margin: 8mm 10mm; }`,
  });

  // Excel Export
  const handleExportExcel = () => {
    if (!activeRows.length) return;

    // Filter row objects to only visible columns
    const exportData = activeRows.map((row, rIdx) => {
      const obj: Record<string, any> = {};
      activeColumns.forEach((col) => {
        const header = isAr ? col.headerAr || col.header : col.header;
        obj[header] =
          col.type === "index" ? rIdx + 1 : row[col.key] ?? row[col.header] ?? "";
      });
      return obj;
    });

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    const cleanSheetName = (isAr ? titleAr || title : title).slice(0, 31).replace(/[\\/?*[\]]/g, "_");
    XLSX.utils.book_append_sheet(wb, ws, cleanSheetName);
    XLSX.writeFile(wb, getExportFileName(`${docTitle}_Report`, "xlsx"));
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[96vw] w-[1400px] h-[94vh] flex flex-col p-0 gap-0 overflow-hidden bg-slate-900 border-slate-800 text-slate-100 shadow-2xl">
        {/* Studio Top Navigation & Controls Bar */}
        <div className="flex flex-col border-b border-slate-800 bg-slate-900/95 backdrop-blur px-5 py-3 shrink-0 gap-3">
          <div className="flex items-center justify-between gap-4">
            {/* Title & Document Badge */}
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400">
                <Printer className="w-5 h-5" />
              </div>
              <div>
                <DialogTitle className="text-base font-bold text-white flex items-center gap-2">
                  <span>{isAr ? "استوديو الطباعة والتقارير الفندقية" : "Sunrise Report Print Studio"}</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-rose-500/30 text-rose-400 bg-rose-500/5">
                    A4 {orientation === "landscape" ? (isAr ? "أفقي" : "Landscape") : (isAr ? "رأسي" : "Portrait")}
                  </Badge>
                </DialogTitle>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isAr ? titleAr || title : title} • {activeRows.length} {isAr ? "سجل جاهز" : "records ready"}
                </p>
              </div>
            </div>

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-2 h-9 text-xs font-semibold bg-emerald-950/40 border-emerald-700/50 text-emerald-300 hover:bg-emerald-900/60 hover:text-white"
              >
                <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
                <span>{isAr ? "تصدير Excel" : "Export Excel"}</span>
              </Button>

              <Button
                variant="default"
                size="sm"
                onClick={() => handlePrint()}
                className="gap-2 h-9 text-xs font-bold bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white shadow-md shadow-rose-900/30 px-4"
              >
                <Printer className="w-4 h-4" />
                <span>{isAr ? "طباعة / حفظ كـ PDF" : "Print / Save PDF"}</span>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => onOpenChange(false)}
                className="text-slate-400 hover:text-white hover:bg-slate-800 h-9 w-9"
              >
                <X className="w-4 h-4" />
              </Button>
            </div>
          </div>

          <Separator className="bg-slate-800" />

          {/* Interactive Customization Controls */}
          <div className="flex items-center justify-between flex-wrap gap-2 text-xs">
            <div className="flex items-center gap-2 flex-wrap">
              {/* Orientation */}
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-800/80 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrientation("landscape")}
                  className={`h-7 px-2.5 text-xs rounded-sm ${
                    orientation === "landscape"
                      ? "bg-rose-600 text-white font-bold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <RotateCw className="w-3.5 h-3.5 mr-1.5 rtl:mr-0 rtl:ml-1.5" />
                  {isAr ? "أفقي (Landscape)" : "Landscape"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setOrientation("portrait")}
                  className={`h-7 px-2.5 text-xs rounded-sm ${
                    orientation === "portrait"
                      ? "bg-rose-600 text-white font-bold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5 mr-1.5 rtl:mr-0 rtl:ml-1.5" />
                  {isAr ? "رأسي (Portrait)" : "Portrait"}
                </Button>
              </div>

              {/* Language */}
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-800/80 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLanguage("ar")}
                  className={`h-7 px-2.5 text-xs rounded-sm ${
                    language === "ar"
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  العربية
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setLanguage("en")}
                  className={`h-7 px-2.5 text-xs rounded-sm ${
                    language === "en"
                      ? "bg-blue-600 text-white font-bold"
                      : "text-slate-300 hover:text-white"
                  }`}
                >
                  English
                </Button>
              </div>

              {/* Font Scale */}
              <div className="inline-flex rounded-md border border-slate-700 bg-slate-800/80 p-0.5">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFontSize("compact")}
                  className={`h-7 px-2 text-xs rounded-sm ${
                    fontSize === "compact"
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={isAr ? "خط مدمج (يناسب الجداول العريضة)" : "Compact Font"}
                >
                  {isAr ? "مدمج" : "Compact"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFontSize("standard")}
                  className={`h-7 px-2 text-xs rounded-sm ${
                    fontSize === "standard"
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={isAr ? "خط قياسي" : "Standard Font"}
                >
                  {isAr ? "قياسي" : "Standard"}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setFontSize("large")}
                  className={`h-7 px-2 text-xs rounded-sm ${
                    fontSize === "large"
                      ? "bg-slate-700 text-white font-bold"
                      : "text-slate-400 hover:text-white"
                  }`}
                  title={isAr ? "خط كبير ومريح" : "Large Font"}
                >
                  {isAr ? "كبير" : "Large"}
                </Button>
              </div>

              {/* Column Chooser Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-1.5 border-slate-700 bg-slate-800/90 text-slate-200 hover:bg-slate-700 hover:text-white text-xs font-semibold"
                  >
                    <Columns3 className="w-3.5 h-3.5 text-rose-400" />
                    <span>
                      {isAr ? "الأعمدة" : "Columns"} ({activeColumns.length}/
                      {availableColumns.length})
                    </span>
                  </Button>
                </PopoverTrigger>
                <PopoverContent
                  align="start"
                  className="w-64 p-3 bg-slate-900 border-slate-800 text-slate-200 shadow-xl"
                >
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800 mb-2">
                    <span className="text-xs font-bold text-white">
                      {isAr ? "اختيار أعمدة الطباعة" : "Select Columns"}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={selectAllColumns}
                      className="h-6 text-[11px] text-rose-400 hover:text-rose-300 p-0"
                    >
                      {isAr ? "تحديد الكل" : "Select All"}
                    </Button>
                  </div>
                  <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                    {availableColumns.map((col) => {
                      const isChecked = visibleColumnKeys.has(col.key);
                      return (
                        <label
                          key={col.key}
                          className="flex items-center gap-2 p-1 rounded hover:bg-slate-800/60 cursor-pointer text-xs"
                        >
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={() => toggleColumn(col.key)}
                            className="border-slate-600 data-[state=checked]:bg-rose-600 data-[state=checked]:border-rose-600"
                          />
                          <span className="truncate">
                            {isAr ? col.headerAr || col.header : col.header}
                          </span>
                        </label>
                      );
                    })}
                  </div>
                </PopoverContent>
              </Popover>

              {/* KPI Toggle */}
              {kpis.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowKpis(!showKpis)}
                  className={`h-8 gap-1.5 border-slate-700 text-xs font-medium ${
                    showKpis
                      ? "bg-slate-800 text-rose-400 border-rose-500/40"
                      : "bg-slate-900/60 text-slate-400 hover:text-white"
                  }`}
                >
                  <BarChart2 className="w-3.5 h-3.5" />
                  <span>{isAr ? "كروت الأرقام" : "KPI Cards"}</span>
                </Button>
              )}

              {/* Signatures Toggle */}
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSignatures(!showSignatures)}
                className={`h-8 gap-1.5 border-slate-700 text-xs font-medium ${
                  showSignatures
                    ? "bg-slate-800 text-rose-400 border-rose-500/40"
                    : "bg-slate-900/60 text-slate-400 hover:text-white"
                }`}
              >
                <PenTool className="w-3.5 h-3.5" />
                <span>{isAr ? "صناديق التوقيعات" : "Approval Signatures"}</span>
              </Button>

              {/* Scope (All vs Page) */}
              {currentPageRows && currentPageRows.length < allRows.length && (
                <div className="inline-flex rounded-md border border-slate-700 bg-slate-800/80 p-0.5">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDataScope("all")}
                    className={`h-7 px-2 text-xs rounded-sm ${
                      dataScope === "all"
                        ? "bg-slate-700 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isAr ? `الكل (${allRows.length})` : `All (${allRows.length})`}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setDataScope("page")}
                    className={`h-7 px-2 text-xs rounded-sm ${
                      dataScope === "page"
                        ? "bg-slate-700 text-white font-bold"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {isAr
                      ? `الصفحة (${currentPageRows.length})`
                      : `Page (${currentPageRows.length})`}
                  </Button>
                </div>
              )}
            </div>

            {/* On-screen Zoom Controls */}
            <div className="flex items-center gap-1 bg-slate-800/90 rounded-md border border-slate-700 px-1 py-0.5">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((z) => Math.max(50, z - 15))}
                className="h-7 w-7 text-slate-300 hover:text-white"
                title={isAr ? "تصغير المعاينة" : "Zoom Out"}
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </Button>
              <span className="text-[11px] font-mono w-10 text-center text-slate-300">
                {zoom}%
              </span>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom((z) => Math.min(150, z + 15))}
                className="h-7 w-7 text-slate-300 hover:text-white"
                title={isAr ? "تكبير المعاينة" : "Zoom In"}
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setZoom(100)}
                className="h-7 w-7 text-slate-300 hover:text-white"
                title={isAr ? "إعادة تعيين الحجم الطبيعي" : "Reset Zoom"}
              >
                <Maximize2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>
        </div>

        {/* Live A4 Interactive Preview Viewport */}
        <div className="flex-1 bg-slate-950 overflow-auto p-8 flex justify-center items-start shadow-inner">
          <div
            style={{
              transform: `scale(${zoom / 100})`,
              transformOrigin: "top center",
              transition: "transform 0.15s ease",
            }}
            className="transition-transform"
          >
            {/* Visual A4 Paper Simulation Canvas */}
            <div
              className="bg-white text-slate-900 shadow-2xl rounded-xs overflow-hidden border border-slate-300"
              style={{
                width: orientation === "landscape" ? "297mm" : "210mm",
                minHeight: orientation === "landscape" ? "210mm" : "297mm",
                padding: "8mm 10mm",
                boxSizing: "border-box",
              }}
            >
              <PrintableReportDocument
                ref={printRef}
                title={title}
                titleAr={titleAr}
                subtitle={subtitle}
                subtitleAr={subtitleAr}
                propertyName={propertyName}
                propertyCode={propertyCode}
                systemLogoUrl={systemLogoUrl}
                propertyLogoUrl={propertyLogoUrl}
                generatedBy={generatedBy}
                filtersSummary={filtersSummary}
                kpis={kpis}
                columns={activeColumns}
                rows={activeRows}
                language={language}
                orientation={orientation}
                fontSize={fontSize}
                showKpis={showKpis}
                showSignatures={showSignatures}
              />
            </div>
          </div>
        </div>

        {/* Bottom Footer Info Bar */}
        <div className="border-t border-slate-800 bg-slate-900 px-6 py-2.5 flex items-center justify-between text-xs text-slate-400">
          <div className="flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
            <span>
              {isAr
                ? "معاينة مطابقة تماماً لمخرجات الطابعة وملفات الـ PDF المتجهية عالية الجودة (Vector A4)"
                : "Exact 1:1 preview matching native A4 vector print and PDF output"}
            </span>
          </div>
          <div className="flex items-center gap-4 text-slate-500">
            <span>
              {isAr ? "عدد الأعمدة المحددة:" : "Active Columns:"}{" "}
              <strong className="text-slate-300 font-mono">
                {activeColumns.length}
              </strong>
            </span>
            <span>•</span>
            <span>
              {isAr ? "عدد الصفوف:" : "Active Rows:"}{" "}
              <strong className="text-slate-300 font-mono">
                {activeRows.length}
              </strong>
            </span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
