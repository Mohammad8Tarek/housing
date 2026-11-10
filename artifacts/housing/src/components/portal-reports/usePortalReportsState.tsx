// State, effects and handlers of PortalReports (moved verbatim).
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate, getExportFileName } from "@/lib/date-utils";
import { toast } from "sonner";
import { useState } from "react";
import { BarChart3, Users, Star, Target } from "lucide-react";
import { useGetSettings, useListProperties } from "@workspace/api-client-react";
import { drawPdfHeader, drawPdfFooter, pdfTextSafe } from "@/lib/pdf-utils";
import jsPDF from "jspdf";
import autoTable from "jspdf-autotable";

export function usePortalReportsState({ defaultType }: { defaultType?: string } = {}) {
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

  const numericPropertyId = typeof activePropertyId === "number" ? activePropertyId : undefined;
  const { data: settings } = useGetSettings(
    { propertyId: numericPropertyId },
    { query: { enabled: !!numericPropertyId } as any },
  );
  const { data: _pData } = useListProperties({
    query: {
      staleTime: 5 * 60 * 1000,
      gcTime: 30 * 60 * 1000,
    } as any,
  });
  const properties = Array.isArray(_pData) ? _pData : ((_pData as any)?.data || []);

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
        rowPageBreak: "avoid",
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
        rowPageBreak: "avoid",
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
          rowPageBreak: "avoid",
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
            rowPageBreak: "avoid",
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
  return {
    defaultType,
    activePropertyId,
    language,
    ar,
    queryClient,
    reportConfig,
    setReportConfig,
    quickPeriod,
    setQuickPeriod,
    isGenerating,
    setIsGenerating,
    expandedSections,
    setExpandedSections,
    numericPropertyId,
    settings,
    _pData,
    properties,
    departments,
    reportData,
    isLoading,
    reportsError,
    refetch,
    applyDatePreset,
    handleExport,
    generatePdf,
    toggleSection,
    reportTypes,
    datePresets,
  };
}

export type PortalReportsState = ReturnType<typeof usePortalReportsState>;

// Values derived after PortalReports's loading/empty early returns (moved verbatim); the
// narrowed inputs (none) are passed in non-null.
export function buildPortalReportsView(s: PortalReportsState) {
  const { reportData } = s;


  const summary = reportData?.summary || {};
  return {
    summary,
  };
}

export type PortalReportsView = ReturnType<typeof buildPortalReportsView>;
