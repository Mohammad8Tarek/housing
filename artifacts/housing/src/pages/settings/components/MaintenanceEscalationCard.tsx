// Auto-escalation of overdue maintenance tickets (opt-in per property): when a
// ticket blows its SLA / due date the system raises its priority and keeps
// re-escalating every N hours it stays overdue, up to "urgent".
import { useEffect, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { TrendingUp } from "lucide-react";
import { toast } from "sonner";

export function MaintenanceEscalationCard({
  propertyId,
  ar,
}: {
  propertyId: number | null;
  ar: boolean;
}) {
  const queryClient = useQueryClient();
  const { data: settings } = useQuery({
    queryKey: ["/api/settings", propertyId],
    queryFn: () =>
      customFetch<any>(`/api/settings?propertyId=${propertyId ?? ""}`),
    enabled: !!propertyId,
  });
  const [enabled, setEnabled] = useState(false);
  const [hours, setHours] = useState(12);
  useEffect(() => {
    if (settings) {
      setEnabled(Boolean(settings.maintenanceEscalationEnabled));
      setHours(Number(settings.maintenanceEscalationHours ?? 12));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      customFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          maintenanceEscalationEnabled: enabled,
          maintenanceEscalationHours: Math.min(168, Math.max(1, hours || 12)),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/settings", propertyId],
      });
      toast.success(ar ? "تم حفظ إعدادات التصعيد" : "Escalation settings saved");
    },
    onError: (e: any) =>
      toast.error(e?.message || (ar ? "تعذّر الحفظ" : "Could not save")),
  });

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <TrendingUp className="w-4 h-4 text-primary" />
          {ar
            ? "التصعيد التلقائي للتذاكر المتأخرة"
            : "Auto-escalation of overdue tickets"}
        </CardTitle>
        <CardDescription className="text-xs">
          {ar
            ? "عند تجاوز التذكرة للوقت المحدد لها، يرفع النظام أولويتها تلقائياً (إلى «عالية» ثم «عاجلة») ويعيد التصعيد كل عدد ساعات تحدده طالما ظلت متأخرة. يُسجّل كل تصعيد في سجل النشاط."
            : "When a ticket passes its target time, the system automatically raises its priority (to High, then Urgent) and re-escalates every N hours it stays overdue. Every escalation is written to the activity log."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mnt-escalation-enabled" className="text-sm">
            {ar ? "تفعيل التصعيد التلقائي" : "Enable auto-escalation"}
          </Label>
          <Switch
            id="mnt-escalation-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mnt-escalation-hours" className="text-sm">
            {ar
              ? "عدد الساعات بين مستويات التصعيد"
              : "Hours between escalation levels"}
          </Label>
          <Input
            id="mnt-escalation-hours"
            type="number"
            min={1}
            max={168}
            value={hours}
            disabled={!enabled}
            onChange={(e) => setHours(Number(e.target.value))}
            className="w-32"
          />
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? "مثال: 12 ساعة — بعد التأخير تصبح «عالية»، وبعد 12 ساعة إضافية تصبح «عاجلة»."
              : "e.g. 12h — once overdue it becomes High; after another 12h it becomes Urgent."}
          </p>
        </div>
        <div className="flex justify-end">
          <Button
            size="sm"
            onClick={() => save.mutate()}
            disabled={save.isPending || !propertyId}
          >
            {save.isPending
              ? ar
                ? "جاري الحفظ..."
                : "Saving..."
              : ar
                ? "حفظ"
                : "Save"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
