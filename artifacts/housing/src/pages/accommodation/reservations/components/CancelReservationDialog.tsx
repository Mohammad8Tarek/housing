import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Ban } from "lucide-react";
import type { CancelDialogState, Setter } from "../types";

interface CancelReservationDialogProps {
  ar: boolean;
  cancelDialog: CancelDialogState;
  setCancelDialog: Setter<CancelDialogState>;
  cancelMutation: { mutate: (vars: { id: number; reason?: string }) => void; isPending: boolean };
}

export function CancelReservationDialog({ ar, cancelDialog, setCancelDialog, cancelMutation }: CancelReservationDialogProps) {
  return (

      <AlertDialog
        open={cancelDialog.open}
        onOpenChange={(o) => !o && setCancelDialog({ open: false, reservation: null, reason: "" })}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Ban className="w-5 h-5" />
              {ar ? "تأكيد إلغاء الحجز" : "Confirm Reservation Cancellation"}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2 text-sm text-muted-foreground">
              <span>
                {ar
                  ? `هل أنت متأكد من رغبتك في إلغاء حجز النزيل "${cancelDialog.reservation?.firstName || ""} ${cancelDialog.reservation?.lastName || ""}"؟`
                  : `Are you sure you want to cancel the reservation for "${cancelDialog.reservation?.firstName || ""} ${cancelDialog.reservation?.lastName || ""}"?`}
              </span>
              {cancelDialog.reservation?.roomId && (
                <span className="block mt-1 text-amber-600 dark:text-amber-400 font-medium">
                  {ar
                    ? `ملاحظة: سيتم تحرير الغرفة والسرير المحجوزين تلقائياً.`
                    : `Note: The reserved room and bed will be released automatically.`}
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="py-2 space-y-1.5">
            <Label className="text-xs text-muted-foreground">{ar ? "سبب الإلغاء (اختياري)" : "Cancellation Reason (Optional)"}</Label>
            <Input
              placeholder={ar ? "أدخل سبب إلغاء الحجز..." : "Enter reason for cancellation..."}
              value={cancelDialog.reason}
              onChange={(e) => setCancelDialog((d) => ({ ...d, reason: e.target.value }))}
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "تراجع" : "Go Back"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 gap-1.5"
              onClick={() => {
                if (cancelDialog.reservation?.id) {
                  cancelMutation.mutate({
                    id: cancelDialog.reservation.id,
                    reason: cancelDialog.reason || undefined,
                  });
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? (
                ar ? "جاري الإلغاء..." : "Cancelling..."
              ) : (
                <>
                  <Ban className="w-4 h-4" />
                  {ar ? "نعم، إلغاء الحجز" : "Yes, Cancel Reservation"}
                </>
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
  );
}
