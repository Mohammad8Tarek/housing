// Link a user to a role template (their permissions then follow the
// template), with a preview of what changes first.
import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Link2, Link2Off } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { useRoleTemplates } from "../components/RoleTemplatesDialog";

type Diff = { added: string[]; removed: string[] };

export function RoleTemplateLink({
  user,
  ar,
  onChanged,
}: {
  user: any;
  ar: boolean;
  onChanged: () => void;
}) {
  const queryClient = useQueryClient();
  const { data } = useRoleTemplates();
  const templates = data?.data ?? [];
  const linked = templates.find((t) => t.id === user?.roleTemplateId);
  const [choice, setChoice] = useState<string>("");
  const [preview, setPreview] = useState<Diff | null>(null);

  const call = (templateId: number | null, previewOnly: boolean) =>
    customFetch<Diff & { linked: number | null }>(
      `/api/users/${user.id}/role-template`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId, preview: previewOnly }),
      },
    );

  const previewMut = useMutation({
    mutationFn: (id: number) => call(id, true),
    onSuccess: (d) => setPreview({ added: d.added, removed: d.removed }),
    onError: (e: any) => toast.error(e?.data?.error || e?.message),
  });
  const applyMut = useMutation({
    mutationFn: (id: number | null) => call(id, false),
    onSuccess: () => {
      setPreview(null);
      setChoice("");
      queryClient.invalidateQueries({ queryKey: ["/api/role-templates"] });
      onChanged();
      toast.success(ar ? "تم تحديث ارتباط القالب" : "Template link updated");
    },
    onError: (e: any) => toast.error(e?.data?.error || e?.message),
  });

  return (
    <div className="rounded-xl border p-3 space-y-2 bg-card">
      <div className="flex flex-wrap items-center gap-2 text-sm">
        {linked ? (
          <>
            <Link2 className="w-4 h-4 text-primary" />
            <span>
              {ar ? "مرتبط بقالب:" : "Linked to template:"}{" "}
              <b>{ar ? linked.nameAr : linked.nameEn}</b>
            </span>
            <span className="text-xs text-muted-foreground">
              {ar
                ? "(أي تعديل في القالب بيتطبق عليه)"
                : "(template changes apply to this user)"}
            </span>
          </>
        ) : (
          <>
            <Link2Off className="w-4 h-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {ar
                ? "الصلاحيات مُدارة يدوياً لهذا المستخدم (غير مرتبط بقالب)"
                : "Permissions are managed individually (no template)"}
            </span>
          </>
        )}
      </div>
      <PermissionGate module="users" action="manage_permissions">
        <div className="flex flex-wrap items-center gap-2">
          <Select
            value={choice}
            onValueChange={(v) => {
              setChoice(v);
              setPreview(null);
              previewMut.mutate(Number(v));
            }}
          >
            <SelectTrigger className="w-60 h-8 text-xs">
              <SelectValue
                placeholder={ar ? "ربط بقالب دور..." : "Link to a template..."}
              />
            </SelectTrigger>
            <SelectContent>
              {templates.map((t) => (
                <SelectItem key={t.id} value={String(t.id)}>
                  {ar ? t.nameAr : t.nameEn} ({t.permissions.length})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {linked && (
            <Button
              size="sm"
              variant="ghost"
              className="h-8 text-xs"
              disabled={applyMut.isPending}
              onClick={() => applyMut.mutate(null)}
            >
              {ar ? "فك الارتباط" : "Unlink"}
            </Button>
          )}
        </div>
        {preview && choice && (
          <div className="rounded-lg bg-muted/40 p-2.5 text-xs space-y-1.5">
            <div className="flex flex-wrap gap-2">
              <Badge
                variant="outline"
                className="text-emerald-700 border-emerald-300"
              >
                +{preview.added.length} {ar ? "صلاحية جديدة" : "added"}
              </Badge>
              <Badge variant="outline" className="text-red-700 border-red-300">
                −{preview.removed.length} {ar ? "صلاحية هتتشال" : "removed"}
              </Badge>
            </div>
            {preview.removed.length > 0 && (
              <div className="text-red-700 dark:text-red-400 break-words">
                {ar ? "هتتشال: " : "Removed: "}
                {preview.removed.join(", ")}
              </div>
            )}
            <Button
              size="sm"
              className="h-7 text-xs"
              disabled={applyMut.isPending}
              onClick={() => applyMut.mutate(Number(choice))}
            >
              {ar
                ? "تأكيد الربط وتطبيق الصلاحيات"
                : "Link and apply permissions"}
            </Button>
          </div>
        )}
      </PermissionGate>
    </div>
  );
}
