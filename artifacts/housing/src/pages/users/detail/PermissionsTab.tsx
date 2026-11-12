// User detail > Access & permissions tab.
import { RoleTemplateLink } from "./RoleTemplateLink";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import {
  ShieldCheck,
  Lock,
  Copy,
  Sparkles,
  SlidersHorizontal,
  Zap,
  ChevronDown,
  ChevronUp,
  Search,
  CheckCircle2,
  XCircle,
} from "lucide-react";
import {
  MODULES,
  MODULE_ACTIONS,
  MODULE_LABELS,
  ACTION_LABELS,
  PERMISSION_GROUPS,
  permKey,
  type Action,
} from "@/lib/permissions";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import type { UserDetailPageState } from "./useUserDetailPageState";

export function renderPermissionsTab(s: UserDetailPageState) {
  const {
    ar,
    actorCanGrant,
    user,
    refetchUser,
    allUsers,
    primaryRole,
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
    simActions,
    defaultPermsForRole,
    diffStats,
    handleClonePermissions,
    simulatorResult,
    togglePerm,
    toggleAllModule,
    toggleAllGroup,
    filteredGroups,
  } = s;
  return (
    <div className="space-y-6">
      {/* Role template link (permissions follow the template) */}
      {user && (
        <RoleTemplateLink user={user} ar={ar} onChanged={() => refetchUser()} />
      )}

      {/* Pure RBAC Fine-Grained Permissions Banner */}
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border bg-gradient-to-r from-card to-muted/30">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center text-white bg-primary">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h3 className="font-bold text-sm">
              {ar
                ? "صلاحيات مباشرة ومستقلة (Pure Fine-Grained RBAC)"
                : "Direct Fine-Grained Permissions"}
            </h3>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "الصلاحيات منفصلة تماماً عن الدور الوظيفي. يمكنك إضافة أو سلب أي صلاحية بحرية كاملة وفورية."
                : "Permissions are completely decoupled from roles. Adding or revoking any permission takes immediate effect."}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setPerms(new Set(defaultPermsForRole));
              toast.info(
                ar
                  ? `تم تطبيق قالب صلاحيات دور (${primaryRole})`
                  : `Applied role template (${primaryRole})`,
              );
            }}
            className="text-xs h-8 px-3"
          >
            <Sparkles className="w-3.5 h-3.5 mr-1" />
            {ar ? "تطبيق قالب الدور الافتراضي" : "Apply Role Template"}
          </Button>
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
                {showSimulator ? (ar ? "إخفاء" : "Hide") : ar ? "فتح" : "Open"}
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <p className="text-xs text-muted-foreground">
              {ar
                ? "اختبر فورياً هل يمتلك هذا المستخدم تصريحاً لتنفيذ إجراء معين."
                : "Instantly test if this user can perform an action."}
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
                      {simActions.map((act: any) => (
                        <SelectItem key={act} value={act} className="text-xs">
                          {ar
                            ? (ACTION_LABELS as Record<string, any>)[act]?.ar ||
                              act
                            : (ACTION_LABELS as Record<string, any>)[act]?.en ||
                              act}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {simulatorResult && (
                  <div
                    className={cn(
                      "p-2 rounded-lg text-xs font-semibold flex items-center gap-2",
                      simulatorResult.allowed
                        ? "bg-emerald-50 text-emerald-800 border border-emerald-200 dark:bg-emerald-950/30 dark:text-emerald-300"
                        : "bg-rose-50 text-rose-800 border border-rose-200 dark:bg-rose-950/30 dark:text-rose-300",
                    )}
                  >
                    {simulatorResult.allowed ? (
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                    ) : (
                      <XCircle className="w-3.5 h-3.5 text-rose-600 shrink-0" />
                    )}
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
              {ar
                ? "نسخ الصلاحيات بالكامل من مستخدم آخر في النظام."
                : "Copy full matrix from another user."}
            </p>
            <div className="flex gap-2">
              <Select
                value={cloneSourceUserId}
                onValueChange={setCloneSourceUserId}
              >
                <SelectTrigger className="h-8 text-xs flex-1">
                  <SelectValue
                    placeholder={ar ? "اختر مستخدم..." : "Select user..."}
                  />
                </SelectTrigger>
                <SelectContent>
                  {allUsers
                    .filter((u: any) => u.id !== user.id)
                    .map((u: any) => (
                      <SelectItem
                        key={u.id}
                        value={String(u.id)}
                        className="text-xs"
                      >
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
                className={cn(
                  "text-xs font-bold px-2 py-0.5 rounded border transition-colors",
                  showOverridesOnly
                    ? "bg-[#C9A24D] text-white border-[#C9A24D]"
                    : "border-border hover:bg-muted text-muted-foreground",
                )}
              >
                {showOverridesOnly
                  ? ar
                    ? "إظهار الكل"
                    : "Show All"
                  : ar
                    ? "الاستثناءات فقط"
                    : "Overrides Only"}
              </button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-1 space-y-2">
            <div className="flex items-center gap-2">
              <Badge
                variant="outline"
                className="text-xs border-emerald-500/30 text-emerald-700 dark:text-emerald-400 bg-emerald-50/50"
              >
                +{diffStats.added} {ar ? "صلاحيات إضافية" : "granted"}
              </Badge>
              <Badge
                variant="outline"
                className="text-xs border-rose-500/30 text-rose-700 dark:text-rose-400 bg-rose-50/50"
              >
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
            placeholder={
              ar ? "بحث في الصلاحيات والإجراءات..." : "Search capabilities..."
            }
            className="ps-9 h-9 text-xs"
          />
        </div>

        <div className="flex items-center gap-1 overflow-x-auto pb-1">
          <button
            onClick={() => setSelectedGroupFilter("all")}
            className={cn(
              "px-2.5 py-1 text-xs font-bold rounded-lg border transition-all whitespace-nowrap",
              selectedGroupFilter === "all"
                ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                : "border-border text-muted-foreground hover:bg-muted",
            )}
          >
            {ar ? "كافة المجموعات" : "All Groups"}
          </button>
          {PERMISSION_GROUPS.map((g) => (
            <button
              key={g.id}
              onClick={() => setSelectedGroupFilter(g.id)}
              className={cn(
                "px-2.5 py-1 text-xs font-bold rounded-lg border transition-all whitespace-nowrap",
                selectedGroupFilter === g.id
                  ? "bg-[#0F2A44] text-white border-[#0F2A44]"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
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
                <span className="text-[11px] text-muted-foreground">
                  ({group.modules.length} {ar ? "موديول" : "modules"})
                </span>
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
                const actions =
                  (MODULE_ACTIONS as Record<string, Action[]>)[mod] || [];
                const modKeys = actions.map((act: any) =>
                  permKey(mod as any, act),
                );
                const enabledCount = modKeys.filter((k: any) =>
                  perms.has(k),
                ).length;
                const isAllEnabled =
                  enabledCount === actions.length && actions.length > 0;
                const isExpanded = expandedModules[mod] ?? true;

                return (
                  <Card
                    key={mod}
                    className={cn(
                      "border transition-all",
                      isAllEnabled
                        ? "border-primary/40 bg-card"
                        : "border-border/70",
                    )}
                  >
                    <div className="p-3.5 flex items-center justify-between border-b bg-muted/20">
                      <div className="flex items-center gap-2.5">
                        <Checkbox
                          checked={isAllEnabled}
                          onCheckedChange={() => toggleAllModule(mod)}
                          title={
                            ar
                              ? "تحديد كافة إجراءات الموديول"
                              : "Toggle all actions"
                          }
                        />
                        <div>
                          <span className="font-bold text-sm text-foreground">
                            {ar
                              ? (MODULE_LABELS as Record<string, any>)[mod]?.ar
                              : (MODULE_LABELS as Record<string, any>)[mod]?.en}
                          </span>
                          <span className="text-xs text-muted-foreground font-mono ms-2 capitalize">
                            ({mod})
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <Badge
                          variant={enabledCount > 0 ? "default" : "secondary"}
                          className="text-[10px] px-1.5 py-0 font-semibold"
                        >
                          {enabledCount}/{actions.length}
                        </Badge>
                        <button
                          type="button"
                          onClick={() =>
                            setExpandedModules((prev) => ({
                              ...prev,
                              [mod]: !isExpanded,
                            }))
                          }
                          className="text-muted-foreground hover:text-foreground p-1"
                        >
                          {isExpanded ? (
                            <ChevronUp className="w-3.5 h-3.5" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5" />
                          )}
                        </button>
                      </div>
                    </div>

                    {isExpanded && (
                      <div className="p-3.5 grid grid-cols-2 gap-2">
                        {actions.map((act: any) => {
                          const pKey = permKey(mod as any, act);
                          const isChecked = perms.has(pKey);
                          const isAdded = diffStats.addedKeys?.has(pKey);
                          const isRevoked = diffStats.revokedKeys?.has(pKey);

                          const canGrant = actorCanGrant(mod, act);
                          return (
                            <label
                              key={act}
                              className={cn(
                                "flex items-center gap-2 p-2 rounded-lg border text-xs font-medium transition-colors",
                                !canGrant && !isChecked
                                  ? "opacity-50 cursor-not-allowed bg-muted/20"
                                  : "cursor-pointer",
                                isChecked
                                  ? "bg-primary/5 border-primary/20 text-foreground"
                                  : "border-border/50 text-muted-foreground hover:bg-muted/30",
                                isAdded &&
                                  "border-emerald-500/50 bg-emerald-500/10 text-emerald-800 dark:text-emerald-300",
                                isRevoked &&
                                  "border-rose-500/50 bg-rose-500/10 text-rose-800 dark:text-rose-300",
                              )}
                            >
                              <Checkbox
                                checked={isChecked}
                                disabled={!canGrant && !isChecked}
                                onCheckedChange={() => togglePerm(pKey)}
                              />
                              <span className="truncate flex-1 flex items-center gap-1">
                                {!canGrant && (
                                  <Lock className="w-3 h-3 text-amber-500 shrink-0" />
                                )}
                                <span>
                                  {ar
                                    ? (ACTION_LABELS as Record<string, any>)[
                                        act
                                      ]?.ar || act
                                    : (ACTION_LABELS as Record<string, any>)[
                                        act
                                      ]?.en || act}
                                </span>
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
  );
}
