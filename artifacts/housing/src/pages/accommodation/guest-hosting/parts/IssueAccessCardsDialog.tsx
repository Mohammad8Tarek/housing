// Issue guest door access cards.
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Key } from "lucide-react";
import KeyManagementPanel from "@/components/KeyManagementPanel";
import type { GuestHostingState } from "./useGuestHostingState";

export function renderIssueAccessCardsDialog(s: GuestHostingState) {
  const { queryClient, ar, keyPromptOpen, setKeyPromptOpen, selectedHostingKey, keyPromptRoomId, setKeyPromptRoomId, keyIssuing, setKeyIssuing, numericPropertyId, modalRooms } = s;
  return (
<Dialog
        open={keyPromptOpen}
        onOpenChange={(open) => {
          if (!open && keyIssuing) return;
          setKeyPromptOpen(open);
        }}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>
              {ar ? "إصدار بطاقات الوصول للضيوف" : "Issue Guest Access Cards"}
            </DialogTitle>
          </DialogHeader>
          <div className="py-2">
            <p className="text-sm text-muted-foreground mb-4">
              {ar
                ? "يمكنك إصدار مفاتيح الغرفة أو الكروت للمرافقين لهذه الاستضافة."
                : "You can issue room keys or cards for companions for this hosting."}
            </p>

            {!selectedHostingKey?.roomId && (
              <div className="mb-4">
                <Label className="text-xs mb-1 block">
                  {ar
                    ? "اختر الغرفة المخصصة (غرفة الموظف)"
                    : "Select assigned room (Profile's Room)"}
                </Label>
                <Select
                  value={keyPromptRoomId}
                  onValueChange={setKeyPromptRoomId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue
                      placeholder={ar ? "اختر الغرفة..." : "Select room..."}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {modalRooms.map((r: any) => (
                      <SelectItem key={r.id} value={String(r.id)}>
                        {r.roomNumber} - {r.buildingName}{" "}
                        {r.floorNumber ? `(Floor ${r.floorNumber})` : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {(selectedHostingKey?.roomId || keyPromptRoomId) &&
            numericPropertyId ? (
              <KeyManagementPanel
                propertyId={numericPropertyId}
                roomId={selectedHostingKey?.roomId || parseInt(keyPromptRoomId)}
                checkInDate={(() => {
                  const d =
                    selectedHostingKey?.actualCheckIn ||
                    selectedHostingKey?.expectedFrom;
                  if (!d) return undefined;
                  return new Date(d) < new Date()
                    ? new Date().toISOString()
                    : d;
                })()}
                checkOutDate={selectedHostingKey?.expectedTo}
                onIssuingChange={setKeyIssuing}
                onIssueComplete={() => {
                  queryClient.invalidateQueries({ queryKey: ["/api/keys"] });
                  toast.success(
                    ar ? "تم إصدار المفاتيح بنجاح" : "Keys issued successfully",
                  );
                }}
              />
            ) : (
              <div className="py-8 text-center text-muted-foreground bg-muted/20 rounded-lg border border-dashed">
                <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
                <p>
                  {ar
                    ? "الرجاء تحديد غرفة لإصدار المفتاح."
                    : "Please select a room to issue a key."}
                </p>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
  );
}
