import { useState } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { X, Plus } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
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

const roomTypes = [
  "Standard",
  "Deluxe",
  "Superior",
  "Suite",
  "Studio",
  "Shared",
  "Dormitory",
  "Executive",
];

const bedTypes = [
  "Single Bed",
  "Twin Bed",
  "Double Bed",
  "Queen Bed",
  "King Bed",
  "Bunk Bed",
  "Sofa Bed",
];

const viewOptions = [
  "Sea view",
  "Tal View",
  "Garden view",
  "Pool view",
  "City view",
  "Mountain view",
  "Back view",
  "Street view",
];

const SUGGESTED_FEATURES = [
  "Bedroom",
  "Bathroom",
  "Seating area",
  "Kitchenette",
  "Balcony",
  "Air conditioning",
  "WiFi",
  "TV",
  "Mini fridge",
  "Safe",
  "Wardrobe",
  "Study desk",
  "Washing machine",
  "Iron",
];

type Props = {
  propertyId?: number;
  buildings: any[];
  floors: any[];
  roomModal: boolean;
  setRoomModal: (v: boolean) => void;
  editRoom: any;
  rForm: any;
  setRForm: (v: any) => void;
  saveRoomHandler: () => void;
  isSaving: boolean;

  deleteRoom: any;
  setDeleteRoom: (v: any) => void;
  confirmDeleteRoom: () => void;
  isDeleting: boolean;
};

export function RoomModals({
  propertyId,
  buildings,
  floors,
  roomModal,
  setRoomModal,
  editRoom,
  rForm,
  setRForm,
  saveRoomHandler,
  isSaving,
  deleteRoom,
  setDeleteRoom,
  confirmDeleteRoom,
  isDeleting,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [featureInput, setFeatureInput] = useState("");

  const { data: lookupRoomTypes = [] } = useLookupValues(
    propertyId || 0,
    LOOKUP_CATEGORIES.ROOM_TYPE
  );

  const { data: lookupClassifications = [] } = useLookupValues(
    propertyId || 0,
    LOOKUP_CATEGORIES.ROOM_CLASSIFICATION
  );

  const activeLookupTypes = lookupRoomTypes.filter((t: any) => !t.disabled);
  const availableRoomTypes =
    activeLookupTypes.length > 0
      ? activeLookupTypes.map((t: any) => t.value)
      : roomTypes;

  const defaultClassifications = [
    "Deluxe room",
    "Family suite",
    "Superior room",
    "Standard room",
  ];
  const activeClassifications = lookupClassifications.filter((t: any) => !t.disabled);
  const availableClassifications = Array.from(
    new Set([
      ...defaultClassifications,
      ...activeClassifications.map((t: any) => t.value),
      ...(rForm.classification ? [rForm.classification] : []),
    ])
  );

  const featuresList: string[] = Array.isArray(rForm.featuresList)
    ? rForm.featuresList
    : typeof rForm.features === "string" && rForm.features
    ? rForm.features.split(/[,;\n]+/).map((s: string) => s.trim()).filter(Boolean)
    : [];

  const addFeature = (feat: string) => {
    const trimmed = feat.trim();
    if (!trimmed) return;
    if (featuresList.some((f) => f.toLowerCase() === trimmed.toLowerCase())) return;
    const next = [...featuresList, trimmed];
    setRForm((p: any) => ({
      ...p,
      featuresList: next,
      features: next.join(", "),
    }));
    setFeatureInput("");
  };

  const removeFeature = (feat: string) => {
    const next = featuresList.filter((f) => f !== feat);
    setRForm((p: any) => ({
      ...p,
      featuresList: next,
      features: next.join(", "),
    }));
  };

  return (
    <>
      <Dialog open={roomModal} onOpenChange={setRoomModal}>
        <DialogContent
          className="max-w-2xl max-h-[90vh] overflow-y-auto"
          srTitle={
            editRoom
              ? ar ? "????? ??????" : "Edit Room"
              : ar ? "????? ????" : "Add Room"
          }
        >
          <DialogHeader>
            <DialogTitle>
              {editRoom
                ? ar ? "????? ??????" : "Edit Room"
                : ar ? "????? ????" : "Add Room"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-2">
            {/* -- Section 1: Location -- */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {ar ? "?????? ????????" : "Location & Identity"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{ar ? "??????" : "Building"} *</Label>
                  <Select
                    value={String(rForm.buildingId)}
                    onValueChange={(v) =>
                      setRForm((p: any) => ({
                        ...p,
                        buildingId: Number(v),
                        floorId: 0,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "???? ??????" : "Building"} />
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
                  <Label>{ar ? "??????" : "Floor"} *</Label>
                  <Select
                    value={String(rForm.floorId)}
                    onValueChange={(v) =>
                      setRForm((p: any) => ({ ...p, floorId: Number(v) }))
                    }
                    disabled={!rForm.buildingId}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "???? ??????" : "Floor"} />
                    </SelectTrigger>
                    <SelectContent>
                      {floors
                        .filter((f) => f.buildingId === rForm.buildingId)
                        .map((f) => (
                          <SelectItem key={f.id} value={String(f.id)}>
                            {ar ? "??????" : "Floor"} {f.floorNumber}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "??? ??????" : "Room Number"} *</Label>
                  <Input
                    value={rForm.roomNumber}
                    onChange={(e) =>
                      setRForm((p: any) => ({ ...p, roomNumber: e.target.value }))
                    }
                    placeholder="e.g. 101, A-205"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "التصنيف" : "Classification"}</Label>
                  <Select
                    value={rForm.classification || "__none__"}
                    onValueChange={(v) => {
                      const val = v === "__none__" ? "" : v;
                      setRForm((p: any) => {
                        const updated: any = { ...p, classification: val };
                        if (val.toLowerCase().includes("family") && (!p.capacity || p.capacity < 3)) {
                          updated.capacity = 4;
                        }
                        return updated;
                      });
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر التصنيف..." : "Select classification..."} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">
                        {ar ? "بدون تصنيف (قياسي)" : "None (Standard)"}
                      </SelectItem>
                      {availableClassifications.map((cls) => (
                        <SelectItem key={cls} value={cls}>
                          {cls}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* -- Section 2: Room Specs -- */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {ar ? "??????? ??????" : "Room Specifications"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{ar ? "النوع" : "Type"}</Label>
                  <Select
                    value={rForm.roomType}
                    onValueChange={(v) => {
                      const matched = activeLookupTypes.find((t: any) => t.value === v);
                      const defaultCap = matched?.parentValue ? Number(matched.parentValue) : null;
                      setRForm((p: any) => ({
                        ...p,
                        roomType: v,
                        ...(defaultCap && !editRoom ? { capacity: defaultCap } : {}),
                      }));
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={ar ? "اختر نوع الغرفة" : "Select Room Type"} />
                    </SelectTrigger>
                    <SelectContent>
                      {availableRoomTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                      {rForm.roomType && !availableRoomTypes.includes(rForm.roomType) && (
                        <SelectItem value={rForm.roomType}>{rForm.roomType}</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "??? ??????" : "Bed Type"}</Label>
                  <Select
                    value={rForm.bedType || "__none__"}
                    onValueChange={(v) =>
                      setRForm((p: any) => ({
                        ...p,
                        bedType: v === "__none__" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— {ar ? "??? ????" : "Not specified"}</SelectItem>
                      {bedTypes.map((t) => (
                        <SelectItem key={t} value={t}>{t}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "????? ??????" : "Max Capacity"}</Label>
                  <Input
                    type="number"
                    min={1}
                    value={rForm.capacity}
                    onChange={(e) =>
                      setRForm((p: any) => ({
                        ...p,
                        capacity: Number(e.target.value),
                      }))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "???????" : "Size"}</Label>
                  <Input
                    value={rForm.size}
                    onChange={(e) =>
                      setRForm((p: any) => ({ ...p, size: e.target.value }))
                    }
                    placeholder="e.g. 40m2, 50 sqm"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "????????" : "View"}</Label>
                  <Select
                    value={rForm.view || "__none__"}
                    onValueChange={(v) =>
                      setRForm((p: any) => ({
                        ...p,
                        view: v === "__none__" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">— {ar ? "??? ????" : "Not specified"}</SelectItem>
                      {viewOptions.map((v) => (
                        <SelectItem key={v} value={v}>{v}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "??? ???? (Connecting)" : "Separator Door"}</Label>
                  <Select
                    value={rForm.separatorDoor ? "yes" : "no"}
                    onValueChange={(v) =>
                      setRForm((p: any) => ({ ...p, separatorDoor: v === "yes" }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="no">{ar ? "?? ????" : "No"}</SelectItem>
                      <SelectItem value="yes">{ar ? "??? ????" : "Yes"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* -- Section 3: Policy -- */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                {ar ? "??????? ???????" : "Policy & Status"}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label>{ar ? "????? ?????" : "Gender Policy"}</Label>
                  <Select
                    value={rForm.gender || "__none__"}
                    onValueChange={(v) =>
                      setRForm((p: any) => ({
                        ...p,
                        gender: v === "__none__" ? "" : v,
                      }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{ar ? "????? / ??? ?????" : "Mixed / None"}</SelectItem>
                      <SelectItem value="M">{ar ? "????" : "Male"}</SelectItem>
                      <SelectItem value="F">{ar ? "????" : "Female"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label>{ar ? "??????" : "Status"}</Label>
                  <Select
                    value={rForm.status}
                    onValueChange={(v) =>
                      setRForm((p: any) => ({ ...p, status: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="available">?? {ar ? "????? (????? ??????)" : "Vacant (Clean)"}</SelectItem>
                      <SelectItem value="dirty">?? {ar ? "????? (????? ?????? ?????)" : "Dirty (Vacant)"}</SelectItem>
                      <SelectItem value="occupied">?? {ar ? "??????? ???? (?????? ??????)" : "Occupied Clean"}</SelectItem>
                      <SelectItem value="occupied_dirty">?? {ar ? "????? ??????? (?????? ?????? ?????)" : "Occupied Dirty"}</SelectItem>
                      <SelectItem value="out_of_service">?? {ar ? "??? ??? ?????? (????? ?????)" : "Out of Service"}</SelectItem>
                      <SelectItem value="out_of_order">?? {ar ? "??? ??? ????? (???? ??????)" : "Out of Order"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* -- Section 4: Room Features -- */}
            <div>
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-3">
                ??? {ar ? "??????? ??????? ?????? (Room Features)" : "Room Features & Amenities"}
              </p>

              {/* Tags display */}
              <div className="flex flex-wrap gap-1.5 mb-3 min-h-[32px]">
                {featuresList.length === 0 && (
                  <span className="text-xs text-muted-foreground italic">
                    {ar ? "?? ???? ?????? ????? ???..." : "No features added yet..."}
                  </span>
                )}
                {featuresList.map((feat) => (
                  <Badge
                    key={feat}
                    variant="secondary"
                    className="gap-1 text-xs cursor-pointer pr-1.5"
                  >
                    {feat}
                    <button
                      type="button"
                      onClick={() => removeFeature(feat)}
                      className="ml-0.5 hover:text-destructive rounded-full"
                    >
                      <X className="w-3 h-3" />
                    </button>
                  </Badge>
                ))}
              </div>

              {/* Quick add suggestions */}
              <div className="flex flex-wrap gap-1.5 mb-3">
                {SUGGESTED_FEATURES.filter(
                  (f) => !featuresList.some((e) => e.toLowerCase() === f.toLowerCase())
                ).map((feat) => (
                  <button
                    key={feat}
                    type="button"
                    onClick={() => addFeature(feat)}
                    className="px-2 py-0.5 rounded-full border border-dashed text-xs text-muted-foreground hover:border-primary hover:text-primary transition-colors"
                  >
                    + {feat}
                  </button>
                ))}
              </div>

              {/* Custom feature input */}
              <div className="flex gap-2">
                <Input
                  placeholder={ar ? "??? ???? ?????..." : "Add custom feature..."}
                  value={featureInput}
                  onChange={(e) => setFeatureInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      addFeature(featureInput);
                    }
                  }}
                  className="text-sm"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => addFeature(featureInput)}
                  className="shrink-0"
                >
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* -- Section 5: Notes -- */}
            <div className="space-y-1.5">
              <Label>{ar ? "???????" : "Notes"}</Label>
              <Textarea
                value={rForm.notes}
                onChange={(e) =>
                  setRForm((p: any) => ({ ...p, notes: e.target.value }))
                }
                placeholder={ar ? "?? ??????? ??????..." : "Any additional notes..."}
                rows={2}
                className="resize-none text-sm"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setRoomModal(false)}>
              {ar ? "?????" : "Cancel"}
            </Button>
            <Button onClick={saveRoomHandler} disabled={isSaving}>
              {isSaving
                ? ar ? "???? ?????..." : "Saving..."
                : editRoom
                ? ar ? "??? ?????????" : "Save Changes"
                : ar ? "????? ??????" : "Add Room"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRoom} onOpenChange={(v) => !v && setDeleteRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "??? ???????" : "Delete Room?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? `?? ??? ????? ?? ??? ?????? ${deleteRoom?.roomNumber}? ??? ??????? ?? ???? ??????? ???.`
                : `Are you sure you want to delete room ${deleteRoom?.roomNumber}? This cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "?????" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteRoom}
              disabled={isDeleting}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {isDeleting ? (ar ? "???? ?????..." : "Deleting...") : (ar ? "???" : "Delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
