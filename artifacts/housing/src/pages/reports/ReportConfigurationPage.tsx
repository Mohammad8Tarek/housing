import { useState, useMemo, useEffect } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Link } from "wouter";
import { toast } from "sonner";

// Icons
import {
  SlidersHorizontal,
  ArrowLeft,
  ArrowRight,
  Download,
  FileSpreadsheet,
  Printer,
  BookmarkPlus,
  FolderOpen,
  RotateCcw,
  Check,
  CheckSquare,
  Square,
  Search,
  Building2,
  Layers,
  Briefcase,
  Award,
  Filter,
  Eye,
  Trash2,
  Calendar,
  Sparkles,
  Info,
  Clock,
  Settings2,
  Users,
  FileBarChart2,
} from "lucide-react";

// Components
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { DataPagination } from "@/components/DataPagination";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

// Config & Export
import {
  DATA_SOURCES,
  SOURCE_COLUMNS,
  DataSourceType,
  CustomColumnDef,
} from "./config/customReportConfig";
import { exportExcel } from "./utils/export";
import { printLuxuryReport, ReportKpiCard } from "./utils/luxury-report-engine";
import { formatDate } from "@/lib/date-utils";

export default function ReportConfigurationPage() {
  const { propertyId, propertySlug, properties, activePropertyId } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();
  const queryClient = useQueryClient();
  const ar = language === "ar";

  const canExport = can("reports", "export");
  const canEdit = can("reports", "edit") || can("reports", "create");

  const effectivePropId = useMemo(() => {
    if (activePropertyId && activePropertyId !== "all") return Number(activePropertyId);
    if (properties && properties.length > 0) return properties[0].id;
    return undefined;
  }, [activePropertyId, properties]);

  // ─── 1. State: Data Source & Columns ──────────────────────────────────────
  const [selectedSource, setSelectedSource] = useState<DataSourceType>("in_house");

  // Initialize selected columns to default columns of selected data source
  const [selectedColumnKeys, setSelectedColumnKeys] = useState<string[]>(() => {
    return SOURCE_COLUMNS["in_house"]
      .filter((c) => c.defaultSelected)
      .map((c) => c.key);
  });

  // Whenever dataSource changes, set default selected columns
  const handleSourceChange = (newSource: DataSourceType) => {
    setSelectedSource(newSource);
    setSelectedColumnKeys(
      SOURCE_COLUMNS[newSource]
        .filter((c) => c.defaultSelected)
        .map((c) => c.key),
    );
    setPage(1);
  };

  // ─── 2. State: Filters & Search ───────────────────────────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 300);

  const [filterBuilding, setFilterBuilding] = useState<string>("all");
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterJobLevel, setFilterJobLevel] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  // ─── 3. State: Presentation & Layout ──────────────────────────────────────
  const [orientation, setOrientation] = useState<"landscape" | "portrait">("landscape");
  const [showStats, setShowStats] = useState<boolean>(true);
  const [showSignatures, setShowSignatures] = useState<boolean>(true);
  const [customReportTitleAr, setCustomReportTitleAr] = useState<string>("");
  const [customReportTitleEn, setCustomReportTitleEn] = useState<string>("");
  const [customNotes, setCustomNotes] = useState<string>("");

  // ─── 4. State: Pagination ─────────────────────────────────────────────────
  const [page, setPage] = useState<number>(1);
  const [limit, setLimit] = useState<number>(20);

  // ─── 5. State: Templates Modals ───────────────────────────────────────────
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
  const [isLoadModalOpen, setIsLoadModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState("");
  const [templateNameEn, setTemplateNameEn] = useState("");

  // ─── Buildings & Floors for Filters ───────────────────────────────────────
  const { data: buildings = [] } = useQuery<any[]>({
    queryKey: ["buildings", effectivePropId],
    queryFn: async () => {
      const res = await fetch(`/api/buildings?propertyId=${effectivePropId}`, { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    enabled: !!effectivePropId,
  });

  const { data: floors = [] } = useQuery<any[]>({
    queryKey: ["floors", effectivePropId],
    queryFn: async () => {
      const res = await fetch(`/api/floors?propertyId=${effectivePropId}`, { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    enabled: !!effectivePropId,
  });

  const availableFloors = useMemo(() => {
    if (!filterBuilding || filterBuilding === "all") return floors;
    return floors.filter((f) => f.buildingId === Number(filterBuilding));
  }, [floors, filterBuilding]);

  // Lookup values for Departments & Job Titles
  const { data: departments = [] } = useQuery<string[]>({
    queryKey: ["lookup_departments", effectivePropId],
    queryFn: async () => {
      const res = await fetch(`/api/lookup_values?propertyId=${effectivePropId}&category=department`, { credentials: "include" });
      if (!res.ok) return [];
      const json = await res.json();
      return (json.data || json || []).map((v: any) => v.value || v);
    },
    enabled: !!effectivePropId,
  });

  // ─── Query: Fetch Report Data (Server-Side Paginated) ─────────────────────
  const currentFilters = useMemo(
    () => ({
      buildingId: filterBuilding,
      floorId: filterFloor,
      department: filterDepartment,
      jobLevel: filterJobLevel,
      gender: filterGender,
      status: filterStatus,
      dateFrom,
      dateTo,
      search: debouncedSearch,
    }),
    [
      filterBuilding,
      filterFloor,
      filterDepartment,
      filterJobLevel,
      filterGender,
      filterStatus,
      dateFrom,
      dateTo,
      debouncedSearch,
    ],
  );

  const {
    data: queryResponse,
    isLoading,
    isFetching,
    refetch,
  } = useQuery({
    queryKey: [
      "custom-report-data",
      effectivePropId,
      selectedSource,
      currentFilters,
      page,
      limit,
    ],
    queryFn: async () => {
      if (!effectivePropId) return { data: [], total: 0, stats: {} };
      const res = await fetch(`/api/reports/custom/query?propertyId=${effectivePropId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataSource: selectedSource,
          columns: selectedColumnKeys,
          filters: currentFilters,
          page,
          limit,
          fetchAll: false,
        }),
      });
      if (!res.ok) throw new Error("Failed to fetch report data");
      return await res.json();
    },
    enabled: !!effectivePropId,
  });

  const reportRows = queryResponse?.data || [];
  const totalCount = queryResponse?.total || 0;
  const reportStats = queryResponse?.stats || {};

  // ─── Query: Saved Templates ───────────────────────────────────────────────
  const { data: templates = [], refetch: refetchTemplates } = useQuery<any[]>({
    queryKey: ["custom-report-templates", effectivePropId],
    queryFn: async () => {
      if (!effectivePropId) return [];
      const res = await fetch(`/api/reports/custom/templates?propertyId=${effectivePropId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return json.templates || [];
    },
    enabled: !!effectivePropId,
  });

  // ─── Mutation: Save Template ──────────────────────────────────────────────
  const saveTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(`/api/reports/custom/templates?propertyId=${effectivePropId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error("Failed to save template");
      return await res.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم حفظ نموذج التقرير بنجاح" : "Template saved successfully");
      setIsSaveModalOpen(false);
      setTemplateName("");
      setTemplateNameEn("");
      refetchTemplates();
    },
    onError: (err: any) => {
      toast.error(err.message || (ar ? "فشل حفظ النموذج" : "Failed to save template"));
    },
  });

  // ─── Mutation: Delete Template ────────────────────────────────────────────
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/reports/custom/templates/${id}?propertyId=${effectivePropId}`, {
        method: "DELETE",
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete template");
      return await res.json();
    },
    onSuccess: () => {
      toast.success(ar ? "تم حذف النموذج بنجاح" : "Template deleted successfully");
      refetchTemplates();
    },
  });

  // Handle Load Template
  const handleApplyTemplate = (tmpl: any) => {
    try {
      if (tmpl.dataSource) {
        setSelectedSource(tmpl.dataSource);
      }
      if (Array.isArray(tmpl.columns) && tmpl.columns.length > 0) {
        setSelectedColumnKeys(tmpl.columns);
      }
      if (tmpl.filters) {
        setFilterBuilding(tmpl.filters.buildingId || "all");
        setFilterFloor(tmpl.filters.floorId || "all");
        setFilterDepartment(tmpl.filters.department || "all");
        setFilterJobLevel(tmpl.filters.jobLevel || "all");
        setFilterGender(tmpl.filters.gender || "all");
        setFilterStatus(tmpl.filters.status || "all");
        setDateFrom(tmpl.filters.dateFrom || "");
        setDateTo(tmpl.filters.dateTo || "");
        if (tmpl.filters.search) setSearchTerm(tmpl.filters.search);
      }
      if (tmpl.layoutOptions) {
        if (tmpl.layoutOptions.orientation) setOrientation(tmpl.layoutOptions.orientation);
        if (tmpl.layoutOptions.showStats !== undefined) setShowStats(tmpl.layoutOptions.showStats);
        if (tmpl.layoutOptions.showSignatures !== undefined) setShowSignatures(tmpl.layoutOptions.showSignatures);
        if (tmpl.layoutOptions.titleAr) setCustomReportTitleAr(tmpl.layoutOptions.titleAr);
        if (tmpl.layoutOptions.titleEn) setCustomReportTitleEn(tmpl.layoutOptions.titleEn);
        if (tmpl.layoutOptions.notes) setCustomNotes(tmpl.layoutOptions.notes);
      }
      setPage(1);
      setIsLoadModalOpen(false);
      toast.success(ar ? `تم استرجاع النموذج: ${tmpl.name}` : `Loaded template: ${tmpl.name}`);
    } catch (e: any) {
      toast.error(ar ? "حدث خطأ أثناء تحميل النموذج" : "Failed to load template");
    }
  };

  const handleSaveCurrentAsTemplate = () => {
    if (!templateName.trim()) {
      toast.error(ar ? "يرجى كتابة اسم النموذج" : "Please provide a template name");
      return;
    }
    saveTemplateMutation.mutate({
      name: templateName.trim(),
      nameEn: templateNameEn.trim() || undefined,
      dataSource: selectedSource,
      columns: selectedColumnKeys,
      filters: currentFilters,
      layoutOptions: {
        orientation,
        showStats,
        showSignatures,
        titleAr: customReportTitleAr,
        titleEn: customReportTitleEn,
        notes: customNotes,
      },
    });
  };

  // ─── Column Helpers ───────────────────────────────────────────────────────
  const allColumnsForSource = useMemo(() => {
    return SOURCE_COLUMNS[selectedSource] || [];
  }, [selectedSource]);

  // Group columns by category
  const categorizedColumns = useMemo(() => {
    const map = new Map<string, { title: string; titleAr: string; cols: CustomColumnDef[] }>();
    allColumnsForSource.forEach((col) => {
      const catKey = col.category;
      if (!map.has(catKey)) {
        map.set(catKey, {
          title: col.category,
          titleAr: col.categoryAr,
          cols: [],
        });
      }
      map.get(catKey)!.cols.push(col);
    });
    return Array.from(map.values());
  }, [allColumnsForSource]);

  const activeColumns = useMemo(() => {
    return allColumnsForSource.filter((c) => selectedColumnKeys.includes(c.key));
  }, [allColumnsForSource, selectedColumnKeys]);

  const toggleColumn = (key: string) => {
    if (selectedColumnKeys.includes(key)) {
      if (selectedColumnKeys.length <= 1) {
        toast.warning(ar ? "يجب اختيار عمود واحد على الأقل" : "Select at least one column");
        return;
      }
      setSelectedColumnKeys(selectedColumnKeys.filter((k) => k !== key));
    } else {
      setSelectedColumnKeys([...selectedColumnKeys, key]);
    }
  };

  const selectAllColumns = () => {
    setSelectedColumnKeys(allColumnsForSource.map((c) => c.key));
  };

  const resetToDefaultColumns = () => {
    setSelectedColumnKeys(
      allColumnsForSource.filter((c) => c.defaultSelected).map((c) => c.key),
    );
  };

  const resetFilters = () => {
    setFilterBuilding("all");
    setFilterFloor("all");
    setFilterDepartment("all");
    setFilterJobLevel("all");
    setFilterGender("all");
    setFilterStatus("all");
    setDateFrom("");
    setDateTo("");
    setSearchTerm("");
    setPage(1);
  };

  // ─── Export: Fetch All Filtered Rows for Export ────────────────────────────
  const fetchAllRowsForExport = async (): Promise<any[]> => {
    const res = await fetch(`/api/reports/custom/query?propertyId=${effectivePropId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        dataSource: selectedSource,
        columns: selectedColumnKeys,
        filters: currentFilters,
        fetchAll: true,
      }),
    });
    if (!res.ok) throw new Error("Failed to fetch export data");
    const json = await res.json();
    return json.data || [];
  };

  // ─── Export Excel ─────────────────────────────────────────────────────────
  const handleExportExcel = async () => {
    try {
      toast.loading(ar ? "جاري تحضير ملف Excel..." : "Generating Excel...");
      const fullRows = await fetchAllRowsForExport();
      toast.dismiss();

      if (!fullRows.length) {
        toast.warning(ar ? "لا توجد بيانات لتصديرها" : "No data to export");
        return;
      }

      // Map rows with localized column headers
      const exportData = fullRows.map((r, idx) => {
        const rowObj: Record<string, any> = {
          "#": idx + 1,
        };
        activeColumns.forEach((col) => {
          const headerName = ar ? col.labelAr : col.label;
          let val = r[col.key];
          if (col.type === "date" && val) {
            val = formatDate(val);
          } else if (val === true) {
            val = ar ? "نعم" : "Yes";
          } else if (val === false) {
            val = ar ? "لا" : "No";
          } else if (val === null || val === undefined) {
            val = "—";
          }
          rowObj[headerName] = val;
        });
        return rowObj;
      });

      const currentSrcDef = DATA_SOURCES.find((s) => s.id === selectedSource);
      const filename = customReportTitleEn
        ? customReportTitleEn.replace(/\s+/g, "_")
        : `${selectedSource}_custom_report`;

      exportExcel(filename, exportData);
      toast.success(ar ? "تم تصدير ملف Excel بنجاح" : "Excel exported successfully");
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || (ar ? "فشل تصدير Excel" : "Failed to export Excel"));
    }
  };

  // ─── Export Luxury PDF ────────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      toast.loading(ar ? "جاري تجهيز تقرير PDF الفاخر..." : "Generating Luxury PDF...");
      const fullRows = await fetchAllRowsForExport();
      toast.dismiss();

      if (!fullRows.length) {
        toast.warning(ar ? "لا توجد بيانات لتصديرها" : "No data to export");
        return;
      }

      const currentSrcDef = DATA_SOURCES.find((s) => s.id === selectedSource);
      const repTitleAr = customReportTitleAr || (ar ? currentSrcDef?.labelAr : currentSrcDef?.label) || "تقرير مخصص";
      const repTitleEn = customReportTitleEn || currentSrcDef?.label || "Custom Configured Report";

      // Build KPI cards from stats
      const kpis: ReportKpiCard[] = [];
      if (showStats) {
        kpis.push({
          label: "Total Records",
          labelAr: "إجمالي السجلات",
          value: totalCount,
          color: "gold",
        });
        if (reportStats.activeCount !== undefined) {
          kpis.push({
            label: "Active",
            labelAr: "الحالات النشطة",
            value: reportStats.activeCount,
            color: "green",
          });
        }
        if (reportStats.overallOccupancyPct) {
          kpis.push({
            label: "Occupancy Rate",
            labelAr: "نسبة الإشغال",
            value: reportStats.overallOccupancyPct,
            color: "blue",
          });
        }
        if (reportStats.totalRooms) {
          kpis.push({
            label: "Total Rooms",
            labelAr: "إجمالي الغرف",
            value: reportStats.totalRooms,
            color: "purple",
          });
        }
        if (reportStats.pendingCount !== undefined) {
          kpis.push({
            label: "Pending",
            labelAr: "قيد الانتظار",
            value: reportStats.pendingCount,
            color: "orange",
          });
        }
      }

      // Headers
      const headers = activeColumns.map((c) => (ar ? c.labelAr : c.label));

      // Rows 2D
      const rows2D = fullRows.map((r, idx) => {
        return activeColumns.map((col) => {
          let val = r[col.key];
          if (col.type === "date" && val) return formatDate(val);
          if (val === true) return ar ? "نعم" : "Yes";
          if (val === false) return ar ? "لا" : "No";
          if (val === null || val === undefined || val === "") return "—";
          return val;
        });
      });

      await printLuxuryReport({
        activeTab: "custom_configuration",
        title: repTitleEn,
        titleAr: repTitleAr,
        subtitle: customNotes || (ar ? "تقرير مخصص من إدارة السكن" : "Staff Housing Configured Report"),
        subtitleAr: customNotes || (ar ? "تقرير مخصص من إدارة السكن" : "Staff Housing Configured Report"),
        language: ar ? "ar" : "en",
        orientation,
        showKpis: showStats,
        showSignatures,
        properties,
        activePropertyId: effectivePropId,
        kpiCards: kpis,
        headers,
        rows: rows2D,
        signatures: {
          role1: "Prepared By: Housing Supervisor",
          role1Ar: "إعداد: مسؤول الإسكان",
          role2: "Reviewed By: Housing Manager",
          role2Ar: "مراجعة: مدير إدارة السكن",
          role3: "Approved By: HR Director",
          role3Ar: "اعتماد: مدير الموارد البشرية",
        },
        autoPrint: true,
      });

      toast.success(ar ? "تم فتح نافذة طباعة PDF الفاخر" : "Luxury PDF opened");
    } catch (err: any) {
      toast.dismiss();
      toast.error(err.message || (ar ? "فشل طباعة التقرير" : "Failed to print PDF"));
    }
  };

  const currentSourceDef = DATA_SOURCES.find((s) => s.id === selectedSource) || DATA_SOURCES[0];

  return (
    <div className="space-y-6 pb-16 animate-in fade-in duration-300">
      {/* ─── Header — matches Reports page style ──────────────────────── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-bold tracking-tight flex items-center gap-2">
            <SlidersHorizontal className="w-6 h-6 text-primary" />
            {ar ? "كنفجريشن ريبورت (مُنشئ التقارير المخصصة)" : "Configuration Report (Custom Builder)"}
          </h1>
          <Badge variant="outline" className="bg-primary/10 text-primary border-primary/20 text-xs font-bold">
            {ar ? "تحكم كامل" : "Full Control"}
          </Badge>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsLoadModalOpen(true)}
            className="flex items-center gap-2 rounded-xl border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200"
          >
            <FolderOpen className="w-4 h-4 text-amber-600" />
            <span>{ar ? "النماذج المحفوظة" : "Saved Templates"}</span>
            {templates.length > 0 && (
              <span className="w-5 h-5 rounded-full bg-amber-600 text-white text-[11px] font-bold flex items-center justify-center">
                {templates.length}
              </span>
            )}
          </Button>

          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setTemplateName(ar ? `تقرير ${currentSourceDef.labelAr} المخصص` : `${currentSourceDef.label} Custom`);
              setIsSaveModalOpen(true);
            }}
            className="flex items-center gap-2 rounded-xl border-primary/30 text-primary hover:bg-primary/10"
          >
            <BookmarkPlus className="w-4 h-4" />
            <span>{ar ? "حفظ كنموذج" : "Save as Template"}</span>
          </Button>

          <Button
            variant="ghost"
            size="sm"
            onClick={resetFilters}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground rounded-xl"
            title={ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
          >
            <RotateCcw className="w-4 h-4" />
            <span className="text-xs">{ar ? "تصفير" : "Reset"}</span>
          </Button>
        </div>
      </div>

      {/* ─── Navigation Tabs — matching Reports page TabsNav ────────────── */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 flex-wrap">
        <Link href={`/${propertySlug || "all"}/reports`}>
          <button
            className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all text-muted-foreground hover:text-foreground hover:bg-background/50"
          >
            <FileBarChart2 className="w-4 h-4 text-amber-500" />
            {ar ? "مركز التقارير الشاملة" : "All Reports"}
          </button>
        </Link>
        <button
          className="flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all bg-background text-foreground shadow-sm border"
        >
          <SlidersHorizontal className="w-4 h-4 text-primary" />
          {ar ? "كنفجريشن ريبورت (تقرير مخصص)" : "Configuration Report"}
        </button>
      </div>

      {/* ─── Step 1: Select Data Source (7 Core Engines) ───────────────────── */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
              1
            </span>
            {ar ? "اختيار مصدر البيانات الأساسي (Data Source)" : "Select Report Data Source"}
          </h2>
          <span className="text-xs text-muted-foreground">
            {ar ? `المصدر الحالي: ${currentSourceDef.labelAr}` : `Current: ${currentSourceDef.label}`}
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-2.5">
          {DATA_SOURCES.map((source) => {
            const isSelected = selectedSource === source.id;
            const Icon = source.icon;
            return (
              <button
                key={source.id}
                onClick={() => handleSourceChange(source.id)}
                className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition-all cursor-pointer relative overflow-hidden group ${
                  isSelected
                    ? "border-primary bg-primary/10 shadow-xs ring-2 ring-primary/30"
                    : "border-border/70 hover:border-primary/40 bg-card hover:bg-muted/40"
                }`}
              >
                {isSelected && (
                  <span className="absolute top-1.5 end-1.5 w-2 h-2 rounded-full bg-primary" />
                )}
                <div className={`p-2.5 rounded-xl mb-2 transition-transform group-hover:scale-110 ${source.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold leading-snug line-clamp-1">
                  {ar ? source.labelAr : source.label}
                </span>
                <span className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1 opacity-70">
                  {source.id}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ─── Step 2: Choose Columns Dynamically ───────────────────────────── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
            <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
              2
            </span>
            {ar ? "تحديد واختيار الأعمدة المطلوبة في التقرير (Column Chooser)" : "Choose Columns to Display"}
          </h2>

          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-semibold px-2.5 py-0.5">
              {ar
                ? `${selectedColumnKeys.length} من أصل ${allColumnsForSource.length} أعمدة مختارة`
                : `${selectedColumnKeys.length} of ${allColumnsForSource.length} columns selected`}
            </Badge>
            <Button variant="ghost" size="sm" onClick={selectAllColumns} className="h-7 text-xs px-2">
              {ar ? "تحديد الكل" : "Select All"}
            </Button>
            <Button variant="ghost" size="sm" onClick={resetToDefaultColumns} className="h-7 text-xs px-2 text-muted-foreground">
              {ar ? "الافتراضي" : "Default"}
            </Button>
          </div>
        </div>

        {/* Categorized Column Chooser */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 bg-card border rounded-2xl p-4">
          {categorizedColumns.map((cat, idx) => (
            <div key={idx} className="space-y-2.5 bg-muted/20 border border-muted/50 rounded-xl p-3">
              <div className="text-xs font-extrabold text-foreground/80 flex items-center justify-between border-b pb-1.5">
                <span>{ar ? cat.titleAr : cat.title}</span>
                <span className="text-[10px] text-muted-foreground">
                  ({cat.cols.filter((c) => selectedColumnKeys.includes(c.key)).length}/{cat.cols.length})
                </span>
              </div>
              <div className="flex flex-col gap-1.5">
                {cat.cols.map((col) => {
                  const checked = selectedColumnKeys.includes(col.key);
                  return (
                    <label
                      key={col.key}
                      onClick={() => toggleColumn(col.key)}
                      className={`flex items-center justify-between p-2 rounded-lg text-xs font-medium cursor-pointer transition-colors border ${
                        checked
                          ? "bg-primary/10 border-primary/30 text-foreground font-semibold"
                          : "bg-background/80 border-transparent hover:bg-muted/60 text-muted-foreground"
                      }`}
                    >
                      <div className="flex items-center gap-2">
                        {checked ? (
                          <CheckSquare className="w-4 h-4 text-primary shrink-0" />
                        ) : (
                          <Square className="w-4 h-4 text-muted-foreground/60 shrink-0" />
                        )}
                        <span>{ar ? col.labelAr : col.label}</span>
                      </div>
                      <Badge variant="outline" className="text-[9px] px-1 py-0 opacity-70">
                        {col.type}
                      </Badge>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Step 3: Multi-Criteria Filter Engine ─────────────────────────── */}
      <div className="space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
            3
          </span>
          {ar ? "الفلاتر والبحث المتقدم (Multi-Criteria Filters)" : "Multi-Criteria Filters & Search"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 bg-card border rounded-2xl p-4">
          {/* Search Box */}
          <div className="space-y-1 col-span-1 sm:col-span-2">
            <Label className="text-xs font-medium">{ar ? "بحث سريع بالاسم / الرقم / الغرفة" : "Search Name, ID, Room"}</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute start-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder={ar ? "ابحث بالاسم، الرقم الوظيفي، الغرفة..." : "Search..."}
                className="ps-8 text-xs h-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Building Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "المبنى" : "Building"}</Label>
            <Select
              value={filterBuilding}
              onValueChange={(val) => {
                setFilterBuilding(val);
                setFilterFloor("all");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
                {buildings.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Floor Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "الدور / الطابق" : "Floor"}</Label>
            <Select
              value={filterFloor}
              onValueChange={(val) => {
                setFilterFloor(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الأدوار" : "All Floors"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأدوار" : "All Floors"}</SelectItem>
                {availableFloors.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {ar ? `الدور ${f.number}` : `Floor ${f.number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "القسم" : "Department"}</Label>
            <Select
              value={filterDepartment}
              onValueChange={(val) => {
                setFilterDepartment(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الأقسام" : "All Departments"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأقسام" : "All Departments"}</SelectItem>
                {departments.map((d: string) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Job Level Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "الدرجة الوظيفية" : "Job Level"}</Label>
            <Select
              value={filterJobLevel}
              onValueChange={(val) => {
                setFilterJobLevel(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الدرجات" : "All Levels"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الدرجات" : "All Levels"}</SelectItem>
                <SelectItem value="0">{ar ? "Level 0 - إدارة عليا (GM)" : "Level 0 - Executive"}</SelectItem>
                <SelectItem value="1">{ar ? "Level 1 - مدراء أقسام (Dept Head)" : "Level 1 - Dept Head"}</SelectItem>
                <SelectItem value="2">{ar ? "Level 2 - مشرفين (Supervisors)" : "Level 2 - Supervisors"}</SelectItem>
                <SelectItem value="3">{ar ? "Level 3 - موظفي تشغيل (Staff)" : "Level 3 - Staff"}</SelectItem>
                <SelectItem value="4">{ar ? "Level 4 - عمالة مساعدة (Support)" : "Level 4 - Support"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gender Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "النوع" : "Gender"}</Label>
            <Select
              value={filterGender}
              onValueChange={(val) => {
                setFilterGender(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "الكل" : "All Genders"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
                <SelectItem value="MALE">{ar ? "ذكور" : "Male"}</SelectItem>
                <SelectItem value="FEMALE">{ar ? "إناث" : "Female"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "الحالة" : "Status"}</Label>
            <Select
              value={filterStatus}
              onValueChange={(val) => {
                setFilterStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "الكل" : "All Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "All Status"}</SelectItem>
                {selectedSource === "in_house" && (
                  <>
                    <SelectItem value="ACTIVE">{ar ? "نشط بالسكن" : "Active"}</SelectItem>
                    <SelectItem value="VACATION">{ar ? "في إجازة" : "On Vacation"}</SelectItem>
                    <SelectItem value="COMPLETED">{ar ? "غادر / منتهي" : "Checked Out"}</SelectItem>
                  </>
                )}
                {selectedSource === "rooms" && (
                  <>
                    <SelectItem value="available">{ar ? "شاغر متاح" : "Available"}</SelectItem>
                    <SelectItem value="occupied">{ar ? "مشغول" : "Occupied"}</SelectItem>
                    <SelectItem value="dirty">{ar ? "متسخ" : "Dirty"}</SelectItem>
                    <SelectItem value="out_of_service">{ar ? "خارج الخدمة" : "Out of Service"}</SelectItem>
                  </>
                )}
                {selectedSource === "maintenance" && (
                  <>
                    <SelectItem value="open">{ar ? "مفتوح / قيد المتابعة" : "Open"}</SelectItem>
                    <SelectItem value="in_progress">{ar ? "جاري الإصلاح" : "In Progress"}</SelectItem>
                    <SelectItem value="resolved">{ar ? "تم الإصلاح" : "Resolved"}</SelectItem>
                  </>
                )}
                {selectedSource === "reservations" && (
                  <>
                    <SelectItem value="pending">{ar ? "معلق" : "Pending"}</SelectItem>
                    <SelectItem value="confirmed">{ar ? "مؤكد" : "Confirmed"}</SelectItem>
                    <SelectItem value="cancelled">{ar ? "ملغي" : "Cancelled"}</SelectItem>
                  </>
                )}
                {selectedSource === "vacations" && (
                  <>
                    <SelectItem value="ACTIVE">{ar ? "في إجازة حالياً" : "On Vacation"}</SelectItem>
                    <SelectItem value="RETURNED">{ar ? "عاد للعمل" : "Returned"}</SelectItem>
                    <SelectItem value="OVERDUE">{ar ? "متأخر عن العودة" : "Overdue"}</SelectItem>
                  </>
                )}
                {selectedSource === "hostings" && (
                  <>
                    <SelectItem value="approved">{ar ? "معتمد" : "Approved"}</SelectItem>
                    <SelectItem value="pending">{ar ? "قيد المراجعة" : "Pending"}</SelectItem>
                    <SelectItem value="completed">{ar ? "منتهي" : "Completed"}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "من تاريخ" : "From Date"}</Label>
            <Input
              type="date"
              value={dateFrom}
              onChange={(e) => {
                setDateFrom(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "إلى تاريخ" : "To Date"}</Label>
            <Input
              type="date"
              value={dateTo}
              onChange={(e) => {
                setDateTo(e.target.value);
                setPage(1);
              }}
              className="h-9 text-xs"
            />
          </div>
        </div>
      </div>

      {/* ─── Step 4: Layout & Print Output Customizer ─────────────────────── */}
      <div className="bg-card border rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex items-center gap-2">
            <Label className="text-xs font-bold text-foreground">{ar ? "اتجاه التقرير:" : "Orientation:"}</Label>
            <div className="flex items-center bg-muted/60 p-1 rounded-xl border">
              <button
                type="button"
                onClick={() => setOrientation("landscape")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  orientation === "landscape"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ar ? "📃 أفقي (Landscape)" : "Landscape"}
              </button>
              <button
                type="button"
                onClick={() => setOrientation("portrait")}
                className={`px-3 py-1 rounded-lg text-xs font-bold transition-all ${
                  orientation === "portrait"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ar ? "📄 عمودي (Portrait)" : "Portrait"}
              </button>
            </div>
          </div>

          <div className="h-5 w-px bg-border/60 hidden md:block" />

          {/* Show Stats Toggle */}
          <div className="flex items-center gap-2">
            <Switch id="toggle-stats" checked={showStats} onCheckedChange={setShowStats} />
            <Label htmlFor="toggle-stats" className="text-xs font-medium cursor-pointer">
              {ar ? "عرض كروت الإحصائيات (KPIs)" : "Show KPI Cards"}
            </Label>
          </div>

          <div className="h-5 w-px bg-border/60 hidden md:block" />

          {/* Show Signatures Toggle */}
          <div className="flex items-center gap-2">
            <Switch id="toggle-sigs" checked={showSignatures} onCheckedChange={setShowSignatures} />
            <Label htmlFor="toggle-sigs" className="text-xs font-medium cursor-pointer">
              {ar ? "صناديق التوقيع والاعتماد" : "Signature Blocks"}
            </Label>
          </div>
        </div>

        {/* Custom Title Input */}
        <div className="flex items-center gap-2 max-w-sm w-full">
          <Input
            value={customReportTitleAr}
            onChange={(e) => setCustomReportTitleAr(e.target.value)}
            placeholder={ar ? "عنوان التقرير بالعربية (اختياري)..." : "Arabic Report Title (Optional)..."}
            className="text-xs h-9"
          />
        </div>
      </div>

      {/* ─── Step 5: Live Interactive Data Grid & Action Toolbar ──────────── */}
      <div className="space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
              <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
                5
              </span>
              {ar ? "المعاينة الحية للتقرير (Live Data Preview)" : "Live Data Preview"}
            </h2>
            {isFetching && (
              <span className="text-xs text-primary font-semibold animate-pulse flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-primary" />
                {ar ? "جاري التحديث..." : "Updating..."}
              </span>
            )}
          </div>

          {/* Export Toolbar */}
          <div className="flex items-center gap-2">
            <Button
              onClick={handleExportPDF}
              disabled={isLoading || !reportRows.length}
              size="sm"
              className="bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl shadow-xs flex items-center gap-1.5"
            >
              <Printer className="w-4 h-4" />
              <span>{ar ? "تصدير PDF فاخر" : "Export Luxury PDF"}</span>
            </Button>

            <Button
              onClick={handleExportExcel}
              disabled={isLoading || !reportRows.length}
              size="sm"
              variant="outline"
              className="rounded-xl border-emerald-300 dark:border-emerald-700 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-50 dark:hover:bg-emerald-950/20 flex items-center gap-1.5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              <span>{ar ? "تصدير إكسيل" : "Export Excel (.xlsx)"}</span>
            </Button>
          </div>
        </div>

        {/* Live Table Container */}
        <div className="border rounded-2xl bg-card overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-start border-collapse">
              <thead>
                <tr className="bg-muted/70 border-b border-border/80 text-muted-foreground font-bold">
                  <th className="py-3 px-3 text-center w-12 border-e border-border/50">#</th>
                  {activeColumns.map((col) => (
                    <th key={col.key} className="py-3 px-3.5 text-start font-extrabold text-foreground border-e border-border/50 whitespace-nowrap">
                      {ar ? col.labelAr : col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border/60">
                {isLoading ? (
                  Array.from({ length: 5 }).map((_, rIdx) => (
                    <tr key={rIdx} className="animate-pulse">
                      <td className="py-3 px-3 text-center border-e">
                        <div className="h-4 w-5 bg-muted rounded mx-auto" />
                      </td>
                      {activeColumns.map((col) => (
                        <td key={col.key} className="py-3 px-3.5 border-e">
                          <div className="h-4 w-24 bg-muted rounded" />
                        </td>
                      ))}
                    </tr>
                  ))
                ) : reportRows.length === 0 ? (
                  <tr>
                    <td colSpan={activeColumns.length + 1} className="py-12 text-center text-muted-foreground">
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Info className="w-8 h-8 text-muted-foreground/50" />
                        <span className="text-sm font-semibold">
                          {ar ? "لا توجد سجلات مطابقة للفلاتر المحددة" : "No records match the current filters"}
                        </span>
                        <Button variant="ghost" size="sm" onClick={resetFilters} className="text-xs text-primary">
                          {ar ? "تصفير الفلاتر" : "Reset Filters"}
                        </Button>
                      </div>
                    </td>
                  </tr>
                ) : (
                  reportRows.map((row: any, rIdx: number) => {
                    const rowSeq = (page - 1) * limit + rIdx + 1;
                    return (
                      <tr key={row.id || rIdx} className="hover:bg-muted/30 transition-colors">
                        <td className="py-2.5 px-3 text-center font-bold text-muted-foreground border-e border-border/50">
                          {rowSeq}
                        </td>
                        {activeColumns.map((col) => {
                          const val = row[col.key];
                          return (
                            <td key={col.key} className="py-2.5 px-3.5 border-e border-border/50 whitespace-nowrap">
                              {col.key === "occupantDetails" ? (
                                val && val !== "—" ? (
                                  <div className="flex flex-wrap items-center gap-1.5 min-w-[200px] max-w-[380px] whitespace-normal">
                                    {String(val).split(" | ").map((item, idx) => (
                                      <span
                                        key={idx}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-semibold bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-300/40 shadow-xs"
                                      >
                                        <Users className="w-3 h-3 text-amber-600 dark:text-amber-400 shrink-0" />
                                        <span>{item}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <Badge variant="outline" className="text-[10px] text-muted-foreground/70 bg-muted/20 font-normal">
                                    {ar ? "شاغرة (بدون ساكن)" : "Vacant"}
                                  </Badge>
                                )
                              ) : col.type === "badge" ? (
                                <Badge variant="outline" className="text-[11px] font-semibold bg-background">
                                  {val || "—"}
                                </Badge>
                              ) : col.type === "date" ? (
                                <span className="font-mono text-xs">{val ? formatDate(val) : "—"}</span>
                              ) : col.type === "status" ? (
                                <Badge
                                  className={`text-[11px] font-bold ${
                                    String(val).toLowerCase().includes("active") || String(val).toLowerCase().includes("available") || String(val).toLowerCase().includes("resolved")
                                      ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 border-emerald-300"
                                      : String(val).toLowerCase().includes("vacation") || String(val).toLowerCase().includes("pending")
                                      ? "bg-amber-500/10 text-amber-700 dark:text-amber-400 border-amber-300"
                                      : "bg-muted text-muted-foreground"
                                  }`}
                                  variant="outline"
                                >
                                  {val || "—"}
                                </Badge>
                              ) : col.type === "boolean" ? (
                                <span>{val ? (ar ? "نعم" : "Yes") : (ar ? "لا" : "No")}</span>
                              ) : (
                                <span className={col.type === "id" ? "font-mono font-bold" : ""}>
                                  {val !== undefined && val !== null && val !== "" ? String(val) : "—"}
                                </span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination Controls */}
          <div className="p-3 border-t bg-muted/20">
            <DataPagination
              total={totalCount}
              pageSize={limit}
              currentPage={page}
              onPageChange={setPage}
              onPageSizeChange={(newLimit) => {
                setLimit(newLimit);
                setPage(1);
              }}
            />
          </div>
        </div>
      </div>

      {/* ─── Modal: Save Current Setup as Named Template ───────────────────── */}
      <Dialog open={isSaveModalOpen} onOpenChange={setIsSaveModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <BookmarkPlus className="w-5 h-5 text-primary" />
              {ar ? "حفظ كنموذج تقرير مخصص" : "Save as Custom Template"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <p className="text-muted-foreground">
              {ar
                ? "سيتم حفظ مصدر البيانات والأعمدة المختارة والفلاتر الحالية لتقوم بتشغيل هذا التقرير بضغطة زر واحدة في أي وقت."
                : "Save your current data source, selected columns, and filters to run this custom report in one click anytime."}
            </p>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? "اسم النموذج بالعربية *" : "Template Name (Arabic) *"}</Label>
              <Input
                value={templateName}
                onChange={(e) => setTemplateName(e.target.value)}
                placeholder={ar ? "مثال: كشف غرف الدور الثاني المميزة" : "e.g. 2nd Floor VIP Rooms"}
                className="text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? "الاسم بالإنجليزية (اختياري)" : "Template Name (English)"}</Label>
              <Input
                value={templateNameEn}
                onChange={(e) => setTemplateNameEn(e.target.value)}
                placeholder="e.g. VIP Floor 2 Rooms"
                className="text-xs"
              />
            </div>

            <div className="p-3 rounded-xl bg-muted/40 border space-y-1 text-[11px]">
              <div className="flex justify-between">
                <span className="text-muted-foreground">{ar ? "مصدر البيانات:" : "Data Source:"}</span>
                <span className="font-bold">{ar ? currentSourceDef.labelAr : currentSourceDef.label}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{ar ? "الأعمدة المحددة:" : "Columns:"}</span>
                <span className="font-bold">{selectedColumnKeys.length}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">{ar ? "الاتجاه:" : "Orientation:"}</span>
                <span className="font-bold">{orientation}</span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="ghost" size="sm" onClick={() => setIsSaveModalOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleSaveCurrentAsTemplate}
              disabled={saveTemplateMutation.isPending || !templateName.trim()}
              className="bg-primary text-primary-foreground font-bold"
            >
              {saveTemplateMutation.isPending ? (ar ? "جاري الحفظ..." : "Saving...") : (ar ? "حفظ النموذج" : "Save Template")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ─── Modal: Load Saved Templates ───────────────────────────────────── */}
      <Dialog open={isLoadModalOpen} onOpenChange={setIsLoadModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <FolderOpen className="w-5 h-5 text-amber-600" />
              {ar ? "النماذج المحفوظة المسبقة" : "Saved Report Templates"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs max-h-[60vh] overflow-y-auto">
            {templates.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <BookmarkPlus className="w-8 h-8 text-muted-foreground/40 mx-auto mb-2" />
                <p>{ar ? "لا توجد نماذج محفوظة حتى الآن." : "No saved templates found yet."}</p>
                <p className="text-[11px] mt-1">
                  {ar ? "قم بتهيئة تقريرك ثم اضغط 'حفظ كنموذج' للاسترجاع لاحقاً." : "Configure a report and click 'Save as Template'."}
                </p>
              </div>
            ) : (
              templates.map((tmpl) => {
                const src = DATA_SOURCES.find((s) => s.id === tmpl.dataSource) || DATA_SOURCES[0];
                const Icon = src.icon;
                return (
                  <div
                    key={tmpl.id}
                    className="flex items-center justify-between p-3 rounded-xl border bg-card hover:bg-muted/30 transition-all gap-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg shrink-0 ${src.color}`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div>
                        <h4 className="font-bold text-sm text-foreground">{tmpl.name}</h4>
                        {tmpl.nameEn && <p className="text-[11px] text-muted-foreground">{tmpl.nameEn}</p>}
                        <div className="flex items-center gap-2 mt-1 text-[10px] text-muted-foreground">
                          <Badge variant="outline" className="text-[9px] py-0">
                            {ar ? src.labelAr : src.label}
                          </Badge>
                          <span>• {Array.isArray(tmpl.columns) ? tmpl.columns.length : 0} {ar ? "عمود" : "cols"}</span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        size="sm"
                        onClick={() => handleApplyTemplate(tmpl)}
                        className="h-8 text-xs font-bold rounded-lg bg-primary/10 hover:bg-primary text-primary hover:text-primary-foreground border-primary/20"
                      >
                        {ar ? "تطبيق" : "Apply"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => deleteTemplateMutation.mutate(tmpl.id)}
                        className="h-8 w-8 text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/20"
                        title={ar ? "حذف النموذج" : "Delete"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setIsLoadModalOpen(false)}>
              {ar ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
