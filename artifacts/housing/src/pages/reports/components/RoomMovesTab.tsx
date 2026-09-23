import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import * as XLSX from "xlsx";
import { printLuxuryReport } from "../utils/luxury-report-engine";
import {
  ArrowLeftRight,
  Building2,
  Calendar,
  Clock,
  Download,
  Filter,
  Printer,
  RefreshCw,
  Search,
  ShieldCheck,
  User,
  Wrench,
  TrendingUp,
  Sparkles,
  BedDouble,
  FileSpreadsheet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { formatDate } from "@/lib/date-utils";
import { DataPagination } from "@/components/DataPagination";
import { useDebounce } from "@/hooks/use-debounce";

interface RoomMovesTabProps {
  ar: boolean;
  activePropertyId?: number | string | null;
  properties?: any[];
  buildings?: any[];
}

export function RoomMovesTab({
  ar,
  activePropertyId,
  properties = [],
  buildings = [],
}: RoomMovesTabProps) {
  const [selectedProp, setSelectedProp] = useState<string>(
    activePropertyId && activePropertyId !== "all" ? String(activePropertyId) : "all"
  );
  const [selectedBuilding, setSelectedBuilding] = useState<string>("all");
  const [selectedReason, setSelectedReason] = useState<string>("all");
  const [fromDate, setFromDate] = useState<string>("");
  const [toDate, setToDate] = useState<string>("");
  const [searchQuery, setSearchQuery] = useState<string>("");
  const debouncedSearch = useDebounce(searchQuery, 300);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [pageSize, setPageSize] = useState<number>(15);

  const queryPropertyId = selectedProp !== "all" ? selectedProp : (activePropertyId && activePropertyId !== "all" ? String(activePropertyId) : "all");

  const { data: responseData, isLoading, refetch, isFetching } = useQuery({
    queryKey: [
      "room-moves-report",
      queryPropertyId,
      selectedBuilding,
      selectedReason,
      fromDate,
      toDate,
      debouncedSearch,
      currentPage,
      pageSize,
    ],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (queryPropertyId && queryPropertyId !== "all") params.append("propertyId", queryPropertyId);
      if (selectedBuilding && selectedBuilding !== "all") params.append("building", selectedBuilding);
      if (selectedReason && selectedReason !== "all") params.append("reasonCode", selectedReason);
      if (fromDate) params.append("fromDate", fromDate);
      if (toDate) params.append("toDate", toDate);
      if (debouncedSearch.trim()) params.append("search", debouncedSearch.trim());
      params.append("page", String(currentPage));
      params.append("limit", String(pageSize));

      const res = await fetch(`/api/reports/room-moves?${params.toString()}`);
      if (!res.ok) {
        throw new Error("Failed to fetch room moves report");
      }
      return res.json();
    },
  });

  const stats = responseData?.stats || {
    totalMoves: 0,
    todayMoves: 0,
    reasonsBreakdown: {},
    usersBreakdown: {},
  };

  const movesList: any[] = responseData?.moves || [];
  const allMovesList: any[] = responseData?.allMoves || [];

  const handleExportExcel = () => {
    const rowsToExport = allMovesList.length > 0 ? allMovesList : movesList;
    const excelRows = rowsToExport.map((r: any, idx: number) => ({
      "#": idx + 1,
      [ar ? "السكن / الفندق" : "Property"]: r.propertyName || "-",
      [ar ? "اسم الموظف" : "Resident Name"]: r.residentName || "-",
      [ar ? "الاسم بالإنجليزية" : "Name (EN)"]: r.residentNameEn || "-",
      [ar ? "كود الموظف" : "Staff ID"]: r.employeeId || "-",
      [ar ? "القسم" : "Department"]: r.department || "-",
      [ar ? "الوظيفة" : "Job Title"]: r.jobTitle || "-",
      [ar ? "الغرفة السابقة" : "Old Room"]: r.oldRoomNumber || "-",
      [ar ? "سرير قديم" : "Old Bed"]: r.oldBedNumber ? `#${r.oldBedNumber}` : "-",
      [ar ? "المبنى القديم" : "Old Building"]: r.oldBuildingName || "-",
      [ar ? "فئة الغرفة القديمة" : "Old Room Type"]: r.oldRoomType || "-",
      [ar ? "الغرفة الجديدة" : "New Room"]: r.newRoomNumber || "-",
      [ar ? "سرير جديد" : "New Bed"]: r.newBedNumber ? `#${r.newBedNumber}` : "-",
      [ar ? "المبنى الجديد" : "New Building"]: r.newBuildingName || "-",
      [ar ? "فئة الغرفة الجديدة" : "New Room Type"]: r.newRoomType || "-",
      [ar ? "كود السبب" : "Reason Code"]: r.reasonCode || "-",
      [ar ? "سبب النقل" : "Move Reason"]: r.moveReason || "-",
      [ar ? "منفذ الحركة (User)" : "Action By"]: r.actionByUsername || "-",
      [ar ? "تاريخ وتوقيت النقل" : "Date & Time"]: formatDateTimeCell(r.createdAt),
    }));

    const ws = XLSX.utils.json_to_sheet(excelRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Room Moves Report");

    const propName = properties.find((p) => String(p.id) === String(queryPropertyId))?.name || "All_Properties";
    XLSX.writeFile(wb, `Room_Moves_Report_${propName}_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  function formatDateTimeCell(dt: string | Date | null | undefined): string {
    if (!dt) return "-";
    const d = new Date(dt);
    if (isNaN(d.getTime())) return "-";
    const day = String(d.getDate()).padStart(2, "0");
    const month = String(d.getMonth() + 1).padStart(2, "0");
    const year = d.getFullYear();
    const hours = String(d.getHours()).padStart(2, "0");
    const minutes = String(d.getMinutes()).padStart(2, "0");
    return `${day}/${month}/${year} ${hours}:${minutes}`;
  }

  const handlePrintReport = () => {
    const propName =
      queryPropertyId !== "all"
        ? properties.find((p) => String(p.id) === String(queryPropertyId))?.displayName ||
          properties.find((p) => String(p.id) === String(queryPropertyId))?.name ||
          `Property #${queryPropertyId}`
        : ar ? "كافة الفنادق والسكنات" : "All Properties";

    const rows = (allMovesList.length > 0 ? allMovesList : movesList).map((r: any, idx: number) => [
      String(idx + 1),
      r.newRoomNumber ? `Rm ${r.newRoomNumber}${r.newBedNumber ? ` (B#${r.newBedNumber})` : ""}` : "-",
      r.residentName || "-",
      r.oldRoomNumber ? `Rm ${r.oldRoomNumber}${r.oldBedNumber ? ` (B#${r.oldBedNumber})` : ""}` : "-",
      r.moveReason || r.reasonCode || "-",
      r.actionByUsername || "System",
      formatDateTimeCell(r.createdAt),
    ]);

    printLuxuryReport({
      title: ar ? "كشف حركات نقل وتغيير الغرف (Room Moves Report)" : "Room Moves & Transfers Report",
      subtitle: ar
        ? `سجل تدقيق وإدارة انتقالات الموظفين بين الغرف والأسرة - ${propName}`
        : `PMS Room & Bed Movement Audit Trail - ${propName}`,
      isRtl: ar,
      kpis: [
        { label: ar ? "إجمالي حركات النقل" : "Total Moves", value: stats.totalMoves },
        { label: ar ? "حركات اليوم" : "Today's Moves", value: stats.todayMoves },
        { label: ar ? "بسبب الصيانة" : "Maintenance", value: stats.reasonsBreakdown?.MAINTENANCE || 0 },
        { label: ar ? "بسبب الترقية" : "Upgrades", value: stats.reasonsBreakdown?.UPGRADE || 0 },
      ],
      headers: [
        "#",
        ar ? "الغرفة الجديدة" : "New Room",
        ar ? "الموظف" : "Resident Name",
        ar ? "الغرفة السابقة" : "Old Room",
        ar ? "سبب النقل" : "Reason",
        ar ? "بواسطة" : "User",
        ar ? "تاريخ ووقت النقل" : "Date & Time",
      ],
      rows,
    });
  };

  const resetFilters = () => {
    setSelectedProp("all");
    setSelectedBuilding("all");
    setSelectedReason("all");
    setFromDate("");
    setToDate("");
    setSearchQuery("");
    setCurrentPage(1);
  };

  const getReasonBadge = (code: string, text: string) => {
    const c = (code || "").toUpperCase();
    if (c === "MAINTENANCE") {
      return (
        <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[11px] gap-1 font-medium">
          <Wrench className="w-3 h-3" />
          <span>{ar ? "صيانة وعطل" : "Maintenance"}</span>
        </Badge>
      );
    }
    if (c === "UPGRADE") {
      return (
        <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 text-[11px] gap-1 font-medium">
          <TrendingUp className="w-3 h-3" />
          <span>{ar ? "ترقية فئة" : "Upgrade"}</span>
        </Badge>
      );
    }
    if (c === "SHIFT_CHANGE") {
      return (
        <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/30 text-[11px] gap-1 font-medium">
          <Clock className="w-3 h-3" />
          <span>{ar ? "تغيير وردية" : "Shift Change"}</span>
        </Badge>
      );
    }
    if (c === "REQUEST") {
      return (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[11px] gap-1 font-medium">
          <Sparkles className="w-3 h-3" />
          <span>{ar ? "طلب شخصي" : "Personal Request"}</span>
        </Badge>
      );
    }
    return (
      <Badge variant="outline" className="text-[11px] font-medium bg-muted/30">
        {ar ? "نقل إداري" : "Administrative"}
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* ── TOP KPI SUMMARY CARDS ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* KPI 1: Total Moves */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "إجمالي حركات النقل" : "Total Room Moves"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <ArrowLeftRight className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-foreground">
              {stats.totalMoves}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5 text-indigo-500" />
              <span>{ar ? "سجل تدقيق كامل للغرف والأسرة" : "Full audit log of room transitions"}</span>
            </p>
          </div>
        </div>

        {/* KPI 2: Today's Moves */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "حركات اليوم" : "Today's Moves"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <Clock className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-emerald-600 dark:text-emerald-400">
              {stats.todayMoves}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span>{ar ? "تحركات مسجلة خلال تاريخ اليوم" : "Room moves registered today"}</span>
            </p>
          </div>
        </div>

        {/* KPI 3: Maintenance Moves */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "نقل بسبب الصيانة والأعطال" : "Maintenance Moves"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <Wrench className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-foreground">
              {stats.reasonsBreakdown?.MAINTENANCE || 0}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span>{ar ? "غرف تم إخلاؤها للصيانة العاجلة" : "Rooms vacated for urgent repair"}</span>
            </p>
          </div>
        </div>

        {/* KPI 4: Upgrade / Reallocation */}
        <div className="rounded-2xl border bg-card p-5 shadow-xs flex flex-col justify-between relative overflow-hidden">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "ترقيات الفئات والدرجات" : "Upgrade & Reallocations"}
            </span>
            <div className="w-10 h-10 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="mt-3">
            <div className="text-3xl font-black tracking-tight text-foreground">
              {(stats.reasonsBreakdown?.UPGRADE || 0) + (stats.reasonsBreakdown?.SHIFT_CHANGE || 0)}
            </div>
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1.5">
              <span>{ar ? "ترقية درجات وتوافق ورديات" : "Job upgrades & shift changes"}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── FILTER TOOLBAR ── */}
      <div className="rounded-2xl border bg-card p-4 shadow-xs space-y-4">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-3">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-5 gap-3 flex-1">
            {/* Property Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "السكن / الفندق" : "Property"}
              </Label>
              <Select value={selectedProp} onValueChange={(val) => { setSelectedProp(val); setCurrentPage(1); }}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder={ar ? "كافة السكنات" : "All Properties"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كافة السكنات والفنادق" : "All Properties"}</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.displayName || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Building Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "المبنى" : "Building"}
              </Label>
              <Select value={selectedBuilding} onValueChange={(val) => { setSelectedBuilding(val); setCurrentPage(1); }}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder={ar ? "كافة المباني" : "All Buildings"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كافة المباني" : "All Buildings"}</SelectItem>
                  {buildings.map((b) => (
                    <SelectItem key={b.id} value={b.name}>
                      {b.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Reason Code Filter */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "سبب النقل" : "Move Reason"}
              </Label>
              <Select value={selectedReason} onValueChange={(val) => { setSelectedReason(val); setCurrentPage(1); }}>
                <SelectTrigger className="text-xs h-9">
                  <SelectValue placeholder={ar ? "كافة الأسباب" : "All Reasons"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كافة الأسباب" : "All Reasons"}</SelectItem>
                  <SelectItem value="MAINTENANCE">{ar ? "صيانة وعطل (Maintenance)" : "Maintenance"}</SelectItem>
                  <SelectItem value="UPGRADE">{ar ? "ترقية فئة السكن (Upgrade)" : "Upgrade"}</SelectItem>
                  <SelectItem value="SHIFT_CHANGE">{ar ? "تغيير وردية (Shift Change)" : "Shift Change"}</SelectItem>
                  <SelectItem value="REQUEST">{ar ? "طلب شخصي (Request)" : "Personal Request"}</SelectItem>
                  <SelectItem value="ADMINISTRATIVE">{ar ? "إداري وتسكين عام" : "Administrative"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Date From */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "من تاريخ" : "From Date"}
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => { setFromDate(e.target.value); setCurrentPage(1); }}
                className="text-xs h-9"
              />
            </div>

            {/* Date To */}
            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-muted-foreground">
                {ar ? "إلى تاريخ" : "To Date"}
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => { setToDate(e.target.value); setCurrentPage(1); }}
                className="text-xs h-9"
              />
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-2 shrink-0">
            <Button
              variant="outline"
              size="sm"
              onClick={resetFilters}
              className="text-xs h-9"
              title={ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
            >
              <RefreshCw className="w-3.5 h-3.5 me-1" />
              <span>{ar ? "إعادة ضبط" : "Reset"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handleExportExcel}
              className="text-xs h-9 border-emerald-500/40 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/10"
            >
              <Download className="w-3.5 h-3.5 me-1" />
              <span>{ar ? "تصدير إكسيل" : "Excel"}</span>
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={handlePrintReport}
              className="text-xs h-9 bg-primary/5 text-primary hover:bg-primary/10 border-primary/30"
            >
              <Printer className="w-3.5 h-3.5 me-1" />
              <span>{ar ? "طباعة فاخرة (PDF)" : "Print PDF"}</span>
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="w-4 h-4 absolute start-3 top-2.5 text-muted-foreground" />
          <Input
            type="text"
            value={searchQuery}
            onChange={(e) => { setSearchQuery(e.target.value); setCurrentPage(1); }}
            placeholder={
              ar
                ? "ابحث برقم الغرفة (قديمة أو جديدة)، اسم الموظف، كود الموظف، أو اسم المشرف المنفذ..."
                : "Search by room number, resident name, staff ID, or supervisor username..."
            }
            className="text-xs ps-9 h-9"
          />
        </div>
      </div>

      {/* ── ROOM MOVES TABLE (PMS HOSPITALITY FORMAT) ── */}
      <div className="rounded-2xl border bg-card shadow-xs overflow-hidden">
        <div className="p-4 border-b bg-muted/20 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
              <ArrowLeftRight className="w-4 h-4 text-primary" />
              <span>{ar ? "كشف سجل حركات نقل الغرف (Room Moves Log)" : "Room Moves & Transfers PMS Manifest"}</span>
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {ar
                ? "كشف تشغيلي يوثق بدقة كافة الانتقالات وتغييرات الغرف والأسرة وأسبابها والمشرف المنفذ."
                : "Official PMS operational log documenting room & bed transfers with reason codes and audit trail."}
            </p>
          </div>
          <span className="text-xs font-mono font-medium text-muted-foreground">
            {stats.totalMoves} {ar ? "حركة نقل مسجلة" : "moves recorded"}
          </span>
        </div>

        {movesList.length === 0 ? (
          <div className="py-12 text-center text-muted-foreground text-xs space-y-2">
            <ArrowLeftRight className="w-8 h-8 mx-auto opacity-30" />
            <p>{ar ? "لا توجد حركات نقل مسجلة مطابقة لمعايير البحث." : "No room moves found matching current criteria."}</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 text-xs">
                  <TableHead className="w-12 text-center font-bold">#</TableHead>
                  <TableHead className="w-44 font-bold">{ar ? "الغرفة الجديدة (To)" : "New Room"}</TableHead>
                  <TableHead className="w-56 font-bold">{ar ? "الموظف والمقيم" : "Resident / Staff"}</TableHead>
                  <TableHead className="w-44 font-bold">{ar ? "الغرفة السابقة (From)" : "Old Room"}</TableHead>
                  <TableHead className="font-bold">{ar ? "سبب النقل (Reason Code)" : "Move Reason"}</TableHead>
                  <TableHead className="w-36 font-bold">{ar ? "المنفذ (User)" : "Action By"}</TableHead>
                  <TableHead className="w-36 text-end font-bold">{ar ? "التاريخ والوقت" : "Date & Time"}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {movesList.map((m: any, idx: number) => {
                  return (
                    <TableRow key={m.id || idx} className="hover:bg-muted/30 text-xs">
                      {/* # Number */}
                      <TableCell className="text-center font-mono text-xs text-muted-foreground">
                        {(currentPage - 1) * pageSize + idx + 1}
                      </TableCell>

                      {/* New Room */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="flex items-center gap-1.5 font-bold text-foreground">
                            <span className="text-sm font-mono text-primary font-black">
                              {m.newRoomNumber}
                            </span>
                            {m.newBedNumber && (
                              <Badge variant="outline" className="px-1.5 py-0 text-[10px] bg-primary/5 text-primary border-primary/30">
                                {ar ? `سرير ${m.newBedNumber}` : `Bed ${m.newBedNumber}`}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[11px] text-muted-foreground truncate">
                            {m.newBuildingName || m.propertyName || "-"}
                            {m.newRoomType && ` • ${m.newRoomType}`}
                          </div>
                        </div>
                      </TableCell>

                      {/* Resident Info */}
                      <TableCell>
                        <div className="space-y-0.5">
                          <div className="font-bold text-foreground truncate">
                            {m.residentName}
                          </div>
                          <div className="text-[11px] text-muted-foreground flex items-center gap-1.5 truncate">
                            {m.employeeId && (
                              <span className="font-mono text-[10px] px-1 py-0.2 rounded bg-muted">
                                {m.employeeId}
                              </span>
                            )}
                            <span>{m.department || m.jobTitle || ""}</span>
                          </div>
                        </div>
                      </TableCell>

                      {/* Old Room */}
                      <TableCell>
                        <div className="space-y-0.5 opacity-90">
                          <div className="flex items-center gap-1.5 font-semibold text-muted-foreground">
                            <span className="text-xs font-mono line-through text-rose-600 dark:text-rose-400">
                              {m.oldRoomNumber}
                            </span>
                            {m.oldBedNumber && (
                              <Badge variant="outline" className="px-1 py-0 text-[9px] bg-muted text-muted-foreground">
                                {ar ? `سرير ${m.oldBedNumber}` : `Bed ${m.oldBedNumber}`}
                              </Badge>
                            )}
                          </div>
                          <div className="text-[10px] text-muted-foreground truncate">
                            {m.oldBuildingName || "-"}
                            {m.oldRoomType && ` • ${m.oldRoomType}`}
                          </div>
                        </div>
                      </TableCell>

                      {/* Move Reason */}
                      <TableCell>
                        <div className="space-y-1">
                          <div>
                            {getReasonBadge(m.reasonCode, m.moveReason)}
                          </div>
                          {m.moveReason && (
                            <p className="text-[11px] text-muted-foreground leading-snug truncate max-w-xs">
                              {m.moveReason}
                            </p>
                          )}
                        </div>
                      </TableCell>

                      {/* Action By User */}
                      <TableCell>
                        <div className="flex items-center gap-1.5">
                          <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0">
                            <User className="w-3 h-3 text-muted-foreground" />
                          </div>
                          <span className="font-mono text-xs text-foreground font-medium truncate">
                            {m.actionByUsername || "System"}
                          </span>
                        </div>
                      </TableCell>

                      {/* Date & Time */}
                      <TableCell className="text-end font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {formatDateTimeCell(m.createdAt)}
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}

        {/* Footer info matching reference image */}
        <div className="p-3 border-t bg-muted/10 flex flex-col sm:flex-row items-center justify-between gap-2 text-[11px] text-muted-foreground">
          <div className="flex items-center gap-2">
            <span className="font-mono">Filter: {fromDate || "All"} to {toDate || "All"}</span>
            <span>•</span>
            <span>Reason: {selectedReason}</span>
            <span>•</span>
            <span className="font-mono">Report: room_move</span>
          </div>

          <DataPagination
            total={stats.totalMoves}
            pageSize={pageSize}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
            onPageSizeChange={(newSize) => { setPageSize(newSize); setCurrentPage(1); }}
          />
        </div>
      </div>
    </div>
  );
}
