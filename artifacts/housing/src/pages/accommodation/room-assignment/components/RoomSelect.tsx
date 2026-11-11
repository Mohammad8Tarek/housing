import type { Room } from "@workspace/api-client-react";
import { Sparkles, AlertTriangle } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import type { FloorInfo, OccupantInfo, Recommendation } from "../types";

/** ── قائمة الغرف المفلترة (room picker with recommendation / occupancy badges) ── */
export function RoomSelect({
  ar,
  selectedRoomId,
  onChange,
  filteredRooms,
  sortedFilteredRooms,
  recommendation,
  entireRoomOccupiedSet,
  singleOccupantRoomsMap,
  canOverrideSingleOccupancy,
  buildingMap,
  floorMap,
}: {
  ar: boolean;
  selectedRoomId: string;
  onChange: (v: string) => void;
  filteredRooms: Room[];
  sortedFilteredRooms: Room[];
  recommendation: Recommendation;
  entireRoomOccupiedSet: Set<number>;
  singleOccupantRoomsMap: Map<number, OccupantInfo>;
  canOverrideSingleOccupancy: boolean;
  buildingMap: Record<number, string>;
  floorMap: Record<number, FloorInfo>;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium">
        {ar ? "اختر الغرفة" : "Select Room"}{" "}
        <span className="text-red-500">*</span>
        {filteredRooms.length > 0 && (
          <span className="ml-2 text-xs text-muted-foreground font-normal">
            ({filteredRooms.length} {ar ? "غرفة" : "rooms"})
          </span>
        )}
      </label>
      <Select value={selectedRoomId} onValueChange={onChange}>
        <SelectTrigger>
          <SelectValue
            placeholder={
              filteredRooms.length === 0
                ? ar
                  ? "لا توجد غرف تطابق الفلاتر"
                  : "No rooms match filters"
                : ar
                  ? "اختر الغرفة من القائمة..."
                  : "Select a room..."
            }
          />
        </SelectTrigger>
        <SelectContent
          position="popper"
          sideOffset={4}
          className="max-h-64 overflow-y-auto"
        >
          {filteredRooms.length === 0 ? (
            <div className="p-4 text-center">
              <AlertTriangle className="w-6 h-6 text-amber-500 mx-auto mb-2 opacity-50" />
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "لا توجد غرف متاحة تطابق خيارات البحث"
                  : "No rooms match current filters"}
              </p>
            </div>
          ) : (
            sortedFilteredRooms.map((r) => {
              const isEntireReserved = entireRoomOccupiedSet.has(r.id);
              const isFull =
                r.currentOccupancy >= r.capacity || isEntireReserved;
              const isSingleOccRoom = singleOccupantRoomsMap.has(r.id);
              const isBlockedBySingleOcc =
                isSingleOccRoom && !canOverrideSingleOccupancy;
              const isDisabled = isFull || isBlockedBySingleOcc;
              const building = buildingMap[r.buildingId] ?? "—";
              const floor = floorMap[r.floorId];
              return (
                <SelectItem
                  key={r.id}
                  value={String(r.id)}
                  disabled={isDisabled}
                >
                  <div
                    className={`flex items-center gap-2 ${isDisabled ? "opacity-50" : ""}`}
                  >
                    <span className="font-mono font-bold text-primary">
                      {r.roomNumber}
                    </span>
                    {recommendation?.recommendedMap[r.id]?.levelMatch && (
                      <span className="text-[10px] px-1.5 py-0.2 rounded font-extrabold bg-amber-500/20 text-amber-700 dark:text-amber-300 border border-amber-400 flex items-center gap-1">
                        <Sparkles className="w-2.5 h-2.5 text-amber-600" />
                        {ar
                          ? recommendation.recommendedMap[r.id].badgeLabelAr
                          : recommendation.recommendedMap[r.id].badgeLabelEn}
                      </span>
                    )}
                    <span className="text-[10px] bg-muted px-1.5 py-0.5 rounded text-muted-foreground">
                      {building}
                    </span>
                    {floor?.number !== undefined && (
                      <span className="text-[10px] text-muted-foreground">
                        {ar ? "دور" : "F"} {floor.number}
                      </span>
                    )}
                    <Badge
                      variant={
                        isFull
                          ? "destructive"
                          : isBlockedBySingleOcc
                            ? "outline"
                            : "outline"
                      }
                      className={`text-[9px] h-4 py-0 ${
                        isEntireReserved
                          ? "bg-purple-700 text-white border-purple-800"
                          : isBlockedBySingleOcc
                            ? "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30"
                            : isSingleOccRoom
                              ? "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300 border-amber-300"
                              : ""
                      }`}
                    >
                      {isEntireReserved
                        ? ar
                          ? "محجوزة بالكامل (فردي)"
                          : "ENTIRE ROOM"
                        : isFull
                          ? ar
                            ? "ممتلئة"
                            : "FULL"
                          : isBlockedBySingleOcc
                            ? ar
                              ? "شخص بمفرده (يتطلب صلاحية)"
                              : "SINGLE OCCUPANT (REQ. PERM)"
                            : isSingleOccRoom
                              ? ar
                                ? "شخص بمفرده (مسموح بالصلاحية)"
                                : "SINGLE OCCUPANT (AUTH)"
                              : r.roomType}
                    </Badge>
                    {r.classification && (
                      <span
                        className={`text-[9px] px-1.5 py-0.2 rounded font-semibold border ${
                          r.classification.toLowerCase().includes("deluxe")
                            ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                            : r.classification
                                  .toLowerCase()
                                  .includes("superior")
                              ? "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                              : r.classification
                                    .toLowerCase()
                                    .includes("family")
                                ? "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                                : "bg-muted text-foreground border-border"
                        }`}
                      >
                        {r.classification}
                      </span>
                    )}
                    <span
                      className={`text-[10px] font-medium ${isFull ? "text-red-500" : isBlockedBySingleOcc ? "text-amber-600 font-bold" : "text-muted-foreground"}`}
                    >
                      {r.currentOccupancy}/{r.capacity}
                    </span>
                  </div>
                </SelectItem>
              );
            })
          )}
        </SelectContent>
      </Select>
    </div>
  );
}
