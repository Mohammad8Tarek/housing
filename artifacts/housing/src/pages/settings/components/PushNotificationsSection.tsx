import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Bell,
  BellRing,
  Smartphone,
  Globe,
  CheckCircle2,
  XCircle,
  Send,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";

type Status = {
  webPush: boolean;
  vapidPublicKey: string | null;
  vapidSource: "env" | "generated" | "none";
  fcm: boolean;
  subscriptions: number;
  devices: number;
};

export function PushNotificationsSection({
  propertyId,
  language,
}: {
  propertyId?: number | "all" | null;
  language: string;
}) {
  const ar = language === "ar";
  const pid = typeof propertyId === "number" ? propertyId : undefined;
  const [testProfileId, setTestProfileId] = useState("");
  const [sending, setSending] = useState(false);

  const { data, isLoading, refetch, isRefetching } = useQuery<Status>({
    queryKey: ["/api/push/admin/status", pid],
    queryFn: async () => {
      const res = await fetch(
        `/api/push/admin/status${pid ? `?propertyId=${pid}` : ""}`,
      );
      if (!res.ok) throw new Error("Failed to load push status");
      return res.json();
    },
  });

  const sendTest = async () => {
    const profileId = testProfileId.trim();
    if (!profileId) {
      toast.error(ar ? "اكتب رقم البروفايل أولاً" : "Enter a profile ID first");
      return;
    }
    setSending(true);
    try {
      const res = await fetch(
        `/api/push/admin/test${pid ? `?propertyId=${pid}` : ""}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ profileId }),
        },
      );
      const body = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(body?.error || "Failed to send");
      toast.success(
        ar
          ? "تم إرسال الإشعار التجريبي ✅ (لو الجهاز مشترك هيوصله)"
          : "Test notification sent ✅ (it reaches the device if subscribed)",
      );
    } catch (e: any) {
      toast.error(
        e?.message ||
          (ar ? "فشل إرسال الإشعار" : "Failed to send notification"),
      );
    } finally {
      setSending(false);
    }
  };

  const StatusRow = ({
    ok,
    icon,
    label,
    detail,
  }: {
    ok: boolean;
    icon: React.ReactNode;
    label: string;
    detail?: string;
  }) => (
    <div className="flex items-center justify-between gap-3 p-3 rounded-xl border bg-muted/20">
      <div className="flex items-center gap-2.5">
        <div className="text-muted-foreground">{icon}</div>
        <div>
          <p className="text-sm font-semibold">{label}</p>
          {detail && (
            <p className="text-[11px] text-muted-foreground">{detail}</p>
          )}
        </div>
      </div>
      {ok ? (
        <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 border-emerald-500/30 gap-1">
          <CheckCircle2 className="w-3.5 h-3.5" />
          {ar ? "مفعّل" : "Active"}
        </Badge>
      ) : (
        <Badge
          variant="outline"
          className="text-rose-700 dark:text-rose-400 border-rose-500/30 gap-1"
        >
          <XCircle className="w-3.5 h-3.5" />
          {ar ? "غير مفعّل" : "Off"}
        </Badge>
      )}
    </div>
  );

  return (
    <Card className="border shadow-sm">
      <CardHeader>
        <div className="flex items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BellRing className="w-5 h-5 text-rose-500" />
              {ar ? "إشعارات بوابة الموظفين" : "Resident Portal Notifications"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "حالة الإشعارات الفورية (Push) وإرسال إشعار تجريبي للتأكد."
                : "Push notification status and a test send to verify delivery."}
            </CardDescription>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            disabled={isRefetching}
            className="gap-1.5 shrink-0"
          >
            <RefreshCw
              className={`w-3.5 h-3.5 ${isRefetching ? "animate-spin" : ""}`}
            />
            {ar ? "تحديث" : "Refresh"}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            {ar ? "جاري التحميل..." : "Loading..."}
          </div>
        ) : !data ? (
          <div className="py-8 text-center text-muted-foreground text-sm">
            {ar ? "تعذّر تحميل الحالة" : "Could not load status"}
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <StatusRow
                ok={data.webPush}
                icon={<Globe className="w-4 h-4" />}
                label={ar ? "إشعارات المتصفح (Web Push)" : "Web Push (browser)"}
                detail={
                  data.webPush
                    ? data.vapidSource === "env"
                      ? ar
                        ? "المفاتيح من إعدادات الخادم"
                        : "Keys from server env"
                      : ar
                        ? "مفاتيح مولّدة تلقائياً ومحفوظة"
                        : "Keys auto-generated & stored"
                    : ar
                      ? "غير مهيّأ"
                      : "Not configured"
                }
              />
              <StatusRow
                ok={data.fcm}
                icon={<Smartphone className="w-4 h-4" />}
                label={ar ? "إشعارات التطبيق (FCM)" : "Native App (FCM)"}
                detail={
                  data.fcm
                    ? ar
                      ? "تطبيق أندرويد/iOS"
                      : "Android / iOS app"
                    : ar
                      ? "يتطلب مفاتيح FCM"
                      : "Requires FCM credentials"
                }
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-xl border bg-muted/20 text-center">
                <p className="text-2xl font-black text-foreground">
                  {data.subscriptions}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ar ? "متصفحات مشتركة" : "Browser subscriptions"}
                </p>
              </div>
              <div className="p-3 rounded-xl border bg-muted/20 text-center">
                <p className="text-2xl font-black text-foreground">
                  {data.devices}
                </p>
                <p className="text-[11px] text-muted-foreground mt-0.5">
                  {ar ? "أجهزة تطبيق" : "App devices"}
                </p>
              </div>
            </div>

            {!data.webPush && (
              <div className="flex items-start gap-2 p-3 rounded-lg border border-amber-500/30 bg-amber-50/50 dark:bg-amber-950/20 text-xs text-amber-800 dark:text-amber-300">
                <Info className="w-4 h-4 mt-0.5 shrink-0" />
                <span>
                  {ar
                    ? "إشعارات المتصفح متوقفة. تتفعّل تلقائياً أول ما البوابة تُفتح على رابط HTTPS."
                    : "Web push is off. It activates automatically once the portal is opened over HTTPS."}
                </span>
              </div>
            )}

            <PermissionGate module="portal_notifications" action="create">
              <div className="pt-3 border-t space-y-2">
                <Label className="text-sm font-semibold flex items-center gap-1.5">
                  <Bell className="w-4 h-4 text-rose-500" />
                  {ar ? "إرسال إشعار تجريبي" : "Send a test notification"}
                </Label>
                <p className="text-[11px] text-muted-foreground">
                  {ar
                    ? "اكتب رقم بروفايل موظف عنده البوابة متثبّتة ومشترك في الإشعارات."
                    : "Enter the profile ID of a resident who installed the portal and enabled notifications."}
                </p>
                <div className="flex gap-2">
                  <Input
                    value={testProfileId}
                    onChange={(e) => setTestProfileId(e.target.value)}
                    placeholder={ar ? "رقم البروفايل" : "Profile ID"}
                    inputMode="numeric"
                    className="max-w-[200px]"
                  />
                  <Button
                    onClick={sendTest}
                    disabled={sending}
                    className="gap-1.5"
                  >
                    <Send className="w-4 h-4" />
                    {sending
                      ? ar
                        ? "جارٍ الإرسال..."
                        : "Sending..."
                      : ar
                        ? "إرسال"
                        : "Send"}
                  </Button>
                </div>
              </div>
            </PermissionGate>
          </>
        )}
      </CardContent>
    </Card>
  );
}
