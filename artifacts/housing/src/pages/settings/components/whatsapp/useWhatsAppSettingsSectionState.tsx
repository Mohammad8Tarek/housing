// State, effects and handlers of WhatsAppSettingsSection (moved verbatim).
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  WhatsAppSettingsSectionProps,
  DEFAULT_TEMPLATE_AR,
  DEFAULT_TEMPLATE_EN,
  DEFAULT_RES_TEMPLATE_AR,
  DEFAULT_RES_TEMPLATE_EN,
} from "./WhatsAppSettingsSection.constants";

export function useWhatsAppSettingsSectionState({
  propertyId,
  language,
}: WhatsAppSettingsSectionProps) {
  const ar = language === "ar";
  const [loading, setLoading] = useState(true);
  const [connecting, setConnecting] = useState(false);
  const [saving, setSaving] = useState(false);
  const [testing, setTesting] = useState(false);

  // Provider: Meta Cloud API vs UltraMsg vs Custom Gateway vs Direct Baileys
  const [provider, setProvider] = useState<
    "meta_cloud" | "baileys" | "ultramsg" | "custom_gateway"
  >("meta_cloud");
  const [metaPhoneNumberId, setMetaPhoneNumberId] = useState("");
  const [metaWabaId, setMetaWabaId] = useState("");
  const [metaAccessToken, setMetaAccessToken] = useState("");
  const [hasMetaToken, setHasMetaToken] = useState(false);
  const [showMetaGuide, setShowMetaGuide] = useState(false);

  // UltraMsg
  const [ultramsgInstanceId, setUltramsgInstanceId] = useState("");
  const [ultramsgToken, setUltramsgToken] = useState("");
  const [hasUltramsgToken, setHasUltramsgToken] = useState(false);

  // Custom / Any WhatsApp Gateway
  const [customGatewayUrl, setCustomGatewayUrl] = useState("");
  const [customGatewayToken, setCustomGatewayToken] = useState("");
  const [hasCustomGatewayToken, setHasCustomGatewayToken] = useState(false);
  const [customGatewayMethod, setCustomGatewayMethod] = useState("POST");
  const [customGatewayPayloadType, setCustomGatewayPayloadType] =
    useState("json");
  const [customGatewayPhoneField, setCustomGatewayPhoneField] = useState("to");
  const [customGatewayMessageField, setCustomGatewayMessageField] =
    useState("body");
  const [customGatewayHeaders, setCustomGatewayHeaders] = useState("");

  // Status & Connection (Baileys)
  const [status, setStatus] = useState<
    "disconnected" | "pairing" | "connected"
  >("disconnected");
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [qrCode, setQrCode] = useState<string | null>(null);
  const [pairingCode, setPairingCode] = useState<string | null>(null);
  const [pairingPhone, setPairingPhone] = useState<string>("");
  const [pairingTab, setPairingTab] = useState<"qr" | "code">("qr");
  const [requestingCode, setRequestingCode] = useState<boolean>(false);
  const [pendingQueueCount, setPendingQueueCount] = useState<number>(0);
  // Anti-ban state from /api/whatsapp/status (banned, safe quota, opt-outs)
  const [antiBanInfo, setAntiBanInfo] = useState<{
    banned: boolean;
    sendingPausedUntil: string | null;
    optOutCount: number;
    quota: {
      sentLast24h: number;
      sentLastHour: number;
      dayLimit: number;
      hourLimit: number;
      warmup: boolean;
    } | null;
  } | null>(null);
  const [processingQueue, setProcessingQueue] = useState<boolean>(false);

  // Config Form
  const [isAutoSendEnabled, setIsAutoSendEnabled] = useState(true);
  const [isReservationSendEnabled, setIsReservationSendEnabled] =
    useState(true);
  const [welcomeTemplateAr, setWelcomeTemplateAr] =
    useState(DEFAULT_TEMPLATE_AR);
  const [welcomeTemplateEn, setWelcomeTemplateEn] =
    useState(DEFAULT_TEMPLATE_EN);
  const [reservationTemplateAr, setReservationTemplateAr] = useState(
    DEFAULT_RES_TEMPLATE_AR,
  );
  const [reservationTemplateEn, setReservationTemplateEn] = useState(
    DEFAULT_RES_TEMPLATE_EN,
  );
  const [supervisorContact, setSupervisorContact] = useState("");
  const [templateCategory, setTemplateCategory] = useState<
    "checkin" | "reservation"
  >("checkin");
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
        fetch(`/api/whatsapp/status?propertyId=${propertyId}`, {
          credentials: "include",
        }),
        fetch(`/api/whatsapp/config?propertyId=${propertyId}`, {
          credentials: "include",
        }),
        fetch(`/api/whatsapp/logs?propertyId=${propertyId}&limit=5`, {
          credentials: "include",
        }),
      ]);

      if (statusRes.ok) {
        const sData = await statusRes.json();
        if (sData.provider) {
          setProvider(sData.provider);
        }
        setStatus(sData.status || "disconnected");
        setPhoneNumber(sData.phoneNumber || null);
        setQrCode(sData.qrCode || null);
        if (sData.pairingCode !== undefined) {
          setPairingCode(sData.pairingCode || null);
        }
        if (sData.pendingQueueCount !== undefined) {
          setPendingQueueCount(sData.pendingQueueCount);
        }
        setAntiBanInfo({
          banned: !!sData.banned,
          sendingPausedUntil: sData.sendingPausedUntil ?? null,
          optOutCount: Number(sData.optOutCount || 0),
          quota: sData.quota ?? null,
        });
        if (sData.isAutoSendEnabled !== undefined) {
          setIsAutoSendEnabled(sData.isAutoSendEnabled);
        }
        if (sData.metaPhoneNumberId !== undefined) {
          setMetaPhoneNumberId(sData.metaPhoneNumberId || "");
        }
        if (sData.metaWabaId !== undefined) {
          setMetaWabaId(sData.metaWabaId || "");
        }
        if (sData.hasMetaToken !== undefined) {
          setHasMetaToken(Boolean(sData.hasMetaToken));
        }
        if (sData.ultramsgInstanceId !== undefined) {
          setUltramsgInstanceId(sData.ultramsgInstanceId || "");
        }
        if (sData.customGatewayUrl !== undefined) {
          setCustomGatewayUrl(sData.customGatewayUrl || "");
        }
        if (sData.hasCustomGatewayToken !== undefined) {
          setHasCustomGatewayToken(Boolean(sData.hasCustomGatewayToken));
        }
        if (sData.customGatewayMethod) {
          setCustomGatewayMethod(sData.customGatewayMethod);
        }
        if (sData.customGatewayPayloadType) {
          setCustomGatewayPayloadType(sData.customGatewayPayloadType);
        }
        if (sData.customGatewayPhoneField) {
          setCustomGatewayPhoneField(sData.customGatewayPhoneField);
        }
        if (sData.customGatewayMessageField) {
          setCustomGatewayMessageField(sData.customGatewayMessageField);
        }
        if (sData.customGatewayHeaders !== undefined) {
          setCustomGatewayHeaders(sData.customGatewayHeaders || "");
        }
      }

      if (configRes.ok) {
        const cData = await configRes.json();
        if (cData.config) {
          if (cData.config.provider) {
            setProvider(cData.config.provider);
          }
          setIsAutoSendEnabled(cData.config.isAutoSendEnabled ?? true);
          setIsReservationSendEnabled(
            cData.config.isReservationSendEnabled ?? true,
          );
          const rawWelcomeAr = cData.config.welcomeTemplateAr || "";
          setWelcomeTemplateAr(
            rawWelcomeAr && !rawWelcomeAr.includes("???")
              ? rawWelcomeAr
              : DEFAULT_TEMPLATE_AR,
          );
          setWelcomeTemplateEn(
            cData.config.welcomeTemplateEn || DEFAULT_TEMPLATE_EN,
          );

          const rawResAr = cData.config.reservationTemplateAr || "";
          setReservationTemplateAr(
            rawResAr && !rawResAr.includes("???")
              ? rawResAr
              : DEFAULT_RES_TEMPLATE_AR,
          );
          setReservationTemplateEn(
            cData.config.reservationTemplateEn || DEFAULT_RES_TEMPLATE_EN,
          );
          setSupervisorContact(cData.config.supervisorContact || "");

          if (cData.config.metaPhoneNumberId !== undefined) {
            setMetaPhoneNumberId(cData.config.metaPhoneNumberId || "");
          }
          if (cData.config.metaWabaId !== undefined) {
            setMetaWabaId(cData.config.metaWabaId || "");
          }
          if (cData.config.hasMetaToken !== undefined) {
            setHasMetaToken(Boolean(cData.config.hasMetaToken));
          }
          if (cData.config.ultramsgInstanceId !== undefined) {
            setUltramsgInstanceId(cData.config.ultramsgInstanceId || "");
          }
          if (cData.config.hasUltramsgToken !== undefined) {
            setHasUltramsgToken(Boolean(cData.config.hasUltramsgToken));
          }
          if (cData.config.customGatewayUrl !== undefined) {
            setCustomGatewayUrl(cData.config.customGatewayUrl || "");
          }
          if (cData.config.hasCustomGatewayToken !== undefined) {
            setHasCustomGatewayToken(
              Boolean(cData.config.hasCustomGatewayToken),
            );
          }
          if (cData.config.customGatewayMethod) {
            setCustomGatewayMethod(cData.config.customGatewayMethod);
          }
          if (cData.config.customGatewayPayloadType) {
            setCustomGatewayPayloadType(cData.config.customGatewayPayloadType);
          }
          if (cData.config.customGatewayPhoneField) {
            setCustomGatewayPhoneField(cData.config.customGatewayPhoneField);
          }
          if (cData.config.customGatewayMessageField) {
            setCustomGatewayMessageField(
              cData.config.customGatewayMessageField,
            );
          }
          if (cData.config.customGatewayHeaders !== undefined) {
            setCustomGatewayHeaders(cData.config.customGatewayHeaders || "");
          }
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
      const res = await fetch(
        `/api/whatsapp/queue/process?propertyId=${propertyId}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await res.json();
      if (data.success) {
        toast.success(
          ar
            ? `تمت معالجة الطابور بنجاح: تم إرسال ${data.processed || 0} رسالة، المتبقي: ${data.pendingRemaining ?? 0}`
            : `Queue processed: ${data.processed || 0} sent, ${data.pendingRemaining ?? 0} pending`,
        );
        fetchStatusAndConfig();
      } else {
        toast.error(
          data.error || (ar ? "فشل معالجة الطابور" : "Failed to process queue"),
        );
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
      if (provider === "baileys" && status === "pairing") {
        fetchStatusAndConfig();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [propertyId, status, provider]);

  // Connect / Request QR or Pairing Code
  const handleConnect = async (phoneForCode?: string) => {
    if (!propertyId) return;
    setConnecting(true);
    try {
      const safePhone =
        typeof phoneForCode === "string" && phoneForCode.trim().length > 0
          ? phoneForCode.trim()
          : undefined;
      const res = await fetch(
        `/api/whatsapp/connect?propertyId=${propertyId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            phoneNumber: safePhone,
          }),
        },
      );
      const data = await res.json();
      if (data.success) {
        setStatus(data.status);
        setQrCode(data.qrCode);
        setPairingCode(data.pairingCode || null);
        setPhoneNumber(data.phoneNumber);
        toast.success(
          data.pairingCode
            ? ar
              ? "تم إنشاء كود الاقتران بنجاح، أدخله في هاتفك"
              : "Pairing code generated, enter it on your phone"
            : ar
              ? "تم توليد رمز QR بنجاح، قم بمسحه من هاتفك"
              : "QR Code generated, scan with your phone",
        );
      } else {
        toast.error(
          data.error || (ar ? "فشل بدء الاتصال" : "Connection failed"),
        );
      }
    } catch {
      toast.error(ar ? "خطأ في الاتصال بالخادم" : "Server communication error");
    } finally {
      setConnecting(false);
    }
  };

  const handleRequestPairingCode = async () => {
    if (!pairingPhone.trim()) {
      toast.error(
        ar
          ? "يرجى إدخال رقم هاتف الواتساب"
          : "Please enter WhatsApp phone number",
      );
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
      const res = await fetch(
        `/api/whatsapp/disconnect?propertyId=${propertyId}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
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
  const handleSaveConfig = async (
    overrideProvider?: "meta_cloud" | "baileys" | "ultramsg" | "custom_gateway",
  ) => {
    if (!propertyId) return;
    setSaving(true);
    try {
      const activeProv = overrideProvider || provider;
      const res = await fetch(`/api/whatsapp/config?propertyId=${propertyId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          provider: activeProv,
          metaPhoneNumberId: metaPhoneNumberId.trim(),
          metaWabaId: metaWabaId.trim(),
          metaAccessToken: metaAccessToken.trim()
            ? metaAccessToken.trim()
            : undefined,
          ultramsgInstanceId: ultramsgInstanceId.trim(),
          ultramsgToken: ultramsgToken.trim()
            ? ultramsgToken.trim()
            : undefined,
          customGatewayUrl: customGatewayUrl.trim(),
          customGatewayToken: customGatewayToken.trim()
            ? customGatewayToken.trim()
            : undefined,
          customGatewayMethod,
          customGatewayPayloadType,
          customGatewayPhoneField: customGatewayPhoneField.trim() || "to",
          customGatewayMessageField: customGatewayMessageField.trim() || "body",
          customGatewayHeaders: customGatewayHeaders.trim() || undefined,
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
        if (metaAccessToken.trim()) {
          setHasMetaToken(true);
          setMetaAccessToken("");
        }
        if (ultramsgToken.trim()) {
          setHasUltramsgToken(true);
          setUltramsgToken("");
        }
        if (customGatewayToken.trim()) {
          setHasCustomGatewayToken(true);
          setCustomGatewayToken("");
        }
        toast.success(
          ar
            ? "تم حفظ إعدادات وقوالب الواتساب بنجاح"
            : "WhatsApp templates & settings saved successfully",
        );
        fetchStatusAndConfig();
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
      toast.error(
        ar ? "يرجى كتابة رقم الهاتف للتجربة" : "Please enter a phone number",
      );
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
            : `Test message sent successfully to ${testPhone}`,
        );
        fetchStatusAndConfig();
      } else {
        toast.error(
          d.error ||
            (ar ? "فشل إرسال الرسالة التجريبية" : "Test message failed"),
        );
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
          employee_name:
            activeTemplateTab === "ar"
              ? "أحمد مصطفى كامل"
              : "Ahmed Mostafa Kamel",
          profile_id: "10575",
          employee_id: "10575",
          property_name:
            activeTemplateTab === "ar"
              ? "سكن منتجع صن رايز"
              : "Sunrise Resort Housing",
          building_name:
            activeTemplateTab === "ar" ? "المبنى ب (Building B)" : "Building B",
          floor_name: activeTemplateTab === "ar" ? "الدور الثاني" : "2nd Floor",
          room_number: "204",
          bed_label:
            activeTemplateTab === "ar"
              ? "سرير A (يمين النافذة)"
              : "Bed A (Right Window)",
          checkin_date: new Date().toLocaleDateString(
            activeTemplateTab === "ar" ? "ar-EG" : "en-US",
          ),
          portal_url: "https://resident.sunrise-resorts.com/portal/",
          supervisor_contact: supervisorContact || "+201012345678",
        }
      : {
          guest_name:
            activeTemplateTab === "ar"
              ? "محمود عبد العزيز"
              : "Mahmoud Abdelaziz",
          property_name:
            activeTemplateTab === "ar"
              ? "سكن منتجع صن رايز"
              : "Sunrise Resort Housing",
          reservation_id: "8421",
          room_info:
            activeTemplateTab === "ar"
              ? "مبنى الفيروز - الغرفة 302"
              : "Al Fayrouz - Room 302",
          bed_info:
            activeTemplateTab === "ar" ? "سرير B (مفرد)" : "Bed B (Single)",
          checkin_date: "2026/09/20",
          checkout_date: "2026/09/30",
          portal_url: "https://resident.sunrise-resorts.com/portal/",
          supervisor_contact: supervisorContact || "+201012345678",
        };

  let previewText = currentTemplate;
  for (const [k, v] of Object.entries(mockVars)) {
    previewText = previewText.replace(new RegExp(`{${k}}`, "g"), v);
  }
  return {
    propertyId,
    language,
    ar,
    loading,
    setLoading,
    connecting,
    setConnecting,
    saving,
    setSaving,
    testing,
    setTesting,
    provider,
    setProvider,
    metaPhoneNumberId,
    setMetaPhoneNumberId,
    metaWabaId,
    setMetaWabaId,
    metaAccessToken,
    setMetaAccessToken,
    hasMetaToken,
    setHasMetaToken,
    showMetaGuide,
    setShowMetaGuide,
    ultramsgInstanceId,
    setUltramsgInstanceId,
    ultramsgToken,
    setUltramsgToken,
    hasUltramsgToken,
    setHasUltramsgToken,
    customGatewayUrl,
    setCustomGatewayUrl,
    customGatewayToken,
    setCustomGatewayToken,
    hasCustomGatewayToken,
    setHasCustomGatewayToken,
    customGatewayMethod,
    setCustomGatewayMethod,
    customGatewayPayloadType,
    setCustomGatewayPayloadType,
    customGatewayPhoneField,
    setCustomGatewayPhoneField,
    customGatewayMessageField,
    setCustomGatewayMessageField,
    customGatewayHeaders,
    setCustomGatewayHeaders,
    status,
    setStatus,
    phoneNumber,
    setPhoneNumber,
    qrCode,
    setQrCode,
    pairingCode,
    setPairingCode,
    pairingPhone,
    setPairingPhone,
    pairingTab,
    setPairingTab,
    requestingCode,
    setRequestingCode,
    pendingQueueCount,
    setPendingQueueCount,
    antiBanInfo,
    processingQueue,
    setProcessingQueue,
    isAutoSendEnabled,
    setIsAutoSendEnabled,
    isReservationSendEnabled,
    setIsReservationSendEnabled,
    welcomeTemplateAr,
    setWelcomeTemplateAr,
    welcomeTemplateEn,
    setWelcomeTemplateEn,
    reservationTemplateAr,
    setReservationTemplateAr,
    reservationTemplateEn,
    setReservationTemplateEn,
    supervisorContact,
    setSupervisorContact,
    templateCategory,
    setTemplateCategory,
    activeTemplateTab,
    setActiveTemplateTab,
    broadcastOpen,
    setBroadcastOpen,
    testPhone,
    setTestPhone,
    logs,
    setLogs,
    textareaArRef,
    textareaEnRef,
    fetchStatusAndConfig,
    handleProcessQueue,
    handleConnect,
    handleRequestPairingCode,
    handleDisconnect,
    handleSaveConfig,
    handleSendTest,
    handleInsertTag,
    currentTemplate,
    mockVars,
    previewText,
  };
}

export type WhatsAppSettingsSectionState = ReturnType<
  typeof useWhatsAppSettingsSectionState
>;
