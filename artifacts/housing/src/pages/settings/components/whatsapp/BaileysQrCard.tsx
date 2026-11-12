// Direct phone link via QR (Baileys): status and pairing.
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Loader2,
  Clock,
  Info,
  Fingerprint,
  Timer,
  ShieldAlert,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import type { WhatsAppSettingsSectionState } from "./useWhatsAppSettingsSectionState";

export function renderBaileysQrCard(s: WhatsAppSettingsSectionState) {
  const {
    ar,
    connecting,
    status,
    phoneNumber,
    qrCode,
    pairingCode,
    pairingPhone,
    setPairingPhone,
    pairingTab,
    setPairingTab,
    requestingCode,
    handleConnect,
    handleRequestPairingCode,
    handleDisconnect,
    antiBanInfo,
  } = s;
  return (
    <Card className="border-border/60 shadow-sm">
      <CardHeader className="pb-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div
              className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
              style={{ backgroundColor: "#00a884" }}
            >
              <MessageSquare className="w-6 h-6" />
            </div>
            <div>
              <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                {ar
                  ? "ربط واتساب السكن المباشر (QR Code)"
                  : "Direct WhatsApp Phone Integration"}
                {status === "connected" ? (
                  <Badge className="bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30 gap-1.5">
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    {ar ? "متصل وجاهز" : "Connected"}
                  </Badge>
                ) : status === "pairing" ? (
                  <Badge className="bg-amber-500/15 text-amber-600 dark:text-amber-400 border-amber-500/30 gap-1.5 animate-pulse">
                    <QrCode className="w-3.5 h-3.5" />
                    {ar ? "بانتظار المسح (QR Code)" : "Pairing"}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="text-muted-foreground gap-1.5"
                  >
                    <XCircle className="w-3.5 h-3.5 text-rose-500" />
                    {ar ? "غير متصل" : "Disconnected"}
                  </Badge>
                )}
              </CardTitle>
              <CardDescription className="text-sm mt-0.5">
                {ar
                  ? "إرسال رسائل التسكين وتفاصيل الإقامة تلقائياً عبر محرك Baileys المباشر من هاتفك الشخصي أو هاتف السكن"
                  : "Send check-in confirmations directly via Baileys socket connected to your property phone"}
              </CardDescription>
            </div>
          </div>

          <PermissionGate module="whatsapp" action="edit">
            <div className="flex items-center gap-2 self-end sm:self-auto">
              {status === "connected" ? (
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleDisconnect}
                  className="gap-1.5"
                >
                  <XCircle className="w-4 h-4" />
                  {ar ? "قطع الاتصال" : "Disconnect"}
                </Button>
              ) : (
                <Button
                  size="sm"
                  onClick={() => handleConnect()}
                  disabled={connecting}
                  className="text-white gap-1.5 shadow-sm"
                  style={{ backgroundColor: "#00a884" }}
                >
                  {connecting ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <QrCode className="w-4 h-4" />
                  )}
                  {status === "pairing"
                    ? ar
                      ? "تحديث رمز QR"
                      : "Refresh QR"
                    : ar
                      ? "ربط رقم واتساب جديد"
                      : "Connect WhatsApp"}
                </Button>
              )}
            </div>
          </PermissionGate>
        </div>
      </CardHeader>
      {antiBanInfo && (
        <div className="px-6 -mt-2 pb-4 space-y-2">
          {antiBanInfo.banned && (
            <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-700 dark:text-red-300 flex items-start gap-2">
              <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
              {ar
                ? "واتساب رفض الاتصال بهذا الرقم (403) — غالباً تم حظره أو تقييده. توقف الإرسال وإعادة الاتصال التلقائي. افتح واتساب على الهاتف للتأكد، ثم أعد الربط أو استخدم رقماً آخر."
                : "WhatsApp refused this number (403): likely banned or restricted. Sending and auto-reconnect stopped. Check WhatsApp on the phone, then link again or use another number."}
            </div>
          )}
          {antiBanInfo.sendingPausedUntil && (
            <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
              {ar
                ? "الإرسال متوقف مؤقتاً لمدة ساعة لأن واتساب حدّ من الرقم؛ سيُستأنف تلقائياً."
                : "Sending is paused for an hour because WhatsApp throttled the number; it resumes automatically."}
            </div>
          )}
          {antiBanInfo.quota && (
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge variant="outline" className="gap-1">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                {ar
                  ? `آخر 24 ساعة: ${antiBanInfo.quota.sentLast24h}/${antiBanInfo.quota.dayLimit}`
                  : `Last 24h: ${antiBanInfo.quota.sentLast24h}/${antiBanInfo.quota.dayLimit}`}
              </Badge>
              <Badge variant="outline" className="gap-1">
                <Timer className="w-3.5 h-3.5" />
                {ar
                  ? `آخر ساعة: ${antiBanInfo.quota.sentLastHour}/${antiBanInfo.quota.hourLimit}`
                  : `Last hour: ${antiBanInfo.quota.sentLastHour}/${antiBanInfo.quota.hourLimit}`}
              </Badge>
              {antiBanInfo.quota.warmup && (
                <Badge
                  variant="outline"
                  className="gap-1 border-amber-400 text-amber-700"
                >
                  {ar
                    ? "رقم جديد: حدود أقل أول 14 يوم"
                    : "New number: lower limits for 14 days"}
                </Badge>
              )}
              {antiBanInfo.optOutCount > 0 && (
                <Badge variant="outline">
                  {ar
                    ? `${antiBanInfo.optOutCount} ألغوا الاشتراك`
                    : `${antiBanInfo.optOutCount} opted out`}
                </Badge>
              )}
            </div>
          )}
        </div>
      )}

      <CardContent className="pt-0 space-y-4">
        {/* Golden Anti-Ban Rules Banner */}
        <div className="p-3.5 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-950 dark:text-amber-200 text-xs space-y-2">
          <div className="flex items-center gap-1.5 font-bold text-amber-800 dark:text-amber-300">
            <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              {ar
                ? "نصائح ذهبية لتجنب الحظر المؤقت في وضع الربط المباشر:"
                : "Anti-Ban Golden Rules for Direct Phone Mode:"}
            </span>
          </div>
          <ul className="grid grid-cols-1 md:grid-cols-3 gap-2 list-disc list-inside leading-relaxed text-[11.5px] text-muted-foreground dark:text-amber-200/90">
            <li>
              <strong>
                {ar ? "استخدم WhatsApp Business:" : "Use WhatsApp Business:"}
              </strong>{" "}
              {ar
                ? "تطبيق الأعمال أكثر تحملاً وموثوقية لدى خوارزميات واتساب."
                : "Business accounts are given higher trust."}
            </li>
            <li>
              <strong>{ar ? "حفظ الرقم في الهاتف:" : "Save Contact:"}</strong>{" "}
              {ar
                ? "إذا حفظ الموظف رقم السكن يختفي زر الإبلاغ عن إزعاج نهائياً."
                : "Recipient saving the contact removes the Report Spam button."}
            </li>
            <li>
              <strong>{ar ? "حماية تلقائية نشطة:" : "Auto-Protection:"}</strong>{" "}
              {ar
                ? "النظام يضع فواصل عشوائية (10-18 ث) واستراحات تلقائية وحدوداً يومية آمنة."
                : "System applies random 10-18s gaps, breaks and safe daily limits."}
            </li>
          </ul>
        </div>

        {status === "connected" && (
          <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                <Smartphone className="w-5 h-5" />
              </div>
              <div>
                <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                  {ar
                    ? "رقم الواتساب المتصل حالياً:"
                    : "Connected Phone Number:"}
                </div>
                <div className="text-lg font-bold font-mono tracking-wide text-emerald-700 dark:text-emerald-300">
                  {phoneNumber || (ar ? "جاهز للإرسال" : "Ready to send")}
                </div>
              </div>
            </div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              <span>
                {ar
                  ? "حماية مكافحة الحظر مفعلة بالكامل"
                  : "Anti-ban protection active"}
              </span>
            </div>
          </div>
        )}

        {status === "pairing" && (
          <div className="p-6 bg-muted/40 rounded-2xl border border-border/80 space-y-6">
            {/* Pairing Method Switcher */}
            <div className="flex items-center justify-center gap-2 max-w-sm mx-auto p-1 bg-background/80 rounded-xl border shadow-2xs">
              <Button
                type="button"
                variant={pairingTab === "qr" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPairingTab("qr")}
                className={`flex-1 text-xs font-semibold gap-1.5 h-8 ${
                  pairingTab === "qr"
                    ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white shadow-xs"
                    : ""
                }`}
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>{ar ? "مسح رمز QR" : "Scan QR Code"}</span>
              </Button>
              <Button
                type="button"
                variant={pairingTab === "code" ? "default" : "ghost"}
                size="sm"
                onClick={() => setPairingTab("code")}
                className={`flex-1 text-xs font-semibold gap-1.5 h-8 ${
                  pairingTab === "code"
                    ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white shadow-xs"
                    : ""
                }`}
              >
                <Smartphone className="w-3.5 h-3.5" />
                <span>{ar ? "الربط برقم الهاتف" : "Pair with Phone #"}</span>
              </Button>
            </div>

            {pairingTab === "qr" ? (
              qrCode ? (
                <div className="flex flex-col md:flex-row items-center justify-center gap-8">
                  <div className="flex flex-col items-center bg-white p-4 rounded-2xl shadow-md border">
                    <img
                      src={qrCode}
                      alt="WhatsApp QR Code"
                      className="w-64 h-64 object-contain rounded-lg"
                    />
                    <div className="text-xs text-gray-500 mt-2 flex items-center gap-1 font-mono">
                      <RefreshCw className="w-3.5 h-3.5 animate-spin text-[#00a884]" />
                      <span>
                        {ar
                          ? "الرمز يتجدد تلقائياً كل 40 ثانية"
                          : "Auto-refreshes every 40s"}
                      </span>
                    </div>
                  </div>

                  <div className="max-w-md space-y-3 text-sm">
                    <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                      <Smartphone className="w-5 h-5 text-[#00a884]" />
                      {ar
                        ? "طريقة ربط الهاتف بالواتساب:"
                        : "How to connect your phone:"}
                    </h4>
                    <ol className="space-y-2 list-decimal list-inside text-muted-foreground leading-relaxed">
                      <li>
                        {ar
                          ? "افتح تطبيق WhatsApp على هاتف السكن."
                          : "Open WhatsApp on the property phone."}
                      </li>
                      <li>
                        {ar
                          ? "اضغط على القائمة (⋮) أو الإعدادات > الأجهزة المرتبطة (Linked Devices)."
                          : "Tap Menu (⋮) or Settings > Linked Devices."}
                      </li>
                      <li>
                        {ar
                          ? "اضغط على زر (ربط جهاز / Link a Device)."
                          : "Tap (Link a Device)."}
                      </li>
                      <li>
                        {ar
                          ? "وجّه كاميرا الهاتف نحو الرمز المربع الظاهر أمامك."
                          : "Point your phone camera to the QR Code on screen."}
                      </li>
                    </ol>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                      <div className="flex items-center gap-1.5 font-bold">
                        <Info className="w-3.5 h-3.5 shrink-0 text-amber-600" />
                        <span>
                          {ar
                            ? "إذا ظهرت لك رسالة (couldn't link):"
                            : "If you see 'couldn't link':"}
                        </span>
                      </div>
                      <p className="leading-relaxed">
                        {ar
                          ? "تأكد من فتح تطبيق واتساب محدث، أو استخدم خيار «الربط برقم الهاتف» أعلاه للحصول على كود مباشر وإدخاله بهاتفك فوراً."
                          : "Ensure WhatsApp is updated, or click 'Pair with Phone #' above to link with a direct pairing code."}
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center p-8 text-center space-y-3 animate-pulse">
                  <Loader2 className="w-10 h-10 text-[#00a884] animate-spin" />
                  <div className="text-sm font-bold text-foreground">
                    {ar
                      ? "جاري إنشاء وتجهيز رمز QR جديد..."
                      : "Generating a fresh QR Code..."}
                  </div>
                  <div className="text-xs text-muted-foreground max-w-sm">
                    {ar
                      ? "يتم الآن إنشاء جلسة ربط آمنة مع خوادم الواتساب، سيظهر رمز QR خلال لحظات..."
                      : "Establishing secure pairing session with WhatsApp servers, QR will appear in moments..."}
                  </div>
                </div>
              )
            ) : (
              /* Pairing Code Tab */
              <div className="max-w-md mx-auto space-y-4">
                <div className="p-4 rounded-xl bg-background border shadow-2xs space-y-3">
                  <Label className="text-xs font-bold text-foreground flex items-center gap-2">
                    <Smartphone className="w-4 h-4 text-[#00a884]" />
                    <span>
                      {ar
                        ? "أدخل رقم هاتف واتساب الخاص بالسكن:"
                        : "Enter Property WhatsApp Phone Number:"}
                    </span>
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      value={pairingPhone}
                      onChange={(e) => setPairingPhone(e.target.value)}
                      placeholder={
                        ar
                          ? "مثال: 01012345678 أو 201012345678"
                          : "e.g. 01012345678"
                      }
                      className="font-mono font-semibold"
                      dir="ltr"
                    />
                    <Button
                      type="button"
                      onClick={handleRequestPairingCode}
                      disabled={requestingCode || !pairingPhone.trim()}
                      className="bg-[#00a884] hover:bg-[#00a884]/90 text-white font-semibold shrink-0"
                    >
                      {requestingCode ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : ar ? (
                        "طلب كود الربط"
                      ) : (
                        "Get Code"
                      )}
                    </Button>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "سيتم إرسال طلب لخوادم الواتساب وتوليد كود من 8 خانات تدخله في هاتفك بدلاً من مسح الكاميرا."
                      : "Requests an 8-character code from WhatsApp servers to enter on your phone without using the camera."}
                  </p>
                </div>

                {pairingCode && (
                  <div className="p-5 rounded-2xl bg-background border-2 border-[#00a884]/30 shadow-md space-y-3 text-center animate-in fade-in">
                    <div className="text-xs text-muted-foreground font-semibold uppercase tracking-wider">
                      {ar
                        ? "كود الاقتران السريع الخاص بهاتفك:"
                        : "Your Direct WhatsApp Pairing Code:"}
                    </div>
                    <div className="text-3xl font-black font-mono tracking-widest text-[#00a884] py-3 bg-[#00a884]/5 rounded-xl border border-[#00a884]/20 select-all">
                      {pairingCode}
                    </div>
                    <div className="text-xs text-muted-foreground text-start rtl:text-right ltr:text-left space-y-1.5 p-3 rounded-lg bg-muted/40">
                      <div className="font-bold text-foreground mb-1">
                        {ar
                          ? "طريقة الإدخال بالهاتف:"
                          : "How to enter on phone:"}
                      </div>
                      <div>
                        1.{" "}
                        {ar
                          ? "افتح تطبيق WhatsApp على هاتفك."
                          : "Open WhatsApp on your phone."}
                      </div>
                      <div>
                        2.{" "}
                        {ar
                          ? "اضغط على: الأجهزة المرتبطة > ربط جهاز."
                          : "Tap: Linked Devices > Link a Device."}
                      </div>
                      <div>
                        3.{" "}
                        {ar
                          ? "اضغط في أسفل شاشة الهاتف على «الربط باستخدام رقم الهاتف بدلاً من ذلك»."
                          : "Tap 'Link with phone number instead' at the bottom."}
                      </div>
                      <div>
                        4.{" "}
                        {ar
                          ? "أدخل الكود الموضح أعلاه."
                          : "Enter the 8-character code shown above."}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        )}

        {/* Advanced Anti-Ban Protection Suite */}
        <div className="pt-2 space-y-2">
          <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
            <span className="font-bold text-foreground flex items-center gap-1.5">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {ar
                ? "منظومة الحماية الذكية المتقدمة ضد الحظر (Anti-Ban Engine)"
                : "Smart Anti-Ban Protection Suite"}
            </span>
            <Badge
              variant="outline"
              className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] py-0 px-2 font-mono"
            >
              {ar ? "نشط وتلقائي 100%" : "100% Automated & Active"}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <ShieldCheck className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-foreground">
                  {ar ? "فحص تسجيل الرقم" : "Pre-Validation"}
                </div>
                <div className="text-muted-foreground text-[11px] leading-relaxed">
                  {ar
                    ? "فحص مسبق مع سيرفرات واتساب لتجنب مراسلة أرقام ملغية"
                    : "Verified with WhatsApp servers before dispatch"}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Clock className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-foreground">
                  {ar ? "فواصل عشوائية (10-18 ث)" : "Random gaps (10-18s)"}
                </div>
                <div className="text-muted-foreground text-[11px] leading-relaxed">
                  {ar
                    ? "تأخير بشري متغير وكتابة Typing تحاكي السلوك البشري"
                    : "Simulates human typing & variable delay per msg"}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Timer className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-foreground">
                  {ar
                    ? "استراحة كل 8 رسائل + حد يومي آمن"
                    : "Break every 8 msgs + safe daily limit"}
                </div>
                <div className="text-muted-foreground text-[11px] leading-relaxed">
                  {ar
                    ? "توقف 70-110 ثانية كل 8 رسائل، و30 رسالة/ساعة و150/يوم (أقل للرقم الجديد)"
                    : "70-110s pause every 8 messages; 30/hour and 150/day (lower for a new number)"}
                </div>
              </div>
            </div>

            <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
              <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                <Fingerprint className="w-4 h-4" />
              </div>
              <div className="text-xs space-y-0.5">
                <div className="font-semibold text-foreground">
                  {ar
                    ? "إلغاء الاشتراك ومنع التكرار"
                    : "Opt-out & no duplicates"}
                </div>
                <div className="text-muted-foreground text-[11px] leading-relaxed">
                  {ar
                    ? "من يرد بـ 0 لا تصله رسائل جماعية، ولا تتكرر نفس الرسالة لنفس الرقم"
                    : "Replying 0 stops broadcasts; the same message never goes twice to a number"}
                </div>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
