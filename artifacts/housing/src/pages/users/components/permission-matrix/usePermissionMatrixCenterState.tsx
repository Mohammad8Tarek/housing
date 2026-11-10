// State, effects and handlers of PermissionMatrixCenter (moved verbatim).
import { useState, useMemo, useEffect } from "react";
import {
  useUpdateUser,
  getListUsersQueryKey,
  getGetMeQueryKey,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { toast } from "sonner";
import {
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  MODULE_DESCRIPTIONS,
  ACTION_LABELS,
  PERMISSION_GROUPS,
  permKey,
  ROLE_DEFAULT_PERMISSIONS,
  type Module,
  type Action,
} from "@/lib/permissions";
import { usePermission } from "@/hooks/use-permission";
import { PermissionMatrixCenterProps, SYSTEM_ROLE_PRESETS } from "./PermissionMatrixCenter.constants";

export function usePermissionMatrixCenterState({
  users,
  selectedUserId,
  onSelectUser,
  properties,
}: PermissionMatrixCenterProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const { isSuperAdmin: actorIsSuperAdmin, perms: actorPerms, can: actorCan } = usePermission();

  const actorCanGrant = (mod: Module, act: Action) => {
    if (actorIsSuperAdmin || actorPerms.has("*")) return true;
    return actorCan(mod, act);
  };

  // Selected User state
  const [currentUserId, setCurrentUserId] = useState<number>(() => {
    if (selectedUserId && users.some((u) => u.id === selectedUserId)) {
      return selectedUserId;
    }
    return users[0]?.id ?? 0;
  });

  useEffect(() => {
    if (selectedUserId && users.some((u) => u.id === selectedUserId)) {
      setCurrentUserId(selectedUserId);
    }
  }, [selectedUserId, users]);

  const activeUser = useMemo(() => {
    return users.find((u) => u.id === currentUserId) || users[0] || null;
  }, [users, currentUserId]);

  const primaryRole = (activeUser?.roles?.[0] || "user").toLowerCase();

  // Role defaults for the active user
  const roleDefaults = useMemo<Set<string>>(() => {
    return new Set(ROLE_DEFAULT_PERMISSIONS[primaryRole] ?? []);
  }, [primaryRole]);

  const getInitialPerms = (userObj: any): Set<string> => {
    if (!userObj) return new Set();
    const explicit = (userObj.permissions as string[] | undefined) ?? [];
    if (explicit.length > 0) {
      if (explicit.length === 1 && explicit[0] === "none") return new Set();
      const normalized = explicit.map((p) => {
        let s = String(p).trim().toLowerCase();
        if (s.startsWith("employees.")) s = s.replace("employees.", "profiles.");
        if (s.startsWith("employees:")) s = s.replace("employees:", "profiles:");
        return s;
      });
      return new Set(normalized);
    }
    const isSuper = (userObj.roles || []).some((r: string) => String(r).toLowerCase() === "super_admin");
    if (isSuper) {
      return new Set(ROLE_DEFAULT_PERMISSIONS["super_admin"] || []);
    }
    return new Set();
  };

  const [perms, setPerms] = useState<Set<string>>(() => getInitialPerms(activeUser));
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedGroup, setSelectedGroup] = useState<string>("all");
  const [hasChanges, setHasChanges] = useState(false);
  const [viewMode, setViewMode] = useState<"cards" | "table">("cards");
  const [userPickerOpen, setUserPickerOpen] = useState(false);
  const [userSearchText, setUserSearchText] = useState("");
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  // When active user changes, reload permissions
  useEffect(() => {
    if (activeUser) {
      setPerms(getInitialPerms(activeUser));
      setHasChanges(false);
    }
  }, [activeUser?.id]);

  const updateMutation = useUpdateUser({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getListUsersQueryKey() });
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast.success(
          ar
            ? `تم تحديث صلاحيات ${activeUser?.username} بنجاح`
            : `Permissions updated for ${activeUser?.username}`,
        );
        setHasChanges(false);
      },
      onError: (e: any) =>
        toast.error(
          e.message ||
            (ar ? "فشل حفظ الصلاحيات" : "Failed to save permissions"),
        ),
    },
  });

  // Action search matching: checks English and Arabic labels & keys
  const matchesActionSearch = (action: Action, query: string): boolean => {
    if (!query) return false;
    const q = query.trim().toLowerCase();
    const en = (ACTION_LABELS[action]?.en || action).toLowerCase();
    const arLabel = (ACTION_LABELS[action]?.ar || "").toLowerCase();
    return en.includes(q) || arLabel.includes(q) || action.toLowerCase().includes(q);
  };

  // Toggle single action with dependency logic:
  // - Disabling view disables all actions for this module.
  // - Enabling any action enables view.
  const toggleAction = (m: Module, a: Action) => {
    const key = permKey(m, a);
    if (!actorCanGrant(m, a) && !perms.has(key)) {
      toast.error(
        ar
          ? "لا تمتلك هذه الصلاحية في حسابك لمنحها لمستخدم آخر"
          : "You do not possess this permission to grant it to another user",
      );
      return;
    }
    setPerms((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
        if (a === "view") {
          (MODULE_ACTIONS[m] ?? []).forEach((other) => {
            next.delete(permKey(m, other));
          });
        }
      } else {
        next.add(key);
        if (a !== "view" && (MODULE_ACTIONS[m] ?? []).includes("view") && actorCanGrant(m, "view")) {
          next.add(permKey(m, "view"));
        }
      }
      return next;
    });
    setHasChanges(true);
  };

  // Master switch for an entire module
  const toggleModuleMaster = (m: Module, shouldEnable: boolean) => {
    const modulePerms = MODULE_ACTIONS[m] ?? [];
    setPerms((prev) => {
      const next = new Set(prev);
      if (shouldEnable) {
        modulePerms.forEach((a) => {
          if (actorCanGrant(m, a)) {
            next.add(permKey(m, a));
          }
        });
      } else {
        modulePerms.forEach((a) => next.delete(permKey(m, a)));
      }
      return next;
    });
    setHasChanges(true);
  };

  // Category-level bulk action
  const toggleCategoryGroup = (groupId: string, shouldEnable: boolean) => {
    const group = PERMISSION_GROUPS.find((g) => g.id === groupId);
    if (!group) return;

    setPerms((prev) => {
      const next = new Set(prev);
      group.modules.forEach((m) => {
        const acts = MODULE_ACTIONS[m] ?? [];
        acts.forEach((a) => {
          if (shouldEnable) {
            if (actorCanGrant(m, a)) {
              next.add(permKey(m, a));
            }
          } else {
            next.delete(permKey(m, a));
          }
        });
      });
      return next;
    });
    setHasChanges(true);

    toast.info(
      shouldEnable
        ? ar
          ? `تم تفعيل كافة صلاحيات ${group.label.ar} المتاحة لك`
          : `Selected all permissions you possess in ${group.label.en}`
        : ar
        ? `تم مسح صلاحيات ${group.label.ar}`
        : `Cleared all permissions in ${group.label.en}`,
    );
  };

  // Bulk column toggle for Spreadsheet Table View (e.g. toggle View column across all visible modules)
  const toggleColumnAction = (action: Action) => {
    // Find all visible modules that support this action
    const candidateModules = visibleModules.filter((m) =>
      (MODULE_ACTIONS[m] ?? []).includes(action),
    );
    if (candidateModules.length === 0) return;

    // Check if all are currently checked
    const allEnabled = candidateModules.every((m) =>
      perms.has(permKey(m, action)),
    );

    setPerms((prev) => {
      const next = new Set(prev);
      if (allEnabled) {
        // Disable action across candidate modules
        candidateModules.forEach((m) => {
          next.delete(permKey(m, action));
          if (action === "view") {
            (MODULE_ACTIONS[m] ?? []).forEach((other) => {
              next.delete(permKey(m, other));
            });
          }
        });
      } else {
        // Enable action across candidate modules (only where actor has permission)
        candidateModules.forEach((m) => {
          if (actorCanGrant(m, action)) {
            next.add(permKey(m, action));
            if (action !== "view" && (MODULE_ACTIONS[m] ?? []).includes("view") && actorCanGrant(m, "view")) {
              next.add(permKey(m, "view"));
            }
          }
        });
      }
      return next;
    });

    setHasChanges(true);
    toast.info(
      allEnabled
        ? ar
          ? `تم تعطيل عملية (${action}) عبر الموديولات الظاهرة`
          : `Disabled ${action} across visible modules`
        : ar
        ? `تم تفعيل عملية (${action}) عبر الموديولات المتاحة لك`
        : `Enabled ${action} across accessible visible modules`,
    );
  };

  const applyRoleDefaults = (roleKey: string) => {
    const defaults = ROLE_DEFAULT_PERMISSIONS[roleKey] ?? [];
    const filtered = defaults.filter((p) => {
      const [mod, act] = p.split(".");
      return actorCanGrant(mod as Module, act as Action);
    });
    setPerms(new Set(filtered));
    setHasChanges(true);
    const preset = SYSTEM_ROLE_PRESETS.find((r) => r.value === roleKey);
    if (filtered.length < defaults.length) {
      toast.warning(
        ar
          ? `تم تطبيق الصلاحيات المتاحة لك فقط (${filtered.length} من ${defaults.length}) من قالب: ${preset ? preset.labelAr : roleKey}`
          : `Applied only permissions you possess (${filtered.length}/${defaults.length}) from role preset: ${preset ? preset.labelEn : roleKey}`,
      );
    } else {
      toast.info(
        ar
          ? `تم تطبيق قالب الدور: ${preset ? preset.labelAr : roleKey}`
          : `Applied role preset: ${preset ? preset.labelEn : roleKey}`,
      );
    }
  };

  const selectAll = () => {
    setPerms(
      new Set(
        MODULES.flatMap((m) =>
          (MODULE_ACTIONS[m] ?? [])
            .filter((a) => actorCanGrant(m, a))
            .map((a) => permKey(m, a)),
        ),
      ),
    );
    setHasChanges(true);
  };

  const deselectAll = () => {
    setPerms(new Set());
    setHasChanges(true);
  };

  const applyReadOnlyAll = () => {
    const readOnly = new Set<string>();
    MODULES.forEach((m) => {
      if ((MODULE_ACTIONS[m] ?? []).includes("view") && actorCanGrant(m, "view")) {
        readOnly.add(permKey(m, "view"));
      }
    });
    setPerms(readOnly);
    setHasChanges(true);
    toast.info(ar ? "تم تطبيق صلاحيات العرض فقط لكافة الأقسام المتاحة لك" : "Applied Read-Only to accessible modules");
  };

  const resetToStored = () => {
    if (activeUser) {
      setPerms(getInitialPerms(activeUser));
      setHasChanges(false);
      toast.info(ar ? "تمت استعادة الصلاحيات الأصلية المحفوظة" : "Reset to stored permissions");
    }
  };

  const revertToRoleDefaults = () => {
    const filteredDefaults = Array.from(roleDefaults).filter((p) => {
      const [mod, act] = p.split(".");
      return actorCanGrant(mod as Module, act as Action);
    });
    setPerms(new Set(filteredDefaults));
    setHasChanges(true);
    toast.info(
      ar
        ? "تم تطبيق قالب صلاحيات الدور المحدد ضمن حدود صلاحياتك (اضغط حفظ لتأكيدها)"
        : "Applied role preset template within your permission limits (click Save to confirm)",
    );
  };

  // Export permissions summary as JSON
  const exportPermissionsSummary = () => {
    if (!activeUser) return;
    const data = {
      exportedAt: new Date().toISOString(),
      user: {
        id: activeUser.id,
        username: activeUser.username,
        email: activeUser.email,
        roles: activeUser.roles,
        jobTitle: activeUser.jobTitle,
      },
      stats: {
        totalPossible,
        activeCount: perms.size,
        customGranted: diffStats.customGranted,
        revoked: diffStats.revoked,
        isExactRoleMatch: diffStats.isExactRoleMatch,
      },
      grantedPermissions: Array.from(perms).sort(),
    };

    const jsonStr = JSON.stringify(data, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `permissions_${activeUser.username}_${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success(
      ar
        ? `تم تصدير ملخص صلاحيات ${activeUser.username}`
        : `Exported permission summary for ${activeUser.username}`,
    );
  };

  const save = () => {
    if (!activeUser) return;
    const permissionsPayload = perms.size === 0 ? ["none"] : Array.from(perms);

    updateMutation.mutate({
      id: activeUser.id,
      data: { permissions: permissionsPayload },
    });
  };

  const totalPossible = useMemo(() => {
    return MODULES.reduce(
      (sum, m) => sum + (MODULE_ACTIONS[m] ?? []).length,
      0,
    );
  }, []);

  // Compute diff counters
  const diffStats = useMemo(() => {
    let customGranted = 0;
    let revoked = 0;

    for (const p of perms) {
      if (!roleDefaults.has(p)) {
        customGranted++;
      }
    }

    for (const rd of roleDefaults) {
      if (!perms.has(rd)) {
        revoked++;
      }
    }

    const isExactRoleMatch =
      perms.size === roleDefaults.size &&
      Array.from(perms).every((p) => roleDefaults.has(p));

    return {
      customGranted,
      revoked,
      isExactRoleMatch,
    };
  }, [perms, roleDefaults]);

  // Action badge color
  const getActionColor = (action: string) => {
    switch (action) {
      case "view":
        return "bg-blue-100 text-blue-700 dark:bg-blue-950/40 dark:text-blue-300 border-blue-200 dark:border-blue-800/50";
      case "create":
        return "bg-emerald-100 text-emerald-700 dark:bg-emerald-950/40 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50";
      case "edit":
        return "bg-amber-100 text-amber-700 dark:bg-amber-950/40 dark:text-amber-300 border-amber-200 dark:border-amber-800/50";
      case "delete":
      case "bulk_delete":
        return "bg-rose-100 text-rose-700 dark:bg-rose-950/40 dark:text-rose-300 border-rose-200 dark:border-rose-800/50";
      case "approve":
        return "bg-purple-100 text-purple-700 dark:bg-purple-950/40 dark:text-purple-300 border-purple-200 dark:border-purple-800/50";
      case "export":
      case "bulk_export":
        return "bg-cyan-100 text-cyan-700 dark:bg-cyan-950/40 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50";
      default:
        return "bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-200 dark:border-slate-700/50";
    }
  };

  // Action-aware search filtering
  const filteredGroups = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return PERMISSION_GROUPS.map((group) => {
      const isGroupSelected =
        selectedGroup === "all" || selectedGroup === group.id;
      if (!isGroupSelected) return null;

      const matchingModules = group.modules.filter((m) => {
        if (!query) return true;
        const enLabel = (MODULE_LABELS[m]?.en || m).toLowerCase();
        const arLabel = (MODULE_LABELS[m]?.ar || "").toLowerCase();
        const descAr = (MODULE_DESCRIPTIONS[m]?.ar || "").toLowerCase();
        const descEn = (MODULE_DESCRIPTIONS[m]?.en || "").toLowerCase();
        const modKey = m.toLowerCase();

        if (
          enLabel.includes(query) ||
          arLabel.includes(query) ||
          descAr.includes(query) ||
          descEn.includes(query) ||
          modKey.includes(query)
        ) {
          return true;
        }

        const acts = MODULE_ACTIONS[m] ?? [];
        return acts.some((a) => matchesActionSearch(a, query));
      });

      if (matchingModules.length === 0) return null;

      return {
        ...group,
        modules: matchingModules,
      };
    }).filter(Boolean) as typeof PERMISSION_GROUPS;
  }, [searchQuery, selectedGroup]);

  // List of all currently visible modules
  const visibleModules = useMemo(() => {
    return filteredGroups.flatMap((g) => g.modules);
  }, [filteredGroups]);

  // Filtered users for combobox
  const filteredUsersList = useMemo(() => {
    if (!userSearchText.trim()) return users;
    const q = userSearchText.trim().toLowerCase();
    return users.filter((u) => {
      const username = (u.username || "").toLowerCase();
      const email = (u.email || "").toLowerCase();
      const role = (u.roles?.[0] || "").toLowerCase();
      const job = (u.jobTitle || "").toLowerCase();
      return (
        username.includes(q) ||
        email.includes(q) ||
        role.includes(q) ||
        job.includes(q)
      );
    });
  }, [users, userSearchText]);

  const moduleStatus = (m: Module) => {
    const modulePerms = MODULE_ACTIONS[m] ?? [];
    const checked = modulePerms.filter((a) => perms.has(permKey(m, a))).length;
    const hasView = perms.has(permKey(m, "view"));
    const isMasterOn = checked > 0;
    const isAllOn = checked === modulePerms.length;

    return {
      checked,
      total: modulePerms.length,
      hasView,
      isMasterOn,
      isAllOn,
    };
  };

  const groupStats = (groupModules: Module[]) => {
    let total = 0;
    let checked = 0;
    groupModules.forEach((m) => {
      const acts = MODULE_ACTIONS[m] ?? [];
      total += acts.length;
      checked += acts.filter((a) => perms.has(permKey(m, a))).length;
    });
    return {
      checked,
      total,
      pct: total > 0 ? Math.round((checked / total) * 100) : 0,
    };
  };

  const toggleGroupCollapse = (groupId: string) => {
    setCollapsedGroups((prev) => ({
      ...prev,
      [groupId]: !prev[groupId],
    }));
  };
  return {
    users,
    selectedUserId,
    onSelectUser,
    properties,
    language,
    ar,
    queryClient,
    actorIsSuperAdmin,
    actorPerms,
    actorCan,
    actorCanGrant,
    currentUserId,
    setCurrentUserId,
    activeUser,
    primaryRole,
    roleDefaults,
    getInitialPerms,
    perms,
    setPerms,
    searchQuery,
    setSearchQuery,
    selectedGroup,
    setSelectedGroup,
    hasChanges,
    setHasChanges,
    viewMode,
    setViewMode,
    userPickerOpen,
    setUserPickerOpen,
    userSearchText,
    setUserSearchText,
    collapsedGroups,
    setCollapsedGroups,
    updateMutation,
    matchesActionSearch,
    toggleAction,
    toggleModuleMaster,
    toggleCategoryGroup,
    toggleColumnAction,
    applyRoleDefaults,
    selectAll,
    deselectAll,
    applyReadOnlyAll,
    resetToStored,
    revertToRoleDefaults,
    exportPermissionsSummary,
    save,
    totalPossible,
    diffStats,
    getActionColor,
    filteredGroups,
    visibleModules,
    filteredUsersList,
    moduleStatus,
    groupStats,
    toggleGroupCollapse,
  };
}

export type PermissionMatrixCenterState = ReturnType<typeof usePermissionMatrixCenterState>;

// Values derived after PermissionMatrixCenter's loading/empty early returns (moved verbatim); the
// narrowed inputs (activeUser) are passed in non-null.
export function buildPermissionMatrixCenterView(s: PermissionMatrixCenterState, activeUser: NonNullable<PermissionMatrixCenterState["activeUser"]>) {
  const {  } = s;


  const isSuper = (activeUser.roles || []).some(
    (r: string) => r.toLowerCase() === "super_admin",
  );
  return {
    activeUser,
    isSuper,
  };
}

export type PermissionMatrixCenterView = ReturnType<typeof buildPermissionMatrixCenterView>;
