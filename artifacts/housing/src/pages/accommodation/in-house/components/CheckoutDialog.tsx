import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { DateInput } from "@/components/ui/date-input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { LogOut } from "lucide-react";
import { EmpAvatar } from "./EmpAvatar";
import { CHECKOUT_REASONS } from "../utils/constants";

export type CheckoutDialogState = {
  open: boolean;
  id: number | null;
  emp?: any;
  propertyId?: number;
};

type Props = {
  ar: boolean;
  dialog: CheckoutDialogState;
  setDialog: (v: CheckoutDialogState) => void;
  checkoutDate: string;
  setCheckoutDate: (v: string) => void;
  checkoutReason: string;
  setCheckoutReason: (v: string) => void;
  checkoutNotes: string;
  setCheckoutNotes: (v: string) => void;
  isPending: boolean;
  onConfirm: () => void;
};

export function CheckoutDialog({
  ar,
  dialog: checkoutDialog,
  setDialog: setCheckoutDialog,
  checkoutDate,
  setCheckoutDate,
  checkoutReason,
  setCheckoutReason,
  checkoutNotes,
  setCheckoutNotes,
  isPending,
  onConfirm: handleCheckout,
}: Props) {
  return (
    <Dialog
      open={checkoutDialog.open}
      onOpenChange={(open) =>
        setCheckoutDialog({ open, id: open ? checkoutDialog.id : null })
      }
    >
      <DialogContent
        className="max-w-sm"
        srTitle={ar ? "تسجيل خروج" : "Checkout Profile"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <LogOut className="w-5 h-5" />
            {ar ? "تسجيل خروج" : "Checkout Profile"}
          </DialogTitle>
        </DialogHeader>
        {checkoutDialog.emp && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-muted/30 -mt-2">
            <EmpAvatar emp={checkoutDialog.emp} />
            <div>
              <p className="font-semibold text-sm">
                {checkoutDialog.emp.firstName} {checkoutDialog.emp.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {checkoutDialog.emp.profileId}
              </p>
            </div>
          </div>
        )}
        <div className="space-y-4 pt-1">
          <div className="space-y-1.5">
            <Label>{ar ? "تاريخ الخروج" : "Check-out Date"}</Label>
            <DateInput
              value={checkoutDate}
              onChange={(iso) => setCheckoutDate(iso)}
            />
          </div>
          <div className="space-y-1.5">
            <Label className="flex items-center gap-1 font-semibold text-xs">
              {ar ? "سبب المغادرة" : "Check-out Reason"}
              <span className="text-destructive font-bold">*</span>
            </Label>
            <Select value={checkoutReason} onValueChange={setCheckoutReason}>
              <SelectTrigger className="w-full">
                <SelectValue placeholder={ar ? "اختر سبب المغادرة (إلزامي)..." : "Select reason (Mandatory)..."} />
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
            <Label>{ar ? "ملاحظات" : "Notes"}</Label>
            <Textarea
              placeholder={ar ? "أي ملاحظات إضافية..." : "Any additional notes..."}
              value={checkoutNotes}
              onChange={(e) => setCheckoutNotes(e.target.value)}
              rows={2}
            />
          </div>
          <div className="flex gap-2 justify-end">
            <Button
              variant="outline"
              onClick={() => setCheckoutDialog({ open: false, id: null })}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleCheckout}
              disabled={isPending || !checkoutReason}
            >
              {isPending
                ? ar
                  ? "جاري..."
                  : "Processing..."
                : ar
                  ? "تأكيد الخروج"
                  : "Confirm Checkout"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
