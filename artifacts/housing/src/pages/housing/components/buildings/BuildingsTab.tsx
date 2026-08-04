// @ts-nocheck
import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  Plus,
  Building2,
  MapPin,
  Users,
  Pencil,
  Trash2,
  Wand2,
  ChevronUp,
  ChevronDown,
  Layers,
  Loader2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  useCreateBuilding,
  useUpdateBuilding,
  useDeleteBuilding,
  useCreateFloor,
  useCreateRoom,
} from "@workspace/api-client-react";
import {
  buildingStatusBadge,
  makeDefaultFloor,
  FloorConfig,
} from "../../utils";

const roomTypes = [
  "Standard",
  "Deluxe",
  "Suite",
  "Studio",
  "Shared",
  "Dormitory",
  "Executive",
];

const roomTypeValues = [
  { value: "Standard", parentValue: "2" },
  { value: "Shared", parentValue: "4" },
  { value: "Dormitory", parentValue: "6" },
  { value: "Suite", parentValue: "1" },
  { value: "Executive", parentValue: "1" },
];

type Props = {
  propertyId: number;
  buildings: any[];
  floors: any[];
  rooms: any[];
  bLoading: boolean;
};

export function BuildingsTab({
  propertyId,
  buildings,
  floors,
  rooms,
  bLoading,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const createBuildingMut = useCreateBuilding();
  const updateBuildingMut = useUpdateBuilding();
  const deleteBuildingMut = useDeleteBuilding();
  const createFloorMut = useCreateFloor();
  const createRoomMut = useCreateRoom();

  const [buildingModal, setBuildingModal] = useState(false);
  const [editBuilding, setEditBuilding] = useState<any>(null);
  const [deleteBuilding, setDeleteBuilding] = useState<any>(null);
  const [bForm, setBForm] = useState({
    name: "",
    location: "",
    status: "active",
    capacity: 0,
  });

  const [smartMode, setSmartMode] = useState(false);
  const [floorConfigs, setFloorConfigs] = useState<FloorConfig[]>([
    makeDefaultFloor(0),
  ]);
  const [expandedFloorConfigs, setExpandedFloorConfigs] = useState<Set<number>>(
    new Set([0]),
  );
  const [isBuildingGenerating, setIsBuildingGenerating] = useState(false);

  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 10;
  
  // Apply pagination
  const paginatedBuildings = buildings.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const paginationMeta = {
    page: currentPage,
    limit: pageSize,
    total: buildings.length,
    totalPages: Math.ceil(buildings.length / pageSize),
    hasNextPage: currentPage * pageSize < buildings.length,
    hasPrevPage: currentPage > 1,
  };

  const smartTotalRooms = smartMode
    ? floorConfigs.reduce((sum, f) => sum + f.roomsCount, 0)
    : 0;
  const smartTotalBeds = smartMode
    ? floorConfigs.reduce((sum, f) => sum + f.roomsCount * f.roomCapacity, 0)
    : 0;

  const openCreateBuilding = () => {
    setEditBuilding(null);
    setBForm({ name: "", location: "", status: "active", capacity: 0 });
    setSmartMode(false);
    setFloorConfigs([makeDefaultFloor(0)]);
    setExpandedFloorConfigs(new Set([0]));
    setBuildingModal(true);
  };

  const openEditBuilding = (b: any) => {
    setEditBuilding(b);
    setBForm({
      name: b.name,
      location: b.location || "",
      status: b.status || "active",
      capacity: b.capacity || 0,
    });
    setSmartMode(false);
    setBuildingModal(true);
  };

  const addFloor = () => {
    setFloorConfigs((prev) => {
      const last = prev[prev.length - 1];
      const newConfig = makeDefaultFloor(prev.length, last);
      setExpandedFloorConfigs((s) => {
        const next = new Set(s);
        next.add(prev.length);
        return next;
      });
      return [...prev, newConfig];
    });
  };

  const removeFloor = (index: number) => {
    setFloorConfigs((prev) => prev.filter((_, i) => i !== index));
    setExpandedFloorConfigs((s) => {
      const next = new Set(s);
      next.delete(index);
      return next;
    });
  };

  const updateFloorConfig = (index: number, updates: Partial<FloorConfig>) => {
    setFloorConfigs((prev) =>
      prev.map((fc, i) => (i === index ? { ...fc, ...updates } : fc)),
    );
  };

  const toggleFloorConfig = (index: number) => {
    setExpandedFloorConfigs((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const saveBuildingHandler = async () => {
    if (!bForm.name.trim()) {
      toast.error(ar ? "اسم المبنى مطلوب" : "Building name is required");
      return;
    }

    try {
      if (editBuilding) {
        await updateBuildingMut.mutateAsync({
          id: editBuilding.id,
          data: {
            ...bForm,
            propertyId,
          },
        });
        toast.success(ar ? "تم تحديث المبنى بنجاح" : "Building updated");
        queryClient.invalidateQueries();
        setBuildingModal(false);
      } else {
        if (smartMode) {
          if (smartTotalRooms > 200) {
            toast.error(
              ar
                ? "الحد الأقصى 200 غرفة في العملية الواحدة"
                : "Max 200 rooms per operation",
            );
            return;
          }

          setIsBuildingGenerating(true);
            // 1. Create Building
            const bData = await createBuildingMut.mutateAsync({
              data: {
                ...bForm,
                capacity: smartTotalBeds,
                propertyId,
              }
            });
          const newBuildingId = bData.id;

          // 2. Create Floors & Rooms sequentially to avoid overwhelming the DB
          for (const fc of floorConfigs) {
            const fData = await createFloorMut.mutateAsync({
              data: {
                propertyId,
                buildingId: newBuildingId,
                floorNumber: fc.floorNumber,
              }
            });
            const newFloorId = fData.id;

            // Generate rooms for this floor
            const roomsData = Array.from({ length: fc.roomsCount }).map(
              (_, i) => ({
                propertyId,
                buildingId: newBuildingId,
                floorId: newFloorId,
                roomNumber: String(fc.roomStartNumber + i),
                roomType: fc.roomType,
                capacity: fc.roomCapacity,
                gender: fc.genderPolicy || undefined,
                status: "available",
              }),
            );

            // Chunk rooms creation to avoid too large payloads
            const chunkSize = 20;
            for (let i = 0; i < roomsData.length; i += chunkSize) {
              const chunk = roomsData.slice(i, i + chunkSize);
              await Promise.all(
                chunk.map((rData) => createRoomMut.mutateAsync({ data: rData })),
              );
            }
          }

          toast.success(
            ar
              ? `تم إنشاء المبنى و ${smartTotalRooms} غرفة`
              : `Building and ${smartTotalRooms} rooms created`,
          );
          queryClient.invalidateQueries();
          setIsBuildingGenerating(false);
          setBuildingModal(false);
        } else {
          // Normal mode
          await createBuildingMut.mutateAsync({
            data: {
              ...bForm,
              propertyId,
            },
          });
          toast.success(ar ? "تمت إضافة المبنى بنجاح" : "Building created successfully");
          queryClient.invalidateQueries();
          setBuildingModal(false);
        }
      }
    } catch (err: any) {
      console.error(err);
      setIsBuildingGenerating(false);
      toast.error(err.message || (ar ? "حدث خطأ" : "Something went wrong"));
    }
  };

  const confirmDeleteBuilding = async () => {
    if (!deleteBuilding) return;
    console.log("Confirming delete for building:", deleteBuilding);
    if (deleteBuilding.id === undefined) {
      toast.error("Error: Building ID is undefined! Cannot delete.");
      console.error("Missing ID in building object:", deleteBuilding);
      return;
    }
    try {
      await deleteBuildingMut.mutateAsync({ id: deleteBuilding.id });
      toast.success(ar ? "تم حذف المبنى بنجاح" : "Building deleted");
      setDeleteBuilding(null);
      queryClient.invalidateQueries();
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "Failed to delete"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {buildings.length} {ar ? "مبنى" : "buildings"}
        </p>
        <PermissionGate module="housing" action="create">
          <Button onClick={openCreateBuilding} size="sm">
            <Plus className="w-4 h-4 mr-1" />{" "}
            {ar ? "إضافة مبنى" : "Add Building"}
          </Button>
        </PermissionGate>
      </div>
      {bLoading ? (
        <div className="space-y-3">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-16 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الاسم" : "Name"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الموقع" : "Location"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الطوابق" : "Floors"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الغرف" : "Rooms"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "السعة" : "Capacity"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الحالة" : "Status"}
                </th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {paginatedBuildings.map((b) => {
                const bFloors = floors.filter((f) => f.buildingId === b.id);
                const bRooms = rooms.filter((r) => r.buildingId === b.id);
                return (
                  <tr
                    key={b.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                          <Building2 className="w-4 h-4 text-primary" />
                        </div>
                        <span className="font-semibold">{b.name}</span>
                      </div>
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <MapPin className="w-3 h-3" />
                        {b.location}
                      </span>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary">{bFloors.length}</Badge>
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary">{bRooms.length}</Badge>
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-1 text-muted-foreground">
                        <Users className="w-3 h-3" />
                        {b.capacity}
                      </span>
                    </td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${buildingStatusBadge(b.status)}`}
                      >
                        {b.status}
                      </span>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <PermissionGate module="housing" action="edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditBuilding(b)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="housing" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteBuilding(b)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {buildings.length === 0 && (
                <tr>
                  <td
                    colSpan={7}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <Building2 className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p>{ar ? "لا توجد مبانٍ" : "No buildings yet"}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {buildings.length > 0 && (
        <PaginationBar
          pagination={paginationMeta as any}
          onPageChange={setCurrentPage}
        />
      )}

      {/* Building Modal */}
      <Dialog
        open={buildingModal}
        onOpenChange={(v) => {
          setBuildingModal(v);
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          srTitle={
            editBuilding
              ? ar
                ? "تعديل المبنى"
                : "Edit Building"
              : ar
                ? "إضافة مبنى جديد"
                : "Add New Building"
          }
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editBuilding
                ? ar
                  ? "تعديل المبنى"
                  : "Edit Building"
                : ar
                  ? "إضافة مبنى جديد"
                  : "Add New Building"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            {/* Basic info */}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>{ar ? "الاسم *" : "Name *"}</Label>
                <Input
                  value={bForm.name}
                  onChange={(e) =>
                    setBForm((p) => ({ ...p, name: e.target.value }))
                  }
                  placeholder={ar ? "اسم المبنى" : "Building name"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الموقع" : "Location"}</Label>
                <Input
                  value={bForm.location}
                  onChange={(e) =>
                    setBForm((p) => ({ ...p, location: e.target.value }))
                  }
                  placeholder={ar ? "الموقع / العنوان" : "Location / address"}
                />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الحالة" : "Status"}</Label>
                <Select
                  value={bForm.status}
                  onValueChange={(v) => setBForm((p) => ({ ...p, status: v }))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      {ar ? "نشط" : "Active"}
                    </SelectItem>
                    <SelectItem value="inactive">
                      {ar ? "غير نشط" : "Inactive"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {/* Smart mode toggle */}
            {!editBuilding && (
              <>
                <Separator />
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-primary">
                        {ar ? "الإنشاء الذكي" : "Smart Generation"}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {ar
                          ? "إنشاء طوابق وغرف تلقائياً"
                          : "Auto-generate floors & rooms"}
                      </p>
                    </div>
                  </div>
                  <Switch
                    checked={smartMode}
                    onCheckedChange={(v) => {
                      setSmartMode(v);
                      if (v) {
                        setFloorConfigs([makeDefaultFloor(0)]);
                        setExpandedFloorConfigs(new Set([0]));
                      }
                    }}
                  />
                </div>

                {smartMode && (
                  <div className="space-y-3">
                    {/* Per-floor config cards */}
                    {floorConfigs.map((fc, idx) => {
                      const isOpen = expandedFloorConfigs.has(idx);
                      return (
                        <div
                          key={idx}
                          className="border rounded-xl overflow-hidden"
                        >
                          <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
                            <button
                              className="flex items-center gap-2 flex-1 text-left"
                              onClick={() => toggleFloorConfig(idx)}
                            >
                              {isOpen ? (
                                <ChevronUp className="w-4 h-4 text-primary" />
                              ) : (
                                <ChevronDown className="w-4 h-4 text-muted-foreground" />
                              )}
                              <Layers className="w-4 h-4 text-primary/70" />
                              <span className="font-semibold text-sm">
                                {ar ? "الطابق" : "Floor"} {fc.floorNumber}
                              </span>
                              <span className="text-xs text-muted-foreground ml-1">
                                — {fc.roomsCount} {ar ? "غرفة" : "rooms"} ·{" "}
                                {fc.roomType} · {fc.roomCapacity}{" "}
                                {ar ? "سرير" : "beds/room"}
                              </span>
                              <span className="text-xs text-muted-foreground">
                                · {ar ? "من" : "from"} {fc.roomStartNumber}
                              </span>
                            </button>
                            {floorConfigs.length > 1 && (
                              <button
                                onClick={() => removeFloor(idx)}
                                className="text-destructive hover:text-destructive/80 p-1 rounded"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>

                          {isOpen && (
                            <div className="p-4 grid grid-cols-2 gap-3 bg-muted/10">
                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  {ar ? "رقم الطابق" : "Floor Number"}
                                </Label>
                                <Input
                                  value={fc.floorNumber}
                                  onChange={(e) =>
                                    updateFloorConfig(idx, {
                                      floorNumber: e.target.value,
                                    })
                                  }
                                  placeholder="1"
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  {ar ? "عدد الغرف" : "Rooms Count"}
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={200}
                                  value={fc.roomsCount}
                                  onChange={(e) =>
                                    updateFloorConfig(idx, {
                                      roomsCount: Math.max(
                                        1,
                                        Number(e.target.value),
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  {ar ? "نوع الغرفة" : "Room Type"}
                                </Label>
                                <Select
                                  value={fc.roomType}
                                  onValueChange={(v) => {
                                    const match = roomTypeValues.find(
                                      (rt) => rt.value === v,
                                    );
                                    const autoCap = match?.parentValue
                                      ? Number(match.parentValue)
                                      : undefined;
                                    updateFloorConfig(idx, {
                                      roomType: v,
                                      ...(autoCap && autoCap > 0
                                        ? { roomCapacity: autoCap }
                                        : {}),
                                    });
                                  }}
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
                                <Label className="text-xs">
                                  {ar
                                    ? "سعة الغرفة (أسرة)"
                                    : "Room Capacity (beds)"}
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  max={20}
                                  value={fc.roomCapacity}
                                  onChange={(e) =>
                                    updateFloorConfig(idx, {
                                      roomCapacity: Math.max(
                                        1,
                                        Number(e.target.value),
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  {ar ? "رقم بداية الغرف" : "Room Start Number"}
                                </Label>
                                <Input
                                  type="number"
                                  min={1}
                                  value={fc.roomStartNumber}
                                  onChange={(e) =>
                                    updateFloorConfig(idx, {
                                      roomStartNumber: Math.max(
                                        1,
                                        Number(e.target.value),
                                      ),
                                    })
                                  }
                                />
                              </div>
                              <div className="space-y-1.5">
                                <Label className="text-xs">
                                  {ar ? "سياسة الجنس" : "Gender Policy"}
                                </Label>
                                <Select
                                  value={fc.genderPolicy || "__none__"}
                                  onValueChange={(v) =>
                                    updateFloorConfig(idx, {
                                      genderPolicy: v === "__none__" ? "" : v,
                                    })
                                  }
                                >
                                  <SelectTrigger>
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="__none__">
                                      {ar ? "مختلط" : "Mixed"}
                                    </SelectItem>
                                    <SelectItem value="M">
                                      {ar ? "ذكور" : "Male Only"}
                                    </SelectItem>
                                    <SelectItem value="F">
                                      {ar ? "إناث" : "Female Only"}
                                    </SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="col-span-2 p-2 rounded-lg bg-primary/5 text-xs text-muted-foreground">
                                {ar ? "أرقام الغرف" : "Room numbers"}:{" "}
                                <span className="font-mono font-bold text-foreground">
                                  {fc.roomStartNumber} —{" "}
                                  {fc.roomStartNumber + fc.roomsCount - 1}
                                </span>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    <button
                      onClick={addFloor}
                      className="w-full py-2.5 border-2 border-dashed border-primary/30 rounded-xl text-sm text-primary/70 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
                    >
                      <Plus className="w-4 h-4" />
                      {ar ? "إضافة طابق" : "Add Floor"}
                    </button>

                    <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 grid grid-cols-3 gap-3 text-center">
                      <div>
                        <p className="text-xl font-bold text-primary">
                          {floorConfigs.length}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ar ? "طابق" : "Floors"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-primary">
                          {smartTotalRooms}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ar ? "غرفة" : "Rooms"}
                        </p>
                      </div>
                      <div>
                        <p className="text-xl font-bold text-primary">
                          {smartTotalBeds}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ar ? "سرير" : "Beds"}
                        </p>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setBuildingModal(false)}
              disabled={isBuildingGenerating}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={saveBuildingHandler}
              disabled={
                createBuildingMut.isPending ||
                updateBuildingMut.isPending ||
                isBuildingGenerating
              }
            >
              {isBuildingGenerating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {ar ? "جاري الإنشاء..." : "Generating..."}
                </>
              ) : editBuilding ? (
                ar ? (
                  "حفظ"
                ) : (
                  "Save"
                )
              ) : smartMode ? (
                ar ? (
                  `إنشاء ذكي (${smartTotalRooms} غرفة)`
                ) : (
                  `Smart Create (${smartTotalRooms} rooms)`
                )
              ) : ar ? (
                "إنشاء"
              ) : (
                "Create"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteBuilding}
        onOpenChange={(v) => !v && setDeleteBuilding(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "حذف المبنى" : "Delete Building"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {(() => {
                const bFloorsCount = deleteBuilding ? floors.filter(f => f.buildingId === deleteBuilding.id).length : 0;
                const bRoomsCount = deleteBuilding ? rooms.filter(r => r.buildingId === deleteBuilding.id).length : 0;
                
                if (bRoomsCount > 0) {
                  return ar
                    ? `هذا المبنى يحتوي على ${bFloorsCount} طوابق و ${bRoomsCount} غرف. هل أنت متأكد من رغبتك في حذف المبنى مع جميع غرفه نهائياً؟ لا يمكن التراجع عن هذا الإجراء.`
                    : `This building contains ${bFloorsCount} floors and ${bRoomsCount} rooms. Are you sure you want to delete the building AND all its rooms permanently? This action cannot be undone.`;
                }

                return ar
                  ? "هل أنت متأكد؟ سيتم حذف المبنى نهائياً. لا يمكن التراجع عن هذا الإجراء."
                  : "Are you sure? This will delete the building permanently. This action cannot be undone.";
              })()}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmDeleteBuilding}
              disabled={deleteBuildingMut.isPending}
            >
              {ar ? "حذف المبنى والغرف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
