import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
} from "@/components/ui/form";
import { Separator } from "@/components/ui/separator";
import { Checkbox } from "@/components/ui/checkbox";
import { Shield } from "lucide-react";
import { useFormContext } from "react-hook-form";
import type { SettingsFormData } from "../hooks/useSettingsForm";

interface SecuritySettingsProps {
  language: string;
  isLoading: boolean;
}

export function SecuritySettings({
  language,
  isLoading,
}: SecuritySettingsProps) {
  const form = useFormContext<SettingsFormData>();
  const ar = language === "ar";

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="w-4 h-4 text-primary" />
          {ar ? "سياسة كلمة المرور" : "Password Policy"}
        </CardTitle>
        <CardDescription>
          {ar
            ? "تحكم في متطلبات كلمة المرور للمستخدمين"
            : "Control password requirements for users"}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <div className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <FormField
                control={form.control}
                name="passwordMinLength"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {ar ? "الحد الأدنى للطول" : "Min Length"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={4}
                        max={32}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passwordExpiryDays"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {ar ? "انتهاء الصلاحية (أيام)" : "Expiry (days)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={365}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passwordHistoryCount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {ar ? "عدد كلمات المرور المحفوظة" : "Password History"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={50}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator />
            <p className="text-sm font-medium text-muted-foreground">
              {ar ? "متطلبات التعقيد" : "Complexity Requirements"}
            </p>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField
                control={form.control}
                name="passwordRequireUppercase"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="text-sm cursor-pointer">
                      {ar ? "حرف كبير" : "Uppercase"}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passwordRequireLowercase"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="text-sm cursor-pointer">
                      {ar ? "حرف صغير" : "Lowercase"}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passwordRequireNumber"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="text-sm cursor-pointer">
                      {ar ? "رقم" : "Number"}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="passwordRequireSymbol"
                render={({ field }) => (
                  <FormItem className="flex items-center justify-between rounded-lg border p-3">
                    <FormLabel className="text-sm cursor-pointer">
                      {ar ? "رمز خاص" : "Symbol"}
                    </FormLabel>
                    <FormControl>
                      <Switch
                        checked={field.value}
                        onCheckedChange={field.onChange}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-2" />
            <CardTitle className="text-lg">
              {ar ? "قفل الحساب" : "Account Lockout"}
            </CardTitle>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mt-2">
              <FormField
                control={form.control}
                name="lockoutThreshold"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {ar
                        ? "عدد المحاولات الفاشلة المسموحة"
                        : "Failed Attempts Threshold"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={20}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lockoutDurationMinutes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      {ar ? "مدة القفل (دقائق)" : "Lockout Duration (minutes)"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={1440}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                  </FormItem>
                )}
              />
            </div>

            <Separator className="my-2" />
            <CardTitle className="text-lg">
              {ar
                ? "التحقق بخطوتين الإجباري"
                : "Mandatory Two-Step Verification"}
            </CardTitle>
            <FormField
              control={form.control}
              name="requireTwoFactorRoles"
              render={({ field }) => {
                const selected = new Set(
                  String(field.value ?? "")
                    .split(/[,\s]+/)
                    .map((r) => r.trim().toLowerCase())
                    .filter(Boolean),
                );
                const toggle = (role: string, on: boolean) => {
                  const next = new Set(selected);
                  if (on) next.add(role);
                  else next.delete(role);
                  field.onChange([...next].join(","));
                };
                return (
                  <FormItem>
                    <FormLabel>
                      {ar
                        ? "الأدوار اللي لازم تفعّل التحقق بخطوتين"
                        : "Roles that must set up two-step verification"}
                    </FormLabel>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mt-2">
                      {TWO_FACTOR_ROLE_OPTIONS.map((opt) => (
                        <label
                          key={opt.role}
                          className="flex items-center gap-2 rounded-lg border px-3 py-2 text-sm cursor-pointer"
                        >
                          <Checkbox
                            checked={selected.has(opt.role)}
                            onCheckedChange={(v) =>
                              toggle(opt.role, v === true)
                            }
                          />
                          <span>{ar ? opt.ar : opt.en}</span>
                        </label>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      {ar
                        ? "المستخدم بالدور ده لو دخل من غير تحقق بخطوتين مش هيقدر يعمل أي حاجة غير إنه يفعّله، وما يقدرش يوقفه بعد كده."
                        : "A user in these roles can't do anything after signing in until it's set up, and can't turn it off afterwards."}
                    </p>
                  </FormItem>
                );
              }}
            />
          </div>
        </Form>
      </CardContent>
    </Card>
  );
}

const TWO_FACTOR_ROLE_OPTIONS: { role: string; ar: string; en: string }[] = [
  { role: "super_admin", ar: "مدير النظام (Super Admin)", en: "Super Admin" },
  {
    role: "system_admin",
    ar: "مسؤول النظام (System Admin)",
    en: "System Admin",
  },
  { role: "admin", ar: "مدير فندق (Admin)", en: "Property Admin" },
  { role: "manager", ar: "مدير السكن (Manager)", en: "Housing Manager" },
  { role: "hr_admin", ar: "الموارد البشرية", en: "HR Admin" },
];
