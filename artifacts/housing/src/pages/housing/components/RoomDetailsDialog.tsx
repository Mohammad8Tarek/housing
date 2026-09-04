import { History, Check, Sparkles, AlertTriangle, Palmtree, Plus, X, Pencil, FileText, Tag } from "lucide-react";
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
import { useQueryClient } from "@tanstack/react-query";
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
      setFeaturesEditMode(false);
      setLocalFeatures(null);
    } catch {
      toast.error(ar ? "فشل حفظ المميزات" : "Failed to save features");
    } finally {
      setSavingFeatures(false);
    }
  };

  const empMap = Object.fromEntries((profiles ?? []).map((e) => [e.id, e]));

  return (
    <Dialog open={!!room} onOpenChange={(open) => !open && onClose()}>
      <DialogContent
        className="max-w-lg"
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
