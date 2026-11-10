// Property dialog > Branding (logo, colors) tab.
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { TabsContent } from "@/components/ui/tabs";
import { Building2, Upload, X } from "lucide-react";
import type { PropertiesState } from "./usePropertiesState";

export function renderBrandingTab(s: PropertiesState) {
  const { ar, form, setForm, logoFileRef } = s;
  return (
<TabsContent value="branding" className="space-y-4 mt-4">
              {/* Logo Upload */}
              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ar ? "شعار العقار (اختياري)" : "PROPERTY LOGO (OPTIONAL)"}
                </Label>
                <input
                  ref={logoFileRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (!file) return;
                    if (file.size > 2 * 1024 * 1024) {
                      toast.error(
                        ar
                          ? "الملف كبير جداً (الحد الأقصى 2 ميغابايت)"
                          : "File too large (max 2MB)",
                      );
                      return;
                    }
                    const reader = new FileReader();
                    reader.onload = () =>
                      setForm((f) => ({ ...f, logo: reader.result as string }));
                    reader.readAsDataURL(file);
                    e.target.value = "";
                  }}
                />
                <div className="flex items-center gap-3">
                  {form.logo ? (
                    <div className="relative">
                      <img
                        src={form.logo}
                        alt="Logo"
                        className="h-16 w-16 rounded-lg object-contain border bg-white"
                      />
                      <button
                        type="button"
                        onClick={() => setForm((f) => ({ ...f, logo: "" }))}
                        className="absolute -top-1.5 -right-1.5 bg-destructive text-white rounded-full w-4 h-4 flex items-center justify-center hover:bg-destructive/80"
                      >
                        <X className="w-2.5 h-2.5" />
                      </button>
                    </div>
                  ) : (
                    <div
                      className="h-16 w-16 rounded-lg border-2 border-dashed border-border flex items-center justify-center cursor-pointer hover:border-primary/60 transition-colors"
                      onClick={() => logoFileRef.current?.click()}
                    >
                      <Building2 className="w-6 h-6 text-muted-foreground/40" />
                    </div>
                  )}
                  <div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => logoFileRef.current?.click()}
                    >
                      <Upload className="w-3.5 h-3.5 mr-1.5" />
                      {ar ? "رفع الشعار" : "Upload Logo"}
                    </Button>
                    <p className="text-xs text-muted-foreground mt-1">
                      {ar ? "JPG أو PNG، حجم أقصى 2MB" : "JPG or PNG, max 2MB"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                  {ar ? "اللون الأساسي" : "PRIMARY COLOR"}
                </Label>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={form.primaryColor}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, primaryColor: e.target.value }))
                    }
                    className="h-12 w-16 rounded-lg border cursor-pointer"
                  />
                  <div className="flex-1">
                    <Input
                      value={form.primaryColor}
                      onChange={(e) =>
                        setForm((f) => ({ ...f, primaryColor: e.target.value }))
                      }
                      className="font-mono"
                      placeholder="#0F2A44"
                    />
                  </div>
                  <div
                    className="h-12 w-12 rounded-lg border flex items-center justify-center"
                    style={{ backgroundColor: form.primaryColor }}
                  >
                    <Building2 className="w-5 h-5 text-white" />
                  </div>
                </div>
              </div>

              <div className="p-4 border rounded-lg bg-muted/30 space-y-2">
                <p className="text-sm font-semibold">
                  {ar ? "معاينة" : "Preview"}
                </p>
                <div className="flex items-center gap-3">
                  <div
                    className="h-10 w-10 rounded-lg flex items-center justify-center overflow-hidden"
                    style={{
                      backgroundColor: form.logo
                        ? "transparent"
                        : form.primaryColor,
                    }}
                  >
                    {form.logo ? (
                      <img
                        src={form.logo}
                        alt="logo"
                        className="h-10 w-10 rounded-lg object-contain border"
                      />
                    ) : (
                      <Building2 className="h-5 w-5 text-white" />
                    )}
                  </div>
                  <div>
                    <p className="font-bold text-sm">
                      {form.displayName ||
                        form.name ||
                        (ar ? "اسم العقار" : "Property Name")}
                    </p>
                    <p className="text-xs text-muted-foreground font-mono">
                      {form.code || "CODE"}
                    </p>
                  </div>
                </div>
              </div>
            </TabsContent>
  );
}
