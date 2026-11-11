import { useState, useMemo, useEffect } from "react";
import {
  useListMaintenance,
  useCreateMaintenance,
  useUpdateMaintenance,
  useDeleteMaintenance,
  useListAssignments,
  getListMaintenanceQueryKey,
  listMaintenance,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { usePermission } from "@/hooks/use-permission";
import { useDebounce } from "@/hooks/use-debounce";
import { toast } from "sonner";
import { Skeleton } from "@/components/ui/skeleton";
import { useColumnVisibility } from "@/components/ui/column-chooser";
import TicketDetailModal from "@/components/ui/ticket-detail-modal";
import { useQueryClient, useQuery } from "@tanstack/react-query";
import { TicketsKanbanBoard } from "./components/TicketsKanbanBoard";
import { TicketsHeader } from "./components/TicketsHeader";
import { TicketsStatusStrip } from "./components/TicketsStatusStrip";
import { TicketsFilterPanel } from "./components/TicketsFilterPanel";
import { TicketsToolbar } from "./components/TicketsToolbar";
import { NewTicketDialog, type TicketForm } from "./components/NewTicketDialog";
import { TicketsBulkActions } from "./components/TicketsBulkActions";
import { TicketsTable } from "./components/TicketsTable";
import { TicketPhotoLightbox } from "./components/TicketPhotoLightbox";
import { TicketDeleteDialog } from "./components/TicketDeleteDialog";
import {
  CATEGORIES,
  CATEGORIES_AR,
  CATEGORY_ICONS,
  PROBLEM_TYPES_MAP,
  PRIORITY_AR,
  TICKET_COLS,
} from "./utils/ticket-constants";
import {
  formatDuration,
  getDurationColor,
  STATUS_AR,
} from "./utils/ticket-duration";
import {
  exportTicketsExcel,
  exportSelectedTicketsExcel as exportSelectedTicketsExcelUtil,
} from "./utils/ticket-export";
import { useAllRows } from "@/lib/use-all-rows";

// Newest report first, then highest id (same order as the API).
function newestTicketFirst(a: any, b: any) {
  const time = (t: any) =>
    t.reportedAt
      ? new Date(t.reportedAt).getTime()
      : t.createdAt
        ? new Date(t.createdAt).getTime()
        : 0;
  const diff = time(b) - time(a);
  if (diff !== 0) return diff;
  return (Number(b.id) || 0) - (Number(a.id) || 0);
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

  const canViewMnt =
    isSuperAdmin ||
    (hasExplicitFilter ? canViewMntExplicit : can("maintenance", "view"));
  const canViewHsk =
    isSuperAdmin ||
    (hasExplicitFilter ? canViewHskExplicit : can("housekeeping", "view"));

  const canEditMnt =
    isSuperAdmin ||
    can("maintenance", "edit") ||
    can("maintenance", "view") ||
    can("maintenance", "view_maintenance");
  const canCreateMnt =
    isSuperAdmin ||
    can("maintenance", "create") ||
    can("maintenance", "view") ||
    can("maintenance", "view_maintenance");
  const canDeleteMnt =
    isSuperAdmin || can("maintenance", "delete") || can("maintenance", "edit");
  const canAssignMnt =
    isSuperAdmin ||
    can("maintenance", "assign" as any) ||
    can("maintenance", "edit") ||
    can("maintenance", "view");

  const canEditHsk =
    isSuperAdmin ||
    can("housekeeping", "edit") ||
    can("housekeeping", "view") ||
    can("maintenance", "view_housekeeping");
  const canCreateHsk =
    isSuperAdmin ||
    can("housekeeping", "create") ||
    can("housekeeping", "view") ||
    can("maintenance", "view_housekeeping");
  const canDeleteHsk =
    isSuperAdmin ||
    can("housekeeping", "delete") ||
    can("housekeeping", "edit");
  const canAssignHsk =
    isSuperAdmin ||
    can("housekeeping", "assign" as any) ||
    can("housekeeping", "edit") ||
    can("housekeeping", "view");

  const hasMaintenance = canViewMnt || canCreateMnt || canEditMnt;
  const hasHousekeeping = canViewHsk || canCreateHsk || canEditHsk;

  const isOnlyHousekeeping = !hasMaintenance && hasHousekeeping;
  const isOnlyMaintenance = hasMaintenance && !hasHousekeeping;
  const hasBoth = isSuperAdmin || (hasMaintenance && hasHousekeeping);
  const hasManagerialScope =
    isSuperAdmin || canAssignMnt || canAssignHsk || canEditMnt || canEditHsk;

  const [scopeFilter, setScopeFilter] = useState<"all" | "me" | "unassigned">(
    "all",
  );

  const canCreateAny =
    isSuperAdmin ||
    (isOnlyHousekeeping
      ? canCreateHsk
      : isOnlyMaintenance
        ? canCreateMnt
        : canCreateMnt || canCreateHsk);
  const canEditAny =
    isSuperAdmin ||
    (isOnlyHousekeeping
      ? canEditHsk
      : isOnlyMaintenance
        ? canEditMnt
        : canEditMnt || canEditHsk);
  const canDeleteAny =
    isSuperAdmin ||
    (isOnlyHousekeeping
      ? canDeleteHsk
      : isOnlyMaintenance
        ? canDeleteMnt
        : canDeleteMnt || canDeleteHsk);

  const defaultCreateCategory =
    isOnlyHousekeeping || (!canCreateMnt && canCreateHsk)
      ? "housekeeping"
      : "maintenance";

  const allowedCreateCategories = isSuperAdmin
    ? CATEGORIES
    : isOnlyMaintenance
      ? ["maintenance"]
      : isOnlyHousekeeping
        ? ["housekeeping"]
        : [
            ...(canCreateMnt ? ["maintenance"] : []),
            ...(canCreateHsk ? ["housekeeping"] : []),
          ];

  const queryClient = useQueryClient();
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [isOpen, setIsOpen] = useState(false);

  // View Mode: List vs Kanban
  const [viewMode, setViewMode] = useState<"list" | "kanban">(() => {
    try {
      return (
        (localStorage.getItem("tickets_view_mode") as "list" | "kanban") ||
        "list"
      );
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
    isOnlyHousekeeping
      ? "housekeeping"
      : isOnlyMaintenance
        ? "maintenance"
        : "all",
  );
  const [statusFilter, setStatusFilter] = useState("all");
  const [searchTerm, setSearchTerm] = useState("");
  const debouncedSearch = useDebounce(searchTerm, 400);

  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");

  useEffect(() => {
    setCurrentPage(1);
  }, [
    debouncedSearch,
    categoryFilter,
    statusFilter,
    priorityFilter,
    fromDate,
    toDate,
  ]);

  const [photoDialog, setPhotoDialog] = useState<string | null>(null);
  const [filterBarFilters, setFilterBarFilters] = useState<Record<string, any>>(
    {},
  );
  const [selectedTicketId, setSelectedTicketId] = useState<number | null>(null);
  const [selectedTicketIds, setSelectedTicketIds] = useState<Set<number>>(
    new Set(),
  );
  const [bulkStatusLoading, setBulkStatusLoading] = useState(false);
  const [subTickets, setSubTickets] = useState<any[]>([]);
  const [loadingSubTickets, setLoadingSubTickets] = useState(false);

  const [departmentFilter, setDepartmentFilter] = useState<string[]>([]);
  const [creatorTypeFilter, setCreatorTypeFilter] = useState("");
  const [propertyFilter, setPropertyFilter] = useState("all");
  const [formPhotoUrl, setFormPhotoUrl] = useState("");

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
  }, [
    debouncedSearch,
    statusFilter,
    priorityFilter,
    categoryFilter,
    scopeFilter,
    propertyFilter,
    fromDate,
    toDate,
  ]);

  // Form state
  const [formPropertyId, setFormPropertyId] = useState<string>(() => {
    if (activePropertyId && activePropertyId !== "all")
      return String(activePropertyId);
    if (properties && properties.length > 0) return String(properties[0].id);
    return "";
  });

  const [form, setForm] = useState<TicketForm>({
    roomId: "",
    category: defaultCreateCategory,
    problemType:
      defaultCreateCategory === "housekeeping" ? "room_cleaning" : "Plumbing",
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
        : (activePropertyId ?? "all");

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
  const { data: _eDataWrapper } = useAllRows(
    "/api/profiles",
    {
      propertyId:
        activePropertyId && activePropertyId !== "all"
          ? activePropertyId
          : undefined,
    },
    { enabled: !!activePropertyId && activePropertyId !== "all" },
  );
  const profiles: any[] = Array.isArray(_eDataWrapper)
    ? _eDataWrapper
    : (_eDataWrapper as any)?.profiles || (_eDataWrapper as any)?.data || [];

  const currentUserProfile = useMemo(() => {
    if (!user || !profiles || profiles.length === 0) return null;
    const uname = String(user.username || "")
      .toLowerCase()
      .trim();
    const uemail = String((user as any)?.email || "")
      .toLowerCase()
      .trim();
    return profiles.find((p: any) => {
      if (p.profileId && String(p.profileId).toLowerCase().trim() === uname)
        return true;
      if (uemail && p.email && String(p.email).toLowerCase().trim() === uemail)
        return true;
      const fullName = `${p.firstName || ""} ${p.lastName || ""}`
        .toLowerCase()
        .trim();
      if (fullName && fullName === uname) return true;
      return false;
    });
  }, [user, profiles]);

  const effectiveAssignedTo =
    scopeFilter === "me"
      ? currentUserProfile?.id
        ? String(currentUserProfile.id)
        : "me"
      : scopeFilter === "unassigned"
        ? "unassigned"
        : undefined;

  // Filters shared by the list, the kanban and the Excel export.
  const ticketFilters = {
    propertyId: effectivePropertyId,
    search: debouncedSearch || undefined,
    priority: priorityFilter || undefined,
    category: categoryFilter === "all" ? undefined : categoryFilter,
    assignedTo: effectiveAssignedTo,
    assignedToProfileId: currentUserProfile?.id,
    fromDate: fromDate || undefined,
    toDate: toDate || undefined,
  };
  const liveQueryOptions = {
    refetchOnMount: true,
    staleTime: 0,
    refetchInterval: 5000,
    refetchIntervalInBackground: true,
    refetchOnWindowFocus: true,
  } as const;

  // Kanban: every active ticket (open / in progress / pending), however old,
  // plus the most recent finished ones. The list view pages normally.
  const isKanban = viewMode === "kanban";
  const pickStatuses = (statuses: string[]) =>
    statusFilter === "all"
      ? statuses
      : statuses.filter((s) => s === statusFilter);
  const kanbanActiveStatuses = pickStatuses(["open", "in_progress", "pending"]);
  const kanbanDoneStatuses = pickStatuses(["resolved", "closed"]);
  const KANBAN_ACTIVE_LIMIT = 5000;
  const KANBAN_DONE_LIMIT = 200;

  const mainListParams = isKanban
    ? {
        ...ticketFilters,
        page: 1,
        limit: KANBAN_ACTIVE_LIMIT,
        status: kanbanActiveStatuses.join(",") || undefined,
      }
    : {
        ...ticketFilters,
        page: currentPage,
        limit: pageSize,
        status: statusFilter === "all" ? undefined : statusFilter,
      };
  const { data: mainTicketsWrapper, isLoading } = useListMaintenance(
    mainListParams as any,
    {
      query: {
        queryKey: getListMaintenanceQueryKey(mainListParams as any),
        enabled: !isKanban || kanbanActiveStatuses.length > 0,
        ...liveQueryOptions,
      },
    },
  );

  const doneListParams = {
    ...ticketFilters,
    page: 1,
    limit: KANBAN_DONE_LIMIT,
    status: kanbanDoneStatuses.join(","),
  };
  const { data: doneTicketsWrapper } = useListMaintenance(
    doneListParams as any,
    {
      query: {
        queryKey: getListMaintenanceQueryKey(doneListParams as any),
        enabled: isKanban && kanbanDoneStatuses.length > 0,
        ...liveQueryOptions,
      },
    },
  );

  const unwrapTickets = (w: any): any[] =>
    Array.isArray(w) ? w : (w?.data as any[]) || [];
  // In kanban mode the main query may be disabled (only finished statuses
  // picked); the status counts then come from the finished-tickets query.
  const allTicketsWrapper =
    isKanban && kanbanActiveStatuses.length === 0
      ? doneTicketsWrapper
      : mainTicketsWrapper;
  const kanbanDoneTickets =
    isKanban && kanbanDoneStatuses.length > 0
      ? unwrapTickets(doneTicketsWrapper)
      : [];
  const allTickets = useMemo(
    () =>
      isKanban
        ? [
            ...(kanbanActiveStatuses.length > 0
              ? unwrapTickets(mainTicketsWrapper)
              : []),
            ...kanbanDoneTickets,
          ]
        : unwrapTickets(mainTicketsWrapper),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [isKanban, mainTicketsWrapper, doneTicketsWrapper, statusFilter],
  );
  const paginationData = (allTicketsWrapper as any)?.pagination || {
    total: allTickets?.length || 0,
    page: currentPage,
    limit: pageSize,
  };

  const { data: _roomsWrapper } = useAllRows(
    "/api/rooms",
    {
      propertyId:
        activePropertyId && activePropertyId !== "all"
          ? activePropertyId
          : undefined,
    },
    { enabled: !!activePropertyId && activePropertyId !== "all" },
  );
  const rooms: any[] = Array.isArray(_roomsWrapper)
    ? _roomsWrapper
    : ((_roomsWrapper as any)?.data as any[]) || [];

  // Rooms specifically for modal's selected property
  const selectedModalPropId =
    parseInt(formPropertyId, 10) ||
    (activePropertyId !== "all" ? activePropertyId : properties[0]?.id);
  const { data: _modalRoomsWrapper } = useAllRows(
    "/api/rooms",
    { propertyId: selectedModalPropId },
    { enabled: !!selectedModalPropId },
  );
  const modalRooms: any[] = Array.isArray(_modalRoomsWrapper)
    ? _modalRoomsWrapper
    : ((_modalRoomsWrapper as any)?.data as any[]) || [];

  const { data: assignments } = useListAssignments(
    {
      propertyId:
        activePropertyId && activePropertyId !== "all"
          ? activePropertyId
          : undefined,
    } as any,
    {
      query: {
        enabled: !!activePropertyId && activePropertyId !== "all",
      } as any,
    },
  );

  // Build room -> occupant name(s) map from active assignments + profiles
  const roomOccupantMap = useMemo(() => {
    const empLookup = Object.fromEntries(
      profiles.map((e: any) => [e.id, `${e.firstName} ${e.lastName}`]),
    );
    const map: Record<number, string> = {};
    (assignments || []).forEach((a: any) => {
      if (a.status === "ACTIVE" && a.roomId) {
        // Assignments carry the resident's name; the profile list (capped)
        // is only a fallback for older APIs.
        const own =
          `${a.profileFirstName || ""} ${a.profileLastName || ""}`.trim();
        const name = own || empLookup[a.profileId];
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

  const invalidate = () => {
    queryClient.invalidateQueries({
      predicate: (q) => {
        const k = q.queryKey;
        return (
          Array.isArray(k) &&
          (k[0] === "/api/maintenance" ||
            k[0] === "/api/rooms" ||
            k[0] === "rooms" ||
            (typeof k[0] === "string" &&
              (k[0].includes("maintenance") || k[0].includes("rooms"))))
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
      const list = Array.isArray(data?.data)
        ? data.data
        : Array.isArray(data)
          ? data
          : [];
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
        toast.success(
          ar ? "تم إنشاء الطلب بنجاح" : "Ticket created successfully",
        );
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
      onMutate: async (variables: any) => {
        // إلغاء أي استعلامات قيد التنفيذ حتى لا تدوس على التحديث الفوري
        await queryClient.cancelQueries({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            typeof q.queryKey[0] === "string" &&
            q.queryKey[0].includes("maintenance"),
        });

        const previousData = queryClient.getQueriesData({
          predicate: (q) =>
            Array.isArray(q.queryKey) &&
            typeof q.queryKey[0] === "string" &&
            q.queryKey[0].includes("maintenance"),
        });

        // تحديث الكاش محلياً فوراً بـ 0ms تأخير
        queryClient.setQueriesData(
          {
            predicate: (q) =>
              Array.isArray(q.queryKey) &&
              typeof q.queryKey[0] === "string" &&
              q.queryKey[0].includes("maintenance"),
          },
          (old: any) => {
            if (!old) return old;
            const updateItem = (item: any) => {
              if (item && item.id === variables.id) {
                return {
                  ...item,
                  ...variables.data,
                  ...(variables.data?.status === "resolved"
                    ? { resolvedAt: new Date().toISOString() }
                    : {}),
                  ...(variables.data?.status === "in_progress" &&
                  !item.startedAt
                    ? { startedAt: new Date().toISOString() }
                    : {}),
                };
              }
              return item;
            };

            if (Array.isArray(old)) {
              return old.map(updateItem);
            }
            if (old.data && Array.isArray(old.data)) {
              return {
                ...old,
                data: old.data.map(updateItem),
              };
            }
            return old;
          },
        );

        return { previousData };
      },
      onError: (err: any, _vars, context: any) => {
        if (context?.previousData) {
          context.previousData.forEach(([queryKey, data]: any) => {
            queryClient.setQueryData(queryKey, data);
          });
        }
        toast.error(ar ? "خطأ في تحديث الطلب" : "Error updating ticket", {
          description: err.message,
        });
      },
      onSuccess: () => {
        toast.success(
          ar ? "تم تحديث الطلب بنجاح" : "Ticket updated successfully",
        );
      },
      onSettled: () => {
        invalidate();
      },
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
      problemType:
        defaultCreateCategory === "housekeeping" ? "room_cleaning" : "Plumbing",
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
      (activePropertyId && activePropertyId !== "all"
        ? activePropertyId
        : properties[0]?.id);

    if (!targetPropId) {
      toast.error(
        ar
          ? "يرجى اختيار الـ Resident أولاً"
          : "Please select a Resident first",
      );
      return;
    }
    if (!form.roomId || !form.description.trim()) {
      toast.error(
        ar
          ? "يرجى تحديد الغرفة وكتابة وصف للطلب"
          : "Please select a room and provide a description",
      );
      return;
    }
    createMutation.mutate({
      data: {
        propertyId: targetPropId,
        roomId: parseInt(form.roomId),
        category: form.category,
        problemType:
          form.problemType ||
          (form.category === "housekeeping" ? "room_cleaning" : "Plumbing"),
        description: form.description.trim(),
        priority: form.priority,
        photoUrl: formPhotoUrl || undefined,
        workerId: form.workerId ? parseInt(form.workerId) : undefined,
      } as any,
    });
  };

  const COLS = TICKET_COLS;

  const { visible, toggle, showAll, hideAll, isVisible } =
    useColumnVisibility(COLS);

  const isColVisible = (key: string) => {
    if (key === "property") {
      return isVisible("property") || propertyFilter === "all";
    }
    return isVisible(key);
  };

  const roomMap = Object.fromEntries(
    (rooms || []).map((r: any) => [r.id, r.roomNumber]),
  );

  const empOptions = profiles.filter((e: any) => e.status === "active");

  const filtered = useMemo(
    () =>
      Array.isArray(allTickets) ? [...allTickets].sort(newestTicketFirst) : [],
    [allTickets],
  );
  const paged = filtered;

  // Status tab totals come from the API: every ticket matching the other
  // filters, per status (not just the rows on this page). Older APIs without
  // statusCounts fall back to counting this page.
  const serverCounts = (allTicketsWrapper as any)?.statusCounts as
    | {
        all: number;
        open: number;
        in_progress: number;
        resolved: number;
        closed: number;
      }
    | undefined;
  const countPage = (status: string) =>
    allTickets?.filter((t: any) => t.status === status).length || 0;
  const totalCount = serverCounts?.all ?? (paginationData.total || 0);
  const openCount = serverCounts?.open ?? countPage("open");
  const inProgressCount = serverCounts?.in_progress ?? countPage("in_progress");
  const resolvedCount = serverCounts?.resolved ?? countPage("resolved");
  const closedCount = serverCounts?.closed ?? countPage("closed");

  // Exports every ticket matching the filters, not just the rows on screen.
  const [isExporting, setIsExporting] = useState(false);
  const exportExcel = async () => {
    if (isExporting) return;
    setIsExporting(true);
    try {
      const EXPORT_PAGE = 5000;
      const rows: any[] = [];
      for (let page = 1; ; page++) {
        const res: any = await listMaintenance({
          ...ticketFilters,
          status: statusFilter === "all" ? undefined : statusFilter,
          page,
          limit: EXPORT_PAGE,
        } as any);
        const batch = unwrapTickets(res);
        rows.push(...batch);
        const total = Number(res?.pagination?.total ?? rows.length);
        if (batch.length < EXPORT_PAGE || rows.length >= total) break;
      }
      exportTicketsExcel(rows.sort(newestTicketFirst), {
        ar,
        properties,
        roomMap,
        roomOccupantMap,
      });
    } catch (err: any) {
      toast.error(ar ? "تعذّر تصدير البلاغات" : "Could not export tickets", {
        description: err?.message,
      });
    } finally {
      setIsExporting(false);
    }
  };

  const exportSelectedTicketsExcel = () => {
    exportSelectedTicketsExcelUtil(allTickets, selectedTicketIds, {
      ar,
      properties,
      roomMap,
      roomOccupantMap,
    });
  };

  const handleBulkStatusChange = async (newStatus: string) => {
    if (selectedTicketIds.size === 0) return;
    setBulkStatusLoading(true);
    try {
      const ids = Array.from(selectedTicketIds);
      await Promise.all(
        ids.map((id) => {
          const t = allTickets.find((item: any) => item.id === id);
          const pId =
            t?.propertyId ||
            (activePropertyId !== "all" ? activePropertyId : undefined);
          return updateMutation.mutateAsync({
            id,
            data: { status: newStatus, propertyId: pId } as any,
            params: pId ? { propertyId: pId } : undefined,
          } as any);
        }),
      );
      toast.success(
        ar
          ? `تم تحديث حالة ${ids.length} تذكرة بنجاح`
          : `Updated status for ${ids.length} ticket(s)`,
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
        ids.map((id) => {
          const t = allTickets.find((item: any) => item.id === id);
          const pId =
            t?.propertyId ||
            (activePropertyId !== "all" ? activePropertyId : undefined);
          return deleteMutation.mutateAsync({
            id,
            params: pId ? { propertyId: pId } : undefined,
          } as any);
        }),
      );
      toast.success(
        ar
          ? `تم حذف ${ids.length} تذكرة بنجاح`
          : `Deleted ${ids.length} ticket(s)`,
      );
      setSelectedTicketIds(new Set());
    } catch {
      toast.error(ar ? "فشل الحذف الجماعي" : "Bulk delete failed");
    }
  };

  const hasActiveFilters = Boolean(
    searchTerm ||
    categoryFilter !==
      (isOnlyHousekeeping
        ? "housekeeping"
        : isOnlyMaintenance
          ? "maintenance"
          : "all") ||
    statusFilter !== "all" ||
    priorityFilter ||
    scopeFilter !== "all" ||
    (propertyFilter && propertyFilter !== "all") ||
    fromDate ||
    toDate,
  );

  const clearAllFilters = () => {
    setSearchTerm("");
    setCategoryFilter(
      isOnlyHousekeeping
        ? "housekeeping"
        : isOnlyMaintenance
          ? "maintenance"
          : "all",
    );
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
      <TicketsHeader
        ar={ar}
        isOnlyHousekeeping={isOnlyHousekeeping}
        isOnlyMaintenance={isOnlyMaintenance}
        canCreateAny={canCreateAny}
        onCreate={() => setIsOpen(true)}
      />

      {/* Status & Category Metric Tabs Strip */}
      <TicketsStatusStrip
        ar={ar}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        totalCount={totalCount}
        openCount={openCount}
        inProgressCount={inProgressCount}
        resolvedCount={resolvedCount}
        closedCount={closedCount}
        hasBoth={hasBoth}
        canViewMnt={canViewMnt}
        canViewHsk={canViewHsk}
        isOnlyMaintenance={isOnlyMaintenance}
        isOnlyHousekeeping={isOnlyHousekeeping}
      />

      {/* 2-Row Filter Grid (Opera / HotSOS Hotel Standard) */}
      <TicketsFilterPanel
        ar={ar}
        properties={properties}
        propertyFilter={propertyFilter}
        setPropertyFilter={setPropertyFilter}
        fromDate={fromDate}
        setFromDate={setFromDate}
        toDate={toDate}
        setToDate={setToDate}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        priorityFilter={priorityFilter}
        setPriorityFilter={setPriorityFilter}
        scopeFilter={scopeFilter}
        setScopeFilter={setScopeFilter}
        creatorTypeFilter={creatorTypeFilter}
        setCreatorTypeFilter={setCreatorTypeFilter}
        hasBoth={hasBoth}
        canViewMnt={canViewMnt}
        canViewHsk={canViewHsk}
        hasActiveFilters={hasActiveFilters}
        clearAllFilters={clearAllFilters}
      />

      {/* Action & Search Bar */}
      <TicketsToolbar
        ar={ar}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        viewMode={viewMode}
        onSetViewMode={handleSetViewMode}
        onExportExcel={exportExcel}
        isExporting={isExporting}
        cols={COLS}
        visible={visible}
        toggle={toggle}
        showAll={showAll}
        hideAll={hideAll}
      />

      {/* New Ticket Dialog */}
      <NewTicketDialog
        open={isOpen}
        onOpenChange={(v) => {
          setIsOpen(v);
          if (!v) resetForm();
        }}
        onCancel={() => setIsOpen(false)}
        ar={ar}
        properties={properties}
        formPropertyId={formPropertyId}
        setFormPropertyId={setFormPropertyId}
        form={form}
        setForm={setForm}
        allowedCreateCategories={allowedCreateCategories}
        modalRooms={modalRooms}
        rooms={rooms}
        roomOccupantMap={roomOccupantMap}
        formWorkers={formWorkers}
        formPhotoUrl={formPhotoUrl}
        setFormPhotoUrl={setFormPhotoUrl}
        onSubmit={onSubmit}
        isPending={createMutation.isPending}
      />

      {/* Main Content Area: Kanban Board vs Data Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full mx-4 sm:mx-6" />
      ) : viewMode === "kanban" ? (
        <div className="px-4 sm:px-6">
          <TicketsKanbanBoard
            tickets={filtered}
            ar={ar}
            onSelectTicket={handleSelectTicket}
            onQuickStatusChange={(id, newStatus, propertyId) => {
              const targetTicket = allTickets?.find((t: any) => t.id === id);
              const pId =
                propertyId ||
                targetTicket?.propertyId ||
                (activePropertyId !== "all" ? activePropertyId : undefined);
              updateMutation.mutate({
                id,
                data: { status: newStatus, propertyId: pId } as any,
                params: pId ? { propertyId: pId } : undefined,
              } as any);
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
            columnTotals={
              serverCounts
                ? {
                    resolved: serverCounts.resolved,
                    closed: serverCounts.closed,
                  }
                : undefined
            }
            formatDuration={(st, res, rep) => formatDuration(st, res, rep, ar)}
            getDurationColor={getDurationColor}
          />
        </div>
      ) : (
        <div className="px-4 sm:px-6 pb-6 space-y-4">
          {/* Bulk Action Bar */}
          <TicketsBulkActions
            ar={ar}
            count={selectedTicketIds.size}
            onClear={() => setSelectedTicketIds(new Set())}
            onExportExcel={exportSelectedTicketsExcel}
            canEditAny={canEditAny}
            canDeleteAny={canDeleteAny}
            bulkStatusLoading={bulkStatusLoading}
            onBulkStatusChange={handleBulkStatusChange}
            onBulkDelete={handleBulkDelete}
          />

          <TicketsTable
            ar={ar}
            paged={paged}
            filtered={filtered}
            selectedTicketIds={selectedTicketIds}
            setSelectedTicketIds={setSelectedTicketIds}
            visible={visible}
            isVisible={isVisible}
            isColVisible={isColVisible}
            onSelectTicket={handleSelectTicket}
            onDeleteTicket={(id) => setDeleteId(id)}
            roomMap={roomMap}
            properties={properties}
            isSuperAdmin={isSuperAdmin}
            isAdmin={isAdmin}
            canDeleteHsk={canDeleteHsk}
            canDeleteMnt={canDeleteMnt}
            categoryFilter={categoryFilter}
            onClearEmptyFilters={() => {
              setSearchTerm("");
              if (!isOnlyHousekeeping && !isOnlyMaintenance) {
                setCategoryFilter("all");
              }
              setStatusFilter("all");
              setPriorityFilter("");
            }}
            paginationData={paginationData}
            pageSize={pageSize}
            onPageSizeChange={(size) => {
              setPageSize(size);
              setCurrentPage(1);
            }}
            currentPage={currentPage}
            onPageChange={setCurrentPage}
          />
        </div>
      )}

      {/* Lightbox */}
      <TicketPhotoLightbox
        ar={ar}
        photoUrl={photoDialog}
        onClose={() => setPhotoDialog(null)}
      />

      {/* Delete Confirmation */}
      <TicketDeleteDialog
        ar={ar}
        open={deleteId !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteId(null);
        }}
        onConfirm={() => {
          if (deleteId) {
            const targetTicket = allTickets?.find(
              (t: any) => t.id === deleteId,
            );
            const pId =
              targetTicket?.propertyId ||
              (activePropertyId !== "all" ? activePropertyId : undefined);
            deleteMutation.mutate({
              id: deleteId,
              params: pId ? { propertyId: pId } : undefined,
            } as any);
          }
        }}
      />

      {/* Ticket Detail Modal */}
      {(() => {
        if (selectedTicketId === null) return null;
        const selectedTicket = allTickets?.find(
          (t: any) => t.id === selectedTicketId,
        );
        if (!selectedTicket) return null;
        const canEditSelectedTicket =
          isSuperAdmin ||
          isAdmin ||
          (selectedTicket?.category === "housekeeping"
            ? canEditHsk
            : canEditMnt);
        return (
          <TicketDetailModal
            open={true}
            onClose={() => setSelectedTicketId(null)}
            ticket={selectedTicket}
            occupantName={
              selectedTicket
                ? roomOccupantMap[selectedTicket.roomId]
                : undefined
            }
            profiles={empOptions}
            workers={propertyWorkers}
            ar={ar}
            canEdit={canEditSelectedTicket}
            onStatusChange={(id, data) => {
              const targetTicket = allTickets?.find((t: any) => t.id === id);
              const pId =
                targetTicket?.propertyId ||
                (activePropertyId !== "all" ? activePropertyId : undefined);
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
              const pId =
                targetTicket?.propertyId ||
                (activePropertyId !== "all" ? activePropertyId : undefined);
              updateMutation.mutate({
                id,
                data: {
                  assignedTo: empId,
                  propertyId: pId,
                } as any,
              });
            }}
            onWorkerAssignChange={(id, workerId) => {
              const targetTicket = allTickets?.find((t: any) => t.id === id);
              const pId =
                targetTicket?.propertyId ||
                (activePropertyId !== "all" ? activePropertyId : undefined);
              updateMutation.mutate({
                id,
                data: {
                  workerId,
                  propertyId: pId,
                } as any,
              });
            }}
            subTickets={subTickets}
            loadingSubTickets={loadingSubTickets}
            onCreateSubTicket={
              canEditSelectedTicket
                ? (parentId, data) => {
                    const parentTicket = allTickets?.find(
                      (t: any) => t.id === parentId,
                    );
                    const pId =
                      parentTicket?.propertyId ||
                      (activePropertyId !== "all"
                        ? activePropertyId
                        : properties[0]?.id);
                    createMutation.mutate({
                      data: {
                        propertyId: pId,
                        roomId: parentTicket?.roomId,
                        category: parentTicket?.category || "maintenance",
                        problemType: data.problemType,
                        description: data.description,
                        priority: data.priority,
                        parentId,
                      } as any,
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
