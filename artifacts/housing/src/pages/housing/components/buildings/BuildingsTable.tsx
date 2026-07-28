import { Building2, MapPin, Users, Pencil, Trash2 } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { buildingStatusBadge } from "../../utils";

type Props = {
  buildings: any[];
  floors: any[];
  rooms: any[];
  bLoading: boolean;
  onEditBuilding: (b: any) => void;
  onDeleteBuilding: (b: any) => void;
};

export function BuildingsTable({
  buildings,
  floors,
  rooms,
  bLoading,
  onEditBuilding,
  onDeleteBuilding,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  if (bLoading) {
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
              {ar ? "الاسم" : "Name"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الموقع" : "Location"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الطوابق" : "Floors"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الغرف" : "Rooms"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "السعة" : "Capacity"}
            </th>
            <th className="text-left p-3 font-semibold text-muted-foreground">
              {ar ? "الحالة" : "Status"}
            </th>
            <th className="p-3" />
          </tr>
        </thead>
        <tbody className="divide-y">
          {buildings.map((b) => {
            const bFloors = floors.filter((f) => f.buildingId === b.id);
            const bRooms = rooms.filter((r) => r.buildingId === b.id);
            return (
              <tr key={b.id} className="hover:bg-muted/30 transition-colors">
                <td className="p-3">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
                      <Building2 className="w-4 h-4 text-primary" />
                    </div>
                    <span className="font-semibold">{b.name}</span>
                  </div>
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <MapPin className="w-3 h-3" />
                    {b.location}
                  </span>
                </td>
                <td className="p-3">
                  <Badge variant="secondary">{bFloors.length}</Badge>
                </td>
                <td className="p-3">
                  <Badge variant="secondary">{bRooms.length}</Badge>
                </td>
                <td className="p-3">
                  <span className="flex items-center gap-1 text-muted-foreground">
                    <Users className="w-3 h-3" />
                    {b.capacity}
                  </span>
                </td>
                <td className="p-3">
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${buildingStatusBadge(b.status)}`}
                  >
                    {b.status}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex items-center gap-1 justify-end">
                    <PermissionGate module="housing" action="edit">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => onEditBuilding(b)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                    <PermissionGate module="housing" action="delete">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => onDeleteBuilding(b)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </PermissionGate>
                  </div>
                </td>
              </tr>
            );
          })}
          {buildings.length === 0 && (
            <tr>
              <td
                colSpan={7}
                className="py-12 text-center text-muted-foreground"
              >
                <Building2 className="w-8 h-8 opacity-30 mx-auto mb-2" />
                <p>{ar ? "لا توجد مبانٍ" : "No buildings yet"}</p>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}
