import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  BarChart,
  Bar,
  LineChart,
  Line,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from "recharts";
import {
  TrendingUp,
  Users,
  FileText,
  Award,
  Activity,
  MessageSquare,
  Calendar,
} from "lucide-react";
import { DashboardKpiCard } from "@/pages/dashboard/components/DashboardKpiCard";

export default function PortalAnalyticsDashboard({ onViewReports }: { onViewReports?: () => void } = {}) {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const [days, setDays] = useState(30);

  const { data: analytics, isLoading } = useQuery({
    queryKey: ["portal-analytics", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-analytics?propertyId=${activePropertyId}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch analytics");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const { data: trends } = useQuery({
    queryKey: ["portal-trends", activePropertyId, days],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-analytics/trends?propertyId=${activePropertyId}&days=${days}`,
        { credentials: "include" },
      );
      if (!res.ok) throw new Error("Failed to fetch trends");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  if (isLoading) return <Skeleton className="h-96 w-full rounded-2xl" />;

  const COLORS = ["#6366F1", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

  const periodOptions = [
    { value: 7,   label: ar ? "آخر 7 أيام"  : "Last 7 days" },
    { value: 30,  label: ar ? "آخر 30 يوم"  : "Last 30 days" },
    { value: 90,  label: ar ? "آخر 90 يوم"  : "Last 90 days" },
    { value: 180, label: ar ? "آخر 6 أشهر"  : "Last 6 months" },
    { value: 365, label: ar ? "هذه السنة"   : "This year" },
  ];

  return (
    <div className="space-y-6">
      {/* Header + controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <TrendingUp className="w-6 h-6 text-primary" />
            {ar ? "تحليلات البوابة التفاعلية" : "Portal Analytics Dashboard"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "مراقبة مؤشرات التفاعل ونشاط الموظفين والفعاليات في البوابة"
              : "Monitor staff portal interaction, event enrollments, and content reach"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period filter */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-xs sm:text-sm font-semibold border border-border/60 rounded-xl px-3 py-1.5 bg-card text-foreground shadow-xs focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {/* View full reports shortcut */}
          {onViewReports && (
            <button
              onClick={onViewReports}
              className="inline-flex items-center gap-1.5 text-xs sm:text-sm px-3.5 py-1.5 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-bold shadow-xs"
            >
              <MessageSquare className="w-4 h-4" />
              {ar ? "التقارير الشاملة" : "Full Reports"}
            </button>
          )}
        </div>
      </div>

      {/* Modern Executive KPI Metrics */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <DashboardKpiCard
          title={ar ? "الاستبيانات والتقييمات" : "Evaluations"}
          value={analytics?.evaluations?.total || 0}
          sub={ar ? `${analytics?.evaluations?.responseRate || 0}% نسبة الاستجابة · ⭐ ${analytics?.evaluations?.avgRating || 0}` : `${analytics?.evaluations?.responseRate || 0}% response rate · ⭐ ${analytics?.evaluations?.avgRating || 0}`}
          icon={Award}
          color="text-primary"
          bg="bg-primary/10"
          delta={{ value: `${analytics?.evaluations?.responseRate || 0}%`, isPositive: (analytics?.evaluations?.responseRate || 0) >= 50 }}
          sparklineData={[5, 8, 12, 10, 15, 18, analytics?.evaluations?.total || 20]}
        />
        <DashboardKpiCard
          title={ar ? "الفعاليات والأنشطة" : "Portal Activities"}
          value={analytics?.activities?.total || 0}
          sub={ar ? `${analytics?.activities?.upcoming || 0} فعالية قادمة` : `${analytics?.activities?.upcoming || 0} upcoming events`}
          icon={Activity}
          color="text-emerald-600 dark:text-emerald-400"
          bg="bg-emerald-500/10"
          delta={{ value: `${analytics?.activities?.upcoming || 0} قادمة`, isPositive: true }}
          sparklineData={[2, 3, 4, 3, 5, 6, analytics?.activities?.total || 7]}
        />
        <DashboardKpiCard
          title={ar ? "المستندات المنشورة" : "Portal Documents"}
          value={analytics?.documents?.total || 0}
          sub={ar ? "ملفات ولوائح نشطة" : "Active guidelines & files"}
          icon={FileText}
          color="text-blue-600 dark:text-blue-400"
          bg="bg-blue-500/10"
          delta={{ value: "+2", isPositive: true }}
          sparklineData={[10, 12, 14, 15, 18, 20, analytics?.documents?.total || 22]}
        />
        <DashboardKpiCard
          title={ar ? "الانخراط والمشاركة" : "Total Engagement"}
          value={analytics?.overview?.totalEngagement || 0}
          sub={ar ? "تفاعلات الموظفين الإجمالية" : "Total staff content interactions"}
          icon={Users}
          color="text-purple-600 dark:text-purple-400"
          bg="bg-purple-500/10"
          delta={{ value: "+8.5%", isPositive: true }}
          sparklineData={[40, 55, 65, 70, 85, 95, analytics?.overview?.totalEngagement || 110]}
        />
      </div>

      {/* Modernized Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evaluation Ratings Distribution */}
        <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Award className="w-4 h-4 text-primary" />
              {ar ? "توزيع التقييمات حسب الفئة" : "Evaluation Ratings by Category"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar ? "متوسط تقييمات الموظفين لمرافق السكن" : "Staff satisfaction distribution across housing services"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart
                data={Object.entries(
                  analytics?.evaluations?.byCategory || {},
                ).map(([cat, count]) => ({
                  category: cat,
                  count,
                }))}
                margin={{ top: 10, right: 10, left: -10, bottom: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                <XAxis dataKey="category" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Bar dataKey="count" name={ar ? "العدد" : "Count"} fill="hsl(var(--primary))" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activities by Category */}
        <Card className="bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
          <CardHeader>
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Activity className="w-4 h-4 text-emerald-500" />
              {ar ? "الفعاليات حسب التصنيف" : "Activities by Category"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar ? "توزيع الأنشطة الرياضية والاجتماعية والترفيهية" : "Categorical spread of employee events"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={280}>
              <PieChart>
                <Pie
                  data={Object.entries(
                    analytics?.activities?.byCategory || {},
                  ).map(([cat, count]) => ({
                    name: cat,
                    value: count,
                  }))}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={85}
                  paddingAngle={3}
                  dataKey="value"
                  stroke="none"
                >
                  {Object.entries(analytics?.activities?.byCategory || {}).map(
                    (_, index) => (
                      <Cell
                        key={`cell-${index}`}
                        fill={COLORS[index % COLORS.length]}
                      />
                    ),
                  )}
                </Pie>
                <Tooltip
                  contentStyle={{
                    backgroundColor: "hsl(var(--card))",
                    borderColor: "hsl(var(--border))",
                    borderRadius: "12px",
                    fontSize: "12px",
                  }}
                />
                <Legend />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trends — filtered by selected period */}
        {trends && (
          <Card className="lg:col-span-2 bg-card/75 backdrop-blur-xl border-border/50 shadow-xl overflow-hidden">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-primary" />
                    {ar ? `المسار التفاعلي (آخر ${days} يوم)` : `Engagement Trajectory (Last ${days} Days)`}
                  </CardTitle>
                  <CardDescription className="text-xs">
                    {ar
                      ? "متابعة تطور مشاركة الاستبيانات والأنشطة عبر الزمن"
                      : "Progression of evaluations and events over time"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart margin={{ top: 10, right: 10, left: -10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="hsl(var(--border))" />
                  <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={12} tickLine={false} axisLine={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: "hsl(var(--card))",
                      borderColor: "hsl(var(--border))",
                      borderRadius: "12px",
                      fontSize: "12px",
                    }}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#6366F1"
                    strokeWidth={2.5}
                    name={ar ? "الاستبيانات" : "Evaluations"}
                    data={trends?.evaluations || []}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10B981"
                    strokeWidth={2.5}
                    name={ar ? "الفعاليات" : "Activities"}
                    data={trends?.activities || []}
                    connectNulls
                  />
                </LineChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
