import { useState } from "react";
import { Tab } from "../types";

export function useReportFilters() {
  const [activeTab, setActiveTab] = useState<Tab>("analytics");
  const [filterProperty, setFilterProperty] = useState<string>("all");
  const [filterBuilding, setFilterBuilding] = useState<string>("all");
  const [filterFloor, setFilterFloor] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState<string>("");
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [filterCategory, setFilterCategory] = useState<string>("all");
  const [filterDepartment, setFilterDepartment] = useState<string>("all");
  const [filterGender, setFilterGender] = useState<string>("all");
  const [filterNationality, setFilterNationality] = useState<string>("all");

  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  const resetReportFilters = () => {
    setFilterProperty("all");
    setSearch("");
    setDateFrom("");
    setDateTo("");
    setFilterDepartment("all");
    setFilterGender("all");
    setFilterNationality("all");
    setFilterBuilding("all");
    setFilterFloor("all");
    setFilterStatus("all");
    setFilterCategory("all");
    setSelectedRows(new Set());
  };

  const hasActiveReportFilters = Boolean(
    filterProperty !== "all" ||
    search ||
    dateFrom ||
    dateTo ||
    filterDepartment !== "all" ||
    filterGender !== "all" ||
    filterNationality !== "all" ||
    filterBuilding !== "all" ||
    filterFloor !== "all" ||
    filterStatus !== "all" ||
    filterCategory !== "all",
  );

  return {
    activeTab,
    setActiveTab,
    filterProperty,
    setFilterProperty,
    filterBuilding,
    setFilterBuilding,
    filterFloor,
    setFilterFloor,
    filterStatus,
    setFilterStatus,
    search,
    setSearch,
    dateFrom,
    setDateFrom,
    dateTo,
    setDateTo,
    selectedRows,
    setSelectedRows,
    filterCategory,
    setFilterCategory,
    filterDepartment,
    setFilterDepartment,
    filterGender,
    setFilterGender,
    filterNationality,
    setFilterNationality,
    currentPage,
    setCurrentPage,
    pageSize,
    setPageSize,
    resetReportFilters,
    hasActiveReportFilters,
  };
}
