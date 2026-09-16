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
  HardHat,
  Users,
  Search,
  RotateCcw,
  MoreVertical,
  Calendar,
  Filter,
  Building2,
  DoorClosed,
  Star,
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
import TicketDetailModal from "@/components/ui/ticket-detail-modal";
import * as XLSX from "xlsx";
import { format, differenceInMinutes } from "date-fns";
import { formatDate, getExportFileName } from "@/lib/date-utils";
import { useQueryClient, useQuery } from "@tanstack/react-query";
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
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { DataPagination } from "@/components/DataPagination";
import { TicketsKanbanBoard } from "./maintenance/components/TicketsKanbanBoard";

const CATEGORIES = ["maintenance", "housekeeping", "general"];
const CATEGORIES_AR = {
  maintenance: "صيانة",
  housekeeping: "هاوس كيبنج",
  general: "عام",
};
const CATEGORIES_EN: Record<string, string> = {
  maintenance: "Maintenance",
  housekeeping: "Housekeeping",
  general: "General",
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
  open: "لم تبدأ / مفتوحة",
  in_progress: "قيد التنفيذ",
  resolved: "تم الإنجاز",
  closed: "مغلقة",
};
const STATUS_EN: Record<string, string> = {
  open: "Not Started",
  in_progress: "In Progress",
  resolved: "Order Completed",
  closed: "Closed",
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

  const canViewMntExplicit = can("maintenance", "view_maintenance");
  const canViewHskExplicit = can("maintenance", "view_housekeeping");
  const hasExplicitFilter = canViewMntExplicit || canViewHskExplicit;

  const canViewMnt = isSuperAdmin || (hasExplicitFilter ? canViewMntExplicit : can("maintenance", "view"));
  const canViewHsk = isSuperAdmin || (hasExplicitFilter ? (canViewHskExplicit || can("housekeeping", "view")) : (can("housekeeping", "view") || can("maintenance", "view")));

  const canEditMnt = isSuperAdmin || can("maintenance", "edit");
  const canCreateMnt = isSuperAdmin || can("maintenance", "create");
  const canDeleteMnt = isSuperAdmin || can("maintenance", "delete");
  const canAssignMnt = isSuperAdmin || can("maintenance", "assign");

  const canEditHsk = isSuperAdmin || can("housekeeping", "edit");
  const canCreateHsk = isSuperAdmin || can("housekeeping", "create");
  const canDeleteHsk = isSuperAdmin || can("housekeeping", "delete");
  const canAssignHsk = isSuperAdmin || can("housekeeping", "assign");

  const hasMaintenance = canViewMnt;
  const hasHousekeeping = canViewHsk;

  const isOnlyHousekeeping = !hasMaintenance && hasHousekeeping;
  const isOnlyMaintenance = hasMaintenance && !hasHousekeeping;
  const hasBoth = hasMaintenance && hasHousekeeping;
  const hasManagerialScope = isSuperAdmin || canAssignMnt || canAssignHsk || canEditMnt || canEditHsk;

  const [scopeFilter, setScopeFilter] = useState<"all" | "me" | "unassigned">("all");

  const canCreateAny = isSuperAdmin || (isOnlyHousekeeping ? canCreateHsk : isOnlyMaintenance ? canCreateMnt : (canCreateMnt || canCreateHsk));
  const canEditAny = isSuperAdmin || (isOnlyHousekeeping ? canEditHsk : isOnlyMaintenance ? canEditMnt : (canEditMnt || canEditHsk));
  const canDeleteAny = isSuperAdmin || (isOnlyHousekeeping ? canDeleteHsk : isOnlyMaintenance ? canDeleteMnt : (canDeleteMnt || canDeleteHsk));

  const defaultCreateCategory = isOnlyHousekeeping || (!canCreateMnt && canCreateHsk) ? "housekeeping" : "maintenance";

  const allowedCreateCategories = isSuperAdmin
    ? CATEGORIES
    : [
        ...(canCreateMnt && !isOnlyHousekeeping ? ["maintenance"] : []),
        ...(canCreateHsk && !isOnlyMaintenance ? ["housekeeping"] : []),
        ...(!isOnlyHousekeeping ? ["general"] : []),
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
    workerId: "",
  });

  // Effective propertyId for list query
  const effectivePropertyId =
    propertyFilter && propertyFilter !== "all"
      ? parseInt(propertyFilter, 10)
      : activePropertyId === "all" || propertyFilter === "all"
        ? "all"
        : activePropertyId ?? "all";

  const targetPropertyId =
    activePropertyId && activePropertyId !== "all"
      ? Number(activePropertyId)
      : properties?.[0]?.id || 1;

  // جلب فنيي وعمال الفندق النشط
  const { data: workersData } = useQuery({
    queryKey: ["/api/workers", targetPropertyId],
    queryFn: async () => {
      if (!targetPropertyId) return { data: [] };
      const res = await fetch(`/api/workers?propertyId=${targetPropertyId}`);
      if (!res.ok) return { data: [] };
      return res.json();
    },
    enabled: !!targetPropertyId,
  });
  const propertyWorkers = workersData?.data || [];

  const formWorkers = useMemo(() => {
    if (!propertyWorkers || !Array.isArray(propertyWorkers)) return [];
    if (form.category === "housekeeping") {
      return propertyWorkers.filter((w: any) => w.specialty === "housekeeping");
    }
    if (form.category === "maintenance") {
      return propertyWorkers.filter((w: any) => w.specialty !== "housekeeping");
    }
    return propertyWorkers;
  }, [propertyWorkers, form.category]);

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
      workerId: "",
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
        ar ? "يرجى اختيار الـ Resident أولاً" : "Please select a Resident first",
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
        workerId: form.workerId ? parseInt(form.workerId) : undefined,
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
    { key: "room_person", label: "ROOM & RESIDENT", labelAr: "الغرفة والنزيل", defaultVisible: true },
    { key: "problem", label: "PROBLEM", labelAr: "المشكلة", defaultVisible: true },
    { key: "resident", label: "RESIDENT", labelAr: "Resident", defaultVisible: true },
    { key: "department", label: "DEPARTMENT", labelAr: "القسم والخدمة", defaultVisible: true },
    { key: "status", label: "STATUS", labelAr: "الحالة", defaultVisible: true },
    { key: "priority", label: "PRIORITY", labelAr: "الأولوية", defaultVisible: true },
    { key: "at", label: "AT", labelAr: "تاريخ البدء", defaultVisible: true },
    { key: "duration", label: "DURATION", labelAr: "المدة", defaultVisible: true },
    { key: "rating", label: "RATING", labelAr: "التقييم", defaultVisible: true },
    { key: "actions", label: "ACTIONS", labelAr: "إجراءات", defaultVisible: true, fixed: true },
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
      [ar ? "Resident" : "Resident"]:
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
      [ar ? "الفني المعين" : "Assigned Worker"]: req.workerName || "—",
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
      [ar ? "التقييم" : "Rating"]: req.rating
        ? `${req.rating}/5`
        : ["resolved", "closed"].includes(req.status)
        ? (ar ? "بانتظار التقييم" : "Pending")
        : "—",
      [ar ? "ملاحظات التقييم" : "Rating Comment"]: req.ratingComment || "—",
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
      [ar ? "Resident" : "Resident"]:
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
      [ar ? "الفني المعين" : "Assigned Worker"]: req.workerName || "—",
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
      [ar ? "التقييم" : "Rating"]: req.rating
        ? `${req.rating}/5`
        : ["resolved", "closed"].includes(req.status)
        ? (ar ? "بانتظار التقييم" : "Pending")
        : "—",
      [ar ? "ملاحظات التقييم" : "Rating Comment"]: req.ratingComment || "—",
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

  const hasActiveFilters = Boolean(
    searchTerm ||
    (categoryFilter !== (isOnlyHousekeeping ? "housekeeping" : isOnlyMaintenance ? "maintenance" : "all")) ||
    statusFilter !== "all" ||
    priorityFilter ||
    scopeFilter !== "all" ||
    (propertyFilter && propertyFilter !== "all") ||
    fromDate ||
    toDate
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setCategoryFilter(isOnlyHousekeeping ? "housekeeping" : isOnlyMaintenance ? "maintenance" : "all");
    setStatusFilter("all");
    setPriorityFilter("");
    setScopeFilter("all");
    setPropertyFilter("all");
    setFromDate("");
    setToDate("");
    setCurrentPage(1);
  };

  return (
    <div className="min-h-screen bg-background space-y-4">
      {/* Executive Header (Linear Style) */}
      <div className="px-4 sm:px-6 pt-6">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
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
                {isOnlyHousekeeping
                  ? (ar ? "طلبات وأوامر الهاوس كيبنج" : "Housekeeping Orders")
                  : isOnlyMaintenance
                    ? (ar ? "بلاغات وأوامر الصيانة الفنية" : "Maintenance Work Orders")
                    : (ar ? "مركز التذاكر وأوامر العمل" : "Operations & Tickets Hub")}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isOnlyHousekeeping
                  ? (ar ? "متابعة وإسناد طلبات النظافة وتجهيز الغرف والمستلزمات" : "Track and assign room cleaning, linens, and housekeeping orders")
                  : isOnlyMaintenance
                    ? (ar ? "متابعة وإسناد بلاغات الأعطال والصيانة الوقائية والطارئة" : "Track and dispatch engineering and repair work orders")
                    : (ar ? "متابعة وإسناد أوامر العمل وبلاغات الصيانة والنظافة" : "Track and assign work orders, maintenance, and housekeeping")}
              </p>
            </div>
          </div>

          {/* Action Bar: Create Ticket */}
          <div className="flex items-center gap-2 self-start sm:self-auto">
            {canCreateAny && (
              <Button
                onClick={() => setIsOpen(true)}
                className="gap-2 shadow-xs font-semibold"
                size="sm"
              >
                <Plus className="w-4 h-4" />
                <span>
                  {isOnlyHousekeeping
                    ? (ar ? "طلب هاوس كيبنج جديد" : "New Housekeeping Order")
                    : isOnlyMaintenance
                      ? (ar ? "بلاغ صيانة جديد" : "New Maintenance Ticket")
                      : (ar ? "إنشاء تذكرة جديدة" : "New Ticket")}
                </span>
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Status & Category Metric Tabs Strip */}
      <div className="px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 pb-1 border-b">
          <div className="flex items-center gap-1.5 overflow-x-auto">
            <button
              type="button"
              onClick={() => setStatusFilter("all")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
                statusFilter === "all"
                  ? "bg-primary/10 text-primary border-b-2 border-primary shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span>{ar ? "كل التذاكر" : "All Tickets"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                {totalCount}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("open")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
                statusFilter === "open"
                  ? "bg-blue-500/10 text-blue-700 dark:text-blue-300 border-b-2 border-blue-500 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-blue-500" />
              <span>{ar ? "مفتوحة" : "Open"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-blue-100 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300">
                {openCount}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("in_progress")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
                statusFilter === "in_progress"
                  ? "bg-amber-500/10 text-amber-700 dark:text-amber-300 border-b-2 border-amber-500 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-amber-500" />
              <span>{ar ? "قيد التنفيذ" : "In Progress"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-amber-100 dark:bg-amber-950/60 text-amber-700 dark:text-amber-300">
                {inProgressCount}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("resolved")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
                statusFilter === "resolved"
                  ? "bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 border-b-2 border-emerald-500 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
              <span>{ar ? "تم الحل" : "Resolved"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold bg-emerald-100 dark:bg-emerald-950/60 text-emerald-700 dark:text-emerald-300">
                {resolvedCount}
              </Badge>
            </button>

            <button
              type="button"
              onClick={() => setStatusFilter("closed")}
              className={`flex items-center gap-2 px-3.5 py-2 text-xs font-bold rounded-lg transition-all shrink-0 ${
                statusFilter === "closed"
                  ? "bg-slate-500/10 text-slate-700 dark:text-slate-300 border-b-2 border-slate-500 shadow-xs"
                  : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
              }`}
            >
              <span className="w-2 h-2 rounded-full bg-slate-400" />
              <span>{ar ? "مغلقة" : "Closed"}</span>
              <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono font-bold">
                {closedCount}
              </Badge>
            </button>
          </div>

          {/* Quick Category Scope Switcher */}
          <div className="flex items-center gap-1 bg-muted/60 dark:bg-muted/30 p-1 rounded-xl border border-border/50 shrink-0">
            {hasBoth && (
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  categoryFilter === "all"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {ar ? "الكل" : "All"}
              </button>
            )}
            {canViewMnt && (
              <button
                type="button"
                onClick={() => setCategoryFilter("maintenance")}
                disabled={isOnlyMaintenance}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  categoryFilter === "maintenance"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                } ${isOnlyMaintenance ? "cursor-default opacity-90" : ""}`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{ar ? "أوردرات الصيانة" : "Maintenance"}</span>
                {isOnlyMaintenance && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-amber-700 text-white font-semibold">
                    {ar ? "فقط" : "Only"}
                  </Badge>
                )}
              </button>
            )}
            {canViewHsk && (
              <button
                type="button"
                onClick={() => setCategoryFilter("housekeeping")}
                disabled={isOnlyHousekeeping}
                className={`flex items-center gap-1.5 px-3 py-1 text-xs font-bold rounded-lg transition-all ${
                  categoryFilter === "housekeeping"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                } ${isOnlyHousekeeping ? "cursor-default opacity-90" : ""}`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{ar ? "أوردرات الهاوس كيبنج" : "Housekeeping"}</span>
                {isOnlyHousekeeping && (
                  <Badge variant="secondary" className="text-[9px] px-1 py-0 h-3.5 bg-sky-700 text-white font-semibold">
                    {ar ? "فقط" : "Only"}
                  </Badge>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 2-Row Filter Grid (Opera / HotSOS Hotel Standard) */}
      <div className="px-4 sm:px-6">
        <div className="bg-card p-4 rounded-xl border shadow-xs space-y-3.5">
          {/* Row 1: Hotels, From Date, To Date, Status */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Resident Filter */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Building2 className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "Resident" : "Resident"}</span>
              </Label>
              <Select value={propertyFilter} onValueChange={(v) => setPropertyFilter(v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={ar ? "كل الـ Resident" : "All Residents"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كل الـ Resident" : "All Residents"}</SelectItem>
                  {properties.map((p) => (
                    <SelectItem key={p.id} value={String(p.id)}>
                      {p.displayName || p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* From Date */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "من تاريخ" : "From Date"}</span>
              </Label>
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>

            {/* To Date */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "إلى تاريخ" : "To Date"}</span>
              </Label>
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="h-9 text-xs bg-background"
              />
            </div>

            {/* Status Filter */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <CheckCircle className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "الحالة" : "Status"}</span>
              </Label>
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={ar ? "كل الحالات" : "All Statuses"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
                  <SelectItem value="open">{ar ? "لم تبدأ / مفتوحة" : "Not Started"}</SelectItem>
                  <SelectItem value="in_progress">{ar ? "قيد التنفيذ" : "In Progress"}</SelectItem>
                  <SelectItem value="resolved">{ar ? "تم الإنجاز" : "Order Completed"}</SelectItem>
                  <SelectItem value="closed">{ar ? "مغلقة" : "Closed"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Row 2: Type, Priority, Departments, Creator Type + Reset */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
            {/* Type */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "النوع" : "Type"}</span>
              </Label>
              <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={ar ? "كل الأنواع" : "All Types"} />
                </SelectTrigger>
                <SelectContent>
                  {!isOnlyHousekeeping && !isOnlyMaintenance && (
                    <SelectItem value="all">{ar ? "كل الأنواع" : "All Types"}</SelectItem>
                  )}
                  {!isOnlyHousekeeping && (
                    <SelectItem value="maintenance">{ar ? "صيانة فنية" : "Maintenance"}</SelectItem>
                  )}
                  {!isOnlyMaintenance && (
                    <SelectItem value="housekeeping">{ar ? "هاوس كيبنج" : "Housekeeping"}</SelectItem>
                  )}
                  {!isOnlyHousekeeping && (
                    <SelectItem value="general">{ar ? "عام" : "General"}</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Priority */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "الأولوية" : "Priority"}</span>
              </Label>
              <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={ar ? "كل الأولويات" : "All Priorities"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كل الأولويات" : "All Priorities"}</SelectItem>
                  {PRIORITIES.map((p) => (
                    <SelectItem key={p} value={p}>
                      <div className="flex items-center gap-1.5">
                        <span className={`w-1.5 h-1.5 rounded-full ${
                          p === "URGENT" ? "bg-red-500" :
                          p === "HIGH" ? "bg-orange-500" :
                          p === "MEDIUM" ? "bg-yellow-500" : "bg-slate-400"
                        }`} />
                        <span>{ar ? PRIORITY_AR[p] : p}</span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Assignment Scope */}
            <div className="space-y-1">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <HardHat className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "نطاق التعيين" : "Assignment"}</span>
              </Label>
              <Select value={scopeFilter} onValueChange={(v: "all" | "me" | "unassigned") => setScopeFilter(v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={ar ? "كل التذاكر" : "All Tickets"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "كل التذاكر" : "All Tickets"}</SelectItem>
                  <SelectItem value="me">{ar ? "تذاكري المسندة إليّ" : "Assigned to Me"}</SelectItem>
                  <SelectItem value="unassigned">{ar ? "تذاكر غير مسندة" : "Unassigned"}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Creator Type & Reset */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5 text-primary" />
                  <span>{ar ? "جهة البلاغ" : "Creator Type"}</span>
                </Label>
                {hasActiveFilters && (
                  <button
                    type="button"
                    onClick={clearAllFilters}
                    className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors font-medium"
                    title={ar ? "إعادة ضبط جميع الفلاتر" : "Reset all filters"}
                  >
                    <RotateCcw className="w-3 h-3" />
                    <span>{ar ? "إعادة ضبط" : "Reset"}</span>
                  </button>
                )}
              </div>
              <Select value={creatorTypeFilter || "all"} onValueChange={(v) => setCreatorTypeFilter(v === "all" ? "" : v)}>
                <SelectTrigger className="h-9 text-xs bg-background">
                  <SelectValue placeholder={ar ? "كل جهات البلاغ" : "All Creators"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
                  <SelectItem value="staff">{ar ? "إدارة السكن / المشرف" : "Staff / Supervisor"}</SelectItem>
                  <SelectItem value="resident">{ar ? "النزيل / بوابة المقيمين" : "Resident / Portal"}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>
      </div>

      {/* Action & Search Bar */}
      <div className="px-4 sm:px-6">
        <div className="flex flex-wrap items-center justify-between gap-3 bg-card p-2.5 rounded-xl border shadow-xs">
          {/* Search Box */}
          <div className="relative w-full sm:w-72">
            <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none" />
            <Input
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder={ar ? "بحث برقم الغرفة، الوصف، الفني..." : "Search tickets..."}
              className="h-8.5 text-xs ps-8 pe-7 bg-background"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                className="absolute end-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            {/* View Mode Toggle */}
            <div className="flex items-center p-0.5 bg-muted rounded-lg border">
              <button
                type="button"
                onClick={() => handleSetViewMode("list")}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === "list"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={ar ? "عرض الجدول" : "Table View"}
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => handleSetViewMode("kanban")}
                className={`p-1.5 rounded-md text-xs transition-colors ${
                  viewMode === "kanban"
                    ? "bg-background text-foreground shadow-xs"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                title={ar ? "لوحة كانبان" : "Kanban Board"}
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Export Excel */}
            <Button
              variant="outline"
              size="sm"
              onClick={exportExcel}
              className="h-8 text-xs gap-1.5 font-medium bg-background"
              title={ar ? "تصدير إلى Excel" : "Export Excel"}
            >
              <FileText className="w-3.5 h-3.5" />
              <span className="hidden md:inline">{ar ? "تصدير" : "Export"}</span>
            </Button>

            {/* Toggle Columns */}
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
                  {ar ? "الـ Resident" : "Resident"} <span className="text-red-500">*</span>
                </Label>
                <Select
                  value={formPropertyId}
                  onValueChange={(v) => {
                    setFormPropertyId(v);
                    setForm((f) => ({ ...f, roomId: "" }));
                  }}
                >
                  <SelectTrigger>
                    <SelectValue placeholder={ar ? "اختر الـ Resident" : "Select Resident"} />
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

            {/* Assign Worker (Optional) */}
            {formWorkers.length > 0 && (
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold flex items-center gap-1.5">
                  <HardHat className="w-3.5 h-3.5 text-primary" />
                  <span>
                    {form.category === "housekeeping"
                      ? (ar ? "تعيين موظف نظافة (اختياري)" : "Assign Cleaner (Optional)")
                      : (ar ? "تعيين فني من فريق العمل (اختياري)" : "Assign Technician (Optional)")}
                  </span>
                </Label>
                <Select
                  value={form.workerId || "unassigned"}
                  onValueChange={(v) => setForm((f) => ({ ...f, workerId: v === "unassigned" ? "" : v }))}
                >
                  <SelectTrigger>
                    <SelectValue
                      placeholder={
                        form.category === "housekeeping"
                          ? (ar ? "اختر موظف النظافة..." : "Select cleaner...")
                          : (ar ? "اختر الفني..." : "Select worker...")
                      }
                    />
                  </SelectTrigger>
                  <SelectContent position="popper" sideOffset={4} className="max-h-56 overflow-y-auto">
                    <SelectItem value="unassigned">
                      — {ar ? "بدون تعيين حالياً" : "None / Unassigned"} —
                    </SelectItem>
                    {formWorkers.map((w: any) => (
                      <SelectItem key={w.id} value={String(w.id)}>
                        <div className="flex items-center gap-2">
                          <span className="font-semibold">{w.name}</span>
                          <span className="text-muted-foreground text-[10px]">
                            ({w.specialty})
                          </span>
                        </div>
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

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

          <div className="border rounded-xl bg-card overflow-hidden overflow-x-auto shadow-xs">
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
                  {(isVisible("room_person") || isVisible("name")) && (
                    <TableHead className="font-semibold min-w-[170px]">
                      {ar ? "الغرفة والنزيل" : "ROOM & RESIDENT"}
                    </TableHead>
                  )}
                  {isVisible("problem") && (
                    <TableHead className="font-semibold min-w-[200px]">
                      {ar ? "المشكلة" : "PROBLEM"}
                    </TableHead>
                  )}
                  {(isVisible("resident") || isVisible("hotel")) && (
                    <TableHead className="font-semibold min-w-[130px]">
                      {ar ? "Resident" : "RESIDENT"}
                    </TableHead>
                  )}
                  {isVisible("department") && (
                    <TableHead className="font-semibold">
                      {ar ? "القسم والخدمة" : "DEPARTMENT"}
                    </TableHead>
                  )}
                  {isVisible("status") && (
                    <TableHead className="font-semibold">
                      {ar ? "الحالة" : "STATUS"}
                    </TableHead>
                  )}
                  {isVisible("priority") && (
                    <TableHead className="font-semibold">
                      {ar ? "الأولوية" : "PRIORITY"}
                    </TableHead>
                  )}
                  {isVisible("at") && (
                    <TableHead className="font-semibold">
                      {ar ? "تاريخ البدء" : "AT"}
                    </TableHead>
                  )}
                  {isVisible("duration") && (
                    <TableHead className="font-semibold">
                      {ar ? "المدة" : "DURATION"}
                    </TableHead>
                  )}
                  {isVisible("rating") && (
                    <TableHead className="font-semibold min-w-[120px]">
                      {ar ? "التقييم" : "RATING"}
                    </TableHead>
                  )}
                  {isVisible("actions") && (
                    <TableHead className="font-semibold text-end">
                      {ar ? "إجراءات" : "ACTIONS"}
                    </TableHead>
                  )}
                </TableRow>
              </TableHeader>
              <TableBody>
                {paged.map((req: any) => (
                  <TableRow
                    key={req.id}
                    onClick={() => handleSelectTicket(req.id)}
                    className="cursor-pointer hover:bg-muted/40 transition-colors group"
                  >
                    <TableCell className="w-10 px-3" onClick={(e) => e.stopPropagation()}>
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
                      <TableCell className="font-mono text-xs font-bold text-muted-foreground">
                        #{req.id}
                      </TableCell>
                    )}

                    {(isVisible("room_person") || isVisible("name")) && (
                      <TableCell className="text-xs font-medium">
                        <div className="flex flex-col gap-0.5">
                          <span className="font-bold text-foreground flex items-center gap-1.5">
                            <DoorClosed className="w-3.5 h-3.5 text-primary shrink-0" />
                            {ar ? "الغرفة" : "Room"} {req.roomNumber || roomMap[req.roomId] || req.roomId}
                          </span>
                          {roomOccupantMap[req.roomId] ? (
                            <span className="text-[11px] text-muted-foreground flex items-center gap-1 font-medium">
                              <User className="w-3 h-3 text-slate-400 shrink-0" />
                              <span className="truncate max-w-[150px]">{roomOccupantMap[req.roomId]}</span>
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-400 italic">
                              {ar ? "شاغرة (بدون نزيل)" : "Vacant (No resident)"}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {isVisible("problem") && (
                      <TableCell className="text-xs">
                        <div className="flex flex-col gap-0.5 max-w-[220px]">
                          <span className="font-semibold text-foreground text-xs line-clamp-1" title={req.title || req.description}>
                            {req.title || (ar ? (PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType) : (PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType)) || (ar ? "طلب صيانة" : "Maintenance Ticket")}
                          </span>
                          {req.description && (
                            <span className="text-[11px] text-muted-foreground line-clamp-2" title={req.description}>
                              {req.description}
                            </span>
                          )}
                        </div>
                      </TableCell>
                    )}

                    {(isVisible("resident") || isVisible("hotel")) && (
                      <TableCell className="text-xs">
                        <div className="flex items-center gap-1.5">
                          <Building2 className="w-3.5 h-3.5 text-primary shrink-0" />
                          <span className="font-medium text-foreground">
                            {req.propertyName ||
                              properties.find((p: any) => p.id === req.propertyId)?.displayName ||
                              properties.find((p: any) => p.id === req.propertyId)?.name ||
                              (ar ? "Resident شروق" : "Sunrise Resident")}
                          </span>
                        </div>
                      </TableCell>
                    )}

                    {isVisible("department") && (
                      <TableCell className="text-xs">
                        <div className="flex flex-col">
                          <span className="font-bold text-foreground">
                            {ar
                              ? (CATEGORIES_AR[req.category] || req.category)
                              : (CATEGORIES_EN[req.category] || req.category?.toUpperCase())}
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {ar
                              ? (PROBLEM_TYPES_MAP[req.problemType]?.labelAr || req.problemType)
                              : (PROBLEM_TYPES_MAP[req.problemType]?.labelEn || req.problemType)}
                          </span>
                        </div>
                      </TableCell>
                    )}

                    {isVisible("status") && (
                      <TableCell onClick={(e) => e.stopPropagation()}>
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
                                    ? (STATUS_AR[req.status?.toLowerCase()] || req.status)
                                    : (STATUS_EN[req.status?.toLowerCase()] || req.status)}
                                </span>
                                <ChevronDown className="w-3 h-3 opacity-60 ml-0.5" />
                              </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="text-xs">
                              <DropdownMenuItem
                                onClick={() => updateMutation.mutate({ id: req.id, data: { status: "open" } })}
                              >
                                <span className="w-2 h-2 rounded-full bg-blue-500 mr-2" />
                                {ar ? "لم تبدأ / مفتوحة" : "Not Started"}
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
                                {ar ? "تم الإنجاز" : "Order Completed"}
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
                                ? (STATUS_AR[req.status?.toLowerCase()] || req.status)
                                : (STATUS_EN[req.status?.toLowerCase()] || req.status)}
                            </span>
                          </span>
                        )}
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
                              ? (PRIORITY_AR[req.priority?.toUpperCase()] || req.priority)
                              : req.priority}
                          </span>
                        </span>
                      </TableCell>
                    )}

                    {isVisible("at") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-semibold text-foreground">
                            Start: {req.reportedAt ? format(new Date(req.reportedAt), "dd-MM-yyyy") : "—"}
                          </span>
                          <span className="text-muted-foreground text-[10px] font-mono">
                            {req.reportedAt ? format(new Date(req.reportedAt), "hh:mm:ss a") : ""}
                          </span>
                        </div>
                      </TableCell>
                    )}

                    {isVisible("duration") && (
                      <TableCell>
                        {req.startedAt || req.reportedAt ? (
                          <Badge
                            variant="secondary"
                            className="font-mono text-xs px-2 py-0.5 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800"
                          >
                            {formatDuration(
                              req.startedAt,
                              req.resolvedAt,
                              req.reportedAt,
                            )}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/50 text-xs">—</span>
                        )}
                      </TableCell>
                    )}

                    {isVisible("rating") && (
                      <TableCell>
                        {req.rating ? (
                          <div className="flex flex-col gap-0.5">
                            <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-bold bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200 dark:border-amber-800 w-fit shadow-2xs">
                              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-400 shrink-0" />
                              <span>{req.rating}/5</span>
                            </div>
                            {req.ratingComment && (
                              <span
                                className="text-[10px] text-muted-foreground truncate max-w-[130px]"
                                title={req.ratingComment}
                              >
                                {req.ratingComment}
                              </span>
                            )}
                          </div>
                        ) : ["resolved", "closed"].includes(req.status) ? (
                          <Badge
                            variant="outline"
                            className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-300 dark:border-amber-700 bg-amber-50/50 dark:bg-amber-950/20 font-medium"
                          >
                            {ar ? "بانتظار التقييم" : "Pending Rating"}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground/40 text-xs">—</span>
                        )}
                      </TableCell>
                    )}

                    {isVisible("actions") && (
                      <TableCell className="text-end" onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Hotel PMS Blue Rounded Square Eye Action Button */}
                          <Button
                            size="icon"
                            className="h-8 w-8 rounded-lg bg-blue-600 hover:bg-blue-700 text-white shadow-xs"
                            onClick={() => handleSelectTicket(req.id)}
                            title={ar ? "عرض تفاصيل التذكرة" : "View Details"}
                          >
                            <Eye className="w-4 h-4" />
                          </Button>

                          {canEditAny && (
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8 text-muted-foreground hover:text-foreground"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end" className="w-44 text-xs">
                                <DropdownMenuItem
                                  onClick={() => handleSelectTicket(req.id)}
                                  className="gap-2 cursor-pointer"
                                >
                                  <Eye className="w-3.5 h-3.5 text-primary" />
                                  <span>{ar ? "عرض التفاصيل الكاملة" : "Full Details"}</span>
                                </DropdownMenuItem>

                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => updateMutation.mutate({ id: req.id, data: { status: "in_progress" } })}
                                  disabled={req.status === "in_progress"}
                                  className="gap-2 cursor-pointer"
                                >
                                  <span className="w-2 h-2 rounded-full bg-amber-500" />
                                  <span>{ar ? "بدء التنفيذ" : "Mark In Progress"}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateMutation.mutate({ id: req.id, data: { status: "resolved" } })}
                                  disabled={req.status === "resolved"}
                                  className="gap-2 cursor-pointer"
                                >
                                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                  <span>{ar ? "تم الحل والإنجاز" : "Mark Resolved"}</span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => updateMutation.mutate({ id: req.id, data: { status: "closed" } })}
                                  disabled={req.status === "closed"}
                                  className="gap-2 cursor-pointer"
                                >
                                  <span className="w-2 h-2 rounded-full bg-slate-400" />
                                  <span>{ar ? "إغلاق الطلب" : "Mark Closed"}</span>
                                </DropdownMenuItem>

                                {(isSuperAdmin || isAdmin || (req.category === "housekeeping" ? canDeleteHsk : canDeleteMnt)) && (
                                  <>
                                    <DropdownMenuSeparator />
                                    <DropdownMenuItem
                                      onClick={() => setDeleteId(req.id)}
                                      className="gap-2 text-destructive focus:text-destructive cursor-pointer"
                                    >
                                      <Trash className="w-3.5 h-3.5" />
                                      <span>{ar ? "حذف التذكرة" : "Delete Ticket"}</span>
                                    </DropdownMenuItem>
                                  </>
                                )}
                              </DropdownMenuContent>
                            </DropdownMenu>
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
            occupantName={selectedTicket ? roomOccupantMap[selectedTicket.roomId] : undefined}
            profiles={empOptions}
            workers={propertyWorkers}
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
            onWorkerAssignChange={(id, workerId) => {
              const targetTicket = allTickets?.find((t: any) => t.id === id);
              const pId = targetTicket?.propertyId || (activePropertyId !== "all" ? activePropertyId : undefined);
              updateMutation.mutate({
                id,
                data: {
                  workerId,
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
