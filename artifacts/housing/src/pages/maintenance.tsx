// @ts-nocheck
import { useState, useMemo, useRef, useEffect } from "react";
import {
  useListMaintenance,
  useCreateMaintenance,
  useUpdateMaintenance,
  useDeleteMaintenance,
  useListRooms,
  useListProfiles,
  useListAssignments,
  getListMaintenanceQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { usePermission } from "@/hooks/use-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Trash,
  Plus,
  Wrench,
  CheckCircle2,
  Play,
  Sparkles,
  FileText,
  Eye,
  Camera,
  ImageIcon,
  X,
  Upload,
} from "lucide-react";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import MaintenanceFilterBar from "@/components/ui/maintenance-filter-bar";
import TicketDetailModal from "@/components/ui/ticket-detail-modal";
import * as XLSX from "xlsx";
import { format, differenceInMinutes } from "date-fns";
import { formatDate, getExportFileName } from "@/lib/date-utils";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DataPagination } from "@/components/DataPagination";
import { PaginationBar } from "@/components/ui/PaginationBar";

const CATEGORIES = ["maintenance", "housekeeping", "general"];
const CATEGORIES_AR = {
  maintenance: "صيانة",
  housekeeping: "هاوس كيبنج",
  general: "عام",
};
const CATEGORY_ICONS = {
  maintenance: <Wrench className="w-3.5 h-3.5" />,
  housekeeping: <Sparkles className="w-3.5 h-3.5" />,
  general: <FileText className="w-3.5 h-3.5" />,
};

const PROBLEM_TYPES = [
  "Plumbing",
  "Electrical",
  "HVAC",
  "Furniture",
  "Cleaning",
  "Internet",
  "Other",
];
const PROBLEM_TYPES_AR = {
  Plumbing: "سباكة",
  Electrical: "كهرباء",
  HVAC: "تكييف",
  Furniture: "أثاث",
  Cleaning: "نظافة",
  Internet: "إنترنت",
  Other: "أخرى",
};
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PRIORITY_AR = {
  LOW: "منخفضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
};
const STATUS_AR = {
  open: "مفتوحة",
  in_progress: "قيد التنفيذ",
  resolved: "تم الحل",
  closed: "مغلقة",
};

function getDurationMins(
  startedAt: any,
  resolvedAt: any,
  reportedAt: any,
): number {
  const start = reportedAt ?? startedAt;
  if (!start) return -1;
  const startDate = new Date(start);
  // Freeze at resolvedAt if ticket is done, otherwise count live
  const endDate = resolvedAt ? new Date(resolvedAt) : new Date();
  return differenceInMinutes(endDate, startDate);
}

function formatDuration(
  startedAt: any,
  resolvedAt: any,
  reportedAt: any,
): string {
  const totalMins = getDurationMins(startedAt, resolvedAt, reportedAt);
  if (totalMins < 0) return "—";
  if (totalMins < 1) return "< 1 min";
  return `${totalMins} min`;
}

function getDurationColor(
  startedAt: any,
  resolvedAt: any,
  reportedAt: any,
): string {
  const totalMins = getDurationMins(startedAt, resolvedAt, reportedAt);
  if (totalMins < 0) return "text-muted-foreground";
  if (totalMins <= 20) return "text-green-600 dark:text-green-400";
  if (totalMins <= 40) return "text-yellow-500 dark:text-yellow-400";
  if (totalMins <= 60) return "text-red-500 dark:text-red-400";
  return "text-gray-900 dark:text-white font-extrabold";
}

export default function Tickets() {
  const { activePropertyId, properties } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const { can, canView, isSuperAdmin, isAdmin } = usePermission();

  const hasMaintenance = isSuperAdmin || isAdmin || canView("maintenance");
  const hasHousekeeping = isSuperAdmin || isAdmin || canView("housekeeping");

  const isOnlyHousekeeping = !hasMaintenance && hasHousekeeping;
  const isOnlyMaintenance = hasMaintenance && !hasHousekeeping;
  const hasBoth = hasMaintenance && hasHousekeeping;

  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState(() =>
    isOnlyHousekeeping ? "housekeeping" : isOnlyMaintenance ? "maintenance" : "all"
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 500);
  const [photoDialog, setPhotoDialog] = useState<string | null>(null);
  const [filterBarFilters, setFilterBarFilters] = useState<Record<string, any>>(
    {},
  );
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(new Set());
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);
  const [subTickets, setSubTickets] = useState<any[]>([]);
  const [loadingSubTickets, setLoadingSubTickets] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [creatorTypeFilter, setCreatorTypeFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Sync category if permissions resolve
  useEffect(() => {
    if (isOnlyHousekeeping && categoryFilter !== "housekeeping") {
      setCategoryFilter("housekeeping");
    } else if (isOnlyMaintenance && categoryFilter !== "maintenance") {
      setCategoryFilter("maintenance");
    }
  }, [isOnlyHousekeeping, isOnlyMaintenance]);

  useEffect(() => {
    setPage(1);
    setCurrentPage(1);
  }, [debouncedSearch, statusFilter, priorityFilter, categoryFilter, propertyFilter, fromDate, toDate]);

  // Form state
  const [formPropertyId, setFormPropertyId] = useState<string>(() => {
    if (activePropertyId && activePropertyId !== "all") return String(activePropertyId);
    if (properties && properties.length > 0) return String(properties[0].id);
    return "";
  });

  const [form, setForm] = useState({
    roomId: "",
    category: isOnlyHousekeeping ? "housekeeping" : "maintenance",
    problemType: "",
    description: "",
    priority: "MEDIUM",
    notes: "",
  });

  // Effective propertyId for list query
  const effectivePropertyId =
    propertyFilter && propertyFilter !== "all"
      ? parseInt(propertyFilter, 10)
      : activePropertyId === "all" || propertyFilter === "all"
        ? "all"
        : activePropertyId ?? "all";

  const {
    data: allTicketsWrapper,
    isLoading,
    isFetching,
  } = useListMaintenance(
    { 
      propertyId: effectivePropertyId, 
      page: currentPage, 
      limit: pageSize,
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      priority: priorityFilter || undefined,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    } as any,
    {
      query: {
        queryKey: getListMaintenanceQueryKey({
          propertyId: effectivePropertyId,
          page: currentPage,
          limit: pageSize,
          search: debouncedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter || undefined,
          category: categoryFilter === "all" ? undefined : categoryFilter,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
        } as any),
        refetchOnMount: true,
        staleTime: 0,
        refetchInterval: 5000,
        refetchIntervalInBackground: true,
        refetchOnWindowFocus: true,
        placeholderData: (prev: any) => prev,
      },
    },
  );
  const allTickets = allTicketsWrapper?.data || allTicketsWrapper || [];
  const paginationData = allTicketsWrapper?.pagination || { total: allTickets?.length || 0, page: currentPage, limit: pageSize };

  const { data: _roomsWrapper } = useListRooms(
    { propertyId: activePropertyId && activePropertyId !== "all" ? activePropertyId : undefined, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId && activePropertyId !== "all" } },
  );
  const rooms = _roomsWrapper?.data || [];

  // Rooms specifically for modal's selected property
  const selectedModalPropId = parseInt(formPropertyId, 10) || (activePropertyId !== "all" ? activePropertyId : properties[0]?.id);
  const { data: _modalRoomsWrapper } = useListRooms(
    { propertyId: selectedModalPropId, limit: 1000 } as any,
    { query: { enabled: !!selectedModalPropId } },
  );
  const modalRooms = _modalRoomsWrapper?.data || [];

  const { data: _eDataWrapper } = useListProfiles(
    { propertyId: activePropertyId && activePropertyId !== "all" ? activePropertyId : undefined, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId && activePropertyId !== "all" } },
  );
  const profiles = _eDataWrapper?.profiles || _eDataWrapper?.data || [];
  const { data: assignments } = useListAssignments(
    { propertyId: activePropertyId && activePropertyId !== "all" ? activePropertyId : undefined } as any,
    { query: { enabled: !!activePropertyId && activePropertyId !== "all" } },
  );

  // Build room → occupant name(s) map from active assignments + profiles
  const roomOccupantMap = useMemo(() => {
    const empLookup = Object.fromEntries(
      profiles.map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
    );
    const map: Record<number, string> = {};
    (assignments || []).forEach((a: any) => {
      if (a.status === "ACTIVE" && a.roomId) {
        const name = empLookup[a.profileId];
        if (name) {
          if (map[a.roomId]) {
            // Multiple occupants — append
            if (!map[a.roomId].includes(name)) {
              map[a.roomId] += `, ${name}`;
            }
          } else {
            map[a.roomId] = name;
          }
        }
      }
    });
    return map;
  }, [assignments, profiles]);

  const invalidate = () => {
    queryClient.invalidateQueries({
      queryKey: getListMaintenanceQueryKey({ propertyId: activePropertyId }),
    });
    queryClient.invalidateQueries({ queryKey: getListMaintenanceQueryKey() });
  };

  const fetchSubTickets = async (parentId: number) => {
    setLoadingSubTickets(true);
    try {
      const res = await fetch(`/api/maintenance/${parentId}/sub-tickets`, {
        credentials: "include",
      });
      if (!res.ok) {
        setSubTickets([]);
        return;
      }
      const data = await res.json();
      setSubTickets(Array.isArray(data) ? data : []);
    } catch (e) {
      setSubTickets([]);
    } finally {
      setLoadingSubTickets(false);
    }
  };

  const handleSelectTicket = (id: number) => {
    setSelectedTicketId(id);
    fetchSubTickets(id);
  };

  const createMutation = useCreateMaintenance({
    mutation: {
      onSuccess: () => {
        setCurrentPage(1);
        setPage(1);
        invalidate();
        toast.success(ar ? "تم إنشاء الطلب" : "Request created");
        setIsOpen(false);
        resetForm();
      },
      onError: (e) =>
        toast.error(ar ? "خطأ" : "Error", {
          description: e.message,
        }),
    },
  });

  const updateMutation = useUpdateMaintenance({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تحديث الحالة" : "Status updated");
      },
      onError: (e) =>
        toast.error(ar ? "خطأ" : "Error", {
          description: e.message,
        }),
    },
  });

  const deleteMutation = useDeleteMaintenance({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم حذف الطلب" : "Request deleted");
        setDeleteId(null);
      },
    },
  });

  const resetForm = () => {
    setForm({
      roomId: "",
      category: isOnlyHousekeeping ? "housekeeping" : "maintenance",
      problemType: "",
      description: "",
      priority: "MEDIUM",
      notes: "",
    });
    setFormPhotoUrl("");
    if (activePropertyId && activePropertyId !== "all") {
      setFormPropertyId(String(activePropertyId));
    } else if (properties && properties.length > 0) {
      setFormPropertyId(String(properties[0].id));
    }
  };

  const onSubmit = () => {
    const targetPropId =
      parseInt(formPropertyId, 10) ||
      (activePropertyId && activePropertyId !== "all" ? activePropertyId : properties[0]?.id);

    if (!targetPropId) {
      toast.error(
        ar ? "يرجى اختيار الفندق / العقار أولاً" : "Please select a hotel/property first",
      );
      return;
    }
    if (!form.roomId || !form.description) {
      toast.error(
        ar ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields",
      );
      return;
    }
    createMutation.mutate({
      data: {
        propertyId: targetPropId,
        roomId: parseInt(form.roomId),
        category: form.category,
        problemType: form.problemType || form.category,
        description: form.description,
        priority: form.priority,
        photoUrl: formPhotoUrl || undefined,
      },
    });
  };

  const handlePhotoUpload = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setFormPhotoUrl(reader.result);
    reader.readAsDataURL(file);
  };

  const priorityColor = (p) => {
    switch ((p || "").toLowerCase()) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/40 dark:text-yellow-300";
      default:
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
    }
  };

  const statusColor = (s) => {
    switch ((s || "").toLowerCase()) {
      case "open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300";
      case "in_progress":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300";
      case "resolved":
        return "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300";
      case "closed":
        return "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const categoryColor = (c) => {
    switch (c) {
      case "maintenance":
        return "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300";
      case "housekeeping":
        return "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300";
      case "general":
        return "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300";
      default:
        return "bg-gray-100 text-gray-600";
    }
  };

  const COLS = [
    { key: "id", label: "ID", labelAr: "رقم", defaultVisible: true },
    { key: "room", label: "Room", labelAr: "الغرفة", defaultVisible: true },
    {
      key: "problemType",
      label: "Problem",
      labelAr: "المشكلة",
      defaultVisible: true,
    },
    { key: "name", label: "Name", labelAr: "الاسم", defaultVisible: true },
    { key: "category", label: "Type", labelAr: "النوع", defaultVisible: true },
    {
      key: "priority",
      label: "Priority",
      labelAr: "الأولوية",
      defaultVisible: true,
    },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    {
      key: "reported",
      label: "Reported",
      labelAr: "تاريخ الإبلاغ",
      defaultVisible: true,
    },
    {
      key: "started",
      label: "Started",
      labelAr: "بدأت",
      defaultVisible: false,
    },
    {
      key: "resolved",
      label: "Resolved",
      labelAr: "حُلّت",
      defaultVisible: true,
    },
    {
      key: "duration",
      label: "Duration",
      labelAr: "المدة",
      defaultVisible: true,
    },
    {
      key: "actions",
      label: "Actions",
      labelAr: "إجراءات",
      defaultVisible: true,
      fixed: true,
    },
  ];

  const { visible, toggle, showAll, hideAll, isVisible } =
    useColumnVisibility(COLS);

  const roomMap = Object.fromEntries(
    (rooms || []).map((r) => [r.id, r.roomNumber]),
  );
  const empMap = Object.fromEntries(
    profiles
      .filter((e) => e.status === "active")
      .map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
  );
  const empOptions = profiles.filter((e) => e.status === "active");

  const filtered = useMemo(() => {
    if (!Array.isArray(allTickets)) return [];
    return [...allTickets].sort((a, b) => {
      const dateA = a.reportedAt ? new Date(a.reportedAt).getTime() : (a.createdAt ? new Date(a.createdAt).getTime() : 0);
      const dateB = b.reportedAt ? new Date(b.reportedAt).getTime() : (b.createdAt ? new Date(b.createdAt).getTime() : 0);
      if (dateB !== dateA) return dateB - dateA;
      return (Number(b.id) || 0) - (Number(a.id) || 0);
    });
  }, [allTickets]);
  const paged = filtered;

  const exportExcel = () => {
    const rows = filtered.map((req) => ({
      [ar ? "رقم" : "ID"]: req.id,
      [ar ? "الفندق / العقار" : "Hotel / Property"]:
        req.propertyName ||
        properties?.find((p) => p.id === req.propertyId)?.name ||
        "—",
      [ar ? "الغرفة" : "Room"]:
        `${ar ? "الغرفة" : "Room"} ${req.roomNumber || (roomMap[req.roomId] ?? req.roomId)}`,
      [ar ? "الاسم" : "Name"]: roomOccupantMap[req.roomId] || "—",
      [ar ? "النوع" : "Type"]: ar
        ? (CATEGORIES_AR[req.category] ?? req.category)
        : req.category,
      [ar ? "نوع المشكلة" : "Problem Type"]: ar
        ? (PROBLEM_TYPES_AR[req.problemType] ?? req.problemType)
        : req.problemType,
      [ar ? "الوصف" : "Description"]: req.description,
      [ar ? "الأولوية" : "Priority"]: ar
        ? (PRIORITY_AR[req.priority] ?? req.priority)
        : req.priority,
      [ar ? "الحالة" : "Status"]: ar
        ? (STATUS_AR[req.status?.toLowerCase()] ?? req.status)
        : req.status,
      [ar ? "تاريخ الإبلاغ" : "Reported (Date)"]: formatDate(req.reportedAt, ""),
      [ar ? "وقت الإبلاغ" : "Reported (Time)"]: req.reportedAt
        ? format(new Date(req.reportedAt), "HH:mm")
        : "",
      [ar ? "المدة" : "Duration"]: formatDuration(
        req.startedAt,
        req.resolvedAt,
        req.reportedAt,
      ),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ar ? "التذاكر" : "Tickets");
    XLSX.writeFile(wb, getExportFileName("Maintenance_Tickets", "xlsx"));
  };

  const exportSelectedTicketsExcel = () => {
    const target =
      selectedTicketIds.size > 0
        ? allTickets.filter((t) => selectedTicketIds.has(t.id))
        : allTickets;
    if (target.length === 0) return;
    const rows = target.map((req) => ({
      [ar ? "رقم الطلب" : "Ticket #"]: req.id,
      [ar ? "الفندق / العقار" : "Hotel / Property"]:
        req.propertyName ||
        properties?.find((p) => p.id === req.propertyId)?.name ||
        "—",
      [ar ? "الغرفة" : "Room"]: req.roomNumber || (roomMap[req.roomId] ?? req.roomId),
      [ar ? "النوع" : "Category"]: ar
        ? (CATEGORIES_AR[req.category] ?? req.category)
        : req.category,
      [ar ? "المشكلة" : "Problem Type"]: ar
        ? (PROBLEM_TYPES_AR[req.problemType] ?? req.problemType)
        : req.problemType,
      [ar ? "الوصف" : "Description"]: req.description,
      [ar ? "الأولوية" : "Priority"]: ar
        ? (PRIORITY_AR[req.priority] ?? req.priority)
        : req.priority,
      [ar ? "الحالة" : "Status"]: ar
        ? (STATUS_AR[req.status?.toLowerCase()] ?? req.status)
        : req.status,
      [ar ? "تاريخ الإبلاغ" : "Reported (Date)"]: formatDate(req.reportedAt, ""),
      [ar ? "المدة" : "Duration"]: formatDuration(
        req.startedAt,
        req.resolvedAt,
        req.reportedAt,
      ),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ar ? "التذاكر المحددة" : "Selected Tickets");
    XLSX.writeFile(wb, getExportFileName("Maintenance_Selected_Tickets", "xlsx"));
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedTicketIds.size === 0) return;
    setBulkStatusLoading(true);
    try {
      const ids = Array.from(selectedTicketIds);
      await Promise.all(
        ids.map((id) =>
          updateMutation.mutateAsync({
            id,
            data: { status: newStatus } as any,
          })
        )
      );
      toast.success(
        ar
          ? `تم تحديث حالة ${ids.length} تذكرة بنجاح`
          : `Updated status for ${ids.length} ticket(s)`
      );
      setSelectedTicketIds(new Set());
    } catch {
      toast.error(ar ? "فشل التحديث الجماعي" : "Bulk update failed");
    } finally {
      setBulkStatusLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedTicketIds.size === 0) return;
    try {
      const ids = Array.from(selectedTicketIds);
      await Promise.all(
        ids.map((id) =>
          deleteMutation.mutateAsync({ id })
        )
      );
      toast.success(
        ar
          ? `تم حذف ${ids.length} تذكرة بنجاح`
          : `Deleted ${ids.length} ticket(s)`
      );
      setSelectedTicketIds(new Set());
    } catch {
      toast.error(ar ? "فشل الحذف الجماعي" : "Bulk delete failed");
    }
  };

  const totalCount = paginationData.total || 0;
  const openCount = allTickets?.filter((t) => t.status === "open").length || 0;
  const inProgressCount =
    allTickets?.filter((t) => t.status === "in_progress").length || 0;
  const closedCount =
    allTickets?.filter((t) => t.status === "closed").length || 0;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground flex items-center gap-2.5">
              {isOnlyHousekeeping ? (
                <>
                  <Sparkles className="w-7 h-7 text-sky-600" />
                  {ar ? "طلبات النظافة (الهاوس كيبنج)" : "Housekeeping Orders"}
                </>
              ) : isOnlyMaintenance ? (
                <>
                  <Wrench className="w-7 h-7 text-amber-600" />
                  {ar ? "أوامر وبلاغات الصيانة" : "Maintenance Orders"}
                </>
              ) : (
                <>
                  <Wrench className="w-7 h-7 text-primary" />
                  {ar ? "إدارة التذاكر والطلبات" : "Tickets & Requests Management"}
                </>
              )}
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              {isOnlyHousekeeping
                ? (ar ? "متابعة وإدارة جميع طلبات وأوامر تنظيف ونظافة الغرف" : "Monitor and manage room housekeeping and cleaning orders")
                : isOnlyMaintenance
                  ? (ar ? "متابعة وإدارة جميع بلاغات وأوامر الصيانة والأعطال" : "Monitor and manage maintenance requests and work orders")
                  : (ar ? "تصفية وإدارة جميع طلبات الصيانة والنظافة والخدمات عبر كافة الفنادق" : "Filter and manage maintenance, housekeeping, and service requests across hotels")}
            </p>
          </div>

          {/* Quick tab filters when user has access to both */}
          {hasBoth && (
            <div className="flex items-center gap-1.5 p-1 bg-muted/60 border rounded-xl shadow-xs self-start sm:self-auto">
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("all");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  categoryFilter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ar ? "كل الطلبات" : "All"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("maintenance");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  categoryFilter === "maintenance"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                {ar ? "الصيانة" : "Maintenance"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setCategoryFilter("housekeeping");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                  categoryFilter === "housekeeping"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                {ar ? "الهاوس كيبنج" : "Housekeeping"}
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Analytics Cards */}
      <div className="px-4 sm:px-6 pb-4 grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-sm font-medium text-muted-foreground">{ar ? "إجمالي التذاكر" : "Total Tickets"}</span>
          <span className="text-3xl font-bold mt-2">{totalCount}</span>
        </div>
        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-sm font-medium text-blue-600 dark:text-blue-400">{ar ? "مفتوحة" : "Open"}</span>
          <span className="text-3xl font-bold mt-2 text-blue-700 dark:text-blue-300">{openCount}</span>
        </div>
        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-sm font-medium text-purple-600 dark:text-purple-400">{ar ? "قيد التنفيذ" : "In Progress"}</span>
          <span className="text-3xl font-bold mt-2 text-purple-700 dark:text-purple-300">{inProgressCount}</span>
        </div>
        <div className="bg-card border rounded-lg p-4 flex flex-col items-center justify-center text-center shadow-sm">
          <span className="text-sm font-medium text-gray-600 dark:text-gray-400">{ar ? "مغلقة" : "Closed"}</span>
          <span className="text-3xl font-bold mt-2 text-gray-700 dark:text-gray-300">{closedCount}</span>
        </div>
      </div>

      {/* FilterBar */}
      <div className="px-4 sm:px-6 pb-4">
        <MaintenanceFilterBar
          ar={ar}
          properties={properties || []}
          departments={["Front Office", "Engineering", "House Keeping"]}
          profiles={profiles}
          allowedCategories={
            isOnlyHousekeeping
              ? ["housekeeping"]
              : isOnlyMaintenance
                ? ["maintenance"]
                : ["maintenance", "housekeeping", "general"]
          }
          initialPropertyId={propertyFilter}
          initialType={categoryFilter === "all" ? "" : categoryFilter}
          onCreateNew={() => setIsOpen(true)}
          onFiltersChange={(filters) => {
            setFilterBarFilters(filters);
            setFromDate(filters.fromDate ?? "");
            setToDate(filters.toDate ?? "");
            setStatusFilter(filters.status || "all");
            setCategoryFilter(
              isOnlyHousekeeping
                ? "housekeeping"
                : isOnlyMaintenance
                  ? "maintenance"
                  : filters.type || "all"
            );
            setPriorityFilter(filters.priority ?? "");
            setDepartmentFilter(filters.departments ?? []);
            setCreatorTypeFilter(filters.creatorType ?? "");
            setPropertyFilter(filters.propertyId || "all");
            setCurrentPage(1);
          }}
        />
      </div>

      {/* Column Chooser */}
      <div className="px-4 sm:px-6 pb-4 flex justify-end">
        <ColumnChooser
          cols={COLS}
          visible={visible}
          onToggle={toggle}
          onShowAll={showAll}
          onHideAll={hideAll}
          ar={ar}
        />
      </div>

      {/* New Request Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          setIsOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent
          className="max-w-md"
          srTitle={ar ? "طلب جديد" : "New Request"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5" />
              {ar ? "طلب جديد" : "New Request"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-2">
            {/* Property Selector */}
            {properties.length > 1 && (
              <div className="space-y-1.5">
                <Label>
                  {ar ? "الفندق / العقار" : "Hotel / Property"} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formPropertyId}
                  onValueChange={(v) => {
                    setFormPropertyId(v);
                    setForm((f) => ({ ...f, roomId: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={ar ? "اختر الفندق" : "Select hotel"} />
                  </SelectTrigger>
                  <SelectContent>
                    {properties.map((p) => (
                      <SelectItem key={p.id} value={String(p.id)}>
                        {p.displayName || p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="space-y-1.5">
              <Label>
                {ar ? "النوع" : "Type"} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.category}
                disabled={isOnlyHousekeeping || isOnlyMaintenance}
                onValueChange={(v) =>
                  setForm((f) => ({
                    ...f,
                    category: v,
                    problemType: v === "general" ? "general" : f.problemType,
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={ar ? "اختر النوع" : "Select type"}
                  />
                </SelectTrigger>
                <SelectContent>
                  {(isOnlyHousekeeping
                    ? ["housekeeping"]
                    : isOnlyMaintenance
                      ? ["maintenance"]
                      : CATEGORIES
                  ).map((c) => (
                    <SelectItem key={c} value={c}>
                      <span className="flex items-center gap-2">
                        {CATEGORY_ICONS[c]}
                        {ar
                          ? CATEGORIES_AR[c]
                          : c.charAt(0).toUpperCase() + c.slice(1)}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {ar ? "الغرفة" : "Room"} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.roomId}
                onValueChange={(v) => setForm((f) => ({ ...f, roomId: v }))}
              >
                <SelectTrigger>
                  <SelectValue
                    placeholder={ar ? "اختر الغرفة" : "Select room"}
                  />
                </SelectTrigger>
                <SelectContent
                  position="popper"
                  sideOffset={4}
                  className="max-h-64 overflow-y-auto"
                >
                  {(modalRooms.length > 0 ? modalRooms : rooms)?.map((r) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      {ar ? "الغرفة" : "Room"} {r.roomNumber}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {form.category !== "general" && (
              <div className="space-y-1.5">
                <Label>{ar ? "نوع المشكلة" : "Problem Type"}</Label>
                <Select
                  value={form.problemType}
                  onValueChange={(v) =>
                    setForm((f) => ({ ...f, problemType: v }))
                  }
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={ar ? "اختر النوع" : "Select type"}
                    />
                  </SelectTrigger>
                  <SelectContent
                    position="popper"
                    sideOffset={4}
                    className="max-h-64 overflow-y-auto"
                  >
                    {PROBLEM_TYPES.map((t) => (
                      <SelectItem key={t} value={t}>
                        {ar ? PROBLEM_TYPES_AR[t] : t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
            <div className="space-y-1.5">
              <Label>{ar ? "الأولوية" : "Priority"}</Label>
              <Select
                value={form.priority}
                onValueChange={(v) => setForm((f) => ({ ...f, priority: v }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4}>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {ar ? PRIORITY_AR[p] : p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label>
                {ar ? "الوصف" : "Description"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder={ar ? "صف المشكلة..." : "Describe the issue..."}
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>
            {/* Photo Upload */}
            <div className="space-y-1.5">
              <Label>{ar ? "صورة (اختياري)" : "Photo (optional)"}</Label>
              <div className="flex items-center gap-3">
                {formPhotoUrl ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img
                      src={formPhotoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                ) : (
                  <div className="flex gap-2">
                    <label className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-surface border cursor-pointer hover:border-primary/40 transition-colors">
                      <Camera className="w-5 h-5 text-primary" />
                      <span className="text-[10px] text-muted-foreground">
                        {ar ? "كاميرا" : "Camera"}
                      </span>
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        capture="environment"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                    <label className="flex flex-col items-center gap-1 px-4 py-3 rounded-lg bg-surface border cursor-pointer hover:border-primary/40 transition-colors">
                      <ImageIcon className="w-5 h-5 text-primary" />
                      <span className="text-[10px] text-muted-foreground">
                        {ar ? "معرض" : "Gallery"}
                      </span>
                      <input
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={handlePhotoUpload}
                      />
                    </label>
                  </div>
                )}
              </div>
            </div>
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={onSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? ar
                    ? "جاري الإنشاء..."
                    : "Creating..."
                  : ar
                    ? "إنشاء"
                    : "Create"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full mx-4 sm:mx-6" />
      ) : (
        <div className="px-4 sm:px-6 pb-6 space-y-4">
          {/* Bulk action bar */}
          <BulkActionBar
            count={selectedTicketIds.size}
            onClear={() => setSelectedTicketIds(new Set())}
            onExportExcel={exportSelectedTicketsExcel}
            extraActions={
              <div className="flex items-center gap-2">
                <Select
                  disabled={bulkStatusLoading}
                  onValueChange={(val) => handleBulkStatusChange(val)}
                >
                  <SelectTrigger className="w-[180px] h-8 text-xs bg-background">
                    <SelectValue
                      placeholder={
                        ar ? "تغيير الحالة جماعياً..." : "Change Status..."
                      }
                    />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-blue-500 shrink-0" />
                        <span>{ar ? "مفتوحة" : "Open"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="in_progress">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-amber-500 shrink-0" />
                        <span>{ar ? "قيد التنفيذ" : "In Progress"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="resolved">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 shrink-0" />
                        <span>{ar ? "تم الحل" : "Resolved"}</span>
                      </div>
                    </SelectItem>
                    <SelectItem value="closed">
                      <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-full bg-slate-400 shrink-0" />
                        <span>{ar ? "مغلقة" : "Closed"}</span>
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
                <PermissionGate anyPermission={[["maintenance", "delete"], ["housekeeping", "delete"]]}>
                  <Button
                    variant="destructive"
                    size="sm"
                    onClick={handleBulkDelete}
                    className="gap-1.5 h-8 text-xs font-semibold"
                  >
                    <Trash className="w-3.5 h-3.5" />
                    {ar ? "حذف المحدد" : "Delete"}
                  </Button>
                </PermissionGate>
              </div>
            }
            ar={ar}
          />

          <div className="border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={
                        paged.length > 0 &&
                        paged.every((t) => selectedTicketIds.has(t.id))
                      }
                      onCheckedChange={(checked) => {
                        setSelectedTicketIds(
                          checked
                            ? new Set([
                                ...selectedTicketIds,
                                ...paged.map((t) => t.id),
                              ])
                            : new Set(
                                Array.from(selectedTicketIds).filter(
                                  (id) => !paged.some((t) => t.id === id),
                                ),
                              ),
                        );
                      }}
                    />
                  </TableHead>
                  {isVisible("id") && (
                    <TableHead className="font-semibold w-16">
                      {ar ? "رقم" : "ID"}
                    </TableHead>
                  )}
                  {isVisible("room") && (
                    <TableHead className="font-semibold">
                      {ar ? "الغرفة" : "Room"}
                    </TableHead>
                  )}
                  {isVisible("problemType") && (
                    <TableHead className="font-semibold">
                      {ar ? "المشكلة" : "Problem"}
                    </TableHead>
                  )}
                  {isVisible("name") && (
                    <TableHead className="font-semibold">
                      {ar ? "الاسم" : "Name"}
                    </TableHead>
                  )}
                  {isVisible("category") && (
                    <TableHead className="font-semibold">
                      {ar ? "النوع" : "Type"}
                    </TableHead>
                  )}
                  {isVisible("priority") && (
                    <TableHead className="font-semibold">
                      {ar ? "الأولوية" : "Priority"}
                    </TableHead>
                  )}
                  {isVisible("status") && (
                    <TableHead className="font-semibold">
                      {ar ? "الحالة" : "Status"}
                    </TableHead>
                  )}
                  {isVisible("reported") && (
                    <TableHead className="font-semibold">
                      {ar ? "الإبلاغ" : "Reported"}
                    </TableHead>
                  )}
                  {isVisible("started") && (
                    <TableHead className="font-semibold">
                      {ar ? "بدأ" : "Started"}
                    </TableHead>
                  )}
                  {isVisible("resolved") && (
                    <TableHead className="font-semibold">
                      {ar ? "الحل" : "Resolved"}
                    </TableHead>
                  )}
                  {isVisible("duration") && (
                    <TableHead className="font-semibold">
                      {ar ? "المدة" : "Duration"}
                    </TableHead>
                  )}
                  {isVisible("actions") && (
                    <TableHead className="font-semibold">
                      {ar ? "إجراءات" : "Actions"}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/20">
                    <TableCell className="w-10 px-3">
                      <Checkbox
                        checked={selectedTicketIds.has(req.id)}
                        onCheckedChange={(checked) => {
                          setSelectedTicketIds((prev) => {
                            const next = new Set(prev);
                            if (checked) next.add(req.id);
                            else next.delete(req.id);
                            return next;
                          });
                        }}
                      />
                    </TableCell>
                    {isVisible("id") && (
                      <TableCell className="font-mono text-sm font-semibold text-muted-foreground">
                        #{req.id}
                      </TableCell>
                    )}
                    {isVisible("room") && (
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex flex-col">
                          <span>
                            {ar ? "الغرفة" : "Room"}{" "}
                            {req.roomNumber || roomMap[req.roomId] || req.roomId}
                          </span>
                          {(req.propertyName || (properties.length > 1 && req.propertyId)) && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {req.propertyName ||
                                properties.find((p) => p.id === req.propertyId)?.displayName ||
                                properties.find((p) => p.id === req.propertyId)?.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVisible("problemType") && (
                      <TableCell className="text-sm">
                        {ar
                          ? (PROBLEM_TYPES_AR[req.problemType] ??
                            req.problemType)
                          : req.problemType || (
                              <span className="text-muted-foreground/50">
                                —
                              </span>
                            )}
                      </TableCell>
                    )}
                    {isVisible("name") && (
                      <TableCell className="text-sm">
                        {roomOccupantMap[req.roomId] || (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVisible("category") && (
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold ${categoryColor(req.category)}`}
                        >
                          {CATEGORY_ICONS[req.category]}
                          {ar
                            ? (CATEGORIES_AR[req.category] ?? req.category)
                            : req.category}
                        </span>
                      </TableCell>
                    )}
                    {isVisible("priority") && (
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${priorityColor(req.priority)}`}
                        >
                          {ar
                            ? (PRIORITY_AR[req.priority?.toUpperCase()] ??
                              PRIORITY_AR[req.priority] ??
                              req.priority)
                            : req.priority
                              ? req.priority.charAt(0).toUpperCase() +
                                req.priority.slice(1).toLowerCase()
                              : req.priority}
                        </span>
                      </TableCell>
                    )}
                    {isVisible("status") && (
                      <TableCell>
                        <span
                          className={`px-2 py-0.5 rounded-full text-xs font-semibold ${statusColor(req.status)}`}
                        >
                          {ar
                            ? (STATUS_AR[req.status?.toLowerCase()] ??
                              req.status)
                            : (req.status || "")
                                .replace(/_/g, " ")
                                .replace(/\b\w/g, (c) => c.toUpperCase())}
                        </span>
                      </TableCell>
                    )}
                    {isVisible("reported") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {formatDate(req.reportedAt)}
                          </span>
                          <span className="text-muted-foreground">
                            {format(new Date(req.reportedAt), "HH:mm")}
                          </span>
                        </div>
                      </TableCell>
                    )}
                    {isVisible("started") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {req.startedAt ? (
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <Play className="w-3 h-3 text-purple-500" />
                              {formatDate(req.startedAt)}
                            </span>
                            <span className="pl-4 text-muted-foreground">
                              {format(new Date(req.startedAt), "HH:mm")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVisible("resolved") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {req.resolvedAt ? (
                          <div className="flex flex-col">
                            <span className="flex items-center gap-1 font-medium text-foreground">
                              <CheckCircle2 className="w-3 h-3 text-green-500" />
                              {formatDate(req.resolvedAt)}
                            </span>
                            <span className="pl-4 text-muted-foreground">
                              {format(new Date(req.resolvedAt), "HH:mm")}
                            </span>
                          </div>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVisible("duration") && (
                      <TableCell>
                        {req.startedAt || req.reportedAt ? (
                          <span
                            className={`text-xs font-bold ${getDurationColor(req.startedAt, req.resolvedAt, req.reportedAt)}`}
                          >
                            {formatDuration(
                              req.startedAt,
                              req.resolvedAt,
                              req.reportedAt,
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">
                            —
                          </span>
                        )}
                      </TableCell>
                    )}

                    {isVisible("actions") && (
                      <TableCell>
                        <div className="flex items-center gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 w-7 p-0"
                            onClick={() => handleSelectTicket(req.id)}
                            title={ar ? "عرض كامل" : "View full"}
                          >
                            <Eye className="w-3.5 h-3.5" />
                          </Button>
                          <PermissionGate anyPermission={[["maintenance", "delete"], ["housekeeping", "delete"]]}>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7"
                              onClick={() => setDeleteId(req.id)}
                            >
                              <Trash className="w-3.5 h-3.5 text-red-500" />
                            </Button>
                          </PermissionGate>
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}
                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={visible.size}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-muted/50 rounded-full flex items-center justify-center mb-2">
                          <Wrench className="w-8 h-8 text-muted-foreground/50" />
                        </div>
                        <p className="text-lg font-semibold text-foreground">
                          {ar ? "لم يتم العثور على تذاكر" : "No tickets found"}
                        </p>
                        <p className="text-sm text-muted-foreground max-w-sm text-center">
                          {ar
                            ? "يبدو أنه لا توجد تذاكر تطابق معايير البحث الخاصة بك. جرب تغيير الفلاتر أو أنشئ تذكرة جديدة."
                            : "It looks like there are no tickets matching your search criteria. Try changing the filters or create a new ticket."}
                        </p>
                        <Button
                          variant="outline"
                          className="mt-4"
                          onClick={() => {
                            setSearchTerm("");
                            setCategoryFilter("all");
                            setStatusFilter("all");
                            setPriorityFilter("");
                          }}
                        >
                          {ar ? "مسح الفلاتر" : "Clear Filters"}
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {paginationData.total > 0 && (
              <DataPagination
                total={paginationData.total}
                pageSize={pageSize}
                onPageSizeChange={(size) => {
                  setPageSize(size);
                  setCurrentPage(1);
                }}
                currentPage={currentPage}
                onPageChange={setCurrentPage}
              />
            )}
          </div>
        </div>
      )}

      {/* Photo Lightbox */}
      <Dialog
        open={!!photoDialog}
        onOpenChange={(open) => {
          if (!open) setPhotoDialog(null);
        }}
      >
        <DialogContent
          className="max-w-2xl max-h-screen overflow-y-auto p-2"
          srTitle={ar ? "عرض الصورة" : "View Photo"}
        >
          {photoDialog && (
            <img
              src={photoDialog}
              alt=""
              className="w-full h-auto max-h-[80vh] object-contain rounded-lg"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {ar ? "حذف الطلب؟" : "Delete Request?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "لا يمكن التراجع عن هذا الإجراء."
                : "This action cannot be undone."}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ar ? "إلغاء" : "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() =>
                deleteId && deleteMutation.mutate({ id: deleteId })
              }
            >
              {ar ? "حذف" : "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ticket Detail Modal */}
      <TicketDetailModal
        open={selectedTicketId !== null}
        onClose={() => setSelectedTicketId(null)}
        ticket={allTickets?.find((t) => t.id === selectedTicketId)}
        profiles={empOptions}
        ar={ar}
        onStatusChange={(id, data) => {
          const targetTicket = allTickets?.find((t) => t.id === id);
          const pId = targetTicket?.propertyId || (activePropertyId !== "all" ? activePropertyId : undefined);
          updateMutation.mutate({
            id,
            data: {
              ...data,
              propertyId: pId,
            },
          });
        }}
        onAssignChange={(id, empId) => {
          const targetTicket = allTickets?.find((t) => t.id === id);
          const pId = targetTicket?.propertyId || (activePropertyId !== "all" ? activePropertyId : undefined);
          updateMutation.mutate({
            id,
            data: {
              assignedTo: empId,
              propertyId: pId,
            },
          });
        }}
        subTickets={subTickets}
        loadingSubTickets={loadingSubTickets}
        onCreateSubTicket={(parentId, data) => {
          const parentTicket = allTickets?.find((t) => t.id === parentId);
          const pId = parentTicket?.propertyId || (activePropertyId !== "all" ? activePropertyId : properties[0]?.id);
          createMutation.mutate({
            data: {
              propertyId: pId,
              roomId: parentTicket?.roomId,
              category: "maintenance",
              problemType: data.problemType,
              description: data.description,
              priority: data.priority,
              parentId,
            },
          });
          fetchSubTickets(parentId);
        }}
      />
    </div>
  );
}
