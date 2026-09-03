// @ts-nocheck
import * as React from "react";
import {
  useGetDashboardStats,
  useGetOccupancyByBuilding,
  useGetRecentActivity,
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
  CalendarCheck,
  UserCheck,
  LayoutGrid,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { motion, useSpring, useTransform } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { useQuery } from "@tanstack/react-query";
import { PageLoader } from "@/components/ui/loader";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useProperty } from "@/context/PropertyContext";
import { Link, useLocation } from "wouter";
import { Badge } from "@/components/ui/badge";

function AnimatedNumber({ value }: { value: string | number }) {
  const reducedMotion = usePrefersReducedMotion();

  // Extract number and suffix (like %)
  const numMatch = String(value).match(/^([\d.]+)(.*)$/);
  const targetNum = numMatch ? parseFloat(numMatch[1]) : 0;
  const suffix = numMatch ? numMatch[2] : "";

  const spring = useSpring(0, { duration: 800, bounce: 0 });
  const display = useTransform(spring, (current) => {
    // preserve decimals if target has decimals
    const hasDecimals = targetNum % 1 !== 0;
    return (hasDecimals ? current.toFixed(1) : Math.round(current)) + suffix;
  });

  React.useEffect(() => {
    if (reducedMotion) {
      spring.set(targetNum);
    } else {
      spring.set(targetNum);
    }
  }, [targetNum, spring, reducedMotion]);

  if (reducedMotion) return <>{value}</>;
  return <motion.span>{display}</motion.span>;
}

export default function Dashboard() {
  const { language } = useLanguage();
  const {
    activePropertyId,
    activeProperty,
    properties,
    isSuperAdmin,
    setActivePropertyId,
  } = useProperty();
  const [, setLocation] = useLocation();
  const ar = language === "ar";
  const isAll = activePropertyId === "all";

  const { data: stats, isLoading: statsLoading } = useGetDashboardStats(
    { propertyId: isAll ? 0 : activePropertyId! },
    { query: { enabled: !isAll && !!activePropertyId } },
  );

  const { data: allStats, isLoading: allLoading } = useQuery({
    queryKey: ["/api/dashboard/all-stats"],
    queryFn: async () => {
      const r = await fetch("/api/dashboard/all-stats");
      if (!r.ok) throw new Error("Failed to load aggregated stats");
      return r.json();
    },
    enabled: isAll,
  });

  const { data: pendingData, isLoading: depLoading } = useQuery({
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

  const statCards = isAll
    ? [
        {
          title: ar ? "إجمالي الموظفين" : "Total Profiles",
          value: totals?.totalProfiles ?? 0,
          sub: ar ? "عبر كل الفروع" : "Across all properties",
          icon: Users,
          color: "text-blue-600",
          bg: "bg-blue-50 dark:bg-blue-950/30",
        },
        {
          title: ar ? "إجمالي الغرف" : "Total Rooms",
          value: totals?.totalRooms ?? 0,
          sub: ar ? "غرفة في كل الفروع" : "Rooms across all properties",
          icon: Building2,
          color: "text-primary",
          bg: "bg-primary/8 dark:bg-primary/15",
        },
        {
          title: ar ? "التذاكر المفتوحة" : "Open Tickets",
          value: totals?.openMaintenance ?? 0,
          sub: ar ? "عبر كل الفروع" : "Across all properties",
          icon: Wrench,
          color: "text-orange-600",
          bg: "bg-orange-50 dark:bg-orange-950/30",
          alert: (totals?.openMaintenance ?? 0) > 0,
        },
        {
          title: ar ? "حجوزات الوصول" : "Arrival Reservations",
          value: totals?.upcomingReservations ?? 0,
          sub: ar ? "عبر كل الفروع" : "Across all properties",
          icon: CalendarCheck,
          color: "text-purple-600",
          bg: "bg-purple-50 dark:bg-purple-950/30",
        },
      ]
    : [
        {
          title: ar ? "إجمالي الفروع" : "Total Properties",
          value: properties.length,
          sub: ar ? "فروع نشطة في النظام" : "Active branches",
          icon: LayoutGrid,
          href: "/properties",
          color: "text-violet-600",
          bg: "bg-violet-50 dark:bg-violet-950/30",
        },
        {
          title: ar ? "إجمالي الموظفين" : "Total Profiles",
          value: stats?.totalProfiles ?? 0,
          sub: `${stats?.activeProfiles ?? 0} ${ar ? "نشط" : "active"}, ${stats?.unhousedProfiles ?? 0} ${ar ? "غير مسكن" : "unhoused"}`,
          icon: Users,
          href: "/profiles",
          color: "text-blue-600",
          bg: "bg-blue-50 dark:bg-blue-950/30",
        },
        {
          title: ar ? "معدل الإشغال" : "Occupancy Rate",
          value: `${stats?.occupancyRate ? stats.occupancyRate.toFixed(1) : 0}%`,
          sub: `${stats?.occupiedRooms ?? 0} / ${stats?.totalRooms ?? 0} ${ar ? "غرفة مشغولة" : "rooms occupied"}`,
          icon: Building2,
          href: "/housing",
          color: "text-primary",
          bg: "bg-primary/8 dark:bg-primary/15",
        },
        {
          title: ar ? "حجوزات الوصول" : "Arrival Reservations",
          value: stats?.upcomingReservations ?? 0,
          sub: ar ? "حجوزات وصول قيد الانتظار" : "Pending arrival check-ins",
          icon: CalendarCheck,
          href: "/accommodation/reservations",
          color: "text-purple-600",
          bg: "bg-purple-50 dark:bg-purple-950/30",
        },
        {
          title: ar ? "التذاكر" : "Tickets",
          value: stats?.openMaintenance ?? 0,
          sub: `${stats?.overdueMaintenance ?? 0} ${ar ? "متأخر" : "overdue"}`,
          icon: Wrench,
          href: "/maintenance",
          color: "text-orange-600",
          bg: "bg-orange-50 dark:bg-orange-950/30",
          alert: (stats?.openMaintenance ?? 0) > 0,
        },
      ];

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">
            {ar ? "لوحة القيادة" : "Dashboard"}
          </h1>
          <p className="text-muted-foreground mt-1 text-sm">
            {isAll
              ? ar
                ? "نظرة عامة إجمالية على كل الفروع"
                : "Aggregated overview of all properties"
              : activeProperty
                ? ar
                  ? `عرض بيانات: ${activeProperty.displayName || activeProperty.name}`
                  : `Viewing: ${activeProperty.displayName || activeProperty.name}`
                : ar
                  ? "نظرة عامة على عمليات الإسكان"
                  : "Overview of housing operations"}
          </p>
        </div>
        {isAll && (
          <Badge
            variant="outline"
            className="text-xs px-3 py-1 border-violet-400 text-violet-600 font-mono"
          >
            {ar ? "كل الفروع" : "ALL"}
          </Badge>
        )}
        {!isAll && isSuperAdmin && activeProperty && (
          <Badge
            variant="outline"
            className="text-xs px-3 py-1 border-primary/40 text-primary font-mono"
          >
            {activeProperty.code}
          </Badge>
        )}
      </div>

      {/* Stat Cards */}
      <div
        className={`grid gap-4 md:grid-cols-2 ${isAll ? "lg:grid-cols-4" : "lg:grid-cols-5"}`}
      >
        {statCards.map((card, i) => (
          <div key={i} className="block h-full group">
            <Card className="h-full flex flex-col bg-card/60 backdrop-blur-2xl border-border/50 shadow-lg hover:shadow-2xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/40 transition-all duration-500 relative overflow-hidden">
              <div className={`absolute top-0 right-0 w-32 h-32 rounded-full blur-3xl opacity-[0.15] pointer-events-none transition-opacity duration-500 group-hover:opacity-30 ${card.bg}`} />
              <CardHeader className="flex flex-row items-center justify-between pb-2 relative z-10">
                <CardTitle className="text-sm font-medium">
                  {card.title}
                </CardTitle>
                <div className={`p-2 rounded-lg ${card.bg}`}>
                  <card.icon className={`h-4 w-4 ${card.color}`} />
                </div>
              </CardHeader>
              <CardContent className="flex-1 flex flex-col justify-end relative z-10">
                <div className="flex items-end justify-between">
                  <div>
                    <div
                      className={`text-2xl font-bold ${card.alert ? "text-orange-600" : ""}`}
                    >
                      {card.value}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">
                      {card.sub}
                    </p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>

      {/* Per-Property Table (only in 'all' mode) */}
      {isAll && perProperty.length > 0 && (
        <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base">
              {ar ? "تفاصيل كل فرع" : "Per-Property Details"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar
                ? "اضغط على أي فرع لعرض تفاصيله"
                : "Click a property to view its dashboard"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
                    <th className="text-left py-2 px-2 font-semibold">
                      {ar ? "الفرع" : "Property"}
                    </th>
                    <th className="text-center py-2 px-2 font-semibold">
                      {ar ? "الموظفون" : "Profiles"}
                    </th>
                    <th className="text-center py-2 px-2 font-semibold">
                      {ar ? "الغرف" : "Rooms"}
                    </th>
                    <th className="text-center py-2 px-2 font-semibold">
                      {ar ? "الإشغال" : "Occupancy"}
                    </th>
                    <th className="text-center py-2 px-2 font-semibold">
                      {ar ? "التذاكر" : "Tickets"}
                    </th>
                    <th className="text-center py-2 px-2 font-semibold">
                      {ar ? "الحجوزات" : "Reservations"}
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {perProperty.map((p: any) => (
                    <tr
                      key={p.id}
                      onClick={() => {
                        setActivePropertyId(p.id);
                        setLocation("/dashboard");
                      }}
                      className="border-b border-border/40 hover:bg-muted/60 cursor-pointer transition-all duration-200 hover:shadow-sm"
                    >
                      <td className="py-2.5 px-2 font-medium">{p.name}</td>
                      <td className="py-2.5 px-2 text-center">
                        {p.totalProfiles}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {p.totalRooms}
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={`font-semibold ${p.occupancyRate > 85 ? "text-orange-600" : "text-green-600"}`}
                        >
                          {p.occupancyRate}%
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        <span
                          className={
                            p.openMaintenance > 0
                              ? "text-orange-600 font-semibold"
                              : ""
                          }
                        >
                          {p.openMaintenance}
                        </span>
                      </td>
                      <td className="py-2.5 px-2 text-center">
                        {p.upcomingReservations}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Charts + Alerts — only when a specific property is selected */}
      {!isAll && (
        <>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-7">
            <Card className="col-span-4 bg-card/70 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle>
                    {ar ? "الإشغال حسب المبنى" : "Occupancy by Building"}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {ar
                      ? "نسبة الإشغال لكل مبنى"
                      : "Occupancy rate per building"}
                  </CardDescription>
                </div>
                <Link href="/housing">
                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-accent gap-1"
                  >
                    {ar ? "عرض الكل" : "View all"}{" "}
                    <ArrowRight className="w-3 h-3" />
                  </Badge>
                </Link>
              </CardHeader>
              <CardContent className="pl-0 h-[280px]">
                {occupancy && occupancy.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      data={occupancy}
                      margin={{ top: 10, right: 30, left: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        vertical={false}
                        stroke="hsl(var(--border))"
                      />
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
                        cursor={{ fill: "hsl(var(--muted))" }}
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          borderColor: "hsl(var(--border))",
                          borderRadius: "8px",
                          fontSize: "12px",
                        }}
                      />
                      <Bar
                        dataKey="occupancyRate"
                        name={ar ? "نسبة الإشغال %" : "Occupancy %"}
                        fill="hsl(var(--primary))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2">
                    <Building2 className="w-10 h-10 opacity-20" />
                    <p>{ar ? "لا توجد بيانات" : "No data available"}</p>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card className="col-span-3 bg-card/70 backdrop-blur-xl border-border/50 shadow-xl flex flex-col overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    {ar ? "تنبيهات المغادرة" : "Departure Alerts"}
                    {(departureAlerts?.length ?? 0) > 0 && (
                      <span className="h-5 min-w-5 px-1.5 flex items-center justify-center rounded-full bg-amber-500 text-white text-[10px] font-bold">
                        {departureAlerts!.length}
                      </span>
                    )}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {ar
                      ? "مغادرات الموظفين القادمة"
                      : "Upcoming profile checkouts"}
                  </CardDescription>
                </div>
                <Link href="/accommodation/in-house">
                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-accent gap-1"
                  >
                    {ar ? "عرض" : "View"} <ArrowRight className="w-3 h-3" />
                  </Badge>
                </Link>
              </CardHeader>
              <CardContent className="flex-1 overflow-auto space-y-2">
                {departureAlerts && departureAlerts.length > 0 ? (
                  departureAlerts.slice(0, 6).map((alert) => (
                    <Link
                      key={alert.assignmentId}
                      href="/accommodation/in-house"
                    >
                      <div className="flex items-center gap-3 p-2.5 rounded-xl border border-border/50 bg-card/50 hover:bg-muted/80 hover:-translate-y-0.5 hover:shadow-md transition-all duration-300 cursor-pointer relative overflow-hidden">
                        <div
                          className={`p-1.5 rounded-full flex-shrink-0 ${alert.daysRemaining <= 1 ? "bg-red-100 text-red-600 dark:bg-red-950/40" : alert.daysRemaining <= 3 ? "bg-amber-100 text-amber-600 dark:bg-amber-950/40" : "bg-primary/10 text-primary"}`}
                        >
                          <AlertTriangle className="h-3.5 w-3.5" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium truncate">
                            {alert.profileName}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {alert.buildingName}, {ar ? "الغرفة" : "Room"}{" "}
                            {alert.roomNumber}
                          </p>
                        </div>
                        <div className="text-right whitespace-nowrap">
                          <p
                            className={`text-xs font-bold ${alert.daysRemaining <= 1 ? "text-red-600" : alert.daysRemaining <= 3 ? "text-amber-600" : "text-foreground"}`}
                          >
                            {alert.daysRemaining < 0
                              ? ar
                                ? "متأخر"
                                : "Overdue"
                              : `${alert.daysRemaining}d`}
                          </p>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(
                              alert.expectedCheckOutDate,
                            ).toLocaleDateString()}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))
                ) : (
                  <div className="h-full flex items-center justify-center text-muted-foreground text-sm flex-col gap-2 pt-8">
                    <CheckCircle2 className="h-8 w-8 text-green-500 opacity-60" />
                    <p className="font-medium text-green-600 dark:text-green-400">
                      {ar ? "لا مغادرات قريبة" : "No upcoming departures"}
                    </p>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Quick Links */}
          <div>
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider mb-3">
              {ar ? "وصول سريع" : "Quick Access"}
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
              {[
                {
                  label: ar ? "الحجوزات والتسكين" : "Reservations & Housing",
                  icon: UserCheck,
                  href: "/accommodation/reservations",
                  color: "text-primary bg-primary/10",
                },
                {
                  label: ar ? "داخلي" : "In-House",
                  icon: Users,
                  href: "/accommodation/in-house",
                  color: "text-green-600 bg-green-50 dark:bg-green-950/30",
                },
                {
                  label: ar ? "الحجوزات" : "Reservations",
                  icon: CalendarCheck,
                  href: "/accommodation/reservations",
                  color: "text-purple-600 bg-purple-50 dark:bg-purple-950/30",
                },
                {
                  label: ar ? "الإسكان" : "Housing",
                  icon: Building2,
                  href: "/housing",
                  color: "text-blue-600 bg-blue-50 dark:bg-blue-950/30",
                },
                {
                  label: ar ? "التذاكر" : "Tickets",
                  icon: Wrench,
                  href: "/maintenance",
                  color: "text-orange-600 bg-orange-50 dark:bg-orange-950/30",
                },
                {
                  label: ar ? "استضافة ضيوف" : "Guest Hosting",
                  icon: Users,
                  href: "/accommodation/guest-hosting",
                  color: "text-rose-600 bg-rose-50 dark:bg-rose-950/30",
                },
              ].map((item, i) => (
                <Link key={i} href={item.href}>
                  <Card className="bg-card/60 backdrop-blur-lg border-border/50 shadow-lg hover:shadow-xl hover:shadow-primary/10 hover:-translate-y-1 hover:border-primary/30 transition-all duration-300 cursor-pointer text-center p-4 group h-full relative overflow-hidden">
                    <div className={`absolute top-0 right-0 w-24 h-24 rounded-full blur-2xl opacity-10 pointer-events-none transition-opacity duration-300 group-hover:opacity-30 ${item.color.split(' ')[1]}`} />
                    <div
                      className={`w-10 h-10 rounded-xl ${item.color} flex items-center justify-center mx-auto mb-2.5 group-hover:scale-110 transition-transform relative z-10`}
                    >
                      <item.icon className="w-5 h-5" />
                    </div>
                    <p className="text-xs font-medium text-foreground leading-tight">
                      {item.label}
                    </p>
                  </Card>
                </Link>
              ))}
            </div>
          </div>

          {/* Recent Activity */}
          {activity && activity.length > 0 && (
            <Card className="bg-card/70 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
              <CardHeader className="flex flex-row items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {ar ? "النشاط الأخير" : "Recent Activity"}
                  </CardTitle>
                  <CardDescription className="text-xs mt-0.5">
                    {ar ? "آخر الأنشطة في النظام" : "Latest system activities"}
                  </CardDescription>
                </div>
                <Link href="/activity-log">
                  <Badge
                    variant="outline"
                    className="text-xs cursor-pointer hover:bg-accent gap-1"
                  >
                    {ar ? "السجل الكامل" : "Full log"}{" "}
                    <ArrowRight className="w-3 h-3" />
                  </Badge>
                </Link>
              </CardHeader>
              <CardContent>
                <div className="space-y-2.5">
                  {activity.slice(0, 5).map((act: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-start gap-3 text-sm py-1.5 border-b border-border/50 last:border-0"
                    >
                      <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                        <span className="text-[10px] font-bold text-primary">
                          {act.username?.[0]?.toUpperCase() ?? "?"}
                        </span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <span className="font-medium">{act.username}</span>
                        <span className="text-muted-foreground">
                          {" "}
                          · {act.action}
                        </span>
                        {act.module && (
                          <Badge
                            variant="outline"
                            className="ml-2 text-[10px] py-0 px-1.5 h-4"
                          >
                            {act.module}
                          </Badge>
                        )}
                      </div>
                      <span className="text-xs text-muted-foreground whitespace-nowrap flex-shrink-0">
                        {act.timestamp
                          ? new Date(act.timestamp).toLocaleDateString()
                          : ""}
                      </span>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
