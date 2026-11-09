import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut } from "lucide-react";
import { CHECKOUT_REASONS } from "../utils/constants";

type Props = {
  ar: boolean;
  open: boolean;
  setOpen: (v: boolean) => void;
  selectedCount: number;
  reason: string;
  setReason: (v: string) => void;
  notes: string;
  setNotes: (v: string) => void;
  loading: boolean;
  onConfirm: () => void;
};

export function BulkCheckoutDialog({
  ar,
  open: bulkCheckoutOpen,
  setOpen: setBulkCheckoutOpen,
  selectedCount,
  reason: bulkCheckoutReason,
  setReason: setBulkCheckoutReason,
  notes: bulkCheckoutNotes,
  setNotes: setBulkCheckoutNotes,
  loading: bulkCheckoutLoading,
  onConfirm: handleBulkCheckout,
}: Props) {
  return (
    <Dialog
      open={bulkCheckoutOpen}
      onOpenChange={(open) => {
        if (!open && !bulkCheckoutLoading) setBulkCheckoutOpen(false);
      }}
    >
      <DialogContent
        className="max-w-md"
        srTitle={ar ? "تسجيل خروج جماعي" : "Bulk Check-out"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-destructive">
            <LogOut className="w-5 h-5" />
            {ar ? "تسجيل خروج جماعي" : "Bulk Check-out"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4 pt-2">
          <div className="p-3 bg-destructive/10 border border-destructive/20 rounded-lg text-sm">
            <p className="font-semibold text-destructive">
              {ar
                ? `هل أنت متأكد من رغبتك في تسجيل خروج ${selectedCount} مقيم محدد؟`
                : `Are you sure you want to check out ${selectedCount} selected resident(s)?`}
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              {ar
                ? "سيتم تحرير الأسرة والغرف وتحديث حالة المقيمين إلى مغادر."
                : "Beds will be freed and residents status updated to checked out."}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 font-semibold text-xs">
              {ar ? "سبب المغادرة الجماعية" : "Bulk Check-out Reason"}
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Select value={bulkCheckoutReason} onValueChange={setBulkCheckoutReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={ar ? "اختر سبب المغادرة الجماعية (إلزامي)..." : "Select bulk reason (Mandatory)..."} />
              </SelectTrigger>
              <SelectContent>
                {CHECKOUT_REASONS.map((r) => (
                  <SelectItem key={r.value} value={r.value}>
                    {ar ? r.labelAr : r.labelEn}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>{ar ? "ملاحظات خروج جماعي (اختياري)" : "Notes (Optional)"}</Label>
            <Input
              placeholder={ar ? "سبب أو تفاصيل المغادرة الجماعية..." : "Reason or details..."}
              value={bulkCheckoutNotes}
              onChange={(e) => setBulkCheckoutNotes(e.target.value)}
            />
          </div>
          <div className="flex justify-end gap-2 pt-2">
            <Button
              variant="outline"
              onClick={() => {
                setBulkCheckoutOpen(false);
                setBulkCheckoutReason("");
              }}
              disabled={bulkCheckoutLoading}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              variant="destructive"
              onClick={handleBulkCheckout}
              disabled={bulkCheckoutLoading || !bulkCheckoutReason}
              className="gap-1.5"
            >
              {bulkCheckoutLoading ? (
                ar ? "جاري الخروج..." : "Checking out..."
              ) : (
                <>
                  <LogOut className="w-4 h-4" />
                  {ar ? `تأكيد خروج (${selectedCount})` : `Confirm Checkout (${selectedCount})`}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
