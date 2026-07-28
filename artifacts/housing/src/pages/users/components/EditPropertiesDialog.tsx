import { useState } from "react";
import { useUpdateUser } from "@workspace/api-client-react";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Building2 } from "lucide-react";

interface EditPropertiesDialogProps {
  user: any;
  properties: any[];
  onClose: () => void;
  onSuccess?: () => void;
}

export function EditPropertiesDialog({
  user,
  properties,
  onClose,
  onSuccess,
}: EditPropertiesDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const updateMutation = useUpdateUser({
    mutation: {
      onError: (e: any) => toast.error(e.message || "Error"),
    },
  });

  const initialPids: number[] = user.propertyIds?.length
    ? user.propertyIds
    : user.propertyId
      ? [user.propertyId]
      : [];
  const [selectedIds, setSelectedIds] = useState<number[]>(initialPids);
  const [saving, setSaving] = useState(false);

  const toggle = (id: number) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const save = async () => {
    if (!selectedIds.length) {
      toast.error(
        ar ? "يجب اختيار فرع واحد على الأقل" : "Select at least one property",
      );
      return;
    }
    setSaving(true);
    try {
      await updateMutation.mutateAsync({
        id: user.id,
        data: { propertyIds: selectedIds, propertyId: selectedIds[0] } as any,
      });
      toast.success(ar ? "تم تحديث الفروع" : "Properties updated");
      onSuccess?.();
      onClose();
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-sm"
        srTitle={ar ? "تعديل الفروع" : "Edit Properties"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Building2 className="w-5 h-5 text-green-600" />
            {ar ? "تعديل الفروع" : "Edit Properties"} —{" "}
            <span className="font-mono">{user.username}</span>
          </DialogTitle>
        </DialogHeader>
        <div className="space-y-3 pt-1">
          <p className="text-sm text-muted-foreground">
            {ar
              ? "اختر جميع الفروع التي يمكن لهذا المستخدم الوصول إليها:"
              : "Select all properties this user can access:"}
          </p>
          <div className="border rounded-lg p-3 space-y-2 max-h-60 overflow-y-auto bg-muted/10">
            {properties.map((p) => (
              <label
                key={p.id}
                className="flex items-center gap-2.5 cursor-pointer hover:bg-muted/30 px-2 py-1.5 rounded-md transition-colors"
              >
                <input
                  type="checkbox"
                  checked={selectedIds.includes(p.id)}
                  onChange={() => toggle(p.id)}
                  className="w-4 h-4 rounded"
                />
                <span className="flex-1 text-sm font-medium">{p.name}</span>
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                  {p.code}
                </span>
              </label>
            ))}
          </div>
          <p className="text-xs text-muted-foreground">
            {selectedIds.length === 0
              ? ar
                ? "لم يتم اختيار أي فرع"
                : "No properties selected"
              : ar
                ? `تم اختيار ${selectedIds.length} فرع`
                : `${selectedIds.length} propert${selectedIds.length > 1 ? "ies" : "y"} selected`}
          </p>
          <div className="flex gap-2 justify-end pt-1">
            <Button variant="outline" onClick={onClose}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={save}
              disabled={saving}
              className="bg-green-600 hover:bg-green-700 text-white"
            >
              {saving
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                  ? "حفظ الفروع"
                  : "Save Properties"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
