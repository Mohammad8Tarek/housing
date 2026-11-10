// Property dialog > General tab.
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TabsContent } from "@/components/ui/tabs";
import type { PropertiesState } from "./usePropertiesState";

export function renderGeneralTab(s: PropertiesState) {
  const { ar, form, setForm } = s;
  return (
<TabsContent value="general" className="space-y-4 mt-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ar ? "اسم العقار (داخلي)" : "PROPERTY NAME (INTERNAL)"}{" "}
                  <span className="text-red-500">*</span>
                </Label>
                <Input
                  placeholder={
                    ar
                      ? "مثال: صن رايز كريستال باي"
                      : "e.g. Sunrise Crystal Bay"
                  }
                  value={form.name}
                  onChange={(e) =>
                    setForm((f) => ({ ...f, name: e.target.value }))
                  }
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "كود العقار (فريد)" : "PROPERTY CODE (UNIQUE)"}{" "}
                    <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    placeholder="e.g. SCB-01"
                    value={form.code}
                    onChange={(e) =>
                      setForm((f) => ({
                        ...f,
                        code: e.target.value.toUpperCase(),
                      }))
                    }
                    className="font-mono"
                  />
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? "يستخدم للتعريف وتسجيل الدخول"
                      : "Used for identification & login"}
                  </p>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "اسم العرض (للعموم)" : "DISPLAY NAME (PUBLIC)"}
                  </Label>
                  <Input
                    placeholder={
                      ar ? "مثال: منتجع كريستال باي" : "e.g. Crystal Bay Resort"
                    }
                    value={form.displayName}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, displayName: e.target.value }))
                    }
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "اللغة الافتراضية" : "DEFAULT LANGUAGE"}
                  </Label>
                  <Select
                    value={form.defaultLanguage}
                    onValueChange={(v) =>
                      setForm((f) => ({ ...f, defaultLanguage: v }))
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="en">🇺🇸 English</SelectItem>
                      <SelectItem value="ar">🇸🇦 العربية</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "الحالة" : "STATUS"}
                  </Label>
                  <Select
                    value={form.status}
                    onValueChange={(v) => setForm((f) => ({ ...f, status: v }))}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">
                        {ar ? "نشط" : "Active"}
                      </SelectItem>
                      <SelectItem value="inactive">
                        {ar ? "غير نشط" : "Inactive"}
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </TabsContent>
  );
}
