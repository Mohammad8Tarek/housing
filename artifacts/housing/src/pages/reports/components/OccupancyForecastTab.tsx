import { useState, useMemo } from "react";
import {
  CalendarRange,
  TrendingUp,
  Users,
  LogOut,
  BedDouble,
  ArrowUpRight,
  ArrowDownRight,
  Printer,
  FileSpreadsheet,
  Building,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface OccupancyForecastTabProps {
  ar: boolean;
  isLoading: boolean;
  properties: any[];
  activePropertyId?: string;
  rooms: any[];
  buildings: any[];
  assignments: any[];
  reservations: any[];
  profiles?: any[];
  onExportPDF?: () => void;
  onExportExcel?: () => void;
}

export function OccupancyForecastTab({
  ar,
  isLoading,
  properties = [],
  activePropertyId,
  rooms = [],
  buildings = [],
  assignments = [],
  reservations = [],
  onExportPDF,
  onExportExcel,
}: OccupancyForecastTabProps) {
  // Horizon: 7, 14, or 30 days
  const [horizonDays, setHorizonDays] = useState<number>(7);
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("all");

  const activePropObj = useMemo(() => {
    return properties.find(
      (p: any) => String(p.id) === String(activePropertyId)
    );
  }, [properties, activePropertyId]);

  // Filtered rooms & capacity
  const filteredRooms = useMemo(() => {
    if (selectedBuildingId === "all") return rooms;
    return rooms.filter((r: any) => r.buildingId === Number(selectedBuildingId));
  }, [rooms, selectedBuildingId]);

  const totalCapacity = useMemo(() => {
    return filteredRooms.reduce((acc: number, r: any) => acc + (r.capacity || 1), 0);
  }, [filteredRooms]);

  // Current active assignments in filtered rooms
  const activeRoomIds = useMemo(() => {
    return new Set(filteredRooms.map((r: any) => r.id));
  }, [filteredRooms]);

  const currentActiveAssignments = useMemo(() => {
    return assignments.filter(
      (a: any) => activeRoomIds.has(a.roomId) && (a.status === "ACTIVE" || a.status === "VACATION")
    );
  }, [assignments, activeRoomIds]);

  // Day-by-day forecast calculation
  const forecastData = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const daysList = [];
    let runningOccupants = currentActiveAssignments.length;

    for (let i = 0; i < horizonDays; i++) {
      const d = new Date(today);
      d.setDate(today.getDate() + i);
      const dIso = d.toISOString().split("T")[0];

      // Day of week
      const dayNameAr = ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"][d.getDay()];
      const dayNameEn = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"][d.getDay()];
      const dayName = ar ? dayNameAr : dayNameEn;

      // Expected arrivals on this day (from confirmed reservations)
      const dayArrivals = reservations.filter((r: any) => {
        if (r.status?.toUpperCase() === "CANCELLED") return false;
        if (r.roomId && !activeRoomIds.has(r.roomId)) return false;
        if (!r.checkInDate) return false;
        const inDate = String(r.checkInDate).slice(0, 10);
        return inDate === dIso;
      }).length;

      // Expected departures on this day (from active assignments due out)
      const dayDepartures = assignments.filter((a: any) => {
        if (!activeRoomIds.has(a.roomId)) return false;
        if (a.status !== "ACTIVE" && a.status !== "VACATION") return false;
        if (!a.checkOutDate) return false;
        const outDate = String(a.checkOutDate).slice(0, 10);
        return outDate === dIso;
      }).length;

      // Net change for the day
      const netMovement = dayArrivals - dayDepartures;
      
      // Calculate projected occupied beds
      if (i > 0) {
        runningOccupants = Math.max(0, runningOccupants + netMovement);
      }
      const projectedOccupied = Math.min(totalCapacity, runningOccupants);
      const projectedVacant = Math.max(0, totalCapacity - projectedOccupied);
      const occPercent = totalCapacity > 0 ? Math.round((projectedOccupied / totalCapacity) * 100) : 0;

      // Demand level
      let demand = "NORMAL";
      if (occPercent >= 90) demand = "CRITICAL";
      else if (occPercent >= 75) demand = "HIGH";
      else if (occPercent < 50) demand = "LOW";

      daysList.push({
        dayIndex: i,
        dateObj: d,
        dateIso: dIso,
        dateDisplay: `${d.getDate().toString().padStart(2, "0")}/${(d.getMonth() + 1).toString().padStart(2, "0")}/${d.getFullYear()}`,
        dayName,
        dayArrivals,
        dayDepartures,
        netMovement,
        projectedOccupied,
        projectedVacant,
        occPercent,
        demand,
      });
    }

    return daysList;
  }, [horizonDays, currentActiveAssignments, totalCapacity, activeRoomIds, reservations, assignments, ar]);

  // Aggregate horizon metrics
  const aggregateMetrics = useMemo(() => {
    if (forecastData.length === 0) {
      return {
        peakOcc: 0,
        peakDate: "—",
        avgOcc: 0,
        totalArrivals: 0,
        totalDepartures: 0,
        minVacant: 0,
        netChange: 0,
      };
    }

    let maxOcc = -1;
    let maxDate = "—";
    let sumOcc = 0;
    let sumArrivals = 0;
    let sumDepartures = 0;
    let minVac = Infinity;

    forecastData.forEach((d) => {
      if (d.occPercent > maxOcc) {
        maxOcc = d.occPercent;
        maxDate = `${d.dayName} ${d.dateDisplay}`;
      }
      sumOcc += d.occPercent;
      sumArrivals += d.dayArrivals;
      sumDepartures += d.dayDepartures;
      if (d.projectedVacant < minVac) {
        minVac = d.projectedVacant;
      }
    });

    return {
      peakOcc: maxOcc,
      peakDate: maxDate,
      avgOcc: Math.round(sumOcc / forecastData.length),
      totalArrivals: sumArrivals,
      totalDepartures: sumDepartures,
      minVacant: isFinite(minVac) ? minVac : 0,
      netChange: sumArrivals - sumDepartures,
    };
  }, [forecastData]);

  if (isLoading) {
    return (
      <div className="space-y-4 p-4">
        <Skeleton className="h-16 w-full rounded-2xl" />
        <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-2xl" />
          ))}
        </div>
        <Skeleton className="h-96 w-full rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Top Banner & Horizon Switcher */}
      <div className="bg-gradient-to-r from-violet-900 via-indigo-900 to-slate-900 text-white rounded-2xl p-5 shadow-sm border border-violet-800/40 relative overflow-hidden">
        <div className="absolute right-0 top-0 w-96 h-96 bg-violet-500/10 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-center gap-3.5">
            <div className="p-3 bg-violet-500/20 text-violet-300 rounded-xl border border-violet-400/30 backdrop-blur-md">
              <CalendarRange className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-xl font-bold tracking-tight">
                  {ar ? "توقعات الإشغال والأسرة المتاحة" : "Occupancy & Bed Availability Forecast"}
                </h2>
                <Badge variant="outline" className="text-xs border-violet-400/40 text-violet-200 bg-violet-500/10">
                  {ar ? `أفق ${horizonDays} يوماً` : `${horizonDays}-Day Horizon`}
                </Badge>
              </div>
              <p className="text-xs text-violet-200/80 mt-1">
                {ar
                  ? `توقعات يومية لحركة النزلاء والمقيمين والقادمين والمغادرين لمنتجع ${activePropObj?.name || "صن رايز"}.`
                  : `Day-by-day projected occupancy, arrivals, and departures for ${activePropObj?.name || "Property"}.`}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2.5 flex-wrap">
            {/* Building filter */}
            <select
              value={selectedBuildingId}
              onChange={(e) => setSelectedBuildingId(e.target.value)}
              aria-label={ar ? "تصفية حسب المبنى" : "Filter by building"}
              className="bg-violet-950/60 text-white text-xs border border-violet-700/50 rounded-lg px-3 py-1.5 focus:outline-hidden focus:ring-2 focus:ring-violet-400"
            >
              <option value="all">{ar ? "كافة المباني (السكن بالكامل)" : "All Buildings"}</option>
              {buildings.map((b: any) => (
                <option key={b.id} value={b.id}>
                  {b.name}
                </option>
              ))}
            </select>

            {/* Horizon Selector */}
            <div className="inline-flex rounded-lg bg-violet-950/80 p-1 border border-violet-700/50">
              <button
                type="button"
                onClick={() => setHorizonDays(7)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  horizonDays === 7 ? "bg-violet-600 text-white shadow-xs" : "text-violet-300 hover:text-white"
                }`}
              >
                {ar ? "7 أيام" : "7 Days"}
              </button>
              <button
                type="button"
                onClick={() => setHorizonDays(14)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  horizonDays === 14 ? "bg-violet-600 text-white shadow-xs" : "text-violet-300 hover:text-white"
                }`}
              >
                {ar ? "14 يوماً" : "14 Days"}
              </button>
              <button
                type="button"
                onClick={() => setHorizonDays(30)}
                className={`px-3 py-1 text-xs font-semibold rounded-md transition-all ${
                  horizonDays === 30 ? "bg-violet-600 text-white shadow-xs" : "text-violet-300 hover:text-white"
                }`}
              >
                {ar ? "30 يوماً" : "30 Days"}
              </button>
            </div>

            {/* Export buttons */}
            <Button
              variant="outline"
              size="sm"
              onClick={onExportExcel}
              className="gap-1.5 text-xs bg-violet-950/50 text-violet-100 border-violet-700/50 hover:bg-violet-800"
            >
              <FileSpreadsheet className="w-3.5 h-3.5" />
              Excel
            </Button>
            <Button
              variant="default"
              size="sm"
              onClick={onExportPDF}
              className="gap-1.5 text-xs bg-violet-500 hover:bg-violet-600 text-white shadow-xs border-0"
            >
              <Printer className="w-3.5 h-3.5" />
              {ar ? "طباعة التوقعات PDF" : "Print PDF"}
            </Button>
          </div>
        </div>
      </div>

      {/* 6 Summary Metric Cards for Horizon */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
        <div className="border rounded-2xl p-3.5 bg-card/75 shadow-xs border-border/50 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-muted-foreground mb-1">
            <span>{ar ? "متوسط الإشغال المتوقع" : "Avg Projected Occupancy"}</span>
            <div className="p-1.5 rounded-lg bg-indigo-500/10 text-indigo-600">
              <TrendingUp className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-indigo-600 dark:text-indigo-400">
            {aggregateMetrics.avgOcc}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ar ? `خلال ${horizonDays} يوماً مقبلة` : `Across ${horizonDays} days`}
          </p>
        </div>

        <div className="border rounded-2xl p-3.5 bg-rose-500/5 shadow-xs border-rose-500/20 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-rose-700 dark:text-rose-300 mb-1">
            <span>{ar ? "أعلى إشغال (الذروة)" : "Peak Occupancy"}</span>
            <div className="p-1.5 rounded-lg bg-rose-500/10 text-rose-600">
              <ArrowUpRight className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-rose-600 dark:text-rose-400">
            {aggregateMetrics.peakOcc}%
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5 truncate" title={aggregateMetrics.peakDate}>
            {aggregateMetrics.peakDate}
          </p>
        </div>

        <div className="border rounded-2xl p-3.5 bg-emerald-500/5 shadow-xs border-emerald-500/20 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-emerald-700 dark:text-emerald-300 mb-1">
            <span>{ar ? "إجمالي القادمين" : "Total Due In"}</span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-600">
              <Users className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-emerald-600 dark:text-emerald-400">
            +{aggregateMetrics.totalArrivals}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ar ? "حجوزات مؤكدة قادمة" : "Confirmed bookings"}
          </p>
        </div>

        <div className="border rounded-2xl p-3.5 bg-amber-500/5 shadow-xs border-amber-500/20 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-amber-700 dark:text-amber-300 mb-1">
            <span>{ar ? "إجمالي المغادرين" : "Total Due Out"}</span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
              <LogOut className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-amber-600 dark:text-amber-400">
            -{aggregateMetrics.totalDepartures}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ar ? "تصفيات ومغادرات مجدولة" : "Scheduled checkouts"}
          </p>
        </div>

        <div className="border rounded-2xl p-3.5 bg-sky-500/5 shadow-xs border-sky-500/20 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-sky-700 dark:text-sky-300 mb-1">
            <span>{ar ? "أدنى أسرة شاغرة متاحة" : "Lowest Availability"}</span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-600">
              <BedDouble className="w-3.5 h-3.5" />
            </div>
          </div>
          <p className="text-2xl font-extrabold tracking-tight text-sky-600 dark:text-sky-400">
            {aggregateMetrics.minVacant}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ar ? `من إجمالي ${totalCapacity} سرير` : `Of ${totalCapacity} total beds`}
          </p>
        </div>

        <div className="border rounded-2xl p-3.5 bg-purple-500/5 shadow-xs border-purple-500/20 backdrop-blur-xl flex flex-col justify-between">
          <div className="flex items-center justify-between text-xs font-semibold text-purple-700 dark:text-purple-300 mb-1">
            <span>{ar ? "صافي حركة الفترة" : "Net Horizon Shift"}</span>
            <div className="p-1.5 rounded-lg bg-purple-500/10 text-purple-600">
              {aggregateMetrics.netChange >= 0 ? (
                <ArrowUpRight className="w-3.5 h-3.5" />
              ) : (
                <ArrowDownRight className="w-3.5 h-3.5" />
              )}
            </div>
          </div>
          <p className={`text-2xl font-extrabold tracking-tight ${
            aggregateMetrics.netChange > 0
              ? "text-emerald-600"
              : aggregateMetrics.netChange < 0
              ? "text-amber-600"
              : "text-foreground"
          }`}>
            {aggregateMetrics.netChange > 0 ? `+${aggregateMetrics.netChange}` : aggregateMetrics.netChange}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {ar ? "فارق القادمين عن المغادرين" : "Arrivals minus departures"}
          </p>
        </div>
      </div>

      {/* Visual Day-by-Day Forecast Trend Bar Chart */}
      <div className="border rounded-2xl bg-card p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <TrendingUp className="w-4 h-4 text-violet-600" />
            <h3 className="font-bold text-sm text-foreground">
              {ar ? `المسار البياني لنسبة الإشغال المتوقعة (${horizonDays} يوماً)` : `Projected Occupancy Trendline (${horizonDays} Days)`}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
              {ar ? "طبيعي (<75%)" : "Normal"}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-amber-500" />
              {ar ? "مرتفع (75-89%)" : "Busy"}
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-500" />
              {ar ? "ذروة (>=90%)" : "Peak"}
            </span>
          </div>
        </div>

        {/* Visual Columns Bar */}
        <div className="grid grid-cols-7 sm:grid-cols-7 lg:grid-cols-14 gap-2 pt-2">
          {forecastData.slice(0, 14).map((d) => {
            const barColor =
              d.occPercent >= 90
                ? "bg-rose-500"
                : d.occPercent >= 75
                ? "bg-amber-500"
                : "bg-emerald-500";
            return (
              <div
                key={d.dateIso}
                className="flex flex-col items-center justify-end h-32 p-2 rounded-xl bg-slate-50 dark:bg-slate-900/40 border border-slate-100 dark:border-slate-800 group hover:border-violet-300 transition-all"
              >
                <span className="text-[11px] font-bold font-mono text-foreground mb-1">
                  {d.occPercent}%
                </span>
                <div className="w-full bg-slate-200 dark:bg-slate-700 rounded-t h-16 flex items-end overflow-hidden">
                  <div
                    className={`w-full transition-all duration-500 rounded-t ${barColor}`}
                    style={{ height: `${Math.max(10, Math.min(100, d.occPercent))}%` }}
                  />
                </div>
                <div className="text-center mt-2">
                  <p className="text-[10px] font-semibold text-foreground truncate">{d.dayName.slice(0, 3)}</p>
                  <p className="text-[9px] font-mono text-muted-foreground">{d.dateDisplay.slice(0, 5)}</p>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Main Day-by-Day Forecast Ledger Table */}
      <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
        <div className="p-4 border-b bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Building className="w-4 h-4 text-violet-600" />
            <h3 className="font-bold text-sm text-foreground">
              {ar ? "جدول سجل التوقعات اليومية (Daily Forecast Ledger)" : "Daily Forecast Ledger"}
            </h3>
          </div>
          <span className="text-xs text-muted-foreground">
            {ar ? `إجمالي السعة المتاحة: ${totalCapacity} سرير` : `Total Capacity: ${totalCapacity} Beds`}
          </span>
        </div>

        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-[#0F2A44] hover:bg-[#0F2A44] text-white">
                <TableHead className="text-white">{ar ? "التاريخ واليوم" : "Date & Day"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "الوصول المتوقع (+ Due In)" : "Expected Arrivals"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "المغادرة المتوقعة (- Due Out)" : "Expected Departures"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "صافي الحركة" : "Net Shift"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "الأسرة المشغولة" : "Projected Occupied"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "الأسرة الشاغرة" : "Projected Vacant"}</TableHead>
                <TableHead className="text-white text-center min-w-[140px]">{ar ? "نسبة الإشغال" : "Occupancy Rate"}</TableHead>
                <TableHead className="text-white text-center">{ar ? "مستوى الضغط" : "Demand Level"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {forecastData.map((row) => (
                <TableRow key={row.dateIso} className="hover:bg-slate-50/80 dark:hover:bg-slate-900/40">
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 flex flex-col items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                        <span>{row.dateDisplay.slice(0, 2)}</span>
                      </div>
                      <div>
                        <p className="font-bold text-sm text-foreground">{row.dayName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.dateDisplay}</p>
                      </div>
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    {row.dayArrivals > 0 ? (
                      <Badge variant="secondary" className="font-mono bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                        +{row.dayArrivals}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">0</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    {row.dayDepartures > 0 ? (
                      <Badge variant="secondary" className="font-mono bg-rose-50 text-rose-700 border-rose-200 font-bold">
                        -{row.dayDepartures}
                      </Badge>
                    ) : (
                      <span className="text-xs text-muted-foreground font-mono">0</span>
                    )}
                  </TableCell>

                  <TableCell className="text-center">
                    <span className={`font-mono text-xs font-bold ${
                      row.netMovement > 0
                        ? "text-emerald-600"
                        : row.netMovement < 0
                        ? "text-rose-600"
                        : "text-muted-foreground"
                    }`}>
                      {row.netMovement > 0 ? `+${row.netMovement}` : row.netMovement}
                    </span>
                  </TableCell>

                  <TableCell className="text-center font-mono font-bold text-sm text-foreground">
                    {row.projectedOccupied}
                  </TableCell>

                  <TableCell className="text-center font-mono text-sm font-semibold text-emerald-600 dark:text-emerald-400">
                    {row.projectedVacant}
                  </TableCell>

                  <TableCell className="text-center">
                    <div className="flex items-center gap-2 justify-center">
                      <span className="font-mono font-bold text-xs w-10 text-right">{row.occPercent}%</span>
                      <Progress
                        value={row.occPercent}
                        className="w-20 h-2"
                      />
                    </div>
                  </TableCell>

                  <TableCell className="text-center">
                    <Badge
                      variant="outline"
                      className={
                        row.demand === "CRITICAL"
                          ? "bg-rose-100 text-rose-800 border-rose-300 font-bold"
                          : row.demand === "HIGH"
                          ? "bg-amber-100 text-amber-800 border-amber-300 font-semibold"
                          : row.demand === "LOW"
                          ? "bg-blue-50 text-blue-700 border-blue-200"
                          : "bg-emerald-50 text-emerald-700 border-emerald-200"
                      }
                    >
                      {row.demand === "CRITICAL"
                        ? (ar ? "ذروة إشغال" : "Peak Demand")
                        : row.demand === "HIGH"
                        ? (ar ? "إشغال مرتفع" : "High Demand")
                        : row.demand === "LOW"
                        ? (ar ? "إشغال منخفض" : "Low Demand")
                        : (ar ? "إشغال طبيعي" : "Normal Demand")}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
