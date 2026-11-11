// Users list: table with per-user actions.
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
import { Badge } from "@/components/ui/badge";
import {
  Trash,
  UserCog,
  ShieldCheck,
  Shield,
  Building2,
  Search,
  Crown,
  MoreVertical,
  Unlock,
  Pen,
  Upload,
  LockKeyhole,
  AlertTriangle,
  RefreshCw,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { Checkbox } from "@/components/ui/checkbox";
import { motion, AnimatePresence } from "framer-motion";
import { DataPagination } from "@/components/DataPagination";
import { WORKFLOW_ROLES, roleColor } from "../utils";
import { ALL_ROLES } from "./index.constants";
import type { UsersPageState } from "./useUsersPageState";

export function renderUsersTable(s: UsersPageState) {
  const {
    currentUser,
    isSuperAdmin,
    ar,
    can,
    showPropertyCol,
    setDeleteUser,
    pageSize,
    setPageSize,
    currentPage,
    setCurrentPage,
    selectedRows,
    searchQuery,
    roleFilter,
    setActiveMainTab,
    setMatrixTargetUserId,
    openUserSheet,
    properties,
    pagination,
    unlockingUserId,
    isUserLocked,
    isUserActive,
    handleUnlockUser,
    uVisible,
    isUVisible,
    pagedUsers,
    allUserPageSelected,
    toggleSelectAllUser,
    toggleUserRow,
  } = s;
  return (
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
            {isUVisible("nationalId") && (
              <TableHead className="font-semibold font-mono">
                {ar ? "الرقم القومي" : "National ID"}
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
              const explicit = (u as any).permissions as string[] | undefined;
              const permCount = explicit?.length ?? 0;
              return (
                <motion.tr
                  key={u.id}
                  layout
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  transition={{ duration: 0.15, ease: "easeOut" }}
                  className={`cursor-pointer transition-colors ${
                    isUserSelected ? "bg-primary/5" : "hover:bg-muted/30"
                  }`}
                  onClick={(e: React.MouseEvent) => {
                    const target = e.target as HTMLElement;
                    if (
                      target.closest(
                        'button, input, a, [role="checkbox"], [role="menuitem"]',
                      )
                    )
                      return;
                    openUserSheet(u, "profile");
                  }}
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
                        title={
                          ar
                            ? "انقر لعرض وإدارة المستخدم"
                            : "Click to manage user"
                        }
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
                  {isUVisible("nationalId") && (
                    <TableCell className="max-w-xs">
                      {(u as any).nationalId || (u as any).national_id ? (
                        <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-muted border text-foreground">
                          {(u as any).nationalId || (u as any).national_id}
                        </span>
                      ) : (
                        <span className="italic text-gray-400">—</span>
                      )}
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
                        title={
                          ar
                            ? "انقر لإدارة التوقيع"
                            : "Click to manage signature"
                        }
                      >
                        {u.hasSignature ? (
                          <span className="inline-flex items-center gap-1 text-xs font-medium text-green-600 dark:text-green-400">
                            <Pen className="w-3.5 h-3.5" />
                            {ar ? "موجود" : "Yes"}
                          </span>
                        ) : u.jobTitle ? (
                          <span className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
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
                            title={
                              ar
                                ? "انقر لتعديل صلاحيات الفروع"
                                : "Click to edit hotel properties"
                            }
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
                                title={
                                  ar
                                    ? "مدير النظام - انقر للاطلاع"
                                    : "Super Admin - Click to view"
                                }
                              >
                                <Crown className="w-3.5 h-3.5 text-amber-500" />
                                <span>
                                  {ar
                                    ? "مدير النظام (شامل)"
                                    : "Super Admin (Full)"}
                                </span>
                              </button>
                            );
                          }
                          const explicitPerms = u.permissions as
                            | string[]
                            | undefined;
                          const hasExplicit =
                            Array.isArray(explicitPerms) &&
                            explicitPerms.length > 0;
                          if (hasExplicit) {
                            if (
                              explicitPerms.length === 1 &&
                              explicitPerms[0] === "none"
                            ) {
                              return (
                                <button
                                  type="button"
                                  onClick={() =>
                                    openUserSheet(u, "permissions")
                                  }
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 hover:bg-rose-500/20 transition-colors w-fit cursor-pointer"
                                  title={
                                    ar
                                      ? "انقر لتعديل الصلاحيات"
                                      : "Click to edit permissions"
                                  }
                                >
                                  <LockKeyhole className="w-3.5 h-3.5" />
                                  <span>
                                    {ar ? "مغلق تماماً" : "Fully Blocked"}
                                  </span>
                                </button>
                              );
                            }
                            const grouped = explicitPerms.reduce(
                              (acc: any, p: string) => {
                                const mod = p.split(".")[0];
                                if (mod) acc[mod] = (acc[mod] || 0) + 1;
                                return acc;
                              },
                              {},
                            );
                            const modules = Object.keys(grouped);
                            return (
                              <div className="flex flex-col gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    openUserSheet(u, "permissions")
                                  }
                                  className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded-lg text-xs font-bold bg-indigo-500/10 text-indigo-700 dark:text-indigo-300 border border-indigo-500/20 hover:bg-indigo-500/20 transition-colors w-fit text-start cursor-pointer"
                                  title={
                                    ar
                                      ? "انقر لتعديل الصلاحيات المخصصة"
                                      : "Click to edit permissions"
                                  }
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
                              title={
                                ar
                                  ? "انقر لتخصيص الصلاحيات"
                                  : "Click to customize permissions"
                              }
                            >
                              <span className="w-1.5 h-1.5 rounded-full bg-slate-400" />
                              <span>
                                {ar ? "افتراضي حسب الدور" : `Default (${role})`}
                              </span>
                            </button>
                          );
                        })()}
                      </div>
                    </TableCell>
                  )}
                  {isUVisible("status") && (
                    <TableCell>
                      <div className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          {isUserLocked(u) ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                              <span className="text-xs font-semibold text-red-600 dark:text-red-400">
                                {ar ? "مقفول" : "Locked"}
                              </span>
                            </>
                          ) : isUserActive(u) ? (
                            <>
                              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                              <span className="text-xs font-semibold text-green-700 dark:text-green-400">
                                {ar ? "نشط" : "Active"}
                              </span>
                            </>
                          ) : (
                            <>
                              <div className="w-2 h-2 rounded-full bg-gray-400" />
                              <span className="text-xs font-semibold text-gray-500">
                                {ar ? "غير نشط" : "Inactive"}
                              </span>
                            </>
                          )}
                        </div>

                        {/* Security Telemetry */}
                        {u.failedLoginAttempts > 0 && (
                          <div className="flex items-center gap-1">
                            <span
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30"
                              title={
                                ar
                                  ? `${u.failedLoginAttempts} محاولات دخول فاشلة`
                                  : `${u.failedLoginAttempts} failed login attempts`
                              }
                            >
                              <AlertTriangle className="w-2.5 h-2.5 text-amber-500" />
                              {u.failedLoginAttempts}{" "}
                              {ar ? "محاولة فاشلة" : "failed"}
                            </span>
                          </div>
                        )}

                        {u.lockedUntil &&
                          new Date(u.lockedUntil) > new Date() && (
                            <span className="text-[10px] text-muted-foreground block font-mono">
                              {ar ? "مغلق حتى: " : "locked until: "}
                              {new Date(u.lockedUntil).toLocaleTimeString([], {
                                hour: "2-digit",
                                minute: "2-digit",
                              })}
                            </span>
                          )}

                        {/* Quick 1-Click Unlock button right in status cell */}
                        {isUserLocked(u) && (
                          <PermissionGate module="users" action="unlock">
                            <Button
                              variant="outline"
                              size="sm"
                              disabled={unlockingUserId === u.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                handleUnlockUser(u);
                              }}
                              className="h-6 px-2 text-[11px] font-medium text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 rounded-md gap-1 shadow-none"
                              title={
                                ar
                                  ? "فك قفل الحساب فوراً"
                                  : "Unlock account now"
                              }
                            >
                              {unlockingUserId === u.id ? (
                                <RefreshCw className="w-3 h-3 animate-spin text-amber-600" />
                              ) : (
                                <Unlock className="w-3 h-3 text-amber-600" />
                              )}
                              <span>{ar ? "فك القفل" : "Unlock"}</span>
                            </Button>
                          </PermissionGate>
                        )}
                      </div>
                    </TableCell>
                  )}
                  {isUVisible("actions") && (
                    <TableCell>
                      <div className="flex items-center gap-1">
                        {/* Standalone Quick Unlock for Locked Users */}
                        {isUserLocked(u) && (
                          <PermissionGate module="users" action="unlock">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-8 px-2 text-xs font-semibold text-amber-700 bg-amber-50 hover:bg-amber-100 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800 rounded-lg gap-1.5 transition-all shadow-sm"
                              onClick={() => handleUnlockUser(u)}
                              disabled={unlockingUserId === u.id}
                              title={
                                ar
                                  ? "فك قفل الحساب وإعادة تفعيله"
                                  : "Unlock Account and Reactivate"
                              }
                            >
                              {unlockingUserId === u.id ? (
                                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                              ) : (
                                <Unlock className="w-3.5 h-3.5" />
                              )}
                              <span className="hidden md:inline">
                                {ar ? "فك القفل" : "Unlock"}
                              </span>
                            </Button>
                          </PermissionGate>
                        )}

                        <PermissionGate
                          module="users"
                          action="manage_permissions"
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:text-[#C9A24D] hover:bg-[#C9A24D]/10 rounded-lg transition-colors"
                            onClick={() => openUserSheet(u, "permissions")}
                            title={
                              ar ? "صلاحيات المستخدم" : "Manage Permissions"
                            }
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
                          <DropdownMenuContent align="end" className="w-56">
                            {/* 1. Edit Profile & Security */}
                            <PermissionGate module="users" action="edit">
                              <DropdownMenuItem
                                onClick={() => openUserSheet(u, "profile")}
                                className="cursor-pointer"
                              >
                                <UserCog className="w-4 h-4 me-2 text-blue-600" />
                                <span>
                                  {ar
                                    ? "تعديل البيانات والأمان"
                                    : "Edit Profile & Security"}
                                </span>
                              </DropdownMenuItem>
                            </PermissionGate>

                            {/* 2. User Permissions */}
                            <PermissionGate
                              module="users"
                              action="manage_permissions"
                            >
                              <DropdownMenuItem
                                onClick={() => openUserSheet(u, "permissions")}
                                className="cursor-pointer"
                              >
                                <Shield className="w-4 h-4 me-2 text-[#C9A24D]" />
                                <span>
                                  {ar ? "صلاحيات المستخدم" : "User Permissions"}
                                </span>
                              </DropdownMenuItem>
                            </PermissionGate>

                            {/* 3. Authorized Properties */}
                            {(isSuperAdmin ||
                              can("users", "edit") ||
                              can("users", "manage_permissions")) &&
                              u.roles?.[0] !== "super_admin" && (
                                <DropdownMenuItem
                                  onClick={() => openUserSheet(u, "properties")}
                                  className="cursor-pointer"
                                >
                                  <Building2 className="w-4 h-4 me-2 text-green-600" />
                                  <span>
                                    {ar
                                      ? "الفنادق المصرح بها"
                                      : "Authorized Properties"}
                                  </span>
                                </DropdownMenuItem>
                              )}

                            {/* 4. Digital Signature */}
                            {(isSuperAdmin ||
                              can("users", "edit") ||
                              u.id === currentUser?.id) && (
                              <DropdownMenuItem
                                onClick={() => openUserSheet(u, "signature")}
                                className="cursor-pointer"
                              >
                                <Upload className="w-4 h-4 me-2 text-slate-600" />
                                <span>
                                  {ar
                                    ? "التوقيع الإلكتروني"
                                    : "Digital Signature"}
                                </span>
                              </DropdownMenuItem>
                            )}

                            {/* 5. View in Full Matrix */}
                            <PermissionGate
                              module="users"
                              action="manage_permissions"
                            >
                              <DropdownMenuItem
                                onClick={() => {
                                  setMatrixTargetUserId(u.id);
                                  setActiveMainTab("matrix");
                                }}
                                className="cursor-pointer text-muted-foreground hover:text-foreground"
                              >
                                <ShieldCheck className="w-4 h-4 me-2 text-[#C9A24D]" />
                                <span>
                                  {ar
                                    ? "عرض في مصفوفة الصلاحيات"
                                    : "View in Full Matrix"}
                                </span>
                              </DropdownMenuItem>
                            </PermissionGate>

                            {/* 6. Instant Unlock Account (when locked) */}
                            {isUserLocked(u) && (
                              <PermissionGate module="users" action="unlock">
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  onClick={() => handleUnlockUser(u)}
                                  disabled={unlockingUserId === u.id}
                                  className="cursor-pointer font-medium text-amber-600 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-950/20"
                                >
                                  {unlockingUserId === u.id ? (
                                    <RefreshCw className="w-4 h-4 me-2 animate-spin" />
                                  ) : (
                                    <Unlock className="w-4 h-4 me-2" />
                                  )}
                                  <span>
                                    {ar
                                      ? "فك قفل الحساب فوراً"
                                      : "Instant Unlock Account"}
                                  </span>
                                </DropdownMenuItem>
                              </PermissionGate>
                            )}

                            <DropdownMenuSeparator />
                            {/* 7. Delete User */}
                            <PermissionGate module="users" action="delete">
                              <DropdownMenuItem
                                onClick={() => setDeleteUser(u)}
                                disabled={u.username === currentUser?.username}
                                className="cursor-pointer text-red-600 dark:text-red-400 focus:text-red-700"
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
  );
}
