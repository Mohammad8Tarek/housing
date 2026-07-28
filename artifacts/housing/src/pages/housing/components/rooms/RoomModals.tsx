import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const roomTypes = [
  "Standard",
  "Deluxe",
  "Suite",
  "Studio",
  "Shared",
  "Dormitory",
  "Executive",
];

type Props = {
  buildings: any[];
  floors: any[];
  roomModal: boolean;
  setRoomModal: (v: boolean) => void;
  editRoom: any;
  rForm: any;
  setRForm: (v: any) => void;
  saveRoomHandler: () => void;
  isSaving: boolean;

  deleteRoom: any;
  setDeleteRoom: (v: any) => void;
  confirmDeleteRoom: () => void;
  isDeleting: boolean;
};

export function RoomModals({
  buildings,
  floors,
  roomModal,
  setRoomModal,
  editRoom,
  rForm,
  setRForm,
  saveRoomHandler,
  isSaving,
  deleteRoom,
  setDeleteRoom,
  confirmDeleteRoom,
  isDeleting,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <>
      <Dialog open={roomModal} onOpenChange={setRoomModal}>
        <DialogContent
          className="max-w-md"
          srTitle={
            editRoom
              ? ar
                ? "تعديل الغرفة"
                : "Edit Room"
              : ar
                ? "إضافة غرفة"
                : "Add Room"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editRoom
                ? ar
                  ? "تعديل الغرفة"
                  : "Edit Room"
                : ar
                  ? "إضافة غرفة"
                  : "Add Room"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{ar ? "المبنى" : "Building"} *</Label>
                <Select
                  value={String(rForm.buildingId)}
                  onValueChange={(v) =>
                    setRForm((p: any) => ({
                      ...p,
                      buildingId: Number(v),
                      floorId: 0,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={ar ? "اختر المبنى" : "Building"}
                    />
                  </SelectTrigger>
                  <SelectContent>
                    {buildings.map((b) => (
                      <SelectItem key={b.id} value={String(b.id)}>
                        {b.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الطابق" : "Floor"} *</Label>
                <Select
                  value={String(rForm.floorId)}
                  onValueChange={(v) =>
                    setRForm((p: any) => ({ ...p, floorId: Number(v) }))
                  }
                  disabled={!rForm.buildingId}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={ar ? "اختر الطابق" : "Floor"} />
                  </SelectTrigger>
                  <SelectContent>
                    {floors
                      .filter((f) => f.buildingId === rForm.buildingId)
                      .map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {ar ? "الطابق" : "Floor"} {f.floorNumber}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="col-span-2 space-y-1.5">
                <Label>{ar ? "رقم الغرفة" : "Room Number"} *</Label>
                <Input
                  value={rForm.roomNumber}
                  onChange={(e) =>
                    setRForm((p: any) => ({ ...p, roomNumber: e.target.value }))
                  }
                  placeholder="e.g. 101, A-205"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "النوع" : "Type"}</Label>
                <Select
                  value={rForm.roomType}
                  onValueChange={(v) =>
                    setRForm((p: any) => ({ ...p, roomType: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {roomTypes.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "السعة" : "Capacity"}</Label>
                <Input
                  type="number"
                  min={1}
                  value={rForm.capacity}
                  onChange={(e) =>
                    setRForm((p: any) => ({
                      ...p,
                      capacity: Number(e.target.value),
                    }))
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "تخصيص الجنس" : "Gender Policy"}</Label>
                <Select
                  value={rForm.gender || "__none__"}
                  onValueChange={(v) =>
                    setRForm((p: any) => ({
                      ...p,
                      gender: v === "__none__" ? "" : v,
                    }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="__none__">
                      {ar ? "مختلط / بلا تخصيص" : "Mixed / None"}
                    </SelectItem>
                    <SelectItem value="M">{ar ? "ذكور" : "Male"}</SelectItem>
                    <SelectItem value="F">{ar ? "إناث" : "Female"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الحالة" : "Status"}</Label>
                <Select
                  value={rForm.status}
                  onValueChange={(v) =>
                    setRForm((p: any) => ({ ...p, status: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="available">
                      {ar ? "متاح" : "Available"}
                    </SelectItem>
                    <SelectItem value="occupied">
                      {ar ? "مشغول" : "Occupied"}
                    </SelectItem>
                    <SelectItem value="maintenance">
                      {ar ? "صيانة" : "Maintenance"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRoomModal(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={saveRoomHandler} disabled={isSaving}>
              {editRoom ? (ar ? "حفظ" : "Save") : ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteRoom}
        onOpenChange={(v) => !v && setDeleteRoom(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "حذف الغرفة" : "Delete Room"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هل أنت متأكد من حذف هذه الغرفة؟"
                : "Are you sure you want to delete this room?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmDeleteRoom}
              disabled={isDeleting}
            >
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
