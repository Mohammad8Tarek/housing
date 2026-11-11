// Edit a hosting (dates, notes).
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { GuestHostingState } from "./useGuestHostingState";

export function renderEditHostingDialog(s: GuestHostingState) {
  const {
    ar,
    editDialog,
    setEditDialog,
    editForm,
    setEditForm,
    filteredEditRooms,
    handleUpdate,
  } = s;
  return (
    <Dialog
      open={editDialog.open}
      onOpenChange={(open) => {
        if (!open) setEditDialog({ open: false, hosting: null });
      }}
    >
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{ar ? "تعديل الاستضافة" : "Edit Hosting"}</DialogTitle>
        </DialogHeader>
        <div className="grid gap-4 py-2">
          <div>
            <Label className="text-xs mb-1 block">
              {ar ? "تاريخ البداية" : "Expected From"}
            </Label>
            <DateInput
              value={editForm.expectedFrom}
              onChange={(iso) =>
                setEditForm((prev) => ({
                  ...prev,
                  expectedFrom: iso,
                }))
              }
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">
              {ar ? "تاريخ النهاية" : "Expected To"}
            </Label>
            <DateInput
              value={editForm.expectedTo}
              onChange={(iso) =>
                setEditForm((prev) => ({
                  ...prev,
                  expectedTo: iso,
                }))
              }
            />
          </div>
          <div>
            <Label className="text-xs mb-1 block">
              {ar ? "الغرفة" : "Room"}
            </Label>
            <Select
              value={editForm.roomId}
              onValueChange={(val) =>
                setEditForm((prev) => ({ ...prev, roomId: val }))
              }
            >
              <SelectTrigger>
                <SelectValue placeholder={ar ? "اختر الغرفة" : "Select room"} />
              </SelectTrigger>
              <SelectContent>
                {filteredEditRooms.map((r: any) => (
                  <SelectItem key={r.id} value={String(r.id)}>
                    {r.roomNumber}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs mb-1 block">
              {ar ? "ملاحظات" : "Notes"}
            </Label>
            <Textarea
              value={editForm.notes}
              onChange={(e) =>
                setEditForm((prev) => ({
                  ...prev,
                  notes: e.target.value,
                }))
              }
              rows={3}
            />
          </div>
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <Button
            variant="outline"
            onClick={() => setEditDialog({ open: false, hosting: null })}
          >
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button onClick={handleUpdate}>{ar ? "حفظ" : "Save"}</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
