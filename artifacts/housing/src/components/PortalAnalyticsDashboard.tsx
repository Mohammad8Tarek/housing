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

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  const COLORS = ["#3B82F6", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6"];

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
            {ar ? "تحليلات البوابة" : "Portal Analytics"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "مراقبة أداء ومشاركة محتوى البوابة"
              : "Monitor portal content performance and engagement"}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* Period filter */}
          <select
            value={days}
            onChange={(e) => setDays(Number(e.target.value))}
            className="text-sm border rounded-lg px-3 py-1.5 bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {periodOptions.map((o) => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
          {/* View full reports shortcut */}
          {onViewReports && (
            <button
              onClick={onViewReports}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-1.5 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 transition-colors font-medium"
            >
              <MessageSquare className="w-4 h-4" />
              {ar ? "التقارير الكاملة" : "Full Reports"}
            </button>
          )}
        </div>
      </div>

      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{ar ? "الاستبيانات" : "Evaluations"}</span>
              <Award className="w-4 h-4 text-primary" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">
              {analytics?.evaluations?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {ar
                ? `${analytics?.evaluations?.responseRate}% نسبة الاستجابة`
                : `${analytics?.evaluations?.responseRate}% response rate`}
            </p>
            <div className="pt-2">
              <Badge variant="secondary" className="text-xs">
                ⭐ {analytics?.evaluations?.avgRating || 0}
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{ar ? "الفعاليات" : "Activities"}</span>
              <Activity className="w-4 h-4 text-green-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">
              {analytics?.activities?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {ar
                ? `${analytics?.activities?.upcoming} قادمة`
                : `${analytics?.activities?.upcoming} upcoming`}
            </p>
            <div className="pt-2 flex gap-1">
              <Badge variant="outline" className="text-xs flex items-center gap-1">
                <Calendar className="w-3 h-3 text-muted-foreground" />
                <span>{analytics?.activities?.upcoming}</span>
              </Badge>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{ar ? "المستندات" : "Documents"}</span>
              <FileText className="w-4 h-4 text-blue-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">
              {analytics?.documents?.total || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {ar ? "ملفات نشطة" : "Active documents"}
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between text-sm">
              <span>{ar ? "الانخراط" : "Engagement"}</span>
              <Users className="w-4 h-4 text-purple-600" />
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="text-3xl font-bold">
              {analytics?.overview?.totalEngagement || 0}
            </div>
            <p className="text-xs text-muted-foreground">
              {ar ? "إجمالي المحتوى" : "Total content"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Evaluation Ratings Distribution */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {ar ? "توزيع التقييمات" : "Evaluation Ratings"}
            </CardTitle>
            <CardDescription>
              {ar ? "توزيع تقييمات الموظفين" : "Profile rating distribution"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart
                data={Object.entries(
                  analytics?.evaluations?.byCategory || {},
                ).map(([cat, count]) => ({
                  category: cat,
                  count,
                }))}
              >
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="category" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#3B82F6" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Activities by Category */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              {ar ? "الفعاليات حسب التصنيف" : "Activities by Category"}
            </CardTitle>
            <CardDescription>
              {ar ? "توزيع الفعاليات" : "Activity distribution"}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={300}>
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
                  labelLine={false}
                  label={(entry) => `${entry.name}: ${entry.value}`}
                  outerRadius={80}
                  fill="#8884d8"
                  dataKey="value"
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
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>

        {/* Trends — filtered by selected period */}
        {trends && (
          <Card className="lg:col-span-2">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base">
                    {ar ? `الاتجاهات (آخر ${days} يوم)` : `Trends (Last ${days} Days)`}
                  </CardTitle>
                  <CardDescription>
                    {ar
                      ? "نشاط الاستبيانات والفعاليات"
                      : "Evaluation and activity activity"}
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <ResponsiveContainer width="100%" height={300}>
                <LineChart>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#3B82F6"
                    name={ar ? "الاستبيانات" : "Evaluations"}
                    data={trends?.evaluations || []}
                    connectNulls
                  />
                  <Line
                    type="monotone"
                    dataKey="count"
                    stroke="#10B981"
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


