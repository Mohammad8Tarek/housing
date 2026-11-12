// Nightly maintenance / housekeeping report email (22:00 Cairo time):
// on/off, recipients, preview and "send now".
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { ClipboardList, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { resolveApiUrl } from "@/lib/api-origin";

export function MaintenanceReportCard({
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
  const [emails, setEmails] = useState("");
  useEffect(() => {
    if (settings) {
      setEnabled(Boolean(settings.maintenanceReportEnabled));
      setEmails(settings.maintenanceReportEmails || "");
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      customFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          maintenanceReportEnabled: enabled,
          maintenanceReportEmails: emails.trim(),
        }),
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ["/api/settings", propertyId],
      });
      toast.success(ar ? "تم حفظ إعدادات التقرير" : "Report settings saved");
    },
    onError: (e: any) =>
      toast.error(e?.message || (ar ? "تعذّر الحفظ" : "Could not save")),
  });

  const sendNow = useMutation({
    mutationFn: () =>
      customFetch<any>(
        `/api/maintenance/daily-report/send?propertyId=${propertyId ?? ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({}),
        },
      ),
    onSuccess: (r: any) =>
      toast.success(
        ar
          ? `تم إرسال تقرير اليوم إلى ${r.recipients?.length ?? 0} مستلم`
          : `Today's report sent to ${r.recipients?.length ?? 0} recipient(s)`,
      ),
    onError: (e: any) =>
      toast.error(
        e?.data?.message ||
          e?.message ||
          (ar ? "تعذّر الإرسال" : "Could not send"),
      ),
  });

  const count = emails
    .split(/[,;\s]+/)
    .filter((e) => /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e.trim())).length;

  return (
    <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-bold flex items-center gap-2">
          <ClipboardList className="w-4 h-4 text-primary" />
          {ar
            ? "تقرير الصيانة والنظافة اليومي"
            : "Daily maintenance & housekeeping report"}
        </CardTitle>
        <CardDescription className="text-xs">
          {ar
            ? "يُرسل كل يوم الساعة 10 مساءً (توقيت القاهرة): ملخص حسب القسم وكل بلاغ بوقت البداية والنهاية والمدة، مع ملف Excel (CSV). يستخدم إعدادات البريد أعلاه."
            : "Sent every day at 10 PM (Cairo): a summary by department and every ticket with start, end and duration, plus an Excel (CSV) file. Uses the email settings above."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="mnt-report-enabled" className="text-sm">
            {ar ? "تفعيل الإرسال اليومي" : "Send every night"}
          </Label>
          <Switch
            id="mnt-report-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="mnt-report-emails" className="text-sm">
            {ar ? "إيميلات المستلمين" : "Recipient emails"}
          </Label>
          <Textarea
            id="mnt-report-emails"
            rows={2}
            dir="ltr"
            placeholder="gm@hotel.com, chief.engineer@hotel.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? `افصل بين الإيميلات بفاصلة. عدد الإيميلات الصحيحة: ${count}`
              : `Separate emails with commas. Valid emails: ${count}`}
          </p>
        </div>
        <div className="flex flex-wrap gap-2 justify-end">
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="gap-1.5"
            disabled={!propertyId}
            onClick={() =>
              window.open(
                resolveApiUrl(
                  `/api/maintenance/daily-report?propertyId=${propertyId}&format=html`,
                ),
                "_blank",
                "noopener",
              )
            }
          >
            <Eye className="w-4 h-4" />
            {ar ? "معاينة تقرير اليوم" : "Preview today's report"}
          </Button>
          <PermissionGate module="settings" action="edit">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="gap-1.5"
              disabled={!propertyId || sendNow.isPending || count === 0}
              onClick={() => sendNow.mutate()}
            >
              <Send className="w-4 h-4" />
              {ar ? "إرسال الآن" : "Send now"}
            </Button>
            <Button
              type="button"
              size="sm"
              disabled={!propertyId || save.isPending}
              onClick={() => save.mutate()}
            >
              {ar ? "حفظ" : "Save"}
            </Button>
          </PermissionGate>
        </div>
        {enabled && count === 0 && (
          <p className="text-xs text-amber-600">
            {ar
              ? "التقرير مفعّل لكن لا توجد إيميلات — لن يُرسل شيء."
              : "The report is on but there are no emails, so nothing will be sent."}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
