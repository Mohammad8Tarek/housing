import { useState } from "react";
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
import { Shield, ShieldAlert, Check, X, ShieldCheck } from "lucide-react";
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
import { SYSTEM_ROLES as ROLES, WORKFLOW_ROLES, roleColor } from "../utils";
import { Badge } from "@/components/ui/badge";

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

  const toggle = (m: Module, a: Action) => {
    const key = permKey(m, a);
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });
  };

  const toggleModule = (m: Module) => {
    const modulePerms = MODULE_ACTIONS[m] ?? [];
    const allChecked = modulePerms.every((a) => perms.has(permKey(m, a)));
    setPerms((prev) => {
      const next = new Set(prev);
      modulePerms.forEach((a) =>
        allChecked ? next.delete(permKey(m, a)) : next.add(permKey(m, a)),
      );
      return next;
    });
  };

  const applyRoleDefaults = (roleKey: string) => {
    setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[roleKey] ?? []));
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
      case "read":
        return "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-800/50";
      case "create":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50";
      case "update":
      case "edit":
        return "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
      case "delete":
        return "bg-rose-100 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300 border-rose-200 dark:border-rose-800/50";
      case "approve":
        return "bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300 border-purple-200 dark:border-purple-800/50";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700/50";
    }
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-5xl max-h-[90vh] p-0 overflow-hidden"
        srTitle={ar ? "مصفوفة الصلاحيات" : "Permission Matrix"}
      >
        <div className="bg-gradient-to-r from-slate-100 to-slate-50 dark:from-slate-900 dark:to-slate-950 p-6 border-b">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-2xl bg-[#0F2A44] flex items-center justify-center shadow-lg shadow-[#0F2A44]/20">
                <ShieldCheck className="w-6 h-6 text-white" />
              </div>
              <div className="flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-xl font-bold tracking-tight">
                      {ar ? "مصفوفة الصلاحيات" : "Permission Matrix"}
                    </h2>
                    <p className="text-sm text-muted-foreground mt-0.5">
                      {ar
                        ? "تحكم في مستوى الوصول والصلاحيات المخصصة"
                        : "Manage access levels and granular permissions"}
                    </p>
                  </div>
                  <div className="text-right">
                    <div className="text-base font-semibold">{user.username}</div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {ar ? "الحساب الحالي" : "Target User"}
                    </div>
                  </div>
                </div>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        <div className="p-6 overflow-y-auto" style={{ maxHeight: "calc(90vh - 180px)" }}>
          {/* Quick Apply & Summary */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 mb-8">
            <div className="lg:col-span-8 space-y-3">
              <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
                {ar ? "تطبيق قالب دور نظام" : "Apply Role Template"}
              </h3>
              <div className="flex flex-wrap gap-2">
                {ROLES.map((r: any) => (
                  <button
                    key={r.value}
                    onClick={() => applyRoleDefaults(r.value)}
                    className="px-4 py-2 rounded-xl text-sm font-medium border bg-card hover:bg-muted/50 transition-colors flex items-center gap-2"
                  >
                    <div className={`w-2 h-2 rounded-full bg-current ${roleColor(r.value).replace('bg-', 'text-').split(' ')[0]}`} />
                    {r.label}
                  </button>
                ))}
              </div>
            </div>
            
            <div className="lg:col-span-4 bg-muted/20 rounded-2xl p-4 border flex flex-col justify-center">
              <div className="text-sm text-muted-foreground mb-1">
                {ar ? "إجمالي الصلاحيات المفعلة" : "Total Active Permissions"}
              </div>
              <div className="flex items-baseline gap-2">
                <span className="text-3xl font-bold text-foreground">{perms.size}</span>
                <span className="text-sm text-muted-foreground font-medium">/ {totalPossible}</span>
              </div>
              <div className="w-full bg-muted rounded-full h-1.5 mt-3 overflow-hidden">
                <div 
                  className="bg-[#C9A24D] h-full rounded-full transition-all duration-500" 
                  style={{ width: `${(perms.size / totalPossible) * 100}%` }}
                />
              </div>
            </div>
          </div>

          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-semibold text-muted-foreground uppercase tracking-wider">
              {ar ? "الصلاحيات التفصيلية" : "Granular Permissions"}
            </h3>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" className="h-8" onClick={selectAll}>
                <Check className="w-3.5 h-3.5 mr-1" />
                {ar ? "تحديد الكل" : "Select All"}
              </Button>
              <Button size="sm" variant="outline" className="h-8 text-muted-foreground" onClick={deselectAll}>
                <X className="w-3.5 h-3.5 mr-1" />
                {ar ? "إلغاء الكل" : "Clear All"}
              </Button>
            </div>
          </div>

          {/* Matrix Grid */}
          <div className="space-y-5">
            {PERMISSION_GROUPS.map((group) => {
              const groupTotal = group.modules.reduce(
                (sum, m) => sum + (MODULE_ACTIONS[m] ?? []).length,
                0,
              );
              const groupChecked = group.modules.reduce(
                (sum, m) =>
                  sum +
                  (MODULE_ACTIONS[m] ?? []).filter((a) =>
                    perms.has(permKey(m, a)),
                  ).length,
                0,
              );
              const progress =
                groupTotal > 0
                  ? Math.round((groupChecked / groupTotal) * 100)
                  : 0;

              return (
                <section
                  key={group.id}
                  className="rounded-2xl border bg-card overflow-hidden shadow-sm"
                >
                  <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="text-sm font-bold">
                          {ar ? group.label.ar : group.label.en}
                        </h3>
                        <Badge variant="outline" className="h-5 rounded-md text-[10px]">
                          {groupChecked}/{groupTotal}
                        </Badge>
                      </div>
                      <p className="mt-1 text-xs text-muted-foreground">
                        {ar ? group.description.ar : group.description.en}
                      </p>
                    </div>
                    <div className="flex min-w-[140px] items-center gap-2">
                      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                        <div
                          className="h-full rounded-full bg-[#C9A24D] transition-all duration-500"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <span className="w-9 text-end text-xs font-semibold text-muted-foreground">
                        {progress}%
                      </span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 gap-3 p-4 md:grid-cols-2">
                    {group.modules.map((m) => {
                      const modulePerms = MODULE_ACTIONS[m] ?? [];
                      const checkedCount = modulePerms.filter((a) =>
                        perms.has(permKey(m, a)),
                      ).length;
                      const allChecked =
                        modulePerms.length > 0 &&
                        checkedCount === modulePerms.length;

                      return (
                        <div key={m} className="rounded-xl border bg-background overflow-hidden">
                          <div className="flex items-center justify-between border-b bg-muted/10 p-3">
                            <div>
                              <div className="font-semibold text-sm">
                                {ar ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en}
                              </div>
                              <div className="text-xs text-muted-foreground mt-0.5">
                                {checkedCount} / {modulePerms.length} {ar ? "مفعل" : "active"}
                              </div>
                            </div>
                            <Switch
                              checked={allChecked}
                              onCheckedChange={() => toggleModule(m)}
                            />
                          </div>

                          <div className="p-3 flex flex-col gap-2">
                            {modulePerms.map((a) => {
                              const isActive = perms.has(permKey(m, a));
                              return (
                                <button
                                  type="button"
                                  key={a}
                                  className="flex items-center justify-between gap-3 rounded-lg px-2 py-1.5 text-start transition-colors hover:bg-muted/50"
                                  onClick={() => toggle(m, a)}
                                >
                                  <div className="flex min-w-0 items-center gap-2">
                                    <Badge variant="outline" className={`capitalize px-2 py-0.5 text-[10px] font-semibold tracking-wide ${getActionColor(a)}`}>
                                      {a}
                                    </Badge>
                                    <span className="truncate text-sm font-medium text-foreground/80">
                                      {ar ? ACTION_LABELS[a].ar : ACTION_LABELS[a].en}
                                    </span>
                                  </div>
                                  <span onClick={(event) => event.stopPropagation()}>
                                    <Switch
                                      checked={isActive}
                                      onCheckedChange={() => toggle(m, a)}
                                      className="scale-75"
                                    />
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>

          <div className="hidden">
            {MODULES.map((m) => {
              const modulePerms = MODULE_ACTIONS[m] ?? [];
              const checkedCount = modulePerms.filter((a) => perms.has(permKey(m, a))).length;
              const allChecked = checkedCount === modulePerms.length;
              
              return (
                <div key={m} className="rounded-2xl border bg-card overflow-hidden shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center justify-between p-4 bg-muted/10 border-b">
                    <div>
                      <div className="font-semibold text-sm">
                        {ar ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        {checkedCount} / {modulePerms.length} {ar ? "مفعل" : "active"}
                      </div>
                    </div>
                    <Switch
                      checked={allChecked}
                      onCheckedChange={() => toggleModule(m)}
                    />
                  </div>
                  
                  <div className="p-4 flex flex-col gap-3">
                    {modulePerms.map((a) => {
                      const isActive = perms.has(permKey(m, a));
                      return (
                        <div 
                          key={a} 
                          className="flex items-center justify-between group cursor-pointer"
                          onClick={() => toggle(m, a)}
                        >
                          <div className="flex items-center gap-3">
                            <Badge variant="outline" className={`capitalize px-2 py-0.5 text-[10px] font-semibold tracking-wide ${getActionColor(a)}`}>
                              {a}
                            </Badge>
                            <span className="text-sm font-medium text-foreground/80 group-hover:text-foreground transition-colors">
                              {ar ? ACTION_LABELS[a].ar : ACTION_LABELS[a].en}
                            </span>
                          </div>
                          <Switch
                            checked={isActive}
                            onCheckedChange={() => toggle(m, a)}
                            className="scale-75"
                          />
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-muted/20 border-t p-4 flex items-center justify-end gap-3 px-6">
          <Button variant="ghost" onClick={onClose}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={save}
            disabled={saving || updateMutation.isPending}
            className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white gap-2 shadow-sm"
          >
            <ShieldAlert className="w-4 h-4" />
            {updateMutation.isPending
              ? ar ? "جاري الحفظ..." : "Saving..."
              : ar ? "تأكيد الصلاحيات" : "Confirm Permissions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
