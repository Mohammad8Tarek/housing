import { Plus, ChevronUp, ChevronDown, Layers, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FloorConfig } from "../../utils";

const roomTypes = ["Standard", "Deluxe", "Suite", "Studio", "Shared", "Dormitory", "Executive"];
const roomTypeValues = [
  { value: "Standard", parentValue: "2" },
  { value: "Shared", parentValue: "4" },
  { value: "Dormitory", parentValue: "6" },
  { value: "Suite", parentValue: "1" },
  { value: "Executive", parentValue: "1" },
];

type Props = {
  floorConfigs: FloorConfig[];
  expandedFloorConfigs: Set<number>;
  toggleFloorConfig: (idx: number) => void;
  removeFloor: (idx: number) => void;
  updateFloorConfig: (idx: number, updates: Partial<FloorConfig>) => void;
  addFloor: () => void;
  smartTotalRooms: number;
  smartTotalBeds: number;
};

export function SmartGenerationConfig({
  floorConfigs,
  expandedFloorConfigs,
  toggleFloorConfig,
  removeFloor,
  updateFloorConfig,
  addFloor,
  smartTotalRooms,
  smartTotalBeds,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  return (
    <div className="space-y-3">
      {floorConfigs.map((fc, idx) => {
        const isOpen = expandedFloorConfigs.has(idx);
        return (
          <div key={idx} className="border rounded-xl overflow-hidden">
            <div className="flex items-center justify-between px-4 py-2.5 bg-muted/40">
              <button className="flex items-center gap-2 flex-1 text-left" onClick={() => toggleFloorConfig(idx)}>
                {isOpen ? <ChevronUp className="w-4 h-4 text-primary" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
                <Layers className="w-4 h-4 text-primary/70" />
                <span className="font-semibold text-sm">{ar ? "الطابق" : "Floor"} {fc.floorNumber}</span>
                <span className="text-xs text-muted-foreground ml-1">
                  — {fc.roomsCount} {ar ? "غرفة" : "rooms"} · {fc.roomType} · {fc.roomCapacity} {ar ? "سرير" : "beds/room"}
                </span>
                <span className="text-xs text-muted-foreground">· {ar ? "من" : "from"} {fc.roomStartNumber}</span>
              </button>
              {floorConfigs.length > 1 && (
                <button onClick={() => removeFloor(idx)} className="text-destructive hover:text-destructive/80 p-1 rounded">
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {isOpen && (
              <div className="p-4 grid grid-cols-2 gap-3 bg-muted/10">
                <div className="space-y-1.5">
                  <Label className="text-xs">{ar ? "رقم الطابق" : "Floor Number"}</Label>
                  <Input value={fc.floorNumber} onChange={(e) => updateFloorConfig(idx, { floorNumber: e.target.value })} placeholder="1" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{ar ? "عدد الغرف" : "Rooms Count"}</Label>
                  <Input type="number" min={1} max={200} value={fc.roomsCount} onChange={(e) => updateFloorConfig(idx, { roomsCount: Math.max(1, Number(e.target.value)) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{ar ? "نوع الغرفة" : "Room Type"}</Label>
                  <Select
                    value={fc.roomType}
                    onValueChange={(v) => {
                      const match = roomTypeValues.find((rt) => rt.value === v);
                      const autoCap = match?.parentValue ? Number(match.parentValue) : undefined;
                      updateFloorConfig(idx, { roomType: v, ...(autoCap && autoCap > 0 ? { roomCapacity: autoCap } : {}) });
                    }}
                  >
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {roomTypes.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{ar ? "سعة الغرفة (أسرة)" : "Room Capacity (beds)"}</Label>
                  <Input type="number" min={1} max={20} value={fc.roomCapacity} onChange={(e) => updateFloorConfig(idx, { roomCapacity: Math.max(1, Number(e.target.value)) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{ar ? "رقم بداية الغرف" : "Room Start Number"}</Label>
                  <Input type="number" min={1} value={fc.roomStartNumber} onChange={(e) => updateFloorConfig(idx, { roomStartNumber: Math.max(1, Number(e.target.value)) })} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">{ar ? "سياسة الجنس" : "Gender Policy"}</Label>
                  <Select value={fc.genderPolicy || "__none__"} onValueChange={(v) => updateFloorConfig(idx, { genderPolicy: v === "__none__" ? "" : v })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__none__">{ar ? "مختلط" : "Mixed"}</SelectItem>
                      <SelectItem value="M">{ar ? "ذكور" : "Male Only"}</SelectItem>
                      <SelectItem value="F">{ar ? "إناث" : "Female Only"}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="col-span-2 p-2 rounded-lg bg-primary/5 text-xs text-muted-foreground">
                  {ar ? "أرقام الغرف" : "Room numbers"}: <span className="font-mono font-bold text-foreground">{fc.roomStartNumber} — {fc.roomStartNumber + fc.roomsCount - 1}</span>
                </div>
              </div>
            )}
          </div>
        );
      })}

      <button onClick={addFloor} className="w-full py-2.5 border-2 border-dashed border-primary/30 rounded-xl text-sm text-primary/70 hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2">
        <Plus className="w-4 h-4" />
        {ar ? "إضافة طابق" : "Add Floor"}
      </button>

      <div className="p-3 rounded-lg bg-primary/10 border border-primary/20 grid grid-cols-3 gap-3 text-center">
        <div>
          <p className="text-xl font-bold text-primary">{floorConfigs.length}</p>
          <p className="text-[11px] text-muted-foreground">{ar ? "طابق" : "Floors"}</p>
        </div>
        <div>
          <p className="text-xl font-bold text-primary">{smartTotalRooms}</p>
          <p className="text-[11px] text-muted-foreground">{ar ? "غرفة" : "Rooms"}</p>
        </div>
        <div>
          <p className="text-xl font-bold text-primary">{smartTotalBeds}</p>
          <p className="text-[11px] text-muted-foreground">{ar ? "سرير" : "Beds"}</p>
        </div>
      </div>
    </div>
  );
}
