import { Building2, Wand2, Loader2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { SmartGenerationConfig } from "./SmartGenerationConfig";
import { FloorConfig } from "../../utils";

type Props = {
  buildingModal: boolean;
  setBuildingModal: (v: boolean) => void;
  editBuilding: any;
  bForm: any;
  setBForm: (v: any) => void;
  smartMode: boolean;
  setSmartMode: (v: boolean) => void;
  floorConfigs: FloorConfig[];
  setFloorConfigs: (v: any) => void;
  expandedFloorConfigs: Set<number>;
  setExpandedFloorConfigs: (v: any) => void;
  toggleFloorConfig: (idx: number) => void;
  removeFloor: (idx: number) => void;
  updateFloorConfig: (idx: number, updates: Partial<FloorConfig>) => void;
  addFloor: () => void;
  smartTotalRooms: number;
  smartTotalBeds: number;
  isBuildingGenerating: boolean;
  saveBuildingHandler: () => void;
  isSaving: boolean;
  
  deleteBuilding: any;
  setDeleteBuilding: (v: any) => void;
  confirmDeleteBuilding: () => void;
  isDeleting: boolean;
};

export function BuildingModals({
  buildingModal, setBuildingModal, editBuilding, bForm, setBForm,
  smartMode, setSmartMode, floorConfigs, setFloorConfigs,
  expandedFloorConfigs, setExpandedFloorConfigs, toggleFloorConfig, removeFloor,
  updateFloorConfig, addFloor, smartTotalRooms, smartTotalBeds,
  isBuildingGenerating, saveBuildingHandler, isSaving,
  deleteBuilding, setDeleteBuilding, confirmDeleteBuilding, isDeleting,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <>
      <Dialog open={buildingModal} onOpenChange={setBuildingModal}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" srTitle={editBuilding ? (ar ? "تعديل المبنى" : "Edit Building") : (ar ? "إضافة مبنى جديد" : "Add New Building")}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editBuilding ? (ar ? "تعديل المبنى" : "Edit Building") : (ar ? "إضافة مبنى جديد" : "Add New Building")}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-1">
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 space-y-1.5">
                <Label>{ar ? "الاسم *" : "Name *"}</Label>
                <Input value={bForm.name} onChange={(e) => setBForm((p: any) => ({ ...p, name: e.target.value }))} placeholder={ar ? "اسم المبنى" : "Building name"} />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الموقع" : "Location"}</Label>
                <Input value={bForm.location} onChange={(e) => setBForm((p: any) => ({ ...p, location: e.target.value }))} placeholder={ar ? "الموقع / العنوان" : "Location / address"} />
              </div>
              <div className="space-y-1.5">
                <Label>{ar ? "الحالة" : "Status"}</Label>
                <Select value={bForm.status} onValueChange={(v) => setBForm((p: any) => ({ ...p, status: v }))}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">{ar ? "نشط" : "Active"}</SelectItem>
                    <SelectItem value="inactive">{ar ? "غير نشط" : "Inactive"}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>

            {!editBuilding && (
              <>
                <Separator />
                <div className="flex items-center justify-between p-3 rounded-xl bg-primary/5 border border-primary/15">
                  <div className="flex items-center gap-2">
                    <Wand2 className="w-4 h-4 text-primary" />
                    <div>
                      <p className="text-sm font-semibold text-primary">{ar ? "الإنشاء الذكي" : "Smart Generation"}</p>
                      <p className="text-xs text-muted-foreground">{ar ? "إنشاء طوابق وغرف تلقائياً" : "Auto-generate floors & rooms"}</p>
                    </div>
                  </div>
                  <Switch
                    checked={smartMode}
                    onCheckedChange={(v) => {
                      setSmartMode(v);
                      if (v) {
                        setFloorConfigs([{ floorNumber: "1", roomsCount: 10, roomType: "Standard", roomCapacity: 2, roomStartNumber: 101, genderPolicy: "" }]);
                        setExpandedFloorConfigs(new Set([0]));
                      }
                    }}
                  />
                </div>

                {smartMode && (
                  <SmartGenerationConfig
                    floorConfigs={floorConfigs}
                    expandedFloorConfigs={expandedFloorConfigs}
                    toggleFloorConfig={toggleFloorConfig}
                    removeFloor={removeFloor}
                    updateFloorConfig={updateFloorConfig}
                    addFloor={addFloor}
                    smartTotalRooms={smartTotalRooms}
                    smartTotalBeds={smartTotalBeds}
                  />
                )}
              </>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setBuildingModal(false)} disabled={isBuildingGenerating}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={saveBuildingHandler} disabled={isSaving || isBuildingGenerating}>
              {isBuildingGenerating ? (
                <><Loader2 className="w-4 h-4 mr-2 animate-spin" />{ar ? "جاري الإنشاء..." : "Generating..."}</>
              ) : editBuilding ? (ar ? "حفظ" : "Save") : smartMode ? (
                ar ? `إنشاء ذكي (${smartTotalRooms} غرفة)` : `Smart Create (${smartTotalRooms} rooms)`
              ) : (ar ? "إنشاء" : "Create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteBuilding} onOpenChange={(v) => !v && setDeleteBuilding(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? "حذف المبنى" : "Delete Building"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar ? "هل أنت متأكد؟ سيتم حذف المبنى وجميع الطوابق والغرف المرتبطة به. لا يمكن التراجع عن هذا الإجراء." : "Are you sure? This will delete the building and all associated floors and rooms. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDeleteBuilding} disabled={isDeleting}>
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
