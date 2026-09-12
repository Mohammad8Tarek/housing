// @ts-nocheck
import { useState, useMemo, useEffect, useRef } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import { usePermission } from "@/hooks/use-permission";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
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
  Mail,
  Phone,
  Lock,
  KeyRound,
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
  CheckCircle2,
  AlertTriangle,
  Upload,
  Loader2,
  Pen,
  X,
  Sparkles,
  Unlock,
  Layers,
  FileSpreadsheet,
  CheckCheck,
  Sliders,
  RotateCcw,
  SlidersHorizontal,
  Briefcase,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import {
  SYSTEM_ROLES,
  WORKFLOW_ROLES,
  roleColor,
} from "../utils";
import {
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  PERMISSION_GROUPS,
  ROLE_DEFAULT_PERMISSIONS,
  permKey,
  type Module,
  type Action,
} from "@/lib/permissions";
import {
  PasswordStrengthMeter,
  evaluatePassword,
} from "./PasswordStrengthMeter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

interface UserManagementSheetProps {
  user: any | null;
  onClose: () => void;
  properties?: any[];
  initialTab?: "profile" | "properties" | "permissions" | "signature";
}

export function UserManagementSheet({
  user,
  onClose,
  properties: propProperties = [],
  initialTab = "profile",
}: UserManagementSheetProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { user: currentUser, isSystemAdmin } = useAuth();
  const { can, isAdmin } = usePermission();
  const { properties: contextProperties, isSuperAdmin } = useProperty();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<"profile" | "properties" | "permissions" | "signature">(initialTab);

  useEffect(() => {
    if (initialTab) setActiveTab(initialTab);
  }, [initialTab, user?.id]);

  // Available properties for assignment
  const availableProperties = useMemo(() => {
    const list = propProperties?.length ? propProperties : contextProperties || [];
    return list;
  }, [propProperties, contextProperties]);

  // Form States
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [primaryRole, setPrimaryRole] = useState("user");
  const [isActive, setIsActive] = useState(true);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);

  // Password reset section state
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Unlocking state
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Permissions state
  const [isDynamicInheritance, setIsDynamicInheritance] = useState(true);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [permSearch, setPermSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");

  // Signature state
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isUploadingSig, setIsUploadingSig] = useState(false);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize data when user changes
  useEffect(() => {
    if (!user) return;

    setName(user.name || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setJobTitle(user.jobTitle || "");
    const r = (user.roles?.[0] || "user").toLowerCase();
    setPrimaryRole(r);
    setIsActive(user.status !== "inactive");

    const pids = user.propertyIds?.length
      ? user.propertyIds
      : user.propertyId
      ? [user.propertyId]
      : [];
    setSelectedPropertyIds(pids);

    // Password reset reset
    setShowPasswordReset(false);
    setNewPassword("");
    setConfirmPassword("");

    // Signature preview
    setSignaturePreview(user.signatureImageUrl || null);

    // Permissions initialization
    const explicit = (user.permissions as string[] | undefined) ?? [];
    if (explicit.length === 0) {
      setIsDynamicInheritance(true);
      setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[r] || []));
    } else {
      setIsDynamicInheritance(false);
      const normalized = explicit.map((p) => {
        let s = String(p).trim().toLowerCase();
        if (s.startsWith("employees.")) s = s.replace("employees.", "profiles.");
        if (s.startsWith("employees:")) s = s.replace("employees:", "profiles:");
        return s;
      });
      setPerms(new Set(normalized));
    }
  }, [user]);

  // Is account currently locked?
  const isLocked = useMemo(() => {
    if (!user?.lockedUntil) return false;
    return new Date(user.lockedUntil) > new Date();
  }, [user?.lockedUntil]);

  // Lockout remaining minutes
  const lockoutRemainingMinutes = useMemo(() => {
    if (!isLocked || !user?.lockedUntil) return 0;
    return Math.max(1, Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000));
  }, [isLocked, user?.lockedUntil]);

  // Update mutation
  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast.success(ar ? "تم حفظ كافة التغييرات بنجاح" : "All changes saved successfully");
        onClose();
      },
      onError: (err: any) => {
        toast.error(err.message || (ar ? "فشل حفظ التغييرات" : "Failed to save changes"));
      },
    },
  });

  // Handle instant unlock
  const handleInstantUnlock = async () => {
    if (!user?.id || isUnlocking) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/users/${user.id}/unlock`, { method: "POST" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to unlock");
      }
      toast.success(ar ? "تم فتح قفل الحساب بنجاح ومسح المحاولات الفاشلة" : "Account unlocked successfully");
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      if (user) user.lockedUntil = null;
    } catch (e: any) {
      toast.error(e.message || (ar ? "فشل فتح القفل" : "Failed to unlock"));
    } finally {
      setIsUnlocking(false);
    }
  };

  // Role default sync
  const handleRoleChange = (newRole: string) => {
    setPrimaryRole(newRole);
    if (isDynamicInheritance) {
      setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[newRole] || []));
    }
  };

  const toggleDynamicInheritance = (enabled: boolean) => {
    setIsDynamicInheritance(enabled);
    if (enabled) {
      setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[primaryRole] || []));
      toast.info(ar ? "تمت استعادة الصلاحيات الافتراضية للدور" : "Restored role default permissions");
    }
  };

  // Module capability level calculations:
  // "none" | "view_only" | "full" | "custom"
  const getModuleCapabilityLevel = (mod: Module): "none" | "view_only" | "full" | "custom" => {
    const actions = MODULE_ACTIONS[mod] || [];
    if (!actions.length) return "none";

    const grantedCount = actions.filter((act) => perms.has(permKey(mod, act))).length;
    if (grantedCount === 0) return "none";
    if (grantedCount === actions.length) return "full";
    if (grantedCount === 1 && perms.has(permKey(mod, "view"))) return "view_only";
    return "custom";
  };

  const setModuleCapabilityLevel = (mod: Module, level: "none" | "view_only" | "full") => {
    setIsDynamicInheritance(false);
    const actions = MODULE_ACTIONS[mod] || [];
    setPerms((prev) => {
      const next = new Set(prev);
      // Remove all actions for this module first
      actions.forEach((act) => next.delete(permKey(mod, act)));

      if (level === "view_only") {
        next.add(permKey(mod, "view"));
      } else if (level === "full") {
        actions.forEach((act) => next.add(permKey(mod, act)));
      }
      return next;
    });
  };

  const toggleSinglePerm = (mod: Module, act: Action) => {
    setIsDynamicInheritance(false);
    const key = permKey(mod, act);
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  // Bulk Perm Actions
  const handleGrantAllRead = () => {
    setIsDynamicInheritance(false);
    setPerms((prev) => {
      const next = new Set(prev);
      MODULES.forEach((mod) => next.add(permKey(mod, "view")));
      return next;
    });
    toast.success(ar ? "تم منح صلاحية القراءة لكافة الموديولات" : "Granted read-only access to all modules");
  };

  const handleGrantAllFull = () => {
    setIsDynamicInheritance(false);
    setPerms((prev) => {
      const next = new Set(prev);
      MODULES.forEach((mod) => {
        const acts = MODULE_ACTIONS[mod] || [];
        acts.forEach((act) => next.add(permKey(mod, act)));
      });
      return next;
    });
    toast.success(ar ? "تم منح التحكم الكامل لكافة الموديولات" : "Granted full access to all modules");
  };

  const handleResetToRoleDefaults = () => {
    setIsDynamicInheritance(true);
    setPerms(new Set(ROLE_DEFAULT_PERMISSIONS[primaryRole] || []));
    toast.success(ar ? `تمت استعادة صلاحيات دور (${primaryRole}) الافتراضية` : `Reset to default (${primaryRole}) permissions`);
  };

  // Upload Signature
  const handleSignatureFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(ar ? "يرجى رفع صورة PNG أو JPEG" : "Please upload a PNG or JPEG image");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(ar ? "حجم الصورة يجب أن يكون أقل من 2 ميجابايت" : "Image must be under 2MB");
      return;
    }

    setIsUploadingSig(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });

      const res = await fetch(`/api/users/${user.id}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to upload signature");

      setSignaturePreview(data.signatureImageUrl || base64);
      toast.success(ar ? "تم حفظ التوقيع الإلكتروني بنجاح" : "Digital signature saved successfully");
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل رفع التوقيع" : "Failed to upload signature"));
    } finally {
      setIsUploadingSig(false);
    }
  };

  // Save All Changes
  const handleSave = async () => {
    if (!user?.id) return;

    // Validate password reset if toggled
    if (showPasswordReset) {
      if (!newPassword || newPassword.length < 6) {
        toast.error(ar ? "كلمة المرور يجب ألا تقل عن 6 أحرف" : "Password must be at least 6 characters");
        setActiveTab("profile");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error(ar ? "كلمات المرور غير متطابقة" : "Passwords do not match");
        setActiveTab("profile");
        return;
      }
    }

    const payload: any = {
      name: name.trim(),
      email: email.trim(),
      phone: phone.trim(),
      jobTitle: jobTitle.trim(),
      roles: [primaryRole],
      status: isActive ? "active" : "inactive",
    };

    // Properties
    if (selectedPropertyIds.length > 0) {
      payload.propertyIds = selectedPropertyIds;
      payload.propertyId = selectedPropertyIds[0];
    }

    // Password reset if requested
    if (showPasswordReset && newPassword) {
      payload.password = newPassword;
    }

    // Permissions: If dynamic inheritance is ON, pass empty array to inherit; else pass explicit
    if (isDynamicInheritance) {
      payload.permissions = [];
    } else {
      payload.permissions = Array.from(perms);
    }

    updateMutation.mutate({
      id: user.id,
      data: payload,
    });
  };

  if (!user) return null;

  return (
    <Sheet open={!!user} onOpenChange={(open) => { if (!open) onClose(); }}>
      <SheetContent
        side={ar ? "left" : "right"}
        className="w-full sm:max-w-2xl lg:max-w-3xl overflow-y-auto p-0 flex flex-col justify-between bg-card text-card-foreground border-border shadow-2xl"
      >
        {/* ── Top Header ── */}
        <div>
          <SheetHeader className="p-6 pb-4 border-b border-border/50 bg-muted/20 relative">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3.5">
                <div className="w-13 h-13 rounded-2xl bg-gradient-to-br from-primary/20 via-primary/10 to-transparent border border-primary/30 flex items-center justify-center shrink-0 shadow-xs">
                  <span className="text-lg font-bold text-primary font-mono">
                    {user.username?.slice(0, 2).toUpperCase()}
                  </span>
                </div>
                <div>
                  <SheetTitle className="text-xl font-bold flex items-center gap-2">
                    <span>{name || user.username}</span>
                    <Badge variant="outline" className="font-mono text-xs px-2 py-0 border-border">
                      @{user.username}
                    </Badge>
                  </SheetTitle>
                  <SheetDescription className="text-xs text-muted-foreground flex items-center gap-2 mt-1 flex-wrap">
                    {/* Role Badge */}
                    <Badge className={cn("text-[11px] px-2 py-0.5 border font-semibold", roleColor(primaryRole))}>
                      {primaryRole.toUpperCase()}
                    </Badge>

                    {/* Status Badge */}
                    {isLocked ? (
                      <Badge variant="destructive" className="text-[11px] px-2 py-0.5 animate-pulse flex items-center gap-1">
                        <Lock className="w-3 h-3" />
                        <span>{ar ? `مقفول (${lockoutRemainingMinutes} د)` : `Locked (${lockoutRemainingMinutes}m)`}</span>
                      </Badge>
                    ) : isActive ? (
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/30">
                        {ar ? "حساب نشط" : "Active"}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-[11px] px-2 py-0.5 bg-muted text-muted-foreground">
                        {ar ? "معطل" : "Inactive"}
                      </Badge>
                    )}

                    {/* Properties Summary */}
                    <span className="text-muted-foreground">·</span>
                    <span className="text-xs text-muted-foreground font-medium">
                      {selectedPropertyIds.length > 1
                        ? ar ? `${selectedPropertyIds.length} فروع مصرحة` : `${selectedPropertyIds.length} Properties`
                        : selectedPropertyIds.length === 1
                        ? availableProperties.find(p => p.id === selectedPropertyIds[0])?.name || (ar ? "فرع واحد" : "1 Property")
                        : (ar ? "غير مخصص لفروع" : "No Property Scope")}
                    </span>
                  </SheetDescription>
                </div>
              </div>
            </div>

            {/* Lockout Quick Alert with 1-click Unlock */}
            {isLocked && (
              <div className="mt-4 p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-center justify-between gap-3 text-destructive">
                <div className="flex items-center gap-2 text-xs font-semibold">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>
                    {ar
                      ? `تم قفل الحساب بسبب تكرار محاولات الدخول الخاطئة. متبقي ${lockoutRemainingMinutes} دقيقة قبل الفتح التلقائي.`
                      : `Account locked due to consecutive failed attempts. ${lockoutRemainingMinutes}m remaining.`}
                  </span>
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="destructive"
                  onClick={handleInstantUnlock}
                  disabled={isUnlocking}
                  className="shrink-0 h-8 gap-1.5 text-xs font-bold"
                >
                  {isUnlocking ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Unlock className="w-3.5 h-3.5" />}
                  <span>{ar ? "فك القفل فوراً" : "Unlock Now"}</span>
                </Button>
              </div>
            )}

            {/* ── Segmented Navigation Tabs ── */}
            <div className="flex items-center gap-1.5 mt-4 p-1 bg-muted/60 dark:bg-muted/40 rounded-xl border border-border/60 text-xs font-semibold overflow-x-auto no-scrollbar">
              <button
                type="button"
                onClick={() => setActiveTab("profile")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0",
                  activeTab === "profile"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <UserCog className="w-3.5 h-3.5" />
                <span>{ar ? "الملف والأمان" : "Profile & Security"}</span>
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("properties")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0",
                  activeTab === "properties"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Building2 className="w-3.5 h-3.5" />
                <span>{ar ? "الفنادق والفروع" : "Property Scope"}</span>
                {selectedPropertyIds.length > 0 && (
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 font-mono">
                    {selectedPropertyIds.length}
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("permissions")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0",
                  activeTab === "permissions"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{ar ? "الدور والصلاحيات" : "Role & Permissions"}</span>
                {!isDynamicInheritance && (
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 border-amber-500/40 text-amber-600 dark:text-amber-400">
                    {ar ? "مخصص" : "Custom"}
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab("signature")}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-lg transition-all shrink-0",
                  activeTab === "signature"
                    ? "bg-background text-foreground shadow-xs font-bold"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Pen className="w-3.5 h-3.5" />
                <span>{ar ? "التوقيع" : "Signature"}</span>
                {signaturePreview && (
                  <Check className="w-3 h-3 text-emerald-500" />
                )}
              </button>
            </div>
          </SheetHeader>

          {/* ── Tab Content Container ── */}
          <div className="p-6 space-y-6">
            {/* ═════════ TAB 1: PROFILE & SECURITY ═════════ */}
            {activeTab === "profile" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* General Info Grid */}
                <div className="space-y-4">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                    {ar ? "البيانات الأساسية للمستخدم" : "Basic Account Details"}
                  </h4>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{ar ? "الاسم الكامل" : "Full Name"}</Label>
                      <div className="relative">
                        <User className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          placeholder={ar ? "الاسم الكامل" : "Full Name"}
                          className="ps-9 h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{ar ? "المسمى الوظيفي" : "Job Title"}</Label>
                      <div className="relative">
                        <Briefcase className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={jobTitle}
                          onChange={(e) => setJobTitle(e.target.value)}
                          placeholder={ar ? "المسمى الوظيفي" : "Job Title"}
                          className="ps-9 h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{ar ? "البريد الإلكتروني" : "Email Address"}</Label>
                      <div className="relative">
                        <Mail className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          type="email"
                          value={email}
                          onChange={(e) => setEmail(e.target.value)}
                          placeholder="user@sunrise.com"
                          className="ps-9 h-10 text-sm"
                        />
                      </div>
                    </div>

                    <div className="space-y-1.5">
                      <Label className="text-xs font-semibold">{ar ? "رقم الهاتف" : "Phone Number"}</Label>
                      <div className="relative">
                        <Phone className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="+20 100 000 0000"
                          className="ps-9 h-10 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {/* Account Status Toggle */}
                <div className="p-4 rounded-xl bg-muted/40 border border-border/60 flex items-center justify-between gap-4">
                  <div className="space-y-0.5">
                    <Label className="text-sm font-bold flex items-center gap-2">
                      <span>{ar ? "حالة تنشيط الحساب" : "Account Active Status"}</span>
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {ar
                        ? "عند التعطيل لن يتمكن المستخدم من تسجيل الدخول إلى النظام أو البوابة."
                        : "When disabled, the user cannot log in to the management system or mobile portal."}
                    </p>
                  </div>
                  <Switch
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                </div>

                {/* Password Reset Accordion */}
                <div className="p-4 rounded-xl border border-border/60 bg-card/60 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2.5">
                      <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
                        <KeyRound className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-bold">{ar ? "إعادة تعيين كلمة المرور" : "Reset Account Password"}</p>
                        <p className="text-xs text-muted-foreground">
                          {ar ? "تعيين كلمة مرور جديدة مباشرة للحساب" : "Directly set a new secure password"}
                        </p>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setShowPasswordReset(!showPasswordReset)}
                      className="text-xs font-semibold h-8"
                    >
                      {showPasswordReset ? (ar ? "إلغاء التعيين" : "Cancel") : (ar ? "تغيير كلمة المرور" : "Change Password")}
                    </Button>
                  </div>

                  {showPasswordReset && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: "auto" }}
                      exit={{ opacity: 0, height: 0 }}
                      className="pt-3 border-t border-border/40 space-y-3.5"
                    >
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{ar ? "كلمة المرور الجديدة" : "New Password"}</Label>
                          <div className="relative">
                            <Input
                              type={showPasswordText ? "text" : "password"}
                              value={newPassword}
                              onChange={(e) => setNewPassword(e.target.value)}
                              placeholder={ar ? "أدخل كلمة المرور الجديدة" : "Enter new password"}
                              className="pe-9 h-10 text-sm"
                            />
                            <button
                              type="button"
                              onClick={() => setShowPasswordText(!showPasswordText)}
                              className="absolute end-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                            >
                              {showPasswordText ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                          </div>
                        </div>

                        <div className="space-y-1.5">
                          <Label className="text-xs font-semibold">{ar ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
                          <Input
                            type={showPasswordText ? "text" : "password"}
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder={ar ? "أعد إدخال كلمة المرور" : "Confirm new password"}
                            className="h-10 text-sm"
                          />
                        </div>
                      </div>

                      {/* Real-time Strength Meter */}
                      {newPassword && (
                        <PasswordStrengthMeter
                          password={newPassword}
                          showRules
                        />
                      )}
                    </motion.div>
                  )}
                </div>
              </motion.div>
            )}

            {/* ═════════ TAB 2: PROPERTIES SCOPE ═════════ */}
            {activeTab === "properties" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <div>
                    <h4 className="text-sm font-bold">{ar ? "تخصيص الفروع والمجمعات المصرح بها" : "Assigned Properties & Hotels"}</h4>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {ar
                        ? "المستخدم سيتمكن فقط من إدارة غرف ونزلاء وتذاكر الفروع المحددة هنا."
                        : "The user will be strictly isolated to manage data within the selected properties."}
                    </p>
                  </div>

                  <div className="flex items-center gap-1.5">
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPropertyIds(availableProperties.map((p) => p.id))}
                      className="text-xs font-semibold h-7"
                    >
                      {ar ? "تحديد الكل" : "Select All"}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setSelectedPropertyIds([])}
                      className="text-xs font-semibold h-7 text-muted-foreground"
                    >
                      {ar ? "مسح التحديد" : "Clear"}
                    </Button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  {availableProperties.map((property) => {
                    const isSelected = selectedPropertyIds.includes(property.id);
                    return (
                      <div
                        key={property.id}
                        onClick={() => {
                          setSelectedPropertyIds((prev) =>
                            prev.includes(property.id)
                              ? prev.filter((id) => id !== property.id)
                              : [...prev, property.id],
                          );
                        }}
                        className={cn(
                          "p-3.5 rounded-xl border transition-all cursor-pointer flex items-center justify-between gap-3 select-none",
                          isSelected
                            ? "bg-primary/5 border-primary shadow-xs ring-1 ring-primary/30"
                            : "bg-card border-border/60 hover:bg-muted/40",
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div
                            className={cn(
                              "w-9 h-9 rounded-lg flex items-center justify-center font-bold text-xs font-mono",
                              isSelected ? "bg-primary text-primary-foreground" : "bg-muted text-muted-foreground",
                            )}
                          >
                            {property.code || "HTL"}
                          </div>
                          <div>
                            <p className="text-xs font-bold text-foreground">{property.name}</p>
                            <p className="text-[11px] text-muted-foreground font-mono">{property.code}</p>
                          </div>
                        </div>

                        <div
                          className={cn(
                            "w-5 h-5 rounded-md border flex items-center justify-center transition-colors",
                            isSelected
                              ? "bg-primary border-primary text-primary-foreground"
                              : "border-muted-foreground/30 bg-background",
                          )}
                        >
                          {isSelected && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ═════════ TAB 3: ROLE & CAPABILITIES ═════════ */}
            {activeTab === "permissions" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-6"
              >
                {/* Primary Role Selector */}
                <div className="p-4 rounded-xl bg-card border border-border/60 space-y-3">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                        {ar ? "الدور الوظيفي الأساسي" : "Primary System Role"}
                      </Label>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {ar
                          ? "يحدد الصلاحيات القياسية للمستخدم في النظام وفقاً لمسؤولياته."
                          : "Defines the baseline authority and default permissions."}
                      </p>
                    </div>

                    <Select value={primaryRole} onValueChange={handleRoleChange}>
                      <SelectTrigger className="w-56 h-10 text-xs font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {SYSTEM_ROLES.map((r) => (
                          <SelectItem key={r.value} value={r.value} className="text-xs font-medium">
                            <span className="flex items-center gap-2">
                              <span>{ar ? r.labelAr : r.labelEn}</span>
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  {/* Dynamic Inheritance Toggle */}
                  <div className="p-3 rounded-lg bg-muted/40 border border-border/40 flex items-center justify-between gap-4">
                    <div className="flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-primary shrink-0" />
                      <div>
                        <p className="text-xs font-bold">
                          {ar ? "المزامنة الديناميكية مع الدور" : "Dynamic Role Synchronization"}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          {ar
                            ? "عند التفعيل يرث المستخدم صلاحيات الدور تلقائياً، وإذا تم تعديل الدور تتحدث صلاحياته فوراً."
                            : "Inherits all default role permissions without manual overrides."}
                        </p>
                      </div>
                    </div>
                    <Switch
                      checked={isDynamicInheritance}
                      onCheckedChange={toggleDynamicInheritance}
                    />
                  </div>
                </div>

                {/* Master Bulk Actions Bar */}
                <div className="flex items-center justify-between gap-2 flex-wrap bg-muted/30 p-2.5 rounded-xl border border-border/40">
                  <div className="flex items-center gap-1.5">
                    <Shield className="w-4 h-4 text-primary" />
                    <span className="text-xs font-bold">{ar ? "تحكم سريع في الموديولات" : "Module Capabilities"}</span>
                    <Badge variant="secondary" className="text-[10px] font-mono px-1.5">
                      {perms.size} {ar ? "صلاحية مفعّلة" : "active"}
                    </Badge>
                  </div>

                  <div className="flex items-center gap-1.5 flex-wrap">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGrantAllRead}
                      className="text-[11px] font-semibold h-7 px-2.5 gap-1"
                    >
                      <Eye className="w-3 h-3" />
                      <span>{ar ? "قراءة للكل" : "All Read"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={handleGrantAllFull}
                      className="text-[11px] font-semibold h-7 px-2.5 gap-1"
                    >
                      <CheckCheck className="w-3 h-3 text-emerald-500" />
                      <span>{ar ? "تحكم كامل للكل" : "All Full"}</span>
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={handleResetToRoleDefaults}
                      className="text-[11px] font-semibold h-7 px-2 text-muted-foreground hover:text-foreground gap-1"
                    >
                      <RotateCcw className="w-3 h-3" />
                      <span>{ar ? "استعادة الدور" : "Reset"}</span>
                    </Button>
                  </div>
                </div>

                {/* Group Filter & Perm Search */}
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex-1 min-w-[200px]">
                    <Input
                      value={permSearch}
                      onChange={(e) => setPermSearch(e.target.value)}
                      placeholder={ar ? "بحث في الموديولات والصلاحيات..." : "Search modules & permissions..."}
                      className="h-8 text-xs bg-card"
                    />
                  </div>
                  <Select value={selectedGroupFilter} onValueChange={setSelectedGroupFilter}>
                    <SelectTrigger className="w-44 h-8 text-xs font-medium">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all" className="text-xs">{ar ? "كافة المجموعات" : "All Groups"}</SelectItem>
                      {Object.entries(PERMISSION_GROUPS).map(([key, grp]) => (
                        <SelectItem key={key} value={key} className="text-xs">
                          {ar ? grp.labelAr : grp.labelEn}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Domain Groups with Module Capability Cards */}
                <div className="space-y-4">
                  {Object.entries(PERMISSION_GROUPS).map(([groupKey, grp]) => {
                    if (selectedGroupFilter !== "all" && selectedGroupFilter !== groupKey) return null;

                    const groupModules = grp.modules.filter((mod) => {
                      if (!permSearch.trim()) return true;
                      const q = permSearch.toLowerCase().trim();
                      const labelEn = MODULE_LABELS[mod]?.en?.toLowerCase() || "";
                      const labelAr = MODULE_LABELS[mod]?.ar || "";
                      return mod.includes(q) || labelEn.includes(q) || labelAr.includes(q);
                    });

                    if (!groupModules.length) return null;

                    return (
                      <div key={groupKey} className="space-y-2.5">
                        <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground uppercase tracking-wider px-1">
                          <span>{ar ? grp.labelAr : grp.labelEn}</span>
                          <span className="text-[10px] font-mono text-muted-foreground/60">({groupModules.length})</span>
                        </div>

                        <div className="space-y-2">
                          {groupModules.map((mod) => {
                            const modInfo = MODULE_LABELS[mod] || { ar: mod, en: mod };
                            const actions = MODULE_ACTIONS[mod] || [];
                            const capLevel = getModuleCapabilityLevel(mod);
                            const isExpanded = expandedModules[mod];

                            return (
                              <div
                                key={mod}
                                className="rounded-xl border border-border/50 bg-card overflow-hidden shadow-2xs transition-all hover:border-border"
                              >
                                {/* Module Header & Quick Capability Switcher */}
                                <div className="p-3.5 flex items-center justify-between gap-3 flex-wrap">
                                  <div className="flex items-center gap-2.5">
                                    <div className="p-1.5 rounded-lg bg-primary/10 text-primary font-mono text-xs font-bold">
                                      {mod.slice(0, 2).toUpperCase()}
                                    </div>
                                    <div>
                                      <p className="text-xs font-bold text-foreground">
                                        {ar ? modInfo.ar : modInfo.en}
                                      </p>
                                      <p className="text-[10px] text-muted-foreground font-mono">
                                        {mod} · {actions.length} {ar ? "إجراءات" : "actions"}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Quick Capability Level Pills */}
                                  <div className="flex items-center gap-1 bg-muted/60 dark:bg-muted/30 p-1 rounded-lg border border-border/40 text-[11px] font-semibold">
                                    <button
                                      type="button"
                                      onClick={() => setModuleCapabilityLevel(mod, "none")}
                                      className={cn(
                                        "px-2 py-1 rounded-md transition-all",
                                        capLevel === "none"
                                          ? "bg-destructive/15 text-destructive font-bold"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                      title={ar ? "حجب الصلاحية بالكامل عن هذا الموديول" : "No Access"}
                                    >
                                      {ar ? "بلا وصول" : "None"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setModuleCapabilityLevel(mod, "view_only")}
                                      className={cn(
                                        "px-2 py-1 rounded-md transition-all",
                                        capLevel === "view_only"
                                          ? "bg-primary/15 text-primary font-bold"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                      title={ar ? "قراءة واستعراض فقط" : "Read Only"}
                                    >
                                      {ar ? "مشاهدة" : "Read"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => setModuleCapabilityLevel(mod, "full")}
                                      className={cn(
                                        "px-2 py-1 rounded-md transition-all",
                                        capLevel === "full"
                                          ? "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400 font-bold"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                      title={ar ? "تشغيل وإدارة كاملة للموديول" : "Full Control"}
                                    >
                                      {ar ? "كامل" : "Full"}
                                    </button>

                                    <button
                                      type="button"
                                      onClick={() => {
                                        setExpandedModules((prev) => ({
                                          ...prev,
                                          [mod]: !prev[mod],
                                        }));
                                      }}
                                      className={cn(
                                        "px-2 py-1 rounded-md transition-all flex items-center gap-1",
                                        capLevel === "custom"
                                          ? "bg-amber-500/20 text-amber-600 dark:text-amber-400 font-bold"
                                          : "text-muted-foreground hover:text-foreground",
                                      )}
                                      title={ar ? "تخصيص الإجراءات التفصيلية" : "Custom Actions"}
                                    >
                                      <span>{ar ? "تخصيص" : "Custom"}</span>
                                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>

                                {/* Expanded Granular Actions */}
                                {isExpanded && (
                                  <div className="p-3 bg-muted/20 border-t border-border/40 grid grid-cols-2 sm:grid-cols-3 gap-2">
                                    {actions.map((act) => {
                                      const key = permKey(mod, act);
                                      const isGranted = perms.has(key);
                                      const actLabel = ACTION_LABELS[act] || { ar: act, en: act };

                                      return (
                                        <div
                                          key={act}
                                          onClick={() => toggleSinglePerm(mod, act)}
                                          className={cn(
                                            "p-2 rounded-lg border text-xs flex items-center justify-between gap-2 cursor-pointer transition-all select-none",
                                            isGranted
                                              ? "bg-primary/10 border-primary/40 text-primary font-bold shadow-2xs"
                                              : "bg-card border-border/50 text-muted-foreground hover:bg-muted/40",
                                          )}
                                        >
                                          <span>{ar ? actLabel.ar : actLabel.en}</span>
                                          <div
                                            className={cn(
                                              "w-4 h-4 rounded flex items-center justify-center border",
                                              isGranted
                                                ? "bg-primary border-primary text-primary-foreground"
                                                : "border-muted-foreground/30",
                                            )}
                                          >
                                            {isGranted && <Check className="w-3 h-3 stroke-[3]" />}
                                          </div>
                                        </div>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            )}

            {/* ═════════ TAB 4: DIGITAL SIGNATURE ═════════ */}
            {activeTab === "signature" && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2 }}
                className="space-y-4"
              >
                <div>
                  <h4 className="text-sm font-bold">{ar ? "التوقيع الإلكتروني للاعتمادات" : "Digital Approval Signature"}</h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ar
                      ? "يستخدم التوقيع تلقائياً في اعتمادات طلبات الاستضافة، تصاريح الزيارة العائلية، وتذاكر الصيانة."
                      : "Used for automated sign-offs on guest hosting, visit permits, and work orders."}
                  </p>
                </div>

                <div className="p-6 rounded-2xl border-2 border-dashed border-border flex flex-col items-center justify-center text-center gap-3 bg-muted/10">
                  {signaturePreview ? (
                    <div className="space-y-3 flex flex-col items-center">
                      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-border shadow-xs max-w-xs">
                        <img
                          src={signaturePreview}
                          alt="Signature Preview"
                          className="max-h-24 object-contain mx-auto"
                        />
                      </div>
                      <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>{ar ? "التوقيع معتمد ومسجل في النظام" : "Signature is verified and active"}</span>
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                        <Pen className="w-6 h-6" />
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {ar ? "لا يوجد توقيع مسجل لهذا الحساب حالياً" : "No signature recorded for this user"}
                      </p>
                    </div>
                  )}

                  <input
                    type="file"
                    ref={sigFileInputRef}
                    onChange={handleSignatureFile}
                    accept="image/png,image/jpeg"
                    className="hidden"
                  />

                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => sigFileInputRef.current?.click()}
                    disabled={isUploadingSig}
                    className="gap-2 text-xs font-bold"
                  >
                    {isUploadingSig ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
                    <span>{signaturePreview ? (ar ? "تحديث صورة التوقيع" : "Replace Signature") : (ar ? "رفع صورة التوقيع" : "Upload Signature")}</span>
                  </Button>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* ── Fixed Bottom Footer Action Bar ── */}
        <SheetFooter className="p-4 px-6 border-t border-border/50 bg-background/95 backdrop-blur-md flex flex-row items-center justify-between gap-3 sticky bottom-0 z-10">
          <div className="text-xs text-muted-foreground">
            <span className="font-semibold text-foreground">@{user.username}</span>
            <span> · {primaryRole}</span>
          </div>

          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onClose}
              disabled={updateMutation.isPending}
              className="text-xs font-semibold"
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>

            <Button
              type="button"
              size="sm"
              onClick={handleSave}
              disabled={updateMutation.isPending}
              className="text-xs font-bold gap-1.5 min-w-[100px]"
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>{ar ? "جاري الحفظ..." : "Saving..."}</span>
                </>
              ) : (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>{ar ? "حفظ التغييرات" : "Save Changes"}</span>
                </>
              )}
            </Button>
          </div>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
