// @ts-nocheck
import { useState, useMemo } from "react";
import { useLanguage } from "@/context/LanguageContext";
import { useLocation } from "wouter";
import {
  BedDouble,
  Building2,
  Layers,
  Search,
  Users,
  Palmtree,
  UserPlus,
  Sparkles,
  CheckCircle,
  Wrench,
  AlertCircle,
  Clock,
  Sparkle,
  Eye,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { DataPagination } from "@/components/DataPagination";
import {
  ROOM_STATUS_OPTIONS,
  roomStatusBadge,
  getRoomStatusLabel,
  statusNorm,
} from "../utils";

type Props = {
  propertyId: number;
  buildings: any[];
  floors: any[];
  rooms: any[];
  assignments: any[];
  profiles: any[];
  onSelectRoom: (room: any) => void;
};

export function RoomSpaceViewTab({
  propertyId,
  buildings = [],
  floors = [],
  rooms = [],
  assignments = [],
  profiles = [],
  onSelectRoom,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [, setLocation] = useLocation();

  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(20);

  // Map profiles and buildings/floors
  const profileMap = useMemo(() => {
    const map = new Map<number, any>();
    for (const p of profiles) map.set(p.id, p);
    return map;
  }, [profiles]);

  const buildingMap = useMemo(() => {
    return Object.fromEntries(buildings.map((b) => [b.id, b.name]));
  }, [buildings]);

  const floorMap = useMemo(() => {
    return Object.fromEntries(floors.map((f) => [f.id, f.floorNumber]));
  }, [floors]);

  // Active assignments by room ID
  const assignmentsByRoom = useMemo(() => {
    const map: Record<number, any[]> = {};
    for (const a of assignments) {
      if (a.status === "ACTIVE") {
        if (!map[a.roomId]) map[a.roomId] = [];
        map[a.roomId].push(a);
      }
    }
    return map;
  }, [assignments]);

  // Filtered rooms
  const filteredRooms = useMemo(() => {
    return rooms.filter((r) => {
      if (selectedBuildingId !== "all" && String(r.buildingId) !== selectedBuildingId) {
        return false;
      }
      if (selectedFloorId !== "all" && String(r.floorId) !== selectedFloorId) {
        return false;
      }
      if (statusFilter !== "all" && statusNorm(r.status) !== statusNorm(statusFilter)) {
        return false;
      }
      if (search.trim()) {
        const q = search.trim().toLowerCase();
        const roomMatch = (r.roomNumber || "").toLowerCase().includes(q);
        const roomTypeMatch = (r.roomType || "").toLowerCase().includes(q);
        const occupants = assignmentsByRoom[r.id] || [];
        const occupantMatch = occupants.some((a) => {
          const prof = profileMap.get(a.profileId);
          if (!prof) return false;
          return (
            (prof.firstName || "").toLowerCase().includes(q) ||
            (prof.lastName || "").toLowerCase().includes(q) ||
            (prof.profileId || "").toLowerCase().includes(q) ||
            (prof.department || "").toLowerCase().includes(q) ||
            (prof.jobTitle || "").toLowerCase().includes(q)
          );
        });
        if (!roomMatch && !roomTypeMatch && !occupantMatch) return false;
      }
      return true;
    });
  }, [rooms, selectedBuildingId, selectedFloorId, statusFilter, search, assignmentsByRoom, profileMap]);

  // KPI Calculations
  const stats = useMemo(() => {
    const totalRooms = rooms.length;
    let totalBeds = 0;
    let occupiedBeds = 0;
    let vacationBeds = 0;

    for (const r of rooms) {
      const cap = r.capacity || 1;
      totalBeds += cap;
      const occs = assignmentsByRoom[r.id] || [];
      occupiedBeds += occs.length;
      for (const a of occs) {
        const prof = profileMap.get(a.profileId);
        if (prof?.status === "VACATION") vacationBeds++;
      }
    }

    const freeBeds = Math.max(0, totalBeds - occupiedBeds);
    const occPct = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return { totalRooms, totalBeds, occupiedBeds, freeBeds, vacationBeds, occPct };
  }, [rooms, assignmentsByRoom, profileMap]);

  // Paginate filtered rooms
  const paginatedRooms = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return filteredRooms.slice(start, start + pageSize);
  }, [filteredRooms, currentPage, pageSize]);

  // Group paginated rooms by Building -> Floor
  const groupedRooms = useMemo(() => {
    const map = new Map<string, { buildingName: string; floorNum: string; rooms: any[] }>();

    for (const r of paginatedRooms) {
      const bName = buildingMap[r.buildingId] || (ar ? `مبنى ${r.buildingId}` : `Building ${r.buildingId}`);
      const fNum = floorMap[r.floorId] || (ar ? `دور ${r.floorId}` : `Floor ${r.floorId}`);
      const key = `${r.buildingId}_${r.floorId}`;

      if (!map.has(key)) {
        map.set(key, { buildingName: bName, floorNum: String(fNum), rooms: [] });
      }
      map.get(key)!.rooms.push(r);
    }

    // Sort rooms by roomNumber numerically if possible
    map.forEach((group) => {
      group.rooms.sort((a, b) => {
        const na = parseInt(a.roomNumber, 10);
        const nb = parseInt(b.roomNumber, 10);
        if (!isNaN(na) && !isNaN(nb)) return na - nb;
        return (a.roomNumber || "").localeCompare(b.roomNumber || "");
      });
    });

    return Array.from(map.values());
  }, [paginatedRooms, buildingMap, floorMap, ar]);

  const handleQuickAssign = (roomId: number, bedNum: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setLocation(`/accommodation/reservations?roomId=${roomId}&bed=${bedNum}`);
  };

  return (
    <div className="space-y-6">
      {/* ── KPI HIGHLIGHTS STRIP ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        <div className="p-3.5 rounded-xl border bg-card/60 backdrop-blur shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <Building2 className="w-4 h-4 text-primary" />
            <span>{ar ? "إجمالي الغرف" : "Total Rooms"}</span>
          </div>
          <p className="text-2xl font-black mt-1 text-foreground">{stats.totalRooms}</p>
          <span className="text-[11px] text-muted-foreground">{filteredRooms.length} {ar ? "مطابقة للفلتر" : "filtered"}</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card/60 backdrop-blur shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <BedDouble className="w-4 h-4 text-indigo-500" />
            <span>{ar ? "إجمالي مساحات الأسرة" : "Total Bed Spaces"}</span>
          </div>
          <p className="text-2xl font-black mt-1 text-indigo-700 dark:text-indigo-300">{stats.totalBeds}</p>
          <span className="text-[11px] text-muted-foreground">{ar ? "سعة الطاقة الإجمالية" : "Max Capacity"}</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-card/60 backdrop-blur shadow-sm">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-semibold">
            <Users className="w-4 h-4 text-blue-500" />
            <span>{ar ? "الأسرة المشغولة" : "Occupied Beds"}</span>
          </div>
          <p className="text-2xl font-black mt-1 text-blue-700 dark:text-blue-300">{stats.occupiedBeds}</p>
          <span className="text-[11px] text-muted-foreground font-semibold">{stats.occPct}% {ar ? "نسبة الإشغال" : "Occupancy"}</span>
        </div>

        <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 backdrop-blur shadow-sm">
          <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300 text-xs font-bold">
            <CheckCircle className="w-4 h-4 text-emerald-600" />
            <span>{ar ? "الأسرة المتاحة (فيكنت)" : "Free Bed Spaces"}</span>
          </div>
          <p className="text-2xl font-black mt-1 text-emerald-600 dark:text-emerald-400">{stats.freeBeds}</p>
          <span className="text-[11px] text-emerald-700/80 dark:text-emerald-300/80 font-medium">
            {ar ? "جاهزة للتسكين الفوري" : "Ready to assign"}
          </span>
        </div>

        <div className="p-3.5 rounded-xl border bg-amber-500/10 border-amber-500/20 backdrop-blur shadow-sm col-span-2 sm:col-span-1">
          <div className="flex items-center gap-2 text-amber-800 dark:text-amber-300 text-xs font-bold">
            <Palmtree className="w-4 h-4 text-amber-600" />
            <span>{ar ? "في إجازة (محجوز)" : "On Vacation"}</span>
          </div>
          <p className="text-2xl font-black mt-1 text-amber-600 dark:text-amber-400">{stats.vacationBeds}</p>
          <span className="text-[11px] text-amber-700/80 dark:text-amber-300/80 font-medium">
            {ar ? "أسرة محجوزة لمجازين" : "Reserved for leaves"}
          </span>
        </div>
      </div>

      {/* ── FILTER & CONTROL BAR ── */}
      <div className="p-4 rounded-xl border bg-card shadow-sm space-y-3">
        <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-center justify-between">
          {/* Search Input */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              placeholder={ar ? "ابحث برقم الغرفة، اسم النزيل، كود الموظف، أو القسم..." : "Search room, occupant, code..."}
              value={search}
              onChange={(e) => {
                setSearch(e.target.value);
                setCurrentPage(1);
              }}
              className="pl-9 bg-muted/20"
            />
          </div>

          {/* Buildings & Floors Pill Dropdowns */}
          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={selectedBuildingId}
              onChange={(e) => {
                setSelectedBuildingId(e.target.value);
                setSelectedFloorId("all");
                setCurrentPage(1);
              }}
              className="h-9 px-3 py-1 text-xs font-semibold rounded-lg border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{ar ? "🏢 جميع المباني" : "🏢 All Buildings"}</option>
              {buildings.map((b) => (
                <option key={b.id} value={String(b.id)}>
                  🏢 {b.name}
                </option>
              ))}
            </select>

            <select
              value={selectedFloorId}
              onChange={(e) => {
                setSelectedFloorId(e.target.value);
                setCurrentPage(1);
              }}
              className="h-9 px-3 py-1 text-xs font-semibold rounded-lg border bg-background text-foreground shadow-sm focus:outline-none focus:ring-2 focus:ring-primary"
            >
              <option value="all">{ar ? "📑 جميع الأدوار" : "📑 All Floors"}</option>
              {floors
                .filter((f) => selectedBuildingId === "all" || String(f.buildingId) === selectedBuildingId)
                .map((f) => (
                  <option key={f.id} value={String(f.id)}>
                    {ar ? `دور ${f.floorNumber}` : `Floor ${f.floorNumber}`}
                  </option>
                ))}
            </select>

            <Button
              size="sm"
              onClick={() => setLocation("/accommodation/reservations")}
              className="gap-2 bg-gradient-to-r from-primary to-indigo-600 text-white font-semibold shadow-md"
            >
              <UserPlus className="w-4 h-4" />
              {ar ? "تسكين موظف" : "Assign Room"}
            </Button>
          </div>
        </div>

        {/* Status Filter Badges Strip */}
        <div className="flex items-center gap-1.5 flex-wrap pt-2 border-t">
          <button
            onClick={() => {
              setStatusFilter("all");
              setCurrentPage(1);
            }}
            className={`px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${
              statusFilter === "all"
                ? "bg-primary text-primary-foreground shadow"
                : "bg-muted/50 text-muted-foreground hover:bg-muted hover:text-foreground"
            }`}
          >
            {ar ? "الكل" : "All"} ({rooms.length})
          </button>

          {ROOM_STATUS_OPTIONS.map((opt) => {
            const count = rooms.filter((r) => statusNorm(r.status) === opt.value).length;
            const isSel = statusFilter === opt.value;
            return (
              <button
                key={opt.value}
                onClick={() => {
                  setStatusFilter(isSel ? "all" : opt.value);
                  setCurrentPage(1);
                }}
                className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all border ${
                  isSel
                    ? "ring-2 ring-primary shadow-sm bg-primary/10 border-primary font-black"
                    : "border-transparent bg-muted/40 text-muted-foreground hover:bg-muted"
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${opt.dot}`} />
                <span>{ar ? opt.shortAr : opt.labelEn}</span>
                <span className="text-[10px] opacity-70 px-1 py-0.2 rounded bg-black/10 dark:bg-white/10">
                  {count}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── VISUAL ROOM & BED MATRIX ── */}
      {groupedRooms.length === 0 ? (
        <div className="p-12 text-center border-2 border-dashed rounded-2xl bg-muted/10">
          <Building2 className="w-12 h-12 mx-auto mb-3 opacity-25 text-muted-foreground" />
          <h3 className="font-bold text-base text-foreground">
            {ar ? "لا توجد غرف تطابق معايير الفلترة" : "No rooms match your filter"}
          </h3>
          <p className="text-xs text-muted-foreground mt-1">
            {ar ? "جرب تغيير فلاتر البحث أو الحالة أو المبنى" : "Try changing your search or filters"}
          </p>
        </div>
      ) : (
        groupedRooms.map((group, gIdx) => (
          <div key={gIdx} className="space-y-3">
            {/* Floor / Building Section Header */}
            <div className="flex items-center justify-between px-3 py-2 rounded-xl bg-muted/40 border">
              <div className="flex items-center gap-2.5">
                <Building2 className="w-4 h-4 text-primary" />
                <span className="font-extrabold text-sm text-foreground">
                  {group.buildingName}
                </span>
                <span className="text-muted-foreground font-light">•</span>
                <span className="text-xs font-semibold px-2 py-0.5 rounded bg-primary/10 text-primary">
                  {group.floorNum}
                </span>
              </div>
              <span className="text-xs font-bold text-muted-foreground">
                {group.rooms.length} {ar ? "غرف" : "Rooms"}
              </span>
            </div>

            {/* Room Cards Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {group.rooms.map((room) => {
                const occupants = assignmentsByRoom[room.id] || [];
                const capacity = room.capacity || 1;
                const occCount = occupants.length;
                const isFull = occCount >= capacity;
                const freeCount = Math.max(0, capacity - occCount);

                // Create array of bed slots 1..capacity
                const bedSlots = Array.from({ length: capacity }, (_, i) => {
                  const bedNum = i + 1;
                  const occ = occupants.find((a) => a.bedNumber === bedNum) || occupants[i];
                  const profile = occ ? profileMap.get(occ.profileId) : null;
                  return { bedNum, occ, profile };
                });

                return (
                  <div
                    key={room.id}
                    onClick={() => onSelectRoom(room)}
                    className="group flex flex-col rounded-2xl border bg-card hover:shadow-lg transition-all duration-300 hover:border-primary/50 overflow-hidden cursor-pointer"
                  >
                    {/* Room Header */}
                    <div className="p-3.5 border-b bg-muted/20 flex items-start justify-between gap-2">
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="text-lg font-black tracking-tight text-foreground font-mono">
                            {room.roomNumber}
                          </span>
                          <span className={`text-[11px] px-2 py-0.5 rounded-full font-bold ${roomStatusBadge(room.status)}`}>
                            {getRoomStatusLabel(room.status, ar)}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 mt-1 text-[11px] text-muted-foreground font-medium">
                          <span>{room.roomType || (ar ? "غرفة قياسية" : "Standard")}</span>
                          {room.gender && (
                            <>
                              <span>•</span>
                              <span className="capitalize">
                                {room.gender === "male" ? (ar ? "رجال 👨" : "Male") : (ar ? "سيدات 👩" : "Female")}
                              </span>
                            </>
                          )}
                        </div>
                      </div>

                      <div className="text-end">
                        <span className={`text-xs font-extrabold px-2 py-1 rounded-lg ${
                          isFull
                            ? "bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                            : freeCount === capacity
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                        }`}>
                          {occCount}/{capacity} {ar ? "سرير" : "Beds"}
                        </span>
                      </div>
                    </div>

                    {/* Room Bed Spaces Matrix */}
                    <div className="p-3 flex-1 flex flex-col gap-2">
                      <p className="text-[10px] uppercase font-bold tracking-wider text-muted-foreground px-1">
                        {ar ? "مخطط الأسرة والمساحات:" : "Bed Spaces Layout:"}
                      </p>

                      {bedSlots.map(({ bedNum, occ, profile }) => {
                        const isVacation = profile?.status === "VACATION";

                        if (profile) {
                          // Occupied Bed Space
                          return (
                            <div
                              key={bedNum}
                              className={`p-2.5 rounded-xl border text-xs flex items-center gap-2.5 transition-all ${
                                isVacation
                                  ? "bg-amber-500/10 border-amber-500/30 text-amber-950 dark:text-amber-200"
                                  : "bg-blue-500/5 border-blue-500/20 text-foreground"
                              }`}
                            >
                              <div className={`w-7 h-7 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${
                                isVacation
                                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                                  : "bg-blue-500/20 text-blue-700 dark:text-blue-300"
                              }`}>
                                {isVacation ? <Palmtree className="w-4 h-4" /> : bedNum}
                              </div>

                              <div className="flex-1 min-w-0">
                                <p className="font-bold truncate text-[12px]">
                                  {profile.firstName} {profile.lastName}
                                </p>
                                <p className="text-[10px] text-muted-foreground truncate">
                                  {profile.profileId || profile.employeeId} {profile.jobTitle ? `• ${profile.jobTitle}` : ""}
                                </p>
                                {isVacation && profile.vacationStartDate && (
                                  <p className="text-[10px] font-semibold text-amber-700 dark:text-amber-300 mt-0.5">
                                    🌴 {ar ? `إجازة حتى ${profile.vacationEndDate}` : `Leave till ${profile.vacationEndDate}`}
                                  </p>
                                )}
                              </div>
                            </div>
                          );
                        }

                        // Vacant Bed Space (Available)
                        return (
                          <div
                            key={bedNum}
                            className="p-2.5 rounded-xl border border-dashed border-emerald-400/60 dark:border-emerald-700 bg-emerald-50/40 dark:bg-emerald-950/20 flex items-center justify-between gap-2 text-xs group/bed hover:bg-emerald-100/60 dark:hover:bg-emerald-900/30 transition-all"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <div className="w-7 h-7 rounded-lg bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 flex items-center justify-center font-bold text-xs flex-shrink-0">
                                {bedNum}
                              </div>
                              <span className="font-semibold text-emerald-800 dark:text-emerald-300 truncate">
                                {ar ? `سرير ${bedNum} متاح` : `Bed ${bedNum} Free`}
                              </span>
                            </div>

                            <Button
                              size="sm"
                              variant="outline"
                              onClick={(e) => handleQuickAssign(room.id, bedNum, e)}
                              className="h-7 px-2 text-[11px] font-bold border-emerald-400 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-600 hover:text-white transition-colors"
                            >
                              + {ar ? "تسكين" : "Assign"}
                            </Button>
                          </div>
                        );
                      })}
                    </div>

                    {/* Room Footer Action */}
                    <div className="p-2.5 bg-muted/10 border-t flex items-center justify-between text-[11px] text-muted-foreground">
                      <span className="font-medium">
                        {freeCount > 0
                          ? (ar ? `متبقي ${freeCount} أماكن` : `${freeCount} spots left`)
                          : (ar ? "مكتملة السعة" : "Fully Occupied")}
                      </span>
                      <span className="text-primary font-bold flex items-center gap-1 group-hover:translate-x-[-2px] rtl:group-hover:translate-x-[2px] transition-transform">
                        <Eye className="w-3.5 h-3.5" />
                        {ar ? "تفاصيل الغرفة" : "Details"}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}

      {/* ── PAGINATION BAR ── */}
      {filteredRooms.length > 0 && (
        <div className="pt-2 bg-card rounded-xl border shadow-sm px-3 py-1">
          <DataPagination
            total={filteredRooms.length}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={(page) => {
              setCurrentPage(page);
              window.scrollTo({ top: 0, behavior: "smooth" });
            }}
            onPageSizeChange={(newSize) => {
              setPageSize(newSize);
              setCurrentPage(1);
            }}
          />
        </div>
      )}
    </div>
  );
}
