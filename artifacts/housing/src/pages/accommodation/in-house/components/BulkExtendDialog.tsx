import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { CalendarPlus } from "lucide-react";

type Props = {
  ar: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  selectedCount: number;
  date: string;
  setDate: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  loading: boolean;
  applyPreset: (days: number) => void;
  onConfirm: () => void;
};

export function BulkExtendDialog({
  ar,
  open: bulkExtendOpen,
  setOpen: setBulkExtendOpen,
  selectedCount,
  date: bulkExtendDate,
  setDate: setBulkExtendDate,
  notes: bulkExtendNotes,
  setNotes: setBulkExtendNotes,
  loading: bulkExtendLoading,
  applyPreset: applyBulkExtendPreset,
  onConfirm: handleBulkExtend,
}: Props) {
  return (
    <Dialog
      open={bulkExtendOpen}
      onOpenChange={(open) => {
        if (!open && !bulkExtendLoading) setBulkExtendOpen(false);
      }}
    >
      <DialogContent
        className="max-w-md"
        srTitle={ar ? "تمديد إقامة جماعي" : "Bulk Extend Stay"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-primary">
            <CalendarPlus className="w-5 h-5 text-primary" />
            {ar ? "تمديد إقامة جماعي" : "Bulk Extend Stay"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <div className="p-3 bg-primary/10 border border-primary/20 rounded-lg text-sm">
            <p className="font-semibold text-primary">
              {ar
                ? `تمديد فترة الإقامة لعدد (${selectedCount}) من المقيمين المحددين`
                : `Extend stay period for (${selectedCount}) selected residents`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ar
                ? "سيتم تحديث تاريخ المغادرة المتوقع لجميع المقيمين المحددين دفعة واحدة."
                : "Expected check-out date will be updated for all selected residents at once."}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label className="font-semibold text-sm">
              {ar
                ? "تاريخ المغادرة الجديد المتوقع لجميع المحددين"
                : "New Expected Departure Date"}{" "}
              *
            </Label>
            <DateInput
              value={bulkExtendDate}
              onChange={(iso) => setBulkExtendDate(iso)}
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
                onClick={() => applyBulkExtendPreset(7)}
              >
                + {ar ? "أسبوع" : "1 week"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyBulkExtendPreset(14)}
              >
                + {ar ? "أسبوعين" : "2 weeks"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyBulkExtendPreset(30)}
              >
                + {ar ? "شهر" : "1 month"}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] font-normal"
                onClick={() => applyBulkExtendPreset(90)}
              >
                + 3 {ar ? "أشهر" : "months"}
              </Button>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label className="text-sm">
              {ar
                ? "سبب التمديد الجماعي / ملاحظات"
                : "Extension Reason / Notes (Optional)"}
            </Label>
            <Input
              placeholder={
                ar
                  ? "سبب تمديد الإقامة الجماعي..."
                  : "Reason for bulk extension..."
              }
              value={bulkExtendNotes}
              onChange={(e) => setBulkExtendNotes(e.target.value)}
            />
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => setBulkExtendOpen(false)}
              disabled={bulkExtendLoading}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleBulkExtend}
              disabled={bulkExtendLoading || !bulkExtendDate}
              className="gap-1.5 bg-primary font-semibold"
            >
              <CalendarPlus className="w-4 h-4" />
              {bulkExtendLoading
                ? ar
                  ? "جاري التمديد..."
                  : "Extending..."
                : ar
                  ? `تأكيد تمديد (${selectedCount}) مقيم`
                  : `Confirm Extend (${selectedCount})`}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
