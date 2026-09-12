import { useState, useMemo } from "react";
import {
  useCreateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import { useAuth } from "@/context/AuthContext";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  UserCog,
  User,
  Plus,
  Mail,
  Phone,
  Lock,
  Eye,
  EyeOff,
  Shield,
  ShieldCheck,
  ShieldAlert,
  Crown,
  Building2,
  Building,
  Headphones,
  Wrench,
  Star,
  Check,
  Loader2,
  Sparkles,
  CheckCircle2,
  Copy,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import { getPermissionsForRoles } from "@/lib/permissions";
import { SYSTEM_ROLES, WORKFLOW_ROLES, roleColor } from "../utils";
import {
  PasswordStrengthMeter,
  evaluatePassword,
} from "./PasswordStrengthMeter";
import { cn } from "@/lib/utils";

interface CreateUserDialogProps {
  properties: any[];
}

export function CreateUserDialog({ properties }: CreateUserDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { activePropertyId, isSuperAdmin } = useProperty();
  const { isSystemAdmin } = useAuth();

  const [isOpen, setIsOpen] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Form state
  const [form, setForm] = useState({
    username: "",
    email: "",
    phone: "",
    password: "",
    role: "manager",
    jobTitle: "none",
    status: "ACTIVE" as "ACTIVE" | "INACTIVE",
    propertyId: (activePropertyId && typeof activePropertyId === "number") ? activePropertyId : 0,
    propertyIds: (activePropertyId && typeof activePropertyId === "number") ? [activePropertyId] : ([] as number[]),
  });

  // Client-side validation errors
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    properties?: string;
  }>({});

  const availableProperties = useMemo(() => {
    return properties || [];
  }, [properties]);

  const resetForm = () => {
    const defaultPid = (activePropertyId && typeof activePropertyId === "number") ? activePropertyId : (availableProperties[0]?.id || 0);
    setForm({
      username: "",
      email: "",
      phone: "",
      password: "",
      role: "manager",
      jobTitle: "none",
      status: "ACTIVE",
      propertyId: defaultPid,
      propertyIds: defaultPid ? [defaultPid] : [],
    });
    setErrors({});
    setShowPassword(false);
  };

  const createMutation = useCreateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(
          ar ? "تم إنشاء المستخدم بنجاح" : "User created successfully",
        );
        setIsOpen(false);
        resetForm();
      },
      onError: (e: any) => {
        toast.error(
          e.message || (ar ? "خطأ في إنشاء المستخدم" : "Error creating user"),
        );
      },
    },
  });

  // Calculate permissions preview
  const resolvedPermissions = useMemo(() => {
    return getPermissionsForRoles([form.role]);
  }, [form.role]);

  // Password evaluation
  const pwdEvaluation = useMemo(() => {
    return evaluatePassword(form.password);
  }, [form.password]);

  // Generate strong random password
  const handleGeneratePassword = () => {
    const chars = "abcdefghjkmnpqrstuvwxyz";
    const uppers = "ABCDEFGHJKLMNPQRSTUVWXYZ";
    const numbers = "23456789";
    const symbols = "!@#$%^&*";
    let pwd = "";
    pwd += uppers.charAt(Math.floor(Math.random() * uppers.length));
    pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    pwd += numbers.charAt(Math.floor(Math.random() * numbers.length));
    pwd += symbols.charAt(Math.floor(Math.random() * symbols.length));
    const all = chars + uppers + numbers + symbols;
    for (let i = 0; i < 8; i++) {
      pwd += all.charAt(Math.floor(Math.random() * all.length));
    }
    setForm((f) => ({ ...f, password: pwd }));
    setShowPassword(true);
    if (errors.password) setErrors((err) => ({ ...err, password: undefined }));
    toast.success(ar ? "تم توليد كلمة سر معقدة مطابقة لسياسة الأمان" : "Strong password generated");
  };

  const handleCopyCredentials = () => {
    const text = `Sunrise Staff Housing Account:\nUsername: ${form.username || "-"}\nPassword: ${form.password}\nRole: ${form.role}`;
    navigator.clipboard.writeText(text);
    toast.success(ar ? "تم نسخ بيانات الاعتماد إلى الحافظة" : "Credentials copied to clipboard");
  };

  // Handle property toggle
  const toggleProperty = (pid: number) => {
    setForm((prev) => {
      const exists = prev.propertyIds.includes(pid);
      let newPids = exists
        ? prev.propertyIds.filter((id) => id !== pid)
        : [...prev.propertyIds, pid];

      let newPrimary = prev.propertyId;
      if (exists && prev.propertyId === pid) {
        newPrimary = newPids[0] || 0;
      } else if (!exists && newPids.length === 1) {
        newPrimary = pid;
      }

      return {
        ...prev,
        propertyIds: newPids,
        propertyId: newPrimary,
      };
    });
    if (errors.properties) {
      setErrors((e) => ({ ...e, properties: undefined }));
    }
  };

  // Set specific property as primary
  const setPrimaryProperty = (pid: number) => {
    setForm((prev) => {
      const newPids = prev.propertyIds.includes(pid)
        ? prev.propertyIds
        : [...prev.propertyIds, pid];
      return {
        ...prev,
        propertyIds: newPids,
        propertyId: pid,
      };
    });
  };

  const selectAllProperties = () => {
    const allIds = availableProperties.map((p) => p.id);
    setForm((prev) => ({
      ...prev,
      propertyIds: allIds,
      propertyId: prev.propertyId || allIds[0] || 0,
    }));
    if (errors.properties) {
      setErrors((e) => ({ ...e, properties: undefined }));
    }
  };

  const clearPropertySelection = () => {
    setForm((prev) => ({
      ...prev,
      propertyIds: [],
      propertyId: 0,
    }));
  };

  // Form submission with validation
  const onSubmit = () => {
    const newErrors: typeof errors = {};

    // Validate username
    if (!form.username.trim()) {
      newErrors.username = ar ? "اسم المستخدم مطلوب" : "Username is required";
    } else if (form.username.trim().length < 3) {
      newErrors.username = ar
        ? "يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل"
        : "Username must be at least 3 characters";
    }

    // Validate email format if provided
    if (form.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) {
      newErrors.email = ar
        ? "البريد الإلكتروني غير صالح"
        : "Invalid email address format";
    }

    // Validate password against backend policy
    if (!form.password) {
      newErrors.password = ar ? "كلمة المرور مطلوبة" : "Password is required";
    } else if (form.password.length < 8) {
      newErrors.password = ar
        ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
        : "Password must be at least 8 characters";
    } else if (!pwdEvaluation.isValid) {
      newErrors.password = ar
        ? "كلمة المرور لا تستوفي شروط الأمان (أحرف كبيرة وصغيرة وأرقام)"
        : "Password must meet security policy (uppercase, lowercase, and numbers)";
    }

    // Validate property assignment
    const needsProperty = form.role !== "super_admin";
    const pids =
      form.propertyIds.length > 0
        ? form.propertyIds
        : form.propertyId
          ? [form.propertyId]
          : [];
    const primaryPid = form.propertyId || pids[0] || (activePropertyId && typeof activePropertyId === "number" ? activePropertyId : 1);

    if (needsProperty && pids.length === 0) {
      newErrors.properties = ar
        ? "الرجاء اختيار فرع واحد على الأقل"
        : "Please select at least one property";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(
        ar
          ? "الرجاء تصحيح الأخطاء في النموذج قبل الإرسال"
          : "Please fix the validation errors before submitting",
      );
      return;
    }

    setErrors({});

    const resolvedRoles = [form.role].filter(Boolean);

    createMutation.mutate({
      data: {
        username: form.username.trim(),
        email: form.email.trim() || undefined,
        phone: form.phone.trim() || undefined,
        password: form.password,
        propertyId: primaryPid,
        propertyIds: pids,
        roles: resolvedRoles,
        jobTitle: form.jobTitle === "none" ? null : form.jobTitle,
        permissions: resolvedPermissions,
        status: form.status,
      } as any,
    });
  };

  const getRoleIcon = (roleVal: string) => {
    switch (roleVal) {
      case "super_admin":
        return <Crown className="w-4 h-4 text-purple-600 dark:text-purple-400" />;
      case "admin":
        return <ShieldAlert className="w-4 h-4 text-red-600 dark:text-red-400" />;
      case "manager":
        return <Building2 className="w-4 h-4 text-blue-600 dark:text-blue-400" />;
      case "receptionist":
        return <Headphones className="w-4 h-4 text-green-600 dark:text-green-400" />;
      case "maintenance_staff":
        return <Wrench className="w-4 h-4 text-orange-600 dark:text-orange-400" />;
      case "housekeeping_staff":
        return <Sparkles className="w-4 h-4 text-sky-600 dark:text-sky-400" />;
      default:
        return <ShieldCheck className="w-4 h-4 text-muted-foreground" />;
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(v) => {
        setIsOpen(v);
        if (!v) resetForm();
      }}
    >
      <PermissionGate module="users" action="create">
        <DialogTrigger asChild>
          <Button className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white gap-2 shadow-xs transition-all hover:shadow-md">
            <Plus className="w-4 h-4" />
            {ar ? "إضافة مستخدم جديد" : "Add New User"}
          </Button>
        </DialogTrigger>
      </PermissionGate>

      <DialogContent
        className="max-w-3xl p-0 overflow-hidden bg-card border-border/80 shadow-2xl rounded-2xl"
        srTitle={ar ? "إضافة مستخدم جديد" : "Add New User"}
      >
        {/* Luxury Navy & Gold Header */}
        <div className="bg-gradient-to-r from-[#0F2A44] via-[#143555] to-[#0F2A44] p-6 text-white border-b border-[#C9A24D]/30 relative overflow-hidden">
          <div className="absolute top-0 right-0 w-64 h-64 bg-[#C9A24D]/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20" />
          <DialogHeader>
            <DialogTitle className="flex items-center gap-3.5 text-xl font-bold tracking-tight text-white">
              <div className="w-11 h-11 rounded-xl bg-white/10 backdrop-blur-md border border-white/20 flex items-center justify-center text-[#C9A24D] shadow-inner">
                <UserCog className="w-6 h-6" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <span>{ar ? "إضافة مستخدم جديد" : "Add New User"}</span>
                  <span className="text-xs px-2.5 py-0.5 rounded-full bg-[#C9A24D]/20 text-[#C9A24D] border border-[#C9A24D]/40 font-medium">
                    {ar ? "نظام الإسكان" : "Staff Housing"}
                  </span>
                </div>
                <span className="block text-xs font-normal text-slate-300 mt-1">
                  {ar
                    ? "أدخل بيانات الاعتماد، الصلاحيات، وربط الفروع الفندقية بدقة"
                    : "Configure user credentials, role permissions, and hotel property assignments"}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* SECTION 1: Account Credentials */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center font-bold text-xs">
                  1
                </div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <User className="w-4 h-4 text-blue-500" />
                  {ar ? "بيانات الحساب والاعتماد" : "Account Credentials"}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {ar ? "معلومات تسجيل الدخول" : "Sign-in identity"}
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {/* Username */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  {ar ? "اسم المستخدم" : "Username"}
                  <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <User className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    dir="ltr"
                    className={cn(
                      "pl-9 font-mono text-sm bg-background border-border/80 focus-visible:ring-[#0F2A44]/30",
                      errors.username && "border-destructive focus-visible:ring-destructive/20",
                    )}
                    placeholder="e.g. m.tarek"
                    value={form.username}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, username: e.target.value.toLowerCase().replace(/\s+/g, "") }));
                      if (errors.username) setErrors((err) => ({ ...err, username: undefined }));
                    }}
                    autoComplete="off"
                  />
                </div>
                {errors.username && (
                  <p className="text-[11px] text-destructive">{errors.username}</p>
                )}
              </div>

              {/* Email */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  {ar ? "البريد الإلكتروني" : "Email Address"}
                </Label>
                <div className="relative">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    dir="ltr"
                    type="email"
                    className={cn(
                      "pl-9 font-mono text-sm bg-background border-border/80 focus-visible:ring-[#0F2A44]/30",
                      errors.email && "border-destructive focus-visible:ring-destructive/20",
                    )}
                    placeholder="name@sunrise.com"
                    value={form.email}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, email: e.target.value }));
                      if (errors.email) setErrors((err) => ({ ...err, email: undefined }));
                    }}
                    autoComplete="email"
                  />
                </div>
                {errors.email && (
                  <p className="text-[11px] text-destructive">{errors.email}</p>
                )}
              </div>

              {/* Phone */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                  {ar ? "رقم الهاتف" : "Phone Number"}
                </Label>
                <div className="relative">
                  <Phone className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    dir="ltr"
                    type="tel"
                    className="pl-9 font-mono text-sm bg-background border-border/80 focus-visible:ring-[#0F2A44]/30"
                    placeholder="+20 100 000 0000"
                    value={form.phone}
                    onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Security & Password */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center font-bold text-xs">
                  2
                </div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Lock className="w-4 h-4 text-amber-500" />
                  {ar ? "الأمان وكلمة المرور" : "Security & Password"}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {ar ? "سياسة كلمة مرور النظام (8+ أحرف)" : "System policy (8+ chars)"}
              </span>
            </div>

            <div className="space-y-3">
              <div className="space-y-1.5">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                    {ar ? "كلمة المرور الجديدة" : "New Password"}
                    <span className="text-destructive">*</span>
                  </Label>
                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGeneratePassword}
                      className="h-6 px-2 text-[11px] gap-1 border-[#C9A24D]/40 text-[#C9A24D] hover:bg-[#C9A24D]/10 font-semibold"
                    >
                      <Sparkles className="w-3 h-3" />
                      {ar ? "توليد كلمة معقدة" : "Generate"}
                    </Button>
                    {form.password && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={handleCopyCredentials}
                        className="h-6 px-1.5 text-[11px] gap-1 text-muted-foreground hover:text-foreground"
                        title={ar ? "نسخ بيانات الحساب" : "Copy credentials"}
                      >
                        <Copy className="w-3 h-3" />
                        {ar ? "نسخ" : "Copy"}
                      </Button>
                    )}
                  </div>
                </div>
                <div className="relative">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                  <Input
                    dir="ltr"
                    type={showPassword ? "text" : "password"}
                    className={cn(
                      "pl-9 pr-10 font-mono text-sm bg-background border-border/80 focus-visible:ring-[#0F2A44]/30",
                      errors.password && "border-destructive focus-visible:ring-destructive/20",
                    )}
                    placeholder={ar ? "أدخل كلمة مرور قوية (8 أحرف على الأقل)" : "Enter strong password (8+ chars)"}
                    value={form.password}
                    onChange={(e) => {
                      setForm((f) => ({ ...f, password: e.target.value }));
                      if (errors.password) setErrors((err) => ({ ...err, password: undefined }));
                    }}
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground p-1 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-[11px] text-destructive">{errors.password}</p>
                )}
              </div>

              {/* Real-time Password Strength Meter & Live Rule Chips */}
              <PasswordStrengthMeter password={form.password} isArabic={ar} showRules={true} />
            </div>
          </div>

          {/* SECTION 3: Roles & Access Level */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-purple-500/10 text-purple-600 dark:text-purple-400 flex items-center justify-center font-bold text-xs">
                  3
                </div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Shield className="w-4 h-4 text-purple-500" />
                  {ar ? "الأدوار ومستويات الوصول (RBAC)" : "Roles & Access Level (RBAC)"}
                </h3>
              </div>
              <Badge variant="outline" className="text-[11px] font-normal border-purple-500/30 text-purple-700 dark:text-purple-300 bg-purple-500/5">
                <Sparkles className="w-3 h-3 mr-1 text-purple-500" />
                {ar
                  ? `تمنح ${resolvedPermissions.length} صلاحية افتراضية`
                  : `Grants ${resolvedPermissions.length} default permissions`}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* System Role */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {ar ? "دور النظام الأساسي" : "System Role"} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={form.role}
                  onValueChange={(v) => {
                    setForm((f) => ({ ...f, role: v }));
                    if (errors.properties && v === "super_admin") {
                      setErrors((e) => ({ ...e, properties: undefined }));
                    }
                  }}
                >
                  <SelectTrigger className="bg-background border-border/80 focus:ring-[#0F2A44]/20">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(form.role)}
                        <span className="font-medium">
                          {SYSTEM_ROLES.find((r) => r.value === form.role)?.[ar ? "labelAr" : "label"]}
                        </span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_ROLES.map((r) => {
                      const isSuper = r.value === "super_admin";
                      const isAdmin = r.value === "admin";
                      // Guard: non-system admins cannot create system admins
                      const disabled = (isSuper || isAdmin) && !isSystemAdmin;

                      return (
                        <SelectItem key={r.value} value={r.value} disabled={disabled}>
                          <div className="flex items-center gap-2.5 py-0.5">
                            {getRoleIcon(r.value)}
                            <span className="font-medium">{ar ? r.labelAr : r.label}</span>
                            <span
                              className={cn(
                                "text-[10px] px-2 py-0.5 rounded-full ml-auto rtl:ml-0 rtl:mr-auto",
                                roleColor(r.value),
                              )}
                            >
                              {r.value}
                            </span>
                          </div>
                        </SelectItem>
                      );
                    })}
                  </SelectContent>
                </Select>
                <p className="text-[11px] text-muted-foreground">
                  {form.role === "super_admin"
                    ? ar ? "صلاحيات كاملة وغير مقيدة على جميع فروع المجمعات." : "Unrestricted full administrative access across all properties."
                    : form.role === "admin"
                      ? ar ? "صلاحيات إدارية عليا للنظام والمستخدمين." : "High-level management of users and housing modules."
                      : form.role === "manager"
                        ? ar ? "إدارة التسكين والغرف وتوزيع الأسرة في الفروع المحددة." : "Manages accommodation, rooms, and assignments in assigned branches."
                        : form.role === "receptionist"
                          ? ar ? "موظف الاستقبال: تسجيل الوصول والمغادرة والنزلاء." : "Front desk: Check-in, check-out, and guest hosting."
                          : ar ? "فني الصيانة: إدارة واستلام بلاغات وتذاكر الصيانة." : "Maintenance staff: Tickets and work orders."}
                </p>
              </div>

              {/* Workflow Role */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {ar ? "منصب الاعتماد في مسارات العمل" : "Workflow Role (Approvals)"}
                </Label>
                <Select
                  value={form.jobTitle}
                  onValueChange={(v) => setForm((f) => ({ ...f, jobTitle: v }))}
                >
                  <SelectTrigger className="bg-background border-border/80 focus:ring-[#0F2A44]/20">
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
                <p className="text-[11px] text-muted-foreground">
                  {ar
                    ? "يحدد دور المستخدم في مصفوفة اعتمادات الاستضافة وطلبات التسكين."
                    : "Determines user position in hosting approval workflow chains."}
                </p>
              </div>
            </div>
          </div>

          {/* SECTION 4: Property Assignment */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center font-bold text-xs">
                  4
                </div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <Building className="w-4 h-4 text-emerald-500" />
                  {ar ? "تعيين الفروع الفندقية والمجمعات" : "Property Assignment"}
                </h3>
              </div>
              {form.role !== "super_admin" && (
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-primary hover:text-primary/90"
                    onClick={selectAllProperties}
                  >
                    {ar ? "تحديد الكل" : "Select All"}
                  </Button>
                  <span className="text-muted-foreground/40">|</span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs px-2 text-muted-foreground hover:text-foreground"
                    onClick={clearPropertySelection}
                  >
                    {ar ? "إلغاء التحديد" : "Clear Selection"}
                  </Button>
                </div>
              )}
            </div>

            {form.role === "super_admin" ? (
              <div className="rounded-xl bg-purple-500/10 border border-purple-500/20 p-4 flex items-center gap-3 text-purple-900 dark:text-purple-200">
                <Crown className="w-5 h-5 text-purple-600 shrink-0" />
                <div className="text-xs leading-relaxed">
                  <span className="font-semibold block mb-0.5">
                    {ar ? "وصول عام وشامل لجميع الفروع" : "Global Hotel Access"}
                  </span>
                  {ar
                    ? "حساب مدير النظام العام (Super Admin) يمتلك صلاحية الوصول التلقائي لجميع الفروع الفندقية ومجمعات سكن العاملين الحالية والمستقبلية."
                    : "Super Admin accounts inherently possess unrestricted access to all current and future hotel properties and housing compounds."}
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>
                    {ar
                      ? "اختر الفروع المسموح للمستخدم إدارتها (انقر النجمة لتحديد الفرع الأساسي):"
                      : "Select properties this user can manage (click star for primary branch):"}
                  </span>
                  <span className="font-mono text-xs font-semibold text-foreground">
                    {form.propertyIds.length} / {availableProperties.length}
                  </span>
                </div>

                {/* Properties Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1">
                  {availableProperties.map((p) => {
                    const isSelected = form.propertyIds.includes(p.id);
                    const isPrimary = form.propertyId === p.id;

                    return (
                      <div
                        key={p.id}
                        onClick={() => toggleProperty(p.id)}
                        className={cn(
                          "relative group flex items-center justify-between p-3 rounded-xl border transition-all cursor-pointer select-none",
                          isSelected
                            ? "bg-card border-primary/40 shadow-xs ring-1 ring-primary/20"
                            : "bg-muted/20 border-border/50 hover:bg-muted/40 opacity-85 hover:opacity-100",
                        )}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className={cn(
                              "w-4 h-4 rounded-md border flex items-center justify-center transition-all shrink-0",
                              isSelected
                                ? "bg-primary border-primary text-primary-foreground"
                                : "border-muted-foreground/40 bg-background",
                            )}
                          >
                            {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                          </div>
                          <div className="truncate">
                            <span className="text-xs font-medium text-foreground block truncate">
                              {p.name}
                            </span>
                            <span className="text-[10px] font-mono text-muted-foreground bg-muted/60 px-1.5 py-0.2 rounded">
                              {p.code}
                            </span>
                          </div>
                        </div>

                        {/* Primary Property Marker */}
                        {isSelected && (
                          <button
                            type="button"
                            title={ar ? "تعيين كفرع أساسي" : "Set as primary property"}
                            onClick={(e) => {
                              e.stopPropagation();
                              setPrimaryProperty(p.id);
                            }}
                            className={cn(
                              "p-1.5 rounded-lg transition-colors ml-1 rtl:ml-0 rtl:mr-1 shrink-0",
                              isPrimary
                                ? "text-amber-500 bg-amber-500/10"
                                : "text-muted-foreground/40 hover:text-amber-500 hover:bg-amber-500/10",
                            )}
                          >
                            <Star
                              className={cn(
                                "w-4 h-4",
                                isPrimary && "fill-amber-500",
                              )}
                            />
                          </button>
                        )}
                      </div>
                    );
                  })}
                </div>

                {errors.properties && (
                  <p className="text-[11px] text-destructive">{errors.properties}</p>
                )}
              </div>
            )}
          </div>

          {/* SECTION 5: Account Status */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-xs">
                  5
                </div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-500" />
                  {ar ? "حالة تفعيل الحساب" : "Account Status"}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {ar ? "التحكم بإمكانية تسجيل الدخول" : "Sign-in authorization"}
              </span>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div
                onClick={() => setForm((f) => ({ ...f, status: "ACTIVE" }))}
                className={cn(
                  "p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none",
                  form.status === "ACTIVE"
                    ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                    : "bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground",
                )}
              >
                <div className="w-3 h-3 rounded-full bg-emerald-500 shrink-0 shadow-xs" />
                <div>
                  <span className="text-xs font-semibold block">
                    {ar ? "حساب نشط (Active)" : "Active Account"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "يسمح بتسجيل الدخول مباشرة" : "Allowed to log in immediately"}
                  </span>
                </div>
              </div>

              <div
                onClick={() => setForm((f) => ({ ...f, status: "INACTIVE" }))}
                className={cn(
                  "p-3 rounded-xl border flex items-center gap-3 cursor-pointer transition-all select-none",
                  form.status === "INACTIVE"
                    ? "bg-slate-500/10 border-slate-500/40 ring-1 ring-slate-500/30 text-slate-900 dark:text-slate-200"
                    : "bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground",
                )}
              >
                <div className="w-3 h-3 rounded-full bg-slate-400 shrink-0 shadow-xs" />
                <div>
                  <span className="text-xs font-semibold block">
                    {ar ? "حساب معطل (Inactive)" : "Inactive Account"}
                  </span>
                  <span className="text-[10px] text-muted-foreground block">
                    {ar ? "حظر تسجيل الدخول مؤقتاً" : "Sign-in blocked temporarily"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100/70 dark:bg-slate-900/70 border-t border-border/70 p-4 px-6 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
            <span>
              {ar
                ? "سيتم تطبيق الصلاحيات الافتراضية للدور فور الإنشاء."
                : "Role baseline permissions are automatically applied."}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="border-border/80"
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={onSubmit}
              disabled={createMutation.isPending}
              className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white font-medium shadow-sm transition-all hover:shadow-md min-w-32"
            >
              {createMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {ar ? "جاري الإنشاء..." : "Creating..."}
                </>
              ) : (
                <>
                  <Plus className="w-4 h-4 mr-1.5" />
                  {ar ? "إنشاء المستخدم" : "Create User"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
