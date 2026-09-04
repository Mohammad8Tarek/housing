// @ts-nocheck
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate, getExportFileName } from "@/lib/date-utils";
import { toast } from "sonner";
import { useState } from "react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  FileText,
  Download,
  BarChart3,
  PlusCircle,
  Loader,
  TrendingUp,
  Users,
  Star,
  Target,
  Calendar,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { useGetSettings, useListProperties } from "@workspace/api-client-react";
import { drawPdfHeader, drawPdfFooter, pdfTextSafe } from "@/lib/pdf-utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

// ═══════════════════════════════════════════════════════════════
// MINI CHART COMPONENTS
// ═══════════════════════════════════════════════════════════════
function BarChart({
  data,
  maxWidth = 200,
}: {
  data: { label: string; value: number; color?: string }[];
  maxWidth?: number;
}) {
  const maxVal = Math.max(...data.map((d) => d.value), 1);
  return (
    <div className="space-y-1.5">
      {data.map((d, i) => (
        <div key={i} className="flex items-center gap-2 text-xs">
          <span className="w-20 text-muted-foreground truncate text-end">
            {d.label}
          </span>
          <div className="flex-1 h-4 bg-muted/30 rounded overflow-hidden">
            <div
              className={`h-full rounded ${d.color || "bg-primary"}`}
              style={{ width: `${Math.max((d.value / maxVal) * 100, 2)}%` }}
            />
          </div>
          <span className="w-8 text-muted-foreground font-mono">{d.value}</span>
        </div>
      ))}
    </div>
  );
}

function StarBar({ distribution }: { distribution: number[] }) {
  const max = Math.max(...distribution, 1);
  return (
    <div className="space-y-1">
      {[5, 4, 3, 2, 1].map((star) => (
        <div key={star} className="flex items-center gap-1.5 text-xs">
          <span className="w-3 text-amber-500">★</span>
          <span className="w-3 text-muted-foreground">{star}</span>
          <div className="flex-1 h-3 bg-muted/30 rounded overflow-hidden">
            <div
              className="h-full bg-amber-400 rounded"
              style={{
                width: `${Math.max((distribution[star - 1] / max) * 100, 2)}%`,
              }}
            />
          </div>
          <span className="w-6 text-muted-foreground font-mono">
            {distribution[star - 1]}
          </span>
        </div>
      ))}
    </div>
  );
}

function KPICard({
  icon: Icon,
  label,
  value,
  sub,
  color = "text-primary",
}: {
  icon: any;
  label: string;
  value: string | number;
  sub?: string;
  color?: string;
}) {
  return (
    <div className="p-3 rounded-xl border border-border bg-card">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={`w-4 h-4 ${color}`} />
        <span className="text-xs text-muted-foreground">{label}</span>
      </div>
      <p className="text-2xl font-bold">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════
// MAIN COMPONENT
// ═══════════════════════════════════════════════════════════════
export default function PortalReports({ defaultType }: { defaultType?: string } = {}) {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const [reportConfig, setReportConfig] = useState({
    type: defaultType || "evaluations",
    format: "excel",
    dateFrom: "",
    dateTo: "",
    department: "all",
    modules: ["evaluations", "activities"],
  });
  const [quickPeriod, setQuickPeriod] = useState("last_30");
  const [isGenerating, setIsGenerating] = useState(false);
  const [expandedSections, setExpandedSections] = useState<
    Record<string, boolean>
  >({});

  const { data: settings } = useGetSettings(
    { propertyId: activePropertyId },
    { query: { enabled: !!activePropertyId } },
  );
  const { data: _pData } = useListProperties({
    query: {
      staleTime: 5 * 60 * 1000,
      cacheTime: 30 * 60 * 1000,
    },
  });
  const properties = _pData?.data || _pData || [];

  // Fetch departments for filter
  const { data: departments = [] } = useQuery({
    queryKey: ["report-departments", activePropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/portal-reports/departments?propertyId=${activePropertyId}`,
      );
      if (!res.ok) return [];
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  // Fetch report data
  const {
    data: reportData,
    isLoading,
    error: reportsError,
    refetch,
  } = useQuery({
    queryKey: ["portal-report-data", activePropertyId, reportConfig],
    queryFn: async () => {
      const params = new URLSearchParams();
      params.set("propertyId", String(activePropertyId));
      if (reportConfig.dateFrom) params.set("from", reportConfig.dateFrom);
      if (reportConfig.dateTo) params.set("to", reportConfig.dateTo);
      if (reportConfig.department && reportConfig.department !== "all")
        params.set("department", reportConfig.department);
      if (reportConfig.type === "custom")
        params.set("modules", reportConfig.modules.join(","));

      const endpoint =
        reportConfig.type === "custom"
          ? "custom-report"
          : `${reportConfig.type}-report`;
      const res = await fetch(`/api/portal-reports/${endpoint}?${params}`);
      if (!res.ok) throw new Error("Failed to fetch report");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  // Date presets
  const applyDatePreset = (preset: string) => {
    setQuickPeriod(preset);
    const now = new Date();
    let from: Date;
    let to = now;
    switch (preset) {
      case "this_month":
        from = new Date(now.getFullYear(), now.getMonth(), 1);
        break;
      case "last_month":
        from = new Date(now.getFullYear(), now.getMonth() - 1, 1);
        to = new Date(now.getFullYear(), now.getMonth(), 0);
        break;
      case "this_quarter": {
        const qMonth = Math.floor(now.getMonth() / 3) * 3;
        from = new Date(now.getFullYear(), qMonth, 1);
        break;
      }
      case "this_year":
        from = new Date(now.getFullYear(), 0, 1);
        break;
      case "last_30":
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      case "last_90":
        from = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        break;
      default:
        from = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    }
    setReportConfig({
      ...reportConfig,
      dateFrom: from.toISOString().split("T")[0],
      dateTo: to.toISOString().split("T")[0],
    });
  };

  const handleExport = async (format: "pdf" | "excel") => {
    setIsGenerating(true);
    try {
      if (format === "pdf" && reportData) {
        await generatePdf(reportData);
        toast.success(
          ar ? "تم إنشاء التقرير" : "Report generated successfully",
        );
      } else {
        const params = new URLSearchParams();
        params.set("propertyId", String(activePropertyId));
        params.set("format", "excel");
        if (reportConfig.dateFrom) params.set("from", reportConfig.dateFrom);
        if (reportConfig.dateTo) params.set("to", reportConfig.dateTo);
        if (reportConfig.department && reportConfig.department !== "all")
          params.set("department", reportConfig.department);

        const endpoint =
          reportConfig.type === "custom"
            ? "custom-report"
            : `${reportConfig.type}-report`;
        const res = await fetch(`/api/portal-reports/${endpoint}?${params}`);
        const blob = await res.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `report-${reportConfig.type}-${Date.now()}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
        toast.success(ar ? "تم التصدير" : "Exported successfully");
      }
    } catch {
      toast.error(ar ? "فشل الإنشاء" : "Failed to generate");
    } finally {
      setIsGenerating(false);
    }
  };

  const generatePdf = async (data: any) => {
    const doc = new jsPDF({
      orientation: "landscape",
      unit: "mm",
      format: "a4",
    });
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const MARGIN = 14;

    const systemLogoUrl = (settings as any)?.systemLogo;
    const activePropObj = properties.find(
      (p: any) => p.id === activePropertyId,
    );
    const propLogoUrl = (activePropObj as any)?.logo;

    const startY = await drawPdfHeader(doc, {
      systemLogoUrl,
      propLogoUrl,
      title: pdfTextSafe(data.titleAr || data.title) || "Report",
      subtitle: data.period
        ? `${pdfTextSafe(formatDate(data.period.from))} — ${pdfTextSafe(formatDate(data.period.to))}`
        : formatDate(new Date()),
      pageW,
    });

    doc.setDrawColor(201, 162, 77);
    doc.setLineWidth(0.8);
    doc.line(MARGIN, startY - 4, pageW - MARGIN, startY - 4);

    let y = startY;

    const drawTable = (title: string, rows: any[], headers?: string[]) => {
      if (!rows || rows.length === 0) return;
      if (y > pageH - 40) {
        doc.addPage();
        y = 20;
      }

      const keys = headers || Object.keys(rows[0]);
      const headRow = keys.map((k) =>
        pdfTextSafe(
          k
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s: string) => s.toUpperCase()),
        ),
      );
      const bodyRows = rows.map((row) =>
        keys.map((k) => {
          const val = row[k];
          if (val == null) return "—";
          if (typeof val === "object") return JSON.stringify(val);
          return pdfTextSafe(String(val));
        }),
      );

      doc.setFillColor(201, 162, 77);
      doc.rect(MARGIN, y - 4.5, 2.5, 5.5, "F");
      doc.setFontSize(9.5);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 42, 68);
      doc.text(pdfTextSafe(title), MARGIN + 4.5, y);
      y += 7;

      autoTable(doc, {
        startY: y,
        head: [headRow],
        body: bodyRows,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 8, cellPadding: 2.5, overflow: "linebreak" },
        headStyles: {
          fillColor: [15, 42, 68],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didDrawPage: (d: any) => {
          drawPdfFooter(doc, pageW, d.cursor?.y ? d.cursor.y + 8 : undefined);
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    };

    // Summary
    if (data.summary) {
      doc.setFontSize(10);
      doc.setFont("helvetica", "bold");
      doc.setTextColor(15, 42, 68);
      doc.text(ar ? "الملخص" : "Summary", MARGIN, y);
      y += 6;
      const summaryRows = Object.entries(data.summary).map(([k, v]) => [
        pdfTextSafe(
          k
            .replace(/([A-Z])/g, " $1")
            .replace(/^./, (s: string) => s.toUpperCase()),
        ),
        String(v ?? "—"),
      ]);
      autoTable(doc, {
        startY: y,
        head: [[ar ? "المقياس" : "Metric", ar ? "القيمة" : "Value"]],
        body: summaryRows,
        margin: { left: MARGIN, right: MARGIN },
        styles: { fontSize: 8.5, cellPadding: 3 },
        headStyles: {
          fillColor: [15, 42, 68],
          textColor: 255,
          fontStyle: "bold",
        },
        alternateRowStyles: { fillColor: [245, 247, 250] },
        didDrawPage: (d: any) => {
          drawPdfFooter(doc, pageW, d.cursor?.y ? d.cursor.y + 8 : undefined);
        },
      });
      y = (doc as any).lastAutoTable.finalY + 10;
    }

    // Department ranking
    if (data.departmentRanking)
      drawTable(
        ar ? "ترتيب الأقسام" : "Department Ranking",
        data.departmentRanking,
      );
    if (data.departmentSummary)
      drawTable(
        ar ? "ملخص الأقسام" : "Department Summary",
        data.departmentSummary,
      );
    if (data.departmentEngagement)
      drawTable(
        ar ? "مشاركة الأقسام" : "Department Engagement",
        data.departmentEngagement,
      );

    // Top items
    if (data.topItems && data.topItems.length > 0) {
      drawTable(
        ar ? "أعلى الأسئلة تقييماً" : "Top Rated Items",
        data.topItems.map((i: any) => ({
          Question: ar ? i.titleAr || i.titleEn : i.titleEn || i.titleAr,
          Responses: i.responseCount,
          "Avg Rating": i.avgRating,
        })),
      );
    }

    // Top activities
    if (data.topActivities && data.topActivities.length > 0) {
      drawTable(
        ar ? "أكثر الفعاليات تسجيلاً" : "Top Activities",
        data.topActivities.map((a: any) => ({
          Activity: ar ? a.titleAr || a.titleEn : a.titleEn || a.titleAr,
          Registered: a.totalRegistered,
          Attended: a.attendedCount,
          "Attendance %": `${a.attendanceRate}%`,
        })),
      );
    }

    // Most active profiles
    if (data.mostActive && data.mostActive.length > 0) {
      drawTable(
        ar ? "الموظفون الأكثر نشاطاً" : "Most Active Profiles",
        data.mostActive.map((e: any) => ({
          Name: e.name,
          Department: e.department,
          Evaluations: e.evaluations,
          Activities: e.activities,
          Total: e.totalEngagement,
        })),
      );
    }

    // Non-engaged
    if (data.nonEngaged && data.nonEngaged.length > 0) {
      drawTable(
        ar ? "موظفون غير مشاركين" : "Non-Engaged Profiles",
        data.nonEngaged,
      );
    }

    // Templates/Activities details
    if (data.templates) {
      for (const tpl of data.templates) {
        if (y > pageH - 40) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(201, 162, 77);
        doc.rect(MARGIN, y - 4.5, 2.5, 5.5, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 42, 68);
        doc.text(
          pdfTextSafe(
            ar ? tpl.titleAr || tpl.titleEn : tpl.titleEn || tpl.titleAr,
          ),
          MARGIN + 4.5,
          y,
        );
        y += 7;
        if (tpl.items && tpl.items.length > 0) {
          drawTable(
            ar ? "الأسئلة" : "Items",
            tpl.items.map((i: any) => ({
              Question: ar ? i.titleAr || i.titleEn : i.titleEn || i.titleAr,
              Type: i.type,
              Responses: i.responseCount,
              "Response Rate": `${i.responseRate}%`,
              Avg: i.type === "rating" ? i.avgRating : "-",
            })),
          );
        }
        if (tpl.departmentBreakdown && tpl.departmentBreakdown.length > 0) {
          drawTable(
            ar ? "تحليل الأقسام" : "Department Breakdown",
            tpl.departmentBreakdown,
          );
        }
      }
    }

    if (data.activities) {
      for (const act of data.activities) {
        if (y > pageH - 40) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(201, 162, 77);
        doc.rect(MARGIN, y - 4.5, 2.5, 5.5, "F");
        doc.setFontSize(10);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(15, 42, 68);
        doc.text(
          pdfTextSafe(
            ar ? act.titleAr || act.titleEn : act.titleEn || act.titleAr,
          ),
          MARGIN + 4.5,
          y,
        );
        y += 7;
        const actStats = [
          [ar ? "المسجلون" : "Registered", String(act.totalRegistered)],
          [ar ? "الحاضرون" : "Attended", String(act.attendedCount)],
          [ar ? "نسبة الحضور" : "Attendance", `${act.attendanceRate}%`],
        ];
        autoTable(doc, {
          startY: y,
          head: [],
          body: actStats,
          margin: { left: MARGIN, right: MARGIN },
          styles: { fontSize: 8, cellPadding: 2 },
          alternateRowStyles: { fillColor: [245, 247, 250] },
          didDrawPage: (d: any) => {
            drawPdfFooter(doc, pageW, d.cursor?.y ? d.cursor.y + 8 : undefined);
          },
        });
        y = (doc as any).lastAutoTable.finalY + 8;
      }
    }

    // Sections (custom report)
    if (data.sections) {
      for (const section of data.sections) {
        if (y > pageH - 40) {
          doc.addPage();
          y = 20;
        }
        doc.setFillColor(15, 42, 68);
        doc.rect(MARGIN, y - 5, pageW - MARGIN * 2, 8, "F");
        doc.setFontSize(11);
        doc.setFont("helvetica", "bold");
        doc.setTextColor(255, 255, 255);
        doc.text(
          pdfTextSafe(
            ar
              ? section.titleAr || section.title
              : section.title || section.titleAr,
          ),
          MARGIN + 3,
          y,
        );
        y += 10;

        if (section.summary) {
          const rows = Object.entries(section.summary).map(([k, v]) => [
            pdfTextSafe(
              k
                .replace(/([A-Z])/g, " $1")
                .replace(/^./, (s: string) => s.toUpperCase()),
            ),
            String(v ?? "—"),
          ]);
          autoTable(doc, {
            startY: y,
            head: [[ar ? "المقياس" : "Metric", ar ? "القيمة" : "Value"]],
            body: rows,
            margin: { left: MARGIN, right: MARGIN },
            styles: { fontSize: 8, cellPadding: 2 },
            headStyles: { fillColor: [15, 42, 68], textColor: 255 },
            alternateRowStyles: { fillColor: [245, 247, 250] },
            didDrawPage: (d: any) => {
              drawPdfFooter(
                doc,
                pageW,
                d.cursor?.y ? d.cursor.y + 8 : undefined,
              );
            },
          });
          y = (doc as any).lastAutoTable.finalY + 8;
        }
        if (section.departmentRanking)
          drawTable(
            ar ? "ترتيب الأقسام" : "Department Ranking",
            section.departmentRanking,
          );
        if (section.departmentSummary)
          drawTable(
            ar ? "ملخص الأقسام" : "Department Summary",
            section.departmentSummary,
          );
        if (section.departmentEngagement)
          drawTable(
            ar ? "مشاركة الأقسام" : "Department Engagement",
            section.departmentEngagement,
          );
        if (section.topItems)
          drawTable(ar ? "أعلى الأسئلة" : "Top Items", section.topItems);
        if (section.topActivities)
          drawTable(
            ar ? "أعلى الفعاليات" : "Top Activities",
            section.topActivities,
          );
        if (section.mostActive)
          drawTable(ar ? "الmost active" : "Most Active", section.mostActive);
      }
    }

    drawPdfFooter(doc, pageW);
    doc.save(getExportFileName(`Portal_Report_${data.type || "export"}`, "pdf"));
  };

  const toggleSection = (key: string) => {
    setExpandedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const reportTypes = [
    {
      value: "evaluations",
      label: ar ? "تقرير الاستبيانات" : "Evaluations Report",
      icon: Star,
    },
    {
      value: "activities",
      label: ar ? "تقرير الفعاليات" : "Activities Report",
      icon: Target,
    },
    {
      value: "engagement",
      label: ar ? "تقرير المشاركة" : "Engagement Report",
      icon: Users,
    },
    {
      value: "custom",
      label: ar ? "تقرير مخصص" : "Custom Report",
      icon: BarChart3,
    },
  ];

  const datePresets = [
    { value: "last_30", label: ar ? "آخر 30 يوم" : "Last 30 days" },
    { value: "last_90", label: ar ? "آخر 90 يوم" : "Last 90 days" },
    { value: "this_month", label: ar ? "هذا الشهر" : "This month" },
    { value: "last_month", label: ar ? "الشهر الماضي" : "Last month" },
    { value: "this_quarter", label: ar ? "هذا الربع" : "This quarter" },
    { value: "this_year", label: ar ? "هذا العام" : "This year" },
  ];

  if (isLoading) return <Skeleton className="h-96 w-full rounded-lg" />;

  if (reportsError) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-6 h-6 text-primary" />
          <h2 className="text-2xl font-bold">{ar ? "التقارير" : "Reports"}</h2>
        </div>
        <Card className="border-destructive/50 bg-destructive/5">
          <CardContent className="pt-6 text-center">
            <p className="text-sm text-destructive">
              {ar ? "فشل تحميل التقارير" : "Failed to load reports"}
            </p>
            <Button
              variant="outline"
              size="sm"
              className="mt-3"
              onClick={() => refetch()}
            >
              {ar ? "إعادة المحاولة" : "Retry"}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const summary = reportData?.summary || {};

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-primary" />
            {ar ? "التقارير" : "Reports"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? "إنشاء وتصدير التقارير التحليلية"
              : "Generate and export analytics reports"}
          </p>
        </div>
      </div>

      {/* ═══ KPI CARDS ═══ */}
      {reportData && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {reportConfig.type === "evaluations" && (
            <>
              <KPICard
                icon={Star}
                label={ar ? "متوسط التقييم" : "Avg Rating"}
                value={summary.globalAvgRating ?? 0}
                sub={`/ 5.0`}
                color="text-amber-500"
              />
              <KPICard
                icon={FileText}
                label={ar ? "إجمالي الردود" : "Total Responses"}
                value={summary.totalResponses ?? 0}
                sub={
                  ar
                    ? `${summary.uniqueRespondents ?? 0} موظف`
                    : `${summary.uniqueRespondents ?? 0} profiles`
                }
                color="text-blue-500"
              />
              <KPICard
                icon={Users}
                label={ar ? "نسبة الاستجابة" : "Response Rate"}
                value={`${summary.responseRate ?? 0}%`}
                sub={
                  ar
                    ? `من ${summary.totalProfiles ?? 0} موظف`
                    : `of ${summary.totalProfiles ?? 0} profiles`
                }
                color="text-green-500"
              />
              <KPICard
                icon={BarChart3}
                label={ar ? "عدد الاستبيانات" : "Templates"}
                value={summary.totalTemplates ?? 0}
                color="text-purple-500"
              />
            </>
          )}
          {reportConfig.type === "activities" && (
            <>
              <KPICard
                icon={Target}
                label={ar ? "إجمالي الفعاليات" : "Total Activities"}
                value={summary.totalActivities ?? 0}
                color="text-blue-500"
              />
              <KPICard
                icon={Users}
                label={ar ? "المسجلون" : "Registered"}
                value={summary.totalJoined ?? 0}
                sub={`${summary.participationRate ?? 0}% ${ar ? "مشاركة" : "participation"}`}
                color="text-green-500"
              />
              <KPICard
                icon={Star}
                label={ar ? "الحاضرون" : "Attended"}
                value={summary.totalAttended ?? 0}
                sub={`${summary.overallAttendanceRate ?? 0}% ${ar ? "حضور" : "attendance"}`}
                color="text-amber-500"
              />
              <KPICard
                icon={Calendar}
                label={ar ? "المهتمون" : "Interested"}
                value={summary.totalInterested ?? 0}
                color="text-purple-500"
              />
            </>
          )}
          {reportConfig.type === "engagement" && (
            <>
              <KPICard
                icon={TrendingUp}
                label={ar ? "نسبة المشاركة" : "Overall Score"}
                value={`${summary.overallScore ?? 0}%`}
                color="text-green-500"
              />
              <KPICard
                icon={Users}
                label={ar ? "الموظفون النشطون" : "Engaged"}
                value={summary.engagedProfiles ?? 0}
                sub={
                  ar
                    ? `من ${summary.totalProfiles ?? 0}`
                    : `of ${summary.totalProfiles ?? 0}`
                }
                color="text-blue-500"
              />
              <KPICard
                icon={Star}
                label={ar ? "نسبة التقييم" : "Evaluation Rate"}
                value={`${summary.evaluationRate ?? 0}%`}
                color="text-amber-500"
              />
              <KPICard
                icon={Target}
                label={ar ? "نسبة الحضور" : "Attendance Rate"}
                value={`${summary.attendanceRate ?? 0}%`}
                color="text-purple-500"
              />
            </>
          )}
          {reportConfig.type === "custom" && (
            <>
              <KPICard
                icon={BarChart3}
                label={ar ? "الأقسام" : "Modules"}
                value={summary.modulesGenerated ?? 0}
                color="text-blue-500"
              />
              <KPICard
                icon={FileText}
                label={ar ? "النوع" : "Modules"}
                value={summary.modules ?? ""}
                color="text-green-500"
              />
            </>
          )}
        </div>
      )}

      {/* ═══ REPORT CONFIG ═══ */}
      <Card className="border-primary/30 bg-primary/5">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base">
            <PlusCircle className="w-5 h-5" />
            {ar ? "إعداد التقرير" : "Report Configuration"}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>{ar ? "نوع التقرير" : "Report Type"}</Label>
              <Select
                value={reportConfig.type}
                onValueChange={(v) =>
                  setReportConfig({ ...reportConfig, type: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {reportTypes.map((t) => (
                    <SelectItem key={t.value} value={t.value}>
                      {t.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "القسم" : "Department"}</Label>
              <Select
                value={reportConfig.department}
                onValueChange={(v) =>
                  setReportConfig({ ...reportConfig, department: v })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    {ar ? "جميع الأقسام" : "All Departments"}
                  </SelectItem>
                  {departments.map((d: string) => (
                    <SelectItem key={d} value={d}>
                      {d}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "فترة سريعة" : "Quick Period"}</Label>
              <Select value={quickPeriod} onValueChange={applyDatePreset}>
                <SelectTrigger>
                  <SelectValue
                    placeholder={ar ? "اختر فترة..." : "Select period..."}
                  />
                </SelectTrigger>
                <SelectContent>
                  {datePresets.map((p) => (
                    <SelectItem key={p.value} value={p.value}>
                      {p.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{ar ? "من التاريخ" : "From Date"}</Label>
              <DateInput
                value={reportConfig.dateFrom}
                onChange={(iso) =>
                  setReportConfig({ ...reportConfig, dateFrom: iso })
                }
              />
            </div>

            <div className="space-y-2">
              <Label>{ar ? "إلى التاريخ" : "To Date"}</Label>
              <DateInput
                value={reportConfig.dateTo}
                onChange={(iso) =>
                  setReportConfig({ ...reportConfig, dateTo: iso })
                }
              />
            </div>

            {reportConfig.type === "custom" && (
              <div className="space-y-2">
                <Label>{ar ? "الأقسام" : "Modules"}</Label>
                <div className="flex gap-2 flex-wrap">
                  {["evaluations", "activities", "engagement"].map((m) => (
                    <label
                      key={m}
                      className="flex items-center gap-1.5 text-sm cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={reportConfig.modules.includes(m)}
                        onChange={(e) => {
                          const modules = e.target.checked
                            ? [...reportConfig.modules, m]
                            : reportConfig.modules.filter((x) => x !== m);
                          setReportConfig({ ...reportConfig, modules });
                        }}
                        className="w-3.5 h-3.5 rounded"
                      />
                      {m === "evaluations"
                        ? ar
                          ? "تقييمات"
                          : "Evaluations"
                        : m === "activities"
                          ? ar
                            ? "فعاليات"
                            : "Activities"
                          : ar
                            ? "مشاركة"
                            : "Engagement"}
                    </label>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex gap-2">
            <Button
              className="gap-2"
              onClick={() => handleExport("pdf")}
              disabled={isGenerating}
            >
              {isGenerating ? (
                <Loader className="w-4 h-4 animate-spin" />
              ) : (
                <Download className="w-4 h-4" />
              )}
              {ar ? "تصدير PDF" : "Export PDF"}
            </Button>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => handleExport("excel")}
              disabled={isGenerating}
            >
              <Download className="w-4 h-4" />
              {ar ? "تصدير Excel" : "Export Excel"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* ═══ REPORT DATA ═══ */}
      {reportData && (
        <div className="space-y-4">
          {/* Charts */}
          {reportData.charts && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base flex items-center gap-2">
                  <BarChart3 className="w-4 h-4" />
                  {ar ? "الرسوم البيانية" : "Charts"}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  {reportData.starDistribution && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "توزيع التقييمات" : "Rating Distribution"}
                      </p>
                      <StarBar distribution={reportData.starDistribution} />
                    </div>
                  )}
                  {reportData.charts.departmentScores && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "ترتيب الأقسام" : "Department Scores"}
                      </p>
                      <BarChart
                        data={Object.entries(
                          reportData.charts.departmentScores,
                        ).map(([k, v]) => ({
                          label: k,
                          value: v as number,
                          color: "bg-green-500",
                        }))}
                      />
                    </div>
                  )}
                  {reportData.charts.categoryBreakdown && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "توزيع التصنيفات" : "Category Breakdown"}
                      </p>
                      <BarChart
                        data={Object.entries(
                          reportData.charts.categoryBreakdown,
                        ).map(([k, v]) => ({
                          label: k,
                          value: v as number,
                          color: "bg-blue-500",
                        }))}
                      />
                    </div>
                  )}
                  {reportData.charts.monthlyTrend && (
                    <div>
                      <p className="text-sm font-medium mb-2">
                        {ar ? "الاتجاه الشهري" : "Monthly Trend"}
                      </p>
                      <BarChart
                        data={Object.entries(
                          reportData.charts.monthlyTrend,
                        ).map(([k, v]) => ({
                          label: k,
                          value: v as number,
                          color: "bg-purple-500",
                        }))}
                      />
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Department Ranking */}
          {reportData.departmentRanking &&
            reportData.departmentRanking.length > 0 && (
              <CollapsibleSection
                title={ar ? "ترتيب الأقسام" : "Department Ranking"}
                icon={<BarChart3 className="w-4 h-4" />}
                expanded={expandedSections.deptRanking !== false}
                onToggle={() => toggleSection("deptRanking")}
              >
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "القسم" : "Department"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "الموظفون" : "Profiles"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "الردود" : "Responses"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "نسبة الاستجابة" : "Response Rate"}
                        </th>
                        <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                          {ar ? "متوسط التقييم" : "Avg Rating"}
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {reportData.departmentRanking.map((d: any, i: number) => (
                        <tr key={i} className="border-b hover:bg-muted/20">
                          <td className="py-2 px-3 font-medium">
                            {d.department}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {d.totalProfiles}
                          </td>
                          <td className="py-2 px-3 text-center">
                            {d.responses}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <Badge
                              variant={
                                d.responseRate > 50 ? "default" : "outline"
                              }
                              className="text-xs"
                            >
                              {d.responseRate}%
                            </Badge>
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span
                              className={`font-bold ${d.avgRating >= 4 ? "text-green-600" : d.avgRating >= 3 ? "text-amber-600" : "text-red-600"}`}
                            >
                              {d.avgRating}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </CollapsibleSection>
            )}

          {/* Top Items */}
          {reportData.topItems && reportData.topItems.length > 0 && (
            <CollapsibleSection
              title={ar ? "أعلى الأسئلة تقييماً" : "Top Rated Items"}
              icon={<Star className="w-4 h-4" />}
              expanded={expandedSections.topItems !== false}
              onToggle={() => toggleSection("topItems")}
            >
              <div className="space-y-2">
                {reportData.topItems.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                  >
                    <span className="text-lg font-bold text-amber-500">
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {ar
                          ? item.titleAr || item.titleEn
                          : item.titleEn || item.titleAr}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.responseCount} {ar ? "رد" : "responses"} —{" "}
                        {item.responseRate}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                      <span className="font-bold text-amber-600">
                        {item.avgRating}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Lowest Items */}
          {reportData.lowestItems && reportData.lowestItems.length > 0 && (
            <CollapsibleSection
              title={ar ? "أقل الأسئلة تقييماً" : "Lowest Rated Items"}
              icon={<Star className="w-4 h-4 text-red-500" />}
              expanded={expandedSections.lowestItems !== false}
              onToggle={() => toggleSection("lowestItems")}
            >
              <div className="space-y-2">
                {reportData.lowestItems.map((item: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg bg-red-500/5 border border-red-500/10"
                  >
                    <span className="text-lg font-bold text-red-500">
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {ar
                          ? item.titleAr || item.titleEn
                          : item.titleEn || item.titleAr}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {item.responseCount} {ar ? "رد" : "responses"} —{" "}
                        {item.responseRate}%
                      </p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-red-400" />
                      <span className="font-bold text-red-600">
                        {item.avgRating}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Top Activities */}
          {reportData.topActivities && reportData.topActivities.length > 0 && (
            <CollapsibleSection
              title={ar ? "أكثر الفعاليات تسجيلاً" : "Top Activities"}
              icon={<Target className="w-4 h-4" />}
              expanded={expandedSections.topAct !== false}
              onToggle={() => toggleSection("topAct")}
            >
              <div className="space-y-2">
                {reportData.topActivities.map((act: any, i: number) => (
                  <div
                    key={i}
                    className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                  >
                    <span className="text-lg font-bold text-blue-500">
                      #{i + 1}
                    </span>
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {ar
                          ? act.titleAr || act.titleEn
                          : act.titleEn || act.titleAr}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {act.totalRegistered} {ar ? "مسجل" : "registered"}
                      </p>
                    </div>
                    <Badge
                      variant={act.attendanceRate > 50 ? "default" : "outline"}
                      className="text-xs"
                    >
                      {act.attendanceRate}% {ar ? "حضور" : "attendance"}
                    </Badge>
                  </div>
                ))}
              </div>
            </CollapsibleSection>
          )}

          {/* Empty Activities */}
          {reportData.emptyActivities &&
            reportData.emptyActivities.length > 0 && (
              <CollapsibleSection
                title={
                  ar
                    ? `فعاليات بدون تسجيل (${reportData.emptyActivities.length})`
                    : `Activities with No Registrations (${reportData.emptyActivities.length})`
                }
                icon={<Target className="w-4 h-4 text-muted-foreground" />}
                expanded={expandedSections.emptyAct !== false}
                onToggle={() => toggleSection("emptyAct")}
              >
                <div className="space-y-2">
                  {reportData.emptyActivities.map((act: any, i: number) => (
                    <div
                      key={i}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/10 border border-dashed border-border"
                    >
                      <div className="flex-1">
                        <p className="text-sm font-medium text-muted-foreground">
                          {ar
                            ? act.titleAr || act.titleEn
                            : act.titleEn || act.titleAr}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {act.category || "—"} —{" "}
                          {formatDate(act.startDate, "—")}
                        </p>
                      </div>
                      <Badge
                        variant="outline"
                        className="text-xs text-muted-foreground"
                      >
                        {ar ? "صفر تسجيل" : "0 registrations"}
                      </Badge>
                    </div>
                  ))}
                </div>
              </CollapsibleSection>
            )}

          {/* Most Active Profiles */}
          {reportData.mostActive && reportData.mostActive.length > 0 && (
            <CollapsibleSection
              title={ar ? "الموظفون الأكثر نشاطاً" : "Most Active Profiles"}
              icon={<Users className="w-4 h-4" />}
              expanded={expandedSections.mostActive !== false}
              onToggle={() => toggleSection("mostActive")}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        #
                      </th>
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "الاسم" : "Name"}
                      </th>
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "القسم" : "Department"}
                      </th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "تقييمات" : "Evaluations"}
                      </th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "فعاليات" : "Activities"}
                      </th>
                      <th className="text-center py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "إجمالي" : "Total"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.mostActive.map((e: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-muted/20">
                        <td className="py-2 px-3 font-bold text-primary">
                          {i + 1}
                        </td>
                        <td className="py-2 px-3 font-medium">{e.name}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {e.department}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {e.evaluations}
                        </td>
                        <td className="py-2 px-3 text-center">
                          {e.activities}
                        </td>
                        <td className="py-2 px-3 text-center font-bold">
                          {e.totalEngagement}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Non-Engaged */}
          {reportData.nonEngaged && reportData.nonEngaged.length > 0 && (
            <CollapsibleSection
              title={
                ar
                  ? `موظفون غير مشاركين (${reportData.nonEngaged.length})`
                  : `Non-Engaged Profiles (${reportData.nonEngaged.length})`
              }
              icon={<Users className="w-4 h-4 text-red-500" />}
              expanded={expandedSections.nonEngaged !== false}
              onToggle={() => toggleSection("nonEngaged")}
            >
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b">
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "الرقم الوظيفي" : "Profile ID"}
                      </th>
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "الاسم" : "Name"}
                      </th>
                      <th className="text-start py-2 px-3 text-muted-foreground font-medium">
                        {ar ? "القسم" : "Department"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {reportData.nonEngaged.map((e: any, i: number) => (
                      <tr key={i} className="border-b hover:bg-muted/20">
                        <td className="py-2 px-3 font-mono text-muted-foreground">
                          {e.profileId}
                        </td>
                        <td className="py-2 px-3 font-medium">{e.name}</td>
                        <td className="py-2 px-3 text-muted-foreground">
                          {e.department}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CollapsibleSection>
          )}

          {/* Custom Report Sections */}
          {reportData.sections &&
            reportData.sections.map((section: any, i: number) => (
              <CollapsibleSection
                key={i}
                title={
                  ar
                    ? section.titleAr || section.title
                    : section.title || section.titleAr
                }
                icon={<BarChart3 className="w-4 h-4" />}
                expanded={expandedSections[`section_${i}`] !== false}
                onToggle={() => toggleSection(`section_${i}`)}
              >
                {/* Summary */}
                {section.summary && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mb-4">
                    {Object.entries(section.summary)
                      .filter(
                        ([k]) => !["modulesGenerated", "modules"].includes(k),
                      )
                      .map(([k, v]) => (
                        <div
                          key={k}
                          className="p-2 rounded-lg bg-muted/20 text-center"
                        >
                          <p className="text-lg font-bold">{String(v)}</p>
                          <p className="text-xs text-muted-foreground">
                            {k
                              .replace(/([A-Z])/g, " $1")
                              .replace(/^./, (s) => s.toUpperCase())}
                          </p>
                        </div>
                      ))}
                  </div>
                )}
                {/* Top Items */}
                {section.topItems && section.topItems.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "أعلى الأسئلة تقييماً" : "Top Rated Items"}
                    </p>
                    <div className="space-y-1.5">
                      {section.topItems.map((item: any, j: number) => (
                        <div
                          key={j}
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                        >
                          <span className="text-sm font-bold text-amber-500">
                            #{j + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {ar
                                ? item.titleAr || item.titleEn
                                : item.titleEn || item.titleAr}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {item.responseCount} {ar ? "رد" : "responses"} —{" "}
                              {item.responseRate}%
                            </p>
                          </div>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 fill-amber-400 text-amber-400" />
                            <span className="font-bold text-amber-600">
                              {item.avgRating}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Top Activities */}
                {section.topActivities && section.topActivities.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "أكثر الفعاليات تسجيلاً" : "Top Activities"}
                    </p>
                    <div className="space-y-1.5">
                      {section.topActivities.map((act: any, j: number) => (
                        <div
                          key={j}
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                        >
                          <span className="text-sm font-bold text-blue-500">
                            #{j + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">
                              {ar
                                ? act.titleAr || act.titleEn
                                : act.titleEn || act.titleAr}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              {act.totalRegistered} {ar ? "مسجل" : "registered"}
                            </p>
                          </div>
                          <Badge
                            variant={
                              act.attendanceRate > 50 ? "default" : "outline"
                            }
                            className="text-xs"
                          >
                            {act.attendanceRate}% {ar ? "حضور" : "attendance"}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Most Active Profiles */}
                {section.mostActive && section.mostActive.length > 0 && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "الموظفون الأكثر نشاطاً" : "Most Active Profiles"}
                    </p>
                    <div className="space-y-1.5">
                      {section.mostActive.map((emp: any, j: number) => (
                        <div
                          key={j}
                          className="flex items-center gap-3 p-2 rounded-lg bg-muted/20"
                        >
                          <span className="text-sm font-bold text-primary">
                            #{j + 1}
                          </span>
                          <div className="flex-1">
                            <p className="text-sm font-medium">{emp.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {emp.department}
                            </p>
                          </div>
                          <span className="text-sm font-bold">
                            {emp.totalEngagement} {ar ? "نشاط" : "engagements"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Department Ranking */}
                {section.departmentRanking && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "ترتيب الأقسام" : "Department Ranking"}
                    </p>
                    <BarChart
                      data={section.departmentRanking.map((d: any) => ({
                        label: d.department,
                        value: d.avgRating,
                        color: "bg-green-500",
                      }))}
                    />
                  </div>
                )}
                {/* Department Summary */}
                {section.departmentSummary && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "ملخص الأقسام" : "Department Summary"}
                    </p>
                    <BarChart
                      data={section.departmentSummary.map((d: any) => ({
                        label: d.department,
                        value: d.registered,
                        color: "bg-blue-500",
                      }))}
                    />
                  </div>
                )}
                {/* Department Engagement */}
                {section.departmentEngagement && (
                  <div className="mb-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "مشاركة الأقسام" : "Department Engagement"}
                    </p>
                    <BarChart
                      data={section.departmentEngagement.map((d: any) => ({
                        label: d.department,
                        value: d.overallScore,
                        color: "bg-purple-500",
                      }))}
                    />
                  </div>
                )}
                {/* Data details (templates/activities in custom sections) */}
                {section.data && section.data.length > 0 && (
                  <div className="space-y-3">
                    <p className="text-sm font-medium">
                      {ar ? "التفاصيل" : "Details"}
                    </p>
                    {section.data.map((item: any, j: number) => (
                      <div
                        key={j}
                        className="p-3 rounded-lg bg-muted/10 border border-border"
                      >
                        <p className="text-sm font-medium mb-1">
                          {ar
                            ? item.titleAr || item.titleEn
                            : item.titleEn || item.titleAr}
                        </p>
                        <div className="flex gap-4 text-xs text-muted-foreground">
                          {item.totalResponses !== undefined && (
                            <span>
                              {ar ? "ردود" : "Responses"}: {item.totalResponses}
                            </span>
                          )}
                          {item.responseRate !== undefined && (
                            <span>
                              {ar ? "نسبة الاستجابة" : "Rate"}:{" "}
                              {item.responseRate}%
                            </span>
                          )}
                          {item.overallAvgRating !== undefined && (
                            <span>
                              {ar ? "متوسط التقييم" : "Avg"}:{" "}
                              {item.overallAvgRating}
                            </span>
                          )}
                          {item.totalRegistered !== undefined && (
                            <span>
                              {ar ? "مسجل" : "Registered"}:{" "}
                              {item.totalRegistered}
                            </span>
                          )}
                          {item.attendedCount !== undefined && (
                            <span>
                              {ar ? "حاضر" : "Attended"}: {item.attendedCount}
                            </span>
                          )}
                          {item.attendanceRate !== undefined && (
                            <span>
                              {ar ? "نسبة الحضور" : "Att. Rate"}:{" "}
                              {item.attendanceRate}%
                            </span>
                          )}
                        </div>
                        {item.starDistribution && (
                          <div className="mt-2">
                            <StarBar distribution={item.starDistribution} />
                          </div>
                        )}
                        {item.departmentBreakdown &&
                          item.departmentBreakdown.length > 0 && (
                            <div className="mt-2">
                              <BarChart
                                data={item.departmentBreakdown.map(
                                  (d: any) => ({
                                    label: d.department,
                                    value: d.responseCount || d.registered || 0,
                                    color: "bg-blue-500",
                                  }),
                                )}
                              />
                            </div>
                          )}
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>
            ))}

          {/* Trend */}
          {reportData.trend && reportData.trend.length > 0 && (
            <CollapsibleSection
              title={ar ? "الاتجاه عبر الزمن" : "Trend Over Time"}
              icon={<TrendingUp className="w-4 h-4" />}
              expanded={expandedSections.trend !== false}
              onToggle={() => toggleSection("trend")}
            >
              <BarChart
                data={reportData.trend.map((t: any) => ({
                  label: t.month,
                  value: t.count || t.total || 0,
                  color: "bg-indigo-500",
                }))}
              />
            </CollapsibleSection>
          )}

          {/* Templates/Activities detail */}
          {reportData.templates &&
            reportData.templates.map((tpl: any) => (
              <CollapsibleSection
                key={tpl.templateId}
                title={
                  ar ? tpl.titleAr || tpl.titleEn : tpl.titleEn || tpl.titleAr
                }
                icon={<FileText className="w-4 h-4" />}
                expanded={expandedSections[`tpl_${tpl.templateId}`] !== false}
                onToggle={() => toggleSection(`tpl_${tpl.templateId}`)}
              >
                <div className="grid grid-cols-3 gap-3 mb-4 text-center">
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold">{tpl.totalResponses}</p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "ردود" : "Responses"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold">{tpl.responseRate}%</p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "نسبة الاستجابة" : "Response Rate"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold text-amber-600">
                      {tpl.overallAvgRating}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "متوسط التقييم" : "Avg Rating"}
                    </p>
                  </div>
                </div>
                {tpl.starDistribution && (
                  <StarBar distribution={tpl.starDistribution} />
                )}
                {tpl.textResponses && tpl.textResponses.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">
                      {ar ? "ردود نصية" : "Text Responses"}
                    </p>
                    <div className="space-y-1.5 max-h-40 overflow-y-auto">
                      {tpl.textResponses.map((tr: any, i: number) => (
                        <div
                          key={i}
                          className="p-2 rounded bg-muted/20 text-xs"
                        >
                          <span className="font-medium text-muted-foreground">
                            {ar ? tr.question : tr.question}:
                          </span>{" "}
                          <span>{tr.text}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {tpl.departmentBreakdown &&
                  tpl.departmentBreakdown.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">
                        {ar ? "تحليل الأقسام" : "Department Breakdown"}
                      </p>
                      <BarChart
                        data={tpl.departmentBreakdown.map((d: any) => ({
                          label: d.department,
                          value: d.responseCount,
                          color: "bg-blue-500",
                        }))}
                      />
                    </div>
                  )}
              </CollapsibleSection>
            ))}

          {reportData.activities &&
            reportData.activities.map((act: any) => (
              <CollapsibleSection
                key={act.activityId}
                title={
                  ar ? act.titleAr || act.titleEn : act.titleEn || act.titleAr
                }
                icon={<Target className="w-4 h-4" />}
                expanded={expandedSections[`act_${act.activityId}`] !== false}
                onToggle={() => toggleSection(`act_${act.activityId}`)}
              >
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold">{act.totalRegistered}</p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "مسجل" : "Registered"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold">{act.joinedCount}</p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "منضم" : "Joined"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold text-green-600">
                      {act.attendedCount}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "حاضر" : "Attended"}
                    </p>
                  </div>
                  <div className="p-2 rounded-lg bg-muted/20">
                    <p className="text-lg font-bold text-amber-600">
                      {act.attendanceRate}%
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {ar ? "نسبة الحضور" : "Attendance"}
                    </p>
                  </div>
                </div>
                {act.departmentBreakdown &&
                  act.departmentBreakdown.length > 0 && (
                    <div className="mt-4">
                      <p className="text-sm font-medium mb-2">
                        {ar ? "تحليل الأقسام" : "Department Breakdown"}
                      </p>
                      <BarChart
                        data={act.departmentBreakdown.map((d: any) => ({
                          label: d.department,
                          value: d.registered,
                          color: "bg-blue-500",
                        }))}
                      />
                    </div>
                  )}
              </CollapsibleSection>
            ))}
        </div>
      )}
    </div>
  );
}

// ═══ COLLAPSIBLE SECTION ═══
function CollapsibleSection({
  title,
  icon,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  icon: React.ReactNode;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <button
        className="w-full flex items-center justify-between p-4 text-left hover:bg-muted/20 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center gap-2">
          {icon}
          <span className="font-medium text-sm">{title}</span>
        </div>
        {expanded ? (
          <ChevronUp className="w-4 h-4 text-muted-foreground" />
        ) : (
          <ChevronDown className="w-4 h-4 text-muted-foreground" />
        )}
      </button>
      {expanded && <CardContent className="pt-0">{children}</CardContent>}
    </Card>
  );
}
