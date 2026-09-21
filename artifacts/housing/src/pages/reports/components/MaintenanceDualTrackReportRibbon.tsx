import { useQuery } from "@tanstack/react-query";
import {
  Wrench,
  Sparkles,
  Clock,
  CheckCircle2,
  AlertTriangle,
  Flame,
  Star,
  Activity,
  ThumbsUp,
  Layers,
  Filter,
} from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { cn } from "@/lib/utils";

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

interface OverviewData {
  maintenance: TrackStats;
  housekeeping: TrackStats;
}

interface MaintenanceDualTrackReportRibbonProps {
  ar: boolean;
  propertyId?: number;
  filterCategory: string;
  setFilterCategory: (cat: string) => void;
  ticketsData?: any[];
}

export function MaintenanceDualTrackReportRibbon({
  ar,
  propertyId,
  filterCategory,
  setFilterCategory,
  ticketsData = [],
}: MaintenanceDualTrackReportRibbonProps) {
  // Query backend summary or calculate from local ticketsData
  const { data: response, isLoading } = useQuery<{ success: boolean; data: OverviewData }>({
    queryKey: ["reports", "maintenance-overview", propertyId],
    queryFn: async () => {
      if (!propertyId) return { success: true, data: getLocalStats(ticketsData) };
      const res = await fetch(`/api/dashboard/tickets-overview?propertyId=${propertyId}`);
      if (!res.ok) return { success: true, data: getLocalStats(ticketsData) };
      return res.json();
    },
    enabled: !!propertyId || ticketsData.length > 0,
    staleTime: 30_000,
  });

  function getLocalStats(list: any[]): OverviewData {
    const calc = (cat: "maintenance" | "housekeeping"): TrackStats => {
      const items = list.filter((t: any) =>
        cat === "housekeeping"
          ? t.category === "housekeeping"
          : t.category !== "housekeeping"
      );
      const total = items.length;
      let open = 0;
      let approved = 0;
      let done = 0;
      let urgent = 0;
      let ratedSum = 0;
      let ratedCount = 0;
      let satisfiedCount = 0;

      items.forEach((t: any) => {
        const st = (t.status || "").toLowerCase();
        const pr = (t.priority || "").toLowerCase();
        if (st === "open" || st.includes("مفتوح")) open++;
        else if (st === "in_progress" || st === "approved" || st.includes("تنفيذ")) approved++;
        else if (st === "resolved" || st === "closed" || st.includes("تم") || st.includes("مكتمل")) done++;

        if (pr === "urgent" || pr === "critical" || pr.includes("عاجل")) urgent++;

        const r = t.rating != null ? Number(t.rating) : null;
        if (r && r > 0) {
          ratedSum += r;
          ratedCount++;
          if (r >= 4) satisfiedCount++;
        }
      });

      const avgRating = ratedCount > 0 ? Number((ratedSum / ratedCount).toFixed(1)) : 0;
      const completionRate = total > 0 ? Math.round((done / total) * 100) : 0;
      const satisfactionRate = ratedCount > 0 ? Math.round((satisfiedCount / ratedCount) * 100) : 0;

      return {
        total,
        open,
        approved,
        done,
        urgent,
        completionRate,
        ratingStats: {
          avgRating,
          totalRated: ratedCount,
          satisfactionRate,
        },
      };
    };

    return {
      maintenance: calc("maintenance"),
      housekeeping: calc("housekeeping"),
    };
  }

  const overview = response?.data || getLocalStats(ticketsData);
  const mnt = overview.maintenance;
  const hsk = overview.housekeeping;

  const totalOverall = (mnt?.total || 0) + (hsk?.total || 0);
  const doneOverall = (mnt?.done || 0) + (hsk?.done || 0);
  const overallCompletion = totalOverall > 0 ? Math.round((doneOverall / totalOverall) * 100) : 0;

  const totalRatedOverall = (mnt?.ratingStats?.totalRated || 0) + (hsk?.ratingStats?.totalRated || 0);
  const overallAvgRating = totalRatedOverall > 0
    ? Number((
        ((mnt?.ratingStats?.avgRating || 0) * (mnt?.ratingStats?.totalRated || 0) +
          (hsk?.ratingStats?.avgRating || 0) * (hsk?.ratingStats?.totalRated || 0)) /
        totalRatedOverall
      ).toFixed(1))
    : 0;

  return (
    <div className="space-y-3.5 mb-2">
      {/* Top Banner Header & Filter Selector */}
      <div className="bg-gradient-to-r from-card via-card to-muted/40 border rounded-xl p-4 shadow-xs flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-primary/10 text-primary shrink-0">
            <Activity className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-base text-foreground">
                {ar ? "المؤشرات التنفيذية المزدوجة للصيانة والهاوس كيبنج" : "Executive Dual-Track Service & Maintenance Hub"}
              </h3>
              <Badge variant="outline" className="text-xs bg-primary/5 text-primary border-primary/20 font-mono">
                {ar ? `${totalOverall} بلاغ كلي` : `${totalOverall} Total Orders`}
              </Badge>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar
                ? "متابعة فورية لأداء الصيانة الهندسية وخدمات النظافة، معدلات الإنجاز وتقييمات رضا النزلاء (الريت)."
                : "Real-time tracking of engineering repairs and housekeeping services, completion metrics, and guest satisfaction ratings."}
            </p>
          </div>
        </div>

        {/* Category Filter Pills */}
        <div className="flex items-center gap-1.5 p-1 bg-muted/70 rounded-lg shrink-0 border">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory("all")}
            className={cn(
              "text-xs font-semibold h-7 px-3 rounded-md transition-all",
              filterCategory === "all" || !filterCategory
                ? "bg-background text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Layers className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            {ar ? "كافة البلاغات" : "All Orders"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory("maintenance")}
            className={cn(
              "text-xs font-semibold h-7 px-3 rounded-md transition-all",
              filterCategory === "maintenance"
                ? "bg-amber-500 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Wrench className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            {ar ? "الصيانة الفنية" : "Maintenance"}
          </Button>

          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setFilterCategory("housekeeping")}
            className={cn(
              "text-xs font-semibold h-7 px-3 rounded-md transition-all",
              filterCategory === "housekeeping"
                ? "bg-sky-500 text-white shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Sparkles className="w-3.5 h-3.5 ltr:mr-1.5 rtl:ml-1.5" />
            {ar ? "الهاوس كيبنج" : "Housekeeping"}
          </Button>
        </div>
      </div>

      {/* The Two Main Tracks Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Track 1: Engineering Maintenance */}
        <Card className={cn(
          "border transition-all shadow-xs relative overflow-hidden",
          filterCategory === "maintenance" ? "ring-2 ring-amber-500 border-amber-300 dark:border-amber-700" : ""
        )}>
          <div className="absolute top-0 ltr:left-0 rtl:right-0 h-1 w-full bg-gradient-to-r from-amber-500 to-amber-600" />
          <CardContent className="p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                  <Wrench className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    {ar ? "شق الصيانة الفنية والأعطال" : "Engineering & Maintenance"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {ar ? "أعمال الكهرباء، السباكة، التكييف، والنجارة" : "HVAC, Plumbing, Electrical, and Furniture repairs"}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200">
                {mnt.total} {ar ? "طلب" : "orders"}
              </Badge>
            </div>

            {/* KPI Counts Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-amber-600 text-[11px] font-medium mb-0.5">
                  <Clock className="w-3 h-3" />
                  <span>{ar ? "مفتوح" : "Open"}</span>
                </div>
                <span className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">
                  {mnt.open}
                </span>
              </div>

              <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-blue-600 text-[11px] font-medium mb-0.5">
                  <Activity className="w-3 h-3" />
                  <span>{ar ? "معتمد/تنفيذ" : "Approved"}</span>
                </div>
                <span className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                  {mnt.approved}
                </span>
              </div>

              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-emerald-600 text-[11px] font-medium mb-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{ar ? "منجز" : "Done"}</span>
                </div>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                  {mnt.done}
                </span>
              </div>

              <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-rose-600 text-[11px] font-medium mb-0.5">
                  <Flame className="w-3 h-3" />
                  <span>{ar ? "عاجل" : "Urgent"}</span>
                </div>
                <span className="text-base font-bold text-rose-700 dark:text-rose-300 font-mono">
                  {mnt.urgent}
                </span>
              </div>
            </div>

            {/* Rating & Completion Ribbon */}
            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-amber-500" />
                  <span className="font-bold text-sm text-foreground font-mono">
                    {mnt.ratingStats?.avgRating ? mnt.ratingStats.avgRating : "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">/ 5</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  ({mnt.ratingStats?.totalRated || 0} {ar ? "تقييم نزلائي" : "rated"})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{ar ? "نسبة الإنجاز:" : "Completion:"}</span>
                <span className="font-bold font-mono text-emerald-600">
                  {mnt.completionRate}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Track 2: Housekeeping & Cleaning */}
        <Card className={cn(
          "border transition-all shadow-xs relative overflow-hidden",
          filterCategory === "housekeeping" ? "ring-2 ring-sky-500 border-sky-300 dark:border-sky-700" : ""
        )}>
          <div className="absolute top-0 ltr:left-0 rtl:right-0 h-1 w-full bg-gradient-to-r from-sky-500 to-sky-600" />
          <CardContent className="p-4 space-y-3.5">
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    {ar ? "شق الهاوس كيبنج والنظافة" : "Housekeeping & Room Service"}
                  </h4>
                  <p className="text-[11px] text-muted-foreground">
                    {ar ? "نظافة الغرف، تغيير المفروشات، وتجهيز الغرف الشاغرة" : "Room cleaning, linen turnover, and amenities replenishments"}
                  </p>
                </div>
              </div>
              <Badge variant="outline" className="font-mono text-xs font-bold bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200">
                {hsk.total} {ar ? "طلب" : "orders"}
              </Badge>
            </div>

            {/* KPI Counts Grid */}
            <div className="grid grid-cols-4 gap-2 text-center">
              <div className="bg-amber-50/60 dark:bg-amber-950/20 border border-amber-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-amber-600 text-[11px] font-medium mb-0.5">
                  <Clock className="w-3 h-3" />
                  <span>{ar ? "مفتوح" : "Open"}</span>
                </div>
                <span className="text-base font-bold text-amber-700 dark:text-amber-300 font-mono">
                  {hsk.open}
                </span>
              </div>

              <div className="bg-blue-50/60 dark:bg-blue-950/20 border border-blue-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-blue-600 text-[11px] font-medium mb-0.5">
                  <Activity className="w-3 h-3" />
                  <span>{ar ? "معتمد/تنفيذ" : "Approved"}</span>
                </div>
                <span className="text-base font-bold text-blue-700 dark:text-blue-300 font-mono">
                  {hsk.approved}
                </span>
              </div>

              <div className="bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-emerald-600 text-[11px] font-medium mb-0.5">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>{ar ? "منجز" : "Done"}</span>
                </div>
                <span className="text-base font-bold text-emerald-700 dark:text-emerald-300 font-mono">
                  {hsk.done}
                </span>
              </div>

              <div className="bg-rose-50/60 dark:bg-rose-950/20 border border-rose-200/60 rounded-lg p-2">
                <div className="flex items-center justify-center gap-1 text-rose-600 text-[11px] font-medium mb-0.5">
                  <Flame className="w-3 h-3" />
                  <span>{ar ? "عاجل" : "Urgent"}</span>
                </div>
                <span className="text-base font-bold text-rose-700 dark:text-rose-300 font-mono">
                  {hsk.urgent}
                </span>
              </div>
            </div>

            {/* Rating & Completion Ribbon */}
            <div className="flex items-center justify-between pt-2 border-t text-xs">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1 text-amber-500">
                  <Star className="w-4 h-4 fill-amber-500" />
                  <span className="font-bold text-sm text-foreground font-mono">
                    {hsk.ratingStats?.avgRating ? hsk.ratingStats.avgRating : "—"}
                  </span>
                  <span className="text-[11px] text-muted-foreground">/ 5</span>
                </div>
                <span className="text-[11px] text-muted-foreground">
                  ({hsk.ratingStats?.totalRated || 0} {ar ? "تقييم نزلائي" : "rated"})
                </span>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-[11px] text-muted-foreground">{ar ? "نسبة الإنجاز:" : "Completion:"}</span>
                <span className="font-bold font-mono text-emerald-600">
                  {hsk.completionRate}%
                </span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
