import { Plus, ChevronRight, Layers, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

type Props = {
  buildings: any[];
  floors: any[];
  rooms: any[];
  fLoading: boolean;
  filteredFloors: any[];
  onEditFloor: (f: any) => void;
  onDeleteFloor: (f: any) => void;
};

export function FloorsTable({
  buildings,
  floors,
  rooms,
  fLoading,
  filteredFloors,
  onEditFloor,
  onDeleteFloor,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  if (fLoading) {
    return (
      <div className="space-y-3">
        {[...Array(4)].map((_, i) => (
          <Skeleton key={i} className="h-16 rounded-xl" />
        ))}
      </div>
    );
  }

  return (
    <div className="rounded-xl border overflow-hidden">
      <table className="w-full text-sm">
        <thead className="bg-muted/50">
          <tr>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "المبنى" : "Building"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الطابق" : "Floor"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الوصف" : "Description"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الغرف" : "Rooms"}
            </th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {filteredFloors.map((f) => {
            const building = buildings.find((b) => b.id === f.buildingId);
            const fRooms = rooms.filter((r) => r.floorId === f.id);
            return (
              <tr key={f.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <ChevronRight className="w-3 h-3 text-muted-foreground" />
                    <span className="font-medium">{building?.name || "-"}</span>
                  </span>
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-2">
                    <Layers className="w-4 h-4 text-primary/60" />
                    <span className="font-semibold">
                      {ar ? "الطابق" : "Floor"} {f.floorNumber}
                    </span>
                  </span>
                </td>
                <td className="p-3 text-muted-foreground">
                  {f.description || "—"}
                </td>
                <td className="p-3">
                  <Badge variant="secondary">{fRooms.length}</Badge>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <PermissionGate module="housing" action="edit">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEditFloor(f)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate module="housing" action="delete">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteFloor(f)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </td>
              </tr>
            );
          })}
          {filteredFloors.length === 0 && (
            <tr>
              <td
                colSpan={5}
                className="py-12 text-center text-muted-foreground"
              >
                <Layers className="w-8 h-8 opacity-30 mx-auto mb-2" />
                <p>{ar ? "لا توجد طوابق" : "No floors yet"}</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
