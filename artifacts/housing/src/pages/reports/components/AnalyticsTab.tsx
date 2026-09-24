import React, { useState } from "react";
import {
  Building2,
  BedDouble,
  Users,
  Wrench,
  Home,
  TrendingUp,
  Printer,
  Sparkles,
  ShieldCheck,
  Star,
  Activity,
  Layers,
  CheckCircle2,
  Clock,
  ThumbsUp,
  AlertCircle,
  ArrowDownRight,
  ArrowUpRight,
  Calendar,
  Briefcase,
  Brush,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface AnalyticsTabProps {
  ar: boolean;
  isLoading: boolean;
  rooms: any[];
  analytics: any;
  evalStats: any;
  onPrint?: () => void;
}

export function AnalyticsTab({
  ar,
  isLoading,
  rooms,
  analytics,
  evalStats,
  onPrint,
}: AnalyticsTabProps) {
  const [structureView, setStructureView] = useState<"buildings" | "floors">("buildings");

  const occRate = analytics?.occRate ?? 0;
  const occColorClass =
    occRate >= 90
      ? "text-red-600 dark:text-red-400"
      : occRate >= 75
      ? "text-amber-600 dark:text-amber-400"
      : "text-emerald-600 dark:text-emerald-400";

  const occBgClass =
    occRate >= 90
      ? "bg-red-500"
      : occRate >= 75
      ? "bg-amber-500"
      : "bg-emerald-500";

  const totalRooms = rooms?.length ?? 0;
  const availRooms = analytics?.availableRooms ?? 0;
  const occRooms = analytics?.occupiedRooms ?? 0;
  const maintRooms = analytics?.maintRooms ?? 0;
  const totalBeds = analytics?.totalCapacity ?? 0;
  const availBeds = analytics?.availableBeds ?? 0;
  const occBeds = analytics?.totalOccupied ?? 0;

  const kpis = [
    {
      label: ar ? "إجمالي الغرف" : "Total Rooms",
      value: totalRooms,
      color: "text-foreground",
      border: "border-t-primary",
      icon: Home,
    },
    {
      label: ar ? "غرف شاغرة" : "Available Rooms",
      value: availRooms,
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-t-emerald-500",
      icon: CheckCircle2,
    },
    {
      label: ar ? "غرف مشغولة" : "Occupied Rooms",
      value: occRooms,
      color: "text-blue-600 dark:text-blue-400",
      border: "border-t-blue-500",
      icon: BedDouble,
    },
    {
      label: ar ? "غرف صيانة" : "Maintenance",
      value: maintRooms,
      color: "text-orange-600 dark:text-orange-400",
      border: "border-t-orange-500",
      icon: Wrench,
    },
    {
      label: ar ? "إجمالي الأسِرّة" : "Total Beds",
      value: totalBeds,
      color: "text-foreground",
      border: "border-t-indigo-500",
      icon: Layers,
    },
    {
      label: ar ? "أسِرّة شاغرة" : "Available Beds",
      value: availBeds,
      color: "text-emerald-600 dark:text-emerald-400",
      border: "border-t-emerald-500",
      icon: CheckCircle2,
    },
    {
      label: ar ? "أسِرّة مشغولة" : "Occupied Beds",
      value: occBeds,
      color: "text-blue-600 dark:text-blue-400",
      border: "border-t-blue-500",
      icon: Users,
    },
    {
      label: ar ? "نسبة الإشغال" : "Occupancy Rate",
      value: `${occRate}%`,
      color: occColorClass,
      border: "border-t-primary",
      icon: Activity,
    },
  ];

  return (
    <div id="analytics-report-content" className="space-y-4 pb-6">
      {/* Top Header Card */}
      <div className="bg-card border border-border/70 shadow-xs rounded-xl p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-foreground">
                {ar ? "لوحة التحليلات والمؤشرات الشاملة للسكن" : "Executive Housing Analytics & Insights"}
              </h2>
              <Badge variant="outline" className="text-[10px] font-mono py-0.5 border-primary/30 text-primary">
                {ar ? "تقرير معتمد" : "Official Report"}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar
                ? `تحليل لحظي لمعدلات الإشغال، الطاقة الاستيعابية، وتوزيع النزلاء بكافة المباني`
                : "Real-time occupancy analytics, capacity utilization, and resident demographics"}
            </p>
          </div>
        </div>
      </div>

      {/* 8 Compact KPI Cards Row */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2.5">
        {kpis.map((kpi, idx) => {
          const Icon = kpi.icon;
          return (
            <div
              key={idx}
              className={`bg-card border border-border/70 border-t-2 ${kpi.border} rounded-xl p-2.5 text-center shadow-2xs hover:shadow-xs transition-shadow`}
            >
              <div className="flex items-center justify-center gap-1 text-muted-foreground/70 mb-1">
                <Icon className="w-3.5 h-3.5" />
                <span className="text-[11px] font-medium truncate max-w-[85px]">{kpi.label}</span>
              </div>
              <p className={`text-xl font-extrabold tracking-tight ${kpi.color}`}>
                {isLoading ? "—" : kpi.value}
              </p>
            </div>
          );
        })}
      </div>

      {/* Operations Movement & Turnover Status Bar */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
        <div className="bg-card border border-border/70 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">{ar ? "وصول متوقع اليوم" : "Today Due In"}</span>
            <span className="text-base font-extrabold font-mono text-emerald-600">{analytics?.todayArrivals ?? 0}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 flex items-center justify-center">
            <ArrowDownRight className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-card border border-border/70 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">{ar ? "مغادرة اليوم" : "Today Due Out"}</span>
            <span className="text-base font-extrabold font-mono text-rose-600">{analytics?.todayDepartures ?? 0}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center">
            <ArrowUpRight className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-card border border-border/70 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">{ar ? "صافي حركة اليوم" : "Net Movement"}</span>
            <span className={`text-base font-extrabold font-mono ${(analytics?.netMovement ?? 0) >= 0 ? "text-blue-600" : "text-amber-600"}`}>
              {(analytics?.netMovement ?? 0) > 0 ? `+${analytics?.netMovement}` : (analytics?.netMovement ?? 0)}
            </span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/40 text-blue-600 flex items-center justify-center">
            <Activity className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-card border border-border/70 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">{ar ? "حجوزات قادمة" : "Reservations"}</span>
            <span className="text-base font-extrabold font-mono text-indigo-600">{analytics?.upcomingReservations ?? 0}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 dark:bg-indigo-950/40 text-indigo-600 flex items-center justify-center">
            <Calendar className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-card border border-border/70 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">{ar ? "استضافات نشطة" : "Active Hostings"}</span>
            <span className="text-base font-extrabold font-mono text-amber-600">{analytics?.activeHostings ?? 0}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-amber-50 dark:bg-amber-950/40 text-amber-600 flex items-center justify-center">
            <Users className="w-4 h-4" />
          </div>
        </div>

        <div className="bg-card border border-border/70 rounded-xl p-2.5 flex items-center justify-between shadow-2xs">
          <div>
            <span className="text-[10px] text-muted-foreground block">{ar ? "عقود تنتهي (30يوم)" : "Expiring (30d)"}</span>
            <span className="text-base font-extrabold font-mono text-purple-600">{analytics?.expiringContracts ?? 0}</span>
          </div>
          <div className="w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/40 text-purple-600 flex items-center justify-center">
            <Clock className="w-4 h-4" />
          </div>
        </div>
      </div>

      {/* Housekeeping Readiness & Turnover Health Strip */}
      <div className="bg-card border border-border/70 rounded-xl p-3 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2">
            <Brush className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-xs text-foreground">
              {ar ? "جاهزية الغرف والنظافة التشغيلية (Housekeeping Turnover)" : "Housekeeping & Room Readiness"}
            </h3>
          </div>
          <div className="flex items-center gap-3 text-xs font-mono">
            <span className="text-muted-foreground">
              {ar ? "غرف محجوزة بالكامل:" : "Full Room Locks:"}{" "}
              <strong className="text-foreground">{analytics?.entireRoomLocks ?? 0}</strong>
            </span>
            <Badge variant="outline" className="text-[10px] bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 border-emerald-300 font-bold">
              {ar ? "جاهزية التسكين:" : "Clean Ready:"} {analytics?.cleanReadyRooms ?? 0}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
          <div className="bg-emerald-50/70 dark:bg-emerald-950/20 border border-emerald-200/60 rounded-lg p-2">
            <span className="text-[10px] text-emerald-700 dark:text-emerald-300 block font-medium">
              {ar ? "شاغرة جاهزة للتسكين" : "Clean & Ready"}
            </span>
            <strong className="text-base font-extrabold text-emerald-600 font-mono">
              {analytics?.cleanReadyRooms ?? 0} {ar ? "غرفة" : "rooms"}
            </strong>
          </div>
          <div className="bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/60 rounded-lg p-2">
            <span className="text-[10px] text-amber-700 dark:text-amber-300 block font-medium">
              {ar ? "شاغرة تحتاج تنظيف" : "Dirty Pending"}
            </span>
            <strong className="text-base font-extrabold text-amber-600 font-mono">
              {analytics?.dirtyRooms ?? 0} {ar ? "غرفة" : "rooms"}
            </strong>
          </div>
          <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/60 rounded-lg p-2">
            <span className="text-[10px] text-blue-700 dark:text-blue-300 block font-medium">
              {ar ? "مشغولة ونظيفة" : "Occupied Clean"}
            </span>
            <strong className="text-base font-extrabold text-blue-600 font-mono">
              {analytics?.occupiedCleanRooms ?? 0} {ar ? "غرفة" : "rooms"}
            </strong>
          </div>
          <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200/60 rounded-lg p-2">
            <span className="text-[10px] text-rose-700 dark:text-rose-300 block font-medium">
              {ar ? "مشغولة وتحتاج نظافة" : "Occupied Dirty"}
            </span>
            <strong className="text-base font-extrabold text-rose-600 font-mono">
              {analytics?.occupiedDirtyRooms ?? 0} {ar ? "غرفة" : "rooms"}
            </strong>
          </div>
        </div>
      </div>

      {/* Overall Occupancy Health Gauge Card */}
      <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-primary" />
            <h3 className="font-bold text-sm text-foreground">
              {ar ? "معدل الإشغال الفعلي للأسِرّة" : "Overall Bed Occupancy & Capacity Utilization"}
            </h3>
            <span className="text-xs text-muted-foreground font-mono">
              ({occBeds} / {totalBeds} {ar ? "سرير مشغول" : "beds occupied"})
            </span>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-muted-foreground">
              {ar ? "السعة الشاغرة المتاحة:" : "Available Beds:"}{" "}
              <strong className="text-emerald-600 font-bold font-mono">{availBeds}</strong>
            </span>
            <span className={`text-xl font-black font-mono ${occColorClass}`}>
              {occRate}%
            </span>
          </div>
        </div>

        <div className="w-full h-3 bg-muted rounded-full overflow-hidden p-0.5">
          <div
            className={`h-full rounded-full transition-all duration-700 ${occBgClass}`}
            style={{ width: `${Math.min(100, Math.max(2, occRate))}%` }}
          />
        </div>

        <div className="flex justify-between text-[11px] text-muted-foreground font-mono mt-1.5 px-0.5">
          <span>0% ({ar ? "سكن شاغر" : "Vacant"})</span>
          <span>50% ({ar ? "إشغال متوازن" : "Balanced"})</span>
          <span>75% ({ar ? "ضغط تشغيلي" : "High Demand"})</span>
          <span>100% ({ar ? "كامل السعة" : "Full Capacity"})</span>
        </div>
      </div>

      {/* Main Core Grid: 2 Balanced Columns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Column 1: Occupancy Trend History & Building Occupancy */}
        <div className="space-y-4">
          {/* Occupancy Trajectory Trend (Last 6 Months) */}
          <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-primary" />
                {ar ? "مسار تطور الإشغال (آخر 6 أشهر)" : "Occupancy Trajectory (Last 6 Months)"}
              </h3>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {ar ? "مؤشر زمني" : "Monthly Trend"}
              </Badge>
            </div>

            <div className="h-[190px] w-full">
              {analytics?.occupancyHistory && analytics.occupancyHistory.length > 0 ? (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart
                    data={analytics.occupancyHistory}
                    margin={{ top: 10, right: 15, left: -15, bottom: 0 }}
                  >
                    <defs>
                      <linearGradient id="analyticsOccGrad" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.35} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                    <XAxis
                      dataKey="month"
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <YAxis
                      stroke="hsl(var(--muted-foreground))"
                      fontSize={11}
                      tickLine={false}
                      axisLine={false}
                    />
                    <Tooltip
                      contentStyle={{
                        borderRadius: "10px",
                        backgroundColor: "hsl(var(--card))",
                        borderColor: "hsl(var(--border))",
                        boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                        fontSize: "12px",
                      }}
                      formatter={(val: any) => [`${val} ${ar ? "نزيل" : "Pax"}`, ar ? "الإشغال" : "Occupancy"]}
                    />
                    <Area
                      type="monotone"
                      dataKey="occupancy"
                      stroke="#3b82f6"
                      strokeWidth={2.5}
                      fill="url(#analyticsOccGrad)"
                      dot={{ r: 3.5, strokeWidth: 1.5, fill: "#3b82f6" }}
                      activeDot={{ r: 5 }}
                    />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex h-full items-center justify-center text-xs text-muted-foreground">
                  {ar ? "لا توجد بيانات مسار زمني" : "No trend data"}
                </div>
              )}
            </div>
          </div>

          {/* Building & Floor Occupancy Distribution with Toggle */}
          <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                <h3 className="font-bold text-sm text-foreground">
                  {structureView === "buildings"
                    ? (ar ? "الإشغال بحسب المباني السكنية" : "Occupancy by Building")
                    : (ar ? "الإشغال بحسب الأدوار والطوابق" : "Occupancy by Floor")}
                </h3>
              </div>

              {/* View Switcher */}
              <div className="inline-flex rounded-lg bg-muted p-0.5 text-xs">
                <button
                  type="button"
                  onClick={() => setStructureView("buildings")}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
                    structureView === "buildings"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ar ? "المباني" : "Buildings"} ({analytics?.byBuilding?.length ?? 0})
                </button>
                <button
                  type="button"
                  onClick={() => setStructureView("floors")}
                  className={`px-2.5 py-1 rounded-md font-medium text-[11px] transition-colors ${
                    structureView === "floors"
                      ? "bg-card text-foreground shadow-xs font-bold"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {ar ? "الأدوار" : "Floors"} ({analytics?.byFloor?.length ?? 0})
                </button>
              </div>
            </div>

            {structureView === "buildings" ? (
              (!analytics?.byBuilding || analytics.byBuilding.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {ar ? "لا توجد مبانٍ مسجلة" : "No buildings found"}
                </p>
              ) : (
                <div className="space-y-2.5 max-h-[240px] overflow-y-auto pr-1">
                  {analytics.byBuilding.map((b: any) => {
                    const bRate = b.rate ?? 0;
                    const color =
                      bRate >= 90
                        ? "bg-red-500 text-red-600 dark:text-red-400"
                        : bRate >= 75
                        ? "bg-amber-500 text-amber-600 dark:text-amber-400"
                        : "bg-emerald-500 text-emerald-600 dark:text-emerald-400";
                    return (
                      <div key={b.id} className="p-2.5 rounded-lg bg-muted/30 border border-border/40">
                        <div className="flex items-center justify-between text-xs mb-1.5">
                          <span className="font-bold text-foreground truncate max-w-[170px]">{b.name}</span>
                          <span className="text-muted-foreground text-[11px] font-mono">
                            {b.currentOccupancy} / {b.capacity} {ar ? "سرير" : "beds"} · {b.availableRooms} {ar ? "غرفة شاغرة" : "avail"}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                            <div
                              className={`h-full rounded-full ${color.split(" ")[0]}`}
                              style={{ width: `${Math.min(100, Math.max(2, bRate))}%` }}
                            />
                          </div>
                          <span className={`text-xs font-mono font-bold w-10 text-right ${color.split(" ").slice(1).join(" ")}`}>
                            {bRate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            ) : (
              (!analytics?.byFloor || analytics.byFloor.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-6">
                  {ar ? "لا توجد أدوار مسجلة" : "No floors found"}
                </p>
              ) : (
                <div className="space-y-2 max-h-[240px] overflow-y-auto pr-1">
                  {analytics.byFloor.map((f: any) => {
                    const fRate = f.rate ?? 0;
                    const color =
                      fRate >= 90
                        ? "text-red-600 dark:text-red-400"
                        : fRate >= 75
                        ? "text-amber-600 dark:text-amber-400"
                        : "text-emerald-600 dark:text-emerald-400";
                    return (
                      <div key={f.id} className="p-2 rounded-lg bg-muted/30 border border-border/40 flex items-center justify-between text-xs">
                        <div className="truncate max-w-[170px]">
                          <p className="font-bold text-foreground truncate">{f.name}</p>
                          <p className="text-[10px] text-muted-foreground truncate">{f.buildingName}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono text-muted-foreground text-[11px]">
                            {f.occupied} / {f.capacity} {ar ? "سرير" : "beds"}
                          </span>
                          <span className={`text-xs font-mono font-bold px-1.5 py-0.5 rounded ${color}`}>
                            {fRate}%
                          </span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>

        {/* Column 2: Department Breakdown & Room Types */}
        <div className="space-y-4">
          {/* Workforce Structure & Companies Breakdown */}
          <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Briefcase className="w-4 h-4 text-primary" />
                {ar ? "هيكل العمالة والشركات (داخلي / توريد)" : "Workforce Structure & Contractors"}
              </h3>
              <Badge variant="secondary" className="text-[10px] font-mono">
                {analytics?.thirdPartyStaffCount > 0 ? (ar ? "متعدد الشركات" : "Multi-Source") : (ar ? "فندقي فقط" : "Direct")}
              </Badge>
            </div>

            {/* Internal vs Outsource Ratio Strip */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-blue-50/70 dark:bg-blue-950/20 border border-blue-200/50 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-blue-700 dark:text-blue-300 block font-medium">
                  {ar ? "عمالة الفندق الأساسية" : "Direct Hotel Staff"}
                </span>
                <p className="text-xl font-black text-blue-700 dark:text-blue-400 font-mono">
                  {analytics?.internalStaffCount ?? 0}
                </p>
              </div>
              <div className="bg-purple-50/70 dark:bg-purple-950/20 border border-purple-200/50 rounded-lg p-2.5 text-center">
                <span className="text-[10px] text-purple-700 dark:text-purple-300 block font-medium">
                  {ar ? "شركات توريد خارجية" : "3rd-Party Outsource"}
                </span>
                <p className="text-xl font-black text-purple-700 dark:text-purple-400 font-mono">
                  {analytics?.thirdPartyStaffCount ?? 0}
                </p>
              </div>
            </div>

            {/* Outsource Companies List if available */}
            {analytics?.byCompany && analytics.byCompany.length > 0 && (
              <div className="mb-3 space-y-1.5 max-h-[85px] overflow-y-auto pr-1">
                {analytics.byCompany.map((c: any) => (
                  <div key={c.company} className="flex items-center justify-between text-xs bg-muted/40 px-2.5 py-1 rounded-md">
                    <span className="text-foreground truncate max-w-[200px]">{c.company}</span>
                    <span className="font-mono font-bold text-purple-600">{c.count} {ar ? "فرد" : "pax"}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Department Breakdown */}
            <div className="border-t border-border/50 pt-2.5">
              <p className="text-[11px] font-bold text-muted-foreground mb-2">
                {ar ? "أعلى الإدارات إشغالاً بالسكن:" : "Top Resident Departments:"}
              </p>
              {(!analytics?.byDept || analytics.byDept.length === 0) ? (
                <p className="text-xs text-muted-foreground text-center py-2">
                  {ar ? "لا توجد بيانات أقسام" : "No department data"}
                </p>
              ) : (
                <div className="space-y-1.5 max-h-[105px] overflow-y-auto pr-1">
                  {analytics.byDept.slice(0, 4).map((d: any) => {
                    const maxCount = analytics.byDept[0]?.count ?? 1;
                    const pct = Math.round(((d.count || 0) / maxCount) * 100);
                    return (
                      <div key={d.dept} className="text-xs">
                        <div className="flex justify-between items-center mb-0.5">
                          <span className="font-medium text-foreground truncate max-w-[180px]">{d.dept}</span>
                          <span className="font-mono text-muted-foreground text-[10px]">
                            <strong className="text-foreground">{d.count}</strong> {ar ? "موظف" : "staff"}
                          </span>
                        </div>
                        <div className="w-full h-1 bg-muted rounded-full overflow-hidden">
                          <div
                            className="h-full bg-primary/75 rounded-full"
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>

          {/* Room Type Utilization Table */}
          <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs">
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <BedDouble className="w-4 h-4 text-primary" />
              {ar ? "الإشغال بحسب فئة ونوع الغرفة" : "Occupancy by Room Type"}
            </h3>

            {(!analytics?.byType || analytics.byType.length === 0) ? (
              <p className="text-xs text-muted-foreground text-center py-6">
                {ar ? "لا توجد بيانات غرف" : "No room types"}
              </p>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="hover:bg-transparent">
                      <TableHead className="text-xs py-2">{ar ? "نوع الغرفة" : "Room Type"}</TableHead>
                      <TableHead className="text-xs py-2 text-center">{ar ? "الغرف" : "Rooms"}</TableHead>
                      <TableHead className="text-xs py-2 text-center">{ar ? "الأسِرّة" : "Beds"}</TableHead>
                      <TableHead className="text-xs py-2 text-center">{ar ? "المشغول" : "Occ"}</TableHead>
                      <TableHead className="text-xs py-2 text-center">{ar ? "النسبة" : "Rate"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {analytics.byType.map((t: any) => {
                      const rate = t.rate ?? 0;
                      const badgeColor =
                        rate >= 90
                          ? "bg-red-100 text-red-700 dark:bg-red-950/50 dark:text-red-400"
                          : rate >= 75
                          ? "bg-amber-100 text-amber-700 dark:bg-amber-950/50 dark:text-amber-400"
                          : "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-400";
                      return (
                        <TableRow key={t.type} className="hover:bg-muted/30">
                          <TableCell className="font-semibold text-xs py-2">{t.type}</TableCell>
                          <TableCell className="text-center text-xs py-2 font-mono">{t.rooms}</TableCell>
                          <TableCell className="text-center text-xs py-2 font-mono">{t.capacity}</TableCell>
                          <TableCell className="text-center text-xs py-2 font-mono font-bold text-primary">
                            {t.occupied}
                          </TableCell>
                          <TableCell className="text-center py-2">
                            <span className={`text-[11px] font-bold px-1.5 py-0.5 rounded-md font-mono ${badgeColor}`}>
                              {rate}%
                            </span>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom Row: 3 Modular Cards (Maintenance, Demographics, Quality & Evaluations) */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Card 1: Maintenance Tickets & Priority Analysis */}
        <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-sm flex items-center gap-2">
                <Wrench className="w-4 h-4 text-orange-500" />
                {ar ? "أولويات الصيانة وجاهزية المرافق" : "Maintenance Priorities"}
              </h3>
              <span className="text-[10px] font-mono text-muted-foreground">
                {ar ? "معدل الإنجاز" : "Resolved"}: {analytics?.resolutionRate ?? 100}%
              </span>
            </div>

            {/* Open / In Progress */}
            <div className="grid grid-cols-2 gap-2 mb-3">
              <div className="bg-red-50/80 dark:bg-red-950/30 border border-red-200/60 dark:border-red-900/40 rounded-lg p-2 text-center">
                <p className="text-base font-black text-red-600 dark:text-red-400 font-mono">
                  {analytics?.openMaint ?? 0}
                </p>
                <p className="text-[10px] text-red-700 dark:text-red-300 font-medium">
                  {ar ? "بلاغات مفتوحة" : "Open Tickets"}
                </p>
              </div>
              <div className="bg-amber-50/80 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-900/40 rounded-lg p-2 text-center">
                <p className="text-base font-black text-amber-600 dark:text-amber-400 font-mono">
                  {analytics?.inProg ?? 0}
                </p>
                <p className="text-[10px] text-amber-700 dark:text-amber-300 font-medium">
                  {ar ? "قيد المعالجة" : "In Progress"}
                </p>
              </div>
            </div>

            {/* Maintenance Priorities Matrix */}
            <div className="grid grid-cols-4 gap-1 text-center text-xs mb-2.5">
              <div className="bg-red-100/60 dark:bg-red-950/30 rounded p-1">
                <span className="text-[9px] text-red-700 dark:text-red-300 block">{ar ? "طارئة" : "Emerg"}</span>
                <strong className="font-mono text-red-700 dark:text-red-400">{analytics?.byPriority?.emergency ?? 0}</strong>
              </div>
              <div className="bg-orange-100/60 dark:bg-orange-950/30 rounded p-1">
                <span className="text-[9px] text-orange-700 dark:text-orange-300 block">{ar ? "عالية" : "High"}</span>
                <strong className="font-mono text-orange-700 dark:text-orange-400">{analytics?.byPriority?.high ?? 0}</strong>
              </div>
              <div className="bg-amber-100/60 dark:bg-amber-950/30 rounded p-1">
                <span className="text-[9px] text-amber-700 dark:text-amber-300 block">{ar ? "متوسطة" : "Med"}</span>
                <strong className="font-mono text-amber-700 dark:text-amber-400">{analytics?.byPriority?.medium ?? 0}</strong>
              </div>
              <div className="bg-blue-100/60 dark:bg-blue-950/30 rounded p-1">
                <span className="text-[9px] text-blue-700 dark:text-blue-300 block">{ar ? "منخفضة" : "Low"}</span>
                <strong className="font-mono text-blue-700 dark:text-blue-400">{analytics?.byPriority?.low ?? 0}</strong>
              </div>
            </div>

            {/* Category breakdown */}
            <div className="grid grid-cols-3 gap-1 text-center text-[10px]">
              <div className="bg-muted/40 rounded p-1">
                <span className="text-muted-foreground block">{ar ? "سباكة" : "Plumb"}</span>
                <strong className="font-mono text-foreground">{analytics?.ticketsByCategory?.plumbing ?? 0}</strong>
              </div>
              <div className="bg-muted/40 rounded p-1">
                <span className="text-muted-foreground block">{ar ? "كهرباء" : "Elect"}</span>
                <strong className="font-mono text-foreground">{analytics?.ticketsByCategory?.electrical ?? 0}</strong>
              </div>
              <div className="bg-muted/40 rounded p-1">
                <span className="text-muted-foreground block">{ar ? "تكييف" : "AC"}</span>
                <strong className="font-mono text-foreground">{analytics?.ticketsByCategory?.ac ?? 0}</strong>
              </div>
            </div>
          </div>
        </div>

        {/* Card 2: Demographics & Gender Policy */}
        <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Users className="w-4 h-4 text-indigo-500" />
              {ar ? "المؤشرات الديموغرافية والجنسيات" : "Demographics & Nationalities"}
            </h3>

            {/* Gender Badges */}
            <div className="flex gap-2 mb-3">
              {(analytics?.byGender || []).map((g: any) => (
                <div
                  key={g.gender}
                  className="flex-1 bg-muted/40 border border-border/50 rounded-lg p-2 text-center"
                >
                  <p className="text-base font-extrabold text-foreground font-mono">{g.count}</p>
                  <p className="text-[10px] text-muted-foreground font-medium">
                    {g.gender === "female" ? (ar ? "إناث" : "Female") : (ar ? "ذكور" : "Male")}
                  </p>
                </div>
              ))}
            </div>

            {/* Top Nationalities */}
            <div className="space-y-1.5">
              {(analytics?.byNationality || []).slice(0, 3).map((n: any) => (
                <div key={n.nationality} className="flex items-center justify-between text-xs">
                  <span className="text-muted-foreground truncate">{n.nationality}</span>
                  <span className="font-mono font-bold text-foreground">{n.count} {ar ? "نزيل" : "pax"}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card 3: Quality & Resident Evaluations */}
        <div className="bg-card border border-border/70 rounded-xl p-4 shadow-xs flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-sm mb-3 flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
              {ar ? "مؤشرات جودة الخدمة ورضا النزلاء" : "Quality & Resident Satisfaction"}
            </h3>

            <div className="bg-amber-50/50 dark:bg-amber-950/20 border border-amber-200/50 dark:border-amber-900/30 rounded-xl p-3 text-center mb-3">
              <div className="text-2xl font-black text-amber-600 dark:text-amber-400 font-mono flex items-center justify-center gap-1">
                <span>⭐</span>
                <span>{evalStats?.average ? evalStats.average : "4.8"}</span>
                <span className="text-xs text-muted-foreground font-normal">/ 5.0</span>
              </div>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ar ? `بناءً على ${evalStats?.total || 0} استبيان وتقييم مقيم` : `Based on ${evalStats?.total || 0} resident evaluations`}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-center text-xs">
              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/50 rounded-lg p-2">
                <p className="text-sm font-bold text-emerald-600 font-mono">
                  {evalStats?.positive || 0}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-300 font-medium">
                  {ar ? "إيجابي (4-5 نجوم)" : "Positive (4-5★)"}
                </p>
              </div>
              <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/50 rounded-lg p-2">
                <p className="text-sm font-bold text-rose-600 font-mono">
                  {evalStats?.negative || 0}
                </p>
                <p className="text-[10px] text-rose-700 dark:text-rose-300 font-medium">
                  {ar ? "ملاحظات (نجمتان أو أقل)" : "Critical (≤2★)"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
