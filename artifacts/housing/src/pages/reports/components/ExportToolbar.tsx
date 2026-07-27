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
