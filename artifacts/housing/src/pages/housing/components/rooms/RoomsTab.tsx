import { RoomImportWizard } from "../import/RoomImportWizard";
import { downloadRoomImportTemplate } from "@/lib/room-importer-engine";
import { Search, Plus, FileDown } from "lucide-react";
import * as XLSX from "xlsx";
import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
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
  useListRooms,
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

const EMPTY_FORM = {
  buildingId: 0,
  floorId: 0,
  roomNumber: "",
  roomType: "Standard",
  capacity: 2,
  gender: "",
  status: "available",
  view: "",
  bedType: "",
  classification: "",
  separatorDoor: false as boolean,
  size: "",
  features: "",
  featuresList: [] as string[],
  notes: "",
};

export function RoomsTab({
  propertyId,
  buildings,
  floors,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { properties } = useProperty();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);

  const createRoomMut = useCreateRoom();
  const updateRoomMut = useUpdateRoom();
  const deleteRoomMut = useDeleteRoom();

  const [roomModal, setRoomModal] = useState(false);
  const [importWizardOpen, setImportWizardOpen] = useState(false);
  const [editRoom, setEditRoom] = useState<any>(null);
  const [deleteRoom, setDeleteRoom] = useState<any>(null);
  const [rForm, setRForm] = useState<typeof EMPTY_FORM>(EMPTY_FORM);

  const [roomBuildingFilter, setRoomBuildingFilter] = useState("all");
  const [roomFloorFilter, setRoomFloorFilter] = useState("all");
  const [roomStatusFilter, setRoomStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<number>>(new Set());

  const invalidateAllHousingQueries = () => {
    queryClient.invalidateQueries({ queryKey: ["buildings"] });
    queryClient.invalidateQueries({ queryKey: ["floors"] });
    queryClient.invalidateQueries({ queryKey: ["rooms"] });
    queryClient.invalidateQueries({ queryKey: ["/api/buildings"] });
    queryClient.invalidateQueries({ queryKey: ["/api/floors"] });
    queryClient.invalidateQueries({ queryKey: ["/api/rooms"] });
    queryClient.invalidateQueries();
  };

  const { data: _rDataWrapper, isLoading: rLoadingQuery, isFetching: rFetching } = useListRooms(
    {
      propertyId,
      limit: pageSize,
      page: currentPage,
      search: debouncedSearch,
      buildingId: roomBuildingFilter === "all" ? undefined : Number(roomBuildingFilter),
      floorId: roomFloorFilter === "all" ? undefined : Number(roomFloorFilter),
      status: roomStatusFilter === "all" ? undefined : roomStatusFilter,
    } as any,
    { query: { keepPreviousData: true } as any }
  );

  const rData = (_rDataWrapper as any)?.data || [];
  const paginationMeta = (_rDataWrapper as any)?.pagination || { total: 0 };
  const rLoading = rLoadingQuery || rFetching;

  const openAddRoom = () => {
    setEditRoom(null);
    setRForm({
      ...EMPTY_FORM,
      buildingId: buildings[0]?.id || 0,
      floorId: floors[0]?.id || 0,
    });
    setRoomModal(true);
  };

  const openEditRoom = (r: any) => {
    setEditRoom(r);
    const rawFeatures = r.featuresList ?? r.features ?? "";
    const featuresList: string[] = Array.isArray(rawFeatures)
      ? rawFeatures
      : String(rawFeatures)
          .split(/[,;\n]+/)
          .map((s: string) => s.trim())
          .filter(Boolean);
    setRForm({
      buildingId: r.buildingId || 0,
      floorId: r.floorId || 0,
      roomNumber: r.roomNumber || "",
      roomType: r.roomType || r.type || "Standard",
      capacity: r.capacity || 2,
      gender: r.gender || "",
      status: statusNorm(r.status) || "available",
      view: r.view || "",
      bedType: r.bedType || "",
      classification: r.classification || "",
      separatorDoor: !!r.separatorDoor,
      size: r.size || (r.sizeSqm ? `${r.sizeSqm}m2` : ""),
      features: typeof r.features === "string" ? r.features : featuresList.join(", "),
      featuresList,
      notes: r.notes || "",
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
      const computedFeaturesList = rForm.featuresList.length
        ? rForm.featuresList
        : rForm.features
            .split(/[,;\n]+/)
            .map((s: string) => s.trim())
            .filter(Boolean);

      const dataToSave = {
        ...rForm,
        propertyId,
        gender: rForm.gender === "" ? undefined : rForm.gender,
        featuresList: computedFeaturesList,
        features: rForm.features || computedFeaturesList.join(", "),
      };

      if (editRoom) {
        const res = await fetch(`/api/rooms/${editRoom.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dataToSave),
        });
        if (!res.ok) throw new Error(await res.text());
        toast.success(ar ? "تم تحديث الغرفة بنجاح" : "Room updated");
      } else {
        await createRoomMut.mutateAsync({ data: dataToSave });
        toast.success(ar ? "تم إضافة الغرفة بنجاح" : "Room added");
      }
      invalidateAllHousingQueries();
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
      invalidateAllHousingQueries();
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل الحذف" : "Failed to delete"));
    }
  };

  const exportRooms = () => {
    const rows = rData.map((r: any) => {
      const bld = buildings.find((b: any) => b.id === r.buildingId);
      const flr = floors.find((f: any) => f.id === r.floorId);
      return {
        "Room Number": r.roomNumber ?? "",
        "Classification/Type": r.classification || r.roomType || r.type || "",
        "Bed Type": r.bedType ?? "",
        "Capacity": r.capacity ?? "",
        "Current Occupancy": r.currentOccupancy ?? 0,
        "Floor": flr ? `${flr.floorNumber}` : (r.floor ?? ""),
        "Building": bld ? bld.name : (r.building ?? ""),
        "Status": r.status ?? "",
        "View": r.view ?? "",
        "Separator Door": r.separatorDoor ? "Yes" : "No",
        "Size": r.size || (r.sizeSqm ? `${r.sizeSqm}m2` : ""),
        "Features": Array.isArray(r.featuresList)
          ? r.featuresList.join(", ")
          : (typeof r.features === "string" ? r.features : ""),
        "Notes": r.notes ?? "",
      };
    });

    const wb = XLSX.utils.book_new();
    const ws = XLSX.utils.json_to_sheet(rows);
    XLSX.utils.book_append_sheet(wb, ws, "Rooms");
    XLSX.writeFile(wb, "Rooms-Export.xlsx");
  };

  const bulkUpdateStatus = async (status: string) => {
    const ids = Array.from(selectedRoomIds);
    try {
      await Promise.all(
        ids.map((id) =>
          fetch(`/api/rooms/${id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status }),
          })
        )
      );
      toast.success(
        ar ? `تم تحديث ${ids.length} غرفة بنجاح` : `Updated ${ids.length} rooms`
      );
      setSelectedRoomIds(new Set());
      invalidateAllHousingQueries();
    } catch {
      toast.error(ar ? "فشل التحديث الجماعي" : "Bulk update failed");
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
              <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
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
              <SelectItem value="all">{ar ? "كل الطوابق" : "All Floors"}</SelectItem>
              {floors
                .filter(
                  (f) =>
                    roomBuildingFilter === "all" ||
                    f.buildingId === Number(roomBuildingFilter),
                )
                .map((f) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {ar ? "طابق" : "Floor"} {f.floorNumber}
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
            <SelectTrigger className="w-[150px] bg-background">
              <SelectValue placeholder={ar ? "الحالة..." : "Status..."} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
              <SelectItem value="available">🟢 {ar ? "شاغرة" : "Vacant"}</SelectItem>
              <SelectItem value="dirty">🟠 {ar ? "تحتاج تنظيف" : "Dirty"}</SelectItem>
              <SelectItem value="occupied">🔵 {ar ? "مشغولة" : "Occupied"}</SelectItem>
              <SelectItem value="occupied_dirty">🟡 {ar ? "مشغولة تحتاج تنظيف" : "Occupied Dirty"}</SelectItem>
              <SelectItem value="occupied_vacation">🟣 {ar ? "إجازة" : "Vacation"}</SelectItem>
              <SelectItem value="out_of_service">⚪ {ar ? "صيانة مؤقتة" : "Out of Service"}</SelectItem>
              <SelectItem value="out_of_order">🔴 {ar ? "خارج الخدمة" : "Out of Order"}</SelectItem>
            </SelectContent>
          </Select>

          <div className="relative w-[160px]">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={ar ? "بحث..." : "Search..."}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-8"
            />
          </div>

          <p className="text-sm text-muted-foreground">
            {paginationMeta.total} {ar ? "غرفة" : "rooms"}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <PermissionGate module="housing" action="export">
            <Button
              variant="outline"
              onClick={exportRooms}
              className="gap-1.5 text-xs font-semibold h-9"
            >
              <FileDown className="w-3.5 h-3.5" />
              {ar ? "تصدير Excel" : "Export Excel"}
            </Button>
          </PermissionGate>

          <PermissionGate module="housing" action="create">
            <Button onClick={openAddRoom} className="gap-2">
              <Plus className="w-4 h-4" />
              {ar ? "إضافة غرفة" : "Add Room"}
            </Button>
          </PermissionGate>
        </div>
      </div>

      {selectedRoomIds.size > 0 && (
        <PermissionGate module="housing" action="edit">
          <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
            <span className="text-sm font-semibold text-primary">
              {selectedRoomIds.size} {ar ? "غرفة محددة" : "rooms selected"}
            </span>
            <Select onValueChange={(status) => bulkUpdateStatus(status)}>
              <SelectTrigger className="w-[200px] h-8 text-xs bg-background">
                <SelectValue placeholder={ar ? "تغيير الحالة..." : "Change status..."} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="available">🟢 {ar ? "شاغرة (فيكنت)" : "Vacant"}</SelectItem>
                <SelectItem value="dirty">🟠 {ar ? "تحتاج تنظيف (ديرتي)" : "Dirty"}</SelectItem>
                <SelectItem value="occupied">🔵 {ar ? "مشغولة" : "Occupied"}</SelectItem>
                <SelectItem value="occupied_dirty">🟡 {ar ? "مشغولة تحتاج تنظيف" : "Occupied Dirty"}</SelectItem>
                <SelectItem value="out_of_service">⚪ {ar ? "خارج الخدمة مؤقتاً" : "Out of Service"}</SelectItem>
                <SelectItem value="out_of_order">🔴 {ar ? "غير صالحة للسكن" : "Out of Order"}</SelectItem>
              </SelectContent>
            </Select>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => setSelectedRoomIds(new Set())}
            >
              {ar ? "إلغاء التحديد" : "Clear"}
            </Button>
          </div>
        </PermissionGate>
      )}

      <RoomsTable
        buildings={buildings}
        floors={floors}
        rLoading={rLoading}
        filteredRoomsTab={rData}
        onEditRoom={openEditRoom}
        onDeleteRoom={setDeleteRoom}
        selectedRoomIds={selectedRoomIds}
        onToggleRoom={(id) =>
          setSelectedRoomIds((prev) => {
            const next = new Set(prev);
            next.has(id) ? next.delete(id) : next.add(id);
            return next;
          })
        }
        onToggleAll={() => {
          if (selectedRoomIds.size === rData.length) {
            setSelectedRoomIds(new Set());
          } else {
            setSelectedRoomIds(new Set(rData.map((r: any) => r.id)));
          }
        }}
      />

      {paginationMeta.total > 0 && (
        <DataPagination
          total={paginationMeta.total}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}

      <RoomImportWizard
        open={importWizardOpen}
        onOpenChange={setImportWizardOpen}
        properties={properties}
        currentPropertyId={propertyId}
        buildings={buildings}
        existingRooms={rData}
        onImportSuccess={() => {
          queryClient.invalidateQueries();
        }}
      />
      <RoomModals
        propertyId={propertyId}
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
