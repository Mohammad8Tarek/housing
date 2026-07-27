import { useState } from "react";
import { Plus } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useCreateFloor, useUpdateFloor, useDeleteFloor } from "@workspace/api-client-react";

import { FloorsTable } from "./FloorsTable";
import { FloorModals } from "./FloorModals";

type Props = {
  propertyId: number;
  buildings: any[];
  floors: any[];
  rooms: any[];
  fLoading: boolean;
};

export function FloorsTab({ propertyId, buildings, floors, rooms, fLoading }: Props) {
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
    (f) => floorBuildingFilter === "all" || f.buildingId === Number(floorBuildingFilter)
  );

  const openCreateFloor = () => {
    setEditFloor(null);
    setFForm({ buildingId: buildings[0]?.id || 0, floorNumber: "", description: "" });
    setFloorModal(true);
  };

  const openEditFloor = (f: any) => {
    setEditFloor(f);
    setFForm({ buildingId: f.buildingId, floorNumber: f.floorNumber, description: f.description || "" });
    setFloorModal(true);
  };

  const saveFloorHandler = async () => {
    if (!fForm.buildingId || !fForm.floorNumber.trim()) {
      toast.error(ar ? "المبنى ورقم الطابق مطلوبان" : "Building and floor number are required");
      return;
    }
    try {
      if (editFloor) {
        await updateFloorMut.mutateAsync({ id: editFloor.id, data: { ...fForm } });
        toast.success(ar ? "تم تحديث الطابق بنجاح" : "Floor updated");
      } else {
        await createFloorMut.mutateAsync({ data: { ...fForm, propertyId } });
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
          <Select value={floorBuildingFilter} onValueChange={setFloorBuildingFilter}>
            <SelectTrigger className="w-[200px]">
              <SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
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
      
      <FloorsTable
        buildings={buildings}
        floors={floors}
        rooms={rooms}
        fLoading={fLoading}
        filteredFloors={filteredFloors}
        onEditFloor={openEditFloor}
        onDeleteFloor={setDeleteFloor}
      />

      <FloorModals
        buildings={buildings}
        floorModal={floorModal}
        setFloorModal={setFloorModal}
        editFloor={editFloor}
        fForm={fForm}
        setFForm={setFForm}
        saveFloorHandler={saveFloorHandler}
        isSaving={createFloorMut.isPending || updateFloorMut.isPending}
        deleteFloor={deleteFloor}
        setDeleteFloor={setDeleteFloor}
        confirmDeleteFloor={confirmDeleteFloor}
        isDeleting={deleteFloorMut.isPending}
      />
    </div>
  );
}
