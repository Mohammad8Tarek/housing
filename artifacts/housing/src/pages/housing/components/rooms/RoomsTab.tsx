import { useState } from "react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateRoom, useUpdateRoom, useDeleteRoom } from "@workspace/api-client-react";
import { statusNorm } from "../../utils";

import { RoomsTable } from "./RoomsTable";
import { RoomModals } from "./RoomModals";

type Props = {
  propertyId: number;
  buildings: any[];
  floors: any[];
  rooms: any[];
  rLoading: boolean;
};

export function RoomsTab({ propertyId, buildings, floors, rooms, rLoading }: Props) {
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
    const matchB = roomBuildingFilter === "all" || r.buildingId === Number(roomBuildingFilter);
    const matchF = roomFloorFilter === "all" || r.floorId === Number(roomFloorFilter);
    const matchS = roomStatusFilter === "all" || statusNorm(r.status) === roomStatusFilter;
    return matchB && matchF && matchS;
  });

  const openCreateRoom = () => {
    setEditRoom(null);
    setRForm({
      buildingId: buildings[0]?.id || 0,
      floorId: 0,
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
      toast.error(ar ? "المبنى والطابق ورقم الغرفة مطلوبون" : "Building, floor, and room number are required");
      return;
    }

    try {
      const dataToSave = {
        ...rForm,
        propertyId,
        gender: rForm.gender === "" ? undefined : rForm.gender,
      };

      if (editRoom) {
        await updateRoomMut.mutateAsync({ id: editRoom.id, data: dataToSave });
        toast.success(ar ? "تم تحديث الغرفة بنجاح" : "Room updated");
      } else {
        await createRoomMut.mutateAsync({ data: dataToSave });
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
          <Select value={roomBuildingFilter} onValueChange={(v) => { setRoomBuildingFilter(v); setRoomFloorFilter("all"); }}>
            <SelectTrigger className="w-[160px]"><SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
              {buildings.map((b) => <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>)}
            </SelectContent>
          </Select>
          <Select value={roomFloorFilter} onValueChange={setRoomFloorFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={ar ? "كل الطوابق" : "All Floors"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الطوابق" : "All Floors"}</SelectItem>
              {(roomBuildingFilter === "all" ? floors : floors.filter((f) => f.buildingId === Number(roomBuildingFilter))).map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>{ar ? "الطابق" : "Floor"} {f.floorNumber}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select value={roomStatusFilter} onValueChange={setRoomStatusFilter}>
            <SelectTrigger className="w-[140px]"><SelectValue placeholder={ar ? "كل الحالات" : "All Statuses"} /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
              <SelectItem value="available">{ar ? "متاح" : "Available"}</SelectItem>
              <SelectItem value="occupied">{ar ? "مشغول" : "Occupied"}</SelectItem>
              <SelectItem value="maintenance">{ar ? "صيانة" : "Maintenance"}</SelectItem>
            </SelectContent>
          </Select>
          <p className="text-sm text-muted-foreground">{filteredRoomsTab.length} {ar ? "غرفة" : "rooms"}</p>
        </div>
        <PermissionGate module="housing" action="create">
          <Button onClick={openCreateRoom} size="sm">
            <Plus className="w-4 h-4 mr-1" /> {ar ? "إضافة غرفة" : "Add Room"}
          </Button>
        </PermissionGate>
      </div>
      
      <RoomsTable
        buildings={buildings}
        floors={floors}
        rLoading={rLoading}
        filteredRoomsTab={filteredRoomsTab}
        onEditRoom={openEditRoom}
        onDeleteRoom={setDeleteRoom}
      />

      <RoomModals
        buildings={buildings}
        floors={floors}
        roomModal={roomModal}
        setRoomModal={setRoomModal}
        editRoom={editRoom}
        rForm={rForm}
        setRForm={setRForm}
        saveRoomHandler={saveRoomHandler}
        isSaving={createRoomMut.isPending || updateRoomMut.isPending}
        deleteRoom={deleteRoom}
        setDeleteRoom={setDeleteRoom}
        confirmDeleteRoom={confirmDeleteRoom}
        isDeleting={deleteRoomMut.isPending}
      />
    </div>
  );
}
