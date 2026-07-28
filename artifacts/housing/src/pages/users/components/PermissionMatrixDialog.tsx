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
import { Shield } from "lucide-react";
import { toast } from "sonner";
import {
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  permKey,
  ROLE_DEFAULT_PERMISSIONS,
  type Module,
  type Action,
} from "@/lib/permissions";
import { SYSTEM_ROLES as ROLES, WORKFLOW_ROLES, roleColor } from "../utils";

interface PermissionMatrixDialogProps {
  user: any; // We'll fix this type later if possible, or just keep any for now.
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
    if (explicit.length > 0) return new Set(explicit);
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
    updateMutation.mutate({
      id: user.id,
      data: { permissions: Array.from(perms) },
    });
  };

  const totalPossible = MODULES.reduce(
    (sum, m) => sum + (MODULE_ACTIONS[m] ?? []).length,
    0,
  );

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        srTitle={ar ? "مصفوفة الصلاحيات" : "Permission Matrix"}
      >
        <DialogHeader>
          <DialogTitle className="flex flex-col gap-3 sm:flex-row sm:items-center">
            <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-[#C9A24D] to-[#8B7532] flex items-center justify-center">
              <Shield className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="text-lg font-semibold">
                {ar ? "مصفوفة الصلاحيات" : "Permission Matrix"}
              </div>
              <div className="text-sm text-muted-foreground">
                {user.username} •{" "}
                {ar
                  ? "تحكم في صلاحيات المستخدم"
                  : "Control permissions for the user"}
              </div>
            </div>
          </DialogTitle>
        </DialogHeader>

        {/* Role Summary */}
        <div className="mt-4 flex flex-wrap items-center gap-3 px-4 py-2.5 rounded-lg bg-muted/20 border text-sm">
          <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
            {ar ? "الدور الحالي" : "Current Role"}:
          </span>
          <span
            className={`px-2.5 py-0.5 rounded-full text-xs font-semibold ${roleColor(user.roles?.[0] || "manager")}`}
          >
            {ROLES.find(
              (r: any) => r.value === (user.roles?.[0] || "").toLowerCase(),
            )?.label ??
              (user.roles?.[0] || "—")}
          </span>
          {user.jobTitle && user.jobTitle !== "none" && (
            <>
              <span className="text-muted-foreground text-xs font-medium uppercase tracking-wider">
                {ar ? "منصب الاعتماد" : "Workflow"}:
              </span>
              <span className="px-2.5 py-0.5 rounded-lg text-xs font-semibold bg-amber-50 text-amber-800 border border-amber-300 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700">
                {WORKFLOW_ROLES.find((r: any) => r.value === user.jobTitle)
                  ?.label ?? user.jobTitle.replace(/_/g, " ")}
              </span>
            </>
          )}
        </div>

        {/* Summary bar */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between px-4 py-3 rounded-lg bg-muted/30 border text-sm">
          <span className="text-muted-foreground">
            {ar ? "الصلاحيات المفعلة:" : "Active permissions:"}
            <span className="font-semibold text-foreground">{perms.size}</span>
            <span className="text-muted-foreground"> / {totalPossible}</span>
          </span>
          <div className="flex flex-wrap gap-2">
            <button
              onClick={selectAll}
              className="text-xs text-blue-600 hover:underline"
            >
              {ar ? "تحديد الكل" : "Select All"}
            </button>
            <span className="text-muted-foreground">·</span>
            <button
              onClick={deselectAll}
              className="text-xs text-muted-foreground hover:underline"
            >
              {ar ? "إلغاء الكل" : "Deselect All"}
            </button>
          </div>
        </div>

        {/* Quick apply role defaults */}
        <div className="mt-4 flex flex-wrap gap-2 pb-3 border-b">
          <span className="text-xs text-muted-foreground self-center">
            {ar ? "تطبيق صلاحيات الدور:" : "Apply role defaults:"}
          </span>
          {ROLES.map((r: any) => (
            <button
              key={r.value}
              onClick={() => applyRoleDefaults(r.value)}
              className={`px-3 py-1 rounded-full text-xs font-semibold transition-colors hover:opacity-80 ${roleColor(r.value)}`}
            >
              {r.label}
            </button>
          ))}
        </div>

        {/* Matrix list */}
        <div className="mt-4 space-y-4">
          {MODULES.map((m) => {
            const modulePerms = MODULE_ACTIONS[m] ?? [];
            const allChecked = modulePerms.every((a) =>
              perms.has(permKey(m, a)),
            );
            const someChecked = modulePerms.some((a) =>
              perms.has(permKey(m, a)),
            );
            const checkedCount = modulePerms.filter((a) =>
              perms.has(permKey(m, a)),
            ).length;
            return (
              <div
                key={m}
                className="rounded-2xl border bg-background p-4 shadow-sm"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {ar ? MODULE_LABELS[m].ar : MODULE_LABELS[m].en}
                    </div>
                    <div className="mt-1 text-xs text-muted-foreground">
                      {checkedCount}/{modulePerms.length}{" "}
                      {ar ? "مفعل" : "enabled"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleModule(m)}
                    className={`inline-flex h-9 items-center justify-center rounded-full border px-4 text-sm font-medium transition ${
                      allChecked
                        ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                        : someChecked
                          ? "border-[#C9A24D] bg-[#C9A24D]/10 text-foreground"
                          : "border-gray-300 text-muted-foreground hover:border-[#0F2A44]"
                    }`}
                  >
                    {allChecked
                      ? ar
                        ? "إلغاء التحديد"
                        : "Unselect"
                      : ar
                        ? "تحديد الكل"
                        : "Select all"}
                  </button>
                </div>
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {modulePerms.map((a) => (
                    <label
                      key={a}
                      className="flex items-center gap-3 rounded-2xl border px-3 py-2 hover:border-slate-400 transition-colors"
                    >
                      <Switch
                        checked={perms.has(permKey(m, a))}
                        onCheckedChange={() => toggle(m, a)}
                        className="scale-75"
                      />
                      <div>
                        <div className="text-sm font-medium">
                          {ar ? ACTION_LABELS[a].ar : ACTION_LABELS[a].en}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {permKey(m, a)}
                        </div>
                      </div>
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
        </div>

        <div className="mt-4 flex gap-2 justify-end pt-2 border-t">
          <Button variant="outline" onClick={onClose}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={save}
            disabled={saving || updateMutation.isPending}
            className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white gap-2"
          >
            <Shield className="w-4 h-4" />
            {updateMutation.isPending
              ? ar
                ? "جاري الحفظ..."
                : "Saving..."
              : ar
                ? "حفظ الصلاحيات"
                : "Save Permissions"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
