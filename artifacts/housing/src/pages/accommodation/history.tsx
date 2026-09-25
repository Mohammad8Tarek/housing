import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useListProfiles,
  useListRooms,
  useListBuildings,
  useListFloors,
  useGetSettings,
  useListProperties,
} from "@workspace/api-client-react";
import { useDebounce } from "@/hooks/use-debounce";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { PermissionGate } from "@/components/ui/permission-gate";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { formatDate, getExportFileName } from "@/lib/date-utils";
import { DataPagination } from "@/components/DataPagination";
import {
  Search,
  Building2,
  BedDouble,
  History,
  FileText,
  FileSpreadsheet,
  Trash2,
  Printer,
} from "lucide-react";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { printLuxuryReport } from "@/pages/reports/utils/luxury-report-engine";
import { ReportPrintStudioModal } from "@/pages/reports/components/ReportPrintStudioModal";
import type { ReportColumnConfig, ReportKpiItem } from "@/pages/reports/components/PrintableReportDocument";
import * as XLSX from "xlsx";
import { exportExcel as exportExcelUtil } from "@/pages/reports/utils/export";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ENDED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    CHECKED_OUT: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
    TRANSFERRED:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
};

const formatStatus = (status: string, ar: boolean) => {
  if (status === "CHECKED_OUT") return ar ? "مغادرة" : "Checked Out";
  if (status === "TRANSFERRED") return ar ? "منقول" : "Transferred";
  if (status === "ENDED") return ar ? "منتهي" : "Ended";
  if (status === "CANCELLED") return ar ? "ملغي" : "Cancelled";
  return status;
};

function ProfileMini({
  emp,
  photoUrl,
}: {
  emp: any;
  photoUrl?: string | null;
}) {
  const fName = emp?.firstName || "";
  const lName = emp?.lastName || "";
  const initials = (fName || lName)
    ? `${fName[0] ?? ""}${lName[0] ?? ""}`.toUpperCase()
    : "ID";
  return (
    <div className="flex items-center gap-2">
      {photoUrl ? (
        <img
          src={photoUrl}
          alt={initials}
          className="w-8 h-8 rounded-full object-cover border flex-shrink-0"
        />
      ) : (
        <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0">
          <span className="text-xs font-bold text-primary">{initials}</span>
        </div>
      )}
      <div className="min-w-0">
        <p className="font-medium text-sm whitespace-nowrap">
          {fName || lName ? `${fName} ${lName}` : `#${emp?.profileId || "—"}`}
        </p>
        <p className="text-xs text-muted-foreground">{emp?.department ?? ""}</p>
      </div>
    </div>
  );
}

export default function HistoryPage() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";

  const [pageSize, setPageSize] = useState(20);
  const [currentPage, setCurrentPage] = useState(1);
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebounce(search, 500);
  const [filterStatus, setFilterStatus] = useState("ALL");
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const [deleteRecord, setDeleteRecord] = useState<any>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [confirmBulkDelete, setConfirmBulkDelete] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);

  // Print Studio Modal state
  const [isStudioOpen, setIsStudioOpen] = useState(false);
  const [studioRows, setStudioRows] = useState<any[]>([]);
  const [isFetchingStudio, setIsFetchingStudio] = useState(false);

  const { data: assignmentsData, isLoading } = useQuery({
    queryKey: [
      "accommodationHistory",
      activePropertyId,
      currentPage,
      pageSize,
      debouncedSearch,
      filterStatus,
    ],
    queryFn: async () => {
      const qs = new URLSearchParams();
      if (activePropertyId) qs.set("propertyId", activePropertyId.toString());
      qs.set("page", currentPage.toString());
      qs.set("limit", pageSize.toString());
      if (debouncedSearch) qs.set("search", debouncedSearch);
      if (filterStatus && filterStatus !== "ALL") qs.set("status", filterStatus);

      const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/assignments/history?${qs.toString()}`, { 
        headers,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch history");
      return res.json() as Promise<{ data: any[]; pagination: { total: number } }>;
    },
    enabled: !!activePropertyId,
  });

  const propId = typeof activePropertyId === "number" ? activePropertyId : undefined;

  const { data: _eDataWrapper } = useListProfiles({ propertyId: propId });
  const profiles = (_eDataWrapper as any)?.profiles || (_eDataWrapper as any)?.data || [];
  const { data: _rData } = useListRooms({ propertyId: propId });
  const rooms = (_rData as any)?.data || [];
  const { data: _bData } = useListBuildings({ propertyId: propId });
  const buildings = (_bData as any)?.data || _bData || [];
  const { data: _fData } = useListFloors({ propertyId: propId });
  const floors = (_fData as any)?.data || _fData || [];
  const { data: settings } = useGetSettings({ propertyId: propId } as any);
  const { data: _pData } = useListProperties();
  const properties = _pData || [];

  const empMap = Object.fromEntries(profiles.map((e: any) => [e.id, e]));
  const roomMap = Object.fromEntries(rooms.map((r: any) => [r.id, r]));
  const buildingMap = Object.fromEntries(buildings.map((b: any) => [b.id, b.name]));
  const floorMap = Object.fromEntries(
    floors.map((f: any) => [f.id, { name: f.floorNumber, number: f.floorNumber }]),
  );

  const paged = assignmentsData?.data || [];
  const totalItems = assignmentsData?.pagination?.total || 0;

  // Bulk selection helpers
  const pagedIds = paged.map((a) => a.id);
  const allPageSelected =
    pagedIds.length > 0 && pagedIds.every((id) => selectedRows.has(id));
  const toggleSelectAll = () => {
    if (allPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedIds.forEach((id) => next.add(id));
        return next;
      });
    }
  };
  const toggleRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  // Get selected or all fetched assignments
  const exportTarget = () =>
    selectedRows.size > 0
      ? paged.filter((a) => selectedRows.has(a.id))
      : paged;

  const handleDeleteSingle = async () => {
    if (!deleteRecord) return;
    setIsDeleting(true);
    try {
      const token =
        localStorage.getItem("auth_token") ||
        sessionStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(
        `/api/assignments/${deleteRecord.id}?propertyId=${activePropertyId}`,
        {
          method: "DELETE",
          headers,
          credentials: "include",
        },
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete" }));
        throw new Error(err.error || "Failed to delete");
      }
      setDeleteRecord(null);
      queryClient.invalidateQueries({ queryKey: ["accommodationHistory"] });
      toast.success(
        ar ? "تم حذف السجل بنجاح" : "Record Deleted Successfully",
        {
          description: ar
            ? "تمت إزالة سجل التسكين بنجاح من قاعدة البيانات"
            : "The accommodation record was removed successfully from the system",
        },
      );
    } catch (e: any) {
      toast.error(
        ar ? "فشل حذف السجل" : "Failed to Delete Record",
        {
          description: e.message || (ar ? "حدث خطأ أثناء محاولة حذف السجل" : "An error occurred while attempting to delete the record"),
        },
      );
    } finally {
      setIsDeleting(false);
    }
  };

  const handleBulkDelete = async () => {
    const ids = Array.from(selectedRows);
    if (ids.length === 0) return;
    setIsBulkDeleting(true);
    try {
      const token =
        localStorage.getItem("auth_token") ||
        sessionStorage.getItem("auth_token");
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch(`/api/assignments/bulk-delete?propertyId=${activePropertyId}`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({ ids, propertyId: activePropertyId }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Failed to delete" }));
        throw new Error(err.error || "Failed to delete");
      }
      const data = await res.json();
      setSelectedRows(new Set());
      setConfirmBulkDelete(false);
      queryClient.invalidateQueries({ queryKey: ["accommodationHistory"] });
      toast.success(
        ar ? "تم الحذف الجماعي بنجاح" : "Bulk Deletion Completed",
        {
          description: ar
            ? `تم حذف ${data.deletedCount ?? ids.length} سجل بنجاح من الأرشيف`
            : `Successfully deleted ${data.deletedCount ?? ids.length} records from history`,
        },
      );
    } catch (e: any) {
      toast.error(
        ar ? "فشل الحذف الجماعي" : "Bulk Deletion Failed",
        {
          description: e.message || (ar ? "حدث خطأ أثناء محاولة الحذف الجماعي" : "An error occurred during bulk deletion"),
        },
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const exportExcel = () => {
    const rows = exportTarget().map((a) => {
      const emp = empMap[a.profileId];
      const room = roomMap[a.roomId];
      const building = a.buildingName || (room ? buildingMap[room.buildingId] : null);
      const floorNum = a.floorNumber ?? (room && floorMap[room.floorId] ? floorMap[room.floorId].number : "");
      const roomNum = a.roomNumber || room?.roomNumber || String(a.roomId);
      const empName = (a.profileFirstName && a.profileLastName)
        ? `${a.profileFirstName} ${a.profileLastName}`
        : (emp ? `${emp.firstName} ${emp.lastName}` : `#${a.profileId}`);
      const empCode = a.profileCode || emp?.profileId || "";
      const nationalId = a.profileNationalId || emp?.nationalId || "";
      const nationality = a.profileNationality || (emp as any)?.nationality || "";
      const jobTitle = a.profileJobTitle || emp?.jobTitle || "";
      const department = a.profileDepartment || emp?.department || "";
      const checkOutDate = a.checkOutDate || (a as any).actualCheckOutDate;
      const daysStayed =
        a.checkInDate && checkOutDate
          ? Math.max(
              0,
              Math.round(
                (new Date(checkOutDate).getTime() -
                  new Date(a.checkInDate).getTime()) /
                  86400000,
              ),
            )
          : null;
      return {
        Name: empName,
        Code: empCode,
        "National ID": nationalId,
        Nationality: nationality,
        "Job Title": jobTitle,
        Department: department,
        Building: building ?? "",
        Floor: floorNum,
        Room: roomNum,
        Bed: a.bedNumber ?? "",
        "Check-in": formatDate(a.checkInDate, ""),
        "Check-out": formatDate(checkOutDate, ""),
        Days: daysStayed ?? "",
        Notes: a.notes ?? "",
        Status: formatStatus(a.status, ar),
      };
    });
    exportExcelUtil("Housing_History", rows, {
      sheetName: ar ? "سجل التسكين" : "History",
      orientation: "landscape",
    });
  };

  const activePropObj = properties.find((p: any) => p.id === activePropertyId);

  const formatHistoryRow = (a: any) => {
    const emp = empMap[a.profileId];
    const room = roomMap[a.roomId];
    const building = a.buildingName || (room ? buildingMap[room.buildingId] : null);
    const floorNum = a.floorNumber ?? (room && floorMap[room.floorId] ? String(floorMap[room.floorId].number) : "—");
    const roomNum = a.roomNumber || room?.roomNumber || String(a.roomId);

    const empName = ar
      ? (a.profileFirstNameAr && a.profileLastNameAr ? `${a.profileFirstNameAr} ${a.profileLastNameAr}` : (emp?.firstNameAr ? `${emp.firstNameAr} ${emp.lastNameAr || ""}`.trim() : (emp ? `${emp.firstName} ${emp.lastName}` : `#${a.profileId}`)))
      : (a.profileFirstName && a.profileLastName ? `${a.profileFirstName} ${a.profileLastName}` : (emp ? `${emp.firstName} ${emp.lastName}` : `#${a.profileId}`));

    const empCode = a.profileCode || emp?.profileId || "";
    const nationalId = a.profileNationalId || emp?.nationalId || "";
    const department = ar
      ? (a.profileDepartmentAr || emp?.departmentAr || a.profileDepartment || emp?.department || "—")
      : (a.profileDepartment || emp?.department || "—");

    const checkOutDate = a.checkOutDate || (a as any).actualCheckOutDate;
    const daysStayed =
      a.checkInDate && checkOutDate
        ? Math.max(
            0,
            Math.round(
              (new Date(checkOutDate).getTime() -
                new Date(a.checkInDate).getTime()) /
                86400000,
            ),
          )
        : null;

    return {
      empName,
      empCode,
      nationalId,
      department,
      building: building || "—",
      floor: floorNum,
      room: roomNum,
      bed: a.bedNumber ? String(a.bedNumber) : "—",
      checkIn: formatDate(a.checkInDate),
      checkOut: formatDate(checkOutDate),
      days: daysStayed !== null ? daysStayed : "—",
      status: formatStatus(a.status, ar),
    };
  };

  const studioColumns: ReportColumnConfig[] = [
    { key: "empName", header: "Employee Name", headerAr: "اسم الموظف", type: "text", align: "right" },
    { key: "empCode", header: "Code", headerAr: "كود الموظف", type: "badge", align: "center", width: "85px" },
    { key: "nationalId", header: "National ID", headerAr: "الرقم القومي", type: "text", align: "center", width: "110px" },
    { key: "department", header: "Department", headerAr: "القسم", type: "text", align: "right" },
    { key: "building", header: "Building", headerAr: "المبنى", type: "text", align: "right" },
    { key: "floor", header: "Floor", headerAr: "الدور", type: "text", align: "center", width: "55px" },
    { key: "room", header: "Room", headerAr: "الغرفة", type: "badge", align: "center", width: "65px" },
    { key: "bed", header: "Bed", headerAr: "السرير", type: "text", align: "center", width: "55px" },
    { key: "checkIn", header: "Check-in", headerAr: "تاريخ التسكين", type: "date", align: "center", width: "95px" },
    { key: "checkOut", header: "Check-out", headerAr: "تاريخ المغادرة", type: "date", align: "center", width: "95px" },
    { key: "days", header: "Days", headerAr: "المدة (أيام)", type: "number", align: "center", width: "70px" },
    { key: "status", header: "Status", headerAr: "حالة السجل", type: "status", align: "center", width: "90px" },
  ];

  const studioKpis: ReportKpiItem[] = [
    {
      label: "Total Records",
      labelAr: "إجمالي السجلات",
      value: (studioRows.length || totalItems).toLocaleString(),
      color: "blue",
    },
    {
      label: "Checked Out",
      labelAr: "تمت المغادرة",
      value: (studioRows.filter((r) => r.status && (r.status.includes("مغادرة") || r.status.toLowerCase().includes("out"))).length || 0).toLocaleString(),
      color: "amber",
    },
    {
      label: "Transferred",
      labelAr: "منقولون",
      value: (studioRows.filter((r) => r.status && (r.status.includes("منقول") || r.status.toLowerCase().includes("transfer"))).length || 0).toLocaleString(),
      color: "emerald",
    },
  ];

  const openPrintStudio = async () => {
    let rawRows: any[] = [];
    if (selectedRows.size > 0) {
      rawRows = paged.filter((a) => selectedRows.has(a.id));
    } else {
      setIsFetchingStudio(true);
      try {
        const qs = new URLSearchParams();
        if (activePropertyId) qs.set("propertyId", activePropertyId.toString());
        qs.set("page", "1");
        qs.set("limit", "2000");
        if (debouncedSearch) qs.set("search", debouncedSearch);
        if (filterStatus && filterStatus !== "ALL") qs.set("status", filterStatus);

        const token = localStorage.getItem("auth_token") || sessionStorage.getItem("auth_token");
        const headers: Record<string, string> = { "Content-Type": "application/json" };
        if (token) headers["Authorization"] = `Bearer ${token}`;

        const res = await fetch(`/api/assignments/history?${qs.toString()}`, {
          headers,
          credentials: "include",
        });
        if (res.ok) {
          const json = await res.json();
          rawRows = json.data || paged;
        } else {
          rawRows = paged;
        }
      } catch {
        rawRows = paged;
      } finally {
        setIsFetchingStudio(false);
      }
    }

    if (!rawRows.length) {
      toast.error(ar ? "لا توجد سجلات لتصديرها" : "No records to export");
      return;
    }

    const formatted = rawRows.map(formatHistoryRow);
    setStudioRows(formatted);
    setIsStudioOpen(true);
  };

  const exportPDF = openPrintStudio;

  const HIST_COLS = [
    {
      key: "profile",
      label: "Profile",
      labelAr: "الموظف",
      defaultVisible: true,
    },
    { key: "code", label: "Code", labelAr: "الكود", defaultVisible: true },
    {
      key: "nationalid",
      label: "National ID",
      labelAr: "الهوية",
      defaultVisible: true,
    },
    {
      key: "nationality",
      label: "Nationality",
      labelAr: "الجنسية",
      defaultVisible: true,
    },
    {
      key: "jobtitle",
      label: "Job Title",
      labelAr: "المسمى",
      defaultVisible: true,
    },
    {
      key: "building",
      label: "Building",
      labelAr: "المبنى",
      defaultVisible: true,
    },
    { key: "floor", label: "Floor", labelAr: "الدور", defaultVisible: true },
    { key: "room", label: "Room", labelAr: "الغرفة", defaultVisible: true },
    { key: "bed", label: "Bed", labelAr: "السرير", defaultVisible: true },
    {
      key: "checkin",
      label: "Check-in",
      labelAr: "الدخول",
      defaultVisible: true,
    },
    {
      key: "checkout",
      label: "Check-out",
      labelAr: "الخروج",
      defaultVisible: true,
    },
    { key: "days", label: "Days", labelAr: "المدة", defaultVisible: true },
    { key: "notes", label: "Notes", labelAr: "ملاحظات", defaultVisible: false },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
  ];
  const {
    visible: histVisible,
    toggle: histToggle,
    showAll: histShowAll,
    hideAll: histHideAll,
    isVisible: isHistVisible,
  } = useColumnVisibility(HIST_COLS);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <History className="w-6 h-6 text-primary" />
            {ar ? "سجل التسكين" : "Housing History"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <ColumnChooser
            cols={HIST_COLS}
            visible={histVisible}
            onToggle={histToggle}
            onShowAll={histShowAll}
            onHideAll={histHideAll}
          />
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
          >
            <FileSpreadsheet className="w-4 h-4" />
            {ar ? "تصدير إكسيل" : "Export Excel"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={openPrintStudio}
            disabled={isFetchingStudio}
            className="gap-2 text-primary border-primary/20 hover:bg-primary/5"
          >
            <Printer className="w-4 h-4" />
            {isFetchingStudio ? (ar ? "جاري التجهيز..." : "Preparing...") : (ar ? "استوديو الطباعة و PDF" : "Print Studio & PDF")}
          </Button>
        </div>
      </div>

      {/* Bulk action bar */}
      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportExcel}
        actions={
          can("accommodation", "delete")
            ? [
                {
                  label: ar ? "حذف السجلات المحددة" : "Delete Selected",
                  variant: "destructive",
                  icon: <Trash2 className="w-3.5 h-3.5" />,
                  onClick: () => setConfirmBulkDelete(true),
                },
              ]
            : undefined
        }
        extraActions={
          <Button
            variant="outline"
            size="sm"
            onClick={openPrintStudio}
            className="gap-1.5 text-primary border-primary/20 hover:bg-primary/5"
          >
            <Printer className="w-3.5 h-3.5" />
            {ar ? "استوديو الطباعة" : "Print Studio"}
          </Button>
        }
        ar={ar}
      />

      {/* Filters */}
      <div className="flex gap-3 flex-wrap print:hidden">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            className="pl-9"
            placeholder={
              ar
                ? "بحث بالاسم أو الكود أو الهوية أو الغرفة..."
                : "Search by name, code, ID or room..."
            }
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setCurrentPage(1);
            }}
          />
        </div>
        <Select
          value={filterStatus}
          onValueChange={(v) => {
            setFilterStatus(v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-40">
            <SelectValue placeholder={ar ? "كل الحالات" : "All Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">
              {ar ? "كل الحالات" : "All Status"}
            </SelectItem>
            <SelectItem value="CHECKED_OUT">
              {ar ? "تمت المغادرة (Checked Out)" : "Checked Out"}
            </SelectItem>
            <SelectItem value="TRANSFERRED">
              {ar ? "تم النقل (Transferred)" : "Transferred"}
            </SelectItem>
            <SelectItem value="ENDED">
              {ar ? "منتهي (Ended)" : "Ended"}
            </SelectItem>
            <SelectItem value="CANCELLED">
              {ar ? "ملغي (Cancelled)" : "Cancelled"}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg bg-card overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allPageSelected}
                    onCheckedChange={toggleSelectAll}
                  />
                </TableHead>
                {isHistVisible("profile") && (
                  <TableHead className="font-semibold">
                    {ar ? "الموظف" : "Profile"}
                  </TableHead>
                )}
                {isHistVisible("code") && (
                  <TableHead className="font-semibold">
                    {ar ? "الكود" : "Code"}
                  </TableHead>
                )}
                {isHistVisible("nationalid") && (
                  <TableHead className="font-semibold">
                    {ar ? "الهوية" : "National ID"}
                  </TableHead>
                )}
                {isHistVisible("nationality") && (
                  <TableHead className="font-semibold">
                    {ar ? "الجنسية" : "Nationality"}
                  </TableHead>
                )}
                {isHistVisible("jobtitle") && (
                  <TableHead className="font-semibold">
                    {ar ? "المسمى الوظيفي" : "Job Title"}
                  </TableHead>
                )}
                {isHistVisible("building") && (
                  <TableHead className="font-semibold">
                    {ar ? "المبنى" : "Building"}
                  </TableHead>
                )}
                {isHistVisible("floor") && (
                  <TableHead className="font-semibold">
                    {ar ? "الدور" : "Floor"}
                  </TableHead>
                )}
                {isHistVisible("room") && (
                  <TableHead className="font-semibold">
                    {ar ? "الغرفة" : "Room"}
                  </TableHead>
                )}
                {isHistVisible("bed") && (
                  <TableHead className="font-semibold">
                    {ar ? "السرير" : "Bed"}
                  </TableHead>
                )}
                {isHistVisible("checkin") && (
                  <TableHead className="font-semibold">
                    {ar ? "الدخول" : "Check-in"}
                  </TableHead>
                )}
                {isHistVisible("checkout") && (
                  <TableHead className="font-semibold">
                    {ar ? "الخروج" : "Check-out"}
                  </TableHead>
                )}
                {isHistVisible("days") && (
                  <TableHead className="font-semibold">
                    {ar ? "المدة" : "Days"}
                  </TableHead>
                )}
                {isHistVisible("notes") && (
                  <TableHead className="font-semibold">
                    {ar ? "ملاحظات" : "Notes"}
                  </TableHead>
                )}
                {isHistVisible("status") && (
                  <TableHead className="font-semibold">
                    {ar ? "الحالة" : "Status"}
                  </TableHead>
                )}
                <TableHead className="w-12 text-center">
                  {ar ? "إجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {paged.map((a) => {
                const emp = empMap[a.profileId] || {
                  firstName: a.profileFirstName,
                  lastName: a.profileLastName,
                  profileId: a.profileCode,
                  nationalId: a.profileNationalId,
                  nationality: a.profileNationality,
                  jobTitle: a.profileJobTitle,
                  department: a.profileDepartment,
                  photoUrl: a.profilePhotoUrl,
                };
                const room = roomMap[a.roomId];
                const building =
                  a.buildingName || (room ? buildingMap[room.buildingId] : null);
                const floorNumber =
                  a.floorNumber ??
                  (room && floorMap[room.floorId]
                    ? floorMap[room.floorId].number
                    : null);
                const roomNumber =
                  a.roomNumber || room?.roomNumber || String(a.roomId);
                const checkOutDate =
                  a.checkOutDate || (a as any).actualCheckOutDate;
                const daysStayed =
                  a.checkInDate && checkOutDate
                    ? Math.max(
                        0,
                        Math.round(
                          (new Date(checkOutDate).getTime() -
                            new Date(a.checkInDate).getTime()) /
                            86400000,
                        ),
                      )
                    : null;

                const isSelected = selectedRows.has(a.id);
                return (
                  <TableRow
                    key={a.id}
                    className={
                      isSelected ? "bg-primary/5" : "hover:bg-muted/20"
                    }
                  >
                    <TableCell className="px-3">
                      <Checkbox
                        checked={isSelected}
                        onCheckedChange={() => toggleRow(a.id)}
                      />
                    </TableCell>
                    {isHistVisible("profile") && (
                      <TableCell>
                        <ProfileMini
                          emp={emp}
                          photoUrl={a.profilePhotoUrl || (emp as any)?.photoUrl}
                        />
                      </TableCell>
                    )}
                    {isHistVisible("code") && (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {a.profileCode || emp?.profileId || `#${a.profileId}`}
                      </TableCell>
                    )}
                    {isHistVisible("nationalid") && (
                      <TableCell className="font-mono text-xs">
                        {a.profileNationalId || emp?.nationalId || "—"}
                      </TableCell>
                    )}
                    {isHistVisible("nationality") && (
                      <TableCell className="text-sm">
                        {a.profileNationality || (emp as any)?.nationality || "—"}
                      </TableCell>
                    )}
                    {isHistVisible("jobtitle") && (
                      <TableCell className="text-sm">
                        {a.profileJobTitle || emp?.jobTitle || "—"}
                      </TableCell>
                    )}
                    {isHistVisible("building") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {building ? (
                          <span className="flex items-center gap-1">
                            <Building2 className="w-3 h-3 text-muted-foreground" />
                            {building}
                          </span>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    {isHistVisible("floor") && (
                      <TableCell className="text-sm">
                        {floorNumber ?? "—"}
                      </TableCell>
                    )}
                    {isHistVisible("room") && (
                      <TableCell>
                        <span className="font-mono font-semibold text-primary">
                          {roomNumber}
                        </span>
                      </TableCell>
                    )}
                    {isHistVisible("bed") && (
                      <TableCell className="text-sm">
                        {a.bedNumber ? (
                          <Badge variant="outline" className="text-xs">
                            <BedDouble className="w-3 h-3 mr-1" />
                            {a.bedNumber}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    {isHistVisible("checkin") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(a.checkInDate)}
                      </TableCell>
                    )}
                    {isHistVisible("checkout") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {formatDate(checkOutDate)}
                      </TableCell>
                    )}
                    {isHistVisible("days") && (
                      <TableCell className="text-sm text-center">
                        {daysStayed !== null ? (
                          <Badge variant="outline" className="text-xs">
                            {daysStayed}
                            {ar ? " يوم" : "d"}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    {isHistVisible("notes") && (
                      <TableCell className="text-sm max-w-[120px] truncate text-muted-foreground">
                        {a.notes || "—"}
                      </TableCell>
                    )}
                    {isHistVisible("status") && (
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusBadge(a.status)}`}
                        >
                          {formatStatus(a.status, ar)}
                        </span>
                      </TableCell>
                    )}
                    <TableCell className="text-center">
                      <PermissionGate module="accommodation" action="delete">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 text-destructive hover:text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteRecord(a)}
                          title={ar ? "حذف السجل" : "Delete Record"}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </PermissionGate>
                    </TableCell>
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={histVisible.size + 2}
                    className="py-12 text-center"
                  >
                    <History className="w-8 h-8 mx-auto mb-2 opacity-30" />
                    <p className="font-medium text-muted-foreground">
                      {ar
                        ? "لا توجد سجلات تاريخية"
                        : "No history records found"}
                    </p>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {totalItems > 0 && (
            <DataPagination
              total={totalItems}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          )}
        </div>
      )}

      {/* Single Delete Confirmation Dialog */}
      <AlertDialog
        open={!!deleteRecord}
        onOpenChange={(open) => !open && setDeleteRecord(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "تأكيد حذف السجل" : "Confirm Delete Record"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هل أنت متأكد من حذف هذا السجل من تاريخ التسكين؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this record from housing history? This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteSingle}
              disabled={isDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {ar ? "جاري الحذف..." : "Deleting..."}
                </span>
              ) : (
                ar ? "تأكيد الحذف" : "Confirm Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Bulk Delete Confirmation Dialog */}
      <AlertDialog
        open={confirmBulkDelete}
        onOpenChange={setConfirmBulkDelete}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "تأكيد الحذف الجماعي للسجلات" : "Confirm Bulk Delete"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? `هل أنت متأكد من حذف ${selectedRows.size} سجل محدد نهائياً من تاريخ التسكين؟`
                : `Are you sure you want to permanently delete ${selectedRows.size} selected records from housing history?`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isBulkDeleting}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleBulkDelete}
              disabled={isBulkDeleting}
              className="bg-destructive hover:bg-destructive/90 text-destructive-foreground"
            >
              {isBulkDeleting ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                  {ar ? "جاري الحذف..." : "Deleting..."}
                </span>
              ) : (
                ar ? "تأكيد الحذف" : "Confirm Delete"
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Unified Report Print Studio Modal */}
      <ReportPrintStudioModal
        open={isStudioOpen}
        onOpenChange={setIsStudioOpen}
        title="Housing Historical Stays Archive"
        titleAr="سجل التسكين وحركات الإقامة التاريخية"
        subtitle={ar ? "سجل تاريخي بكافة تسكينات ومغادرات الموظفين" : "Historical record of staff stays, movements and departures"}
        subtitleAr="سجل تاريخي بكافة تسكينات ومغادرات الموظفين"
        propertyName={activePropObj?.displayName || activePropObj?.name}
        propertyCode={activePropObj?.code}
        systemLogoUrl={settings?.systemLogo}
        propertyLogoUrl={activePropObj?.logo}
        filtersSummary={{
          [ar ? "الحالة" : "Status"]: filterStatus === "ALL" ? (ar ? "كل الحالات" : "All Status") : formatStatus(filterStatus, ar),
          ...(debouncedSearch ? { [ar ? "البحث" : "Search"]: debouncedSearch } : {}),
        }}
        kpis={studioKpis}
        availableColumns={studioColumns}
        allRows={studioRows}
        currentPageRows={paged.map(formatHistoryRow)}
        initialLanguage={ar ? "ar" : "en"}
      />
    </div>
  );
}
