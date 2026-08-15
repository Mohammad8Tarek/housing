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
import { usePaginatedReports } from "./hooks/usePaginatedReports";

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
    filters.filterBuilding === ""
      ? data.floors
      : data.floors.filter(
          (f: any) => f.buildingId === Number(filters.filterBuilding),
        );

  const { stats, analytics } = useReportAnalytics({
    rooms: data.rooms,
    assignments: data.assignments,
    employees: data.employees,
    buildings: data.buildings,
    maintenance: data.maintenance,
  });

  const processor = useReportDataProcessor({
    ...filters,
    buildings: data.buildings,
    floors: data.floors,
    rooms: data.rooms,
    employees: data.employees,
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

  const { data: serverData, isLoading: isServerLoading } = usePaginatedReports({
    propertyId: numericPropertyId,
    tab: filters.activeTab,
    page: filters.currentPage,
    limit: filters.pageSize,
    search: filters.search,
  });

  const paginatedData = serverData?.data || [];
  const totalCount = serverData?.pagination?.total || 0;

  const { handleExportExcel, handleExportPDF, handleExportAnalyticsPDF } =
    useReportExport({
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
      employees: data.employees,
      evalStats: data.evalStats,
      floorMap: data.floorMap,
      buildingMap: data.buildingMap,
      empMap: data.empMap,
      roomMap: data.roomMap,
    });

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analyze and export housing data across all modules
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

      <StatsCards stats={stats} isLoading={data.isLoading} />

      <TabsNav
        activeTab={filters.activeTab}
        setActiveTab={filters.setActiveTab}
        setFilterStatus={filters.setFilterStatus}
        setFilterCategory={filters.setFilterCategory}
        ar={ar}
      />

      {filters.activeTab === "analytics" && (
        <AnalyticsTab
          ar={ar}
          isLoading={data.isLoading}
          rooms={data.rooms}
          analytics={analytics}
          evalStats={data.evalStats}
        />
      )}

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
            currentDataLength={allData.length}
            selectedRowsSize={filters.selectedRows.size}
          />

          <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
            <ReportTable
              isLoading={data.isLoading || isServerLoading}
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
