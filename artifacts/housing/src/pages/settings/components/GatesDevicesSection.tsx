import { useCallback, useEffect, useMemo, useState } from "react";
import { formatDateTime } from "@/lib/date-utils";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Fingerprint,
  Loader2,
  Plus,
  RefreshCw,
  Trash2,
  KeyRound,
  Copy,
  Check,
  DoorOpen,
} from "lucide-react";
import { toast } from "sonner";
import { PermissionGate } from "@/components/ui/permission-gate";

type PropertyId = number | "all" | null | undefined;

type GateDevice = {
  id: number;
  propertyId: number;
  name: string;
  deviceType: "BIOMETRIC" | "TURNSTILE" | "HYBRID";
  vendor: "ZKTECO" | "HIKVISION" | "SUPREMA" | "GENERIC";
  serialNumber?: string | null;
  ipAddress?: string | null;
  port?: number | null;
  direction: "IN" | "OUT" | "BOTH";
  apiKeyPrefix?: string | null;
  enabled: boolean;
  lastSeenAt?: string | null;
};

type NewDeviceForm = {
  name: string;
  deviceType: GateDevice["deviceType"];
  vendor: GateDevice["vendor"];
  serialNumber: string;
  ipAddress: string;
  port: string;
  direction: GateDevice["direction"];
};

const emptyForm: NewDeviceForm = {
  name: "",
  deviceType: "BIOMETRIC",
  vendor: "ZKTECO",
  serialNumber: "",
  ipAddress: "",
  port: "",
  direction: "IN",
};

async function readApiResponse(resp: Response) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }
  return data;
}

interface GatesDevicesSectionProps {
  propertyId: PropertyId;
  language: string;
}

export function GatesDevicesSection({
  propertyId,
  language,
}: GatesDevicesSectionProps) {
  const ar = language === "ar";
  const currentPropertyId = typeof propertyId === "number" ? propertyId : null;

  const [devices, setDevices] = useState<GateDevice[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState<NewDeviceForm>(emptyForm);
  const [saving, setSaving] = useState(false);
  // The raw key is shown once; { id, key } for the device it belongs to.
  const [revealedKey, setRevealedKey] = useState<{
    id: number | "new";
    key: string;
  } | null>(null);
  const [copied, setCopied] = useState(false);

  const eventUrl = useMemo(() => {
    const base = typeof window !== "undefined" ? window.location.origin : "";
    return `${base}/api/gate/device/event?propertyId=${currentPropertyId ?? ""}`;
  }, [currentPropertyId]);

  const load = useCallback(async () => {
    if (!currentPropertyId) {
      setDevices([]);
      return;
    }
    setLoading(true);
    try {
      const resp = await fetch(
        `/api/gate/devices?propertyId=${currentPropertyId}`,
        { credentials: "include" },
      );
      const data = await readApiResponse(resp);
      setDevices((data.data || []) as GateDevice[]);
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "تعذر تحميل الأجهزة" : "Failed to load devices"),
      );
    } finally {
      setLoading(false);
    }
  }, [ar, currentPropertyId]);

  useEffect(() => {
    load();
  }, [load]);

  const addDevice = async () => {
    if (!currentPropertyId) return;
    if (!form.name.trim()) {
      toast.error(ar ? "اسم الجهاز مطلوب" : "Device name is required");
      return;
    }
    setSaving(true);
    try {
      const resp = await fetch(
        `/api/gate/devices?propertyId=${currentPropertyId}`,
        {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: form.name.trim(),
            deviceType: form.deviceType,
            vendor: form.vendor,
            serialNumber: form.serialNumber.trim() || undefined,
            ipAddress: form.ipAddress.trim() || undefined,
            port: form.port ? Number(form.port) : undefined,
            direction: form.direction,
          }),
        },
      );
      const data = await readApiResponse(resp);
      toast.success(ar ? "تم تسجيل الجهاز" : "Device registered");
      if (data.apiKey) setRevealedKey({ id: "new", key: data.apiKey });
      setForm(emptyForm);
      await load();
    } catch (err: any) {
      toast.error(err.message || (ar ? "تعذر الحفظ" : "Save failed"));
    } finally {
      setSaving(false);
    }
  };

  const patchDevice = async (
    id: number,
    body: Record<string, unknown>,
    successMsg: string,
  ) => {
    if (!currentPropertyId) return;
    try {
      const resp = await fetch(
        `/api/gate/devices/${id}?propertyId=${currentPropertyId}`,
        {
          method: "PATCH",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        },
      );
      const data = await readApiResponse(resp);
      toast.success(successMsg);
      if (data.apiKey) setRevealedKey({ id, key: data.apiKey });
      await load();
    } catch (err: any) {
      toast.error(err.message || (ar ? "تعذر التحديث" : "Update failed"));
    }
  };

  const removeDevice = async (id: number, name: string) => {
    if (!currentPropertyId) return;
    if (
      !window.confirm(ar ? `حذف الجهاز "${name}"؟` : `Delete device "${name}"?`)
    )
      return;
    try {
      const resp = await fetch(
        `/api/gate/devices/${id}?propertyId=${currentPropertyId}`,
        { method: "DELETE", credentials: "include" },
      );
      await readApiResponse(resp);
      toast.success(ar ? "تم حذف الجهاز" : "Device deleted");
      await load();
    } catch (err: any) {
      toast.error(err.message || (ar ? "تعذر الحذف" : "Delete failed"));
    }
  };

  const copyKey = async (key: string) => {
    try {
      await navigator.clipboard.writeText(key);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      toast.error(ar ? "تعذر النسخ" : "Copy failed");
    }
  };

  if (!currentPropertyId) {
    return (
      <div className="text-center py-12 text-muted-foreground text-sm bg-card border rounded-xl p-8">
        {ar
          ? "يرجى اختيار الفندق / العقار أولاً لإدارة أجهزة البوابة"
          : "Please select a hotel/property first to manage gate devices"}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <Fingerprint className="w-4 h-4 text-primary" />
          {ar
            ? "سجّل أجهزة البصمة والبوابات (ZKTeco، Hikvision، Suprema أو أي نظام) وولّد مفاتيحها لربطها بالتسكين وتسجيل الدخول/الخروج."
            : "Register biometric & turnstile devices (ZKTeco, Hikvision, Suprema, or any system) and mint their keys to tie entry/exit to accommodation."}
        </p>
      </div>

      {/* One-time key reveal */}
      {revealedKey && (
        <Card className="border-amber-400/60 bg-amber-50/60 dark:bg-amber-950/20">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2 text-amber-700 dark:text-amber-400">
              <KeyRound className="w-4 h-4" />
              {ar
                ? "مفتاح الجهاز — يُعرض مرة واحدة"
                : "Device key — shown once"}
            </CardTitle>
            <CardDescription className="text-xs">
              {ar
                ? "انسخه الآن واحفظه في إعدادات الجهاز. لن يظهر مرة أخرى."
                : "Copy it now into the device settings. It will not be shown again."}
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-2">
            <code className="flex-1 text-xs break-all bg-background border rounded px-2 py-1.5">
              {revealedKey.key}
            </code>
            <Button
              size="sm"
              variant="outline"
              onClick={() => copyKey(revealedKey.key)}
            >
              {copied ? (
                <Check className="w-4 h-4" />
              ) : (
                <Copy className="w-4 h-4" />
              )}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={() => setRevealedKey(null)}
            >
              {ar ? "تم" : "Done"}
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Add device */}
      <PermissionGate
        anyPermission={[
          ["gate", "create"],
          ["settings", "edit"],
        ]}
      >
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Plus className="w-4 h-4" />
              {ar ? "إضافة جهاز" : "Add device"}
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الاسم" : "Name"}</Label>
              <Input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder={ar ? "بوابة المدخل الرئيسي" : "Main gate"}
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "النوع" : "Type"}</Label>
              <Select
                value={form.deviceType}
                onValueChange={(v) =>
                  setForm({ ...form, deviceType: v as any })
                }
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="BIOMETRIC">
                    {ar ? "بصمة / وش" : "Biometric"}
                  </SelectItem>
                  <SelectItem value="TURNSTILE">
                    {ar ? "بوابة دوّارة" : "Turnstile"}
                  </SelectItem>
                  <SelectItem value="HYBRID">
                    {ar ? "مدمج" : "Hybrid"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">{ar ? "الشركة" : "Vendor"}</Label>
              <Select
                value={form.vendor}
                onValueChange={(v) => setForm({ ...form, vendor: v as any })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ZKTECO">ZKTeco</SelectItem>
                  <SelectItem value="HIKVISION">Hikvision</SelectItem>
                  <SelectItem value="SUPREMA">Suprema</SelectItem>
                  <SelectItem value="GENERIC">
                    {ar ? "عام / أخرى" : "Generic / Other"}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs">
                {ar ? "الرقم التسلسلي (SN)" : "Serial (SN)"}
              </Label>
              <Input
                value={form.serialNumber}
                onChange={(e) =>
                  setForm({ ...form, serialNumber: e.target.value })
                }
                placeholder="CGXX214860123"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs">IP</Label>
              <Input
                value={form.ipAddress}
                onChange={(e) =>
                  setForm({ ...form, ipAddress: e.target.value })
                }
                placeholder="192.168.1.50"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "المنفذ" : "Port"}</Label>
                <Input
                  value={form.port}
                  onChange={(e) => setForm({ ...form, port: e.target.value })}
                  placeholder="4370"
                  inputMode="numeric"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">{ar ? "الاتجاه" : "Dir."}</Label>
                <Select
                  value={form.direction}
                  onValueChange={(v) =>
                    setForm({ ...form, direction: v as any })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="IN">{ar ? "دخول" : "IN"}</SelectItem>
                    <SelectItem value="OUT">{ar ? "خروج" : "OUT"}</SelectItem>
                    <SelectItem value="BOTH">
                      {ar ? "الاثنين" : "BOTH"}
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="md:col-span-3 flex justify-end">
              <Button onClick={addDevice} disabled={saving}>
                {saving ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Plus className="w-4 h-4" />
                )}
                {ar ? "تسجيل وتوليد مفتاح" : "Register & mint key"}
              </Button>
            </div>
          </CardContent>
        </Card>
      </PermissionGate>

      {/* Device list */}
      <Card>
        <CardHeader className="pb-3 flex-row items-center justify-between">
          <CardTitle className="text-sm flex items-center gap-2">
            <DoorOpen className="w-4 h-4" />
            {ar ? "الأجهزة المسجّلة" : "Registered devices"}
            <Badge variant="secondary">{devices.length}</Badge>
          </CardTitle>
          <Button size="sm" variant="ghost" onClick={load} disabled={loading}>
            <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin" : ""}`} />
          </Button>
        </CardHeader>
        <CardContent className="space-y-2">
          {devices.length === 0 && !loading && (
            <p className="text-xs text-muted-foreground py-6 text-center">
              {ar ? "لا توجد أجهزة مسجّلة بعد." : "No devices registered yet."}
            </p>
          )}
          {devices.map((d) => (
            <div
              key={d.id}
              className="flex flex-wrap items-center gap-3 border rounded-lg p-3 bg-card"
            >
              <Fingerprint className="w-5 h-5 text-primary shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-sm truncate">
                    {d.name}
                  </span>
                  <Badge variant="outline" className="text-[10px]">
                    {d.vendor}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {d.deviceType}
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    {d.direction}
                  </Badge>
                </div>
                <div className="text-[11px] text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                  {d.serialNumber && <span>SN: {d.serialNumber}</span>}
                  {d.ipAddress && (
                    <span>
                      {d.ipAddress}
                      {d.port ? `:${d.port}` : ""}
                    </span>
                  )}
                  {d.apiKeyPrefix && (
                    <span>
                      {ar ? "المفتاح" : "key"}: {d.apiKeyPrefix}…
                    </span>
                  )}
                  <span>
                    {ar ? "آخر ظهور" : "last seen"}:{" "}
                    {d.lastSeenAt
                      ? formatDateTime(d.lastSeenAt, "-")
                      : ar
                        ? "لم يتصل بعد"
                        : "never"}
                  </span>
                </div>
              </div>
              <PermissionGate
                anyPermission={[
                  ["gate", "create"],
                  ["settings", "edit"],
                ]}
              >
                <div className="flex items-center gap-2 shrink-0">
                  <div className="flex items-center gap-1.5">
                    <Switch
                      checked={d.enabled}
                      onCheckedChange={(v) =>
                        patchDevice(
                          d.id,
                          { enabled: v },
                          v
                            ? ar
                              ? "تم التفعيل"
                              : "Enabled"
                            : ar
                              ? "تم التعطيل"
                              : "Disabled",
                        )
                      }
                    />
                    <span className="text-[11px] text-muted-foreground">
                      {d.enabled ? (ar ? "مفعّل" : "On") : ar ? "موقوف" : "Off"}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    variant="outline"
                    title={ar ? "تدوير المفتاح" : "Rotate key"}
                    onClick={() =>
                      patchDevice(
                        d.id,
                        { rotateKey: true },
                        ar ? "تم تدوير المفتاح" : "Key rotated",
                      )
                    }
                  >
                    <KeyRound className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive"
                    title={ar ? "حذف" : "Delete"}
                    onClick={() => removeDevice(d.id, d.name)}
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </PermissionGate>
            </div>
          ))}
        </CardContent>
      </Card>

      {/* Setup help */}
      <Card className="bg-muted/30">
        <CardHeader className="pb-2">
          <CardTitle className="text-sm">
            {ar ? "ربط الجهاز" : "Connecting a device"}
          </CardTitle>
        </CardHeader>
        <CardContent className="text-xs text-muted-foreground space-y-2">
          <p>
            {ar
              ? "وجّه الجهاز (أو جسر التكامل) ليرسل الأحداث إلى:"
              : "Point the device (or an integration bridge) to send events to:"}
          </p>
          <code className="block break-all bg-background border rounded px-2 py-1.5">
            POST {eventUrl}
          </code>
          <p>
            {ar
              ? "مع ترويسة x-device-key = مفتاح الجهاز. الصيغة إمّا JSON موحّد { userRef, direction, method } أو رفع ZKTeco ATTLOG { format: 'zkteco_attlog', data }."
              : "with header x-device-key = the device key. Body is either normalized JSON { userRef, direction, method } or a ZKTeco ATTLOG upload { format: 'zkteco_attlog', data }."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
