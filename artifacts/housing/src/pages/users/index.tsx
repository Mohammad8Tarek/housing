// @ts-nocheck
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
import { useDebounce } from "@/hooks/use-debounce";
import { getExportFileName } from "@/lib/date-utils";
import { toast } from "sonner";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Trash,
  UserCog,
  ShieldCheck,
  Shield,
  KeyRound,
  Building2,
  Search,
  Users,
  Crown,
  Briefcase,
  Headphones,
  Wrench,
  MoreVertical,
  Unlock,
  X,
  Pen,
  Upload,
  Fingerprint,
  Gauge,
  LockKeyhole,
  ClipboardCheck,
  AlertTriangle,
  Sparkles,
  Check,
  RefreshCw,
  Filter,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { PermissionGate } from "@/components/ui/permission-gate";
import { usePermission } from "@/hooks/use-permission";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import * as XLSX from "xlsx";
import { motion, AnimatePresence } from "framer-motion";
import { DataPagination } from "@/components/DataPagination";
import {
  ErrorState,
  EmptyState,
  TableSkeleton,
} from "@/components/ui/page-states";

// Import extracted components
import { PermissionMatrixDialog } from "./components/PermissionMatrixDialog";
import { PermissionMatrixCenter } from "./components/PermissionMatrixCenter";
import { EditUserDialog } from "./components/EditUserDialog";
import { EditPropertiesDialog } from "./components/EditPropertiesDialog";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { ResetPasswordDialog } from "./components/ResetPasswordDialog";
import { DeleteUserDialog } from "./components/DeleteUserDialog";
import { UnlockUserDialog } from "./components/UnlockUserDialog";
import { UploadSignatureDialog } from "./components/UploadSignatureDialog";
import { UserManagementSheet } from "./components/UserManagementSheet";

import { SYSTEM_ROLES, WORKFLOW_ROLES, roleColor } from "./utils";
const ALL_ROLES = [...SYSTEM_ROLES, ...WORKFLOW_ROLES];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { isSuperAdmin, properties: ctxProperties, canSeeAllProperties } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { can, isAdmin } = usePermission();
  const showPropertyCol = isSuperAdmin || Boolean(canSeeAllProperties) || (ctxProperties && ctxProperties.length > 1) || can("users", "view");

  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [matrixUser, setMatrixUser] = useState<any | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [workflowFilter, setWorkflowFilter] = useState<"all" | "workflow">("all");
  const [signedFilter, setSignedFilter] = useState<"all" | "signed">("all");
  const [customPermsFilter, setCustomPermsFilter] = useState(false);

  // Bulk Operations State
  const [bulkRoleModalOpen, setBulkRoleModalOpen] = useState(false);
  const [bulkPropModalOpen, setBulkPropModalOpen] = useState(false);
  const [selectedBulkRole, setSelectedBulkRole] = useState("manager");
  const [selectedBulkProps, setSelectedBulkProps] = useState<number[]>([]);
  const [isBulkExecuting, setIsBulkExecuting] = useState(false);
  const [editUser, setEditUser] = useState<any | null>(null);
  const [unlockUser, setUnlockUser] = useState<any | null>(null);
  const [editPropsUser, setEditPropsUser] = useState<any | null>(null);
  const [signatureUser, setSignatureUser] = useState<any | null>(null);
  const [activeMainTab, setActiveMainTab] = useState<"users" | "matrix">("users");
  const [matrixTargetUserId, setMatrixTargetUserId] = useState<number | null>(null);

  // Modern Unified User Management Drawer
  const [sheetUser, setSheetUser] = useState<any | null>(null);
  const [sheetTab, setSheetTab] = useState<"profile" | "properties" | "permissions" | "signature">("profile");

  const openUserSheet = (u: any, tab: "profile" | "properties" | "permissions" | "signature" = "profile") => {
    setSheetUser(u);
    setSheetTab(tab);
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
    status: statusFilter
  });
  const { data: properties } = useListProperties();
  const { data: allUsersRes } = useListUsers({ limit: 500 } as any);

  const users = _apiResponseWrapper?.data ?? [];
  const allUsers = allUsersRes?.data ?? users;
  const pagination = _apiResponseWrapper?.pagination;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const isUserLocked = (u: any) => u.status === "LOCKED";



  // ── Optimized Stats (Single Pass across all accounts) ──
  const stats = useMemo(() => {
    const all = (allUsers && allUsers.length > 0) ? allUsers : (users || []);
    const s = {
      total: all.length,
      superAdmin: 0,
      admin: 0,
      manager: 0,
      receptionist: 0,
      maintenance: 0,
      active: 0,
      locked: 0,
      inactive: 0,
      workflowUsers: 0,
      signedWorkflowUsers: 0,
      customPermissionUsers: 0,
      customPermissionTotal: 0,
    };
    for (const u of all) {
      if (u.status === "ACTIVE") s.active++;
      if (u.status === "LOCKED") s.locked++;
      if (u.status === "INACTIVE") s.inactive++;
      if (u.jobTitle && u.jobTitle !== "none") s.workflowUsers++;
      if (u.jobTitle && u.jobTitle !== "none" && u.hasSignature) s.signedWorkflowUsers++;
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
      list = list.filter((u: any) => u.jobTitle && u.jobTitle !== "none" && u.hasSignature);
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
      toast.error(err.message || (ar ? "فشل التحديث الجماعي" : "Bulk update failed"));
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
      toast.error(err.message || (ar ? "فشل تعيين الفروع" : "Failed to assign properties"));
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
      toast.error(err.message || (ar ? "فشل فك القفل" : "Failed to unlock users"));
    } finally {
      setIsBulkExecuting(false);
    }
  };

  const bulkDeleteUserMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(ar ? "تم حذف المستخدمين المحددين" : "Selected users deleted");
      },
      onError: (err: any) => {
        toast.error(err?.message || (ar ? "فشل حذف المستخدمين" : "Failed to delete users"));
      },
    },
  });

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Modern Unified Slide-Over Sheet Drawer */}
      {sheetUser && (
        <UserManagementSheet
          user={sheetUser}
          initialTab={sheetTab}
          properties={properties ?? []}
          allUsers={allUsers ?? []}
          onClose={() => setSheetUser(null)}
        />
      )}

      {/* Dynamic Dialogs */}
      {matrixUser && (
        <PermissionMatrixDialog
          user={matrixUser}
          onClose={() => setMatrixUser(null)}
        />
      )}
      {editUser && (
        <EditUserDialog
          user={editUser}
          properties={properties ?? []}
          onClose={() => setEditUser(null)}
        />
      )}
      {editPropsUser && (
        <EditPropertiesDialog
          user={editPropsUser}
          properties={properties ?? []}
          onClose={() => setEditPropsUser(null)}
          onSuccess={invalidate}
        />
      )}
      {resetUser && (
        <ResetPasswordDialog
          user={resetUser}
          onClose={() => setResetUser(null)}
        />
      )}
      {deleteUser && (
        <DeleteUserDialog
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
        />
      )}
      {unlockUser && (
        <UnlockUserDialog
          user={unlockUser}
          onClose={() => setUnlockUser(null)}
        />
      )}
      {signatureUser && (
        <UploadSignatureDialog
          user={signatureUser}
          onClose={() => setSignatureUser(null)}
        />
      )}

      {/* ── Enterprise Header ── */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#0F2A44] flex items-center justify-center">
              <Users className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">
                {ar ? "إدارة المستخدمين والصلاحيات" : "Users & Permissions"}
              </h1>
            </div>
          </div>
        </div>
        {activeMainTab === "users" && (
          <div className="flex items-center gap-2">
            <ColumnChooser
              cols={USER_COLS}
              visible={uVisible}
              onToggle={uToggle}
              onShowAll={uShowAll}
              onHideAll={uHideAll}
              ar={ar}
            />
            <PermissionGate module="users" action="create">
              <CreateUserDialog properties={properties ?? []} />
            </PermissionGate>
          </div>
        )}
      </div>

      {/* ── Main Section Tabs: Users List vs Permissions Center ── */}
      <div className="flex border-b overflow-x-auto no-scrollbar gap-2">
        <button
          type="button"
          onClick={() => setActiveMainTab("users")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeMainTab === "users"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{ar ? "قائمة المستخدمين والحسابات" : "Users & Accounts"}</span>
          <Badge variant="secondary" className="text-xs px-2 py-0 font-semibold ms-1">
            {stats.total}
          </Badge>
        </button>

        <PermissionGate module="users" action="manage_permissions">
          <button
            type="button"
            onClick={() => setActiveMainTab("matrix")}
            className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
              activeMainTab === "matrix"
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
            }`}
          >
            <ShieldCheck className="w-4 h-4 text-[#C9A24D]" />
            <span>{ar ? "مركز ومصفوفة الصلاحيات الشاملة" : "Permissions Center"}</span>
            <Badge
              variant="outline"
              className="text-xs px-2 py-0 font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 ms-1"
            >
              {stats.customPermissionUsers} {ar ? "مخصص" : "custom"}
            </Badge>
          </button>
        </PermissionGate>
      </div>

      {activeMainTab === "matrix" ? (
        <PermissionMatrixCenter
          users={allUsers}
          selectedUserId={matrixTargetUserId}
          onSelectUser={(uid) => setMatrixTargetUserId(uid)}
          properties={properties ?? []}
        />
      ) : (
        <>

      {/* ── Stats Cards ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {[
          {
            label: ar ? "إجمالي المستخدمين" : "Total Users",
            count: stats.total,
            icon: Users,
            color:
              "from-blue-500/10 to-blue-600/5 border-blue-200 dark:border-blue-800/40",
            iconColor: "text-blue-600 dark:text-blue-400",
          },
          {
            label: ar ? "سوبر أدمن" : "Super Admin",
            count: stats.superAdmin,
            icon: Crown,
            color:
              "from-purple-500/10 to-purple-600/5 border-purple-200 dark:border-purple-800/40",
            iconColor: "text-purple-600 dark:text-purple-400",
          },
          {
            label: ar ? "أدمن" : "Admin",
            count: stats.admin,
            icon: ShieldCheck,
            color:
              "from-red-500/10 to-red-600/5 border-red-200 dark:border-red-800/40",
            iconColor: "text-red-600 dark:text-red-400",
          },
          {
            label: ar ? "مدير" : "Manager",
            count: stats.manager,
            icon: Briefcase,
            color:
              "from-sky-500/10 to-sky-600/5 border-sky-200 dark:border-sky-800/40",
            iconColor: "text-sky-600 dark:text-sky-400",
          },
          {
            label: ar ? "استقبال" : "Receptionist",
            count: stats.receptionist,
            icon: Headphones,
            color:
              "from-green-500/10 to-green-600/5 border-green-200 dark:border-green-800/40",
            iconColor: "text-green-600 dark:text-green-400",
          },
          {
            label: ar ? "صيانة" : "Maintenance",
            count: stats.maintenance,
            icon: Wrench,
            color:
              "from-orange-500/10 to-orange-600/5 border-orange-200 dark:border-orange-800/40",
            iconColor: "text-orange-600 dark:text-orange-400",
          },
        ].map((card, i) => (
          <div
            key={i}
            className={`relative overflow-hidden rounded-xl border bg-gradient-to-br ${card.color} p-4 transition-all hover:shadow-md`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs font-medium text-muted-foreground">
                  {card.label}
                </p>
                <p className="text-2xl font-bold mt-1">{card.count}</p>
              </div>
              <card.icon className={`w-8 h-8 ${card.iconColor} opacity-60`} />
            </div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
        <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-7">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="flex items-center gap-2 text-base font-bold">
                <Gauge className="h-4 w-4 text-[#0F2A44]" />
                {ar ? "ملخص التشغيل والصلاحيات" : "Operations & Access Overview"}
              </h2>
              <p className="mt-1 text-sm text-muted-foreground">
                {ar
                  ? "نظرة سريعة على الحسابات، أدوار الاعتماد، والصلاحيات المخصصة."
                  : "A quick health check for accounts, approval roles, and custom access."}
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                setCustomPermsFilter((prev) => !prev);
                setCurrentPage(1);
              }}
              title={ar ? "تصفية المستخدمين ذوي الصلاحيات المخصصة" : "Filter users with custom permissions"}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md text-xs font-bold border transition-all cursor-pointer ${
                customPermsFilter
                  ? "bg-[#C9A24D] text-white border-[#C9A24D] shadow-sm"
                  : "bg-muted/50 text-muted-foreground border-border hover:bg-muted hover:text-foreground"
              }`}
            >
              <Sparkles className="w-3 h-3 text-[#C9A24D]" />
              <span>{stats.customPermissionTotal} {ar ? "صلاحية مخصصة" : "custom permissions"}</span>
              {customPermsFilter && <span className="text-[10px]">✕</span>}
            </button>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                id: "active",
                label: ar ? "نشط" : "Active",
                value: stats.active,
                icon: ShieldCheck,
                tone: "text-emerald-600 bg-emerald-50 border-emerald-100 dark:bg-emerald-950/20 dark:border-emerald-800/40",
                active: statusFilter === "ACTIVE",
                onClick: () => {
                  setStatusFilter((prev) => (prev === "ACTIVE" ? "all" : "ACTIVE"));
                  setCurrentPage(1);
                },
              },
              {
                id: "locked",
                label: ar ? "مقفول" : "Locked",
                value: stats.locked,
                icon: LockKeyhole,
                tone: "text-rose-600 bg-rose-50 border-rose-100 dark:bg-rose-950/20 dark:border-rose-800/40",
                active: statusFilter === "LOCKED",
                onClick: () => {
                  setStatusFilter((prev) => (prev === "LOCKED" ? "all" : "LOCKED"));
                  setCurrentPage(1);
                },
              },
              {
                id: "workflow",
                label: ar ? "أدوار اعتماد" : "Approval roles",
                value: stats.workflowUsers,
                icon: ClipboardCheck,
                tone: "text-amber-700 bg-amber-50 border-amber-100 dark:bg-amber-950/20 dark:border-amber-800/40",
                active: workflowFilter === "workflow",
                onClick: () => {
                  setWorkflowFilter((prev) => (prev === "workflow" ? "all" : "workflow"));
                  setCurrentPage(1);
                },
              },
              {
                id: "signed",
                label: ar ? "بتوقيع" : "Signed",
                value: stats.signedWorkflowUsers,
                icon: Fingerprint,
                tone: "text-sky-700 bg-sky-50 border-sky-100 dark:bg-sky-950/20 dark:border-sky-800/40",
                active: signedFilter === "signed",
                onClick: () => {
                  setSignedFilter((prev) => (prev === "signed" ? "all" : "signed"));
                  setCurrentPage(1);
                },
              },
            ].map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={item.onClick}
                className={`rounded-lg border p-3 text-start transition-all cursor-pointer hover:shadow-sm ${item.tone} ${
                  item.active ? "ring-2 ring-offset-2 ring-[#0F2A44] dark:ring-[#C9A24D] shadow-md scale-[1.02]" : "opacity-90 hover:opacity-100"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold">{item.label}</span>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-bold flex items-baseline justify-between">
                  <span>{item.value}</span>
                  {item.active && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10">
                      {ar ? "مفعل" : "Filtered"}
                    </span>
                  )}
                </div>
              </button>
            ))}
          </div>
        </section>

        <section className="rounded-xl border bg-card p-4 shadow-sm lg:col-span-5">
          <h2 className="flex items-center gap-2 text-base font-bold">
            <Shield className="h-4 w-4 text-[#C9A24D]" />
            {ar ? "تقسيمة الصلاحيات" : "Permission Groups"}
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            {ar
              ? "تنظيم وتصنيف الصلاحيات وفقاً لدورات العمل الفندقية والتشغيلية المعتمدة."
              : "Permissions are grouped by hotel workflows, not technical screens."}
          </p>
          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-2">
            {[
              ar ? "التشغيل اليومي" : "Daily operations",
              ar ? "مسار التسكين" : "Accommodation flow",
              ar ? "بوابة الموظف" : "Employee portal",
              ar ? "الإدارة" : "Management",
              ar ? "الأمان والتدقيق" : "Security & audit",
            ].map((label) => (
              <div key={label} className="rounded-lg border bg-muted/20 px-3 py-2 text-sm font-medium">
                {label}
              </div>
            ))}
          </div>
        </section>
      </div>

      {/* ── Search & Filter Bar ── */}
      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 rtl:right-3 rtl:left-auto top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder={ar ? "بحث بالاسم..." : "Search users by name..."}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pl-10 rtl:pr-10 rtl:pl-3 h-10"
          />
          {searchQuery && (
            <button
              onClick={() => {
                setSearchQuery("");
                setCurrentPage(1);
              }}
              className={`absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground ${ar ? "left-3" : "right-3"}`}
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>
        <Select
          value={statusFilter}
          onValueChange={(v) => {
            setStatusFilter(v);
            setCurrentPage(1);
          }}
        >
          <SelectTrigger className="w-full sm:w-[150px] h-10">
            <SelectValue placeholder={ar ? "الحالة" : "Status"} />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              {ar ? "كل الحالات" : "All Status"}
            </SelectItem>
            <SelectItem value="ACTIVE">{ar ? "نشط" : "Active"}</SelectItem>
            <SelectItem value="LOCKED">{ar ? "مقفول" : "Locked"}</SelectItem>
            <SelectItem value="INACTIVE">
              {ar ? "غير نشط" : "Inactive"}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* ── Role Filter Tabs ── */}
      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {ROLE_TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => {
              setRoleFilter(tab.id);
              setCurrentPage(1);
            }}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap border transition-all ${
              roleFilter === tab.id
                ? "bg-[#0F2A44] text-white border-[#0F2A44] shadow-md shadow-[#0F2A44]/20"
                : "bg-card border-border text-muted-foreground hover:text-foreground hover:border-[#C9A24D]/40"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
            <span
              className={`px-1.5 py-0.5 rounded-full text-xs font-bold ${
                roleFilter === tab.id ? "bg-white/20" : "bg-muted"
              }`}
            >
              {tab.count}
            </span>
          </button>
        ))}
      </div>

      <BulkActionBar
        count={selectedRows.size}
        onClear={() => setSelectedRows(new Set())}
        onExportExcel={exportUserExcel}
        ar={ar}
        extraActions={
          <div className="flex items-center gap-2 flex-wrap">
            <PermissionGate module="users" action="edit">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setBulkRoleModalOpen(true)}
                className="gap-1.5 h-8 text-xs font-semibold bg-background border-border/80 hover:bg-muted"
              >
                <Shield className="w-3.5 h-3.5 text-[#C9A24D]" />
                {ar ? "تغيير الدور" : "Change Role"}
              </Button>
            </PermissionGate>

            {isSuperAdmin && (
              <PermissionGate module="users" action="edit">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSelectedBulkProps([]);
                    setBulkPropModalOpen(true);
                  }}
                  className="gap-1.5 h-8 text-xs font-semibold bg-background border-border/80 hover:bg-muted"
                >
                  <Building2 className="w-3.5 h-3.5 text-blue-500" />
                  {ar ? "تخصيص الفروع" : "Assign Hotels"}
                </Button>
              </PermissionGate>
            )}

            <PermissionGate module="users" action="edit">
              <Button
                variant="outline"
                size="sm"
                onClick={handleBulkUnlock}
                disabled={isBulkExecuting}
                className="gap-1.5 h-8 text-xs font-semibold bg-background border-emerald-500/30 text-emerald-600 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              >
                <KeyRound className="w-3.5 h-3.5 text-emerald-500" />
                {ar ? "فك القفل" : "Unlock"}
              </Button>
            </PermissionGate>

            <PermissionGate module="settings" action="delete">
              <Button
                variant="destructive"
                size="sm"
                onClick={() => {
                  if (
                    window.confirm(
                      ar
                        ? `هل أنت متأكد من حذف ${selectedRows.size} مستخدم محدد؟`
                        : `Are you sure you want to delete ${selectedRows.size} selected users?`
                    )
                  ) {
                    selectedRows.forEach((id) =>
                      bulkDeleteUserMutation.mutate({ id })
                    );
                    setSelectedRows(new Set());
                  }
                }}
                className="gap-1.5 h-8 text-xs font-semibold"
              >
                <Trash className="w-3.5 h-3.5" />
                {ar ? "حذف المحدد" : "Delete Selected"}
              </Button>
            </PermissionGate>
          </div>
        }
      />

      {/* ── Results count ── */}
      {(searchQuery || roleFilter !== "all" || statusFilter !== "all") && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {ar
              ? `عرض ${pagination?.total ?? 0} مستخدم`
              : `Showing ${pagination?.total ?? 0} users`}
          </p>
          <button
            onClick={() => {
              setSearchQuery("");
              setRoleFilter("all");
              setStatusFilter("all");
            }}
            className="text-xs text-[#C9A24D] hover:underline"
          >
            {ar ? "مسح الفلاتر" : "Clear filters"}
          </button>
        </div>
      )}

      {/* ── Main Table ── */}
      {isError ? (
        <ErrorState
          onRetry={() => refetch()}
          className="border rounded-xl bg-card my-4"
        />
      ) : isLoading ? (
        <TableSkeleton rows={5} columns={8} className="my-4" />
      ) : pagedUsers.length === 0 ? (
        <EmptyState
          title={ar ? "لا يوجد مستخدمين" : "No users found"}
          description={
            ar
              ? "لم يتم العثور على أي مستخدمين يتطابقون مع البحث."
              : "No users found matching your search criteria."
          }
          className="border rounded-xl bg-card my-4"
        />
      ) : (
        <div className="border rounded-xl bg-card overflow-hidden shadow-sm">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="w-10 px-3">
                  <Checkbox
                    checked={allUserPageSelected}
                    onCheckedChange={toggleSelectAllUser}
                  />
                </TableHead>
                {isUVisible("username") && (
                  <TableHead className="font-semibold">
                    {ar ? "اسم المستخدم" : "Username"}
                  </TableHead>
                )}
                {isUVisible("email") && (
                  <TableHead className="font-semibold">
                    {ar ? "البريد الإلكتروني" : "Email"}
                  </TableHead>
                )}
                {isUVisible("phone") && (
                  <TableHead className="font-semibold">
                    {ar ? "الهاتف" : "Phone"}
                  </TableHead>
                )}
                {isUVisible("roles") && (
                  <TableHead className="font-semibold">
                    {ar ? "الدور" : "Role"}
                  </TableHead>
                )}
                {isUVisible("workflowRole") && (
                  <TableHead className="font-semibold">
                    {ar ? "منصب الاعتماد" : "Workflow Role"}
                  </TableHead>
                )}
                {isUVisible("signature") && (
                  <TableHead className="font-semibold text-center">
                    {ar ? "التوقيع" : "Signature"}
                  </TableHead>
                )}
                {isUVisible("property") && showPropertyCol && (
                  <TableHead className="font-semibold">
                    {ar ? "الفرع" : "Property"}
                  </TableHead>
                )}
                {isUVisible("permissions") && (
                  <TableHead className="font-semibold">
                    {ar ? "الصلاحيات" : "Permissions"}
                  </TableHead>
                )}
                {isUVisible("status") && (
                  <TableHead className="font-semibold">
                    {ar ? "الحالة" : "Status"}
                  </TableHead>
                )}
                {isUVisible("actions") && (
                  <TableHead className="font-semibold">
                    {ar ? "إجراءات" : "Actions"}
                  </TableHead>
                )}
              </TableRow>
            </TableHeader>
            <TableBody>
              <AnimatePresence mode="popLayout">
                {pagedUsers.map((u: any) => {
                  const isUserSelected = selectedRows.has(u.id);
                  const explicit = (u as any).permissions as
                    | string[]
                    | undefined;
                  const permCount = explicit?.length ?? 0;
                  return (
                    <motion.tr
                      key={u.id}
                      layout
                      initial={{ opacity: 0, y: -8 }}
                      animate={{ opacity: 1, y: 0 }}
                      exit={{ opacity: 0, y: 8 }}
                      transition={{ duration: 0.15, ease: "easeOut" }}
                      className={
                        isUserSelected ? "bg-primary/5" : "hover:bg-muted/20"
                      }
                    >
                      <TableCell className="px-3">
                        <Checkbox
                          checked={isUserSelected}
                          onCheckedChange={() => toggleUserRow(u.id)}
                        />
                      </TableCell>
                      {isUVisible("username") && (
                        <TableCell>
                          <div
                            className="flex items-center gap-3 cursor-pointer group select-none"
                            onClick={() => openUserSheet(u, "profile")}
                            title={ar ? "انقر لعرض وإدارة المستخدم" : "Click to manage user"}
                          >
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white transition-transform group-hover:scale-105 shadow-sm ${u.roles?.some((r: string) => r.toLowerCase() === "super_admin") ? "bg-gradient-to-br from-purple-500 to-purple-700" : u.roles?.some((r: string) => r.toLowerCase() === "admin") ? "bg-gradient-to-br from-red-500 to-red-700" : "bg-gradient-to-br from-[#0F2A44] to-[#1a3d5c]"}`}
                            >
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-sm group-hover:text-[#C9A24D] transition-colors">
                                {u.username}
                              </span>
                              {u.username === currentUser?.username && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] ms-2 border-[#C9A24D]/40 text-[#C9A24D]"
                                >
                                  {ar ? "أنت" : "You"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </TableCell>
                      )}
                      {isUVisible("email") && (
                        <TableCell className="max-w-xs">
                          <div
                            className="text-sm text-muted-foreground truncate"
                            title={(u as any).email || "-"}
                          >
                            {(u as any).email ? (
                              <a
                                href={`mailto:${(u as any).email}`}
                                className="text-blue-600 hover:underline truncate block"
                              >
                                {(u as any).email}
                              </a>
                            ) : (
                              <span className="italic text-gray-400">—</span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {isUVisible("phone") && (
                        <TableCell className="max-w-xs">
                          <div
                            className="text-sm text-muted-foreground truncate"
                            title={(u as any).phone || "-"}
                          >
                            {(u as any).phone ? (
                              <a
                                href={`tel:${(u as any).phone}`}
                                className="text-blue-600 hover:underline truncate block"
                              >
                                {(u as any).phone}
                              </a>
                            ) : (
                              <span className="italic text-gray-400">—</span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {isUVisible("roles") && (
                        <TableCell className="min-w-max">
                          <div className="flex flex-wrap gap-1 max-w-xs">
                            {(u.roles || []).slice(0, 2).map((r: string) => (
                              <span
                                key={r}
                                className={`px-2 py-0.5 rounded-full text-xs font-semibold whitespace-nowrap ${roleColor(r)}`}
                              >
                                {(() => {
                                  const roleObj = ALL_ROLES.find(
                                    (x: any) => x.value === r.toLowerCase(),
                                  );
                                  const label = ar
                                    ? roleObj?.labelAr
                                    : roleObj?.label;
                                  return label ?? r.replace(/_/g, " ");
                                })()}
                              </span>
                            ))}
                            {(u.roles || []).length > 2 && (
                              <span className="px-2 py-0.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-800 dark:bg-gray-800/40 dark:text-gray-300 whitespace-nowrap">
                                +{(u.roles || []).length - 2}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {isUVisible("workflowRole") && (
                        <TableCell>
                          {u.jobTitle ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
                              {(() => {
                                const roleObj = WORKFLOW_ROLES.find(
                                  (r: any) => r.value === u.jobTitle,
                                );
                                const label = ar
                                  ? roleObj?.labelAr
                                  : roleObj?.label;
                                return label ?? u.jobTitle.replace(/_/g, " ");
                              })()}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              —
                            </span>
                          )}
                        </TableCell>
                      )}
                      {isUVisible("signature") && (
                        <TableCell className="text-center">
                          <button
                            type="button"
                            onClick={() => openUserSheet(u, "signature")}
                            className="inline-flex items-center gap-1 hover:opacity-80 cursor-pointer transition-opacity"
                            title={ar ? "انقر لإدارة التوقيع" : "Click to manage signature"}
                          >
                            {u.hasSignature ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
                              >
                                <Pen className="w-3.5 h-3.5" />
                                {ar ? "موجود" : "Yes"}
                              </span>
                            ) : u.jobTitle ? (
                              <span
                                className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
                              >
                                <Pen className="w-3.5 h-3.5 opacity-30" />
                                {ar ? "مفقود" : "Missing"}
                              </span>
                            ) : (
                              <span className="text-xs text-muted-foreground italic">
                                —
                              </span>
                            )}
                          </button>
                        </TableCell>
                      )}
                      {isUVisible("property") && showPropertyCol && (
                        <TableCell>
                          {(() => {
                            const pids: number[] = (u as any).propertyIds?.length
                              ? (u as any).propertyIds
                              : (u as any).propertyId
                                ? [(u as any).propertyId]
                                : [];
                            if (!pids.length)
                              return (
                                <span className="text-xs text-muted-foreground italic">
                                  Global
                                </span>
                              );
                            return (
                              <div
                                className="flex flex-wrap gap-1 cursor-pointer hover:opacity-80 transition-opacity"
                                onClick={() => openUserSheet(u, "properties")}
                                title={ar ? "انقر لتعديل صلاحيات الفروع" : "Click to edit hotel properties"}
                              >
                                {pids.map((pid) => {
                                  const p = properties?.find((x) => x.id === pid);
                                  return (
                                    <span
                                      key={pid}
                                      className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-semibold hover:bg-[#C9A24D]/20 hover:text-[#C9A24D] transition-colors"
                                    >
                                      {p?.code ?? `#${pid}`}
                                    </span>
                                  );
                                })}
                              </div>
                            );
                          })()}
                        </TableCell>
                      )}
                      {isUVisible("permissions") && (
                        <TableCell>
                          <div className="flex flex-col gap-1 max-w-[240px]">
                            {(() => {
                              const isSuper = (u.roles || []).some(
                                (r: string) => r.toLowerCase() === "super_admin",
                              );
                              if (isSuper) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => openUserSheet(u, "permissions")}
                                    className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 transition-colors w-fit cursor-pointer"
                                    title={ar ? "مدير النظام - انقر للاطلاع" : "Super Admin - Click to view"}
                                  >
                                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                                    <span>
                                      {ar ? "مدير النظام (شامل)" : "Super Admin (Full)"}
                                    </span>
                                  </button>
                                );
                              }
                              const explicitPerms = u.permissions as string[] | undefined;
                              const hasExplicit = Array.isArray(explicitPerms) && explicitPerms.length > 0;
                              if (hasExplicit) {
                                if (explicitPerms.length === 1 && explicitPerms[0] === "none") {
                                  return (
                                    <button
                                      type="button"
                                      onClick={() => openUserSheet(u, "permissions")}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors w-fit cursor-pointer"
                                      title={ar ? "انقر لتعديل الصلاحيات" : "Click to edit permissions"}
                                    >
                                      <LockKeyhole className="w-3.5 h-3.5" />
                                      <span>{ar ? "مغلق تماماً" : "Fully Blocked"}</span>
                                    </button>
                                  );
                                }
                                const grouped = explicitPerms.reduce((acc: any, p: string) => {
                                  const mod = p.split(".")[0];
                                  if (mod) acc[mod] = (acc[mod] || 0) + 1;
                                  return acc;
                                }, {});
                                const modules = Object.keys(grouped);
                                return (
                                  <div className="flex flex-col gap-1">
                                    <button
                                      type="button"
                                      onClick={() => openUserSheet(u, "permissions")}
                                      className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors w-fit text-start cursor-pointer"
                                      title={ar ? "انقر لتعديل الصلاحيات المخصصة" : "Click to edit permissions"}
                                    >
                                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                                      <span>
                                        {ar
                                          ? `مخصص (${modules.length} موديول / ${explicitPerms.length} إجراء)`
                                          : `Custom (${modules.length} mods / ${explicitPerms.length} actions)`}
                                      </span>
                                    </button>
                                    <div className="flex flex-wrap gap-1">
                                      {modules.slice(0, 2).map((mod) => (
                                        <span
                                          key={mod}
                                          className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border capitalize"
                                        >
                                          {mod.replace(/_/g, " ")} ({grouped[mod]})
                                        </span>
                                      ))}
                                      {modules.length > 2 && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-semibold bg-muted text-muted-foreground border">
                                          +{modules.length - 2}
                                        </span>
                                      )}
                                    </div>
                                  </div>
                                );
                              }
                              const role = u.roles?.[0] || "user";
                              return (
                                <button
                                  type="button"
                                  onClick={() => openUserSheet(u, "permissions")}
                                  className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted/50 border border-border/60 hover:bg-muted cursor-pointer transition-colors w-fit"
                                  title={ar ? "انقر لتخصيص الصلاحيات" : "Click to customize permissions"}
                                >
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>{ar ? "افتراضي حسب الدور" : `Default (${role})`}</span>
                                </button>
                              );
                            })()}
                          </div>
                        </TableCell>
                      )}
                      {isUVisible("status") && (
                        <TableCell>
                          <div className="space-y-1">
                            <div className="flex items-center gap-2">
                              {u.status === "LOCKED" ? (
                                <>
                                  <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                                  <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                    {ar ? "مقفول" : "Locked"}
                                  </span>
                                </>
                              ) : (
                                <>
                                  <div
                                    className={`w-2 h-2 rounded-full ${u.status === "ACTIVE" ? "bg-green-500 animate-pulse" : "bg-gray-400"}`}
                                  />
                                  <span
                                    className={`text-xs font-semibold ${u.status === "ACTIVE" ? "text-green-700 dark:text-green-400" : "text-gray-500"}`}
                                  >
                                    {u.status === "ACTIVE"
                                      ? ar
                                        ? "نشط"
                                        : "Active"
                                      : ar
                                        ? "غير نشط"
                                        : "Inactive"}
                                  </span>
                                </>
                              )}
                            </div>

                            {/* Security Telemetry */}
                            {u.failedLoginAttempts > 0 && (
                              <div className="flex items-center gap-1">
                                <span
                                  className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                                  title={ar ? `${u.failedLoginAttempts} محاولات دخول فاشلة` : `${u.failedLoginAttempts} failed login attempts`}
                                >
                                  <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                                  {u.failedLoginAttempts} {ar ? "محاولة فاشلة" : "failed"}
                                </span>
                              </div>
                            )}

                            {u.lockedUntil && new Date(u.lockedUntil) > new Date() && (
                              <span className="text-[10px] text-muted-foreground block font-mono">
                                {ar ? "مغلق حتى: " : "locked until: "}
                                {new Date(u.lockedUntil).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                              </span>
                            )}
                          </div>
                        </TableCell>
                      )}
                      {isUVisible("actions") && (
                        <TableCell>
                          <div className="flex items-center gap-1">
                            <PermissionGate module="users" action="manage_permissions">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-muted-foreground hover:text-[#C9A24D] hover:bg-[#C9A24D]/10 rounded-lg transition-colors"
                                onClick={() => openUserSheet(u, "permissions")}
                                title={ar ? "إدارة الصلاحيات" : "Manage Permissions"}
                              >
                                <Shield className="w-4 h-4 text-[#C9A24D]" />
                              </Button>
                            </PermissionGate>
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button
                                  variant="ghost"
                                  size="icon"
                                  className="h-8 w-8"
                                >
                                  <MoreVertical className="w-4 h-4" />
                                </Button>
                              </DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="w-52">
                              <PermissionGate module="users" action="edit">
                                <DropdownMenuItem
                                  onClick={() => openUserSheet(u, "profile")}
                                  className="cursor-pointer"
                                >
                                  <UserCog className="w-4 h-4 me-2 text-blue-600" />
                                  <span>
                                    {ar ? "تعديل البيانات والأمان" : "Edit Profile & Security"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="users" action="manage_permissions">
                                <DropdownMenuItem
                                  onClick={() => openUserSheet(u, "permissions")}
                                  className="cursor-pointer"
                                >
                                  <Shield className="w-4 h-4 me-2 text-[#C9A24D]" />
                                  <span>
                                    {ar ? "صلاحيات المستخدم الذكية" : "Smart Capabilities Drawer"}
                                  </span>
                                </DropdownMenuItem>
                                <DropdownMenuItem
                                  onClick={() => {
                                    setMatrixTargetUserId(u.id);
                                    setActiveMainTab("matrix");
                                  }}
                                  className="cursor-pointer text-[#C9A24D] font-medium"
                                >
                                  <ShieldCheck className="w-4 h-4 me-2 text-[#C9A24D]" />
                                  <span>
                                    {ar ? "مركز الصلاحيات الشامل" : "Full Permissions Center"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                              {(isAdmin || can("users", "edit") || u.id === currentUser?.id) && (
                                <DropdownMenuItem
                                  onClick={() => openUserSheet(u, "signature")}
                                  className="cursor-pointer"
                                >
                                  <Upload className="w-4 h-4 me-2 text-slate-600" />
                                  <span>
                                    {ar ? "رفع / تعديل التوقيع" : "Manage Signature"}
                                  </span>
                                </DropdownMenuItem>
                              )}
                              {(isSuperAdmin || can("users", "edit") || can("users", "manage_permissions")) &&
                                u.roles?.[0] !== "super_admin" && (
                                  <DropdownMenuItem
                                    onClick={() => openUserSheet(u, "properties")}
                                    className="cursor-pointer"
                                  >
                                    <Building2 className="w-4 h-4 me-2 text-green-600" />
                                    <span>
                                      {ar ? "تعديل الفروع المصرحة" : "Authorized Properties"}
                                    </span>
                                  </DropdownMenuItem>
                                )}
                              <PermissionGate module="users" action="reset_password">
                                <DropdownMenuItem
                                  onClick={() => openUserSheet(u, "profile")}
                                  className="cursor-pointer"
                                >
                                  <KeyRound className="w-4 h-4 me-2 text-blue-500" />
                                  <span>
                                    {ar
                                      ? "إعادة تعيين كلمة المرور"
                                      : "Reset Password"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                              {isUserLocked(u) && (
                                <PermissionGate module="users" action="unlock">
                                  <DropdownMenuItem
                                    onClick={() => openUserSheet(u, "profile")}
                                    className="cursor-pointer font-medium text-amber-600 dark:text-amber-400"
                                  >
                                    <Unlock className="w-4 h-4 me-2" />
                                    <span>
                                      {ar ? "فتح قفل الحساب فوراً" : "Instant Unlock Account"}
                                    </span>
                                  </DropdownMenuItem>
                                </PermissionGate>
                              )}
                              <DropdownMenuSeparator />
                              <PermissionGate module="users" action="delete">
                                <DropdownMenuItem
                                  onClick={() => setDeleteUser(u)}
                                  disabled={
                                    u.username === currentUser?.username
                                  }
                                  className="cursor-pointer text-red-600 dark:text-red-400"
                                >
                                  <Trash className="w-4 h-4 me-2" />
                                  <span>
                                    {ar ? "حذف المستخدم" : "Delete User"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                            </DropdownMenuContent>
                            </DropdownMenu>
                          </div>
                        </TableCell>
                      )}
                    </motion.tr>
                  );
                })}
              </AnimatePresence>
              {pagedUsers.length === 0 && (
                <TableRow>
                  <TableCell
                    colSpan={uVisible.size + 1}
                    className="py-16 text-center"
                  >
                    <div className="flex flex-col items-center gap-3 text-muted-foreground">
                      <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center">
                        {searchQuery || roleFilter !== "all" ? (
                          <Search className="w-7 h-7 opacity-40" />
                        ) : (
                          <ShieldCheck className="w-7 h-7 opacity-40" />
                        )}
                      </div>
                      <p className="font-semibold text-foreground">
                        {searchQuery || roleFilter !== "all"
                          ? ar
                            ? "لا توجد نتائج"
                            : "No matching users"
                          : ar
                            ? "لا يوجد مستخدمين"
                            : "No users found"}
                      </p>
                      <p className="text-sm max-w-xs">
                        {searchQuery || roleFilter !== "all"
                          ? ar
                            ? "حاول تغيير معايير البحث أو الفلتر"
                            : "Try adjusting your search or filter criteria"
                          : ar
                            ? "اضغط إضافة مستخدم لإنشاء مستخدم جديد"
                            : 'Click "Add User" to create a new system user'}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          {pagination?.total > 0 && (
            <DataPagination
              total={pagination?.total}
              pageSize={pageSize}
              onPageSizeChange={(size) => {
                setPageSize(size);
                setCurrentPage(1);
              }}
              currentPage={currentPage}
              onPageChange={(page) => {
                setCurrentPage(page);
              }}
            />
          )}
        </div>
      )}
        </>
      )}
      {/* ── Bulk Role Assignment Dialog ── */}
      <Dialog open={bulkRoleModalOpen} onOpenChange={setBulkRoleModalOpen}>
        <DialogContent className="max-w-md" dir={ar ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Shield className="w-5 h-5 text-[#C9A24D]" />
              {ar ? `تغيير الدور لـ (${selectedRows.size}) مستخدم محدد` : `Change Role for (${selectedRows.size}) Users`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {ar
                ? "حدد الدور الوظيفي الجديد ليتم تطبيقه على جميع الحسابات المحددة فوراً:"
                : "Select the new primary role to apply immediately to all selected accounts:"}
            </p>
            <div className="space-y-2">
              <label className="text-xs font-semibold text-foreground">
                {ar ? "الدور الجديد" : "Target Role"}
              </label>
              <Select value={selectedBulkRole} onValueChange={setSelectedBulkRole}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ALL_ROLES.map((role) => (
                    <SelectItem key={role.value} value={role.value}>
                      <span className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-full ${roleColor(role.value)}`} />
                        {ar ? role.labelAr : role.label}
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBulkRoleModalOpen(false)}
              disabled={isBulkExecuting}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleBulkRoleChange}
              disabled={isBulkExecuting}
              className="bg-[#0F2A44] hover:bg-[#143555] text-white"
            >
              {isBulkExecuting ? (
                <RefreshCw className="w-4 h-4 animate-spin me-1.5" />
              ) : (
                <Check className="w-4 h-4 me-1.5" />
              )}
              {ar ? "تطبيق الدور الجماعي" : "Apply Role"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Bulk Property Assignment Dialog ── */}
      <Dialog open={bulkPropModalOpen} onOpenChange={setBulkPropModalOpen}>
        <DialogContent className="max-w-md" dir={ar ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <Building2 className="w-5 h-5 text-blue-500" />
              {ar ? `تخصيص الفروع الفندقية لـ (${selectedRows.size}) مستخدم` : `Assign Properties for (${selectedRows.size}) Users`}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <p className="text-sm text-muted-foreground">
              {ar
                ? "حدد الفنادق والفروع المسموح للمستخدمين المحددين الوصول إليها وإدارتها:"
                : "Select the hotel properties these selected users will have access to:"}
            </p>
            <div className="space-y-2 max-h-56 overflow-y-auto border rounded-lg p-2.5 bg-muted/20">
              {(properties ?? []).map((p: any) => {
                const checked = selectedBulkProps.includes(p.id);
                return (
                  <label
                    key={p.id}
                    className="flex items-center gap-3 p-2 rounded hover:bg-muted cursor-pointer transition-colors"
                  >
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(val) => {
                        if (val) {
                          setSelectedBulkProps((prev) => [...prev, p.id]);
                        } else {
                          setSelectedBulkProps((prev) => prev.filter((id) => id !== p.id));
                        }
                      }}
                    />
                    <div className="flex-1">
                      <span className="text-sm font-semibold">{p.name}</span>
                      <span className="text-xs text-muted-foreground font-mono ms-2">({p.code})</span>
                    </div>
                  </label>
                );
              })}
            </div>
          </div>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setBulkPropModalOpen(false)}
              disabled={isBulkExecuting}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleBulkPropertiesChange}
              disabled={isBulkExecuting}
              className="bg-[#0F2A44] hover:bg-[#143555] text-white"
            >
              {isBulkExecuting ? (
                <RefreshCw className="w-4 h-4 animate-spin me-1.5" />
              ) : (
                <Check className="w-4 h-4 me-1.5" />
              )}
              {ar ? "تطبيق الفروع" : "Apply Properties"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

