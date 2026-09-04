import { useState, useMemo, useEffect } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
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
  ShieldAlert,
  Check,
  X,
  ShieldCheck,
  Search,
  Lock,
  Sparkles,
  Eye,
  Sliders,
  Layers,
  FolderLock,
  User,
  LayoutDashboard,
  Building2,
  Users,
  CalendarCheck,
  BedDouble,
  MessageSquare,
  Sparkles as HousekeepingIcon,
  Wrench,
  FileBarChart,
  UserCheck,
  Building,
  Trophy,
  Settings,
  Activity,
  FileText,
  CreditCard,
  Radio,
  Award,
  ClipboardList,
  Flame,
  KeyRound,
  RotateCcw,
  Crown,
  UserPlus,
} from "lucide-react";
import { toast } from "sonner";
import {
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  MODULE_DESCRIPTIONS,
  ACTION_LABELS,
  PERMISSION_GROUPS,
  permKey,
  ROLE_DEFAULT_PERMISSIONS,
  type Module,
  type Action,
} from "@/lib/permissions";
import { SYSTEM_ROLES as ROLES, roleColor } from "../utils";

interface PermissionMatrixCenterProps {
  users: any[];
  selectedUserId?: number | null;
  onSelectUser?: (userId: number) => void;
  properties?: any[];
}

export function PermissionMatrixCenter({
  users,
  selectedUserId,
  onSelectUser,
  properties,
}: PermissionMatrixCenterProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  // Selected User state
  const [currentUserId, setCurrentUserId] = useState<number>(() => {
    if (selectedUserId && users.some((u) => u.id === selectedUserId)) {
      return selectedUserId;
    }
    return users[0]?.id ?? 0;
  });

  useEffect(() => {
    if (selectedUserId && users.some((u) => u.id === selectedUserId)) {
      setCurrentUserId(selectedUserId);
    }
  }, [selectedUserId, users]);

  const activeUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || users[0] || null;
  }, [users, currentUserId]);

  const getInitialPerms = (userObj: any): Set<string> => {
    if (!userObj) return new Set();
    const explicit = (userObj.permissions as string[] | undefined) ?? [];
    if (explicit.length > 0) {
      if (explicit.length === 1 && explicit[0] === "none") return new Set();
      return new Set(explicit);
    }
    const role = userObj.roles?.[0]?.toLowerCase() ?? "";
    return new Set(ROLE_DEFAULT_PERMISSIONS[role] ?? []);
  };

  const [perms, setPerms] = useState<Set<string>>(() => getInitialPerms(activeUser));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [hasChanges, setHasChanges] = useState(false);

  // When active user changes, reset permissions to their stored values
  useEffect(() => {
    if (activeUser) {
      setPerms(getInitialPerms(activeUser));
      setHasChanges(false);
    }
  }, [activeUser?.id]);

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(
          ar
            ? `تم تحديث صلاحيات ${activeUser?.username} بنجاح`
            : `Permissions updated for ${activeUser?.username}`,
        );
        setHasChanges(false);
      },
      onError: (e: any) =>
        toast.error(
          e.message ||
            (ar ? "فشل حفظ الصلاحيات" : "Failed to save permissions"),
        ),
    },
  });

  // Action toggle with auto-dependency logic
  const toggleAction = (m: Module, a: Action) => {
    const key = permKey(m, a);
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (a === "view") {
          // If view is disabled, disable all other actions for this module
          (MODULE_ACTIONS[m] ?? []).forEach((other) => {
            next.delete(permKey(m, other));
          });
        }
      } else {
        next.add(key);
        // Must have view to do any action
        if (a !== "view" && (MODULE_ACTIONS[m] ?? []).includes("view")) {
          next.add(permKey(m, "view"));
        }
      }
      return next;
    });
    setHasChanges(true);
  };

  // Master module switch
  const toggleModuleMaster = (m: Module, shouldEnable: boolean) => {
    const modulePerms = MODULE_ACTIONS[m] ?? [];
    setPerms((prev) => {
      const next = new Set(prev);
      if (shouldEnable) {
        modulePerms.forEach((a) => next.add(permKey(m, a)));
      } else {
        modulePerms.forEach((a) => next.delete(permKey(m, a)));
      }
      return next;
    });
    setHasChanges(true);
  };

  const applyRoleDefaults = (roleKey: string) => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[roleKey] ?? [];
    setPerms(new Set(defaults));
    setHasChanges(true);
    toast.info(
      ar
        ? `تم تطبيق قالب دور: ${ROLES.find((r) => r.value === roleKey)?.label || roleKey}`
        : `Applied template: ${roleKey}`,
    );
  };

  const selectAll = () => {
    setPerms(
      new Set(
        MODULES.flatMap((m) =>
          (MODULE_ACTIONS[m] ?? []).map((a) => permKey(m, a)),
        ),
      ),
    );
    setHasChanges(true);
  };

  const deselectAll = () => {
    setPerms(new Set());
    setHasChanges(true);
  };

  const applyReadOnlyAll = () => {
    const readOnly = new Set<string>();
    MODULES.forEach((m) => {
      if ((MODULE_ACTIONS[m] ?? []).includes("view")) {
        readOnly.add(permKey(m, "view"));
      }
    });
    setPerms(readOnly);
    setHasChanges(true);
    toast.info(ar ? "تم تطبيق صلاحيات العرض فقط لكافة الأقسام" : "Applied Read-Only to all");
  };

  const resetToStored = () => {
    if (activeUser) {
      setPerms(getInitialPerms(activeUser));
      setHasChanges(false);
      toast.info(ar ? "تمت استعادة الصلاحيات الأصلية" : "Reset to stored permissions");
    }
  };

  const save = () => {
    if (!activeUser) return;
    const toSave = Array.from(perms);
    updateMutation.mutate({
      id: activeUser.id,
      data: { permissions: toSave.length === 0 ? ["none"] : toSave },
    });
  };

  const totalPossible = MODULES.reduce(
    (sum, m) => sum + (MODULE_ACTIONS[m] ?? []).length,
    0,
  );

  const getModuleIcon = (m: Module) => {
    switch (m) {
      case "dashboard":
        return <LayoutDashboard className="w-5 h-5 text-blue-500" />;
      case "housing":
        return <Building2 className="w-5 h-5 text-indigo-500" />;
      case "profiles":
        return <Users className="w-5 h-5 text-amber-500" />;
      case "reservations":
        return <CalendarCheck className="w-5 h-5 text-blue-600" />;
      case "accommodation":
        return <BedDouble className="w-5 h-5 text-emerald-500" />;
      case "hosting_requests":
        return <MessageSquare className="w-5 h-5 text-rose-500" />;
      case "guest_hosting":
        return <UserPlus className="w-5 h-5 text-purple-600" />;
      case "housekeeping":
        return <HousekeepingIcon className="w-5 h-5 text-orange-500" />;
      case "maintenance":
        return <Wrench className="w-5 h-5 text-orange-600" />;
      case "reports":
        return <FileBarChart className="w-5 h-5 text-teal-500" />;
      case "users":
        return <UserCheck className="w-5 h-5 text-cyan-600" />;
      case "properties":
        return <Building className="w-5 h-5 text-green-600" />;
      case "portal_content":
        return <Trophy className="w-5 h-5 text-purple-500" />;
      case "settings":
        return <Settings className="w-5 h-5 text-slate-500" />;
      case "activity_log":
        return <Activity className="w-5 h-5 text-rose-600" />;
      case "documents":
        return <FileText className="w-5 h-5 text-blue-400" />;
      case "billing":
        return <CreditCard className="w-5 h-5 text-emerald-600" />;
      case "communications":
        return <Radio className="w-5 h-5 text-sky-500" />;
      case "evaluations":
        return <Award className="w-5 h-5 text-indigo-600" />;
      case "surveys":
        return <ClipboardList className="w-5 h-5 text-green-500" />;
      case "activities":
        return <Flame className="w-5 h-5 text-amber-600" />;
      case "smart_locks":
        return <KeyRound className="w-5 h-5 text-yellow-600" />;
      default:
        return <Sliders className="w-5 h-5 text-primary" />;
    }
  };

  const getActionColor = (action: string) => {
    switch (action) {
      case "view":
      case "read":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/50";
      case "create":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50";
      case "edit":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
      case "delete":
      case "bulk_delete":
        return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/50";
      case "approve":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/50";
      case "export":
      case "bulk_export":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700/50";
    }
  };

  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return PERMISSION_GROUPS.map((group) => {
      const isGroupSelected =
        selectedGroup === "all" || selectedGroup === group.id;
      if (!isGroupSelected) return null;

      const matchingModules = group.modules.filter((m) => {
        if (!query) return true;
        const enLabel = (MODULE_LABELS[m]?.en || m).toLowerCase();
        const arLabel = (MODULE_LABELS[m]?.ar || "").toLowerCase();
        const descAr = (MODULE_DESCRIPTIONS[m]?.ar || "").toLowerCase();
        const descEn = (MODULE_DESCRIPTIONS[m]?.en || "").toLowerCase();
        return (
          enLabel.includes(query) ||
          arLabel.includes(query) ||
          descAr.includes(query) ||
          descEn.includes(query) ||
          m.includes(query)
        );
      });

      if (matchingModules.length === 0) return null;

      return {
        ...group,
        modules: matchingModules,
      };
    }).filter(Boolean) as typeof PERMISSION_GROUPS;
  }, [searchQuery, selectedGroup]);

  const moduleStatus = (m: Module) => {
    const modulePerms = MODULE_ACTIONS[m] ?? [];
    const checked = modulePerms.filter((a) => perms.has(permKey(m, a))).length;
    const hasView = perms.has(permKey(m, "view"));
    const isMasterOn = checked > 0;
    const isAllOn = checked === modulePerms.length;

    return {
      checked,
      total: modulePerms.length,
      hasView,
      isMasterOn,
      isAllOn,
    };
  };

  if (!activeUser) {
    return (
      <div className="p-12 text-center text-muted-foreground">
        {ar ? "لا يوجد مستخدمون متاحون" : "No users available"}
      </div>
    );
  }

  const isSuper = (activeUser.roles || []).some(
    (r: string) => r.toLowerCase() === "super_admin",
  );

  return (
    <div className="space-y-6">
      {/* ── Executive Header Bar: User Selector & Profile Card ── */}
      <div className="p-5 sm:p-6 rounded-3xl bg-gradient-to-r from-slate-900 via-[#0F2A44] to-slate-900 text-white shadow-xl border border-white/10">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          {/* User Selector + Profile */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4 flex-1">
            <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
              {isSuper ? (
                <Crown className="w-7 h-7 text-white" />
              ) : (
                <ShieldCheck className="w-7 h-7 text-white" />
              )}
            </div>
            <div className="space-y-1.5 flex-1 min-w-0">
              <div className="flex flex-wrap items-center gap-3">
                <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight">
                  {ar ? "مركز إدارة الصلاحيات والمصفوفة" : "Permission Control Center"}
                </h2>
                {hasChanges && (
                  <Badge className="bg-amber-500 text-slate-950 font-bold animate-pulse text-xs">
                    {ar ? "تغييرات غير محفوظة" : "Unsaved Changes"}
                  </Badge>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3 text-xs sm:text-sm text-slate-300">
                <span>{ar ? "المستخدم المحدد:" : "Selected User:"}</span>
                <div className="min-w-[200px] sm:min-w-[260px]">
                  <Select
                    value={String(currentUserId)}
                    onValueChange={(val) => {
                      const id = Number(val);
                      setCurrentUserId(id);
                      if (onSelectUser) onSelectUser(id);
                    }}
                  >
                    <SelectTrigger className="h-9 bg-white/10 border-white/20 text-white font-bold rounded-xl focus:ring-amber-500">
                      <SelectValue placeholder={activeUser.username} />
                    </SelectTrigger>
                    <SelectContent className="max-h-72">
                      {users.map((u) => (
                        <SelectItem key={u.id} value={String(u.id)} className="cursor-pointer">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold">{u.username}</span>
                            <span className="text-xs text-muted-foreground">
                              ({u.roles?.[0] || "user"})
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center gap-1.5">
                  <span
                    className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${roleColor(
                      activeUser.roles?.[0] || "user",
                    )}`}
                  >
                    {activeUser.roles?.[0]?.replace(/_/g, " ") || "user"}
                  </span>
                  {activeUser.jobTitle && (
                    <span className="text-xs text-slate-400">
                      • {activeUser.jobTitle.replace(/_/g, " ")}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* Live Metric Display */}
          <div className="flex items-center gap-4 bg-white/5 border border-white/10 rounded-2xl p-4 self-stretch sm:self-auto justify-between sm:justify-start">
            <div>
              <div className="text-xs text-slate-400 font-medium">
                {ar ? "الصلاحيات النشطة" : "Active Access"}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-black text-white">{perms.size}</span>
                <span className="text-xs text-slate-400 font-medium">/ {totalPossible}</span>
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

      {/* ── Toolbar: Quick Presets, Search & Category Filters ── */}
      <div className="p-4 sm:p-5 rounded-2xl border bg-card shadow-xs space-y-4">
        {/* Row 1: Role Presets */}
        <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b pb-4">
          <div className="space-y-1.5 flex-1">
            <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
              {ar ? "قوالب الأدوار السريعة (تطبيق بنقرة واحدة على المستخدم الحالي)" : "One-Click Role Presets"}
            </div>
            <div className="flex flex-wrap gap-2">
              {ROLES.map((r: any) => (
                <button
                  key={r.value}
                  type="button"
                  onClick={() => applyRoleDefaults(r.value)}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border bg-muted/40 hover:bg-muted transition-all flex items-center gap-1.5 shadow-2xs"
                >
                  <div
                    className={`w-2 h-2 rounded-full bg-current ${roleColor(
                      r.value,
                    )
                      .replace("bg-", "text-")
                      .split(" ")[0]}`}
                  />
                  <span>{r.label}</span>
                </button>
              ))}
              <button
                type="button"
                onClick={applyReadOnlyAll}
                className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-2xs"
                title={ar ? "منح صلاحيات العرض فقط لكافة الأقسام" : "Grant view-only across all modules"}
              >
                <Eye className="w-3.5 h-3.5 text-blue-600" />
                <span>{ar ? "عرض فقط للكل" : "Read-Only All"}</span>
              </button>
            </div>
          </div>

          {/* Quick Actions */}
          <div className="flex items-center gap-2 self-end lg:self-auto">
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold rounded-xl"
              onClick={selectAll}
            >
              <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
              {ar ? "تحديد الكل" : "Select All"}
            </Button>
            <Button
              size="sm"
              variant="outline"
              className="h-8 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
              onClick={deselectAll}
            >
              <X className="w-3.5 h-3.5 mr-1" />
              {ar ? "إلغاء الكل (حجب كامل)" : "Clear All"}
            </Button>
            {hasChanges && (
              <Button
                size="sm"
                variant="ghost"
                className="h-8 text-xs font-semibold rounded-xl text-muted-foreground"
                onClick={resetToStored}
              >
                <RotateCcw className="w-3.5 h-3.5 mr-1" />
                {ar ? "استعادة" : "Reset"}
              </Button>
            )}
          </div>
        </div>

        {/* Row 2: Search Bar + Group Filter Tabs */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="w-4 h-4 text-muted-foreground absolute start-3.5 top-1/2 -translate-y-1/2" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                ar
                  ? "ابحث عن أي موديول (مثال: الإسكان، التسكين، الحجوزات، الصيانة)..."
                  : "Search any module or keyword..."
              }
              className="ps-10 pe-9 h-10 text-xs rounded-xl"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => setSearchQuery("")}
                className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="w-4 h-4" />
              </button>
            )}
          </div>

          {/* Category Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
            <button
              type="button"
              onClick={() => setSelectedGroup("all")}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                selectedGroup === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "bg-muted/60 hover:bg-muted text-muted-foreground"
              }`}
            >
              {ar ? "كافة الأقسام" : "All Modules"}
            </button>
            {PERMISSION_GROUPS.map((g) => (
              <button
                key={g.id}
                type="button"
                onClick={() => setSelectedGroup(g.id)}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedGroup === g.id
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground"
                }`}
              >
                {ar ? g.label.ar : g.label.en}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ── Main Modules Content Grid ── */}
      <div className="space-y-8">
        {filteredGroups.length === 0 ? (
          <div className="p-16 text-center rounded-3xl border bg-card">
            <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
              <Search className="w-7 h-7 text-muted-foreground" />
            </div>
            <h3 className="text-lg font-bold text-foreground">
              {ar ? "لا توجد نتائج مطابقة لبحثك" : "No matching modules found"}
            </h3>
            <p className="text-xs text-muted-foreground mt-1">
              {ar ? "جرب البحث باسم صفحة أخرى أو إزالة الفلتر" : "Try a different search query"}
            </p>
          </div>
        ) : (
          filteredGroups.map((group) => {
            return (
              <section key={group.id} className="space-y-3">
                <div className="flex items-center justify-between border-b pb-2 px-1">
                  <div className="flex items-center gap-2">
                    <Layers className="w-5 h-5 text-[#C9A24D]" />
                    <h3 className="text-base font-bold text-foreground">
                      {ar ? group.label.ar : group.label.en}
                    </h3>
                    <Badge variant="outline" className="text-xs font-semibold">
                      {group.modules.length} {ar ? "موديول" : "modules"}
                    </Badge>
                  </div>
                  <span className="text-xs text-muted-foreground hidden sm:inline">
                    {ar ? group.description.ar : group.description.en}
                  </span>
                </div>

                <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4">
                  {group.modules.map((m) => {
                    const modulePerms = MODULE_ACTIONS[m] ?? [];
                    const status = moduleStatus(m);

                    return (
                      <div
                        key={m}
                        className={`rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                          !status.isMasterOn
                            ? "bg-muted/15 border-border/60 opacity-80"
                            : "bg-card border-border shadow-xs hover:shadow-md"
                        }`}
                      >
                        {/* Card Header */}
                        <div
                          className={`p-4 border-b ${
                            !status.isMasterOn
                              ? "bg-muted/30"
                              : status.isAllOn
                              ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20"
                              : "bg-primary/5 border-primary/15"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="flex items-start gap-3 min-w-0">
                              <div
                                className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                  !status.isMasterOn
                                    ? "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                    : "bg-card shadow-xs border"
                                }`}
                              >
                                {getModuleIcon(m)}
                              </div>
                              <div className="min-w-0">
                                <h4 className="font-bold text-sm sm:text-base text-foreground truncate">
                                  {ar ? MODULE_LABELS[m]?.ar : MODULE_LABELS[m]?.en}
                                </h4>
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                  {ar
                                    ? MODULE_DESCRIPTIONS[m]?.ar
                                    : MODULE_DESCRIPTIONS[m]?.en}
                                </p>
                              </div>
                            </div>

                            {/* Master Toggle */}
                            <div className="flex flex-col items-end gap-1 flex-shrink-0">
                              <Switch
                                checked={status.isMasterOn}
                                onCheckedChange={(val) => toggleModuleMaster(m, val)}
                                className="data-[state=checked]:bg-emerald-600 scale-110"
                                title={ar ? "تفعيل أو إغلاق الموديول بالكامل" : "Toggle module"}
                              />
                              <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                {status.isMasterOn
                                  ? ar
                                    ? "مفعل"
                                    : "Enabled"
                                  : ar
                                  ? "مغلق"
                                  : "Disabled"}
                              </span>
                            </div>
                          </div>

                          {/* Status Badge */}
                          <div className="mt-3 flex items-center justify-between">
                            {!status.isMasterOn ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] py-0.5 px-2 font-bold border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-1"
                              >
                                <Lock className="w-3 h-3" />
                                <span>{ar ? "مغلق تماماً (غير مرئي للمستخدم)" : "Fully Blocked (Hidden)"}</span>
                              </Badge>
                            ) : status.isAllOn ? (
                              <Badge
                                variant="outline"
                                className="text-[11px] py-0.5 px-2 font-bold border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                              >
                                <Check className="w-3 h-3" />
                                <span>{ar ? "وصول كامل لكافة العمليات" : "Full Access"} ({status.checked}/{status.total})</span>
                              </Badge>
                            ) : (
                              <Badge
                                variant="outline"
                                className="text-[11px] py-0.5 px-2 font-bold border-blue-300 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center gap-1"
                              >
                                <Eye className="w-3 h-3" />
                                <span>{ar ? "وصول مخصص" : "Custom Access"} ({status.checked}/{status.total})</span>
                              </Badge>
                            )}

                            <span className="text-[10px] font-mono text-muted-foreground">
                              {m}
                            </span>
                          </div>
                        </div>

                        {/* Card Body: Actions List */}
                        <div className="p-3.5 flex-1">
                          {!status.isMasterOn ? (
                            <div className="h-full min-h-[90px] p-3 rounded-2xl bg-muted/30 border border-dashed border-border/70 flex flex-col items-center justify-center text-center gap-2">
                              <FolderLock className="w-6 h-6 text-rose-500/80" />
                              <p className="text-xs text-muted-foreground max-w-xs">
                                {ar
                                  ? "تم إغلاق هذه الصفحة بالكامل. لن تظهر في القائمة الجانبية ولن يتمكن المستخدم من دخولها."
                                  : "This page is blocked. It will not appear in the sidebar or via direct URL."}
                              </p>
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                className="h-7 text-xs font-bold text-primary hover:text-primary/90 mt-1"
                                onClick={() => toggleModuleMaster(m, true)}
                              >
                                {ar ? "فتح هذه الصفحة" : "Enable Page"}
                              </Button>
                            </div>
                          ) : (
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {modulePerms.map((a) => {
                                const isChecked = perms.has(permKey(m, a));
                                const isViewAction = a === "view";
                                const isActionDisabled = !isViewAction && !status.hasView;

                                return (
                                  <div
                                    key={a}
                                    onClick={() => {
                                      if (!isActionDisabled) toggleAction(m, a);
                                    }}
                                    className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 select-none ${
                                      isActionDisabled
                                        ? "opacity-40 cursor-not-allowed bg-muted/20 border-border/40"
                                        : isChecked
                                        ? "bg-primary/5 border-primary/25 cursor-pointer hover:bg-primary/10 shadow-2xs"
                                        : "bg-card hover:bg-muted/50 cursor-pointer border-border/70"
                                    }`}
                                  >
                                    <div className="flex items-center gap-2 min-w-0">
                                      <Badge
                                        variant="outline"
                                        className={`capitalize text-[9px] px-1.5 py-0 font-bold tracking-wider ${getActionColor(
                                          a,
                                        )}`}
                                      >
                                        {a}
                                      </Badge>
                                      <span className="text-xs font-bold text-foreground/90 truncate">
                                        {ar
                                          ? ACTION_LABELS[a]?.ar || a
                                          : ACTION_LABELS[a]?.en || a}
                                      </span>
                                    </div>
                                    <Switch
                                      checked={isChecked}
                                      disabled={isActionDisabled}
                                      onCheckedChange={() => toggleAction(m, a)}
                                      onClick={(e) => e.stopPropagation()}
                                      className="scale-75 data-[state=checked]:bg-[#0F2A44] dark:data-[state=checked]:bg-[#C9A24D]"
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </div>

      {/* ── Floating / Sticky Save Bar ── */}
      <div className="sticky bottom-4 z-20 p-4 rounded-2xl bg-card/95 backdrop-blur-md border shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
            <ShieldAlert className="w-5 h-5 text-primary" />
          </div>
          <div>
            <div className="text-sm font-bold text-foreground">
              {ar
                ? `حفظ مصفوفة صلاحيات: ${activeUser.username}`
                : `Save Permissions for ${activeUser.username}`}
            </div>
            <div className="text-xs text-muted-foreground">
              {perms.size} {ar ? "صلاحية نشطة من أصل" : "active permissions out of"} {totalPossible}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {hasChanges && (
            <Button variant="ghost" size="sm" onClick={resetToStored}>
              {ar ? "تراجع" : "Cancel"}
            </Button>
          )}
          <Button
            onClick={save}
            disabled={updateMutation.isPending}
            className="bg-gradient-to-r from-[#0F2A44] via-slate-900 to-[#0F2A44] hover:opacity-95 text-white font-bold gap-2 shadow-lg min-w-[180px] h-11 rounded-xl"
          >
            <ShieldCheck className="w-4 h-4 text-[#C9A24D]" />
            {updateMutation.isPending
              ? ar
                ? "جاري حفظ الصلاحيات..."
                : "Saving..."
              : ar
              ? "تأكيد وحفظ الصلاحيات"
              : "Confirm & Save Permissions"}
          </Button>
        </div>
      </div>
    </div>
  );
}
