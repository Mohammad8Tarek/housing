import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ShieldCheck, Search, Users, X, ListChecks } from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { ColumnChooser } from "@/components/ui/column-chooser";
import {
  ErrorState,
  EmptyState,
  TableSkeleton,
} from "@/components/ui/page-states";
import { PermissionMatrixCenter } from "./components/PermissionMatrixCenter";
import { CreateUserDialog } from "./components/CreateUserDialog";
import { RoleTemplatesDialog } from "./components/RoleTemplatesDialog";
import { AccessReviewTab } from "./components/AccessReviewTab";
import { usePermission } from "@/hooks/use-permission";
import { DeleteUserDialog } from "./components/DeleteUserDialog";
import { useUsersPageState } from "./list/useUsersPageState";
import { renderUsersStats } from "./list/UsersStats";
import { renderUsersFilters } from "./list/UsersFilters";
import { renderUsersBulkBar } from "./list/UsersBulkBar";
import { renderUsersTable } from "./list/UsersTable";
import { renderBulkRoleDialog } from "./list/BulkRoleDialog";
import { renderBulkPropertiesDialog } from "./list/BulkPropertiesDialog";

export default function UsersPage() {
  const s = useUsersPageState();
  const { isSuperAdmin } = usePermission();
  const {
    ar,
    deleteUser,
    setDeleteUser,
    setCurrentPage,
    searchQuery,
    setSearchQuery,
    roleFilter,
    setRoleFilter,
    statusFilter,
    setStatusFilter,
    activeMainTab,
    setActiveMainTab,
    matrixTargetUserId,
    setMatrixTargetUserId,
    isLoading,
    isError,
    refetch,
    properties,
    allUsers,
    pagination,
    stats,
    ROLE_TABS,
    USER_COLS,
    uVisible,
    uToggle,
    uShowAll,
    uHideAll,
    pagedUsers,
  } = s;

  return (
    <div className="space-y-6" dir={ar ? "rtl" : "ltr"}>
      {/* Dynamic Dialogs */}
      {deleteUser && (
        <DeleteUserDialog
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
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
            {isSuperAdmin && <RoleTemplatesDialog ar={ar} />}
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
          <Badge
            variant="secondary"
            className="text-xs px-2 py-0 font-semibold ms-1"
          >
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
            <span>
              {ar ? "مركز ومصفوفة الصلاحيات الشاملة" : "Permissions Center"}
            </span>
            <Badge
              variant="outline"
              className="text-xs px-2 py-0 font-semibold border-amber-500/30 text-amber-600 dark:text-amber-400 ms-1"
            >
              {stats.customPermissionUsers} {ar ? "مخصص" : "custom"}
            </Badge>
          </button>
        </PermissionGate>

        <button
          type="button"
          onClick={() => setActiveMainTab("access")}
          className={`flex items-center gap-2 px-5 py-3 text-sm font-bold border-b-2 transition-all whitespace-nowrap ${
            activeMainTab === "access"
              ? "border-primary text-primary"
              : "border-transparent text-muted-foreground hover:text-foreground hover:border-border"
          }`}
        >
          <ListChecks className="w-4 h-4" />
          <span>{ar ? "مراجعة الصلاحيات" : "Access Review"}</span>
        </button>
      </div>

      {activeMainTab === "access" ? (
        <AccessReviewTab ar={ar} />
      ) : activeMainTab === "matrix" ? (
        <PermissionMatrixCenter
          users={allUsers}
          selectedUserId={matrixTargetUserId}
          onSelectUser={(uid) => setMatrixTargetUserId(uid)}
          properties={properties ?? []}
        />
      ) : (
        <>
          {/* ── Stats Cards ── */}
          {renderUsersStats(s)}

          {renderUsersFilters(s)}

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
                <SelectItem value="LOCKED">
                  {ar ? "مقفول" : "Locked"}
                </SelectItem>
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

          {renderUsersBulkBar(s)}

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
            renderUsersTable(s)
          )}
        </>
      )}
      {/* ── Bulk Role Assignment Dialog ── */}
      {renderBulkRoleDialog(s)}

      {/* ── Bulk Property Assignment Dialog ── */}
      {renderBulkPropertiesDialog(s)}
    </div>
  );
}
