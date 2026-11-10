// Save the current builder state as a template.
import { BookmarkPlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderSaveTemplateDialog(s: ReportConfigurationPageState) {
  const { ar, selectedColumnKeys, orientation, isSaveModalOpen, setIsSaveModalOpen, templateName, setTemplateName, templateNameEn, setTemplateNameEn, saveTemplateMutation, handleSaveCurrentAsTemplate, currentSourceDef } = s;
  return (
<Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <BookmarkPlus className="w-5 h-5 text-primary" />
              {ar ? "حفظ كنموذج تقرير مخصص" : "Save as Custom Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-muted-foreground">
              {ar
                ? "سيتم حفظ مصدر البيانات والأعمدة المختارة والفلاتر الحالية لتقوم بتشغيل هذا التقرير بضغطة زر واحدة في أي وقت."
                : "Save your current data source, selected columns, and filters to run this custom report in one click anytime."}
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? "اسم النموذج بالعربية *" : "Template Name (Arabic) *"}</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={ar ? "مثال: كشف غرف الدور الثاني المميزة" : "e.g. 2nd Floor VIP Rooms"}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? "الاسم بالإنجليزية (اختياري)" : "Template Name (English)"}</Label>
              <Input
                value={templateNameEn}
                onChange={(e) => setTemplateNameEn(e.target.value)}
                placeholder="e.g. VIP Floor 2 Rooms"
                className="text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{ar ? "مصدر البيانات:" : "Data Source:"}</span>
                <span className="font-bold">{ar ? currentSourceDef.labelAr : currentSourceDef.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{ar ? "الأعمدة المحددة:" : "Columns:"}</span>
                <span className="font-bold">{selectedColumnKeys.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{ar ? "الاتجاه:" : "Orientation:"}</span>
                <span className="font-bold">{orientation}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsSaveModalOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <PermissionGate module="reports" action="create">
              <Button
                size="sm"
                onClick={handleSaveCurrentAsTemplate}
                disabled={saveTemplateMutation.isPending || !templateName.trim()}
                className="bg-primary text-primary-foreground font-bold"
              >
                {saveTemplateMutation.isPending ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ النموذج" : "Save Template")}
              </Button>
            </PermissionGate>
          </DialogFooter>
        </DialogContent>
      </Dialog>
  );
}
