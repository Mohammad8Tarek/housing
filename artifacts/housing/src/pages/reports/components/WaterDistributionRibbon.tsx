import React, { useMemo } from "react";
import {
  Droplets,
  Building2,
  Layers,
  Printer,
  CheckCircle2,
  RotateCcw,
  Users,
  CheckSquare,
  Square,
  Sparkles,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

interface WaterDistributionRibbonProps {
  ar: boolean;
  buildings: any[];
  floors: any[];
  filterBuilding: string;
  setFilterBuilding: (b: string) => void;
  filterFloor: string;
  setFilterFloor: (f: string) => void;
  data: any[];
  allAssignments: any[];
  roomMap: Record<number, any>;
  onPrint?: () => void;
  waterCheckState: Record<string, boolean>;
  onToggleWaterCheck?: (key: string, val: boolean) => void;
  onBatchWaterCheck?: (keys: string[], val: boolean) => void;
}

export function WaterDistributionRibbon({
  ar,
  buildings = [],
  floors = [],
  filterBuilding,
  setFilterBuilding,
  filterFloor,
  setFilterFloor,
  data = [],
  allAssignments = [],
  roomMap = {},
  onPrint,
  waterCheckState = {},
  onBatchWaterCheck,
}: WaterDistributionRibbonProps) {
  // Count active residents per building across all assignments
  const buildingCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (allAssignments || []).forEach((a: any) => {
      if (a.status !== "ACTIVE" && a.status !== "VACATION") return;
      const rId = a.roomId ?? a.room_id;
      const room = roomMap[Number(rId)] || roomMap[rId] || {};
      const bId = room.buildingId ?? a.buildingId;
      if (bId) {
        const key = String(bId);
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [allAssignments, roomMap]);

  // Floors filtered for the currently selected building
  const availableFloors = useMemo(() => {
    if (!filterBuilding || filterBuilding === "all") return floors;
    return floors.filter((f: any) => String(f.buildingId) === String(filterBuilding));
  }, [floors, filterBuilding]);

  // Count active residents per floor for currently selected building
  const floorCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    (allAssignments || []).forEach((a: any) => {
      if (a.status !== "ACTIVE" && a.status !== "VACATION") return;
      const rId = a.roomId ?? a.room_id;
      const room = roomMap[Number(rId)] || roomMap[rId] || {};
      const bId = room.buildingId ?? a.buildingId;
      if (filterBuilding && filterBuilding !== "all" && String(bId) !== String(filterBuilding)) {
        return;
      }
      const fId = room.floorId ?? a.floorId;
      if (fId) {
        const key = String(fId);
        counts[key] = (counts[key] || 0) + 1;
      }
    });
    return counts;
  }, [allAssignments, roomMap, filterBuilding]);

  // Total eligible residents in current view
  const totalEligible = data.length;

  // Real-time check stats from waterCheckState
  const issue1Count = useMemo(() => {
    return data.filter((row) => Boolean(waterCheckState[`${row.id}_1`])).length;
  }, [data, waterCheckState]);

  const issue2Count = useMemo(() => {
    return data.filter((row) => Boolean(waterCheckState[`${row.id}_2`])).length;
  }, [data, waterCheckState]);

  const issue1Pct = totalEligible > 0 ? Math.round((issue1Count / totalEligible) * 100) : 0;
  const issue2Pct = totalEligible > 0 ? Math.round((issue2Count / totalEligible) * 100) : 0;
  const overallPct = Math.round((issue1Pct + issue2Pct) / 2);

  // Batch actions for current data rows
  const handleMarkAllIssue1 = () => {
    if (!onBatchWaterCheck || data.length === 0) return;
    const keys = data.map((r) => `${r.id}_1`);
    onBatchWaterCheck(keys, true);
  };

  const handleMarkAllIssue2 = () => {
    if (!onBatchWaterCheck || data.length === 0) return;
    const keys = data.map((r) => `${r.id}_2`);
    onBatchWaterCheck(keys, true);
  };

  const handleResetCurrentChecks = () => {
    if (!onBatchWaterCheck || data.length === 0) return;
    const keys = data.flatMap((r) => [`${r.id}_1`, `${r.id}_2`]);
    onBatchWaterCheck(keys, false);
  };

  const currentBuildingObj = buildings.find((b: any) => String(b.id) === String(filterBuilding));
  const currentFloorObj = floors.find((f: any) => String(f.id) === String(filterFloor));

  return (
    <Card className="border-cyan-500/30 bg-gradient-to-br from-cyan-500/5 via-sky-500/5 to-background shadow-xs overflow-hidden">
      <CardContent className="p-4 sm:p-5 space-y-4">
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-cyan-600 to-sky-500 text-white flex items-center justify-center shadow-md shadow-cyan-500/20 shrink-0">
              <Droplets className="w-5 h-5 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-base font-bold text-foreground">
                  {ar ? "كشف توزيع وصرف المياه للمقيمين بالسكن" : "Staff Water Distribution & Dispensation Manifest"}
                </h2>
                <Badge variant="outline" className="text-[11px] font-semibold border-cyan-500/30 text-cyan-700 dark:text-cyan-300 bg-cyan-500/10">
                  {ar ? "حصص معتمدة" : "Standard Ration"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "تصفية سريعة ومباشرة حسب المبنى والطابق مع إمكانية تحضير كشوف التوقيع والطباعة المجمعة"
                  : "Instant building and floor filtering with signature-ready printable sheets"}
              </p>
            </div>
          </div>

          {/* Quick Print & Reset Actions */}
          <div className="flex items-center gap-2 flex-wrap">
            {onPrint && (
              <Button
                variant="default"
                size="sm"
                onClick={onPrint}
                className="h-9 gap-1.5 text-xs font-bold bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs"
              >
                <Printer className="w-4 h-4" />
                <span>
                  {ar
                    ? currentBuildingObj
                      ? `طباعة كشف ${currentBuildingObj.name}`
                      : "طباعة كشف الصرف"
                    : "Print Water Sheet"}
                </span>
              </Button>
            )}

            {onBatchWaterCheck && data.length > 0 && (
              <div className="flex items-center gap-1 bg-background/80 p-1 rounded-lg border border-border/80">
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllIssue1}
                  className="h-7 px-2 text-[11px] font-medium gap-1 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                  title={ar ? "تحديد جميع المقيمين كأنهم استلموا الصرف الأول" : "Mark all 1st issue"}
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>{ar ? "صرف 1 للكل" : "All 1st"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleMarkAllIssue2}
                  className="h-7 px-2 text-[11px] font-medium gap-1 text-sky-700 dark:text-sky-300 hover:bg-sky-50 dark:hover:bg-sky-950/40"
                  title={ar ? "تحديد جميع المقيمين كأنهم استلموا الصرف الثاني" : "Mark all 2nd issue"}
                >
                  <CheckSquare className="w-3 h-3" />
                  <span>{ar ? "صرف 2 للكل" : "All 2nd"}</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleResetCurrentChecks}
                  className="h-7 px-2 text-[11px] font-medium gap-1 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                  title={ar ? "إعادة تعيين علامات الاستلام لهذا التحديد" : "Reset checks for scope"}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{ar ? "تفريغ" : "Reset"}</span>
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* Filter Bar 1: Building Pills Selector */}
        <div className="space-y-1.5">
          <div className="flex items-center justify-between text-xs">
            <span className="font-bold flex items-center gap-1.5 text-muted-foreground">
              <Building2 className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-400" />
              <span>{ar ? "تصفية سريعة حسب المبنى:" : "Quick Filter by Building:"}</span>
            </span>
            {filterBuilding !== "all" && (
              <button
                onClick={() => {
                  setFilterBuilding("all");
                  setFilterFloor("all");
                }}
                className="text-[11px] font-semibold text-cyan-600 hover:underline"
              >
                {ar ? "عرض كافة المباني" : "Show All Buildings"}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
            <Button
              type="button"
              size="sm"
              variant={filterBuilding === "all" || !filterBuilding ? "default" : "outline"}
              onClick={() => {
                setFilterBuilding("all");
                setFilterFloor("all");
              }}
              className={cn(
                "h-8 px-3 text-xs font-semibold shrink-0 gap-1.5",
                (filterBuilding === "all" || !filterBuilding)
                  ? "bg-cyan-600 hover:bg-cyan-700 text-white"
                  : "bg-background/80 hover:bg-muted"
              )}
            >
              <span>{ar ? "كافة المباني" : "All Buildings"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center bg-cyan-700/20 text-cyan-900 dark:text-cyan-100">
                {Object.values(buildingCounts).reduce((a, b) => a + b, 0)}
              </Badge>
            </Button>

            {buildings.map((b: any) => {
              const count = buildingCounts[String(b.id)] || 0;
              const isSelected = String(filterBuilding) === String(b.id);
              return (
                <Button
                  key={b.id}
                  type="button"
                  size="sm"
                  variant={isSelected ? "default" : "outline"}
                  onClick={() => {
                    setFilterBuilding(String(b.id));
                    setFilterFloor("all");
                  }}
                  className={cn(
                    "h-8 px-3 text-xs font-semibold shrink-0 gap-1.5 transition-all",
                    isSelected
                      ? "bg-cyan-600 hover:bg-cyan-700 text-white shadow-xs font-bold"
                      : "bg-background/80 hover:bg-cyan-50 dark:hover:bg-cyan-950/20 border-border/80"
                  )}
                >
                  <Building2 className="w-3.5 h-3.5 opacity-70" />
                  <span>{b.name}</span>
                  <Badge
                    variant={isSelected ? "secondary" : "outline"}
                    className={cn(
                      "text-[10px] px-1.5 py-0 h-4 min-w-[18px] justify-center font-mono",
                      isSelected
                        ? "bg-white/20 text-white"
                        : "text-muted-foreground"
                    )}
                  >
                    {count}
                  </Badge>
                </Button>
              );
            })}
          </div>
        </div>

        {/* Filter Bar 2: Floor Pills Selector */}
        {availableFloors.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-border/50">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-muted-foreground">
                <Layers className="w-3.5 h-3.5 text-sky-600 dark:text-sky-400" />
                <span>
                  {ar
                    ? currentBuildingObj
                      ? `طوابق ${currentBuildingObj.name}:`
                      : "تصفية حسب الطابق:"
                    : "Quick Filter by Floor:"}
                </span>
              </span>
              {filterFloor !== "all" && (
                <button
                  onClick={() => setFilterFloor("all")}
                  className="text-[11px] font-semibold text-sky-600 hover:underline"
                >
                  {ar ? "عرض كافة الطوابق" : "Show All Floors"}
                </button>
              )}
            </div>

            <div className="flex items-center gap-2 overflow-x-auto pb-1 pt-0.5 scrollbar-thin">
              <Button
                type="button"
                size="sm"
                variant={filterFloor === "all" || !filterFloor ? "default" : "outline"}
                onClick={() => setFilterFloor("all")}
                className={cn(
                  "h-7 px-2.5 text-xs font-medium shrink-0 gap-1.5",
                  (filterFloor === "all" || !filterFloor)
                    ? "bg-sky-600 hover:bg-sky-700 text-white"
                    : "bg-background/80 hover:bg-muted"
                )}
              >
                <span>{ar ? "كافة الطوابق" : "All Floors"}</span>
              </Button>

              {availableFloors.map((f: any) => {
                const count = floorCounts[String(f.id)] || 0;
                const isSelected = String(filterFloor) === String(f.id);
                const bName = buildings.find((b: any) => String(b.id) === String(f.buildingId))?.name;
                const displayName = f.name || (ar ? `الدور ${f.floorNumber}` : `Floor ${f.floorNumber}`);

                return (
                  <Button
                    key={f.id}
                    type="button"
                    size="sm"
                    variant={isSelected ? "default" : "outline"}
                    onClick={() => setFilterFloor(String(f.id))}
                    className={cn(
                      "h-7 px-2.5 text-xs font-medium shrink-0 gap-1.5 transition-all",
                      isSelected
                        ? "bg-sky-600 hover:bg-sky-700 text-white shadow-xs font-bold"
                        : "bg-background/80 hover:bg-sky-50 dark:hover:bg-sky-950/20 border-border/80"
                    )}
                  >
                    <span>{displayName}</span>
                    {filterBuilding === "all" && bName && (
                      <span className="text-[10px] opacity-75 font-normal">({bName})</span>
                    )}
                    <Badge
                      variant={isSelected ? "secondary" : "outline"}
                      className={cn(
                        "text-[9px] px-1 py-0 h-3.5 min-w-[15px] justify-center font-mono",
                        isSelected ? "bg-white/20 text-white" : "text-muted-foreground"
                      )}
                    >
                      {count}
                    </Badge>
                  </Button>
                );
              })}
            </div>
          </div>
        )}

        {/* Real-time KPI Summary Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 pt-1 border-t border-border/50 text-xs">
          {/* Total Eligible */}
          <div className="rounded-lg bg-background/80 p-2.5 border border-border/80 flex items-center justify-between">
            <div>
              <span className="text-muted-foreground block text-[11px] font-medium">
                {ar ? "إجمالي المستحقين:" : "Total Eligible:"}
              </span>
              <span className="text-base font-extrabold text-foreground">{totalEligible}</span>
              <span className="text-[10px] text-muted-foreground mr-1 rtl:mr-1 rtl:ml-0 ml-1">
                {ar ? "نزيل مسكن" : "residents"}
              </span>
            </div>
            <Users className="w-5 h-5 text-cyan-600/70" />
          </div>

          {/* Issue 1 Status */}
          <div className="rounded-lg bg-background/80 p-2.5 border border-cyan-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium">
                {ar ? "الصرف الأول (نصف أول):" : "1st Issue:"}
              </span>
              <span className="font-mono font-bold text-xs text-cyan-700 dark:text-cyan-300">
                {issue1Count} / {totalEligible} ({issue1Pct}%)
              </span>
            </div>
            <Progress value={issue1Pct} className="h-1.5 mt-1.5 bg-cyan-950/20 [&>div]:bg-cyan-500" />
          </div>

          {/* Issue 2 Status */}
          <div className="rounded-lg bg-background/80 p-2.5 border border-sky-500/20 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground text-[11px] font-medium">
                {ar ? "الصرف الثاني (نصف ثاني):" : "2nd Issue:"}
              </span>
              <span className="font-mono font-bold text-xs text-sky-700 dark:text-sky-300">
                {issue2Count} / {totalEligible} ({issue2Pct}%)
              </span>
            </div>
            <Progress value={issue2Pct} className="h-1.5 mt-1.5 bg-sky-950/20 [&>div]:bg-sky-500" />
          </div>

          {/* Active Filter Scope Badge */}
          <div className="rounded-lg bg-cyan-50/50 dark:bg-cyan-950/20 p-2.5 border border-cyan-500/30 flex items-center justify-between">
            <div className="truncate">
              <span className="text-[10px] text-cyan-800 dark:text-cyan-300 font-bold block">
                {ar ? "نطاق الكشف الحالي:" : "Current Scope:"}
              </span>
              <p className="text-xs font-extrabold text-foreground truncate mt-0.5">
                {currentBuildingObj ? currentBuildingObj.name : (ar ? "كافة المباني" : "All Buildings")}
                {currentFloorObj ? ` • ${currentFloorObj.name || (ar ? `الدور ${currentFloorObj.floorNumber}` : `Floor ${currentFloorObj.floorNumber}`)}` : ""}
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-cyan-600 shrink-0" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
