// Extend the current stay period.
import { Button } from "@/components/ui/button";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CalendarPlus } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import type {
  ProfileDetailState,
  ProfileDetailView,
} from "./useProfileDetailState";

export function renderExtendStayDialog(
  s: ProfileDetailState,
  v: ProfileDetailView,
) {
  const {
    ar,
    currentAssignment,
    extendModalOpen,
    setExtendModalOpen,
    extendNewDate,
    setExtendNewDate,
    extendNotes,
    setExtendNotes,
    extendLoading,
    applyExtendPresetDetail,
    handleConfirmExtendFromDetail,
  } = s;
  return (
    <Dialog open={extendModalOpen} onOpenChange={setExtendModalOpen}>
      <DialogContent
        className="max-w-md"
        srTitle={ar ? "تمديد فترة الإقامة" : "Extend Stay Period"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <CalendarPlus className="w-5 h-5 text-primary" />
            {ar ? "تمديد فترة الإقامة" : "Extend Stay Period"}
          </DialogTitle>
        </DialogHeader>

        {currentAssignment && (
          <div className="grid grid-cols-2 gap-2 text-xs p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div>
              <span className="text-muted-foreground block mb-0.5">
                {ar ? "تاريخ التسكين:" : "Check-in Date:"}
              </span>
              <span className="font-semibold">
                {formatDate(currentAssignment.checkInDate)}
              </span>
            </div>
            <div>
              <span className="text-muted-foreground block mb-0.5">
                {ar ? "تاريخ المغادرة الحالي:" : "Current Departure:"}
              </span>
              <span className="font-semibold">
                {formatDate(
                  currentAssignment.expectedCheckOutDate,
                  ar ? "غير محدد" : "Not set",
                )}
              </span>
            </div>
          </div>
        )}

        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">
              {ar
                ? "تاريخ المغادرة الجديد المتوقع"
                : "New Expected Departure Date"}{" "}
              *
            </Label>
            <DateInput
              value={extendNewDate}
              onChange={(iso) => setExtendNewDate(iso)}
              min={new Date().toISOString().split("T")[0]}
              className="font-mono text-sm"
            />
            <div className="flex flex-wrap items-center gap-1.5 pt-1.5">
              <span className="text-xs text-muted-foreground mr-1 rtl:ml-1 rtl:mr-0">
                {ar ? "إضافة سريعة:" : "Quick add:"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyExtendPresetDetail(3)}
              >
                +3 {ar ? "أيام" : "days"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyExtendPresetDetail(7)}
              >
                + {ar ? "أسبوع" : "1 week"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyExtendPresetDetail(14)}
              >
                + {ar ? "أسبوعين" : "2 weeks"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyExtendPresetDetail(30)}
              >
                + {ar ? "شهر" : "1 month"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyExtendPresetDetail(90)}
              >
                + 3 {ar ? "أشهر" : "months"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">
              {ar ? "سبب التمديد / ملاحظات" : "Extension Reason / Notes"}
            </Label>
            <Textarea
              placeholder={
                ar
                  ? "أدخل سبب تمديد الإقامة أو أي تفاصيل إضافية..."
                  : "Enter reason for extending stay or additional notes..."
              }
              value={extendNotes}
              onChange={(e) => setExtendNotes(e.target.value)}
              rows={2}
            />
          </div>

          <div className="flex gap-2 justify-end pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => setExtendModalOpen(false)}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleConfirmExtendFromDetail}
              disabled={extendLoading || !extendNewDate}
              className="gap-1.5 bg-primary font-semibold"
            >
              <CalendarPlus className="w-4 h-4" />
              {extendLoading
                ? ar
                  ? "جاري التمديد..."
                  : "Extending..."
                : ar
                  ? "تأكيد تمديد الإقامة"
                  : "Confirm Extension"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
