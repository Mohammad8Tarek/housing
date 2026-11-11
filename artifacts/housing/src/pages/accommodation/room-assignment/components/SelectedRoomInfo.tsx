import type { Room } from "@workspace/api-client-react";
import { Badge } from "@/components/ui/badge";
import { AlertTriangle } from "lucide-react";
import type { FloorInfo, OccupantInfo } from "../types";

/** معلومات الغرفة المختارة + تنبيهات الامتلاء / الغرفة الكاملة / النزيل المنفرد */
export function SelectedRoomInfo({
  ar,
  selectedRoom,
  buildingMap,
  floorMap,
  entireRoomOccupiedSet,
  singleOccupantRoomsMap,
}: {
  ar: boolean;
  selectedRoom: Room;
  buildingMap: Record<number, string>;
  floorMap: Record<number, FloorInfo>;
  entireRoomOccupiedSet: Set<number>;
  singleOccupantRoomsMap: Map<number, OccupantInfo>;
}) {
  const roomFull = selectedRoom.currentOccupancy >= selectedRoom.capacity;
  return (
    <>
      <div
        className={`p-3 rounded-lg border flex flex-wrap gap-4 text-sm ${roomFull ? "bg-red-50 border-red-200 dark:bg-red-950/20 dark:border-red-800" : "bg-muted/40"}`}
      >
        <div>
          <span className="text-xs text-muted-foreground block">
            {ar ? "المبنى" : "Building"}
          </span>
          <span className="font-medium">
            {buildingMap[selectedRoom.buildingId] ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">
            {ar ? "الدور" : "Floor"}
          </span>
          <span className="font-medium">
            {floorMap[selectedRoom.floorId]?.number ?? "—"}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">
            {ar ? "نوع الغرفة" : "Room Type"}
          </span>
          <span className="font-medium capitalize">
            {selectedRoom.roomType}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">
            {ar ? "الطاقة الاستيعابية" : "Capacity"}
          </span>
          <span
            className={`font-bold ${roomFull ? "text-red-600" : "text-foreground"}`}
          >
            {selectedRoom.currentOccupancy}/{selectedRoom.capacity}
          </span>
        </div>
        <div>
          <span className="text-xs text-muted-foreground block">
            {ar ? "الحالة" : "Status"}
          </span>
          <Badge
            variant={
              roomFull
                ? "destructive"
                : selectedRoom.status?.toLowerCase() === "available"
                  ? "default"
                  : "secondary"
            }
            className="capitalize"
          >
            {roomFull ? (ar ? "ممتلئة" : "Full") : selectedRoom.status}
          </Badge>
        </div>
        {selectedRoom.gender && (
          <div>
            <span className="text-xs text-muted-foreground block">
              {ar ? "الجنس" : "Gender"}
            </span>
            <span className="font-medium capitalize">
              {selectedRoom.gender}
            </span>
          </div>
        )}
      </div>
      {entireRoomOccupiedSet.has(selectedRoom.id) ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-purple-50 border border-purple-200 dark:bg-purple-950/20 dark:border-purple-800 text-purple-700 dark:text-purple-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium">
            {ar
              ? "هذه الغرفة محجوزة بالكامل لموظف آخر (استخدام فردي/غرفة خاصة). لا يمكن تسكين أي شخص آخر عليها."
              : "This room is reserved exclusively for another resident. No additional assignments are permitted."}
          </p>
        </div>
      ) : roomFull ? (
        <div className="flex items-center gap-2 p-3 rounded-lg bg-red-50 border border-red-200 dark:bg-red-950/20 dark:border-red-800 text-red-700 dark:text-red-400">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <p className="text-sm font-medium">
            {ar
              ? `هذه الغرفة وصلت للحد الأقصى (${selectedRoom.capacity} سرير).`
              : `This room is at full capacity (${selectedRoom.capacity} bed${selectedRoom.capacity !== 1 ? "s" : ""}).`}
          </p>
        </div>
      ) : null}
      {/* Single Occupant Authorized Notice */}
      {selectedRoom && singleOccupantRoomsMap.has(selectedRoom.id) && (
        <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-amber-900 dark:text-amber-200 text-xs">
          <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <span className="font-bold block">
              {ar
                ? "تنبيه: غرفة يشغلها نزيل بمفرده"
                : "Notice: Room Occupied by Single Resident"}
            </span>
            <span>
              {ar
                ? `هذه الغرفة يشغلها حالياً النزيل (${singleOccupantRoomsMap.get(selectedRoom.id)?.residentName || ""}) بمفرده وبها أسِرّة شاغرة. أنت تقوم بالتسكين المشترك بموجب الصلاحية الإدارية الاستثنائية الممنوحة لك.`
                : `This room is currently occupied by (${singleOccupantRoomsMap.get(selectedRoom.id)?.residentName || ""}) alone. You are assigning shared occupancy under your administrative override permission.`}
            </span>
          </div>
        </div>
      )}
    </>
  );
}
