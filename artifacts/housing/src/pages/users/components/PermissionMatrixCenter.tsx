import { useState, useMemo, useEffect } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
  RotateCcw,
  Crown,
  UserPlus,
  LayoutGrid,
  Table as TableIcon,
  Download,
  CheckCheck,
  ChevronDown,
  ChevronUp,
  MinusCircle,
  Plus,
  Shield,
  FileSpreadsheet,
  Users as UsersIcon,
  Filter,
  CheckSquare,
  Square,
  Info,
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
import { roleColor } from "../utils";

interface PermissionMatrixCenterProps {
  users: any[];
  selectedUserId?: number | null;
  onSelectUser?: (userId: number) => void;
  properties?: any[];
}

// 9 Comprehensive System Role Presets
interface SystemRolePreset {
  value: string;
  labelEn: string;
  labelAr: string;
  badgeClass: string;
}

const SYSTEM_ROLE_PRESETS: SystemRolePreset[] = [
  {
    value: "super_admin",
    labelEn: "Super Admin",
    labelAr: "مدير النظام العام",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300",
  },
  {
    value: "system_admin",
    labelEn: "System Admin",
    labelAr: "مدير النظام التقني",
    badgeClass: "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300 border-purple-300",
  },
  {
    value: "admin",
    labelEn: "Property Admin",
    labelAr: "مدير النظام",
    badgeClass: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300 border-red-300",
  },
  {
    value: "manager",
    labelEn: "Property Manager",
    labelAr: "مدير المجمع",
    badgeClass: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300 border-blue-300",
  },
  {
    value: "receptionist",
    labelEn: "Receptionist",
    labelAr: "موظف استقبال",
    badgeClass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-300 border-emerald-300",
  },
  {
    value: "maintenance_staff",
    labelEn: "Maintenance Staff",
    labelAr: "موظف صيانة فنية",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300",
  },
  {
    value: "housekeeping_staff",
    labelEn: "Housekeeping Staff",
    labelAr: "موظف خدمات ونظافة",
    badgeClass: "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300 border-sky-300",
  },
  {
    value: "hr_admin",
    labelEn: "HR Admin",
    labelAr: "مسؤول الموارد البشرية",
    badgeClass: "bg-pink-100 text-pink-800 dark:bg-pink-900/40 dark:text-pink-300 border-pink-300",
  },
  {
    value: "portal_admin",
    labelEn: "Portal Admin",
    labelAr: "مسؤول البوابة",
    badgeClass: "bg-violet-100 text-violet-800 dark:bg-violet-900/40 dark:text-violet-300 border-violet-300",
  },
  {
    value: "security_staff",
    labelEn: "Security Staff",
    labelAr: "موظف أمن",
    badgeClass: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300 border-amber-300",
  },
];

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

  const primaryRole = (activeUser?.roles?.[0] || "user").toLowerCase();

  // Role defaults for the active user
  const roleDefaults = useMemo<Set<string>>(() => {
    return new Set(ROLE_DEFAULT_PERMISSIONS[primaryRole] ?? []);
  }, [primaryRole]);

  const getInitialPerms = (userObj: any): Set<string> => {
    if (!userObj) return new Set();
    const explicit = (userObj.permissions as string[] | undefined) ?? [];
    if (explicit.length > 0) {
      if (explicit.length === 1 && explicit[0] === "none") return new Set();
      const normalized = explicit.map((p) => {
        let s = String(p).trim().toLowerCase();
        if (s.startsWith("employees.")) s = s.replace("employees.", "profiles.");
        if (s.startsWith("employees:")) s = s.replace("employees:", "profiles:");
        return s;
      });
      return new Set(normalized);
    }
    return new Set(ROLE_DEFAULT_PERMISSIONS[primaryRole] ?? []);
  };

  const [perms, setPerms] = useState<Set<string>>(() => getInitialPerms(activeUser));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userSearchText, setUserSearchText] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isDynamicInheritance, setIsDynamicInheritance] = useState<boolean>(() => {
    const explicit = (activeUser?.permissions as string[] | undefined) ?? [];
    return explicit.length === 0;
  });

  // When active user changes, reload permissions
  useEffect(() => {
    if (activeUser) {
      setPerms(getInitialPerms(activeUser));
      const explicit = (activeUser.permissions as string[] | undefined) ?? [];
      setIsDynamicInheritance(explicit.length === 0);
      setHasChanges(false);
    }
  }, [activeUser?.id]);

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
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

  // Action search matching: checks English and Arabic labels & keys
  const matchesActionSearch = (action: Action, query: string): boolean => {
    if (!query) return false;
    const q = query.trim().toLowerCase();
    const en = (ACTION_LABELS[action]?.en || action).toLowerCase();
    const arLabel = (ACTION_LABELS[action]?.ar || "").toLowerCase();
    return en.includes(q) || arLabel.includes(q) || action.toLowerCase().includes(q);
  };

  // Toggle single action with dependency logic:
  // - Disabling view disables all actions for this module.
  // - Enabling any action enables view.
  const toggleAction = (m: Module, a: Action) => {
    setIsDynamicInheritance(false);
    const key = permKey(m, a);
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (a === "view") {
          (MODULE_ACTIONS[m] ?? []).forEach((other) => {
            next.delete(permKey(m, other));
          });
        }
      } else {
        next.add(key);
        if (a !== "view" && (MODULE_ACTIONS[m] ?? []).includes("view")) {
          next.add(permKey(m, "view"));
        }
      }
      return next;
    });
    setHasChanges(true);
  };

  // Master switch for an entire module
  const toggleModuleMaster = (m: Module, shouldEnable: boolean) => {
    setIsDynamicInheritance(false);
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

  // Category-level bulk action
  const toggleCategoryGroup = (groupId: string, shouldEnable: boolean) => {
    setIsDynamicInheritance(false);
    const group = PERMISSION_GROUPS.find((g) => g.id === groupId);
    if (!group) return;

    setPerms((prev) => {
      const next = new Set(prev);
      group.modules.forEach((m) => {
        const acts = MODULE_ACTIONS[m] ?? [];
        acts.forEach((a) => {
          if (shouldEnable) {
            next.add(permKey(m, a));
          } else {
            next.delete(permKey(m, a));
          }
        });
      });
      return next;
    });
    setHasChanges(true);

    toast.info(
      shouldEnable
        ? ar
          ? `تم تفعيل كافة صلاحيات ${group.label.ar}`
          : `Selected all permissions in ${group.label.en}`
        : ar
        ? `تم مسح صلاحيات ${group.label.ar}`
        : `Cleared all permissions in ${group.label.en}`,
    );
  };

  // Bulk column toggle for Spreadsheet Table View (e.g. toggle View column across all visible modules)
  const toggleColumnAction = (action: Action) => {
    setIsDynamicInheritance(false);
    // Find all visible modules that support this action
    const candidateModules = visibleModules.filter((m) =>
      (MODULE_ACTIONS[m] ?? []).includes(action),
    );
    if (candidateModules.length === 0) return;

    // Check if all are currently checked
    const allEnabled = candidateModules.every((m) =>
      perms.has(permKey(m, action)),
    );

    setPerms((prev) => {
      const next = new Set(prev);
      if (allEnabled) {
        // Disable action across candidate modules
        candidateModules.forEach((m) => {
          next.delete(permKey(m, action));
          if (action === "view") {
            (MODULE_ACTIONS[m] ?? []).forEach((other) => {
              next.delete(permKey(m, other));
            });
          }
        });
      } else {
        // Enable action across candidate modules
        candidateModules.forEach((m) => {
          next.add(permKey(m, action));
          if (action !== "view" && (MODULE_ACTIONS[m] ?? []).includes("view")) {
            next.add(permKey(m, "view"));
          }
        });
      }
      return next;
    });

    setHasChanges(true);
    toast.info(
      allEnabled
        ? ar
          ? `تم تعطيل عملية (${action}) عبر الموديولات الظاهرة`
          : `Disabled ${action} across visible modules`
        : ar
        ? `تم تفعيل عملية (${action}) عبر الموديولات الظاهرة`
        : `Enabled ${action} across visible modules`,
    );
  };

  const applyRoleDefaults = (roleKey: string) => {
    setIsDynamicInheritance(false);
    const defaults = ROLE_DEFAULT_PERMISSIONS[roleKey] ?? [];
    setPerms(new Set(defaults));
    setHasChanges(true);
    const preset = SYSTEM_ROLE_PRESETS.find((r) => r.value === roleKey);
    toast.info(
      ar
        ? `تم تطبيق قالب الدور: ${preset ? preset.labelAr : roleKey}`
        : `Applied role preset: ${preset ? preset.labelEn : roleKey}`,
    );
  };

  const selectAll = () => {
    setIsDynamicInheritance(false);
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
    setIsDynamicInheritance(false);
    setPerms(new Set());
    setHasChanges(true);
  };

  const applyReadOnlyAll = () => {
    setIsDynamicInheritance(false);
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
      const explicit = (activeUser.permissions as string[] | undefined) ?? [];
      setIsDynamicInheritance(explicit.length === 0);
      setHasChanges(false);
      toast.info(ar ? "تمت استعادة الصلاحيات الأصلية المحفوظة" : "Reset to stored permissions");
    }
  };

  const revertToRoleDefaults = () => {
    setPerms(new Set(roleDefaults));
    setIsDynamicInheritance(true);
    setHasChanges(true);
    toast.info(
      ar
        ? "تمت استعادة افتراضيات الدور (سيتم الحفظ بالوراثة الديناميكية)"
        : "Reverted to role defaults (dynamic inheritance will be saved)",
    );
  };

  // Export permissions summary as JSON
  const exportPermissionsSummary = () => {
    if (!activeUser) return;
    const data = {
      exportedAt: new Date().toISOString(),
      user: {
        id: activeUser.id,
        username: activeUser.username,
        email: activeUser.email,
        roles: activeUser.roles,
        jobTitle: activeUser.jobTitle,
      },
      stats: {
        totalPossible,
        activeCount: perms.size,
        customGranted: diffStats.customGranted,
        revoked: diffStats.revoked,
        isDynamicInheritance: isDynamicInheritance && diffStats.isExactRoleMatch,
      },
      grantedPermissions: Array.from(perms).sort(),
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permissions_${activeUser.username}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(
      ar
        ? `تم تصدير ملخص صلاحيات ${activeUser.username}`
        : `Exported permission summary for ${activeUser.username}`,
    );
  };

  const save = () => {
    if (!activeUser) return;
    let permissionsPayload: string[];

    if (isDynamicInheritance && diffStats.isExactRoleMatch) {
      permissionsPayload = [];
    } else if (perms.size === 0) {
      permissionsPayload = ["none"];
    } else {
      permissionsPayload = Array.from(perms);
    }

    updateMutation.mutate({
      id: activeUser.id,
      data: { permissions: permissionsPayload },
    });
  };

  const totalPossible = useMemo(() => {
    return MODULES.reduce(
      (sum, m) => sum + (MODULE_ACTIONS[m] ?? []).length,
      0,
    );
  }, []);

  // Compute diff counters
  const diffStats = useMemo(() => {
    let customGranted = 0;
    let revoked = 0;

    for (const p of perms) {
      if (!roleDefaults.has(p)) {
        customGranted++;
      }
    }

    for (const rd of roleDefaults) {
      if (!perms.has(rd)) {
        revoked++;
      }
    }

    const isExactRoleMatch =
      perms.size === roleDefaults.size &&
      Array.from(perms).every((p) => roleDefaults.has(p));

    return {
      customGranted,
      revoked,
      isExactRoleMatch,
    };
  }, [perms, roleDefaults]);

  // Action badge color
  const getActionColor = (action: string) => {
    switch (action) {
      case "view":
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

  // Action-aware search filtering
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
        const modKey = m.toLowerCase();

        if (
          enLabel.includes(query) ||
          arLabel.includes(query) ||
          descAr.includes(query) ||
          descEn.includes(query) ||
          modKey.includes(query)
        ) {
          return true;
        }

        const acts = MODULE_ACTIONS[m] ?? [];
        return acts.some((a) => matchesActionSearch(a, query));
      });

      if (matchingModules.length === 0) return null;

      return {
        ...group,
        modules: matchingModules,
      };
    }).filter(Boolean) as typeof PERMISSION_GROUPS;
  }, [searchQuery, selectedGroup]);

  // List of all currently visible modules
  const visibleModules = useMemo(() => {
    return filteredGroups.flatMap((g) => g.modules);
  }, [filteredGroups]);

  // Filtered users for combobox
  const filteredUsersList = useMemo(() => {
    if (!userSearchText.trim()) return users;
    const q = userSearchText.trim().toLowerCase();
    return users.filter((u) => {
      const username = (u.username || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const role = (u.roles?.[0] || "").toLowerCase();
      const job = (u.jobTitle || "").toLowerCase();
      return (
        username.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        job.includes(q)
      );
    });
  }, [users, userSearchText]);

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

  const groupStats = (groupModules: Module[]) => {
    let total = 0;
    let checked = 0;
    groupModules.forEach((m) => {
      const acts = MODULE_ACTIONS[m] ?? [];
      total += acts.length;
      checked += acts.filter((a) => perms.has(permKey(m, a))).length;
    });
    return {
      checked,
      total,
      pct: total > 0 ? Math.round((checked / total) * 100) : 0,
    };
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
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
    <TooltipProvider delayDuration={150}>
      <div className="space-y-6">
        {/* ── Executive Header: User Combobox Selector & Diff Dashboard ── */}
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
                    {ar ? "مركز التحكم في الصلاحيات والمصفوفة" : "Permission Control Center"}
                  </h2>
                  {hasChanges && (
                    <Badge className="bg-amber-500 text-slate-950 font-bold animate-pulse text-xs">
                      {ar ? "تغييرات غير محفوظة" : "Unsaved Changes"}
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
                            placeholder={ar ? "ابحث بالاسم أو الدور..." : "Search user or role..."}
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
                              const uExplicit = (u.permissions as string[] | undefined) ?? [];
                              const hasCustom = uExplicit.length > 0 && uExplicit[0] !== "none";

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
                                      <div className="truncate font-semibold">{u.username}</div>
                                      <div
                                        className={`text-[10px] truncate ${
                                          isSelected ? "text-primary-foreground/80" : "text-muted-foreground"
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
                                    {isSelected && <Check className="w-3.5 h-3.5 ms-1" />}
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
                        <Sparkles className="w-3 h-3" />
                        +{diffStats.customGranted} {ar ? "منح مخصص" : "custom"}
                      </Badge>
                    )}
                    {diffStats.revoked > 0 && (
                      <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-xs py-0.5 px-2 font-bold gap-1">
                        <MinusCircle className="w-3 h-3" />
                        -{diffStats.revoked} {ar ? "ملغي من الدور" : "revoked"}
                      </Badge>
                    )}
                    {diffStats.isExactRoleMatch && (
                      <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-xs py-0.5 px-2 font-bold gap-1">
                        <Shield className="w-3 h-3" />
                        {isDynamicInheritance
                          ? ar
                            ? "وراثة ديناميكية للدور"
                            : "Dynamic Role Inherited"
                          : ar
                          ? "مطابق لافتراضيات الدور"
                          : "Matches Role Defaults"}
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

        {/* ── Toolbar: Presets, Bulk Controls, View Mode Toggle & Search ── */}
        <div className="p-4 sm:p-5 rounded-3xl border bg-card shadow-xs space-y-4">
          {/* Row 1: All 9 System Role Presets + Actions */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b pb-4">
            <div className="space-y-1.5 flex-1">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
                <span>{ar ? "قوالب الأدوار السريعة (تطبيق بنقرة واحدة)" : "One-Click Role Presets (9 System Roles)"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SYSTEM_ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => applyRoleDefaults(preset.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-2xs ${
                      preset.value === primaryRole
                        ? "ring-1 ring-primary bg-muted font-bold"
                        : "bg-muted/40 hover:bg-muted text-foreground"
                    }`}
                    title={ar ? preset.labelAr : preset.labelEn}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>{ar ? preset.labelAr : preset.labelEn}</span>
                    {preset.value === primaryRole && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({ar ? "الحالي" : "current"})
                      </span>
                    )}
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

                <button
                  type="button"
                  onClick={revertToRoleDefaults}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#C9A24D]/40 bg-[#C9A24D]/10 text-amber-800 dark:text-amber-300 hover:bg-[#C9A24D]/20 transition-all flex items-center gap-1.5 shadow-2xs"
                  title={
                    ar
                      ? "استعادة افتراضيات الدور ومسح التخصيصات (وراثة ديناميكية)"
                      : "Revert custom overrides back to dynamic role inheritance"
                  }
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#C9A24D]" />
                  <span>{ar ? "استعادة افتراضيات الدور" : "Revert to Role"}</span>
                </button>
              </div>
            </div>

            {/* View Mode Switcher + Global Bulk Actions */}
            <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
              {/* Dual View Toggle */}
              <div className="flex items-center p-1 bg-muted rounded-xl border">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === "cards"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={ar ? "عرض البطاقات المرئية" : "Visual Cards View"}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{ar ? "بطاقات" : "Cards"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={ar ? "عرض جدول المصفوفة التفاعلي" : "Spreadsheet Table View"}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{ar ? "جدول المصفوفة" : "Table"}</span>
                </button>
              </div>

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
                {ar ? "إلغاء الكل" : "Clear All"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold rounded-xl text-primary"
                onClick={exportPermissionsSummary}
                title={ar ? "تصدير ملخص الصلاحيات بتنسيق JSON" : "Export permission summary as JSON"}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {ar ? "تصدير" : "Export"}
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

          {/* Row 2: Action-Aware Search + Category Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Action-Aware Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute start-3.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  ar
                    ? "ابحث بموديول أو عملية (مثال: حذف، تصدير، اعتماد، تسكين)..."
                    : "Search module or action (e.g. delete, export, approve)..."
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
                {ar ? "كافة الأقسام" : "All Domains"}
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

        {/* ── View 1: Visual Card Grid View ── */}
        {viewMode === "cards" && (
          <div className="space-y-8">
            {filteredGroups.length === 0 ? (
              <div className="p-16 text-center rounded-3xl border bg-card">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Search className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {ar ? "لا توجد نتائج مطابقة لبحثك" : "No matching modules or actions found"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar ? "جرب البحث باسم صفحة أخرى أو إزالة الفلتر" : "Try a different search query"}
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const gStats = groupStats(group.modules);
                const isCollapsed = Boolean(collapsedGroups[group.id]);

                return (
                  <section
                    key={group.id}
                    className="space-y-3 rounded-3xl border bg-card/60 p-5 shadow-xs transition-all"
                  >
                    {/* Domain Category Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapse(group.id)}
                          className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                          title={isCollapsed ? (ar ? "توسيع" : "Expand") : ar ? "طي" : "Collapse"}
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                        <Layers className="w-5 h-5 text-[#C9A24D]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">
                              {ar ? group.label.ar : group.label.en}
                            </h3>
                            <Badge variant="outline" className="text-xs font-semibold">
                              {gStats.checked}/{gStats.total} ({gStats.pct}%)
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {ar ? group.description.ar : group.description.en}
                          </span>
                        </div>
                      </div>

                      {/* Group Bulk Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          onClick={() => toggleCategoryGroup(group.id, true)}
                        >
                          <CheckCheck className="w-3.5 h-3.5 mr-1" />
                          {ar ? "تحديد القسم" : "Select Group"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          onClick={() => toggleCategoryGroup(group.id, false)}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          {ar ? "إلغاء القسم" : "Clear Group"}
                        </Button>
                      </div>
                    </div>

                    {/* Modules Grid */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 pt-1">
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
                                          : "bg-card shadow-xs border text-primary"
                                      }`}
                                    >
                                      {!status.isMasterOn ? (
                                        <Lock className="w-5 h-5" />
                                      ) : (
                                        <Sliders className="w-5 h-5" />
                                      )}
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

                                  {/* Master Switch */}
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
                                      const key = permKey(m, a);
                                      const isChecked = perms.has(key);
                                      const isViewAction = a === "view";
                                      const isActionDisabled = !isViewAction && !status.hasView;
                                      const isRoleDefault = roleDefaults.has(key);
                                      const isActionMatch = matchesActionSearch(a, searchQuery);

                                      // Visual state badges
                                      let statusBadge = null;
                                      let tooltipText = "";

                                      if (isChecked && isRoleDefault) {
                                        statusBadge = (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-semibold border-blue-300 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center gap-0.5"
                                          >
                                            <Shield className="w-2.5 h-2.5 text-blue-500" />
                                            <span>{ar ? "افتراضي للدور" : "Role Default"}</span>
                                          </Badge>
                                        );
                                        tooltipText = ar
                                          ? `ممنوحة تلقائياً عبر دور (${primaryRole})`
                                          : `Granted by default by role (${primaryRole})`;
                                      } else if (isChecked && !isRoleDefault) {
                                        statusBadge = (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-bold border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5"
                                          >
                                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                            <span>{ar ? "+ مخصص" : "+ Custom"}</span>
                                          </Badge>
                                        );
                                        tooltipText = ar
                                          ? "صلاحية استثنائية مخصصة لهذا المستخدم"
                                          : "Custom grant override for this user";
                                      } else if (!isChecked && isRoleDefault) {
                                        statusBadge = (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-bold border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-0.5"
                                          >
                                            <MinusCircle className="w-2.5 h-2.5 text-rose-500" />
                                            <span>{ar ? "- ملغي" : "- Revoked"}</span>
                                          </Badge>
                                        );
                                        tooltipText = ar
                                          ? `ممنوحة عادة عبر دور (${primaryRole}) ولكن تم إلغاؤها`
                                          : `Normally included in role (${primaryRole}), but revoked`;
                                      }

                                      return (
                                        <Tooltip key={a}>
                                          <TooltipTrigger asChild>
                                            <div
                                              onClick={() => {
                                                if (!isActionDisabled) toggleAction(m, a);
                                              }}
                                              className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 select-none ${
                                                isActionMatch
                                                  ? "ring-2 ring-[#C9A24D] bg-[#C9A24D]/10"
                                                  : ""
                                              } ${
                                                isActionDisabled
                                                  ? "opacity-40 cursor-not-allowed bg-muted/20 border-border/40"
                                                  : isChecked
                                                  ? "bg-primary/5 border-primary/25 cursor-pointer hover:bg-primary/10 shadow-2xs"
                                                  : "bg-card hover:bg-muted/50 cursor-pointer border-border/70"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <Badge
                                                  variant="outline"
                                                  className={`capitalize text-[9px] px-1.5 py-0 font-bold tracking-wider flex-shrink-0 ${getActionColor(
                                                    a,
                                                  )}`}
                                                >
                                                  {a}
                                                </Badge>
                                                <div className="min-w-0 flex-1">
                                                  <div className="text-xs font-bold text-foreground/90 truncate">
                                                    {ar
                                                      ? ACTION_LABELS[a]?.ar || a
                                                      : ACTION_LABELS[a]?.en || a}
                                                  </div>
                                                  {statusBadge && <div className="mt-0.5">{statusBadge}</div>}
                                                </div>
                                              </div>

                                              <Switch
                                                checked={isChecked}
                                                disabled={isActionDisabled}
                                                onCheckedChange={() => toggleAction(m, a)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="scale-75 data-[state=checked]:bg-[#0F2A44] dark:data-[state=checked]:bg-[#C9A24D]"
                                              />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            {tooltipText || (ar ? ACTION_LABELS[a]?.ar || a : ACTION_LABELS[a]?.en || a)}
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
        )}

        {/* ── View 2: Interactive Matrix Spreadsheet Table View ── */}
        {viewMode === "table" && (
          <div className="rounded-3xl border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                {/* Table Header with Column Bulk Toggles */}
                <thead className="bg-muted/60 border-b text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3.5 text-start min-w-[220px] max-w-[280px]">
                      {ar ? "الموديول والصفحة" : "Module & Page"}
                    </th>

                    {/* Canonical Action Columns with Bulk Column Click */}
                    {(
                      [
                        { key: "view", en: "View", ar: "عرض" },
                        { key: "create", en: "Create", ar: "إنشاء" },
                        { key: "edit", en: "Edit", ar: "تعديل" },
                        { key: "delete", en: "Delete", ar: "حذف" },
                        { key: "export", en: "Export", ar: "تصدير" },
                        { key: "approve", en: "Approve", ar: "اعتماد" },
                      ] as const
                    ).map((col) => (
                      <th
                        key={col.key}
                        className="p-3 text-center min-w-[90px] border-s border-border/50"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => toggleColumnAction(col.key)}
                              className="w-full inline-flex items-center justify-center gap-1 hover:text-primary transition-colors py-1 rounded-lg hover:bg-muted"
                            >
                              <span>{ar ? col.ar : col.en}</span>
                              <Sliders className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {ar
                              ? `تبديل صلاحية (${col.ar}) للكل في الموديولات الظاهرة`
                              : `Toggle ${col.en} across all visible modules`}
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    ))}

                    <th className="p-3.5 text-start min-w-[260px] border-s border-border/50">
                      {ar ? "العمليات الخاصة والإضافية" : "Special Operations"}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60">
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-muted-foreground">
                        {ar ? "لا توجد موديولات مطابقة" : "No matching modules"}
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group) => {
                      return (
                        <tr key={`group-${group.id}`} className="contents">
                          {/* Category Subheader Row */}
                          <tr className="bg-muted/40 font-bold text-foreground">
                            <td colSpan={8} className="p-2.5 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-[#C9A24D]" />
                                  <span>{ar ? group.label.ar : group.label.en}</span>
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    ({group.modules.length} {ar ? "موديول" : "modules"})
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                                    onClick={() => toggleCategoryGroup(group.id, true)}
                                  >
                                    {ar ? "تحديد القسم" : "Select Group"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] font-bold text-rose-600 hover:text-rose-700"
                                    onClick={() => toggleCategoryGroup(group.id, false)}
                                  >
                                    {ar ? "إلغاء القسم" : "Clear Group"}
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Module Rows */}
                          {group.modules.map((m) => {
                            const modulePerms = MODULE_ACTIONS[m] ?? [];
                            const status = moduleStatus(m);

                            // Extra special actions not in standard 6 columns
                            const standardCols: Action[] = [
                              "view",
                              "create",
                              "edit",
                              "delete",
                              "export",
                              "approve",
                            ];
                            const specialActions = modulePerms.filter(
                              (a) => !standardCols.includes(a),
                            );

                            return (
                              <tr
                                key={m}
                                className={`transition-colors hover:bg-muted/20 ${
                                  !status.isMasterOn ? "opacity-60 bg-muted/10" : ""
                                }`}
                              >
                                {/* Module Name & Master Switch */}
                                <td className="p-3 align-middle">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-bold text-foreground text-xs truncate">
                                        {ar ? MODULE_LABELS[m]?.ar : MODULE_LABELS[m]?.en}
                                      </div>
                                      <div className="text-[10px] font-mono text-muted-foreground">
                                        {m}
                                      </div>
                                    </div>
                                    <Switch
                                      checked={status.isMasterOn}
                                      onCheckedChange={(val) => toggleModuleMaster(m, val)}
                                      className="scale-75 data-[state=checked]:bg-emerald-600 flex-shrink-0"
                                      title={ar ? "تفعيل أو إغلاق الموديول" : "Toggle module"}
                                    />
                                  </div>
                                </td>

                                {/* Standard Action Columns */}
                                {standardCols.map((act) => {
                                  const supportsAction = modulePerms.includes(act);
                                  if (!supportsAction) {
                                    return (
                                      <td
                                        key={act}
                                        className="p-2 text-center text-muted-foreground/40 border-s border-border/40"
                                      >
                                        —
                                      </td>
                                    );
                                  }

                                  const key = permKey(m, act);
                                  const isChecked = perms.has(key);
                                  const isRoleDefault = roleDefaults.has(key);
                                  const isViewAction = act === "view";
                                  const isActionDisabled = !isViewAction && !status.hasView;
                                  const isActionMatch = matchesActionSearch(act, searchQuery);

                                  let badgeIcon = null;
                                  let tooltipDesc = "";

                                  if (isChecked && isRoleDefault) {
                                    badgeIcon = <Shield className="w-2 h-2 text-blue-500" />;
                                    tooltipDesc = ar ? "افتراضي للدور" : "Role Default";
                                  } else if (isChecked && !isRoleDefault) {
                                    badgeIcon = <Sparkles className="w-2 h-2 text-emerald-500" />;
                                    tooltipDesc = ar ? "+ منح مخصص" : "+ Custom Grant";
                                  } else if (!isChecked && isRoleDefault) {
                                    badgeIcon = <MinusCircle className="w-2 h-2 text-rose-500" />;
                                    tooltipDesc = ar ? "- ملغي من الدور" : "- Revoked from Role";
                                  }

                                  return (
                                    <td
                                      key={act}
                                      className={`p-2 text-center border-s border-border/40 ${
                                        isActionMatch ? "bg-[#C9A24D]/10" : ""
                                      }`}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="inline-flex flex-col items-center gap-0.5">
                                            <Switch
                                              checked={isChecked}
                                              disabled={isActionDisabled}
                                              onCheckedChange={() => toggleAction(m, act)}
                                              className="scale-75 data-[state=checked]:bg-[#0F2A44] dark:data-[state=checked]:bg-[#C9A24D]"
                                            />
                                            {badgeIcon && (
                                              <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground font-semibold">
                                                {badgeIcon}
                                              </div>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                          {ar ? ACTION_LABELS[act]?.ar : ACTION_LABELS[act]?.en}: {tooltipDesc}
                                        </TooltipContent>
                                      </Tooltip>
                                    </td>
                                  );
                                })}

                                {/* Special Operations Chips */}
                                <td className="p-2 border-s border-border/40">
                                  {specialActions.length === 0 ? (
                                    <span className="text-[11px] text-muted-foreground/50 italic">
                                      {ar ? "لا توجد عمليات إضافية" : "No special actions"}
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {specialActions.map((sa) => {
                                        const key = permKey(m, sa);
                                        const isChecked = perms.has(key);
                                        const isActionDisabled = !status.hasView;
                                        const isRoleDefault = roleDefaults.has(key);
                                        const isActionMatch = matchesActionSearch(sa, searchQuery);

                                        let pillBadge = "";
                                        if (isChecked && isRoleDefault) {
                                          pillBadge = "border-blue-300 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300";
                                        } else if (isChecked && !isRoleDefault) {
                                          pillBadge = "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
                                        } else if (!isChecked && isRoleDefault) {
                                          pillBadge = "border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400";
                                        } else {
                                          pillBadge = "border-border bg-card text-muted-foreground hover:bg-muted";
                                        }

                                        return (
                                          <Tooltip key={sa}>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                disabled={isActionDisabled}
                                                onClick={() => toggleAction(m, sa)}
                                                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1 ${pillBadge} ${
                                                  isActionMatch ? "ring-2 ring-[#C9A24D]" : ""
                                                } ${
                                                  isActionDisabled ? "opacity-30 cursor-not-allowed" : ""
                                                }`}
                                              >
                                                <span>
                                                  {ar
                                                    ? ACTION_LABELS[sa]?.ar || sa
                                                    : ACTION_LABELS[sa]?.en || sa}
                                                </span>
                                                {isChecked ? (
                                                  <Check className="w-2.5 h-2.5" />
                                                ) : isRoleDefault ? (
                                                  <MinusCircle className="w-2.5 h-2.5 text-rose-500" />
                                                ) : null}
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                              {sa}:{" "}
                                              {isChecked && isRoleDefault
                                                ? ar
                                                  ? "افتراضي للدور"
                                                  : "Role Default"
                                                : isChecked && !isRoleDefault
                                                ? ar
                                                  ? "+ منح مخصص"
                                                  : "+ Custom Grant"
                                                : !isChecked && isRoleDefault
                                                ? ar
                                                  ? "- ملغي من الدور"
                                                  : "- Revoked from Role"
                                                : ar
                                                ? "غير مفعل"
                                                : "Disabled"}
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ── Floating / Sticky Save Bar ── */}
        <div className="sticky bottom-4 z-20 p-4 rounded-3xl bg-card/95 backdrop-blur-md border shadow-2xl flex flex-col sm:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-[#C9A24D]/10 flex items-center justify-center flex-shrink-0">
              <ShieldAlert className="w-5 h-5 text-[#C9A24D]" />
            </div>
            <div>
              <div className="text-sm font-bold text-foreground flex items-center gap-2">
                <span>
                  {ar
                    ? `حفظ مصفوفة صلاحيات: ${activeUser.username}`
                    : `Save Permissions for ${activeUser.username}`}
                </span>
                {diffStats.customGranted > 0 && (
                  <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 text-[10px] py-0 px-1.5 font-bold">
                    +{diffStats.customGranted} {ar ? "مخصص" : "custom"}
                  </Badge>
                )}
                {diffStats.revoked > 0 && (
                  <Badge className="bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30 text-[10px] py-0 px-1.5 font-bold">
                    -{diffStats.revoked} {ar ? "ملغي" : "revoked"}
                  </Badge>
                )}
              </div>
              <div className="text-xs text-muted-foreground">
                {perms.size} {ar ? "صلاحية نشطة من أصل" : "active permissions out of"} {totalPossible} (
                {Math.round((perms.size / totalPossible) * 100)}%)
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
              className="bg-gradient-to-r from-[#0F2A44] via-slate-900 to-[#0F2A44] hover:opacity-95 text-white font-bold gap-2 shadow-lg min-w-[200px] h-11 rounded-2xl"
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
    </TooltipProvider>
  );
}
