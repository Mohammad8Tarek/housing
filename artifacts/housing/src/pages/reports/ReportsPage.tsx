import { useMemo } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { DataPagination } from "@/components/DataPagination";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { usePrintLanguage, PrintLanguageDialog } from "@/lib/PrintLanguageDialog";

import { useReportData } from "./hooks/useReportData";
import { useReportFilters } from "./hooks/useReportFilters";
import { useReportDataProcessor } from "./hooks/useReportDataProcessor";
import { useReportAnalytics } from "./hooks/useReportAnalytics";
import { useReportExport } from "./hooks/useReportExport";
import { sortReportRows, useReportSort } from "./hooks/useReportSort";

import { ClipboardCheck, AlertOctagon } from "lucide-react";
import { ExportToolbar } from "./components/ExportToolbar";
import { StatsCards } from "./components/StatsCards";
import { TabsNav } from "./components/TabsNav";
import { ReportFilters } from "./components/ReportFilters";
import { ReportTable } from "./components/ReportTable";
import { ManagerFlashTab } from "./components/ManagerFlashTab";
import { OccupancyForecastTab } from "./components/OccupancyForecastTab";

export default function Reports() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();
  const ar = language === "ar";
  const canExportReports = can("reports", "export");

  const { langDialogOpen, openDialog, handleSelect, handleCancel } = usePrintLanguage();
  const filters = useReportFilters();

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
    buildingMap: data.buildingMap,
    floorMap: data.floorMap,
    roomMap: data.roomMap,
    empMap: data.empMap,
  });

  const allData = processor.currentData();
  const { sort, toggle } = useReportSort(filters.activeTab);
  const sortedData = useMemo(
    () => sortReportRows(allData, sort),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [allData, sort],
  );
  const totalCount = sortedData.length;

  const handleSortToggle = (key: string) => {
    toggle(key);
    filters.setCurrentPage(1);
  };

  // Real-time responsive pagination based on filtered data
  const startIndex = (filters.currentPage - 1) * filters.pageSize;
  const paginatedData = sortedData.slice(startIndex, startIndex + filters.pageSize);

  const { handleExportExcel, handleExportPDF, handleExportAnalyticsPDF } =
    useReportExport({
      ar,
      activeTab: filters.activeTab,
      canExportReports,
      currentData: processor.currentData,
      properties: data.properties,
      propId: data.propId,
      activePropertyId,
      dateFrom: filters.dateFrom,
      dateTo: filters.dateTo,
      search: filters.search,
      settings: data.settings,
      analytics,
      rooms: data.rooms,
      profiles: data.profiles,
      evalStats: data.evalStats,
      floorMap: data.floorMap,
      buildingMap: data.buildingMap,
      empMap: data.empMap,
      roomMap: data.roomMap,
      openPrintDialog: openDialog,
      inventoryViewMode: filters.inventoryViewMode,
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ar ? "مركز التقارير الشاملة" : "Comprehensive Reports"}
          </h1>
        </div>
        <div className="flex gap-2 flex-wrap">
          <ExportToolbar
            canExportReports={canExportReports}
            activeTab={filters.activeTab}
            ar={ar}
            handleExportAnalyticsPDF={handleExportAnalyticsPDF}
            handleExportExcel={handleExportExcel}
            handleExportPDF={handleExportPDF}
          />
        </div>
      </div>

      {/* KPI Cards */}
      <StatsCards
        stats={stats}
        isLoading={data.isLoading}
        ar={ar}
        activeTab={filters.activeTab}
        equipmentInventory={data.equipmentInventory}
        rooms={data.rooms}
        assignments={data.assignments}
      />

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
        />
      )}

      {/* Other Tabs: Data Table & Filters */}
      {filters.activeTab !== "analytics" && filters.activeTab !== "manager_flash" && filters.activeTab !== "occupancy_forecast" && (
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
          />

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
                    {ar ? "مركز تدقيق ومطابقة حالات الغرف (PMS Discrepancy Hub)" : "Room Status Discrepancy & Audit Center"}
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
            />
          </div>

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

      <PrintLanguageDialog
        open={langDialogOpen}
        onSelect={handleSelect}
        onCancel={handleCancel}
      />
    </div>
  );
}
