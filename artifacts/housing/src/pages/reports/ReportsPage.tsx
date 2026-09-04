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

import { ExportToolbar } from "./components/ExportToolbar";
import { StatsCards } from "./components/StatsCards";
import { TabsNav } from "./components/TabsNav";
import { ReportFilters } from "./components/ReportFilters";
import { ReportTable } from "./components/ReportTable";

export default function Reports() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();
  const ar = language === "ar";
  const canExportReports = can("reports", "export");

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

  const { stats, analytics } = useReportAnalytics({
    ar,
    rooms: data.rooms,
    assignments: data.assignments,
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
    buildingMap: data.buildingMap,
    floorMap: data.floorMap,
    roomMap: data.roomMap,
    empMap: data.empMap,
  });

  const allData = processor.currentData();
  const totalCount = allData.length;

  // Real-time responsive pagination based on filtered data
  const startIndex = (filters.currentPage - 1) * filters.pageSize;
  const paginatedData = allData.slice(startIndex, startIndex + filters.pageSize);

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
    });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            {ar ? "مركز التقارير الشاملة" : "Comprehensive Reports"}
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            {ar
              ? "استخراج وجرد وتحليل بيانات التسكين، الغرف الشاغرة والمشغولة، المقيمين، العقود، والصيانة"
              : "Analyze, filter, and export occupancy, vacant beds, profiles, contracts, and maintenance"}
          </p>
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
      <StatsCards stats={stats} isLoading={data.isLoading} ar={ar} />

      {/* Tabs Navigation */}
      <TabsNav
        activeTab={filters.activeTab}
        setActiveTab={filters.setActiveTab}
        setFilterStatus={filters.setFilterStatus}
        setFilterCategory={filters.setFilterCategory}
        ar={ar}
      />

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

      {/* Other Tabs: Data Table & Filters */}
      {filters.activeTab !== "analytics" && (
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
          />

          <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
            <ReportTable
              isLoading={data.isLoading}
              allData={allData}
              paginatedData={paginatedData}
              selectedRows={filters.selectedRows}
              setSelectedRows={filters.setSelectedRows}
              activeTab={filters.activeTab}
              ar={ar}
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
    </div>
  );
}
