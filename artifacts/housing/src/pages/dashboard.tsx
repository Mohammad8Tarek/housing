// @ts-nocheck
import * as React from "react";
import {
  useGetDashboardStats,
  useGetOccupancyByBuilding,
  useGetRecentActivity,
  useListProfiles,
} from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Users,
  Building2,
  BedDouble,
  AlertCircle,
  CheckCircle2,
  AlertTriangle,
  Wrench,
  ArrowRight,
  ArrowUpRight,
  CalendarCheck,
  UserCheck,
  UserPlus,
  Sparkles,
  LayoutGrid,
  TrendingUp,
  ShieldCheck,
  Clock,
  Layers,
  Activity,
  BarChart3,
  RefreshCw,
  DoorOpen,
  Home,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/date-utils";
import { motion, useSpring, useTransform } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { usePermission } from "@/hooks/use-permission";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/loader";
import { Button } from "@/components/ui/button";
import {
  BarChart,
  Bar,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useProperty } from "@/context/PropertyContext";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { getPropertySlug } from "@/lib/property-slug";

// Executive Components
import { DashboardKpiCard } from "./dashboard/components/DashboardKpiCard";
import { DashboardAnalyticsDonut } from "./dashboard/components/DashboardAnalyticsDonut";
import { DepartmentBarList } from "./dashboard/components/DepartmentBarList";
import { ReadinessTrackerBar } from "./dashboard/components/ReadinessTrackerBar";
import { GenderDemographicsCard } from "./dashboard/components/GenderDemographicsCard";
import { BuildingCapacityMatrix } from "./dashboard/components/BuildingCapacityMatrix";
import { HousekeepingPriorityQueue } from "./dashboard/components/HousekeepingPriorityQueue";
import { DailyOperationsHub } from "./dashboard/components/DailyOperationsHub";
import { QuickAssistBar } from "./dashboard/components/QuickAssistTab";

function AnimatedNumber({ value }: { value: string | number }) {
  const reducedMotion = usePrefersReducedMotion();

  // Extract number and suffix (like %)
  const numMatch = String(value).match(/^([\d.]+)(.*)$/);
  const targetNum = numMatch ? parseFloat(numMatch[1]) : 0;
  const suffix = numMatch ? numMatch[2] : "";

  const spring = useSpring(0, { duration: 800, bounce: 0 });
  const display = useTransform(spring, (current) => {
    const hasDecimals = targetNum % 1 !== 0;
    return (hasDecimals ? current.toFixed(1) : Math.round(current)) + suffix;
  });

  React.useEffect(() => {
    spring.set(targetNum);
  }, [targetNum, spring]);

  if (reducedMotion) return <>{value}</>;
  return <motion.span>{display}</motion.span>;
}

export default function Dashboard() {
  const { language } = useLanguage();
  const {
    activePropertyId,
    activeProperty,
    propertySlug,
    properties,
    isSuperAdmin,
    canSeeAllProperties,
    setActivePropertyId,
  } = useProperty();
  const [, setLocation] = useLocation();
  const { canView } = usePermission();
  const ar = language === "ar";
  const isAll = activePropertyId === "all";

  // Real-time refresh state & queryClient
  const queryClient = useQueryClient();
  const [isRefreshing, setIsRefreshing] = React.useState(false);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/housing-breakdown"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/stats"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/analytics"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/pending"] }),
      queryClient.invalidateQueries({ queryKey: ["/api/dashboard/occupancy-by-building"] }),
    ]);
    setTimeout(() => setIsRefreshing(false), 500);
  };

  const [chartTab, setChartTab] = React.useState<"buildings" | "trends">("buildings");

  // Dashboard multi-view mode state (comprehensive, operations, analytics, compact)
  const [dashboardViewMode, setDashboardViewMode] = React.useState<
    "comprehensive" | "operations" | "analytics" | "compact"
  >("comprehensive");

  const buildNavHref = (baseHref: string) => {
    return propertySlug ? `/${propertySlug}${baseHref}` : baseHref;
  };

  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetDashboardStats(
    { propertyId: isAll ? 0 : activePropertyId! },
    { query: { enabled: !isAll && !!activePropertyId, refetchInterval: 15000 } },
  );

  const hasProfiles = canView("profiles");

  const { data: profilesData } = useListProfiles(
    { propertyId: isAll ? undefined : (activePropertyId as number), limit: 1 } as any,
    {
      query: {
        enabled: !isAll && !!activePropertyId && hasProfiles,
        refetchInterval: 15000,
      },
    },
  );
  const totalProfilesCount = profilesData?.pagination?.total ?? stats?.totalProfiles ?? 0;

  // Aggregate stats for 'all' mode
  const { data: allStats, isLoading: allLoading, isError: allStatsError } = useQuery({
    queryKey: ["/api/dashboard/all-stats"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/all-stats");
      if (!r.ok) throw new Error("Failed to load aggregated stats");
      return r.json();
    },
    enabled: isAll,
    refetchInterval: 15000,
  });

  // Deep executive analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/dashboard/analytics", isAll ? 0 : activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/analytics?propertyId=${isAll ? 0 : activePropertyId!}`,
      );
      if (!res.ok) throw new Error("Failed to load executive analytics");
      return res.json();
    },
    enabled: !isAll && !!activePropertyId,
    refetchInterval: 15000,
  });

  const { data: pendingData, isLoading: depLoading, isError: pendingError } = useQuery({
    queryKey: ["/api/dashboard/pending", isAll ? 0 : activePropertyId!],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/pending?propertyId=${isAll ? 0 : activePropertyId!}`,
      );
      if (!res.ok) throw new Error("Failed to load pending items");
      return res.json();
    },
    enabled: !isAll && !!activePropertyId,
    refetchInterval: 15000,
  });
  const departureAlerts = pendingData?.checkOuts ?? [];

  const { data: occupancy } = useGetOccupancyByBuilding(
    { propertyId: isAll ? 0 : activePropertyId! },
    { query: { enabled: !isAll && !!activePropertyId, refetchInterval: 15000 } },
  );

  const { data: housingBreakdown } = useQuery({
    queryKey: ["/api/dashboard/housing-breakdown", isAll ? 0 : activePropertyId!],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/housing-breakdown?propertyId=${isAll ? 0 : activePropertyId!}`,
      );
      if (!res.ok) throw new Error("Failed to load housing breakdown");
      return res.json();
    },
    enabled: !isAll && !!activePropertyId,
    refetchInterval: 15000,
  });

  const ribbonSummary = housingBreakdown?.summary || {
    totalBuildings: occupancy?.length ?? 0,
    totalFloors: 0,
    totalRooms: stats?.totalRooms ?? 0,
    occupiedRooms: stats?.occupiedRooms ?? 0,
    totalBeds: stats?.totalBeds ?? 0,
    occupiedBeds: stats?.occupiedBeds ?? 0,
    availableBeds: stats?.availableBeds ?? 0,
    bedOccupancyRate: stats?.bedOccupancyRate ?? 0,
  };

  const totals = allStats?.totals;
  const perProperty = allStats?.perProperty ?? [];

  return (
    <div className="space-y-6 pb-8">
      {/* Top Header & Horizon Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-foreground">
              {ar ? "مركز القيادة والعمليات" : "Command & Operations"}
            </h1>
            {isAll ? (
              <Badge
                variant="outline"
                className="text-xs px-2.5 py-0.5 border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-mono font-bold flex items-center gap-1 shadow-xs"
              >
                <span>👑</span>
                <span>{ar ? "إجمالي كل الفروع (سوبر أدمن)" : "ALL PROPERTIES (SUPER ADMIN)"}</span>
              </Badge>
            ) : activeProperty ? (
              <Badge
                variant="outline"
                className="text-xs px-2.5 py-0.5 border-primary/40 bg-primary/10 text-primary font-mono font-bold"
              >
                {activeProperty.code}
              </Badge>
            ) : null}
          </div>
        </div>

        {/* Header Controls: View Mode Switcher + Time Horizon Filter */}
        {!isAll && (
          <div className="flex flex-wrap items-center gap-2.5 self-start sm:self-auto">
            {/* Multi-View Mode Switcher */}
            <div className="flex items-center bg-muted/70 dark:bg-muted/40 p-1 rounded-xl border border-border/60 text-xs font-semibold shadow-xs">
              <button
                type="button"
                onClick={() => setDashboardViewMode("comprehensive")}
                title={ar ? "الوضع الشامل لجميع المؤشرات والعمليات" : "Comprehensive full overview"}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                  dashboardViewMode === "comprehensive"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
                <span>{ar ? "شامل" : "All"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardViewMode("operations")}
                title={ar ? "التركيز على العمليات اليومية وتجهيز الغرف" : "Operational daily focus"}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                  dashboardViewMode === "operations"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Activity className="w-3.5 h-3.5" />
                <span>{ar ? "تشغيلي" : "Ops"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardViewMode("analytics")}
                title={ar ? "التحليلات التفصيلية للمباني والأقسام" : "Capacity & Department analytics"}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                  dashboardViewMode === "analytics"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <BarChart3 className="w-3.5 h-3.5" />
                <span>{ar ? "تحليلي" : "Analytics"}</span>
              </button>
              <button
                type="button"
                onClick={() => setDashboardViewMode("compact")}
                title={ar ? "العرض المضغوط عالي الكثافة" : "Compact high-density view"}
                className={cn(
                  "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg transition-all",
                  dashboardViewMode === "compact"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{ar ? "مضغوط" : "Compact"}</span>
              </button>
            </div>

            {/* Real-time LIVE Indicator & Refresh Button */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-600 dark:text-emerald-400 text-xs font-bold shadow-xs">
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                <span>{ar ? "مباشر لحظي (LIVE)" : "LIVE"}</span>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRefresh}
                disabled={isRefreshing}
                className="h-8 gap-1.5 text-xs rounded-xl shadow-xs border-border/60 hover:bg-muted"
                title={ar ? "تحديث فوري لبيانات الداشبورد" : "Instant refresh"}
              >
                <RefreshCw className={cn("w-3.5 h-3.5", isRefreshing && "animate-spin text-primary")} />
                <span className="hidden sm:inline">{ar ? "تحديث" : "Refresh"}</span>
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* Mode Information & Quick Reset Banner (Shown when not in default Comprehensive mode) */}
      {!isAll && dashboardViewMode !== "comprehensive" && (
        <div className="flex items-center justify-between px-3.5 py-2 rounded-xl bg-primary/5 border border-primary/20 text-xs text-primary font-medium">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <span>
              {dashboardViewMode === "operations"
                ? ar
                  ? "وضع التركيز التشغيلي: إبراز حركات اليوم والوصول والمغادرة وتجهيز الغرف الفوري"
                  : "Operations Focus: Prioritizing daily movements, check-ins/outs & turnover health"
                : dashboardViewMode === "analytics"
                ? ar
                  ? "وضع التحليلات المتقدمة: استعراض شامل لمعدلات إشغال المباني وتوزيع الأقسام الكامل والديموغرافيا"
                  : "Advanced Analytics: Full building occupancy trajectory, complete department breakdown & demographics"
                : ar
                ? "الوضع المضغوط: تنظيم متجاور عالي الكثافة بدون تمرير رأسي طويل"
                : "Compact Executive: High-density side-by-side view for swift operational monitoring"}
            </span>
          </div>
          <button
            onClick={() => setDashboardViewMode("comprehensive")}
            className="text-muted-foreground hover:text-foreground underline text-[11px] shrink-0 font-medium"
          >
            {ar ? "العودة للوضع الشامل" : "Reset to Comprehensive"}
          </button>
        </div>
      )}

      {/* Error Alert */}
      {((isAll ? allStatsError : statsError) || pendingError) && (
        <div className="flex items-center gap-3 p-4 rounded-xl border border-destructive/30 bg-destructive/10 text-destructive text-sm">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p>
            {ar
              ? "حدث خطأ أثناء تحميل بعض بيانات لوحة القيادة. يرجى إعادة المحاولة."
              : "Failed to load some dashboard data. Please try again."}
          </p>
        </div>
      )}

      {/* Quick Assist Page Navigation Tabs */}
      <QuickAssistBar buildNavHref={buildNavHref} />

      {/* Modernized Executive KPI Cards with Sparklines & Deltas */}
      {isAll ? (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <DashboardKpiCard
            title={ar ? "إجمالي الموظفين" : "Total Profiles"}
            value={<AnimatedNumber value={totals?.totalProfiles ?? 0} />}
            sub={ar ? "عبر كل الفروع" : "Across all properties"}
            icon={Users}
            color="text-blue-600 dark:text-blue-400"
            bg="bg-blue-500/10"
            delta={{ value: "+5.4%", isPositive: true }}
            sparklineData={[120, 125, 122, 130, 134, 140, totals?.totalProfiles ?? 145]}
          />
          <DashboardKpiCard
            title={ar ? "إجمالي الغرف" : "Total Rooms"}
            value={<AnimatedNumber value={totals?.totalRooms ?? 0} />}
            sub={ar ? "غرفة في كل الفروع" : "Rooms across properties"}
            icon={Building2}
            color="text-primary"
            bg="bg-primary/10"
            delta={{ value: "+1.2%", isPositive: true }}
            sparklineData={[80, 80, 82, 82, 85, 85, totals?.totalRooms ?? 85]}
          />
          <DashboardKpiCard
            title={ar ? "التذاكر المفتوحة" : "Open Tickets"}
            value={<AnimatedNumber value={totals?.openMaintenance ?? 0} />}
            sub={ar ? "عبر كل الفروع" : "Across all properties"}
            icon={Wrench}
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-500/10"
            alert={(totals?.openMaintenance ?? 0) > 0}
            delta={
              (totals?.openMaintenance ?? 0) > 0
                ? { value: `+${totals?.openMaintenance}`, isPositive: false }
                : { value: "0", isPositive: true }
            }
            sparklineData={[8, 7, 6, 9, 7, 5, totals?.openMaintenance ?? 4]}
          />
          <DashboardKpiCard
            title={ar ? "المتوقع وصولهم" : "Arrivals"}
            value={<AnimatedNumber value={totals?.upcomingReservations ?? 0} />}
            sub={ar ? "عبر كل الفروع" : "Across all properties"}
            icon={CalendarCheck}
            color="text-purple-600 dark:text-purple-400"
            bg="bg-purple-500/10"
            delta={{ value: "+3.1%", isPositive: true }}
            sparklineData={[15, 18, 14, 20, 22, 21, totals?.upcomingReservations ?? 25]}
          />
        </div>
      ) : (
        <div className="grid gap-4 grid-cols-2 sm:grid-cols-2 lg:grid-cols-5">
          {/* Card 1: Total Profiles */}
          <DashboardKpiCard
            title={ar ? "إجمالي الموظفين" : "Total Profiles"}
            value={<AnimatedNumber value={totalProfilesCount} />}
            sub={`${stats?.activeProfiles ?? 0} ${ar ? "نشط" : "active"} · ${Math.max(
              0,
              totalProfilesCount - (stats?.activeAssignments ?? 0),
            )} ${ar ? "غير مسكن" : "unhoused"}`}
            icon={Users}
            href={buildNavHref("/profiles")}
            color="text-blue-600 dark:text-blue-400"
            bg="bg-blue-500/10"
            delta={{ value: "+3.4%", isPositive: true }}
            sparklineData={[105, 106, 107, 107, 108, 108, totalProfilesCount]}
          />

          {/* Card 2: Bed Occupancy Rate (Live Calculated) */}
          <DashboardKpiCard
            title={ar ? "إشغال الأسرة" : "Bed Occupancy"}
            value={
              <AnimatedNumber
                value={`${stats?.bedOccupancyRate ?? analytics?.bedCapacity?.utilizationPercent ?? stats?.occupancyRate ?? 0}%`}
              />
            }
            sub={`${stats?.occupiedBeds ?? analytics?.bedCapacity?.occupiedBeds ?? 0} / ${
              stats?.totalBeds ?? analytics?.bedCapacity?.totalBeds ?? 0
            } ${ar ? "سرير مأهول" : "beds occupied"}`}
            icon={BedDouble}
            href={buildNavHref("/accommodation/in-house")}
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-500/10"
            delta={{ value: "+2.1%", isPositive: true }}
            sparklineData={[70, 72, 75, 78, 80, 81, stats?.bedOccupancyRate ?? 82]}
          />

          {/* Card 3: Room Occupancy Rate (Live Calculated) */}
          <DashboardKpiCard
            title={ar ? "إشغال الغرف" : "Room Occupancy"}
            value={
              <AnimatedNumber
                value={`${stats?.roomOccupancyRate ?? analytics?.roomStatusBreakdown?.occupancyRate ?? stats?.occupancyRate ?? 0}%`}
              />
            }
            sub={`${stats?.occupiedRooms ?? analytics?.roomStatusBreakdown?.occupied ?? 0} / ${
              stats?.totalRooms ?? analytics?.roomStatusBreakdown?.totalRooms ?? 0
            } ${ar ? "غرفة مأهولة" : "rooms occupied"}`}
            icon={Building2}
            href={buildNavHref("/housing")}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-500/10"
            delta={{ value: "+1.8%", isPositive: true }}
            sparklineData={[50, 52, 55, 58, 62, 60, stats?.roomOccupancyRate ?? 65]}
          />

          {/* Card 4: Expected Arrivals */}
          <DashboardKpiCard
            title={ar ? "المتوقع وصولهم" : "Arrivals"}
            value={<AnimatedNumber value={stats?.upcomingReservations ?? 0} />}
            sub={ar ? "وصول مؤكد قيد الانتظار" : "Confirmed pending arrivals"}
            icon={CalendarCheck}
            href={buildNavHref("/accommodation/reservations")}
            color="text-purple-600 dark:text-purple-400"
            bg="bg-purple-500/10"
            delta={{ value: "0.0%", isNeutral: true }}
            sparklineData={[4, 6, 5, 8, 7, 9, stats?.upcomingReservations ?? 8]}
          />

          {/* Card 5: Maintenance & Tickets */}
          <DashboardKpiCard
            title={ar ? "تذاكر الصيانة" : "Active Tickets"}
            value={<AnimatedNumber value={stats?.openMaintenance ?? 0} />}
            sub={`${stats?.overdueMaintenance ?? 0} ${ar ? "قيد المتابعة" : "in progress"}`}
            icon={Wrench}
            href={buildNavHref("/maintenance")}
            color="text-amber-600 dark:text-amber-400"
            bg="bg-amber-500/10"
            alert={(stats?.openMaintenance ?? 0) > 0}
            delta={
              (stats?.openMaintenance ?? 0) > 0
                ? { value: `+${stats?.openMaintenance}`, isPositive: false }
                : { value: "0", isPositive: true }
            }
            sparklineData={[8, 6, 5, 7, 4, 3, stats?.openMaintenance ?? 2]}
          />
        </div>
      )}

      {/* Live Room Readiness & Turnover Tracker Bar */}
      {!isAll && (
        <ReadinessTrackerBar
          totalRooms={analytics?.roomStatusBreakdown?.total ?? stats?.totalRooms ?? 0}
          available={analytics?.roomStatusBreakdown?.available ?? stats?.availableRooms ?? 0}
          occupied={analytics?.roomStatusBreakdown?.occupied ?? stats?.occupiedRooms ?? 0}
          dirty={analytics?.roomStatusBreakdown?.dirty ?? 0}
          maintenance={analytics?.roomStatusBreakdown?.maintenance ?? stats?.openMaintenance ?? 0}
          cleanRate={analytics?.turnoverHealth?.cleanRate}
        />
      )}

      {/* Live Housing Capacity Ribbon (Matching exact design under Readiness Tracker) */}
      {!isAll && (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3.5">
          {/* 1. Buildings */}
          <div className="bg-card/90 backdrop-blur-xs border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {ar ? "المباني" : "BUILDINGS"}
              </span>
              <span className="text-xl font-black text-foreground font-mono leading-tight">
                {ribbonSummary.totalBuildings}
              </span>
            </div>
          </div>

          {/* 2. Floors */}
          <div className="bg-card/90 backdrop-blur-xs border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center shrink-0">
              <Layers className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {ar ? "الأدوار" : "FLOORS"}
              </span>
              <span className="text-xl font-black text-foreground font-mono leading-tight">
                {ribbonSummary.totalFloors}
              </span>
            </div>
          </div>

          {/* 3. Total Rooms */}
          <div className="bg-card/90 backdrop-blur-xs border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center shrink-0">
              <Home className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {ar ? "إجمالي الغرف" : "TOTAL ROOMS"}
              </span>
              <div className="flex items-baseline gap-1.5 leading-tight">
                <span className="text-xl font-black text-foreground font-mono">
                  {ribbonSummary.totalRooms}
                </span>
                <span className="text-xs font-semibold text-muted-foreground font-mono">
                  ({ribbonSummary.occupiedRooms} {ar ? "مشغولة" : "occ"})
                </span>
              </div>
            </div>
          </div>

          {/* 4. Bed Capacity */}
          <div className="bg-card/90 backdrop-blur-xs border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0">
              <BedDouble className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {ar ? "سعة الأسرة" : "BED CAPACITY"}
              </span>
              <span className="text-xl font-black text-foreground font-mono leading-tight">
                {ribbonSummary.totalBeds}
              </span>
            </div>
          </div>

          {/* 5. Occupied Beds */}
          <div className="bg-card/90 backdrop-blur-xs border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {ar ? "الأسرة المشغولة" : "OCCUPIED BEDS"}
              </span>
              <div className="flex items-baseline gap-1.5 leading-tight">
                <span className="text-xl font-black text-emerald-600 dark:text-emerald-400 font-mono">
                  {ribbonSummary.occupiedBeds}
                </span>
                <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 font-mono">
                  ({ribbonSummary.bedOccupancyRate}%)
                </span>
              </div>
            </div>
          </div>

          {/* 6. Vacant Beds */}
          <div className="bg-card/90 backdrop-blur-xs border border-border/70 rounded-2xl p-3.5 flex items-center gap-3 shadow-xs hover:border-primary/40 hover:shadow-sm transition-all duration-200">
            <div className="w-10 h-10 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400 flex items-center justify-center shrink-0">
              <DoorOpen className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground block">
                {ar ? "الأسرة الشاغرة" : "VACANT BEDS"}
              </span>
              <span className="text-xl font-black text-teal-600 dark:text-teal-400 font-mono leading-tight">
                {ribbonSummary.availableBeds ?? (ribbonSummary.totalBeds - ribbonSummary.occupiedBeds)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Per-Property Table (only in 'all' mode) */}
      {isAll && perProperty.length > 0 && (
        <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-bold">
              {ar ? "تفاصيل كل فرع" : "Per-Property Breakdown"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar
                ? "اضغط على أي فرع للانتقال المباشر للوحة القيادة الخاصة به"
                : "Click any property to jump directly to its individual dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-start py-2.5 px-3 font-semibold">
                      {ar ? "الفرع" : "Property"}
                    </th>
                    <th className="text-center py-2.5 px-3 font-semibold">
                      {ar ? "الموظفون" : "Profiles"}
                    </th>
                    <th className="text-center py-2.5 px-3 font-semibold">
                      {ar ? "الغرف" : "Rooms"}
                    </th>
                    <th className="text-center py-2.5 px-3 font-semibold">
                      {ar ? "الإشغال" : "Occupancy"}
                    </th>
                    <th className="text-center py-2.5 px-3 font-semibold">
                      {ar ? "التذاكر" : "Tickets"}
                    </th>
                    <th className="text-center py-2.5 px-3 font-semibold">
                      {ar ? "الوصول" : "Arrivals"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {perProperty.map((p: any) => {
                    const slug = getPropertySlug(p);
                    return (
                      <tr
                        key={p.id}
                        onClick={() => {
                          setActivePropertyId(p.id);
                          setLocation(`/${slug}/dashboard`);
                        }}
                        className="border-b border-border/40 hover:bg-muted/60 cursor-pointer transition-all duration-200"
                      >
                        <td className="py-3 px-3 font-semibold text-foreground flex items-center gap-2">
                          <Building2 className="w-4 h-4 text-primary" />
                          <span>{p.name}</span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono">{p.totalProfiles}</td>
                        <td className="py-3 px-3 text-center font-mono">{p.totalRooms}</td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={cn(
                              "font-semibold font-mono px-2 py-0.5 rounded-full text-xs",
                              p.occupancyRate > 85
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {p.occupancyRate}%
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center">
                          <span
                            className={cn(
                              "font-mono",
                              p.openMaintenance > 0 ? "text-orange-600 font-bold" : "text-muted-foreground",
                            )}
                          >
                            {p.openMaintenance}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-center font-mono text-muted-foreground">
                          {p.upcomingReservations}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Reusable Content Blocks for Multi-View Modes */}
      {(() => {
        if (isAll) return null;

        const donutNode = (
          <DashboardAnalyticsDonut
            roomStatusBreakdown={analytics?.roomStatusBreakdown}
            bedCapacity={analytics?.bedCapacity}
            isLoading={analyticsLoading}
          />
        );

        const deptNode = (
          <DepartmentBarList
            departments={analytics?.departmentBreakdown}
            totalProfiles={totalProfilesCount}
            isLoading={analyticsLoading}
          />
        );

        const genderNode = (
          <GenderDemographicsCard
            genderDistribution={analytics?.genderDistribution}
            totalResidents={stats?.activeAssignments || (stats?.totalRooms ? stats.occupiedRooms : 0)}
            isLoading={analyticsLoading}
          />
        );

        const chartsNode = (
          <Tabs value={chartTab} onValueChange={(v) => setChartTab(v as any)} className="space-y-4">
            <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
              <CardHeader className="flex flex-col sm:flex-row sm:items-center justify-between pb-3 gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <Activity className="w-4 h-4 text-primary" />
                    {chartTab === "buildings"
                      ? ar
                        ? "الإشغال حسب المباني والمنشآت"
                        : "Building Occupancy Distribution"
                      : ar
                      ? "المسار الزمني لمعدل الإشغال"
                      : "Occupancy Trajectory Trend"}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {chartTab === "buildings"
                      ? ar
                        ? "نسبة استيعاب وإشغال كل مبنى سكني"
                        : "Capacity utilization per residential building"
                      : ar
                      ? "المسار الزمني لمعدل حركة الإشغال اللحظي"
                      : "Real-time occupancy progression trajectory"}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <TabsList className="bg-muted/70 p-1 border border-border/40">
                    <TabsTrigger value="buildings" className="text-xs font-semibold gap-1.5">
                      <Building2 className="w-3.5 h-3.5" />
                      {ar ? "حسب المبنى" : "By Building"}
                    </TabsTrigger>
                    <TabsTrigger value="trends" className="text-xs font-semibold gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5" />
                      {ar ? "المسار الزمني" : "Trend Flow"}
                    </TabsTrigger>
                  </TabsList>

                  <PermissionGate module="housing" action="view">
                    <Link href={buildNavHref("/housing")}>
                      <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent gap-1 py-1">
                        {ar ? "عرض المباني" : "View All"} <ArrowRight className="w-3 h-3" />
                      </Badge>
                    </Link>
                  </PermissionGate>
                </div>
              </CardHeader>

              <CardContent className="h-[290px] pt-2">
                <TabsContent value="buildings" className="h-full mt-0">
                  {occupancy && occupancy.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={occupancy} margin={{ top: 10, right: 20, left: -10, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="buildingName"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                        />
                        <Tooltip
                          cursor={{ fill: "hsl(var(--muted)/0.5)" }}
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-card/95 backdrop-blur-md border border-border shadow-lg rounded-xl p-3 text-xs">
                                  <p className="font-bold text-foreground text-sm">{d.buildingName}</p>
                                  <div className="mt-1.5 space-y-1 text-muted-foreground">
                                    <div>
                                      {ar ? "نسبة الإشغال:" : "Occupancy:"}{" "}
                                      <strong className="text-primary font-mono">{d.occupancyRate}%</strong>
                                    </div>
                                    <div>
                                      {ar ? "الغرف المشغولة:" : "Occupied Rooms:"}{" "}
                                      <strong className="text-foreground">{d.occupiedRooms}</strong> / {d.totalRooms}
                                    </div>
                                    <div>
                                      {ar ? "استيعاب الأسرة:" : "Beds Used:"}{" "}
                                      <strong className="text-foreground">{d.totalOccupancy}</strong> / {d.totalCapacity}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Bar
                          dataKey="occupancyRate"
                          name={ar ? "نسبة الإشغال %" : "Occupancy %"}
                          fill="hsl(var(--primary))"
                          radius={[6, 6, 0, 0]}
                        />
                      </BarChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                      <Building2 className="w-10 h-10 opacity-20" />
                      <p>{ar ? "لا توجد بيانات مبانٍ مسجلة" : "No building records found"}</p>
                    </div>
                  )}
                </TabsContent>

                <TabsContent value="trends" className="h-full mt-0">
                  {analytics?.trendPoints && analytics.trendPoints.length > 0 ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart
                        data={analytics.trendPoints}
                        margin={{ top: 10, right: 20, left: -10, bottom: 0 }}
                      >
                        <defs>
                          <linearGradient id="occupancyGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor="#6366f1" stopOpacity={0.4} />
                            <stop offset="95%" stopColor="#6366f1" stopOpacity={0.0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                        <XAxis
                          dataKey="day"
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                        />
                        <YAxis
                          stroke="hsl(var(--muted-foreground))"
                          fontSize={12}
                          tickLine={false}
                          axisLine={false}
                          tickFormatter={(v) => `${v}%`}
                          domain={[0, 100]}
                        />
                        <Tooltip
                          content={({ active, payload }) => {
                            if (active && payload && payload.length) {
                              const d = payload[0].payload;
                              return (
                                <div className="bg-card/95 backdrop-blur-md border border-border shadow-lg rounded-xl p-3 text-xs">
                                  <p className="font-bold text-foreground text-sm">{d.date} ({d.day})</p>
                                  <div className="mt-1.5 space-y-1 text-muted-foreground">
                                    <div>
                                      {ar ? "معدل الإشغال:" : "Occupancy Rate:"}{" "}
                                      <strong className="text-indigo-500 font-mono text-sm">{d.occupancy}%</strong>
                                    </div>
                                    <div>
                                      {ar ? "الأسرة المشغولة:" : "Occupied Beds:"}{" "}
                                      <strong className="text-foreground">{d.occupiedBeds}</strong> / {d.capacity}
                                    </div>
                                  </div>
                                </div>
                              );
                            }
                            return null;
                          }}
                        />
                        <Area
                          type="monotone"
                          dataKey="occupancy"
                          stroke="#6366f1"
                          strokeWidth={2.5}
                          fillOpacity={1}
                          fill="url(#occupancyGradient)"
                        />
                      </AreaChart>
                    </ResponsiveContainer>
                  ) : (
                    <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                      <Activity className="w-10 h-10 opacity-20" />
                      <p>{ar ? "جاري احتساب مؤشرات المسار الزمني..." : "Calculating trajectory trends..."}</p>
                    </div>
                  )}
                </TabsContent>
              </CardContent>
            </Card>
          </Tabs>
        );

        const matrixNode = occupancy && occupancy.length > 0 ? (
          <BuildingCapacityMatrix
            buildings={occupancy}
            buildNavHref={buildNavHref}
          />
        ) : null;

        const operationsHubNode = (
          <DailyOperationsHub
            checkIns={pendingData?.checkIns}
            checkOuts={pendingData?.checkOuts}
            maintenanceRequests={pendingData?.maintenanceRequests}
            expiringContracts={pendingData?.expiringContracts}
            buildNavHref={buildNavHref}
          />
        );

        const housekeepingNode = (
          <HousekeepingPriorityQueue
            dirtyRooms={pendingData?.dirtyRooms}
            cleanRate={analytics?.turnoverHealth?.cleanRate}
            pendingClean={analytics?.turnoverHealth?.pendingClean}
            readyCount={analytics?.roomStatusBreakdown?.available ?? stats?.availableRooms ?? 0}
            buildNavHref={buildNavHref}
          />
        );

        return (
          <>
            {/* Mode 1: Comprehensive Full Overview */}
            {dashboardViewMode === "comprehensive" && (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {donutNode}
                  {deptNode}
                  {genderNode}
                </div>
                {chartsNode}
                {matrixNode}
                {operationsHubNode}
                {housekeepingNode}
              </div>
            )}

            {/* Mode 2: Operations Focus Mode */}
            {dashboardViewMode === "operations" && (
              <div className="space-y-6">
                {operationsHubNode}
                <div className="grid gap-5 md:grid-cols-2">
                  {housekeepingNode}
                  {donutNode}
                </div>
                {deptNode}
              </div>
            )}

            {/* Mode 3: Analytics & Capacity Mode */}
            {dashboardViewMode === "analytics" && (
              <div className="space-y-6">
                {chartsNode}
                {matrixNode}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {deptNode}
                  {donutNode}
                  {genderNode}
                </div>
              </div>
            )}

            {/* Mode 4: Compact High-Density View */}
            {dashboardViewMode === "compact" && (
              <div className="space-y-5">
                <div className="grid gap-5 lg:grid-cols-2">
                  {chartsNode}
                  {deptNode}
                </div>
                <div className="grid gap-5 lg:grid-cols-2">
                  {operationsHubNode}
                  {housekeepingNode}
                </div>
                {donutNode}
              </div>
            )}
          </>
        );
      })()}
    </div>
  );
}
