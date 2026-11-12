// Role templates manager (system admins): edit a template's permissions; every
// user linked to it is updated by the server.
import { useEffect, useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Layers, Users } from "lucide-react";
import { toast } from "sonner";
import {
  ACTION_LABELS,
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  permKey,
} from "@/lib/permissions";

export type RoleTemplate = {
  id: number;
  key: string;
  nameAr: string;
  nameEn: string;
  permissions: string[];
  isSystem: boolean;
  linkedUsers: number;
};

export const roleTemplatesKey = ["/api/role-templates"];

export function useRoleTemplates(enabled = true) {
  return useQuery({
    queryKey: roleTemplatesKey,
    queryFn: () => customFetch<{ data: RoleTemplate[] }>("/api/role-templates"),
    enabled,
    staleTime: 60_000,
  });
}

export function RoleTemplatesDialog({ ar }: { ar: boolean }) {
  const [open, setOpen] = useState(false);
  const queryClient = useQueryClient();
  const { data } = useRoleTemplates(open);
  const templates = data?.data ?? [];
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const selected = templates.find((t) => t.id === selectedId) ?? templates[0];
  const [nameAr, setNameAr] = useState("");
  const [nameEn, setNameEn] = useState("");
  const [perms, setPerms] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (selected) {
      setNameAr(selected.nameAr);
      setNameEn(selected.nameEn);
      setPerms(new Set(selected.permissions));
    }
  }, [selected?.id, selected?.permissions.join(",")]);

  const dirty = useMemo(
    () =>
      !!selected &&
      (nameAr !== selected.nameAr ||
        nameEn !== selected.nameEn ||
        perms.size !== selected.permissions.length ||
        selected.permissions.some((p) => !perms.has(p))),
    [selected, nameAr, nameEn, perms],
  );

  const save = useMutation({
    mutationFn: () =>
      customFetch<any>(`/api/role-templates/${selected!.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nameAr: nameAr.trim(),
          nameEn: nameEn.trim(),
          permissions: [...perms],
        }),
      }),
    onSuccess: (r: any) => {
      queryClient.invalidateQueries({ queryKey: roleTemplatesKey });
      queryClient.invalidateQueries({ queryKey: ["/api/users"] });
      toast.success(
        ar
          ? `تم حفظ القالب وتحديث ${r.updatedUsers} مستخدم مرتبط`
          : `Template saved; ${r.updatedUsers} linked user(s) updated`,
      );
    },
    onError: (e: any) =>
      toast.error(e?.message || (ar ? "تعذّر الحفظ" : "Could not save")),
  });

  const toggle = (k: string) =>
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(k) ? next.delete(k) : next.add(k);
      return next;
    });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-1.5">
          <Layers className="w-4 h-4" />
          {ar ? "قوالب الأدوار" : "Role templates"}
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{ar ? "قوالب الأدوار" : "Role templates"}</DialogTitle>
          <DialogDescription>
            {ar
              ? "المستخدم المرتبط بقالب ياخد صلاحياته، وأي تعديل في القالب بيتطبق على كل المرتبطين بيه. تعديل صلاحيات مستخدم يدوياً بيفك ارتباطه بالقالب."
              : "Users linked to a template get its permissions, and editing the template updates all of them. Editing a user's permissions by hand unlinks them."}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 md:grid-cols-[220px_1fr]">
          <div className="space-y-1">
            {templates.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setSelectedId(t.id)}
                className={`w-full text-start rounded-lg border px-3 py-2 text-sm ${
                  selected?.id === t.id
                    ? "border-primary bg-primary/5 font-semibold"
                    : "hover:bg-muted"
                }`}
              >
                <div>{ar ? t.nameAr : t.nameEn}</div>
                <div className="text-[11px] text-muted-foreground flex items-center gap-2">
                  <span>
                    {t.permissions.length} {ar ? "صلاحية" : "permissions"}
                  </span>
                  <span className="flex items-center gap-0.5">
                    <Users className="w-3 h-3" />
                    {t.linkedUsers}
                  </span>
                </div>
              </button>
            ))}
          </div>
          {selected && (
            <div className="space-y-3">
              <div className="grid gap-2 sm:grid-cols-2">
                <Input
                  dir="rtl"
                  value={nameAr}
                  onChange={(e) => setNameAr(e.target.value)}
                />
                <Input
                  dir="ltr"
                  value={nameEn}
                  onChange={(e) => setNameEn(e.target.value)}
                />
              </div>
              <div className="rounded-lg border divide-y max-h-[55vh] overflow-y-auto">
                {MODULES.map((m) => (
                  <div key={m} className="p-2.5 space-y-1.5">
                    <div className="text-xs font-semibold">
                      {ar ? MODULE_LABELS[m]?.ar : MODULE_LABELS[m]?.en}
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                      {(MODULE_ACTIONS[m] ?? []).map((a) => {
                        const k = permKey(m, a);
                        return (
                          <label
                            key={k}
                            className="flex items-center gap-1.5 text-xs cursor-pointer"
                          >
                            <Checkbox
                              checked={perms.has(k)}
                              onCheckedChange={() => toggle(k)}
                            />
                            {ar ? ACTION_LABELS[a]?.ar : ACTION_LABELS[a]?.en}
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between gap-2">
                <Badge variant="outline">
                  {perms.size} {ar ? "صلاحية مختارة" : "selected"}
                </Badge>
                <Button
                  size="sm"
                  disabled={
                    !dirty || save.isPending || !nameAr.trim() || !nameEn.trim()
                  }
                  onClick={() => save.mutate()}
                >
                  {ar
                    ? `حفظ وتحديث ${selected.linkedUsers} مستخدم`
                    : `Save and update ${selected.linkedUsers} user(s)`}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
