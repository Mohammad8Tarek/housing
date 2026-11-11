// State, effects and handlers of UserDetailPage (moved verbatim).
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
import { WORKFLOW_ROLES } from "../utils";
import {
  MODULE_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  PERMISSION_GROUPS,
  ROLE_DEFAULT_PERMISSIONS,
  permKey,
  type Action,
} from "@/lib/permissions";
import { evaluatePassword } from "../components/PasswordStrengthMeter";
import { toast } from "sonner";
import { ALL_ROLES, ActiveTab } from "./detail.constants";

export function useUserDetailPageState() {
  const { id } = useParams<{ id: string }>();
  const [, setLocation] = useLocation();
  const userId = parseInt(id || "0", 10);
  const { language } = useLanguage();
  const ar = language === "ar";
  const { user: currentUser, isSystemAdmin } = useAuth();
  const { can, isAdmin, perms: actorPerms } = usePermission();
  const {
    properties: contextProperties,
    isSuperAdmin,
    buildNavHref,
  } = useProperty();
  const canGrantAnything = isSuperAdmin || isSystemAdmin || actorPerms.has("*");

  const actorCanGrant = (mod: string, act: string) => {
    if (canGrantAnything) return true;
    return can(mod as any, act as any);
  };
  const queryClient = useQueryClient();

  // Read tab from query string or default to 'profile'
  const searchParams = new URLSearchParams(window.location.search);
  const initialTabParam = searchParams.get("tab") as ActiveTab;
  const validTabs: ActiveTab[] = [
    "profile",
    "permissions",
    "properties",
    "signature",
    "audit",
  ];
  const [activeTab, setActiveTab] = useState<ActiveTab>(
    validTabs.includes(initialTabParam) ? initialTabParam : "profile",
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
  const properties = propertiesRes?.length
    ? propertiesRes
    : contextProperties || [];

  // Form Edit State
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [department, setDepartment] = useState("");
  const [jobTitle, setJobTitle] = useState("");
  const [primaryRole, setPrimaryRole] = useState("user");
  const [isActive, setIsActive] = useState(true);
  const [selectedPropertyIds, setSelectedPropertyIds] = useState<number[]>([]);
  const [primaryPropertyId, setPrimaryPropertyId] = useState<number | null>(
    null,
  );

  // Password Management State
  const [changePassword, setChangePassword] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPasswordText, setShowPasswordText] = useState(false);

  // Unlocking State
  const [isUnlocking, setIsUnlocking] = useState(false);

  // Delete User Confirmation Dialog State
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Permissions Matrix State
  const [perms, setPerms] = useState<Set<string>>(new Set());
  const [expandedModules, setExpandedModules] = useState<
    Record<string, boolean>
  >({});
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
    setNationalId((user as any).nationalId || (user as any).national_id || "");
    setDepartment(user.department || "");
    setJobTitle(user.jobTitle || "");
    const r = (user.roles?.[0] || "user").toLowerCase();
    setPrimaryRole(r);
    setIsActive(String(user.status || "").toUpperCase() !== "INACTIVE");

    const pids = user.propertyIds?.length
      ? user.propertyIds
      : user.propertyId
        ? [user.propertyId]
        : [];
    setSelectedPropertyIds(pids);
    setPrimaryPropertyId(user.propertyId || (pids[0] ?? null));

    // Reset password fields
    setChangePassword(false);
    setNewPassword("");
    setConfirmPassword("");

    // Signature preview
    setSignaturePreview(user.signatureImageUrl || null);

    // Permissions initialization
    const explicit = (user.permissions as string[] | undefined) ?? [];
    if (explicit.length === 0) {
      if (r === "super_admin") {
        setPerms(new Set(ROLE_DEFAULT_PERMISSIONS["super_admin"] || []));
      } else {
        setPerms(new Set());
      }
    } else {
      const normalized = explicit
        .filter((p) => p && p !== "none")
        .map((p) => {
          let s = String(p).trim().toLowerCase();
          if (s.startsWith("employees."))
            s = s.replace("employees.", "profiles.");
          if (s.startsWith("employees:"))
            s = s.replace("employees:", "profiles:");
          return s;
        });
      const allowed = canGrantAnything
        ? normalized
        : normalized.filter((p: string) => {
            const parts = p.split(".");
            if (parts.length === 2) return actorCanGrant(parts[0], parts[1]);
            return actorPerms.has(p);
          });
      setPerms(new Set(allowed));
    }
  }, [user]);

  // Is account locked check
  const isLocked = useMemo(() => {
    const st = String(user?.status || "").toUpperCase();
    if (st === "LOCKED") return true;
    if (!user?.lockedUntil) return false;
    return new Date(user.lockedUntil) > new Date();
  }, [user?.status, user?.lockedUntil]);

  const lockoutRemainingMinutes = useMemo(() => {
    if (!isLocked || !user?.lockedUntil) return 0;
    return Math.max(
      1,
      Math.ceil((new Date(user.lockedUntil).getTime() - Date.now()) / 60000),
    );
  }, [isLocked, user?.lockedUntil]);

  // Actions for the selected simulator module
  const simActions = useMemo(() => {
    return (MODULE_ACTIONS as Record<string, Action[]>)[simModule] || ["view"];
  }, [simModule]);

  useEffect(() => {
    if (simActions.length > 0 && !simActions.includes(simAction as any)) {
      setSimAction(simActions[0]);
    }
  }, [simModule, simActions, simAction]);

  // Default permissions for current role clamped to actor's reach
  const defaultPermsForRole = useMemo(() => {
    const raw = ROLE_DEFAULT_PERMISSIONS[primaryRole] || [];
    if (canGrantAnything) return new Set(raw);
    return new Set(
      raw.filter((p: string) => {
        const parts = p.split(".");
        if (parts.length === 2) return actorCanGrant(parts[0], parts[1]);
        return actorPerms.has(p);
      }),
    );
  }, [primaryRole, canGrantAnything, actorPerms]);

  // Diff stats calculation (comparison against role template)
  const diffStats = useMemo(() => {
    const added = Array.from(perms).filter((p) => !defaultPermsForRole.has(p));
    const revoked = Array.from(defaultPermsForRole).filter(
      (p) => !perms.has(p),
    );
    return {
      added: added.length,
      revoked: revoked.length,
      isIdentical: added.length === 0 && revoked.length === 0,
      addedKeys: new Set(added),
      revokedKeys: new Set(revoked),
    };
  }, [perms, defaultPermsForRole]);

  const isModuleOverridden = (mod: string) => {
    const actions = (MODULE_ACTIONS as Record<string, Action[]>)[mod] || [];
    return actions.some((act: any) => {
      const key = permKey(mod as any, act);
      return diffStats.addedKeys?.has(key) || diffStats.revokedKeys?.has(key);
    });
  };

  // Password Generator
  const handleGeneratePassword = () => {
    setChangePassword(true);
    const chars =
      "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789!@#$%&*";
    let pwd = "";
    pwd += "ABCDEFGHJKLMNPQRSTUVWXYZ"[Math.floor(Math.random() * 24)];
    pwd += "abcdefghijkmnpqrstuvwxyz"[Math.floor(Math.random() * 24)];
    pwd += "23456789"[Math.floor(Math.random() * 8)];
    pwd += "!@#$%&*"[Math.floor(Math.random() * 7)];
    for (let i = 0; i < 8; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    const shuffled = pwd
      .split("")
      .sort(() => 0.5 - Math.random())
      .join("");
    setNewPassword(shuffled);
    setConfirmPassword(shuffled);
    setShowPasswordText(true);
    toast.success(
      ar
        ? "تم توليد كلمة مرور معقدة وقوية عشوائياً"
        : "Strong password generated",
    );
  };

  const handleCopyCredentials = () => {
    if (!newPassword) {
      toast.error(
        ar
          ? "يرجى كتابة أو توليد كلمة المرور أولاً"
          : "Please generate or enter password first",
      );
      return;
    }
    const text = `${ar ? "اسم المستخدم" : "Username"}: ${user?.username}\n${ar ? "كلمة المرور" : "Password"}: ${newPassword}\n${ar ? "رابط النظام" : "System URL"}: ${window.location.origin}`;
    navigator.clipboard.writeText(text);
    toast.success(
      ar
        ? "تم نسخ بيانات الدخول إلى الحافظة بنجاح"
        : "Credentials copied to clipboard",
    );
  };

  // Clone Permissions Handler
  const handleClonePermissions = () => {
    if (!cloneSourceUserId) {
      toast.error(
        ar
          ? "يرجى اختيار المستخدم أولاً"
          : "Please select a user to clone from",
      );
      return;
    }
    const source = allUsers?.find(
      (u: any) => String(u.id) === String(cloneSourceUserId),
    );
    if (!source) return;

    const sourceExplicit = (source.permissions as string[] | undefined) ?? [];
    if (sourceExplicit.length === 0) {
      if (source.roles?.includes("super_admin")) {
        setPerms(new Set(ROLE_DEFAULT_PERMISSIONS["super_admin"] || []));
      } else {
        setPerms(new Set());
      }
    } else {
      const normalized = sourceExplicit
        .filter((p) => p && p !== "none")
        .map((p: string) => {
          let s = String(p).trim().toLowerCase();
          if (s.startsWith("employees."))
            s = s.replace("employees.", "profiles.");
          if (s.startsWith("employees:"))
            s = s.replace("employees:", "profiles:");
          return s;
        });
      setPerms(new Set(normalized));
    }
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
        reason: ar
          ? "مسموح بالكامل (سوبر أدمن مدير النظام العام)"
          : "Fully allowed (Super Admin)",
        type: "super",
      };
    }
    const key = permKey(simModule as any, simAction as any);
    const hasPerm = perms.has(key);
    if (hasPerm) {
      return {
        allowed: true,
        reason: ar
          ? "مسموح ✅ - ممنوح في صلاحيات المستخدم"
          : "Allowed - explicitly granted in permissions",
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
  }, [simModule, simAction, primaryRole, perms, ar]);

  // Instant Unlock Handler
  const handleInstantUnlock = async () => {
    if (!user?.id || isUnlocking) return;
    setIsUnlocking(true);
    try {
      const res = await fetch(`/api/users/${user.id}/unlock`, {
        method: "POST",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || "Failed to unlock");
      }
      toast.success(
        ar
          ? "تم فتح قفل الحساب بنجاح ومسح المحاولات الفاشلة"
          : "Account unlocked successfully",
      );
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
      toast.error(
        ar ? "يرجى اختيار صورة بتنسيق PNG أو JPEG" : "Only PNG or JPEG allowed",
      );
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        ar ? "الحد الأقصى لحجم صورة التوقيع 2 ميجابايت" : "Max 2MB allowed",
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

      const res = await fetch(`/api/users/${user.id}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: base64 }),
      });
      const data = await res.json();
      if (!res.ok)
        throw new Error(data.message || "Failed to upload signature");

      setSignaturePreview(base64);
      toast.success(
        ar ? "تم حفظ التوقيع الرقمي بنجاح" : "Digital signature saved",
      );
      queryClient.invalidateQueries({ queryKey: ["user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (e: any) {
      toast.error(
        e.message || (ar ? "فشل حفظ التوقيع" : "Failed to save signature"),
      );
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
      const res = await fetch(`/api/users/${user.id}/signature`, {
        method: "DELETE",
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.message || "Failed to delete signature");
      }
      setSignaturePreview(null);
      toast.success(
        ar ? "تم حذف التوقيع الرقمي بنجاح" : "Digital signature deleted",
      );
      queryClient.invalidateQueries({ queryKey: ["user-detail", userId] });
      queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
    } catch (e: any) {
      toast.error(
        e.message || (ar ? "فشل حذف التوقيع" : "Failed to delete signature"),
      );
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
        toast.success(
          ar
            ? "تم حفظ كافة تعديلات المستخدم بنجاح"
            : "User updated successfully",
        );
        setChangePassword(false);
        setNewPassword("");
        setConfirmPassword("");
        refetchUser();
      },
      onError: (err: any) => {
        toast.error(
          err.message || (ar ? "فشل حفظ التغييرات" : "Failed to save changes"),
        );
      },
    },
  });

  // Save All Changes
  const handleSaveAll = async () => {
    if (!user) return;

    // Password validation ONLY if user explicitly opted in to change password
    if (changePassword && newPassword.trim()) {
      const evalResult = evaluatePassword(newPassword.trim());
      if (evalResult.score < 2) {
        toast.error(
          ar
            ? "كلمة المرور ضعيفة جداً، يرجى اختيار كلمة مرور أقوى"
            : "Password is too weak",
        );
        return;
      }
      if (newPassword !== confirmPassword) {
        toast.error(
          ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match",
        );
        return;
      }
    }

    const payload: any = {
      name,
      email: email || null,
      phone: phone || null,
      nationalId: nationalId || null,
      jobTitle: jobTitle || null,
      roles: [primaryRole],
      status: isActive ? "ACTIVE" : "INACTIVE",
      propertyIds: selectedPropertyIds,
      propertyId: primaryPropertyId || selectedPropertyIds[0] || null,
    };

    if (changePassword && newPassword.trim()) {
      payload.password = newPassword.trim();
    }

    // Pure RBAC: explicit permissions are the sole source of truth.
    // If 0 permissions, send ["none"] to prevent fallback.
    payload.permissions = perms.size === 0 ? ["none"] : Array.from(perms);

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
        toast.success(
          ar ? "تم حذف حساب المستخدم بنجاح" : "User account deleted",
        );
        setLocation(buildNavHref("/users"));
      },
      onError: (err: any) => {
        toast.error(
          err.message || (ar ? "فشل حذف المستخدم" : "Failed to delete user"),
        );
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
    const parts = pKey.split(".");
    if (
      parts.length === 2 &&
      !perms.has(pKey) &&
      !actorCanGrant(parts[0], parts[1])
    ) {
      toast.error(
        ar
          ? "لا يمكنك منح صلاحية لا تملكها"
          : "Cannot grant unowned permission",
      );
      return;
    }
    setPerms((prev) => {
      const next = new Set(prev);
      next.has(pKey) ? next.delete(pKey) : next.add(pKey);
      return next;
    });
  };

  const toggleAllModule = (mod: string) => {
    const actions = (MODULE_ACTIONS as Record<string, Action[]>)[mod] || [];
    const allKeys = actions.map((act: any) => permKey(mod as any, act));
    const allEnabled = allKeys.every((k: any) => perms.has(k));

    setPerms((prev) => {
      const next = new Set(prev);
      allKeys.forEach((k: any) => {
        if (allEnabled) {
          next.delete(k);
        } else {
          const parts = k.split(".");
          if (parts.length === 2 && actorCanGrant(parts[0], parts[1])) {
            next.add(k);
          }
        }
      });
      return next;
    });
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
        if (allEnabled) {
          next.delete(k);
        } else {
          const parts = k.split(".");
          if (parts.length === 2 && actorCanGrant(parts[0], parts[1])) {
            next.add(k);
          }
        }
      });
      return next;
    });
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
        const matchMod =
          mod.toLowerCase().includes(q) ||
          modLabelAr.includes(q) ||
          modLabelEn.includes(q);
        if (matchMod) return true;
        return (MODULE_ACTIONS[mod] || []).some((act) => {
          const actAr = ACTION_LABELS[act]?.ar.toLowerCase() || "";
          const actEn = ACTION_LABELS[act]?.en.toLowerCase() || "";
          return (
            act.toLowerCase().includes(q) ||
            actAr.includes(q) ||
            actEn.includes(q)
          );
        });
      });
      if (filteredMods.length === 0) return null;
      return { ...group, modules: filteredMods };
    }).filter(Boolean);
  }, [selectedGroupFilter, permSearch, showOverridesOnly, diffStats]);

  // Fetch Activity Logs for this User (Audit Tab)
  const {
    data: auditLogsData,
    isLoading: isAuditLoading,
    refetch: refetchAudit,
  } = useQuery({
    queryKey: ["user-audit-logs", user?.username],
    queryFn: async () => {
      if (!user?.username) return [];
      const propId = contextProperties?.[0]?.id || 1;
      const res = await fetch(
        `/api/activity-logs?propertyId=${propId}&search=${encodeURIComponent(user.username)}&limit=30`,
      );
      if (!res.ok) return [];
      const data = await res.json();
      return Array.isArray(data) ? data : data.data || [];
    },
    enabled: activeTab === "audit" && !!user?.username,
  });
  const auditLogs = auditLogsData || [];
  // Pure lookups on constant role lists (safe before the loading/error early returns).
  const primaryRoleObj = ALL_ROLES.find((r) => r.value === primaryRole);
  const workflowRoleObj = WORKFLOW_ROLES.find((r) => r.value === jobTitle);
  return {
    id,
    setLocation,
    userId,
    language,
    ar,
    currentUser,
    isSystemAdmin,
    can,
    isAdmin,
    actorPerms,
    contextProperties,
    isSuperAdmin,
    buildNavHref,
    canGrantAnything,
    actorCanGrant,
    queryClient,
    searchParams,
    initialTabParam,
    validTabs,
    activeTab,
    setActiveTab,
    handleTabChange,
    user,
    isUserLoading,
    isUserError,
    refetchUser,
    allUsersRes,
    allUsers,
    propertiesRes,
    properties,
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
    selectedPropertyIds,
    setSelectedPropertyIds,
    primaryPropertyId,
    setPrimaryPropertyId,
    changePassword,
    setChangePassword,
    newPassword,
    setNewPassword,
    confirmPassword,
    setConfirmPassword,
    showPasswordText,
    setShowPasswordText,
    isUnlocking,
    setIsUnlocking,
    deleteConfirmOpen,
    setDeleteConfirmOpen,
    perms,
    setPerms,
    expandedModules,
    setExpandedModules,
    permSearch,
    setPermSearch,
    selectedGroupFilter,
    setSelectedGroupFilter,
    showOverridesOnly,
    setShowOverridesOnly,
    cloneSourceUserId,
    setCloneSourceUserId,
    simModule,
    setSimModule,
    simAction,
    setSimAction,
    showSimulator,
    setShowSimulator,
    signaturePreview,
    setSignaturePreview,
    isUploadingSig,
    setIsUploadingSig,
    isDeletingSig,
    setIsDeletingSig,
    sigFileInputRef,
    isLocked,
    lockoutRemainingMinutes,
    simActions,
    defaultPermsForRole,
    diffStats,
    isModuleOverridden,
    handleGeneratePassword,
    handleCopyCredentials,
    handleClonePermissions,
    simulatorResult,
    handleInstantUnlock,
    handleUploadSig,
    handleDeleteSig,
    updateMutation,
    handleSaveAll,
    deleteMutation,
    handleDeleteUser,
    togglePerm,
    toggleAllModule,
    toggleAllGroup,
    filteredGroups,
    auditLogsData,
    isAuditLoading,
    refetchAudit,
    auditLogs,
    primaryRoleObj,
    workflowRoleObj,
  };
}

export type UserDetailPageState = ReturnType<typeof useUserDetailPageState>;
