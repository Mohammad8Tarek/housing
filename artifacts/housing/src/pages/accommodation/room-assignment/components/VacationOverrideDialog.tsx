import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, AlertTriangle } from "lucide-react";
import type { VacationPromptData } from "../types";

/** ── ديالوج تأكيد تصريح الإدارة للتسكين المؤقت (بديل إجازة) ── */
export function VacationOverrideDialog({
  ar,
  vacationPromptData,
  onCancel,
  selectedBed,
  expectedCheckOut,
  setExpectedCheckOut,
  onConfirm,
}: {
  ar: boolean;
  vacationPromptData: VacationPromptData | null;
  onCancel: () => void;
  selectedBed: string;
  expectedCheckOut: string;
  setExpectedCheckOut: (iso: string) => void;
  onConfirm: () => void;
}) {
  return (
    <Dialog
      open={!!vacationPromptData}
      onOpenChange={(open) => !open && onCancel()}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <AlertTriangle className="w-5 h-5" />
            {ar
              ? "تصريح إدارة السكن: تسكين مؤقت بديل إجازة"
              : "Manager Override: Temporary Vacation Housing"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2 text-sm">
          <p className="text-foreground">
            {ar
              ? `السرير رقم (${selectedBed}) مخصص للموظف (${vacationPromptData?.occupantName}) وهو حالياً في إجازة رسمية${
                  vacationPromptData?.vacationEndDate
                    ? ` حتى تاريخ ${vacationPromptData.vacationEndDate}`
                    : ""
                }.`
              : `Bed #${selectedBed} is assigned to ${vacationPromptData?.occupantName} who is currently on vacation.`}
          </p>
          <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs space-y-1 text-amber-900 dark:text-amber-200">
            <p className="font-bold">
              {ar
                ? "ضوابط التسكين المؤقت وفقاً لسياسة السكن:"
                : "Policy Rules:"}
            </p>
            <p>
              •{" "}
              {ar
                ? "يُسمح بالتسكين المؤقت فقط بقرار وتصريح من مدير السكن أو الآدمن."
                : "Allowed only by Housing Manager or Admin permission."}
            </p>
            <p>
              •{" "}
              {ar
                ? "ممنوع منعاً باتاً تسكين شخصين معاً؛ هذا التسكين مؤقت فقط طالما أن الموظف الأصلي في إجازة."
                : "No double rooming allowed; only valid while resident is away."}
            </p>
            <p>
              •{" "}
              {ar
                ? "يجب مغادرة أو نقل الموظف البديل فور عودة الموظف الأصلي من الإجازة."
                : "Temporary occupant must vacate before original resident returns."}
            </p>
          </div>

          <div className="space-y-1.5 pt-1">
            <label className="text-xs font-bold">
              {ar
                ? "تاريخ مغادرة الموظف المؤقت (إلزامي):"
                : "Expected Check-out Date (Required):"}
            </label>
            <DateInput
              value={
                expectedCheckOut || vacationPromptData?.vacationEndDate || ""
              }
              max={vacationPromptData?.vacationEndDate || undefined}
              onChange={(iso) => setExpectedCheckOut(iso)}
            />
            {vacationPromptData?.vacationEndDate && (
              <p className="text-[11px] text-muted-foreground">
                {ar
                  ? `تاريخ عودة المقيم الأصلي من الإجازة: ${vacationPromptData.vacationEndDate}`
                  : `Return date: ${vacationPromptData.vacationEndDate}`}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2 justify-end pt-3">
          <Button variant="outline" onClick={onCancel}>
            {ar ? "إلغاء والتراجع" : "Cancel"}
          </Button>
          <Button
            onClick={onConfirm}
            className="bg-amber-600 hover:bg-amber-700 text-white font-bold gap-1.5"
          >
            <CheckCircle2 className="w-4 h-4" />
            {ar
              ? "تأكيد التسكين المؤقت (بتصريح الإدارة)"
              : "Authorize Temporary Assignment"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
