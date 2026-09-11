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
import { useAuth } from "@/context/AuthContext";
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
  Layers,
  Clock,
  AlertCircle,
  ShieldCheck,
  User,
  CheckCircle,
  List,
  LayoutGrid,
  ChevronDown,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
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
import { TicketsKanbanBoard } from "./maintenance/components/TicketsKanbanBoard";

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

const MAINTENANCE_PROBLEM_TYPES = [
  { key: "Plumbing", labelEn: "Plumbing", labelAr: "سباكة" },
  { key: "Electrical", labelEn: "Electrical", labelAr: "كهرباء" },
  { key: "HVAC", labelEn: "HVAC & AC", labelAr: "تكييف وتبريد" },
  { key: "Furniture", labelEn: "Furniture & Woodwork", labelAr: "أثاث ونجارة" },
  { key: "Internet", labelEn: "Internet & Network", labelAr: "إنترنت وشبكات" },
  { key: "Appliances", labelEn: "Appliances", labelAr: "أجهزة كهربائية" },
  { key: "Other", labelEn: "Other Maintenance", labelAr: "أعطال أخرى" },
];

const HOUSEKEEPING_ORDER_TYPES = [
  { key: "room_cleaning", labelEn: "Room Cleaning", labelAr: "تنظيف الغرفة" },
  { key: "bed_sheets", labelEn: "Bed Linen Change", labelAr: "تغيير المفارش والأسرة" },
  { key: "towels", labelEn: "Towels & Amenities", labelAr: "توفر مناشف ومستلزمات" },
  { key: "deep_cleaning", labelEn: "Deep Cleaning", labelAr: "تنظيف شامل وعميق" },
  { key: "waste_removal", labelEn: "Trash Removal", labelAr: "تفريغ المهملات" },
  { key: "sanitization", labelEn: "Sanitization & Disinfection", labelAr: "تعقيم وتطهير" },
  { key: "turnover", labelEn: "Turnover Preparation", labelAr: "تجهيز لنزيل جديد" },
  { key: "other", labelEn: "Special / Other Request", labelAr: "طلب نظافة آخر" },
];

const GENERAL_PROBLEM_TYPES = [
  { key: "general_inquiry", labelEn: "General Inquiry", labelAr: "استفسار عام" },
  { key: "inspection", labelEn: "Room Inspection", labelAr: "فحص ومعاينة" },
  { key: "pest_control", labelEn: "Pest Control", labelAr: "مكافحة حشرات" },
  { key: "other", labelEn: "Other", labelAr: "أخرى" },
];

const PROBLEM_TYPES_MAP: Record<string, { labelEn: string; labelAr: string }> = {
  Plumbing: { labelEn: "Plumbing", labelAr: "سباكة" },
  Electrical: { labelEn: "Electrical", labelAr: "كهرباء" },
  HVAC: { labelEn: "HVAC & AC", labelAr: "تكييف وتبريد" },
  Furniture: { labelEn: "Furniture & Woodwork", labelAr: "أثاث ونجارة" },
  Internet: { labelEn: "Internet & Network", labelAr: "إنترنت وشبكات" },
  Appliances: { labelEn: "Appliances", labelAr: "أجهزة كهربائية" },
  Cleaning: { labelEn: "Cleaning", labelAr: "نظافة" },
  Other: { labelEn: "Other", labelAr: "أعطال أخرى" },
  room_cleaning: { labelEn: "Room Cleaning", labelAr: "تنظيف الغرفة" },
  bed_sheets: { labelEn: "Bed Linen Change", labelAr: "تغيير المفارش والأسرة" },
  towels: { labelEn: "Towels & Amenities", labelAr: "مناشف ومستلزمات" },
  deep_cleaning: { labelEn: "Deep Cleaning", labelAr: "تنظيف شامل وعميق" },
  waste_removal: { labelEn: "Trash Removal", labelAr: "تفريغ المهملات" },
  sanitization: { labelEn: "Sanitization & Disinfection", labelAr: "تعقيم وتطهير" },
  turnover: { labelEn: "Turnover Preparation", labelAr: "تجهيز لنزيل جديد" },
  general_inquiry: { labelEn: "General Inquiry", labelAr: "استفسار عام" },
  inspection: { labelEn: "Room Inspection", labelAr: "فحص ومعاينة" },
  pest_control: { labelEn: "Pest Control", labelAr: "مكافحة حشرات" },
  other: { labelEn: "Other", labelAr: "طلب آخر" },
};

const PRIORITIES = ["LOW", "MEDIUM", "HIGH", "URGENT"];
const PRIORITY_AR: Record<string, string> = {
  LOW: "منخفضة",
  MEDIUM: "متوسطة",
  HIGH: "عالية",
  URGENT: "عاجلة",
};
const STATUS_AR: Record<string, string> = {
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
  if (totalMins >= 60) {
    const hours = Math.floor(totalMins / 60);
    const mins = totalMins % 60;
    return `${hours}h ${mins}m`;
  }
  return `${totalMins} min`;
}

function getDurationColor(
  startedAt: any,
  resolvedAt: any,
  reportedAt: any,
): string {
  const totalMins = getDurationMins(startedAt, resolvedAt, reportedAt);
  if (totalMins < 0) return "text-muted-foreground";
  if (totalMins <= 30) return "text-emerald-600 dark:text-emerald-400";
  if (totalMins <= 120) return "text-amber-500 dark:text-amber-400";
  return "text-red-500 dark:text-red-400 font-bold";
}

export default function Tickets() {
  const { user } = useAuth();
  const { activePropertyId, properties } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const { can, canView, isSuperAdmin, isAdmin } = usePermission();

  const canViewMnt = isSuperAdmin || isAdmin || can("maintenance", "view");
  const canEditMnt = isSuperAdmin || isAdmin || can("maintenance", "edit");
  const canCreateMnt = isSuperAdmin || isAdmin || can("maintenance", "create");
  const canDeleteMnt = isSuperAdmin || isAdmin || can("maintenance", "delete");
  const canAssignMnt = isSuperAdmin || isAdmin || can("maintenance", "assign");

  const canViewHsk = isSuperAdmin || isAdmin || can("housekeeping", "view");
  const canEditHsk = isSuperAdmin || isAdmin || can("housekeeping", "edit");
  const canCreateHsk = isSuperAdmin || isAdmin || can("housekeeping", "create");
  const canDeleteHsk = isSuperAdmin || isAdmin || can("housekeeping", "delete");
  const canAssignHsk = isSuperAdmin || isAdmin || can("housekeeping", "assign");

  const hasMaintenance = canViewMnt;
  const hasHousekeeping = canViewHsk;

  const isOnlyHousekeeping = !hasMaintenance && hasHousekeeping;
  const isOnlyMaintenance = hasMaintenance && !hasHousekeeping;
  const hasBoth = hasMaintenance && hasHousekeeping;
  const hasManagerialScope = isSuperAdmin || isAdmin || canAssignMnt || canAssignHsk;

  const [scopeFilter, setScopeFilter] = useState<"all" | "me" | "unassigned">(() => {
    return hasManagerialScope ? "all" : "me";
  });

  const canCreateAny = isSuperAdmin || isAdmin || (isOnlyHousekeeping ? canCreateHsk : isOnlyMaintenance ? canCreateMnt : (canCreateMnt || canCreateHsk));
  const canEditAny = isSuperAdmin || isAdmin || (isOnlyHousekeeping ? canEditHsk : isOnlyMaintenance ? canEditMnt : (canEditMnt || canEditHsk));
  const canDeleteAny = isSuperAdmin || isAdmin || (isOnlyHousekeeping ? canDeleteHsk : isOnlyMaintenance ? canDeleteMnt : (canDeleteMnt || canDeleteHsk));

  const defaultCreateCategory = isOnlyHousekeeping || (!canCreateMnt && canCreateHsk) ? "housekeeping" : "maintenance";

  const allowedCreateCategories = isSuperAdmin || isAdmin
    ? CATEGORIES
    : [
        ...(canCreateMnt ? ["maintenance"] : []),
        ...(canCreateHsk ? ["housekeeping"] : []),
        ...(canCreateMnt || canCreateHsk ? ["general"] : []),
      ];

  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  // View Mode: List vs Kanban
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    try {
      return (localStorage.getItem("tickets_view_mode") as "list" | "kanban") || "list";
    } catch {
      return "list";
    }
  });

  const handleSetViewMode = (mode: "list" | "kanban") => {
    setViewMode(mode);
    try {
      localStorage.setItem("tickets_view_mode", mode);
    } catch {}
  };

  const [deleteId, setDeleteId] = useState<number | null>(null);
  const [categoryFilter, setCategoryFilter] = useState<string>(() =>
    isOnlyHousekeeping ? "housekeeping" : isOnlyMaintenance ? "maintenance" : "all"
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);
  const [photoDialog, setPhotoDialog] = useState<string | null>(null);
  const [filterBarFilters, setFilterBarFilters] = useState<Record<string, any>>({});
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

  // Sync category filter with role boundaries
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
  }, [debouncedSearch, statusFilter, priorityFilter, categoryFilter, scopeFilter, propertyFilter, fromDate, toDate]);

  // Form state
  const [formPropertyId, setFormPropertyId] = useState<string>(() => {
    if (activePropertyId && activePropertyId !== "all") return String(activePropertyId);
    if (properties && properties.length > 0) return String(properties[0].id);
    return "";
  });

  const [form, setForm] = useState({
    roomId: "",
    category: defaultCreateCategory,
    problemType: defaultCreateCategory === "housekeeping" ? "room_cleaning" : "Plumbing",
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

  // Pre-load profiles for employee mapping and current user match
  const { data: _eDataWrapper } = useListProfiles(
    { propertyId: activePropertyId && activePropertyId !== "all" ? activePropertyId : undefined, limit: 1000 } as any,
    { query: { enabled: !!activePropertyId && activePropertyId !== "all" } },
  );
  const profiles = _eDataWrapper?.profiles || _eDataWrapper?.data || [];

  const currentUserProfile = useMemo(() => {
    if (!user || !profiles || profiles.length === 0) return null;
    const uname = String(user.username || "").toLowerCase().trim();
    const uemail = String(user.email || "").toLowerCase().trim();
    return profiles.find((p: any) => {
      if (p.profileId && String(p.profileId).toLowerCase().trim() === uname) return true;
      if (uemail && p.email && String(p.email).toLowerCase().trim() === uemail) return true;
      const fullName = `${p.firstName || ""} ${p.lastName || ""}`.toLowerCase().trim();
      if (fullName && fullName === uname) return true;
      return false;
    });
  }, [user, profiles]);

  const effectiveAssignedTo =
    scopeFilter === "me"
      ? (currentUserProfile?.id ? String(currentUserProfile.id) : "me")
      : scopeFilter === "unassigned"
        ? "unassigned"
        : undefined;

  const {
    data: allTicketsWrapper,
    isLoading,
  } = useListMaintenance(
    { 
      propertyId: effectivePropertyId, 
      page: currentPage, 
      limit: viewMode === "kanban" ? 200 : pageSize,
      search: debouncedSearch || undefined,
      status: statusFilter === "all" ? undefined : statusFilter,
      priority: priorityFilter || undefined,
      category: categoryFilter === "all" ? undefined : categoryFilter,
      assignedTo: effectiveAssignedTo,
      assignedToProfileId: currentUserProfile?.id,
      fromDate: fromDate || undefined,
      toDate: toDate || undefined,
    } as any,
    {
      query: {
        queryKey: getListMaintenanceQueryKey({
          propertyId: effectivePropertyId,
          page: currentPage,
          limit: viewMode === "kanban" ? 200 : pageSize,
          search: debouncedSearch || undefined,
          status: statusFilter === "all" ? undefined : statusFilter,
          priority: priorityFilter || undefined,
          category: categoryFilter === "all" ? undefined : categoryFilter,
          assignedTo: effectiveAssignedTo,
          assignedToProfileId: currentUserProfile?.id,
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

  const myTicketsCount = useMemo(() => {
    if (!currentUserProfile || !allTickets || !Array.isArray(allTickets)) return 0;
    return allTickets.filter(
      (t: any) =>
        t.assignedTo === currentUserProfile.id &&
        t.status !== "closed" &&
        t.status !== "resolved",
    ).length;
  }, [allTickets, currentUserProfile]);

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

  const { data: assignments } = useListAssignments(
    { propertyId: activePropertyId && activePropertyId !== "all" ? activePropertyId : undefined } as any,
    { query: { enabled: !!activePropertyId && activePropertyId !== "all" } },
  );

  // Build room -> occupant name(s) map from active assignments + profiles
  const roomOccupantMap = useMemo(() => {
    const empLookup = Object.fromEntries(
      profiles.map((e: any) => [e.id, `${e.firstName} ${e.lastName}`]),
    );
    const map: Record<number, string> = {};
    (assignments || []).forEach((a: any) => {
      if (a.status === "ACTIVE" && a.roomId) {
        const name = empLookup[a.profileId];
        if (name) {
          if (map[a.roomId]) {
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

  const handlePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error(ar ? "حجم الصورة كبير جداً (أقصى حد 5 ميجابايت)" : "Image too large (max 5MB)");
      return;
    }
    const reader = new FileReader();
    reader.onloadend = () => {
      setFormPhotoUrl(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey;
        return Array.isArray(k) && (
          k[0] === "/api/maintenance" ||
          (typeof k[0] === "string" && k[0].includes("maintenance"))
        );
      },
    });
  };

  const fetchSubTickets = async (parentId: number) => {
    setLoadingSubTickets(true);
    try {
      const pId = activePropertyId !== "all" ? activePropertyId : undefined;
      const url = pId
        ? `/api/maintenance?parentId=${parentId}&propertyId=${pId}`
        : `/api/maintenance?parentId=${parentId}`;
      const res = await fetch(url);
      const data = await res.json();
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data) ? data : [];
      setSubTickets(list);
    } catch {
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
        toast.success(ar ? "تم إنشاء الطلب بنجاح" : "Ticket created successfully");
        setIsOpen(false);
        resetForm();
      },
      onError: (e: any) =>
        toast.error(ar ? "خطأ" : "Error", {
          description: e.message,
        }),
    },
  });

  const updateMutation = useUpdateMaintenance({
    mutation: {
      onSuccess: () => {
        invalidate();
        toast.success(ar ? "تم تحديث الحالة بنجاح" : "Status updated successfully");
      },
      onError: (e: any) =>
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
      category: defaultCreateCategory,
      problemType: defaultCreateCategory === "housekeeping" ? "room_cleaning" : "Plumbing",
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
    if (!form.roomId || !form.description.trim()) {
      toast.error(
        ar ? "يرجى تحديد الغرفة وكتابة وصف للطلب" : "Please select a room and provide a description",
      );
      return;
    }
    createMutation.mutate({
      data: {
        propertyId: targetPropId,
        roomId: parseInt(form.roomId),
        category: form.category,
        problemType: form.problemType || (form.category === "housekeeping" ? "room_cleaning" : "Plumbing"),
        description: form.description.trim(),
        priority: form.priority,
        photoUrl: formPhotoUrl || undefined,
      },
    });
  };

  const priorityColor = (p: string) => {
    switch ((p || "").toLowerCase()) {
      case "urgent":
        return "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300 border-red-200 dark:border-red-800";
      case "high":
        return "bg-orange-100 text-orange-800 dark:bg-orange-950/50 dark:text-orange-300 border-orange-200 dark:border-orange-800";
      case "medium":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-950/50 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800";
      case "low":
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-700";
    }
  };

  const statusColor = (s: string) => {
    switch ((s || "").toLowerCase()) {
      case "open":
        return "bg-blue-100 text-blue-800 dark:bg-blue-950/50 dark:text-blue-300 border-blue-200 dark:border-blue-800";
      case "in_progress":
        return "bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "resolved":
        return "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800";
      case "closed":
        return "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400 border-slate-200 dark:border-slate-700";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const categoryColor = (c: string) => {
    switch (c) {
      case "maintenance":
        return "bg-amber-50 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800";
      case "housekeeping":
        return "bg-sky-50 text-sky-800 dark:bg-sky-950/40 dark:text-sky-300 border-sky-200 dark:border-sky-800";
      case "general":
        return "bg-purple-50 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800";
      default:
        return "bg-slate-100 text-slate-600";
    }
  };

  const COLS = [
    { key: "id", label: "ID", labelAr: "رقم", defaultVisible: true },
    { key: "room", label: "Room", labelAr: "الغرفة", defaultVisible: true },
    { key: "problemType", label: "Problem", labelAr: "المشكلة / الخدمة", defaultVisible: true },
    { key: "name", label: "Occupant", labelAr: "النزيل", defaultVisible: true },
    { key: "category", label: "Type", labelAr: "القسم", defaultVisible: true },
    { key: "priority", label: "Priority", labelAr: "الأولوية", defaultVisible: true },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    { key: "reported", label: "Reported", labelAr: "تاريخ الإبلاغ", defaultVisible: true },
    { key: "duration", label: "Duration", labelAr: "المدة", defaultVisible: true },
    { key: "actions", label: "Actions", labelAr: "إجراءات", defaultVisible: true, fixed: true },
  ];

  const { visible, toggle, showAll, hideAll, isVisible } = useColumnVisibility(COLS);

  const roomMap = Object.fromEntries(
    (rooms || []).map((r: any) => [r.id, r.roomNumber]),
  );

  const empOptions = profiles.filter((e: any) => e.status === "active");

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

  // Counts
  const totalCount = paginationData.total || 0;
  const openCount = allTickets?.filter((t: any) => t.status === "open").length || 0;
  const inProgressCount = allTickets?.filter((t: any) => t.status === "in_progress").length || 0;
  const resolvedCount = allTickets?.filter((t: any) => t.status === "resolved").length || 0;
  const closedCount = allTickets?.filter((t: any) => t.status === "closed").length || 0;

  const maintenanceCount = useMemo(() => allTickets?.filter((t: any) => t.category === "maintenance").length || 0, [allTickets]);
  const housekeepingCount = useMemo(() => allTickets?.filter((t: any) => t.category === "housekeeping").length || 0, [allTickets]);
  const generalCount = useMemo(() => allTickets?.filter((t: any) => t.category === "general").length || 0, [allTickets]);

  const exportExcel = () => {
    const rows = filtered.map((req: any) => ({
      [ar ? "رقم الطلب" : "ID"]: req.id,
      [ar ? "الفندق / العقار" : "Hotel / Property"]:
        req.propertyName ||
        properties?.find((p: any) => p.id === req.propertyId)?.name ||
        "—",
      [ar ? "الغرفة" : "Room"]:
        `${ar ? "الغرفة" : "Room"} ${req.roomNumber || (roomMap[req.roomId] ?? req.roomId)}`,
      [ar ? "النزيل المقيم" : "Occupant"]: roomOccupantMap[req.roomId] || "—",
      [ar ? "القسم / النوع" : "Type"]: ar
        ? (CATEGORIES_AR[req.category] ?? req.category)
        : req.category,
      [ar ? "نوع المشكلة / الخدمة" : "Problem / Service"]: ar
        ? (PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType)
        : (PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType),
      [ar ? "الوصف" : "Description"]: req.description,
      [ar ? "الأولوية" : "Priority"]: ar
        ? (PRIORITY_AR[req.priority?.toUpperCase()] ?? req.priority)
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
    XLSX.utils.book_append_sheet(wb, ws, ar ? "التذاكر" : "Tickets");
    XLSX.writeFile(wb, getExportFileName("Tickets_Hub", "xlsx"));
  };

  const exportSelectedTicketsExcel = () => {
    const target =
      selectedTicketIds.size > 0
        ? allTickets.filter((t: any) => selectedTicketIds.has(t.id))
        : allTickets;
    if (target.length === 0) return;
    const rows = target.map((req: any) => ({
      [ar ? "رقم الطلب" : "Ticket #"]: req.id,
      [ar ? "الفندق / العقار" : "Hotel / Property"]:
        req.propertyName ||
        properties?.find((p: any) => p.id === req.propertyId)?.name ||
        "—",
      [ar ? "الغرفة" : "Room"]: req.roomNumber || (roomMap[req.roomId] ?? req.roomId),
      [ar ? "النوع" : "Category"]: ar
        ? (CATEGORIES_AR[req.category] ?? req.category)
        : req.category,
      [ar ? "المشكلة" : "Problem Type"]: ar
        ? (PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType)
        : (PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType),
      [ar ? "الوصف" : "Description"]: req.description,
      [ar ? "الأولوية" : "Priority"]: ar
        ? (PRIORITY_AR[req.priority?.toUpperCase()] ?? req.priority)
        : req.priority,
      [ar ? "الحالة" : "Status"]: ar
        ? (STATUS_AR[req.status?.toLowerCase()] ?? req.status)
        : req.status,
      [ar ? "تاريخ الإبلاغ" : "Reported"]: formatDate(req.reportedAt, ""),
      [ar ? "المدة" : "Duration"]: formatDuration(
        req.startedAt,
        req.resolvedAt,
        req.reportedAt,
      ),
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, ar ? "التذاكر المحددة" : "Selected Tickets");
    XLSX.writeFile(wb, getExportFileName("Selected_Tickets", "xlsx"));
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

  return (
    <div className="min-h-screen bg-background space-y-5">
      {/* Header */}
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className={`p-2.5 rounded-xl shadow-xs ${
              isOnlyHousekeeping
                ? "bg-sky-100 text-sky-600 dark:bg-sky-950 dark:text-sky-400"
                : isOnlyMaintenance
                  ? "bg-amber-100 text-amber-600 dark:bg-amber-950 dark:text-amber-400"
                  : "bg-primary/10 text-primary"
            }`}>
              {isOnlyHousekeeping ? (
                <Sparkles className="w-6 h-6" />
              ) : isOnlyMaintenance ? (
                <Wrench className="w-6 h-6" />
              ) : (
                <Layers className="w-6 h-6" />
              )}
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-foreground">
                {isOnlyHousekeeping ? (
                  ar ? "طلبات وأوامر الهاوس كيبنج" : "Housekeeping Orders Hub"
                ) : isOnlyMaintenance ? (
                  ar ? "بلاغات وأوامر الصيانة الفنية" : "Maintenance Work Orders"
                ) : (
                  ar ? "مركز التذاكر والعمليات الموحد" : "Operations & Tickets Hub"
                )}
              </h1>
              <p className="text-sm text-muted-foreground mt-0.5">
                {isOnlyHousekeeping
                  ? (ar ? "متابعة وتنفيذ جميع طلبات تنظيف الغرف وتغيير المفارش والتعقيم" : "Track and manage room cleaning, linen changes, and housekeeping requests")
                  : isOnlyMaintenance
                    ? (ar ? "متابعة وإصلاح أعطال الغرف والمرافق والسباكة والكهرباء والتكييف" : "Track and resolve room repairs, HVAC, electrical, and plumbing issues")
                    : (ar ? "المنصة المركزية لإدارة وتتبع كافة تذاكر الصيانة والهاوس كيبنج والخدمات" : "Unified central hub for tracking maintenance, housekeeping, and facility tickets")}
              </p>
            </div>
          </div>

          {/* Top Quick Segmented Tabs for Category & Scope (Linear / Plane style) */}
          <div className="flex flex-wrap items-center gap-2.5 self-start md:self-auto max-w-full">
            {/* 1. Category Switcher */}
            {hasBoth && (
              <div className="flex items-center gap-1 p-1 bg-muted/80 dark:bg-muted/40 border rounded-xl shadow-xs overflow-x-auto">
                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    categoryFilter === "all"
                      ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{ar ? "كل الأقسام" : "All Categories"}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    categoryFilter === "all"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}>
                    {totalCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("maintenance");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    categoryFilter === "maintenance"
                      ? "bg-amber-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <Wrench className="w-3.5 h-3.5" />
                  <span>{ar ? "الصيانة" : "Maintenance"}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    categoryFilter === "maintenance"
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}>
                    {maintenanceCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("housekeeping");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    categoryFilter === "housekeeping"
                      ? "bg-sky-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <Sparkles className="w-3.5 h-3.5" />
                  <span>{ar ? "الهاوس كيبنج" : "Housekeeping"}</span>
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    categoryFilter === "housekeeping"
                      ? "bg-white/20 text-white"
                      : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                  }`}>
                    {housekeepingCount}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => {
                    setCategoryFilter("general");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    categoryFilter === "general"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <FileText className="w-3.5 h-3.5" />
                  <span>{ar ? "عام" : "General"}</span>
                  {generalCount > 0 && (
                    <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      categoryFilter === "general"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                    }`}>
                      {generalCount}
                    </span>
                  )}
                </button>
              </div>
            )}

            {/* 2. User Scoping Filter (Linear / Plane style: All Orders / Assigned to Me / Unassigned) */}
            <div className="flex items-center gap-1 p-1 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 rounded-xl shadow-xs overflow-x-auto">
              {hasManagerialScope && (
                <button
                  type="button"
                  onClick={() => {
                    setScopeFilter("all");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    scopeFilter === "all"
                      ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                      : "text-indigo-900 dark:text-indigo-300 hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{ar ? "كل الأوردرات" : "All Orders"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => {
                  setScopeFilter("me");
                  setCurrentPage(1);
                }}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  scopeFilter === "me"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-indigo-900 dark:text-indigo-300 hover:text-foreground hover:bg-background/40"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{ar ? "أوردراتي أنا فقط" : "Assigned to Me"}</span>
                {myTicketsCount > 0 && (
                  <span className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    scopeFilter === "me"
                      ? "bg-white/20 text-white"
                      : "bg-indigo-200 text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-200"
                  }`}>
                    {myTicketsCount}
                  </span>
                )}
              </button>

              {hasManagerialScope && (
                <button
                  type="button"
                  onClick={() => {
                    setScopeFilter("unassigned");
                    setCurrentPage(1);
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    scopeFilter === "unassigned"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "text-indigo-900 dark:text-indigo-300 hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{ar ? "غير مسندة" : "Unassigned"}</span>
                </button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Role Awareness Context Banner */}
      <div className="px-4 sm:px-6">
        {hasBoth ? (
          <div className="flex flex-wrap items-center justify-between gap-3 p-3 rounded-xl bg-gradient-to-r from-muted/60 via-muted/40 to-muted/60 border shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <span>{ar ? "وضع الإدارة الشاملة (مركز العمليات الموحد)" : "Unified Operations Hub (Management Mode)"}</span>
                  <Badge variant="outline" className="text-[10px] font-medium py-0 px-1.5 bg-background">
                    {ar ? "كامل الصلاحيات" : "All Access"}
                  </Badge>
                </div>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ar
                    ? "معروض لك كافة بلاغات الصيانة، طلبات الهاوس كيبنج، والخدمات العامة لجميع الفنادق"
                    : "Displaying all maintenance work orders, housekeeping orders, and general requests across hotels"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[11px] text-muted-foreground font-medium hidden sm:inline">
                {ar ? "الأقسام المتاحة:" : "Active Modules:"}
              </span>
              <Badge variant="outline" className="gap-1 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800 text-[10px]">
                <Wrench className="w-3 h-3" />
                {ar ? "صيانة" : "Maintenance"}
              </Badge>
              <Badge variant="outline" className="gap-1 bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border-sky-200 dark:border-sky-800 text-[10px]">
                <Sparkles className="w-3 h-3" />
                {ar ? "هاوس كيبنج" : "Housekeeping"}
              </Badge>
            </div>
          </div>
        ) : isOnlyHousekeeping ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-sky-50 dark:bg-sky-950/30 border border-sky-200 dark:border-sky-800/60 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-sky-100 dark:bg-sky-900/50 text-sky-600 dark:text-sky-300">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-sky-900 dark:text-sky-200 flex items-center gap-1.5">
                  <span>{ar ? "قسم الهاوس كيبنج والنظافة" : "Housekeeping Department Workspace"}</span>
                  <Badge className="text-[10px] font-medium py-0 px-1.5 bg-sky-600 text-white">
                    {ar ? "محدد للهاوس كيبنج" : "Housekeeping View"}
                  </Badge>
                </div>
                <p className="text-[11px] text-sky-700/80 dark:text-sky-300/80 mt-0.5">
                  {ar
                    ? "معروض لك حصرياً طلبات وأوامر تنظيف ونظافة الغرف والكتان والمستلزمات"
                    : "Displaying room cleaning, linen turnover, and amenities orders exclusively"}
                </p>
              </div>
            </div>
          </div>
        ) : isOnlyMaintenance ? (
          <div className="flex items-center justify-between gap-3 p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/60 shadow-xs">
            <div className="flex items-center gap-2.5">
              <div className="p-2 rounded-lg bg-amber-100 dark:bg-amber-900/50 text-amber-600 dark:text-amber-300">
                <Wrench className="w-4 h-4" />
              </div>
              <div>
                <div className="text-xs font-semibold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                  <span>{ar ? "قسم الصيانة والأعطال الفنية" : "Maintenance Department Workspace"}</span>
                  <Badge className="text-[10px] font-medium py-0 px-1.5 bg-amber-600 text-white">
                    {ar ? "محدد للصيانة" : "Maintenance View"}
                  </Badge>
                </div>
                <p className="text-[11px] text-amber-700/80 dark:text-amber-300/80 mt-0.5">
                  {ar
                    ? "معروض لك حصرياً بلاغات وأعطال الصيانة (سباكة، كهرباء، تكييف، أثاث)"
                    : "Displaying plumbing, electrical, HVAC, and repair work orders exclusively"}
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>

      {/* Analytics KPI Cards (Tremor / Shadcn Style) */}
      <div className="px-4 sm:px-6 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
        <div className="bg-card border rounded-xl p-4 shadow-xs flex items-center justify-between">
          <div>
            <span className="text-xs font-medium text-muted-foreground">
              {ar ? "إجمالي التذاكر" : "Total Tickets"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-foreground">
              {totalCount}
            </div>
            <div className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1.5">
              <span>{paged.length} {ar ? "في هذا العرض" : "in this view"}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-muted/80 flex items-center justify-center text-muted-foreground">
            <Layers className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-blue-200/60 dark:border-blue-900/40 rounded-xl p-4 shadow-xs flex items-center justify-between bg-gradient-to-br from-blue-50/40 to-transparent dark:from-blue-950/20">
          <div>
            <span className="text-xs font-medium text-blue-600 dark:text-blue-400">
              {ar ? "مفتوحة وجديدة" : "Open Tickets"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-blue-700 dark:text-blue-300">
              {openCount}
            </div>
            <div className="text-[11px] text-blue-600/80 dark:text-blue-400/80 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500 inline-block" />
              <span>{ar ? "تحتاج اتخاذ إجراء" : "Requires action"}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/50 flex items-center justify-center text-blue-600 dark:text-blue-400">
            <AlertCircle className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-amber-200/60 dark:border-amber-900/40 rounded-xl p-4 shadow-xs flex items-center justify-between bg-gradient-to-br from-amber-50/40 to-transparent dark:from-amber-950/20">
          <div>
            <span className="text-xs font-medium text-amber-600 dark:text-amber-400">
              {ar ? "قيد التنفيذ" : "In Progress"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-amber-700 dark:text-amber-300">
              {inProgressCount}
            </div>
            <div className="text-[11px] text-amber-600/80 dark:text-amber-400/80 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-500 inline-block" />
              <span>{ar ? "العمل جاري عليها" : "Currently active"}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-100 dark:bg-amber-900/50 flex items-center justify-center text-amber-600 dark:text-amber-400">
            <Play className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-card border border-emerald-200/60 dark:border-emerald-900/40 rounded-xl p-4 shadow-xs flex items-center justify-between bg-gradient-to-br from-emerald-50/40 to-transparent dark:from-emerald-950/20">
          <div>
            <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
              {ar ? "مكتملة ومغلقة" : "Resolved / Closed"}
            </span>
            <div className="text-2xl sm:text-3xl font-bold tracking-tight mt-1 text-emerald-700 dark:text-emerald-300">
              {resolvedCount + closedCount}
            </div>
            <div className="text-[11px] text-emerald-600/80 dark:text-emerald-400/80 mt-1 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 inline-block" />
              <span>{ar ? "تم إنجازها بنجاح" : "Completed successfully"}</span>
            </div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-100 dark:bg-emerald-900/50 flex items-center justify-center text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* FilterBar & Toolbar */}
      <div className="px-4 sm:px-6">
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
          onCreateNew={canCreateAny ? () => setIsOpen(true) : undefined}
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

      {/* View Switcher, Column Chooser & Quick Actions */}
      <div className="px-4 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          {/* Dual View Switcher: List vs Kanban */}
          <div className="flex items-center gap-1 p-1 bg-muted/80 dark:bg-muted/40 rounded-xl border shadow-xs">
            <button
              type="button"
              onClick={() => handleSetViewMode("list")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "list"
                  ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
              title={ar ? "عرض جدول البيانات" : "Table List View"}
            >
              <List className="w-3.5 h-3.5" />
              <span>{ar ? "جدول البيانات" : "Table View"}</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetViewMode("kanban")}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 transition-all ${
                viewMode === "kanban"
                  ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                  : "text-muted-foreground hover:text-foreground hover:bg-background/40"
              }`}
              title={ar ? "لوحة كانبان التفاعلية" : "Interactive Kanban Board"}
            >
              <LayoutGrid className="w-3.5 h-3.5" />
              <span>{ar ? "لوحة كانبان" : "Kanban Board"}</span>
            </button>
          </div>

          <div className="text-xs text-muted-foreground font-medium hidden sm:block">
            {ar ? `عرض ${paged.length} من أصل ${totalCount} تذكرة` : `Showing ${paged.length} of ${totalCount} tickets`}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={exportExcel}
            className="text-xs gap-1.5 h-8 font-medium"
          >
            <FileText className="w-3.5 h-3.5" />
            <span>{ar ? "تصدير Excel" : "Export Excel"}</span>
          </Button>
          {viewMode === "list" && (
            <ColumnChooser
              cols={COLS}
              visible={visible}
              onToggle={toggle}
              onShowAll={showAll}
              onHideAll={hideAll}
              ar={ar}
            />
          )}
        </div>
      </div>

      {/* New Ticket Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          setIsOpen(v);
          if (!v) resetForm();
        }}
      >
        <DialogContent
          className="max-w-md sm:max-w-lg"
          srTitle={ar ? "إنشاء طلب جديد" : "Create New Ticket"}
        >
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Plus className="w-5 h-5 text-primary" />
              {ar ? "إنشاء طلب / تذكرة جديدة" : "Create New Ticket"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            {/* Property Selector */}
            {properties.length > 1 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
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

            {/* Category Selector (if multiple allowed) */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "نوع الطلب والقسم المختص" : "Ticket Category & Department"} <span className="text-red-500">*</span>
              </Label>
              {allowedCreateCategories.length > 1 ? (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        category: "maintenance",
                        problemType: "Plumbing",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.category === "maintenance"
                        ? "bg-amber-500/15 border-amber-500 text-amber-800 dark:text-amber-300 shadow-xs ring-1 ring-amber-500"
                        : "bg-background hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Wrench className="w-4 h-4 text-amber-600" />
                    <span>{ar ? "صيانة فنية" : "Maintenance"}</span>
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({
                        ...f,
                        category: "housekeeping",
                        problemType: "room_cleaning",
                      }))
                    }
                    className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                      form.category === "housekeeping"
                        ? "bg-sky-500/15 border-sky-500 text-sky-800 dark:text-sky-300 shadow-xs ring-1 ring-sky-500"
                        : "bg-background hover:bg-muted/50 text-muted-foreground"
                    }`}
                  >
                    <Sparkles className="w-4 h-4 text-sky-600" />
                    <span>{ar ? "هاوس كيبنج" : "Housekeeping"}</span>
                  </button>
                  {allowedCreateCategories.includes("general") && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm((f) => ({
                          ...f,
                          category: "general",
                          problemType: "general_inquiry",
                        }))
                      }
                      className={`flex items-center justify-center gap-2 p-2.5 rounded-xl border text-xs font-semibold transition-all ${
                        form.category === "general"
                          ? "bg-purple-500/15 border-purple-500 text-purple-800 dark:text-purple-300 shadow-xs ring-1 ring-purple-500"
                          : "bg-background hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      <FileText className="w-4 h-4 text-purple-600" />
                      <span>{ar ? "طلب عام" : "General"}</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-muted/60 border text-xs font-semibold">
                  {form.category === "housekeeping" ? (
                    <>
                      <Sparkles className="w-4 h-4 text-sky-600" />
                      <span>{ar ? "طلب هاوس كيبنج ونظافة" : "Housekeeping Order"}</span>
                    </>
                  ) : (
                    <>
                      <Wrench className="w-4 h-4 text-amber-600" />
                      <span>{ar ? "بلاغ صيانة وعطل فني" : "Maintenance Work Order"}</span>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Dynamic Problem Type based on category */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {form.category === "housekeeping"
                  ? (ar ? "نوع خدمة النظافة" : "Housekeeping Service Type")
                  : form.category === "maintenance"
                    ? (ar ? "نوع المشكلة والعطل" : "Issue / Problem Type")
                    : (ar ? "التصنيف" : "Classification")}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.problemType}
                onValueChange={(v) => setForm((f) => ({ ...f, problemType: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر النوع..." : "Select type..."} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-64 overflow-y-auto">
                  {(form.category === "housekeeping"
                    ? HOUSEKEEPING_ORDER_TYPES
                    : form.category === "maintenance"
                      ? MAINTENANCE_PROBLEM_TYPES
                      : GENERAL_PROBLEM_TYPES
                  ).map((item) => (
                    <SelectItem key={item.key} value={item.key}>
                      {ar ? item.labelAr : item.labelEn}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Room Selector */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "الغرفة" : "Room"} <span className="text-red-500">*</span>
              </Label>
              <Select
                value={form.roomId}
                onValueChange={(v) => setForm((f) => ({ ...f, roomId: v }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder={ar ? "اختر الغرفة..." : "Select room..."} />
                </SelectTrigger>
                <SelectContent position="popper" sideOffset={4} className="max-h-64 overflow-y-auto">
                  {(modalRooms.length > 0 ? modalRooms : rooms)?.map((r: any) => (
                    <SelectItem key={r.id} value={String(r.id)}>
                      <span className="flex items-center justify-between w-full gap-3">
                        <span>{ar ? "الغرفة" : "Room"} {r.roomNumber}</span>
                        {roomOccupantMap[r.id] && (
                          <span className="text-[11px] text-muted-foreground font-normal">
                            ({roomOccupantMap[r.id]})
                          </span>
                        )}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {form.roomId && roomOccupantMap[Number(form.roomId)] && (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 mt-1">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>{ar ? "النزيل المقيم:" : "Current Occupant:"} <strong>{roomOccupantMap[Number(form.roomId)]}</strong></span>
                </p>
              )}
            </div>

            {/* Priority */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? "الأولوية" : "Priority"}</Label>
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
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${
                          p === "URGENT" ? "bg-red-500" :
                          p === "HIGH" ? "bg-orange-500" :
                          p === "MEDIUM" ? "bg-yellow-500" : "bg-slate-400"
                        }`} />
                        <span>{ar ? PRIORITY_AR[p] : p}</span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">
                {ar ? "تفاصيل الطلب / المشكلة" : "Description & Details"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Textarea
                placeholder={
                  form.category === "housekeeping"
                    ? (ar ? "اكتب تفاصيل طلب النظافة أو المستلزمات المطلوبة..." : "Describe cleaning or amenities requested...")
                    : (ar ? "صف المشكلة أو العطل بدقة..." : "Describe the maintenance issue...")
                }
                value={form.description}
                onChange={(e) =>
                  setForm((f) => ({ ...f, description: e.target.value }))
                }
                rows={3}
              />
            </div>

            {/* Photo Upload */}
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">{ar ? "صورة مرفقة (اختياري)" : "Attach Photo (Optional)"}</Label>
              <div className="flex items-center gap-3">
                {formPhotoUrl ? (
                  <div className="relative w-20 h-20 rounded-lg overflow-hidden border">
                    <img
                      src={formPhotoUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => setFormPhotoUrl("")}
                      className="absolute top-1 right-1 p-0.5 rounded-full bg-black/60 text-white hover:bg-black"
                    >
                      <X className="w-3 h-3" />
                    </button>
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

            {/* Actions */}
            <div className="flex gap-2 justify-end pt-2">
              <Button variant="outline" onClick={() => setIsOpen(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button onClick={onSubmit} disabled={createMutation.isPending}>
                {createMutation.isPending
                  ? ar
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : ar
                    ? "إنشاء الطلب"
                    : "Create Ticket"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Main Content Area: Kanban Board vs Data Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full mx-4 sm:mx-6" />
      ) : viewMode === "kanban" ? (
        <div className="px-4 sm:px-6">
          <TicketsKanbanBoard
            tickets={filtered}
            ar={ar}
            onSelectTicket={handleSelectTicket}
            onQuickStatusChange={(id, newStatus) => {
              updateMutation.mutate({
                id,
                data: { status: newStatus },
              });
            }}
            onDeleteTicket={canDeleteAny ? (id) => setDeleteId(id) : undefined}
            roomMap={roomMap}
            roomOccupantMap={roomOccupantMap}
            properties={properties || []}
            canEdit={canEditAny}
            canDelete={canDeleteAny}
            categoryIcons={CATEGORY_ICONS}
            categoryAr={CATEGORIES_AR}
            problemTypesMap={PROBLEM_TYPES_MAP}
            priorityAr={PRIORITY_AR}
            statusAr={STATUS_AR}
            formatDuration={formatDuration}
            getDurationColor={getDurationColor}
          />
        </div>
      ) : (
        <div className="px-4 sm:px-6 pb-6 space-y-4">
          {/* Bulk Action Bar */}
          <BulkActionBar
            count={selectedTicketIds.size}
            onClear={() => setSelectedTicketIds(new Set())}
            onExportExcel={exportSelectedTicketsExcel}
            extraActions={
              (canEditAny || canDeleteAny) ? (
                <div className="flex items-center gap-2">
                  {canEditAny && (
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
                  )}
                  {canDeleteAny && (
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={handleBulkDelete}
                      className="gap-1.5 h-8 text-xs font-semibold"
                    >
                      <Trash className="w-3.5 h-3.5" />
                      {ar ? "حذف المحدد" : "Delete"}
                    </Button>
                  )}
                </div>
              ) : undefined
            }
            ar={ar}
          />

          <div className="border rounded-xl bg-card overflow-hidden shadow-xs">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40 hover:bg-muted/40">
                  <TableHead className="w-10 px-3">
                    <Checkbox
                      checked={
                        paged.length > 0 &&
                        paged.every((t: any) => selectedTicketIds.has(t.id))
                      }
                      onCheckedChange={(checked) => {
                        setSelectedTicketIds(
                          checked
                            ? new Set([
                                ...selectedTicketIds,
                                ...paged.map((t: any) => t.id),
                              ])
                            : new Set(
                                Array.from(selectedTicketIds).filter(
                                  (id) => !paged.some((t: any) => t.id === id),
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
                      {ar ? "المشكلة / الخدمة" : "Problem / Service"}
                    </TableHead>
                  )}
                  {isVisible("name") && (
                    <TableHead className="font-semibold">
                      {ar ? "النزيل المقيم" : "Occupant"}
                    </TableHead>
                  )}
                  {isVisible("category") && (
                    <TableHead className="font-semibold">
                      {ar ? "القسم" : "Category"}
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
                      {ar ? "تاريخ الإبلاغ" : "Reported"}
                    </TableHead>
                  )}
                  {isVisible("duration") && (
                    <TableHead className="font-semibold">
                      {ar ? "المدة" : "Duration"}
                    </TableHead>
                  )}
                  {isVisible("actions") && (
                    <TableHead className="font-semibold text-end">
                      {ar ? "إجراءات" : "Actions"}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((req: any) => (
                  <TableRow key={req.id} className="hover:bg-muted/20 transition-colors">
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
                      <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                        #{req.id}
                      </TableCell>
                    )}

                    {isVisible("room") && (
                      <TableCell className="font-medium whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            {ar ? "الغرفة" : "Room"}{" "}
                            {req.roomNumber || roomMap[req.roomId] || req.roomId}
                          </span>
                          {(req.propertyName || (properties.length > 1 && req.propertyId)) && (
                            <span className="text-[10px] text-muted-foreground font-normal">
                              {req.propertyName ||
                                properties.find((p: any) => p.id === req.propertyId)?.displayName ||
                                properties.find((p: any) => p.id === req.propertyId)?.name}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {isVisible("problemType") && (
                      <TableCell className="text-xs">
                        <div className="flex flex-col max-w-[200px]">
                          <span className="font-semibold text-foreground truncate">
                            {ar
                              ? (PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType)
                              : (PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType || "—")}
                          </span>
                          {req.description && (
                            <span className="text-[11px] text-muted-foreground line-clamp-1">
                              {req.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {isVisible("name") && (
                      <TableCell className="text-xs">
                        {roomOccupantMap[req.roomId] ? (
                          <span className="font-medium text-foreground">
                            {roomOccupantMap[req.roomId]}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50">—</span>
                        )}
                      </TableCell>
                    )}

                    {isVisible("category") && (
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border ${categoryColor(req.category)}`}
                        >
                          {CATEGORY_ICONS[req.category] || <FileText className="w-3.5 h-3.5" />}
                          <span>
                            {ar
                              ? (CATEGORIES_AR[req.category] ?? req.category)
                              : req.category}
                          </span>
                        </span>
                      </TableCell>
                    )}

                    {isVisible("priority") && (
                      <TableCell>
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${priorityColor(req.priority)}`}
                        >
                          <span className={`w-1.5 h-1.5 rounded-full ${
                            (req.priority || "").toUpperCase() === "URGENT" ? "bg-red-600 animate-pulse" :
                            (req.priority || "").toUpperCase() === "HIGH" ? "bg-orange-500" :
                            (req.priority || "").toUpperCase() === "MEDIUM" ? "bg-yellow-500" : "bg-slate-400"
                          }`} />
                          <span>
                            {ar
                              ? (PRIORITY_AR[req.priority?.toUpperCase()] ?? req.priority)
                              : req.priority
                                ? req.priority.charAt(0).toUpperCase() + req.priority.slice(1).toLowerCase()
                                : req.priority}
                          </span>
                        </span>
                      </TableCell>
                    )}

                    {isVisible("status") && (
                      <TableCell>
                        {canEditAny ? (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <button
                                type="button"
                                className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border transition-all hover:ring-2 hover:ring-primary/20 ${statusColor(req.status)}`}
                                title={ar ? "انقر لتغيير الحالة سريعاً" : "Click to change status"}
                              >
                                <span className={`w-1.5 h-1.5 rounded-full ${
                                  req.status === "open" ? "bg-blue-500" :
                                  req.status === "in_progress" ? "bg-amber-500" :
                                  req.status === "resolved" ? "bg-emerald-500" : "bg-slate-400"
                                }`} />
                                <span>
                                  {ar
                                    ? (STATUS_AR[req.status?.toLowerCase()] ?? req.status)
                                    : (req.status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                                </span>
                                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="text-xs">
                              <DropdownMenuItem
                                onClick={() => updateMutation.mutate({ id: req.id, data: { status: "open" } })}
                              >
                                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                                {ar ? "مفتوحة" : "Open"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateMutation.mutate({ id: req.id, data: { status: "in_progress" } })}
                              >
                                <span className="w-2 h-2 rounded-full bg-amber-500 mr-2" />
                                {ar ? "قيد التنفيذ" : "In Progress"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateMutation.mutate({ id: req.id, data: { status: "resolved" } })}
                              >
                                <span className="w-2 h-2 rounded-full bg-emerald-500 mr-2" />
                                {ar ? "تم الحل" : "Resolved"}
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => updateMutation.mutate({ id: req.id, data: { status: "closed" } })}
                              >
                                <span className="w-2 h-2 rounded-full bg-slate-400 mr-2" />
                                {ar ? "مغلقة" : "Closed"}
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        ) : (
                          <span
                            className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold border ${statusColor(req.status)}`}
                          >
                            <span className={`w-1.5 h-1.5 rounded-full ${
                              req.status === "open" ? "bg-blue-500" :
                              req.status === "in_progress" ? "bg-amber-500" :
                              req.status === "resolved" ? "bg-emerald-500" : "bg-slate-400"
                            }`} />
                            <span>
                              {ar
                                ? (STATUS_AR[req.status?.toLowerCase()] ?? req.status)
                                : (req.status || "").replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}
                            </span>
                          </span>
                        )}
                      </TableCell>
                    )}

                    {isVisible("reported") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-medium text-foreground">
                            {formatDate(req.reportedAt)}
                          </span>
                          <span className="text-muted-foreground text-[11px]">
                            {req.reportedAt ? format(new Date(req.reportedAt), "HH:mm") : ""}
                          </span>
                        </div>
                      </TableCell>
                    )}

                    {isVisible("duration") && (
                      <TableCell>
                        {req.startedAt || req.reportedAt ? (
                          <span
                            className={`text-xs ${getDurationColor(req.startedAt, req.resolvedAt, req.reportedAt)}`}
                          >
                            {formatDuration(
                              req.startedAt,
                              req.resolvedAt,
                              req.reportedAt,
                            )}
                          </span>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </TableCell>
                    )}

                    {isVisible("actions") && (
                      <TableCell className="text-end">
                        <div className="flex items-center justify-end gap-1">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2.5 text-xs gap-1"
                            onClick={() => handleSelectTicket(req.id)}
                            title={ar ? "عرض التفاصيل" : "View Details"}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            <span className="hidden sm:inline">{ar ? "تفاصيل" : "View"}</span>
                          </Button>
                          {(isSuperAdmin || isAdmin || (req.category === "housekeeping" ? canDeleteHsk : canDeleteMnt)) && (
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 text-muted-foreground hover:text-red-600"
                              onClick={() => setDeleteId(req.id)}
                              title={ar ? "حذف" : "Delete"}
                            >
                              <Trash className="w-3.5 h-3.5" />
                            </Button>
                          )}
                        </div>
                      </TableCell>
                    )}
                  </TableRow>
                ))}

                {filtered.length === 0 && (
                  <TableRow>
                    <TableCell
                      colSpan={visible.size + 1}
                      className="py-16 text-center"
                    >
                      <div className="flex flex-col items-center justify-center space-y-3">
                        <div className="w-16 h-16 bg-muted/60 rounded-full flex items-center justify-center mb-2">
                          {categoryFilter === "housekeeping" ? (
                            <Sparkles className="w-8 h-8 text-sky-500/60" />
                          ) : (
                            <Wrench className="w-8 h-8 text-amber-500/60" />
                          )}
                        </div>
                        <p className="text-base font-bold text-foreground">
                          {categoryFilter === "housekeeping"
                            ? (ar ? "لا توجد طلبات هاوس كيبنج حالياً" : "No housekeeping orders found")
                            : categoryFilter === "maintenance"
                              ? (ar ? "لا توجد بلاغات صيانة حالياً" : "No maintenance orders found")
                              : (ar ? "لم يتم العثور على أي تذاكر مطابقة" : "No tickets found")}
                        </p>
                        <p className="text-xs text-muted-foreground max-w-sm text-center">
                          {ar
                            ? "لا توجد تذاكر تطابق معايير البحث الحالية. يمكنك مسح الفلاتر أو إنشاء طلب جديد."
                            : "There are no tickets matching your active filter criteria. Try clearing filters or create a new ticket."}
                        </p>
                        <Button
                          variant="outline"
                          size="sm"
                          className="mt-2 text-xs"
                          onClick={() => {
                            setSearchTerm("");
                            if (!isOnlyHousekeeping && !isOnlyMaintenance) {
                              setCategoryFilter("all");
                            }
                            setStatusFilter("all");
                            setPriorityFilter("");
                          }}
                        >
                          {ar ? "مسح جميع الفلاتر" : "Clear All Filters"}
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

      {/* Lightbox */}
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
              {ar ? "تأكيد حذف التذكرة؟" : "Delete Ticket?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? "هل أنت متأكد من رغبتك في حذف هذا الطلب؟ لا يمكن التراجع عن هذا الإجراء."
                : "Are you sure you want to delete this ticket? This action cannot be undone."}
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
              {ar ? "حذف التذكرة" : "Delete Ticket"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Ticket Detail Modal */}
      {(() => {
        const selectedTicket = allTickets?.find((t: any) => t.id === selectedTicketId);
        const canEditSelectedTicket = isSuperAdmin || isAdmin || (selectedTicket?.category === "housekeeping" ? canEditHsk : canEditMnt);
        return (
          <TicketDetailModal
            open={selectedTicketId !== null}
            onClose={() => setSelectedTicketId(null)}
            ticket={selectedTicket}
            profiles={empOptions}
            ar={ar}
            canEdit={canEditSelectedTicket}
            onStatusChange={(id, data) => {
              const targetTicket = allTickets?.find((t: any) => t.id === id);
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
              const targetTicket = allTickets?.find((t: any) => t.id === id);
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
            onCreateSubTicket={
              canEditSelectedTicket
                ? (parentId, data) => {
                    const parentTicket = allTickets?.find((t: any) => t.id === parentId);
                    const pId = parentTicket?.propertyId || (activePropertyId !== "all" ? activePropertyId : properties[0]?.id);
                    createMutation.mutate({
                      data: {
                        propertyId: pId,
                        roomId: parentTicket?.roomId,
                        category: parentTicket?.category || "maintenance",
                        problemType: data.problemType,
                        description: data.description,
                        priority: data.priority,
                        parentId,
                      },
                    });
                    fetchSubTickets(parentId);
                  }
                : undefined
            }
          />
        );
      })()}
    </div>
  );
}
