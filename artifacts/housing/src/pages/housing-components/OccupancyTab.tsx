import { useState } from "react";
import { Building2, BedDouble, Layers, ChevronRight, ChevronDown } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Badge } from "@/components/ui/badge";
import { statusNorm } from "./utils";

type Props = {
  buildings: any[];
  floors: any[];
  rooms: any[];
  onSelectRoom: (room: any) => void;
};

export function OccupancyTab({
  buildings,
  floors,
  rooms,
  onSelectRoom,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [expandedBuildings, setExpandedBuildings] = useState<Set<number>>(new Set());
  const [expandedFloors, setExpandedFloors] = useState<Set<number>>(new Set());

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {ar
          ? "عرض شجري للإشغال: مبانٍ ← طوابق ← غرف ← أسرة"
          : "Tree view: Buildings → Floors → Rooms → Beds"}
      </p>
      {buildings.length === 0 ? (
        <div className="py-12 text-center text-muted-foreground">
          <Building2 className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p>{ar ? "لا توجد مبانٍ" : "No buildings"}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {buildings.map((building) => {
            const bFloors = floors.filter(
              (f) => f.buildingId === building.id,
            );
            const bRooms = rooms.filter(
              (r) => r.buildingId === building.id,
            );
            const totalBeds = bRooms.reduce(
              (s, r) => s + (r.capacity ?? 0),
              0,
            );
            const usedBeds = bRooms.reduce(
              (s, r) => s + (r.currentOccupancy ?? 0),
              0,
            );
            const freeBeds = totalBeds - usedBeds;
            const pct =
              totalBeds > 0 ? Math.round((usedBeds / totalBeds) * 100) : 0;
            const isExpanded = expandedBuildings.has(building.id);
            return (
              <div
                key={building.id}
                className="border rounded-xl overflow-hidden shadow-sm"
              >
                <button
                  className="w-full flex items-center justify-between p-4 bg-muted/20 hover:bg-muted/40 transition-colors"
                  onClick={() =>
                    setExpandedBuildings((prev) => {
                      const s = new Set(prev);
                      s.has(building.id)
                        ? s.delete(building.id)
                        : s.add(building.id);
                      return s;
                    })
                  }
                >
                  <div className="flex items-center gap-3">
                    {isExpanded ? (
                      <ChevronDown className="w-4 h-4 text-primary" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-muted-foreground" />
                    )}
                    <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-5 h-5 text-primary" />
                    </div>
                    <div className="text-left">
                      <p className="font-bold text-base">{building.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {bFloors.length} {ar ? "طابق" : "floors"} •{" "}
                        {bRooms.length} {ar ? "غرفة" : "rooms"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="hidden sm:flex items-center gap-4 text-sm">
                      <span className="flex items-center gap-1.5">
                        <BedDouble className="w-4 h-4 text-muted-foreground" />
                        <span className="font-semibold">{usedBeds}</span>
                        <span className="text-muted-foreground">
                          /{totalBeds}
                        </span>
                      </span>
                      <span className="text-green-600 font-semibold">
                        {freeBeds} {ar ? "متاح" : "free"}
                      </span>
                    </div>
                    <div className="w-24 h-2 rounded-full bg-muted overflow-hidden">
                      <div
                        className={`h-full rounded-full ${pct >= 90 ? "bg-red-500" : pct >= 70 ? "bg-amber-500" : "bg-green-500"}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-sm font-bold w-10 text-right">
                      {pct}%
                    </span>
                  </div>
                </button>
                {isExpanded && (
                  <div className="divide-y">
                    {bFloors.map((floor) => {
                      const fRooms = rooms.filter(
                        (r) => r.floorId === floor.id,
                      );
                      const fBeds = fRooms.reduce(
                        (s, r) => s + (r.capacity ?? 0),
                        0,
                      );
                      const fUsed = fRooms.reduce(
                        (s, r) => s + (r.currentOccupancy ?? 0),
                        0,
                      );
                      const isFloorExpanded = expandedFloors.has(floor.id);
                      return (
                        <div key={floor.id}>
                          <button
                            className="w-full flex items-center justify-between px-6 py-3 bg-background hover:bg-muted/20 transition-colors"
                            onClick={() =>
                              setExpandedFloors((prev) => {
                                const s = new Set(prev);
                                s.has(floor.id)
                                  ? s.delete(floor.id)
                                  : s.add(floor.id);
                                return s;
                              })
                            }
                          >
                            <div className="flex items-center gap-3">
                              {isFloorExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-primary" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-muted-foreground" />
                              )}
                              <Layers className="w-4 h-4 text-primary/60" />
                              <span className="font-semibold text-sm">
                                {ar ? "الطابق" : "Floor"}{" "}
                                {floor.floorNumber}
                              </span>
                              <Badge
                                variant="secondary"
                                className="text-xs"
                              >
                                {fRooms.length} {ar ? "غرفة" : "rooms"}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-3 text-sm">
                              <span className="flex items-center gap-1.5">
                                <BedDouble className="w-3.5 h-3.5 text-muted-foreground" />
                                <span className="font-semibold">
                                  {fUsed}
                                </span>
                                <span className="text-muted-foreground">
                                  /{fBeds}
                                </span>
                              </span>
                              <span className="text-green-600 text-xs">
                                {fBeds - fUsed} {ar ? "متاح" : "free"}
                              </span>
                            </div>
                          </button>
                          {isFloorExpanded && (
                            <div className="px-8 py-2 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2 bg-muted/5">
                              {fRooms.map((room) => {
                                const free =
                                  (room.capacity ?? 1) -
                                  (room.currentOccupancy ?? 0);
                                const roomPct = room.capacity
                                  ? Math.round(
                                      ((room.currentOccupancy ?? 0) /
                                        room.capacity) *
                                        100,
                                    )
                                  : 0;
                                return (
                                  <button
                                    key={room.id}
                                    className="p-2.5 rounded-lg border bg-card hover:shadow-sm hover:border-primary/30 transition-all text-left"
                                    onClick={() => onSelectRoom(room)}
                                  >
                                    <div className="flex items-center justify-between mb-1.5">
                                      <span className="font-mono font-bold text-sm text-primary">
                                        {room.roomNumber}
                                      </span>
                                      <span
                                        className={`w-2 h-2 rounded-full flex-shrink-0 ${statusNorm(room.status) === "available" ? "bg-green-500" : statusNorm(room.status) === "occupied" ? "bg-blue-500" : "bg-red-500"}`}
                                      />
                                    </div>
                                    <div className="flex items-center gap-1 text-xs text-muted-foreground mb-1.5">
                                      <BedDouble className="w-3 h-3" />
                                      <span className="font-semibold text-foreground">
                                        {room.currentOccupancy ?? 0}
                                      </span>
                                      <span>/{room.capacity}</span>
                                      <span className="ml-auto text-green-600 font-medium">
                                        {free} {ar ? "ح" : "fr"}
                                      </span>
                                    </div>
                                    <div className="w-full h-1.5 rounded-full bg-muted overflow-hidden">
                                      <div
                                        className={`h-full rounded-full ${roomPct >= 100 ? "bg-blue-500" : roomPct > 0 ? "bg-amber-400" : "bg-green-400"}`}
                                        style={{ width: `${roomPct}%` }}
                                      />
                                    </div>
                                  </button>
                                );
                              })}
                              {fRooms.length === 0 && (
                                <p className="col-span-full py-2 text-xs text-muted-foreground">
                                  {ar ? "لا توجد غرف" : "No rooms"}
                                </p>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                    {bFloors.length === 0 && (
                      <p className="px-6 py-3 text-sm text-muted-foreground">
                        {ar ? "لا توجد طوابق" : "No floors"}
                      </p>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
