// @ts-nocheck
import { useState, useMemo } from "react";
import {
  useListUsers,
  useListProperties,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useDebounce } from "@/hooks/use-debounce";
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
} from "lucide-react";
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
import { EditUserDialog } from "./components/EditUserDialog";
import { EditPropertiesDialog } from "./components/EditPropertiesDialog";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { ResetPasswordDialog } from "./components/ResetPasswordDialog";
import { DeleteUserDialog } from "./components/DeleteUserDialog";
import { UnlockUserDialog } from "./components/UnlockUserDialog";
import { UploadSignatureDialog } from "./components/UploadSignatureDialog";

import { SYSTEM_ROLES, WORKFLOW_ROLES, roleColor } from "./utils";
const ALL_ROLES = [...SYSTEM_ROLES, ...WORKFLOW_ROLES];

export default function UsersPage() {
  const { user: currentUser } = useAuth();
  const { isSuperAdmin } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { can, isAdmin } = usePermission();

  const [deleteUser, setDeleteUser] = useState<any | null>(null);
  const [matrixUser, setMatrixUser] = useState<any | null>(null);
  const [pageSize, setPageSize] = useState(10);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<Set<number>>(new Set());
  const [resetUser, setResetUser] = useState<any | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [editUser, setEditUser] = useState<any | null>(null);
  const [unlockUser, setUnlockUser] = useState<any | null>(null);
  const [editPropsUser, setEditPropsUser] = useState<any | null>(null);
  const [signatureUser, setSignatureUser] = useState<any | null>(null);

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

  const users = _apiResponseWrapper?.data ?? [];
  const pagination = _apiResponseWrapper?.pagination;

  const invalidate = () =>
    queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });

  const isUserLocked = (u: any) => u.status === "LOCKED";



  // ── Optimized Stats (Single Pass) ──
  const stats = useMemo(() => {
    const all = users || [];
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
      if (u.jobTitle) s.workflowUsers++;
      if (u.jobTitle && u.hasSignature) s.signedWorkflowUsers++;
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
  }, [users]);

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
      labelAr: "البروبرتي",
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

  const pagedUsers = users;
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
    XLSX.writeFile(wb, `users_${new Date().toISOString().slice(0, 10)}.xlsx`);
  };

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Dynamic Dialogs */}
      {matrixUser && (
        <PermissionMatrixDialog
          user={matrixUser}
          onClose={() => setMatrixUser(null)}
        />
      )}
      {editUser && (
        <EditUserDialog user={editUser} onClose={() => setEditUser(null)} />
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
              <p className="text-sm text-muted-foreground">
                {ar
                  ? "إدارة المستخدمين والأدوار وصلاحيات الوصول"
                  : "Manage system users, roles, and granular access control"}
              </p>
            </div>
          </div>
        </div>
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
      </div>

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
            <Badge variant="outline" className="rounded-md">
              {stats.customPermissionTotal} {ar ? "صلاحية" : "permissions"}
            </Badge>
          </div>

          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            {[
              {
                label: ar ? "نشط" : "Active",
                value: stats.active,
                icon: ShieldCheck,
                tone: "text-emerald-600 bg-emerald-50 border-emerald-100",
              },
              {
                label: ar ? "مقفول" : "Locked",
                value: stats.locked,
                icon: LockKeyhole,
                tone: "text-rose-600 bg-rose-50 border-rose-100",
              },
              {
                label: ar ? "أدوار اعتماد" : "Approval roles",
                value: stats.workflowUsers,
                icon: ClipboardCheck,
                tone: "text-amber-700 bg-amber-50 border-amber-100",
              },
              {
                label: ar ? "بتوقيع" : "Signed",
                value: stats.signedWorkflowUsers,
                icon: Fingerprint,
                tone: "text-sky-700 bg-sky-50 border-sky-100",
              },
            ].map((item) => (
              <div key={item.label} className={`rounded-lg border p-3 ${item.tone}`}>
                <div className="flex items-center justify-between">
                  <span className="text-xs font-medium">{item.label}</span>
                  <item.icon className="h-4 w-4" />
                </div>
                <div className="mt-2 text-2xl font-bold">{item.value}</div>
              </div>
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
              ? "الصلاحيات اتقسمت حسب شغل الفندق بدل أسماء تقنية صعبة."
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
                {isUVisible("property") && isSuperAdmin && (
                  <TableHead className="font-semibold">
                    {ar ? "البروبرتي" : "Property"}
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
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-bold text-white ${u.roles?.some((r: string) => r.toLowerCase() === "super_admin") ? "bg-gradient-to-br from-purple-500 to-purple-700" : u.roles?.some((r: string) => r.toLowerCase() === "admin") ? "bg-gradient-to-br from-red-500 to-red-700" : "bg-gradient-to-br from-[#0F2A44] to-[#1a3d5c]"}`}
                            >
                              {u.username.charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <span className="font-semibold text-sm">
                                {u.username}
                              </span>
                              {u.username === currentUser?.username && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] ms-2 rtl:mr-2 rtl:ml-0 border-[#C9A24D]/40 text-[#C9A24D]"
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
                          {u.hasSignature ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400"
                              title={
                                ar ? "التوقيع متوفر" : "Signature available"
                              }
                            >
                              <Pen className="w-3.5 h-3.5" />
                              {ar ? "موجود" : "Yes"}
                            </span>
                          ) : u.jobTitle ? (
                            <span
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground"
                              title={
                                ar ? "التوقيع غير متوفر" : "Signature missing"
                              }
                            >
                              <Pen className="w-3.5 h-3.5 opacity-30" />
                              {ar ? "مفقود" : "Missing"}
                            </span>
                          ) : (
                            <span className="text-xs text-muted-foreground italic">
                              —
                            </span>
                          )}
                        </TableCell>
                      )}
                      {isUVisible("property") && isSuperAdmin && (
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
                              <div className="flex flex-wrap gap-1">
                                {pids.map((pid) => {
                                  const p = properties?.find((x) => x.id === pid);
                                  return (
                                    <span
                                      key={pid}
                                      className="text-xs font-mono bg-muted px-2 py-0.5 rounded font-semibold"
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
                                  <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 w-fit">
                                    <Crown className="w-3.5 h-3.5 text-amber-500" />
                                    <span>
                                      {ar ? "سوبر أدمن (كامل)" : "Super Admin (Full)"}
                                    </span>
                                  </span>
                                );
                              }
                              const explicitPerms = u.permissions as string[] | undefined;
                              const hasExplicit = Array.isArray(explicitPerms) && explicitPerms.length > 0;
                              if (hasExplicit) {
                                if (explicitPerms.length === 1 && explicitPerms[0] === "none") {
                                  return (
                                    <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 w-fit">
                                      <LockKeyhole className="w-3.5 h-3.5" />
                                      <span>{ar ? "مغلق تماماً" : "Fully Blocked"}</span>
                                    </span>
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
                                      onClick={() => setMatrixUser(u)}
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
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-medium text-muted-foreground bg-muted/50 border border-border/60 w-fit">
                                  <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                                  <span>{ar ? "افتراضي حسب الدور" : `Default (${role})`}</span>
                                </span>
                              );
                            })()}
                          </div>
                        </TableCell>
                      )}
                      {isUVisible("status") && (
                        <TableCell>
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
                                onClick={() => setMatrixUser(u)}
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
                            <DropdownMenuContent align="end" className="w-48">
                              <PermissionGate module="users" action="edit">
                                <DropdownMenuItem
                                  onClick={() => setEditUser(u)}
                                  className="cursor-pointer"
                                >
                                  <UserCog className="w-4 h-4 me-2 text-blue-600" />
                                  <span>
                                    {ar ? "تعديل البيانات" : "Edit User Data"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                              <PermissionGate module="users" action="manage_permissions">
                                <DropdownMenuItem
                                  onClick={() => setMatrixUser(u)}
                                  className="cursor-pointer"
                                >
                                  <Shield className="w-4 h-4 me-2 text-[#C9A24D]" />
                                  <span>
                                    {ar ? "تعديل الصلاحيات" : "Edit Permissions"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                              {(isAdmin || u.id === currentUser?.id) && (
                                <DropdownMenuItem
                                  onClick={() => setSignatureUser(u)}
                                  className="cursor-pointer"
                                >
                                  <Upload className="w-4 h-4 me-2 text-slate-600" />
                                  <span>
                                    {ar ? "رفع توقيع" : "Upload Signature"}
                                  </span>
                                </DropdownMenuItem>
                              )}
                              {isSuperAdmin &&
                                u.roles?.[0] !== "super_admin" && (
                                  <DropdownMenuItem
                                    onClick={() => setEditPropsUser(u)}
                                    className="cursor-pointer"
                                  >
                                    <Building2 className="w-4 h-4 me-2 text-green-600" />
                                    <span>
                                      {ar ? "تعديل الفروع" : "Edit Properties"}
                                    </span>
                                  </DropdownMenuItem>
                                )}
                              <PermissionGate module="users" action="reset_password">
                                <DropdownMenuItem
                                  onClick={() => setResetUser(u)}
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
                                    onClick={() => setUnlockUser(u)}
                                    className="cursor-pointer"
                                  >
                                    <Unlock className="w-4 h-4 me-2 text-amber-600" />
                                    <span>
                                      {ar ? "فتح قفل الحساب" : "Unlock Account"}
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
                                  <Trash className="w-4 h-4 mr-2" />
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
    </div>
  );
}
