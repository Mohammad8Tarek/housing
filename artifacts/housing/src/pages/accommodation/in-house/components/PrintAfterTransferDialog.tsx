import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Printer } from "lucide-react";

export type PrintAfterTransferState = {
  assignment: any;
  emp: any;
  room: any;
  building: string | null;
  floorNum: string | null;
} | null;

type Props = {
  ar: boolean;
  state: PrintAfterTransferState;
  setState: (v: PrintAfterTransferState) => void;
  printHousingLetter: (assignment: any, emp: any) => void;
};

export function PrintAfterTransferDialog({
  ar,
  state: printAfterTransfer,
  setState: setPrintAfterTransfer,
  printHousingLetter,
}: Props) {
  if (!printAfterTransfer) return null;
  return (
    <Dialog
      open={!!printAfterTransfer}
      onOpenChange={(open) => {
        if (!open) setPrintAfterTransfer(null);
      }}
    >
      <DialogContent
        className="max-w-sm"
        srTitle={ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <Printer className="w-4 h-4 text-primary" />
            {ar ? "خطاب السكن" : "Housing Letter"}
          </DialogTitle>
        </DialogHeader>
        <p className="text-sm text-muted-foreground">
          {ar
            ? `تم نقل ${printAfterTransfer.emp?.firstName || ""} ${printAfterTransfer.emp?.lastName || ""} بنجاح. هل تريد طباعة خطاب السكن للغرفة الجديدة؟`
            : `${printAfterTransfer.emp?.firstName || ""} ${printAfterTransfer.emp?.lastName || ""} transferred. Print housing letter for the new room?`}
        </p>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setPrintAfterTransfer(null)}
          >
            {ar ? "تخطي" : "Skip"}
          </Button>
          <Button
            size="sm"
            className="gap-1"
            onClick={() => {
              printHousingLetter(
                printAfterTransfer.assignment,
                printAfterTransfer.emp,
              );
              setPrintAfterTransfer(null);
            }}
          >
            <Printer className="w-3.5 h-3.5" />
            {ar ? "طباعة" : "Print"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
