import { useState, useMemo } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
} from "@workspace/api-client-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import { usePermission } from "@/hooks/use-permission";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
} from "lucide-react";
import { SYSTEM_ROLES, WORKFLOW_ROLES, roleColor } from "../utils";
import { getPermissionsForRoles } from "@/lib/permissions";
import {
  PasswordStrengthMeter,
  evaluatePassword,
} from "./PasswordStrengthMeter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

interface EditUserDialogProps {
  user: any;
  onClose: () => void;
  properties?: any[];
}

function useUserSignature(userId: number) {
  return useQuery({
    queryKey: ["user-signature", userId],
    queryFn: async () => {
      const res = await fetch(`/api/users/${userId}/signature`);
      if (!res.ok) throw new Error("Failed to fetch signature");
      return res.json() as Promise<{
        signatureImageUrl: string | null;
        uploadedAt: string | null;
      }>;
    },
    enabled: !!userId,
    staleTime: 30_000,
  });
}

export function EditUserDialog({
  user,
  onClose,
  properties: propProperties,
}: EditUserDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const { user: currentUser, isSystemAdmin } = useAuth();
  const { can, isAdmin } = usePermission();
  const { properties: contextProperties, activePropertyId } = useProperty();
  const queryClient = useQueryClient();

  const availableProperties = useMemo(() => {
    return propProperties || contextProperties || [];
  }, [propProperties, contextProperties]);

  // Initial properties calculation
  const initialPropertyIds: number[] = useMemo(() => {
    if (user.propertyIds && Array.isArray(user.propertyIds) && user.propertyIds.length > 0) {
      return user.propertyIds;
    }
    if (user.propertyId) {
      return [user.propertyId];
    }
    return [];
  }, [user]);

  // Initial primary property
  const initialPrimaryPropertyId: number = useMemo(() => {
    return user.propertyId || initialPropertyIds[0] || (availableProperties[0]?.id || 0);
  }, [user, initialPropertyIds, availableProperties]);

  // Form State
  const [formData, setFormData] = useState({
    username: user.username || "",
    email: user.email || "",
    phone: user.phone || "",
    status: (user.status || "ACTIVE") as "ACTIVE" | "INACTIVE" | "LOCKED",
    role: user.roles?.[0] || "manager",
    jobTitle: user.jobTitle || "none",
    propertyId: initialPrimaryPropertyId,
    propertyIds: initialPropertyIds,
  });

  // Password reset state
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Field validation errors
  const [errors, setErrors] = useState<{
    username?: string;
    email?: string;
    password?: string;
    confirmPassword?: string;
    properties?: string;
  }>({});

  // Lockout state handling
  const isInitiallyLocked =
    user.status === "LOCKED" ||
    Boolean(user.lockedUntil && new Date(user.lockedUntil) > new Date());
  const [isLockedState, setIsLockedState] = useState(isInitiallyLocked);
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Digital Signature Management
  const isSelf = currentUser?.id === user.id;
  const canUploadSignature = isSystemAdmin || isAdmin || isSelf || can("users", "edit");
  const [isUploadingSig, setIsUploadingSig] = useState(false);
  const [showSigPreview, setShowSigPreview] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    data: sigData,
    isLoading: sigLoading,
    refetch: refetchSig,
  } = useUserSignature(user.id);

  // Password evaluation
  const pwdEvaluation = useMemo(() => {
    return evaluatePassword(newPassword);
  }, [newPassword]);

  // Permissions preview
  const resolvedPermissions = useMemo(() => {
    return getPermissionsForRoles([formData.role]);
  }, [formData.role]);

  const hasCustomPermissions =
    user.permissions &&
    Array.isArray(user.permissions) &&
    user.permissions.length > 0;

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(
          ar ? "تم تحديث بيانات المستخدم بنجاح" : "User data updated successfully",
        );
        onClose();
      },
      onError: (e: any) => {
        toast.error(
          e.message ||
            (ar ? "فشل تحديث بيانات المستخدم" : "Failed to update user data"),
        );
      },
    },
  });

  // Unlock User Account Handler
  const handleUnlockAccount = async () => {
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/users/${user.id}/unlock`, {
        method: "POST",
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || "Failed to unlock user");
      }
      setIsLockedState(false);
      setFormData((prev) => ({ ...prev, status: "ACTIVE" }));
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      toast.success(
        ar
          ? "تم فتح قفل الحساب بنجاح وإعادة تفعيله"
          : "Account unlocked and reactivated successfully",
      );
    } catch (err: any) {
      toast.error(
        err.message || (ar ? "فشل فتح قفل الحساب" : "Failed to unlock account"),
      );
    } finally {
      setIsUnlocking(false);
    }
  };

  // Signature upload handler
  const handleSignatureUpload = async (file: File) => {
    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(
        ar ? "يرجى رفع صورة PNG أو JPEG" : "Please upload a PNG or JPEG image",
      );
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
      const endpoint = isSelf
        ? "/api/users/me/signature"
        : `/api/users/${user.id}/signature`;
      const res = await fetch(endpoint, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: base64 }),
      });
      if (!res.ok) throw new Error("Upload failed");
      toast.success(
        ar ? "تم حفظ التوقيع بنجاح" : "Signature saved successfully",
      );
      refetchSig();
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch {
      toast.error(ar ? "فشل رفع التوقيع" : "Failed to upload signature");
    } finally {
      setIsUploadingSig(false);
    }
  };

  // Toggle Property Selection
  const toggleProperty = (pid: number) => {
    setFormData((prev) => {
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

  const setPrimaryProperty = (pid: number) => {
    setFormData((prev) => {
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
    setFormData((prev) => ({
      ...prev,
      propertyIds: allIds,
      propertyId: prev.propertyId || allIds[0] || 0,
    }));
    if (errors.properties) {
      setErrors((e) => ({ ...e, properties: undefined }));
    }
  };

  const clearPropertySelection = () => {
    setFormData((prev) => ({
      ...prev,
      propertyIds: [],
      propertyId: 0,
    }));
  };

  const save = async () => {
    const newErrors: typeof errors = {};

    // Validate username
    if (!formData.username.trim()) {
      newErrors.username = ar ? "اسم المستخدم مطلوب" : "Username is required";
    } else if (formData.username.trim().length < 3) {
      newErrors.username = ar
        ? "يجب أن يتكون اسم المستخدم من 3 أحرف على الأقل"
        : "Username must be at least 3 characters";
    }

    // Validate email
    if (formData.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email.trim())) {
      newErrors.email = ar
        ? "صيغة البريد الإلكتروني غير صحيحة"
        : "Invalid email address format";
    }

    // Validate password if changePassword is active
    if (changePassword) {
      if (!newPassword) {
        newErrors.password = ar
          ? "الرجاء إدخال كلمة المرور الجديدة"
          : "Please enter new password";
      } else if (newPassword.length < 8) {
        newErrors.password = ar
          ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل"
          : "Password must be at least 8 characters";
      } else if (!pwdEvaluation.isValid) {
        newErrors.password = ar
          ? "كلمة المرور لا تستوفي شروط الأمان (أحرف كبيرة وصغيرة وأرقام)"
          : "Password must meet policy requirements (upper, lower, and numbers)";
      }

      if (newPassword && newPassword !== confirmPassword) {
        newErrors.confirmPassword = ar
          ? "كلمتا المرور غير متطابقتين"
          : "Passwords do not match";
      }
    }

    // Validate property assignment
    const needsProperty = formData.role !== "super_admin";
    const pids =
      formData.propertyIds.length > 0
        ? formData.propertyIds
        : formData.propertyId
          ? [formData.propertyId]
          : [];
    const primaryPid = formData.propertyId || pids[0] || (activePropertyId && typeof activePropertyId === "number" ? activePropertyId : 1);

    if (needsProperty && pids.length === 0) {
      newErrors.properties = ar
        ? "الرجاء اختيار فرع واحد على الأقل"
        : "Please select at least one property";
    }

    if (Object.keys(newErrors).length > 0) {
      setErrors(newErrors);
      toast.error(
        ar
          ? "الرجاء تصحيح الأخطاء في النموذج قبل الحفظ"
          : "Please resolve the validation errors before saving",
      );
      return;
    }

    setErrors({});
    setSaving(true);

    try {
      const resolvedRoles = [formData.role].filter(Boolean);

      // CRITICAL FIX: Preserve existing user.permissions unless explicitly managed in Matrix
      // DO NOT overwrite with getPermissionsForRoles(resolvedRoles) if user already has custom permissions!
      const preservedPermissions =
        user.permissions && Array.isArray(user.permissions) && user.permissions.length > 0
          ? user.permissions
          : getPermissionsForRoles(resolvedRoles);

      const patchPayload: any = {
        username: formData.username.trim(),
        email: formData.email.trim() || undefined,
        phone: formData.phone.trim() || undefined,
        status: isLockedState ? "LOCKED" : formData.status,
        roles: resolvedRoles,
        jobTitle: formData.jobTitle === "none" ? null : formData.jobTitle,
        permissions: preservedPermissions,
        propertyId: primaryPid,
        propertyIds: pids,
      };

      if (changePassword && newPassword) {
        patchPayload.password = newPassword;
      }

      await updateMutation.mutateAsync({
        id: user.id,
        data: patchPayload,
      });
    } finally {
      setSaving(false);
    }
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
      open
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
    >
      <DialogContent
        className="max-w-3xl p-0 overflow-hidden bg-card border-border/80 shadow-2xl rounded-2xl"
        srTitle={ar ? "تعديل بيانات المستخدم" : "Edit User Data"}
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
                  <span>{ar ? "تعديل بيانات المستخدم" : "Edit User Account"}</span>
                  <span className="font-mono text-xs px-2.5 py-0.5 rounded-full bg-white/10 text-slate-200 border border-white/20 font-medium">
                    @{user.username}
                  </span>
                  {hasCustomPermissions && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#C9A24D]/20 text-[#C9A24D] border border-[#C9A24D]/40 font-medium">
                      {ar ? "صلاحيات مخصصة" : "Custom Perms"}
                    </span>
                  )}
                </div>
                <span className="block text-xs font-normal text-slate-300 mt-1">
                  {ar
                    ? "تحديث بيانات الاعتماد، الفروع، الصلاحيات، وإعادة تعيين كلمة المرور"
                    : "Update credentials, property access, roles, and manage password security"}
                </span>
              </div>
            </DialogTitle>
          </DialogHeader>
        </div>

        {/* Scrollable Form Body */}
        <div className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* LOCKOUT ALERT (If Account is Locked) */}
          {isLockedState && (
            <div className="rounded-xl border border-rose-500/30 bg-rose-500/10 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 text-rose-950 dark:text-rose-200 animate-fade-in">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-lg bg-rose-500/20 flex items-center justify-center shrink-0 text-rose-600 dark:text-rose-400">
                  <AlertTriangle className="w-5 h-5" />
                </div>
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
                    {ar ? "الحساب مقفل أمنياً (Locked)" : "Account is Security Locked"}
                  </h4>
                  <p className="text-xs text-rose-800 dark:text-rose-200 mt-0.5">
                    {ar
                      ? "تم قفل هذا الحساب لتجاوز الحد الأقصى لمحاولات تسجيل الدخول الفاشلة."
                      : "Account was locked due to exceeding maximum consecutive failed sign-in attempts."}
                  </p>
                </div>
              </div>
              <Button
                type="button"
                size="sm"
                onClick={handleUnlockAccount}
                disabled={isUnlocking}
                className="bg-rose-600 hover:bg-rose-700 text-white shrink-0 gap-1.5 shadow-xs"
              >
                {isUnlocking ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <Unlock className="w-3.5 h-3.5" />
                )}
                {ar ? "فتح قفل الحساب فوراً" : "Unlock Account Now"}
              </Button>
            </div>
          )}

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
              <span className="text-xs text-muted-foreground font-mono">
                ID: #{user.id}
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
                    placeholder="e.g. john.doe"
                    value={formData.username}
                    onChange={(e) => {
                      setFormData((f) => ({
                        ...f,
                        username: e.target.value.toLowerCase().replace(/\s+/g, ""),
                      }));
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
                    value={formData.email}
                    onChange={(e) => {
                      setFormData((f) => ({ ...f, email: e.target.value }));
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
                    value={formData.phone}
                    onChange={(e) => setFormData((f) => ({ ...f, phone: e.target.value }))}
                    autoComplete="tel"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* SECTION 2: Security & Password (Collapsible) */}
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
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-medium text-muted-foreground">
                  {ar ? "تغيير كلمة المرور" : "Change Password"}
                </span>
                <Switch
                  checked={changePassword}
                  onCheckedChange={(v) => {
                    setChangePassword(v);
                    if (!v) {
                      setNewPassword("");
                      setConfirmPassword("");
                      setErrors((e) => ({
                        ...e,
                        password: undefined,
                        confirmPassword: undefined,
                      }));
                    }
                  }}
                />
              </div>
            </div>

            {changePassword ? (
              <div className="space-y-4 pt-1 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* New Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                      {ar ? "كلمة المرور الجديدة" : "New Password"}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                      <Input
                        dir="ltr"
                        type={showNewPassword ? "text" : "password"}
                        className={cn(
                          "pl-9 pr-10 font-mono text-sm bg-background border-border/80 focus-visible:ring-[#0F2A44]/30",
                          errors.password && "border-destructive focus-visible:ring-destructive/20",
                        )}
                        placeholder={ar ? "8 أحرف على الأقل" : "Minimum 8 characters"}
                        value={newPassword}
                        onChange={(e) => {
                          setNewPassword(e.target.value);
                          if (errors.password) setErrors((err) => ({ ...err, password: undefined }));
                        }}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowNewPassword(!showNewPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground p-1 transition-colors"
                      >
                        {showNewPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.password && (
                      <p className="text-[11px] text-destructive">{errors.password}</p>
                    )}
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground flex items-center gap-1">
                      {ar ? "تأكيد كلمة المرور" : "Confirm New Password"}
                      <span className="text-destructive">*</span>
                    </Label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 pointer-events-none" />
                      <Input
                        dir="ltr"
                        type={showConfirmPassword ? "text" : "password"}
                        className={cn(
                          "pl-9 pr-10 font-mono text-sm bg-background border-border/80 focus-visible:ring-[#0F2A44]/30",
                          errors.confirmPassword && "border-destructive focus-visible:ring-destructive/20",
                        )}
                        placeholder={ar ? "أعد كتابة كلمة المرور" : "Re-enter password"}
                        value={confirmPassword}
                        onChange={(e) => {
                          setConfirmPassword(e.target.value);
                          if (errors.confirmPassword) setErrors((err) => ({ ...err, confirmPassword: undefined }));
                        }}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/70 hover:text-foreground p-1 transition-colors"
                      >
                        {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                    </div>
                    {errors.confirmPassword && (
                      <p className="text-[11px] text-destructive">{errors.confirmPassword}</p>
                    )}
                  </div>
                </div>

                {/* Strength Meter and Rule Chips */}
                <PasswordStrengthMeter password={newPassword} isArabic={ar} showRules={true} />
              </div>
            ) : (
              <div className="rounded-lg bg-muted/20 border border-dashed border-border/60 p-3 text-xs text-muted-foreground flex items-center justify-between">
                <span>
                  {ar
                    ? "كلمة المرور الحالية مشفرة ومحفوظة بأمان ولن تتغير."
                    : "Current password is hash-encrypted and securely preserved."}
                </span>
                <span className="text-[11px] text-muted-foreground/80">
                  {ar ? "قم بتفعيل الخيار بالأعلى لتغييرها" : "Toggle switch above to change"}
                </span>
              </div>
            )}
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
                {hasCustomPermissions
                  ? ar
                    ? `مخصص (${user.permissions.length} صلاحية)`
                    : `Customized (${user.permissions.length} perms)`
                  : ar
                    ? `دور افتراضي (${resolvedPermissions.length} صلاحية)`
                    : `Role default (${resolvedPermissions.length} perms)`}
              </Badge>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {/* System Role */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground">
                  {ar ? "دور النظام الأساسي" : "System Role"} <span className="text-destructive">*</span>
                </Label>
                <Select
                  value={formData.role}
                  onValueChange={(v) => {
                    setFormData((f) => ({ ...f, role: v }));
                    if (errors.properties && v === "super_admin") {
                      setErrors((e) => ({ ...e, properties: undefined }));
                    }
                  }}
                >
                  <SelectTrigger className="bg-background border-border/80 focus:ring-[#0F2A44]/20">
                    <SelectValue>
                      <div className="flex items-center gap-2">
                        {getRoleIcon(formData.role)}
                        <span className="font-medium">
                          {SYSTEM_ROLES.find((r) => r.value === formData.role)?.[ar ? "labelAr" : "label"]}
                        </span>
                      </div>
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {SYSTEM_ROLES.map((r) => {
                      const isSuper = r.value === "super_admin";
                      const isAdmin = r.value === "admin";
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
                  {formData.role === "super_admin"
                    ? ar ? "صلاحيات كاملة وغير مقيدة على جميع فروع المجمعات." : "Unrestricted full administrative access across all properties."
                    : formData.role === "admin"
                      ? ar ? "صلاحيات إدارية عليا للنظام والمستخدمين." : "High-level management of users and housing modules."
                      : formData.role === "manager"
                        ? ar ? "إدارة التسكين والغرف وتوزيع الأسرة في الفروع المحددة." : "Manages accommodation, rooms, and assignments in assigned branches."
                        : formData.role === "receptionist"
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
                  value={formData.jobTitle}
                  onValueChange={(v) => setFormData((f) => ({ ...f, jobTitle: v }))}
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
                    ? "يحدد رتبة توقيع المستخدم في اعتمادات الاستضافة وطلبات التسكين."
                    : "Determines signing authority in hosting approval workflows."}
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
              {formData.role !== "super_admin" && (
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

            {formData.role === "super_admin" ? (
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
                    {formData.propertyIds.length} / {availableProperties.length}
                  </span>
                </div>

                {/* Properties Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 max-h-52 overflow-y-auto p-1">
                  {availableProperties.map((p) => {
                    const isSelected = formData.propertyIds.includes(p.id);
                    const isPrimary = formData.propertyId === p.id;

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

          {/* SECTION 5: Account Status & Digital Signature */}
          <div className="bg-slate-50/60 dark:bg-slate-900/40 border border-border/70 rounded-xl p-4.5 space-y-4">
            <div className="flex items-center justify-between pb-2 border-b border-border/50">
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-lg bg-slate-500/10 text-slate-600 dark:text-slate-400 flex items-center justify-center font-bold text-xs">
                  5
                </div>
                <h3 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4 text-slate-500" />
                  {ar ? "حالة الحساب والتوقيع الرقمي" : "Account Status & Signature"}
                </h3>
              </div>
              <span className="text-xs text-muted-foreground">
                {ar ? "التحكم في النشاط والاعتمادات" : "Activity & Signing"}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {/* Account Status Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground">
                  {ar ? "حالة تسجيل الدخول" : "Account Status"}
                </Label>
                <div className="grid grid-cols-2 gap-2">
                  <div
                    onClick={() => {
                      if (!isLockedState) setFormData((f) => ({ ...f, status: "ACTIVE" }));
                    }}
                    className={cn(
                      "p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all select-none",
                      formData.status === "ACTIVE" && !isLockedState
                        ? "bg-emerald-500/10 border-emerald-500/40 ring-1 ring-emerald-500/30 text-emerald-950 dark:text-emerald-200"
                        : "bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground",
                      isLockedState && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold block leading-tight">
                        {ar ? "نشط (Active)" : "Active"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {ar ? "مسموح بالدخول" : "Can sign in"}
                      </span>
                    </div>
                  </div>

                  <div
                    onClick={() => {
                      if (!isLockedState) setFormData((f) => ({ ...f, status: "INACTIVE" }));
                    }}
                    className={cn(
                      "p-2.5 rounded-xl border flex items-center gap-2.5 cursor-pointer transition-all select-none",
                      formData.status === "INACTIVE" && !isLockedState
                        ? "bg-slate-500/10 border-slate-500/40 ring-1 ring-slate-500/30 text-slate-900 dark:text-slate-200"
                        : "bg-muted/20 border-border/50 hover:bg-muted/40 text-muted-foreground",
                      isLockedState && "opacity-50 cursor-not-allowed",
                    )}
                  >
                    <div className="w-2.5 h-2.5 rounded-full bg-slate-400 shrink-0" />
                    <div>
                      <span className="text-xs font-semibold block leading-tight">
                        {ar ? "معطل (Inactive)" : "Inactive"}
                      </span>
                      <span className="text-[10px] text-muted-foreground block">
                        {ar ? "محظور الدخول" : "Blocked sign-in"}
                      </span>
                    </div>
                  </div>
                </div>
              </div>

              {/* Digital Signature Card */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground flex items-center justify-between">
                  <span>{ar ? "التوقيع الرقمي المعتمد" : "Digital Workflow Signature"}</span>
                  {sigData?.signatureImageUrl && (
                    <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                      <CheckCircle2 className="w-3 h-3" />
                      {ar ? "توقيع معتمد" : "Verified"}
                    </span>
                  )}
                </Label>

                <div className="border border-border/70 rounded-xl p-3 bg-background/80 flex items-center justify-between gap-3">
                  {sigLoading ? (
                    <div className="flex items-center gap-2 text-xs text-muted-foreground py-1">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{ar ? "جاري تحميل التوقيع..." : "Loading signature..."}</span>
                    </div>
                  ) : sigData?.signatureImageUrl ? (
                    <div className="flex items-center justify-between w-full">
                      <div className="flex items-center gap-2.5">
                        <div className="w-12 h-8 rounded border bg-muted/20 p-1 flex items-center justify-center overflow-hidden">
                          <img
                            src={sigData.signatureImageUrl}
                            alt="Signature Thumbnail"
                            className="max-h-full max-w-full object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowSigPreview(!showSigPreview)}
                          className="text-xs text-[#0F2A44] dark:text-[#C9A24D] hover:underline font-medium flex items-center gap-1"
                        >
                          <Pen className="w-3 h-3" />
                          {ar ? (showSigPreview ? "إخفاء المعاينة" : "معاينة") : (showSigPreview ? "Hide Preview" : "Preview")}
                        </button>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingSig || !canUploadSignature}
                        onClick={() => document.getElementById("sig-upload-edit")?.click()}
                        className="h-8 text-xs border-border/80"
                      >
                        {isUploadingSig ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {ar ? "استبدال" : "Replace"}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between w-full">
                      <span className="text-xs text-muted-foreground">
                        {ar ? "لا يوجد توقيع رقمي مرفوع" : "No signature image uploaded"}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={isUploadingSig || !canUploadSignature}
                        onClick={() => document.getElementById("sig-upload-edit")?.click()}
                        className="h-8 text-xs border-border/80"
                      >
                        {isUploadingSig ? (
                          <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />
                        ) : (
                          <Upload className="w-3.5 h-3.5 mr-1.5" />
                        )}
                        {ar ? "رفع توقيع" : "Upload"}
                      </Button>
                    </div>
                  )}

                  <input
                    id="sig-upload-edit"
                    type="file"
                    className="hidden"
                    accept="image/png,image/jpeg"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleSignatureUpload(file);
                    }}
                  />
                </div>

                {/* Expanded Signature Preview */}
                {showSigPreview && sigData?.signatureImageUrl && (
                  <div className="relative border rounded-xl p-3 bg-muted/15 animate-fade-in flex items-center justify-center">
                    <button
                      type="button"
                      onClick={() => setShowSigPreview(false)}
                      className="absolute top-2 right-2 rtl:left-2 rtl:right-auto bg-background rounded-full p-1 shadow-xs border text-muted-foreground hover:text-foreground"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                    <img
                      src={sigData.signatureImageUrl}
                      alt="Signature Full"
                      className="max-h-24 object-contain"
                    />
                  </div>
                )}

                {!canUploadSignature && (
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "فقط المدير العام يمكنه تعديل توقيع مستخدم آخر."
                      : "Only system admins can manage signatures for other users."}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="bg-slate-100/70 dark:bg-slate-900/70 border-t border-border/70 p-4 px-6 flex items-center justify-between">
          <div className="text-xs text-muted-foreground flex items-center gap-1.5">
            <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
            <span>
              {hasCustomPermissions
                ? ar
                  ? "يتم الاحتفاظ بالصلاحيات المخصصة لهذا المستخدم بأمان."
                  : "User's custom permission overrides are securely preserved."
                : ar
                  ? "يتم تطبيق صلاحيات الدور المحدثة تلقائياً."
                  : "Updated role baseline permissions will apply."}
            </span>
          </div>
          <div className="flex items-center gap-2.5">
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="border-border/80"
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              type="button"
              onClick={save}
              disabled={saving || updateMutation.isPending}
              className="bg-[#0F2A44] hover:bg-[#0F2A44]/90 text-white font-medium shadow-sm transition-all hover:shadow-md min-w-32"
            >
              {saving || updateMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  {ar ? "جاري الحفظ..." : "Saving..."}
                </>
              ) : (
                <>
                  <UserCog className="w-4 h-4 mr-1.5" />
                  {ar ? "حفظ التغييرات" : "Save Changes"}
                </>
              )}
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
