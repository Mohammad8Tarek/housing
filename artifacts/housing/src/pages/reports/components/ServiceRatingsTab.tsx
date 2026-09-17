import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { printLuxuryReport } from "../utils/luxury-report-engine";
import {
  Star,
  Award,
  ThumbsUp,
  Wrench,
  Sparkles,
  Clock,
  Filter,
  Download,
  Printer,
  Calendar,
  Building2,
  CheckCircle2,
  AlertCircle,
  TrendingUp,
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
import { formatDateTime } from "@/lib/date-utils";

interface ServiceRatingsTabProps {
  ar: boolean;
  activePropertyId?: number | string | null;
  properties?: any[];
}

export function ServiceRatingsTab({
  ar,
  activePropertyId,
  properties = [],
}: ServiceRatingsTabProps) {
  const [category, setCategory] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchTicket, setSearchTicket] = useState<string>("");

  const { data: responseData, isLoading, refetch } = useQuery({
    queryKey: ["service-ratings-report", activePropertyId, category, fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (activePropertyId) params.append("propertyId", String(activePropertyId));
      if (category && category !== "all") params.append("category", category);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);

      const res = await fetch(`/api/reports/service-ratings?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch service ratings report");
      }
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const summary = responseData?.summary || {
    totalTickets: 0,
    completedTicketsCount: 0,
    totalRated: 0,
    unratedCount: 0,
    averageRating: 0,
    maintenanceAvg: 0,
    housekeepingAvg: 0,
    satisfactionRate: 0,
    starsBreakdown: { 5: 0, 4: 0, 3: 0, 2: 0, 1: 0 },
  };

  const workerLeaderboard = responseData?.workerLeaderboard || [];
  const ratedTickets = responseData?.ratedTickets || [];

  const filteredTickets = ratedTickets.filter((t: any) => {
    if (!searchTicket) return true;
    const s = searchTicket.toLowerCase();
    return (
      String(t.id).includes(s) ||
      (t.roomNumber && String(t.roomNumber).toLowerCase().includes(s)) ||
      (t.workerName && t.workerName.toLowerCase().includes(s)) ||
      (t.description && t.description.toLowerCase().includes(s)) ||
      (t.ratingComment && t.ratingComment.toLowerCase().includes(s))
    );
  });

  const handleExportExcel = () => {
    if (!ratedTickets.length && !workerLeaderboard.length) return;

    const wb = XLSX.utils.book_new();

    // Sheet 1: Summary & Worker Leaderboard
    const leaderboardRows = workerLeaderboard.map((w: any, idx: number) => ({
      [ar ? "الترتيب" : "Rank"]: idx + 1,
      [ar ? "اسم الفني / العامل" : "Worker Name"]: w.workerName,
      [ar ? "التخصص" : "Specialty"]: w.specialty || "—",
      [ar ? "الطلبات المقيّمة" : "Total Rated Orders"]: w.totalRated,
      [ar ? "متوسط التقييم" : "Avg Rating"]: `${w.averageRating} / 5`,
      [ar ? "نسبة الرضا" : "Satisfaction Rate"]: `${w.satisfactionRate}%`,
    }));

    const wsLeaderboard = XLSX.utils.json_to_sheet(leaderboardRows);
    XLSX.utils.book_append_sheet(wb, wsLeaderboard, ar ? "لوحة أداء الفنيين" : "Worker Leaderboard");

    // Sheet 2: Detailed Rated Tickets
    const ticketRows = ratedTickets.map((t: any) => ({
      [ar ? "رقم الطلب" : "Ticket #"]: t.id,
      [ar ? "الغرفة" : "Room"]: t.roomNumber || "—",
      [ar ? "القسم" : "Category"]:
        t.category === "maintenance"
          ? (ar ? "صيانة" : "Maintenance")
          : t.category === "housekeeping"
          ? (ar ? "هاوس كيبنج" : "Housekeeping")
          : t.category,
      [ar ? "نوع المشكلة" : "Problem Type"]: t.problemType,
      [ar ? "الفني المعين" : "Worker"]: t.workerName || "—",
      [ar ? "التقييم النجوم" : "Rating (Stars)"]: `${t.rating} / 5`,
      [ar ? "ملاحظات الموظف" : "Resident Comment"]: t.ratingComment || "—",
      [ar ? "تاريخ الإبلاغ" : "Reported At"]: t.reportedAt ? formatDateTime(t.reportedAt) : "—",
      [ar ? "تاريخ التقييم" : "Rated At"]: t.ratedAt ? formatDateTime(t.ratedAt) : "—",
    }));

    const wsTickets = XLSX.utils.json_to_sheet(ticketRows);
    XLSX.utils.book_append_sheet(wb, wsTickets, ar ? "سجل التقييمات التفصيلي" : "Ratings Detail Log");

    const dateStr = new Date().toISOString().slice(0, 10);
    XLSX.writeFile(wb, `Service_Ratings_Report_${dateStr}.xlsx`);
  };

  const handlePrint = async () => {
    const rows = ratedTickets.map((t: any) => ({
      [ar ? "رقم الطلب" : "Ticket #"]: `#${t.id}`,
      [ar ? "الغرفة" : "Room"]: t.roomNumber || "—",
      [ar ? "القسم" : "Category"]:
        t.category === "maintenance"
          ? (ar ? "صيانة" : "Maintenance")
          : t.category === "housekeeping"
          ? (ar ? "هاوس كيبنج" : "Housekeeping")
          : t.category,
      [ar ? "نوع المشكلة" : "Problem Type"]: t.problemType,
      [ar ? "الفني المعين" : "Worker"]: t.workerName || "—",
      [ar ? "التقييم النجوم" : "Rating (Stars)"]: `${t.rating || 0} / 5 ⭐`,
      [ar ? "ملاحظات الموظف" : "Resident Comment"]: t.ratingComment || "—",
      [ar ? "تاريخ التقييم" : "Rated At"]: t.ratedAt ? formatDateTime(t.ratedAt) : "—",
    }));

    const printRows =
      rows.length > 0
        ? rows
        : workerLeaderboard.map((w: any, idx: number) => ({
            [ar ? "الترتيب" : "Rank"]: idx + 1,
            [ar ? "اسم الفني / العامل" : "Worker Name"]: w.workerName,
            [ar ? "التخصص" : "Specialty"]: w.specialty || "—",
            [ar ? "الطلبات المقيّمة" : "Total Rated Orders"]: w.totalRated,
            [ar ? "متوسط التقييم" : "Avg Rating"]: `${w.averageRating} / 5 ⭐`,
            [ar ? "نسبة الرضا" : "Satisfaction Rate"]: `${w.satisfactionRate}%`,
          }));

    await printLuxuryReport({
      activeTab: "service_ratings",
      rows: printRows,
      properties,
      activePropertyId,
      language: ar ? "ar" : "en",
    });
  };

  return (
    <div className="space-y-6 bg-background p-4 print:p-0">
      {/* Header & Actions Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-card p-4 rounded-xl border shadow-xs">
        <div className="flex items-center gap-3">
          <div className="p-2.5 rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
            <Star className="w-6 h-6 fill-amber-500" />
          </div>
          <div>
            <h2 className="text-lg font-bold text-foreground">
              {ar ? "تقرير جودة الخدمات وتقييمات النزلاء" : "Service Quality & Resident Satisfaction Report"}
            </h2>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "متابعة أداء الصيانة والنظافة الميدانية، ومعدلات رضا النزلاء عن الخدمات المنجزة"
                : "Monitor operational maintenance & housekeeping quality and employee satisfaction metrics"}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExportExcel}
            className="text-xs gap-1.5 font-semibold"
          >
            <Download className="w-4 h-4 text-emerald-600" />
            <span>{ar ? "تصدير Excel" : "Export Excel"}</span>
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={handlePrint}
            className="text-xs gap-1.5 font-semibold print:hidden"
          >
            <Printer className="w-4 h-4 text-primary" />
            <span>{ar ? "طباعة" : "Print Report"}</span>
          </Button>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="bg-card p-3.5 rounded-xl border shadow-xs print:hidden">
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Category Filter */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "القسم / الخدمة" : "Category"}</span>
            </Label>
            <Select value={category} onValueChange={(v) => setCategory(v)}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "الكل" : "All Categories"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كافة الأقسام (صيانة ونظافة)" : "All Categories"}</SelectItem>
                <SelectItem value="maintenance">{ar ? "صيانة فنية فقط" : "Maintenance Only"}</SelectItem>
                <SelectItem value="housekeeping">{ar ? "هاوس كيبنج فقط" : "Housekeeping Only"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "من تاريخ" : "From Date"}</span>
            </Label>
            <Input
              type="date"
              value={fromDate}
              onChange={(e) => setFromDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "إلى تاريخ" : "To Date"}</span>
            </Label>
            <Input
              type="date"
              value={toDate}
              onChange={(e) => setToDate(e.target.value)}
              className="h-9 text-xs"
            />
          </div>

          {/* Reset / Search */}
          <div className="flex items-end gap-2">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => {
                setCategory("all");
                setFromDate("");
                setToDate("");
                setSearchTicket("");
                refetch();
              }}
              className="h-9 text-xs w-full font-medium"
            >
              {ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
            </Button>
          </div>
        </div>
      </div>

      {/* KPI Cards Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Overall Average Rating */}
        <div className="bg-card p-4 rounded-xl border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {ar ? "متوسط التقييم العام" : "Average Rating"}
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Star className="w-4 h-4 fill-amber-500" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-foreground">
              {summary.averageRating}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">/ 5</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
            <span>{summary.totalRated}</span>
            <span>{ar ? "طلب تم تقييمه" : "rated tickets"}</span>
          </p>
        </div>

        {/* Satisfaction Rate */}
        <div className="bg-card p-4 rounded-xl border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {ar ? "نسبة الرضا والإيجابية" : "Satisfaction Rate"}
            </span>
            <div className="p-1.5 rounded-lg bg-emerald-500/10 text-emerald-500">
              <ThumbsUp className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-emerald-600 dark:text-emerald-400">
              {summary.satisfactionRate}%
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {ar ? "تقييم 4 أو 5 نجوم" : "4 or 5 star ratings"}
          </p>
        </div>

        {/* Maintenance Average */}
        <div className="bg-card p-4 rounded-xl border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {ar ? "متوسط تقييم الصيانة" : "Maintenance Avg"}
            </span>
            <div className="p-1.5 rounded-lg bg-blue-500/10 text-blue-500">
              <Wrench className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
              {summary.maintenanceAvg}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">/ 5</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {ar ? "صيانة غرف ومرافق" : "Technical & facilities"}
          </p>
        </div>

        {/* Housekeeping Average */}
        <div className="bg-card p-4 rounded-xl border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {ar ? "متوسط تقييم النظافة" : "Housekeeping Avg"}
            </span>
            <div className="p-1.5 rounded-lg bg-sky-500/10 text-sky-500">
              <Sparkles className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-sky-600 dark:text-sky-400">
              {summary.housekeepingAvg}
            </span>
            <span className="text-xs font-semibold text-muted-foreground">/ 5</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {ar ? "نظافة وهاوس كيبنج" : "Room cleaning & linens"}
          </p>
        </div>

        {/* Pending Rating */}
        <div className="bg-card p-4 rounded-xl border shadow-xs relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground">
              {ar ? "بانتظار التقييم" : "Pending Rating"}
            </span>
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-500">
              <Clock className="w-4 h-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
              {summary.unratedCount}
            </span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {ar ? "طلبات منجزة لم تقيّم" : "Completed without rating"}
          </p>
        </div>
      </div>

      {/* Analytics Section: Star Distribution + Leaderboard */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Star Rating Breakdown */}
        <div className="bg-card p-5 rounded-xl border shadow-xs space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-primary" />
              <span>{ar ? "توزيع التقييمات بالنجوم" : "Star Rating Distribution"}</span>
            </h3>
            <Badge variant="outline" className="text-xs">
              {summary.totalRated} {ar ? "تقييم" : "Ratings"}
            </Badge>
          </div>

          <div className="space-y-3 pt-2">
            {[5, 4, 3, 2, 1].map((stars) => {
              const count = summary.starsBreakdown?.[stars] || 0;
              const percent = summary.totalRated > 0 ? Math.round((count / summary.totalRated) * 100) : 0;
              return (
                <div key={stars} className="space-y-1">
                  <div className="flex items-center justify-between text-xs">
                    <div className="flex items-center gap-1.5 font-semibold">
                      <span className="w-3 text-center">{stars}</span>
                      <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                    </div>
                    <div className="flex items-center gap-2 text-muted-foreground font-mono">
                      <span>{count}</span>
                      <span className="text-[11px]">({percent}%)</span>
                    </div>
                  </div>
                  <Progress value={percent} className="h-2 bg-muted" />
                </div>
              );
            })}
          </div>

          <div className="p-3 bg-muted/40 rounded-lg text-xs text-muted-foreground space-y-1">
            <p className="font-semibold text-foreground">
              {ar ? "مؤشر الرضا العام:" : "General Satisfaction Index:"}
            </p>
            <p>
              {ar
                ? `نسبة الرضا الحالية تبلغ ${summary.satisfactionRate}% بناءً على تقييمات النزلاء الحقيقية فور إتمام المهام.`
                : `Current satisfaction is at ${summary.satisfactionRate}% based on real resident feedback upon completion.`}
            </p>
          </div>
        </div>

        {/* Worker Leaderboard */}
        <div className="bg-card p-5 rounded-xl border shadow-xs space-y-4 lg:col-span-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600">
                <Award className="w-4 h-4" />
              </div>
              <h3 className="font-bold text-sm text-foreground">
                {ar ? "لوحة شرف وتقييم الفنيين وعمال النظافة" : "Technician & Worker Performance Leaderboard"}
              </h3>
            </div>
            <span className="text-xs text-muted-foreground font-medium">
              {workerLeaderboard.length} {ar ? "فني مسجل" : "technicians"}
            </span>
          </div>

          <div className="border rounded-xl overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-12 text-center">{ar ? "#" : "Rank"}</TableHead>
                  <TableHead>{ar ? "الفني / العامل" : "Worker Name"}</TableHead>
                  <TableHead>{ar ? "التخصص" : "Specialty"}</TableHead>
                  <TableHead className="text-center">{ar ? "المهام المقيّمة" : "Rated Orders"}</TableHead>
                  <TableHead className="text-center">{ar ? "متوسط التقييم" : "Avg Rating"}</TableHead>
                  <TableHead className="text-end">{ar ? "نسبة الرضا" : "Satisfaction"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {workerLeaderboard.length > 0 ? (
                  workerLeaderboard.map((w: any, idx: number) => (
                    <TableRow key={w.workerId || idx} className="hover:bg-muted/30">
                      <TableCell className="text-center font-mono font-bold text-xs text-muted-foreground">
                        {idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : idx + 1}
                      </TableCell>
                      <TableCell className="font-semibold text-xs text-foreground">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-xs shrink-0">
                            {w.workerName ? w.workerName.charAt(0) : "W"}
                          </div>
                          <span>{w.workerName}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-xs text-muted-foreground">
                        <Badge variant="outline" className="text-[10px]">
                          {w.specialty || (ar ? "فني عام" : "General")}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-mono text-xs font-bold">
                        {w.totalRated}
                      </TableCell>
                      <TableCell className="text-center">
                        <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold font-mono">
                          <Star className="w-3 h-3 fill-amber-400 text-amber-400" />
                          <span>{w.averageRating}</span>
                        </div>
                      </TableCell>
                      <TableCell className="text-end font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        {w.satisfactionRate}%
                      </TableCell>
                    </TableRow>
                  ))
                ) : (
                  <TableRow>
                    <TableCell colSpan={6} className="text-center py-8 text-xs text-muted-foreground">
                      {ar ? "لا توجد بيانات تقييمات للفنيين حالياً." : "No technician ratings data available."}
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
          </div>
        </div>
      </div>

      {/* Detailed Rated Tickets Log */}
      <div className="bg-card p-5 rounded-xl border shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              <span>{ar ? "سجل التقييمات وملاحظات النزلاء التفصيلي" : "Detailed Service Ratings & Feedback Log"}</span>
            </h3>
            <p className="text-xs text-muted-foreground">
              {ar ? "عرض كافة الطلبات المقيمة مع تعليقات وملاحظات الموظفين" : "All rated orders with resident comments and evaluation timestamps"}
            </p>
          </div>

          <div className="w-full sm:w-64">
            <Input
              placeholder={ar ? "بحث برقم الغرفة، الفني، التعليق..." : "Search tickets, worker, room..."}
              value={searchTicket}
              onChange={(e) => setSearchTicket(e.target.value)}
              className="h-8.5 text-xs"
            />
          </div>
        </div>

        <div className="border rounded-xl overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-16 font-semibold text-xs">{ar ? "رقم" : "ID"}</TableHead>
                <TableHead className="font-semibold text-xs">{ar ? "الغرفة" : "Room"}</TableHead>
                <TableHead className="font-semibold text-xs">{ar ? "القسم والخدمة" : "Category & Problem"}</TableHead>
                <TableHead className="font-semibold text-xs">{ar ? "الفني المعين" : "Worker"}</TableHead>
                <TableHead className="font-semibold text-xs min-w-[120px]">{ar ? "التقييم" : "Rating"}</TableHead>
                <TableHead className="font-semibold text-xs min-w-[200px]">{ar ? "ملاحظات وتعليق الموظف" : "Resident Feedback"}</TableHead>
                <TableHead className="font-semibold text-xs text-end">{ar ? "تاريخ التقييم" : "Rated Date"}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredTickets.length > 0 ? (
                filteredTickets.map((t: any) => (
                  <TableRow key={t.id} className="hover:bg-muted/30">
                    <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                      #{t.id}
                    </TableCell>
                    <TableCell className="text-xs font-bold">
                      {ar ? "غرفة" : "Room"} {t.roomNumber || "—"}
                    </TableCell>
                    <TableCell className="text-xs">
                      <div className="flex flex-col">
                        <span className="font-bold text-foreground">
                          {t.category === "maintenance"
                            ? (ar ? "صيانة فنية" : "Maintenance")
                            : t.category === "housekeeping"
                            ? (ar ? "هاوس كيبنج" : "Housekeeping")
                            : t.category}
                        </span>
                        <span className="text-[11px] text-muted-foreground">{t.problemType}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-medium">
                      {t.workerName || (ar ? "غير محدد" : "Unassigned")}
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 text-xs font-bold w-fit">
                        <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400" />
                        <span>{t.rating} / 5</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs">
                      {t.ratingComment ? (
                        <p className="italic text-foreground bg-muted/30 px-2.5 py-1 rounded-md border text-[11px] max-w-md">
                          "{t.ratingComment}"
                        </p>
                      ) : (
                        <span className="text-muted-foreground/50 text-[11px]">
                          {ar ? "بدون تعليق إضافي" : "No comment"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-end text-xs text-muted-foreground font-mono whitespace-nowrap">
                      {t.ratedAt ? formatDateTime(t.ratedAt) : "—"}
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-12 text-xs text-muted-foreground">
                    <AlertCircle className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="font-semibold text-sm text-foreground mb-1">
                      {ar ? "لا توجد تقييمات تطابق معايير البحث" : "No rated tickets matching criteria"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "تأكد من اختيار الـ Property الصحيح أو توسيع نطاق التاريخ."
                        : "Verify the selected property or broaden the date range."}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </div>
      </div>
    </div>
  );
}
