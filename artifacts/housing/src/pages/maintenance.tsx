// @ts-nocheck
import { useState, useMemo, useRef, useEffect } from "react";
import {
  useListMaintenance,
  useCreateMaintenance,
  useUpdateMaintenance,
  useDeleteMaintenance,
  useListRooms,
  useListEmployees,
  useListAssignments,
  getListMaintenanceQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
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
  HVAC: "تكيي�?",
  Furniture: "أثاث",
  Cleaning: "نظا�?ة",
  Internet: "إنترنت",
  Other: "أخرى",
};
const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PRIORITY_AR = {
  LOW: "منخ�?ضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
};
const STATUS_AR = {
  open: "م�?توحة",
  in_progress: "قيد التن�?يذ",
  resolved: "محلولة",
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
  const queryClient = useQueryClient();
  const LIMIT = 25;
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  const [deleteId, setDeleteId] = useState(null);
  const [categoryFilter, setCategoryFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const [photoDialog, setPhotoDialog] = useState<string | null>(null);
  const [filterBarFilters, setFilterBarFilters] = useState<Record<string, any>>(
    {},
  );
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [subTickets, setSubTickets] = useState<any[]>([]);
  const [loadingSubTickets, setLoadingSubTickets] = useState(false);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  useEffect(() => {
    setPage(1);
  }, [searchTerm, statusFilter, priorityFilter]);
  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [creatorTypeFilter, setCreatorTypeFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState({
    roomId: "",
    category: "maintenance",
    problemType: "",
    description: "",
    priority: "MEDIUM",
    notes: "",
  });

  const {
    data: allTicketsWrapper,
    isLoading,
    isFetching,
  } = useListMaintenance(
    { propertyId: activePropertyId ?? undefined, page, limit: LIMIT },
    {
      query: {
        queryKey: getListMaintenanceQueryKey({
          propertyId: activePropertyId ?? undefined,
          page,
          limit: LIMIT,
        }),
        enabled: !!activePropertyId,
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

  const { data: _roomsWrapper } = useListRooms(
    { propertyId: activePropertyId, limit: 1000 },
    { query: { enabled: !!activePropertyId } },
  );
  const rooms = _roomsWrapper?.data || [];
  const { data: _eDataWrapper } = useListEmployees(
    { propertyId: activePropertyId ?? undefined, limit: 1000 },
    { query: { enabled: !!activePropertyId } },
  );
  const employees = _eDataWrapper?.employees || _eDataWrapper?.data || [];
  const { data: assignments } = useListAssignments(
    { propertyId: activePropertyId } as any,
    { query: { enabled: !!activePropertyId } },
  );

  // Build room → occupant name(s) map from active assignments + employees
  const roomOccupantMap = useMemo(() => {
    const empLookup = Object.fromEntries(
      employees.map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
    );
    const map: Record<number, string> = {};
    (assignments || []).forEach((a: any) => {
      if (a.status === "ACTIVE" && a.roomId) {
        const name = empLookup[a.employeeId];
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
  }, [assignments, employees]);

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
      const data = await res.json();
      setSubTickets(data || []);
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
      category: "maintenance",
      problemType: "",
      description: "",
      priority: "MEDIUM",
      notes: "",
    });
    setFormPhotoUrl("");
  };

  const onSubmit = () => {
    if (!form.roomId || !form.description) {
      toast.error(
        ar ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields",
      );
      return;
    }
    createMutation.mutate({
      data: {
        propertyId: activePropertyId,
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
    { key: "room", label: "Room", labelAr: "الغر�?ة", defaultVisible: true },
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
      labelAr: "ح�?لت",
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
    employees
      .filter((e) => e.status === "active")
      .map((e) => [e.id, `${e.firstName} ${e.lastName}`]),
  );
  const empOptions = employees.filter((e) => e.status === "active");

  const filtered = useMemo(() => {
    let items = allTickets ?? [];
    if (categoryFilter !== "all") {
      items = items.filter((t) => t.category === categoryFilter);
    }
    if (statusFilter !== "all") {
      items = items.filter(
        (t) => (t.status || "").toLowerCase() === statusFilter,
      );
    }
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      items = items.filter(
        (t) =>
          (t.problemType ?? "").toLowerCase().includes(q) ||
          (roomMap[t.roomId] ?? "").toLowerCase().includes(q) ||
          (t.description ?? "").toLowerCase().includes(q),
      );
    }
    if (fromDate) {
      const from = new Date(fromDate);
      from.setHours(0, 0, 0, 0);
      items = items.filter((t) => new Date(t.reportedAt) >= from);
    }
    if (toDate) {
      const to = new Date(toDate);
      to.setHours(23, 59, 59, 999);
      items = items.filter((t) => new Date(t.reportedAt) <= to);
    }
    if (priorityFilter) {
      items = items.filter(
        (t) =>
          (t.priority || "").toLowerCase() === priorityFilter.toLowerCase(),
      );
    }
    if (departmentFilter.length > 0) {
      items = items.filter((t) =>
        departmentFilter.includes(t.department || ""),
      );
    }
    if (creatorTypeFilter) {
      if (creatorTypeFilter === "staff") {
        items = items.filter((t) => t.createdByStaff === true);
      } else if (creatorTypeFilter === "guest") {
        items = items.filter((t) => t.createdByStaff === false);
      }
    }
    if (propertyFilter) {
      items = items.filter((t) => String(t.propertyId) === propertyFilter);
    }
    const statusOrder = { open: 0, in_progress: 1, resolved: 2, closed: 3 };
    items.sort((a, b) => {
      const aOrder = statusOrder[(a.status || "").toLowerCase()] ?? 99;
      const bOrder = statusOrder[(b.status || "").toLowerCase()] ?? 99;
      if (aOrder !== bOrder) return aOrder - bOrder;
      return (
        new Date(b.reportedAt).getTime() - new Date(a.reportedAt).getTime()
      );
    });
    return items;
  }, [
    allTickets,
    categoryFilter,
    statusFilter,
    searchTerm,
    roomMap,
    fromDate,
    toDate,
    priorityFilter,
    departmentFilter,
    creatorTypeFilter,
    propertyFilter,
  ]);

  const exportExcel = () => {
    const rows = filtered.map((req) => ({
      [ar ? "رقم" : "ID"]: req.id,
      [ar ? "الغرفة" : "Room"]:
        `${ar ? "الغرفة" : "Room"} ${roomMap[req.roomId] ?? req.roomId}`,
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
      [ar ? "تاريخ الإبلاغ" : "Reported (Date)"]: req.reportedAt
        ? format(new Date(req.reportedAt), "yyyy-MM-dd")
        : "",
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
    XLSX.writeFile(wb, `tickets_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6 pb-4">
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
          {ar ? "التذاكر" : "Tickets Management"}
        </h1>
        <p className="text-sm text-muted-foreground mt-1">
          {ar
            ? "تصفية وإدارة جميع طلبات الصيانة والنظافة والخدمات"
            : "Filter and manage all maintenance, housekeeping, and service requests"}
        </p>
      </div>

      {/* FilterBar */}
      <div className="px-4 sm:px-6 pb-4">
        <MaintenanceFilterBar
          ar={ar}
          properties={properties || []}
          departments={["Front Office", "Engineering", "House Keeping"]}
          employees={employees}
          onCreateNew={() => setIsOpen(true)}
          onFiltersChange={(filters) => {
            setFilterBarFilters(filters);
            setFromDate(filters.fromDate ?? "");
            setToDate(filters.toDate ?? "");
            setStatusFilter(filters.status || "all");
            setCategoryFilter(filters.type || "all");
            setPriorityFilter(filters.priority ?? "");
            setDepartmentFilter(filters.departments ?? []);
            setCreatorTypeFilter(filters.creatorType ?? "");
            setPropertyFilter(filters.propertyId ?? "");
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
            <div className="space-y-1.5">
              <Label>
                {ar ? "النوع" : "Type"} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.category}
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
                  {CATEGORIES.map((c) => (
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
                  {rooms?.map((r) => (
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
        <div className="px-4 sm:px-6 pb-6">
          <div className="border rounded-lg bg-card overflow-hidden">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/30">
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
                {filtered.map((req) => (
                  <TableRow key={req.id} className="hover:bg-muted/20">
                    {isVisible("id") && (
                      <TableCell className="font-mono text-sm font-semibold text-muted-foreground">
                        #{req.id}
                      </TableCell>
                    )}
                    {isVisible("room") && (
                      <TableCell className="font-medium whitespace-nowrap">
                        {ar ? "الغرفة" : "Room"}{" "}
                        {roomMap[req.roomId] ?? req.roomId}
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
                            {format(new Date(req.reportedAt), "MMM d, yyyy")}
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
                              {format(new Date(req.startedAt), "MMM d, yyyy")}
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
                              {format(new Date(req.resolvedAt), "MMM d, yyyy")}
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
                          <PermissionGate module="maintenance" action="delete">
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
                      className="py-12 text-center"
                    >
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Wrench className="w-8 h-8 opacity-30" />
                        <p className="font-medium">
                          {ar ? "لا توجد طلبات" : "No tickets found"}
                        </p>
                        <p className="text-sm">
                          {ar
                            ? 'اضغط "طلب جديد" للإبلاغ'
                            : 'Click "New Request" to report'}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                )}
              </TableBody>
            </Table>
            {allTicketsWrapper?.pagination && (
              <PaginationBar
                pagination={allTicketsWrapper.pagination}
                isFetching={isFetching}
                onPageChange={setPage}
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
        employees={empOptions}
        ar={ar}
        onStatusChange={(id, data) => {
          updateMutation.mutate({ id, data });
        }}
        onAssignChange={(id, empId) => {
          updateMutation.mutate({ id, data: { assignedTo: empId } });
        }}
        subTickets={subTickets}
        loadingSubTickets={loadingSubTickets}
        onCreateSubTicket={(parentId, data) => {
          createMutation.mutate({
            data: {
              propertyId: activePropertyId,
              roomId: allTickets?.find((t) => t.id === parentId)?.roomId,
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
