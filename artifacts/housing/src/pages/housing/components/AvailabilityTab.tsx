import { useState } from "react";
import { useDebounce } from "@/hooks/use-debounce";
import { Search, Building2, BedDouble, Layers } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { DataPagination } from "@/components/DataPagination";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { roomStatusBadge, statusNorm, getRoomStatusLabel } from "../utils";

import { useListRooms } from "@workspace/api-client-react";

type Props = {
  propertyId: number;
  buildings: any[];
  floors: any[];
  rooms: any[];
  rLoading: boolean;
  onSelectRoom: (room: any) => void;
};



export function AvailabilityTab({
  propertyId,
  buildings,
  floors,
  onSelectRoom,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [statusFilter, setStatusFilter] = useState("all");
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);

  const { data: _rDataWrapper, isLoading: rLoadingQuery, isFetching: rFetching } = useListRooms(
    { 
      propertyId, 
      limit: pageSize, 
      page: currentPage, 
      search: debouncedSearch,
      status: statusFilter === "all" ? undefined : statusFilter
    } as any,
    { query: { keepPreviousData: true } as any }
  );

  const rData = (_rDataWrapper as any)?.data || [];
  const paginationMeta = (_rDataWrapper as any)?.pagination || { total: 0 };
  const rLoading = rLoadingQuery && rData.length === 0;

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
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                <span>{ar ? "شاغرة (جاهزة)" : "Vacant Clean"}</span>
              </div>
            </SelectItem>
            <SelectItem value="dirty">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                <span>{ar ? "تحتاج تنظيف" : "Vacant Dirty"}</span>
              </div>
            </SelectItem>
            <SelectItem value="occupied">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                <span>{ar ? "مشغولة" : "Occupied Clean"}</span>
              </div>
            </SelectItem>
            <SelectItem value="occupied_dirty">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-amber-600 shrink-0" />
                <span>{ar ? "مشغولة (تحتاج تنظيف)" : "Occupied Dirty"}</span>
              </div>
            </SelectItem>
            <SelectItem value="occupied_vacation">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-purple-500 shrink-0" />
                <span>{ar ? "في إجازة" : "On Vacation"}</span>
              </div>
            </SelectItem>
            <SelectItem value="out_of_service">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                <span>{ar ? "صيانة مؤقتة" : "Out of Service"}</span>
              </div>
            </SelectItem>
            <SelectItem value="out_of_order">
              <div className="flex items-center gap-2">
                <span className="w-2 h-2 rounded-full bg-red-500 shrink-0" />
                <span>{ar ? "خارج الخدمة" : "Out of Order"}</span>
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
        <span className="text-sm text-muted-foreground">
          {paginationMeta.total} {ar ? "غرفة" : "rooms"}
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
          {rData.map((room: any) => {
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
                    className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roomStatusBadge(room.status)}`}
                  >
                    {getRoomStatusLabel(room.status, ar)}
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
          {rData.length === 0 && (
            <div className="col-span-full py-12 text-center text-muted-foreground">
              <BedDouble className="w-8 h-8 opacity-30 mx-auto mb-2" />
              <p className="font-medium">
                {ar ? "لا توجد غرف" : "No rooms found"}
              </p>
            </div>
          )}
        </div>
      )}

      {paginationMeta.total > 0 && (
        <DataPagination
          total={paginationMeta.total}
          pageSize={pageSize}
          onPageSizeChange={(size) => {
            setPageSize(size);
            setCurrentPage(1);
          }}
          currentPage={currentPage}
          onPageChange={setCurrentPage}
        />
      )}
    </div>
  );
}
