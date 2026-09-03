import { useState, useMemo } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  Brush,
  CheckCircle2,
  RotateCcw,
  Building2,
  Layers,
  BedDouble,
  Users,
  Search,
  Wrench,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataPagination } from "@/components/DataPagination";

interface HousekeepingTabProps {
  propertyId: number;
  buildings: any[];
  floors: any[];
  rooms: any[];
}

export function HousekeepingTab({
  propertyId,
  buildings = [],
  floors = [],
  rooms = [],
}: HousekeepingTabProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  // Filters state
  const [buildingFilter, setBuildingFilter] = useState<string>("all");
  const [floorFilter, setFloorFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState<string>("");

  // Loading state for updating rooms
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // OOS/OOO Modal State
  const [oosRoom, setOosRoom] = useState<any | null>(null);
  const [oosType, setOosType] = useState<"out_of_service" | "out_of_order">("out_of_service");
  const [oosReason, setOosReason] = useState("");
  const [oosStartDate, setOosStartDate] = useState("");
  const [oosEndDate, setOosEndDate] = useState("");
  const [isSubmittingOos, setIsSubmittingOos] = useState(false);

  // Lookup maps for buildings and floors
  const buildingMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const b of buildings) {
      map.set(Number(b.id), b.name);
    }
    return map;
  }, [buildings]);

  const floorMap = useMemo(() => {
    const map = new Map<number, string>();
    for (const f of floors) {
      const label = f.floorNumber
        ? `${ar ? "الطابق" : "Floor"} ${f.floorNumber}`
        : f.name || `#${f.id}`;
      map.set(Number(f.id), label);
    }
    return map;
  }, [floors, ar]);

  // Floors filtered by selected building (if any)
  const filteredFloorOptions = useMemo(() => {
    if (buildingFilter === "all") return floors;
    return floors.filter((f) => String(f.buildingId) === buildingFilter);
  }, [floors, buildingFilter]);

  // Stats calculations
  const dirtyCount = useMemo(() => {
    return rooms.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "dirty" || s === "vacant_dirty";
    }).length;
  }, [rooms]);

  const occupiedDirtyCount = useMemo(() => {
    return rooms.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "occupied_dirty";
    }).length;
  }, [rooms]);

  const cleanedTodayCount = 0; // Static 0 as specified

  const oosCount = useMemo(() => {
    return rooms.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();
      return s === "out_of_service" || s === "oos" || s === "maintenance";
    }).length;
  }, [rooms]);

  // Filtered rooms based on user selection
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      const s = (r.status || "").toLowerCase().trim();

      // Status filter
      if (statusFilter === "dirty") {
        if (s !== "dirty" && s !== "vacant_dirty") return false;
      } else if (statusFilter === "occupied_dirty") {
        if (s !== "occupied_dirty") return false;
      } else if (statusFilter === "out_of_service") {
        if (s !== "out_of_service" && s !== "oos" && s !== "maintenance" && s !== "out_of_order")
          return false;
      } else if (statusFilter === "clean") {
        if (s !== "available" && s !== "clean") return false;
      } else if (statusFilter === "occupied") {
        if (s !== "occupied") return false;
      }

      // Building filter
      if (buildingFilter !== "all" && String(r.buildingId) !== buildingFilter) {
        return false;
      }

      // Floor filter
      if (floorFilter !== "all" && String(r.floorId) !== floorFilter) {
        return false;
      }

      // Search filter
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const matchNumber = (r.roomNumber || "").toLowerCase().includes(q);
        const matchType = (r.roomType || "").toLowerCase().includes(q);
        if (!matchNumber && !matchType) return false;
      }

      return true;
    });
  }, [
    rooms,
    statusFilter,
    buildingFilter,
    floorFilter,
    search,
  ]);

  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(12);

  // Reset page when filters change
  useMemo(() => {
    setCurrentPage(1);
  }, [filteredRooms]);

  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRooms.slice(start, start + pageSize);
  }, [filteredRooms, currentPage, pageSize]);

  // Quick Action Handler
  const handleUpdateStatus = async (room: any, newStatus: string) => {
    setUpdatingId(room.id);
    try {
      const res = await fetch(`/api/rooms/${room.id}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId, status: newStatus }),
      });

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(
          errData.error || (ar ? "فشل تحديث حالة الغرفة" : "Failed to update room status")
        );
      }

      await queryClient.invalidateQueries();

      if (newStatus === "available") {
        toast.success(
          ar
            ? `تم تحديث الغرفة ${room.roomNumber} وجعلها جاهزة/نظيفة`
            : `Room ${room.roomNumber} marked clean & available`
        );
      } else if (newStatus === "occupied") {
        toast.success(
          ar
            ? `تم تنظيف الغرفة المشغولة ${room.roomNumber} بنجاح`
            : `Room ${room.roomNumber} cleaned (Occupied Clean)`
        );
      } else {
        toast.success(
          ar
            ? `تم تحديث حالة الغرفة ${room.roomNumber} بنجاح`
            : `Room ${room.roomNumber} status updated successfully`
        );
      }
    } catch (err: any) {
      toast.error(
        err.message ||
          (ar ? "حدث خطأ أثناء تحديث حالة الغرفة" : "Failed to update room status")
      );
    } finally {
      setUpdatingId(null);
    }
  };

  const handleSubmitOos = async () => {
    if (!oosRoom) return;
    if (!oosStartDate || !oosEndDate) {
      toast.error(ar ? "يرجى تحديد تاريخ البداية والنهاية" : "Please select start and end dates");
      return;
    }
    
    setIsSubmittingOos(true);
    try {
      const descriptionWithDates = `[${oosStartDate} to ${oosEndDate}] ${oosReason || (oosType === "out_of_order" ? "Out of Order" : "Out of Service")}`;
      
      // 1. Create a Maintenance ticket for tracking
      await fetch("/api/maintenance", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          roomId: oosRoom.id,
          category: "housekeeping",
          problemType: oosType, // out_of_service or out_of_order
          description: descriptionWithDates,
          priority: "high",
          dueDate: new Date(oosEndDate).toISOString(),
        }),
      });
      // The backend will automatically change the room status to 'out_of_service'
      // But we also want to support 'out_of_order' properly in the rooms table.
      // So we make a direct patch to the room just to be safe if it's out_of_order.
      if (oosType === "out_of_order") {
        await fetch(`/api/rooms/${oosRoom.id}/status`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ propertyId, status: "out_of_order" }),
        });
      }

      setOosRoom(null);
      setOosReason("");
      setOosStartDate("");
      setOosEndDate("");
      
      queryClient.invalidateQueries({ queryKey: ["/api/rooms", propertyId] });
      queryClient.invalidateQueries({ queryKey: ["/api/maintenance", propertyId] });
      toast.success(ar ? "تم إغلاق الغرفة وإنشاء التذكرة" : "Room closed and ticket created");
    } catch (err: any) {
      toast.error(err.message || "Error");
    } finally {
      setIsSubmittingOos(false);
    }
  };

  // Helper for status badge styling
  const getStatusBadge = (status: string) => {
    const s = (status || "").toLowerCase().trim();
    if (s === "dirty" || s === "vacant_dirty") {
      return {
        className:
          "bg-orange-100 text-orange-800 dark:bg-orange-950/80 dark:text-orange-300 border-orange-300 dark:border-orange-800",
        label: ar ? "تحتاج تنظيف" : "Dirty (Vacant)",
      };
    }
    if (s === "occupied_dirty") {
      return {
        className:
          "bg-purple-100 text-purple-800 dark:bg-purple-950/80 dark:text-purple-300 border-purple-300 dark:border-purple-800",
        label: ar ? "مشغولة تحتاج تنظيف" : "Occupied Dirty",
      };
    }
    if (s === "out_of_service" || s === "oos" || s === "maintenance") {
      return {
        className:
          "bg-amber-100 text-amber-800 dark:bg-amber-950/80 dark:text-amber-300 border-amber-300 dark:border-amber-800",
        label: ar ? "صيانة مؤقتة" : "Out of Service",
      };
    }
    if (s === "out_of_order") {
      return {
        className:
          "bg-red-100 text-red-800 dark:bg-red-950/80 dark:text-red-300 border-red-300 dark:border-red-800",
        label: ar ? "خارج الخدمة" : "Out of Order",
      };
    }
    return {
      className: "bg-muted text-muted-foreground border-border",
      label: status || (ar ? "أخرى" : "Other"),
    };
  };

  return (
    <div className="space-y-6">
      {/* ── 1. STATS ROW (4 CARDS) ── */}
      <div className="grid gap-4 grid-cols-2 md:grid-cols-4">
        {/* 🟠 Dirty rooms */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm border-orange-200/80 dark:border-orange-900/40 bg-gradient-to-br from-orange-50/40 to-background dark:from-orange-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-orange-700 dark:text-orange-400">
              {ar ? "غرف غير نظيفة (شاغرة)" : "Dirty (Vacant)"}
            </span>
            <div className="p-1.5 rounded-lg bg-orange-100 dark:bg-orange-900/40 text-orange-600 dark:text-orange-400">
              <Brush className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-orange-600 dark:text-orange-400">
            {dirtyCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {ar ? "شاغرة تحتاج تنظيف وتجهيز" : "Vacant rooms needing cleaning"}
          </p>
        </div>

        {/* 🟣 Occupied Dirty rooms */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm border-purple-200/80 dark:border-purple-900/40 bg-gradient-to-br from-purple-50/40 to-background dark:from-purple-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-purple-700 dark:text-purple-400">
              {ar ? "مشغولة تحتاج تنظيف" : "Occupied Dirty"}
            </span>
            <div className="p-1.5 rounded-lg bg-purple-100 dark:bg-purple-900/40 text-purple-600 dark:text-purple-400">
              <Users className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-purple-600 dark:text-purple-400">
            {occupiedDirtyCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {ar ? "نزلاء بحاجة لخدمة الغرف" : "Occupied needing housekeeping"}
          </p>
        </div>

        {/* 🟢 Cleaned today */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm border-emerald-200/80 dark:border-emerald-900/40 bg-gradient-to-br from-emerald-50/40 to-background dark:from-emerald-950/10">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-400">
              {ar ? "تم تنظيفها اليوم" : "Cleaned Today"}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-400">
              <CheckCircle2 className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-emerald-600 dark:text-emerald-400">
            {cleanedTodayCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {ar ? "إجمالي الغرف المنجزة اليوم" : "Rooms cleaned today"}
          </p>
        </div>

        {/* ⚪ Out of Service */}
        <div className="p-4 rounded-xl border bg-card text-card-foreground shadow-sm border-slate-200 dark:border-slate-800 bg-gradient-to-br from-slate-50/50 to-background dark:from-slate-900/20">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-700 dark:text-slate-300">
              {ar ? "صيانة مؤقتة" : "Out of Service"}
            </span>
            <div className="p-1.5 rounded-lg bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="text-2xl font-black text-slate-700 dark:text-slate-300">
            {oosCount}
          </div>
          <p className="text-[11px] text-muted-foreground mt-1">
            {ar ? "غرف خارج الخدمة مؤقتاً" : "Rooms out of service"}
          </p>
        </div>
      </div>

      {/* ── 2. FILTERS ── */}
      <div className="flex flex-wrap items-center gap-3 p-4 bg-card border rounded-xl shadow-xs">
        {/* Building Select */}
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            {ar ? "المبنى" : "Building"}
          </label>
          <Select
            value={buildingFilter}
            onValueChange={(val) => {
              setBuildingFilter(val);
              setFloorFilter("all");
            }}
          >
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={ar ? "جميع المباني" : "All Buildings"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "جميع المباني" : "All Buildings"}</SelectItem>
              {buildings.map((b) => (
                <SelectItem key={b.id} value={String(b.id)}>
                  {b.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Floor Select */}
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            {ar ? "الطابق" : "Floor"}
          </label>
          <Select value={floorFilter} onValueChange={setFloorFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={ar ? "جميع الطوابق" : "All Floors"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">{ar ? "جميع الطوابق" : "All Floors"}</SelectItem>
              {filteredFloorOptions.map((f) => (
                <SelectItem key={f.id} value={String(f.id)}>
                  {f.floorNumber
                    ? ar
                      ? `الطابق ${f.floorNumber}`
                      : `Floor ${f.floorNumber}`
                    : f.name || `#${f.id}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Status Filter */}
        <div className="flex-1 min-w-[180px]">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            {ar ? "الحالة" : "Status"}
          </label>
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="h-9 text-xs">
              <SelectValue placeholder={ar ? "الكل" : "All"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                {ar ? "الكل (جميع الغرف)" : "All Rooms"}
              </SelectItem>
              <SelectItem value="clean">
                🟢 {ar ? "نظيفة/جاهزة" : "Clean/Available"}
              </SelectItem>
              <SelectItem value="occupied">
                🔵 {ar ? "مشغولة نظيفة" : "Occupied Clean"}
              </SelectItem>
              <SelectItem value="dirty">
                🟠 {ar ? "تحتاج تنظيف" : "Dirty (Vacant)"}
              </SelectItem>
              <SelectItem value="occupied_dirty">
                🟣 {ar ? "مشغولة تحتاج تنظيف" : "Occupied Dirty"}
              </SelectItem>
              <SelectItem value="out_of_service">
                ⚪ {ar ? "صيانة مؤقتة" : "Out of Service"}
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Room Search */}
        <div className="flex-1 min-w-[150px]">
          <label className="text-xs font-medium text-muted-foreground block mb-1.5">
            {ar ? "بحث برقم الغرفة" : "Search Room"}
          </label>
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={ar ? "رقم الغرفة أو النوع..." : "Room # or type..."}
              className="h-9 text-xs pl-8"
            />
          </div>
        </div>
      </div>

      {/* ── 3. ROOM CARDS GRID / EMPTY STATE ── */}
      {rooms.length === 0 ? (
        /* Empty State: No rooms at all */
        <div className="flex flex-col items-center justify-center py-16 px-4 text-center border rounded-2xl bg-card shadow-xs">
          <div className="w-16 h-16 rounded-full bg-emerald-100 dark:bg-emerald-950/60 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4 shadow-xs">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h3 className="text-xl font-bold text-emerald-700 dark:text-emerald-300">
            {ar ? "لا توجد غرف مضافة!" : "No rooms added!"}
          </h3>
          <p className="text-sm text-muted-foreground mt-1 max-w-md">
            {ar
              ? "يرجى إضافة الغرف إلى العقار للبدء."
              : "Please add rooms to the property to begin."}
          </p>
        </div>
      ) : filteredRooms.length === 0 ? (
        /* Empty State: Filter matched nothing */
        <div className="flex flex-col items-center justify-center py-14 px-4 text-center border rounded-2xl bg-card shadow-xs">
          <p className="text-base font-semibold text-muted-foreground">
            {ar
              ? "لا توجد غرف تطابق معايير الفلترة المحددة"
              : "No rooms match the selected filters"}
          </p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-3 text-xs text-primary"
            onClick={() => {
              setBuildingFilter("all");
              setFloorFilter("all");
              setStatusFilter("all");
              setSearch("");
            }}
          >
            {ar ? "إعادة تعيين الفلاتر" : "Reset filters"}
          </Button>
        </div>
      ) : (
        /* Room cards grid */
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
            {paginatedRooms.map((room) => {
              const normStatus = (room.status || "").toLowerCase().trim();
              const badge = getStatusBadge(normStatus);

              const buildingName = room.buildingId
                ? buildingMap.get(Number(room.buildingId)) || `Building ${room.buildingId}`
                : ar
                ? "غير محدد"
                : "Unassigned";

            const floorName = room.floorId
              ? floorMap.get(Number(room.floorId)) || `Floor ${room.floorId}`
              : ar
              ? "طابق غير محدد"
              : "No Floor";

            const isUpdating = updatingId === room.id;

            return (
              <div
                key={room.id}
                className="p-4 rounded-xl border bg-card shadow-sm hover:shadow-md transition-shadow flex flex-col justify-between"
              >
                <div>
                  {/* Header: Room number + Badge */}
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div className="min-w-0">
                      <span className="text-2xl font-black tracking-tight text-primary">
                        {room.roomNumber}
                      </span>
                      <div className="text-[10px] sm:text-xs text-muted-foreground flex items-center gap-1.5 mt-0.5 whitespace-nowrap">
                        <Building2 className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                        <span className="truncate max-w-[80px] sm:max-w-[100px]">{buildingName}</span>
                        <span>•</span>
                        <Layers className="w-3.5 h-3.5 text-muted-foreground/70 shrink-0" />
                        <span className="truncate max-w-[60px] sm:max-w-[100px]">{floorName}</span>
                      </div>
                    </div>
                    <Badge
                      className={`text-[10px] sm:text-[11px] font-bold px-1.5 py-0.5 border text-center ${badge.className}`}
                    >
                      {badge.label}
                    </Badge>
                  </div>

                  {/* Room type + Capacity */}
                  <div className="my-3 py-2 px-3 rounded-lg bg-muted/40 text-xs flex items-center justify-between text-muted-foreground">
                    <div className="flex items-center gap-1.5">
                      <BedDouble className="w-3.5 h-3.5 text-foreground/70" />
                      <span className="font-medium text-foreground">
                        {room.roomType || (ar ? "قياسي" : "Standard")}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Users className="w-3.5 h-3.5 text-foreground/70" />
                      <span>
                        {ar
                          ? `السعة: ${room.capacity || 1}`
                          : `Capacity: ${room.capacity || 1}`}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Quick Action Button */}
                <div className="mt-2 pt-2 border-t border-border/50 flex gap-2">
                  {/* For 'dirty' */}
                  {(normStatus === "dirty" || normStatus === "vacant_dirty") && (
                    <Button
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(room, "available")}
                      className="flex-1 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold text-xs shadow-xs gap-1.5 px-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>
                          {ar ? "✅ تنظيف" : "✅ Clean"}
                        </span>
                      )}
                    </Button>
                  )}

                  {/* For 'occupied_dirty' */}
                  {normStatus === "occupied_dirty" && (
                    <Button
                      size="sm"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(room, "occupied")}
                      className="flex-1 bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs shadow-xs gap-1.5 px-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>
                          {ar ? "✅ تنظيف" : "✅ Clean"}
                        </span>
                      )}
                    </Button>
                  )}

                  {/* For 'out_of_service' */}
                  {(normStatus === "out_of_service" ||
                    normStatus === "oos" ||
                    normStatus === "maintenance") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(room, "available")}
                      className="flex-1 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-foreground font-semibold text-xs shadow-xs gap-1.5 px-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <>
                          <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
                          <span>
                            {ar
                              ? "↩️ متاح"
                              : "↩️ Avail."}
                          </span>
                        </>
                      )}
                    </Button>
                  )}

                  {/* For 'available/clean' */}
                  {(normStatus === "available" || normStatus === "clean") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(room, "dirty")}
                      className="flex-1 border-orange-200 dark:border-orange-800 hover:bg-orange-50 dark:hover:bg-orange-950/30 text-orange-700 dark:text-orange-400 font-semibold text-xs shadow-xs gap-1.5 px-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>
                          {ar ? "🧹 غير نظيف" : "🧹 Dirty"}
                        </span>
                      )}
                    </Button>
                  )}

                  {/* For 'occupied' */}
                  {(normStatus === "occupied" || normStatus === "occupied_clean") && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdating}
                      onClick={() => handleUpdateStatus(room, "occupied_dirty")}
                      className="flex-1 border-purple-200 dark:border-purple-800 hover:bg-purple-50 dark:hover:bg-purple-950/30 text-purple-700 dark:text-purple-400 font-semibold text-xs shadow-xs gap-1.5 px-2"
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <span>
                          {ar ? "🧹 غير نظيف" : "🧹 Dirty"}
                        </span>
                      )}
                    </Button>
                  )}

                  {/* OOS Button for all except OOS itself */}
                  {normStatus !== "out_of_service" && normStatus !== "oos" && normStatus !== "maintenance" && normStatus !== "out_of_order" && (
                    <Button
                      size="sm"
                      variant="outline"
                      disabled={isUpdating}
                      onClick={() => {
                        setOosRoom(room);
                        setOosType("out_of_service");
                        setOosReason("");
                        setOosStartDate("");
                        setOosEndDate("");
                      }}
                      className="flex-1 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-400 font-semibold text-[11px] shadow-xs gap-1 px-1"
                      title={ar ? "إغلاق الغرفة للصيانة" : "Close room for service"}
                    >
                      {isUpdating ? (
                        <Loader2 className="w-3 h-3 animate-spin" />
                      ) : (
                        <span>
                          {ar ? "🚫 إغلاق" : "🚫 Close"}
                        </span>
                      )}
                    </Button>
                  )}
                </div>
              </div>
            );
          })}
          </div>
          {filteredRooms.length > 0 && (
            <DataPagination
              total={filteredRooms.length}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
            />
          )}
        </div>
      )}

      {/* OOS / OOO Dialog */}
      <Dialog open={!!oosRoom} onOpenChange={(open) => !open && setOosRoom(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {ar ? "إغلاق الغرفة للخدمة" : "Close Room for Service"} - {oosRoom?.roomNumber}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>{ar ? "نوع الإغلاق" : "Closure Type"}</Label>
              <Select value={oosType} onValueChange={(v: any) => setOosType(v)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="out_of_service">
                    {ar ? "صيانة مؤقتة أو نظافة" : "Out of Service (Minor)"}
                  </SelectItem>
                  <SelectItem value="out_of_order">
                    {ar ? "خارج الخدمة لخلل جسيم" : "Out of Order (Major)"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "السبب / الملاحظات" : "Reason / Notes"}</Label>
              <Textarea 
                value={oosReason}
                onChange={(e) => setOosReason(e.target.value)}
                placeholder={ar ? "اذكر سبب إغلاق الغرفة..." : "Reason for closing..."}
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{ar ? "من تاريخ *" : "From Date *"}</Label>
                <Input 
                  type="date"
                  value={oosStartDate}
                  onChange={(e) => setOosStartDate(e.target.value)}
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>{ar ? "إلى تاريخ *" : "To Date *"}</Label>
                <Input 
                  type="date"
                  value={oosEndDate}
                  onChange={(e) => setOosEndDate(e.target.value)}
                  min={oosStartDate || undefined}
                  required
                />
              </div>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setOosRoom(null)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSubmitOos} disabled={isSubmittingOos}>
              {isSubmittingOos && <Loader2 className="w-4 h-4 mr-2 animate-spin" />}
              {ar ? "تأكيد الإغلاق" : "Confirm Closure"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
