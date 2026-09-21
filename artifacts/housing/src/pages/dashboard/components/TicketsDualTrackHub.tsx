import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Link } from "wouter";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Wrench,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  ArrowRight,
  Star,
  Activity,
  UserCheck,
  Building,
  Home,
  MessageSquare,
  ThumbsUp,
  ChevronRight,
  ExternalLink,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/date-utils";

interface TrackStats {
  total: number;
  open: number;
  approved: number;
  done: number;
  urgent: number;
  completionRate: number;
  ratingStats: {
    avgRating: number;
    totalRated: number;
    satisfactionRate: number;
  };
}

interface TicketItem {
  id: number;
  roomId: number;
  category: string;
  problemType: string;
  description: string;
  status: string;
  priority: string;
  reportedBy?: string | null;
  reportedAt?: string | null;
  resolvedAt?: string | null;
  rating?: number | null;
  ratingComment?: string | null;
  ratedAt?: string | null;
  roomNumber?: string | null;
  buildingName?: string | null;
}

interface OverviewData {
  maintenance: TrackStats;
  housekeeping: TrackStats;
  recentMaintenance: TicketItem[];
  recentHousekeeping: TicketItem[];
}

interface TicketsDualTrackHubProps {
  propertyId: number;
  buildNavHref: (path: string) => string;
}

export function TicketsDualTrackHub({
  propertyId,
  buildNavHref,
}: TicketsDualTrackHubProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [activeTab, setActiveTab] = useState<"both" | "maintenance" | "housekeeping">("both");

  const { data: response, isLoading } = useQuery<{ success: boolean; data: OverviewData }>({
    queryKey: ["dashboard", "tickets-overview", propertyId],
    queryFn: async () => {
      const res = await fetch(`/api/dashboard/tickets-overview?propertyId=${propertyId}`);
      if (!res.ok) throw new Error("Failed to fetch tickets overview");
      return res.json();
    },
    refetchInterval: 15_000,
  });

  const overview = response?.data;
  const mnt = overview?.maintenance;
  const hsk = overview?.housekeeping;

  const getStatusBadge = (status: string) => {
    const st = (status || "open").toLowerCase();
    if (st === "open") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
          <Clock className="w-2.5 h-2.5" />
          {ar ? "مفتوحة" : "Open"}
        </span>
      );
    }
    if (st === "in_progress") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
          <Activity className="w-2.5 h-2.5" />
          {ar ? "معتمدة / قيد العمل" : "In Progress"}
        </span>
      );
    }
    if (st === "resolved" || st === "closed" || st === "completed") {
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
          <CheckCircle2 className="w-2.5 h-2.5" />
          {ar ? "تم الإنجاز" : "Done"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-muted text-muted-foreground">
        {status}
      </span>
    );
  };

  const getPriorityBadge = (priority: string) => {
    const pr = (priority || "medium").toLowerCase();
    if (pr === "urgent") {
      return (
        <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[9px] font-black bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30 animate-pulse">
          <Flame className="w-2.5 h-2.5 text-rose-500" />
          {ar ? "عاجل" : "Urgent"}
        </span>
      );
    }
    if (pr === "high") {
      return (
        <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-bold bg-amber-500/15 text-amber-600 dark:text-amber-400">
          {ar ? "مرتفع" : "High"}
        </span>
      );
    }
    return (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium text-muted-foreground bg-muted/60">
        {ar ? "عادي" : "Normal"}
      </span>
    );
  };

  const renderStars = (rating: number) => {
    return (
      <div className="inline-flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={cn(
              "w-2.5 h-2.5",
              star <= rating
                ? "text-amber-400 fill-amber-400"
                : "text-muted-foreground/30"
            )}
          />
        ))}
      </div>
    );
  };

  return (
    <Card className="bg-card/85 backdrop-blur-xl border-border/70 shadow-xl overflow-hidden">
      {/* Executive Card Header */}
      <CardHeader className="pb-3 border-b border-border/40 bg-muted/20">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-black flex items-center gap-2 text-foreground tracking-tight">
              <div className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center shrink-0">
                <Wrench className="w-4 h-4" />
              </div>
              <span>
                {ar
                  ? "مركز بلاغات وعمليات الخدمة (تذاكر الصيانة والهاوس كيبنج)"
                  : "Service Orders & Operations Hub (Maintenance & Housekeeping)"}
              </span>
            </CardTitle>
            <CardDescription className="text-xs">
              {ar
                ? "متابعة لحظية وشاملة لكافة طلبات الصيانة والنظافة مع التقييمات ومعدلات الإنجاز والرضا"
                : "Real-time dual-track monitoring for tickets, approvals, resolutions, and resident satisfaction ratings"}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2">
            {/* Track Switcher */}
            <div className="inline-flex items-center p-1 bg-muted rounded-xl border text-xs">
              <button
                type="button"
                onClick={() => setActiveTab("both")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all",
                  activeTab === "both"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                {ar ? "الشقين معاً" : "Dual Track"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("maintenance")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1",
                  activeTab === "maintenance"
                    ? "bg-background text-amber-600 dark:text-amber-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Wrench className="w-3 h-3" />
                {ar ? "صيانة" : "Maintenance"}
              </button>
              <button
                type="button"
                onClick={() => setActiveTab("housekeeping")}
                className={cn(
                  "px-2.5 py-1 rounded-lg font-bold transition-all flex items-center gap-1",
                  activeTab === "housekeeping"
                    ? "bg-background text-emerald-600 dark:text-emerald-400 shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Sparkles className="w-3 h-3" />
                {ar ? "هاوس كيبنج" : "Housekeeping"}
              </button>
            </div>

            <Link href={buildNavHref("/maintenance")}>
              <Button variant="outline" size="sm" className="h-8 gap-1 text-xs font-semibold">
                <span>{ar ? "جميع التذاكر" : "All Tickets"}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </Button>
            </Link>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-5">
        <div
          className={cn(
            "grid gap-5",
            activeTab === "both" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
          )}
        >
          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TRACK 1: MAINTENANCE (الصيانة والأعطال)                        */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {(activeTab === "both" || activeTab === "maintenance") && (
            <div className="rounded-2xl border-2 border-amber-500/25 bg-amber-500/[0.02] p-4 flex flex-col justify-between space-y-4 shadow-xs">
              {/* Track Title & Rating Ribbon */}
              <div className="flex items-start justify-between gap-2 border-b border-amber-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold">
                    <Wrench className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                      {ar ? "شق الصيانة والأعطال" : "Maintenance Operations"}
                      <Badge variant="outline" className="text-[10px] font-mono border-amber-500/30 text-amber-700 dark:text-amber-300">
                        {mnt?.total ?? 0} {ar ? "بلاغ" : "tickets"}
                      </Badge>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {ar ? "سباكة، كهرباء، تكييف، نجارة، وأجهزة" : "Plumbing, electrical, AC, carpentry, appliances"}
                    </p>
                  </div>
                </div>

                {/* Rating & Satisfaction Badge */}
                <div className="flex flex-col items-end">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-amber-500/10 border border-amber-500/25">
                    <Star className="w-3.5 h-3.5 text-amber-500 fill-amber-500" />
                    <span className="text-xs font-black text-amber-600 dark:text-amber-400 font-mono">
                      {mnt?.ratingStats.avgRating ? mnt.ratingStats.avgRating.toFixed(1) : "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/ 5</span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                    {mnt?.ratingStats.totalRated ?? 0} {ar ? "تقييم" : "ratings"} ({mnt?.ratingStats.satisfactionRate ?? 0}% {ar ? "رضا" : "satisfaction"})
                  </span>
                </div>
              </div>

              {/* 4 KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Open */}
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    <span>{ar ? "مفتوحة" : "Open"}</span>
                  </div>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                    {mnt?.open ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "بانتظار البدء" : "Pending start"}
                  </span>
                </div>

                {/* 2. Approved / In Progress */}
                <div className="p-2.5 rounded-xl bg-blue-500/10 border border-blue-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-blue-700 dark:text-blue-400">
                    <Activity className="w-3 h-3" />
                    <span>{ar ? "معتمدة" : "Approved"}</span>
                  </div>
                  <div className="text-2xl font-black text-blue-700 dark:text-blue-300 font-mono mt-0.5">
                    {mnt?.approved ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "قيد التنفيذ" : "In progress"}
                  </span>
                </div>

                {/* 3. Done */}
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{ar ? "تم الإنجاز" : "Done"}</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                    {mnt?.done ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "مكتملة ومغلقة" : "Resolved"}
                  </span>
                </div>

                {/* 4. Urgent */}
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span>{ar ? "عاجلة" : "Urgent"}</span>
                  </div>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5">
                    {mnt?.urgent ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "أولوية قصوى" : "High priority"}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 bg-background/80 p-2.5 rounded-xl border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">
                    {ar ? "نسبة إنجاز طلبات الصيانة:" : "Maintenance Completion Rate:"}
                  </span>
                  <span className="font-black font-mono text-amber-600 dark:text-amber-400">
                    {mnt?.completionRate ?? 0}%
                  </span>
                </div>
                <Progress value={mnt?.completionRate ?? 0} className="h-2 bg-amber-500/15" />
              </div>

              {/* Recent Tickets Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
                  <span>{ar ? "أحدث بلاغات الصيانة الواردة:" : "Recent Maintenance Requests:"}</span>
                  <Link href={buildNavHref("/maintenance?category=maintenance")}>
                    <span className="text-amber-600 dark:text-amber-400 hover:underline cursor-pointer flex items-center gap-1 text-[11px]">
                      {ar ? "عرض الكل" : "View All"}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>

                {(!overview?.recentMaintenance || overview.recentMaintenance.length === 0) ? (
                  <div className="text-center py-6 border rounded-xl bg-background/50 text-xs text-muted-foreground">
                    {ar ? "لا توجد بلاغات صيانة حالياً" : "No maintenance tickets found"}
                  </div>
                ) : (
                  <div className="border rounded-xl bg-background divide-y divide-border/60 overflow-hidden text-xs">
                    {overview.recentMaintenance.slice(0, 5).map((t) => (
                      <Link
                        key={t.id}
                        href={buildNavHref(`/maintenance?ticketId=${t.id}`)}
                        className="p-2.5 flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors block cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0 font-bold">
                            #{t.roomNumber || t.roomId}
                          </Badge>
                          <div className="truncate">
                            <p className="font-semibold text-foreground truncate text-[11px]">
                              {t.problemType}
                            </p>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {t.buildingName || "Housing"} • {t.reportedBy || (ar ? "نزيل" : "Resident")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.rating ? (
                            <div className="hidden sm:flex items-center gap-0.5">
                              {renderStars(t.rating)}
                            </div>
                          ) : null}
                          {getPriorityBadge(t.priority)}
                          {getStatusBadge(t.status)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ══════════════════════════════════════════════════════════════ */}
          {/* TRACK 2: HOUSEKEEPING (الهاوس كيبنج والنظافة)                  */}
          {/* ══════════════════════════════════════════════════════════════ */}
          {(activeTab === "both" || activeTab === "housekeeping") && (
            <div className="rounded-2xl border-2 border-emerald-500/25 bg-emerald-500/[0.02] p-4 flex flex-col justify-between space-y-4 shadow-xs">
              {/* Track Title & Rating Ribbon */}
              <div className="flex items-start justify-between gap-2 border-b border-emerald-500/20 pb-3">
                <div className="flex items-center gap-2.5">
                  <div className="w-10 h-10 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold">
                    <Sparkles className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-foreground flex items-center gap-1.5">
                      {ar ? "شق الهاوس كيبنج والنظافة" : "Housekeeping Operations"}
                      <Badge variant="outline" className="text-[10px] font-mono border-emerald-500/30 text-emerald-700 dark:text-emerald-300">
                        {hsk?.total ?? 0} {ar ? "طلب" : "orders"}
                      </Badge>
                    </h3>
                    <p className="text-[11px] text-muted-foreground">
                      {ar ? "نظافة الغرف، المفارش، مستلزمات الحمام، والقمامة" : "Room cleaning, linen, amenities, trash collection"}
                    </p>
                  </div>
                </div>

                {/* Rating & Satisfaction Badge */}
                <div className="flex flex-col items-end">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-500/10 border border-emerald-500/25">
                    <Star className="w-3.5 h-3.5 text-emerald-600 fill-emerald-600 dark:text-emerald-400 dark:fill-emerald-400" />
                    <span className="text-xs font-black text-emerald-700 dark:text-emerald-300 font-mono">
                      {hsk?.ratingStats.avgRating ? hsk.ratingStats.avgRating.toFixed(1) : "—"}
                    </span>
                    <span className="text-[10px] text-muted-foreground">/ 5</span>
                  </div>
                  <span className="text-[10px] font-semibold text-muted-foreground mt-0.5">
                    {hsk?.ratingStats.totalRated ?? 0} {ar ? "تقييم" : "ratings"} ({hsk?.ratingStats.satisfactionRate ?? 0}% {ar ? "رضا" : "satisfaction"})
                  </span>
                </div>
              </div>

              {/* 4 KPI Cards Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {/* 1. Open */}
                <div className="p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-amber-700 dark:text-amber-400">
                    <Clock className="w-3 h-3" />
                    <span>{ar ? "مفتوحة" : "Open"}</span>
                  </div>
                  <div className="text-2xl font-black text-amber-700 dark:text-amber-300 font-mono mt-0.5">
                    {hsk?.open ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "بانتظار البدء" : "Pending clean"}
                  </span>
                </div>

                {/* 2. Approved / In Progress */}
                <div className="p-2.5 rounded-xl bg-teal-500/10 border border-teal-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-teal-700 dark:text-teal-400">
                    <Activity className="w-3 h-3" />
                    <span>{ar ? "معتمدة" : "Approved"}</span>
                  </div>
                  <div className="text-2xl font-black text-teal-700 dark:text-teal-300 font-mono mt-0.5">
                    {hsk?.approved ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "جاري التنظيف" : "In progress"}
                  </span>
                </div>

                {/* 3. Done */}
                <div className="p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                    <CheckCircle2 className="w-3 h-3" />
                    <span>{ar ? "تم الإنجاز" : "Done"}</span>
                  </div>
                  <div className="text-2xl font-black text-emerald-700 dark:text-emerald-300 font-mono mt-0.5">
                    {hsk?.done ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "غرف نظيفة وجاهزة" : "Cleaned & Ready"}
                  </span>
                </div>

                {/* 4. Urgent */}
                <div className="p-2.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-center">
                  <div className="flex items-center justify-center gap-1 text-[11px] font-bold text-rose-700 dark:text-rose-400">
                    <Flame className="w-3 h-3 text-rose-500" />
                    <span>{ar ? "عاجلة" : "Urgent"}</span>
                  </div>
                  <div className="text-2xl font-black text-rose-700 dark:text-rose-400 font-mono mt-0.5">
                    {hsk?.urgent ?? 0}
                  </div>
                  <span className="text-[9px] text-muted-foreground">
                    {ar ? "طلب فوري" : "Immediate clean"}
                  </span>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-1.5 bg-background/80 p-2.5 rounded-xl border">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-bold text-muted-foreground">
                    {ar ? "نسبة إنجاز طلبات النظافة:" : "Housekeeping Resolution Rate:"}
                  </span>
                  <span className="font-black font-mono text-emerald-600 dark:text-emerald-400">
                    {hsk?.completionRate ?? 0}%
                  </span>
                </div>
                <Progress value={hsk?.completionRate ?? 0} className="h-2 bg-emerald-500/15" />
              </div>

              {/* Recent Tickets Table */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs font-bold text-muted-foreground px-1">
                  <span>{ar ? "أحدث طلبات النظافة الواردة:" : "Recent Housekeeping Orders:"}</span>
                  <Link href={buildNavHref("/maintenance?category=housekeeping")}>
                    <span className="text-emerald-600 dark:text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 text-[11px]">
                      {ar ? "عرض الكل" : "View All"}
                      <ChevronRight className="w-3 h-3" />
                    </span>
                  </Link>
                </div>

                {(!overview?.recentHousekeeping || overview.recentHousekeeping.length === 0) ? (
                  <div className="text-center py-6 border rounded-xl bg-background/50 text-xs text-muted-foreground">
                    {ar ? "لا توجد طلبات نظافة حالياً" : "No housekeeping requests found"}
                  </div>
                ) : (
                  <div className="border rounded-xl bg-background divide-y divide-border/60 overflow-hidden text-xs">
                    {overview.recentHousekeeping.slice(0, 5).map((t) => (
                      <Link
                        key={t.id}
                        href={buildNavHref(`/maintenance?category=housekeeping&ticketId=${t.id}`)}
                        className="p-2.5 flex items-center justify-between gap-2 hover:bg-muted/50 transition-colors block cursor-pointer"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <Badge variant="outline" className="font-mono text-[10px] px-1.5 py-0 shrink-0 font-bold border-emerald-500/30">
                            #{t.roomNumber || t.roomId}
                          </Badge>
                          <div className="truncate">
                            <p className="font-semibold text-foreground truncate text-[11px]">
                              {t.problemType}
                            </p>
                            <span className="text-[10px] text-muted-foreground truncate block">
                              {t.buildingName || "Housing"} • {t.reportedBy || (ar ? "نزيل" : "Resident")}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-1.5 shrink-0">
                          {t.rating ? (
                            <div className="hidden sm:flex items-center gap-0.5">
                              {renderStars(t.rating)}
                            </div>
                          ) : null}
                          {getPriorityBadge(t.priority)}
                          {getStatusBadge(t.status)}
                        </div>
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
