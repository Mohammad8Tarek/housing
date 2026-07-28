import { useState } from "react";
import { Key, Building2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import KeyManagementPanel from "@/components/KeyManagementPanel";

type Props = {
  buildings: any[];
  rooms: any[];
  assignments: any[];
  employees: any[];
  propertyId: number | null;
};

export function KeysTab({
  buildings,
  rooms,
  assignments,
  employees,
  propertyId,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [selectedKeyRoomId, setSelectedKeyRoomId] = useState<string>("");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm text-muted-foreground">
            {ar
              ? "إدارة مفاتيح الغرف وبطاقات الوصول"
              : "Manage room keys and access cards"}
          </p>
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-medium flex items-center gap-2">
          <Key className="w-4 h-4 text-amber-600" />
          {ar ? "اختر الغرفة لإدارة مفاتيحها" : "Select Room to Manage Keys"}
        </label>
        <Select value={selectedKeyRoomId} onValueChange={setSelectedKeyRoomId}>
          <SelectTrigger className="max-w-sm">
            <SelectValue
              placeholder={ar ? "اختر غرفة..." : "Select a room..."}
            />
          </SelectTrigger>
          <SelectContent className="max-h-72 overflow-y-auto">
            {buildings.map((b) => {
              const bRooms = rooms.filter((r) => r.buildingId === b.id);
              if (bRooms.length === 0) return null;
              return (
                <div key={b.id}>
                  <div className="px-3 py-1.5 text-xs font-semibold text-muted-foreground bg-muted/50 sticky top-0">
                    <Building2 className="inline w-3 h-3 mr-1" />
                    {b.name}
                  </div>
                  {bRooms.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      <span className="flex items-center gap-2">
                        <span className="font-mono font-bold text-primary">
                          {r.roomNumber}
                        </span>
                        <span className="text-xs text-muted-foreground capitalize">
                          {r.roomType}
                        </span>
                        <Badge
                          variant={
                            r.currentOccupancy >= r.capacity
                              ? "destructive"
                              : "outline"
                          }
                          className="text-[9px] h-4 py-0"
                        >
                          {r.currentOccupancy}/{r.capacity}
                        </Badge>
                      </span>
                    </SelectItem>
                  ))}
                </div>
              );
            })}
          </SelectContent>
        </Select>
      </div>

      {selectedKeyRoomId && propertyId ? (
        (() => {
          const roomIdNum = parseInt(selectedKeyRoomId);
          const activeAssignment = assignments.find(
            (a: any) => a.roomId === roomIdNum && a.status === "ACTIVE",
          );
          const assignedEmployee = activeAssignment
            ? employees.find((e: any) => e.id === activeAssignment.employeeId)
            : undefined;
          return (
            <div className="max-w-lg space-y-2">
              {activeAssignment && assignedEmployee && (
                <div className="flex items-center gap-2 rounded-lg border bg-amber-50 px-3 py-2 text-xs text-amber-800">
                  <span className="font-semibold">الساكن الحالي:</span>
                  <span>
                    {assignedEmployee.firstName} {assignedEmployee.lastName}
                  </span>
                  <span className="text-muted-foreground">
                    — غرفة{" "}
                    {rooms.find((r: any) => r.id === roomIdNum)?.roomNumber}
                  </span>
                </div>
              )}
              <KeyManagementPanel
                propertyId={propertyId}
                roomId={roomIdNum}
                assignmentId={activeAssignment?.id}
                employeeId={activeAssignment?.employeeId}
                checkInDate={activeAssignment?.checkInDate}
                checkOutDate={
                  activeAssignment?.expectedCheckOutDate ||
                  activeAssignment?.checkOutDate
                }
                notes={
                  assignedEmployee
                    ? `${assignedEmployee.firstName} ${assignedEmployee.lastName}`
                    : undefined
                }
              />
            </div>
          );
        })()
      ) : (
        <div className="py-12 text-center text-muted-foreground border rounded-xl bg-muted/10">
          <Key className="w-8 h-8 mx-auto mb-2 opacity-30" />
          <p className="font-medium">
            {ar ? "الرجاء اختيار غرفة" : "Please select a room"}
          </p>
        </div>
      )}
    </div>
  );
}
