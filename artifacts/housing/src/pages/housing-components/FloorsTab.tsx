// @ts-nocheck
import { useState } from "react";
import { Plus, ChevronRight, Layers, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
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
  useCreateFloor,
  useUpdateFloor,
  useDeleteFloor,
} from "@workspace/api-client-react";

type Props = {
  buildings: any[];
  floors: any[];
  rooms: any[];
  fLoading: boolean;
};

export function FloorsTab({
  propertyId,
  buildings,
  floors,
  rooms,
  fLoading,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const createFloorMut = useCreateFloor();
  const updateFloorMut = useUpdateFloor();
  const deleteFloorMut = useDeleteFloor();

  const [floorModal, setFloorModal] = useState(false);
  const [editFloor, setEditFloor] = useState<any>(null);
  const [deleteFloor, setDeleteFloor] = useState<any>(null);
  const [fForm, setFForm] = useState({
    buildingId: 0,
    floorNumber: "",
    description: "",
  });

  const [floorBuildingFilter, setFloorBuildingFilter] = useState("all");

  const filteredFloors = floors.filter(
    (f) =>
      floorBuildingFilter === "all" ||
      f.buildingId === Number(floorBuildingFilter),
  );

  const openCreateFloor = () => {
    setEditFloor(null);
    setFForm({
      buildingId: buildings[0]?.id || 0,
      floorNumber: "",
      description: "",
    });
    setFloorModal(true);
  };

  const openEditFloor = (f: any) => {
    setEditFloor(f);
    setFForm({
      buildingId: f.buildingId,
      floorNumber: f.floorNumber,
      description: f.description || "",
    });
    setFloorModal(true);
  };

  const saveFloorHandler = async () => {
    if (!fForm.buildingId || !fForm.floorNumber.trim()) {
      toast.error(
        ar
          ? "المبنى ورقم الطابق مطلوبان"
          : "Building and floor number are required",
      );
      return;
    }

    try {
      if (editFloor) {
        await updateFloorMut.mutateAsync({
          id: editFloor.id,
          data: { ...fForm, propertyId },
        });
        toast.success(ar ? "تم تحديث الطابق بنجاح" : "Floor updated");
      } else {
        await createFloorMut.mutateAsync({
          ...fForm,
          propertyId,
        });
        toast.success(ar ? "تم إضافة الطابق بنجاح" : "Floor added");
      }
      setFloorModal(false);
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "Failed to save"));
    }
  };

  const confirmDeleteFloor = async () => {
    if (!deleteFloor) return;
    try {
      await deleteFloorMut.mutateAsync(deleteFloor.id);
      toast.success(ar ? "تم حذف الطابق بنجاح" : "Floor deleted");
      setDeleteFloor(null);
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ" : "Failed to delete"));
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          <Select
            value={floorBuildingFilter}
            onValueChange={setFloorBuildingFilter}
          >
            <SelectTrigger className="w-[200px]">
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
          <p className="text-sm text-muted-foreground">
            {filteredFloors.length} {ar ? "طابق" : "floors"}
          </p>
        </div>
        <PermissionGate module="housing" action="create">
          <Button onClick={openCreateFloor} size="sm">
            <Plus className="w-4 h-4 mr-1" /> {ar ? "إضافة طابق" : "Add Floor"}
          </Button>
        </PermissionGate>
      </div>
      {fLoading ? (
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
                  {ar ? "المبنى" : "Building"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الطابق" : "Floor"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الوصف" : "Description"}
                </th>
                <th className="text-left p-3 font-semibold text-muted-foreground">
                  {ar ? "الغرف" : "Rooms"}
                </th>
                <th className="p-3" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {filteredFloors.map((f) => {
                const building = buildings.find((b) => b.id === f.buildingId);
                const fRooms = rooms.filter((r) => r.floorId === f.id);
                return (
                  <tr
                    key={f.id}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <ChevronRight className="w-3 h-3 text-muted-foreground" />
                        <span className="font-medium">
                          {building?.name || "-"}
                        </span>
                      </span>
                    </td>
                    <td className="p-3">
                      <span className="flex items-center gap-2">
                        <Layers className="w-4 h-4 text-primary/60" />
                        <span className="font-semibold">
                          {ar ? "الطابق" : "Floor"} {f.floorNumber}
                        </span>
                      </span>
                    </td>
                    <td className="p-3 text-muted-foreground">
                      {f.description || "—"}
                    </td>
                    <td className="p-3">
                      <Badge variant="secondary">{fRooms.length}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1 justify-end">
                        <PermissionGate module="housing" action="edit">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8"
                            onClick={() => openEditFloor(f)}
                          >
                            <Pencil className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                        <PermissionGate module="housing" action="delete">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-destructive hover:text-destructive"
                            onClick={() => setDeleteFloor(f)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </PermissionGate>
                      </div>
                    </td>
                  </tr>
                );
              })}
              {filteredFloors.length === 0 && (
                <tr>
                  <td
                    colSpan={5}
                    className="py-12 text-center text-muted-foreground"
                  >
                    <Layers className="w-8 h-8 opacity-30 mx-auto mb-2" />
                    <p>{ar ? "لا توجد طوابق" : "No floors yet"}</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Floor Modal */}
      <Dialog open={floorModal} onOpenChange={setFloorModal}>
        <DialogContent
          className="max-w-md"
          srTitle={
            editFloor
              ? ar
                ? "تعديل الطابق"
                : "Edit Floor"
              : ar
                ? "إضافة طابق"
                : "Add Floor"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editFloor
                ? ar
                  ? "تعديل الطابق"
                  : "Edit Floor"
                : ar
                  ? "إضافة طابق"
                  : "Add Floor"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{ar ? "المبنى" : "Building"} *</Label>
              <Select
                value={String(fForm.buildingId)}
                onValueChange={(v) =>
                  setFForm((p) => ({ ...p, buildingId: Number(v) }))
                }
                disabled={!!editFloor}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={ar ? "اختر المبنى" : "Select building"}
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
              <Label>{ar ? "رقم الطابق" : "Floor Number"} *</Label>
              <Input
                value={fForm.floorNumber}
                onChange={(e) =>
                  setFForm((p) => ({ ...p, floorNumber: e.target.value }))
                }
                placeholder={ar ? "مثال: 1، 2، الأرضي" : "e.g. 1, 2, Ground"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "الوصف" : "Description"}</Label>
              <Input
                value={fForm.description}
                onChange={(e) =>
                  setFForm((p) => ({ ...p, description: e.target.value }))
                }
                placeholder={ar ? "وصف اختياري" : "Optional description"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFloorModal(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={saveFloorHandler}
              disabled={createFloorMut.isPending || updateFloorMut.isPending}
            >
              {editFloor ? (ar ? "حفظ" : "Save") : ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deleteFloor}
        onOpenChange={(v) => !v && setDeleteFloor(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "حذف الطابق" : "Delete Floor"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هل أنت متأكد؟ سيتم حذف الطابق. لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure? This will delete the floor. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={confirmDeleteFloor}
              disabled={deleteFloorMut.isPending}
            >
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
