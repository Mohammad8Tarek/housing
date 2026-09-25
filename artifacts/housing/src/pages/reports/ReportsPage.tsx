import { useMemo, useEffect, useRef, useCallback } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { DataPagination } from "@/components/DataPagination";
import { AnalyticsTab } from "./components/AnalyticsTab";

import { useReportData } from "./hooks/useReportData";
import { useReportFilters } from "./hooks/useReportFilters";
import { useReportDataProcessor } from "./hooks/useReportDataProcessor";
import { useReportAnalytics } from "./hooks/useReportAnalytics";
import { useReportExport } from "./hooks/useReportExport";
import { sortReportRows, useReportSort } from "./hooks/useReportSort";
import { useReportColumns } from "./hooks/useReportColumns";
import { useSmartReportExport } from "@/hooks/useSmartReportExport";
import { SMART_REPORT_TABS } from "@/config/reportDefinitions";

import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ClipboardCheck, AlertOctagon, Palmtree, SlidersHorizontal } from "lucide-react";
import { ExportToolbar } from "./components/ExportToolbar";
import { StatsCards } from "./components/StatsCards";
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
  );

  const floorOptions =
    filters.filterBuilding === "all" ||
    filters.filterBuilding === "undefined" ||
    !filters.filterBuilding
      ? data.floors
      : data.floors.filter(
          (f: any) => f.buildingId === Number(filters.filterBuilding),
        );

  const filteredRoomsForAnalytics = useMemo(() => {
    return data.rooms.filter((r: any) => {
      if (filters.filterBuilding !== "all" && filters.filterBuilding && r.buildingId !== Number(filters.filterBuilding)) return false;
      if (filters.filterFloor !== "all" && filters.filterFloor && r.floorId !== Number(filters.filterFloor)) return false;
      return true;
    });
  }, [data.rooms, filters.filterBuilding, filters.filterFloor]);

  const filteredAssignmentsForAnalytics = useMemo(() => {
    return data.assignments.filter((a: any) => {
      if (a.status !== "ACTIVE" && a.status !== "VACATION") return false;
      const room = data.roomMap[a.roomId];
      if (filters.filterBuilding !== "all" && filters.filterBuilding && (!room || room.buildingId !== Number(filters.filterBuilding))) return false;
      if (filters.filterFloor !== "all" && filters.filterFloor && (!room || room.floorId !== Number(filters.filterFloor))) return false;
      return true;
    });
  }, [data.assignments, data.roomMap, filters.filterBuilding, filters.filterFloor]);

  const { stats, analytics } = useReportAnalytics({
    ar,
    rooms: filteredRoomsForAnalytics,
    assignments: filteredAssignmentsForAnalytics,
    profiles: data.profiles,
    buildings: data.buildings,
    floors: data.floors,
    maintenance: data.maintenance,
    reservations: data.reservations,
    hostings: data.hostings,
  });

  const processor = useReportDataProcessor({
    ar,
    ...filters,
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

  const allData = processor.currentData();
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
  const totalCount = isInHouseGrouped ? groupedInHouseRooms.length : sortedData.length;

  const handleSortToggle = (key: string) => {
    toggle(key);
    filters.setCurrentPage(1);
  };

  // Real-time responsive pagination based on filtered data
  const startIndex = (filters.currentPage - 1) * filters.pageSize;
  const paginatedData = useMemo(() => {
    if (isInHouseGrouped) {
      const pageRooms = groupedInHouseRooms.slice(startIndex, startIndex + filters.pageSize);
      return pageRooms.flatMap(([_, list]) => list);
    }
    return sortedData.slice(startIndex, startIndex + filters.pageSize);
  }, [isInHouseGrouped, groupedInHouseRooms, sortedData, startIndex, filters.pageSize]);

  const exportActions =
    useReportExport({
      ar,
      activeTab: filters.activeTab,
      canExportReports,
      currentData: () => sortedData,
      currentPageData: () => paginatedData,
      properties: data.properties,
      propId: data.propId,
      activePropertyId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: filters.search,
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

  const { handleExportExcel, handleExportPDF, handleExportAnalyticsPDF } =
    exportActions;

  // ── Smart Report Export (jsPDF + AutoTable column system) ──
  const smartDef = SMART_REPORT_TABS[filters.activeTab];
  const activeProperty = data.properties?.find((p: any) => String(p.id) === String(activePropertyId));
  const propertyLabel = activeProperty ? (ar ? (activeProperty as any).nameAr || activeProperty.name : activeProperty.name) : undefined;

  const smartExport = useSmartReportExport({
    columns: smartDef?.columns ?? [],
    getData: () => sortedData as Record<string, unknown>[],
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
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ar ? "مركز التقارير الشاملة" : "Comprehensive Reports"}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap items-center">
          {can("reports", "config") && (
            <Link href={`/${propertySlug || "all"}/reports/configuration`}>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 border-violet-200 dark:border-violet-800 text-violet-700 dark:text-violet-300 hover:bg-violet-50 dark:hover:bg-violet-950/40"
              >
                <SlidersHorizontal className="w-4 h-4 text-violet-600 dark:text-violet-400" />
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
            handleSmartExportPdf={smartExport.exportPdf}
            handleSmartExportCsv={smartExport.exportCsv}
            handleSmartExportXlsx={smartExport.exportXlsx}
            isSmartExportingPdf={smartExport.isExportingPdf}
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
          rooms={data.rooms}
          buildings={data.buildings}
          floors={data.floors}
          assignments={data.assignments}
          reservations={data.reservations}
          maintenance={data.maintenance}
          profiles={data.profiles}
          onExportPDF={handleExportPDF}
          onExportExcel={handleExportExcel}
          onRegisterExport={handleRegisterExport}
        />
      )}

      {/* Tab 1: Analytics Dashboard */}
      {filters.activeTab === "analytics" && (
        <AnalyticsTab
          ar={ar}
          isLoading={data.isLoading}
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
          rooms={data.rooms}
          buildings={data.buildings}
          assignments={data.assignments}
          reservations={data.reservations}
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
            <div className="bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-sky-900 dark:text-sky-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-700 dark:text-sky-300 shrink-0">
                  <ClipboardCheck className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
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
            <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-amber-900 dark:text-amber-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-700 dark:text-amber-300 shrink-0">
                  <AlertOctagon className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
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
                <span className="px-2.5 py-1 rounded-md bg-rose-600 text-white font-bold text-xs">
                  {ar ? "فحص فوري للمشرف" : "Immediate Inspection Required"}
                </span>
              </div>
            </div>
          )}

          {filters.activeTab === "vacations" && (
            <div className="bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800 rounded-xl p-3.5 flex flex-col md:flex-row md:items-center justify-between gap-3 text-xs text-emerald-900 dark:text-emerald-200">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-emerald-100 dark:bg-emerald-900/50 text-emerald-700 dark:text-emerald-300 shrink-0">
                  <Palmtree className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="font-bold text-sm">
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
                isLoading={data.isLoading}
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
