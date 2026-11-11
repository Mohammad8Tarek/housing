// State, effects and handlers of UsersPage (moved verbatim).
import { useState, useMemo } from "react";
import {
  useListUsers,
  useListProperties,
  useDeleteUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useLocation } from "wouter";
import { useDebounce } from "@/hooks/use-debounce";
import { getExportFileName } from "@/lib/date-utils";
import { toast } from "sonner";
import {
  ShieldCheck,
  Users,
  Crown,
  Briefcase,
  Headphones,
  Wrench,
  Sparkles,
} from "lucide-react";
import { usePermission } from "@/hooks/use-permission";
import { useColumnVisibility } from "@/components/ui/column-chooser";
import * as XLSX from "xlsx";

export function useUsersPageState() {
  const [, setLocation] = useLocation();
  const { user: currentUser } = useAuth();
  const {
    isSuperAdmin,
    properties: ctxProperties,
    canSeeAllProperties,
    buildNavHref,
  } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { can, isAdmin } = usePermission();
  const showPropertyCol =
    isSuperAdmin ||
    Boolean(canSeeAllProperties) ||
    (ctxProperties && ctxProperties.length > 1) ||
    can("users", "view");

  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<"all" | "workflow">(
    "all",
  );
  const [signedFilter, setSignedFilter] = useState<"all" | "signed">("all");
  const [customPermsFilter, setCustomPermsFilter] = useState(false);

  // Bulk Operations State
  const [bulkRoleModalOpen, setBulkRoleModalOpen] = useState(false);
  const [bulkPropModalOpen, setBulkPropModalOpen] = useState(false);
  const [selectedBulkRole, setSelectedBulkRole] = useState("manager");
  const [selectedBulkProps, setSelectedBulkProps] = useState<number[]>([]);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<"users" | "matrix">(
    "users",
  );
  const [matrixTargetUserId, setMatrixTargetUserId] = useState<number | null>(
    null,
  );

  // Direct navigation to Dedicated User Details & Governance Hub (/users/:id)
  const openUserSheet = (
    u: any,
    tab:
      | "profile"
      | "properties"
      | "permissions"
      | "signature"
      | "audit" = "profile",
  ) => {
    setLocation(buildNavHref(`/users/${u.id}?tab=${tab}`));
  };

  const debouncedSearch = useDebounce(searchQuery, 500);

  const {
    data: _apiResponseWrapper,
    isLoading,
    isError,
    refetch,
  } = useListUsers({
    page: currentPage,
    limit: pageSize as any,
    search: debouncedSearch,
    role: roleFilter,
    status: statusFilter,
  } as any);
  const { data: properties } = useListProperties();
  const { data: allUsersRes } = useListUsers({ limit: 500 } as any);

  const users: any[] = Array.isArray(_apiResponseWrapper)
    ? _apiResponseWrapper
    : (((_apiResponseWrapper as any)?.data as any[]) ?? []);
  const allUsers: any[] = Array.isArray(allUsersRes)
    ? allUsersRes
    : (((allUsersRes as any)?.data as any[]) ?? users);
  const pagination = (_apiResponseWrapper as any)?.pagination;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const [unlockingUserId, setUnlockingUserId] = useState<number | null>(null);

  const isUserLocked = (u: any) => {
    const st = String(u.status || "").toUpperCase();
    return (
      st === "LOCKED" ||
      Boolean(u.lockedUntil && new Date(u.lockedUntil) > new Date())
    );
  };

  const isUserActive = (u: any) => {
    if (isUserLocked(u)) return false;
    const st = String(u.status || "").toUpperCase();
    return st === "ACTIVE" || st === "";
  };

  const handleUnlockUser = async (u: any) => {
    if (!u?.id) return;
    setUnlockingUserId(u.id);
    try {
      const res = await fetch(`/api/users/${u.id}/unlock`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(
          err.error || (ar ? "فشل فتح قفل الحساب" : "Failed to unlock user"),
        );
      }
      toast.success(
        ar
          ? `تم فتح قفل حساب ${u.username} بنجاح وإعادة تفعيله`
          : `User ${u.username} unlocked and reactivated successfully`,
      );
      invalidate();
      refetch();
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "فشل فتح قفل الحساب" : "Failed to unlock user"),
      );
    } finally {
      setUnlockingUserId(null);
    }
  };

  // ── Optimized Stats (Single Pass across all accounts) ──
  const stats = useMemo(() => {
    const all = allUsers && allUsers.length > 0 ? allUsers : users || [];
    const s = {
      total: all.length,
      superAdmin: 0,
      admin: 0,
      manager: 0,
      receptionist: 0,
      maintenance: 0,
      housekeeping: 0,
      active: 0,
      locked: 0,
      inactive: 0,
      workflowUsers: 0,
      signedWorkflowUsers: 0,
      customPermissionUsers: 0,
      customPermissionTotal: 0,
    };
    for (const u of all) {
      if (isUserLocked(u)) {
        s.locked++;
      } else if (isUserActive(u)) {
        s.active++;
      } else {
        s.inactive++;
      }
      if (u.jobTitle && u.jobTitle !== "none") s.workflowUsers++;
      if (u.jobTitle && u.jobTitle !== "none" && u.hasSignature)
        s.signedWorkflowUsers++;
      if ((u.permissions || []).length > 0) {
        s.customPermissionUsers++;
        s.customPermissionTotal += (u.permissions || []).length;
      }
      const roles = u.roles || [];
      if (roles.some((r: string) => r.toLowerCase() === "super_admin"))
        s.superAdmin++;
      if (roles.some((r: string) => r.toLowerCase() === "admin")) s.admin++;
      if (roles.some((r: string) => r.toLowerCase() === "manager")) s.manager++;
      if (roles.some((r: string) => r.toLowerCase() === "receptionist"))
        s.receptionist++;
      if (roles.some((r: string) => r.toLowerCase() === "maintenance_staff"))
        s.maintenance++;
      if (roles.some((r: string) => r.toLowerCase() === "housekeeping_staff"))
        s.housekeeping++;
    }
    return s;
  }, [allUsers, users]);

  const ROLE_TABS = [
    { id: "all", label: ar ? "الكل" : "All", icon: Users, count: stats.total },
    {
      id: "super_admin",
      label: ar ? "سوبر ادمن" : "Super Admin",
      icon: Crown,
      count: stats.superAdmin,
    },
    {
      id: "admin",
      label: ar ? "ادمن" : "Admin",
      icon: ShieldCheck,
      count: stats.admin,
    },
    {
      id: "manager",
      label: ar ? "مدير" : "Manager",
      icon: Briefcase,
      count: stats.manager,
    },
    {
      id: "receptionist",
      label: ar ? "استقبال" : "Receptionist",
      icon: Headphones,
      count: stats.receptionist,
    },
    {
      id: "maintenance_staff",
      label: ar ? "صيانة" : "Maintenance",
      icon: Wrench,
      count: stats.maintenance,
    },
    {
      id: "housekeeping_staff",
      label: ar ? "نظافة" : "Housekeeping",
      icon: Sparkles,
      count: stats.housekeeping,
    },
  ];

  const USER_COLS = [
    {
      key: "username",
      label: "Username",
      labelAr: "اسم المستخدم",
      defaultVisible: true,
    },
    {
      key: "email",
      label: "Email",
      labelAr: "البريد الإلكتروني",
      defaultVisible: true,
    },
    { key: "phone", label: "Phone", labelAr: "الهاتف", defaultVisible: true },
    {
      key: "nationalId",
      label: "National ID",
      labelAr: "الرقم القومي",
      defaultVisible: true,
    },
    { key: "roles", label: "Roles", labelAr: "الأدوار", defaultVisible: false },
    {
      key: "workflowRole",
      label: "Workflow Role",
      labelAr: "منصب مسار العمل",
      defaultVisible: true,
    },
    {
      key: "signature",
      label: "Signature",
      labelAr: "التوقيع",
      defaultVisible: true,
    },
    {
      key: "property",
      label: "Property",
      labelAr: "الفرع",
      defaultVisible: true,
    },
    {
      key: "permissions",
      label: "Permissions",
      labelAr: "الصلاحيات",
      defaultVisible: false,
    },
    { key: "status", label: "Status", labelAr: "الحالة", defaultVisible: true },
    {
      key: "actions",
      label: "Actions",
      labelAr: "إجراءات",
      defaultVisible: true,
      fixed: true,
    },
  ];
  const {
    visible: uVisible,
    toggle: uToggle,
    showAll: uShowAll,
    hideAll: uHideAll,
    isVisible: isUVisible,
  } = useColumnVisibility(USER_COLS);

  const filteredUsers = useMemo(() => {
    let list = users;
    if (workflowFilter === "workflow") {
      list = list.filter((u: any) => u.jobTitle && u.jobTitle !== "none");
    }
    if (signedFilter === "signed") {
      list = list.filter(
        (u: any) => u.jobTitle && u.jobTitle !== "none" && u.hasSignature,
      );
    }
    if (customPermsFilter) {
      list = list.filter((u: any) => (u.permissions || []).length > 0);
    }
    return list;
  }, [users, workflowFilter, signedFilter, customPermsFilter]);

  const pagedUsers = filteredUsers;
  const pagedUserIds = pagedUsers.map((u: any) => u.id);
  const allUserPageSelected =
    pagedUserIds.length > 0 &&
    pagedUserIds.every((id: number) => selectedRows.has(id));

  const toggleSelectAllUser = () => {
    if (allUserPageSelected) {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedUserIds.forEach((id: number) => next.delete(id));
        return next;
      });
    } else {
      setSelectedRows((prev) => {
        const next = new Set(prev);
        pagedUserIds.forEach((id: number) => next.add(id));
        return next;
      });
    }
  };

  const toggleUserRow = (id: number) => {
    setSelectedRows((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const exportUserExcel = () => {
    const all: any[] = users || [];
    const target =
      selectedRows.size > 0
        ? all.filter((u: any) => selectedRows.has(u.id))
        : all;
    const rows = target.map((u: any) => ({
      Username: u.username,
      National_ID: u.nationalId || u.national_id || "",
      Email: u.email || "",
      Phone: u.phone || "",
      Roles: (u.roles || []).join(", "),
      Status: u.status ?? "",
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Users");
    XLSX.writeFile(wb, getExportFileName("Users", "xlsx"));
  };

  const handleBulkRoleChange = async () => {
    if (selectedRows.size === 0 || !selectedBulkRole) return;
    setIsBulkExecuting(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedRows),
          action: "role",
          role: selectedBulkRole,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to update roles");
      toast.success(
        ar
          ? `تم تحديث دور ${selectedRows.size} مستخدم بنجاح`
          : `Updated roles for ${selectedRows.size} users`,
      );
      setBulkRoleModalOpen(false);
      setSelectedRows(new Set());
      invalidate();
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "فشل التحديث الجماعي" : "Bulk update failed"),
      );
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleBulkPropertiesChange = async () => {
    if (selectedRows.size === 0) return;
    setIsBulkExecuting(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedRows),
          action: "properties",
          propertyIds: selectedBulkProps,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assign properties");
      toast.success(
        ar
          ? `تم تعيين الفروع لـ ${selectedRows.size} مستخدم بنجاح`
          : `Assigned properties to ${selectedRows.size} users`,
      );
      setBulkPropModalOpen(false);
      setSelectedRows(new Set());
      invalidate();
    } catch (err: any) {
      toast.error(
        err.message ||
          (ar ? "فشل تعيين الفروع" : "Failed to assign properties"),
      );
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const handleBulkUnlock = async () => {
    if (selectedRows.size === 0) return;
    setIsBulkExecuting(true);
    try {
      const res = await fetch("/api/users/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ids: Array.from(selectedRows),
          action: "status",
          status: "UNLOCK",
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to unlock users");
      toast.success(
        ar
          ? `تم فك قفل ${selectedRows.size} مستخدم بنجاح`
          : `Unlocked ${selectedRows.size} users`,
      );
      setSelectedRows(new Set());
      invalidate();
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "فشل فك القفل" : "Failed to unlock users"),
      );
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const bulkDeleteUserMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(
          ar ? "تم حذف المستخدمين المحددين" : "Selected users deleted",
        );
      },
      onError: (err: any) => {
        toast.error(
          err?.message ||
            (ar ? "فشل حذف المستخدمين" : "Failed to delete users"),
        );
      },
    },
  });
  return {
    setLocation,
    currentUser,
    isSuperAdmin,
    ctxProperties,
    canSeeAllProperties,
    buildNavHref,
    language,
    ar,
    queryClient,
    can,
    isAdmin,
    showPropertyCol,
    deleteUser,
    setDeleteUser,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    selectedRows,
    setSelectedRows,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    workflowFilter,
    setWorkflowFilter,
    signedFilter,
    setSignedFilter,
    customPermsFilter,
    setCustomPermsFilter,
    bulkRoleModalOpen,
    setBulkRoleModalOpen,
    bulkPropModalOpen,
    setBulkPropModalOpen,
    selectedBulkRole,
    setSelectedBulkRole,
    selectedBulkProps,
    setSelectedBulkProps,
    isBulkExecuting,
    setIsBulkExecuting,
    activeMainTab,
    setActiveMainTab,
    matrixTargetUserId,
    setMatrixTargetUserId,
    openUserSheet,
    debouncedSearch,
    _apiResponseWrapper,
    isLoading,
    isError,
    refetch,
    properties,
    allUsersRes,
    users,
    allUsers,
    pagination,
    invalidate,
    unlockingUserId,
    setUnlockingUserId,
    isUserLocked,
    isUserActive,
    handleUnlockUser,
    stats,
    ROLE_TABS,
    USER_COLS,
    uVisible,
    uToggle,
    uShowAll,
    uHideAll,
    isUVisible,
    filteredUsers,
    pagedUsers,
    pagedUserIds,
    allUserPageSelected,
    toggleSelectAllUser,
    toggleUserRow,
    exportUserExcel,
    handleBulkRoleChange,
    handleBulkPropertiesChange,
    handleBulkUnlock,
    bulkDeleteUserMutation,
  };
}

export type UsersPageState = ReturnType<typeof useUsersPageState>;
