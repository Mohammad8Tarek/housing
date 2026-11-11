import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { toast } from "sonner";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { DataPagination } from "@/components/DataPagination";
import { useDebounce } from "@/hooks/use-debounce";
import { AnalyticsTab } from "./components/AnalyticsTab";

import { useReportData } from "./hooks/useReportData";
import { useReportFilters } from "./hooks/useReportFilters";
import { useReportDataProcessor } from "./hooks/useReportDataProcessor";
import { useServerAnalytics } from "./hooks/useServerAnalytics";
import { useReportExport } from "./hooks/useReportExport";
import { sortReportRows, useReportSort } from "./hooks/useReportSort";
import { OWN_VIEW_TABS, SERVER_ROW_TABS, useServerReportRows } from "./hooks/useServerReportRows";
import { useReportColumns } from "./hooks/useReportColumns";
import { useSmartReportExport } from "@/hooks/useSmartReportExport";
import { SMART_REPORT_TABS } from "@/config/reportDefinitions";

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, AlertOctagon, Palmtree, SlidersHorizontal } from "lucide-react";
import { ExportToolbar } from "./components/ExportToolbar";
import { TabsNav } from "./components/TabsNav";
import { ReportFilters } from "./components/ReportFilters";
import { ReportTable } from "./components/ReportTable";
import { ManagerFlashTab } from "./components/ManagerFlashTab";
import { OccupancyForecastTab } from "./components/OccupancyForecastTab";
import { VacantRoomsOperationalMatrix } from "./components/VacantRoomsOperationalMatrix";
import { InHouseGroupedRoomsView } from "./components/InHouseGroupedRoomsView";
import { ServiceRatingsTab } from "./components/ServiceRatingsTab";
import { HousingMapReportTab } from "./components/HousingMapReportTab";
import { MaintenanceDualTrackReportRibbon } from "./components/MaintenanceDualTrackReportRibbon";
import { HousingRatingsTab } from "./components/HousingRatingsTab";
import { RoomMovesTab } from "./components/RoomMovesTab";
import { ReportPrintStudioModal } from "./components/ReportPrintStudioModal";
import { TABS, groupOfTab } from "./constants";

export default function Reports() {
  const { activePropertyId, propertySlug } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();
  const ar = language === "ar";
  const canExportReports = can("reports", "export");

  const filters = useReportFilters();
  const reportCols = useReportColumns(filters.activeTab, ar);

  const numericPropertyId: number | undefined =
    activePropertyId && activePropertyId !== "all"
      ? Number(activePropertyId)
      : undefined;

  const data = useReportData(
    filters.filterProperty,
    numericPropertyId,
    filters.filterBuilding,
    filters.activeTab,
  );

  const floorOptions =
    filters.filterBuilding === "all" ||
    filters.filterBuilding === "undefined" ||
    !filters.filterBuilding
      ? data.floors
      : data.floors.filter(
          (f: any) => String(f.buildingId) === String(filters.filterBuilding),
        );

  // Analytics are computed by the API; only the Analytics tab (and its PDF) use them.
  const serverAnalytics = useServerAnalytics({
    enabled: filters.activeTab === "analytics",
    propId: data.propId,
    ar,
    filterBuilding: filters.filterBuilding,
    filterFloor: filters.filterFloor,
  });
  const { stats, analytics } = serverAnalytics;

  // Rows are rebuilt from the full datasets, so wait until typing pauses.
  const debouncedSearch = useDebounce(filters.search, 300);

  const processor = useReportDataProcessor({
    ar,
    ...filters,
    search: debouncedSearch,
    buildings: data.buildings,
    floors: data.floors,
    rooms: data.rooms,
    profiles: data.profiles,
    assignments: data.assignments,
    reservations: data.reservations,
    maintenance: data.maintenance,
    hostings: data.hostings,
    equipmentInventory: data.equipmentInventory,
    gateLogs: data.gateLogs,
    vacations: data.vacations,
    buildingMap: data.buildingMap,
    floorMap: data.floorMap,
    roomMap: data.roomMap,
    empMap: data.empMap,
    settings: data.settings,
  });

  // Reports in SERVER_ROW_TABS are built and paged by the API instead.
  const isServerTab = SERVER_ROW_TABS.has(filters.activeTab);

  // Rebuild rows only when a report input changes, not on every render.
  const allData = useMemo(
    () => (isServerTab ? [] : processor.currentData()),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [
      isServerTab, ar, filters.activeTab, filters.filterBuilding, filters.filterFloor, filters.filterStatus,
      filters.filterCategory, filters.inventoryViewMode, filters.filterDepartment, filters.filterGender,
      filters.filterNationality, filters.filterRoomType, filters.filterEmploymentType, filters.waterSortMode,
      debouncedSearch, filters.dateFrom, filters.dateTo,
      data.buildings, data.floors, data.rooms, data.profiles, data.assignments, data.reservations,
      data.maintenance, data.hostings, data.equipmentInventory, data.gateLogs, data.vacations,
      data.buildingMap, data.floorMap, data.roomMap, data.empMap, data.settings,
    ],
  );
  const { sort, toggle } = useReportSort(filters.activeTab);
  const sortedData = useMemo(
    () => sortReportRows(allData, sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allData, sort],
  );

  const groupedInHouseRooms = useMemo(() => {
    if (filters.activeTab !== "assignments") return [];
    const map = new Map<string, any[]>();
    sortedData.forEach((a: any) => {
      const key = String(a.roomId || a.roomNumber || "unassigned");
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(a);
    });
    return Array.from(map.entries());
  }, [filters.activeTab, sortedData]);

  const isInHouseGrouped = filters.activeTab === "assignments" && filters.inHouseViewMode === "grouped";

  const server = useServerReportRows({
    // These tabs show their own view; their rows load only for export.
    enabled: isServerTab && !OWN_VIEW_TABS.has(filters.activeTab),
    report: filters.activeTab,
    propId: data.propId,
    ar,
    filters,
    search: debouncedSearch,
    sort,
    page: filters.currentPage,
    pageSize: filters.pageSize,
    groupByRoom: isInHouseGrouped,
  });

  const totalCount = isServerTab
    ? server.total
    : isInHouseGrouped
      ? groupedInHouseRooms.length
      : sortedData.length;

  const handleSortToggle = (key: string) => {
    toggle(key);
    filters.setCurrentPage(1);
  };

  useEffect(() => {
    if (isServerTab && server.isLoading) return;
    const maxPage = Math.max(1, Math.ceil(totalCount / filters.pageSize));
    if (filters.currentPage > maxPage) {
      filters.setCurrentPage(1);
    }
  }, [totalCount, filters.currentPage, filters.pageSize, filters, isServerTab, server.isLoading]);

  // Real-time responsive pagination based on filtered data
  const startIndex = (filters.currentPage - 1) * filters.pageSize;
  const paginatedData = useMemo(() => {
    if (isServerTab) return server.pageRows;
    if (isInHouseGrouped) {
      const pageRooms = groupedInHouseRooms.slice(startIndex, startIndex + filters.pageSize);
      return pageRooms.flatMap(([_, list]) => list);
    }
    return sortedData.slice(startIndex, startIndex + filters.pageSize);
  }, [isServerTab, server.pageRows, isInHouseGrouped, groupedInHouseRooms, sortedData, startIndex, filters.pageSize]);

  // Real-time Water Distribution check state for ribbon & table synchronicity
  const [waterCheckState, setWaterCheckState] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("water_distribution_checks");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleWaterCheck = useCallback((key: string, val: boolean) => {
    setWaterCheckState((prev) => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem("water_distribution_checks", JSON.stringify(next));
      } catch {}
      return next;
    });
  }, []);


  const exportActions =
    useReportExport({
      ar,
      activeTab: filters.activeTab,
      canExportReports,
      currentData: isServerTab ? server.allRows : () => sortedData,
      currentPageData: () => paginatedData,
      properties: data.properties,
      propId: data.propId,
      activePropertyId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: filters.search,
      filterBuilding: filters.filterBuilding,
      filterFloor: filters.filterFloor,
      filterDepartment: filters.filterDepartment,
      settings: data.settings,
      analytics,
      stats,
      rooms: data.rooms,
      profiles: data.profiles,
      buildings: data.buildings,
      floors: data.floors,
      evalStats: data.evalStats,
      floorMap: data.floorMap,
      buildingMap: data.buildingMap,
      empMap: data.empMap,
      roomMap: data.roomMap,
      inventoryViewMode: filters.inventoryViewMode,
      filterRow: reportCols.filterRow,
    });

  const { handleExportAnalyticsPDF } = exportActions;

  // Server-paged reports only hold one page; load every row before exporting.
  const withAllRows =
    <A extends unknown[]>(fn: (...args: A) => unknown) =>
    async (...args: A) => {
      if (isServerTab) {
        try {
          await server.loadAllRows();
        } catch {
          toast.error(ar ? "تعذر تحميل بيانات التقرير للتصدير" : "Could not load report data for export");
          return;
        }
      }
      return fn(...args);
    };
  const handleExportExcel = withAllRows(exportActions.handleExportExcel);
  const handleExportPDF = withAllRows(exportActions.handleExportPDF);

  // ── Smart Report Export (jsPDF + AutoTable column system) ──
  const smartDef = SMART_REPORT_TABS[filters.activeTab];
  const activeProperty = data.properties?.find((p: any) => String(p.id) === String(activePropertyId));
  const propertyLabel = activeProperty ? (ar ? (activeProperty as any).nameAr || activeProperty.name : activeProperty.name) : undefined;

  const smartExport = useSmartReportExport({
    columns: smartDef?.columns ?? [],
    getData: async () =>
      (isServerTab ? await server.loadAllRows() : sortedData) as Record<string, unknown>[],
    meta: {
      title: smartDef ? (ar ? smartDef.titleAr : smartDef.title) : '',
      subtitle: propertyLabel,
      filters: {
        ...(filters.dateFrom ? { [ar ? 'من' : 'From']: filters.dateFrom } : {}),
        ...(filters.dateTo ? { [ar ? 'إلى' : 'To']: filters.dateTo } : {}),
        ...(filters.search ? { [ar ? 'بحث' : 'Search']: filters.search } : {}),
      },
    },
    generatedBy: undefined,
    language: ar ? 'ar' : 'en',
  });

  const activeTabConfig = TABS.find((t) => t.id === filters.activeTab);
  const reportGroup = groupOfTab(filters.activeTab);

  const customExportRef = useRef<{
    exportExcel?: () => void;
    exportPDF?: () => void;
  }>({});

  const handleRegisterExport = useCallback(
    (actions: { exportExcel?: () => void; exportPDF?: () => void }) => {
      customExportRef.current = actions;
    },
    [],
  );

  useEffect(() => {
    customExportRef.current = {};
  }, [filters.activeTab]);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="flex items-stretch gap-3 min-w-0">
          <span className="w-1 rounded-full bg-[#2AA8AB] shrink-0" aria-hidden />
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[#BC9F6F]">
              {ar ? reportGroup.labelAr : reportGroup.label}
              {propertyLabel ? ` · ${propertyLabel}` : ""}
            </p>
            <h1 className="text-2xl font-bold tracking-tight truncate">
              {activeTabConfig
                ? ar
                  ? activeTabConfig.labelAr
                  : activeTabConfig.label
                : ar
                ? "مركز التقارير"
                : "Reports"}
            </h1>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar ? "مركز التقارير الشاملة" : "Comprehensive Reports Center"}
            </p>
          </div>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {can("reports", "config") && (
            <Link href={`/${propertySlug || "all"}/reports/configuration`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-[#2AA8AB]/40 text-[#1F7F81] dark:text-[#59B7A8] hover:bg-[#2AA8AB]/10"
              >
                <SlidersHorizontal className="w-4 h-4" />
                <span>{ar ? "كستم ريبورت" : "Custom Reports"}</span>
              </Button>
            </Link>
          )}
          <ExportToolbar
            canExportReports={canExportReports}
            activeTab={filters.activeTab}
            ar={ar}
            handleExportAnalyticsPDF={handleExportAnalyticsPDF}
            handleExportExcel={handleExportExcel}
            handleExportPDF={handleExportPDF}
            handleSmartExportCsv={smartExport.exportCsv}
            handleSmartExportXlsx={smartExport.exportXlsx}
            isSmartExportingCsv={smartExport.isExportingCsv}
            isSmartExportingXlsx={smartExport.isExportingXlsx}
            hasSmartReport={!!smartDef}
            cols={reportCols.cols}
            visible={reportCols.visible}
            onToggle={reportCols.toggle}
            onShowAll={reportCols.showAll}
            onHideAll={reportCols.hideAll}
            customExportRef={customExportRef}
          />
        </div>
      </div>

      {/* Tabs Navigation */}
      <TabsNav
        activeTab={filters.activeTab}
        setActiveTab={filters.setActiveTab}
        setFilterStatus={filters.setFilterStatus}
        setFilterCategory={filters.setFilterCategory}
        ar={ar}
      />

      {/* Opera PMS: Manager Flash Report */}
      {filters.activeTab === "manager_flash" && (
        <ManagerFlashTab
          ar={ar}
          isLoading={data.isLoading}
          properties={data.properties}
          activePropertyId={activePropertyId}
          propId={data.propId}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onRegisterExport={handleRegisterExport}
        />
      )}

      {/* Tab 1: Analytics Dashboard */}
      {filters.activeTab === "analytics" && (
        <AnalyticsTab
          ar={ar}
          isLoading={data.isLoading || serverAnalytics.isLoading}
          rooms={data.rooms}
          analytics={analytics}
          evalStats={data.evalStats}
          onPrint={handleExportAnalyticsPDF}
        />
      )}

      {/* Opera PMS: 7/14/30-Day Occupancy Forecast */}
      {filters.activeTab === "occupancy_forecast" && (
        <OccupancyForecastTab
          ar={ar}
          isLoading={data.isLoading}
          properties={data.properties}
          activePropertyId={activePropertyId}
          propId={data.propId}
          buildings={data.buildings}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onRegisterExport={handleRegisterExport}
        />
      )}

      {/* Service Quality & Ratings Report */}
      {filters.activeTab === "service_ratings" && (
        <ServiceRatingsTab
          ar={ar}
          activePropertyId={activePropertyId}
          properties={data.properties}
          onRegisterExport={handleRegisterExport}
        />
      )}

      {/* Housing Map & Detailed Structure Report */}
      {filters.activeTab === "housing_map" && (
        <HousingMapReportTab
          ar={ar}
          activePropertyId={activePropertyId}
          properties={data.properties}
          settings={data.settings}
          onRegisterExport={handleRegisterExport}
        />
      )}

      {/* Weekly Housing Pulse Ratings Report */}
      {filters.activeTab === "housing_ratings" && (
        <HousingRatingsTab
          ar={ar}
          activePropertyId={activePropertyId}
          properties={data.properties}
          onRegisterExport={handleRegisterExport}
        />
      )}

      {/* Room Moves & Bed Transfers PMS Report */}
      {filters.activeTab === "room_moves" && (
        <RoomMovesTab
          ar={ar}
          activePropertyId={activePropertyId}
          properties={data.properties}
          buildings={data.buildings}
          onRegisterExport={handleRegisterExport}
        />
      )}

      {/* Other Tabs: Data Table & Filters */}
      {filters.activeTab !== "analytics" &&
        filters.activeTab !== "manager_flash" &&
        filters.activeTab !== "occupancy_forecast" &&
        filters.activeTab !== "service_ratings" &&
        filters.activeTab !== "housing_map" &&
        filters.activeTab !== "housing_ratings" &&
        filters.activeTab !== "room_moves" && (
        <>
          <ReportFilters
            ar={ar}
            activeTab={filters.activeTab}
            properties={data.properties}
            propId={data.propId}
            buildings={data.buildings}
            floors={data.floors}
            floorOptions={floorOptions}
            departments={data.departments}
            nationalities={data.nationalities}
            filterProperty={filters.filterProperty}
            setFilterProperty={filters.setFilterProperty}
            filterBuilding={filters.filterBuilding}
            setFilterBuilding={filters.setFilterBuilding}
            filterFloor={filters.filterFloor}
            setFilterFloor={filters.setFilterFloor}
            filterStatus={filters.filterStatus}
            setFilterStatus={filters.setFilterStatus}
            filterRoomType={filters.filterRoomType}
            setFilterRoomType={filters.setFilterRoomType}
            filterEmploymentType={filters.filterEmploymentType}
            setFilterEmploymentType={filters.setFilterEmploymentType}
            filterCategory={filters.filterCategory}
            setFilterCategory={filters.setFilterCategory}
            filterDepartment={filters.filterDepartment}
            setFilterDepartment={filters.setFilterDepartment}
            filterGender={filters.filterGender}
            setFilterGender={filters.setFilterGender}
            filterNationality={filters.filterNationality}
            setFilterNationality={filters.setFilterNationality}
            search={filters.search}
            setSearch={filters.setSearch}
            dateFrom={filters.dateFrom}
            setDateFrom={filters.setDateFrom}
            dateTo={filters.dateTo}
            setDateTo={filters.setDateTo}
            resetReportFilters={filters.resetReportFilters}
            hasActiveReportFilters={filters.hasActiveReportFilters}
            currentDataLength={totalCount}
            selectedRowsSize={filters.selectedRows.size}
            inventoryViewMode={filters.inventoryViewMode}
            setInventoryViewMode={filters.setInventoryViewMode}
            inHouseViewMode={filters.inHouseViewMode}
            setInHouseViewMode={filters.setInHouseViewMode}
            waterSortMode={filters.waterSortMode}
            setWaterSortMode={filters.setWaterSortMode}
            rooms={data.rooms}
            roomTypes={data.configuredRoomTypes}
          />

          {filters.activeTab === "maintenance" && (
            <MaintenanceDualTrackReportRibbon
              ar={ar}
              propertyId={numericPropertyId}
              filterCategory={filters.filterCategory}
              setFilterCategory={filters.setFilterCategory}
              ticketsData={data.maintenance}
            />
          )}

          {filters.activeTab === "housekeeping_sheet" && (
            <div className="bg-[#2AA8AB]/5 border border-[#2AA8AB]/30 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-foreground">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#2AA8AB]/15 text-[#1F7F81] dark:text-[#59B7A8] shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1F7F81] dark:text-[#59B7A8]">
                    {ar ? "كشف مهام وتوزيع أعمال الهاوس كيبنج الميداني" : "Room Attendant Daily Task Assignment Sheet"}
                  </h4>
                  <p className="text-muted-foreground mt-0.5">
                    {ar
                      ? "كشف توزيع المهام الميداني مع خانات الفحص الفعلي (المفروشات والعهد والتوقيع) مصمم للطباعة والحوافظ اليدوية."
                      : "Daily operational task sheet with physical inspection checkpoints (linen, amenities, and signatures) formatted for clipboards."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0 text-xs font-semibold">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-red-100 text-red-800 border border-red-200">
                  <span className="w-2 h-2 rounded-full bg-red-600 animate-pulse" />
                  {ar ? "أولوية 1: مغادرة شاملة" : "Priority 1: Turnover"}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-blue-100 text-blue-800 border border-blue-200">
                  <span className="w-2 h-2 rounded-full bg-blue-600" />
                  {ar ? "أولوية 2: نظافة مقيم" : "Priority 2: Stayover"}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-slate-100 text-slate-800 border border-slate-200">
                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                  {ar ? "أولوية 3: تفتيش شاغر" : "Priority 3: Refresh"}
                </span>
              </div>
            </div>
          )}

          {filters.activeTab === "room_discrepancy" && (
            <div className="bg-[#2AA8AB]/5 border border-[#2AA8AB]/30 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-foreground">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#2AA8AB]/15 text-[#1F7F81] dark:text-[#59B7A8] shrink-0">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1F7F81] dark:text-[#59B7A8]">
                    {ar ? "مركز تدقيق ومطابقة حالات الغرف والنزلاء" : "Room Status Discrepancy & Audit Center"}
                  </h4>
                  <p className="text-muted-foreground mt-0.5">
                    {ar
                      ? "يكتشف التناقضات بين سجلات التسكين (Front Desk) والحالة الميدانية (Housekeeping): نائم غير مسجل (Sleep)، غادر دون تسجيل (Skip)، تكدس."
                      : "Flags mismatches between front desk records and physical housekeeping status: Sleep (unrecorded), Skip (unreported departure), Overcrowded."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <span className="px-2.5 py-1 rounded-md bg-[#A52D2C] text-white font-bold text-xs">
                  {ar ? "فحص فوري للمشرف" : "Immediate Inspection Required"}
                </span>
              </div>
            </div>
          )}

          {filters.activeTab === "vacations" && (
            <div className="bg-[#2AA8AB]/5 border border-[#2AA8AB]/30 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-foreground">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-[#2AA8AB]/15 text-[#1F7F81] dark:text-[#59B7A8] shrink-0">
                  <Palmtree className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm text-[#1F7F81] dark:text-[#59B7A8]">
                    {ar ? "تقرير الإجازات (استعلام زمني بالتاريخ)" : "Vacations Report (Date Range Query)"}
                  </h4>
                  <p className="text-muted-foreground mt-0.5">
                    {ar
                      ? "يتيح لك تحديد أي فترة زمنية سابقة (من تاريخ / إلى تاريخ) للاستعلام الدقيق عن كل من نزل إجازة في تلك الفترة وحالته وتاريخ عودته الفعلي وسكنه."
                      : "Filter by any historical date range (From / To) to audit who was on leave, their expected vs actual return dates, housing assignments, and overdue status."}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-wrap shrink-0 text-xs font-semibold">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-amber-100 text-amber-800 border border-amber-200 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800">
                  <span className="w-2 h-2 rounded-full bg-amber-600 animate-pulse" />
                  {ar ? "في إجازة حالياً" : "On Vacation"}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-100 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800">
                  <span className="w-2 h-2 rounded-full bg-emerald-600" />
                  {ar ? "عاد للعمل" : "Returned"}
                </span>
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-rose-100 text-rose-800 border border-rose-200 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800">
                  <span className="w-2 h-2 rounded-full bg-rose-600" />
                  {ar ? "متأخر عن العودة" : "Overdue"}
                </span>
              </div>
            </div>
          )}

          {filters.activeTab === "vacant_rooms" && (
            <VacantRoomsOperationalMatrix
              ar={ar}
              rooms={data.rooms}
              assignments={data.assignments}
              buildings={data.buildings}
              buildingMap={data.buildingMap}
              filterBuilding={filters.filterBuilding}
              onFilterBuilding={filters.setFilterBuilding}
              onFilterRoomType={filters.setFilterRoomType}
              currentRoomTypeFilter={filters.filterRoomType}
            />
          )}

          {filters.activeTab === "assignments" && filters.inHouseViewMode === "grouped" ? (
            <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
              <InHouseGroupedRoomsView
                assignments={paginatedData}
                roomMap={data.roomMap}
                buildingMap={data.buildingMap}
                floorMap={data.floorMap}
                ar={ar}
              />
            </div>
          ) : (
            <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
              <ReportTable
                isLoading={isServerTab ? data.isLoading || server.isLoading : data.isLoading}
                allData={sortedData}
                paginatedData={paginatedData}
                selectedRows={filters.selectedRows}
                setSelectedRows={filters.setSelectedRows}
                activeTab={filters.activeTab}
                inventoryViewMode={filters.inventoryViewMode}
                ar={ar}
                sort={sort}
                onSortToggle={handleSortToggle}
                floorMap={data.floorMap}
                buildingMap={data.buildingMap}
                empMap={data.empMap}
                roomMap={data.roomMap}
                visibleCols={reportCols.visible}
                waterCheckState={waterCheckState}
                onToggleWaterCheck={toggleWaterCheck}
              />
            </div>
          )}

          <div className="mt-2">
            <DataPagination
              total={totalCount}
              pageSize={filters.pageSize}
              currentPage={filters.currentPage}
              onPageChange={filters.setCurrentPage}
              onPageSizeChange={filters.setPageSize}
            />
          </div>
        </>
      )}

      {exportActions.printStudioProps && (
        <ReportPrintStudioModal
          open={exportActions.isStudioOpen}
          onOpenChange={exportActions.setIsStudioOpen}
          {...exportActions.printStudioProps}
        />
      )}
    </div>
  );
}
