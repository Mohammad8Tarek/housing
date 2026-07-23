// @ts-nocheck
import { useState, useMemo, useEffect, useCallback } from "react";
import {
  useListRooms,
  useListBuildings,
  useListFloors,
  useListEmployees,
  useListAssignments,
  useListReservations,
  useListMaintenance,
  useListHostings,
  useListProperties,
  useGetSettings,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
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
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  FileSpreadsheet,
  FileText,
  BarChart2,
  Users,
  Home,
  Wrench,
  BookOpen,
  BedDouble,
  TrendingUp,
  Building2,
  RefreshCw,
  Search,
  Plus,
  Pencil,
  Eye,
  AlertCircle,
  Calendar,
} from "lucide-react";
import * as XLSX from "xlsx";
import { DataPagination } from "@/components/DataPagination";

import { exportExcel, exportPDF, exportAnalyticsPDF } from "./utils/export";
import { AnalyticsTab } from "./components/AnalyticsTab";
import { StatusBadge } from "./components/StatusBadge";
type Tab =
  | "analytics"
  | "housing"
  | "employees"
  | "assignments"
  | "hostings"
  | "maintenance"
  | "reservations";

const TABS: {
  id: Tab;
  label: string;
  labelAr: string;
  icon: React.ReactNode;
}[] = [
  {
    id: "analytics",
    label: "Analytics",
    labelAr: "تحليلات",
    icon: <TrendingUp className="w-4 h-4" />,
  },
  {
    id: "housing",
    label: "Housing",
    labelAr: "الغرف",
    icon: <Home className="w-4 h-4" />,
  },
  {
    id: "employees",
    label: "Employees",
    labelAr: "الموظفون",
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: "assignments",
    label: "Assignments",
    labelAr: "الإسكان",
    icon: <BookOpen className="w-4 h-4" />,
  },
  {
    id: "hostings",
    label: "Guests",
    labelAr: "الضيوف",
    icon: <Users className="w-4 h-4" />,
  },
  {
    id: "maintenance",
    label: "Maintenance",
    labelAr: "الصيانة",
    icon: <Wrench className="w-4 h-4" />,
  },
  {
    id: "reservations",
    label: "Reservations",
    labelAr: "الحجوزات",
    icon: <BarChart2 className="w-4 h-4" />,
  },
];

export default function Reports() {
  const { activePropertyId, isSuperAdmin } = useProperty();
  const { language } = useLanguage();
  const { can } = usePermission();
  const ar = language === "ar";
  const canExportReports = can("reports", "export");

  // Safe text for jsPDF (strips Arabic chars that Helvetica can't render)
  const pdfTextSafe = (
    str: string | null | undefined,
    fallback?: string,
  ): string => {
    if (!str) return "—";
    if (!/[\u0600-\u06FF]/.test(str)) return str;
    const latin = str.replace(/[^\x20-\x7E]/g, "").trim();
    return latin.length >= 2 ? latin : (fallback ?? "[AR]");
  };

  // Companion helpers
  const getComps = (h: any) =>
    Array.isArray(h.companions) ? h.companions : [];
  const getGuestNames = (h: any) => {
    const names = getComps(h)
      .map((c: any) => c.name)
      .filter(Boolean);
    return names.length ? names.join(", ") : "—";
  };
  const getGuestRelations = (h: any) => {
    const rels = getComps(h)
      .map((c: any) => c.relation)
      .filter(Boolean);
    return rels.length ? [...new Set(rels)].join(", ") : "—";
  };
  const getGuestDocs = (h: any) => {
    const docs = getComps(h)
      .map((c: any) => c.idNumber)
      .filter(Boolean);
    return docs.length ? docs.join(", ") : "—";
  };
  const getGuestProfiles = (h: any) => {
    return getComps(h).map((c: any) => {
      const parts = [
        Number(c.isChild) === 1
          ? ar
            ? "طفل"
            : "Child"
          : ar
            ? "بالغ"
            : "Adult",
        c.relation,
        c.idNumber ? `${ar ? "وثيقة" : "Doc"} ${c.idNumber}` : "",
        Number(c.isChild) === 1 && c.age != null
          ? `${c.age}${ar ? " سنة" : "y"}`
          : "",
      ].filter(Boolean);
      return { name: c.name, meta: parts.join(" - ") };
    });
  };

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

  useEffect(() => {
    setCurrentPage(1);
  }, [
    activeTab,
    filterProperty,
    filterBuilding,
    filterFloor,
    filterStatus,
    filterCategory,
    filterDepartment,
    filterGender,
    filterNationality,
    search,
    dateFrom,
    dateTo,
  ]);

  const { data: properties = [] } = useListProperties({
    query: { enabled: true },
  });

  // propId: use selected property filter > active property in context > first available property
  const propId = useMemo(() => {
    if (filterProperty !== "all" && filterProperty !== "")
      return Number(filterProperty);
    if (activePropertyId) return activePropertyId;
    if (properties.length > 0) return properties[0].id;
    return undefined;
  }, [filterProperty, activePropertyId, properties]);

  const { data: settings } = useGetSettings(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const { data: buildings = [] } = useListBuildings(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );

  // ========== التعديل الأساسي: جلب الأدوار بناءً على المبنى المحدد ==========
  const floorsQueryParams = useMemo(() => {
    // إذا تم اختيار مبنى محدد (ليس "all")، نرسل buildingId للـ API
    if (
      filterBuilding !== "all" &&
      filterBuilding !== "undefined" &&
      filterBuilding !== ""
    ) {
      return { buildingId: Number(filterBuilding) };
    }
    // وإلا نرسل propertyId لجلب جميع الأدوار في العقار
    return { propertyId: propId };
  }, [filterBuilding, propId]);

  const { data: floors = [], refetch: refetchFloors } = useListFloors(
    floorsQueryParams,
    { query: { enabled: !!propId } },
  );
  // ====================================================================

  const { data: _rData , isLoading: roomLoad } = useListRooms(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const rooms = _rData?.data || [];
  const { data: _eData , isLoading: empLoad } = useListEmployees(
    { propertyId: propId , limit: 1000},
    { query: { enabled: !!propId } },
  );
  const employees = _eData?.data || [];
  const { data: assignments = [], isLoading: assLoad } = useListAssignments(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const { data: _resData, isLoading: resLoad } = useListReservations(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const { data: _mntData, isLoading: mntLoad } = useListMaintenance(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const { data: hostings = [], isLoading: hostLoad } = useListHostings(
    { propertyId: propId },
    { query: { enabled: !!propId } },
  );
  const reservations = _resData?.data || [];
  const maintenance = _mntData?.data || [];


  const [evalStats, setEvalStats] = useState({
    total: 0,
    average: 0,
    positive: 0,
    negative: 0,
  });
  useEffect(() => {
    if (!propId) return;
    fetch(`/api/evaluations/stats?propertyId=${propId}`, {
      credentials: "include",
    })
      .then((r) => r.json().catch(() => null))
      .then((d) => {
        if (d) setEvalStats(d);
      })
      .catch(() => { toast.error(ar ? "فشل تصدير التقرير" : "Failed to export report"); })
    }, [propId]);

  // Reset all filters when active property changes
  useEffect(() => {
    setFilterBuilding("all");
    setFilterFloor("all");
    setFilterStatus("all");
    setFilterCategory("all");
    setFilterDepartment("all");
    setFilterGender("all");
    setFilterNationality("all");
    setSearch("");
  }, [propId]);

  // ========== إعادة جلب الأدوار تلقائياً عند تغيير المبنى ==========
  useEffect(() => {
    if (filterBuilding !== "all") {
      refetchFloors();
    }
  }, [filterBuilding, refetchFloors]);
  // ==================================================================

  const buildingMap = useMemo(() => {
    const m: Record<number, string> = {};
    buildings.forEach((b) => (m[b.id] = b.name));
    return m;
  }, [buildings]);

  const floorMap = useMemo(() => {
    const m: Record<number, string> = {};
    floors.forEach(
      (f) => (m[f.id] = f.name || f.floorNumber || `Floor ${f.id}`),
    );
    return m;
  }, [floors]);

  const roomMap = useMemo(() => {
    const m: Record<number, (typeof rooms)[number]> = {};
    rooms.forEach((r) => (m[r.id] = r));
    return m;
  }, [rooms]);

  const departments = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.department) set.add(e.department.trim());
    });
    reservations.forEach((r) => {
      if (r.department) set.add(r.department.trim());
    });
    return Array.from(set).sort();
  }, [employees, reservations]);

  const nationalities = useMemo(() => {
    const set = new Set<string>();
    employees.forEach((e) => {
      if (e.nationality) set.add(e.nationality.trim());
    });
    return Array.from(set).sort();
  }, [employees]);

  const empMap = useMemo(() => {
    const m: Record<number, (typeof employees)[number]> = {};
    employees.forEach((e) => (m[e.id] = e));
    return m;
  }, [employees]);

  const filteredBuildingIds = new Set(
    filterBuilding === "all"
      ? buildings.map((b) => b.id)
      : [Number(filterBuilding)],
  );

  const filteredFloorIds = new Set(
    floors
      .filter((f) => {
        if (!filteredBuildingIds.has(f.buildingId)) return false;
        if (filterFloor !== "all" && f.id !== Number(filterFloor)) return false;
        return true;
      })
      .map((f) => f.id),
  );

  const filteredRooms = rooms.filter((r) => {
    if (filterBuilding !== "all" && !filteredBuildingIds.has(r.buildingId))
      return false;
    if (filterFloor !== "all" && !filteredFloorIds.has(r.floorId)) return false;
    if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus)
      return false;
    if (
      filterGender !== "all" &&
      r.genderPolicy?.toLowerCase() !== filterGender
    )
      return false;
    return true;
  });
  const filteredRoomIds = new Set(filteredRooms.map((r) => r.id));

  const filteredEmployees = employees.filter((e) => {
    if (filterStatus !== "all" && e.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all" && e.department !== filterDepartment)
      return false;
    if (filterGender !== "all" && e.gender?.toLowerCase() !== filterGender)
      return false;
    if (filterNationality !== "all" && e.nationality !== filterNationality)
      return false;
    return true;
  });

  const filteredAssignments = assignments.filter((a) => {
    if (
      (filterBuilding !== "all" || filterFloor !== "all") &&
      !filteredRoomIds.has(a.roomId)
    )
      return false;
    if (filterStatus !== "all" && a.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all") {
      const emp = empMap[a.employeeId];
      if (emp?.department !== filterDepartment) return false;
    }
    if (filterGender !== "all") {
      const emp = empMap[a.employeeId];
      if (emp?.gender?.toLowerCase() !== filterGender) return false;
    }
    return true;
  });

  const filteredMaintenance = maintenance.filter((m) => {
    if (
      (filterBuilding !== "all" || filterFloor !== "all") &&
      !filteredRoomIds.has(m.roomId)
    )
      return false;
    if (filterStatus !== "all" && m.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterCategory !== "all" && m.category !== filterCategory) return false;
    return true;
  });

  const filteredReservations = reservations.filter((r) => {
    if (filterStatus !== "all" && r.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all" && r.department !== filterDepartment)
      return false;
    return true;
  });

  const filteredHostings = hostings.filter((h) => {
    if (
      (filterBuilding !== "all" || filterFloor !== "all") &&
      h.roomId &&
      !filteredRoomIds.has(h.roomId)
    )
      return false;
    if (filterStatus !== "all" && h.status?.toLowerCase() !== filterStatus)
      return false;
    if (filterDepartment !== "all") {
      const emp = empMap[h.employeeId];
      if (emp?.department !== filterDepartment) return false;
    }
    return true;
  });

  const isLoading =
    roomLoad || empLoad || assLoad || resLoad || mntLoad || hostLoad;

  const getStatusOptions = (): { value: string; label: string }[] => {
    switch (activeTab) {
      case "housing":
        return [
          { value: "available", label: "Available" },
          { value: "occupied", label: "Occupied" },
          { value: "maintenance", label: "Maintenance" },
        ];
      case "employees":
        return [
          { value: "active", label: "Active" },
          { value: "inactive", label: "Inactive" },
        ];
      case "assignments":
        return [
          { value: "active", label: "Active" },
          { value: "checked_out", label: "Checked Out" },
        ];
      case "hostings":
        return [
          { value: "pending", label: "Pending" },
          { value: "approved", label: "Approved" },
          { value: "active", label: "Active" },
          { value: "completed", label: "Completed" },
          { value: "cancelled", label: "Cancelled" },
        ];
      case "maintenance":
        return [
          { value: "open", label: "Open" },
          { value: "in_progress", label: "In Progress" },
          { value: "resolved", label: "Resolved" },
        ];
      case "reservations":
        return [
          { value: "pending", label: "Pending" },
          { value: "confirmed", label: "Confirmed" },
          { value: "checked_in", label: "Checked In" },
          { value: "checked_out", label: "Checked Out" },
          { value: "cancelled", label: "Cancelled" },
        ];
      default:
        return [];
    }
  };

  const applySearchAndDate = (
    data: any[],
    dateField?: string,
    searchFields?: (item: any) => string[],
  ): any[] => {
    return data.filter((item) => {
      if (search.trim()) {
        const q = search.toLowerCase();
        const fields = searchFields
          ? searchFields(item)
          : [JSON.stringify(item)];
        if (!fields.some((f) => f?.toLowerCase().includes(q))) return false;
      }
      if (dateField && (dateFrom || dateTo)) {
        const d = item[dateField]?.slice(0, 10);
        if (!d) return true;
        if (dateFrom && d < dateFrom) return false;
        if (dateTo && d > dateTo) return false;
      }
      return true;
    });
  };

  const currentData = (): any[] => {
    switch (activeTab) {
      case "housing":
        return applySearchAndDate(filteredRooms, "createdAt", (r) => [
          r.roomNumber,
          r.roomType,
          buildingMap[r.buildingId],
          r.status,
        ]);
      case "employees":
        return applySearchAndDate(filteredEmployees, "hireDate", (e) => [
          e.firstName,
          e.lastName,
          e.employeeCode,
          e.department,
          e.nationality,
          e.jobTitle,
        ]);
      case "assignments":
        return applySearchAndDate(filteredAssignments, "checkInDate", (a) => {
          const emp = empMap[a.employeeId];
          const room = roomMap[a.roomId];
          return [
            emp?.firstName,
            emp?.lastName,
            emp?.employeeId,
            room?.roomNumber,
            a.status,
          ];
        });
      case "maintenance":
        return applySearchAndDate(filteredMaintenance, "reportedAt", (m) => {
          const room = roomMap[m.roomId];
          return [
            room?.roomNumber,
            m.category,
            m.problemType,
            m.priority,
            m.status,
            m.reportedBy,
            m.assignedToName,
          ];
        });
      case "hostings":
        return applySearchAndDate(filteredHostings, "expectedFrom", (h) => {
          const emp = empMap[h.employeeId];
          const room = h.roomId ? roomMap[h.roomId] : undefined;
          return [
            emp?.firstName,
            emp?.lastName,
            emp?.employeeId,
            room?.roomNumber,
            h.status,
            h.hostingType,
          ];
        });
      case "reservations":
        return applySearchAndDate(filteredReservations, "checkInDate", (r) => [
          r.firstName,
          r.lastName,
          r.department,
          r.roomType,
          r.status,
        ]);
      default:
        return [];
    }
  };

  const toExcelRows = (): Record<string, any>[] => {
    const data = currentData();
    switch (activeTab) {
      case "housing":
        return data.map((r) => ({
          "Room No": r.roomNumber,
          Type: r.roomType ?? "—",
          Capacity: r.capacity,
          Gender: r.genderPolicy ?? "—",
          Floor: floorMap[r.floorId] ?? r.floorId,
          Building: buildingMap[r.buildingId] ?? r.buildingId,
          Status: r.status,
        }));
      case "employees":
        return data.map((e) => ({
          Code: e.employeeCode,
          "First Name": e.firstName,
          "Last Name": e.lastName,
          "National ID": e.nationalId ?? "—",
          Nationality: e.nationality ?? "—",
          Phone: (e as any).phone ?? "—",
          Gender: e.gender ?? "—",
          Department: e.department ?? "—",
          "Job Title": e.jobTitle ?? "—",
          Level: (e as any).level ?? "—",
          "Hire Date": (e as any).hireDate ?? "—",
          Address: (e as any).address ?? "—",
          Status: e.status,
        }));
      case "assignments":
        return data.map((a) => {
          const emp = empMap[a.employeeId];
          const room = roomMap[a.roomId];
          return {
            Employee: emp
              ? `${emp.firstName} ${emp.lastName}`
              : `#${a.employeeId}`,
            "Room No": room?.roomNumber ?? `#${a.roomId}`,
            Building: room ? (buildingMap[room.buildingId] ?? "—") : "—",
            "Check-In": a.checkInDate,
            "Expected Out": a.expectedCheckOutDate ?? "—",
            "Check-Out": a.checkOutDate ?? "—",
            Status: a.status,
          };
        });
      case "maintenance":
        return data.map((m) => {
          const room = roomMap[m.roomId];
          return {
            Category: m.category ?? "—",
            "Room No": room?.roomNumber ?? `#${m.roomId}`,
            Building: room ? (buildingMap[room.buildingId] ?? "—") : "—",
            Problem: m.problemType,
            Priority: m.priority,
            Status: m.status,
            "Assigned To": (m as any).assignedToName ?? "—",
            "Reported By": (m as any).reportedBy ?? "—",
            Reported: m.reportedAt,
            Started: (m as any).startedAt ?? "—",
            Resolved: (m as any).resolvedAt ?? "—",
            "Due Date": m.dueDate ?? "—",
            Notes: (m as any).notes ?? "—",
          };
        });
      case "reservations":
        return data.map((r) => ({
          Name: `${r.firstName} ${r.lastName}`,
          "Room No": r.roomId
            ? (roomMap[r.roomId]?.roomNumber ?? `#${r.roomId}`)
            : "—",
          "Room Type": r.roomType ?? "—",
          Department: r.department ?? "—",
          "Check-In": r.checkInDate,
          "Check-Out": r.checkOutDate ?? "—",
          Status: r.status,
        }));
      case "hostings":
        return data.map((h) => {
          const emp = empMap[h.employeeId];
          const room = h.roomId ? roomMap[h.roomId] : undefined;
          const names = getGuestNames(h);
          return {
            Employee: emp
              ? `${emp.firstName} ${emp.lastName}`
              : `#${h.employeeId}`,
            Code: emp?.employeeCode ?? "—",
            Dept: emp?.department ?? "—",
            Room: room?.roomNumber ?? (h.roomId ? `#${h.roomId}` : "—"),
            Building: room ? (buildingMap[room.buildingId] ?? "—") : "—",
            Type: h.hostingType ?? "—",
            Guests: `${h.guestsCount ?? 0}${names !== "—" ? ` · ${names}` : ""}`,
            From: h.expectedFrom?.slice(0, 10) ?? "—",
            To: h.expectedTo?.slice(0, 10) ?? "—",
            "Check In": h.actualCheckIn?.slice(0, 10) ?? "—",
            "Check Out": h.actualCheckOut?.slice(0, 10) ?? "—",
            Status: h.status,
          };
        });
      default:
        return [];
    }
  };

  const stats = useMemo(
    () => ({
      total: rooms.length,
      available: rooms.filter((r) => r.status?.toLowerCase() === "available")
        .length,
      occupied: rooms.filter((r) => r.status?.toLowerCase() === "occupied")
        .length,
      maint: rooms.filter((r) => r.status?.toLowerCase() === "maintenance")
        .length,
      employees: employees.length,
      activeAss: assignments.filter((a) => a.status?.toLowerCase() === "active")
        .length,
    }),
    [rooms, assignments, employees],
  );

  const analytics = useMemo(() => {
    const activeAssignments = assignments.filter(
      (a) => a.status?.toLowerCase() === "active",
    );

    // Capacity & beds
    const totalCapacity = rooms.reduce((s, r) => s + (r.capacity ?? 0), 0);
    const totalOccupied = rooms.reduce(
      (s, r) => s + (r.currentOccupancy ?? 0),
      0,
    );
    const availableBeds = Math.max(0, totalCapacity - totalOccupied);
    const availableRooms = rooms.filter(
      (r) => r.status?.toLowerCase() === "available",
    ).length;
    const occupiedRooms = rooms.filter(
      (r) => r.status?.toLowerCase() === "occupied",
    ).length;
    const maintRooms = rooms.filter(
      (r) => r.status?.toLowerCase() === "maintenance",
    ).length;
    const occRate =
      totalCapacity > 0 ? Math.round((totalOccupied / totalCapacity) * 100) : 0;

    // By building
    const byBuilding = buildings
      .map((b) => {
        const bRooms = rooms.filter((r) => r.buildingId === b.id);
        const bCapacity = bRooms.reduce((s, r) => s + (r.capacity ?? 0), 0);
        const bOccupied = bRooms.reduce(
          (s, r) => s + (r.currentOccupancy ?? 0),
          0,
        );
        const bAvail = bRooms.filter(
          (r) => r.status?.toLowerCase() === "available",
        ).length;
        const bRate =
          bCapacity > 0 ? Math.round((bOccupied / bCapacity) * 100) : 0;
        return {
          id: b.id,
          name: b.name,
          totalRooms: bRooms.length,
          occupied: occupiedRooms,
          availableRooms: bAvail,
          capacity: bCapacity,
          currentOccupancy: bOccupied,
          rate: bRate,
        };
      })
      .sort((a, b) => b.rate - a.rate);

    // By room type
    const typeMap: Record<string, { cap: number; occ: number; count: number }> =
      {};
    rooms.forEach((r) => {
      const t = r.roomType ?? "Unknown";
      if (!typeMap[t]) typeMap[t] = { cap: 0, occ: 0, count: 0 };
      typeMap[t].cap += r.capacity ?? 0;
      typeMap[t].occ += r.currentOccupancy ?? 0;
      typeMap[t].count += 1;
    });
    const byType = Object.entries(typeMap)
      .map(([type, d]) => ({
        type,
        rooms: d.count,
        capacity: d.cap,
        occupied: d.occ,
        rate: d.cap > 0 ? Math.round((d.occ / d.cap) * 100) : 0,
      }))
      .sort((a, b) => b.rate - a.rate);

    // By gender policy
    const genderMap: Record<string, number> = {};
    rooms.forEach((r) => {
      const g = r.genderPolicy ?? "any";
      genderMap[g] = (genderMap[g] ?? 0) + 1;
    });
    const byGender = Object.entries(genderMap).map(([g, cnt]) => ({
      gender: g,
      count: cnt,
    }));

    // By department (active assignments)
    const deptMap: Record<string, number> = {};
    activeAssignments.forEach((a) => {
      const emp = employees.find((e) => e.id === a.employeeId);
      const dept = emp?.department ?? "Unknown";
      deptMap[dept] = (deptMap[dept] ?? 0) + 1;
    });
    const byDept = Object.entries(deptMap)
      .map(([dept, count]) => ({ dept, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10);

    // Maintenance summary
    const openMaint = maintenance.filter(
      (m) => m.status?.toLowerCase() === "open",
    ).length;
    const inProg = maintenance.filter(
      (m) => m.status?.toLowerCase() === "in_progress",
    ).length;

    // Tickets by category
    const ticketsByCategory = {
      maintenance: maintenance.filter((m) => m.category === "maintenance")
        .length,
      housekeeping: maintenance.filter((m) => m.category === "housekeeping")
        .length,
      general: maintenance.filter((m) => m.category === "general").length,
    };

    // Employee assignment stats
    const assignedCounts: Record<
      number,
      { empId: number; total: number; open: number; resolved: number }
    > = {};
    maintenance
      .filter((m) => m.assignedTo)
      .forEach((m) => {
        const a = m.assignedTo!;
        if (!assignedCounts[a])
          assignedCounts[a] = { empId: a, total: 0, open: 0, resolved: 0 };
        assignedCounts[a].total++;
        if (m.status === "open" || m.status === "in_progress")
          assignedCounts[a].open++;
        if (m.status === "resolved" || m.status === "closed")
          assignedCounts[a].resolved++;
      });
    const topEmployees = Object.values(assignedCounts)
      .sort((a, b) => b.resolved - a.resolved)
      .slice(0, 5)
      .map((a) => ({
        ...a,
        name: employees.find((e) => e.id === a.empId)
          ? `${employees.find((e) => e.id === a.empId)!.firstName} ${employees.find((e) => e.id === a.empId)!.lastName}`
          : `Emp #${a.empId}`,
      }));

    return {
      totalCapacity,
      totalOccupied,
      availableBeds,
      availableRooms,
      occupiedRooms,
      maintRooms,
      occRate,
      byBuilding,
      byType,
      byGender,
      byDept,
      openMaint,
      inProg,
      ticketsByCategory,
      topEmployees,
    };
  }, [rooms, assignments, employees, buildings, maintenance]);

  // ========== خيارات الأدوار مع رسالة عند عدم وجود بيانات ==========
  const floorOptions = useMemo(() => {
    if (
      filterBuilding === "all" ||
      filterBuilding === "undefined" ||
      filterBuilding === ""
    ) {
      return floors;
    }
    return floors.filter((f) => f.buildingId === Number(filterBuilding));
  }, [floors, filterBuilding]);

  const filterFieldClass = "min-w-0 space-y-1.5";
  const filterLabelClass =
    "flex min-h-4 items-center gap-1 truncate text-[11px] font-bold uppercase tracking-normal text-muted-foreground/80";
  const filterControlClass = "h-9 w-full bg-background text-sm";
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

  const allData = currentData();
  const paginatedData = allData.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize,
  );

  const handleExportExcel = () => {
    if (!canExportReports) return;
    exportExcel(activeTab, toExcelRows());
  };

  const handleExportPDF = () => {
    if (!canExportReports) return;
    exportPDF(
      activeTab,
      toExcelRows(),
      properties,
      propId,
      activePropertyId,
      dateFrom,
      dateTo,
      search,
      settings,
    );
  };

  const handleExportAnalyticsPDF = () => {
    if (!canExportReports) return;
    exportAnalyticsPDF(
      analytics,
      rooms,
      employees,
      evalStats,
      properties,
      propId,
      activePropertyId,
      settings,
    );
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Reports</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Analyze and export housing data across all modules
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          {canExportReports && activeTab === "analytics" ? (
            <Button
              variant="outline"
              size="sm"
              onClick={handleExportAnalyticsPDF}
              className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
            >
              <FileText className="w-4 h-4" />
              {ar ? "طباعة التحليلات PDF" : "Print Analytics PDF"}
            </Button>
          ) : canExportReports ? (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportExcel}
                className="gap-2 text-green-700 border-green-200 hover:bg-green-50"
              >
                <FileSpreadsheet className="w-4 h-4" />
                Excel
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleExportPDF}
                className="gap-2 text-red-700 border-red-200 hover:bg-red-50"
              >
                <FileText className="w-4 h-4" />
                PDF
              </Button>
            </>
          ) : null}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: "Total Rooms",
            value: stats.total,
            color: "text-foreground",
          },
          {
            label: "Available",
            value: stats.available,
            color: "text-green-600",
          },
          { label: "Occupied", value: stats.occupied, color: "text-blue-600" },
          {
            label: "Maintenance",
            value: stats.maint,
            color: "text-orange-600",
          },
          {
            label: "Employees",
            value: stats.employees,
            color: "text-purple-600",
          },
          {
            label: "Active Stays",
            value: stats.activeAss,
            color: "text-indigo-600",
          },
        ].map((s) => (
          <div
            key={s.label}
            className="bg-card border rounded-lg p-3 text-center shadow-sm"
          >
            <p className={`text-xl font-bold ${s.color}`}>
              {isLoading ? "—" : s.value}
            </p>
            <p className="text-xs text-muted-foreground mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-muted/40 rounded-lg p-1 flex-wrap">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setActiveTab(tab.id);
              setFilterStatus("all");
              setFilterCategory("all");
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all ${
              activeTab === tab.id
                ? "bg-background text-foreground shadow-sm border"
                : "text-muted-foreground hover:text-foreground hover:bg-background/50"
            }`}
          >
            {tab.icon}
            {ar ? tab.labelAr : tab.label}
          </button>
        ))}
      </div>

      {activeTab === "analytics" && (
        <AnalyticsTab
          ar={ar}
          isLoading={isLoading}
          rooms={rooms}
          analytics={analytics}
          evalStats={evalStats}
        />
      )}

      {/* Filters + Table (hidden on analytics tab) */}
      {activeTab !== "analytics" && (
        <>
          <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
            <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-sm font-bold text-foreground">
                  {ar ? "الفلاتر" : "Filters"}
                </h2>
              </div>
              <Badge
                variant="outline"
                className="h-8 w-fit px-3 text-xs font-semibold bg-muted/40"
              >
                {currentData().length} {ar ? "سجل" : "records"}
                {selectedRows.size > 0 && (
                  <span
                    className={
                      ar ? "mr-1.5 text-primary" : "ml-1.5 text-primary"
                    }
                  >
                    | {selectedRows.size} {ar ? "محدد" : "selected"}
                  </span>
                )}
              </Badge>
            </div>

            <div className="grid gap-3 p-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
              {/* Property Filter — shows for SuperAdmin or any user with access to >1 property */}
              {properties.length > 1 && (
                <div className={filterFieldClass}>
                  <label className={filterLabelClass}>
                    {ar ? "العقار" : "Property"}
                  </label>
                  <Select
                    value={filterProperty}
                    onValueChange={(v) => {
                      setFilterProperty(v);
                      setFilterBuilding("all");
                      setFilterFloor("all");
                      setFilterStatus("all");
                      setFilterCategory("all");
                      setFilterDepartment("all");
                      setFilterGender("all");
                      setFilterNationality("all");
                      setSearch("");
                      setDateFrom("");
                      setDateTo("");
                    }}
                  >
                    <SelectTrigger className={filterControlClass}>
                      <SelectValue
                        placeholder={ar ? "اختر العقار" : "Select Property"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {ar ? "العقار النشط" : "Active Property"}
                      </SelectItem>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)}>
                          {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {propId && (
                    <p className="text-[10px] text-muted-foreground truncate block">
                      {ar ? "الحالي: " : "Now: "}
                      {properties.find((p) => p.id === propId)?.name ??
                        `#${propId}`}
                    </p>
                  )}
                </div>
              )}

              {/* Category — Maintenance only */}
              {activeTab === "maintenance" && (
                <div className={filterFieldClass}>
                  <label className={filterLabelClass}>
                    {ar ? "التصنيف" : "Category"}
                  </label>
                  <Select
                    value={filterCategory}
                    onValueChange={setFilterCategory}
                  >
                    <SelectTrigger className={filterControlClass}>
                      <SelectValue placeholder="All" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
                      <SelectItem value="maintenance">
                        {ar ? "صيانة" : "Maintenance"}
                      </SelectItem>
                      <SelectItem value="housekeeping">
                        {ar ? "هاوس كيبنج" : "Housekeeping"}
                      </SelectItem>
                      <SelectItem value="general">
                        {ar ? "عام" : "General"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Building — Housing / Assignments / Maintenance / Hostings */}
              {(activeTab === "housing" ||
                activeTab === "assignments" ||
                activeTab === "maintenance" ||
                activeTab === "hostings") && (
                <div className={filterFieldClass}>
                  <label className={filterLabelClass}>
                    {ar ? "المبنى" : "Building"}
                  </label>
                  <Select
                    value={filterBuilding}
                    onValueChange={(v) => {
                      setFilterBuilding(v);
                      setFilterFloor("all");
                    }}
                  >
                    <SelectTrigger className={filterControlClass}>
                      <SelectValue
                        placeholder={ar ? "كل المباني" : "All Buildings"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {ar ? "كل المباني" : "All Buildings"}
                      </SelectItem>
                      {buildings.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Floor — Housing / Assignments / Maintenance / Hostings */}
              {(activeTab === "housing" ||
                activeTab === "assignments" ||
                activeTab === "maintenance" ||
                activeTab === "hostings") && (
                <div className={filterFieldClass}>
                  <label className={filterLabelClass}>
                    {ar ? "الدور" : "Floor"}
                  </label>
                  <Select
                    value={filterFloor}
                    onValueChange={setFilterFloor}
                    disabled={
                      filterBuilding === "all" && floorOptions.length === 0
                    }
                  >
                    <SelectTrigger className={filterControlClass}>
                      <SelectValue
                        placeholder={ar ? "كل الأدوار" : "All Floors"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {ar ? "كل الأدوار" : "All Floors"}
                      </SelectItem>
                      {floorOptions.map((f) => (
                        <SelectItem key={f.id} value={String(f.id)}>
                          {f.name || f.floorNumber || `Floor ${f.id}`}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Status — all tabs except analytics */}
              {getStatusOptions().length > 0 && (
                <div className={filterFieldClass}>
                  <label className={filterLabelClass}>
                    {ar ? "الحالة" : "Status"}
                  </label>
                  <Select value={filterStatus} onValueChange={setFilterStatus}>
                    <SelectTrigger className={filterControlClass}>
                      <SelectValue
                        placeholder={ar ? "كل الحالات" : "All Statuses"}
                      />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {ar ? "كل الحالات" : "All Statuses"}
                      </SelectItem>
                      {getStatusOptions().map((s) => (
                        <SelectItem key={s.value} value={s.value}>
                          {s.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Department — Employees / Assignments / Reservations */}
              {(activeTab === "employees" ||
                activeTab === "assignments" ||
                activeTab === "reservations" ||
                activeTab === "hostings") &&
                departments.length > 0 && (
                  <div className={filterFieldClass}>
                    <label className={filterLabelClass}>
                      {ar ? "القسم" : "Department"}
                    </label>
                    <Select
                      value={filterDepartment}
                      onValueChange={setFilterDepartment}
                    >
                      <SelectTrigger className={filterControlClass}>
                        <SelectValue
                          placeholder={ar ? "كل الأقسام" : "All Departments"}
                        />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">
                          {ar ? "كل الأقسام" : "All Departments"}
                        </SelectItem>
                        {departments.map((d) => (
                          <SelectItem key={d} value={d}>
                            {d}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

              {/* Gender — Employees / Housing / Assignments */}
              {(activeTab === "employees" ||
                activeTab === "housing" ||
                activeTab === "assignments" ||
                activeTab === "hostings") && (
                <div className={filterFieldClass}>
                  <label className={filterLabelClass}>
                    {ar ? "النوع" : "Gender"}
                  </label>
                  <Select value={filterGender} onValueChange={setFilterGender}>
                    <SelectTrigger className={filterControlClass}>
                      <SelectValue placeholder={ar ? "الكل" : "All"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {ar ? "الكل" : "All Genders"}
                      </SelectItem>
                      <SelectItem value="male">
                        {ar ? "ذكور" : "Male"}
                      </SelectItem>
                      <SelectItem value="female">
                        {ar ? "إناث" : "Female"}
                      </SelectItem>
                      {activeTab === "housing" && (
                        <SelectItem value="mixed">
                          {ar ? "مختلط" : "Mixed"}
                        </SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Nationality — Employees only */}
              {activeTab === "employees" && nationalities.length > 0 && (
                <div className={filterFieldClass}>
                  <label className={filterLabelClass}>
                    {ar ? "الجنسية" : "Nationality"}
                  </label>
                  <Select
                    value={filterNationality}
                    onValueChange={setFilterNationality}
                  >
                    <SelectTrigger className={filterControlClass}>
                      <SelectValue placeholder={ar ? "الكل" : "All"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">
                        {ar ? "الكل" : "All Nationalities"}
                      </SelectItem>
                      {nationalities.map((n) => (
                        <SelectItem key={n} value={n}>
                          {n}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {/* Search */}
              <div className={`${filterFieldClass} sm:col-span-2`}>
                <label className={filterLabelClass}>
                  {ar ? "بحث" : "Search"}
                </label>
                <div className="relative w-full">
                  <Search
                    className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground ${ar ? "right-2.5" : "left-2.5"}`}
                  />
                  <Input
                    className={`${filterControlClass} ${ar ? "pr-8" : "pl-8"}`}
                    placeholder={ar ? "ابحث هنا..." : "Search records..."}
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                  />
                </div>
              </div>

              {/* Date Range */}
              {activeTab !== "housing" && (
                <>
                  <div className={filterFieldClass}>
                    <label className={filterLabelClass}>
                      <Calendar className="w-3 h-3 text-muted-foreground/80" />
                      {activeTab === "employees"
                        ? ar
                          ? "التعيين من"
                          : "Hired From"
                        : ar
                          ? "من"
                          : "From"}
                    </label>
                    <Input
                      type="date"
                      className={filterControlClass}
                      value={dateFrom}
                      onChange={(e) => setDateFrom(e.target.value)}
                    />
                  </div>
                  <div className={filterFieldClass}>
                    <label className={filterLabelClass}>
                      <Calendar className="w-3 h-3 text-muted-foreground/80" />
                      {activeTab === "employees"
                        ? ar
                          ? "التعيين إلى"
                          : "Hired To"
                        : ar
                          ? "إلى"
                          : "To"}
                    </label>
                    <Input
                      type="date"
                      className={filterControlClass}
                      value={dateTo}
                      onChange={(e) => setDateTo(e.target.value)}
                    />
                  </div>
                </>
              )}
            </div>

            {/* Clear */}
            {hasActiveReportFilters && (
              <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
                <div className="flex flex-wrap items-center gap-2 sm:justify-end">
                  <Button
                    variant="outline"
                    size="sm"
                    className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground"
                    onClick={resetReportFilters}
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    {ar ? "تهيئة الفلاتر" : "Reset Filters"}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* Table */}
          <div className="border rounded-lg bg-card overflow-hidden shadow-sm">
            {isLoading ? (
              <div className="space-y-2 p-4">
                {Array.from({ length: 8 }).map((_, i) => (
                  <Skeleton key={i} className="h-10 w-full" />
                ))}
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow className="bg-[#0F2A44] hover:bg-[#0F2A44]">
                      <TableHead className="w-10 px-3">
                        <Checkbox
                          className="border-white/40 data-[state=checked]:bg-white data-[state=checked]:text-[#0F2A44]"
                          checked={
                            allData.length > 0 &&
                            allData.every((r) => selectedRows.has(r.id))
                          }
                          onCheckedChange={(checked) => {
                            if (checked)
                              setSelectedRows(
                                new Set(allData.map((r: any) => r.id)),
                              );
                            else setSelectedRows(new Set());
                          }}
                        />
                      </TableHead>
                      {activeTab === "housing" && (
                        <>
                          <TableHead className="text-white font-semibold">
                            Room No
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Type
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Capacity
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Gender Policy
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Floor
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Building
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Status
                          </TableHead>
                        </>
                      )}
                      {activeTab === "employees" && (
                        <>
                          <TableHead className="text-white font-semibold w-10">
                            Photo
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Code
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            First Name
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Last Name
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            National ID
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Nationality
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Phone
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Gender
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Department
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Job Title
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Level
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Status
                          </TableHead>
                        </>
                      )}
                      {activeTab === "assignments" && (
                        <>
                          <TableHead className="text-white font-semibold">
                            Employee
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Room
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Building
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Check-In
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Expected Out
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Check-Out
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Status
                          </TableHead>
                        </>
                      )}
                      {activeTab === "maintenance" && (
                        <>
                          <TableHead className="text-white font-semibold">
                            Category
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Room
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Building
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Problem
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Priority
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Status
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Assigned To
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Reported By
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Reported
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Started
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Resolved
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Due Date
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Notes
                          </TableHead>
                        </>
                      )}
                      {activeTab === "hostings" && (
                        <>
                          <TableHead className="text-white font-semibold">
                            Host Employee
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Room
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Type
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Guests
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Expected
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Actual Check
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Status
                          </TableHead>
                        </>
                      )}
                      {activeTab === "reservations" && (
                        <>
                          <TableHead className="text-white font-semibold">
                            Name
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Room
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Room Type
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Department
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Check-In
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Check-Out
                          </TableHead>
                          <TableHead className="text-white font-semibold">
                            Status
                          </TableHead>
                        </>
                      )}
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {allData.length === 0 ? (
                      <TableRow>
                        <TableCell
                          colSpan={20}
                          className="py-16 text-center text-muted-foreground"
                        >
                          <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-20" />
                          <p className="font-medium">
                            No records match the selected filters
                          </p>
                        </TableCell>
                      </TableRow>
                    ) : (
                      paginatedData.map((row: any, idx: number) => (
                        <TableRow
                          key={row.id ?? idx}
                          className={
                            selectedRows.has(row.id)
                              ? "bg-primary/5"
                              : "hover:bg-muted/30"
                          }
                        >
                          <TableCell className="px-3">
                            <Checkbox
                              checked={selectedRows.has(row.id)}
                              onCheckedChange={() => {
                                setSelectedRows((prev) => {
                                  const next = new Set(prev);
                                  next.has(row.id)
                                    ? next.delete(row.id)
                                    : next.add(row.id);
                                  return next;
                                });
                              }}
                            />
                          </TableCell>
                          {activeTab === "housing" && (
                            <>
                              <TableCell className="font-mono font-medium">
                                {row.roomNumber}
                              </TableCell>
                              <TableCell>{row.roomType ?? "—"}</TableCell>
                              <TableCell>{row.capacity}</TableCell>
                              <TableCell className="capitalize">
                                {row.genderPolicy ?? "—"}
                              </TableCell>
                              <TableCell>
                                {floorMap[row.floorId] ?? "—"}
                              </TableCell>
                              <TableCell>
                                {buildingMap[row.buildingId] ?? "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={row.status} />
                              </TableCell>
                            </>
                          )}
                          {activeTab === "employees" && (
                            <>
                              <TableCell>
                                {(row as any).photoUrl ? (
                                  <img
                                    src={(row as any).photoUrl}
                                    alt=""
                                    className="w-8 h-8 rounded-full object-cover border"
                                  />
                                ) : (
                                  <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-xs font-bold text-primary">
                                    {row.firstName?.[0]}
                                    {row.lastName?.[0]}
                                  </div>
                                )}
                              </TableCell>
                              <TableCell className="font-mono text-xs font-medium text-primary">
                                {row.employeeCode}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">
                                {row.firstName}
                              </TableCell>
                              <TableCell className="font-medium whitespace-nowrap">
                                {row.lastName}
                              </TableCell>
                              <TableCell className="font-mono text-xs">
                                {row.nationalId ?? "—"}
                              </TableCell>
                              <TableCell>{row.nationality ?? "—"}</TableCell>
                              <TableCell className="font-mono text-xs">
                                {(row as any).phone ?? "—"}
                              </TableCell>
                              <TableCell className="capitalize">
                                {row.gender ?? "—"}
                              </TableCell>
                              <TableCell>{row.department ?? "—"}</TableCell>
                              <TableCell>{row.jobTitle ?? "—"}</TableCell>
                              <TableCell>{(row as any).level ?? "—"}</TableCell>
                              <TableCell>
                                <StatusBadge status={row.status} />
                              </TableCell>
                            </>
                          )}
                          {activeTab === "assignments" && (
                            <>
                              <TableCell className="font-medium">
                                {empMap[row.employeeId]
                                  ? `${empMap[row.employeeId].firstName} ${empMap[row.employeeId].lastName}`
                                  : `Emp #${row.employeeId}`}
                              </TableCell>
                              <TableCell className="font-mono">
                                {roomMap[row.roomId]?.roomNumber ??
                                  `#${row.roomId}`}
                              </TableCell>
                              <TableCell>
                                {roomMap[row.roomId]
                                  ? (buildingMap[
                                      roomMap[row.roomId].buildingId
                                    ] ?? "—")
                                  : "—"}
                              </TableCell>
                              <TableCell>
                                {row.checkInDate?.slice(0, 10)}
                              </TableCell>
                              <TableCell>
                                {row.expectedCheckOutDate?.slice(0, 10) ?? "—"}
                              </TableCell>
                              <TableCell>
                                {row.checkOutDate?.slice(0, 10) ?? "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={row.status} />
                              </TableCell>
                            </>
                          )}
                          {activeTab === "maintenance" && (
                            <>
                              <TableCell>
                                {(row as any).category ?? "—"}
                              </TableCell>
                              <TableCell className="font-mono">
                                {roomMap[(row as any).roomId]?.roomNumber ??
                                  `#${(row as any).roomId}`}
                              </TableCell>
                              <TableCell>
                                {(row as any).roomId
                                  ? (buildingMap[
                                      roomMap[(row as any).roomId]?.buildingId
                                    ] ?? "—")
                                  : "—"}
                              </TableCell>
                              <TableCell className="max-w-[200px] truncate">
                                {(row as any).problem ?? "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={(row as any).priority} />
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={row.status} />
                              </TableCell>
                              <TableCell>
                                {(row as any).assignedTo ?? "—"}
                              </TableCell>
                              <TableCell>
                                {(row as any).reportedBy ?? "—"}
                              </TableCell>
                              <TableCell>
                                {(row as any).reportedDate?.slice(0, 10) ?? "—"}
                              </TableCell>
                              <TableCell>
                                {(row as any).startedDate?.slice(0, 10) ?? "—"}
                              </TableCell>
                              <TableCell>
                                {(row as any).resolvedDate?.slice(0, 10) ?? "—"}
                              </TableCell>
                              <TableCell>
                                {(row as any).dueDate?.slice(0, 10) ?? "—"}
                              </TableCell>
                              <TableCell className="max-w-[150px] truncate text-xs">
                                {(row as any).notes ?? "—"}
                              </TableCell>
                            </>
                          )}
                          {activeTab === "hostings" && (
                            <>
                              <TableCell className="font-medium">
                                {empMap[(row as any).employeeId]
                                  ? `${empMap[(row as any).employeeId].firstName} ${empMap[(row as any).employeeId].lastName}`
                                  : `Emp #${(row as any).employeeId}`}
                              </TableCell>
                              <TableCell className="font-mono">
                                {roomMap[(row as any).roomId]?.roomNumber ??
                                  `#${(row as any).roomId}`}
                              </TableCell>
                              <TableCell>
                                {(row as any).hostingType ?? "—"}
                              </TableCell>
                              <TableCell>
                                {(row as any).numberOfGuests ?? "—"}
                              </TableCell>
                              <TableCell>
                                <div>
                                  {(row as any).expectedCheckIn?.slice(0, 10) ??
                                    "—"}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {(row as any).expectedCheckOut?.slice(
                                    0,
                                    10,
                                  ) ?? "—"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <div>
                                  {(row as any).actualCheckIn?.slice(0, 10) ??
                                    "—"}
                                </div>
                                <div className="text-muted-foreground text-xs">
                                  {(row as any).actualCheckOut?.slice(0, 10) ??
                                    "—"}
                                </div>
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={row.status} />
                              </TableCell>
                            </>
                          )}
                          {activeTab === "reservations" && (
                            <>
                              <TableCell className="font-medium">
                                {row.firstName} {row.lastName}
                              </TableCell>
                              <TableCell className="font-mono">
                                {row.roomId
                                  ? (roomMap[row.roomId]?.roomNumber ??
                                    `#${row.roomId}`)
                                  : "—"}
                              </TableCell>
                              <TableCell>{row.roomType ?? "—"}</TableCell>
                              <TableCell>{row.department ?? "—"}</TableCell>
                              <TableCell>
                                {row.checkInDate?.slice(0, 10)}
                              </TableCell>
                              <TableCell>
                                {row.checkOutDate?.slice(0, 10) ?? "—"}
                              </TableCell>
                              <TableCell>
                                <StatusBadge status={row.status} />
                              </TableCell>
                            </>
                          )}
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                  {currentData().length > 0 && (
                    <tfoot>
                      <tr className="bg-[#0F2A44]/90 text-[#C9A24D]">
                        <td
                          className="px-3 py-2.5 text-xs font-bold"
                          colSpan={2}
                        >
                          {ar ? "الإجمالي" : "Total"}
                        </td>
                        <td
                          className="px-3 py-2.5 text-xs font-bold"
                          colSpan={18}
                        >
                          {currentData().length}{" "}
                          {activeTab === "housing"
                            ? "rooms"
                            : activeTab === "employees"
                              ? "employees"
                              : activeTab === "assignments"
                                ? "assignments"
                                : activeTab === "maintenance"
                                  ? "requests"
                                  : activeTab === "hostings"
                                    ? "hostings"
                                    : "reservations"}
                          {selectedRows.size > 0 && (
                            <span className="ml-3 text-white/80">
                              · {selectedRows.size} selected
                            </span>
                          )}
                          {activeTab === "housing" && (
                            <span className="ml-3">
                              |{" "}
                              {(currentData() as any[]).reduce(
                                (s, r) => s + (r.capacity ?? 0),
                                0,
                              )}{" "}
                              beds total
                            </span>
                          )}
                          {activeTab === "assignments" && (
                            <span className="ml-3">
                              | Active:{" "}
                              {
                                (currentData() as any[]).filter(
                                  (a) => a.status === "ACTIVE",
                                ).length
                              }
                            </span>
                          )}
                        </td>
                      </tr>
                    </tfoot>
                  )}
                </Table>
              </div>
            )}
          </div>

          <div className="mt-2">
            <DataPagination
              total={allData.length}
              pageSize={pageSize}
              currentPage={currentPage}
              onPageChange={setCurrentPage}
              onPageSizeChange={setPageSize}
            />
          </div>
        </>
      )}
    </div>
  );
}
