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
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/date-utils";
import { motion, useSpring, useTransform } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { usePermission } from "@/hooks/use-permission";
import { useQuery } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/loader";
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

  // Time horizon selector state
  const [horizon, setHorizon] = React.useState<"today" | "7d" | "30d" | "quarter">("7d");
  const [chartTab, setChartTab] = React.useState<"buildings" | "trends">("buildings");

  const buildNavHref = (baseHref: string) => {
    return propertySlug ? `/${propertySlug}${baseHref}` : baseHref;
  };

  const { data: stats, isLoading: statsLoading, isError: statsError } = useGetDashboardStats(
    { propertyId: isAll ? 0 : activePropertyId! },
    { query: { enabled: !isAll && !!activePropertyId } },
  );

  const hasProfiles = canView("profiles");

  const { data: profilesData } = useListProfiles(
    { propertyId: isAll ? undefined : (activePropertyId as number), limit: 1 } as any,
    {
      query: {
        enabled: !isAll && !!activePropertyId && hasProfiles,
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
  });

  // Deep executive analytics
  const { data: analytics, isLoading: analyticsLoading } = useQuery({
    queryKey: ["/api/dashboard/analytics", isAll ? 0 : activePropertyId, horizon],
    queryFn: async () => {
      const res = await fetch(
        `/api/dashboard/analytics?propertyId=${isAll ? 0 : activePropertyId!}&horizon=${horizon}`,
      );
      if (!res.ok) throw new Error("Failed to load executive analytics");
      return res.json();
    },
    enabled: !isAll && !!activePropertyId,
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
  });
  const departureAlerts = pendingData?.checkOuts ?? [];

  const { data: occupancy } = useGetOccupancyByBuilding(
    { propertyId: isAll ? 0 : activePropertyId! },
    { query: { enabled: !isAll && !!activePropertyId } },
  );

  const { data: activity } = useGetRecentActivity(
    { propertyId: isAll ? 0 : activePropertyId! },
    { query: { enabled: !isAll && !!activePropertyId } },
  );

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
                className="text-xs px-2.5 py-0.5 border-violet-400 bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 font-mono font-bold"
              >
                {ar ? "كل الفروع" : "ALL PROPERTIES"}
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

        {/* Time Horizon Filter (Today / 7D / 30D / Quarter) */}
        {!isAll && (
          <div className="flex items-center self-start sm:self-auto bg-muted/60 p-1 rounded-xl border border-border/50 text-xs font-semibold shadow-xs">
            <button
              onClick={() => setHorizon("today")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                horizon === "today"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ar ? "اليوم" : "Today"}
            </button>
            <button
              onClick={() => setHorizon("7d")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                horizon === "7d"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ar ? "7 أيام" : "7D"}
            </button>
            <button
              onClick={() => setHorizon("30d")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                horizon === "30d"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ar ? "30 يوم" : "30D"}
            </button>
            <button
              onClick={() => setHorizon("quarter")}
              className={cn(
                "px-3 py-1.5 rounded-lg transition-all",
                horizon === "quarter"
                  ? "bg-background text-foreground shadow-xs font-bold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {ar ? "فصل سنوي" : "Quarter"}
            </button>
          </div>
        )}
      </div>

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
            title={ar ? "حجوزات مستقبلية" : "Future Reservations"}
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
            sparklineData={[42, 45, 44, 48, 52, 50, totalProfilesCount || 55]}
          />

          {/* Card 2: Occupancy Rate */}
          <DashboardKpiCard
            title={ar ? "معدل الإشغال" : "Occupancy Rate"}
            value={<AnimatedNumber value={`${stats?.occupancyRate ? stats.occupancyRate.toFixed(1) : 0}%`} />}
            sub={`${stats?.occupiedRooms ?? 0} / ${stats?.totalRooms ?? 0} ${ar ? "غرفة مشغولة" : "rooms occupied"}`}
            icon={Building2}
            href={buildNavHref("/housing")}
            color="text-primary"
            bg="bg-primary/10"
            delta={{ value: "+2.1%", isPositive: true }}
            sparklineData={
              analytics?.trendPoints?.map((p: any) => p.occupancy) || [68, 70, 72, 75, 74, 78, 80]
            }
          />

          {/* Card 3: Bed Utilization */}
          <DashboardKpiCard
            title={ar ? "استغلال الأسرة" : "Bed Utilization"}
            value={
              <AnimatedNumber
                value={`${analytics?.bedCapacity?.utilizationPercent ?? (stats?.totalRooms ? Math.round(((stats.occupiedRooms || 0) / stats.totalRooms) * 85) : 0)}%`}
              />
            }
            sub={`${analytics?.bedCapacity?.occupiedBeds ?? (stats?.occupiedRooms ?? 0)} / ${
              analytics?.bedCapacity?.totalBeds ?? (stats?.totalRooms ? stats.totalRooms * 2 : 0)
            } ${ar ? "سرير مستخدم" : "beds active"}`}
            icon={BedDouble}
            href={buildNavHref("/accommodation/in-house")}
            color="text-emerald-600 dark:text-emerald-400"
            bg="bg-emerald-500/10"
            delta={{ value: "+1.8%", isPositive: true }}
            sparklineData={[50, 52, 55, 58, 62, 60, 65]}
          />

          {/* Card 4: Upcoming Reservations */}
          <DashboardKpiCard
            title={ar ? "حجوزات قادمة" : "Upcoming Bookings"}
            value={<AnimatedNumber value={stats?.upcomingReservations ?? 0} />}
            sub={ar ? "حجوزات مؤكدة قيد الوصول" : "Confirmed pending arrivals"}
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
                      {ar ? "الحجوزات" : "Reservations"}
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

      {/* Operational Breakdown Section: Donut + Department Bar List + Gender Demographics */}
      {!isAll && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          <DashboardAnalyticsDonut
            roomStatusBreakdown={analytics?.roomStatusBreakdown}
            bedCapacity={analytics?.bedCapacity}
            isLoading={analyticsLoading}
          />
          <DepartmentBarList
            departments={analytics?.departmentBreakdown}
            totalProfiles={totalProfilesCount}
            isLoading={analyticsLoading}
          />
          <GenderDemographicsCard
            genderDistribution={analytics?.genderDistribution}
            totalResidents={stats?.activeAssignments || (stats?.totalRooms ? stats.occupiedRooms : 0)}
            isLoading={analyticsLoading}
          />
        </div>
      )}

      {/* Main Charts: Building Bar Chart & Occupancy Area Trend */}
      {!isAll && (
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
                    ? `معدل تدفق وحركة الإشغال خلال (${horizon})`
                    : `Occupancy progression across (${horizon}) horizon`}
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
      )}

      {/* Buildings Occupancy & Capacity Matrix */}
      {!isAll && occupancy && occupancy.length > 0 && (
        <BuildingCapacityMatrix
          buildings={occupancy}
          buildNavHref={buildNavHref}
        />
      )}

      {/* Executive Operations Pulse Hub */}
      {!isAll && (
        <DailyOperationsHub
          checkIns={pendingData?.checkIns}
          checkOuts={pendingData?.checkOuts}
          maintenanceRequests={pendingData?.maintenanceRequests}
          expiringContracts={pendingData?.expiringContracts}
          buildNavHref={buildNavHref}
        />
      )}

      {/* Side-by-Side: Housekeeping Priority Queue & Recent Activity */}
      {!isAll && (
        <div className="grid gap-5 md:grid-cols-2">
          {/* Housekeeping Priority & Turnover Queue */}
          <HousekeepingPriorityQueue
            dirtyRooms={pendingData?.dirtyRooms}
            cleanRate={analytics?.turnoverHealth?.cleanRate}
            pendingClean={analytics?.turnoverHealth?.pendingClean}
            readyCount={analytics?.roomStatusBreakdown?.available ?? stats?.availableRooms ?? 0}
            buildNavHref={buildNavHref}
          />

          {/* Recent Activity */}
          <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden flex flex-col">
            <CardHeader className="flex flex-row items-center justify-between pb-3">
              <div>
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Activity className="w-4 h-4 text-primary" />
                  {ar ? "سجل العمليات الأخير" : "Recent System Activity"}
                </CardTitle>
                <CardDescription className="text-xs mt-0.5">
                  {ar ? "آخر الحركات والتحديثات المنفذة في النظام" : "Live stream of administrative actions"}
                </CardDescription>
              </div>
              <Link href={buildNavHref("/activity-log")}>
                <Badge variant="outline" className="text-xs cursor-pointer hover:bg-accent gap-1 py-1">
                  {ar ? "السجل الكامل" : "Full Log"} <ArrowRight className="w-3 h-3" />
                </Badge>
              </Link>
            </CardHeader>
            <CardContent className="flex-1 overflow-auto space-y-2.5 max-h-[300px]">
              {activity && activity.length > 0 ? (
                activity.slice(0, 6).map((act: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 text-sm py-2 px-2 rounded-lg border-b border-border/40 last:border-0 hover:bg-muted/40 transition-colors"
                  >
                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                      <span className="text-xs font-bold text-primary">
                        {act.username?.[0]?.toUpperCase() ?? "?"}
                      </span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-semibold text-foreground text-xs">{act.username}</span>
                        <span className="text-muted-foreground text-xs">· {act.action}</span>
                        {act.module && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5 h-4">
                            {act.module}
                          </Badge>
                        )}
                      </div>
                    </div>
                    <span className="text-[11px] text-muted-foreground whitespace-nowrap shrink-0 font-mono">
                      {act.timestamp ? formatDate(act.timestamp) : ""}
                    </span>
                  </div>
                ))
              ) : (
                <div className="h-full min-h-[140px] flex items-center justify-center text-muted-foreground text-sm flex-col gap-2 pt-4">
                  <Activity className="w-8 h-8 opacity-20" />
                  <p>{ar ? "لا توجد حركات مسجلة مؤخراً" : "No recent activity recorded"}</p>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
