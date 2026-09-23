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
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
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
  Building2,
  FlaskConical,
  Check,
  AlertTriangle,
  Eye,
  EyeOff,
  Server,
  Trash2,
  Plus,
  ChevronDown,
  ChevronUp,
  Copy,
  CheckCheck,
  Edit,
  Hash,
  Loader2,
  Sparkles,
  CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";
import { PermissionGate } from "@/components/ui/permission-gate";

interface EsignSource {
  id: string;
  label: string;
  baseUrl: string;
  username: string;
  password: string;
  hotelCode: string;
  isActive: boolean;
}

interface HrSyncSectionProps {
  propertyId: number | null;
  language: string;
}

export function HrSyncSection({ propertyId, language }: HrSyncSectionProps) {
  const queryClient = useQueryClient();
  const { properties } = useProperty();
  const ar = language === "ar";

  const validProperties = useMemo(() => properties.filter((p) => p.id > 0), [properties]);

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

  const [isActive, setIsActive] = useState(false);
  const [autoCheckoutOnDeparture, setAutoCheckoutOnDeparture] = useState(true);
  const [autoVacationSync, setAutoVacationSync] = useState(true);

  const [esignSources, setEsignSources] = useState<EsignSource[]>([]);
  const [editingEsignSource, setEditingEsignSource] = useState<EsignSource | null>(null);
  const [isEsignDialogOpen, setIsEsignDialogOpen] = useState(false);
  const [showEsignPassword, setShowEsignPassword] = useState(false);
  const [testingEsign, setTestingEsign] = useState(false);
  const [esignTestResult, setEsignTestResult] = useState<{
    success: boolean;
    message: string;
    hotelId?: number;
    hotelName?: string;
    hotelCode?: string;
  } | null>(null);

  const [rangeSyncSourceId, setRangeSyncSourceId] = useState<string>("");
  const [batchRefreshSourceId, setBatchRefreshSourceId] = useState<string>("");

  const [rangeHotelId, setRangeHotelId] = useState<number>(effectiveHotelId);
  const [rangeFrom, setRangeFrom] = useState("");
  const [rangeTo, setRangeTo] = useState("");
  const [isRangeSyncing, setIsRangeSyncing] = useState(false);
  const [rangeSyncResult, setRangeSyncResult] = useState<any | null>(null);

  const [isBatchRefreshing, setIsBatchRefreshing] = useState(false);
  const [batchRefreshResult, setBatchRefreshResult] = useState<any | null>(null);
  const [showBatchConfirm, setShowBatchConfirm] = useState(false);

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
        setEsignSources(Array.isArray(d.config.esignConfigs) ? d.config.esignConfigs : []);
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

  const saveAllEsignConfigs = async (newSources?: EsignSource[]) => {
    const sourcesToSave = newSources || esignSources;
    try {
      const resp = await fetch("/api/hr-sync/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: effectiveHotelId,
          esignConfigs: sourcesToSave,
          isActive,
          autoCheckoutOnDeparture,
          autoVacationSync,
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).error || "Save failed");
      toast.success(
        ar
          ? `تم حفظ بيانات الربط بنجاح`
          : "e-Signature HR connection config saved",
      );
      loadConfig(effectiveHotelId);
    } catch (err: any) {
      toast.error(err?.message || "Failed to save e-Signature config");
    }
  };

  // Note: global toggles (isActive, autoCheckoutOnDeparture, autoVacationSync) are saved
  // together with esignConfigs when user explicitly saves sources

  const handleAddEsignSource = () => {
    setEditingEsignSource({
      id: `src-${Date.now()}`,
      label: "",
      baseUrl: "https://signature-backend.sunrise-resorts.com/api",
      username: "",
      password: "",
      hotelCode: "",
      isActive: true,
    });
    setEsignTestResult(null);
    setIsEsignDialogOpen(true);
  };

  const handleEditEsignSource = (src: EsignSource) => {
    setEditingEsignSource({ ...src });
    setEsignTestResult(null);
    setIsEsignDialogOpen(true);
  };

  const handleDeleteEsignSource = (id: string) => {
    if (window.confirm(ar ? "هل أنت متأكد من حذف هذا المصدر؟" : "Are you sure you want to delete this source?")) {
      const newSources = esignSources.filter((s) => s.id !== id);
      setEsignSources(newSources);
      saveAllEsignConfigs(newSources);
    }
  };

  const handleSaveEsignSource = () => {
    if (!editingEsignSource?.label || !editingEsignSource?.baseUrl) {
      toast.error(ar ? "يرجى تعبئة الحقول الإلزامية" : "Please fill required fields");
      return;
    }
    const isNew = !esignSources.find((s) => s.id === editingEsignSource.id);
    const newSources = isNew
      ? [...esignSources, editingEsignSource]
      : esignSources.map((s) => (s.id === editingEsignSource.id ? editingEsignSource : s));

    setEsignSources(newSources);
    saveAllEsignConfigs(newSources);
    setIsEsignDialogOpen(false);
  };

  const handleTestEsign = async () => {
    if (!editingEsignSource?.username.trim() || !editingEsignSource?.password.trim() || !editingEsignSource?.hotelCode.trim()) {
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
          baseUrl: editingEsignSource.baseUrl.trim(),
          username: editingEsignSource.username.trim(),
          password: editingEsignSource.password,
          hotelCode: editingEsignSource.hotelCode.trim().toUpperCase(),
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

  const handleTestEsignSource = async (src: EsignSource) => {
    const tId = toast.loading(ar ? "جارٍ الاختبار..." : "Testing connection...");
    try {
      const resp = await fetch("/api/hr-sync/esign/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: effectiveHotelId,
          baseUrl: src.baseUrl.trim(),
          username: src.username.trim(),
          password: src.password,
          hotelCode: src.hotelCode.trim().toUpperCase(),
        }),
      });
      const data = await resp.json();
      if (resp.ok && data.success) {
        toast.success(ar ? `نجاح! الفندق: ${data.hotelName}` : `Success! Hotel: ${data.hotelName}`, { id: tId });
      } else {
        toast.error(data.error || (ar ? "فشل الاتصال" : "Connection failed"), { id: tId });
      }
    } catch (err: any) {
      toast.error(err?.message || "Test failed", { id: tId });
    }
  };

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
          sourceId: rangeSyncSourceId || undefined,
          fromClockNo: fromNum,
          toClockNo: toNum,
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
          sourceId: batchRefreshSourceId || undefined,
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

  return (
    <Card className="border-0 shadow-none bg-transparent">
      <CardHeader className="px-0 pt-0">
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="text-lg font-bold flex items-center gap-2">
              <RefreshCw className="w-5 h-5 text-primary" />
              {ar ? "إعدادات الربط مع الموارد البشرية (HR Sync)" : "HR Sync Configuration"}
            </CardTitle>
            <CardDescription className="text-sm">
              {ar
                ? "إدارة روابط الـ API، وسحب البيانات آلياً، والتحكم في مصادر e-Signature المتعددة."
                : "Manage API integrations, automated data sync, and multiple e-Signature sources."}
            </CardDescription>
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
        </div>
      </CardHeader>

      <CardContent className="px-0 space-y-6">
        {/* Global Operational Toggles */}
        <div className="grid gap-4 sm:grid-cols-2 bg-muted/40 p-4 rounded-xl border border-border/50">
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

          <div className="flex items-center justify-between p-2 border-t sm:border-t-0 sm:border-l border-border/50 rtl:sm:border-l-0 rtl:sm:border-r">
            <div className="space-y-0.5">
              <span className="text-sm font-semibold flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-red-500" />
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
        </div>

        {/* E-Signature API Sources Card */}
        <Card className="border shadow-xs">
          <CardHeader className="pb-3 flex flex-row items-center justify-between">
            <div className="space-y-1">
              <CardTitle className="text-base font-bold text-foreground">
                {ar ? "مصادر ربط الموارد البشرية (e-Signature API Sources)" : "e-Signature API Sources"}
              </CardTitle>
              <CardDescription className="text-xs">
                {ar ? "أضف روابط الـ API للمنشآت المتعددة هنا." : "Add multiple API connections here."}
              </CardDescription>
            </div>
            <Button size="sm" onClick={handleAddEsignSource} className="gap-1.5 text-xs">
              <Plus className="w-3.5 h-3.5" />
              {ar ? "إضافة مصدر" : "Add Source"}
            </Button>
          </CardHeader>
          <CardContent className="pt-1">
            {esignSources.length === 0 ? (
              <div className="text-center p-6 border border-dashed rounded-xl bg-muted/30">
                <Server className="w-8 h-8 text-muted-foreground/50 mx-auto mb-2" />
                <p className="text-sm font-medium text-muted-foreground">
                  {ar ? "لا توجد مصادر مضافة بعد." : "No sources added yet."}
                </p>
              </div>
            ) : (
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {esignSources.map((src) => (
                  <Card key={src.id} className={`border transition-all shadow-xs ${src.isActive ? 'border-border/80' : 'opacity-60 bg-muted/30'}`}>
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5 truncate">
                            <Server className="w-4 h-4 text-primary shrink-0" />
                            <span className="truncate">{src.label}</span>
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground font-mono truncate mt-0.5">
                            {src.username || (ar ? 'بدون مستخدم' : 'No username')}
                          </p>
                        </div>
                        <Badge variant={src.isActive ? 'default' : 'secondary'} className="text-[10px] shrink-0">
                          {src.isActive ? (ar ? 'نشط' : 'Active') : (ar ? 'معطل' : 'Off')}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="p-4 pt-1 space-y-3">
                      <div className="flex items-center justify-between text-xs pt-1">
                        <span className="text-muted-foreground">{ar ? 'كود الفندق:' : 'Hotel Code:'}</span>
                        <Badge variant="outline" className="font-mono text-xs font-bold text-primary border-primary/30 bg-primary/5">
                          {src.hotelCode || 'N/A'}
                        </Badge>
                      </div>
                      <Separator />
                      <div className="flex items-center justify-between pt-1">
                        <div className="flex items-center gap-1">
                          <Button size="sm" variant="outline" className="h-7 text-xs px-2 gap-1" onClick={() => handleTestEsignSource(src)}>
                            <FlaskConical className="w-3.5 h-3.5 text-amber-500" />
                            {ar ? 'اختبار' : 'Test'}
                          </Button>
                        </div>
                        <div className="flex items-center gap-1">
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleEditEsignSource(src)}>
                            <Edit className="w-3.5 h-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7 hover:text-red-500 hover:bg-red-500/10" onClick={() => handleDeleteEsignSource(src.id)}>
                            <Trash2 className="w-3.5 h-3.5" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        {/* Range Sync & Batch Refresh Grid */}
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

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-primary" />
                  {ar ? 'مصدر الـ API:' : 'API Source:'}
                </span>
                <Select value={rangeSyncSourceId} onValueChange={setRangeSyncSourceId}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder={ar ? 'الكل (تلقائي)' : 'All (Auto)'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">
                      {ar ? 'جميع المصادر النشطة (تلقائي)' : 'All Active Sources (Auto)'}
                    </SelectItem>
                    {esignSources.filter(s => s.isActive).map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.label} [{s.hotelCode}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                      ? "تحديث كافة البروفايلات وتصحيح أي بيانات خاطئة"
                      : "Periodic verification & data correction against HR server"}
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground leading-relaxed pt-1">
                {ar
                  ? "يقوم بتمرير كافة الأرقام الوظيفية لملفات السكن الحالية على سيرفر الموارد البشرية، وتحديث (المسميات، الأقسام، الهواتف، العناوين، انتهاء العقود) مع الحفاظ التام على التسكين والغرف."
                  : "Scans all current housing profiles against HR and refreshes contact info, job titles, and departments with zero impact on room assignments."}
              </p>

              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] text-muted-foreground font-medium flex items-center gap-1">
                  <Server className="w-3.5 h-3.5 text-primary" />
                  {ar ? 'مصدر الـ API:' : 'API Source:'}
                </span>
                <Select value={batchRefreshSourceId} onValueChange={setBatchRefreshSourceId}>
                  <SelectTrigger className="h-8 text-xs bg-background">
                    <SelectValue placeholder={ar ? 'الكل (تلقائي)' : 'All (Auto)'} />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="" className="text-xs">
                      {ar ? 'جميع المصادر النشطة (تلقائي)' : 'All Active Sources (Auto)'}
                    </SelectItem>
                    {esignSources.filter(s => s.isActive).map(s => (
                      <SelectItem key={s.id} value={s.id} className="text-xs">
                        {s.label} [{s.hotelCode}]
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
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

      <Dialog open={isEsignDialogOpen} onOpenChange={setIsEsignDialogOpen}>
        <DialogContent className="max-w-xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingEsignSource?.id.startsWith('src-') 
                ? (ar ? 'إضافة مصدر API جديد' : 'Add New API Source') 
                : (ar ? 'تعديل مصدر API' : 'Edit API Source')}
            </DialogTitle>
            <DialogDescription>
              {ar ? 'أدخل بيانات المصدر الفندقي (e-Signature).' : 'Enter e-Signature API details.'}
            </DialogDescription>
          </DialogHeader>
          {editingEsignSource && (
            <div className="space-y-4 py-2 text-xs">
              <div className="grid gap-3 sm:grid-cols-3">
                <div className="sm:col-span-2">
                  <label className="font-semibold block mb-1">{ar ? 'اسم المصدر *' : 'Source Label *'}</label>
                  <Input value={editingEsignSource.label} onChange={(e) => setEditingEsignSource({...editingEsignSource, label: e.target.value})} placeholder={ar ? 'مثال: فندق أ' : 'e.g. Hotel A'} />
                </div>
                <div>
                  <label className="font-semibold block mb-1">{ar ? 'الحالة' : 'Status'}</label>
                  <div className="flex items-center justify-between border rounded-md p-2 h-9">
                    <span className="text-[11px] font-medium">{editingEsignSource.isActive ? (ar ? 'نشط' : 'Active') : (ar ? 'معطل' : 'Off')}</span>
                    <Switch checked={editingEsignSource.isActive} onCheckedChange={(c) => setEditingEsignSource({...editingEsignSource, isActive: c})} />
                  </div>
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">{ar ? 'رابط السيرفر (Base URL) *' : 'Server URL (Base URL) *'}</label>
                <Input value={editingEsignSource.baseUrl} onChange={(e) => setEditingEsignSource({...editingEsignSource, baseUrl: e.target.value})} dir="ltr" />
              </div>
              <div>
                <label className="font-semibold block mb-1">{ar ? 'اسم المستخدم (Username/Email)' : 'Username / Email'}</label>
                <Input value={editingEsignSource.username} onChange={(e) => setEditingEsignSource({...editingEsignSource, username: e.target.value})} dir="ltr" />
              </div>
              <div>
                <label className="font-semibold block mb-1">{ar ? 'كلمة المرور (Password)' : 'Password'}</label>
                <div className="relative">
                  <Input type={showEsignPassword ? 'text' : 'password'} value={editingEsignSource.password} onChange={(e) => setEditingEsignSource({...editingEsignSource, password: e.target.value})} dir="ltr" className="pr-8" />
                  <button type="button" onClick={() => setShowEsignPassword(!showEsignPassword)} className="absolute inset-y-0 right-0 flex items-center pr-2.5 text-muted-foreground hover:text-foreground">
                    {showEsignPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
              <div>
                <label className="font-semibold block mb-1">{ar ? 'كود الفندق (Hotel Code)' : 'Hotel Code'}</label>
                <Input value={editingEsignSource.hotelCode} onChange={(e) => setEditingEsignSource({...editingEsignSource, hotelCode: e.target.value.toUpperCase()})} dir="ltr" className="uppercase" />
              </div>
              
              <div className="pt-2 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                <Button type="button" variant="outline" size="sm" onClick={handleTestEsign} disabled={testingEsign} className="gap-1.5 text-xs h-9 border-amber-500/40 hover:bg-amber-500/10 text-amber-600">
                  {testingEsign ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <FlaskConical className="w-3.5 h-3.5 text-amber-500" />}
                  {ar ? "اختبار الاتصال والفندق" : "Test Hotel Connection"}
                </Button>
                {esignTestResult && (
                  <div className={`p-2 px-3 rounded-lg border text-[11px] flex items-center gap-2 ${esignTestResult.success ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-700" : "bg-red-500/10 border-red-500/30 text-red-700"}`}>
                    {esignTestResult.success ? <CheckCircle2 className="w-4 h-4 shrink-0" /> : <AlertTriangle className="w-4 h-4 shrink-0" />}
                    <span>{esignTestResult.message}</span>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0 mt-2">
            <Button variant="outline" onClick={() => setIsEsignDialogOpen(false)}>{ar ? 'إلغاء' : 'Cancel'}</Button>
            <Button onClick={handleSaveEsignSource} className="gap-1.5"><Check className="w-4 h-4" />{ar ? 'حفظ المصدر' : 'Save Source'}</Button>
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
