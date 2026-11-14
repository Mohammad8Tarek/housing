// Nightly housing operations report email (21:30 Cairo time): on/off,
// recipients, preview and "send now". Mirrors MaintenanceReportCard.
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
import { Building2, Eye, Send } from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";
import { resolveApiUrl } from "@/lib/api-origin";
import { ReportDeliveryControls } from "./ReportDeliveryControls";

const pad = (n: number) => String(n).padStart(2, "0");

export function HousingReportCard({
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
  const [lang, setLang] = useState<"ar" | "en">("en");
  const [hour, setHour] = useState(21);
  const [minute, setMinute] = useState(30);
  useEffect(() => {
    if (settings) {
      setEnabled(Boolean(settings.housingReportEnabled));
      setEmails(settings.housingReportEmails || "");
      setLang(settings.housingReportLang === "ar" ? "ar" : "en");
      setHour(Number(settings.housingReportHour ?? 21));
      setMinute(Number(settings.housingReportMinute ?? 30));
    }
  }, [settings]);

  const save = useMutation({
    mutationFn: () =>
      customFetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          housingReportEnabled: enabled,
          housingReportEmails: emails.trim(),
          housingReportLang: lang,
          housingReportHour: hour,
          housingReportMinute: minute,
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
        `/api/housing/daily-report/send?propertyId=${propertyId ?? ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ lang }),
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
          <Building2 className="w-4 h-4 text-primary" />
          {ar ? "تقرير عمليات السكن اليومي" : "Daily housing operations report"}
        </CardTitle>
        <CardDescription className="text-xs">
          {ar
            ? "يُرسل كل يوم في الوقت اللي تحدده (توقيت القاهرة): مين سكن اليوم ومين اتنقل ومين غادر، ومين مخالف لسياسة السكن حالياً (ومعتمد ولا لأ)، مع ملف Excel (CSV). يستخدم إعدادات البريد أعلاه."
            : "Sent daily at the time you choose (Cairo): today's check-ins, transfers and check-outs, and who currently breaks the housing policy (approved or not), plus an Excel (CSV) file. Uses the email settings above."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <Label htmlFor="housing-report-enabled" className="text-sm">
            {ar ? "تفعيل الإرسال اليومي" : "Send every night"}
          </Label>
          <Switch
            id="housing-report-enabled"
            checked={enabled}
            onCheckedChange={setEnabled}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="housing-report-emails" className="text-sm">
            {ar ? "إيميلات المستلمين" : "Recipient emails"}
          </Label>
          <Textarea
            id="housing-report-emails"
            rows={2}
            dir="ltr"
            placeholder="gm@hotel.com, housing.manager@hotel.com"
            value={emails}
            onChange={(e) => setEmails(e.target.value)}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            {ar
              ? `افصل بين الإيميلات بفاصلة (أكتر من إيميل). عدد الإيميلات الصحيحة: ${count}`
              : `Separate emails with commas (more than one allowed). Valid emails: ${count}`}
          </p>
        </div>
        <ReportDeliveryControls
          ar={ar}
          lang={lang}
          hour={hour}
          minute={minute}
          onLang={setLang}
          onHour={setHour}
          onMinute={setMinute}
          idPrefix="housing-report"
        />
        <p className="text-[11px] text-muted-foreground">
          {ar
            ? `هيتبعت يومياً الساعة ${pad(hour)}:${pad(minute)} بتوقيت القاهرة.`
            : `Sends daily at ${pad(hour)}:${pad(minute)} Cairo time.`}
        </p>
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
                  `/api/housing/daily-report?propertyId=${propertyId}&format=html&lang=${lang}`,
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
