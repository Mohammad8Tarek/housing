import { useEffect, useState } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { RefreshCw, ShieldAlert, Calendar, LogOut, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface HrSyncSectionProps {
  propertyId: number | null;
  language: string;
}

export function HrSyncSection({ propertyId, language }: HrSyncSectionProps) {
  const queryClient = useQueryClient();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [fieldMapping, setFieldMapping] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [autoCheckoutOnDeparture, setAutoCheckoutOnDeparture] = useState(true);
  const [autoVacationSync, setAutoVacationSync] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const ar = language === "ar";

  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/hr-sync/config?propertyId=${propertyId}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d && d.config) {
          setApiUrl(d.config.apiUrl || "");
          setApiKey(d.config.apiKey || "");
          setFieldMapping(
            d.config.fieldMapping
              ? JSON.stringify(d.config.fieldMapping, null, 2)
              : "",
          );
          setIsActive(d.config.isActive ?? false);
          setAutoCheckoutOnDeparture(d.config.autoCheckoutOnDeparture ?? true);
          setAutoVacationSync(d.config.autoVacationSync ?? true);
        }
      })
      .catch(() => {
        toast.error(
          ar ? "فشل تحميل إعدادات المزامنة" : "Failed to load sync settings",
        );
      });
  }, [propertyId]);

  const saveConfig = async () => {
    if (!propertyId) return;
    try {
      let fm: any = undefined;
      if (fieldMapping.trim()) {
        try {
          fm = JSON.parse(fieldMapping);
        } catch {
          toast.error(ar ? "JSON تطابق الحقول غير صحيح" : "Invalid JSON in field mapping");
          return;
        }
      }
      const resp = await fetch("/api/hr-sync/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId,
          apiUrl: apiUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          fieldMapping: fm,
          isActive,
          autoCheckoutOnDeparture,
          autoVacationSync,
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).message || "Save failed");
      toast.success(ar ? "تم حفظ إعدادات الربط بنجاح" : "HR sync config saved");
    } catch (err: any) {
      toast.error(err.message || "Error saving config");
    }
  };

  const triggerSync = async () => {
    if (!propertyId) return;
    setSyncing(true);
    try {
      const resp = await fetch("/api/hr-sync/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error || "Sync failed");
      const d = await resp.json();
      toast.success(
        ar
          ? `تمت المزامنة: ${d.stats?.created || 0} موظف جديد، ${d.stats?.updated || 0} تحديث بيانات${d.stats?.departedAutoCheckouts ? `، وإخلاء ${d.stats.departedAutoCheckouts} غرف للتصفية` : ""}`
          : `Sync complete: ${d.stats?.created || 0} created, ${d.stats?.updated || 0} updated${d.stats?.departedAutoCheckouts ? `, ${d.stats.departedAutoCheckouts} auto-checkouts` : ""}`,
      );
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card className="shadow-sm">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-5 h-5 text-primary" />
          {ar ? "الربط مع نظام الموارد البشرية (HR Sync API)" : "HR System Integration (API Sync)"}
        </CardTitle>
        <CardDescription>
          {ar
            ? "جلب بيانات الموظفين بالكامل، وأتمتة الإجازات، وتنفيذ الخروج التلقائي (Auto-checkout) والإنذارات عند التصفية"
            : "Sync full employee profiles, automate vacations, and trigger auto-checkout and alarms on departure"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Sync Status & Action Toggles */}
        <div className="grid gap-4 md:grid-cols-3 bg-muted/40 p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between p-2">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold block">
                {ar ? "حالة الربط الآلي:" : "Sync Status:"}
              </span>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? ar
                    ? "الربط مفعل وجاهز"
                    : "Active & Ready"
                  : ar
                    ? "الربط معطل حالياً"
                    : "Disabled"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? (ar ? "نشط" : "Active") : ar ? "متوقف" : "Disabled"}
              </Badge>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="flex items-center justify-between p-2 border-t md:border-t-0 md:border-r border-border/50">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                {ar ? "إخلاء الغرفة عند التصفية:" : "Auto-Checkout on Departure:"}
              </span>
              <p className="text-xs text-muted-foreground">
                {ar ? "إخلاء السرير وتحويل الغرفة لمتسخة فوراً" : "Release bed & set room to dirty"}
              </p>
            </div>
            <Switch
              checked={autoCheckoutOnDeparture}
              onCheckedChange={setAutoCheckoutOnDeparture}
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t md:border-t-0 md:border-r border-border/50">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                {ar ? "مزامنة الإجازات تلقائياً:" : "Auto Vacation Sync:"}
              </span>
              <p className="text-xs text-muted-foreground">
                {ar ? "تحويل الغرفة لـ occupied_vacation" : "Sync room to occupied_vacation"}
              </p>
            </div>
            <Switch
              checked={autoVacationSync}
              onCheckedChange={setAutoVacationSync}
            />
          </div>
        </div>

        {/* API Credentials */}
        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium mb-1 block">
              {ar ? "رابط API الموارد البشرية (GET Endpoint)" : "HR API Endpoint URL (GET)"}
            </label>
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder="https://hr-solution.com/api/employees"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {ar
                ? "الرابط الذي يُرجع قائمة الموظفين عند الضغط على 'مزامنة الآن'"
                : "URL that returns employees array when pulling data"}
            </p>
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              {ar ? "مفتاح الربط (API Key / Bearer Token)" : "API Key / Bearer Token"}
            </label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••••••••••"
              type="password"
            />
            <p className="text-xs text-muted-foreground mt-1">
              {ar
                ? "يُستخدم للتحقق في الترويسات (Authorization / x-api-key)"
                : "Used in Authorization / x-api-key headers"}
            </p>
          </div>
        </div>

        <div>
          <label className="text-sm font-medium mb-1 block">
            {ar ? "تطابق الحقول المخصص - Field Mapping (JSON)" : "Custom Field Mapping (JSON)"}
          </label>
          <Textarea
            value={fieldMapping}
            onChange={(e) => setFieldMapping(e.target.value)}
            rows={3}
            placeholder='{"firstName": "first_name", "jobTitle": "position", "dateOfBirth": "dob"}'
            className="font-mono text-xs"
          />
          <p className="text-xs text-muted-foreground mt-1">
            {ar
              ? "اختياري. النظام يتعرف تلقائياً على معظم الحقول القياسية، ولكن يمكنك تخصيص مسميات حقول الـ HR هنا."
              : "Optional. The system auto-detects standard field names, but you can override mappings here."}
          </p>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={saveConfig}>
            <CheckCircle2 className="w-4 h-4 mr-1.5" />
            {ar ? "حفظ الإعدادات" : "Save Config"}
          </Button>
          <Button
            variant="secondary"
            onClick={triggerSync}
            disabled={syncing || !isActive || !apiUrl}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing
              ? ar
                ? "جارٍ المزامنة..."
                : "Syncing..."
              : ar
                ? "مزامنة الآن (Pull)"
                : "Sync Now (Pull)"}
          </Button>
        </div>

        <Separator />

        {/* Developer Webhooks Reference */}
        <div className="space-y-4 pt-1">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-primary" />
              {ar
                ? "مسارات الـ Webhooks لنظام الموارد البشرية (Push Endpoints):"
                : "External HR Push Webhooks Endpoints:"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "يمكن لنظام الموارد البشرية إرسال التحديثات تلقائياً عبر الـ Webhooks التالية:"
                : "Your HR solution can push updates in real-time to these endpoints:"}
            </p>
          </div>

          <div className="grid gap-3 md:grid-cols-3">
            {/* Webhook 1: Full Profiles */}
            <div className="bg-muted/40 rounded-xl p-3 border text-xs space-y-2">
              <div className="font-semibold text-primary flex items-center justify-between">
                <span>1. مزامنة البروفايلات الكاملة</span>
                <Badge variant="outline" className="text-[10px]">POST</Badge>
              </div>
              <code className="block bg-background p-1.5 rounded font-mono text-[11px] text-foreground">
                /api/hr-sync/receive
              </code>
              <p className="text-muted-foreground text-[11px]">
                {ar
                  ? "إرسال كل البروفايلات بالداتا الكاملة، صور البطاقات، والوظائف."
                  : "Push all profile fields, documents, and employment details."}
              </p>
            </div>

            {/* Webhook 2: Vacation Start / Return */}
            <div className="bg-muted/40 rounded-xl p-3 border text-xs space-y-2">
              <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                <span>2. إشعار إجازة (خروج / عودة)</span>
                <Badge variant="outline" className="text-[10px]">POST</Badge>
              </div>
              <code className="block bg-background p-1.5 rounded font-mono text-[11px] text-foreground">
                /api/hr-sync/notify-vacation
              </code>
              <p className="text-muted-foreground text-[11px]">
                {ar
                  ? "تسجيل الإجازة وتحويل الغرفة لـ occupied_vacation وحجز السرير."
                  : "Sync vacation start/return & room occupied_vacation status."}
              </p>
            </div>

            {/* Webhook 3: Departure / Clearance */}
            <div className="bg-muted/40 rounded-xl p-3 border text-xs space-y-2">
              <div className="font-semibold text-red-600 dark:text-red-400 flex items-center justify-between">
                <span>3. إشعار تصفية ومغادرة</span>
                <Badge variant="outline" className="text-[10px]">POST</Badge>
              </div>
              <code className="block bg-background p-1.5 rounded font-mono text-[11px] text-foreground">
                /api/hr-sync/notify-departure
              </code>
              <p className="text-muted-foreground text-[11px]">
                {ar
                  ? "عمل Check-out تلقائي، تحويل الغرفة لـ dirty، وإطلاق إنذار فوري."
                  : "Auto check-out, set room dirty, and broadcast instant alarm."}
              </p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
