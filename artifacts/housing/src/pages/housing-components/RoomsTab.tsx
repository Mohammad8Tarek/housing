// @ts-nocheck
import { useState } from "react";
import { Plus, Home, Users, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
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
import {
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
} from "@workspace/api-client-react";
import { roomStatusBadge, statusNorm } from "./utils";

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
  rooms: any[];
  rLoading: boolean;
};

export function RoomsTab({
  propertyId,
  buildings,
  floors,
  rooms,
  rLoading,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const createRoomMut = useCreateRoom();
  const updateRoomMut = useUpdateRoom();
  const deleteRoomMut = useDeleteRoom();

  const [roomModal, setRoomModal] = useState(false);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [deleteRoom, setDeleteRoom] = useState<any>(null);
  const [rForm, setRForm] = useState({
    buildingId: 0,
    floorId: 0,
    roomNumber: "",
    roomType: "Standard",
    capacity: 2,
    gender: "",
    status: "available",
  });

  const [roomBuildingFilter, setRoomBuildingFilter] = useState("all");
  const [roomFloorFilter, setRoomFloorFilter] = useState("all");
  const [roomStatusFilter, setRoomStatusFilter] = useState("all");

  const filteredRoomsTab = rooms.filter((r) => {
    const matchB =
      roomBuildingFilter === "all" ||
      r.buildingId === Number(roomBuildingFilter);
    const matchF =
      roomFloorFilter === "all" || r.floorId === Number(roomFloorFilter);
    const matchS =
      roomStatusFilter === "all" || statusNorm(r.status) === roomStatusFilter;
    return matchB && matchF && matchS;
  });

  const openCreateRoom = () => {
    setEditRoom(null);
    setRForm({
      buildingId: buildings[0]?.id || 0,
      floorId: 0, // Wait for user or pick first
      roomNumber: "",
      roomType: "Standard",
      capacity: 2,
      gender: "",
      status: "available",
    });
    setRoomModal(true);
  };

  const openEditRoom = (r: any) => {
    setEditRoom(r);
    setRForm({
      buildingId: r.buildingId,
      floorId: r.floorId,
      roomNumber: r.roomNumber,
      roomType: r.roomType || "Standard",
      capacity: r.capacity || 2,
      gender: r.gender || "",
      status: r.status || "available",
    });
    setRoomModal(true);
  };

  const saveRoomHandler = async () => {
    if (!rForm.buildingId || !rForm.floorId || !rForm.roomNumber.trim()) {
      toast.error(
        ar
          ? "المبنى والطابق ورقم الغرفة مطلوبون"
          : "Building, floor, and room number are required",
      );
      return;
    }

    try {
      const dataToSave = {
        ...rForm,
        propertyId,
        gender: rForm.gender === "" ? undefined : rForm.gender,
      };

      if (editRoom) {
        await updateRoomMut.mutateAsync({
          id: editRoom.id,
          data: dataToSave,
        });
        toast.success(ar ? "تم تحديث الغرفة بنجاح" : "Room updated");
      } else {
        await createRoomMut.mutateAsync(dataToSave);
        toast.success(ar ? "تم إضافة الغرفة بنجاح" : "Room added");
      }
      setRoomModal(false);
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "Failed to save"));
    }
  };

  const confirmDeleteRoom = async () => {
    if (!deleteRoom) return;
    try {
      await deleteRoomMut.mutateAsync(deleteRoom.id);
      toast.success(ar ? "تم حذف الغرفة بنجاح" : "Room deleted");
      setDeleteRoom(null);
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "Failed to delete"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={roomBuildingFilter}
            onValueChange={(v) => {
              setRoomBuildingFilter(v);
              setRoomFloorFilter("all");
            }}
          >
            <SelectTrigger className="w-[160px]">
              <SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {ar ? "كل المباني" : "All Buildings"}
              </SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roomFloorFilter} onValueChange={setRoomFloorFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={ar ? "كل الطوابق" : "All Floors"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {ar ? "كل الطوابق" : "All Floors"}
              </SelectItem>
              {(roomBuildingFilter === "all"
                ? floors
                : floors.filter(
                    (f) => f.buildingId === Number(roomBuildingFilter),
                  )
              ).map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>
                  {ar ? "الطابق" : "Floor"} {f.floorNumber}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roomStatusFilter} onValueChange={setRoomStatusFilter}>
            <SelectTrigger className="w-[140px]">
              <SelectValue placeholder={ar ? "كل الحالات" : "All Statuses"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {ar ? "كل الحالات" : "All Statuses"}
              </SelectItem>
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
          <p className="text-sm text-muted-foreground">
            {filteredRoomsTab.length} {ar ? "غرفة" : "rooms"}
          </p>
        </div>
        <PermissionGate module="housing" action="create">
          <Button onClick={openCreateRoom} size="sm">
            <Plus className="w-4 h-4 mr-1" /> {ar ? "إضافة غرفة" : "Add Room"}
          </Button>
        </PermissionGate>
      </div>
      {rLoading ? (
        <div className="space-y-3">
          {[...Array(6)].map((_, i) => (
            <Skeleton key={i} className="h-14 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الغرفة" : "Room"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "النوع" : "Type"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "المبنى" : "Building"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الطابق" : "Floor"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الإشغال" : "Occupancy"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الحالة" : "Status"}
                </th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredRoomsTab.map((r) => {
                const building = buildings.find((b) => b.id === r.buildingId);
                const floor = floors.find((f) => f.id === r.floorId);
                return (
                  <tr
                    key={r.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <span className="font-bold text-primary">
                        #{r.roomNumber}
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="px-2 py-0.5 bg-muted rounded text-xs font-medium">
                        {r.roomType}
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {building?.name || "—"}
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {floor
                        ? `${ar ? "الطابق" : "Floor"} ${floor.floorNumber}`
                        : "—"}
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {r.currentOccupancy}/{r.capacity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roomStatusBadge(r.status)}`}
                      >
                        {r.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <PermissionGate module="housing" action="edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditRoom(r)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="housing" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteRoom(r)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredRoomsTab.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <Home className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p>{ar ? "لا توجد غرف" : "No rooms found"}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Room Modal */}
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
                    setRForm((p) => ({
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
                    setRForm((p) => ({ ...p, floorId: Number(v) }))
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
                    setRForm((p) => ({ ...p, roomNumber: e.target.value }))
                  }
                  placeholder="e.g. 101, A-205"
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "النوع" : "Type"}</Label>
                <Select
                  value={rForm.roomType}
                  onValueChange={(v) =>
                    setRForm((p) => ({ ...p, roomType: v }))
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
                    setRForm((p) => ({
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
                    setRForm((p) => ({
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
                  onValueChange={(v) => setRForm((p) => ({ ...p, status: v }))}
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
            <Button
              onClick={saveRoomHandler}
              disabled={createRoomMut.isPending || updateRoomMut.isPending}
            >
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
              disabled={deleteRoomMut.isPending}
            >
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
