import { useMemo } from "react";
import { Bed, User, Phone, Calendar, Briefcase, Building, CheckCircle, ShieldCheck } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface InHouseGroupedRoomsViewProps {
  assignments: any[];
  roomMap: Record<number, any>;
  buildingMap: Record<number, string>;
  floorMap: Record<number, string>;
  ar: boolean;
  search?: string;
}

export function InHouseGroupedRoomsView({
  assignments = [],
  roomMap = {},
  buildingMap = {},
  floorMap = {},
  ar,
}: InHouseGroupedRoomsViewProps) {
  // Group assignments by room
  const groupedRooms = useMemo(() => {
    const map = new Map<string, { roomInfo: any; occupants: any[] }>();

    assignments.forEach((a: any) => {
      const rId = String(a.roomId || a.roomNumber || "unassigned");
      if (!map.has(rId)) {
        const roomObj = roomMap[a.roomId] || {
          roomNumber: a.roomNumber || `#${a.roomId}`,
          capacity: a.capacity || 1,
          roomType: a.roomType || "Standard",
          buildingId: a.buildingId,
          floorId: a.floorId,
          status: "available",
        };
        map.set(rId, {
          roomInfo: {
            ...roomObj,
            buildingName: a.buildingName || buildingMap[roomObj.buildingId] || "—",
            floorName: a.floorName || floorMap[roomObj.floorId] || "—",
            roomType: a.roomType || roomObj.roomType || "—",
            capacity: Number(a.capacity || roomObj.capacity || 1),
          },
          occupants: [],
        });
      }
      map.get(rId)!.occupants.push(a);
    });

    // Sort occupants inside each room by bed number
    const list = Array.from(map.values()).map((item) => {
      item.occupants.sort((x: any, y: any) => {
        const bX = Number(x.bedNumber) || 999;
        const bY = Number(y.bedNumber) || 999;
        return bX - bY;
      });
      return item;
    });

    // Sort rooms by roomNumber natural sort
    list.sort((a, b) => {
      return String(a.roomInfo.roomNumber).localeCompare(String(b.roomInfo.roomNumber), undefined, {
        numeric: true,
        sensitivity: "base",
      });
    });

    return list;
  }, [assignments, roomMap, buildingMap, floorMap]);

  if (groupedRooms.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <Building className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold text-base">
          {ar ? "لا توجد غرف أو نزلاء مطابقين للفلاتر المحددة" : "No rooms or occupants matching the filters"}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-3">
      {groupedRooms.map(({ roomInfo, occupants }) => {
        const capacity = Math.max(1, roomInfo.capacity || occupants.length);
        const occupiedCount = occupants.length;
        const vacantCount = Math.max(0, capacity - occupiedCount);
        const isFull = vacantCount === 0;

        // Construct complete bed slots (1 to capacity)
        const occupiedBedMap = new Map<number, any>();
        const unnumberedOccupants: any[] = [];

        occupants.forEach((occ: any) => {
          const num = Number(occ.bedNumber);
          if (!isNaN(num) && num >= 1 && num <= capacity && !occupiedBedMap.has(num)) {
            occupiedBedMap.set(num, occ);
          } else {
            unnumberedOccupants.push(occ);
          }
        });

        // Fill remaining slots
        const bedSlots: { bedNum: number; occupant?: any; isVacant: boolean }[] = [];
        for (let b = 1; b <= capacity; b++) {
          if (occupiedBedMap.has(b)) {
            bedSlots.push({ bedNum: b, occupant: occupiedBedMap.get(b), isVacant: false });
          } else if (unnumberedOccupants.length > 0) {
            bedSlots.push({ bedNum: b, occupant: unnumberedOccupants.shift(), isVacant: false });
          } else {
            bedSlots.push({ bedNum: b, isVacant: true });
          }
        }
        // Any remaining overflow occupants
        while (unnumberedOccupants.length > 0) {
          bedSlots.push({ bedNum: bedSlots.length + 1, occupant: unnumberedOccupants.shift(), isVacant: false });
        }

        return (
          <div
            key={roomInfo.roomNumber}
            className="rounded-xl border bg-card shadow-xs overflow-hidden transition-all hover:border-primary/40"
          >
            {/* Room Header Bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 bg-muted/40 px-4 py-3 border-b">
              <div className="flex items-center gap-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary font-bold text-sm">
                  {roomInfo.roomNumber}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-base text-foreground">
                      {ar ? `غرفة ${roomInfo.roomNumber}` : `Room ${roomInfo.roomNumber}`}
                    </span>
                    <Badge variant="outline" className="text-xs bg-background font-normal text-muted-foreground">
                      {roomInfo.buildingName} • {roomInfo.floorName}
                    </Badge>
                    {roomInfo.roomType && roomInfo.roomType !== "—" && (
                      <Badge variant="secondary" className="text-xs font-semibold">
                        {roomInfo.roomType}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ar
                      ? `سعة الغرفة: ${capacity} أسرة • النزلاء المسكنون حالياً: ${occupiedCount} موظف`
                      : `Capacity: ${capacity} beds • Current In-House Occupants: ${occupiedCount} staff`}
                  </p>
                </div>
              </div>

              {/* Occupancy Status Badge */}
              <div className="flex items-center gap-2">
                <Badge
                  className={`text-xs px-2.5 py-1 font-bold ${
                    isFull
                      ? "bg-slate-700 text-white dark:bg-slate-800"
                      : "bg-emerald-600 text-white"
                  }`}
                >
                  {isFull
                    ? ar
                      ? `مشغولة بالكامل (${occupiedCount}/${capacity})`
                      : `Fully Occupied (${occupiedCount}/${capacity})`
                    : ar
                    ? `يتوفر ${vacantCount} سرير شاغر (${occupiedCount}/${capacity})`
                    : `${vacantCount} Vacant Beds Available (${occupiedCount}/${capacity})`}
                </Badge>
              </div>
            </div>

            {/* Beds Grid */}
            <div className="p-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {bedSlots.map(({ bedNum, occupant, isVacant }) => {
                if (isVacant) {
                  return (
                    <div
                      key={`vacant-${bedNum}`}
                      className="rounded-lg border-2 border-dashed border-emerald-300 dark:border-emerald-800/80 bg-emerald-50/40 dark:bg-emerald-950/20 p-3.5 flex flex-col justify-between"
                    >
                      <div className="flex items-center justify-between mb-2">
                        <Badge
                          variant="outline"
                          className="bg-emerald-100 text-emerald-800 border-emerald-300 dark:bg-emerald-900/60 dark:text-emerald-300 font-bold text-xs"
                        >
                          <Bed className="w-3.5 h-3.5 mr-1 ml-1" />
                          {ar ? `سرير ${bedNum}` : `Bed ${bedNum}`}
                        </Badge>
                        <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                          {ar ? "شاغر ومتاح" : "Vacant & Ready"}
                        </span>
                      </div>
                      <div className="py-2 text-center">
                        <CheckCircle className="w-6 h-6 mx-auto text-emerald-500 mb-1" />
                        <p className="text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                          {ar ? "سرير فارغ متاح للتسكين" : "Available Bed Slot"}
                        </p>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          {ar ? "يمكن تسكين موظف جديد في هذا السرير" : "Ready for check-in or transfer"}
                        </p>
                      </div>
                    </div>
                  );
                }

                const isVacation = occupant.status === "VACATION";
                const isEntire = occupant.isEntireRoom;

                return (
                  <div
                    key={occupant.id || `occ-${bedNum}`}
                    className="rounded-lg border bg-background/80 p-3.5 space-y-2.5 shadow-2xs hover:shadow-xs transition-shadow"
                  >
                    {/* Bed & Status Badge */}
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5">
                        <Badge variant="secondary" className="font-bold text-xs">
                          <Bed className="w-3.5 h-3.5 mr-1 ml-1 text-primary" />
                          {ar ? `سرير ${occupant.bedNumber && occupant.bedNumber !== "—" ? occupant.bedNumber : bedNum}` : `Bed ${occupant.bedNumber && occupant.bedNumber !== "—" ? occupant.bedNumber : bedNum}`}
                        </Badge>
                        {isEntire && (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] px-1.5 py-0 font-medium">
                            {ar ? "غرفة كاملة" : "Full Room"}
                          </Badge>
                        )}
                      </div>

                      {isVacation ? (
                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 text-[11px] font-bold">
                          {ar ? "في إجازة" : "On Vacation"}
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-950/60 dark:text-emerald-300 text-[11px] font-bold">
                          {ar ? "مقيم بالسكن" : "In-House"}
                        </Badge>
                      )}
                    </div>

                    {/* Resident Info */}
                    <div className="space-y-1">
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-sm text-foreground leading-tight">
                          {occupant.fullName}
                        </h4>
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground font-mono">
                        <span>{occupant.profileCode}</span>
                        {occupant.employmentType === "THIRD_PARTY" ? (
                          <span className="text-purple-600 font-sans font-medium">
                            ({occupant.companyName || (ar ? "طرف ثالث" : "Third Party")})
                          </span>
                        ) : (
                          <span className="text-blue-600 font-sans font-medium">
                            ({ar ? "فندق" : "Hotel"})
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Department & Job */}
                    <div className="space-y-1 text-xs text-muted-foreground pt-1 border-t border-dashed">
                      <div className="flex items-center gap-1.5">
                        <Briefcase className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                        <span className="truncate font-medium text-foreground">{occupant.department}</span>
                        <span className="text-muted-foreground/60">•</span>
                        <span className="truncate">{occupant.jobTitle}</span>
                      </div>
                      {occupant.phone && occupant.phone !== "—" && (
                        <div className="flex items-center gap-1.5 text-[11px] font-mono">
                          <Phone className="w-3.5 h-3.5 shrink-0 text-muted-foreground/70" />
                          <span>{occupant.phone}</span>
                        </div>
                      )}
                    </div>

                    {/* Dates Footer */}
                    <div className="pt-2 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                      <div className="flex items-center gap-1">
                        <Calendar className="w-3 h-3" />
                        <span>{ar ? "تسكين:" : "In:"}</span>
                        <span className="font-medium text-foreground">{occupant.checkInDate}</span>
                      </div>
                      {occupant.contractEndDate && occupant.contractEndDate !== "—" && (
                        <div className="flex items-center gap-1 text-amber-700 dark:text-amber-400">
                          <ShieldCheck className="w-3 h-3" />
                          <span>{ar ? "عقد:" : "Contract:"}</span>
                          <span className="font-medium">{occupant.contractEndDate}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
