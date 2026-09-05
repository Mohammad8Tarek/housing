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
} from "lucide-react";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { drawPdfHeader, pdfTextSafe } from "@/lib/pdf-utils";
import * as XLSX from "xlsx";

const statusBadge = (status: string) => {
  const map: Record<string, string> = {
    ENDED: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300",
    TRANSFERRED:
      "bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300",
    CANCELLED: "bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300",
  };
  return map[status] ?? "bg-gray-100 text-gray-600";
};

function ProfileMini({
  emp,
  photoUrl,
}: {
  emp: any;
  photoUrl?: string | null;
}) {
  const initials =
    `${emp?.firstName?.[0] ?? ""}${emp?.lastName?.[0] ?? ""}`.toUpperCase();
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
          {emp?.firstName} {emp?.lastName}
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
      toast.success(ar ? "تم حذف السجل بنجاح" : "Record deleted successfully");
      setDeleteRecord(null);
      queryClient.invalidateQueries({ queryKey: ["accommodationHistory"] });
    } catch (e: any) {
      toast.error(
        e.message || (ar ? "فشل حذف السجل" : "Failed to delete record"),
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

      const res = await fetch("/api/assignments/bulk-delete", {
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
      toast.success(
        ar
          ? `تم حذف ${data.deletedCount} سجل بنجاح`
          : `Deleted ${data.deletedCount} records successfully`,
      );
      setSelectedRows(new Set());
      setConfirmBulkDelete(false);
      queryClient.invalidateQueries({ queryKey: ["accommodationHistory"] });
    } catch (e: any) {
      toast.error(
        e.message || (ar ? "فشل الحذف الجماعي" : "Failed to bulk delete"),
      );
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const exportExcel = () => {
    const rows = exportTarget().map((a) => {
      const emp = empMap[a.profileId];
      const room = roomMap[a.roomId];
      const building = room ? buildingMap[room.buildingId] : null;
      const floor = room ? floorMap[room.floorId] : null;
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
        Name: emp ? `${emp.firstName} ${emp.lastName}` : `#${a.profileId}`,
        Code: emp?.profileId ?? "",
        "National ID": emp?.nationalId ?? "",
        Nationality: (emp as any)?.nationality ?? "",
        "Job Title": emp?.jobTitle ?? "",
        Department: emp?.department ?? "",
        Building: building ?? "",
        Floor: floor?.number ?? "",
        Room: room?.roomNumber ?? String(a.roomId),
        Bed: a.bedNumber ?? "",
        "Check-in": formatDate(a.checkInDate, ""),
        "Check-out": formatDate(checkOutDate, ""),
        Days: daysStayed ?? "",
        Notes: a.notes ?? "",
        Status: a.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "History");
    XLSX.writeFile(wb, getExportFileName("Housing_History", "xlsx"));
  };

  const exportPDF = async () => {
    const { default: jsPDF } = await import("jspdf");
    const { default: autoTable } = await import("jspdf-autotable");
    const doc = new jsPDF({ orientation: "landscape" });
    const pageW = doc.internal.pageSize.getWidth();

    const activeProp = properties.find((p) => p.id === activePropertyId);
    const propName = activeProp?.name ?? "";

    const startY = await drawPdfHeader(doc, {
      systemLogoUrl: (settings as any)?.systemLogo,
      propLogoUrl: (activeProp as any)?.logo,
      title: `Housing History Report${propName ? ` — ${propName}` : ""}`,
      subtitle: `Generated: ${new Date().toLocaleString()}  |  Records: ${exportTarget().length}`,
      pageW,
    });

    const rows = exportTarget().map((a) => {
      const emp = empMap[a.profileId];
      const room = roomMap[a.roomId];
      const building = room ? buildingMap[room.buildingId] : null;
      const floor = room ? floorMap[room.floorId] : null;
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
      return [
        emp ? `${emp.firstName} ${emp.lastName}` : `#${a.profileId}`,
        emp?.profileId ?? "",
        emp?.nationalId ?? "",
        emp?.department ?? "",
        pdfTextSafe(building ?? "") || "—",
        floor?.number ? String(floor.number) : "—",
        room?.roomNumber ?? String(a.roomId),
        a.bedNumber ? String(a.bedNumber) : "—",
        formatDate(a.checkInDate),
        formatDate(checkOutDate),
        daysStayed !== null ? String(daysStayed) : "—",
        a.status,
      ];
    });

    autoTable(doc, {
      head: [
        [
          "Profile",
          "Code",
          "National ID",
          "Department",
          "Building",
          "Floor",
          "Room",
          "Bed",
          "Check-in",
          "Check-out",
          "Days",
          "Status",
        ],
      ],
      body: rows,
      startY,
      styles: { fontSize: 7.5, cellPadding: 2 },
      headStyles: {
        fillColor: [15, 42, 68],
        textColor: 255,
        fontStyle: "bold",
      },
      alternateRowStyles: { fillColor: [245, 247, 250] },
      foot: [
        ["", "", "", "", "", "", "", "", "", `Total: ${rows.length}`, "", ""],
      ],
      footStyles: {
        fillColor: [15, 42, 68],
        textColor: [201, 162, 77],
        fontStyle: "bold",
      },
    });

    const finalY = (doc as any).lastAutoTable?.finalY ?? startY + 10;
    doc.setFontSize(8);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(150, 150, 150);
    doc.text(
      "Sunrise Staff Housing Management  ·  Confidential",
      pageW / 2,
      finalY + 8,
      { align: "center" },
    );

    doc.save(getExportFileName("Housing_History", "pdf"));
  };

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
          <p className="text-sm text-muted-foreground mt-1">
            {ar
              ? `${totalItems} سجل — جميع من غادروا أو نُقلوا`
              : `${totalItems} records — all who checked out or were transferred`}
          </p>
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
            onClick={exportPDF}
            className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
          >
            <FileText className="w-4 h-4" />
            {ar ? "تصدير PDF" : "Export PDF"}
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
            onClick={exportPDF}
            className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50 dark:text-red-400 dark:border-red-800 dark:hover:bg-red-950/40"
          >
            <FileText className="w-3.5 h-3.5" />
            {ar ? "PDF" : "PDF"}
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
            <SelectItem value="ENDED">{ar ? "منتهي" : "Ended"}</SelectItem>
            <SelectItem value="TRANSFERRED">
              {ar ? "منقول" : "Transferred"}
            </SelectItem>
            <SelectItem value="CANCELLED">
              {ar ? "ملغي" : "Cancelled"}
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
                const emp = empMap[a.profileId];
                const room = roomMap[a.roomId];
                const building = room ? buildingMap[room.buildingId] : null;
                const floor = room ? floorMap[room.floorId] : null;
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
                          photoUrl={(emp as any)?.photoUrl}
                        />
                      </TableCell>
                    )}
                    {isHistVisible("code") && (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {emp?.profileId ?? `#${a.profileId}`}
                      </TableCell>
                    )}
                    {isHistVisible("nationalid") && (
                      <TableCell className="font-mono text-xs">
                        {emp?.nationalId ?? "—"}
                      </TableCell>
                    )}
                    {isHistVisible("nationality") && (
                      <TableCell className="text-sm">
                        {(emp as any)?.nationality ?? "—"}
                      </TableCell>
                    )}
                    {isHistVisible("jobtitle") && (
                      <TableCell className="text-sm">
                        {emp?.jobTitle ?? "—"}
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
                        {floor?.number ?? "—"}
                      </TableCell>
                    )}
                    {isHistVisible("room") && (
                      <TableCell>
                        <span className="font-mono font-semibold text-primary">
                          {room?.roomNumber ?? a.roomId}
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
                          {a.status}
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
    </div>
  );
}
