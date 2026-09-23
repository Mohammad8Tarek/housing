// @ts-nocheck
import { useState, useMemo, useEffect } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/date-utils";
import { toast } from "sonner";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { printLuxuryReport } from "@/pages/reports/utils/luxury-report-engine";
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
  Send,
  Settings2,
  Bell,
  Clock,
  Radio,
  Sliders,
  AlertCircle,
  HelpCircle,
  FileSpreadsheet,
  Users,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { DataPagination } from "@/components/DataPagination";

export function HousingPulseSection() {
  const { activePropertyId, properties } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  // Filters & Pagination State
  const [ratingFilter, setRatingFilter] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchComment, setSearchComment] = useState<string>("");
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  // Dialogs State
  const [isConfigOpen, setIsConfigOpen] = useState(false);
  const [isPushConfirmOpen, setIsPushConfirmOpen] = useState(false);

  // Configuration Form State
  const [configForm, setConfigForm] = useState({
    enabled: true,
    ratingType: "faces", // 'faces' | 'stars'
    allowComment: true,
    commentRequired: false,
    cooldownDays: 7,
    titleAr: "استطلاع جودة السكن الأسبوعي",
    titleEn: "Weekly Housing Quality Pulse",
    questionAr: "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟",
    questionEn: "How satisfied are you with housing conditions, cleanliness & services this week?",
  });

  // Fetch Housing Pulse Configuration
  const { data: configData, isLoading: isConfigLoading } = useQuery({
    queryKey: ["housing-pulse-config", activePropertyId],
    queryFn: async () => {
      const res = await fetch(`/api/evaluations/housing-pulse?propertyId=${activePropertyId}`);
      if (!res.ok) throw new Error("Failed to load pulse configuration");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  // Sync form when configData changes
  useEffect(() => {
    if (configData?.config) {
      const c = configData.config;
      setConfigForm({
        enabled: c.enabled ?? true,
        ratingType: c.ratingType || "faces",
        allowComment: c.allowComment ?? true,
        commentRequired: c.commentRequired ?? false,
        cooldownDays: c.cooldownDays ?? 7,
        titleAr: c.titleAr || "استطلاع جودة السكن الأسبوعي",
        titleEn: c.titleEn || "Weekly Housing Quality Pulse",
        questionAr: c.questionAr || "ما مدى رضاك عن مستوى السكن ونظافته وخدماته هذا الأسبوع؟",
        questionEn: c.questionEn || "How satisfied are you with housing conditions, cleanliness & services this week?",
      });
    }
  }, [configData]);

  // Fetch Housing Ratings Report (Stats & Comments)
  const {
    data: reportData,
    isLoading: isReportLoading,
    refetch: refetchReport,
    isFetching: isReportFetching,
  } = useQuery({
    queryKey: [
      "housing-ratings-report",
      activePropertyId,
      ratingFilter,
      fromDate,
      toDate,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activePropertyId && activePropertyId !== "all") {
        params.append("propertyId", String(activePropertyId));
      }
      if (ratingFilter && ratingFilter !== "all") params.append("rating", ratingFilter);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      params.append("page", String(currentPage));
      params.append("limit", String(pageSize));

      const res = await fetch(`/api/reports/housing-ratings?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch housing ratings report");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  // Save Configuration Mutation
  const saveConfigMutation = useMutation({
    mutationFn: async (payload: typeof configForm) => {
      const res = await fetch("/api/evaluations/housing-pulse", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...payload,
          propertyId: activePropertyId,
        }),
      });
      if (!res.ok) throw new Error("Failed to update configuration");
      return res.json();
    },
    onSuccess: () => {
      toast.success(
        ar ? "تم حفظ إعدادات استطلاع السكن بنجاح" : "Housing pulse configuration saved successfully"
      );
      queryClient.invalidateQueries({ queryKey: ["housing-pulse-config", activePropertyId] });
      setIsConfigOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || (ar ? "فشل حفظ الإعدادات" : "Failed to save configuration"));
    },
  });

  // Push Survey Mutation
  const pushSurveyMutation = useMutation({
    mutationFn: async () => {
      const res = await fetch("/api/evaluations/housing-pulse/push", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ propertyId: activePropertyId }),
      });
      if (!res.ok) throw new Error("Failed to push survey");
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        ar
          ? `تم إرسال الاستطلاع فوراً إلى ${data.activeResidentsCount || 0} موظف مقيم بالسكن!`
          : `Survey pushed immediately to ${data.activeResidentsCount || 0} active in-house residents!`
      );
      queryClient.invalidateQueries({ queryKey: ["housing-pulse-config", activePropertyId] });
      setIsPushConfirmOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || (ar ? "فشل إرسال الاستطلاع" : "Failed to push survey"));
    },
  });

  const stats = reportData?.stats || {
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

  const commentsList: any[] = reportData?.comments || [];
  const allCommentsList: any[] = reportData?.allComments || [];
  const pagination = reportData?.pagination || {
    page: 1,
    limit: pageSize,
    total: 0,
    totalPages: 1,
  };

  const filteredComments = useMemo(() => {
    if (!searchComment.trim()) return commentsList;
    const s = searchComment.toLowerCase().trim();
    return commentsList.filter(
      (c) =>
        (c.comment && c.comment.toLowerCase().includes(s)) ||
        (c.propertyName && c.propertyName.toLowerCase().includes(s))
    );
  }, [commentsList, searchComment]);

  // Export to Excel
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
    XLSX.utils.book_append_sheet(wb, ws, "Housing Pulse");

    const currentPropName =
      properties?.find((p) => String(p.id) === String(activePropertyId))?.name || "Property";
    const dateStr = new Date().toISOString().split("T")[0];
    XLSX.writeFile(wb, `Housing_Pulse_${currentPropName}_${dateStr}.xlsx`);
    toast.success(ar ? "تم تصدير ملف الإكسل بنجاح" : "Excel file exported successfully");
  };

  // Print Luxury PDF Report
  const handlePrintReport = () => {
    const currentPropName =
      properties?.find((p) => String(p.id) === String(activePropertyId))?.name || `Property #${activePropertyId}`;

    printLuxuryReport({
      activeTab: "housing_ratings",
      title: ar ? "تقرير استطلاع جودة السكن الدوري (سري تماماً)" : "Housing Quality Pulse Report (Anonymous)",
      subtitle: ar
        ? `نتائج قياس رضا الموظفين الدوري عن جودة السكن والخدمات - ${currentPropName}`
        : `Periodic staff housing satisfaction metrics & anonymous feedback - ${currentPropName}`,
      language: ar ? "ar" : "en",
      properties,
      activePropertyId,
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
      rows: (allCommentsList.length > 0 ? allCommentsList : commentsList).map((r: any, idx: number) => [
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
      ]),
    });
  };

  const activeConfig = configData?.config || configForm;

  return (
    <div className="space-y-6">
      {/* ── TOP HEADER & ACTIONS BAR ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-card border border-border/70 shadow-xs">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-primary/10 text-primary flex items-center justify-center">
              <HeartHandshake className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base font-bold flex items-center gap-2">
                <span>{ar ? "استطلاع نبض السكن الدوري" : "Housing Satisfaction Pulse"}</span>
                {activeConfig.enabled ? (
                  <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px]">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 mr-1 animate-pulse" />
                    {ar ? "الاستطلاع نشط" : "Pulse Active"}
                  </Badge>
                ) : (
                  <Badge variant="secondary" className="text-[10px]">
                    {ar ? "متوقف مؤقتاً" : "Disabled"}
                  </Badge>
                )}
              </h2>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "قياس دوري ومجهول الهوية لرضا الموظفين المقيمين، مع إمكانية البوش الفوري وتعديل نمط الإجابة والأسئلة"
                  : "Periodic anonymous pulse for resident satisfaction with instant push and customizable rating mode"}
              </p>
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Push Today Button */}
          <Button
            size="sm"
            onClick={() => setIsPushConfirmOpen(true)}
            className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold shadow-xs flex items-center gap-1.5"
          >
            <Send className="w-4 h-4" />
            <span>{ar ? "إرسال الاستطلاع الآن (بوش اليوم)" : "Push Survey Now"}</span>
          </Button>

          {/* Configuration Dialog Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={() => setIsConfigOpen(true)}
            className="flex items-center gap-1.5 font-medium"
          >
            <Settings2 className="w-4 h-4 text-primary" />
            <span>{ar ? "إعدادات الاستبيان" : "Survey Settings"}</span>
          </Button>

          {/* Export Excel Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handleExportExcel}
            disabled={stats.totalRatings === 0}
            className="flex items-center gap-1.5"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{ar ? "تصدير Excel" : "Export Excel"}</span>
          </Button>

          {/* Print PDF Button */}
          <Button
            size="sm"
            variant="outline"
            onClick={handlePrintReport}
            disabled={stats.totalRatings === 0}
            className="flex items-center gap-1.5"
          >
            <Printer className="w-4 h-4 text-blue-600" />
            <span>{ar ? "طباعة التقرير" : "Print Report"}</span>
          </Button>
        </div>
      </div>

      {/* ── PULSE STATUS INFO BANNER ── */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-3 text-xs bg-muted/30 p-3.5 rounded-xl border border-border/50">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-muted-foreground shrink-0" />
          <span className="text-muted-foreground">{ar ? "فترة التكرار:" : "Cooldown:"}</span>
          <span className="font-semibold">
            {ar ? `كل ${activeConfig.cooldownDays} أيام` : `Every ${activeConfig.cooldownDays} days`}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Star className="w-4 h-4 text-amber-500 shrink-0" />
          <span className="text-muted-foreground">{ar ? "طريقة الإجابة:" : "Rating Mode:"}</span>
          <Badge variant="outline" className="text-[11px] font-semibold">
            {activeConfig.ratingType === "stars"
              ? ar ? "⭐⭐⭐⭐⭐ نجوم (1 إلى 5)" : "Stars Scale (1-5)"
              : ar ? "😊😐🙁 وجوه تعبيرية" : "Smiley Faces"}
          </Badge>
        </div>
        <div className="flex items-center gap-2">
          <MessageSquare className="w-4 h-4 text-primary shrink-0" />
          <span className="text-muted-foreground">{ar ? "كتابة الملاحظات:" : "Comments:"}</span>
          <span className="font-semibold">
            {!activeConfig.allowComment
              ? ar ? "معطلة" : "Disabled"
              : activeConfig.commentRequired
              ? ar ? "إلزامية" : "Required"
              : ar ? "مفعلة (اختيارية)" : "Optional"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <Bell className="w-4 h-4 text-emerald-500 shrink-0" />
          <span className="text-muted-foreground">{ar ? "آخر إرسال فوري:" : "Last Pushed:"}</span>
          <span className="font-mono text-[11px]">
            {activeConfig.lastPushedAt ? formatDate(activeConfig.lastPushedAt) : (ar ? "تلقائي دوري" : "Automated periodic")}
          </span>
        </div>
      </div>

      {/* ── 4 KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Ratings */}
        <Card className="border border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {ar ? "إجمالي التقييمات المستلمة" : "Total Ratings Collected"}
                </p>
                <h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">
                  {stats.totalRatings}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 flex items-center justify-center">
                <Users className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-2 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-1 font-semibold text-emerald-600">
                <Smile className="w-3.5 h-3.5" /> {stats.satisfiedCount}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-amber-600">
                <Meh className="w-3.5 h-3.5" /> {stats.neutralCount}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1 font-semibold text-rose-600">
                <Frown className="w-3.5 h-3.5" /> {stats.dissatisfiedCount}
              </span>
            </div>
          </CardContent>
        </Card>

        {/* Card 2: Satisfaction Rate */}
        <Card className="border border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {ar ? "مؤشر الرضا العام" : "Satisfaction Rate"}
                </p>
                <h3 className="text-2xl font-bold mt-1 tracking-tight text-emerald-600">
                  {stats.satisfactionRate}%
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 flex items-center justify-center">
                <TrendingUp className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3">
              <Progress
                value={stats.satisfactionRate}
                className="h-1.5 bg-muted"
                indicatorClassName="bg-emerald-500"
              />
            </div>
          </CardContent>
        </Card>

        {/* Card 3: Average Score */}
        <Card className="border border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {ar ? "متوسط التقييم العام" : "Average Score"}
                </p>
                <div className="flex items-center gap-1.5 mt-1">
                  <h3 className="text-2xl font-bold tracking-tight text-amber-600">
                    {stats.averageScore}
                  </h3>
                  <span className="text-xs text-muted-foreground font-semibold">/ 5</span>
                </div>
              </div>
              <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
                <Star className="w-5 h-5 fill-amber-500" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`w-3.5 h-3.5 ${
                    star <= Math.round(Number(stats.averageScore) || 0)
                      ? "text-amber-400 fill-amber-400"
                      : "text-muted-foreground/30"
                  }`}
                />
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Card 4: Written Comments */}
        <Card className="border border-border/80 shadow-xs hover:border-primary/40 transition-colors">
          <CardContent className="pt-4 pb-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-[11px] font-medium text-muted-foreground">
                  {ar ? "الملاحظات والمقترحات" : "Written Feedback"}
                </p>
                <h3 className="text-2xl font-bold mt-1 tracking-tight text-foreground">
                  {stats.commentsCount}
                </h3>
              </div>
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 text-purple-600 flex items-center justify-center">
                <MessageSquare className="w-5 h-5" />
              </div>
            </div>
            <div className="mt-3 flex items-center gap-1.5 text-[10px] text-muted-foreground">
              <Lock className="w-3 h-3 text-muted-foreground/60" />
              <span>{ar ? "ملاحظات سرية 100% بدون إظهار اسم المقيم" : "100% Anonymous feedback"}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── SATISFACTION DISTRIBUTION BAR ── */}
      {stats.totalRatings > 0 && (
        <Card className="border border-border/70 shadow-xs">
          <CardHeader className="py-3 px-4 border-b border-border/50">
            <CardTitle className="text-xs font-bold flex items-center justify-between">
              <span>{ar ? "توزيع استجابات المقيمين" : "Resident Response Distribution"}</span>
              <span className="text-[11px] font-normal text-muted-foreground">
                {ar ? `إجمالي الاستجابات: ${stats.totalRatings}` : `Total Responses: ${stats.totalRatings}`}
              </span>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 space-y-3">
            {/* Visual Segments Bar */}
            <div className="w-full h-3 rounded-full overflow-hidden flex bg-muted">
              {stats.satisfiedPct > 0 && (
                <div
                  style={{ width: `${stats.satisfiedPct}%` }}
                  className="bg-emerald-500 h-full transition-all"
                  title={`${ar ? "راضي" : "Satisfied"}: ${stats.satisfiedPct}%`}
                />
              )}
              {stats.neutralPct > 0 && (
                <div
                  style={{ width: `${stats.neutralPct}%` }}
                  className="bg-amber-400 h-full transition-all"
                  title={`${ar ? "متوسط" : "Neutral"}: ${stats.neutralPct}%`}
                />
              )}
              {stats.dissatisfiedPct > 0 && (
                <div
                  style={{ width: `${stats.dissatisfiedPct}%` }}
                  className="bg-rose-500 h-full transition-all"
                  title={`${ar ? "غير راضي" : "Dissatisfied"}: ${stats.dissatisfiedPct}%`}
                />
              )}
            </div>

            {/* Legend Labels */}
            <div className="grid grid-cols-3 gap-2 text-center text-xs">
              <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
                <div className="flex items-center justify-center gap-1.5 font-bold text-emerald-600">
                  <Smile className="w-4 h-4" />
                  <span>{ar ? "راضي" : "Satisfied"}</span>
                </div>
                <div className="text-base font-extrabold text-foreground mt-0.5">
                  {stats.satisfiedPct}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  ({stats.satisfiedCount} {ar ? "صوت" : "ratings"})
                </div>
              </div>

              <div className="p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                <div className="flex items-center justify-center gap-1.5 font-bold text-amber-600">
                  <Meh className="w-4 h-4" />
                  <span>{ar ? "متوسط" : "Neutral"}</span>
                </div>
                <div className="text-base font-extrabold text-foreground mt-0.5">
                  {stats.neutralPct}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  ({stats.neutralCount} {ar ? "صوت" : "ratings"})
                </div>
              </div>

              <div className="p-2 rounded-lg bg-rose-500/10 border border-rose-500/20">
                <div className="flex items-center justify-center gap-1.5 font-bold text-rose-600">
                  <Frown className="w-4 h-4" />
                  <span>{ar ? "غير راضي" : "Dissatisfied"}</span>
                </div>
                <div className="text-base font-extrabold text-foreground mt-0.5">
                  {stats.dissatisfiedPct}%
                </div>
                <div className="text-[10px] text-muted-foreground">
                  ({stats.dissatisfiedCount} {ar ? "صوت" : "ratings"})
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* ── FILTER & SEARCH TOOLBAR ── */}
      <div className="p-3 rounded-xl bg-card border border-border/70 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2 flex-wrap flex-1">
          {/* Rating filter */}
          <div className="w-40">
            <Select
              value={ratingFilter}
              onValueChange={(val) => {
                setRatingFilter(val);
                setCurrentPage(1);
              }}
            >
              <SelectTrigger className="h-8 text-xs">
                <SelectValue placeholder={ar ? "تصفية التقييم" : "Filter Rating"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كافة التقييمات" : "All Ratings"}</SelectItem>
                <SelectItem value="satisfied">{ar ? "راضي 😊 (أو 4-5 نجوم)" : "Satisfied 😊"}</SelectItem>
                <SelectItem value="neutral">{ar ? "متوسط 😐 (أو 3 نجوم)" : "Neutral 😐"}</SelectItem>
                <SelectItem value="dissatisfied">{ar ? "غير راضي 🙁 (أو 1-2 نجوم)" : "Dissatisfied 🙁"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Comment Search */}
          <div className="relative min-w-[200px] flex-1 max-w-sm">
            <Search className="w-3.5 h-3.5 absolute start-2.5 top-2.5 text-muted-foreground" />
            <Input
              value={searchComment}
              onChange={(e) => setSearchComment(e.target.value)}
              placeholder={ar ? "البحث في الملاحظات والمقترحات..." : "Search comments..."}
              className="h-8 text-xs ps-8"
            />
          </div>
        </div>

        {/* Refresh button */}
        <Button
          size="sm"
          variant="ghost"
          onClick={() => refetchReport()}
          disabled={isReportFetching}
          className="h-8 px-2 text-xs text-muted-foreground"
        >
          <RefreshCw className={`w-3.5 h-3.5 mr-1 ${isReportFetching ? "animate-spin" : ""}`} />
          <span>{ar ? "تحديث" : "Refresh"}</span>
        </Button>
      </div>

      {/* ── DETAILED FEEDBACK COMMENTS TABLE ── */}
      <div className="border rounded-xl overflow-hidden bg-card shadow-xs">
        <div className="p-3 border-b bg-muted/20 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <h4 className="text-xs font-bold">
              {ar ? "سجل استجابات وملاحظات المقيمين" : "Resident Feedback & Ratings Log"}
            </h4>
            <Badge variant="secondary" className="text-[10px]">
              {pagination.total} {ar ? "استجابة" : "records"}
            </Badge>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
            <Lock className="w-3 h-3 text-emerald-600" />
            <span>{ar ? "السرية التامة: لا يتم تسجيل اسم أو رقم الموظف نهائياً" : "Fully Anonymous: No employee IDs logged"}</span>
          </div>
        </div>

        {isReportLoading ? (
          <div className="p-6 space-y-3">
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
            <Skeleton className="h-10 w-full" />
          </div>
        ) : filteredComments.length === 0 ? (
          <div className="text-center py-12 space-y-2">
            <HeartHandshake className="w-8 h-8 text-muted-foreground/40 mx-auto" />
            <p className="text-xs font-medium text-muted-foreground">
              {ar ? "لا توجد تقييمات مسجلة مطابقة حتى الآن" : "No matching rating records found"}
            </p>
          </div>
        ) : (
          <>
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 text-center text-xs">#</TableHead>
                  <TableHead className="text-xs">{ar ? "المقيم" : "Resident"}</TableHead>
                  <TableHead className="text-xs">{ar ? "التقييم" : "Rating"}</TableHead>
                  <TableHead className="text-xs">{ar ? "الدرجة" : "Score"}</TableHead>
                  <TableHead className="text-xs">{ar ? "الملاحظة / المقترح" : "Feedback / Comment"}</TableHead>
                  <TableHead className="text-xs text-right">{ar ? "التاريخ" : "Date"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredComments.map((r: any, idx: number) => {
                  const itemIndex = (pagination.page - 1) * pageSize + idx + 1;
                  return (
                    <TableRow key={r.id || idx} className="hover:bg-muted/30">
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {itemIndex}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="font-mono text-[10px] bg-muted/40 flex items-center gap-1 w-fit">
                          <Lock className="w-2.5 h-2.5 text-muted-foreground" />
                          <span>{ar ? "مقيم سري مجهول" : "Anonymous Resident"} #{r.id || idx + 1}</span>
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {r.rating === "satisfied" ? (
                          <Badge className="bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1 text-[11px]">
                            <Smile className="w-3.5 h-3.5 text-emerald-600" />
                            <span>{ar ? "راضي" : "Satisfied"}</span>
                          </Badge>
                        ) : r.rating === "neutral" ? (
                          <Badge className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1 text-[11px]">
                            <Meh className="w-3.5 h-3.5 text-amber-600" />
                            <span>{ar ? "متوسط" : "Neutral"}</span>
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-500/10 text-rose-700 dark:text-rose-300 border-rose-500/30 gap-1 text-[11px]">
                            <Frown className="w-3.5 h-3.5 text-rose-600" />
                            <span>{ar ? "غير راضي" : "Dissatisfied"}</span>
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-xs">
                          {r.score ? `${r.score} / 5` : "—"}
                        </span>
                      </TableCell>
                      <TableCell className="max-w-md">
                        {r.comment ? (
                          <p className="text-xs text-foreground bg-muted/30 p-2 rounded-lg border border-border/40 whitespace-pre-wrap">
                            {r.comment}
                          </p>
                        ) : (
                          <span className="text-[11px] text-muted-foreground italic">
                            {ar ? "بدون ملاحظة مكتوبة" : "No comment"}
                          </span>
                        )}
                      </TableCell>
                      <TableCell className="text-right text-[11px] text-muted-foreground font-mono">
                        {formatDate(r.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>

            {/* Pagination */}
            <div className="p-3 border-t">
              <DataPagination
                currentPage={pagination.page}
                totalPages={pagination.totalPages}
                pageSize={pageSize}
                totalItems={pagination.total}
                onPageChange={(p) => setCurrentPage(p)}
                onPageSizeChange={(s) => {
                  setPageSize(s);
                  setCurrentPage(1);
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* ── DIALOG 1: CONFIGURATION MODAL ── */}
      <Dialog open={isConfigOpen} onOpenChange={setIsConfigOpen}>
        <DialogContent className="max-w-lg" srTitle={ar ? "إعدادات استطلاع نبض السكن" : "Housing Pulse Settings"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <span>{ar ? "إعدادات استطلاع نبض السكن الأسبوعي" : "Housing Pulse Survey Settings"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {ar
                ? "تخصيص نمط الإجابة، الملاحظات، فترة التكرار، والأسئلة المعروضة على بوابة المقيمين"
                : "Customize rating format, comments, recurrence cooldown, and questions on the portal"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-3">
            {/* 1. Pulse Active Toggle */}
            <div className="flex items-center justify-between p-3 rounded-lg bg-muted/40 border">
              <div>
                <Label className="text-xs font-bold">
                  {ar ? "تفعيل الاستطلاع التلقائي" : "Enable Automated Pulse"}
                </Label>
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {ar
                    ? "عرض الاستطلاع دورياً للموظفين المقيمين عند فتح البوابة"
                    : "Display pulse periodically to residents when logging into the portal"}
                </p>
              </div>
              <Switch
                checked={configForm.enabled}
                onCheckedChange={(val) => setConfigForm((f) => ({ ...f, enabled: val }))}
              />
            </div>

            {/* 2. Rating Format (Faces vs Stars) */}
            <div className="space-y-2">
              <Label className="text-xs font-bold">
                {ar ? "طريقة الإجابة ونمط التقييم" : "Rating Format"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setConfigForm((f) => ({ ...f, ratingType: "faces" }))}
                  className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                    configForm.ratingType === "faces"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Smile className="w-4 h-4 text-emerald-600" />
                    <span>{ar ? "وجوه تعبيرية" : "Smiley Faces"}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {ar ? "😊 راضي / 😐 متوسط / 🙁 غير راضي" : "Satisfied / Neutral / Dissatisfied"}
                  </p>
                </button>

                <button
                  type="button"
                  onClick={() => setConfigForm((f) => ({ ...f, ratingType: "stars" }))}
                  className={`p-3 rounded-xl border text-start transition-all cursor-pointer ${
                    configForm.ratingType === "stars"
                      ? "border-primary bg-primary/10 shadow-xs"
                      : "border-border hover:bg-muted/40"
                  }`}
                >
                  <div className="flex items-center gap-1.5 font-bold text-xs">
                    <Star className="w-4 h-4 text-amber-500 fill-amber-500" />
                    <span>{ar ? "نجوم (1 إلى 5)" : "5-Star Scale"}</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {ar ? "⭐⭐⭐⭐⭐ تقييم رقمي تدريجي" : "1 to 5 numeric stars"}
                  </p>
                </button>
              </div>
            </div>

            {/* 3. Comments Controls */}
            <div className="grid grid-cols-2 gap-3 p-3 rounded-lg bg-muted/40 border">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">
                    {ar ? "السماح بالتعليقات" : "Allow Comments"}
                  </Label>
                  <p className="text-[9px] text-muted-foreground">
                    {ar ? "مربع للملاحظات والمقترحات" : "Feedback textbox"}
                  </p>
                </div>
                <Switch
                  checked={configForm.allowComment}
                  onCheckedChange={(val) => setConfigForm((f) => ({ ...f, allowComment: val }))}
                />
              </div>

              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-semibold">
                    {ar ? "التعليق إلزامي" : "Comment Required"}
                  </Label>
                  <p className="text-[9px] text-muted-foreground">
                    {ar ? "إلزام الموظف بكتابة سبب" : "Require written explanation"}
                  </p>
                </div>
                <Switch
                  disabled={!configForm.allowComment}
                  checked={configForm.commentRequired}
                  onCheckedChange={(val) => setConfigForm((f) => ({ ...f, commentRequired: val }))}
                />
              </div>
            </div>

            {/* 4. Recurrence Cooldown (Days) */}
            <div className="space-y-1">
              <Label className="text-xs font-semibold">
                {ar ? "فترة التكرار التلقائي (بالأيام)" : "Recurrence Cooldown (Days)"}
              </Label>
              <Input
                type="number"
                min={1}
                max={365}
                value={configForm.cooldownDays}
                onChange={(e) =>
                  setConfigForm((f) => ({
                    ...f,
                    cooldownDays: Math.max(1, parseInt(e.target.value) || 7),
                  }))
                }
                className="h-8 text-xs font-mono"
              />
              <p className="text-[10px] text-muted-foreground">
                {ar
                  ? "المدة الفاصلة بين استطلاعات الموظف نفسه (الافتراضي 7 أيام)"
                  : "Days before an employee can rate again (default 7 days)"}
              </p>
            </div>

            {/* 5. Custom Titles & Questions */}
            <div className="space-y-2 border-t pt-3">
              <Label className="text-xs font-bold">
                {ar ? "عنوان وسؤال الاستبيان" : "Survey Title & Question"}
              </Label>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {ar ? "العنوان (عربي)" : "Title (AR)"}
                  </Label>
                  <Input
                    value={configForm.titleAr}
                    onChange={(e) => setConfigForm((f) => ({ ...f, titleAr: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-[11px] text-muted-foreground">
                    {ar ? "العنوان (إنجليزي)" : "Title (EN)"}
                  </Label>
                  <Input
                    value={configForm.titleEn}
                    onChange={(e) => setConfigForm((f) => ({ ...f, titleEn: e.target.value }))}
                    className="h-8 text-xs"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  {ar ? "السؤال المعروض (عربي)" : "Prompt Question (AR)"}
                </Label>
                <Input
                  value={configForm.questionAr}
                  onChange={(e) => setConfigForm((f) => ({ ...f, questionAr: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>

              <div className="space-y-1">
                <Label className="text-[11px] text-muted-foreground">
                  {ar ? "السؤال المعروض (إنجليزي)" : "Prompt Question (EN)"}
                </Label>
                <Input
                  value={configForm.questionEn}
                  onChange={(e) => setConfigForm((f) => ({ ...f, questionEn: e.target.value }))}
                  className="h-8 text-xs"
                />
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsConfigOpen(false)}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={() => saveConfigMutation.mutate(configForm)}
              disabled={saveConfigMutation.isPending}
            >
              {saveConfigMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : null}
              <span>{ar ? "حفظ التغييرات" : "Save Settings"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG 2: PUSH TODAY CONFIRMATION MODAL ── */}
      <Dialog open={isPushConfirmOpen} onOpenChange={setIsPushConfirmOpen}>
        <DialogContent className="max-w-md" srTitle={ar ? "تأكيد إرسال الاستطلاع الآن" : "Confirm Instant Push"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-emerald-600">
              <Send className="w-5 h-5" />
              <span>{ar ? "إرسال الاستطلاع الآن لجميع المقيمين؟" : "Push Survey to All Residents Now?"}</span>
            </DialogTitle>
            <DialogDescription className="text-xs">
              {ar
                ? "سيتم إرسال إشعار فوري وتفعيل بطاقة التقييم لجميع الموظفين المقيمين حالياً بالسكن دون انتظار انقضاء الـ 7 أيام."
                : "This will immediately display the survey on the portal homepage for all current in-house residents without waiting for the cooldown."}
            </DialogDescription>
          </DialogHeader>

          <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-foreground space-y-1.5">
            <div className="font-semibold flex items-center gap-1.5 text-emerald-700 dark:text-emerald-300">
              <Sparkles className="w-4 h-4" />
              <span>{ar ? "ماذا يحدث عند التأكيد؟" : "What happens next?"}</span>
            </div>
            <ul className="list-disc list-inside text-[11px] text-muted-foreground space-y-1">
              <li>{ar ? "يظهر كارت الاستبيان على الفور في واجهة البوابة لكل موظف مقيم." : "The rating prompt immediately renders on each resident's portal."}</li>
              <li>{ar ? "يتم بث إشعار WebSocket وتنبيه داخلي في البوابة." : "A real-time WebSocket notification is dispatched."}</li>
              <li>{ar ? "التقييمات تظل سرية ومجهولة الهوية 100% لحماية خصوصية الموظفين." : "Ratings remain 100% anonymous."}</li>
            </ul>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsPushConfirmOpen(false)}
            >
              {ar ? "تراجع" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={() => pushSurveyMutation.mutate()}
              disabled={pushSurveyMutation.isPending}
              className="bg-emerald-600 hover:bg-emerald-700 text-white"
            >
              {pushSurveyMutation.isPending ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin mr-1" />
              ) : (
                <Send className="w-3.5 h-3.5 mr-1" />
              )}
              <span>{ar ? "تأكيد وإرسال للمقيمين الآن" : "Confirm & Push Now"}</span>
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
