import type { Building, Floor } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Search, X } from "lucide-react";

/** ── فلاتر البحث (المبنى / الدور / رقم الغرفة) ── */
export function RoomFiltersBar({
  ar,
  buildings,
  floors,
  searchBuilding,
  searchFloor,
  searchRoomNumber,
  onBuildingChange,
  onFloorChange,
  onRoomNumberChange,
  onReset,
}: {
  ar: boolean;
  buildings: Building[];
  floors: Floor[];
  searchBuilding: string;
  searchFloor: string;
  searchRoomNumber: string;
  onBuildingChange: (v: string) => void;
  onFloorChange: (v: string) => void;
  onRoomNumberChange: (v: string) => void;
  onReset: () => void;
}) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-3 p-3 bg-muted/30 rounded-lg border border-dashed">
      {/* فلتر المبنى */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          {ar ? "المبنى" : "Building"}
        </label>
        <Select value={searchBuilding} onValueChange={onBuildingChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">
              {ar ? "كل المباني" : "All Buildings"}
            </SelectItem>
            {buildings.map((b) => (
              <SelectItem key={b.id} value={String(b.id)}>
                {b.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* فلتر الدور */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          {ar ? "الدور" : "Floor"}
        </label>
        <Select value={searchFloor} onValueChange={onFloorChange}>
          <SelectTrigger className="h-9">
            <SelectValue placeholder={ar ? "كل الأدوار" : "All Floors"} />
          </SelectTrigger>
          <SelectContent position="popper" sideOffset={4}>
            <SelectItem value="all">
              {ar ? "كل الأدوار" : "All Floors"}
            </SelectItem>
            {floors
              .filter(
                (f) =>
                  searchBuilding === "all" ||
                  String(f.buildingId ?? (f as any).building_id) ===
                    String(searchBuilding),
              )
              .map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>
                  {ar ? "دور" : "Floor"}{" "}
                  {f.floorNumber ?? (f as any).floor_number}
                </SelectItem>
              ))}
          </SelectContent>
        </Select>
      </div>

      {/* بحث برقم الغرفة */}
      <div className="space-y-1">
        <label className="text-[10px] font-bold uppercase text-muted-foreground">
          {ar ? "رقم الغرفة" : "Room #"}
        </label>
        <div className="relative">
          <Search className="absolute left-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
          <Input
            className="h-9 pl-7"
            placeholder={ar ? "اكتب رقم الغرفة..." : "Room number..."}
            value={searchRoomNumber}
            onChange={(e) => onRoomNumberChange(e.target.value)}
          />
        </div>
      </div>

      {(searchBuilding !== "all" ||
        searchFloor !== "all" ||
        searchRoomNumber.trim()) && (
        <div className="md:col-span-3 flex justify-end">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 px-2.5 text-xs text-muted-foreground hover:text-foreground border border-dashed"
            onClick={onReset}
          >
            <X className="w-3.5 h-3.5 mr-1 rtl:ml-1 rtl:mr-0" />
            {ar ? "إلغاء الفلاتر وعرض الكل" : "Reset Filters / Show All"}
          </Button>
        </div>
      )}
    </div>
  );
}
