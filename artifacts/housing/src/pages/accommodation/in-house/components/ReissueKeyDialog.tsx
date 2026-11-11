import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Key } from "lucide-react";
import { toast } from "sonner";
import KeyManagementPanel from "@/components/KeyManagementPanel";

export type ReissueDialogState = {
  open: boolean;
  assignment: any;
  emp: any;
  room: any;
};

type Props = {
  ar: boolean;
  dialog: ReissueDialogState;
  setDialog: (v: ReissueDialogState) => void;
  notes: string;
  setNotes: (v: string) => void;
  issuing: boolean;
  setIssuing: (v: boolean) => void;
  numericPropertyId: number | undefined;
  invalidate: () => void;
};

export function ReissueKeyDialog({
  ar,
  dialog: reissueDialog,
  setDialog: setReissueDialog,
  notes: reissueNotes,
  setNotes: setReissueNotes,
  issuing: reissueIssuing,
  setIssuing: setReissueIssuing,
  numericPropertyId,
  invalidate,
}: Props) {
  return (
    <Dialog
      open={reissueDialog.open}
      onOpenChange={(open) => {
        if (!open && reissueIssuing) return;
        setReissueDialog({
          open,
          assignment: open ? reissueDialog.assignment : null,
          emp: open ? reissueDialog.emp : null,
          room: open ? reissueDialog.room : null,
        });
      }}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            {ar ? "إعادة إصدار مفتاح" : "Re-issue Key Card"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {reissueDialog.emp && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-semibold">
                {reissueDialog.emp.firstName} {reissueDialog.emp.lastName}
              </p>
              <p className="text-xs text-muted-foreground">
                {ar ? "الغرفة" : "Room"}: {reissueDialog.room?.roomNumber} —{" "}
                {ar ? "السرير" : "Bed"}:{" "}
                {reissueDialog.assignment?.bedNumber || "—"}
              </p>
            </div>
          )}
          <div className="space-y-1.5">
            <Label className="text-xs">
              {ar ? "سبب إعادة الإصدار" : "Reason"}
            </Label>
            <Input
              className="h-8 text-xs"
              placeholder={ar ? "مثال: المفتاح ضائع" : "e.g., Key lost"}
              value={reissueNotes}
              onChange={(e) => setReissueNotes(e.target.value)}
            />
          </div>
          {reissueDialog.assignment &&
            reissueDialog.room &&
            numericPropertyId && (
              <KeyManagementPanel
                propertyId={numericPropertyId}
                roomId={reissueDialog.assignment.roomId}
                assignmentId={reissueDialog.assignment.id}
                profileId={reissueDialog.assignment.profileId}
                defaultCardType="guest"
                notes={
                  reissueNotes ||
                  (ar ? "إعادة إصدار - مفتاح ضائع" : "Re-issue - lost key")
                }
                onIssuingChange={setReissueIssuing}
                onIssueComplete={() => {
                  invalidate();
                  toast.success(
                    ar ? "تم إصدار المفاتيح بنجاح" : "Keys issued successfully",
                  );
                }}
              />
            )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              disabled={reissueIssuing}
              onClick={() =>
                setReissueDialog({
                  open: false,
                  assignment: null,
                  emp: null,
                  room: null,
                })
              }
            >
              {ar ? "إغلاق" : "Close"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
