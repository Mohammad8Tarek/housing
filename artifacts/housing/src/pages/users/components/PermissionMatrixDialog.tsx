import { useState, useMemo, useEffect } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  RotateCcw,
  User,
  Plus,
  MinusCircle,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  Info,
  CheckCheck,
  Shield,
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

interface PermissionMatrixDialogProps {
  user: any;
  onClose: () => void;
}

// Comprehensive 9 system role presets
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
    labelAr: "موظف صيانة",
    badgeClass: "bg-orange-100 text-orange-800 dark:bg-orange-900/40 dark:text-orange-300 border-orange-300",
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

export function PermissionMatrixDialog({
  user,
  onClose,
}: PermissionMatrixDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  // Primary role of the target user
  const primaryRole = (user.roles?.[0] || "user").toLowerCase();

  // Baseline permissions for this user's primary role
  const roleDefaults = useMemo<Set<string>>(() => {
    return new Set(ROLE_DEFAULT_PERMISSIONS[primaryRole] ?? []);
  }, [primaryRole]);

  // Initial permission computation
  const initialPerms = (): Set<string> => {
    const explicit = (user.permissions as string[] | undefined) ?? [];
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
    return new Set(roleDefaults);
  };

  const [perms, setPerms] = useState<Set<string>>(initialPerms);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [isDynamicInheritance, setIsDynamicInheritance] = useState<boolean>(() => {
    const explicit = (user.permissions as string[] | undefined) ?? [];
    return explicit.length === 0;
  });

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast.success(
          ar ? "تم تحديث الصلاحيات بنجاح" : "Permissions updated successfully",
        );
        onClose();
      },
      onError: (e: any) =>
        toast.error(
          e.message ||
            (ar ? "فشل حفظ الصلاحيات" : "Failed to save permissions"),
        ),
    },
  });

  // Action search matching: checks both English and Arabic labels & keys
  const matchesActionSearch = (action: Action, query: string): boolean => {
    if (!query) return false;
    const q = query.trim().toLowerCase();
    const en = (ACTION_LABELS[action]?.en || action).toLowerCase();
    const arLabel = (ACTION_LABELS[action]?.ar || "").toLowerCase();
    return en.includes(q) || arLabel.includes(q) || action.toLowerCase().includes(q);
  };

  // Toggle single action with dependency rules:
  // - If disabling 'view', auto-disable all other actions for that module.
  // - If enabling any sub-action, auto-enable 'view'.
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
  };

  // Category bulk toggle
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

  // Apply one of the 9 role presets
  const applyRoleDefaults = (roleKey: string) => {
    setIsDynamicInheritance(false);
    const defaults = ROLE_DEFAULT_PERMISSIONS[roleKey] ?? [];
    setPerms(new Set(defaults));
    const preset = SYSTEM_ROLE_PRESETS.find((r) => r.value === roleKey);
    toast.info(
      ar
        ? `تم تطبيق قالب الدور: ${preset ? preset.labelAr : roleKey}`
        : `Applied role preset: ${preset ? preset.labelEn : roleKey}`,
    );
  };

  // Revert to dynamic role defaults
  const revertToRoleDefaults = () => {
    setPerms(new Set(roleDefaults));
    setIsDynamicInheritance(true);
    toast.info(
      ar
        ? "تمت استعادة الصلاحيات الافتراضية للدور (سيتم الحفظ بالوراثة الديناميكية)"
        : "Reverted to role defaults (will save as dynamic role inheritance)",
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
  };

  const deselectAll = () => {
    setIsDynamicInheritance(false);
    setPerms(new Set());
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
    toast.info(ar ? "تم تطبيق صلاحيات العرض فقط لكافة الموديولات" : "Applied Read-Only to all modules");
  };

  // Save handler with zero-permission safeguard & dynamic inheritance
  const save = () => {
    setSaving(true);
    let permissionsPayload: string[];

    if (isDynamicInheritance && perms.size === roleDefaults.size) {
      const allMatch = Array.from(perms).every((p) => roleDefaults.has(p));
      if (allMatch) {
        // Empty array means dynamic role inheritance
        permissionsPayload = [];
      } else {
        permissionsPayload = Array.from(perms);
      }
    } else if (perms.size === 0) {
      // Zero-permission safeguard: ["none"] ensures backend does not fall back to role defaults
      permissionsPayload = ["none"];
    } else {
      permissionsPayload = Array.from(perms);
    }

    updateMutation.mutate({
      id: user.id,
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

  // Action color coding
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

  // Action-aware search filtering across groups, modules, and granular actions
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
        const descEn = (MODULE_DESCRIPTIONS[m]?.en || "").toLowerCase();
        const descAr = (MODULE_DESCRIPTIONS[m]?.ar || "").toLowerCase();
        const modKey = m.toLowerCase();

        if (
          enLabel.includes(query) ||
          arLabel.includes(query) ||
          descEn.includes(query) ||
          descAr.includes(query) ||
          modKey.includes(query)
        ) {
          return true;
        }

        // Action-aware check: check all actions of this module
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

  // Overall module stats
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

  // Group progress stats
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

  // Collapse / Expand toggle
  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };

  return (
    <TooltipProvider delayDuration={150}>
      <Dialog
        open
        onOpenChange={(open) => {
          if (!open) onClose();
        }}
      >
        <DialogContent
          className="max-w-4xl lg:max-w-5xl max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0 border-border/80 shadow-2xl"
          srTitle={ar ? "مصفوفة الصلاحيات المتقدمة" : "Permission Matrix"}
        >
          {/* ── Header: Luxury Navy/Gold Gradient with User Info & Diff Badges ── */}
          <div className="bg-gradient-to-r from-slate-900 via-[#0F2A44] to-slate-900 text-white p-5 sm:p-6 border-b border-white/10 flex-shrink-0">
            <DialogHeader>
              <DialogTitle className="flex items-start sm:items-center gap-4 text-white">
                <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0 mt-0.5 sm:mt-0">
                  <ShieldCheck className="w-6 h-6 text-white" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                    <div>
                      <h2 className="text-lg sm:text-xl font-bold tracking-tight text-white flex items-center gap-2">
                        <span>{ar ? "مصفوفة الصلاحيات وحجب الموديولات" : "Interactive Permission Matrix"}</span>
                      </h2>
                      <p className="text-xs text-slate-300 mt-0.5">
                        {ar
                          ? "إدارة دقيقة لصلاحيات المستخدمين مع التمييز البصري بين افتراضيات الدور والمنح المخصص"
                          : "Granular access management with clear distinction between role defaults and custom grants"}
                      </p>
                    </div>

                    {/* User Badge & Diff Summary */}
                    <div className="bg-white/10 backdrop-blur-md px-3.5 py-2 rounded-2xl border border-white/15 self-start sm:self-auto space-y-1">
                      <div className="flex items-center gap-2">
                        <div className="w-6 h-6 rounded-full bg-[#C9A24D] text-slate-950 flex items-center justify-center text-xs font-black">
                          {user.username?.charAt(0).toUpperCase() || "U"}
                        </div>
                        <span className="font-bold text-sm text-white">{user.username}</span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${roleColor(
                            primaryRole,
                          )}`}
                        >
                          {user.roles?.[0] ? user.roles[0].replace(/_/g, " ") : "user"}
                        </span>
                      </div>

                      {/* Active Diff Indicators */}
                      <div className="flex items-center gap-1.5 flex-wrap text-[11px]">
                        {diffStats.customGranted > 0 && (
                          <Badge className="bg-emerald-500/20 text-emerald-300 border-emerald-500/40 text-[10px] py-0 px-1.5 font-bold gap-1">
                            <Sparkles className="w-2.5 h-2.5" />
                            +{diffStats.customGranted} {ar ? "مخصص" : "custom"}
                          </Badge>
                        )}
                        {diffStats.revoked > 0 && (
                          <Badge className="bg-rose-500/20 text-rose-300 border-rose-500/40 text-[10px] py-0 px-1.5 font-bold gap-1">
                            <MinusCircle className="w-2.5 h-2.5" />
                            -{diffStats.revoked} {ar ? "ملغي" : "revoked"}
                          </Badge>
                        )}
                        {diffStats.isExactRoleMatch && (
                          <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/40 text-[10px] py-0 px-1.5 font-bold gap-1">
                            <Shield className="w-2.5 h-2.5" />
                            {isDynamicInheritance
                              ? ar
                                ? "وراثة ديناميكية للدور"
                                : "Dynamic Role Inherited"
                              : ar
                              ? "مطابق للدور"
                              : "Matches Role Defaults"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </DialogTitle>
            </DialogHeader>
          </div>

          {/* ── Toolbar: Presets, Bulk Actions, Search & Group Filters ── */}
          <div className="bg-muted/30 border-b p-4 sm:p-5 flex-shrink-0 space-y-3.5">
            {/* Row 1: All 9 System Role Presets + Read-Only + Revert to Role */}
            <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-3.5">
              <div className="space-y-1.5 flex-1">
                <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
                  <span>{ar ? "قوالب الأدوار السريعة (9 أدوار نظامية)" : "Quick Role Presets (9 Roles)"}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {SYSTEM_ROLE_PRESETS.map((preset) => (
                    <button
                      key={preset.value}
                      type="button"
                      onClick={() => applyRoleDefaults(preset.value)}
                      className={`px-2.5 py-1 rounded-lg text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-xs ${
                        preset.value === primaryRole
                          ? "ring-1 ring-primary bg-card font-bold"
                          : "bg-card hover:bg-muted/80 text-foreground"
                      }`}
                      title={ar ? preset.labelAr : preset.labelEn}
                    >
                      <span className="w-1.5 h-1.5 rounded-full bg-current" />
                      <span>{ar ? preset.labelAr : preset.labelEn}</span>
                      {preset.value === primaryRole && (
                        <span className="text-[9px] text-muted-foreground font-normal">
                          ({ar ? "الحالي" : "current"})
                        </span>
                      )}
                    </button>
                  ))}

                  <button
                    type="button"
                    onClick={applyReadOnlyAll}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-xs"
                    title={ar ? "منح صلاحيات العرض فقط لكافة الأقسام" : "Grant view-only across all modules"}
                  >
                    <Eye className="w-3 h-3 text-blue-600" />
                    <span>{ar ? "عرض فقط للكل" : "Read-Only All"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={revertToRoleDefaults}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-[#C9A24D]/40 bg-[#C9A24D]/10 text-amber-800 dark:text-amber-300 hover:bg-[#C9A24D]/20 transition-all flex items-center gap-1.5 shadow-xs"
                    title={
                      ar
                        ? "استعادة افتراضيات الدور ومسح التخصيصات (وراثة ديناميكية)"
                        : "Revert custom overrides back to dynamic role inheritance"
                    }
                  >
                    <RotateCcw className="w-3 h-3 text-[#C9A24D]" />
                    <span>{ar ? "استعادة افتراضيات الدور" : "Revert to Role"}</span>
                  </button>
                </div>
              </div>

              {/* Live Metric Display */}
              <div className="flex items-center gap-3 bg-card border rounded-2xl px-4 py-2 shadow-xs min-w-[210px] justify-between self-stretch lg:self-auto">
                <div>
                  <div className="text-[11px] font-medium text-muted-foreground">
                    {ar ? "الصلاحيات النشطة" : "Active Permissions"}
                  </div>
                  <div className="flex items-baseline gap-1.5">
                    <span className="text-2xl font-black text-foreground">{perms.size}</span>
                    <span className="text-xs text-muted-foreground font-medium">/ {totalPossible}</span>
                  </div>
                </div>
                <div className="flex flex-col items-end gap-1">
                  <span className="text-xs font-bold text-[#C9A24D]">
                    {Math.round((perms.size / totalPossible) * 100)}%
                  </span>
                  <div className="w-16 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-[#C9A24D] to-amber-500 rounded-full transition-all duration-300"
                      style={{ width: `${(perms.size / totalPossible) * 100}%` }}
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Row 2: Real-time Search, Category Filter Tabs, Global Actions */}
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1 border-t">
              {/* Action-Aware Search Input */}
              <div className="relative flex-1 max-w-sm">
                <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
                <Input
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={
                    ar
                      ? "ابحث بموديول أو عملية (مثال: حذف، تصدير، اعتماد، تسكين)..."
                      : "Search module or action (e.g. delete, export, approve)..."
                  }
                  className="ps-9 pe-8 h-9 text-xs rounded-xl"
                />
                {searchQuery && (
                  <button
                    type="button"
                    onClick={() => setSearchQuery("")}
                    className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>

              {/* Category Domain Tabs */}
              <div className="flex items-center gap-1 overflow-x-auto no-scrollbar">
                <button
                  type="button"
                  onClick={() => setSelectedGroup("all")}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                    selectedGroup === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted hover:bg-muted/80 text-muted-foreground"
                  }`}
                >
                  {ar ? "كافة الأقسام" : "All Domains"}
                </button>
                {PERMISSION_GROUPS.map((g) => (
                  <button
                    key={g.id}
                    type="button"
                    onClick={() => setSelectedGroup(g.id)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap ${
                      selectedGroup === g.id
                        ? "bg-primary text-primary-foreground shadow-xs"
                        : "bg-muted hover:bg-muted/80 text-muted-foreground"
                    }`}
                  >
                    {ar ? g.label.ar : g.label.en}
                  </button>
                ))}
              </div>

              {/* Global Select / Clear */}
              <div className="flex items-center gap-1.5 self-end sm:self-auto flex-shrink-0">
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold rounded-xl"
                  onClick={selectAll}
                  title={ar ? "تفعيل كافة الصلاحيات" : "Select all permissions"}
                >
                  <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                  {ar ? "تحديد الكل" : "Select All"}
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 text-xs font-semibold rounded-xl text-muted-foreground hover:text-rose-600"
                  onClick={deselectAll}
                  title={ar ? "إلغاء كافة الصلاحيات (حجب كامل)" : "Clear all"}
                >
                  <X className="w-3.5 h-3.5 mr-1" />
                  {ar ? "إلغاء الكل" : "Clear All"}
                </Button>
              </div>
            </div>
          </div>

          {/* ── Main Scrollable Body: Grouped Modules ── */}
          <div
            className="p-5 overflow-y-auto flex-1 space-y-6"
            style={{ maxHeight: "calc(92vh - 290px)" }}
          >
            {filteredGroups.length === 0 ? (
              <div className="text-center py-16">
                <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Search className="w-6 h-6 text-muted-foreground" />
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {ar ? "لا توجد موديولات أو عمليات مطابقة" : "No matching modules or actions found"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar
                    ? "جرب البحث باسم صفحة أخرى أو مصطلح عملية (مثل: حذف، تصدير)"
                    : "Try searching with a different term or action keyword"}
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const gStats = groupStats(group.modules);
                const isCollapsed = Boolean(collapsedGroups[group.id]);

                return (
                  <section
                    key={group.id}
                    className="space-y-3 rounded-2xl border bg-card/60 p-4 transition-all"
                  >
                    {/* Category Domain Header with Progress & Bulk Controls */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b pb-3">
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
                        <Layers className="w-4 h-4 text-[#C9A24D]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-sm font-bold text-foreground">
                              {ar ? group.label.ar : group.label.en}
                            </h3>
                            <Badge variant="outline" className="text-[10px] font-mono py-0 px-1.5">
                              {gStats.checked}/{gStats.total} ({gStats.pct}%)
                            </Badge>
                          </div>
                          <p className="text-[11px] text-muted-foreground hidden sm:block">
                            {ar ? group.description.ar : group.description.en}
                          </p>
                        </div>
                      </div>

                      {/* Group Bulk Actions */}
                      <div className="flex items-center gap-1.5 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          onClick={() => toggleCategoryGroup(group.id, true)}
                        >
                          <CheckCheck className="w-3 h-3 mr-1" />
                          {ar ? "تحديد القسم" : "Select Group"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-7 text-[11px] font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          onClick={() => toggleCategoryGroup(group.id, false)}
                        >
                          <X className="w-3 h-3 mr-1" />
                          {ar ? "إلغاء القسم" : "Clear Group"}
                        </Button>
                      </div>
                    </div>

                    {/* Group Modules Grid */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5 pt-1">
                        {group.modules.map((m) => {
                          const modulePerms = MODULE_ACTIONS[m] ?? [];
                          const status = moduleStatus(m);

                          return (
                            <div
                              key={m}
                              className={`rounded-2xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                                !status.isMasterOn
                                  ? "bg-muted/15 border-border/60 opacity-85"
                                  : "bg-card border-border shadow-xs hover:shadow-md"
                              }`}
                            >
                              {/* Module Card Header */}
                              <div
                                className={`p-3.5 flex items-center justify-between border-b ${
                                  !status.isMasterOn
                                    ? "bg-muted/30"
                                    : status.isAllOn
                                    ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20"
                                    : "bg-primary/5 border-primary/15"
                                }`}
                              >
                                <div className="flex items-center gap-2.5 min-w-0">
                                  <div
                                    className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 ${
                                      !status.isMasterOn
                                        ? "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                        : status.isAllOn
                                        ? "bg-emerald-500 text-white shadow-sm shadow-emerald-500/30"
                                        : "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                                    }`}
                                  >
                                    {!status.isMasterOn ? (
                                      <Lock className="w-4 h-4" />
                                    ) : (
                                      <Sliders className="w-4 h-4" />
                                    )}
                                  </div>
                                  <div className="min-w-0">
                                    <div className="font-bold text-sm truncate text-foreground flex items-center gap-2">
                                      <span>{ar ? MODULE_LABELS[m]?.ar : MODULE_LABELS[m]?.en}</span>
                                      <span className="text-[10px] text-muted-foreground font-mono font-normal">
                                        ({m})
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1.5 mt-0.5">
                                      {!status.isMasterOn ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] py-0 px-1.5 font-bold border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400"
                                        >
                                          {ar ? "مغلق تماماً (لن يظهر)" : "Disabled (Hidden)"}
                                        </Badge>
                                      ) : status.isAllOn ? (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] py-0 px-1.5 font-bold border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300"
                                        >
                                          {ar ? "وصول كامل" : "Full Access"} ({status.checked}/{status.total})
                                        </Badge>
                                      ) : (
                                        <Badge
                                          variant="outline"
                                          className="text-[10px] py-0 px-1.5 font-bold border-blue-300 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300"
                                        >
                                          {ar ? "وصول مخصص" : "Custom"} ({status.checked}/{status.total})
                                        </Badge>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {/* Module Master Switch */}
                                <div className="flex items-center gap-2 ms-2">
                                  <span className="text-[11px] font-semibold text-muted-foreground hidden sm:inline">
                                    {status.isMasterOn
                                      ? ar
                                        ? "مفعل"
                                        : "Active"
                                      : ar
                                      ? "مغلق"
                                      : "Off"}
                                  </span>
                                  <Switch
                                    checked={status.isMasterOn}
                                    onCheckedChange={(val) => toggleModuleMaster(m, val)}
                                    className="data-[state=checked]:bg-emerald-600"
                                    title={ar ? "تفعيل أو إغلاق الموديول بالكامل" : "Toggle module"}
                                  />
                                </div>
                              </div>

                              {/* Module Actions Body */}
                              <div className="p-3">
                                {!status.isMasterOn ? (
                                  <div className="py-4 px-3 rounded-xl bg-muted/30 border border-dashed border-border/70 flex items-center justify-between gap-3 text-start">
                                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                      <FolderLock className="w-4 h-4 text-rose-500/80 flex-shrink-0" />
                                      <span>
                                        {ar
                                          ? "هذا الموديول محجوب بالكامل ولن يظهر للمستخدم في القائمة الجانبية أو المسارات."
                                          : "This module is completely hidden from the sidebar and URL access."}
                                      </span>
                                    </div>
                                    <Button
                                      type="button"
                                      variant="ghost"
                                      size="sm"
                                      className="h-7 text-xs font-semibold text-primary hover:text-primary/90 flex-shrink-0"
                                      onClick={() => toggleModuleMaster(m, true)}
                                    >
                                      {ar ? "فتح الموديول" : "Enable"}
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

                                      // Visual state calculation
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
                                          ? `ممنوحة عادة عبر دور (${primaryRole}) ولكن تم إلغاؤها خصيصاً`
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
                                                  <div className="text-xs font-semibold text-foreground/90 truncate">
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

          {/* ── Footer: Confirm & Save ── */}
          <div className="bg-muted/30 border-t p-4 px-6 flex items-center justify-between gap-3 flex-shrink-0">
            <div className="text-xs text-muted-foreground hidden sm:flex items-center gap-1.5">
              <Info className="w-3.5 h-3.5 text-muted-foreground" />
              <span>
                {ar
                  ? "سيتم تطبيق الصلاحيات بشكل فوري وتحديث صلاحيات الجلسة الحالية."
                  : "Permissions take effect immediately upon saving with cache invalidation."}
              </span>
            </div>
            <div className="flex items-center gap-3 ms-auto">
              <Button
                variant="ghost"
                onClick={onClose}
                disabled={saving || updateMutation.isPending}
              >
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={save}
                disabled={saving || updateMutation.isPending}
                className="bg-gradient-to-r from-[#0F2A44] via-slate-900 to-[#0F2A44] hover:opacity-90 text-white font-bold gap-2 shadow-md min-w-[170px]"
              >
                <ShieldAlert className="w-4 h-4 text-[#C9A24D]" />
                {updateMutation.isPending
                  ? ar
                    ? "جاري الحفظ..."
                    : "Saving..."
                  : ar
                  ? "تأكيد وحفظ الصلاحيات"
                  : "Confirm & Save Permissions"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </TooltipProvider>
  );
}
