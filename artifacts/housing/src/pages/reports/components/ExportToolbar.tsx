import { Button } from "@/components/ui/button";
import { FileSpreadsheet, FileText } from "lucide-react";
import { Tab } from "../types";

interface ExportToolbarProps {
  canExportReports: boolean;
  activeTab: Tab;
  ar: boolean;
  handleExportAnalyticsPDF: () => void;
  handleExportExcel: () => void;
  handleExportPDF: () => void;
}

export function ExportToolbar({
  canExportReports,
  activeTab,
  ar,
  handleExportAnalyticsPDF,
  handleExportExcel,
  handleExportPDF,
}: ExportToolbarProps) {
  if (!canExportReports) return null;

  if (activeTab === "manager_flash") {
    return (
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleExportExcel}
          className="gap-2 text-emerald-700 border-emerald-200 hover:bg-emerald-50 text-xs"
        >
          <FileSpreadsheet className="w-4 h-4" />
          {ar ? "تصدير مصفوفة المباني Excel" : "Export Matrix Excel"}
        </Button>
        <Button
          variant="default"
          size="sm"
          onClick={handleExportPDF}
          className="gap-2 bg-amber-600 hover:bg-amber-700 text-white text-xs shadow-xs"
        >
          <FileText className="w-4 h-4" />
          {ar ? "تقرير المدير الصباحي PDF" : "Manager Flash PDF"}
        </Button>
      </div>
    );
  }

  if (activeTab === "analytics") {
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

  return (
    <>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportExcel}
        className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
      >
        <FileSpreadsheet className="w-4 h-4" />
        Excel
      </Button>
      <Button
        variant="outline"
        size="sm"
        onClick={handleExportPDF}
        className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
      >
        <FileText className="w-4 h-4" />
        PDF
      </Button>
    </>
  );
}
