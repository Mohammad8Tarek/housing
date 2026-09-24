import { useState, useMemo, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { printLuxuryReport } from "../utils/luxury-report-engine";
import {
  HeartHandshake,
  Star,
  Smile,
  Meh,
  Frown,
  Download,
  Printer,
  Calendar,
  Building2,
  Lock,
  Search,
  CheckCircle2,
  TrendingUp,
  MessageSquare,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { formatDate } from "@/lib/date-utils";
import { DataPagination } from "@/components/DataPagination";

interface HousingRatingsTabProps {
  ar: boolean;
  activePropertyId?: number | string | null;
  properties?: any[];
  onRegisterExport?: (actions: { exportExcel?: () => void; exportPDF?: () => void }) => void;
}

export function HousingRatingsTab({
  ar,
  activePropertyId,
  properties = [],
  onRegisterExport,
}: HousingRatingsTabProps) {
  const [selectedProp, setSelectedProp] = useState<string>(
    activePropertyId && activePropertyId !== "all" ? String(activePropertyId) : "all"
  );
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchComment, setSearchComment] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const queryPropertyId = selectedProp !== "all" ? selectedProp : (activePropertyId && activePropertyId !== "all" ? String(activePropertyId) : "all");

  const { data: responseData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ["housing-ratings-report", queryPropertyId, ratingFilter, fromDate, toDate, currentPage, pageSize],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryPropertyId && queryPropertyId !== "all") params.append("propertyId", queryPropertyId);
      if (ratingFilter && ratingFilter !== "all") params.append("rating", ratingFilter);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      params.append("page", String(currentPage));
      params.append("limit", String(pageSize));

      const res = await fetch(`/api/reports/housing-ratings?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch housing ratings report");
      }
      return res.json();
    },
  });

  const stats = responseData?.stats || {
    totalRatings: 0,
    satisfiedCount: 0,
    neutralCount: 0,
    dissatisfiedCount: 0,
    satisfiedPct: 0,
    neutralPct: 0,
    dissatisfiedPct: 0,
    satisfactionRate: 0,
    averageScore: 0,
    commentsCount: 0,
  };

  const propertyBreakdown: any[] = responseData?.propertyBreakdown || [];
  const commentsList: any[] = responseData?.comments || [];
  const allCommentsList: any[] = responseData?.allComments || [];

  const filteredComments = useMemo(() => {
    if (!searchComment.trim()) return commentsList;
    const s = searchComment.toLowerCase().trim();
    return commentsList.filter(
      (c) =>
        (c.comment && c.comment.toLowerCase().includes(s)) ||
        (c.propertyName && c.propertyName.toLowerCase().includes(s))
    );
  }, [commentsList, searchComment]);

  const handleExportExcel = () => {
    const rowsToExport = allCommentsList.length > 0 ? allCommentsList : commentsList;
    const excelRows = rowsToExport.map((r: any, idx: number) => ({
      "#": idx + 1,
      [ar ? "السكن / الفندق" : "Property"]: r.propertyName || "-",
      [ar ? "التقييم" : "Rating"]:
        r.rating === "satisfied"
          ? ar ? "راضي" : "Satisfied"
          : r.rating === "neutral"
          ? ar ? "متوسط" : "Neutral"
          : ar ? "غير راضي" : "Dissatisfied",
      [ar ? "الدرجة (من 5)" : "Score (out of 5)"]: r.score || "-",
      [ar ? "الملاحظة / المقترح (سري ومجهول)" : "Feedback / Comment (Anonymous)"]: r.comment || "-",
      [ar ? "تاريخ التقييم" : "Date"]: formatDate(r.createdAt),
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Housing Pulse Ratings");

    const propName = properties.find((p) => String(p.id) === String(queryPropertyId))?.name || "All_Properties";
    XLSX.writeFile(wb, `Housing_Pulse_Ratings_${propName}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  const handlePrintReport = () => {
    const propName =
      queryPropertyId !== "all"
        ? properties.find((p) => String(p.id) === String(queryPropertyId))?.name || `Property #${queryPropertyId}`
        : ar ? "كافة الفنادق والسكنات" : "All Properties";

    const rows = (allCommentsList.length > 0 ? allCommentsList : commentsList).map((r: any, idx: number) => [
      String(idx + 1),
      r.propertyName || "-",
      r.rating === "satisfied"
        ? ar ? "راضي" : "Satisfied"
        : r.rating === "neutral"
        ? ar ? "متوسط" : "Neutral"
        : ar ? "غير راضي" : "Dissatisfied",
      `${r.score} / 5`,
      r.comment || "-",
      formatDate(r.createdAt),
    ]);

    printLuxuryReport({
      activeTab: "housing_ratings",
      title: ar ? "تقرير استطلاع جودة السكن الأسبوعي (سري تماماً)" : "Weekly Housing Quality Pulse Report (Anonymous)",
      subtitle: ar
        ? `نتائج قياس رضا الموظفين الدوري عن جودة السكن والخدمات - ${propName}`
        : `Periodic staff housing satisfaction metrics & anonymous feedback - ${propName}`,
      language: ar ? "ar" : "en",
      properties,
      activePropertyId: queryPropertyId !== "all" ? queryPropertyId : (activePropertyId ?? undefined),
      kpiCards: [
        { label: ar ? "إجمالي التقييمات" : "Total Ratings", value: stats.totalRatings, color: "blue" },
        { label: ar ? "نسبة الرضا العامة" : "Satisfaction Rate", value: `${stats.satisfactionRate}%`, color: "green" },
        { label: ar ? "متوسط التقييم" : "Average Score", value: `${stats.averageScore} / 5`, color: "gold" },
        { label: ar ? "عدد الملاحظات المكتوبة" : "Written Comments", value: stats.commentsCount, color: "purple" },
      ],
      headers: [
        "#",
        ar ? "السكن" : "Property",
        ar ? "التقييم" : "Rating",
        ar ? "الدرجة" : "Score",
        ar ? "الملاحظة (سرية ومجهولة)" : "Feedback / Comment",
        ar ? "التاريخ" : "Date",
      ],
      rows,
    });
  };

  useEffect(() => {
    if (onRegisterExport) {
      onRegisterExport({
        exportExcel: handleExportExcel,
        exportPDF: handlePrintReport,
      });
    }
  }, [onRegisterExport, allCommentsList, commentsList, queryPropertyId, ar, stats]);

  const resetFilters = () => {
    setSelectedProp("all");
    setRatingFilter("all");
    setFromDate("");
    setToDate("");
    setSearchComment("");
    setCurrentPage(1);
  };

  return (
    <div className="space-y-6">
      {/* ── TOP KPI METRIC CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Overall Satisfaction */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "نسبة الرضا العامة" : "Satisfaction Rate"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <HeartHandshake className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-foreground flex items-baseline gap-2">
              <span>{stats.satisfactionRate}%</span>
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400 flex items-center gap-0.5">
                <Smile className="w-3.5 h-3.5" />
                {stats.satisfiedCount} {ar ? "راضي" : "Satisfied"}
              </span>
            </div>
            <Progress value={stats.satisfactionRate} className="h-2 mt-3 bg-muted" />
          </div>
        </div>

        {/* KPI 2: Average Score */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "متوسط التقييم العام" : "Average Score"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <Star className="w-5 h-5 fill-amber-400 text-amber-500" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-foreground flex items-baseline gap-1.5">
              <span>{stats.averageScore}</span>
              <span className="text-sm font-medium text-muted-foreground">/ 5.0</span>
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <TrendingUp className="w-3.5 h-3.5 text-amber-500" />
              <span>{ar ? "مقياس جودة السكن الأسبوعي" : "Weekly Housing Quality Index"}</span>
            </p>
          </div>
        </div>

        {/* KPI 3: Total Submissions */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "إجمالي التقييمات المستلمة" : "Total Ratings"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-foreground">
              {stats.totalRatings}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Lock className="w-3.5 h-3.5 text-muted-foreground/70" />
              <span>{ar ? "تحديث تلقائي كل 7 أيام" : "Auto-recurring every 7 days"}</span>
            </p>
          </div>
        </div>

        {/* KPI 4: Feedback Comments Count */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "الملاحظات والمقترحات" : "Written Feedback"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center">
              <MessageSquare className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-foreground">
              {stats.commentsCount}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-purple-500" />
              <span>{ar ? "ملاحظات سرية لتحسين الخدمات" : "Anonymous suggestions for improvement"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── SATISFACTION DISTRIBUTION BREAKDOWN BAR ── */}
      <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
            <span>{ar ? "توزيع نسب الرضا (استطلاع الـ 7 أيام)" : "Satisfaction Distribution (7-Day Pulse)"}</span>
          </h3>
          <span className="text-xs text-muted-foreground font-mono">
            {stats.totalRatings} {ar ? "مشارك" : "responses"}
          </span>
        </div>

        <div className="h-4 w-full rounded-full overflow-hidden flex bg-muted">
          {stats.satisfiedPct > 0 && (
            <div
              style={{ width: `${stats.satisfiedPct}%` }}
              className="bg-emerald-500 transition-all duration-500"
              title={`${ar ? "راضي" : "Satisfied"}: ${stats.satisfiedCount} (${stats.satisfiedPct}%)`}
            />
          )}
          {stats.neutralPct > 0 && (
            <div
              style={{ width: `${stats.neutralPct}%` }}
              className="bg-amber-500 transition-all duration-500"
              title={`${ar ? "متوسط" : "Neutral"}: ${stats.neutralCount} (${stats.neutralPct}%)`}
            />
          )}
          {stats.dissatisfiedPct > 0 && (
            <div
              style={{ width: `${stats.dissatisfiedPct}%` }}
              className="bg-rose-500 transition-all duration-500"
              title={`${ar ? "غير راضي" : "Dissatisfied"}: ${stats.dissatisfiedCount} (${stats.dissatisfiedPct}%)`}
            />
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 pt-1 text-center text-xs">
          <div className="p-2 rounded-xl bg-emerald-500/10 border border-emerald-500/20">
            <div className="font-bold text-emerald-700 dark:text-emerald-300 flex items-center justify-center gap-1">
              <Smile className="w-3.5 h-3.5" />
              <span>{ar ? "راضي" : "Satisfied"}</span>
            </div>
            <div className="text-sm font-extrabold text-foreground mt-0.5">
              {stats.satisfiedCount} ({stats.satisfiedPct}%)
            </div>
          </div>

          <div className="p-2 rounded-xl bg-amber-500/10 border border-amber-500/20">
            <div className="font-bold text-amber-700 dark:text-amber-300 flex items-center justify-center gap-1">
              <Meh className="w-3.5 h-3.5" />
              <span>{ar ? "متوسط" : "Neutral"}</span>
            </div>
            <div className="text-sm font-extrabold text-foreground mt-0.5">
              {stats.neutralCount} ({stats.neutralPct}%)
            </div>
          </div>

          <div className="p-2 rounded-xl bg-rose-500/10 border border-rose-500/20">
            <div className="font-bold text-rose-700 dark:text-rose-300 flex items-center justify-center gap-1">
              <Frown className="w-3.5 h-3.5" />
              <span>{ar ? "غير راضي" : "Dissatisfied"}</span>
            </div>
            <div className="text-sm font-extrabold text-foreground mt-0.5">
              {stats.dissatisfiedCount} ({stats.dissatisfiedPct}%)
            </div>
          </div>
        </div>
      </div>

      {/* ── PROPERTY BREAKDOWN COMPARISON ── */}
      {propertyBreakdown.length > 0 && (
        <div className="rounded-2xl border bg-card p-5 shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="w-4 h-4 text-primary" />
              <span>{ar ? "مقارنة مستويات الرضا بين السكنات والفنادق" : "Property Satisfaction Benchmark"}</span>
            </h3>
          </div>

          <div className="overflow-x-auto rounded-xl border">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="font-bold">{ar ? "السكن / الخاصية" : "Property"}</TableHead>
                  <TableHead className="text-center font-bold">{ar ? "إجمالي التقييمات" : "Total Ratings"}</TableHead>
                  <TableHead className="text-center font-bold text-emerald-600 dark:text-emerald-400">{ar ? "راضي" : "Satisfied"}</TableHead>
                  <TableHead className="text-center font-bold text-amber-600 dark:text-amber-400">{ar ? "متوسط" : "Neutral"}</TableHead>
                  <TableHead className="text-center font-bold text-rose-600 dark:text-rose-400">{ar ? "غير راضي" : "Dissatisfied"}</TableHead>
                  <TableHead className="text-center font-bold">{ar ? "متوسط الدرجة" : "Avg Score"}</TableHead>
                  <TableHead className="font-bold">{ar ? "مؤشر الرضا" : "Satisfaction Index"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {propertyBreakdown.map((pb) => (
                  <TableRow key={pb.propertyId}>
                    <TableCell className="font-bold text-foreground flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-primary" />
                      <span>{pb.propertyName}</span>
                    </TableCell>
                    <TableCell className="text-center font-mono font-medium">{pb.total}</TableCell>
                    <TableCell className="text-center font-medium text-emerald-600 dark:text-emerald-400">
                      {pb.satisfied} ({pb.total > 0 ? Math.round((pb.satisfied / pb.total) * 100) : 0}%)
                    </TableCell>
                    <TableCell className="text-center font-medium text-amber-600 dark:text-amber-400">
                      {pb.neutral} ({pb.total > 0 ? Math.round((pb.neutral / pb.total) * 100) : 0}%)
                    </TableCell>
                    <TableCell className="text-center font-medium text-rose-600 dark:text-rose-400">
                      {pb.dissatisfied} ({pb.total > 0 ? Math.round((pb.dissatisfied / pb.total) * 100) : 0}%)
                    </TableCell>
                    <TableCell className="text-center font-bold">
                      <Badge variant="outline" className="font-mono bg-amber-500/10 text-amber-600 border-amber-300">
                        {pb.averageScore} / 5
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Progress value={pb.satisfactionRate} className="h-2 w-24" />
                        <span className="text-xs font-bold">{pb.satisfactionRate}%</span>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      )}

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 flex-1">
            {/* Property Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "تصفية بالسكن" : "Filter Property"}
              </Label>
              <Select value={selectedProp} onValueChange={(val) => { setSelectedProp(val); setCurrentPage(1); }}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder={ar ? "كافة السكنات" : "All Properties"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كافة السكنات والفنادق" : "All Properties"}</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.displayName || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Rating Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "تصفية بالتقييم" : "Filter Rating"}
              </Label>
              <Select value={ratingFilter} onValueChange={(val) => { setRatingFilter(val); setCurrentPage(1); }}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder={ar ? "كافة التقييمات" : "All Ratings"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كافة التقييمات" : "All Ratings"}</SelectItem>
                  <SelectItem value="satisfied">{ar ? "راضي فقط" : "Satisfied Only"}</SelectItem>
                  <SelectItem value="neutral">{ar ? "متوسط فقط" : "Neutral Only"}</SelectItem>
                  <SelectItem value="dissatisfied">{ar ? "غير راضي فقط" : "Dissatisfied Only"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "من تاريخ" : "From Date"}
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
                className="text-xs h-9"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "إلى تاريخ" : "To Date"}
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-xs h-9"
              title={ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
            >
              <RefreshCw className="w-3.5 h-3.5 me-1" />
              <span>{ar ? "إعادة ضبط" : "Reset"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="text-xs h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Download className="w-3.5 h-3.5 me-1" />
              <span>{ar ? "تصدير إكسيل" : "Excel"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              className="text-xs h-9 bg-primary/5 text-primary hover:bg-primary/10 border-primary/30"
            >
              <Printer className="w-3.5 h-3.5 me-1" />
              <span>{ar ? "طباعة فاخرة (PDF)" : "Print PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Search in comments */}
        <div className="relative">
          <Search className="w-4 h-4 absolute start-3 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            value={searchComment}
            onChange={(e) => setSearchComment(e.target.value)}
            placeholder={
              ar
                ? "ابحث في نصوص الملاحظات والمقترحات المكتوبة من الموظفين..."
                : "Search written resident feedback and comments..."
            }
            className="text-xs ps-9 h-9"
          />
        </div>
      </div>

      {/* ── ANONYMOUS COMMENTS FEED TABLE ── */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <MessageSquare className="w-4 h-4 text-primary" />
              <span>{ar ? "سجل التقييمات والملاحظات المجهولة (سرية الموظفين 100%)" : "Anonymous Feedback & Comments Stream"}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1.5">
              <Lock className="w-3 h-3 text-muted-foreground/70" />
              <span>
                {ar
                  ? "يتم تشفير وتجهيل هوية الموظف والغرفة بالكامل لتشجيع الصراحة التامة."
                  : "All resident IDs, names, and room numbers are strictly masked for confidentiality."}
              </span>
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {stats.commentsCount} {ar ? "ملاحظة مسجلة" : "written comments"}
          </span>
        </div>

        {filteredComments.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
            <MessageSquare className="w-8 h-8 mx-auto opacity-30" />
            <p>{ar ? "لا توجد تقييمات تطابق معايير البحث الحالية." : "No ratings found matching current filters."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-14 text-center font-bold">#</TableHead>
                  <TableHead className="w-40 font-bold">{ar ? "السكن" : "Property"}</TableHead>
                  <TableHead className="w-32 text-center font-bold">{ar ? "التقييم" : "Rating"}</TableHead>
                  <TableHead className="w-24 text-center font-bold">{ar ? "الدرجة" : "Score"}</TableHead>
                  <TableHead className="font-bold">{ar ? "الملاحظة / المقترح المكتوب" : "Resident Feedback"}</TableHead>
                  <TableHead className="w-32 text-end font-bold">{ar ? "التاريخ" : "Date"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComments.map((r: any, idx: number) => {
                  const isSatisfied = r.rating === "satisfied";
                  const isNeutral = r.rating === "neutral";

                  return (
                    <TableRow key={r.id || idx} className="hover:bg-muted/30">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </TableCell>
                      <TableCell className="text-xs font-semibold">
                        <Badge variant="outline" className="font-normal text-xs bg-background">
                          {r.propertyName}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        {isSatisfied ? (
                          <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 font-medium text-[11px] gap-1">
                            <Smile className="w-3 h-3" />
                            <span>{ar ? "راضي" : "Satisfied"}</span>
                          </Badge>
                        ) : isNeutral ? (
                          <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 font-medium text-[11px] gap-1">
                            <Meh className="w-3 h-3" />
                            <span>{ar ? "متوسط" : "Neutral"}</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 font-medium text-[11px] gap-1">
                            <Frown className="w-3 h-3" />
                            <span>{ar ? "غير راضي" : "Dissatisfied"}</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-bold text-foreground">
                        {r.score} / 5
                      </TableCell>
                      <TableCell className="text-xs">
                        {r.comment ? (
                          <div className="p-2.5 rounded-xl bg-muted/40 border border-border/50 text-foreground leading-relaxed italic">
                            "{r.comment}"
                          </div>
                        ) : (
                          <span className="text-muted-foreground italic text-[11px]">
                            {ar ? "بدون ملاحظة مكتوبة" : "No written comment"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatDate(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Pagination */}
        <div className="p-3 border-t bg-muted/10">
          <DataPagination
            total={stats.commentsCount || stats.totalRatings}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
          />
        </div>
      </div>
    </div>
  );
}
