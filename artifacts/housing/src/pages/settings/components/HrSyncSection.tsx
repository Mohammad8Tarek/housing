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
} from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { useProperty } from "@/context/PropertyContext";

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

  // Load Config
  const loadConfig = async () => {
    if (!propertyId) return;
    try {
      const res = await fetch(`/api/hr-sync/config?propertyId=${propertyId}`, {
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
            : [propertyId],
        );
      }
    } catch {
      toast.error(ar ? "فشل تحميل إعدادات مزامنة الـ HR" : "Failed to load HR sync settings");
    }
  };

  useEffect(() => {
    loadConfig();
  }, [propertyId]);

  // Save Config
  const saveConfig = async (newSources?: HrSourceConfig[]) => {
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

      const payloadSources = newSources || sources;

      const resp = await fetch("/api/hr-sync/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId,
          fieldMapping: fm,
          isActive,
          autoCheckoutOnDeparture,
          autoVacationSync,
          targetPropertyIds: targetPropertyIds.length > 0 ? targetPropertyIds : [propertyId],
          sources: payloadSources,
        }),
      });

      if (!resp.ok) throw new Error((await resp.json()).message || "Save failed");
      toast.success(ar ? "تم حفظ إعدادات ومصادر الـ HR بنجاح" : "HR sync config saved");
      loadConfig();
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

        {/* Multi-Source Cards List */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold flex items-center gap-2">
              <Layers className="w-4 h-4 text-primary" />
              {ar ? "قواعد بيانات وروابط الـ HR المتصلة:" : "Connected HR Databases & APIs:"}
            </h3>
            <span className="text-xs text-muted-foreground">
              {ar ? `إجمالي المصادر: ${sources.length}` : `Total sources: ${sources.length}`}
            </span>
          </div>

          {sources.length === 0 ? (
            <div className="text-center py-10 px-4 border border-dashed rounded-xl bg-muted/20 space-y-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 text-primary flex items-center justify-center mx-auto">
                <Layers className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <p className="text-sm font-semibold">
                  {ar ? "لم تتم إضافة أي مصدر HR بعد" : "No HR sources configured yet"}
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  {ar
                    ? "يمكنك ربط عدة روابط API لقواعد بيانات فنادق مختلفة (التاج، وايت هيلز، المرافئ...) تسكن عمالتها في هذا السكن."
                    : "Connect multiple hotel databases sharing this housing facility or split across multiple locations."}
                </p>
              </div>
              <div className="flex items-center justify-center gap-2 pt-1">
                <Button size="sm" onClick={handleAddNewSource} className="gap-1.5 text-xs">
                  <Plus className="w-3.5 h-3.5" />
                  {ar ? "إضافة مصدر جديد" : "Add Source"}
                </Button>
                <Button size="sm" variant="outline" onClick={setupDemoFeeds} className="gap-1.5 text-xs">
                  <FlaskConical className="w-3.5 h-3.5" />
                  {ar ? "تجربة روابط تلقائية (Demo)" : "Load Demo Feeds"}
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
                    className={`border transition-all shadow-sm ${src.isActive ? "border-border/80" : "opacity-60 bg-muted/30"}`}
                  >
                    <CardHeader className="p-4 pb-2">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <CardTitle className="text-sm font-bold flex items-center gap-1.5">
                            <Building2 className="w-4 h-4 text-primary shrink-0" />
                            {src.name}
                          </CardTitle>
                          <p className="text-[11px] text-muted-foreground font-mono truncate max-w-[220px] mt-0.5">
                            {src.apiUrl}
                          </p>
                        </div>
                        <Badge variant={src.isActive ? "default" : "secondary"} className="text-[10px]">
                          {src.isActive ? (ar ? "نشط" : "Active") : ar ? "متوقف" : "Off"}
                        </Badge>
                      </div>
                    </CardHeader>

                    <CardContent className="p-4 pt-1 space-y-3">
                      {/* Properties & Level Badges */}
                      <div className="space-y-1.5 pt-1">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="text-[11px] text-muted-foreground">{ar ? "السكن المستهدف:" : "Target:"}</span>
                          {src.targetPropertyIds && src.targetPropertyIds.length > 0 ? (
                            src.targetPropertyIds.map((pid) => {
                              const prop = properties?.find((p: any) => p.id === pid);
                              return (
                                <Badge key={pid} variant="outline" className="text-[10px] bg-background">
                                  {prop?.displayName || prop?.name || `Property #${pid}`}
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
                          <span className="text-[11px] text-muted-foreground">{ar ? "استيراد البروفايلات:" : "Profiles:"}</span>
                          {src.syncProfiles !== false ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 dark:text-emerald-400 border-emerald-500/30 bg-emerald-500/5">
                              {ar ? "مفعّل (استيراد كامل)" : "Enabled"}
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] text-amber-600 dark:text-amber-400 border-amber-500/30 bg-amber-500/5">
                              {ar ? "معطل (إجازات وتصفيات فقط)" : "Movements only"}
                            </Badge>
                          )}
                        </div>

                        {src.allowedLevels && src.allowedLevels.length > 0 && (
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-[11px] text-muted-foreground">{ar ? "المستويات:" : "Levels:"}</span>
                            <Badge variant="secondary" className="text-[10px]">
                              {src.allowedLevels.map((l) => `Lvl ${l}`).join(", ")}
                            </Badge>
                          </div>
                        )}

                        {src.housingEligibleOnly && (
                          <Badge variant="outline" className="text-[10px] text-blue-600 dark:text-blue-400 border-blue-500/30 bg-blue-500/5">
                            {ar ? "مستحقي السكن فقط" : "Housing Eligible Only"}
                          </Badge>
                        )}
                      </div>

                      <Separator />

                      {/* Card Footer Actions */}
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

        {/* Bilingual Step-by-Step Developer Integration Guide */}
        <div className="space-y-4 pt-1">
          <div>
            <h4 className="text-sm font-semibold flex items-center gap-2 mb-1">
              <ShieldAlert className="w-4 h-4 text-primary" />
              {ar
                ? "دليل الربط البرمجي الكامل مع الـ HR والـ Webhooks التلقائية:"
                : "HR System Integration API Reference & Webhooks:"}
            </h4>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "يدعم النظام طريقتين للربط: السحب الآلي الدوري (Pull) أو الإرسال الفوري المباشر عبر الـ Webhooks (Push)."
                : "Supports dual-mode: Periodic Pulling or Real-Time Push Webhooks directly from your HR solution."}
            </p>
          </div>

          {/* Casual to Permanent Upgrade Feature Banner */}
          <div className="p-3.5 rounded-xl bg-primary/5 border border-primary/20 space-y-1.5 text-xs">
            <div className="font-semibold text-primary flex items-center gap-1.5">
              <Check className="w-4 h-4 text-emerald-500" />
              {ar
                ? "ميزة ترقية العمالة المؤقتة إلى تعيين رسمي (Casual -> Permanent Transition):"
                : "Automatic Casual to Permanent Worker Transition:"}
            </div>
            <p className="text-muted-foreground text-[11px] leading-relaxed">
              {ar
                ? "عندما يبدأ الموظف بكود مؤقت (Casual مثل CAS-1042) ثم يتعين برقم وظيفي جديد (مثل EMP-8802)، يقوم النظام تلقائياً بالمطابقة بالرقم القومي (National ID). يتم تحديث رقم الموظف وحفظ رقمه السابق (previous_profile_id)، مع الحفاظ الكامل على تسكينه وسريره الحالي وسجل إقامته دون أي انقطاع أو إخلاء!"
                : "When an employee transitions from a casual worker code to a permanent ID with the same National ID, the system preserves their active room and bed assignment with zero interruption."}
            </p>
          </div>

          {/* Webhooks Cards */}
          <div className="grid gap-3 md:grid-cols-3">
            {/* Webhook 1 */}
            <div className="bg-muted/40 rounded-xl p-3 border text-xs space-y-2">
              <div className="font-semibold text-primary flex items-center justify-between">
                <span>1. إرسال بروفايلات (Push)</span>
                <Badge variant="outline" className="text-[10px]">POST</Badge>
              </div>
              <code className="block bg-background p-1.5 rounded font-mono text-[11px] text-foreground">
                /api/hr-sync/receive
              </code>
              <p className="text-muted-foreground text-[11px]">
                {ar
                  ? "إرسال حزمة الموظفين بالكامل، مع صور البطاقات والأقسام."
                  : "Push employee profiles array with documents and jobs."}
              </p>
            </div>

            {/* Webhook 2 */}
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
                  ? "تسجيل الإجازة وتحديث حالة الغرفة لـ occupied_vacation."
                  : "Sync vacation start/return & room occupied_vacation status."}
              </p>
            </div>

            {/* Webhook 3 */}
            <div className="bg-muted/40 rounded-xl p-3 border text-xs space-y-2">
              <div className="font-semibold text-red-600 dark:text-red-400 flex items-center justify-between">
                <span>3. إشعار تصفية واستقالة</span>
                <Badge variant="outline" className="text-[10px]">POST</Badge>
              </div>
              <code className="block bg-background p-1.5 rounded font-mono text-[11px] text-foreground">
                /api/hr-sync/notify-departure
              </code>
              <p className="text-muted-foreground text-[11px]">
                {ar
                  ? "Check-out تلقائي وإخلاء السرير وتحويل الغرفة لمتسخة."
                  : "Auto check-out, release bed, and set room to dirty."}
              </p>
            </div>
          </div>
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
    </Card>
  );
}
