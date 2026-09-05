import { Home, Users, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roomStatusBadge, getRoomStatusLabel } from "../../utils";

type Props = {
  buildings: any[];
  floors: any[];
  rLoading: boolean;
  filteredRoomsTab: any[];
  onEditRoom: (r: any) => void;
  onDeleteRoom: (r: any) => void;
  selectedRoomIds: Set<number>;
  onToggleRoom: (id: number) => void;
  onToggleAll: () => void;
};

export function RoomsTable({
  buildings,
  floors,
  rLoading,
  filteredRoomsTab,
  onEditRoom,
  onDeleteRoom,
  selectedRoomIds,
  onToggleRoom,
  onToggleAll,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  if (rLoading) {
    return (
      <div className="space-y-3">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    );
  }

  const allSelected =
    filteredRoomsTab.length > 0 &&
    filteredRoomsTab.every((r) => selectedRoomIds.has(r.id));

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="p-3 w-10 text-center">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={onToggleAll}
                className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
              />
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الغرفة" : "Room"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "النوع" : "Type"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "التصنيف" : "Classification"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "المبنى" : "Building"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الطابق" : "Floor"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الإشغال" : "Occupancy"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الحالة" : "Status"}
            </th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {filteredRoomsTab.map((r) => {
            const building = buildings.find((b) => b.id === r.buildingId);
            const floor = floors.find((f) => f.id === r.floorId);
            return (
              <tr key={r.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedRoomIds.has(r.id)}
                    onChange={() => onToggleRoom(r.id)}
                    className="w-4 h-4 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                  />
                </td>
                <td className="p-3">
                  <span className="font-bold text-primary">
                    #{r.roomNumber}
                  </span>
                </td>
                <td className="p-3">
                  <span className="px-2 py-0.5 bg-muted rounded text-xs font-medium">
                    {r.roomType}
                  </span>
                </td>
                <td className="p-3">
                  {r.classification ? (
                    <span
                      className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${
                        r.classification.toLowerCase().includes("deluxe")
                          ? "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                          : r.classification.toLowerCase().includes("superior")
                          ? "bg-blue-50 text-blue-800 border-blue-300 dark:bg-blue-950/40 dark:text-blue-300 dark:border-blue-800"
                          : r.classification.toLowerCase().includes("family")
                          ? "bg-purple-50 text-purple-800 border-purple-300 dark:bg-purple-950/40 dark:text-purple-300 dark:border-purple-800"
                          : "bg-muted/70 text-foreground border-border"
                      }`}
                    >
                      {r.classification}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/60 text-xs italic">—</span>
                  )}
                </td>
                <td className="p-3 text-muted-foreground">
                  {building?.name || "—"}
                </td>
                <td className="p-3 text-muted-foreground">
                  {floor
                    ? `${ar ? "الطابق" : "Floor"} ${floor.floorNumber}`
                    : "—"}
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {r.currentOccupancy}/{r.capacity}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${roomStatusBadge(r.status)}`}
                  >
                    {getRoomStatusLabel(r.status, ar)}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <PermissionGate module="housing" action="edit">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEditRoom(r)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate module="housing" action="delete">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteRoom(r)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredRoomsTab.length === 0 && (
            <tr>
              <td
                colSpan={9}
                className="py-12 text-center text-muted-foreground"
              >
                <Home className="w-8 h-8 opacity-30 mx-auto mb-2" />
                <p>{ar ? "لا توجد غرف" : "No rooms found"}</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
