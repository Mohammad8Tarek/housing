// @ts-nocheck
import { useState } from "react";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { Button } from "@/components/ui/button";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Plus,
  Trash2,
  Pencil,
  Check,
  X,
  ToggleLeft,
  ToggleRight,
  BedDouble,
  Layers,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import {
  useLookupValues,
  useCreateLookupValue,
  useDeleteLookupValue,
  type LookupValue,
} from "@/hooks/use-lookup-values";

interface LookupSectionProps {
  propertyId: number;
  category: string;
  label: string;
  description: string;
  parentCategory?: string;
  parentLabel?: string;
  showCapacity?: boolean;
  extraLabel?: string;
}

export function LookupSection({
  propertyId,
  category,
  label,
  description,
  parentCategory,
  parentLabel,
  showCapacity,
  extraLabel,
}: LookupSectionProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [newValue, setNewValue] = useState("");
  const [newCapacity, setNewCapacity] = useState<number>(2);
  const [newExtraValue, setNewExtraValue] = useState("");
  const [selectedParent, setSelectedParent] = useState<string>("__all__");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editParentValue, setEditParentValue] = useState<string>("");
  const [editExtraValue, setEditExtraValue] = useState("");
  const [editCapacity, setEditCapacity] = useState<number>(2);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: number;
    val: string;
  }>({ open: false, id: 0, val: "" });
  const queryClient = useQueryClient();

  // Arabic vs English translations for core entities
  const getEntityLabel = () => {
    if (!ar) return label;
    if (category === "job_title") return "المسمى الوظيفي";
    if (category === "department") return "القسم";
    if (category === "room_type") return "نوع الغرفة";
    if (category === "nationality") return "الجنسية";
    return label;
  };

  const getParentEntityLabel = () => {
    if (!ar) return parentLabel || "Department";
    if (parentCategory === "department") return "القسم";
    return parentLabel || "القسم";
  };

  const getExtraEntityLabel = () => {
    if (!ar) return extraLabel || "Level";
    if (extraLabel?.toLowerCase().includes("level")) return "الدرجة";
    return extraLabel || "الدرجة";
  };

  const currentLabel = getEntityLabel();
  const currentParentLabel = getParentEntityLabel();
  const currentExtraLabel = getExtraEntityLabel();

  const { data: values = [], isLoading } = useLookupValues(
    propertyId,
    category,
    true,
  );
  const { data: parentValues = [] } = useLookupValues(
    parentCategory ? propertyId : undefined,
    parentCategory,
    true,
  );
  const createMutation = useCreateLookupValue(propertyId);
  const deleteMutation = useDeleteLookupValue(propertyId, category);

  const filteredValues =
    selectedParent && selectedParent !== "__all__"
      ? values.filter((v) => v.parentValue === selectedParent)
      : values;

  const handleAdd = async () => {
    const trimmed = newValue.trim();
    if (!trimmed) return;
    try {
      await createMutation.mutateAsync({
        category,
        value: trimmed,
        extraValue: extraLabel ? (newExtraValue.trim() || undefined) : undefined,
        parentValue: showCapacity
          ? String(newCapacity)
          : parentCategory
            ? selectedParent !== "__all__"
              ? selectedParent
              : undefined
            : undefined,
      });
      setNewValue("");
      if (showCapacity) setNewCapacity(2);
      if (extraLabel) setNewExtraValue("");
      toast.success(ar ? `تمت إضافة ${currentLabel} بنجاح` : `${label} added successfully`);
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشلت الإضافة" : "Error adding item"));
    }
  };

  const handleDeleteClick = (id: number, val: string) => {
    setDeleteDialog({ open: true, id, val });
  };

  const performDelete = async () => {
    await deleteMutation.mutateAsync(deleteDialog.id);
    toast.success(ar ? `تم حذف ${currentLabel}` : `${label} deleted`);
  };

  const startEdit = (v: LookupValue) => {
    setEditingId(v.id);
    setEditValue(v.value);
    setEditParentValue(v.parentValue || "");
    setEditExtraValue(v.extraValue || "");
    setEditCapacity(showCapacity && v.parentValue ? Number(v.parentValue) : 2);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
    setEditParentValue("");
    setEditExtraValue("");
  };

  const saveEdit = async (v: LookupValue) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    try {
      const payload: any = {
        value: trimmed,
        parentValue: showCapacity
          ? String(editCapacity)
          : (parentCategory ? (editParentValue || null) : (v.parentValue ?? null)),
      };
      if (extraLabel) {
        payload.extraValue = editExtraValue.trim() || null;
      }
      const resp = await fetch(`/api/lookup-values/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || (ar ? "فشل التحديث" : "Failed to update"));
      }
      await queryClient.invalidateQueries({
        queryKey: ["lookup-values", propertyId],
      });
      await queryClient.invalidateQueries({
        queryKey: ["/api/lookup-values"],
      });
      setEditingId(null);
      toast.success(ar ? `تم تحديث ${currentLabel} بنجاح` : `${label} updated successfully`);
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل التحديث" : "Update failed"));
    }
  };

  const toggleDisable = async (v: LookupValue) => {
    const currentDisabled = (v as any).disabled ?? false;
    try {
      const resp = await fetch(`/api/lookup-values/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ disabled: !currentDisabled }),
      });
      if (!resp.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({
        queryKey: ["lookup-values", propertyId],
      });
      toast.success(
        currentDisabled
          ? (ar ? `تم تفعيل ${currentLabel}` : `${label} enabled`)
          : (ar ? `تم تعطيل ${currentLabel}` : `${label} disabled`)
      );
    } catch {
      toast.error(ar ? "فشل التحديث" : "Update failed");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {/* Filter by Department / Parent */}
      {parentCategory && parentValues.length > 0 && (
        <div className="flex items-center gap-2 p-2 bg-muted/40 rounded-lg border border-border/50">
          <span className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            {ar ? `فلترة حسب ${currentParentLabel}:` : `Filter by ${currentParentLabel}:`}
          </span>
          <Select value={selectedParent} onValueChange={setSelectedParent}>
            <SelectTrigger className="w-56 h-8 text-xs bg-background">
              <SelectValue placeholder={ar ? `كل ${currentParentLabel}s` : `All ${currentParentLabel}s`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">{ar ? "الكل" : "All"}</SelectItem>
              {parentValues.map((p) => (
                <SelectItem key={p.id} value={p.value}>
                  {p.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Add New Row */}
      <PermissionGate module="settings" action="create">
        <div className="flex flex-wrap gap-2 items-center p-3 rounded-xl bg-card border shadow-sm">
          {parentCategory && (
            <Select value={selectedParent} onValueChange={setSelectedParent}>
              <SelectTrigger className="w-44 h-9 text-xs">
                <SelectValue placeholder={ar ? `اختر ${currentParentLabel}...` : `Select ${currentParentLabel}...`} />
              </SelectTrigger>
              <SelectContent>
                {parentValues.map((p) => (
                  <SelectItem key={p.id} value={p.value}>
                    {p.value}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          <Input
            placeholder={ar ? `اسم ${currentLabel} الجديد...` : `New ${label}...`}
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleAdd()}
            className="flex-1 min-w-[200px] h-9 text-sm"
          />
          {extraLabel && (
            <Input
              placeholder={ar ? `${currentExtraLabel} (مثال: Level 1)...` : `${currentExtraLabel} (e.g. Level 1)...`}
              value={newExtraValue}
              onChange={(e) => setNewExtraValue(e.target.value)}
              className="w-44 h-9 text-sm font-medium"
            />
          )}
          {showCapacity && (
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <BedDouble className="w-4 h-4 text-muted-foreground" />
              <Input
                type="number"
                min={1}
                max={20}
                value={newCapacity}
                onChange={(e) =>
                  setNewCapacity(Math.max(1, Number(e.target.value)))
                }
                className="w-20 h-9 text-center text-sm"
                title={ar ? "عدد الأسرة" : "Number of beds"}
              />
            </div>
          )}
          <Button
            onClick={handleAdd}
            disabled={createMutation.isPending || !newValue.trim()}
            className="h-9 gap-1.5 px-4 font-semibold text-xs"
          >
            <Plus className="w-4 h-4" /> {ar ? "إضافة" : "Add"}
          </Button>
        </div>
      </PermissionGate>

      {/* Data Table */}
      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      ) : filteredValues.length === 0 ? (
        <div className="text-center py-10 border rounded-xl bg-card text-muted-foreground">
          <p className="text-sm font-medium">
            {ar ? `لم يتم إضافة أي ${currentLabel} بعد` : `No ${label.toLowerCase()}s added yet`}
          </p>
        </div>
      ) : (
        <div className="rounded-xl border bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader className="bg-muted/60">
              <TableRow>
                <TableHead className="font-bold text-xs uppercase tracking-wider">{currentLabel}</TableHead>
                {parentCategory && (
                  <TableHead className="font-bold text-xs uppercase tracking-wider">{currentParentLabel}</TableHead>
                )}
                {extraLabel && (
                  <TableHead className="font-bold text-xs uppercase tracking-wider text-primary font-bold">
                    {currentExtraLabel}
                  </TableHead>
                )}
                {showCapacity && (
                  <TableHead className="font-bold text-xs uppercase tracking-wider">
                    {ar ? "السعة (أسرة)" : "Capacity (Beds)"}
                  </TableHead>
                )}
                <TableHead className="font-bold text-xs uppercase tracking-wider w-28 text-center">
                  {ar ? "الحالة" : "Status"}
                </TableHead>
                <TableHead className="font-bold text-xs uppercase tracking-wider w-32 text-end">
                  {ar ? "الإجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredValues.map((v) => {
                const isDisabled = (v as any).disabled ?? false;
                const isEditing = editingId === v.id;
                return (
                  <TableRow
                    key={v.id}
                    className={`hover:bg-muted/40 transition-colors ${
                      isDisabled ? "bg-muted/20 opacity-70" : ""
                    }`}
                  >
                    {isEditing ? (
                      <>
                        <TableCell>
                          <Input
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit(v);
                              if (e.key === "Escape") cancelEdit();
                            }}
                            className="h-8 text-sm"
                            autoFocus
                            placeholder={ar ? "المسمى..." : "Name..."}
                          />
                        </TableCell>
                        {parentCategory && (
                          <TableCell>
                            <Select
                              value={editParentValue}
                              onValueChange={setEditParentValue}
                            >
                              <SelectTrigger className="h-8 text-xs w-full min-w-[140px]">
                                <SelectValue placeholder={ar ? "اختر القسم..." : "Select Department..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {parentValues.map((p) => (
                                  <SelectItem key={p.id} value={p.value}>
                                    {p.value}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                        )}
                        {extraLabel && (
                          <TableCell>
                            <Input
                              value={editExtraValue}
                              onChange={(e) => setEditExtraValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") saveEdit(v);
                                if (e.key === "Escape") cancelEdit();
                              }}
                              className="h-8 text-sm font-semibold text-primary w-36"
                              placeholder={ar ? "مثال: Level 1" : "e.g. Level 1"}
                            />
                          </TableCell>
                        )}
                        {showCapacity && (
                          <TableCell>
                            <Input
                              type="number"
                              min={1}
                              max={20}
                              value={editCapacity}
                              onChange={(e) =>
                                setEditCapacity(Math.max(1, Number(e.target.value)))
                              }
                              className="h-8 w-20 text-center text-sm"
                            />
                          </TableCell>
                        )}
                        <TableCell className="text-center">
                          <Badge variant="outline" className="text-xs">
                            {ar ? "تعديل..." : "Editing..."}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              size="sm"
                              variant="default"
                              className="h-8 px-2.5 bg-green-600 hover:bg-green-700 text-white gap-1 text-xs"
                              onClick={() => saveEdit(v)}
                            >
                              <Check className="w-3.5 h-3.5" /> {ar ? "حفظ" : "Save"}
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-muted-foreground"
                              onClick={cancelEdit}
                            >
                              <X className="w-4 h-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </>
                    ) : (
                      <>
                        <TableCell className="font-semibold text-sm">
                          <span className={isDisabled ? "line-through text-muted-foreground" : ""}>
                            {v.value}
                          </span>
                        </TableCell>

                        {parentCategory && (
                          <TableCell>
                            {v.parentValue ? (
                              <Badge variant="secondary" className="text-xs font-medium">
                                {v.parentValue}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs italic">—</span>
                            )}
                          </TableCell>
                        )}

                        {extraLabel && (
                          <TableCell>
                            {v.extraValue ? (
                              <Badge
                                variant="outline"
                                className="bg-primary/10 text-primary border-primary/25 font-bold px-2.5 py-0.5 text-xs shadow-xs"
                              >
                                {v.extraValue}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground/60 text-xs italic font-normal">
                                {ar ? "غير محدد" : "Not set"}
                              </span>
                            )}
                          </TableCell>
                        )}

                        {showCapacity && (
                          <TableCell>
                            {v.parentValue ? (
                              <Badge variant="secondary" className="text-xs gap-1">
                                <BedDouble className="w-3.5 h-3.5" />
                                {v.parentValue} {ar ? "أسرة" : "beds"}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground text-xs">—</span>
                            )}
                          </TableCell>
                        )}

                        <TableCell className="text-center">
                          {isDisabled ? (
                            <Badge
                              variant="secondary"
                              className="text-xs bg-amber-100 text-amber-800 border-amber-200"
                            >
                              {ar ? "معطل" : "Disabled"}
                            </Badge>
                          ) : (
                            <Badge
                              variant="outline"
                              className="text-xs bg-emerald-50 text-emerald-700 border-emerald-200"
                            >
                              {ar ? "مفعل" : "Active"}
                            </Badge>
                          )}
                        </TableCell>

                        <TableCell className="text-end">
                          <div className="flex items-center justify-end gap-1">
                            <PermissionGate module="settings" action="edit">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-blue-600 hover:bg-blue-50"
                                onClick={() => startEdit(v)}
                                title={ar ? "تعديل" : "Edit"}
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className={`h-8 w-8 ${
                                  isDisabled
                                    ? "text-muted-foreground hover:bg-muted"
                                    : "text-green-600 hover:bg-green-50"
                                }`}
                                onClick={() => toggleDisable(v)}
                                title={isDisabled ? (ar ? "تفعيل" : "Enable") : (ar ? "تعطيل" : "Disable")}
                              >
                                {isDisabled ? (
                                  <ToggleLeft className="w-4 h-4" />
                                ) : (
                                  <ToggleRight className="w-4 h-4" />
                                )}
                              </Button>
                            </PermissionGate>
                            <PermissionGate module="settings" action="delete">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                                onClick={() => handleDeleteClick(v.id, v.value)}
                                title={ar ? "حذف" : "Delete"}
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </PermissionGate>
                          </div>
                        </TableCell>
                      </>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <AnimatedConfirmModal
        open={deleteDialog.open}
        onOpenChange={(o) => setDeleteDialog((d) => ({ ...d, open: o }))}
        onConfirm={performDelete}
        title={ar ? `حذف ${currentLabel}` : `Delete ${label}`}
        description={
          ar
            ? `هل أنت متأكد من حذف "${deleteDialog.val}"؟ هذا الإجراء لا يمكن التراجع عنه.`
            : `Are you sure you want to delete "${deleteDialog.val}"? This action cannot be undone.`
        }
        variant="destructive"
        confirmText={ar ? "حذف" : "Delete"}
        cancelText={ar ? "إلغاء" : "Cancel"}
      />
    </div>
  );
}
