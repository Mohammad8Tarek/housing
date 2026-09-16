// @ts-nocheck
import * as React from "react";
import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Building2,
  Layers,
  BedDouble,
  Search,
  CheckCircle2,
  AlertTriangle,
  Users,
  User,
  Home,
  ArrowUpRight,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  Sparkles,
  Wrench,
  DoorOpen,
  LayoutGrid,
  ListTree,
  X,
  Bed,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/context/LanguageContext";
import { cn } from "@/lib/utils";
import { Link } from "wouter";

interface HousingStructureExplorerProps {
  propertyId: number | string;
  buildNavHref: (path: string) => string;
}

export function HousingStructureExplorer({
  propertyId,
  buildNavHref,
}: HousingStructureExplorerProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const numericPropertyId = propertyId === "all" ? 1 : Number(propertyId) || 1;

  // Search and filter states
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");
  const [selectedFloorId, setSelectedFloorId] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [viewMode, setViewMode] = useState<"hierarchy" | "grid">("hierarchy");
  const [expandedBuildings, setExpandedBuildings] = useState<Record<number, boolean>>({});
  const [expandedFloors, setExpandedFloors] = useState<Record<number, boolean>>({});

  // Live Query
  const {
    data,
    isLoading,
    isRefetching,
    refetch,
  } = useQuery({
    queryKey: ["/api/dashboard/housing-breakdown", numericPropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/housing-breakdown?propertyId=${numericPropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch housing breakdown");
      return res.json();
    },
    refetchInterval: 15000, // 15s live auto-refresh
    staleTime: 10000,
  });

  const housing = data?.housing;
  const rawBuildings = data?.buildings || [];

  // Initialize expanded state for the first building and its floors once loaded
  React.useEffect(() => {
    if (rawBuildings.length > 0 && Object.keys(expandedBuildings).length === 0) {
      const bInit: Record<number, boolean> = {};
      const fInit: Record<number, boolean> = {};
      rawBuildings.forEach((b: any, idx: number) => {
        // Expand first 2 buildings by default
        bInit[b.id] = idx < 2;
        (b.floors || []).forEach((f: any) => {
          fInit[f.id] = true; // Floors expanded inside expanded building
        });
      });
      setExpandedBuildings(bInit);
      setExpandedFloors(fInit);
    }
  }, [rawBuildings]);

  const toggleBuilding = (bId: number) => {
    setExpandedBuildings((prev) => ({ ...prev, [bId]: !prev[bId] }));
  };

  const toggleFloor = (fId: number) => {
    setExpandedFloors((prev) => ({ ...prev, [fId]: !prev[fId] }));
  };

  const expandAll = () => {
    const bInit: Record<number, boolean> = {};
    const fInit: Record<number, boolean> = {};
    rawBuildings.forEach((b: any) => {
      bInit[b.id] = true;
      (b.floors || []).forEach((f: any) => {
        fInit[f.id] = true;
      });
    });
    setExpandedBuildings(bInit);
    setExpandedFloors(fInit);
  };

  const collapseAll = () => {
    setExpandedBuildings({});
    setExpandedFloors({});
  };

  // Filter logic
  const filteredData = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();

    return rawBuildings
      .map((b: any) => {
        if (selectedBuildingId !== "all" && String(b.id) !== selectedBuildingId) {
          return null;
        }

        const filteredFloors = (b.floors || [])
          .map((f: any) => {
            if (selectedFloorId !== "all" && String(f.id) !== selectedFloorId) {
              return null;
            }

            const filteredRooms = (f.rooms || []).filter((r: any) => {
              // Status filter
              if (statusFilter !== "all") {
                const normStatus = (r.status || "").toLowerCase();
                if (statusFilter === "available" && normStatus !== "available") return false;
                if (statusFilter === "occupied" && normStatus !== "occupied") return false;
                if (statusFilter === "partially_occupied" && normStatus !== "partially_occupied") return false;
                if (
                  statusFilter === "dirty" &&
                  normStatus !== "dirty" &&
                  normStatus !== "occupied_dirty"
                ) {
                  return false;
                }
                if (
                  statusFilter === "maintenance" &&
                  normStatus !== "maintenance" &&
                  normStatus !== "out_of_service" &&
                  normStatus !== "out_of_order"
                ) {
                  return false;
                }
              }

              // Text Search (Room number, resident name, department, job title)
              if (q) {
                const matchRoom = String(r.roomNumber || "").toLowerCase().includes(q);
                const matchType = String(r.roomType || "").toLowerCase().includes(q);
                const matchResidents = (r.residents || []).some((res: any) => {
                  const p = res.profile || {};
                  return (
                    String(p.fullName || "").toLowerCase().includes(q) ||
                    String(p.profileId || "").toLowerCase().includes(q) ||
                    String(p.department || "").toLowerCase().includes(q) ||
                    String(p.jobTitle || "").toLowerCase().includes(q)
                  );
                });
                return matchRoom || matchType || matchResidents;
              }

              return true;
            });

            if (filteredRooms.length === 0 && (q || statusFilter !== "all" || selectedFloorId !== "all")) {
              return null;
            }

            return {
              ...f,
              rooms: filteredRooms,
            };
          })
          .filter(Boolean);

        if (filteredFloors.length === 0 && (q || statusFilter !== "all" || selectedBuildingId !== "all")) {
          return null;
        }

        return {
          ...b,
          floors: filteredFloors,
        };
      })
      .filter(Boolean);
  }, [rawBuildings, searchQuery, selectedBuildingId, selectedFloorId, statusFilter]);

  // Flattened rooms for Grid View
  const allFilteredRooms = useMemo(() => {
    const list: any[] = [];
    filteredData.forEach((b: any) => {
      (b.floors || []).forEach((f: any) => {
        (f.rooms || []).forEach((r: any) => {
          list.push({
            ...r,
            buildingName: b.name,
            floorNumber: f.floorNumber,
          });
        });
      });
    });
    return list;
  }, [filteredData]);

  // Helpers for badge styling
  const getRoomBadge = (status: string) => {
    const st = (status || "").toLowerCase();
    switch (st) {
      case "available":
        return {
          label: ar ? "شاغرة ومتاحة" : "Vacant Available",
          className: "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30",
          dot: "bg-emerald-500",
        };
      case "occupied":
        return {
          label: ar ? "مأهولة بالكامل" : "Fully Occupied",
          className: "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30",
          dot: "bg-blue-500",
        };
      case "partially_occupied":
        return {
          label: ar ? "إشغال جزئي" : "Partially Occupied",
          className: "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30",
          dot: "bg-amber-500",
        };
      case "dirty":
      case "occupied_dirty":
        return {
          label: ar ? "تحتاج نظافة" : "Needs Cleaning",
          className: "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/30",
          dot: "bg-orange-500",
        };
      case "maintenance":
      case "out_of_service":
      case "out_of_order":
        return {
          label: ar ? "صيانة / خارج الخدمة" : "Maintenance",
          className: "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30",
          dot: "bg-rose-500",
        };
      case "vacation":
        return {
          label: ar ? "إجازة" : "Vacation",
          className: "bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30",
          dot: "bg-purple-500",
        };
      default:
        return {
          label: status,
          className: "bg-muted text-muted-foreground border-border",
          dot: "bg-muted-foreground",
        };
    }
  };

  return (
    <Card className="rounded-3xl border border-border/70 bg-card/75 backdrop-blur-xl shadow-xl overflow-hidden">
      {/* ── 1. Top Section Header ── */}
      <CardHeader className="bg-muted/20 border-b border-border/50 pb-5">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shadow-xs">
                <Building2 className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-base sm:text-lg font-bold flex items-center gap-2">
                  <span>{ar ? "تفصيل السكن والمباني والأدوار والغرف" : "Housing, Buildings, Floors & Rooms Structure"}</span>
                  <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 gap-1 px-2">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    <span>{ar ? "مباشر لحظي" : "LIVE"}</span>
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {ar
                    ? "استعراض هرمي مباشر للطاقة الاستيعابية وتوزيع المقيمين وحالة كل غرفة وسرير لحظياً"
                    : "Real-time interactive breakdown of physical housing capacity, resident bed slots, and live room statuses"}
                </CardDescription>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* View Mode: Hierarchy vs Flat Grid */}
            <div className="flex items-center bg-background border border-border/80 rounded-xl p-1 shadow-2xs text-xs font-semibold">
              <button
                type="button"
                onClick={() => setViewMode("hierarchy")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer",
                  viewMode === "hierarchy"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ListTree className="w-3.5 h-3.5" />
                <span>{ar ? "هرمي" : "Tree"}</span>
              </button>
              <button
                type="button"
                onClick={() => setViewMode("grid")}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all cursor-pointer",
                  viewMode === "grid"
                    ? "bg-primary text-primary-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{ar ? "شبكة الغرف" : "Room Grid"}</span>
              </button>
            </div>

            {/* Expand / Collapse All (Tree view only) */}
            {viewMode === "hierarchy" && (
              <div className="flex items-center gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={expandAll}
                  className="h-8 px-2.5 text-xs rounded-xl font-medium"
                >
                  {ar ? "توسيع الكل" : "Expand All"}
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={collapseAll}
                  className="h-8 px-2.5 text-xs rounded-xl font-medium"
                >
                  {ar ? "طي الكل" : "Collapse"}
                </Button>
              </div>
            )}

            {/* Manual Refresh */}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => refetch()}
              disabled={isRefetching}
              className="h-8 w-8 p-0 rounded-xl"
              title={ar ? "تحديث مباشر" : "Refresh"}
            >
              <RefreshCw className={cn("w-3.5 h-3.5", isRefetching && "animate-spin text-primary")} />
            </Button>

            {/* Link to full housing management */}
            <Link href={buildNavHref("/housing")}>
              <Button size="sm" className="h-8 px-3 rounded-xl text-xs gap-1 font-bold bg-primary text-primary-foreground shadow-xs cursor-pointer">
                <span>{ar ? "إدارة السكن" : "Manage"}</span>
                <ArrowUpRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>

        {/* ── 2. Live Capacity Stats Ribbon ── */}
        {housing && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-4">
            {/* Buildings */}
            <div className="p-2.5 rounded-2xl bg-card border border-border/60 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
                <Building2 className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ar ? "المباني" : "Buildings"}</p>
                <p className="text-base font-black font-mono text-foreground">{housing.totalBuildings}</p>
              </div>
            </div>

            {/* Floors */}
            <div className="p-2.5 rounded-2xl bg-card border border-border/60 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
                <Layers className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ar ? "الأدوار" : "Floors"}</p>
                <p className="text-base font-black font-mono text-foreground">{housing.totalFloors}</p>
              </div>
            </div>

            {/* Rooms */}
            <div className="p-2.5 rounded-2xl bg-card border border-border/60 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-violet-500/10 text-violet-600 dark:text-violet-400 flex items-center justify-center shrink-0">
                <Home className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ar ? "الغرف الكلية" : "Total Rooms"}</p>
                <p className="text-base font-black font-mono text-foreground">
                  {housing.totalRooms}{" "}
                  <span className="text-[10px] font-normal text-muted-foreground">({housing.occupiedRooms} {ar ? "مشغولة" : "occ"})</span>
                </p>
              </div>
            </div>

            {/* Total Beds */}
            <div className="p-2.5 rounded-2xl bg-card border border-border/60 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
                <BedDouble className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ar ? "سعة الأسرة" : "Bed Capacity"}</p>
                <p className="text-base font-black font-mono text-foreground">{housing.totalCapacity}</p>
              </div>
            </div>

            {/* Occupied Beds */}
            <div className="p-2.5 rounded-2xl bg-card border border-border/60 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <Users className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ar ? "الأسرة المشغولة" : "Occupied Beds"}</p>
                <p className="text-base font-black font-mono text-emerald-600 dark:text-emerald-400">
                  {housing.occupiedBeds}{" "}
                  <span className="text-[10px] font-bold">({housing.bedOccupancyRate}%)</span>
                </p>
              </div>
            </div>

            {/* Vacant Beds */}
            <div className="p-2.5 rounded-2xl bg-card border border-border/60 flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
                <DoorOpen className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">{ar ? "الأسرة الشاغرة" : "Vacant Beds"}</p>
                <p className="text-base font-black font-mono text-teal-600 dark:text-teal-400">{housing.vacantBeds}</p>
              </div>
            </div>
          </div>
        )}
      </CardHeader>

      <CardContent className="p-5 sm:p-6 space-y-5">
        {/* ── 3. Filters & Search Bar ── */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 rounded-2xl bg-muted/40 border border-border/60">
          {/* Text Search */}
          <div className="relative flex-1 min-w-[220px]">
            <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <Input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ar ? "بحث برقم الغرفة، اسم الموظف، القسم، الوظيفة..." : "Search room number, resident, department..."}
              className="ps-9 pe-8 h-9 rounded-xl text-xs bg-background"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Building filter */}
            {rawBuildings.length > 1 && (
              <select
                value={selectedBuildingId}
                onChange={(e) => {
                  setSelectedBuildingId(e.target.value);
                  setSelectedFloorId("all");
                }}
                className="h-9 px-2.5 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[150px] truncate"
              >
                <option value="all">{ar ? "جميع المباني" : "All Buildings"}</option>
                {rawBuildings.map((b: any) => (
                  <option key={b.id} value={String(b.id)}>
                    {b.name}
                  </option>
                ))}
              </select>
            )}

            {/* Status chips */}
            <div className="flex items-center gap-1 overflow-x-auto py-0.5">
              {[
                { id: "all", label: ar ? "الكل" : "All" },
                { id: "available", label: ar ? "شاغر ومتاح" : "Vacant" },
                { id: "occupied", label: ar ? "مأهول" : "Occupied" },
                { id: "partially_occupied", label: ar ? "جزئي" : "Partial" },
                { id: "dirty", label: ar ? "نظافة" : "Dirty" },
                { id: "maintenance", label: ar ? "صيانة" : "Maint" },
              ].map((st) => (
                <button
                  key={st.id}
                  type="button"
                  onClick={() => setStatusFilter(st.id)}
                  className={cn(
                    "px-2.5 py-1 rounded-lg text-xs font-semibold whitespace-nowrap transition-all cursor-pointer",
                    statusFilter === st.id
                      ? "bg-primary text-primary-foreground shadow-xs font-bold"
                      : "bg-background text-muted-foreground hover:text-foreground border border-border/70",
                  )}
                >
                  {st.label}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Loading state */}
        {isLoading && (
          <div className="py-12 flex flex-col items-center justify-center gap-3 text-muted-foreground">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-semibold">{ar ? "جارٍ تحميل تفاصيل السكن والمباني..." : "Loading housing hierarchy..."}</p>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && filteredData.length === 0 && (
          <div className="py-12 text-center text-muted-foreground border-2 border-dashed border-border/80 rounded-3xl p-6">
            <Building2 className="w-10 h-10 mx-auto opacity-40 mb-2" />
            <h4 className="font-bold text-sm text-foreground">{ar ? "لا توجد غرف أو مباني مطابقة" : "No matching rooms or buildings"}</h4>
            <p className="text-xs text-muted-foreground mt-1 max-w-sm mx-auto">
              {ar ? "جرّب تغيير كلمات البحث أو إزالة فلاتر الحالة لعرض المزيد من الغرف." : "Try adjusting your search criteria or resetting filters."}
            </p>
            {(searchQuery || statusFilter !== "all" || selectedBuildingId !== "all") && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setSearchQuery("");
                  setStatusFilter("all");
                  setSelectedBuildingId("all");
                  setSelectedFloorId("all");
                }}
                className="mt-3 text-xs rounded-xl"
              >
                {ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
              </Button>
            )}
          </div>
        )}

        {/* ── 4A. HIERARCHICAL DRILL-DOWN VIEW (Buildings -> Floors -> Rooms) ── */}
        {!isLoading && viewMode === "hierarchy" && filteredData.length > 0 && (
          <div className="space-y-4">
            {filteredData.map((b: any) => {
              const isBExpanded = expandedBuildings[b.id] ?? true;
              const isHigh = b.occupancyRate >= 85;
              const isMedium = b.occupancyRate >= 60 && b.occupancyRate < 85;

              return (
                <div
                  key={b.id}
                  className="rounded-3xl border border-border/80 bg-card/60 overflow-hidden shadow-sm transition-all"
                >
                  {/* Building Header Accordion Bar */}
                  <div
                    onClick={() => toggleBuilding(b.id)}
                    className="p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer hover:bg-muted/40 transition-colors select-none bg-muted/20 border-b border-border/40"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/20 text-primary flex items-center justify-center shrink-0 shadow-xs">
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-black text-base text-foreground tracking-tight">{b.name}</h3>
                          {b.location && (
                            <Badge variant="outline" className="text-[10px] font-normal text-muted-foreground">
                              {b.location}
                            </Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {b.totalFloors} {ar ? "أدوار" : "floors"} · {b.totalRooms} {ar ? "غرفة" : "rooms"} · {b.totalCapacity} {ar ? "سرير إجمالي" : "beds capacity"}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center gap-4">
                      {/* Bed Progress Bar */}
                      <div className="w-36 sm:w-44 space-y-1">
                        <div className="flex items-center justify-between text-[11px]">
                          <span className="text-muted-foreground font-medium">{ar ? "إشغال الأسرة:" : "Bed Occupancy:"}</span>
                          <span className="font-mono font-bold text-foreground">{b.occupancyRate}%</span>
                        </div>
                        <div className="h-2 w-full rounded-full bg-muted/80 overflow-hidden">
                          <div
                            style={{ width: `${Math.min(b.occupancyRate, 100)}%` }}
                            className={cn(
                              "h-full rounded-full transition-all duration-500",
                              isHigh
                                ? "bg-gradient-to-r from-amber-500 to-rose-500"
                                : isMedium
                                ? "bg-gradient-to-r from-primary to-amber-500"
                                : "bg-gradient-to-r from-teal-500 to-emerald-500",
                            )}
                          />
                        </div>
                      </div>

                      {/* Quick Bed Counters */}
                      <div className="hidden sm:flex items-center gap-2 text-xs font-mono">
                        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-bold px-2 py-0.5">
                          {b.occupiedBeds} {ar ? "مأهول" : "occ"}
                        </Badge>
                        <Badge className="bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/30 font-bold px-2 py-0.5">
                          {b.vacantBeds} {ar ? "شاغر" : "vac"}
                        </Badge>
                      </div>

                      {/* Toggle Arrow */}
                      <div className="w-8 h-8 rounded-xl bg-background border border-border flex items-center justify-center text-muted-foreground">
                        {isBExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </div>
                    </div>
                  </div>

                  {/* Building Expanded Content: List of Floors */}
                  {isBExpanded && (
                    <div className="p-4 sm:p-5 space-y-4">
                      {(b.floors || []).map((f: any) => {
                        const isFExpanded = expandedFloors[f.id] ?? true;

                        return (
                          <div
                            key={f.id}
                            className="rounded-2xl border border-border/70 bg-background/80 overflow-hidden shadow-2xs"
                          >
                            {/* Floor Header Bar */}
                            <div
                              onClick={() => toggleFloor(f.id)}
                              className="px-4 py-3 flex items-center justify-between gap-3 cursor-pointer hover:bg-muted/30 transition-colors select-none border-b border-border/40 bg-muted/10"
                            >
                              <div className="flex items-center gap-2.5">
                                <div className="w-7 h-7 rounded-lg bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center font-mono font-bold text-xs">
                                  {f.floorNumber}
                                </div>
                                <div>
                                  <h4 className="text-xs sm:text-sm font-bold text-foreground flex items-center gap-2">
                                    <span>{ar ? `الدور ${f.floorNumber}` : `Floor ${f.floorNumber}`}</span>
                                    {f.description && (
                                      <span className="text-[11px] font-normal text-muted-foreground">
                                        · {f.description}
                                      </span>
                                    )}
                                  </h4>
                                  <p className="text-[11px] text-muted-foreground font-mono">
                                    {f.rooms.length} {ar ? "غرف" : "rooms"} · {f.totalCapacity} {ar ? "سرير" : "beds"} · {f.occupiedBeds} {ar ? "مأهول" : "occ"} · {f.vacantBeds} {ar ? "شاغر" : "vac"}
                                  </p>
                                </div>
                              </div>

                              <div className="flex items-center gap-3">
                                <span className="text-xs font-mono font-bold text-primary px-2 py-0.5 rounded-md bg-primary/10 border border-primary/20">
                                  {f.occupancyRate}% {ar ? "إشغال" : "occ"}
                                </span>
                                <div className="w-6 h-6 rounded-lg flex items-center justify-center text-muted-foreground">
                                  {isFExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                                </div>
                              </div>
                            </div>

                            {/* Floor Rooms Grid */}
                            {isFExpanded && (
                              <div className="p-3.5 sm:p-4">
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
                                  {f.rooms.map((room: any) => (
                                    <RoomDetailCard
                                      key={room.id}
                                      room={room}
                                      ar={ar}
                                      buildNavHref={buildNavHref}
                                      getRoomBadge={getRoomBadge}
                                    />
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* ── 4B. FLAT ROOM GRID VIEW (Fast search across all rooms) ── */}
        {!isLoading && viewMode === "grid" && allFilteredRooms.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3">
            {allFilteredRooms.map((room: any) => (
              <RoomDetailCard
                key={room.id}
                room={room}
                ar={ar}
                buildNavHref={buildNavHref}
                getRoomBadge={getRoomBadge}
                showLocation
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

// ─── Individual Room Card Component ───
interface RoomDetailCardProps {
  room: any;
  ar: boolean;
  buildNavHref: (path: string) => string;
  getRoomBadge: (status: string) => { label: string; className: string; dot: string };
  showLocation?: boolean;
}

function RoomDetailCard({
  room,
  ar,
  buildNavHref,
  getRoomBadge,
  showLocation = false,
}: RoomDetailCardProps) {
  const badgeInfo = getRoomBadge(room.status);
  const residents = room.residents || [];
  const capacity = room.capacity || 1;

  // Build bed slots array from capacity
  const bedSlots = Array.from({ length: capacity }, (_, i) => {
    const bedNum = i + 1;
    const resident = residents.find((r: any) => Number(r.bedNumber) === bedNum) || residents[i];
    return {
      bedNum,
      resident,
    };
  });

  return (
    <div className="p-3 rounded-2xl border border-border/70 bg-card hover:border-primary/50 transition-all shadow-2xs hover:shadow-sm flex flex-col justify-between gap-2.5 relative group">
      {/* Top Bar: Room Number, Type & Status */}
      <div>
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex items-center gap-1.5">
              <span className="font-mono font-black text-base text-foreground group-hover:text-primary transition-colors">
                {room.roomNumber}
              </span>
              {room.roomType && (
                <span className="text-[10px] font-medium text-muted-foreground truncate max-w-[80px]">
                  · {room.roomType}
                </span>
              )}
            </div>
            {showLocation && (
              <p className="text-[10px] text-muted-foreground truncate mt-0.5">
                {room.buildingName} · {ar ? "دور" : "Floor"} {room.floorNumber}
              </p>
            )}
          </div>

          <Badge
            className={cn(
              "text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 flex items-center gap-1",
              badgeInfo.className,
            )}
          >
            <span className={cn("w-1.5 h-1.5 rounded-full", badgeInfo.dot)} />
            <span>{badgeInfo.label}</span>
          </Badge>
        </div>

        {/* Capacity Indicator Pill */}
        <div className="flex items-center justify-between text-[11px] mt-2 pt-1.5 border-t border-border/40 text-muted-foreground">
          <span className="flex items-center gap-1">
            <BedDouble className="w-3.5 h-3.5 text-muted-foreground" />
            <span>{ar ? "سعة الأسرة:" : "Beds:"}</span>
            <strong className="text-foreground font-mono">
              {room.occupiedBeds} / {capacity}
            </strong>
          </span>

          <span
            className={cn(
              "font-mono font-bold text-[10px]",
              room.vacantBeds > 0 ? "text-emerald-600 dark:text-emerald-400" : "text-muted-foreground",
            )}
          >
            {room.vacantBeds > 0 ? (ar ? `${room.vacantBeds} شاغر` : `${room.vacantBeds} free`) : (ar ? "مكتمل" : "Full")}
          </span>
        </div>
      </div>

      {/* Bed Slots & Resident Allocations */}
      <div className="space-y-1 bg-muted/30 rounded-xl p-2 border border-border/40">
        {bedSlots.map((slot) => {
          const res = slot.resident;
          const prof = res?.profile;

          if (res && prof) {
            return (
              <div
                key={slot.bedNum}
                className="flex items-center justify-between gap-1.5 text-[11px] py-0.5"
                title={`${prof.fullName} (${prof.department || ""})`}
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="w-4 h-4 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center text-[9px] font-mono font-bold shrink-0">
                    B{slot.bedNum}
                  </span>
                  <span className="font-semibold text-foreground truncate max-w-[120px]">
                    {prof.fullName}
                  </span>
                </div>
                {prof.department && (
                  <span className="text-[10px] text-muted-foreground truncate max-w-[70px] text-end">
                    {prof.department}
                  </span>
                )}
              </div>
            );
          }

          // Vacant Bed Slot
          return (
            <div
              key={slot.bedNum}
              className="flex items-center justify-between gap-1.5 text-[11px] py-0.5 text-muted-foreground/70"
            >
              <div className="flex items-center gap-1.5">
                <span className="w-4 h-4 rounded-md bg-muted text-muted-foreground flex items-center justify-center text-[9px] font-mono shrink-0">
                  B{slot.bedNum}
                </span>
                <span className="italic text-[10px] text-emerald-600/80 dark:text-emerald-400/80">
                  {ar ? "سرير شاغر" : "Empty bed"}
                </span>
              </div>
              <span className="text-[10px] text-emerald-500 font-mono">✓</span>
            </div>
          );
        })}
      </div>

      {/* Action Footer */}
      <div className="flex items-center justify-between pt-1 border-t border-border/40 text-[11px]">
        <Link
          href={buildNavHref(`/housing`)}
          className="text-xs font-semibold text-primary hover:underline flex items-center gap-1 cursor-pointer"
        >
          <span>{ar ? "تفاصيل الغرفة" : "Manage Room"}</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </Link>
        {room.gender && (
          <span className="text-[10px] uppercase font-bold text-muted-foreground">
            {room.gender === "M" ? (ar ? "رجال" : "Male") : room.gender === "F" ? (ar ? "سيدات" : "Female") : room.gender}
          </span>
        )}
      </div>
    </div>
  );
}
