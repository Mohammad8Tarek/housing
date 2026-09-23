import { useEffect, useState, useMemo } from "react";
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
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  RefreshCw,
  ShieldAlert,
  Calendar,
  LogOut,
  CheckCircle2,
  Plus,
  Trash2,
  Edit,
  ExternalLink,
  Layers,
  Building2,
  Tag,
  FlaskConical,
  Zap,
  HelpCircle,
  Check,
  AlertTriangle,
  Info,
  Eye,
  EyeOff,
  Lock,
  Server,
  KeyRound,
  Hash,
  ArrowRight,
  Search,
  Sparkles,
  Database,
  Loader2,
  Users,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCheck,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { PermissionGate } from "@/components/ui/permission-gate";

export interface HrSourceConfig {
  id: string;
  name: string;
  apiUrl: string;
  apiKey?: string;
  targetPropertyIds?: number[];
  syncProfiles?: boolean;
  allowedLevels?: string[];
  allowedDepartments?: string[];
  housingEligibleOnly?: boolean;
  autoCheckoutOnDeparture?: boolean;
  autoVacationSync?: boolean;
  isActive?: boolean;
  lastSyncAt?: string | null;
}

interface HrSyncSectionProps {
  propertyId: number | null;
  language: string;
}

const AVAILABLE_JOB_LEVELS = [
  { level: "0", titleAr: "المستوى 0: الإدارة العليا (Executives / GM)", titleEn: "Level 0: Executive / GM" },
  { level: "1", titleAr: "المستوى 1: مدراء الإدارات (Dept Heads)", titleEn: "Level 1: Department Heads" },
  { level: "2", titleAr: "المستوى 2: المشرفين ورؤساء الأقسام (Supervisors)", titleEn: "Level 2: Supervisors" },
  { level: "3", titleAr: "المستوى 3: موظفي التشغيل والخدمة (Line Staff)", titleEn: "Level 3: Line Staff" },
  { level: "4", titleAr: "المستوى 4: العمالة والخدمات المساعدة (Support / Casual)", titleEn: "Level 4: Support / Casual" },
];

export function HrSyncSection({ propertyId, language }: HrSyncSectionProps) {
  const queryClient = useQueryClient();
  const { properties } = useProperty();
  const ar = language === "ar";

  // List of real properties/hotels
  const validProperties = useMemo(() => properties.filter((p) => p.id > 0), [properties]);

  // Active Selected Hotel for this Section
  const [activeHotelId, setActiveHotelId] = useState<number>(() => {
    if (typeof propertyId === "number" && propertyId > 0) return propertyId;
    return validProperties[0]?.id || 1;
  });

  useEffect(() => {
    if (typeof propertyId === "number" && propertyId > 0) {
      setActiveHotelId(propertyId);
    }
  }, [propertyId]);

  const effectiveHotelId = activeHotelId;
  const currentHotel = useMemo(
    () => validProperties.find((p) => p.id === effectiveHotelId) || validProperties[0],
    [validProperties, effectiveHotelId],
  );

  // Master Global Settings
  const [isActive, setIsActive] = useState(false);
  const [autoCheckoutOnDeparture, setAutoCheckoutOnDeparture] = useState(true);
  const [autoVacationSync, setAutoVacationSync] = useState(true);
  const [fieldMapping, setFieldMapping] = useState("");
  const [sources, setSources] = useState<HrSourceConfig[]>([]);
  const [targetPropertyIds, setTargetPropertyIds] = useState<number[]>([]);

  // UI State
  const [syncing, setSyncing] = useState(false);
  const [activeSyncType, setActiveSyncType] = useState<string | null>(null);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [isTestModalOpen, setIsTestModalOpen] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testResult, setTestResult] = useState<any | null>(null);

  // Edit/Add Source Dialog State
  const [editingSource, setEditingSource] = useState<HrSourceConfig | null>(null);

  // Sunrise e-Signature Configuration State
  const [esignBaseUrl, setEsignBaseUrl] = useState("https://signature-backend.sunrise-resorts.com/api");
  const [esignUsername, setEsignUsername] = useState("");
  const [esignPassword, setEsignPassword] = useState("");
  const [esignHotelCode, setEsignHotelCode] = useState("");
  const [esignIsActive, setEsignIsActive] = useState(true);
  const [showEsignPassword, setShowEsignPassword] = useState(false);
  const [savingEsign, setSavingEsign] = useState(false);
  const [testingEsign, setTestingEsign] = useState(false);
  const [esignTestResult, setEsignTestResult] = useState<{
    success: boolean;
    message: string;
    hotelId?: number;
    hotelName?: string;
    hotelCode?: string;
  } | null>(null);

  // Range Sync State (with dedicated hotel selection)
  const [rangeHotelId, setRangeHotelId] = useState<number>(effectiveHotelId);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [isRangeSyncing, setIsRangeSyncing] = useState(false);
  const [rangeSyncResult, setRangeSyncResult] = useState<any | null>(null);

  // Batch Refresh State
  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
  const [batchRefreshResult, setBatchRefreshResult] = useState<any | null>(null);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

  // Developer Guide Accordion State
  const [showDevGuide, setShowDevGuide] = useState(false);
  const [copiedWebhook, setCopiedWebhook] = useState<string | null>(null);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopiedWebhook(id);
    toast.success(ar ? "تم نسخ الرابط للحافظة" : "Copied to clipboard");
    setTimeout(() => setCopiedWebhook(null), 2500);
  };

  useEffect(() => {
    setRangeHotelId(effectiveHotelId);
  }, [effectiveHotelId]);

  // Load Config for specific hotel
  const loadConfig = async (targetId?: number) => {
    const hotelIdToLoad = targetId || effectiveHotelId;
    if (!hotelIdToLoad) return;
    try {
      const res = await fetch(`/api/hr-sync/config?propertyId=${hotelIdToLoad}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to load");
      const d = await res.json();
      if (d && d.config) {
        setIsActive(d.config.isActive ?? false);
        setAutoCheckoutOnDeparture(d.config.autoCheckoutOnDeparture ?? true);
        setAutoVacationSync(d.config.autoVacationSync ?? true);
        setFieldMapping(
          d.config.fieldMapping && Object.keys(d.config.fieldMapping).length > 0
            ? JSON.stringify(d.config.fieldMapping, null, 2)
            : "",
        );
        setSources(Array.isArray(d.config.sources) ? d.config.sources : []);
        setTargetPropertyIds(
          Array.isArray(d.config.targetPropertyIds)
            ? d.config.targetPropertyIds
            : [hotelIdToLoad],
        );

        if (d.config.esignConfig) {
          const ec = d.config.esignConfig;
          if (ec.baseUrl) setEsignBaseUrl(ec.baseUrl);
          if (ec.username) setEsignUsername(ec.username);
          if (ec.password) setEsignPassword(ec.password);
          if (ec.hotelCode) setEsignHotelCode(ec.hotelCode);
          if (ec.isActive !== undefined) setEsignIsActive(ec.isActive);
        } else {
          // If no custom code yet, try default code from hotel metadata
          const hotelObj = validProperties.find((p) => p.id === hotelIdToLoad);
          if (hotelObj?.code) {
            setEsignHotelCode(hotelObj.code);
          } else {
            setEsignHotelCode("");
          }
          setEsignPassword("");
        }
      }
    } catch {
      toast.error(ar ? "فشل تحميل إعدادات مزامنة الـ HR" : "Failed to load HR sync settings");
    }
  };

  const handleHotelChange = (newHotelId: number) => {
    setActiveHotelId(newHotelId);
    setEsignTestResult(null);
    loadConfig(newHotelId);
  };

  // Quick helper: Copy credentials from another hotel
  const copyCredentialsFromOtherHotel = async (fromHotelId: number) => {
    try {
      const res = await fetch(`/api/hr-sync/config?propertyId=${fromHotelId}`, {
        credentials: "include",
      });
      const d = await res.json();
      if (d?.config?.esignConfig) {
        const ec = d.config.esignConfig;
        if (ec.baseUrl) setEsignBaseUrl(ec.baseUrl);
        if (ec.username) setEsignUsername(ec.username);
        if (ec.password) setEsignPassword(ec.password);
        toast.success(
          ar
            ? "تم نسخ رابط السيرفر وبيانات الدخول! يرجى التأكد من كود هذا الفندق فقط ثم الحفظ."
            : "Credentials copied. Set hotel code and save.",
        );
      } else {
        toast.info(ar ? "الفندق المحدد ليس لديه بيانات ربط محفوظة بعد" : "Selected hotel has no saved credentials");
      }
    } catch {
      toast.error(ar ? "فشل نسخ البيانات" : "Failed to copy credentials");
    }
  };

  // Save e-Signature Settings
  const saveEsignSettings = async () => {
    if (!effectiveHotelId) return;
    setSavingEsign(true);
    try {
      const resp = await fetch("/api/hr-sync/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: effectiveHotelId,
          esignConfig: {
            baseUrl: esignBaseUrl.trim(),
            username: esignUsername.trim(),
            password: esignPassword,
            hotelCode: esignHotelCode.trim().toUpperCase(),
            isActive: esignIsActive,
          },
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error || "Save failed");
      toast.success(
        ar
          ? `تم حفظ بيانات الربط لفندق "${currentHotel?.name || ""}" بنجاح`
          : "e-Signature HR connection config saved",
      );
      loadConfig(effectiveHotelId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save e-Signature config");
    } finally {
      setSavingEsign(false);
    }
  };

  // Test e-Signature Connection
  const handleTestEsign = async () => {
    if (!esignUsername.trim() || !esignPassword.trim() || !esignHotelCode.trim()) {
      toast.error(
        ar
          ? "يرجى كتابة اسم المستخدم، وكلمة المرور، وكود الفندق أولاً"
          : "Username, password, and hotel code are required",
      );
      return;
    }
    setTestingEsign(true);
    setEsignTestResult(null);
    try {
      const resp = await fetch("/api/hr-sync/esign/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: effectiveHotelId,
          baseUrl: esignBaseUrl.trim(),
          username: esignUsername.trim(),
          password: esignPassword,
          hotelCode: esignHotelCode.trim().toUpperCase(),
        }),
      });
      const data = await resp.json();
      setEsignTestResult(data);
      if (resp.ok && data.success) {
        toast.success(
          ar
            ? `الاتصال ناجح! تم التحقق من فندق: ${data.hotelName} (كود: ${data.hotelCode}، معرف: ${data.hotelId})`
            : `Connected successfully to hotel: ${data.hotelName}`,
        );
      } else {
        toast.error(data.error || (ar ? "فشل الاتصال بسيرفر الـ HR" : "Connection failed"));
      }
    } catch (err: any) {
      toast.error(err?.message || "Test connection failed");
    } finally {
      setTestingEsign(false);
    }
  };

  // Range Sync (من كود إلى كود) مع إمكانية تحديد الفندق
  const handleRangeSync = async () => {
    const fromNum = parseInt(rangeFrom.trim(), 10);
    const toNum = parseInt(rangeTo.trim(), 10);
    if (isNaN(fromNum) || isNaN(toNum)) {
      toast.error(
        ar
          ? "يرجى كتابة أرقام وظيفية صحيحة في خانتي (من كود) و(إلى كود)"
          : "Please enter valid start and end clock numbers",
      );
      return;
    }
    if (fromNum > toNum) {
      toast.error(
        ar
          ? "بداية النطاق يجب أن تكون أقل من أو تساوي نهاية النطاق"
          : "Start number must be less than or equal to end number",
      );
      return;
    }
    if (toNum - fromNum + 1 > 2000) {
      toast.error(
        ar
          ? "الحد الأقصى للنطاق في المرة الواحدة هو 2000 موظف"
          : "Maximum range is 2000 employees per run",
      );
      return;
    }

    const targetHotel = validProperties.find((p) => p.id === rangeHotelId) || currentHotel;
    setIsRangeSyncing(true);
    setRangeSyncResult(null);
    try {
      const resp = await fetch("/api/hr-sync/esign/range-sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: rangeHotelId || effectiveHotelId,
          fromClockNo: fromNum,
          toClockNo: toNum,
          hotelCode:
            rangeHotelId === effectiveHotelId && esignHotelCode.trim()
              ? esignHotelCode.trim().toUpperCase()
              : undefined,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Range sync failed");
      }

      setRangeSyncResult(data);
      toast.success(
        ar
          ? `اكتمل استيراد النطاق لفندق "${targetHotel?.name || ""}" بنجاح! تم العثور على ${data.foundCount} موظف (إنشاء ${data.stats?.created || 0}، وتحديث ${data.stats?.updated || 0})`
          : `Range sync complete for ${targetHotel?.name || ""}! Found ${data.foundCount} employees`,
      );
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["lookup_values"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(err?.message || (ar ? "حدث خطأ أثناء الاستيراد بالنطاق" : "Range sync error"));
    } finally {
      setIsRangeSyncing(false);
    }
  };

  // Batch Refresh Existing Profiles
  const handleBatchRefresh = async () => {
    setShowBatchConfirm(false);
    setIsBatchRefreshing(true);
    setBatchRefreshResult(null);
    try {
      const resp = await fetch("/api/hr-sync/esign/refresh-existing", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: effectiveHotelId,
        }),
      });
      const data = await resp.json();
      if (!resp.ok || !data.success) {
        throw new Error(data.error || "Batch refresh failed");
      }

      setBatchRefreshResult(data);
      toast.success(
        ar
          ? `اكتمل التحديث الشامل لفندق "${currentHotel?.name || ""}"! تم فحص ${data.totalChecked} وتحديث ${data.updatedCount} موظف`
          : `Batch refresh complete for ${currentHotel?.name || ""}: ${data.updatedCount} profiles updated`,
      );
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["lookup_values"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
    } catch (err: any) {
      toast.error(
        err?.message || (ar ? "حدث خطأ أثناء تحديث بيانات الموظفين" : "Batch refresh error"),
      );
    } finally {
      setIsBatchRefreshing(false);
    }
  };

  useEffect(() => {
    loadConfig(effectiveHotelId);
  }, [effectiveHotelId]);

  // Save Config
  const saveConfig = async (newSources?: HrSourceConfig[]) => {
    if (!effectiveHotelId) return;
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

      const payloadSources = newSources || sources;

      const resp = await fetch("/api/hr-sync/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: effectiveHotelId,
          fieldMapping: fm,
          isActive,
          autoCheckoutOnDeparture,
          autoVacationSync,
          targetPropertyIds: targetPropertyIds.length > 0 ? targetPropertyIds : [effectiveHotelId],
          sources: payloadSources,
          esignConfig: {
            baseUrl: esignBaseUrl.trim(),
            username: esignUsername.trim(),
            password: esignPassword,
            hotelCode: esignHotelCode.trim().toUpperCase(),
            isActive: esignIsActive,
          },
        }),
      });

      if (!resp.ok) throw new Error((await resp.json()).message || "Save failed");
      toast.success(ar ? "تم حفظ إعدادات ومصادر الـ HR بنجاح" : "HR sync config saved");
      loadConfig(effectiveHotelId);
    } catch (err: any) {
      toast.error(err.message || "Error saving config");
    }
  };

  // Trigger Sync with granular scope
  const triggerSync = async (scope: "full" | "movements_only" | "lookups_only" = "full", sourceId?: string) => {
    if (!propertyId) return;
    setSyncing(true);
    setActiveSyncType(sourceId ? `${scope}_${sourceId}` : scope);

    try {
      const resp = await fetch("/api/hr-sync/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId, scope, sourceId }),
      });

      const d = await resp.json();
      if (!resp.ok) throw new Error(d.error || "Sync failed");

      if (scope === "lookups_only") {
        toast.success(
          ar
            ? `تم تحديث المسميات بنجاح: تم تسجيل ${d.stats?.lookupsAdded || 0} قسم ووظيفة ومستوى في النظام`
            : `Lookups synced: ${d.stats?.lookupsAdded || 0} lookups added/verified`,
        );
      } else if (scope === "movements_only") {
        toast.success(
          ar
            ? `تمت مزامنة الحركات: تم فحص الإجازات وتنفيذ ${d.stats?.departedAutoCheckouts || 0} إخلاء للتصفية (بدون تعديل بروفايلات)`
            : `Movements synced: ${d.stats?.departedAutoCheckouts || 0} checkouts executed (profiles untouched)`,
        );
      } else {
        toast.success(
          ar
            ? `اكتملت المزامنة الشاملة: ${d.stats?.created || 0} موظف جديد، ${d.stats?.updated || 0} تحديث${d.stats?.casualUpgrades ? `، وترقية ${d.stats.casualUpgrades} عمالة مؤقتة (Casual -> دائم)` : ""}${d.stats?.departedAutoCheckouts ? `، وإخلاء ${d.stats.departedAutoCheckouts} غرف` : ""}`
            : `Full sync complete: ${d.stats?.created || 0} created, ${d.stats?.updated || 0} updated${d.stats?.casualUpgrades ? `, ${d.stats.casualUpgrades} casual upgraded` : ""}${d.stats?.departedAutoCheckouts ? `, ${d.stats.departedAutoCheckouts} checkouts` : ""}`,
        );
      }

      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["rooms"] });
      queryClient.invalidateQueries({ queryKey: ["assignments"] });
      queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      queryClient.invalidateQueries({ queryKey: ["lookup_values"] });
      loadConfig();
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
      setActiveSyncType(null);
    }
  };

  // Test Connection
  const handleTestConnection = async (apiUrl: string, apiKey?: string) => {
    if (!apiUrl) {
      toast.error(ar ? "يرجى إدخال الرابط أولاً" : "Please provide API URL");
      return;
    }
    setTestingConnection(true);
    setTestResult(null);
    try {
      const resp = await fetch("/api/hr-sync/test-connection", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ apiUrl, apiKey }),
      });
      const data = await resp.json();
      setTestResult(data);
      setIsTestModalOpen(true);
      if (resp.ok && data.success) {
        toast.success(ar ? "الاتصال بالرابط ناجح!" : "Connection successful!");
      } else {
        toast.error(data.error || (ar ? "فشل الاتصال بالرابط" : "Connection failed"));
      }
    } catch (err: any) {
      toast.error(err.message || "Test connection failed");
    } finally {
      setTestingConnection(false);
    }
  };

  // Quick Action: Setup 3 Demo Mock Feeds (Al-Taj, White Hills, Al-Marafe)
  const setupDemoFeeds = () => {
    const demoSources: HrSourceConfig[] = [
      {
        id: "source_taj",
        name: ar ? "فندق التاج (Al-Taj Hotel)" : "Al-Taj Hotel",
        apiUrl: "/api/hr-sync/mock-feed?hotel=al_taj",
        targetPropertyIds: propertyId ? [propertyId] : [1],
        syncProfiles: true,
        allowedLevels: ["0", "1", "2", "4"],
        housingEligibleOnly: true,
        autoCheckoutOnDeparture: true,
        autoVacationSync: true,
        isActive: true,
      },
      {
        id: "source_white_hills",
        name: ar ? "فندق وايت هيلز (White Hills Hotel)" : "White Hills Hotel",
        apiUrl: "/api/hr-sync/mock-feed?hotel=white_hills",
        targetPropertyIds: propertyId ? [propertyId] : [1],
        syncProfiles: true,
        allowedLevels: ["1", "2"],
        housingEligibleOnly: true,
        autoCheckoutOnDeparture: true,
        autoVacationSync: true,
        isActive: true,
      },
      {
        id: "source_marafe",
        name: ar ? "فندق المرافئ (Al-Marafe Hotel)" : "Al-Marafe Hotel",
        apiUrl: "/api/hr-sync/mock-feed?hotel=al_marafe",
        targetPropertyIds: propertyId ? [propertyId] : [1],
        syncProfiles: false, // Movements only: test sync without profiles
        allowedLevels: [],
        housingEligibleOnly: false,
        autoCheckoutOnDeparture: true,
        autoVacationSync: true,
        isActive: true,
      },
    ];

    setSources(demoSources);
    setIsActive(true);
    saveConfig(demoSources);
    toast.success(
      ar
        ? "تم تحميل روابط الـ Mock التجريبية لـ 3 فنادق (التاج، وايت هيلز، المرافئ) بنجاح!"
        : "Demo mock sources for 3 hotels loaded successfully!",
    );
  };

  // Open Dialog for New Source
  const handleAddNewSource = () => {
    setEditingSource({
      id: `source_${Date.now()}`,
      name: "",
      apiUrl: "",
      apiKey: "",
      targetPropertyIds: propertyId ? [propertyId] : [],
      syncProfiles: true,
      allowedLevels: [],
      allowedDepartments: [],
      housingEligibleOnly: false,
      autoCheckoutOnDeparture: true,
      autoVacationSync: true,
      isActive: true,
    });
    setIsDialogOpen(true);
  };

  // Open Dialog for Editing Source
  const handleEditSource = (src: HrSourceConfig) => {
    setEditingSource({ ...src });
    setIsDialogOpen(true);
  };

  // Delete Source
  const handleDeleteSource = (id: string) => {
    const updated = sources.filter((s) => s.id !== id);
    setSources(updated);
    saveConfig(updated);
    toast.success(ar ? "تم حذف الرابط بنجاح" : "HR source removed");
  };

  // Save Source from Dialog
  const handleSaveSourceDialog = () => {
    if (!editingSource) return;
    if (!editingSource.name.trim() || !editingSource.apiUrl.trim()) {
      toast.error(ar ? "يرجى كتابة اسم المصدر ورابط الـ API" : "Name and API URL are required");
      return;
    }

    const existingIndex = sources.findIndex((s) => s.id === editingSource.id);
    let updatedSources = [...sources];
    if (existingIndex >= 0) {
      updatedSources[existingIndex] = editingSource;
    } else {
      updatedSources.push(editingSource);
    }

    setSources(updatedSources);
    saveConfig(updatedSources);
    setIsDialogOpen(false);
    setEditingSource(null);
  };

  return (
    <Card className="shadow-sm border-border/60">
      <CardHeader>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <CardTitle className="flex items-center gap-2.5 text-lg font-bold">
              <RefreshCw className="w-5 h-5 text-primary animate-pulse" />
              {ar ? "منظومة الربط الشامل مع الموارد البشرية (HR Multi-Database Sync)" : "HR Multi-Source Integration Hub"}
            </CardTitle>
            <CardDescription className="mt-1">
              {ar
                ? "ربط عدة قواعد بيانات وفنادق في نفس السكن، وفلترة المستويات (سكن القيادات)، وترقية العمالة المؤقتة (Casual -> دائم) مع الحفاظ على التسكين، والتحكم في عزل البروفايلات."
                : "Multi-hotel HR integration: executive level filters, casual-to-permanent upgrades, and movements/lookups sync."}
            </CardDescription>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <Button
              variant="outline"
              size="sm"
              onClick={setupDemoFeeds}
              className="gap-1.5 text-xs border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10"
            >
              <FlaskConical className="w-3.5 h-3.5" />
              {ar ? "تحميل روابط تجريبية (Mock 3 Hotels)" : "Load 3 Hotel Feeds"}
            </Button>
            <Button
              size="sm"
              onClick={handleAddNewSource}
              className="gap-1.5 text-xs shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              {ar ? "إضافة رابط HR جديد" : "Add HR Source"}
            </Button>
          </div>
        </div>

        {/* Target Hotel Selector Banner */}
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 bg-muted/50 rounded-xl border border-border/70 mt-3">
          <div className="flex items-center gap-2.5 flex-wrap">
            <div className="flex items-center gap-1.5 font-bold text-xs text-foreground">
              <Building2 className="w-4 h-4 text-primary" />
              <span>{ar ? "الفندق المراد إدارته وضبط ربطه:" : "Active Target Hotel:"}</span>
            </div>
            <Select value={String(effectiveHotelId)} onValueChange={(val) => handleHotelChange(Number(val))}>
              <SelectTrigger className="h-8 text-xs bg-background min-w-[220px] font-semibold shadow-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {validProperties.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                    {p.name} {p.code ? `[${p.code}]` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">{ar ? "كود الفندق بالنظام:" : "Hotel System Code:"}</span>
            <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30 bg-primary/5">
              {esignHotelCode || currentHotel?.code || "N/A"}
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-6">
        {/* Global Operational Toggles */}
        <div className="grid gap-4 sm:grid-cols-3 bg-muted/40 p-4 rounded-xl border border-border/50">
          <div className="flex items-center justify-between p-2">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold block">
                {ar ? "حالة الربط العام:" : "Master Sync State:"}
              </span>
              <p className="text-xs text-muted-foreground">
                {isActive
                  ? ar
                    ? "الربط الآلي نشط وجاهز"
                    : "Enabled & Active"
                  : ar
                    ? "الربط متوقف حالياً"
                    : "Disabled"}
              </p>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant={isActive ? "default" : "secondary"}>
                {isActive ? (ar ? "مفعّل" : "Active") : ar ? "متوقف" : "Disabled"}
              </Badge>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>

          <div className="flex items-center justify-between p-2 border-t sm:border-t-0 sm:border-r border-border/50">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <LogOut className="w-3.5 h-3.5 text-red-500" />
                {ar ? "إخلاء الغرفة عند التصفية:" : "Auto-Checkout on Departure:"}
              </span>
              <p className="text-xs text-muted-foreground">
                {ar ? "إخلاء السرير وتحويل الغرفة لمتسخة فوراً" : "Release bed & set room dirty"}
              </p>
            </div>
            <Switch
              checked={autoCheckoutOnDeparture}
              onCheckedChange={setAutoCheckoutOnDeparture}
            />
          </div>

          <div className="flex items-center justify-between p-2 border-t sm:border-t-0 sm:border-r border-border/50">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <Calendar className="w-3.5 h-3.5 text-amber-500" />
                {ar ? "مزامنة الإجازات تلقائياً:" : "Auto Vacation Sync:"}
              </span>
              <p className="text-xs text-muted-foreground">
                {ar ? "تحويل الغرفة لـ occupied_vacation" : "Sync occupied_vacation status"}
              </p>
            </div>
            <Switch
              checked={autoVacationSync}
              onCheckedChange={setAutoVacationSync}
            />
          </div>
        </div>

        {/* ================================================================= */}
        {/* Sunrise e-Signature (Hotel HR API) Integration Hub               */}
        {/* ================================================================= */}
        <Card className="border-2 border-primary/20 bg-linear-to-b from-primary/5 via-card to-card shadow-sm">
          <CardHeader className="pb-3">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="space-y-1">
                <CardTitle className="text-base font-bold flex items-center gap-2 text-foreground">
                  <div className="p-1.5 rounded-lg bg-primary/10 text-primary">
                    <Building2 className="w-5 h-5" />
                  </div>
                  <span>
                    {ar
                      ? "الربط الفندقي المباشر (Sunrise e-Signature Employee API)"
                      : "Sunrise Hotel HR e-Signature Integration"}
                  </span>
                  <Badge variant={esignIsActive ? "default" : "secondary"} className="text-[10px]">
                    {esignIsActive ? (ar ? "نشط" : "Active") : (ar ? "معطل" : "Disabled")}
                  </Badge>
                </CardTitle>
                <CardDescription className="text-xs">
                  {ar
                    ? "الربط مع سيرفر الموارد البشرية الفندقي لجلب وتحديث بيانات الموظفين بالرقم الوظيفي (Clock Number)، والاستيراد بالنطاق، والتحديث الشامل."
                    : "Direct connection to fetch employee records by Clock Number, execute range imports, and batch update profiles."}
                </CardDescription>
              </div>

              <div className="flex items-center gap-2">
                <span className="text-xs text-muted-foreground">{ar ? "تفعيل الربط:" : "Enable:"}</span>
                <Switch checked={esignIsActive} onCheckedChange={setEsignIsActive} />
              </div>
            </div>
          </CardHeader>

          <CardContent className="space-y-5 pt-1">
            {/* Step 1: Connection Credentials */}
            <div className="p-4 rounded-xl bg-card border border-border/70 space-y-4">
              <div className="flex items-center justify-between flex-wrap gap-2">
                <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <KeyRound className="w-3.5 h-3.5 text-primary" />
                  {ar ? "بيانات الدخول وسيرفر الفندق (Zero-Hardcode):" : "Server & Hotel Credentials:"}
                </h4>
                {validProperties.length > 1 && (
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] text-muted-foreground hidden sm:inline">
                      {ar ? "تسريع الإعداد:" : "Quick Setup:"}
                    </span>
                    <Select onValueChange={(val) => copyCredentialsFromOtherHotel(Number(val))}>
                      <SelectTrigger className="h-7 text-[11px] w-[210px] bg-muted/40 border-dashed text-foreground">
                        <SelectValue placeholder={ar ? "نسخ رابط وحساب فندق آخر..." : "Copy from another hotel..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {validProperties
                          .filter((p) => p.id !== effectiveHotelId)
                          .map((p) => (
                            <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                              {ar ? `نسخ من: ${p.name}` : `Copy from: ${p.name}`}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
              </div>

              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {ar ? "رابط سيرفر الـ HR (API URL):" : "API Base URL:"}
                  </label>
                  <Input
                    value={esignBaseUrl}
                    onChange={(e) => setEsignBaseUrl(e.target.value)}
                    placeholder="https://signature-backend.sunrise-resorts.com/api"
                    className="h-9 text-xs font-mono"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {ar ? "اسم المستخدم / البريد (Username/Email):" : "Username / Email:"}
                  </label>
                  <Input
                    value={esignUsername}
                    onChange={(e) => setEsignUsername(e.target.value)}
                    placeholder="housing.hr@sunrise-resorts.com"
                    className="h-9 text-xs"
                    dir="ltr"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {ar ? "كلمة المرور (Password):" : "Password:"}
                  </label>
                  <div className="relative">
                    <Input
                      type={showEsignPassword ? "text" : "password"}
                      value={esignPassword}
                      onChange={(e) => setEsignPassword(e.target.value)}
                      placeholder="••••••••"
                      className="h-9 text-xs pr-8"
                      dir="ltr"
                    />
                    <button
                      type="button"
                      onClick={() => setShowEsignPassword(!showEsignPassword)}
                      className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground"
                    >
                      {showEsignPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-foreground">
                    {ar ? "كود الفندق (Hotel Code):" : "Hotel Code:"}
                  </label>
                  <Input
                    value={esignHotelCode}
                    onChange={(e) => setEsignHotelCode(e.target.value.toUpperCase())}
                    placeholder={ar ? "مثال: CO أو DR أو RB" : "e.g. CO, DR, RB"}
                    className="h-9 text-xs font-mono uppercase"
                    dir="ltr"
                  />
                </div>
              </div>

              {/* Action Buttons & Feedback */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleTestEsign}
                    disabled={testingEsign}
                    className="gap-1.5 text-xs h-9 border-amber-500/40 hover:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                  >
                    {testingEsign ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
                    )}
                    {ar ? "اختبار الاتصال والفندق" : "Test Hotel Connection"}
                  </Button>

                  <Button
                    type="button"
                    size="sm"
                    onClick={saveEsignSettings}
                    disabled={savingEsign}
                    className="gap-1.5 text-xs h-9"
                  >
                    {savingEsign ? (
                      <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    ) : (
                      <Check className="w-3.5 h-3.5" />
                    )}
                    {ar ? "حفظ بيانات الربط" : "Save Credentials"}
                  </Button>
                </div>

                {esignTestResult && (
                  <div
                    className={`p-2 px-3 rounded-lg border text-xs flex items-center gap-2 ${
                      esignTestResult.success
                        ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                        : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
                    }`}
                  >
                    {esignTestResult.success ? (
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                    ) : (
                      <AlertTriangle className="w-4 h-4 shrink-0" />
                    )}
                    <span>{esignTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>

            {/* Step 2: Range Sync & Batch Refresh Grid */}
            <div className="grid gap-4 md:grid-cols-2">
              {/* Feature 1: Range-Based Sync */}
              <div className="p-4 rounded-xl bg-card border border-border/70 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-400">
                      <Hash className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {ar ? "الاستيراد والتحديث بالنطاق (Range Sync):" : "Range-Based Import & Sync:"}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {ar
                          ? "فحص واستيراد/تحديث الموظفين من كود معين إلى كود معين"
                          : "Scan & import/update employees between two clock numbers"}
                      </p>
                    </div>
                  </div>

                  {/* Target Hotel for Range Import */}
                  <div className="space-y-1.5 pt-1">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                        <Building2 className="w-3.5 h-3.5 text-primary" />
                        {ar ? "الفندق المستهدف للاستيراد:" : "Target Hotel for Range:"}
                      </span>
                      {(() => {
                        const targetHotelObj = validProperties.find((p) => p.id === rangeHotelId);
                        return targetHotelObj?.code ? (
                          <Badge variant="outline" className="text-[10px] font-mono font-bold text-primary border-primary/30">
                            Code: {targetHotelObj.code}
                          </Badge>
                        ) : null;
                      })()}
                    </div>
                    <Select
                      value={String(rangeHotelId)}
                      onValueChange={(val) => setRangeHotelId(Number(val))}
                    >
                      <SelectTrigger className="h-8 text-xs bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {validProperties.map((p) => (
                          <SelectItem key={p.id} value={String(p.id)} className="text-xs">
                            {p.name} {p.code ? `[${p.code}]` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="grid grid-cols-2 gap-2 pt-1">
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {ar ? "من الرقم الوظيفي:" : "From Clock No:"}
                      </span>
                      <Input
                        value={rangeFrom}
                        onChange={(e) => setRangeFrom(e.target.value)}
                        placeholder="1001"
                        className="h-9 text-xs font-mono"
                        dir="ltr"
                      />
                    </div>
                    <div className="space-y-1">
                      <span className="text-[11px] text-muted-foreground font-medium">
                        {ar ? "إلى الرقم الوظيفي:" : "To Clock No:"}
                      </span>
                      <Input
                        value={rangeTo}
                        onChange={(e) => setRangeTo(e.target.value)}
                        placeholder="1100"
                        className="h-9 text-xs font-mono"
                        dir="ltr"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleRangeSync}
                    disabled={isRangeSyncing || !rangeFrom || !rangeTo}
                    className="w-full gap-1.5 text-xs h-9 border border-primary/20 bg-primary/10 hover:bg-primary/20 text-primary font-semibold"
                  >
                    {isRangeSyncing ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>{ar ? "جارٍ فحص واستيراد النطاق..." : "Scanning Range..."}</span>
                      </>
                    ) : (
                      <>
                        <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                        <span>{ar ? "بدء فحص واستيراد النطاق" : "Start Range Scan & Sync"}</span>
                      </>
                    )}
                  </Button>

                  {rangeSyncResult && (
                    <div className="p-2.5 rounded-lg bg-muted/40 border text-[11px] space-y-1">
                      <div className="flex items-center justify-between font-semibold text-foreground">
                        <span>{ar ? "نتيجة الاستيراد:" : "Sync Summary:"}</span>
                        <Badge variant="outline" className="text-[10px]">
                          {rangeSyncResult.scannedCount} {ar ? "رقم تم فحصه" : "scanned"}
                        </Badge>
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-muted-foreground pt-1">
                        <div>
                          {ar ? "وُجد في الـ HR: " : "Found in HR: "}
                          <span className="font-bold text-foreground">{rangeSyncResult.foundCount}</span>
                        </div>
                        <div>
                          {ar ? "غير موجود: " : "Not Found: "}
                          <span className="font-bold text-foreground">{rangeSyncResult.notFoundCount}</span>
                        </div>
                        <div>
                          {ar ? "ملفات جديدة: " : "Created: "}
                          <span className="font-bold text-emerald-600 dark:text-emerald-400">
                            {rangeSyncResult.stats?.created || 0}
                          </span>
                        </div>
                        <div>
                          {ar ? "ملفات تم تحديثها: " : "Updated: "}
                          <span className="font-bold text-blue-600 dark:text-blue-400">
                            {rangeSyncResult.stats?.updated || 0}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Feature 2: Batch Refresh for Existing Profiles */}
              <div className="p-4 rounded-xl bg-card border border-border/70 space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <div className="p-1 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
                      <RefreshCw className="w-4 h-4" />
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-foreground">
                        {ar ? "تحديث وتصحيح بيانات الموظفين الحاليين:" : "Batch Refresh Existing Residents:"}
                      </h4>
                      <p className="text-[11px] text-muted-foreground">
                        {ar
                          ? "زر خاص للسوبر أدمن وإدارة الـ HR لتحديث كافة البروفايلات وتصحيح أي بيانات خاطئة دورياً"
                          : "Periodic verification & data correction against HR server"}
                      </p>
                    </div>
                  </div>

                  <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                    {ar
                      ? "يقوم بتمرير كافة الأرقام الوظيفية لملفات السكن الحالية على سيرفر الموارد البشرية، وتحديث (المسميات، الأقسام، الهواتف، العناوين، انتهاء العقود) مع الحفاظ التام على التسكين والغرف."
                      : "Scans all current housing profiles against HR and refreshes contact info, job titles, and departments with zero impact on room assignments."}
                  </p>
                </div>

                <div className="space-y-2 pt-2 border-t border-border/50">
                  <PermissionGate module="hr_sync" action="edit">
                    <Button
                      type="button"
                      variant="default"
                      size="sm"
                      onClick={() => setShowBatchConfirm(true)}
                      disabled={isBatchRefreshing}
                      className="w-full gap-1.5 text-xs h-9 font-semibold"
                    >
                      {isBatchRefreshing ? (
                        <>
                          <Loader2 className="w-3.5 h-3.5 animate-spin" />
                          <span>{ar ? "جارٍ التحديث الشامل لكافة الموظفين..." : "Batch Refreshing..."}</span>
                        </>
                      ) : (
                        <>
                          <RefreshCw className="w-3.5 h-3.5" />
                          <span>
                            {ar
                              ? "🔄 فحص وتحديث بيانات موظفي السكن الحاليين"
                              : "Refresh All Existing Profiles"}
                          </span>
                        </>
                      )}
                    </Button>
                  </PermissionGate>

                  {batchRefreshResult && (
                    <div className="p-2.5 rounded-lg bg-emerald-500/10 border border-emerald-500/30 text-[11px] space-y-1 text-emerald-800 dark:text-emerald-300">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{ar ? "اكتمل التحديث الشامل:" : "Refresh Completed:"}</span>
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                      </div>
                      <div className="grid grid-cols-2 gap-1 text-[11px] pt-1">
                        <div>
                          {ar ? "تم فحصهم: " : "Checked: "}
                          <span className="font-bold">{batchRefreshResult.totalChecked}</span>
                        </div>
                        <div>
                          {ar ? "تم تصحيح وتحديث: " : "Updated: "}
                          <span className="font-bold">{batchRefreshResult.updatedCount}</span>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Operations Action Bar */}
        <div className="p-4 bg-background rounded-xl border border-primary/20 shadow-sm space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <span className="text-xs font-bold uppercase tracking-wider text-primary flex items-center gap-1.5">
              <Zap className="w-4 h-4 text-amber-500" />
              {ar ? "عمليات المزامنة السريعة والمخصصة:" : "Specialized Sync Operations:"}
            </span>
            <span className="text-xs text-muted-foreground">
              {ar
                ? `المصادر النشطة: ${sources.filter((s) => s.isActive).length} من ${sources.length}`
                : `Active sources: ${sources.filter((s) => s.isActive).length} / ${sources.length}`}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {/* Action 1: Full Sync */}
            <Button
              variant="default"
              onClick={() => triggerSync("full")}
              disabled={syncing || !isActive || sources.length === 0}
              className="h-auto py-3 px-4 flex flex-col items-start gap-1 justify-center text-left"
            >
              <div className="flex items-center gap-2 font-semibold text-xs">
                <RefreshCw
                  className={`w-3.5 h-3.5 ${syncing && activeSyncType === "full" ? "animate-spin" : ""}`}
                />
                {ar ? "🔄 مزامنة شاملة لكافة المصادر" : "🔄 Sync All Sources (Full)"}
              </div>
              <span className="text-[11px] opacity-80 font-normal">
                {ar ? "بروفايلات + إجازات + تصفيات + ترقيات عمالة" : "Profiles + vacations + departures"}
              </span>
            </Button>

            {/* Action 2: Movements Only */}
            <Button
              variant="secondary"
              onClick={() => triggerSync("movements_only")}
              disabled={syncing || !isActive || sources.length === 0}
              className="h-auto py-3 px-4 flex flex-col items-start gap-1 justify-center text-left border border-border/80"
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-amber-600 dark:text-amber-400">
                <Calendar className="w-3.5 h-3.5" />
                {ar ? "🏖️ مزامنة الإجازات والتصفيات فقط" : "🏖️ Movements Only (No Profiles)"}
              </div>
              <span className="text-[11px] text-muted-foreground font-normal">
                {ar ? "إخلاءات وتحديث إجازات دون لمس البروفايلات" : "Checkouts & leaves without altering profiles"}
              </span>
            </Button>

            {/* Action 3: Lookups Only */}
            <Button
              variant="outline"
              onClick={() => triggerSync("lookups_only")}
              disabled={syncing || !isActive || sources.length === 0}
              className="h-auto py-3 px-4 flex flex-col items-start gap-1 justify-center text-left border-border/80"
            >
              <div className="flex items-center gap-2 font-semibold text-xs text-primary">
                <Tag className="w-3.5 h-3.5" />
                {ar ? "🏷️ مزامنة المسميات والأقسام فقط" : "🏷️ Lookups Only (Dept & Titles)"}
              </div>
              <span className="text-[11px] text-muted-foreground font-normal">
                {ar ? "تسجيل مسميات الوظائف والدرجات في الإعدادات" : "Auto-populate departments & titles"}
              </span>
            </Button>
          </div>
        </div>

        {/* ================================================================= */}
        {/* Multi-Hotel System Matrix (Registered Hotels & HR Connection)     */}
        {/* ================================================================= */}
        <div className="space-y-3 pt-1">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <div>
              <h3 className="text-sm font-semibold flex items-center gap-2">
                <Building2 className="w-4 h-4 text-primary" />
                {ar ? "فنادق المنظومة وحالة ربط الـ HR (Registered Hotels Matrix):" : "Registered Hotels & HR Connection Matrix:"}
              </h3>
              <p className="text-[11px] text-muted-foreground mt-0.5">
                {ar
                  ? "يمكنك إدارة بيانات الربط والكود الوظيفي والاستيراد لكل فندق على حدة باختياره أدناه:"
                  : "Manage credentials, hotel codes, and range import individually for each hotel:"}
              </p>
            </div>
            <Badge variant="outline" className="text-xs font-semibold">
              {ar ? `${validProperties.length} فنادق مسجلة` : `${validProperties.length} Registered Hotels`}
            </Badge>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {validProperties.map((p) => {
              const isSelected = p.id === effectiveHotelId;
              const isRangeSelected = p.id === rangeHotelId;
              const hotelCode = isSelected && esignHotelCode ? esignHotelCode : (p.code || "N/A");

              return (
                <Card
                  key={p.id}
                  className={`border transition-all shadow-xs ${
                    isSelected
                      ? "ring-2 ring-primary border-primary bg-primary/5"
                      : "hover:border-border/90 bg-card"
                  }`}
                >
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-start justify-between gap-2">
                      <div className="space-y-0.5 min-w-0">
                        <CardTitle className="text-sm font-bold flex items-center gap-1.5 truncate">
                          <Building2 className={`w-4 h-4 shrink-0 ${isSelected ? "text-primary" : "text-muted-foreground"}`} />
                          <span className="truncate">{p.name}</span>
                        </CardTitle>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {p.displayName || p.name}
                        </p>
                      </div>
                      <Badge
                        variant={isSelected ? "default" : "outline"}
                        className="text-[10px] shrink-0"
                      >
                        {isSelected ? (ar ? "محدد حالياً" : "Active") : `#${p.id}`}
                      </Badge>
                    </div>
                  </CardHeader>

                  <CardContent className="p-4 pt-1 space-y-3">
                    <div className="flex items-center justify-between text-xs pt-1">
                      <span className="text-muted-foreground">{ar ? "كود الفندق في الـ HR:" : "HR Hotel Code:"}</span>
                      <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30 bg-primary/5">
                        {hotelCode}
                      </Badge>
                    </div>

                    <Separator />

                    <div className="flex items-center justify-between gap-2 pt-1">
                      <Button
                        size="sm"
                        variant={isSelected ? "secondary" : "outline"}
                        onClick={() => handleHotelChange(p.id)}
                        className="h-7 text-xs gap-1 flex-1 font-medium"
                      >
                        <Edit className="w-3 h-3" />
                        {isSelected
                          ? (ar ? "قيد التعديل أعلاه" : "Editing Above")
                          : (ar ? "ضبط بيانات هذا الفندق" : "Configure This Hotel")}
                      </Button>

                      <Button
                        size="sm"
                        variant={isRangeSelected ? "default" : "ghost"}
                        onClick={() => {
                          setRangeHotelId(p.id);
                          toast.info(
                            ar
                              ? `تم اختيار فندق "${p.name}" في خانة الاستيراد بالنطاق (Range Sync)`
                              : `Selected ${p.name} for Range Import`,
                          );
                        }}
                        className={`h-7 text-xs gap-1 px-2.5 ${isRangeSelected ? "bg-primary text-primary-foreground" : "text-primary hover:bg-primary/10"}`}
                        title={ar ? "تحديد هذا الفندق لاستيراد نطاق الأرقام الوظيفية" : "Select for range import"}
                      >
                        <Hash className="w-3 h-3" />
                        {ar ? "سحب نطاق" : "Range"}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>

        <Separator />

        {/* Custom API Sources Section */}
        <div className="space-y-3">
          <div className="flex items-center justify-between flex-wrap gap-2">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              {ar ? "مصادر وروابط مزامنة مخصصة (Custom External Feeds):" : "Custom External Feeds & Legacy Sources:"}
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-muted-foreground">
                {ar ? `المصادر: ${sources.length}` : `Sources: ${sources.length}`}
              </span>
              <Button size="sm" variant="outline" onClick={handleAddNewSource} className="h-7 text-xs gap-1">
                <Plus className="w-3 h-3" />
                {ar ? "إضافة مصدر" : "Add Source"}
              </Button>
            </div>
          </div>

          {sources.length === 0 ? (
            <div className="text-center py-6 px-4 border border-dashed rounded-xl bg-muted/20 space-y-2">
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "لا توجد مصادر مخصصة إضافية. نظام الربط الفندقي المباشر (Sunrise e-Signature API) يعمل لجميع الفنادق أعلاه."
                  : "No custom feeds configured. The direct Sunrise e-Signature API handles all registered hotels above."}
              </p>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button size="sm" variant="ghost" onClick={setupDemoFeeds} className="h-7 text-xs text-amber-600 gap-1">
                  <FlaskConical className="w-3 h-3" />
                  {ar ? "تحميل روابط تجريبية (Demo Mock)" : "Load Demo Mock Feeds"}
                </Button>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {sources.map((src) => {
                const isSrcSyncing = syncing && activeSyncType?.includes(src.id);
                return (
                  <Card
                    key={src.id}
                    className={`border transition-all shadow-xs ${src.isActive ? "border-border/80" : "opacity-60 bg-muted/30"}`}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 truncate">
                            <Building2 className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{src.name}</span>
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[220px] mt-0.5">
                            {src.apiUrl}
                          </p>
                        </div>
                        <Badge variant={src.isActive ? "default" : "secondary"} className="text-[10px] shrink-0">
                          {src.isActive ? (ar ? "نشط" : "Active") : ar ? "متوقف" : "Off"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      <div className="space-y-1.5 pt-1 text-[11px]">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-muted-foreground">{ar ? "السكن المستهدف:" : "Target:"}</span>
                          {src.targetPropertyIds && src.targetPropertyIds.length > 0 ? (
                            src.targetPropertyIds.map((pid) => {
                              const prop = properties?.find((p: any) => p.id === pid);
                              return (
                                <Badge key={pid} variant="outline" className="text-[10px] bg-background">
                                  {prop?.displayName || prop?.name || `#${pid}`}
                                </Badge>
                              );
                            })
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              {ar ? "كافة العقارات" : "All Properties"}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-muted-foreground">{ar ? "البروفايلات:" : "Profiles:"}</span>
                          {src.syncProfiles !== false ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                              {ar ? "استيراد كامل" : "Enabled"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5">
                              {ar ? "حركات فقط" : "Movements only"}
                            </Badge>
                          )}
                        </div>
                      </div>

                      <Separator />

                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => triggerSync("full", src.id)}
                            disabled={syncing || !src.isActive}
                            className="h-7 text-xs gap-1 px-2"
                          >
                            <RefreshCw className={`w-3 h-3 ${isSrcSyncing ? "animate-spin" : ""}`} />
                            {ar ? "مزامنة" : "Sync"}
                          </Button>
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleTestConnection(src.apiUrl, src.apiKey)}
                            disabled={testingConnection}
                            className="h-7 text-xs gap-1 px-2"
                          >
                            <FlaskConical className="w-3 h-3 text-amber-500" />
                            {ar ? "اختبار" : "Test"}
                          </Button>
                        </div>

                        <div className="flex items-center gap-1">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleEditSource(src)}
                          >
                            <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                          </Button>
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 hover:text-red-500 hover:bg-red-500/10"
                            onClick={() => handleDeleteSource(src.id)}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Global Save Button */}
        <div className="flex justify-end gap-2 pt-2">
          <Button onClick={() => saveConfig()} className="gap-1.5">
            <CheckCircle2 className="w-4 h-4" />
            {ar ? "حفظ كافة الإعدادات والمصادر" : "Save All Configuration"}
          </Button>
        </div>

        <Separator />

        {/* Bilingual Step-by-Step Developer Integration Guide (Collapsible Drawer) */}
        <div className="border border-border/70 rounded-xl overflow-hidden bg-card shadow-xs">
          <button
            type="button"
            onClick={() => setShowDevGuide(!showDevGuide)}
            className="w-full p-4 flex items-center justify-between text-left hover:bg-muted/40 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10 text-primary">
                <ShieldAlert className="w-4 h-4" />
              </div>
              <div className="text-right sm:text-right rtl:text-right ltr:text-left">
                <span className="text-xs sm:text-sm font-bold block text-foreground">
                  {ar ? "دليل وروابط الـ Webhooks للمطورين والربط المباشر (Push APIs)" : "Developer Webhooks & Push Integration Guide"}
                </span>
                <span className="text-[11px] text-muted-foreground block mt-0.5">
                  {ar
                    ? `روابط الاستقبال الفوري مجهزة تلقائياً برقم الفندق المستهدف (#${effectiveHotelId} - ${currentHotel?.name || ""})`
                    : `Push webhook endpoints formatted for hotel #${effectiveHotelId} (${currentHotel?.name || ""})`}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="outline" className="text-[10px] hidden sm:inline-flex">
                {showDevGuide ? (ar ? "إخفاء التفاصيل" : "Hide Details") : (ar ? "عرض روابط المطورين" : "Show Webhooks")}
              </Badge>
              {showDevGuide ? <ChevronUp className="w-4 h-4 text-muted-foreground" /> : <ChevronDown className="w-4 h-4 text-muted-foreground" />}
            </div>
          </button>

          {showDevGuide && (
            <div className="p-4 pt-2 border-t border-border/60 space-y-4 bg-muted/20">
              <p className="text-xs text-muted-foreground leading-relaxed">
                {ar
                  ? "يدعم النظام استقبال البيانات الفورية (Push Webhooks) مباشرة من سيرفر الموارد البشرية عند حدوث أي تعديل أو إجازة أو استقالة. الروابط أدناه مجهزة تلقائياً بمعرّف الفندق المختار حالياً:"
                  : "The system supports instant Push Webhooks directly from HR servers. Below endpoints are tailored for the currently active hotel:"}
              </p>

              {/* Casual to Permanent Upgrade Feature Banner */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-1 text-xs">
                <div className="font-semibold text-primary flex items-center gap-1.5">
                  <Check className="w-4 h-4 text-emerald-500" />
                  {ar
                    ? "ميزة ترقية العمالة المؤقتة إلى تعيين رسمي (Casual -> Permanent Transition):"
                    : "Automatic Casual to Permanent Worker Transition:"}
                </div>
                <p className="text-muted-foreground text-[11px] leading-relaxed">
                  {ar
                    ? "عندما يبدأ الموظف بكود مؤقت (Casual مثل CAS-1042) ثم يتعين برقم وظيفي جديد (مثل EMP-8802)، يقوم النظام تلقائياً بالمطابقة بالرقم القومي (National ID). يتم تحديث رقم الموظف وحفظ رقمه السابق، مع الحفاظ الكامل على تسكينه وسريره الحالي وسجل إقامته دون أي انقطاع أو إخلاء!"
                    : "When an employee transitions from a casual worker code to a permanent ID with the same National ID, the system preserves their active room and bed assignment with zero interruption."}
                </p>
              </div>

              {/* Webhooks Cards with copy buttons and dynamic propertyId */}
              <div className="grid gap-3 md:grid-cols-3">
                {/* Webhook 1 */}
                <div className="bg-background rounded-xl p-3.5 border text-xs space-y-2.5 shadow-2xs">
                  <div className="font-semibold text-primary flex items-center justify-between">
                    <span>{ar ? "1. إرسال بروفايلات (Push)" : "1. Push Profiles"}</span>
                    <Badge variant="outline" className="text-[10px]">POST</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="block flex-1 bg-muted p-1.5 rounded font-mono text-[11px] text-foreground truncate" dir="ltr">
                      {`/api/hr-sync/receive?propertyId=${effectiveHotelId}`}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/api/hr-sync/receive?propertyId=${effectiveHotelId}`,
                          "webhook-1",
                        )
                      }
                      title={ar ? "نسخ الرابط بالكامل" : "Copy full URL"}
                    >
                      {copiedWebhook === "webhook-1" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {ar
                      ? "إرسال حزمة الموظفين بالكامل، مع صور البطاقات والأقسام."
                      : "Push employee profiles array with documents and jobs."}
                  </p>
                </div>

                {/* Webhook 2 */}
                <div className="bg-background rounded-xl p-3.5 border text-xs space-y-2.5 shadow-2xs">
                  <div className="font-semibold text-amber-600 dark:text-amber-400 flex items-center justify-between">
                    <span>{ar ? "2. إشعار إجازة (خروج / عودة)" : "2. Vacation Notice"}</span>
                    <Badge variant="outline" className="text-[10px]">POST</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="block flex-1 bg-muted p-1.5 rounded font-mono text-[11px] text-foreground truncate" dir="ltr">
                      {`/api/hr-sync/notify-vacation?propertyId=${effectiveHotelId}`}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/api/hr-sync/notify-vacation?propertyId=${effectiveHotelId}`,
                          "webhook-2",
                        )
                      }
                      title={ar ? "نسخ الرابط بالكامل" : "Copy full URL"}
                    >
                      {copiedWebhook === "webhook-2" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {ar
                      ? "تسجيل الإجازة وتحديث حالة الغرفة لـ occupied_vacation."
                      : "Sync vacation start/return & room occupied_vacation status."}
                  </p>
                </div>

                {/* Webhook 3 */}
                <div className="bg-background rounded-xl p-3.5 border text-xs space-y-2.5 shadow-2xs">
                  <div className="font-semibold text-red-600 dark:text-red-400 flex items-center justify-between">
                    <span>{ar ? "3. إشعار تصفية واستقالة" : "3. Departure Notice"}</span>
                    <Badge variant="outline" className="text-[10px]">POST</Badge>
                  </div>
                  <div className="flex items-center gap-1">
                    <code className="block flex-1 bg-muted p-1.5 rounded font-mono text-[11px] text-foreground truncate" dir="ltr">
                      {`/api/hr-sync/notify-departure?propertyId=${effectiveHotelId}`}
                    </code>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-7 w-7 shrink-0"
                      onClick={() =>
                        copyToClipboard(
                          `${window.location.origin}/api/hr-sync/notify-departure?propertyId=${effectiveHotelId}`,
                          "webhook-3",
                        )
                      }
                      title={ar ? "نسخ الرابط بالكامل" : "Copy full URL"}
                    >
                      {copiedWebhook === "webhook-3" ? (
                        <CheckCheck className="w-3.5 h-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="w-3.5 h-3.5" />
                      )}
                    </Button>
                  </div>
                  <p className="text-muted-foreground text-[11px] leading-relaxed">
                    {ar
                      ? "Check-out تلقائي وإخلاء السرير وتحويل الغرفة لمتسخة."
                      : "Auto check-out, release bed, and set room to dirty."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>

      {/* Dialog for Adding / Editing an HR Source */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Building2 className="w-5 h-5 text-primary" />
              {editingSource?.name
                ? ar
                  ? `تعديل المصدر: ${editingSource.name}`
                  : `Edit Source: ${editingSource.name}`
                : ar
                  ? "إضافة مصدر HR / فندق جديد"
                  : "Add New HR Source"}
            </DialogTitle>
            <DialogDescription>
              {ar
                ? "تحديد رابط الـ API والفندق المستهدف وفلاتر المستويات الوظيفية (مثل سكن القيادات)."
                : "Set API endpoint, target housing properties, and executive level filters."}
            </DialogDescription>
          </DialogHeader>

          {editingSource && (
            <div className="space-y-4 py-2 text-xs">
              {/* Name & Active State */}
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold mb-1 block">
                    {ar ? "اسم المصدر / الفندق *" : "Source / Hotel Name *"}
                  </label>
                  <Input
                    value={editingSource.name}
                    onChange={(e) =>
                      setEditingSource({ ...editingSource, name: e.target.value })
                    }
                    placeholder={ar ? "مثال: فندق التاج أو وايت هيلز" : "e.g. Al-Taj Hotel"}
                  />
                </div>
                <div>
                  <label className="font-semibold mb-1 block">
                    {ar ? "الحالة" : "Status"}
                  </label>
                  <div className="flex items-center justify-between border rounded-md p-2 h-9">
                    <span className="text-[11px] font-medium">
                      {editingSource.isActive ? (ar ? "نشط" : "Active") : ar ? "معطل" : "Off"}
                    </span>
                    <Switch
                      checked={editingSource.isActive ?? true}
                      onCheckedChange={(c) =>
                        setEditingSource({ ...editingSource, isActive: c })
                      }
                    />
                  </div>
                </div>
              </div>

              {/* API Endpoint & Key */}
              <div className="space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="font-semibold">
                      {ar ? "رابط الـ API (GET Endpoint) *" : "HR API Endpoint URL (GET) *"}
                    </label>
                    <button
                      type="button"
                      onClick={() =>
                        setEditingSource({
                          ...editingSource,
                          apiUrl: "/api/hr-sync/mock-feed?hotel=al_taj",
                        })
                      }
                      className="text-[10px] text-primary hover:underline"
                    >
                      {ar ? "استخدام رابط تجريبي (Mock)" : "Use Mock Feed"}
                    </button>
                  </div>
                  <Input
                    value={editingSource.apiUrl}
                    onChange={(e) =>
                      setEditingSource({ ...editingSource, apiUrl: e.target.value })
                    }
                    placeholder="https://hr-system.com/api/employees"
                    className="font-mono text-xs"
                  />
                </div>

                <div>
                  <label className="font-semibold mb-1 block">
                    {ar ? "مفتاح الربط (API Key / Bearer Token)" : "API Key / Bearer Token"}
                  </label>
                  <Input
                    type="password"
                    value={editingSource.apiKey || ""}
                    onChange={(e) =>
                      setEditingSource({ ...editingSource, apiKey: e.target.value })
                    }
                    placeholder="••••••••••••••••"
                  />
                </div>
              </div>

              {/* Target Housing Properties */}
              <div className="space-y-1.5 p-3 rounded-xl bg-muted/40 border">
                <label className="font-semibold block">
                  {ar ? "السكن المستهدف (الفنادق والعقارات التي يسكن بها هذا المصدر):" : "Target Housing Properties:"}
                </label>
                <div className="grid gap-2 sm:grid-cols-2 pt-1">
                  {properties?.map((prop: any) => {
                    const isChecked = editingSource.targetPropertyIds?.includes(prop.id) ?? false;
                    return (
                      <label
                        key={prop.id}
                        className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-background border border-transparent hover:border-border transition-colors"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const cur = editingSource.targetPropertyIds || [];
                            const next = checked
                              ? [...cur, prop.id]
                              : cur.filter((id) => id !== prop.id);
                            setEditingSource({ ...editingSource, targetPropertyIds: next });
                          }}
                        />
                        <span className="text-xs font-medium">
                          {prop.displayName || prop.name}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Switch: Sync Profiles ON/OFF */}
              <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                <div className="space-y-0.5 max-w-[400px]">
                  <span className="font-semibold block">
                    {ar ? "مزامنة واستيراد البروفايلات (Sync Profiles):" : "Import & Sync Profiles:"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "إذا تم إيقافه، سيتم فقط مزامنة الإجازات والتصفيات والخروج التلقائي دون إضافة موظفين جدد إلى قاعدة البيانات."
                      : "When disabled, only vacations & departures will sync without creating or overwriting employee profiles."}
                  </p>
                </div>
                <Switch
                  checked={editingSource.syncProfiles !== false}
                  onCheckedChange={(c) =>
                    setEditingSource({ ...editingSource, syncProfiles: c })
                  }
                />
              </div>

              {/* Executive Job Level Filter */}
              <div className="space-y-2 p-3 rounded-xl border bg-background">
                <div className="flex items-center justify-between">
                  <label className="font-semibold block text-primary">
                    {ar ? "فلاتر الدرجات الوظيفية (سكن القيادات):" : "Job Level Filters (Executive Housing):"}
                  </label>
                  <span className="text-[10px] text-muted-foreground">
                    {ar ? "اتركه فارغاً للسماح للكل" : "Leave empty to allow all"}
                  </span>
                </div>
                <div className="space-y-1.5 pt-1">
                  {AVAILABLE_JOB_LEVELS.map((lvl) => {
                    const isChecked = editingSource.allowedLevels?.includes(lvl.level) ?? false;
                    return (
                      <label
                        key={lvl.level}
                        className="flex items-center gap-2 cursor-pointer p-1.5 rounded hover:bg-muted/50 transition-colors"
                      >
                        <Checkbox
                          checked={isChecked}
                          onCheckedChange={(checked) => {
                            const cur = editingSource.allowedLevels || [];
                            const next = checked
                              ? [...cur, lvl.level]
                              : cur.filter((l) => l !== lvl.level);
                            setEditingSource({ ...editingSource, allowedLevels: next });
                          }}
                        />
                        <span className="text-xs">
                          {ar ? lvl.titleAr : lvl.titleEn}
                        </span>
                      </label>
                    );
                  })}
                </div>
              </div>

              {/* Switch: Housing Eligible Only */}
              <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/30">
                <div className="space-y-0.5">
                  <span className="font-semibold block">
                    {ar ? "مستحقي السكن فقط (Housing Eligible Only):" : "Housing Eligible Only:"}
                  </span>
                  <p className="text-[11px] text-muted-foreground">
                    {ar ? "تجاهل أي موظف غير مصرح له بالسكن في نظام الموارد البشرية" : "Skip employees not eligible for housing"}
                  </p>
                </div>
                <Switch
                  checked={editingSource.housingEligibleOnly ?? false}
                  onCheckedChange={(c) =>
                    setEditingSource({ ...editingSource, housingEligibleOnly: c })
                  }
                />
              </div>

              {/* Test Connection Button in Dialog */}
              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => handleTestConnection(editingSource.apiUrl, editingSource.apiKey)}
                  disabled={testingConnection || !editingSource.apiUrl}
                  className="w-full gap-1.5 text-xs border-dashed"
                >
                  <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
                  {testingConnection
                    ? ar
                      ? "جارٍ اختبار الرابط..."
                      : "Testing Connection..."
                    : ar
                      ? "اختبار صحة هذا الرابط الآن"
                      : "Test This Endpoint Now"}
                </Button>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setIsDialogOpen(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button onClick={handleSaveSourceDialog}>
              <Check className="w-4 h-4 mr-1.5" />
              {ar ? "حفظ المصدر" : "Save Source"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Test Connection Preview Dialog */}
      <Dialog open={isTestModalOpen} onOpenChange={setIsTestModalOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <FlaskConical className="w-5 h-5 text-amber-500" />
              {ar ? "نتيجة اختبار الاتصال بالـ HR" : "HR Connection Test Result"}
            </DialogTitle>
          </DialogHeader>

          {testResult && (
            <div className="space-y-3 py-2 text-xs">
              <div
                className={`p-3 rounded-xl border flex items-center justify-between ${
                  testResult.success
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400"
                    : "bg-red-500/10 border-red-500/30 text-red-700 dark:text-red-400"
                }`}
              >
                <div className="flex items-center gap-2 font-semibold">
                  {testResult.success ? (
                    <CheckCircle2 className="w-4 h-4" />
                  ) : (
                    <AlertTriangle className="w-4 h-4" />
                  )}
                  <span>{testResult.message || (testResult.success ? "اتصال ناجح" : "فشل الاتصال")}</span>
                </div>
                {testResult.latencyMs !== undefined && (
                  <Badge variant="outline" className="text-[10px]">
                    {testResult.latencyMs} ms
                  </Badge>
                )}
              </div>

              {testResult.error && (
                <div className="p-3 bg-red-50 dark:bg-red-950/20 text-red-600 rounded-lg border border-red-200 dark:border-red-900 font-mono text-[11px]">
                  {testResult.error}
                </div>
              )}

              {testResult.sample && testResult.sample.length > 0 && (
                <div className="space-y-1.5">
                  <span className="font-semibold text-xs block">
                    {ar ? `عينة من البيانات المستلمة (أول ${testResult.sample.length} سجلات):` : "Sample Parsed Records:"}
                  </span>
                  <div className="space-y-1.5 max-h-48 overflow-y-auto">
                    {testResult.sample.map((emp: any, idx: number) => (
                      <div
                        key={idx}
                        className="p-2 rounded-lg bg-muted/50 border text-[11px] flex items-center justify-between"
                      >
                        <div>
                          <span className="font-bold text-foreground">
                            {emp.profileId || emp.employeeId || `Record #${idx + 1}`}
                          </span>{" "}
                          — {emp.firstName} {emp.lastName}
                          <span className="text-muted-foreground block text-[10px]">
                            {emp.jobTitle} • {emp.department} • المستوى {emp.level || "N/A"}
                          </span>
                        </div>
                        <Badge variant="outline" className="text-[10px]">
                          {emp.companyName || emp.hotel || "Staff"}
                        </Badge>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}

          <DialogFooter>
            <Button onClick={() => setIsTestModalOpen(false)}>
              {ar ? "إغلاق" : "Close"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Batch Refresh Confirmation Dialog */}
      <Dialog open={showBatchConfirm} onOpenChange={setShowBatchConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertTriangle className="w-5 h-5" />
              {ar ? "تأكيد التحديث الشامل لبيانات الموظفين" : "Confirm Batch Profile Refresh"}
            </DialogTitle>
            <DialogDescription className="text-xs pt-2 leading-relaxed">
              {ar
                ? "سيقوم النظام بالاتصال بسيرفر الموارد البشرية (Sunrise e-Signature)، وتمرير كافة الأرقام الوظيفية للموظفين المسكنين حالياً وتحديث بياناتهم الرسمية (الأسماء، الوظائف، الأقسام، الهواتف، انتهاء العقود) وتصحيح أي بيانات غير دقيقة. هل تريد المتابعة؟"
                : "The system will query Sunrise e-Signature HR API for all current residents and refresh/correct their details without affecting existing bed assignments. Proceed?"}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" size="sm" onClick={() => setShowBatchConfirm(false)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              size="sm"
              onClick={handleBatchRefresh}
              className="gap-1.5 bg-primary text-primary-foreground"
            >
              <RefreshCw className="w-4 h-4" />
              {ar ? "بدء التحديث الآن" : "Start Refresh"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
