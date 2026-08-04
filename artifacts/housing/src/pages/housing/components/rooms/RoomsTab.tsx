import { useState } from "react";
import { Search, Building2, Layers, Plus } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  useCreateRoom,
  useUpdateRoom,
  useDeleteRoom,
} from "@workspace/api-client-react";
import { statusNorm } from "../../utils";

import { DataPagination } from "@/components/DataPagination";
import { RoomsTable } from "./RoomsTable";
import { RoomModals } from "./RoomModals";

type Props = {
  propertyId: number;
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
  const queryClient = useQueryClient();

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
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

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

  const sortedRooms = [...filteredRoomsTab].sort((a, b) => {
    return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, {
      numeric: true,
    });
  });

  const paginatedRooms = sortedRooms.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const paginationMeta = {
    page: currentPage,
    limit: pageSize,
    total: sortedRooms.length,
    totalPages: Math.ceil(sortedRooms.length / pageSize),
    hasNextPage: currentPage * pageSize < sortedRooms.length,
    hasPrevPage: currentPage > 1,
  };

  const openAddRoom = () => {
    setEditRoom(null);
    setRForm({
      buildingId: buildings[0]?.id || 0,
      floorId: floors[0]?.id || 0,
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
      buildingId: r.buildingId || 0,
      floorId: r.floorId || 0,
      roomNumber: r.roomNumber || "",
      roomType: r.type || "Standard",
      capacity: r.capacity || 2,
      gender: r.gender || "",
      status: statusNorm(r.status) || "available",
    });
    setRoomModal(true);
  };

  const saveRoomHandler = async () => {
    if (!rForm.buildingId || !rForm.floorId || !rForm.roomNumber.trim()) {
      toast.error(
        ar
          ? "المبنى والطابق ورقم الغرفة مطلوبين"
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
        await updateRoomMut.mutateAsync({ id: editRoom.id, data: dataToSave });
        toast.success(ar ? "تم تحديث الغرفة بنجاح" : "Room updated");
      } else {
        await createRoomMut.mutateAsync({ data: dataToSave });
        toast.success(ar ? "تم إضافة الغرفة بنجاح" : "Room added");
      }
      queryClient.invalidateQueries();
      setRoomModal(false);
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل الحفظ" : "Failed to save"));
    }
  };

  const confirmDeleteRoom = async () => {
    if (!deleteRoom) return;
    if (deleteRoom.id === undefined) {
      toast.error("Error: Room ID is undefined! Cannot delete.");
      return;
    }
    try {
      await deleteRoomMut.mutateAsync({ id: deleteRoom.id });
      toast.success(ar ? "تم حذف الغرفة بنجاح" : "Room deleted");
      setDeleteRoom(null);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل الحذف" : "Failed to delete"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col md:flex-row gap-4 justify-between items-start md:items-center">
        <div className="flex flex-wrap gap-2 items-center">
          <Select
            value={roomBuildingFilter}
            onValueChange={(val) => {
              setRoomBuildingFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder={ar ? "المبنى..." : "Building..."} />
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

          <Select
            value={roomFloorFilter}
            onValueChange={(val) => {
              setRoomFloorFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder={ar ? "الطابق..." : "Floor..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {ar ? "كل الطوابق" : "All Floors"}
              </SelectItem>
              {floors
                .filter(
                  (f) =>
                    roomBuildingFilter === "all" ||
                    f.buildingId === Number(roomBuildingFilter),
                )
                .map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {f.floorNumber}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>

          <Select
            value={roomStatusFilter}
            onValueChange={(val) => {
              setRoomStatusFilter(val);
              setCurrentPage(1);
            }}
          >
            <SelectTrigger className="w-[140px] bg-background">
              <SelectValue placeholder={ar ? "الحالة..." : "Status..."} />
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
            {sortedRooms.length} {ar ? "غرفة" : "rooms"}
          </p>
        </div>
        <PermissionGate module="housing" action="create">
          <Button onClick={openAddRoom} className="gap-2">
            <Plus className="w-4 h-4" />
            {ar ? "إضافة غرفة" : "Add Room"}
          </Button>
        </PermissionGate>
      </div>

      <RoomsTable
        buildings={buildings}
        floors={floors}
        rLoading={rLoading}
        filteredRoomsTab={paginatedRooms}
        onEditRoom={openEditRoom}
        onDeleteRoom={setDeleteRoom}
      />

      {sortedRooms.length > 0 && (
        <DataPagination
          total={sortedRooms.length}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}

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
