import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
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
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import {
  Mail,
  Send,
  CheckCircle2,
  AlertTriangle,
  Eye,
  EyeOff,
  Server,
  Key,
  ShieldCheck,
  RefreshCw,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";

interface EmailSettingsSectionProps {
  propertyId: number | null;
  language: string;
}

export function EmailSettingsSection({
  propertyId,
  language,
}: EmailSettingsSectionProps) {
  const ar = language === "ar";
  const queryClient = useQueryClient();

  const [smtpHost, setSmtpHost] = useState("");
  const [smtpPort, setSmtpPort] = useState(587);
  const [smtpSecure, setSmtpSecure] = useState(false);
  const [smtpUser, setSmtpUser] = useState("");
  const [smtpPass, setSmtpPass] = useState("");
  const [smtpFrom, setSmtpFrom] = useState("");
  const [hasExistingPass, setHasExistingPass] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Test Email States
  const [testRecipient, setTestRecipient] = useState("");
  const [testResult, setTestResult] = useState<{
    success: boolean;
    message?: string;
    error?: string;
  } | null>(null);

  // Fetch current settings
  const { data: settings, isLoading } = useQuery({
    queryKey: ["/api/settings", propertyId],
    queryFn: async () => {
      if (!propertyId) return null;
      const res = await fetch(`/api/settings?propertyId=${propertyId}`);
      if (!res.ok) throw new Error("Failed to load settings");
      return res.json();
    },
    enabled: !!propertyId,
  });

  useEffect(() => {
    if (settings) {
      setSmtpHost(settings.smtpHost || "");
      setSmtpPort(Number(settings.smtpPort) || 587);
      setSmtpSecure(Boolean(settings.smtpSecure));
      setSmtpUser(settings.smtpUser || "");
      setSmtpPass(settings.smtpPass || "");
      setHasExistingPass(Boolean(settings.hasSmtpPass));
      setSmtpFrom(settings.smtpFrom || "");
    }
  }, [settings]);

  // Save Settings Mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!propertyId) throw new Error("No property selected");
      const res = await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort) || 587,
          smtpSecure,
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim(),
          smtpFrom: smtpFrom.trim(),
        }),
      });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || "Failed to save SMTP settings");
      }
      return res.json();
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/settings", propertyId] });
      setHasExistingPass(Boolean(data.hasSmtpPass));
      setSmtpPass(data.smtpPass || "");
      toast.success(
        ar
          ? "تم حفظ إعدادات البريد الإلكتروني بنجاح"
          : "Email & SMTP settings saved successfully",
      );
    },
    onError: (err: any) => {
      toast.error(err.message || (ar ? "فشل حفظ الإعدادات" : "Failed to save settings"));
    },
  });

  // Test Email Mutation
  const testEmailMutation = useMutation({
    mutationFn: async () => {
      if (!testRecipient || !testRecipient.includes("@")) {
        throw new Error(
          ar
            ? "يرجى كتابة بريد إلكتروني صحيح لاستقبال الرسالة التجريبية"
            : "Please enter a valid recipient email address",
        );
      }
      setTestResult(null);
      const res = await fetch("/api/settings/email/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId,
          toEmail: testRecipient.trim(),
          smtpHost: smtpHost.trim(),
          smtpPort: Number(smtpPort) || 587,
          smtpSecure,
          smtpUser: smtpUser.trim(),
          smtpPass: smtpPass.trim(),
          smtpFrom: smtpFrom.trim(),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Failed to send test email");
      }
      return data;
    },
    onSuccess: () => {
      setTestResult({
        success: true,
        message:
          ar
            ? "تم إرسال البريد التجريبي بنجاح! تحقق من صندوق الوارد (أو مجلد Spam)"
            : "Test email sent successfully! Please check your inbox or spam folder",
      });
      toast.success(ar ? "نجح اختبار إرسال البريد!" : "Test email sent successfully!");
    },
    onError: (err: any) => {
      setTestResult({
        success: false,
        error: err.message,
      });
      toast.error(err.message || (ar ? "فشل إرسال البريد التجريبي" : "Failed to send test email"));
    },
  });

  // Provider Presets
  const applyPreset = (provider: "gmail" | "office365" | "custom") => {
    if (provider === "gmail") {
      setSmtpHost("smtp.gmail.com");
      setSmtpPort(587);
      setSmtpSecure(false);
      if (!smtpFrom && smtpUser) {
        setSmtpFrom(`"Sunrise Staff Housing" <${smtpUser}>`);
      }
      toast.info(
        ar
          ? "تم تطبيق إعدادات Gmail (استخدم كلمة مرور التطبيق App Password)"
          : "Applied Gmail presets (remember to use an App Password)",
      );
    } else if (provider === "office365") {
      setSmtpHost("smtp.office365.com");
      setSmtpPort(587);
      setSmtpSecure(false);
      if (!smtpFrom && smtpUser) {
        setSmtpFrom(`"Sunrise Staff Housing" <${smtpUser}>`);
      }
      toast.info(
        ar
          ? "تم تطبيق إعدادات Microsoft 365 / Exchange"
          : "Applied Microsoft 365 / Exchange presets",
      );
    } else {
      setSmtpHost("");
      setSmtpPort(587);
      setSmtpSecure(false);
    }
  };

  if (isLoading) {
    return (
      <div className="p-8 flex items-center justify-center gap-2 text-muted-foreground">
        <RefreshCw className="w-5 h-5 animate-spin" />
        <span>{ar ? "جاري تحميل إعدادات البريد..." : "Loading email settings..."}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Top Description & Presets Card */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300 flex items-center justify-center flex-shrink-0">
                <Mail className="w-5 h-5" />
              </div>
              <div>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  {ar ? "إعدادات البريد الإلكتروني (SMTP)" : "Email & SMTP Server Settings"}
                  <Badge variant="outline" className="text-[11px] font-normal">
                    {hasExistingPass
                      ? ar
                        ? "✅ تم التكوين"
                        : "Configured"
                      : ar
                        ? "⚠️ غير مكتمل"
                        : "Not configured"}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs mt-1">
                  {ar
                    ? "تكوين سيرفر الـ SMTP لإرسال رموز التحقق (OTP) لاستعادة كلمة المرور وإشعارات النظام"
                    : "Configure SMTP mail gateway to deliver password reset OTPs and system notifications"}
                </CardDescription>
              </div>
            </div>

            {/* Quick Provider Presets */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-xs text-muted-foreground font-medium ml-1">
                {ar ? "إعدادات سريعة:" : "Presets:"}
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 hover:bg-red-50 hover:text-red-600 hover:border-red-200 dark:hover:bg-red-950/30 transition-colors"
                onClick={() => applyPreset("gmail")}
              >
                <span className="font-bold text-red-500">G</span> Google / Gmail
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-8 text-xs gap-1.5 hover:bg-blue-50 hover:text-blue-600 hover:border-blue-200 dark:hover:bg-blue-950/30 transition-colors"
                onClick={() => applyPreset("office365")}
              >
                <span className="font-bold text-blue-500">M</span> Microsoft 365
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="h-8 text-xs"
                onClick={() => applyPreset("custom")}
              >
                {ar ? "مخصص" : "Custom"}
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6 pt-2">
          {/* Main Credentials Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {/* Host */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Server className="w-3.5 h-3.5 text-muted-foreground" />
                {ar ? "سيرفر البريد (SMTP Host)" : "SMTP Host Server"}
              </Label>
              <Input
                placeholder="smtp.gmail.com"
                value={smtpHost}
                onChange={(e) => setSmtpHost(e.target.value)}
                className="font-mono text-xs"
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">
                {ar ? "مثال: smtp.gmail.com أو mail.sunrise-resorts.com" : "e.g. smtp.gmail.com or mail.sunrise-resorts.com"}
              </p>
            </div>

            {/* Port */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                {ar ? "رقم المنفذ (Port)" : "Port"}
              </Label>
              <div className="flex items-center gap-2">
                <Input
                  type="number"
                  placeholder="587"
                  value={smtpPort}
                  onChange={(e) => setSmtpPort(Number(e.target.value) || 587)}
                  className="font-mono text-xs w-28"
                  dir="ltr"
                />
                <div className="flex items-center gap-1 text-[11px] text-muted-foreground">
                  <span className="cursor-pointer underline" onClick={() => setSmtpPort(587)}>
                    587 (TLS)
                  </span>
                  <span>/</span>
                  <span className="cursor-pointer underline" onClick={() => { setSmtpPort(465); setSmtpSecure(true); }}>
                    465 (SSL)
                  </span>
                </div>
              </div>
            </div>

            {/* Secure (SSL/TLS) Toggle */}
            <div className="space-y-2 flex flex-col justify-between">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                {ar ? "التشفير الآمن (SSL/TLS)" : "SSL/TLS Encryption"}
              </Label>
              <div className="flex items-center justify-between p-2.5 rounded-lg border bg-muted/30">
                <span className="text-xs font-medium">
                  {smtpSecure
                    ? (ar ? "مفعل (Port 465 SSL)" : "Enabled (SSL)")
                    : (ar ? "STARTTLS (Port 587)" : "STARTTLS (TLS)")}
                </span>
                <Switch
                  checked={smtpSecure}
                  onCheckedChange={setSmtpSecure}
                />
              </div>
            </div>

            {/* Username / Email */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                {ar ? "اسم المستخدم / بريد الإرسال" : "Username / Sender Email"}
              </Label>
              <Input
                type="text"
                placeholder="noreply@sunrise-resorts.com"
                value={smtpUser}
                onChange={(e) => setSmtpUser(e.target.value)}
                className="text-xs"
                dir="ltr"
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Key className="w-3.5 h-3.5 text-muted-foreground" />
                  {ar ? "كلمة المرور (App Password)" : "Password / App Password"}
                </span>
                {hasExistingPass && (
                  <span className="text-[10px] text-emerald-600 font-normal">
                    {ar ? "✓ مسجلة سابقاً" : "✓ Saved"}
                  </span>
                )}
              </Label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  placeholder={hasExistingPass ? "•••••••• (غير معدلة)" : "Password"}
                  value={smtpPass}
                  onChange={(e) => setSmtpPass(e.target.value)}
                  className="text-xs pr-9 pl-9"
                  dir="ltr"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Info className="w-3 h-3 text-amber-500 shrink-0" />
                {ar
                  ? "لحسابات Gmail يلزم استخدام App Password من إعدادات أمان Google"
                  : "For Gmail, use a 16-character App Password generated from Google Account"}
              </p>
            </div>

            {/* From Address / Display Name */}
            <div className="space-y-2">
              <Label className="text-xs font-semibold">
                {ar ? "عنوان واسم المرسل (From Header)" : "Sender Display Name & Address"}
              </Label>
              <Input
                type="text"
                placeholder='"Sunrise Staff Housing" <noreply@sunrise-resorts.com>'
                value={smtpFrom}
                onChange={(e) => setSmtpFrom(e.target.value)}
                className="text-xs"
                dir="ltr"
              />
              <p className="text-[11px] text-muted-foreground">
                {ar ? "الاسم الذي يظهر للموظف عند استلام الإيميل" : "The display name and sender email shown in recipient inbox"}
              </p>
            </div>
          </div>

          {/* Action Footer */}
          <div className="flex justify-end pt-2 border-t">
            <PermissionGate module="settings" action="edit">
              <Button
                type="button"
                onClick={() => saveMutation.mutate()}
                disabled={saveMutation.isPending}
                className="gap-2"
              >
                {saveMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span>{ar ? "جاري الحفظ..." : "Saving..."}</span>
                  </>
                ) : (
                  <>
                    <ShieldCheck className="w-4 h-4" />
                    <span>{ar ? "حفظ إعدادات البريد" : "Save Email Settings"}</span>
                  </>
                )}
              </Button>
            </PermissionGate>
          </div>
        </CardContent>
      </Card>

      {/* Live Test Email Section */}
      <Card className="border-slate-200 dark:border-slate-800 shadow-sm bg-gradient-to-br from-slate-50/50 to-white dark:from-slate-900/40 dark:to-slate-900/10">
        <CardHeader className="pb-3">
          <CardTitle className="text-base font-bold flex items-center gap-2">
            <Send className="w-4 h-4 text-primary" />
            {ar ? "اختبار الإرسال المباشر (Send Test Email)" : "Live SMTP Test Verification"}
          </CardTitle>
          <CardDescription className="text-xs">
            {ar
              ? "أدخل بريدك الإلكتروني الشخصي للتحقق من أن النظام قادر على إرسال رسائل الـ OTP بنجاح دون أي مشاكل"
              : "Enter your email to test connectivity and verify that OTP emails can be delivered"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-col sm:flex-row items-center gap-3">
            <div className="relative flex-1 w-full">
              <Input
                type="email"
                placeholder={ar ? "أدخل بريدك الإلكتروني (مثل name@domain.com)" : "Enter recipient email (e.g. name@domain.com)"}
                value={testRecipient}
                onChange={(e) => setTestRecipient(e.target.value)}
                className="text-xs"
                dir="ltr"
              />
            </div>
            <PermissionGate module="settings" action="edit">
              <Button
                type="button"
                variant="secondary"
                onClick={() => testEmailMutation.mutate()}
                disabled={testEmailMutation.isPending || !testRecipient}
                className="w-full sm:w-auto gap-2 flex-shrink-0"
              >
                {testEmailMutation.isPending ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-primary" />
                    <span>{ar ? "جاري الفحص والإرسال..." : "Testing Connection..."}</span>
                  </>
                ) : (
                  <>
                    <Send className="w-4 h-4 text-primary" />
                    <span>{ar ? "إرسال بريد تجريبي الآن" : "Send Test Email Now"}</span>
                  </>
                )}
              </Button>
            </PermissionGate>
          </div>

          {/* Test Result Display */}
          {testResult && (
            <div
              className={`p-3.5 rounded-lg border text-xs flex items-start gap-2.5 transition-all ${
                testResult.success
                  ? "bg-emerald-50 border-emerald-200 text-emerald-800 dark:bg-emerald-950/40 dark:border-emerald-800 dark:text-emerald-200"
                  : "bg-red-50 border-red-200 text-red-800 dark:bg-red-950/40 dark:border-red-800 dark:text-red-200"
              }`}
            >
              {testResult.success ? (
                <CheckCircle2 className="w-4 h-4 text-emerald-600 mt-0.5 shrink-0" />
              ) : (
                <AlertTriangle className="w-4 h-4 text-red-600 mt-0.5 shrink-0" />
              )}
              <div className="space-y-1">
                <p className="font-semibold">
                  {testResult.success
                    ? (ar ? "نجح الاتصال والإرسال بنجاح!" : "Connection and Email Delivery Succeeded!")
                    : (ar ? "فشل الاتصال بسيرفر البريد" : "SMTP Connection Failed")}
                </p>
                <p className="text-[11px] opacity-90">
                  {testResult.success ? testResult.message : testResult.error}
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
