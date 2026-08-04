import { useState } from "react";
import { Search, Building2, BedDouble, Layers } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { PaginationBar } from "@/components/ui/PaginationBar";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roomStatusBadge, statusNorm } from "../utils";

type Props = {
  buildings: any[];
  floors: any[];
  rooms: any[];
  rLoading: boolean;
  onSelectRoom: (room: any) => void;
};

export function AvailabilityTab({
  buildings,
  floors,
  rooms,
  rLoading,
  onSelectRoom,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const pageSize = 12; // using 12 for better grid layout (divisible by 2, 3, 4)

  const filteredRooms = rooms.filter((r) => {
    const matchSearch = r.roomNumber
      .toLowerCase()
      .includes(search.toLowerCase());
    const matchStatus =
      statusFilter === "all" || statusNorm(r.status) === statusFilter;
    return matchSearch && matchStatus;
  });

  const sortedRooms = [...filteredRooms].sort((a, b) => {
    return String(a.roomNumber).localeCompare(String(b.roomNumber), undefined, {
      numeric: true,
    });
  });

  const paginatedRooms = sortedRooms.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  );

  const paginationMeta = {
    page: currentPage,
    limit: pageSize,
    total: sortedRooms.length,
    totalPages: Math.ceil(sortedRooms.length / pageSize),
    hasNextPage: currentPage * pageSize < sortedRooms.length,
    hasPrevPage: currentPage > 1,
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={ar ? "ابحث عن غرفة..." : "Search room..."}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-8"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder={ar ? "كل الحالات" : "All Statuses"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {ar ? "كل الحالات" : "All Statuses"}
            </SelectItem>
            <SelectItem value="available">
              {ar ? "متاح" : "Available"}
            </SelectItem>
            <SelectItem value="occupied">
              {ar ? "مشغول" : "Occupied"}
            </SelectItem>
            <SelectItem value="maintenance">
              {ar ? "صيانة" : "Maintenance"}
            </SelectItem>
            <SelectItem value="reserved">
              {ar ? "محجوز" : "Reserved"}
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {filteredRooms.length} {ar ? "غرفة" : "rooms"}
        </span>
      </div>

      {rLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {[...Array(10)].map((_, i) => (
            <Skeleton key={i} className="h-28 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {paginatedRooms.map((room) => {
            const building = buildings.find((b) => b.id === room.buildingId);
            const floor = floors.find((f) => f.id === room.floorId);
            return (
              <div
                key={room.id}
                className="border rounded-xl p-4 cursor-pointer hover:shadow-md transition-all hover:border-primary/30 bg-card"
                onClick={() => onSelectRoom(room)}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <p className="font-bold text-base">
                      {ar ? "الغرفة" : "Room"} {room.roomNumber}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {room.roomType || "Standard"}
                    </p>
                  </div>
                  <span
                    className={`px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${roomStatusBadge(room.status)}`}
                  >
                    {room.status}
                  </span>
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Building2 className="w-3 h-3" />
                    {building?.name || `Bldg ${room.buildingId}`}
                  </span>
                  <span className="flex items-center gap-1">
                    <BedDouble className="w-3 h-3" />
                    {room.currentOccupancy}/{room.capacity}
                  </span>
                </div>
                {floor && (
                  <div className="mt-2 pt-2 border-t">
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Layers className="w-3 h-3" />
                      {ar ? "الطابق" : "Floor"} {floor.floorNumber}
                    </span>
                  </div>
                )}
              </div>
            );
          })}
          {paginatedRooms.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <BedDouble className="w-8 h-8 opacity-30 mx-auto mb-2" />
              <p className="font-medium">
                {ar ? "لا توجد غرف" : "No rooms found"}
              </p>
            </div>
          )}
        </div>
      )}

      {sortedRooms.length > 0 && (
        <PaginationBar
          pagination={paginationMeta as any}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
