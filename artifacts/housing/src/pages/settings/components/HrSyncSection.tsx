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
import { RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";

interface HrSyncSectionProps {
  propertyId: number | null;
  language: string;
}

export function HrSyncSection({ propertyId, language }: HrSyncSectionProps) {
  const queryClient = useQueryClient();
  const [apiUrl, setApiUrl] = useState("");
  const [apiKey, setApiKey] = useState("");
  const [fieldMapping, setFieldMapping] = useState("");
  const [isActive, setIsActive] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const ar = language === "ar";

  useEffect(() => {
    if (!propertyId) return;
    fetch(`/api/hr-sync/config?propertyId=${propertyId}`, {
      credentials: "include",
    })
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (d) {
          setApiUrl(d.apiUrl || "");
          setApiKey(d.apiKey || "");
          setFieldMapping(
            d.fieldMapping ? JSON.stringify(d.fieldMapping, null, 2) : "",
          );
          setIsActive(d.isActive ?? false);
        }
      })
      .catch(() => { toast.error(ar ? "فشل تحميل إعدادات المزامنة" : "Failed to load sync settings"); })
    }, [propertyId]);

  const saveConfig = async () => {
    if (!propertyId) return;
    try {
      let fm: any = undefined;
      if (fieldMapping.trim()) {
        try {
          fm = JSON.parse(fieldMapping);
        } catch {
          toast.error(ar ? "JSON غير صحيح" : "Invalid JSON");
          return;
        }
      }
      const resp = await fetch("/api/hr-sync/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId,
          apiUrl: apiUrl.trim() || undefined,
          apiKey: apiKey.trim() || undefined,
          fieldMapping: fm,
          isActive,
        }),
      });
      if (!resp.ok) throw new Error((await resp.json()).message);
      toast.success(ar ? "تم حفظ إعدادات HR" : "HR sync config saved");
    } catch (err: any) {
      toast.error(err.message || "Error");
    }
  };

  const triggerSync = async () => {
    if (!propertyId) return;
    setSyncing(true);
    try {
      const resp = await fetch("/api/hr-sync/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ propertyId }),
      });
      if (!resp.ok) throw new Error((await resp.json()).message);
      const d = await resp.json();
      toast.success(ar
          ? `تمت المزامنة: ${d.created || 0} جديد، ${d.updated || 0} تحديث`
          : `Sync complete: ${d.created || 0} created, ${d.updated || 0} updated`);
    } catch (err: any) {
      toast.error(err.message || "Sync failed");
    } finally {
      setSyncing(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="w-4 h-4 text-primary" />
          {ar ? "مزامنة HR" : "HR Sync"}
        </CardTitle>
        <CardDescription>
          {ar
            ? "ربط نظام HR الخارجي لجلب بيانات الموظفين تلقائياً"
            : "Connect external HR system to automatically import employee data"}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex items-center gap-3">
          <span className="text-sm font-medium">
            {ar ? "الحالة:" : "Status:"}
          </span>
          <Badge variant={isActive ? "default" : "secondary"}>
            {isActive ? (ar ? "نشط" : "Active") : ar ? "متوقف" : "Disabled"}
          </Badge>
          <Switch checked={isActive} onCheckedChange={setIsActive} />
        </div>

        <div className="grid gap-4">
          <div>
            <label className="text-sm font-medium mb-1 block">
              {ar ? "رابط API" : "API URL"}
            </label>
            <Input
              value={apiUrl}
              onChange={(e) => setApiUrl(e.target.value)}
              placeholder={
                ar
                  ? "https://hr-system.com/api/employees"
                  : "https://hr-system.com/api/employees"
              }
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              {ar ? "مفتاح API" : "API Key"}
            </label>
            <Input
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="••••••••"
              type="password"
            />
          </div>
          <div>
            <label className="text-sm font-medium mb-1 block">
              {ar ? "تطابق الحقول (JSON)" : "Field Mapping (JSON)"}
            </label>
            <Textarea
              value={fieldMapping}
              onChange={(e) => setFieldMapping(e.target.value)}
              rows={4}
              placeholder={
                ar
                  ? '{"firstName": "name_first", "lastName": "name_last"}'
                  : '{"firstName": "name_first", "lastName": "name_last"}'
              }
            />
            <p className="text-xs text-muted-foreground mt-1">
              {ar
                ? "تطابق أسماء حقول النظام مع حقول HR"
                : "Map your DB fields to HR system field names"}
            </p>
          </div>
        </div>

        <div className="flex gap-3 pt-2">
          <Button onClick={saveConfig}>
            {ar ? "حفظ الإعدادات" : "Save Config"}
          </Button>
          <Button
            variant="secondary"
            onClick={triggerSync}
            disabled={syncing || !isActive}
          >
            <RefreshCw
              className={`w-4 h-4 mr-1.5 ${syncing ? "animate-spin" : ""}`}
            />
            {syncing
              ? ar
                ? "جارٍ المزامنة..."
                : "Syncing..."
              : ar
                ? "مزامنة الآن"
                : "Sync Now"}
          </Button>
        </div>

        <Separator />
        <div className="pt-2">
          <h4 className="text-sm font-medium mb-2">
            {ar
              ? "نظام HR الخارجي يرسل البيانات عن طريق:"
              : "External HR system pushes data via:"}
          </h4>
          <div className="bg-muted/30 rounded-lg p-3 text-xs font-mono">
            <p className="mb-1">
              <span className="text-primary font-bold">POST</span>{" "}
              /api/hr-sync/receive
            </p>
            <p className="mb-1">
              Header:{" "}
              <span className="text-amber-600">
                x-api-key: {apiKey || "<your-api-key>"}
              </span>
            </p>
            <pre className="text-muted-foreground mt-2">
              {JSON.stringify(
                {
                  propertyId,
                  employees: [
                    {
                      employeeId: "EMP001",
                      firstName: "Mohamed",
                      lastName: "Ali",
                      nationalId: "1234567890",
                      department: "IT",
                      jobTitle: "Developer",
                      phone: "0501234567",
                      email: "m@example.com",
                    },
                  ],
                },
                null,
                2,
              )}
            </pre>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
