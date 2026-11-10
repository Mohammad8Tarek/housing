// Add/edit an approval signature step.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { CheckCircle2, FileCheck } from "lucide-react";
import { PREDEFINED_ROLES } from "./PoliciesSection.constants";
import type { PoliciesSectionState } from "./usePoliciesSectionState";

export function renderSignatureStepDialog(s: PoliciesSectionState) {
  const { ar, existingJobTitles, isStepModalOpen, setIsStepModalOpen, editingStepIndex, stepForm, setStepForm, handleSaveStep } = s;
  return (
<Dialog open={isStepModalOpen} onOpenChange={setIsStepModalOpen}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <FileCheck className="w-5 h-5 text-pink-600" />
            {editingStepIndex !== null
              ? (ar ? "تعديل خطوة الاعتماد" : "Edit Signature Step")
              : (ar ? "إضافة خطوة اعتماد جديدة" : "Add Approval Step")}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "حدد الوظيفة المطلوبة للتوقيع والمسمى الرسمي الذي سيظهر في استمارة الاعتماد"
              : "Select the required approval role and the official title shown on vouchers"}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {/* Quick Preset Selector */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "اختر من الوظائف الشائعة أو القائمة:" : "Quick Preset Role:"}
            </label>
            <select
              className="w-full h-9 px-3 rounded-md border text-xs bg-background focus:outline-none focus:ring-1 focus:ring-primary"
              value={
                PREDEFINED_ROLES.some((r) => r.key === stepForm.roleRequired)
                  ? stepForm.roleRequired
                  : "custom"
              }
              onChange={(e) => {
                const val = e.target.value;
                if (val === "custom") {
                  setStepForm((prev) => ({ ...prev, roleRequired: "" }));
                } else {
                  const preset = PREDEFINED_ROLES.find((r) => r.key === val);
                  if (preset) {
                    setStepForm((prev) => ({
                      ...prev,
                      roleRequired: preset.key,
                      labelAr: preset.ar,
                      labelEn: preset.en,
                    }));
                  }
                }
              }}
            >
              <optgroup label={ar ? "الأدوار القياسية" : "Standard Roles"}>
                {PREDEFINED_ROLES.map((r) => (
                  <option key={r.key} value={r.key}>
                    {ar ? `${r.ar} (${r.en})` : `${r.en} (${r.ar})`}
                  </option>
                ))}
              </optgroup>
              {existingJobTitles && existingJobTitles.length > 0 && (
                <optgroup label={ar ? "المسميات المسجلة بالنظام" : "Lookup Job Titles"}>
                  {existingJobTitles.map((jt: any) => (
                    <option key={jt.id || jt.value} value={jt.value}>
                      {ar ? jt.labelAr || jt.label : jt.label}
                    </option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {/* Role Required Code */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "كود / مفتاح الوظيفة (Role Key):" : "Role Key (System Identifier):"}
            </label>
            <Input
              placeholder="e.g. housing_manager, general_manager"
              value={stepForm.roleRequired}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, roleRequired: e.target.value }))
              }
              className="font-mono text-xs"
            />
            <span className="text-[10px] text-muted-foreground block">
              {ar
                ? "يجب أن يطابق كود الدور أو المسمى الوظيفي للمستخدمين المصرح لهم بالتوقيع"
                : "Must match the user's role or job title identifier to allow signing"}
            </span>
          </div>

          {/* Arabic Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "المسمى الرسمي بالعربية:" : "Official Title (Arabic):"}
            </label>
            <Input
              placeholder="مثال: مدير السكن / مدير الموارد البشرية"
              value={stepForm.labelAr}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, labelAr: e.target.value }))
              }
              className="text-xs"
            />
          </div>

          {/* English Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "المسمى الرسمي بالإنجليزية:" : "Official Title (English):"}
            </label>
            <Input
              placeholder="e.g. Housing Manager / HR Manager"
              value={stepForm.labelEn}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, labelEn: e.target.value }))
              }
              className="text-xs"
            />
          </div>

          {/* Description / Instructions */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-foreground">
              {ar ? "ملاحظات وتوجيهات الخطوة (اختياري):" : "Step Notes / Guidance (Optional):"}
            </label>
            <Input
              placeholder={ar ? "مثال: مراجعة المستندات والأهلية..." : "e.g. Review documents and eligibility..."}
              value={stepForm.description}
              onChange={(e) =>
                setStepForm((prev) => ({ ...prev, description: e.target.value }))
              }
              className="text-xs"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setIsStepModalOpen(false)}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleSaveStep}
            className="bg-pink-600 hover:bg-pink-700 text-white font-bold gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {ar ? "حفظ الخطوة" : "Save Step"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
