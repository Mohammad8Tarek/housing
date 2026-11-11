// User detail > General & profile tab.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  Copy,
  Sparkles,
  RefreshCw,
  Eye,
  EyeOff,
  Crown,
  User,
} from "lucide-react";
import { SYSTEM_ROLES, WORKFLOW_ROLES, roleColor } from "../utils";
import { PasswordStrengthMeter } from "../components/PasswordStrengthMeter";
import { cn } from "@/lib/utils";
import type { UserDetailPageState } from "./useUserDetailPageState";

export function renderProfileTab(s: UserDetailPageState) {
  const {
    ar,
    user,
    name,
    setName,
    email,
    setEmail,
    phone,
    setPhone,
    nationalId,
    setNationalId,
    department,
    setDepartment,
    jobTitle,
    setJobTitle,
    primaryRole,
    setPrimaryRole,
    isActive,
    setIsActive,
    changePassword,
    setChangePassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPasswordText,
    setShowPasswordText,
    isUnlocking,
    isLocked,
    lockoutRemainingMinutes,
    handleGeneratePassword,
    handleCopyCredentials,
    handleInstantUnlock,
  } = s;
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      {/* Main Account Details */}
      <div className="lg:col-span-2 space-y-6">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <User className="w-5 h-5 text-[#0F2A44]" />
              {ar ? "معلومات الحساب والهوية" : "Account Identity & Contact"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "تعديل البيانات الأساسية، البريد الإلكتروني، ورقم الهاتف."
                : "Update profile name, contact information, and department."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "اسم المستخدم (Username)" : "Username"}
                </Label>
                <Input
                  value={user.username}
                  disabled
                  className="bg-muted font-mono"
                />
                <span className="text-[10px] text-muted-foreground">
                  {ar
                    ? "اسم المستخدم ثابت ولا يمكن تعديله"
                    : "Username is immutable"}
                </span>
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "الاسم الكامل / الظاهر" : "Full / Display Name"}
                </Label>
                <Input
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={
                    ar ? "الاسم الكامل للموظف" : "Employee Full Name"
                  }
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "البريد الإلكتروني" : "Email Address"}
                </Label>
                <Input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="user@example.com"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "رقم الهاتف" : "Phone Number"}
                </Label>
                <Input
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+20 100 000 0000"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "الرقم القومي (14 رقم)" : "National ID (14 digits)"}
                </Label>
                <Input
                  value={nationalId}
                  onChange={(e) =>
                    setNationalId(
                      e.target.value.replace(/\D/g, "").slice(0, 14),
                    )
                  }
                  placeholder="29901011234567"
                  maxLength={14}
                  className="font-mono tracking-wider"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar ? "القسم / الإدارة" : "Department"}
                </Label>
                <Input
                  value={department}
                  onChange={(e) => setDepartment(e.target.value)}
                  placeholder={
                    ar
                      ? "إدارة الإسكان / الصيانة / الاستقبال"
                      : "Housing / Maintenance / HR"
                  }
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs font-semibold">
                  {ar
                    ? "منصب الاعتماد ومسار العمل (Workflow Role)"
                    : "Workflow Approval Role"}
                </Label>
                <Select
                  value={jobTitle || "none"}
                  onValueChange={(val) =>
                    setJobTitle(val === "none" ? "" : val)
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {WORKFLOW_ROLES.map((r) => (
                      <SelectItem key={r.value} value={r.value}>
                        {ar ? r.labelAr : r.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* System Roles Selector */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Crown className="w-5 h-5 text-[#C9A24D]" />
              {ar ? "الدور الوظيفي الأساسي في النظام" : "Primary System Role"}
            </CardTitle>
            <CardDescription>
              {ar
                ? "يحدد الدور الصلاحيات الافتراضية الممنوحة للمستخدم في جميع موديولات النظام."
                : "Defines the base permissions inherited by this account across all modules."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {SYSTEM_ROLES.map((role) => {
                const isSelected = primaryRole === role.value;
                return (
                  <div
                    key={role.value}
                    onClick={() => setPrimaryRole(role.value)}
                    className={cn(
                      "p-3.5 rounded-xl border-2 cursor-pointer transition-all flex items-start gap-3",
                      isSelected
                        ? "border-[#C9A24D] bg-[#C9A24D]/5 shadow-sm"
                        : "border-border hover:border-border/80 hover:bg-muted/30",
                    )}
                  >
                    <div
                      className={cn(
                        "w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0",
                        isSelected
                          ? "border-[#C9A24D]"
                          : "border-muted-foreground",
                      )}
                    >
                      {isSelected && (
                        <div className="w-2 h-2 rounded-full bg-[#C9A24D]" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-sm">
                          {ar ? role.labelAr : role.label}
                        </span>
                        <span
                          className={cn(
                            "text-[10px] px-1.5 py-0.2 rounded font-semibold",
                            roleColor(role.value),
                          )}
                        >
                          {role.value}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {role.value === "housekeeping_staff"
                          ? ar
                            ? "مخصص لأوامر النظافة والخدمات وتجهيز الغرف فقط"
                            : "Restricted to housekeeping & cleaning orders"
                          : role.value === "maintenance_staff"
                            ? ar
                              ? "مخصص لأوامر الصيانة الفنية وإصلاح الأعطال فقط"
                              : "Restricted to technical maintenance & work orders"
                            : role.value === "super_admin"
                              ? ar
                                ? "صلاحيات مطلقة لإدارة جميع الفنادق والفرع والنظام"
                                : "Full unrestricted control across all hotels"
                              : role.value === "admin"
                                ? ar
                                  ? "إدارة شاملة للمستخدمين والغرف والتسكين"
                                  : "Comprehensive property administration"
                                : ar
                                  ? "صلاحيات تشغيلية محددة حسب الوظيفة"
                                  : "Role-based operations"}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Right Column: Password & Account Security */}
      <div className="space-y-6">
        {/* Account Status Switch */}
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <ShieldCheck className="w-4 h-4 text-emerald-600" />
              {ar ? "حالة تفعيل الحساب" : "Account Status"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 rounded-xl border bg-muted/20">
              <div className="space-y-0.5">
                <Label className="text-sm font-bold">
                  {isActive
                    ? ar
                      ? "الحساب نشط ومفعل"
                      : "Account Active"
                    : ar
                      ? "الحساب معطل"
                      : "Account Disabled"}
                </Label>
                <p className="text-xs text-muted-foreground">
                  {isActive
                    ? ar
                      ? "يمكن للمستخدم تسجيل الدخول واستخدام النظام"
                      : "User can sign in and operate"
                    : ar
                      ? "تم إيقاف الدخول لهذا الحساب مؤقتاً"
                      : "Sign-in is blocked for this user"}
                </p>
              </div>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            {isLocked && (
              <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 space-y-2">
                <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                  <Lock className="w-4 h-4" />
                  <span>
                    {ar ? "الحساب مقفول أمنياً" : "Account Security Locked"}
                  </span>
                </div>
                <p className="text-xs text-rose-600 dark:text-rose-300">
                  {ar
                    ? `تم قفل الحساب بسبب ${user.failedLoginAttempts} محاولات دخول خاطئة متتالية. يتبقى ${lockoutRemainingMinutes} دقيقة لفك القفل تلقائياً.`
                    : `Locked due to ${user.failedLoginAttempts} failed attempts. ${lockoutRemainingMinutes}m left.`}
                </p>
                <Button
                  size="sm"
                  onClick={handleInstantUnlock}
                  disabled={isUnlocking}
                  className="w-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold"
                >
                  {isUnlocking ? (
                    <RefreshCw className="w-3.5 h-3.5 animate-spin me-1" />
                  ) : (
                    <Unlock className="w-3.5 h-3.5 me-1" />
                  )}
                  {ar ? "فتح القفل فوراً ومسح المحاولات" : "Unlock Account Now"}
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Password Reset & Generator Card */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle className="text-base flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-blue-600" />
                {ar ? "تعيين كلمة المرور" : "Password Management"}
              </CardTitle>
              <div className="flex items-center gap-2">
                <span className="text-xs font-medium text-muted-foreground">
                  {ar ? "تغيير كلمة المرور" : "Change Password"}
                </span>
                <Switch
                  checked={changePassword}
                  onCheckedChange={(checked) => {
                    setChangePassword(checked);
                    if (!checked) {
                      setNewPassword("");
                      setConfirmPassword("");
                    }
                  }}
                />
              </div>
            </div>
            <CardDescription>
              {ar
                ? "كلمة المرور الحالية محفوظة ومحمية تلقائياً. فعل الخيار فقط إذا كنت ترغب بتغييرها."
                : "Current password is kept safe. Enable toggle only if you want to set a new password."}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {!changePassword ? (
              <div className="flex items-center justify-between p-3.5 rounded-lg border border-dashed border-border/80 bg-muted/20">
                <div className="flex items-center gap-2.5 text-xs text-muted-foreground">
                  <ShieldCheck className="w-4 h-4 text-emerald-500 shrink-0" />
                  <span>
                    {ar
                      ? "كلمة المرور الحالية آمنة ولن يتم تعديلها عند حفظ التغييرات"
                      : "Current password is safe and will not be changed on save"}
                  </span>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setChangePassword(true)}
                  className="text-xs font-medium h-7 px-2.5 text-[#C9A24D] border-[#C9A24D]/30 hover:bg-[#C9A24D]/10"
                >
                  <KeyRound className="w-3.5 h-3.5 me-1" />
                  {ar ? "تغيير كلمة المرور" : "Change Password"}
                </Button>
              </div>
            ) : (
              <div className="space-y-3 animate-fade-in">
                <div className="flex justify-end">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGeneratePassword}
                    className="text-xs text-[#C9A24D] hover:text-[#b08e40] font-bold p-0 h-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 me-1" />
                    {ar ? "توليد ذكي عشوائي" : "Generate Strong"}
                  </Button>
                </div>

                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">
                      {ar ? "كلمة المرور الجديدة" : "New Password"}
                    </Label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showPasswordText ? (
                        <EyeOff className="w-3 h-3" />
                      ) : (
                        <Eye className="w-3 h-3" />
                      )}
                      {showPasswordText
                        ? ar
                          ? "إخفاء"
                          : "Hide"
                        : ar
                          ? "إظهار"
                          : "Show"}
                    </button>
                  </div>
                  <Input
                    type={showPasswordText ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    className="font-mono text-sm"
                  />
                  {newPassword && (
                    <PasswordStrengthMeter password={newPassword} />
                  )}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">
                    {ar ? "تأكيد كلمة المرور" : "Confirm Password"}
                  </Label>
                  <Input
                    type={showPasswordText ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    autoComplete="new-password"
                    className="font-mono text-sm"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {ar
                        ? "كلمتا المرور غير متطابقتين"
                        : "Passwords do not match"}
                    </p>
                  )}
                </div>

                {newPassword && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleCopyCredentials}
                    className="w-full text-xs"
                  >
                    <Copy className="w-3.5 h-3.5 me-1.5" />
                    {ar ? "نسخ بيانات الدخول للحافظة" : "Copy Credentials"}
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
