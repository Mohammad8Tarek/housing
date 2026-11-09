import type { Room } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Key, Printer } from "lucide-react";
import KeyManagementPanel from "@/components/KeyManagementPanel";
import type { ProfileResult } from "../../shared/profile-search";

/** Key Issuance Prompt Dialog (shown right after a successful assignment) */
export function KeyIssuancePromptDialog({
  ar,
  open,
  onOpenChange,
  keyIssuing,
  setKeyIssuing,
  lastAssignment,
  selectedRoom,
  selectedProfile,
  activePropertyId,
  checkInDate,
  expectedCheckOut,
  onIssueComplete,
  onPrintHousingLetter,
  onClose,
}: {
  ar: boolean;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  keyIssuing: boolean;
  setKeyIssuing: (v: boolean) => void;
  lastAssignment: any;
  selectedRoom: Room | undefined;
  selectedProfile: ProfileResult | null;
  activePropertyId: number | "all" | undefined;
  checkInDate: string;
  expectedCheckOut: string;
  onIssueComplete: () => void;
  onPrintHousingLetter: () => void;
  onClose: () => void;
}) {
  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
    >
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Key className="w-5 h-5 text-amber-600" />
            {ar ? "إصدار مفاتيح الغرفة" : "Issue Room Keys"}
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-4">
          {lastAssignment && (
            <div className="rounded-lg border bg-muted/30 p-3">
              <p className="text-sm font-semibold">
                {ar ? "تم التعيين بنجاح" : "Assignment Successful"}
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                {ar ? "الغرفة" : "Room"}: {selectedRoom?.roomNumber} —{" "}
                {ar ? "السعة" : "Capacity"}: {selectedRoom?.capacity}{" "}
                {ar ? "أسرّة" : "beds"}
              </p>
              <p className="text-xs text-muted-foreground">
                {ar ? "عدد المفاتيح المطلوبة" : "Keys needed"}:{" "}
                <span className="font-bold text-amber-600">
                  {selectedRoom?.capacity}
                </span>
              </p>
            </div>
          )}
          {lastAssignment && selectedRoom && activePropertyId && (
            <KeyManagementPanel
              propertyId={activePropertyId as number}
              roomId={selectedRoom.id}
              assignmentId={lastAssignment.id}
              profileId={
                selectedProfile
                  ? parseInt(selectedProfile.id as any)
                  : undefined
              }
              checkInDate={checkInDate}
              checkOutDate={expectedCheckOut}
              onIssuingChange={setKeyIssuing}
              onIssueComplete={onIssueComplete}
            />
          )}
          <div className="flex justify-end gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={onPrintHousingLetter}
              disabled={keyIssuing}
              className="gap-1"
            >
              <Printer className="w-3.5 h-3.5" />
              {ar ? "طباعة خطاب السكن" : "Print Housing Letter"}
            </Button>
            <Button
              variant="outline"
              disabled={keyIssuing}
              onClick={onClose}
            >
              {ar ? "تخطي" : "Skip"}
            </Button>
            <Button
              disabled={keyIssuing}
              onClick={onClose}
            >
              {ar ? "متابعة" : "Continue"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
