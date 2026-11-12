// Settings > Maintenance services: each property's service catalogue
// (names in Arabic / English, department, target time, active).
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { customFetch } from "@workspace/api-client-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Timer, Wrench } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { usePermission } from "@/hooks/use-permission";

type Service = {
  id: number;
  category: "maintenance" | "housekeeping" | "general";
  key: string;
  labelAr: string;
  labelEn: string;
  targetMinutes: number;
  active: boolean;
  sortOrder: number;
};

const CATEGORIES: Array<{ id: Service["category"]; ar: string; en: string }> = [
  { id: "maintenance", ar: "الصيانة", en: "Maintenance" },
  { id: "housekeeping", ar: "النظافة", en: "Housekeeping" },
  { id: "general", ar: "عام", en: "General" },
];

const fmtMinutes = (m: number, ar: boolean) => {
  if (m < 60) return ar ? `${m} دقيقة` : `${m} min`;
  const h = Math.floor(m / 60);
  const r = m % 60;
  if (ar) return r ? `${h} س ${r} د` : `${h} ساعة`;
  return r ? `${h}h ${r}m` : `${h}h`;
};

export function MaintenanceServicesSection({
  propertyId,
  language,
}: {
  propertyId: number | null;
  language: string;
}) {
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { can } = usePermission();
  const canEdit = can("settings", "edit") || can("maintenance", "edit");
  const key = ["/api/maintenance/services", String(propertyId ?? "")];

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () =>
      customFetch<{ data: Service[] }>(
        `/api/maintenance/services?propertyId=${propertyId ?? ""}`,
      ),
    enabled: !!propertyId,
  });
  const services = data?.data ?? [];
  const refresh = () => {
    queryClient.invalidateQueries({ queryKey: ["/api/maintenance/services"] });
    queryClient.invalidateQueries({ queryKey: ["/api/maintenance"] });
  };

  const update = useMutation({
    mutationFn: ({ id, ...changes }: Partial<Service> & { id: number }) =>
      customFetch(`/api/maintenance/services/${id}?propertyId=${propertyId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(changes),
      }),
    onSuccess: () => {
      refresh();
      toast.success(ar ? "تم الحفظ" : "Saved");
    },
    onError: (e: any) =>
      toast.error(e?.message || (ar ? "تعذّر الحفظ" : "Could not save")),
  });

  const [draft, setDraft] = useState({
    category: "maintenance" as Service["category"],
    labelAr: "",
    labelEn: "",
    targetMinutes: 60,
  });
  const create = useMutation({
    mutationFn: () =>
      customFetch(`/api/maintenance/services?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(draft),
      }),
    onSuccess: () => {
      refresh();
      setDraft((d) => ({ ...d, labelAr: "", labelEn: "" }));
      toast.success(ar ? "تمت إضافة الخدمة" : "Service added");
    },
    onError: (e: any) =>
      toast.error(e?.message || (ar ? "تعذّرت الإضافة" : "Could not add")),
  });

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <Wrench className="w-4 h-4 text-primary" />
          {ar
            ? "خدمات الصيانة والنظافة"
            : "Maintenance & housekeeping services"}
        </CardTitle>
        <CardDescription className="text-xs">
          {ar
            ? "الخدمات اللي بتظهر عند فتح بلاغ، والوقت المستهدف لكل خدمة (بالأولوية العادية؛ العاجل نصف الوقت، والمنخفض ضعفه). البلاغ اللي يعدّي وقته بيتعلّم عليه «متأخر»."
            : "The services offered when opening a ticket and each one's target time (at normal priority; urgent is half, low is double). Tickets past their target are flagged overdue."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {isLoading && (
          <p className="text-sm text-muted-foreground">
            {ar ? "جاري التحميل..." : "Loading..."}
          </p>
        )}
        {CATEGORIES.map((cat) => {
          const rows = services.filter((s) => s.category === cat.id);
          if (rows.length === 0) return null;
          return (
            <div key={cat.id} className="space-y-2">
              <h3 className="text-sm font-semibold">
                {ar ? cat.ar : cat.en}{" "}
                <Badge variant="outline" className="ms-1">
                  {rows.filter((r) => r.active).length}
                </Badge>
              </h3>
              <div className="rounded-lg border divide-y">
                {rows.map((s) => (
                  <ServiceRow
                    key={s.id}
                    s={s}
                    ar={ar}
                    canEdit={canEdit}
                    onSave={(changes) =>
                      update.mutate({ id: s.id, ...changes })
                    }
                  />
                ))}
              </div>
            </div>
          );
        })}

        <PermissionGate
          anyPermission={[
            ["settings", "edit"],
            ["maintenance", "edit"],
          ]}
        >
          <div className="rounded-lg border border-dashed p-3 space-y-2">
            <p className="text-sm font-semibold">
              {ar ? "إضافة خدمة" : "Add a service"}
            </p>
            <div className="grid gap-2 sm:grid-cols-[150px_1fr_1fr_120px_auto] items-center">
              <Select
                value={draft.category}
                onValueChange={(v) =>
                  setDraft((d) => ({
                    ...d,
                    category: v as Service["category"],
                  }))
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.id} value={c.id}>
                      {ar ? c.ar : c.en}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                dir="rtl"
                placeholder="الاسم بالعربي"
                value={draft.labelAr}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, labelAr: e.target.value }))
                }
              />
              <Input
                dir="ltr"
                placeholder="English name"
                value={draft.labelEn}
                onChange={(e) =>
                  setDraft((d) => ({ ...d, labelEn: e.target.value }))
                }
              />
              <Input
                type="number"
                min={5}
                value={draft.targetMinutes}
                onChange={(e) =>
                  setDraft((d) => ({
                    ...d,
                    targetMinutes: Number(e.target.value),
                  }))
                }
                title={ar ? "الوقت المستهدف بالدقائق" : "Target minutes"}
              />
              <Button
                size="sm"
                className="gap-1"
                disabled={
                  !propertyId ||
                  create.isPending ||
                  !draft.labelAr.trim() ||
                  !draft.labelEn.trim() ||
                  !(draft.targetMinutes >= 5)
                }
                onClick={() => create.mutate()}
              >
                <Plus className="w-4 h-4" />
                {ar ? "إضافة" : "Add"}
              </Button>
            </div>
          </div>
        </PermissionGate>
      </CardContent>
    </Card>
  );
}

function ServiceRow({
  s,
  ar,
  canEdit,
  onSave,
}: {
  s: Service;
  ar: boolean;
  canEdit: boolean;
  onSave: (changes: Partial<Service>) => void;
}) {
  const [labelAr, setLabelAr] = useState(s.labelAr);
  const [labelEn, setLabelEn] = useState(s.labelEn);
  const [minutes, setMinutes] = useState(s.targetMinutes);
  const dirty =
    labelAr !== s.labelAr ||
    labelEn !== s.labelEn ||
    minutes !== s.targetMinutes;
  return (
    <div
      className={`grid gap-2 p-2 sm:grid-cols-[1fr_1fr_150px_auto_auto] items-center ${s.active ? "" : "opacity-60"}`}
    >
      <Input
        dir="rtl"
        value={labelAr}
        disabled={!canEdit}
        onChange={(e) => setLabelAr(e.target.value)}
        className="h-8 text-sm"
      />
      <Input
        dir="ltr"
        value={labelEn}
        disabled={!canEdit}
        onChange={(e) => setLabelEn(e.target.value)}
        className="h-8 text-sm"
      />
      <div className="flex items-center gap-1">
        <Timer className="w-4 h-4 text-muted-foreground shrink-0" />
        <Input
          type="number"
          min={5}
          value={minutes}
          disabled={!canEdit}
          onChange={(e) => setMinutes(Number(e.target.value))}
          className="h-8 text-sm"
          title={fmtMinutes(minutes || 0, ar)}
        />
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Switch
          checked={s.active}
          disabled={!canEdit}
          onCheckedChange={(v) => onSave({ active: v })}
          aria-label={ar ? "مفعّلة" : "Active"}
        />
        {s.active ? (ar ? "مفعّلة" : "Active") : ar ? "موقوفة" : "Off"}
      </div>
      {canEdit ? (
        <Button
          size="sm"
          variant={dirty ? "default" : "outline"}
          className="h-8"
          disabled={
            !dirty || !labelAr.trim() || !labelEn.trim() || !(minutes >= 5)
          }
          onClick={() =>
            onSave({
              labelAr: labelAr.trim(),
              labelEn: labelEn.trim(),
              targetMinutes: minutes,
            })
          }
        >
          {ar ? "حفظ" : "Save"}
        </Button>
      ) : (
        <span />
      )}
    </div>
  );
}
