// Import job-level policies from Excel (preview + confirm).
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, FileSpreadsheet, Upload } from "lucide-react";
import type { PoliciesSectionState } from "./usePoliciesSectionState";

export function renderImportPoliciesDialog(s: PoliciesSectionState) {
  const { ar, isImportModalOpen, setIsImportModalOpen, importFileName, setImportFileName, importData, setImportData, handleFileChange, handleConfirmImport } = s;
  return (
<Dialog open={isImportModalOpen} onOpenChange={setIsImportModalOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-primary">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            {ar ? "استيراد وتحديث السياسات من ملف إكسيل" : "Import Policies from Excel"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "قم برفع ملف الإكسيل المطابق للنموذج المعتمد لتحديث سعات الدرجات والقواعد المخصصة والسياسات العامة تلقائياً."
              : "Upload an Excel workbook formatted like the official template to import level capacities, custom rules, and policies."}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* File Upload Zone */}
          <div className="border-2 border-dashed rounded-xl p-6 text-center space-y-2 hover:bg-muted/30 transition-colors bg-muted/10">
            <Upload className="w-8 h-8 mx-auto text-muted-foreground/60" />
            <div className="space-y-1">
              <p className="text-xs font-semibold">
                {importFileName ||
                  (ar
                    ? "اختر ملف إكسيل (.xlsx أو .xls)"
                    : "Choose Excel file (.xlsx or .xls)")}
              </p>
              <p className="text-[11px] text-muted-foreground">
                {ar
                  ? "يمكنك استخدام زر 'تصدير نموذج إكسيل' لتعبئة البيانات المطلوبة"
                  : "You can download the template using the 'Export Excel Template' button"}
              </p>
            </div>
            <input
              type="file"
              accept=".xlsx, .xls"
              id="policy-excel-upload"
              className="hidden"
              onChange={handleFileChange}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="text-xs mt-2"
              onClick={() =>
                document.getElementById("policy-excel-upload")?.click()
              }
            >
              <Upload className="w-3.5 h-3.5 mr-1.5 rtl:ml-1.5 rtl:mr-0" />
              {ar ? "تصفح الملفات..." : "Browse files..."}
            </Button>
          </div>

          {/* Preview Summary */}
          {importData && (
            <div className="rounded-xl border bg-muted/30 p-3.5 space-y-2 text-xs">
              <span className="font-bold flex items-center gap-1.5 text-foreground">
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                {ar ? "ملخص البيانات المكتشفة في الملف:" : "Detected Excel Content:"}
              </span>
              <div className="grid grid-cols-3 gap-2 text-center pt-1">
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "سعات الدرجات" : "Level Capacities"}
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {importData.levelCapacities.length}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "قواعد مخصصة" : "Custom Rules"}
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {importData.customRules.length}
                  </span>
                </div>
                <div className="p-2 rounded-lg bg-background border">
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "سياسات عامة" : "General Policies"}
                  </span>
                  <span className="font-bold text-sm text-primary">
                    {importData.generalPolicies.length}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsImportModalOpen(false);
              setImportData(null);
              setImportFileName("");
            }}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            disabled={!importData}
            onClick={handleConfirmImport}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {ar ? "تطبيق السياسات على الإعدادات" : "Apply to Settings"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
