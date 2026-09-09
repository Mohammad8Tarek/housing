import { History, Check, Sparkles, AlertTriangle, Palmtree, Plus, X, Pencil, FileText, Tag, PackageCheck, Trash2, Wrench, RefreshCw } from "lucide-react";
import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { getListRoomsQueryKey } from "@workspace/api-client-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/date-utils";
import { roomStatusBadge, getRoomStatusLabel, statusNorm } from "../utils";

type Props = {
  room: any | null;
  onClose: () => void;
  onOpenRoomLog: (room: any) => void;
  buildings: any[];
  floors: any[];
  assignments: any[];
  profiles: any[];
};

export function RoomDetailsDialog({
  room,
  onClose,
  onOpenRoomLog,
  buildings,
  floors,
  assignments,
  profiles,
}: Props) {
  const { language } = useLanguage();
  const { activePropertyId: propertyId } = useProperty();
  const qc = useQueryClient();
  const ar = language === "ar";

  const [featuresEditMode, setFeaturesEditMode] = useState(false);
  const [featuresInput, setFeaturesInput] = useState("");
  const [localFeatures, setLocalFeatures] = useState<string[] | null>(null);
  const [savingFeatures, setSavingFeatures] = useState(false);

  if (!room) return null;

  const currentFeaturesList: string[] =
    localFeatures ??
    (Array.isArray(room.featuresList) && room.featuresList.length > 0
      ? room.featuresList
      : room.features
      ? String(room.features)
          .split(/[,;\n]+/)
          .map((s: string) => s.trim())
          .filter(Boolean)
      : []);

  const addFeatureInline = (feat: string) => {
    const trimmed = feat.trim();
    if (!trimmed) return;
    if (currentFeaturesList.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return;
    setLocalFeatures([...currentFeaturesList, trimmed]);
    setFeaturesInput("");
  };

  const removeFeatureInline = (feat: string) => {
    setLocalFeatures(currentFeaturesList.filter((f) => f !== feat));
  };

  const saveFeatures = async () => {
    setSavingFeatures(true);
    try {
      const res = await fetch(`/api/rooms/${room.id}/features`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          featuresList: currentFeaturesList,
          features: currentFeaturesList.join(", "),
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم حفظ مميزات الغرفة بنجاح" : "Room features saved");
      qc.invalidateQueries({ queryKey: getListRoomsQueryKey() });
      qc.invalidateQueries({ queryKey: ["room-inventory"] });
      refetchInventory();
      setFeaturesEditMode(false);
      setLocalFeatures(null);
    } catch {
      toast.error(ar ? "فشل حفظ المميزات" : "Failed to save features");
    } finally {
      setSavingFeatures(false);
    }
  };

  // Room Equipment Inventory State
  const [showAddInventory, setShowAddInventory] = useState(false);
  const [newItemName, setNewItemName] = useState("");
  const [newItemCategory, setNewItemCategory] = useState("electronics");
  const [newItemQuantity, setNewItemQuantity] = useState(1);
  const [newItemCondition, setNewItemCondition] = useState("good");
  const [newItemSerial, setNewItemSerial] = useState("");
  const [newItemBarcode, setNewItemBarcode] = useState("");
  const [isSubmittingItem, setIsSubmittingItem] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const { data: inventoryData, refetch: refetchInventory } = useQuery({
    queryKey: ["room-inventory-single", room?.id, propertyId],
    queryFn: async () => {
      if (!room?.id || !propertyId) return [];
      const res = await fetch(`/api/room-inventory/room/${room.id}?propertyId=${propertyId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.data || [];
    },
    enabled: !!room?.id && !!propertyId,
  });
  const roomInventory: any[] = inventoryData || [];

  const handleSyncFromFeatures = async () => {
    setIsSyncing(true);
    try {
      const res = await fetch("/api/room-inventory/sync-from-features", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ roomId: room.id, propertyId }),
      });
      if (!res.ok) throw new Error();
      const json = await res.json();
      toast.success(
        ar
          ? `تم استيراد ${json.data?.createdCount || 0} صنف جديد من تجهيزات الغرفة`
          : `Synced ${json.data?.createdCount || 0} items from room features`
      );
      refetchInventory();
      qc.invalidateQueries({ queryKey: ["room-inventory"] });
    } catch {
      toast.error(ar ? "فشل استيراد المحتويات" : "Failed to sync inventory");
    } finally {
      setIsSyncing(false);
    }
  };

  const handleAddItem = async () => {
    if (!newItemName.trim()) {
      toast.error(ar ? "اسم المعدة مطلوب" : "Item name is required");
      return;
    }
    setIsSubmittingItem(true);
    try {
      const res = await fetch("/api/room-inventory", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          roomId: room.id,
          propertyId,
          itemName: newItemName.trim(),
          category: newItemCategory,
          quantity: Number(newItemQuantity) || 1,
          condition: newItemCondition,
          serialNumber: newItemSerial.trim() || undefined,
          barcode: newItemBarcode.trim() || undefined,
        }),
      });
      if (!res.ok) throw new Error();
      toast.success(ar ? "تمت إضافة العهدة/المعدة بنجاح" : "Equipment item added");
      setNewItemName("");
      setNewItemSerial("");
      setNewItemBarcode("");
      setNewItemQuantity(1);
      setShowAddInventory(false);
      refetchInventory();
      qc.invalidateQueries({ queryKey: ["room-inventory"] });
    } catch {
      toast.error(ar ? "فشل إضافة العهدة" : "Failed to add item");
    } finally {
      setIsSubmittingItem(false);
    }
  };

  const handleUpdateCondition = async (itemId: number, newCond: string) => {
    try {
      const res = await fetch(`/api/room-inventory/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ condition: newCond, propertyId }),
      });
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم تحديث حالة المعدة" : "Item condition updated");
      refetchInventory();
      qc.invalidateQueries({ queryKey: ["room-inventory"] });
    } catch {
      toast.error(ar ? "فشل تحديث الحالة" : "Failed to update condition");
    }
  };

  const handleUpdateCategory = async (itemId: number, newCat: string) => {
    try {
      const res = await fetch(`/api/room-inventory/${itemId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ category: newCat, propertyId }),
      });
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم تحديث تصنيف المعدة" : "Item category updated");
      refetchInventory();
      qc.invalidateQueries({ queryKey: ["room-inventory"] });
    } catch {
      toast.error(ar ? "فشل تحديث التصنيف" : "Failed to update category");
    }
  };

  const handleDeleteInventory = async (itemId: number) => {
    try {
      const res = await fetch(`/api/room-inventory/${itemId}?propertyId=${propertyId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم حذف الصنف من الجرد" : "Item removed from inventory");
      refetchInventory();
      qc.invalidateQueries({ queryKey: ["room-inventory"] });
    } catch {
      toast.error(ar ? "فشل الحذف" : "Failed to delete item");
    }
  };

  const handleCreateTicket = async (itemId: number) => {
    try {
      const res = await fetch(`/api/room-inventory/${itemId}/create-ticket`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId }),
      });
      if (!res.ok) throw new Error();
      toast.success(ar ? "تم إنشاء طلب صيانة عاجل بنجاح!" : "Maintenance ticket created!");
      refetchInventory();
      qc.invalidateQueries({ queryKey: ["room-inventory"] });
      qc.invalidateQueries({ queryKey: ["maintenance"] });
    } catch {
      toast.error(ar ? "فشل إنشاء طلب الصيانة" : "Failed to create ticket");
    }
  };

  const empMap = Object.fromEntries((profiles ?? []).map((e) => [e.id, e]));

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-xl max-h-[90vh] overflow-y-auto"
        srTitle={`${ar ? "الغرفة" : "Room"} ${room.roomNumber}`}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>
              {ar ? "الغرفة" : "Room"} {room.roomNumber}
            </span>
            <Button
              variant="ghost"
              size="sm"
              className="text-xs"
              onClick={() => {
                onOpenRoomLog(room);
                onClose();
              }}
            >
              <History className="w-3.5 h-3.5 mr-1" />
              {ar ? "سجل الغرفة" : "Room Log"}
            </Button>
          </DialogTitle>
        </DialogHeader>
        
        {/* Housekeeping & Room Status Workflow Bar */}
        <div className="p-3.5 rounded-xl border bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mt-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-muted-foreground">{ar ? "تغيير الحالة السريعة:" : "Quick Status:"}</span>
            <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${roomStatusBadge(room.status || "")}`}>
              {getRoomStatusLabel(room.status || "", ar)}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* 🔒 Status editing is restricted to the Housekeeping page */}
          </div>
        </div>
        {statusNorm(room.status) === "occupied_vacation" && (
          <div className="p-3 rounded-xl border border-amber-300 bg-amber-50/90 dark:bg-amber-950/40 text-amber-900 dark:text-amber-200 flex items-center gap-2.5 text-xs font-semibold mt-2">
            <Palmtree className="w-5 h-5 text-amber-600 flex-shrink-0" />
            <div className="flex-1">
              <p className="font-bold text-sm text-amber-950 dark:text-amber-100">
                {ar ? "نزيل هذه الغرفة في إجازة حالياً" : "Occupant is currently on vacation"}
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300 mt-0.5">
                {ar ? "السرير محجوز له لحين عودته من الإجازة." : "Bed is reserved until their return."}
              </p>
            </div>
          </div>
        )}
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[
            {
              label: ar ? "حالة الغرفة" : "Room Status",
              value: (
                <span
                  className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roomStatusBadge(room.status || "")}`}
                >
                  {getRoomStatusLabel(room.status || "", ar)}
                </span>
              ),
            },
            {
              label: ar ? "التصنيف / النوع" : "Classification / Type",
              value: room.classification
                ? `${room.classification} (${room.roomType})`
                : room.roomType || "—",
            },
            {
              label: ar ? "السعة القصوى" : "Max Capacity",
              value: `${room.capacity} ${ar ? "أسرة" : "beds"}`,
            },
            {
              label: ar ? "الإشغال الحالي" : "Occupancy",
              value: (
                <span className={`font-bold ${(room.currentOccupancy ?? 0) >= room.capacity ? "text-red-600" : "text-emerald-600"}`}>
                  {room.currentOccupancy ?? 0} / {room.capacity}
                </span>
              ),
            },
            {
              label: ar ? "المبنى" : "Building",
              value:
                buildings.find((b) => b.id === room.buildingId)?.name ||
                `Bldg ${room.buildingId}`,
            },
            {
              label: ar ? "الطابق" : "Floor",
              value: (() => {
                const f = floors.find((fl) => fl.id === room.floorId);
                return f ? `${ar ? "الطابق" : "Floor"} ${f.floorNumber}` : "—";
              })(),
            },
            {
              label: ar ? "نوع السرير" : "Bed Type",
              value: room.bedType || "—",
            },
            {
              label: ar ? "الإطلالة" : "View",
              value: room.view || "—",
            },
            {
              label: ar ? "المساحة" : "Room Size",
              value: room.size
                ? room.size
                : room.sizeSqm
                ? `${room.sizeSqm} m²`
                : "—",
            },
            {
              label: ar ? "باب فاصل" : "Separator Door",
              value: room.separatorDoor != null
                ? room.separatorDoor
                  ? ar ? "نعم يوجد" : "Yes"
                  : ar ? "لا يوجد" : "No"
                : "—",
            },
            ...(room.gender ? [{
              label: ar ? "تخصيص الجنس" : "Gender Policy",
              value: room.gender === "M" ? (ar ? "ذكور" : "Male") : room.gender === "F" ? (ar ? "إناث" : "Female") : room.gender,
            }] : []),
          ].map((row, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
              <div className="font-medium text-sm">{row.value}</div>
            </div>
          ))}
        </div>
        {/* Notes */}
        {room.notes && (
          <div className="p-3 rounded-lg bg-amber-50/60 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 mt-2">
            <p className="text-xs text-amber-700 dark:text-amber-400 font-semibold mb-1 flex items-center gap-1.5">
              <FileText className="w-3.5 h-3.5 text-amber-600" /> {ar ? "ملاحظات:" : "Notes:"}
            </p>
            <p className="text-sm text-amber-900 dark:text-amber-200">{room.notes}</p>
          </div>
        )}
        {/* ── Room Features (always show, editable) ── */}
        <div className="p-3 rounded-lg bg-muted/30 mt-2 space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-xs text-muted-foreground font-bold flex items-center gap-1.5">
              <Tag className="w-3.5 h-3.5 text-muted-foreground" /> {ar ? "تجهيزات ومميزات الغرفة:" : "Room Features & Amenities:"}
            </p>
            {!featuresEditMode ? (
              <Button
                variant="ghost"
                size="sm"
                className="h-6 px-2 text-xs gap-1"
                onClick={() => setFeaturesEditMode(true)}
              >
                <Pencil className="w-3 h-3" />
                {ar ? "تعديل" : "Edit"}
              </Button>
            ) : (
              <div className="flex gap-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => {
                    setFeaturesEditMode(false);
                    setLocalFeatures(null);
                  }}
                >
                  {ar ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={saveFeatures}
                  disabled={savingFeatures}
                >
                  {savingFeatures ? "..." : ar ? "حفظ" : "Save"}
                </Button>
              </div>
            )}
          </div>

          {/* Tags */}
          <div className="flex flex-wrap gap-1.5 min-h-[28px]">
            {currentFeaturesList.length === 0 && !featuresEditMode && (
              <span className="text-xs text-muted-foreground italic">
                {ar ? "لا توجد مميزات مضافة" : "No features added"}
              </span>
            )}
            {currentFeaturesList.map((feat, fIdx) => (
              featuresEditMode ? (
                <Badge key={fIdx} variant="secondary" className="gap-1 text-xs pr-1">
                  {String(feat).trim()}
                  <button
                    type="button"
                    onClick={() => removeFeatureInline(feat)}
                    className="ml-0.5 hover:text-destructive"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </Badge>
              ) : (
                <span
                  key={fIdx}
                  className="px-2 py-0.5 rounded-md text-[11px] font-semibold bg-primary/10 text-primary border border-primary/20 flex items-center gap-1"
                >
                  <Sparkles className="w-3 h-3 text-primary/70" />
                  {String(feat).trim()}
                </span>
              )
            ))}
          </div>

          {/* Inline add input when editing */}
          {featuresEditMode && (
            <div className="flex gap-2">
              <Input
                placeholder={ar ? "أضف ميزة..." : "Add feature..."}
                value={featuresInput}
                onChange={(e) => setFeaturesInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    addFeatureInline(featuresInput);
                  }
                }}
                className="h-7 text-xs"
              />
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => addFeatureInline(featuresInput)}
                className="h-7 w-7 p-0 shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
              </Button>
            </div>
          )}
        </div>

        {/* ── Room Equipment Inventory (جرد العهد والمعدات) ── */}
        <div className="p-3.5 rounded-lg bg-card border shadow-xs mt-2 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <PackageCheck className="w-4 h-4 text-cyan-600" />
              <p className="text-xs font-bold text-foreground">
                {ar ? "جرد محتويات ومعدات الغرفة:" : "Room Equipment & Inventory:"}
              </p>
              <Badge variant="secondary" className="text-[10px] h-5 px-1.5 font-bold">
                {roomInventory.length}
              </Badge>
            </div>
            <div className="flex items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="h-6 px-2 text-[11px] gap-1 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800"
                onClick={handleSyncFromFeatures}
                disabled={isSyncing}
                title={ar ? "توليد تلقائي من مميزات الغرفة" : "Sync from room features"}
              >
                <RefreshCw className={`w-3 h-3 ${isSyncing ? "animate-spin" : ""}`} />
                {ar ? "توليد تلقائي" : "Sync"}
              </Button>
              <Button
                variant={showAddInventory ? "secondary" : "default"}
                size="sm"
                className="h-6 px-2 text-[11px] gap-1"
                onClick={() => setShowAddInventory(!showAddInventory)}
              >
                <Plus className="w-3 h-3" />
                {ar ? "إضافة عهدة" : "Add Asset"}
              </Button>
            </div>
          </div>

          {/* Add Item Form */}
          {showAddInventory && (
            <div className="p-3 rounded-md bg-muted/40 border border-dashed space-y-2">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    {ar ? "اسم المعدة *" : "Item Name *"}
                  </label>
                  <Input
                    placeholder={ar ? "مثال: تلفزيون 43 بوصة" : "e.g. Smart TV 43\""}
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    className="h-7 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    {ar ? "التصنيف" : "Category"}
                  </label>
                  <Select value={newItemCategory} onValueChange={setNewItemCategory}>
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="appliances">{ar ? "أجهزة كهربائية وتكييف (Electric)" : "Electric & Appliances"}</SelectItem>
                      <SelectItem value="electronics">{ar ? "إلكترونيات وشاشات (Electronics)" : "Electronics"}</SelectItem>
                      <SelectItem value="furniture">{ar ? "أثاث وغرف نوم (Furniture)" : "Furniture"}</SelectItem>
                      <SelectItem value="fixtures">{ar ? "مرافق وخزائن (Fixtures)" : "Fixtures"}</SelectItem>
                      <SelectItem value="linen">{ar ? "مفروشات وبياضات (Linen)" : "Linen"}</SelectItem>
                      <SelectItem value="other">{ar ? "أخرى (Other)" : "Other"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    {ar ? "العدد" : "Quantity"}
                  </label>
                  <Input
                    type="number"
                    min={1}
                    value={newItemQuantity}
                    onChange={(e) => setNewItemQuantity(Math.max(1, parseInt(e.target.value, 10) || 1))}
                    className="h-7 text-xs bg-background"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    {ar ? "الحالة" : "Condition"}
                  </label>
                  <Select value={newItemCondition} onValueChange={setNewItemCondition}>
                    <SelectTrigger className="h-7 text-xs bg-background">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="good">{ar ? "سليم / ممتاز" : "Good"}</SelectItem>
                      <SelectItem value="fair">{ar ? "مقبول / يعمل" : "Fair"}</SelectItem>
                      <SelectItem value="needs_repair">{ar ? "بحاجة لصيانة" : "Needs Repair"}</SelectItem>
                      <SelectItem value="damaged">{ar ? "تالف / معطل" : "Damaged"}</SelectItem>
                      <SelectItem value="missing">{ar ? "مفقود" : "Missing"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <label className="text-[10px] font-semibold text-muted-foreground block mb-0.5">
                    {ar ? "سيريال / كود" : "Serial / Tag"}
                  </label>
                  <Input
                    placeholder="S/N: 92831"
                    value={newItemSerial}
                    onChange={(e) => setNewItemSerial(e.target.value)}
                    className="h-7 text-xs bg-background"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 px-2 text-xs"
                  onClick={() => setShowAddInventory(false)}
                >
                  {ar ? "إلغاء" : "Cancel"}
                </Button>
                <Button
                  size="sm"
                  className="h-6 px-2.5 text-xs font-semibold"
                  onClick={handleAddItem}
                  disabled={isSubmittingItem}
                >
                  {isSubmittingItem ? "..." : ar ? "حفظ العهدة" : "Save Item"}
                </Button>
              </div>
            </div>
          )}

          {/* Inventory Items List */}
          {roomInventory.length === 0 ? (
            <div className="p-3 text-center rounded-md bg-muted/20 border text-xs text-muted-foreground">
              {ar
                ? "لا توجد عهد أو معدات مسجلة لهذه الغرفة بعد. اضغط 'توليد تلقائي' للاستيراد من تجهيزات الغرفة."
                : "No equipment registered for this room yet. Click 'Sync' to import from room features."}
            </div>
          ) : (
            <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
              {roomInventory.map((item: any) => (
                <div
                  key={item.id}
                  className="flex items-center justify-between p-2 rounded-lg bg-muted/30 border text-xs hover:bg-muted/50 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-foreground truncate">{item.itemName}</span>
                      {item.quantity > 1 && (
                        <Badge variant="secondary" className="text-[10px] h-4 px-1">
                          x{item.quantity}
                        </Badge>
                      )}
                      <Select
                        value={item.category || "other"}
                        onValueChange={(val) => handleUpdateCategory(item.id, val)}
                      >
                        <SelectTrigger className="h-5 text-[10px] px-1.5 bg-background/50 border border-muted-foreground/30 text-muted-foreground hover:text-foreground rounded">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="appliances">{ar ? "كهربائية (Electric)" : "Electric"}</SelectItem>
                          <SelectItem value="electronics">{ar ? "إلكترونيات (Electronics)" : "Electronics"}</SelectItem>
                          <SelectItem value="furniture">{ar ? "أثاث (Furniture)" : "Furniture"}</SelectItem>
                          <SelectItem value="fixtures">{ar ? "مرافق (Fixtures)" : "Fixtures"}</SelectItem>
                          <SelectItem value="linen">{ar ? "مفروشات (Linen)" : "Linen"}</SelectItem>
                          <SelectItem value="other">{ar ? "أخرى (Other)" : "Other"}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    {(item.serialNumber || item.barcode) && (
                      <div className="text-[10px] text-muted-foreground font-mono mt-0.5">
                        {item.serialNumber ? `S/N: ${item.serialNumber}` : ""}
                        {item.serialNumber && item.barcode ? " | " : ""}
                        {item.barcode ? `Tag: ${item.barcode}` : ""}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-1.5 shrink-0 ml-2 rtl:mr-2 rtl:ml-0">
                    <Select
                      value={item.condition || "good"}
                      onValueChange={(val) => handleUpdateCondition(item.id, val)}
                    >
                      <SelectTrigger
                        className={`h-6 text-[10px] px-1.5 font-bold ${
                          item.condition === "good"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                            : item.condition === "fair"
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : item.condition === "needs_repair"
                            ? "bg-amber-50 text-amber-700 border-amber-300"
                            : "bg-rose-50 text-rose-700 border-rose-300"
                        }`}
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="good">{ar ? "سليم" : "Good"}</SelectItem>
                        <SelectItem value="fair">{ar ? "مقبول" : "Fair"}</SelectItem>
                        <SelectItem value="needs_repair">{ar ? "يحتاج صيانة" : "Needs Repair"}</SelectItem>
                        <SelectItem value="damaged">{ar ? "تالف" : "Damaged"}</SelectItem>
                        <SelectItem value="missing">{ar ? "مفقود" : "Missing"}</SelectItem>
                      </SelectContent>
                    </Select>

                    {(item.condition === "needs_repair" || item.condition === "damaged") && (
                      <Button
                        size="sm"
                        variant="outline"
                        className="h-6 px-1.5 text-[10px] gap-1 text-rose-600 border-rose-200 hover:bg-rose-50"
                        onClick={() => handleCreateTicket(item.id)}
                        title={ar ? "إنشاء تذكرة صيانة" : "Create maintenance ticket"}
                      >
                        <Wrench className="w-2.5 h-2.5" />
                        {ar ? "صيانة" : "Fix"}
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteInventory(item.id)}
                      title={ar ? "حذف" : "Delete"}
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {(() => {
          const roomAssignments = (assignments ?? []).filter(
            (a) => a.roomId === room.id && a.status === "ACTIVE",
          );
          if (!roomAssignments.length) return null;
          return (
            <div className="mt-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2">
                {ar ? "المقيمون الحاليون" : "Current Occupants"}
              </p>
              <div className="space-y-2">
                {roomAssignments.map((a) => {
                  const emp = empMap[a.profileId];
                  const initials =
                    `${emp?.firstName?.[0] ?? ""}${emp?.lastName?.[0] ?? ""}`.toUpperCase();
                  return (
                    <div
                      key={a.id}
                      className="flex items-center gap-2 p-2.5 rounded-lg bg-muted/20 border"
                    >
                      {(emp as any)?.photoUrl ? (
                        <img
                          src={(emp as any).photoUrl}
                          alt={initials}
                          className="w-8 h-8 rounded-full object-cover border flex-shrink-0"
                        />
                      ) : (
                        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <span className="text-xs font-bold text-primary">
                            {initials}
                          </span>
                        </div>
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">
                          {emp
                            ? `${emp.firstName} ${emp.lastName}`
                            : `#${a.profileId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {emp?.department ?? ""}{" "}
                          {a.bedNumber
                            ? `• ${ar ? "سرير" : "Bed"} ${a.bedNumber}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(a.checkInDate)}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })()}
      </DialogContent>
    </Dialog>
  );
}
