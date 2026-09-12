// @ts-nocheck
import { useState, useMemo, useEffect, useRef } from "react";
import { useParams, useLocation } from "wouter";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  useUpdateUser,
  useDeleteUser,
  getListUsersQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useAuth } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import { usePermission } from "@/hooks/use-permission";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ArrowLeft,
  ArrowRight,
  Save,
  RotateCcw,
  Shield,
  ShieldCheck,
  ShieldAlert,
  KeyRound,
  Lock,
  Unlock,
  Building2,
  Building,
  Pen,
  Upload,
  Trash2,
  Clock,
  Activity,
  Check,
  CheckCheck,
  Copy,
  Sparkles,
  RefreshCw,
  Sliders,
  SlidersHorizontal,
  Eye,
  EyeOff,
  Crown,
  Briefcase,
  Wrench,
  Headphones,
  Zap,
  AlertTriangle,
  Star,
  Filter,
  Layers,
  FileSpreadsheet,
  UserCheck,
  UserX,
  History,
  ChevronDown,
  ChevronUp,
  User,
  Mail,
  Phone,
  Search,
  CheckCircle2,
  XCircle,
  ExternalLink,
} from "lucide-react";
import {
  SYSTEM_ROLES,
  WORKFLOW_ROLES,
  roleColor,
} from "./utils";
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
} from "./components/PasswordStrengthMeter";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence } from "framer-motion";

const ALL_ROLES = [...SYSTEM_ROLES, ...WORKFLOW_ROLES];

type ActiveTab = "profile" | "permissions" | "properties" | "signature" | "audit";

export default function UserDetailPage() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const userId = parseInt(id || "0", 10);
  const { language } = useLanguage();
  const ar = language === "ar";
  const { user: currentUser, isSystemAdmin } = useAuth();
  const { can, isAdmin } = usePermission();
  const { properties: contextProperties, isSuperAdmin, buildNavHref } = useProperty();
  const queryClient = useQueryClient();

  // Read tab from query string or default to 'profile'
  const searchParams = new URLSearchParams(window.location.search);
  const initialTabParam = searchParams.get("tab") as ActiveTab;
  const validTabs: ActiveTab[] = ["profile", "permissions", "properties", "signature", "audit"];
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    validTabs.includes(initialTabParam) ? initialTabParam : "profile"
  );

  // Sync tab change to URL query param
  const handleTabChange = (tab: ActiveTab) => {
    setActiveTab(tab);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", tab);
    window.history.replaceState({}, "", url.toString());
  };

  // 1. Fetch User Data
  const {
    data: user,
    isLoading: isUserLoading,
    isError: isUserError,
    refetch: refetchUser,
  } = useQuery({
    queryKey: ["user-detail", userId],
    queryFn: async () => {
      if (!userId) throw new Error("Invalid User ID");
      const res = await fetch(`/api/users/${userId}`);
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "User not found");
      }
      return res.json();
    },
    enabled: !!userId,
  });

  // 2. Fetch All Users for Permission Cloner
  const { data: allUsersRes } = useQuery({
    queryKey: ["all-users-cloner"],
    queryFn: async () => {
      const res = await fetch("/api/users?limit=100");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    },
  });
  const allUsers = allUsersRes || [];

  // 3. Fetch Properties
  const { data: propertiesRes } = useQuery({
    queryKey: ["all-properties-selector"],
    queryFn: async () => {
      const res = await fetch("/api/properties");
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    },
  });
  const properties = propertiesRes?.length ? propertiesRes : contextProperties || [];

  // Form Edit State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [primaryRole, setPrimaryRole] = useState("user");
  const [isActive, setIsActive] = useState(true);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [primaryPropertyId, setPrimaryPropertyId] = useState<number | null>(null);

  // Password Management State
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Unlocking State
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Delete User Confirmation Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Permissions Matrix State
  const [isDynamicInheritance, setIsDynamicInheritance] = useState(true);
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<Record<string, boolean>>({});
  const [permSearch, setPermSearch] = useState("");
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>("all");
  const [showOverridesOnly, setShowOverridesOnly] = useState(false);

  // Permission Cloner State
  const [cloneSourceUserId, setCloneSourceUserId] = useState<string>("");

  // Live Access Simulator State
  const [simModule, setSimModule] = useState<string>("housing");
  const [simAction, setSimAction] = useState<string>("view");
  const [showSimulator, setShowSimulator] = useState(false);

  // Signature State
  const [signaturePreview, setSignaturePreview] = useState<string | null>(null);
  const [isUploadingSig, setIsUploadingSig] = useState(false);
  const [isDeletingSig, setIsDeletingSig] = useState(false);
  const sigFileInputRef = useRef<HTMLInputElement>(null);

  // Initialize data whenever user is loaded/changed
  useEffect(() => {
    if (!user) return;

    setName(user.name || user.username || "");
    setEmail(user.email || "");
    setPhone(user.phone || "");
    setDepartment(user.department || "");
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
    setPrimaryPropertyId(user.propertyId || (pids[0] ?? null));

    // Reset password fields
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

  // Is account locked check
  const isLocked = useMemo(() => {
    if (!user?.lockedUntil) return false;
    return new Date(user.lockedUntil) > new Date();
  }, [user?.lockedUntil]);

  const lockoutRemainingMinutes = useMemo(() => {
    if (!isLocked || !user?.lockedUntil) return 0;
    return Math.max(1, Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000));
  }, [isLocked, user?.lockedUntil]);

  // Actions for the selected simulator module
  const simActions = useMemo(() => {
    return MODULE_ACTIONS[simModule] || ["view"];
  }, [simModule]);

  useEffect(() => {
    if (simActions.length > 0 && !simActions.includes(simAction)) {
      setSimAction(simActions[0]);
    }
  }, [simModule, simActions, simAction]);

  // Default permissions for current role
  const defaultPermsForRole = useMemo(() => {
    return new Set(ROLE_DEFAULT_PERMISSIONS[primaryRole] || []);
  }, [primaryRole]);

  // Diff stats calculation
  const diffStats = useMemo(() => {
    if (isDynamicInheritance) {
      return { added: 0, revoked: 0, isIdentical: true, addedKeys: new Set<string>(), revokedKeys: new Set<string>() };
    }
    const added = Array.from(perms).filter((p) => !defaultPermsForRole.has(p));
    const revoked = Array.from(defaultPermsForRole).filter((p) => !perms.has(p));
    return {
      added: added.length,
      revoked: revoked.length,
      isIdentical: added.length === 0 && revoked.length === 0,
      addedKeys: new Set(added),
      revokedKeys: new Set(revoked),
    };
  }, [perms, defaultPermsForRole, isDynamicInheritance]);

  const isModuleOverridden = (mod: string) => {
    const actions = MODULE_ACTIONS[mod] || [];
    return actions.some((act) => {
      const key = permKey(mod, act);
      return diffStats.addedKeys?.has(key) || diffStats.revokedKeys?.has(key);
    });
  };

  // Password Generator
  const handleGeneratePassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    let pwd = "";
    pwd += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    pwd += "abcdefghijkmnpqrstuvwxyz"[Math.floor(Math.random() * 24)];
    pwd += "23456789"[Math.floor(Math.random() * 8)];
    pwd += "!@#$%&*"[Math.floor(Math.random() * 7)];
    for (let i = 0; i < 8; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    const shuffled = pwd.split("").sort(() => 0.5 - Math.random()).join("");
    setNewPassword(shuffled);
    setConfirmPassword(shuffled);
    setShowPasswordText(true);
    toast.success(ar ? "تم توليد كلمة مرور معقدة وقوية عشوائياً" : "Strong password generated");
  };

  const handleCopyCredentials = () => {
    if (!newPassword) {
      toast.error(ar ? "يرجى كتابة أو توليد كلمة المرور أولاً" : "Please generate or enter password first");
      return;
    }
    const text = `${ar ? "اسم المستخدم" : "Username"}: ${user?.username}\n${ar ? "كلمة المرور" : "Password"}: ${newPassword}\n${ar ? "رابط النظام" : "System URL"}: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    toast.success(ar ? "تم نسخ بيانات الدخول إلى الحافظة بنجاح" : "Credentials copied to clipboard");
  };

  // Clone Permissions Handler
  const handleClonePermissions = () => {
    if (!cloneSourceUserId) {
      toast.error(ar ? "يرجى اختيار المستخدم أولاً" : "Please select a user to clone from");
      return;
    }
    const source = allUsers?.find((u: any) => String(u.id) === String(cloneSourceUserId));
    if (!source) return;

    const sourceExplicit = (source.permissions as string[] | undefined) ?? [];
    if (sourceExplicit.length === 0) {
      const sourceRole = (source.roles?.[0] || "user").toLowerCase();
      const roleDefaults = ROLE_DEFAULT_PERMISSIONS[sourceRole] || [];
      setPerms(new Set(roleDefaults));
    } else {
      const normalized = sourceExplicit.map((p) => {
        let s = String(p).trim().toLowerCase();
        if (s.startsWith("employees.")) s = s.replace("employees.", "profiles.");
        if (s.startsWith("employees:")) s = s.replace("employees:", "profiles:");
        return s;
      });
      setPerms(new Set(normalized));
    }
    setIsDynamicInheritance(false);
    toast.success(
      ar
        ? `تم استنساخ كافة صلاحيات (${source.username}) بنجاح`
        : `Cloned permissions from ${source.username} successfully`,
    );
  };

  // Simulator Result
  const simulatorResult = useMemo(() => {
    if (!simModule || !simAction) return null;
    const isSuper = primaryRole === "super_admin";
    if (isSuper) {
      return {
        allowed: true,
        reason: ar ? "مسموح بالكامل (سوبر أدمن مدير النظام العام)" : "Fully allowed (Super Admin)",
        type: "super",
      };
    }
    const key = permKey(simModule, simAction);
    const hasPerm = perms.has(key);
    if (hasPerm) {
      if (isDynamicInheritance) {
        return {
          allowed: true,
          reason: ar
            ? `مسموح ✅ - موروث تلقائياً من الدور الافتراضي (${primaryRole})`
            : `Allowed - inherited from role (${primaryRole})`,
          type: "inherited",
        };
      }
      return {
        allowed: true,
        reason: ar
          ? "مسموح ✅ - ممنوح استثنائياً عبر الصلاحيات المخصصة"
          : "Allowed - explicitly granted via custom permissions",
        type: "custom",
      };
    }
    return {
      allowed: false,
      reason: ar
        ? "محظور ❌ - المستخدم لا يمتلك هذا التصريح في مصفوفته"
        : "Denied - user does not have this permission",
      type: "denied",
    };
  }, [simModule, simAction, primaryRole, perms, isDynamicInheritance, ar]);

  // Instant Unlock Handler
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
      queryClient.invalidateQueries({ queryKey: ["user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
      refetchUser();
    } catch (e: any) {
      toast.error(e.message || (ar ? "فشل فتح القفل" : "Failed to unlock"));
    } finally {
      setIsUnlocking(false);
    }
  };

  // Signature Upload
  const handleUploadSig = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(ar ? "يرجى اختيار صورة بتنسيق PNG أو JPEG" : "Only PNG or JPEG allowed");
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(ar ? "الحد الأقصى لحجم صورة التوقيع 2 ميجابايت" : "Max 2MB allowed");
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
      if (!res.ok) throw new Error(data.message || "Failed to upload signature");

      setSignaturePreview(base64);
      toast.success(ar ? "تم حفظ التوقيع الرقمي بنجاح" : "Digital signature saved");
      queryClient.invalidateQueries({ queryKey: ["user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (e: any) {
      toast.error(e.message || (ar ? "فشل حفظ التوقيع" : "Failed to save signature"));
    } finally {
      setIsUploadingSig(false);
      if (sigFileInputRef.current) sigFileInputRef.current.value = "";
    }
  };

  // Signature Delete
  const handleDeleteSig = async () => {
    if (!user?.id || isDeletingSig) return;
    setIsDeletingSig(true);
    try {
      const res = await fetch(`/api/users/${user.id}/signature`, { method: "DELETE" });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to delete signature");
      }
      setSignaturePreview(null);
      toast.success(ar ? "تم حذف التوقيع الرقمي بنجاح" : "Digital signature deleted");
      queryClient.invalidateQueries({ queryKey: ["user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (e: any) {
      toast.error(e.message || (ar ? "فشل حذف التوقيع" : "Failed to delete signature"));
    } finally {
      setIsDeletingSig(false);
    }
  };

  // Update User Mutation
  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: ["user-detail", userId] });
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast.success(ar ? "تم حفظ كافة تعديلات المستخدم بنجاح" : "User updated successfully");
        setNewPassword("");
        setConfirmPassword("");
        refetchUser();
      },
      onError: (err: any) => {
        toast.error(err.message || (ar ? "فشل حفظ التغييرات" : "Failed to save changes"));
      },
    },
  });

  // Save All Changes
  const handleSaveAll = async () => {
    if (!user) return;

    // Password validation if entered
    if (newPassword) {
      const evalResult = evaluatePassword(newPassword);
      if (evalResult.score < 2) {
        toast.error(ar ? "كلمة المرور ضعيفة جداً، يرجى اختيار كلمة مرور أقوى" : "Password is too weak");
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
        return;
      }
    }

    const payload: any = {
      name,
      email: email || null,
      phone: phone || null,
      jobTitle: jobTitle || null,
      roles: [primaryRole],
      status: isActive ? "active" : "inactive",
      propertyIds: selectedPropertyIds,
      propertyId: primaryPropertyId || selectedPropertyIds[0] || null,
    };

    if (newPassword) {
      payload.password = newPassword;
    }

    // If dynamic inheritance is ON, pass empty array to clear explicit permissions in DB
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

  // Delete User Mutation
  const deleteMutation = useDeleteUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        toast.success(ar ? "تم حذف حساب المستخدم بنجاح" : "User account deleted");
        setLocation(buildNavHref("/users"));
      },
      onError: (err: any) => {
        toast.error(err.message || (ar ? "فشل حذف المستخدم" : "Failed to delete user"));
      },
    },
  });

  const handleDeleteUser = () => {
    if (!user) return;
    deleteMutation.mutate({ id: user.id });
    setDeleteConfirmOpen(false);
  };

  // Permission Toggle Helpers
  const togglePerm = (pKey: string) => {
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(pKey) ? next.delete(pKey) : next.add(pKey);
      return next;
    });
    if (isDynamicInheritance) setIsDynamicInheritance(false);
  };

  const toggleAllModule = (mod: string) => {
    const actions = MODULE_ACTIONS[mod] || [];
    const allKeys = actions.map((act) => permKey(mod, act));
    const allEnabled = allKeys.every((k) => perms.has(k));

    setPerms((prev) => {
      const next = new Set(prev);
      allKeys.forEach((k) => {
        allEnabled ? next.delete(k) : next.add(k);
      });
      return next;
    });
    if (isDynamicInheritance) setIsDynamicInheritance(false);
  };

  const toggleAllGroup = (groupId: string) => {
    const group = PERMISSION_GROUPS.find((g) => g.id === groupId);
    if (!group) return;
    const allKeys: string[] = [];
    group.modules.forEach((mod) => {
      (MODULE_ACTIONS[mod] || []).forEach((act) => {
        allKeys.push(permKey(mod, act));
      });
    });
    const allEnabled = allKeys.every((k) => perms.has(k));
    setPerms((prev) => {
      const next = new Set(prev);
      allKeys.forEach((k) => {
        allEnabled ? next.delete(k) : next.add(k);
      });
      return next;
    });
    if (isDynamicInheritance) setIsDynamicInheritance(false);
  };

  // Filtered Groups
  const filteredGroups = useMemo(() => {
    return PERMISSION_GROUPS.map((group) => {
      if (selectedGroupFilter !== "all" && group.id !== selectedGroupFilter) {
        return null;
      }
      const filteredMods = group.modules.filter((mod) => {
        if (showOverridesOnly && !isModuleOverridden(mod)) return false;
        if (!permSearch.trim()) return true;
        const q = permSearch.toLowerCase();
        const modLabelAr = MODULE_LABELS[mod]?.ar.toLowerCase() || "";
        const modLabelEn = MODULE_LABELS[mod]?.en.toLowerCase() || "";
        const matchMod = mod.toLowerCase().includes(q) || modLabelAr.includes(q) || modLabelEn.includes(q);
        if (matchMod) return true;
        return (MODULE_ACTIONS[mod] || []).some((act) => {
          const actAr = ACTION_LABELS[act]?.ar.toLowerCase() || "";
          const actEn = ACTION_LABELS[act]?.en.toLowerCase() || "";
          return act.toLowerCase().includes(q) || actAr.includes(q) || actEn.includes(q);
        });
      });
      if (filteredMods.length === 0) return null;
      return { ...group, modules: filteredMods };
    }).filter(Boolean);
  }, [selectedGroupFilter, permSearch, showOverridesOnly, diffStats]);

  // Fetch Activity Logs for this User (Audit Tab)
  const { data: auditLogsData, isLoading: isAuditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ["user-audit-logs", user?.username],
    queryFn: async () => {
      if (!user?.username) return [];
      const propId = contextProperties?.[0]?.id || 1;
      const res = await fetch(`/api/activity-logs?propertyId=${propId}&search=${encodeURIComponent(user.username)}&limit=30`);
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    },
    enabled: activeTab === "audit" && !!user?.username,
  });
  const auditLogs = auditLogsData || [];

  if (isUserLoading) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <RefreshCw className="w-8 h-8 animate-spin text-[#C9A24D]" />
        <p className="text-sm font-medium text-muted-foreground">
          {ar ? "جاري تحميل ملف وحوكمة المستخدم..." : "Loading user governance profile..."}
        </p>
      </div>
    );
  }

  if (isUserError || !user) {
    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
        <div className="w-16 h-16 rounded-2xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
          <UserX className="w-8 h-8 text-red-600" />
        </div>
        <div>
          <h2 className="text-xl font-bold text-foreground">
            {ar ? "المستخدم غير موجود" : "User Not Found"}
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            {ar ? "تعذر العثور على المستخدم المطلوب أو قد تم حذفه." : "The requested user could not be found or was deleted."}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setLocation(buildNavHref("/users"))}
          className="mt-2"
        >
          {ar ? <ArrowRight className="w-4 h-4 me-2" /> : <ArrowLeft className="w-4 h-4 me-2" />}
          {ar ? "العودة لقائمة المستخدمين" : "Back to Users"}
        </Button>
      </div>
    );
  }

  const primaryRoleObj = ALL_ROLES.find((r) => r.value === primaryRole);
  const workflowRoleObj = WORKFLOW_ROLES.find((r) => r.value === jobTitle);

  return (
    <div className="space-y-6 pb-20 max-w-7xl mx-auto px-2 sm:px-4">
      {/* ── Breadcrumb & Top Bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setLocation(buildNavHref("/users"))}
          className="text-muted-foreground hover:text-foreground -ms-2"
        >
          {ar ? <ArrowRight className="w-4 h-4 ms-1" /> : <ArrowLeft className="w-4 h-4 me-1" />}
          <span>{ar ? "العودة لقائمة المستخدمين" : "Back to Users"}</span>
        </Button>

        <div className="flex items-center gap-2">
          {isLocked && (
            <Button
              variant="outline"
              size="sm"
              onClick={handleInstantUnlock}
              disabled={isUnlocking}
              className="border-rose-300 text-rose-700 hover:bg-rose-50 dark:border-rose-800 dark:text-rose-400"
            >
              {isUnlocking ? (
                <RefreshCw className="w-3.5 h-3.5 animate-spin me-1.5" />
              ) : (
                <Unlock className="w-3.5 h-3.5 me-1.5" />
              )}
              {ar ? "فتح قفل الحساب" : "Unlock Account"}
            </Button>
          )}

          {can("users", "delete") && user.username !== currentUser?.username && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setDeleteConfirmOpen(true)}
              className="border-red-200 text-red-600 hover:bg-red-50 hover:border-red-300 dark:border-red-900/40 dark:hover:bg-red-950/30"
            >
              <Trash2 className="w-3.5 h-3.5 me-1.5" />
              {ar ? "حذف الحساب" : "Delete"}
            </Button>
          )}

          <Button
            size="sm"
            onClick={handleSaveAll}
            disabled={updateMutation.isPending}
            className="bg-[#0F2A44] hover:bg-[#18426a] text-white shadow-sm"
          >
            {updateMutation.isPending ? (
              <RefreshCw className="w-3.5 h-3.5 animate-spin me-1.5" />
            ) : (
              <Save className="w-3.5 h-3.5 me-1.5" />
            )}
            {ar ? "حفظ التغييرات" : "Save Changes"}
          </Button>
        </div>
      </div>

      {/* ── Enterprise User Identity Banner ── */}
      <Card className="border shadow-sm overflow-hidden bg-gradient-to-br from-card via-card to-muted/20">
        <div className="h-2.5 bg-gradient-to-r from-[#0F2A44] via-[#C9A24D] to-[#0F2A44]" />
        <CardContent className="p-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div
                className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black text-white shadow-md transition-transform hover:scale-105 ${
                  primaryRole === "super_admin"
                    ? "bg-gradient-to-br from-purple-600 to-indigo-700"
                    : primaryRole === "admin"
                    ? "bg-gradient-to-br from-red-600 to-rose-700"
                    : "bg-gradient-to-br from-[#0F2A44] to-[#1e4e7e]"
                }`}
              >
                {user.username.charAt(0).toUpperCase()}
              </div>
              <div className="space-y-1.5">
                <div className="flex flex-wrap items-center gap-2.5">
                  <h1 className="text-2xl font-bold tracking-tight text-foreground">
                    {user.username}
                  </h1>
                  {user.username === currentUser?.username && (
                    <Badge variant="outline" className="border-[#C9A24D] text-[#C9A24D] text-xs font-semibold">
                      {ar ? "حسابك الحالي" : "You"}
                    </Badge>
                  )}
                  {isLocked ? (
                    <Badge className="bg-rose-500/15 text-rose-700 border-rose-300 dark:border-rose-800 dark:text-rose-400 gap-1 animate-pulse font-bold">
                      <Lock className="w-3 h-3" />
                      {ar ? `مقفول (${lockoutRemainingMinutes} دقيقة متبقية)` : `Locked (${lockoutRemainingMinutes}m left)`}
                    </Badge>
                  ) : isActive ? (
                    <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400 gap-1 font-semibold">
                      <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                      {ar ? "نشط" : "Active"}
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="gap-1 font-medium">
                      <span className="w-2 h-2 rounded-full bg-slate-400" />
                      {ar ? "غير نشط" : "Inactive"}
                    </Badge>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                  <span className={`px-2.5 py-0.5 rounded-full font-bold ${roleColor(primaryRole)}`}>
                    {ar ? primaryRoleObj?.labelAr : primaryRoleObj?.label}
                  </span>
                  {jobTitle && jobTitle !== "none" && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-500/10 text-amber-800 dark:text-amber-300 border border-amber-500/20 font-medium">
                      <Briefcase className="w-3 h-3 text-amber-600" />
                      {ar ? workflowRoleObj?.labelAr : workflowRoleObj?.label}
                    </span>
                  )}
                  {user.email && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Mail className="w-3.5 h-3.5" />
                      {user.email}
                    </span>
                  )}
                  {user.phone && (
                    <span className="flex items-center gap-1 text-muted-foreground">
                      <Phone className="w-3.5 h-3.5" />
                      {user.phone}
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Security Quick Telemetry Cards */}
            <div className="flex flex-wrap items-center gap-3 self-stretch sm:self-center">
              <div className="flex items-center gap-3 p-3 rounded-xl border bg-background/80 min-w-[130px]">
                <div className="w-8 h-8 rounded-lg bg-blue-500/10 flex items-center justify-center text-blue-600">
                  <Building2 className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{ar ? "الفروع المصرحة" : "Properties"}</p>
                  <p className="text-sm font-bold">{selectedPropertyIds.length || (ar ? "عام" : "Global")}</p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border bg-background/80 min-w-[130px]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${signaturePreview ? "bg-emerald-500/10 text-emerald-600" : "bg-muted text-muted-foreground"}`}>
                  <Pen className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{ar ? "التوقيع الرقمي" : "Digital Signature"}</p>
                  <p className="text-sm font-bold text-foreground">
                    {signaturePreview ? (ar ? "مفعل ومسجل" : "Registered") : (ar ? "غير مسجل" : "Not Set")}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 rounded-xl border bg-background/80 min-w-[130px]">
                <div className={`w-8 h-8 rounded-lg flex items-center justify-center ${user.failedLoginAttempts > 0 ? "bg-amber-500/10 text-amber-600" : "bg-emerald-500/10 text-emerald-600"}`}>
                  <ShieldAlert className="w-4 h-4" />
                </div>
                <div>
                  <p className="text-[11px] text-muted-foreground">{ar ? "محاولات فاشلة" : "Failed Logins"}</p>
                  <p className="text-sm font-bold text-foreground">{user.failedLoginAttempts || 0}</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Tabs Navigation Bar ── */}
      <div className="border-b border-border/70 flex gap-2 overflow-x-auto pb-px">
        {[
          {
            id: "profile",
            label: ar ? "البيانات الأساسية والحساب" : "General & Profile",
            icon: User,
          },
          {
            id: "permissions",
            label: ar ? "مصفوفة الصلاحيات والحوكمة" : "Access & Permissions",
            icon: ShieldCheck,
            badge: !isDynamicInheritance ? (ar ? "مخصص" : "Custom") : null,
          },
          {
            id: "properties",
            label: ar ? "الفنادق والفروع" : "Hotel Properties",
            icon: Building2,
            count: selectedPropertyIds.length,
          },
          {
            id: "signature",
            label: ar ? "التوقيع الرقمي" : "Digital Signature",
            icon: Pen,
            badge: signaturePreview ? "✓" : null,
          },
          {
            id: "audit",
            label: ar ? "سجل النشاط والأمان" : "Security & Audit",
            icon: History,
          },
        ].map((tab) => {
          const isSelected = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabChange(tab.id as ActiveTab)}
              className={cn(
                "flex items-center gap-2 py-3 px-4 text-sm font-bold border-b-2 transition-all whitespace-nowrap cursor-pointer",
                isSelected
                  ? "border-[#C9A24D] text-[#C9A24D] bg-[#C9A24D]/5 rounded-t-lg"
                  : "border-transparent text-muted-foreground hover:text-foreground hover:bg-muted/40"
              )}
            >
              <tab.icon className={cn("w-4 h-4", isSelected ? "text-[#C9A24D]" : "text-muted-foreground")} />
              <span>{tab.label}</span>
              {tab.badge && (
                <span className="text-[10px] px-1.5 py-0.2 rounded-full font-bold bg-[#C9A24D] text-white">
                  {tab.badge}
                </span>
              )}
              {typeof tab.count === "number" && tab.count > 0 && (
                <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                  {tab.count}
                </Badge>
              )}
            </button>
          );
        })}
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 1: PROFILE & GENERAL ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "profile" && (
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
                  {ar ? "تعديل البيانات الأساسية، البريد الإلكتروني، ورقم الهاتف." : "Update profile name, contact information, and department."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? "اسم المستخدم (Username)" : "Username"}</Label>
                    <Input value={user.username} disabled className="bg-muted font-mono" />
                    <span className="text-[10px] text-muted-foreground">{ar ? "اسم المستخدم ثابت ولا يمكن تعديله" : "Username is immutable"}</span>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? "الاسم الكامل / الظاهر" : "Full / Display Name"}</Label>
                    <Input
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder={ar ? "الاسم الكامل للموظف" : "Employee Full Name"}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? "البريد الإلكتروني" : "Email Address"}</Label>
                    <Input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="user@example.com"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? "رقم الهاتف" : "Phone Number"}</Label>
                    <Input
                      value={phone}
                      onChange={(e) => setPhone(e.target.value)}
                      placeholder="+20 100 000 0000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? "القسم / الإدارة" : "Department"}</Label>
                    <Input
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder={ar ? "إدارة الإسكان / الصيانة / الاستقبال" : "Housing / Maintenance / HR"}
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">{ar ? "منصب الاعتماد ومسار العمل (Workflow Role)" : "Workflow Approval Role"}</Label>
                    <Select value={jobTitle || "none"} onValueChange={(val) => setJobTitle(val === "none" ? "" : val)}>
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
                  {ar ? "يحدد الدور الصلاحيات الافتراضية الممنوحة للمستخدم في جميع موديولات النظام." : "Defines the base permissions inherited by this account across all modules."}
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
                            : "border-border hover:border-border/80 hover:bg-muted/30"
                        )}
                      >
                        <div className={cn("w-4 h-4 rounded-full border-2 mt-0.5 flex items-center justify-center shrink-0", isSelected ? "border-[#C9A24D]" : "border-muted-foreground")}>
                          {isSelected && <div className="w-2 h-2 rounded-full bg-[#C9A24D]" />}
                        </div>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm">{ar ? role.labelAr : role.label}</span>
                            <span className={cn("text-[10px] px-1.5 py-0.2 rounded font-semibold", roleColor(role.value))}>
                              {role.value}
                            </span>
                          </div>
                          <p className="text-xs text-muted-foreground mt-1">
                            {role.value === "housekeeping_staff"
                              ? ar ? "مخصص لأوامر النظافة والخدمات وتجهيز الغرف فقط" : "Restricted to housekeeping & cleaning orders"
                              : role.value === "maintenance_staff"
                              ? ar ? "مخصص لأوامر الصيانة الفنية وإصلاح الأعطال فقط" : "Restricted to technical maintenance & work orders"
                              : role.value === "super_admin"
                              ? ar ? "صلاحيات مطلقة لإدارة جميع الفنادق والفرع والنظام" : "Full unrestricted control across all hotels"
                              : role.value === "admin"
                              ? ar ? "إدارة شاملة للمستخدمين والغرف والتسكين" : "Comprehensive property administration"
                              : ar ? "صلاحيات تشغيلية محددة حسب الوظيفة" : "Role-based operations"}
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
                      {isActive ? (ar ? "الحساب نشط ومفعل" : "Account Active") : (ar ? "الحساب معطل" : "Account Disabled")}
                    </Label>
                    <p className="text-xs text-muted-foreground">
                      {isActive
                        ? ar ? "يمكن للمستخدم تسجيل الدخول واستخدام النظام" : "User can sign in and operate"
                        : ar ? "تم إيقاف الدخول لهذا الحساب مؤقتاً" : "Sign-in is blocked for this user"}
                    </p>
                  </div>
                  <Switch checked={isActive} onCheckedChange={setIsActive} />
                </div>

                {isLocked && (
                  <div className="p-3.5 rounded-xl border border-rose-300 bg-rose-50 dark:bg-rose-950/20 dark:border-rose-900/40 space-y-2">
                    <div className="flex items-center gap-2 text-rose-700 dark:text-rose-400 font-bold text-sm">
                      <Lock className="w-4 h-4" />
                      <span>{ar ? "الحساب مقفول أمنياً" : "Account Security Locked"}</span>
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
                      {isUnlocking ? <RefreshCw className="w-3.5 h-3.5 animate-spin me-1" /> : <Unlock className="w-3.5 h-3.5 me-1" />}
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
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleGeneratePassword}
                    className="text-xs text-[#C9A24D] hover:text-[#b08e40] font-bold p-0 h-auto"
                  >
                    <Sparkles className="w-3.5 h-3.5 me-1" />
                    {ar ? "توليد ذكي" : "Generate"}
                  </Button>
                </div>
                <CardDescription>
                  {ar ? "اترك الحقول فارغة إذا كنت لا ترغب في تغيير كلمة المرور." : "Leave blank to keep existing password."}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">{ar ? "كلمة المرور الجديدة" : "New Password"}</Label>
                    <button
                      type="button"
                      onClick={() => setShowPasswordText(!showPasswordText)}
                      className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1"
                    >
                      {showPasswordText ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3" />}
                      {showPasswordText ? (ar ? "إخفاء" : "Hide") : (ar ? "إظهار" : "Show")}
                    </button>
                  </div>
                  <Input
                    type={showPasswordText ? "text" : "password"}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="font-mono text-sm"
                  />
                  {newPassword && <PasswordStrengthMeter password={newPassword} />}
                </div>

                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">{ar ? "تأكيد كلمة المرور" : "Confirm Password"}</Label>
                  <Input
                    type={showPasswordText ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="font-mono text-sm"
                  />
                  {confirmPassword && newPassword !== confirmPassword && (
                    <p className="text-[11px] text-rose-500 font-medium">
                      {ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match"}
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
              </CardContent>
            </Card>
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 2: ACCESS & PERMISSIONS MATRIX ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "permissions" && (
        <div className="space-y-6">
          {/* Dynamic Inheritance vs Custom Overrides Banner */}
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border bg-gradient-to-r from-card to-muted/30">
            <div className="flex items-center gap-3">
              <div className={cn("w-10 h-10 rounded-xl flex items-center justify-center text-white", isDynamicInheritance ? "bg-emerald-600" : "bg-[#C9A24D]")}>
                {isDynamicInheritance ? <RefreshCw className="w-5 h-5" /> : <Sliders className="w-5 h-5" />}
              </div>
              <div>
                <h3 className="font-bold text-sm">
                  {isDynamicInheritance
                    ? ar ? `مزامنة تلقائية حسب الدور الافتراضي (${primaryRole})` : `Inherited Dynamically from (${primaryRole})`
                    : ar ? "صلاحيات مخصصة واستثناءات فردية (Custom Matrix)" : "Customized Permission Matrix"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {isDynamicInheritance
                    ? ar ? "المستخدم يرث كافة صلاحيات دوره تلقائياً ويتم تحديثها مع أي تعديل على إعدادات الدور." : "Role-based automatic inheritance is active."
                    : ar ? "تم تفعيل التخصيص اليدوي، ولن يتأثر الحساب بالتغييرات العامة على الدور." : "Account has explicit overrides disconnected from role defaults."}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-xs font-bold text-muted-foreground">
                {isDynamicInheritance ? (ar ? "تفعيل التخصيص الفردي" : "Customize") : (ar ? "استعادة الافتراضي" : "Reset to Role")}
              </span>
              <Switch
                checked={!isDynamicInheritance}
                onCheckedChange={(checked) => {
                  if (!checked) {
                    setIsDynamicInheritance(true);
                    setPerms(new Set(defaultPermsForRole));
                    toast.info(ar ? "تمت استعادة مصفوفة الصلاحيات الافتراضية للدور" : "Restored role defaults");
                  } else {
                    setIsDynamicInheritance(false);
                    toast.info(ar ? "تم تفعيل التخصيص الفردي للصلاحيات" : "Custom permissions enabled");
                  }
                }}
              />
            </div>
          </div>

          {/* Smart Capabilities Toolbar */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {/* 1. Live Access Simulator Card */}
            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <Zap className="w-4 h-4 text-amber-500" />
                    {ar ? "محاكي الوصول اللحظي" : "Live Access Simulator"}
                  </span>
                  <button
                    onClick={() => setShowSimulator(!showSimulator)}
                    className="text-xs text-[#C9A24D] hover:underline font-semibold"
                  >
                    {showSimulator ? (ar ? "إخفاء" : "Hide") : (ar ? "فتح" : "Open")}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {ar ? "اختبر فورياً هل يمتلك هذا المستخدم تصريحاً لتنفيذ إجراء معين." : "Instantly test if this user can perform an action."}
                </p>
                {showSimulator && (
                  <div className="space-y-2 pt-2 border-t mt-2">
                    <div className="grid grid-cols-2 gap-2">
                      <Select value={simModule} onValueChange={setSimModule}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {MODULES.map((m) => (
                            <SelectItem key={m} value={m} className="text-xs">
                              {ar ? MODULE_LABELS[m]?.ar : MODULE_LABELS[m]?.en}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <Select value={simAction} onValueChange={setSimAction}>
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {simActions.map((act) => (
                            <SelectItem key={act} value={act} className="text-xs">
                              {ar ? ACTION_LABELS[act]?.ar || act : ACTION_LABELS[act]?.en || act}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>

                    {simulatorResult && (
                      <div className={cn("p-2 rounded-lg text-xs font-semibold flex items-center gap-2", simulatorResult.allowed ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300" : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300")}>
                        {simulatorResult.allowed ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" /> : <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />}
                        <span>{simulatorResult.reason}</span>
                      </div>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>

            {/* 2. Permission Cloner Card */}
            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center gap-1.5">
                  <Copy className="w-4 h-4 text-blue-500" />
                  {ar ? "استنساخ الصلاحيات" : "Clone Permissions"}
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <p className="text-xs text-muted-foreground">
                  {ar ? "نسخ الصلاحيات بالكامل من مستخدم آخر في النظام." : "Copy full matrix from another user."}
                </p>
                <div className="flex gap-2">
                  <Select value={cloneSourceUserId} onValueChange={setCloneSourceUserId}>
                    <SelectTrigger className="h-8 text-xs flex-1">
                      <SelectValue placeholder={ar ? "اختر مستخدم..." : "Select user..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {allUsers
                        .filter((u: any) => u.id !== user.id)
                        .map((u: any) => (
                          <SelectItem key={u.id} value={String(u.id)} className="text-xs">
                            {u.username} ({u.roles?.[0] || "user"})
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={handleClonePermissions}
                    disabled={!cloneSourceUserId}
                    className="h-8 text-xs"
                  >
                    {ar ? "استنساخ" : "Clone"}
                  </Button>
                </div>
              </CardContent>
            </Card>

            {/* 3. Diff & Overrides Card */}
            <Card className="border shadow-sm">
              <CardHeader className="p-4 pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="flex items-center gap-1.5">
                    <SlidersHorizontal className="w-4 h-4 text-indigo-500" />
                    {ar ? "تحليل الفروقات والاستثناءات" : "Diff & Overrides"}
                  </span>
                  <button
                    onClick={() => setShowOverridesOnly(!showOverridesOnly)}
                    className={cn("text-xs font-bold px-2 py-0.5 rounded border transition-colors", showOverridesOnly ? "bg-[#C9A24D] text-white border-[#C9A24D]" : "border-border hover:bg-muted text-muted-foreground")}
                  >
                    {showOverridesOnly ? (ar ? "إظهار الكل" : "Show All") : (ar ? "الاستثناءات فقط" : "Overrides Only")}
                  </button>
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 pt-1 space-y-2">
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50">
                    +{diffStats.added} {ar ? "صلاحيات إضافية" : "granted"}
                  </Badge>
                  <Badge variant="outline" className="text-xs border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-50/50">
                    -{diffStats.revoked} {ar ? "صلاحيات ملغاة" : "revoked"}
                  </Badge>
                  {diffStats.isIdentical && (
                    <span className="text-xs text-muted-foreground italic">
                      {ar ? "متطابق مع الدور الافتراضي" : "Matches default role"}
                    </span>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Search and Category Filters */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="w-4 h-4 absolute start-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={permSearch}
                onChange={(e) => setPermSearch(e.target.value)}
                placeholder={ar ? "بحث في الصلاحيات والإجراءات..." : "Search capabilities..."}
                className="ps-9 h-9 text-xs"
              />
            </div>

            <div className="flex items-center gap-1 overflow-x-auto pb-1">
              <button
                onClick={() => setSelectedGroupFilter("all")}
                className={cn("px-2.5 py-1 text-xs font-bold rounded-lg border transition-all whitespace-nowrap", selectedGroupFilter === "all" ? "bg-[#0F2A44] text-white border-[#0F2A44]" : "border-border text-muted-foreground hover:bg-muted")}
              >
                {ar ? "كافة المجموعات" : "All Groups"}
              </button>
              {PERMISSION_GROUPS.map((g) => (
                <button
                  key={g.id}
                  onClick={() => setSelectedGroupFilter(g.id)}
                  className={cn("px-2.5 py-1 text-xs font-bold rounded-lg border transition-all whitespace-nowrap", selectedGroupFilter === g.id ? "bg-[#0F2A44] text-white border-[#0F2A44]" : "border-border text-muted-foreground hover:bg-muted")}
                >
                  {ar ? g.label.ar : g.label.en}
                </button>
              ))}
            </div>
          </div>

          {/* Granular Module Permission Accordions */}
          <div className="space-y-4">
            {filteredGroups.map((group: any) => (
              <div key={group.id} className="space-y-3">
                <div className="flex items-center justify-between px-1">
                  <div className="flex items-center gap-2">
                    <h4 className="text-xs font-black uppercase tracking-wider text-muted-foreground">
                      {ar ? group.label.ar : group.label.en}
                    </h4>
                    <span className="text-[11px] text-muted-foreground">({group.modules.length} {ar ? "موديول" : "modules"})</span>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => toggleAllGroup(group.id)}
                    className="text-xs h-7 text-muted-foreground hover:text-foreground"
                  >
                    {ar ? "تحديد / إلغاء الكل للمجموعة" : "Toggle All Group"}
                  </Button>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {group.modules.map((mod: string) => {
                    const actions = MODULE_ACTIONS[mod] || [];
                    const modKeys = actions.map((act) => permKey(mod, act));
                    const enabledCount = modKeys.filter((k) => perms.has(k)).length;
                    const isAllEnabled = enabledCount === actions.length && actions.length > 0;
                    const isExpanded = expandedModules[mod] ?? true;

                    return (
                      <Card key={mod} className={cn("border transition-all", isAllEnabled ? "border-primary/40 bg-card" : "border-border/70")}>
                        <div className="p-3.5 flex items-center justify-between border-b bg-muted/20">
                          <div className="flex items-center gap-2.5">
                            <Checkbox
                              checked={isAllEnabled}
                              onCheckedChange={() => toggleAllModule(mod)}
                              title={ar ? "تحديد كافة إجراءات الموديول" : "Toggle all actions"}
                            />
                            <div>
                              <span className="font-bold text-sm text-foreground">
                                {ar ? MODULE_LABELS[mod]?.ar : MODULE_LABELS[mod]?.en}
                              </span>
                              <span className="text-xs text-muted-foreground font-mono ms-2 capitalize">
                                ({mod})
                              </span>
                            </div>
                          </div>

                          <div className="flex items-center gap-2">
                            <Badge variant={enabledCount > 0 ? "default" : "secondary"} className="text-[10px] px-1.5 py-0 font-semibold">
                              {enabledCount}/{actions.length}
                            </Badge>
                            <button
                              type="button"
                              onClick={() => setExpandedModules((prev) => ({ ...prev, [mod]: !isExpanded }))}
                              className="text-muted-foreground hover:text-foreground p-1"
                            >
                              {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                            </button>
                          </div>
                        </div>

                        {isExpanded && (
                          <div className="p-3.5 grid grid-cols-2 gap-2">
                            {actions.map((act) => {
                              const pKey = permKey(mod, act);
                              const isChecked = perms.has(pKey);
                              const isAdded = diffStats.addedKeys?.has(pKey);
                              const isRevoked = diffStats.revokedKeys?.has(pKey);

                              return (
                                <label
                                  key={act}
                                  className={cn(
                                    "flex items-center gap-2 p-2 rounded-lg border text-xs font-medium cursor-pointer transition-colors",
                                    isChecked
                                      ? "bg-primary/5 border-primary/20 text-foreground"
                                      : "border-border/50 text-muted-foreground hover:bg-muted/30",
                                    isAdded && "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                                    isRevoked && "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-300"
                                  )}
                                >
                                  <Checkbox
                                    checked={isChecked}
                                    onCheckedChange={() => togglePerm(pKey)}
                                  />
                                  <span className="truncate flex-1">
                                    {ar ? ACTION_LABELS[act]?.ar || act : ACTION_LABELS[act]?.en || act}
                                  </span>
                                  {isAdded && (
                                    <span className="text-[9px] font-black text-emerald-600 bg-emerald-100 dark:bg-emerald-950/60 px-1 rounded">
                                      +{ar ? "إضافي" : "Added"}
                                    </span>
                                  )}
                                  {isRevoked && (
                                    <span className="text-[9px] font-black text-rose-600 bg-rose-100 dark:bg-rose-950/60 px-1 rounded">
                                      -{ar ? "ملغي" : "Revoked"}
                                    </span>
                                  )}
                                </label>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 3: HOTELS & PROPERTIES SCOPE ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "properties" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-lg flex items-center gap-2">
                    <Building2 className="w-5 h-5 text-blue-600" />
                    {ar ? "صلاحيات الوصول للفنادق والفروع (Multi-Tenant Scope)" : "Authorized Hotel Properties"}
                  </CardTitle>
                  <CardDescription>
                    {ar
                      ? "حدد الفنادق التي يُسمح لهذا المستخدم بالوصول إلى غرفها، نزلائها، وطلباتها."
                      : "Define which hotel schemas and branches this user is authorized to manage."}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      const allIds = properties.map((p: any) => p.id);
                      setSelectedPropertyIds(allIds);
                      if (!primaryPropertyId && allIds.length > 0) setPrimaryPropertyId(allIds[0]);
                    }}
                    className="text-xs"
                  >
                    {ar ? "تحديد كافة الفنادق" : "Select All Hotels"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setSelectedPropertyIds([]);
                      setPrimaryPropertyId(null);
                    }}
                    className="text-xs"
                  >
                    {ar ? "إلغاء التحديد" : "Deselect All"}
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {properties.map((property: any) => {
                  const isChecked = selectedPropertyIds.includes(property.id);
                  const isPrimary = primaryPropertyId === property.id;

                  return (
                    <div
                      key={property.id}
                      className={cn(
                        "p-4 rounded-xl border-2 transition-all flex flex-col justify-between gap-3",
                        isChecked
                          ? "border-[#0F2A44] bg-[#0F2A44]/5 shadow-sm"
                          : "border-border hover:border-border/80 bg-card"
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <label className="flex items-center gap-3 cursor-pointer flex-1">
                          <Checkbox
                            checked={isChecked}
                            onCheckedChange={(val) => {
                              if (val) {
                                setSelectedPropertyIds((prev) => [...prev, property.id]);
                                if (!primaryPropertyId) setPrimaryPropertyId(property.id);
                              } else {
                                setSelectedPropertyIds((prev) => prev.filter((id) => id !== property.id));
                                if (primaryPropertyId === property.id) {
                                  const remaining = selectedPropertyIds.filter((id) => id !== property.id);
                                  setPrimaryPropertyId(remaining[0] ?? null);
                                }
                              }
                            }}
                          />
                          <div>
                            <span className="font-bold text-sm block text-foreground">
                              {property.name}
                            </span>
                            <span className="text-xs text-muted-foreground font-mono">
                              ({property.code})
                            </span>
                          </div>
                        </label>

                        {isChecked && (
                          <button
                            type="button"
                            onClick={() => setPrimaryPropertyId(property.id)}
                            title={isPrimary ? (ar ? "الفندق الأساسي الحالي" : "Current Primary Hotel") : (ar ? "تعيين كفندق أساسي" : "Set as Primary Hotel")}
                            className={cn("p-1.5 rounded-lg border transition-colors", isPrimary ? "bg-amber-500/15 border-amber-500/30 text-amber-600 dark:text-amber-400" : "border-border text-muted-foreground hover:bg-muted")}
                          >
                            <Star className={cn("w-4 h-4", isPrimary && "fill-amber-500")} />
                          </button>
                        )}
                      </div>

                      <div className="flex items-center justify-between text-xs text-muted-foreground pt-2 border-t">
                        <span>{property.city || (ar ? "مصر" : "Egypt")}</span>
                        {isPrimary && (
                          <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 dark:text-amber-400 font-bold">
                            ★ {ar ? "الفرع الأساسي" : "Primary"}
                          </Badge>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 4: DIGITAL SIGNATURE ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "signature" && (
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <Pen className="w-5 h-5 text-indigo-600" />
                {ar ? "التوقيع الرقمي للمستخدم" : "Digital Signature"}
              </CardTitle>
              <CardDescription>
                {ar
                  ? "يُستخدم هذا التوقيع الرقمي في أختام تصاريح استضافة الضيوف، أوامر الصيانة، وتقارير استلام وتسليم الغرف."
                  : "Applied on guest hosting approvals, maintenance sign-offs, and room handover records."}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="flex flex-col items-center justify-center p-8 rounded-2xl border-2 border-dashed bg-muted/20 text-center gap-4">
                {signaturePreview ? (
                  <div className="space-y-4">
                    <div className="p-4 bg-white dark:bg-zinc-900 rounded-xl border shadow-sm max-w-sm mx-auto">
                      <img
                        src={signaturePreview}
                        alt="Signature Preview"
                        className="max-h-36 object-contain mx-auto"
                      />
                    </div>
                    <div className="flex items-center justify-center gap-3">
                      <Badge className="bg-emerald-500/15 text-emerald-700 border-emerald-300 dark:border-emerald-800 dark:text-emerald-400 font-semibold">
                        <Check className="w-3.5 h-3.5 me-1" />
                        {ar ? "التوقيع مسجل ومعتمد" : "Signature Registered"}
                      </Badge>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={handleDeleteSig}
                        disabled={isDeletingSig}
                        className="text-red-600 hover:bg-red-50 border-red-200 text-xs"
                      >
                        {isDeletingSig ? <RefreshCw className="w-3.5 h-3.5 animate-spin me-1" /> : <Trash2 className="w-3.5 h-3.5 me-1" />}
                        {ar ? "حذف التوقيع" : "Delete Signature"}
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <div className="w-16 h-16 rounded-full bg-muted flex items-center justify-center mx-auto text-muted-foreground">
                      <Pen className="w-8 h-8 opacity-40" />
                    </div>
                    <h4 className="font-bold text-foreground">{ar ? "لا يوجد توقيع رقمي مسجل" : "No Signature Uploaded"}</h4>
                    <p className="text-xs text-muted-foreground max-w-sm">
                      {ar
                        ? "قم برفع صورة التوقيع بخلفية شفافة (PNG أو JPEG، بحد أقصى 2 ميجابايت) ليتم اعتمادها في المستندات."
                        : "Upload a transparent signature image (PNG/JPEG under 2MB)."}
                    </p>
                  </div>
                )}

                <div>
                  <input
                    ref={sigFileInputRef}
                    type="file"
                    accept="image/png,image/jpeg"
                    onChange={handleUploadSig}
                    className="hidden"
                  />
                  <Button
                    onClick={() => sigFileInputRef.current?.click()}
                    disabled={isUploadingSig}
                    className="bg-[#0F2A44] hover:bg-[#18426a] text-white"
                  >
                    {isUploadingSig ? (
                      <RefreshCw className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <Upload className="w-4 h-4 me-2" />
                    )}
                    {signaturePreview
                      ? ar ? "استبدال صورة التوقيع" : "Replace Signature"
                      : ar ? "رفع صورة التوقيع الآن" : "Upload Signature Image"}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/* ── TAB 5: SECURITY & AUDIT TRAIL ── */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === "audit" && (
        <div className="space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <div>
                <CardTitle className="text-lg flex items-center gap-2">
                  <History className="w-5 h-5 text-[#C9A24D]" />
                  {ar ? "سجل نشاط وحركات المستخدم" : "User Security & Activity Audit"}
                </CardTitle>
                <CardDescription>
                  {ar ? "سجل زمني مفصل لجميع العمليات والحركات التي نفذها هذا الحساب في النظام." : "Chronological activity log performed by this account."}
                </CardDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAudit()}
                disabled={isAuditLoading}
                className="text-xs"
              >
                <RefreshCw className={cn("w-3.5 h-3.5 me-1.5", isAuditLoading && "animate-spin")} />
                {ar ? "تحديث السجل" : "Refresh"}
              </Button>
            </CardHeader>
            <CardContent>
              {isAuditLoading ? (
                <div className="flex items-center justify-center py-12">
                  <RefreshCw className="w-6 h-6 animate-spin text-[#C9A24D]" />
                </div>
              ) : auditLogs.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground space-y-2">
                  <Activity className="w-8 h-8 mx-auto opacity-30" />
                  <p className="font-semibold">{ar ? "لا توجد حركات مسجلة لهذا المستخدم حتى الآن" : "No activity logs recorded yet"}</p>
                </div>
              ) : (
                <div className="rounded-xl border overflow-hidden">
                  <Table>
                    <TableHeader>
                      <TableRow className="bg-muted/40">
                        <TableHead className="w-40">{ar ? "التاريخ والوقت" : "Timestamp"}</TableHead>
                        <TableHead>{ar ? "الموديول" : "Module"}</TableHead>
                        <TableHead>{ar ? "الإجراء" : "Action"}</TableHead>
                        <TableHead>{ar ? "التفاصيل" : "Details"}</TableHead>
                        <TableHead className="w-32">{ar ? "عنوان IP" : "IP Address"}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {auditLogs.map((log: any) => (
                        <TableRow key={log.id}>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {new Date(log.createdAt || log.timestamp).toLocaleString([], {
                              dateStyle: "short",
                              timeStyle: "short",
                            })}
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-semibold uppercase px-2 py-0.5 rounded bg-muted">
                              {log.module}
                            </span>
                          </TableCell>
                          <TableCell>
                            <span className="text-xs font-bold text-foreground">
                              {log.action}
                            </span>
                          </TableCell>
                          <TableCell className="text-xs text-muted-foreground max-w-xs truncate">
                            {typeof log.details === "object" ? JSON.stringify(log.details) : String(log.details || "—")}
                          </TableCell>
                          <TableCell className="text-xs font-mono text-muted-foreground">
                            {log.ipAddress || log.ip || "—"}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* ── Delete User Confirmation Alert Dialog ── */}
      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent dir={ar ? "rtl" : "ltr"}>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-red-600">
              <AlertTriangle className="w-5 h-5" />
              {ar ? "تأكيد حذف حساب المستخدم" : "Confirm User Deletion"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {ar
                ? `هل أنت متأكد من رغبتك في حذف المستخدم (${user.username}) نهائياً من النظام؟ لا يمكن التراجع عن هذه العملية.`
                : `Are you sure you want to permanently delete user (${user.username})? This action cannot be undone.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 sm:gap-0">
            <AlertDialogCancel disabled={deleteMutation.isPending}>
              {ar ? "إلغاء" : "Cancel"}
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteUser}
              disabled={deleteMutation.isPending}
              className="bg-red-600 hover:bg-red-700 text-white"
            >
              {deleteMutation.isPending ? (
                <RefreshCw className="w-4 h-4 animate-spin me-1.5" />
              ) : (
                <Trash2 className="w-4 h-4 me-1.5" />
              )}
              {ar ? "تأكيد الحذف نهائياً" : "Delete User"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
