// Permission center header: target user picker, unsaved-changes bar, save/reset.
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Check,
  ShieldCheck,
  Search,
  Sparkles,
  Crown,
  ChevronDown,
  MinusCircle,
  Shield,
} from "lucide-react";
import { roleColor } from "../../utils";
import type {
  PermissionMatrixCenterState,
  PermissionMatrixCenterView,
} from "./usePermissionMatrixCenterState";

export function renderMatrixHeader(
  s: PermissionMatrixCenterState,
  v: PermissionMatrixCenterView,
) {
  const {
    onSelectUser,
    ar,
    currentUserId,
    setCurrentUserId,
    primaryRole,
    perms,
    hasChanges,
    userPickerOpen,
    setUserPickerOpen,
    userSearchText,
    setUserSearchText,
    totalPossible,
    diffStats,
    filteredUsersList,
  } = s;
  const { activeUser, isSuper } = v;
  return (
    <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0F2A44] to-slate-900 text-white shadow-xl border border-white/10">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
        {/* User Profile & Selector */}
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1 min-w-0">
          <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
            {isSuper ? (
              <Crown className="w-7 h-7 text-white" />
            ) : (
              <ShieldCheck className="w-7 h-7 text-white" />
            )}
          </div>

          <div className="space-y-2 flex-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                {ar
                  ? "مركز التحكم في الصلاحيات والمصفوفة"
                  : "Permission Control Center"}
              </h2>
              {hasChanges && (
                <Badge className="bg-amber-500 text-slate-950 font-bold animate-pulse text-xs">
                  {ar ? "تغييرات غير محفوظة" : "Unsaved Changes"}
                </Badge>
              )}
              {isSuper && (
                <Badge className="bg-emerald-500/20 text-emerald-200 border border-emerald-400/40 font-bold text-xs">
                  {ar
                    ? "مدير النظام: صلاحيات كاملة دائماً (لا يمكن تقييدها)"
                    : "Super admin: always full access (cannot be restricted)"}
                </Badge>
              )}
            </div>

            {/* Searchable User Selector Combobox */}
            <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300">
              <span className="font-semibold text-slate-200">
                {ar ? "المستخدم المستهدف:" : "Target User:"}
              </span>

              <Popover open={userPickerOpen} onOpenChange={setUserPickerOpen}>
                <PopoverTrigger asChild>
                  <button
                    type="button"
                    className="h-10 px-3 bg-white/10 hover:bg-white/15 border border-white/20 text-white font-bold rounded-xl flex items-center gap-2.5 transition-all text-xs sm:text-sm shadow-xs min-w-[240px]"
                  >
                    <div className="w-6 h-6 rounded-full bg-[#C9A24D] text-slate-950 flex items-center justify-center text-xs font-black flex-shrink-0">
                      {activeUser.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <span className="truncate max-w-[140px] text-start">
                      {activeUser.username}
                    </span>
                    <Badge
                      variant="outline"
                      className={`text-[10px] py-0 px-1.5 font-bold ${roleColor(
                        primaryRole,
                      )}`}
                    >
                      {activeUser.roles?.[0] || "user"}
                    </Badge>
                    <ChevronDown className="w-3.5 h-3.5 ms-auto opacity-70" />
                  </button>
                </PopoverTrigger>

                <PopoverContent
                  className="w-80 p-3 bg-popover text-popover-foreground border shadow-xl rounded-2xl"
                  align="start"
                >
                  <div className="space-y-2.5">
                    <div className="relative">
                      <Search className="w-3.5 h-3.5 absolute start-2.5 top-1/2 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        value={userSearchText}
                        onChange={(e) => setUserSearchText(e.target.value)}
                        placeholder={
                          ar
                            ? "ابحث بالاسم أو الدور..."
                            : "Search user or role..."
                        }
                        className="ps-8 pe-2 h-8 text-xs rounded-xl"
                        autoFocus
                      />
                    </div>

                    <div className="max-h-60 overflow-y-auto space-y-1">
                      {filteredUsersList.length === 0 ? (
                        <div className="p-4 text-center text-xs text-muted-foreground">
                          {ar ? "لا يوجد مستخدم مطابق" : "No users matched"}
                        </div>
                      ) : (
                        filteredUsersList.map((u) => {
                          const isSelected = u.id === currentUserId;
                          const uRole = u.roles?.[0] || "user";
                          const uExplicit =
                            (u.permissions as string[] | undefined) ?? [];
                          const hasCustom =
                            uExplicit.length > 0 && uExplicit[0] !== "none";

                          return (
                            <button
                              key={u.id}
                              type="button"
                              onClick={() => {
                                setCurrentUserId(u.id);
                                if (onSelectUser) onSelectUser(u.id);
                                setUserPickerOpen(false);
                              }}
                              className={`w-full p-2 rounded-xl flex items-center justify-between gap-2 text-start transition-colors text-xs ${
                                isSelected
                                  ? "bg-primary text-primary-foreground font-bold"
                                  : "hover:bg-muted text-foreground"
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0">
                                <div
                                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                                    isSelected
                                      ? "bg-white text-slate-900"
                                      : "bg-muted-foreground/20"
                                  }`}
                                >
                                  {u.username?.charAt(0).toUpperCase()}
                                </div>
                                <div className="min-w-0">
                                  <div className="truncate font-semibold">
                                    {u.username}
                                  </div>
                                  <div
                                    className={`text-[10px] truncate ${
                                      isSelected
                                        ? "text-primary-foreground/80"
                                        : "text-muted-foreground"
                                    }`}
                                  >
                                    {u.email || u.jobTitle || uRole}
                                  </div>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 flex-shrink-0">
                                <span
                                  className={`text-[9px] px-1.5 py-0.5 rounded-full font-bold ${
                                    isSelected
                                      ? "bg-white/20 text-white"
                                      : roleColor(uRole)
                                  }`}
                                >
                                  {uRole}
                                </span>
                                {hasCustom && (
                                  <span
                                    className={`text-[9px] px-1 py-0.5 rounded-full font-bold ${
                                      isSelected
                                        ? "bg-emerald-300 text-slate-950"
                                        : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                                    }`}
                                  >
                                    +C
                                  </span>
                                )}
                                {isSelected && (
                                  <Check className="w-3.5 h-3.5 ms-1" />
                                )}
                              </div>
                            </button>
                          );
                        })
                      )}
                    </div>
                  </div>
                </PopoverContent>
              </Popover>

              {/* Active Diff Indicators */}
              <div className="flex items-center gap-1.5 flex-wrap">
                {diffStats.customGranted > 0 && (
                  <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-xs py-0.5 px-2 font-bold gap-1">
                    <Sparkles className="w-3 h-3" />+{diffStats.customGranted}{" "}
                    {ar ? "منح مخصص" : "custom"}
                  </Badge>
                )}
                {diffStats.revoked > 0 && (
                  <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs py-0.5 px-2 font-bold gap-1">
                    <MinusCircle className="w-3 h-3" />-{diffStats.revoked}{" "}
                    {ar ? "ملغي من الدور" : "revoked"}
                  </Badge>
                )}
                {diffStats.isExactRoleMatch && (
                  <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs py-0.5 px-2 font-bold gap-1">
                    <Shield className="w-3 h-3" />
                    {ar ? "مطابق لقالب الدور" : "Matches Role Template"}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Live Progress Card */}
        <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 self-stretch lg:self-auto justify-between lg:justify-start min-w-[240px]">
          <div>
            <div className="text-xs text-slate-400 font-medium">
              {ar ? "الصلاحيات النشطة" : "Active Permissions"}
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-white">
                {perms.size}
              </span>
              <span className="text-xs text-slate-400 font-medium">
                / {totalPossible}
              </span>
            </div>
          </div>
          <div className="text-end">
            <span className="text-base font-black text-[#C9A24D]">
              {Math.round((perms.size / totalPossible) * 100)}%
            </span>
            <div className="w-24 h-2.5 bg-white/10 rounded-full overflow-hidden mt-1">
              <div
                className="h-full bg-gradient-to-r from-[#C9A24D] to-amber-400 rounded-full transition-all duration-300"
                style={{ width: `${(perms.size / totalPossible) * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
