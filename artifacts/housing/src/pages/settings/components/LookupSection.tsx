import { useState } from "react";
import { AnimatedConfirmModal } from "@/components/shared/AnimatedConfirmModal";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
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
}

export function LookupSection({
  propertyId,
  category,
  label,
  description,
  parentCategory,
  parentLabel,
  showCapacity,
}: LookupSectionProps) {
  const [newValue, setNewValue] = useState("");
  const [newCapacity, setNewCapacity] = useState<number>(2);
  const [selectedParent, setSelectedParent] = useState<string>("__all__");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editValue, setEditValue] = useState("");
  const [editCapacity, setEditCapacity] = useState<number>(2);
  const [deleteDialog, setDeleteDialog] = useState<{
    open: boolean;
    id: number;
    val: string;
  }>({ open: false, id: 0, val: "" });
  const queryClient = useQueryClient();

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
      toast.success(`${label} added`);
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  };

  const handleDeleteClick = (id: number, val: string) => {
    setDeleteDialog({ open: true, id, val });
  };

  const performDelete = async () => {
    await deleteMutation.mutateAsync(deleteDialog.id);
    toast.success(`${label} deleted`);
  };

  const startEdit = (v: LookupValue) => {
    setEditingId(v.id);
    setEditValue(v.value);
    setEditCapacity(showCapacity && v.parentValue ? Number(v.parentValue) : 2);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditValue("");
  };

  const saveEdit = async (v: LookupValue) => {
    const trimmed = editValue.trim();
    if (!trimmed) return;
    try {
      const resp = await fetch(`/api/lookup-values/${v.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          value: trimmed,
          parentValue: showCapacity
            ? String(editCapacity)
            : (v.parentValue ?? null),
        }),
      });
      if (!resp.ok) throw new Error("Failed");
      await queryClient.invalidateQueries({
        queryKey: ["lookup-values", propertyId, category],
      });
      setEditingId(null);
      toast.success(`${label} updated`);
    } catch {
      toast.error("Update failed");
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
        queryKey: ["lookup-values", propertyId, category],
      });
      toast.success(currentDisabled ? `${label} enabled` : `${label} disabled`);
    } catch {
      toast.error("Update failed");
    }
  };

  return (
    <div className="space-y-4">
      <div>
        <p className="text-sm text-muted-foreground">{description}</p>
      </div>

      {parentCategory && parentValues.length > 0 && (
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground">
            {parentLabel}:
          </span>
          <Select value={selectedParent} onValueChange={setSelectedParent}>
            <SelectTrigger className="w-48">
              <SelectValue placeholder={`All ${parentLabel}s`} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All</SelectItem>
              {parentValues.map((p) => (
                <SelectItem key={p.id} value={p.value}>
                  {p.value}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      <div className="flex gap-2 items-center">
        {parentCategory && (
          <Select value={selectedParent} onValueChange={setSelectedParent}>
            <SelectTrigger className="w-44">
              <SelectValue placeholder={`Select ${parentLabel}`} />
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
          placeholder={`New ${label}...`}
          value={newValue}
          onChange={(e) => setNewValue(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleAdd()}
          className="flex-1"
        />
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
              className="w-16 text-center"
              title="Number of beds"
            />
          </div>
        )}
        <Button
          onClick={handleAdd}
          disabled={createMutation.isPending || !newValue.trim()}
        >
          <Plus className="w-4 h-4 mr-1" /> Add
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <Skeleton key={i} className="h-9 w-full" />
          ))}
        </div>
      ) : filteredValues.length === 0 ? (
        <p className="text-sm text-muted-foreground text-center py-6 border rounded-md">
          No {label.toLowerCase()}s added yet
        </p>
      ) : (
        <div className="border rounded-md divide-y">
          {filteredValues.map((v) => {
            const isDisabled = (v as any).disabled ?? false;
            const isEditing = editingId === v.id;
            return (
              <div
                key={v.id}
                className={`flex items-center justify-between px-4 py-2.5 hover:bg-muted/30 ${
                  isDisabled ? "bg-muted/20" : ""
                }`}
              >
                {isEditing ? (
                  <div className="flex items-center gap-2 flex-1">
                    <Input
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") saveEdit(v);
                        if (e.key === "Escape") cancelEdit();
                      }}
                      className="h-7 text-sm flex-1"
                      autoFocus
                    />
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 text-green-600"
                      onClick={() => saveEdit(v)}
                    >
                      <Check className="w-3.5 h-3.5" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7"
                      onClick={cancelEdit}
                    >
                      <X className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                ) : (
                  <>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-sm font-medium ${
                          isDisabled ? "line-through text-muted-foreground" : ""
                        }`}
                      >
                        {v.value}
                      </span>
                      {showCapacity && v.parentValue && (
                        <Badge variant="secondary" className="text-xs gap-1">
                          <BedDouble className="w-3 h-3" />
                          {v.parentValue} beds
                        </Badge>
                      )}
                      {isDisabled && (
                        <Badge
                          variant="secondary"
                          className="text-xs bg-amber-100 text-amber-700 border-amber-200"
                        >
                          Disabled
                        </Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-blue-500"
                        onClick={() => startEdit(v)}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className={`h-7 w-7 ${
                          isDisabled
                            ? "text-muted-foreground hover:bg-muted"
                            : "text-green-500 hover:bg-green-50"
                        }`}
                        onClick={() => toggleDisable(v)}
                      >
                        {isDisabled ? (
                          <ToggleLeft className="h-4 w-4" />
                        ) : (
                          <ToggleRight className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDeleteClick(v.id, v.value)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      <AnimatedConfirmModal
        open={deleteDialog.open}
        onOpenChange={(open) => setDeleteDialog((prev) => ({ ...prev, open }))}
        title={`Delete "${deleteDialog.val}"?`}
        description="Are you sure you want to delete this lookup value?"
        variant="destructive"
        onConfirm={performDelete}
      />
    </div>
  );
}
