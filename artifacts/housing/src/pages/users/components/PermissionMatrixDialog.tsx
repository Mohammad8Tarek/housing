import { useState, useMemo } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
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
} from "lucide-react";
import { toast } from "sonner";
import {
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  PERMISSION_GROUPS,
  permKey,
  ROLE_DEFAULT_PERMISSIONS,
  type Module,
  type Action,
} from "@/lib/permissions";
import { SYSTEM_ROLES as ROLES, roleColor } from "../utils";

interface PermissionMatrixDialogProps {
  user: any;
  onClose: () => void;
}

export function PermissionMatrixDialog({
  user,
  onClose,
}: PermissionMatrixDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const initialPerms = (): Set<string> => {
    const explicit = (user.permissions as string[] | undefined) ?? [];
    if (explicit.length > 0) {
      if (explicit.length === 1 && explicit[0] === "none") return new Set();
      return new Set(explicit);
    }
    const role = user.roles?.[0]?.toLowerCase() ?? "";
    return new Set(ROLE_DEFAULT_PERMISSIONS[role] ?? []);
  };

  const [perms, setPerms] = useState<Set<string>>(initialPerms);
  const [saving, setSaving] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
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

  // Toggle single action with dependency rule:
  // - If disabling 'view', auto-disable all other actions for that module.
  // - If enabling any action, auto-enable 'view'.
  const toggleAction = (m: Module, a: Action) => {
    const key = permKey(m, a);
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (a === "view") {
          // You cannot perform operations if you can't view
          (MODULE_ACTIONS[m] ?? []).forEach((other) => {
            next.delete(permKey(m, other));
          });
        }
      } else {
        next.add(key);
        // You must have 'view' to perform any sub-action
        if (a !== "view" && (MODULE_ACTIONS[m] ?? []).includes("view")) {
          next.add(permKey(m, "view"));
        }
      }
      return next;
    });
  };

  // Master switch for entire module
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
  };

  const applyRoleDefaults = (roleKey: string) => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[roleKey] ?? [];
    setPerms(new Set(defaults));
    toast.info(
      ar
        ? `تم تطبيق قالب: ${ROLES.find((r) => r.value === roleKey)?.label || roleKey}`
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
  };

  const deselectAll = () => {
    setPerms(new Set());
  };

  const applyReadOnlyAll = () => {
    const readOnly = new Set<string>();
    MODULES.forEach((m) => {
      if ((MODULE_ACTIONS[m] ?? []).includes("view")) {
        readOnly.add(permKey(m, "view"));
      }
    });
    setPerms(readOnly);
    toast.info(ar ? "تم تطبيق صلاحيات العرض فقط" : "Applied Read-Only to all");
  };

  const save = () => {
    setSaving(true);
    const toSave = Array.from(perms);
    updateMutation.mutate({
      id: user.id,
      data: { permissions: toSave.length === 0 ? ["none"] : toSave },
    });
  };

  const totalPossible = MODULES.reduce(
    (sum, m) => sum + (MODULE_ACTIONS[m] ?? []).length,
    0,
  );

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

  // Filter modules based on search query and selected category tab
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
        return enLabel.includes(query) || arLabel.includes(query) || m.includes(query);
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

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-5xl max-h-[92vh] p-0 overflow-hidden flex flex-col gap-0 border-border/80 shadow-2xl"
        srTitle={ar ? "مصفوفة الصلاحيات المتقدمة" : "Permission Matrix"}
      >
        {/* Header */}
        <div className="bg-gradient-to-r from-slate-900 via-[#0F2A44] to-slate-900 text-white p-5 sm:p-6 border-b border-white/10 flex-shrink-0">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4 text-white">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-amber-600 flex items-center justify-center shadow-lg shadow-amber-500/20 flex-shrink-0">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight text-white flex items-center gap-2">
                      <span>{ar ? "مصفوفة الصلاحيات وحجب الموديولات" : "Granular Permission Matrix"}</span>
                    </h2>
                    <p className="text-xs sm:text-sm text-slate-300 mt-0.5">
                      {ar
                        ? "تحكم فوري ودقيق في صلاحيات المستخدم وظهور الصفحات والموديولات"
                        : "Control page visibility and user permissions with strict enforcement"}
                    </p>
                  </div>
                  <div className="bg-white/10 backdrop-blur-md px-3.5 py-1.5 rounded-xl border border-white/15 text-start sm:text-end self-start sm:self-auto">
                    <div className="text-sm font-semibold text-white flex items-center gap-1.5">
                      <span className="w-2 h-2 rounded-full bg-emerald-400" />
                      {user.username}
                    </div>
                    <div className="text-[11px] text-slate-300">
                      {user.email || (user.roles?.[0] ? user.roles[0].replace(/_/g, " ") : "User")}
                    </div>
                  </div>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Action Toolbar & Stats */}
        <div className="bg-muted/30 border-b p-4 sm:p-5 flex-shrink-0 space-y-4">
          {/* Top Row: Presets + Stats */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4">
            {/* Quick Templates */}
            <div className="space-y-1.5 flex-1">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
                {ar ? "قوالب الأدوار السريعة (تطبيق بنقرة واحدة)" : "Quick Role Presets"}
              </div>
              <div className="flex flex-wrap gap-1.5">
                {ROLES.map((r: any) => (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => applyRoleDefaults(r.value)}
                    className="px-2.5 py-1 rounded-lg text-xs font-semibold border bg-card hover:bg-muted/70 transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <div className={`w-1.5 h-1.5 rounded-full bg-current ${roleColor(r.value).replace('bg-', 'text-').split(' ')[0]}`} />
                    <span>{r.label}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={applyReadOnlyAll}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-xs"
                  title={ar ? "منح صلاحيات العرض فقط لكافة الأقسام" : "Grant view-only across all modules"}
                >
                  <Eye className="w-3 h-3 text-blue-600" />
                  <span>{ar ? "عرض فقط للكل" : "Read Only"}</span>
                </button>
              </div>
            </div>

            {/* Live Counter Card */}
            <div className="flex items-center gap-3 bg-card border rounded-xl px-4 py-2 shadow-xs min-w-[200px] justify-between">
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

          {/* Bottom Row: Search, Category Filters, Global Toggles */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Search Input */}
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 text-muted-foreground absolute start-3 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={ar ? "ابحث عن موديول أو صفحة..." : "Search module or page..."}
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

            {/* Category Pills */}
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
                {ar ? "كافة الأقسام" : "All Groups"}
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

            {/* Bulk Select / Clear */}
            <div className="flex items-center gap-1.5 self-end sm:self-auto">
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

        {/* Main Content Area: Module Cards */}
        <div className="p-5 overflow-y-auto flex-1 space-y-6" style={{ maxHeight: "calc(92vh - 270px)" }}>
          {filteredGroups.length === 0 ? (
            <div className="text-center py-16">
              <div className="w-12 h-12 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                <Search className="w-6 h-6 text-muted-foreground" />
              </div>
              <h3 className="text-base font-bold text-foreground">
                {ar ? "لا توجد نتائج مطابقة" : "No matching modules found"}
              </h3>
              <p className="text-xs text-muted-foreground mt-1">
                {ar ? "جرب البحث بكلمات أخرى أو تغيير الفلتر" : "Try a different search term or category"}
              </p>
            </div>
          ) : (
            filteredGroups.map((group) => {
              return (
                <section key={group.id} className="space-y-3">
                  <div className="flex items-center gap-2 border-b pb-2">
                    <Layers className="w-4 h-4 text-[#C9A24D]" />
                    <h3 className="text-sm font-bold text-foreground">
                      {ar ? group.label.ar : group.label.en}
                    </h3>
                    <span className="text-xs text-muted-foreground">
                      ({group.modules.length} {ar ? "موديول" : "modules"})
                    </span>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
                    {group.modules.map((m) => {
                      const modulePerms = MODULE_ACTIONS[m] ?? [];
                      const status = moduleStatus(m);

                      return (
                        <div
                          key={m}
                          className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
                            !status.isMasterOn
                              ? "bg-muted/15 border-border/60 opacity-85"
                              : "bg-card border-border shadow-xs hover:shadow-md"
                          }`}
                        >
                          {/* Module Header with Master Toggle */}
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
                                  const isChecked = perms.has(permKey(m, a));
                                  const isViewAction = a === "view";
                                  // If this is a sub-action and view is not checked, disable it
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
                                          ? "bg-primary/5 border-primary/20 cursor-pointer hover:bg-primary/10"
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
                                        <span className="text-xs font-semibold text-foreground/90 truncate">
                                          {ar ? ACTION_LABELS[a]?.ar || a : ACTION_LABELS[a]?.en || a}
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

        {/* Footer */}
        <div className="bg-muted/30 border-t p-4 px-6 flex items-center justify-between gap-3 flex-shrink-0">
          <div className="text-xs text-muted-foreground hidden sm:block">
            {ar
              ? "سيتم تطبيق الصلاحيات بشكل فوري وإعادة توجيه المستخدم إذا تم حجب أي صفحة."
              : "Permissions take effect immediately upon saving."}
          </div>
          <div className="flex items-center gap-3 ms-auto">
            <Button variant="ghost" onClick={onClose} disabled={saving || updateMutation.isPending}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={save}
              disabled={saving || updateMutation.isPending}
              className="bg-gradient-to-r from-[#0F2A44] to-slate-900 hover:opacity-90 text-white font-bold gap-2 shadow-md min-w-[150px]"
            >
              <ShieldAlert className="w-4 h-4 text-[#C9A24D]" />
              {updateMutation.isPending
                ? ar
                  ? "جاري الحفظ..."
                  : "Saving..."
                : ar
                ? "تأكيد وحفظ الصلاحيات"
                : "Confirm & Save"}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
