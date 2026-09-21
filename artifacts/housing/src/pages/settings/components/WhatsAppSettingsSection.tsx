import { useEffect, useState, useRef } from "react";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Label } from "@/components/ui/label";
import {
  MessageSquare,
  QrCode,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Send,
  ShieldCheck,
  Smartphone,
  Copy,
  Sparkles,
  PhoneCall,
  RotateCcw,
  Loader2,
  CheckCheck,
  Globe,
  Radio,
  BookmarkCheck,
  Clock,
  Layers,
  Info,
  Fingerprint,
  Timer,
} from "lucide-react";
import { toast } from "sonner";
import { BroadcastWhatsAppDialog } from "@/components/BroadcastWhatsAppDialog";

interface WhatsAppSettingsSectionProps {
  propertyId: number | null;
  language: string;
}

const DEFAULT_TEMPLATE_AR = `مرحباً بك أ/ {employee_name} في {property_name} 🌴✨

يسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:
🏢 المبنى: {building_name} ({floor_name})
🚪 رقم الغرفة: {room_number}
🛏️ السرير: {bed_label}
📅 تاريخ التسكين: {checkin_date}

🌐 رابط بوابة المقيمين:
{portal_url}

🔑 بيانات وطريقة تسجيل الدخول:
• اسم المستخدم: {profile_id} (رقمك الوظيفي)
• كلمة المرور الافتراضية: 1234
*(يرجى استخدام كلمة المرور الشخصية إذا قمت بتعيينها مسبقاً، أو سيطلب منك النظام تعيين كلمة مرور جديدة فور أول تسجيل دخول)*

📲 من خلال البوابة يمكنك:
• تسجيل ومتابعة بلاغات الصيانة والأعطال
• طلب خدمات النظافة والهاوس كيبنج
• التقديم على تصاريح استضافة الأقارب والزيارات
• المحادثة المباشرة مع مشرفي إدارة السكن

نتمنى لك إقامة هانئة ومريحة! ✨`;

const DEFAULT_TEMPLATE_EN = `Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨

Your accommodation has been successfully confirmed:
🏢 Building: {building_name} ({floor_name})
🚪 Room: {room_number}
🛏️ Bed: {bed_label}
📅 Check-in Date: {checkin_date}

🌐 Resident Portal Link:
{portal_url}

🔑 Portal Login Instructions:
• Username: {profile_id} (Your Employee ID)
• Default Password: 1234
*(Please use your personal password if already set, or you will be prompted to set a new password upon your first sign-in)*

📲 Through the portal you can:
• Submit and track maintenance tickets
• Request housekeeping & room cleaning
• Apply for guest and visitor hosting permits
• Chat directly with Housing Supervisors

We wish you a pleasant and comfortable stay! ✨`;

const DEFAULT_RES_TEMPLATE_AR = `مرحباً بك أ/ {guest_name} في {property_name} 🌴✨

يسعدنا تأكيد حجز إقامتك المسبق لدينا:
🔖 رقم الحجز: #{reservation_id}
🏢 المبنى / الغرفة: {room_info}
🛏️ تفاصيل السرير: {bed_info}
📅 تاريخ الوصول المتوقع: {checkin_date}
📅 تاريخ المغادرة المتوقع: {checkout_date}

🌐 رابط بوابة المقيمين:
{portal_url}

ℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.

نتمنى لك رحلة موفقة وإقامة سعيدة! ✨`;

const DEFAULT_RES_TEMPLATE_EN = `Welcome Mr/Ms {guest_name} to {property_name}! 🌴✨

We are pleased to confirm your upcoming reservation:
🔖 Booking Ref: #{reservation_id}
🏢 Building / Room: {room_info}
🛏️ Bed Info: {bed_info}
📅 Expected Check-in: {checkin_date}
📅 Expected Check-out: {checkout_date}

🌐 Resident Portal Link:
{portal_url}

ℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.

We wish you a safe trip and a pleasant stay! ✨`;

const VARIABLE_TAGS = [
  { tag: "{employee_name}", labelAr: "اسم الموظف", labelEn: "Employee Name" },
  { tag: "{profile_id}", labelAr: "الرقم الوظيفي / كود الموظف", labelEn: "Employee / Profile ID" },
  { tag: "{property_name}", labelAr: "اسم السكن/الفندق", labelEn: "Property Name" },
  { tag: "{building_name}", labelAr: "اسم المبنى", labelEn: "Building" },
  { tag: "{floor_name}", labelAr: "الدور/الطابق", labelEn: "Floor" },
  { tag: "{room_number}", labelAr: "رقم الغرفة", labelEn: "Room No." },
  { tag: "{bed_label}", labelAr: "السرير", labelEn: "Bed" },
  { tag: "{checkin_date}", labelAr: "تاريخ التسكين", labelEn: "Check-in Date" },
  { tag: "{portal_url}", labelAr: "رابط البوابة", labelEn: "Portal Link" },
  { tag: "{supervisor_contact}", labelAr: "هاتف المشرف", labelEn: "Supervisor Phone" },
];

const RESERVATION_TAGS = [
  { tag: "{guest_name}", labelAr: "اسم النزيل", labelEn: "Guest Name" },
  { tag: "{property_name}", labelAr: "اسم السكن/الفندق", labelEn: "Property Name" },
  { tag: "{reservation_id}", labelAr: "رقم الحجز", labelEn: "Booking Ref" },
  { tag: "{room_info}", labelAr: "المبنى والغرفة", labelEn: "Building & Room" },
  { tag: "{bed_info}", labelAr: "السرير", labelEn: "Bed" },
  { tag: "{checkin_date}", labelAr: "تاريخ الوصول", labelEn: "Check-in Date" },
  { tag: "{checkout_date}", labelAr: "تاريخ المغادرة", labelEn: "Check-out Date" },
  { tag: "{portal_url}", labelAr: "رابط البوابة", labelEn: "Portal Link" },
  { tag: "{supervisor_contact}", labelAr: "هاتف المشرف", labelEn: "Supervisor Phone" },
];

export function WhatsAppSettingsSection({
  propertyId,
  language,
}: WhatsAppSettingsSectionProps) {
  const ar = language === "ar";
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Status & Connection
  const [status, setStatus] = useState<"disconnected" | "pairing" | "connected">("disconnected");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState<string>("");
  const [pairingTab, setPairingTab] = useState<"qr" | "code">("qr");
  const [requestingCode, setRequestingCode] = useState<boolean>(false);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  const [processingQueue, setProcessingQueue] = useState<boolean>(false);

  // Config Form
  const [isAutoSendEnabled, setIsAutoSendEnabled] = useState(true);
  const [isReservationSendEnabled, setIsReservationSendEnabled] = useState(true);
  const [welcomeTemplateAr, setWelcomeTemplateAr] = useState(DEFAULT_TEMPLATE_AR);
  const [welcomeTemplateEn, setWelcomeTemplateEn] = useState(DEFAULT_TEMPLATE_EN);
  const [reservationTemplateAr, setReservationTemplateAr] = useState(DEFAULT_RES_TEMPLATE_AR);
  const [reservationTemplateEn, setReservationTemplateEn] = useState(DEFAULT_RES_TEMPLATE_EN);
  const [supervisorContact, setSupervisorContact] = useState("");
  const [templateCategory, setTemplateCategory] = useState<"checkin" | "reservation">("checkin");
  const [activeTemplateTab, setActiveTemplateTab] = useState<"ar" | "en">("ar");
  const [broadcastOpen, setBroadcastOpen] = useState(false);

  // Test Message
  const [testPhone, setTestPhone] = useState("");

  // Logs
  const [logs, setLogs] = useState<any[]>([]);

  const textareaArRef = useRef<HTMLTextAreaElement>(null);
  const textareaEnRef = useRef<HTMLTextAreaElement>(null);

  // Fetch status & config
  const fetchStatusAndConfig = async () => {
    if (!propertyId) return;
    try {
      const [statusRes, configRes, logsRes] = await Promise.all([
        fetch(`/api/whatsapp/status?propertyId=${propertyId}`, { credentials: "include" }),
        fetch(`/api/whatsapp/config?propertyId=${propertyId}`, { credentials: "include" }),
        fetch(`/api/whatsapp/logs?propertyId=${propertyId}&limit=5`, { credentials: "include" }),
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        setStatus(sData.status || "disconnected");
        setPhoneNumber(sData.phoneNumber || null);
        setQrCode(sData.qrCode || null);
        if (sData.pairingCode !== undefined) {
          setPairingCode(sData.pairingCode || null);
        }
        if (sData.pendingQueueCount !== undefined) {
          setPendingQueueCount(sData.pendingQueueCount);
        }
        if (sData.isAutoSendEnabled !== undefined) {
          setIsAutoSendEnabled(sData.isAutoSendEnabled);
        }
      }

      if (configRes.ok) {
        const cData = await configRes.json();
        if (cData.config) {
          setIsAutoSendEnabled(cData.config.isAutoSendEnabled ?? true);
          setIsReservationSendEnabled(cData.config.isReservationSendEnabled ?? true);
          const rawWelcomeAr = cData.config.welcomeTemplateAr || "";
          setWelcomeTemplateAr(
            rawWelcomeAr && !rawWelcomeAr.includes("???") ? rawWelcomeAr : DEFAULT_TEMPLATE_AR
          );
          setWelcomeTemplateEn(cData.config.welcomeTemplateEn || DEFAULT_TEMPLATE_EN);

          const rawResAr = cData.config.reservationTemplateAr || "";
          setReservationTemplateAr(
            rawResAr && !rawResAr.includes("???") ? rawResAr : DEFAULT_RES_TEMPLATE_AR
          );
          setReservationTemplateEn(cData.config.reservationTemplateEn || DEFAULT_RES_TEMPLATE_EN);
          setSupervisorContact(cData.config.supervisorContact || "");
        }
      }

      if (logsRes.ok) {
        const lData = await logsRes.json();
        setLogs(lData.logs || []);
      }
    } catch (e) {
      console.error("Error fetching WhatsApp config:", e);
    } finally {
      setLoading(false);
    }
  };

  // Manual Outbox Queue Flush
  const handleProcessQueue = async () => {
    if (!propertyId) return;
    setProcessingQueue(true);
    try {
      const res = await fetch(`/api/whatsapp/queue/process?propertyId=${propertyId}`, {
        method: "POST",
        credentials: "include",
      });
      const data = await res.json();
      if (data.success) {
        toast.success(
          ar
            ? `تمت معالجة الطابور بنجاح: تم إرسال ${data.processed || 0} رسالة، المتبقي: ${data.pendingRemaining ?? 0}`
            : `Queue processed: ${data.processed || 0} sent, ${data.pendingRemaining ?? 0} pending`
        );
        fetchStatusAndConfig();
      } else {
        toast.error(data.error || (ar ? "فشل معالجة الطابور" : "Failed to process queue"));
      }
    } catch {
      toast.error(ar ? "خطأ في الاتصال بالخادم" : "Server error");
    } finally {
      setProcessingQueue(false);
    }
  };

  useEffect(() => {
    fetchStatusAndConfig();
    const interval = setInterval(() => {
      // Poll if pairing to catch the connection
      if (status === "pairing") {
        fetchStatusAndConfig();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [propertyId, status]);

  // Connect / Request QR or Pairing Code
  const handleConnect = async (phoneForCode?: string) => {
    if (!propertyId) return;
    setConnecting(true);
    try {
      const safePhone = typeof phoneForCode === "string" && phoneForCode.trim().length > 0 ? phoneForCode.trim() : undefined;
      const res = await fetch(`/api/whatsapp/connect?propertyId=${propertyId}`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          phoneNumber: safePhone,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
        setQrCode(data.qrCode);
        setPairingCode(data.pairingCode || null);
        setPhoneNumber(data.phoneNumber);
        toast.success(
          data.pairingCode
            ? (ar ? "تم إنشاء كود الاقتران بنجاح، أدخله في هاتفك" : "Pairing code generated, enter it on your phone")
            : (ar ? "تم توليد رمز QR بنجاح، قم بمسحه من هاتفك" : "QR Code generated, scan with your phone")
        );
      } else {
        toast.error(data.error || (ar ? "فشل بدء الاتصال" : "Connection failed"));
      }
    } catch {
      toast.error(ar ? "خطأ في الاتصال بالخادم" : "Server communication error");
    } finally {
      setConnecting(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!pairingPhone.trim()) {
      toast.error(ar ? "يرجى إدخال رقم هاتف الواتساب" : "Please enter WhatsApp phone number");
      return;
    }
    setRequestingCode(true);
    try {
      await handleConnect(pairingPhone.trim());
    } finally {
      setRequestingCode(false);
    }
  };

  // Disconnect
  const handleDisconnect = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/whatsapp/disconnect?propertyId=${propertyId}`, {
        method: "POST",
        credentials: "include",
      });
      if (res.ok) {
        setStatus("disconnected");
        setQrCode(null);
        setPhoneNumber(null);
        toast.info(ar ? "تم قطع اتصال الواتساب" : "WhatsApp disconnected");
      }
    } catch {
      toast.error(ar ? "فشل قطع الاتصال" : "Failed to disconnect");
    }
  };

  // Save config
  const handleSaveConfig = async () => {
    if (!propertyId) return;
    setSaving(true);
    try {
      const res = await fetch(`/api/whatsapp/config?propertyId=${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          isAutoSendEnabled,
          isReservationSendEnabled,
          welcomeTemplateAr,
          welcomeTemplateEn,
          reservationTemplateAr,
          reservationTemplateEn,
          supervisorContact,
        }),
      });
      if (res.ok) {
        toast.success(
          ar
            ? "تم حفظ إعدادات وقوالب الواتساب بنجاح"
            : "WhatsApp templates & settings saved successfully"
        );
      } else {
        toast.error(ar ? "فشل حفظ الإعدادات" : "Failed to save settings");
      }
    } catch {
      toast.error(ar ? "خطأ في الاتصال بالخادم" : "Server error");
    } finally {
      setSaving(false);
    }
  };

  // Send Test Message
  const handleSendTest = async () => {
    if (!propertyId || !testPhone.trim()) {
      toast.error(ar ? "يرجى كتابة رقم الهاتف للتجربة" : "Please enter a phone number");
      return;
    }
    setTesting(true);
    try {
      const res = await fetch(`/api/whatsapp/test?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          phone: testPhone.trim(),
          language: activeTemplateTab,
        }),
      });
      const d = await res.json();
      if (d.success) {
        toast.success(
          ar
            ? `تم إرسال الرسالة التجريبية بنجاح إلى ${testPhone}`
            : `Test message sent successfully to ${testPhone}`
        );
        fetchStatusAndConfig();
      } else {
        toast.error(d.error || (ar ? "فشل إرسال الرسالة التجريبية" : "Test message failed"));
      }
    } catch {
      toast.error(ar ? "فشل الاتصال بالخادم" : "Server error");
    } finally {
      setTesting(false);
    }
  };

  // Insert tag into active textarea
  const handleInsertTag = (tag: string) => {
    const isAr = activeTemplateTab === "ar";
    const ref = isAr ? textareaArRef.current : textareaEnRef.current;
    if (!ref) return;

    const start = ref.selectionStart;
    const end = ref.selectionEnd;

    if (templateCategory === "checkin") {
      const text = isAr ? welcomeTemplateAr : welcomeTemplateEn;
      const newText = text.substring(0, start) + tag + text.substring(end);
      if (isAr) setWelcomeTemplateAr(newText);
      else setWelcomeTemplateEn(newText);
    } else {
      const text = isAr ? reservationTemplateAr : reservationTemplateEn;
      const newText = text.substring(0, start) + tag + text.substring(end);
      if (isAr) setReservationTemplateAr(newText);
      else setReservationTemplateEn(newText);
    }

    setTimeout(() => {
      ref.focus();
      ref.setSelectionRange(start + tag.length, start + tag.length);
    }, 50);
  };

  // Compile preview with realistic mock data
  const currentTemplate =
    templateCategory === "checkin"
      ? activeTemplateTab === "ar"
        ? welcomeTemplateAr
        : welcomeTemplateEn
      : activeTemplateTab === "ar"
      ? reservationTemplateAr
      : reservationTemplateEn;

  const mockVars =
    templateCategory === "checkin"
      ? {
          employee_name: activeTemplateTab === "ar" ? "أحمد مصطفى كامل" : "Ahmed Mostafa Kamel",
          profile_id: "10575",
          employee_id: "10575",
          property_name: activeTemplateTab === "ar" ? "سكن منتجع صن رايز" : "Sunrise Resort Housing",
          building_name: activeTemplateTab === "ar" ? "المبنى ب (Building B)" : "Building B",
          floor_name: activeTemplateTab === "ar" ? "الدور الثاني" : "2nd Floor",
          room_number: "204",
          bed_label: activeTemplateTab === "ar" ? "سرير A (يمين النافذة)" : "Bed A (Right Window)",
          checkin_date: new Date().toLocaleDateString(activeTemplateTab === "ar" ? "ar-EG" : "en-US"),
          portal_url: "https://resident.sunrise-resorts.com/portal/",
          supervisor_contact: supervisorContact || "+201012345678",
        }
      : {
          guest_name: activeTemplateTab === "ar" ? "محمود عبد العزيز" : "Mahmoud Abdelaziz",
          property_name: activeTemplateTab === "ar" ? "سكن منتجع صن رايز" : "Sunrise Resort Housing",
          reservation_id: "8421",
          room_info: activeTemplateTab === "ar" ? "مبنى الفيروز - الغرفة 302" : "Al Fayrouz - Room 302",
          bed_info: activeTemplateTab === "ar" ? "سرير B (مفرد)" : "Bed B (Single)",
          checkin_date: "2026/09/20",
          checkout_date: "2026/09/30",
          portal_url: "https://resident.sunrise-resorts.com/portal/",
          supervisor_contact: supervisorContact || "+201012345678",
        };

  let previewText = currentTemplate;
  for (const [k, v] of Object.entries(mockVars)) {
    previewText = previewText.replace(new RegExp(`{${k}}`, "g"), v);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center p-12 text-muted-foreground">
        <Loader2 className="w-8 h-8 animate-spin mr-2" />
        <span>{ar ? "جاري تحميل إعدادات الواتساب..." : "Loading WhatsApp settings..."}</span>
      </div>
    );
  }

  return (
    <div className="space-y-6 w-full">
      {/* ── CARD 1: CONNECTION STATUS & QR CODE ── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div
                className="w-12 h-12 rounded-xl flex items-center justify-center text-white shadow-sm"
                style={{ backgroundColor: "#25d366" }}
              >
                <MessageSquare className="w-6 h-6" />
              </div>
              <div>
                <CardTitle className="text-lg sm:text-xl font-bold flex items-center gap-2">
                  {ar ? "ربط واتساب السكن المباشر" : "Direct WhatsApp Integration"}
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
                    <Badge variant="outline" className="text-muted-foreground gap-1.5">
                      <XCircle className="w-3.5 h-3.5 text-rose-500" />
                      {ar ? "غير متصل" : "Disconnected"}
                    </Badge>
                  )}
                </CardTitle>
                <CardDescription className="text-sm mt-0.5">
                  {ar
                    ? "إرسال رسائل التسكين وتفاصيل الإقامة تلقائياً بدون أي تكلفة أو وسيط عبر محرك Baileys المباشر"
                    : "Send check-in confirmations and housing details automatically at zero cost via Baileys"}
                </CardDescription>
              </div>
            </div>

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
          </div>
        </CardHeader>

        <CardContent className="pt-0 space-y-4">
          {status === "connected" && (
            <div className="p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold">
                  <Smartphone className="w-5 h-5" />
                </div>
                <div>
                  <div className="text-sm font-semibold text-emerald-800 dark:text-emerald-200">
                    {ar ? "رقم الواتساب المتصل حالياً:" : "Connected Phone Number:"}
                  </div>
                  <div className="text-lg font-bold font-mono tracking-wide text-emerald-700 dark:text-emerald-300">
                    {phoneNumber || ar ? "جاهز للإرسال" : "Ready to send"}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-emerald-600" />
                <span>{ar ? "حماية مكافحة الحظر مفعلة بالكامل" : "Anti-ban protection active"}</span>
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
                    pairingTab === "qr" ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white shadow-xs" : ""
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
                    pairingTab === "code" ? "bg-[#00a884] hover:bg-[#00a884]/90 text-white shadow-xs" : ""
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
                        <span>{ar ? "الرمز يتجدد تلقائياً كل 40 ثانية" : "Auto-refreshes every 40s"}</span>
                      </div>
                    </div>

                    <div className="max-w-md space-y-3 text-sm">
                      <h4 className="font-bold text-base text-foreground flex items-center gap-2">
                        <Smartphone className="w-5 h-5 text-[#00a884]" />
                        {ar ? "طريقة ربط الهاتف بالواتساب:" : "How to connect your phone:"}
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
                          <span>{ar ? "إذا ظهرت لك رسالة (couldn't link):" : "If you see 'couldn't link':"}</span>
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
                      {ar ? "جاري إنشاء وتجهيز رمز QR جديد..." : "Generating a fresh QR Code..."}
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
                      <span>{ar ? "أدخل رقم هاتف واتساب الخاص بالسكن:" : "Enter Property WhatsApp Phone Number:"}</span>
                    </Label>
                    <div className="flex gap-2">
                      <Input
                        value={pairingPhone}
                        onChange={(e) => setPairingPhone(e.target.value)}
                        placeholder={ar ? "مثال: 01012345678 أو 201012345678" : "e.g. 01012345678"}
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
                        ) : (
                          ar ? "طلب كود الربط" : "Get Code"
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
                        {ar ? "كود الاقتران السريع الخاص بهاتفك:" : "Your Direct WhatsApp Pairing Code:"}
                      </div>
                      <div className="text-3xl font-black font-mono tracking-widest text-[#00a884] py-3 bg-[#00a884]/5 rounded-xl border border-[#00a884]/20 select-all">
                        {pairingCode}
                      </div>
                      <div className="text-xs text-muted-foreground text-start rtl:text-right ltr:text-left space-y-1.5 p-3 rounded-lg bg-muted/40">
                        <div className="font-bold text-foreground mb-1">
                          {ar ? "طريقة الإدخال بالهاتف:" : "How to enter on phone:"}
                        </div>
                        <div>1. {ar ? "افتح تطبيق WhatsApp على هاتفك." : "Open WhatsApp on your phone."}</div>
                        <div>2. {ar ? "اضغط على: الأجهزة المرتبطة > ربط جهاز." : "Tap: Linked Devices > Link a Device."}</div>
                        <div>3. {ar ? "اضغط في أسفل شاشة الهاتف على «الربط باستخدام رقم الهاتف بدلاً من ذلك»." : "Tap 'Link with phone number instead' at the bottom."}</div>
                        <div>4. {ar ? "أدخل الكود الموضح أعلاه." : "Enter the 8-character code shown above."}</div>
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
                {ar ? "منظومة الحماية الذكية المتقدمة ضد الحظر (Anti-Ban Engine)" : "Smart Anti-Ban Protection Suite"}
              </span>
              <Badge variant="outline" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/30 text-[10px] py-0 px-2 font-mono">
                {ar ? "نشط وتلقائي 100%" : "100% Automated & Active"}
              </Badge>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
              <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 text-blue-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <ShieldCheck className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-foreground">{ar ? "فحص تسجيل الرقم" : "Pre-Validation"}</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    {ar ? "فحص مسبق مع سيرفرات واتساب لتجنب مراسلة أرقام ملغية" : "Verified with WhatsApp servers before dispatch"}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Clock className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-foreground">{ar ? "فواصل عشوائية (5-9s)" : "Random Jitter (5-9s)"}</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    {ar ? "تأخير بشري متغير وكتابة Typing تحاكي السلوك البشري" : "Simulates human typing & variable delay per msg"}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-amber-500/10 text-amber-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Timer className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-foreground">{ar ? "استراحة تبريد كل 15 رسالة" : "Batch Cooldown (15 msgs)"}</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    {ar ? "توقف أمان (40-60 ثانية) تلقائياً لتهدئة الحساب ومنع الحظر" : "Auto 40-60s cooling pause every 15 msgs sent"}
                  </div>
                </div>
              </div>

              <div className="p-3 rounded-xl bg-card border flex items-start gap-3 shadow-2xs">
                <div className="w-8 h-8 rounded-lg bg-purple-500/10 text-purple-600 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <Fingerprint className="w-4 h-4" />
                </div>
                <div className="text-xs space-y-0.5">
                  <div className="font-semibold text-foreground">{ar ? "بصمة وهاش فريد لكل رسالة" : "Unique Hash Fingerprint"}</div>
                  <div className="text-muted-foreground text-[11px] leading-relaxed">
                    {ar ? "تشفير بحروف غير مرئية يمنع خوارزميات السبام من مطابقة النصوص" : "Invisible zero-width hash prevents bulk duplicate flags"}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── PERSISTENT OUTBOX QUEUE STATUS CARD ── */}
      <Card
        className={`border-border/60 shadow-sm transition-all ${
          pendingQueueCount > 0
            ? "border-amber-500/40 bg-amber-500/5 dark:bg-amber-500/10"
            : "bg-muted/20"
        }`}
      >
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start sm:items-center gap-3">
              <div
                className={`w-10 h-10 rounded-xl flex items-center justify-center font-bold flex-shrink-0 ${
                  pendingQueueCount > 0
                    ? "bg-amber-500 text-white shadow-sm"
                    : "bg-primary/10 text-primary"
                }`}
              >
                <Layers className="w-5 h-5" />
              </div>
              <div className="space-y-0.5">
                <div className="text-sm font-bold flex items-center gap-2">
                  <span>
                    {ar
                      ? "طابور العمليات غير المتصلة (Offline Outbox Queue)"
                      : "Offline Outbox Queue"}
                  </span>
                  {pendingQueueCount > 0 ? (
                    <Badge className="bg-amber-500 text-white border-0 text-xs px-2 py-0.5 animate-pulse">
                      {ar ? `${pendingQueueCount} رسالة معلقة` : `${pendingQueueCount} Pending`}
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-emerald-600 border-emerald-500/30 text-xs">
                      {ar ? "تم إرسال كل العمليات" : "All Processed"}
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  {pendingQueueCount > 0
                    ? ar
                      ? `يوجد ${pendingQueueCount} عملية تسكين أو حجز محفوظة بأمان في قاعدة البيانات، وسيتم إرسالها تلقائياً فور عودة اتصال الواتساب.`
                      : `${pendingQueueCount} check-in or booking notifications saved safely in DB. They will dispatch automatically upon WhatsApp reconnection.`
                    : ar
                    ? "نظام الحفظ الدائم نشط: أي عملية تسكين أو حجز تتم أثناء انقطاع اتصال الواتساب تُحفظ تلقائياً في هذا الطابور ولا تضيع أبداً."
                    : "Active offline buffer: Any accommodation or reservation performed while disconnected is queued and auto-dispatched."}
                </p>
              </div>
            </div>

            {pendingQueueCount > 0 && (
              <Button
                size="sm"
                onClick={handleProcessQueue}
                disabled={processingQueue || status !== "connected"}
                className="gap-1.5 text-xs font-semibold self-end sm:self-auto text-white shadow-sm flex-shrink-0"
                style={{ backgroundColor: status === "connected" ? "#00a884" : undefined }}
              >
                {processingQueue ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Send className="w-3.5 h-3.5" />
                )}
                {ar ? "معالجة وإرسال الطابور الآن" : "Process Queue Now"}
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* ── CARD 2: AUTOMATION TOGGLE & SUPERVISOR CONTACT ── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <CardTitle className="text-lg font-bold">
            {ar ? "إعدادات الإرسال التلقائي والبث الجماعي" : "Auto-Dispatch & Broadcast Configuration"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "التحكم في تفعيل أو إيقاف إرسال رسائل الواتساب الفورية عند التسكين أو الحجز، وإطلاق البث الجماعي"
              : "Toggle automated check-in and reservation WhatsApp messaging, and launch targeted broadcasts"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Check-In Auto-Send Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
            <div className="space-y-0.5">
              <div className="font-semibold text-sm">
                {ar
                  ? "إرسال رسالة ترحيب وتفاصيل التسكين تلقائياً عند إجراء Check-In"
                  : "Automatically send welcome WhatsApp upon Check-In"}
              </div>
              <div className="text-xs text-muted-foreground">
                {ar
                  ? "بمجرد حفظ التسكين لأي موظف يملك رقم هاتف، يصله فوراً إشعار الغرفة والسرير في الخلفية"
                  : "Dispatches room and bed details directly to employee's WhatsApp right after assignment"}
              </div>
            </div>
            <Switch
              checked={isAutoSendEnabled}
              onCheckedChange={setIsAutoSendEnabled}
            />
          </div>

          {/* Reservation Confirmation Auto-Send Toggle */}
          <div className="flex items-center justify-between p-4 rounded-xl bg-muted/30 border">
            <div className="space-y-0.5">
              <div className="font-semibold text-sm">
                {ar
                  ? "إرسال رسالة تأكيد الحجز المسبق تلقائياً عند إنشاء حجز جديد"
                  : "Automatically send reservation confirmation WhatsApp upon booking"}
              </div>
              <div className="text-xs text-muted-foreground">
                {ar
                  ? "بمجرد حفظ حجز جديد لنزيل يملك رقم هاتف، تصله فوراً تفاصيل الحجز وموعد الوصول ورقم التأكيد"
                  : "Dispatches booking details and expected arrival date directly to guest upon reservation"}
              </div>
            </div>
            <Switch
              checked={isReservationSendEnabled}
              onCheckedChange={setIsReservationSendEnabled}
            />
          </div>

          {/* Broadcast Launch Banner */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 rounded-xl bg-gradient-to-r from-emerald-500/10 via-teal-500/10 to-blue-500/10 border border-emerald-500/20">
            <div className="space-y-0.5">
              <div className="font-semibold text-sm flex items-center gap-2 text-foreground">
                <Radio className="w-4 h-4 text-emerald-600 animate-pulse" />
                <span>{ar ? "خدمة البث والإرسال الجماعي (Broadcast Messages)" : "Targeted WhatsApp Broadcast Messaging"}</span>
                <Badge className="bg-emerald-500/20 text-emerald-700 dark:text-emerald-300 border-0 text-[10px]">
                  {ar ? "جديد" : "New"}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "إرسال تنبيهات جماعية موجهة لجميع المقيمين، أو لمبنى محدد، أو لدور، أو لغرف معينة، أو لمقيمين محددين مع حماية مكافحة الحظر"
                  : "Send targeted broadcasts to all in-house, specific building, floor, rooms, or selected guests with anti-ban pacing"}
              </p>
            </div>
            <Button
              type="button"
              onClick={() => setBroadcastOpen(true)}
              className="text-white gap-2 font-semibold text-xs shadow-sm flex-shrink-0"
              style={{ backgroundColor: "#00a884" }}
            >
              <Radio className="w-4 h-4" />
              {ar ? "فتح نافذة البث الجماعي" : "Launch Broadcast"}
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-1">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                <PhoneCall className="w-3.5 h-3.5 text-primary" />
                {ar ? "رقم مسؤول السكن للطوارئ (Supervisor Contact):" : "Housing Supervisor Contact Number:"}
              </label>
              <Input
                placeholder="+201012345678"
                value={supervisorContact}
                onChange={(e) => setSupervisorContact(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[11px] text-muted-foreground">
                {ar
                  ? "يتم تضمين هذا الرقم في القالب عبر المتغير {supervisor_contact}"
                  : "Injected dynamically into templates via {supervisor_contact}"}
              </p>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {ar ? "رابط بوابة المقيمين الافتراضي:" : "Resident Portal URL:"}
              </label>
              <Input
                readOnly
                value="https://resident.sunrise-resorts.com/portal/"
                className="bg-muted text-muted-foreground font-mono text-sm cursor-not-allowed"
              />
              <p className="text-[11px] text-muted-foreground">
                {ar ? "يتم تضمينه تلقائياً في الرسالة عبر {portal_url}" : "Injected via {portal_url}"}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── CARD 3: TEMPLATE EDITOR & LIVE PREVIEW ── */}
      <Card className="border-border/60 shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <CardTitle className="text-lg font-bold">
                {ar ? "محرر قوالب رسائل الواتساب" : "WhatsApp Message Template Editor"}
              </CardTitle>
              <CardDescription>
                {ar
                  ? "قم بتخصيص نص الرسائل التلقائية للتسكين أو تأكيد الحجز مع دعم كامل للرموز التعبيرية والمتغيرات"
                  : "Customize automated messages for check-in or reservations with emojis and dynamic variables"}
              </CardDescription>
              <div className="mt-2 inline-flex items-center gap-1.5 px-3 py-1 rounded-lg text-xs bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/20 font-medium">
                <Globe className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>
                  {ar
                    ? "تحديد اللغة ذكي وتلقائي: ترسل الرسالة بالعربية للجنسيات المصرية والعربية، وبالإنجليزية للجنسيات الأجنبية"
                    : "Auto-Language: Dispatched in Arabic for Egyptian & Arab nationalities, and in English for foreign nationalities"}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (templateCategory === "checkin") {
                    if (activeTemplateTab === "ar") setWelcomeTemplateAr(DEFAULT_TEMPLATE_AR);
                    else setWelcomeTemplateEn(DEFAULT_TEMPLATE_EN);
                  } else {
                    if (activeTemplateTab === "ar") setReservationTemplateAr(DEFAULT_RES_TEMPLATE_AR);
                    else setReservationTemplateEn(DEFAULT_RES_TEMPLATE_EN);
                  }
                  toast.info(ar ? "تم استعادة القالب الافتراضي" : "Reset to default template");
                }}
                className="gap-1 text-xs"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {ar ? "استعادة الافتراضي" : "Reset"}
              </Button>
              <Button
                size="sm"
                onClick={handleSaveConfig}
                disabled={saving}
                className="gap-1.5 font-semibold text-xs"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : null}
                {ar ? "حفظ القوالب والإعدادات" : "Save All Templates"}
              </Button>
            </div>
          </div>

          {/* Template Category Switcher */}
          <div className="flex items-center gap-2 pt-3 border-t mt-2">
            <Button
              type="button"
              variant={templateCategory === "checkin" ? "default" : "outline"}
              size="sm"
              onClick={() => setTemplateCategory("checkin")}
              className="gap-2 text-xs font-semibold"
            >
              <MessageSquare className="w-3.5 h-3.5" />
              {ar ? "رسائل التسكين المباشر (Check-In)" : "Check-in Messages"}
            </Button>
            <Button
              type="button"
              variant={templateCategory === "reservation" ? "default" : "outline"}
              size="sm"
              onClick={() => setTemplateCategory("reservation")}
              className="gap-2 text-xs font-semibold"
            >
              <BookmarkCheck className="w-3.5 h-3.5" />
              {ar ? "رسائل تأكيد الحجوزات المسبقة (Reservations)" : "Reservation Confirmation"}
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Quick Variable Insert Chips */}
          <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border">
            <div className="text-xs font-semibold flex items-center gap-1.5 text-muted-foreground">
              <Sparkles className="w-3.5 h-3.5 text-amber-500" />
              <span>
                {ar
                  ? `انقر على أي متغير لإدراجه في موضع المؤشر (${templateCategory === "checkin" ? "قالب التسكين" : "قالب الحجز"}):`
                  : `Click any variable to insert at cursor (${templateCategory === "checkin" ? "Check-in" : "Reservation"}):`}
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5 pt-1">
              {(templateCategory === "checkin" ? VARIABLE_TAGS : RESERVATION_TAGS).map((v) => (
                <button
                  key={v.tag}
                  type="button"
                  onClick={() => handleInsertTag(v.tag)}
                  className="px-2.5 py-1 rounded-md text-xs font-medium bg-card hover:bg-primary/10 border hover:border-primary/40 text-foreground transition-colors flex items-center gap-1 active:scale-95 shadow-2xs"
                  title={ar ? v.labelAr : v.labelEn}
                >
                  <span className="text-primary font-mono font-bold">{v.tag}</span>
                  <span className="text-muted-foreground text-[10.5px]">({ar ? v.labelAr : v.labelEn})</span>
                </button>
              ))}
            </div>
          </div>

          {/* Tabs & Layout: Editor on Left, Live Mockup on Right */}
          <Tabs
            value={activeTemplateTab}
            onValueChange={(val) => setActiveTemplateTab(val as "ar" | "en")}
            className="w-full"
          >
            <TabsList className="w-full max-w-xs mb-3">
              <TabsTrigger value="ar" className="flex-1">
                🇪🇬 {ar ? "القالب العربي" : "Arabic Template"}
              </TabsTrigger>
              <TabsTrigger value="en" className="flex-1">
                🇬🇧 {ar ? "القالب الإنجليزي" : "English Template"}
              </TabsTrigger>
            </TabsList>

            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
              {/* Left Column: Textarea Editor */}
              <div className="lg:col-span-7 space-y-3">
                <TabsContent value="ar" className="m-0 space-y-2">
                  <Textarea
                    ref={textareaArRef}
                    rows={12}
                    dir="rtl"
                    value={templateCategory === "checkin" ? welcomeTemplateAr : reservationTemplateAr}
                    onChange={(e) =>
                      templateCategory === "checkin"
                        ? setWelcomeTemplateAr(e.target.value)
                        : setReservationTemplateAr(e.target.value)
                    }
                    className="font-sans leading-relaxed text-sm p-3.5 resize-y shadow-inner"
                    placeholder="اكتب نص القالب هنا..."
                  />
                  <div className="text-xs text-muted-foreground flex justify-between px-1">
                    <span>
                      {ar ? "عدد الأحرف:" : "Characters:"}{" "}
                      {(templateCategory === "checkin" ? welcomeTemplateAr : reservationTemplateAr).length}
                    </span>
                    <span>{ar ? "اللغة: العربية (RTL)" : "Language: Arabic (RTL)"}</span>
                  </div>
                </TabsContent>

                <TabsContent value="en" className="m-0 space-y-2">
                  <Textarea
                    ref={textareaEnRef}
                    rows={12}
                    dir="ltr"
                    value={templateCategory === "checkin" ? welcomeTemplateEn : reservationTemplateEn}
                    onChange={(e) =>
                      templateCategory === "checkin"
                        ? setWelcomeTemplateEn(e.target.value)
                        : setReservationTemplateEn(e.target.value)
                    }
                    className="font-sans leading-relaxed text-sm p-3.5 resize-y shadow-inner"
                    placeholder="Type template text here..."
                  />
                  <div className="text-xs text-muted-foreground flex justify-between px-1">
                    <span>
                      {ar ? "عدد الأحرف:" : "Characters:"}{" "}
                      {(templateCategory === "checkin" ? welcomeTemplateEn : reservationTemplateEn).length}
                    </span>
                    <span>{ar ? "Language: English (LTR)" : "Language: English (LTR)"}</span>
                  </div>
                </TabsContent>
              </div>

              {/* Right Column: Live Mobile WhatsApp Mockup */}
              <div className="lg:col-span-5 flex flex-col items-center">
                <div className="w-full max-w-[340px] rounded-3xl overflow-hidden border-4 border-gray-800 shadow-2xl bg-[#0b141a] text-white">
                  {/* WhatsApp Mobile Top Bar */}
                  <div className="bg-[#202c33] px-3 py-2.5 flex items-center gap-2.5 border-b border-[#2a3942]">
                    <div className="w-8 h-8 rounded-full bg-[#00a884] flex items-center justify-center text-white font-bold text-xs">
                      SH
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-xs font-semibold truncate leading-tight">
                        {mockVars.property_name}
                      </div>
                      <div className="text-[10px] text-[#25d366] leading-none">
                        {ar ? "حساب أعمال موثق" : "Verified Business"}
                      </div>
                    </div>
                  </div>

                  {/* WhatsApp Chat Wallpaper & Bubble */}
                  <div
                    className="p-3 min-h-[300px] flex flex-col justify-end text-sm"
                    style={{
                      backgroundColor: "#0b141a",
                      backgroundImage:
                        "radial-gradient(#1f2c34 1px, transparent 1px)",
                      backgroundSize: "16px 16px",
                    }}
                  >
                    <div
                      className="p-3 rounded-2xl rounded-tr-xs shadow-md space-y-2 max-w-[95%] self-end"
                      style={{ backgroundColor: "#005c4b" }}
                      dir={activeTemplateTab === "ar" ? "rtl" : "ltr"}
                    >
                      <p className="text-[12.5px] leading-relaxed whitespace-pre-wrap text-[#e9edef] select-none">
                        {previewText}
                      </p>
                      <div className="flex items-center justify-end gap-1 text-[10px] text-[#8696a0]">
                        <span>{new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}</span>
                        <CheckCheck className="w-3.5 h-3.5 text-[#53bdeb]" />
                      </div>
                    </div>
                  </div>
                </div>
                <span className="text-[11px] text-muted-foreground mt-2">
                  {ar
                    ? templateCategory === "checkin"
                      ? "📱 معاينة حية لشاشة هاتف الموظف فور التسكين"
                      : "📱 معاينة حية لرسالة تأكيد الحجز المسبق"
                    : templateCategory === "checkin"
                    ? "📱 Live mobile preview upon check-in"
                    : "📱 Live mobile preview upon reservation confirmation"}
                </span>
              </div>
            </div>
          </Tabs>
        </CardContent>
      </Card>

      {/* ── CARD 4: TEST SENDER & DELIVERY LOGS ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Test Sender */}
        <Card className="lg:col-span-5 border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center gap-2">
              <Send className="w-4 h-4 text-primary" />
              {ar ? "إرسال رسالة تجريبية" : "Send Test Message"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar
                ? "اختبر وصول الرسالة برقم هاتفك للتأكد من سلامة القالب قبل الاستخدام"
                : "Test message delivery to verify format and phone connectivity"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {ar ? "رقم الهاتف للتجربة:" : "Phone Number for Test:"}
              </label>
              <Input
                placeholder="01012345678"
                value={testPhone}
                onChange={(e) => setTestPhone(e.target.value)}
                className="font-mono text-sm"
              />
              <p className="text-[10.5px] text-muted-foreground">
                {ar ? "يدعم الأرقام المحلية 01x أو الدولية +20x" : "Supports local 01x or international +20x"}
              </p>
            </div>

            <Button
              onClick={handleSendTest}
              disabled={testing || status !== "connected"}
              className="w-full text-white font-semibold gap-2 shadow-sm"
              style={{ backgroundColor: status === "connected" ? "#00a884" : undefined }}
            >
              {testing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
              {status !== "connected"
                ? ar
                  ? "يجب ربط الواتساب أولاً"
                  : "Connect WhatsApp First"
                : ar
                ? "إرسال الرسالة التجريبية الآن"
                : "Send Test Message Now"}
            </Button>
          </CardContent>
        </Card>

        {/* Delivery Logs */}
        <Card className="lg:col-span-7 border-border/60 shadow-sm">
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-bold flex items-center justify-between">
              <span>{ar ? "آخر عمليات الإرسال" : "Recent Delivery Logs"}</span>
              <Button
                variant="ghost"
                size="sm"
                onClick={fetchStatusAndConfig}
                className="h-7 px-2 text-xs"
              >
                <RefreshCw className="w-3 h-3 mr-1" />
                {ar ? "تحديث" : "Refresh"}
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="pt-0">
            {logs.length === 0 ? (
              <div className="text-center py-6 text-xs text-muted-foreground">
                {ar ? "لا توجد رسائل مرسلة حتى الآن" : "No message logs recorded yet"}
              </div>
            ) : (
              <div className="divide-y divide-border/60 text-xs">
                {logs.map((log) => (
                  <div key={log.id} className="py-2.5 flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold flex items-center gap-2">
                        <span className="font-mono">{log.recipient_phone}</span>
                        {log.recipient_name && (
                          <span className="text-muted-foreground truncate">({log.recipient_name})</span>
                        )}
                      </div>
                      <div className="text-[11px] text-muted-foreground truncate max-w-sm mt-0.5">
                        {log.message_content}
                      </div>
                    </div>
                    <div className="text-end flex-shrink-0">
                      {log.status === "SENT" ? (
                        <Badge className="bg-emerald-500/15 text-emerald-600 border-emerald-500/30 text-[10px] px-1.5 py-0.5">
                          {ar ? "تم الإرسال" : "Sent"}
                        </Badge>
                      ) : log.status === "QUEUED" ? (
                        <Badge variant="outline" className="bg-amber-500/15 text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0.5 gap-1">
                          <Clock className="w-2.5 h-2.5 animate-spin" />
                          {ar ? "في الانتظار" : "Queued"}
                        </Badge>
                      ) : log.status === "NOT_REGISTERED" ? (
                        <Badge variant="outline" className="text-amber-600 border-amber-500/30 text-[10px] px-1.5 py-0.5">
                          {ar ? "غير مسجل بواتساب" : "No WhatsApp"}
                        </Badge>
                      ) : (
                        <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5">
                          {ar ? "فشل الإرسال" : "Failed"}
                        </Badge>
                      )}
                      <div className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(log.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Broadcast WhatsApp Dialog */}
      <BroadcastWhatsAppDialog
        open={broadcastOpen}
        onOpenChange={setBroadcastOpen}
        propertyId={propertyId}
        language={language}
      />
    </div>
  );
}
