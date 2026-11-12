// Scheduled report emails: schedule the open report (with its current
// filters) to be emailed daily / weekly / monthly, and manage the property's
// schedules. A schedule runs with its creator's permissions.
import { useMemo, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CalendarClock, Loader2, Send, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { REPORT_TITLES } from "@workspace/report-rows";
import { useAuth } from "@/context/AuthContext";
import { usePermission } from "@/hooks/use-permission";
import { formatDate } from "@/lib/date-utils";
import { FILTER_KEYS, SERVER_ROW_TABS } from "../hooks/useServerReportRows";

type Schedule = {
  id: number;
  reportKey: string;
  frequency: "daily" | "weekly" | "monthly";
  dayOfWeek: number | null;
  dayOfMonth: number | null;
  hour: number;
  recipients: string;
  lang: "ar" | "en";
  filters: Record<string, string>;
  enabled: boolean;
  createdBy: number;
  createdByName: string | null;
  lastRunAt: string | null;
  lastStatus: string | null;
  lastError: string | null;
};

const DAYS = {
  ar: ["الأحد", "الاثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة", "السبت"],
  en: [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ],
};
// Absolute dates make no sense for a repeating report.
const SAVED_FILTERS = FILTER_KEYS.filter(
  (k) => k !== "dateFrom" && k !== "dateTo",
);

// Scheduler failure reasons, in the user's language.
const ERRORS: Array<[RegExp, string, string]> = [
  [
    /SMTP not configured/i,
    "إعدادات البريد (SMTP) غير مكتملة",
    "Email (SMTP) settings are incomplete",
  ],
  [/No recipients/i, "لا يوجد مستلمين", "No recipients"],
  [
    /Creator account is not active/i,
    "حساب منشئ الجدولة موقوف",
    "The creator's account is disabled",
  ],
  [
    /Creator account no longer exists/i,
    "حساب منشئ الجدولة اتمسح",
    "The creator's account was deleted",
  ],
];
function errorText(raw: string, ar: boolean): string {
  const hit = ERRORS.find(([re]) => re.test(raw));
  return hit ? (ar ? hit[1] : hit[2]) : raw;
}

const hourLabel = (h: number) => `${String(h).padStart(2, "0")}:00`;

export function ReportSchedulesDialog({
  ar,
  propId,
  report,
  filters,
}: {
  ar: boolean;
  propId: number | undefined;
  report: string;
  filters: Record<string, any>;
}) {
  const [open, setOpen] = useState(false);
  const qc = useQueryClient();
  const { user } = useAuth();
  const { can } = usePermission();
  const canConfig = can("reports", "config");
  const key = ["/api/report-schedules", propId];
  const title = (k: string) =>
    REPORT_TITLES[k]?.[ar ? "ar" : "en"] ??
    (ar ? "التقرير المفتوح" : "The open report");
  const schedulable = SERVER_ROW_TABS.has(report);

  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () =>
      customFetch<{ data: Schedule[] }>(
        `/api/report-schedules?propertyId=${propId}`,
      ),
    enabled: open && !!propId,
  });
  const schedules = data?.data ?? [];

  const [frequency, setFrequency] = useState<"daily" | "weekly" | "monthly">(
    "daily",
  );
  const [dayOfWeek, setDayOfWeek] = useState(0);
  const [dayOfMonth, setDayOfMonth] = useState(1);
  const [hour, setHour] = useState(8);
  const [recipients, setRecipients] = useState("");
  const [lang, setLang] = useState<"ar" | "en">(ar ? "ar" : "en");

  const savedFilters = useMemo(() => {
    const out: Record<string, string> = {};
    for (const k of SAVED_FILTERS) {
      const v = filters[k];
      if (v && v !== "all") out[k] = String(v);
    }
    return out;
  }, [filters]);
  const emailsOk = useMemo(() => {
    const list = recipients.split(/[,;\s]+/).filter(Boolean);
    return (
      list.length > 0 &&
      list.length <= 20 &&
      list.every((e) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e))
    );
  }, [recipients]);

  const url = (path = "") =>
    `/api/report-schedules${path}?propertyId=${propId}`;
  const onError = (e: any) =>
    toast.error(
      (ar ? e?.data?.error : e?.data?.errorEn || e?.data?.error) ||
        (ar ? "حصلت مشكلة" : "Something went wrong"),
    );

  const create = useMutation({
    mutationFn: () =>
      customFetch(url(), {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          reportKey: report,
          frequency,
          dayOfWeek: frequency === "weekly" ? dayOfWeek : null,
          dayOfMonth: frequency === "monthly" ? dayOfMonth : null,
          hour,
          recipients,
          lang,
          filters: savedFilters,
        }),
      }),
    onSuccess: () => {
      toast.success(ar ? "تم جدولة التقرير" : "Report scheduled");
      setRecipients("");
      qc.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  const toggle = useMutation({
    mutationFn: (s: Schedule) =>
      customFetch(url(`/${s.id}`), {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ enabled: !s.enabled }),
      }),
    onSuccess: () => qc.invalidateQueries({ queryKey: key }),
    onError,
  });
  const remove = useMutation({
    mutationFn: (s: Schedule) =>
      customFetch(url(`/${s.id}`), { method: "DELETE" }),
    onSuccess: () => {
      toast.success(ar ? "تم إلغاء الجدولة" : "Schedule removed");
      qc.invalidateQueries({ queryKey: key });
    },
    onError,
  });
  const sendNow = useMutation({
    mutationFn: (s: Schedule) =>
      customFetch<{ rows: number }>(url(`/${s.id}/send-now`), {
        method: "POST",
      }),
    onSuccess: (r) => {
      toast.success(ar ? `تم الإرسال (${r.rows} صف)` : `Sent (${r.rows} rows)`);
      qc.invalidateQueries({ queryKey: key });
    },
    onError: (e: any) => {
      toast.error(
        `${ar ? "تعذر الإرسال" : "Send failed"}: ${errorText(String(e?.data?.error ?? ""), ar)}`,
      );
      qc.invalidateQueries({ queryKey: key });
    },
  });

  const when = (s: Schedule) => {
    const t = hourLabel(s.hour);
    if (s.frequency === "weekly")
      return ar
        ? `كل ${DAYS.ar[s.dayOfWeek ?? 0]} ${t}`
        : `Every ${DAYS.en[s.dayOfWeek ?? 0]} ${t}`;
    if (s.frequency === "monthly")
      return ar
        ? `يوم ${s.dayOfMonth} من كل شهر ${t}`
        : `Day ${s.dayOfMonth} of each month ${t}`;
    return ar ? `يومياً ${t}` : `Daily ${t}`;
  };
  const mine = (s: Schedule) => s.createdBy === (user as any)?.id || canConfig;

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <CalendarClock className="w-4 h-4" />
          <span>{ar ? "إرسال مجدول" : "Schedule email"}</span>
        </Button>
      </DialogTrigger>
      <DialogContent
        className="max-w-2xl max-h-[90vh] overflow-y-auto"
        dir={ar ? "rtl" : "ltr"}
      >
        <DialogHeader>
          <DialogTitle>
            {ar ? "التقارير المجدولة" : "Scheduled reports"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? "التقرير بيتبعت بالإيميل لوحده في الميعاد اللي تحدده (بتوقيت القاهرة)، ومعاه ملف يتفتح على Excel. بيتبعت بصلاحياتك أنت."
              : "The report is emailed automatically at the time you pick (Cairo time), with a file that opens in Excel. It runs with your permissions."}
          </DialogDescription>
        </DialogHeader>

        {/* New schedule for the open report */}
        <div className="rounded-xl border p-4 space-y-3">
          <div className="text-sm font-semibold">
            {ar ? "جدولة: " : "Schedule: "}
            <span className="text-primary">{title(report)}</span>
          </div>
          {!schedulable ? (
            <p className="text-sm text-muted-foreground">
              {ar
                ? "التقرير ده لسه مينفعش يتجدول. اختار تقرير تاني من التبويبات."
                : "This report can't be scheduled yet. Pick another report tab."}
            </p>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="space-y-1">
                  <Label className="text-xs">{ar ? "التكرار" : "Repeat"}</Label>
                  <Select
                    value={frequency}
                    onValueChange={(v: any) => setFrequency(v)}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">
                        {ar ? "يومي" : "Daily"}
                      </SelectItem>
                      <SelectItem value="weekly">
                        {ar ? "أسبوعي" : "Weekly"}
                      </SelectItem>
                      <SelectItem value="monthly">
                        {ar ? "شهري" : "Monthly"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {frequency !== "daily" && (
                  <div className="space-y-1">
                    <Label className="text-xs">{ar ? "اليوم" : "Day"}</Label>
                    {frequency === "weekly" ? (
                      <Select
                        value={String(dayOfWeek)}
                        onValueChange={(v) => setDayOfWeek(Number(v))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {DAYS[ar ? "ar" : "en"].map((d, i) => (
                            <SelectItem key={i} value={String(i)}>
                              {d}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <Select
                        value={String(dayOfMonth)}
                        onValueChange={(v) => setDayOfMonth(Number(v))}
                      >
                        <SelectTrigger className="h-9">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="max-h-64">
                          {Array.from({ length: 28 }, (_, i) => i + 1).map(
                            (d) => (
                              <SelectItem key={d} value={String(d)}>
                                {d}
                              </SelectItem>
                            ),
                          )}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  <Label className="text-xs">
                    {ar ? "الساعة (القاهرة)" : "Time (Cairo)"}
                  </Label>
                  <Select
                    value={String(hour)}
                    onValueChange={(v) => setHour(Number(v))}
                  >
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="max-h-64">
                      {Array.from({ length: 24 }, (_, h) => (
                        <SelectItem key={h} value={String(h)}>
                          {hourLabel(h)}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <Label className="text-xs">
                    {ar ? "لغة التقرير" : "Language"}
                  </Label>
                  <Select value={lang} onValueChange={(v: any) => setLang(v)}>
                    <SelectTrigger className="h-9">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="ar">العربية</SelectItem>
                      <SelectItem value="en">English</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs">
                  {ar ? "الإيميلات (افصل بفاصلة)" : "Emails (comma separated)"}
                </Label>
                <Input
                  dir="ltr"
                  value={recipients}
                  onChange={(e) => setRecipients(e.target.value)}
                  placeholder="hr@hotel.com, gm@hotel.com"
                  className={
                    recipients && !emailsOk ? "border-destructive" : ""
                  }
                />
              </div>
              {Object.keys(savedFilters).some(
                (k) => k !== "inventoryViewMode" && k !== "waterSortMode",
              ) && (
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "هيتبعت بنفس الفلاتر المختارة دلوقتي (ماعدا التواريخ)."
                    : "It will use the filters selected now (except dates)."}
                </p>
              )}
              <Button
                className="gap-2"
                disabled={!emailsOk || create.isPending}
                onClick={() => create.mutate()}
              >
                {create.isPending ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <CalendarClock className="w-4 h-4" />
                )}
                {ar ? "حفظ الجدولة" : "Save schedule"}
              </Button>
            </>
          )}
        </div>

        {/* Existing schedules */}
        <div className="space-y-2">
          <div className="text-sm font-semibold">
            {ar
              ? "كل التقارير المجدولة للفندق"
              : "All scheduled reports for this property"}
          </div>
          {isLoading ? (
            <div className="py-4 text-center">
              <Loader2 className="w-5 h-5 animate-spin inline" />
            </div>
          ) : schedules.length === 0 ? (
            <p className="text-sm text-muted-foreground py-3">
              {ar ? "مفيش تقارير مجدولة" : "No scheduled reports"}
            </p>
          ) : (
            <ul className="divide-y rounded-xl border">
              {schedules.map((s) => (
                <li key={s.id} className="flex items-start gap-3 p-3">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold truncate">
                      {title(s.reportKey)}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {when(s)} · {s.lang === "ar" ? "عربي" : "English"} ·{" "}
                      {ar ? "بواسطة" : "by"} {s.createdByName}
                    </div>
                    <div
                      className="text-xs text-muted-foreground truncate"
                      dir="ltr"
                    >
                      {s.recipients}
                    </div>
                    {s.lastRunAt && (
                      <div className="text-xs mt-0.5">
                        <Badge
                          variant="outline"
                          className={
                            s.lastStatus === "sent"
                              ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-400"
                              : "border-rose-500/40 text-rose-700 dark:text-rose-400"
                          }
                        >
                          {s.lastStatus === "sent"
                            ? ar
                              ? "اتبعت"
                              : "Sent"
                            : ar
                              ? "فشل"
                              : "Failed"}{" "}
                          {formatDate(s.lastRunAt)}
                        </Badge>
                        {s.lastError && (
                          <span className="text-rose-600 ms-2">
                            {errorText(s.lastError, ar)}
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                  {mine(s) && (
                    <div className="flex items-center gap-1 shrink-0">
                      <span dir="ltr" className="inline-flex">
                        <Switch
                          checked={s.enabled}
                          onCheckedChange={() => toggle.mutate(s)}
                          aria-label={ar ? "تشغيل/إيقاف" : "On/off"}
                        />
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8"
                        title={ar ? "إرسال الآن" : "Send now"}
                        disabled={sendNow.isPending}
                        onClick={() => sendNow.mutate(s)}
                      >
                        {sendNow.isPending && sendNow.variables?.id === s.id ? (
                          <Loader2 className="w-4 h-4 animate-spin" />
                        ) : (
                          <Send className="w-4 h-4" />
                        )}
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive"
                        title={ar ? "حذف" : "Delete"}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(s)}
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
