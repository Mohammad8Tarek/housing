import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";

type Props = {
  buildings: any[];
  floorModal: boolean;
  setFloorModal: (v: boolean) => void;
  editFloor: any;
  fForm: any;
  setFForm: (v: any) => void;
  saveFloorHandler: () => void;
  isSaving: boolean;
  
  deleteFloor: any;
  setDeleteFloor: (v: any) => void;
  confirmDeleteFloor: () => void;
  isDeleting: boolean;
};

export function FloorModals({
  buildings,
  floorModal,
  setFloorModal,
  editFloor,
  fForm,
  setFForm,
  saveFloorHandler,
  isSaving,
  deleteFloor,
  setDeleteFloor,
  confirmDeleteFloor,
  isDeleting,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <>
      <Dialog open={floorModal} onOpenChange={setFloorModal}>
        <DialogContent className="max-w-md" srTitle={editFloor ? (ar ? "تعديل الطابق" : "Edit Floor") : (ar ? "إضافة طابق" : "Add Floor")}>
          <DialogHeader>
            <DialogTitle>{editFloor ? (ar ? "تعديل الطابق" : "Edit Floor") : (ar ? "إضافة طابق" : "Add Floor")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>{ar ? "المبنى" : "Building"} *</Label>
              <Select
                value={String(fForm.buildingId)}
                onValueChange={(v) => setFForm((p: any) => ({ ...p, buildingId: Number(v) }))}
                disabled={!!editFloor}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر المبنى" : "Select building"} />
                </SelectTrigger>
                <SelectContent>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "رقم الطابق" : "Floor Number"} *</Label>
              <Input
                value={fForm.floorNumber}
                onChange={(e) => setFForm((p: any) => ({ ...p, floorNumber: e.target.value }))}
                placeholder={ar ? "مثال: 1، 2، الأرضي" : "e.g. 1, 2, Ground"}
              />
            </div>
            <div className="space-y-1.5">
              <Label>{ar ? "الوصف" : "Description"}</Label>
              <Input
                value={fForm.description}
                onChange={(e) => setFForm((p: any) => ({ ...p, description: e.target.value }))}
                placeholder={ar ? "وصف اختياري" : "Optional description"}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setFloorModal(false)}>{ar ? "إلغاء" : "Cancel"}</Button>
            <Button onClick={saveFloorHandler} disabled={isSaving}>
              {editFloor ? (ar ? "حفظ" : "Save") : ar ? "إنشاء" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteFloor} onOpenChange={(v) => !v && setDeleteFloor(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ar ? "حذف الطابق" : "Delete Floor"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هل أنت متأكد؟ سيتم حذف الطابق. لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure? This will delete the floor. This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={confirmDeleteFloor} disabled={isDeleting}>
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
