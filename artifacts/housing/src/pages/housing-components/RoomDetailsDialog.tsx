import { format } from "date-fns";
import { History } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { roomStatusBadge } from "./utils";

type Props = {
  room: any | null;
  onClose: () => void;
  onOpenRoomLog: (room: any) => void;
  buildings: any[];
  floors: any[];
  assignments: any[];
  employees: any[];
};

export function RoomDetailsDialog({
  room,
  onClose,
  onOpenRoomLog,
  buildings,
  floors,
  assignments,
  employees,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  if (!room) return null;

  const empMap = Object.fromEntries((employees ?? []).map((e) => [e.id, e]));

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
        <div className="grid grid-cols-2 gap-3 mt-2">
          {[
            {
              label: ar ? "الحالة" : "Status",
              value: (
                <span
                  className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roomStatusBadge(room.status || "")}`}
                >
                  {room.status}
                </span>
              ),
            },
            {
              label: ar ? "النوع" : "Type",
              value: room.roomType,
            },
            {
              label: ar ? "السعة" : "Capacity",
              value: `${room.capacity} ${ar ? "أسرة" : "beds"}`,
            },
            {
              label: ar ? "الإشغال" : "Occupancy",
              value: `${room.currentOccupancy}/${room.capacity}`,
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
                return f ? `${ar ? "الطابق" : "Floor"} ${f.floorNumber}` : "-";
              })(),
            },
          ].map((row, i) => (
            <div key={i} className="p-3 rounded-lg bg-muted/30">
              <p className="text-xs text-muted-foreground mb-1">{row.label}</p>
              <div className="font-medium text-sm">{row.value}</div>
            </div>
          ))}
        </div>
        {room.gender && (
          <div className="p-3 rounded-lg bg-muted/30">
            <p className="text-xs text-muted-foreground mb-1">
              {ar ? "تخصيص الجنس" : "Gender"}
            </p>
            <p className="font-medium text-sm capitalize">{room.gender}</p>
          </div>
        )}
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
                  const emp = empMap[a.employeeId];
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
                            : `#${a.employeeId}`}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {emp?.department ?? ""}{" "}
                          {a.bedNumber
                            ? `• ${ar ? "سرير" : "Bed"} ${a.bedNumber}`
                            : ""}
                        </p>
                      </div>
                      <p className="text-xs text-muted-foreground whitespace-nowrap">
                        {format(new Date(a.checkInDate), "MMM d")}
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
