import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
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
import { CheckCircle2, Loader2, Save, Server, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useEncoderStatus } from "@workspace/api-client-react";

type PropertyId = number | "all" | null | undefined;

type HotekServer = {
  id: number;
  propertyId: number;
  name: string;
  host: string;
  port: number;
  protocol: "fidelio";
  workstation: string;
  serverCode?: string | null;
  isActive: boolean;
  isDefault: boolean;
  lastSeenAt?: string | null;
  lastSuccessAt?: string | null;
  lastError?: string | null;
};

type ServerForm = {
  name: string;
  host: string;
  port: string;
  workstation: string;
  serverCode: string;
  isActive: boolean;
};

interface DoorLocksSectionProps {
  propertyId: PropertyId;
  language: string;
}

const defaultServerForm: ServerForm = {
  name: "Hotek Smart Server",
  host: "127.0.0.1",
  port: "10003",
  workstation: "WS1",
  serverCode: "99",
  isActive: true,
};

async function readApiResponse(resp: Response) {
  const data = await resp.json().catch(() => ({}));
  if (!resp.ok) {
    throw new Error(data.error || data.message || "Request failed");
  }
  return data;
}

function formatDate(value: string | null | undefined, language: string) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "-";
  return new Intl.DateTimeFormat(language === "ar" ? "ar-EG" : "en-US", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

export function DoorLocksSection({
  propertyId,
  language,
}: DoorLocksSectionProps) {
  const ar = language === "ar";
  const currentPropertyId = typeof propertyId === "number" ? propertyId : null;

  const [servers, setServers] = useState<HotekServer[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<number | null>(null);
  const [serverForm, setServerForm] = useState<ServerForm>(defaultServerForm);
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [savingServer, setSavingServer] = useState(false);
  const [testingServer, setTestingServer] = useState(false);

  const encType = "smart";
  const { data: status, refetch: refetchStatus } = useEncoderStatus(encType, {
    query: { refetchInterval: 5000 },
  });

  const selectedServer = useMemo(
    () =>
      servers.find((server) => server.id === selectedServerId) ??
      servers.find((server) => server.isDefault) ??
      servers[0],
    [servers, selectedServerId],
  );

  const bridgeConnected = status?.connected ?? false;
  const serverConfigured = Boolean(selectedServer);
  const serverEnabled = Boolean(selectedServer?.isActive);
  const remoteAddress = bridgeConnected ? (status as any)?.remoteAddress : null;
  const serverOnline = serverConfigured && serverEnabled && bridgeConnected;

  const loadConfig = useCallback(
    async (preferredServerId?: number) => {
      if (!currentPropertyId) return;
      setLoadingConfig(true);
      try {
        const resp = await fetch(
          `/api/hotek/config?propertyId=${currentPropertyId}`,
          {
            credentials: "include",
          },
        );
        const data = await readApiResponse(resp);
        const nextServers = (data.servers || []) as HotekServer[];
        setServers(nextServers);
        const nextServer =
          nextServers.find((server) => server.id === preferredServerId) ??
          nextServers.find((server) => server.isDefault) ??
          nextServers[0] ??
          null;
        setSelectedServerId(nextServer?.id ?? null);
      } catch (err: any) {
        toast.error(err.message ||
            (ar ? "تعذر تحميل إعدادات Hotek" : "Failed to load Hotek config"));
      } finally {
        setLoadingConfig(false);
      }
    },
    [ar, currentPropertyId, toast],
  );

  useEffect(() => {
    if (!currentPropertyId) {
      setServers([]);
      setSelectedServerId(null);
      return;
    }
    loadConfig();
  }, [currentPropertyId, loadConfig]);

  useEffect(() => {
    if (!selectedServer) {
      setServerForm(defaultServerForm);
      return;
    }
    setServerForm({
      name: selectedServer.name || defaultServerForm.name,
      host: selectedServer.host || defaultServerForm.host,
      port: String(selectedServer.port || defaultServerForm.port),
      workstation: selectedServer.workstation || defaultServerForm.workstation,
      serverCode: selectedServer.serverCode || "",
      isActive: selectedServer.isActive,
    });
  }, [selectedServer]);

  const saveServer = async () => {
    if (!currentPropertyId) return;
    const port = Number(serverForm.port);
    if (!Number.isInteger(port) || port <= 0 || port > 65535) {
      toast.error(ar ? "رقم المنفذ غير صحيح" : "Invalid port");
      return;
    }
    setSavingServer(true);
    try {
      const resp = await fetch(
        selectedServer
          ? `/api/hotek/servers/${selectedServer.id}`
          : "/api/hotek/servers",
        {
          method: selectedServer ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "include",
          body: JSON.stringify({
            propertyId: currentPropertyId,
            name: serverForm.name.trim() || defaultServerForm.name,
            host: serverForm.host.trim() || defaultServerForm.host,
            port,
            protocol: "fidelio",
            workstation:
              serverForm.workstation.trim() || defaultServerForm.workstation,
            serverCode: serverForm.serverCode.trim() || null,
            isActive: serverForm.isActive,
            isDefault: true,
          }),
        },
      );
      const data = await readApiResponse(resp);
      toast.success(ar ? "تم حفظ إعدادات Hotek" : "Hotek server saved");
      await loadConfig(data.server?.id);
    } catch (err: any) {
      toast.error(err.message ||
          (ar ? "فشل حفظ إعدادات Hotek" : "Failed to save Hotek server"));
    } finally {
      setSavingServer(false);
    }
  };

  const testServer = async () => {
    if (!currentPropertyId || !selectedServer) return;
    setTestingServer(true);
    try {
      const resp = await fetch(
        `/api/hotek/servers/${selectedServer.id}/test?propertyId=${currentPropertyId}`,
        {
          method: "POST",
          credentials: "include",
        },
      );
      const data = await readApiResponse(resp);
      toast.success(data.message ||
          (data.connected ? "Hotek connected" : "Waiting for Hotek"));
      await refetchStatus();
      await loadConfig(selectedServer.id);
    } catch (err: any) {
      toast.error(err.message ||
          (ar ? "فشل فحص حالة Hotek" : "Failed to check Hotek status"));
    } finally {
      setTestingServer(false);
    }
  };

  if (!currentPropertyId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <KeyIcon />
            {ar ? "إعدادات الأقفال" : "Door Lock Settings"}
          </CardTitle>
          <CardDescription>
            {ar
              ? "اختر فرع محدد لإدارة إعدادات Hotek."
              : "Select one property to manage Hotek settings."}
          </CardDescription>
        </CardHeader>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <KeyIcon />
          {ar ? "إعدادات Hotek Smart Server" : "Hotek Smart Server"}
        </CardTitle>
        <CardDescription>
          {ar
            ? "إدارة السيرفر الخاص بالفرع الحالي."
            : "Manage the current property's server."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-5">
        {/* ── Status Bar ── */}
        <div className="flex flex-wrap items-center gap-2">
          <Badge
            variant={serverConfigured ? "default" : "secondary"}
            className={serverOnline ? "gap-1 bg-emerald-600" : "gap-1"}
          >
            <Server className="h-3.5 w-3.5" />
            {!serverConfigured
              ? ar
                ? "Smart Server غير محفوظ"
                : "Smart Server Not Configured"
              : serverOnline
                ? ar
                  ? "Smart Server Online"
                  : "Smart Server Online"
                : serverEnabled
                  ? ar
                    ? "Smart Server Waiting"
                    : "Smart Server Waiting"
                  : ar
                    ? "Smart Server متوقف"
                    : "Smart Server Disabled"}
          </Badge>
          {remoteAddress && (
            <span className="text-sm text-muted-foreground">
              {remoteAddress}
            </span>
          )}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              refetchStatus();
              loadConfig(selectedServer?.id);
            }}
          >
            <RefreshCw className="h-4 w-4" />
          </Button>
        </div>

        {/* ── Smart Server Config ── */}
        <div className="rounded-md border bg-muted/20 p-4 space-y-4">
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div>
              <h3 className="text-sm font-semibold">
                {ar ? "Smart Server" : "Smart Server"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {selectedServer
                  ? `${selectedServer.host}:${selectedServer.port} · ${selectedServer.workstation}`
                  : ar
                    ? "لم يتم حفظ سيرفر لهذا الفرع بعد."
                    : "No server saved for this property yet."}
              </p>
            </div>
            {servers.length > 1 && (
              <div className="w-full md:w-64">
                <Select
                  value={String(selectedServer?.id ?? "")}
                  onValueChange={(value) => setSelectedServerId(Number(value))}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {servers.map((server) => (
                      <SelectItem key={server.id} value={String(server.id)}>
                        {server.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-5">
            <Field label={ar ? "الاسم" : "Name"}>
              <Input
                value={serverForm.name}
                onChange={(e) =>
                  setServerForm((prev) => ({ ...prev, name: e.target.value }))
                }
              />
            </Field>
            <Field label="Host">
              <Input
                value={serverForm.host}
                onChange={(e) =>
                  setServerForm((prev) => ({ ...prev, host: e.target.value }))
                }
              />
            </Field>
            <Field label="Port">
              <Input
                inputMode="numeric"
                value={serverForm.port}
                onChange={(e) =>
                  setServerForm((prev) => ({ ...prev, port: e.target.value }))
                }
              />
            </Field>
            <Field label="Workstation">
              <Input
                value={serverForm.workstation}
                onChange={(e) =>
                  setServerForm((prev) => ({
                    ...prev,
                    workstation: e.target.value,
                  }))
                }
              />
            </Field>
            <Field label="Server Code">
              <Input
                value={serverForm.serverCode}
                onChange={(e) =>
                  setServerForm((prev) => ({
                    ...prev,
                    serverCode: e.target.value,
                  }))
                }
              />
            </Field>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Badge variant="outline">Fidelio FIAS</Badge>
            <div className="flex items-center gap-2">
              <Switch
                checked={serverForm.isActive}
                onCheckedChange={(checked) =>
                  setServerForm((prev) => ({ ...prev, isActive: checked }))
                }
              />
              <span className="text-sm">{ar ? "نشط" : "Active"}</span>
            </div>
            {selectedServer?.lastSuccessAt && (
              <span className="text-xs text-muted-foreground">
                {ar ? "آخر اتصال ناجح: " : "Last success: "}
                {formatDate(selectedServer.lastSuccessAt, language)}
              </span>
            )}
            {selectedServer?.lastError && (
              <span className="text-xs text-amber-600">
                {selectedServer.lastError}
              </span>
            )}
            <div className="ml-auto flex gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={testServer}
                disabled={!selectedServer || testingServer}
              >
                {testingServer ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-4 w-4" />
                )}
                {ar ? "فحص" : "Check"}
              </Button>
              <Button
                type="button"
                onClick={saveServer}
                disabled={savingServer}
              >
                {savingServer ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Save className="h-4 w-4" />
                )}
                {ar ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="text-xs text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

function KeyIcon() {
  return <Server className="h-4 w-4 text-primary" />;
}
