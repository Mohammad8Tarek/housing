import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Palmtree, Info } from "lucide-react";
import { EmpAvatar } from "./EmpAvatar";

export type VacationDialogState = {
  open: boolean;
  emp: any;
  room?: any;
};

type Props = {
  ar: boolean;
  dialog: VacationDialogState;
  setDialog: (v: VacationDialogState) => void;
  startDate: string;
  setStartDate: (v: string) => void;
  endDate: string;
  setEndDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  submitting: boolean;
  durationDays: () => number | null;
  onConfirm: () => void;
};

export function VacationDialog({
  ar,
  dialog: vacationDialog,
  setDialog: setVacationDialog,
  startDate: vacationStartDate,
  setStartDate: setVacationStartDate,
  endDate: vacationEndDate,
  setEndDate: setVacationEndDate,
  notes: vacationNotes,
  setNotes: setVacationNotes,
  submitting: vacationSubmitting,
  durationDays: vacationDurationDays,
  onConfirm: handleConfirmVacation,
}: Props) {
  return (
    <Dialog
      open={vacationDialog.open}
      onOpenChange={(open) => {
        if (!open) setVacationDialog({ open: false, emp: null });
      }}
    >
      <DialogContent
        className="max-w-md"
        srTitle={ar ? "تسجيل إجازة موظف" : "Record Employee Vacation"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-amber-600">
            <Palmtree className="w-5 h-5" />
            {ar ? "تسجيل خروج في إجازة" : "Set Employee on Vacation"}
          </DialogTitle>
        </DialogHeader>

        {vacationDialog.emp && (
          <div className="flex items-center gap-3 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <EmpAvatar emp={vacationDialog.emp} />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm text-foreground truncate">
                {vacationDialog.emp.firstName} {vacationDialog.emp.lastName}
              </p>
              <div className="flex items-center gap-2 text-xs text-muted-foreground mt-0.5">
                <span>
                  {vacationDialog.emp.employeeId ||
                    vacationDialog.emp.profileId}
                </span>
                {vacationDialog.room && (
                  <Badge variant="outline" className="text-[10px] py-0">
                    {ar ? "غرفة" : "Room"} {vacationDialog.room.roomNumber}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1">
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "تاريخ بدء الإجازة (من)" : "Start Date"}
              </Label>
              <DateInput
                value={vacationStartDate}
                onChange={(iso) => setVacationStartDate(iso)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "تاريخ العودة المتوقع (إلى)" : "Return Date"}
              </Label>
              <DateInput
                value={vacationEndDate}
                onChange={(iso) => setVacationEndDate(iso)}
              />
            </div>
          </div>

          {vacationDurationDays() !== null && (
            <div className="p-2.5 rounded-lg bg-teal-50 dark:bg-teal-950/40 border border-teal-200 dark:border-teal-800 text-teal-800 dark:text-teal-200 flex items-center justify-between text-xs font-bold">
              <span>{ar ? "مدة الإجازة المحسوبة:" : "Vacation Duration:"}</span>
              <span className="text-sm px-2 py-0.5 rounded bg-teal-200/60 dark:bg-teal-900/60">
                {vacationDurationDays()} {ar ? "يوم" : "Days"}
              </span>
            </div>
          )}

          <div className="space-y-1.5">
            <Label className="text-xs font-semibold">
              {ar ? "ملاحظات الإجازة (اختياري)" : "Vacation Notes"}
            </Label>
            <Textarea
              placeholder={
                ar
                  ? "اكتب أي تفاصيل إضافية مثل رقم الطوارئ أو سبب الإجازة..."
                  : "Add any notes or contact info..."
              }
              value={vacationNotes}
              onChange={(e) => setVacationNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="p-2.5 rounded-lg bg-muted/40 border text-[11px] text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-blue-500" />{" "}
              {ar ? "تأثير الإجراء:" : "Action Effect:"}
            </p>
            <p>
              •{" "}
              {ar
                ? "سيتحول الموظف إلى حالة 'في إجازة' مع حفظ التواريخ."
                : "Employee status will change to Vacation with dates saved."}
            </p>
            <p>
              •{" "}
              {ar
                ? "ستتحول غرفته تلقائياً إلى 'مشغولة - إجازة' ويبقى سريره محجوزاً له."
                : "Room will automatically switch to Occupied Vacation holding his bed."}
            </p>
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              variant="outline"
              onClick={() => setVacationDialog({ open: false, emp: null })}
              disabled={vacationSubmitting}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirmVacation}
              disabled={
                vacationSubmitting || !vacationStartDate || !vacationEndDate
              }
              className="bg-amber-600 hover:bg-amber-700 text-white gap-2 font-semibold"
            >
              <Palmtree className="w-4 h-4" />
              {vacationSubmitting
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "تأكيد الإجازة"
                  : "Confirm Vacation"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
