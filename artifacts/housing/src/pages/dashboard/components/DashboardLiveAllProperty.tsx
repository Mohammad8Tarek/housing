import * as React from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Users,
  Building2,
  BedDouble,
  Wrench,
  CalendarCheck,
  Sparkles,
  ArrowRight,
  TrendingUp,
  ShieldCheck,
  RefreshCw,
  BarChart3,
  CheckCircle2,
  AlertTriangle,
  DoorOpen,
  FileSpreadsheet,
  Layers,
  Activity,
  Compass,
  ArrowUpRight,
  Clock,
  SlidersHorizontal,
  ChevronRight,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Legend,
  Cell,
} from "recharts";
import { DashboardKpiCard } from "./DashboardKpiCard";
import { formatDate } from "@/lib/date-utils";
import { Link, useLocation } from "wouter";
import { getPropertySlug } from "@/lib/property-slug";

interface DashboardLiveAllPropertyProps {
  ar: boolean;
  totals: any;
  perProperty: any[];
  analytics: any;
  operations: any;
  allStatsLoading: boolean;
  refetchAllStats: () => void;
  setActivePropertyId: (id: number | "all") => void;
  properties?: any[];
}

export function DashboardLiveAllProperty({
  ar,
  totals,
  perProperty = [],
  analytics,
  operations,
  allStatsLoading,
  refetchAllStats,
  setActivePropertyId,
  properties = [],
}: DashboardLiveAllPropertyProps) {
  const [, setLocation] = useLocation();
  const [activeOpsTab, setActiveOpsTab] = React.useState<"arrivals" | "tickets">("arrivals");

  // Chart data for comparing properties
  const propertyChartData = React.useMemo(() => {
    return perProperty.map((p) => ({
      name: p.name || p.displayName || `Hotel #${p.id}`,
      code: p.code,
      bedOccupancy: p.bedOccupancyRate ?? p.occupancyRate ?? 0,
      roomOccupancy: p.roomOccupancyRate ?? 0,
      totalRooms: p.totalRooms ?? 0,
      totalBeds: p.totalBeds ?? 0,
      occupiedBeds: p.occupiedBeds ?? 0,
    }));
  }, [perProperty]);

  // Executive Reports Matrix
  const reportCards = [
    {
      title: ar ? "تقرير الإشغال العام الموحد" : "Executive Portfolio Occupancy",
      desc: ar ? "إشغال الفنادق والمباني وتوزيع الأسرة" : "All properties & buildings occupancy",
      icon: BarChart3,
      tab: "manager_flash",
      color: "text-blue-600 dark:text-blue-400",
      bg: "bg-blue-500/10 hover:bg-blue-500/15",
    },
    {
      title: ar ? "استثناءات ومخالفات السياسة" : "Policy Exceptions & Level Audit",
      desc: ar ? "سجل التجاوزات واعتمادات الإدارة" : "Policy violations & manager overrides",
      icon: ShieldCheck,
      tab: "policy_exceptions",
      color: "text-rose-600 dark:text-rose-400",
      bg: "bg-rose-500/10 hover:bg-rose-500/15",
    },
    {
      title: ar ? "بيان الغرف الشاغرة الجاهزة" : "Vacant Ready Rooms Manifest",
      desc: ar ? "غرف نظيفة وجاهزة للتسكين الفوري" : "Clean rooms ready for immediate check-in",
      icon: DoorOpen,
      tab: "vacant_rooms",
      color: "text-emerald-600 dark:text-emerald-400",
      bg: "bg-emerald-500/10 hover:bg-emerald-500/15",
    },
    {
      title: ar ? "حركة التسكين اليومية" : "Daily Operations Movement",
      desc: ar ? "الوصول والمغادرة وحركات اليوم" : "Today arrivals, check-outs & transfers",
      icon: CalendarCheck,
      tab: "daily_movement",
      color: "text-purple-600 dark:text-purple-400",
      bg: "bg-purple-500/10 hover:bg-purple-500/15",
    },
    {
      title: ar ? "نظافة وتجهيز الغرف" : "Housekeeping & Turnover",
      desc: ar ? "معدل الجاهزية وقوائم التنظيف" : "Room turnover health & cleaning queue",
      icon: Sparkles,
      tab: "housekeeping_sheet",
      color: "text-amber-600 dark:text-amber-400",
      bg: "bg-amber-500/10 hover:bg-amber-500/15",
    },
    {
      title: ar ? "سجل الصيانة والأعطال" : "Maintenance & Asset Health",
      desc: ar ? "الأعطال المفتوحة وأداء الفنيين" : "Active tickets & service ratings",
      icon: Wrench,
      tab: "maintenance",
      color: "text-orange-600 dark:text-orange-400",
      bg: "bg-orange-500/10 hover:bg-orange-500/15",
    },
    {
      title: ar ? "العقود والإقامات المنتهية" : "Expiring Contracts & Overstay",
      desc: ar ? "عقود منتهية مستمرة في السكن" : "Staff with expired HR contracts",
      icon: AlertTriangle,
      tab: "expiring_contracts",
      color: "text-red-600 dark:text-red-400",
      bg: "bg-red-500/10 hover:bg-red-500/15",
    },
    {
      title: ar ? "تقييمات وجودة السكن" : "Housing Pulse & Satisfaction",
      desc: ar ? "استطلاعات رضا المقيمين والخدمات" : "Resident ratings & survey scores",
      icon: TrendingUp,
      tab: "housing_ratings",
      color: "text-indigo-600 dark:text-indigo-400",
      bg: "bg-indigo-500/10 hover:bg-indigo-500/15",
    },
  ];

  return (
    <div className="space-y-6">
      {/* 1. LIVE MASTER COMMAND BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/10 via-card to-background p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge
                variant="outline"
                className="bg-primary/15 text-primary border-primary/30 text-xs px-2.5 py-0.5 font-bold flex items-center gap-1.5"
              >
                <span className="relative flex h-2 w-2">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                </span>
                {ar ? "مركز القيادة الموحد — بث مباشر" : "LIVE ALL-PROPERTIES COMMAND CENTER"}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {perProperty.length} {ar ? "فنادق وفروع تحت الإشراف" : "Properties Under Management"}
              </Badge>
              <Badge variant="outline" className="text-[11px] font-mono text-muted-foreground">
                {ar ? "صلاحيات Super Admin كاملة" : "Super Admin Full Authority"}
              </Badge>
            </div>
            <h2 className="text-xl font-bold tracking-tight text-foreground">
              {ar ? "نظرة شمولية موحدة على سكن العاملين بكافة الفروع" : "Unified Staff Housing Overview Across All Properties"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "متابعة فورية ومباشرة للطاقة الاستيعابية، نسب الإشغال، البلاغات المفتوحة، وحركات التسكين دون الحاجة للتبديل بين الفنادق."
                : "Real-time consolidated tracking of total capacity, occupancy metrics, open service orders, and daily movements."}
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-center shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => refetchAllStats()}
              disabled={allStatsLoading}
              className="gap-2 text-xs font-semibold h-9"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${allStatsLoading ? "animate-spin text-primary" : ""}`} />
              {ar ? "تحديث مباشر" : "Live Refresh"}
            </Button>
            <Button
              asChild
              variant="default"
              size="sm"
              className="gap-2 text-xs font-semibold h-9 shadow-sm"
            >
              <Link href="/reports?tab=manager_flash">
                <FileSpreadsheet className="w-3.5 h-3.5" />
                {ar ? "التقارير الموحدة" : "Executive Reports"}
              </Link>
            </Button>
          </div>
        </div>
      </div>

      {/* 2. MASTER EXECUTIVE KPI CARDS */}
      <div className="grid gap-4 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
        {/* Total Profiles */}
        <DashboardKpiCard
          title={ar ? "إجمالي القوة العاملة" : "Total Workforce"}
          value={totals?.totalProfiles ?? 0}
          sub={`${totals?.activeAssignments ?? 0} ${ar ? "مسكن حالياً" : "housed"} · ${Math.max(0, (totals?.totalProfiles ?? 0) - (totals?.activeAssignments ?? 0))} ${ar ? "غير مسكن" : "unhoused"}`}
          icon={Users}
          href="/profiles"
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-500/10"
          sparklineData={[120, 125, 128, 130, 135, totals?.totalProfiles ?? 140]}
        />

        {/* Global Bed Occupancy */}
        <DashboardKpiCard
          title={ar ? "إشغال الأسرة العام" : "Global Bed Occupancy"}
          value={`${totals?.bedOccupancyRate ?? totals?.occupancyRate ?? 0}%`}
          sub={`${totals?.occupiedBeds ?? 0} / ${totals?.totalBeds ?? 0} ${ar ? "سرير مأهول" : "beds occupied"}`}
          icon={BedDouble}
          href="/reports?tab=in_house"
          color="text-amber-600 dark:text-amber-400"
          bg="bg-amber-500/10"
          sparklineData={[70, 72, 75, 78, 80, totals?.bedOccupancyRate ?? 82]}
        />

        {/* Global Room Occupancy */}
        <DashboardKpiCard
          title={ar ? "إشغال الغرف العام" : "Global Room Occupancy"}
          value={`${totals?.roomOccupancyRate ?? 0}%`}
          sub={`${totals?.occupiedRooms ?? 0} / ${totals?.totalRooms ?? 0} ${ar ? "غرفة مشغولة" : "rooms occupied"}`}
          icon={Building2}
          href="/reports?tab=rooms"
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10"
          sparklineData={[60, 62, 65, 68, 70, totals?.roomOccupancyRate ?? 72]}
        />

        {/* Available Ready Beds */}
        <DashboardKpiCard
          title={ar ? "الأسرة الشاغرة" : "Vacant Beds"}
          value={totals?.availableBeds ?? 0}
          sub={`${totals?.availableRooms ?? 0} ${ar ? "غرفة شاغرة بالكامل" : "vacant rooms"}`}
          icon={DoorOpen}
          href="/reports?tab=vacant_rooms"
          color="text-teal-600 dark:text-teal-400"
          bg="bg-teal-500/10"
          sparklineData={[30, 28, 25, 22, 20, totals?.availableBeds ?? 18]}
        />

        {/* Open Maintenance & Housekeeping Orders */}
        <DashboardKpiCard
          title={ar ? "البلاغات المفتوحة" : "Active Service Tickets"}
          value={totals?.openMaintenance ?? 0}
          sub={ar ? "صيانة وخدمات عبر كل الفروع" : "Orders across all branches"}
          icon={Wrench}
          href="/maintenance"
          color="text-rose-600 dark:text-rose-400"
          bg="bg-rose-500/10"
          alert={(totals?.openMaintenance ?? 0) > 0}
          sparklineData={[8, 9, 7, 6, 8, totals?.openMaintenance ?? 5]}
        />

        {/* Confirmed Upcoming Arrivals */}
        <DashboardKpiCard
          title={ar ? "الوصول المتوقع" : "Expected Arrivals"}
          value={totals?.upcomingReservations ?? 0}
          sub={ar ? "حجوزات مؤكدة قيد الانتظار" : "Confirmed arrivals pending"}
          icon={CalendarCheck}
          href="/reports?tab=daily_movement"
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-500/10"
          sparklineData={[4, 6, 8, 7, 9, totals?.upcomingReservations ?? 8]}
        />
      </div>

      {/* 3. CONSOLIDATED READINESS & TURNOVER RIBBON */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        <div className="bg-card/80 border border-border/70 rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-primary/10 flex items-center justify-center text-primary shrink-0">
            <Building2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{ar ? "إجمالي الغرف" : "Total Rooms"}</p>
            <p className="text-base font-bold font-mono text-foreground">{totals?.totalRooms ?? 0}</p>
          </div>
        </div>

        <div className="bg-card/80 border border-border/70 rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-emerald-500/10 flex items-center justify-center text-emerald-600 dark:text-emerald-400 shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{ar ? "غرف جاهزة ونظيفة" : "Clean & Ready"}</p>
            <p className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400">{totals?.availableRooms ?? 0}</p>
          </div>
        </div>

        <div className="bg-card/80 border border-border/70 rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <Sparkles className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{ar ? "بحاجة لنظافة" : "Dirty / Cleaning"}</p>
            <p className="text-base font-bold font-mono text-amber-600 dark:text-amber-400">{totals?.dirtyRooms ?? 0}</p>
          </div>
        </div>

        <div className="bg-card/80 border border-border/70 rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-rose-500/10 flex items-center justify-center text-rose-600 dark:text-rose-400 shrink-0">
            <Wrench className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{ar ? "صيانة / خارج الخدمة" : "OOO Maintenance"}</p>
            <p className="text-base font-bold font-mono text-rose-600 dark:text-rose-400">{totals?.oooRooms ?? 0}</p>
          </div>
        </div>

        <div className="bg-card/80 border border-border/70 rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600 dark:text-blue-400 shrink-0">
            <Layers className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{ar ? "إجمالي المباني" : "Total Buildings"}</p>
            <p className="text-base font-bold font-mono text-foreground">{totals?.totalBuildings ?? 0}</p>
          </div>
        </div>

        <div className="bg-card/80 border border-border/70 rounded-xl p-3 flex items-center gap-3 shadow-xs">
          <div className="w-9 h-9 rounded-lg bg-indigo-500/10 flex items-center justify-center text-indigo-600 dark:text-indigo-400 shrink-0">
            <TrendingUp className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <p className="text-[11px] font-semibold text-muted-foreground">{ar ? "معدل الجاهزية العام" : "Clean Readiness"}</p>
            <p className="text-base font-bold font-mono text-indigo-600 dark:text-indigo-400">{totals?.cleanRate ?? 100}%</p>
          </div>
        </div>
      </div>

      {/* 4. PER-PROPERTY INTERACTIVE COMPARISON MATRIX & DIRECT JUMP */}
      <Card className="bg-card/85 backdrop-blur-md border border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Compass className="w-4 h-4 text-primary" />
              {ar ? "مصفوفة مقارنة الفنادق والفروع (Live Branch Performance Matrix)" : "Branch Performance & Occupancy Matrix"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar
                ? "مقارنة مباشرة بين نسب الإشغال والجاهزية، مع إمكانية الدخول الفوري للوحة تحكم أي فندق."
                : "Comparative view across all hotels with one-click direct jump to any branch dashboard."}
            </CardDescription>
          </div>
          <Badge variant="outline" className="font-mono text-xs self-start sm:self-auto">
            {perProperty.length} {ar ? "فروع نشطة" : "Active Branches"}
          </Badge>
        </CardHeader>
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-border bg-muted/30 text-muted-foreground text-[11px] font-bold uppercase tracking-wider">
                  <th className="text-start py-3 px-4">{ar ? "الفندق / الفرع" : "Hotel Branch"}</th>
                  <th className="text-center py-3 px-3">{ar ? "إشغال الأسرة" : "Bed Occupancy"}</th>
                  <th className="text-center py-3 px-3">{ar ? "إشغال الغرف" : "Room Occupancy"}</th>
                  <th className="text-center py-3 px-3">{ar ? "الموظفون" : "Staff"}</th>
                  <th className="text-center py-3 px-3">{ar ? "الأسرة (مشغول/إجمالي)" : "Beds (Occ/Tot)"}</th>
                  <th className="text-center py-3 px-3">{ar ? "غرف تحتاج نظافة" : "Dirty Rooms"}</th>
                  <th className="text-center py-3 px-3">{ar ? "البلاغات" : "Tickets"}</th>
                  <th className="text-center py-3 px-3">{ar ? "الوصول" : "Arrivals"}</th>
                  <th className="text-end py-3 px-4">{ar ? "إجراء" : "Action"}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border/40">
                {perProperty.map((p: any) => {
                  const slug = getPropertySlug(p);
                  const bedRate = p.bedOccupancyRate ?? p.occupancyRate ?? 0;
                  const roomRate = p.roomOccupancyRate ?? 0;

                  return (
                    <tr
                      key={p.id}
                      className="hover:bg-muted/50 transition-colors group cursor-pointer"
                      onClick={() => {
                        setActivePropertyId(p.id);
                        setLocation(`/${slug}/dashboard`);
                      }}
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors shrink-0">
                            <Building2 className="w-4 h-4" />
                          </div>
                          <div>
                            <p className="font-bold text-foreground text-xs group-hover:text-primary transition-colors">
                              {p.name || p.displayName}
                            </p>
                            <p className="text-[11px] text-muted-foreground font-mono">
                              {p.code ? `[${p.code}]` : ""} • {p.totalBuildings || 0} {ar ? "مباني" : "buildings"}
                            </p>
                          </div>
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <div className="inline-flex flex-col items-center gap-1 w-24">
                          <span
                            className={`font-mono font-bold text-xs px-2 py-0.5 rounded-full ${
                              bedRate >= 85
                                ? "bg-rose-500/10 text-rose-600 dark:text-rose-400"
                                : bedRate >= 65
                                ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                                : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                            }`}
                          >
                            {bedRate}%
                          </span>
                          <Progress value={bedRate} className="h-1.5 w-full bg-muted" />
                        </div>
                      </td>

                      <td className="py-3 px-3 text-center">
                        <span className="font-mono font-semibold text-xs text-foreground">
                          {roomRate}%
                        </span>
                      </td>

                      <td className="py-3 px-3 text-center font-mono font-medium text-foreground">
                        {p.totalProfiles ?? 0}
                      </td>

                      <td className="py-3 px-3 text-center font-mono text-[11px]">
                        <span className="font-bold text-foreground">{p.occupiedBeds ?? 0}</span>
                        <span className="text-muted-foreground"> / {p.totalBeds ?? 0}</span>
                      </td>

                      <td className="py-3 px-3 text-center">
                        {(p.dirtyRooms ?? 0) > 0 ? (
                          <Badge variant="outline" className="bg-amber-500/10 text-amber-600 border-amber-300 text-[10px] font-mono">
                            {p.dirtyRooms} {ar ? "متسخة" : "dirty"}
                          </Badge>
                        ) : (
                          <span className="text-emerald-600 text-[11px]">✓ {ar ? "جاهز" : "Clean"}</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {(p.openMaintenance ?? 0) > 0 ? (
                          <Badge variant="outline" className="bg-rose-500/10 text-rose-600 border-rose-300 text-[10px] font-mono">
                            {p.openMaintenance}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground font-mono">0</span>
                        )}
                      </td>

                      <td className="py-3 px-3 text-center">
                        {(p.upcomingReservations ?? 0) > 0 ? (
                          <Badge variant="outline" className="bg-purple-500/10 text-purple-600 border-purple-300 text-[10px] font-mono">
                            +{p.upcomingReservations}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground font-mono">0</span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-end">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 text-xs font-semibold gap-1 text-primary hover:text-primary hover:bg-primary/10"
                        >
                          <span>{ar ? "فتح الفرع" : "Enter"}</span>
                          <ChevronRight className="w-3.5 h-3.5 rtl:rotate-180" />
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* 5. SIDE-BY-SIDE ANALYTICS CHARTS & DISTRIBUTION */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Comparative Occupancy BarChart */}
        <Card className="bg-card/85 backdrop-blur-md border border-border/70 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              {ar ? "مقارنة نسب الإشغال بين كافة الفروع" : "Comparative Hotel Occupancy Rates"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar ? "نسبة إشغال الأسرة مقابل الغرف لكل فندق" : "Bed occupancy vs Room occupancy by property"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4">
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={propertyChartData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" opacity={0.5} />
                  <XAxis dataKey="code" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} domain={[0, 100]} tickFormatter={(v) => `${v}%`} />
                  <Tooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length) {
                        const d = payload[0].payload;
                        return (
                          <div className="bg-card border border-border rounded-xl p-3 shadow-lg text-xs space-y-1">
                            <p className="font-bold text-foreground">{d.name}</p>
                            <p className="text-amber-600">{ar ? "إشغال الأسرة:" : "Bed Occupancy:"} <strong className="font-mono">{d.bedOccupancy}%</strong> ({d.occupiedBeds}/{d.totalBeds})</p>
                            <p className="text-emerald-600">{ar ? "إشغال الغرف:" : "Room Occupancy:"} <strong className="font-mono">{d.roomOccupancy}%</strong></p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Bar dataKey="bedOccupancy" name={ar ? "إشغال الأسرة %" : "Bed %"} fill="#f59e0b" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="roomOccupancy" name={ar ? "إشغال الغرف %" : "Room %"} fill="#10b981" radius={[4, 4, 0, 0]} />
                  <Legend wrapperStyle={{ fontSize: "11px", paddingTop: "8px" }} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        {/* Global Department Workforce Allocation */}
        <Card className="bg-card/85 backdrop-blur-md border border-border/70 shadow-sm overflow-hidden">
          <CardHeader className="pb-3 border-b border-border/50">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Users className="w-4 h-4 text-primary" />
              {ar ? "توزيع المقيمين حسب الأقسام العامة" : "Workforce Distribution by Department"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar ? "أكبر الأقسام إشغالاً للسكن عبر كافة الفنادق" : "Top departments housed across all hotels"}
            </CardDescription>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {(analytics?.departmentBreakdown || []).slice(0, 6).map((dept: any, idx: number) => {
              const count = dept.count || 0;
              const percent = dept.percent || 0;
              return (
                <div key={idx} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-foreground truncate max-w-[200px]">{dept.name}</span>
                    <span className="font-mono text-muted-foreground text-[11px]">{count} {ar ? "موظف" : "staff"} ({percent}%)</span>
                  </div>
                  <Progress value={percent} className="h-1.5" />
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* 6. EXECUTIVE ALL-PROPERTIES REPORTS & AUDIT CENTER */}
      <Card className="bg-card/85 backdrop-blur-md border border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <FileSpreadsheet className="w-4 h-4 text-primary" />
            {ar ? "مركز التقارير والتدقيق الشامل لكافة الفنادق (Executive Cross-Property Audit)" : "Consolidated Reports & Audit Center"}
          </CardTitle>
          <CardDescription className="text-xs">
            {ar
              ? "وصول فوري ومباشر لكافة تقارير وإحصائيات النظام الشاملة لمدير النظام العام (Super Admin)"
              : "Instant one-click access to consolidated system reports and audit manifests"}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {reportCards.map((rc, idx) => {
              const Icon = rc.icon;
              return (
                <Link
                  key={idx}
                  href={`/reports?tab=${rc.tab}&propertyId=all`}
                  className={`group p-3.5 rounded-xl border border-border/60 ${rc.bg} transition-all duration-200 flex flex-col justify-between gap-3`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1">
                      <p className="font-bold text-xs text-foreground group-hover:text-primary transition-colors">
                        {rc.title}
                      </p>
                      <p className="text-[11px] text-muted-foreground line-clamp-2">
                        {rc.desc}
                      </p>
                    </div>
                    <div className={`w-8 h-8 rounded-lg bg-background/80 flex items-center justify-center shrink-0 ${rc.color} shadow-xs`}>
                      <Icon className="w-4 h-4" />
                    </div>
                  </div>
                  <div className="flex items-center justify-between text-[11px] font-semibold text-primary pt-2 border-t border-border/40">
                    <span>{ar ? "فتح التقرير الشامل" : "Open Audit Report"}</span>
                    <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform rtl:group-hover:-translate-x-0.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* 7. CROSS-PROPERTY LIVE OPERATIONS & TASKS HUB */}
      <Card className="bg-card/85 backdrop-blur-md border border-border/70 shadow-sm overflow-hidden">
        <CardHeader className="pb-3 border-b border-border/50 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-primary" />
              {ar ? "غرفة العمليات المركزية الحية (Live Central Operations Stream)" : "Central Operations Stream"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar
                ? "أحدث طلبات الصيانة، النظافة، وحركات الوصول المؤكدة عبر كافة الفنادق في شاشة واحدة."
                : "Live stream of incoming arrivals and urgent service orders across all hotels."}
            </CardDescription>
          </div>

          {/* Tab Selector */}
          <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border border-border/50 self-start sm:self-auto">
            <Button
              type="button"
              size="sm"
              variant={activeOpsTab === "arrivals" ? "default" : "ghost"}
              className="h-7 text-xs font-semibold px-2.5 gap-1.5"
              onClick={() => setActiveOpsTab("arrivals")}
            >
              <CalendarCheck className="w-3.5 h-3.5" />
              {ar ? "الوصول المتوقع" : "Arrivals"}
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                {operations?.checkIns?.length || 0}
              </Badge>
            </Button>
            <Button
              type="button"
              size="sm"
              variant={activeOpsTab === "tickets" ? "default" : "ghost"}
              className="h-7 text-xs font-semibold px-2.5 gap-1.5"
              onClick={() => setActiveOpsTab("tickets")}
            >
              <Wrench className="w-3.5 h-3.5" />
              {ar ? "البلاغات النشطة" : "Active Tickets"}
              <Badge variant="secondary" className="text-[10px] px-1 py-0 h-4">
                {operations?.maintenanceRequests?.length || 0}
              </Badge>
            </Button>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          {activeOpsTab === "arrivals" ? (
            <div className="divide-y divide-border/40">
              {(operations?.checkIns || []).length > 0 ? (
                operations.checkIns.map((arr: any) => (
                  <div key={arr.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center text-purple-600 shrink-0">
                        <CalendarCheck className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-foreground">{arr.guestName || "—"}</p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {ar ? "غرفة" : "Room"} {arr.roomNumber || "—"} • {ar ? "الوصول:" : "Check-in:"} {formatDate(arr.checkInDate)}
                        </p>
                      </div>
                    </div>
                    <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-semibold">
                      {arr.propertyName}
                    </Badge>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {ar ? "لا توجد حجوزات وصول مؤكدة قيد الانتظار حالياً." : "No upcoming confirmed arrivals pending."}
                </div>
              )}
            </div>
          ) : (
            <div className="divide-y divide-border/40">
              {(operations?.maintenanceRequests || []).length > 0 ? (
                operations.maintenanceRequests.map((t: any) => (
                  <div key={t.id} className="p-3.5 flex items-center justify-between gap-3 hover:bg-muted/40 transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-amber-500/10 flex items-center justify-center text-amber-600 shrink-0">
                        <Wrench className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="font-bold text-xs text-foreground">
                          {t.problemType || (ar ? "بلاغ صيانة" : "Service Order")} #{t.id}
                        </p>
                        <p className="text-[11px] text-muted-foreground font-mono">
                          {ar ? "فئة:" : "Category:"} {t.category || "maintenance"} • {ar ? "غرفة" : "Room"} {t.roomNumber || "—"}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge
                        variant="outline"
                        className={
                          t.priority === "urgent" || t.priority === "high"
                            ? "bg-rose-50 text-rose-700 border-rose-300 text-[10px]"
                            : "bg-blue-50 text-blue-700 border-blue-300 text-[10px]"
                        }
                      >
                        {t.priority || "medium"}
                      </Badge>
                      <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 text-xs font-semibold">
                        {t.propertyName}
                      </Badge>
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-8 text-center text-xs text-muted-foreground">
                  {ar ? "لا توجد بلاغات صيانة أو نظافة مفتوحة حالياً." : "No active service tickets."}
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
