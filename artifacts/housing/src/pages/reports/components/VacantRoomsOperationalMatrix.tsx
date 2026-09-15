import { useMemo } from "react";
import { BedDouble, Building, Layers, CheckCircle, Users } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface VacantRoomsOperationalMatrixProps {
  ar: boolean;
  rooms: any[];
  assignments: any[];
  buildings: any[];
  buildingMap: Record<number, string>;
  filterBuilding?: string;
  onFilterBuilding?: (bId: string) => void;
  onFilterRoomType?: (type: string) => void;
  currentRoomTypeFilter?: string;
}

export function VacantRoomsOperationalMatrix({
  ar,
  rooms = [],
  assignments = [],
  buildings = [],
  buildingMap = {},
  filterBuilding = "all",
  onFilterBuilding,
  onFilterRoomType,
  currentRoomTypeFilter = "all",
}: VacantRoomsOperationalMatrixProps) {
  // Map of active occupant count per room
  const { activeAssByRoom, roomHasFullLock } = useMemo(() => {
    const activeAss = new Map<number, number>();
    const fullLocks = new Map<number, boolean>();
    assignments
      .filter((a: any) => a.status?.toLowerCase() === "active" || a.status?.toLowerCase() === "vacation")
      .forEach((a: any) => {
        activeAss.set(a.roomId, (activeAss.get(a.roomId) || 0) + 1);
        if (
          a.isEntireRoom ||
          a.is_entire_room ||
          a.notes?.includes("[حجز الغرفة بالكامل]") ||
          a.notes?.includes("[تسكين الغرفة بالكامل]")
        ) {
          fullLocks.set(a.roomId, true);
        }
      });
    return { activeAssByRoom: activeAss, roomHasFullLock: fullLocks };
  }, [assignments]);

  // Operational metrics by capacity (1 bed, 2 beds, 3 beds, 4 beds, 5+ beds)
  const capacityStats = useMemo(() => {
    const tiers: Record<
      string,
      {
        key: string;
        label: string;
        labelAr: string;
        filterVal: string;
        totalRooms: number;
        fullyVacantRooms: number;
        partiallyVacantRooms: number;
        vacantBeds: number;
        totalBeds: number;
      }
    > = {
      "1": {
        key: "1",
        label: "Single (1 Bed)",
        labelAr: "غرفة فردية (سرير واحد)",
        filterVal: "single",
        totalRooms: 0,
        fullyVacantRooms: 0,
        partiallyVacantRooms: 0,
        vacantBeds: 0,
        totalBeds: 0,
      },
      "2": {
        key: "2",
        label: "Double (2 Beds)",
        labelAr: "غرفة مزدوجة (سريرين)",
        filterVal: "double",
        totalRooms: 0,
        fullyVacantRooms: 0,
        partiallyVacantRooms: 0,
        vacantBeds: 0,
        totalBeds: 0,
      },
      "3": {
        key: "3",
        label: "Triple (3 Beds)",
        labelAr: "غرفة ثلاثية (3 أسرة)",
        filterVal: "triple",
        totalRooms: 0,
        fullyVacantRooms: 0,
        partiallyVacantRooms: 0,
        vacantBeds: 0,
        totalBeds: 0,
      },
      "4": {
        key: "4",
        label: "Quad (4 Beds)",
        labelAr: "غرفة رباعية (4 أسرة)",
        filterVal: "quad",
        totalRooms: 0,
        fullyVacantRooms: 0,
        partiallyVacantRooms: 0,
        vacantBeds: 0,
        totalBeds: 0,
      },
      "5+": {
        key: "5+",
        label: "5+ Beds (Quint+)",
        labelAr: "غرف خماسية فأكثر (5+)",
        filterVal: "5",
        totalRooms: 0,
        fullyVacantRooms: 0,
        partiallyVacantRooms: 0,
        vacantBeds: 0,
        totalBeds: 0,
      },
    };

    rooms.forEach((r: any) => {
      const isOoo = ["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(
        r.status?.toLowerCase()
      );
      if (isOoo) return;

      const cap = Number(r.capacity || 1);
      const isFullLock = roomHasFullLock.get(r.id);
      const occ = isFullLock ? cap : Math.min(cap, Math.max(r.currentOccupancy || 0, activeAssByRoom.get(r.id) || 0));
      const vacant = Math.max(0, cap - occ);

      let tierKey = "5+";
      if (cap === 1) tierKey = "1";
      else if (cap === 2) tierKey = "2";
      else if (cap === 3) tierKey = "3";
      else if (cap === 4) tierKey = "4";

      const tier = tiers[tierKey];
      if (tier) {
        tier.totalRooms += 1;
        tier.totalBeds += cap;
        tier.vacantBeds += vacant;
        if (occ === 0 && vacant === cap) {
          tier.fullyVacantRooms += 1;
        } else if (vacant > 0) {
          tier.partiallyVacantRooms += 1;
        }
      }
    });

    return Object.values(tiers);
  }, [rooms, activeAssByRoom, roomHasFullLock]);

  // Operational metrics by Building
  const buildingStats = useMemo(() => {
    return buildings.map((b: any) => {
      const bRooms = rooms.filter((r: any) => r.buildingId === b.id);
      let totalBeds = 0;
      let occupiedBeds = 0;
      let vacantBeds = 0;
      let fullyVacantRooms = 0;
      let partiallyVacantRooms = 0;

      bRooms.forEach((r: any) => {
        const isOoo = ["maintenance", "out_of_service", "out_of_order", "oos", "ooo"].includes(
          r.status?.toLowerCase()
        );
        if (isOoo) return;

        const cap = Number(r.capacity || 1);
        const isFullLock = roomHasFullLock.get(r.id);
        const occ = isFullLock ? cap : Math.min(cap, Math.max(r.currentOccupancy || 0, activeAssByRoom.get(r.id) || 0));
        const vacant = Math.max(0, cap - occ);

        totalBeds += cap;
        occupiedBeds += occ;
        vacantBeds += vacant;

        if (occ === 0 && vacant === cap) {
          fullyVacantRooms += 1;
        } else if (vacant > 0) {
          partiallyVacantRooms += 1;
        }
      });

      const occRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

      return {
        id: b.id,
        name: b.name || buildingMap[b.id] || `#${b.id}`,
        totalRooms: bRooms.length,
        totalBeds,
        occupiedBeds,
        vacantBeds,
        fullyVacantRooms,
        partiallyVacantRooms,
        totalVacantRooms: fullyVacantRooms + partiallyVacantRooms,
        occRate,
      };
    });
  }, [buildings, rooms, activeAssByRoom, roomHasFullLock, buildingMap]);

  const totalVacantBedsAll = capacityStats.reduce((acc, c) => acc + c.vacantBeds, 0);
  const totalFullyVacantRoomsAll = capacityStats.reduce((acc, c) => acc + c.fullyVacantRooms, 0);
  const totalPartiallyVacantRoomsAll = capacityStats.reduce((acc, c) => acc + c.partiallyVacantRooms, 0);

  return (
    <div className="space-y-4 rounded-xl border bg-gradient-to-b from-card to-background p-4 shadow-xs">
      {/* Header Banner */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-2 border-b">
        <div className="flex items-center gap-2.5">
          <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
            <BedDouble className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <span>{ar ? "مصفوفة السعة التشغيلية وتوزيع الأسرة الشاغرة" : "Operational Bed Capacity & Vacancy Matrix"}</span>
              <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 font-bold text-xs">
                {totalVacantBedsAll} {ar ? "سرير شاغر حالياً" : "Vacant Beds Total"}
              </Badge>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar
                ? "ملخص فوري لعدد الغرف والأسرة المتاحة للتسكين مصنفة بحسب سعة الغرفة والمبنى لسرعة اتخاذ القرار التشغيلي."
                : "Real-time breakdown of vacant beds and room availability segmented by bed-capacity tier and building."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 shrink-0 text-xs">
          <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 px-3 py-1.5 rounded-md border border-emerald-200 dark:border-emerald-800">
            <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
            <span>{totalFullyVacantRoomsAll} {ar ? "غرفة شاغرة كلياً" : "Fully Vacant Rooms"}</span>
          </div>
          <div className="flex items-center gap-1.5 bg-sky-50 dark:bg-sky-950/40 text-sky-800 dark:text-sky-300 px-3 py-1.5 rounded-md border border-sky-200 dark:border-sky-800">
            <Users className="w-3.5 h-3.5 text-sky-600" />
            <span>{totalPartiallyVacantRoomsAll} {ar ? "غرفة شاغرة جزئياً (بها نزل وسرير متاح)" : "Partially Vacant Rooms"}</span>
          </div>
        </div>
      </div>

      {/* 1. Room Count & Vacancy by Capacity Tiers */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5 text-indigo-500" />
            {ar ? "توزيع الغرف والأسرة الشاغرة حسب سعة الغرفة (Room Capacity Breakdown):" : "Rooms and Vacant Beds by Capacity:"}
          </span>
          {onFilterRoomType && currentRoomTypeFilter !== "all" && (
            <button
              onClick={() => onFilterRoomType("all")}
              className="text-[11px] text-primary hover:underline font-semibold"
            >
              {ar ? "عرض كل السعات" : "Clear capacity filter"}
            </button>
          )}
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-2.5">
          {capacityStats.map((tier) => {
            const isSelected = currentRoomTypeFilter === tier.filterVal;
            return (
              <div
                key={tier.key}
                onClick={() => onFilterRoomType && onFilterRoomType(isSelected ? "all" : tier.filterVal)}
                className={`relative p-3 rounded-lg border text-left rtl:text-right transition-all cursor-pointer ${
                  isSelected
                    ? "bg-primary/10 border-primary shadow-sm"
                    : "bg-muted/30 hover:bg-muted/60 border-border"
                }`}
              >
                <div className="flex items-center justify-between gap-1 mb-1">
                  <span className="text-xs font-bold text-foreground truncate">
                    {ar ? tier.labelAr : tier.label}
                  </span>
                  <Badge
                    variant={tier.vacantBeds > 0 ? "default" : "secondary"}
                    className={`text-[10px] h-5 px-1.5 font-bold ${
                      tier.vacantBeds > 0
                        ? "bg-emerald-600 text-white hover:bg-emerald-700"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {tier.vacantBeds} {ar ? "سرير شاغر" : "vacant"}
                  </Badge>
                </div>

                <div className="space-y-1 text-[11px] text-muted-foreground">
                  <div className="flex justify-between">
                    <span>{ar ? "إجمالي الغرف:" : "Total Rooms:"}</span>
                    <span className="font-semibold text-foreground">{tier.totalRooms}</span>
                  </div>
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>{ar ? "شاغرة كلياً:" : "Fully Vacant:"}</span>
                    <span className="font-bold">{tier.fullyVacantRooms}</span>
                  </div>
                  {tier.key !== "1" && (
                    <div className="flex justify-between text-sky-700 dark:text-sky-400">
                      <span>{ar ? "شاغرة جزئياً:" : "Partially Vacant:"}</span>
                      <span className="font-bold">{tier.partiallyVacantRooms}</span>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* 2. Vacant Beds by Building */}
      {buildingStats.length > 0 && (
        <div className="pt-2">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-bold text-muted-foreground flex items-center gap-1.5">
              <Building className="w-3.5 h-3.5 text-amber-500" />
              {ar ? "الأسرة الشاغرة موزعة حسب المبنى (Vacant Beds per Building):" : "Vacant Beds Breakdown by Building:"}
            </span>
            {onFilterBuilding && filterBuilding !== "all" && (
              <button
                onClick={() => onFilterBuilding("all")}
                className="text-[11px] text-primary hover:underline font-semibold"
              >
                {ar ? "عرض كل المباني" : "Show all buildings"}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
            {buildingStats.map((b) => {
              const isSelected = filterBuilding === String(b.id);
              return (
                <div
                  key={b.id}
                  onClick={() => onFilterBuilding && onFilterBuilding(isSelected ? "all" : String(b.id))}
                  className={`p-3 rounded-lg border transition-all cursor-pointer ${
                    isSelected
                      ? "bg-primary/10 border-primary shadow-sm"
                      : "bg-muted/20 hover:bg-muted/50 border-border"
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="font-bold text-xs text-foreground truncate max-w-[140px]">{b.name}</span>
                    <Badge
                      className={`text-[10px] h-5 px-2 font-bold ${
                        b.vacantBeds > 0
                          ? "bg-emerald-600 text-white hover:bg-emerald-700"
                          : "bg-slate-200 text-slate-700 dark:bg-slate-800 dark:text-slate-300"
                      }`}
                    >
                      {b.vacantBeds} {ar ? "سرير متاح" : "vacant beds"}
                    </Badge>
                  </div>

                  <div className="space-y-1 text-[11px] text-muted-foreground">
                    <div className="flex justify-between">
                      <span>{ar ? "غرف بها شواغر:" : "Vacant Rooms:"}</span>
                      <span className="font-semibold text-foreground">
                        {b.totalVacantRooms} {ar ? "غرفة" : "rooms"}
                        {b.fullyVacantRooms > 0 && (
                          <span className="text-emerald-600 text-[10px] mr-1 ml-1 font-normal">
                            ({b.fullyVacantRooms} {ar ? "شاغرة تماماً" : "full"})
                          </span>
                        )}
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span>{ar ? "نسبة الإشغال:" : "Occupancy:"}</span>
                      <span className="font-semibold text-foreground">{b.occRate}%</span>
                    </div>
                  </div>

                  {/* Progress bar */}
                  <div className="w-full bg-muted rounded-full h-1.5 mt-2 overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${
                        b.occRate >= 95
                          ? "bg-red-500"
                          : b.occRate >= 80
                          ? "bg-amber-500"
                          : "bg-emerald-500"
                      }`}
                      style={{ width: `${Math.min(100, b.occRate)}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
