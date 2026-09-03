import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
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
import { format } from "date-fns";
import { DataPagination } from "@/components/DataPagination";
import {
  Search,
  Building2,
  BedDouble,
  History,
  FileText,
  FileSpreadsheet,
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

      const token = localStorage.getItem("auth-storage") ? JSON.parse(localStorage.getItem("auth-storage") || "{}")?.state?.token : null;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;
      
      const res = await fetch(`/api/assignments/history?${qs.toString()}`, { headers });
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
  const properties = (_pData as any)?.data || _pData || [];

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
        "Check-in": a.checkInDate
          ? format(new Date(a.checkInDate), "yyyy-MM-dd")
          : "",
        "Check-out": checkOutDate
          ? format(new Date(checkOutDate), "yyyy-MM-dd")
          : "",
        Days: daysStayed ?? "",
        Notes: a.notes ?? "",
        Status: a.status,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "History");
    XLSX.writeFile(
      wb,
      `housing_history_${new Date().toISOString().slice(0, 10)}.xlsx`,
    );
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
        a.checkInDate ? format(new Date(a.checkInDate), "MMM d, yyyy") : "—",
        checkOutDate ? format(new Date(checkOutDate), "MMM d, yyyy") : "—",
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

    doc.save(`housing_history_${new Date().toISOString().slice(0, 10)}.pdf`);
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
            {ar ? "Excel" : "Excel"}
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
        extraActions={
          <Button
            variant="outline"
            size="sm"
            onClick={exportPDF}
            className="gap-1.5 text-red-700 border-red-200 hover:bg-red-50"
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
                        {a.checkInDate
                          ? format(new Date(a.checkInDate), "MMM d, yyyy")
                          : "—"}
                      </TableCell>
                    )}
                    {isHistVisible("checkout") && (
                      <TableCell className="text-sm whitespace-nowrap">
                        {checkOutDate
                          ? format(new Date(checkOutDate), "MMM d, yyyy")
                          : "—"}
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
                  </TableRow>
                );
              })}
              {paged.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={histVisible.size + 1}
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
    </div>
  );
}
