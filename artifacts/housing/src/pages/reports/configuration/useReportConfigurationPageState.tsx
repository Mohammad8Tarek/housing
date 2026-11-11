// State, effects and handlers of ReportConfigurationPage (moved verbatim).
import { useState, useMemo } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { useGetSettings } from "@workspace/api-client-react";
import {
  DATA_SOURCES,
  SOURCE_COLUMNS,
  DataSourceType,
  CustomColumnDef,
} from "../config/customReportConfig";
import { exportExcel } from "../utils/export";
import { formatDate } from "@/lib/date-utils";
import type {
  ReportColumnConfig,
  ReportKpiItem,
} from "../components/PrintableReportDocument";

export function useReportConfigurationPageState() {
  const { propertySlug, properties, activePropertyId } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();
  const queryClient = useQueryClient();
  const ar = language === "ar";

  const canAccessConfig = can("reports", "config");
  const canExport = can("reports", "export");
  const canEdit = can("reports", "edit") || can("reports", "create");

  const effectivePropId = useMemo(() => {
    if (activePropertyId && activePropertyId !== "all")
      return Number(activePropertyId);
    if (properties && properties.length > 0) return properties[0].id;
    return undefined;
  }, [activePropertyId, properties]);

  const { data: settings } = useGetSettings(
    { propertyId: effectivePropId },
    {
      query: {
        queryKey: ["settings", effectivePropId],
        enabled: !!effectivePropId,
      },
    },
  );

  // ─── 1. State: Data Source & Columns ──────────────────────────────────────
  const [selectedSource, setSelectedSource] =
    useState<DataSourceType>("in_house");

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
  const [orientation, setOrientation] = useState<"landscape" | "portrait">(
    "landscape",
  );
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
      const res = await fetch(`/api/buildings?propertyId=${effectivePropId}`, {
        credentials: "include",
      });
      if (!res.ok) return [];
      const json = await res.json();
      return Array.isArray(json) ? json : json.data || [];
    },
    enabled: !!effectivePropId,
  });

  const { data: floors = [] } = useQuery<any[]>({
    queryKey: ["floors", effectivePropId],
    queryFn: async () => {
      const res = await fetch(`/api/floors?propertyId=${effectivePropId}`, {
        credentials: "include",
      });
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
      const res = await fetch(
        `/api/lookup-values?propertyId=${effectivePropId}&category=department`,
        { credentials: "include" },
      );
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
      const res = await fetch(
        `/api/reports/custom/query?propertyId=${effectivePropId}`,
        {
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
        },
      );
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
      const res = await fetch(
        `/api/reports/custom/templates?propertyId=${effectivePropId}`,
        {
          credentials: "include",
        },
      );
      if (!res.ok) return [];
      const json = await res.json();
      return json.templates || [];
    },
    enabled: !!effectivePropId,
  });

  // ─── Mutation: Save Template ──────────────────────────────────────────────
  const saveTemplateMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch(
        `/api/reports/custom/templates?propertyId=${effectivePropId}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify(payload),
        },
      );
      if (!res.ok) throw new Error("Failed to save template");
      return await res.json();
    },
    onSuccess: () => {
      toast.success(
        ar ? "تم حفظ نموذج التقرير بنجاح" : "Template saved successfully",
      );
      setIsSaveModalOpen(false);
      setTemplateName("");
      setTemplateNameEn("");
      refetchTemplates();
    },
    onError: (err: any) => {
      toast.error(
        err.message || (ar ? "فشل حفظ النموذج" : "Failed to save template"),
      );
    },
  });

  // ─── Mutation: Delete Template ────────────────────────────────────────────
  const deleteTemplateMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(
        `/api/reports/custom/templates/${id}?propertyId=${effectivePropId}`,
        {
          method: "DELETE",
          credentials: "include",
        },
      );
      if (!res.ok) throw new Error("Failed to delete template");
      return await res.json();
    },
    onSuccess: () => {
      toast.success(
        ar ? "تم حذف النموذج بنجاح" : "Template deleted successfully",
      );
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
        if (tmpl.layoutOptions.orientation)
          setOrientation(tmpl.layoutOptions.orientation);
        if (tmpl.layoutOptions.showStats !== undefined)
          setShowStats(tmpl.layoutOptions.showStats);
        if (tmpl.layoutOptions.showSignatures !== undefined)
          setShowSignatures(tmpl.layoutOptions.showSignatures);
        if (tmpl.layoutOptions.titleAr)
          setCustomReportTitleAr(tmpl.layoutOptions.titleAr);
        if (tmpl.layoutOptions.titleEn)
          setCustomReportTitleEn(tmpl.layoutOptions.titleEn);
        if (tmpl.layoutOptions.notes) setCustomNotes(tmpl.layoutOptions.notes);
      }
      setPage(1);
      setIsLoadModalOpen(false);
      toast.success(
        ar
          ? `تم استرجاع النموذج: ${tmpl.name}`
          : `Loaded template: ${tmpl.name}`,
      );
    } catch (e: any) {
      toast.error(
        ar ? "حدث خطأ أثناء تحميل النموذج" : "Failed to load template",
      );
    }
  };

  const handleSaveCurrentAsTemplate = () => {
    if (!templateName.trim()) {
      toast.error(
        ar ? "يرجى كتابة اسم النموذج" : "Please provide a template name",
      );
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
    const map = new Map<
      string,
      { title: string; titleAr: string; cols: CustomColumnDef[] }
    >();
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
    return allColumnsForSource.filter((c) =>
      selectedColumnKeys.includes(c.key),
    );
  }, [allColumnsForSource, selectedColumnKeys]);

  const toggleColumn = (key: string) => {
    if (selectedColumnKeys.includes(key)) {
      if (selectedColumnKeys.length <= 1) {
        toast.warning(
          ar ? "يجب اختيار عمود واحد على الأقل" : "Select at least one column",
        );
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
    const res = await fetch(
      `/api/reports/custom/query?propertyId=${effectivePropId}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          dataSource: selectedSource,
          columns: selectedColumnKeys,
          filters: currentFilters,
          fetchAll: true,
        }),
      },
    );
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
          if (
            (col.type === "date" ||
              (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val))) &&
            val
          ) {
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
      toast.success(
        ar ? "تم تصدير ملف Excel بنجاح" : "Excel exported successfully",
      );
    } catch (err: any) {
      toast.dismiss();
      toast.error(
        err.message || (ar ? "فشل تصدير Excel" : "Failed to export Excel"),
      );
    }
  };

  // ─── Studio State & Mappings ─────────────────────────────────────────────
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioRows, setStudioRows] = useState<any[]>([]);
  const [isFetchingStudio, setIsFetchingStudio] = useState(false);

  const activePropObj = useMemo(() => {
    return (
      properties?.find((p: any) => p.id === effectivePropId) || properties?.[0]
    );
  }, [properties, effectivePropId]);

  const studioColumns: ReportColumnConfig[] = useMemo(() => {
    const cols: ReportColumnConfig[] = [
      {
        key: "#",
        header: "#",
        headerAr: "م",
        type: "index",
        align: "center",
        width: "38px",
      },
    ];

    activeColumns.forEach((c) => {
      let type: ReportColumnConfig["type"] = "text";
      let align: ReportColumnConfig["align"] = ar ? "right" : "left";
      let width: string | undefined = undefined;

      if (c.type === "date") {
        type = "date";
        align = "center";
        width = "82px";
      } else if (c.type === "number") {
        type = "number";
        align = "center";
        width = "64px";
      } else if (c.type === "status") {
        type = "status";
        align = "center";
        width = "78px";
      } else if (c.type === "boolean") {
        type = "text";
        align = "center";
        width = "52px";
      } else if (/phone|هاتف|موبايل/i.test(c.key)) {
        align = "center";
        width = "88px";
      } else if (/notes|ملاحظات|details|تفاصيل/i.test(c.key)) {
        width = "125px";
      }

      cols.push({
        key: c.key,
        header: c.label,
        headerAr: c.labelAr,
        type,
        align,
        width,
      });
    });

    return cols;
  }, [activeColumns, ar]);

  const studioFormattedRows = useMemo(() => {
    return studioRows.map((r, idx) => {
      const obj: Record<string, any> = { "#": idx + 1 };
      activeColumns.forEach((col) => {
        let val = r[col.key];
        if (
          (col.type === "date" ||
            (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val))) &&
          val
        ) {
          val = formatDate(val);
        } else if (val === true) {
          val = ar ? "نعم" : "Yes";
        } else if (val === false) {
          val = ar ? "لا" : "No";
        } else if (val === null || val === undefined) {
          val = "—";
        }
        obj[col.key] = val;
      });
      return obj;
    });
  }, [studioRows, activeColumns, ar]);

  const studioCurrentPageRows = useMemo(() => {
    return reportRows.map((r: any, idx: number) => {
      const obj: Record<string, any> = { "#": (page - 1) * limit + idx + 1 };
      activeColumns.forEach((col) => {
        let val = r[col.key];
        if (
          (col.type === "date" ||
            (typeof val === "string" && /^\d{4}-\d{2}-\d{2}/.test(val))) &&
          val
        ) {
          val = formatDate(val);
        } else if (val === true) {
          val = ar ? "نعم" : "Yes";
        } else if (val === false) {
          val = ar ? "لا" : "No";
        } else if (val === null || val === undefined) {
          val = "—";
        }
        obj[col.key] = val;
      });
      return obj;
    });
  }, [reportRows, activeColumns, page, limit, ar]);

  const studioKpis: ReportKpiItem[] = useMemo(() => {
    if (!showStats) return [];
    const k: ReportKpiItem[] = [
      {
        label: "Total Records",
        labelAr: "إجمالي السجلات",
        value: totalCount,
        color: "amber",
      },
    ];
    if (reportStats.activeCount !== undefined) {
      k.push({
        label: "Active",
        labelAr: "الحالات النشطة",
        value: reportStats.activeCount,
        color: "emerald",
      });
    }
    if (reportStats.overallOccupancyPct) {
      k.push({
        label: "Occupancy Rate",
        labelAr: "نسبة الإشغال",
        value: reportStats.overallOccupancyPct,
        color: "blue",
      });
    }
    if (reportStats.totalRooms) {
      k.push({
        label: "Total Rooms",
        labelAr: "إجمالي الغرف",
        value: reportStats.totalRooms,
        color: "purple",
      });
    }
    if (reportStats.pendingCount !== undefined) {
      k.push({
        label: "Pending",
        labelAr: "قيد الانتظار",
        value: reportStats.pendingCount,
        color: "amber",
      });
    }
    return k;
  }, [showStats, totalCount, reportStats]);

  // ─── Export Studio PDF ───────────────────────────────────────────────────
  const handleExportPDF = async () => {
    try {
      setIsFetchingStudio(true);
      toast.loading(
        ar ? "جاري تحضير استوديو الطباعة..." : "Preparing Print Studio...",
      );
      const fullRows = await fetchAllRowsForExport();
      toast.dismiss();

      if (!fullRows.length) {
        toast.warning(ar ? "لا توجد بيانات لتصديرها" : "No data to export");
        return;
      }

      setStudioRows(fullRows);
      setIsStudioOpen(true);
    } catch (err: any) {
      toast.dismiss();
      toast.error(
        err.message || (ar ? "فشل تجهيز التقرير" : "Failed to prepare report"),
      );
    } finally {
      setIsFetchingStudio(false);
    }
  };

  const currentSourceDef =
    DATA_SOURCES.find((s) => s.id === selectedSource) || DATA_SOURCES[0];
  return {
    propertySlug,
    properties,
    activePropertyId,
    language,
    can,
    queryClient,
    ar,
    canAccessConfig,
    canExport,
    canEdit,
    effectivePropId,
    settings,
    selectedSource,
    setSelectedSource,
    selectedColumnKeys,
    setSelectedColumnKeys,
    handleSourceChange,
    searchTerm,
    setSearchTerm,
    debouncedSearch,
    filterBuilding,
    setFilterBuilding,
    filterFloor,
    setFilterFloor,
    filterDepartment,
    setFilterDepartment,
    filterJobLevel,
    setFilterJobLevel,
    filterGender,
    setFilterGender,
    filterStatus,
    setFilterStatus,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    orientation,
    setOrientation,
    showStats,
    setShowStats,
    showSignatures,
    setShowSignatures,
    customReportTitleAr,
    setCustomReportTitleAr,
    customReportTitleEn,
    setCustomReportTitleEn,
    customNotes,
    setCustomNotes,
    page,
    setPage,
    limit,
    setLimit,
    isSaveModalOpen,
    setIsSaveModalOpen,
    isLoadModalOpen,
    setIsLoadModalOpen,
    templateName,
    setTemplateName,
    templateNameEn,
    setTemplateNameEn,
    buildings,
    floors,
    availableFloors,
    departments,
    currentFilters,
    queryResponse,
    isLoading,
    isFetching,
    refetch,
    reportRows,
    totalCount,
    reportStats,
    templates,
    refetchTemplates,
    saveTemplateMutation,
    deleteTemplateMutation,
    handleApplyTemplate,
    handleSaveCurrentAsTemplate,
    allColumnsForSource,
    categorizedColumns,
    activeColumns,
    toggleColumn,
    selectAllColumns,
    resetToDefaultColumns,
    resetFilters,
    fetchAllRowsForExport,
    handleExportExcel,
    isStudioOpen,
    setIsStudioOpen,
    studioRows,
    setStudioRows,
    isFetchingStudio,
    setIsFetchingStudio,
    activePropObj,
    studioColumns,
    studioFormattedRows,
    studioCurrentPageRows,
    studioKpis,
    handleExportPDF,
    currentSourceDef,
  };
}

export type ReportConfigurationPageState = ReturnType<
  typeof useReportConfigurationPageState
>;
