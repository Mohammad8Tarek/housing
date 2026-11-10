// Permissions as module cards.
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, X, Search, Lock, Sparkles, Eye, Sliders, Layers, FolderLock, CheckCheck, ChevronDown, ChevronUp, MinusCircle, Shield } from "lucide-react";
import { MODULE_ACTIONS, MODULE_LABELS, MODULE_DESCRIPTIONS, ACTION_LABELS, permKey } from "@/lib/permissions";
import type { PermissionMatrixCenterState, PermissionMatrixCenterView } from "./usePermissionMatrixCenterState";

export function renderCardsView(s: PermissionMatrixCenterState, v: PermissionMatrixCenterView) {
  const { ar, actorCanGrant, primaryRole, roleDefaults, perms, searchQuery, collapsedGroups, matchesActionSearch, toggleAction, toggleModuleMaster, toggleCategoryGroup, getActionColor, filteredGroups, moduleStatus, groupStats, toggleGroupCollapse } = s;
  return (
<div className="space-y-8">
            {filteredGroups.length === 0 ? (
              <div className="p-16 text-center rounded-3xl border bg-card">
                <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mx-auto mb-3">
                  <Search className="w-7 h-7 text-muted-foreground" />
                </div>
                <h3 className="text-lg font-bold text-foreground">
                  {ar ? "لا توجد نتائج مطابقة لبحثك" : "No matching modules or actions found"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar ? "جرب البحث باسم صفحة أخرى أو إزالة الفلتر" : "Try a different search query"}
                </p>
              </div>
            ) : (
              filteredGroups.map((group) => {
                const gStats = groupStats(group.modules);
                const isCollapsed = Boolean(collapsedGroups[group.id]);

                return (
                  <section
                    key={group.id}
                    className="space-y-3 rounded-3xl border bg-card/60 p-5 shadow-xs transition-all"
                  >
                    {/* Domain Category Header */}
                    <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 border-b pb-3">
                      <div className="flex items-center gap-2.5">
                        <button
                          type="button"
                          onClick={() => toggleGroupCollapse(group.id)}
                          className="p-1 rounded-lg hover:bg-muted text-muted-foreground transition-colors"
                          title={isCollapsed ? (ar ? "توسيع" : "Expand") : ar ? "طي" : "Collapse"}
                        >
                          {isCollapsed ? (
                            <ChevronDown className="w-4 h-4" />
                          ) : (
                            <ChevronUp className="w-4 h-4" />
                          )}
                        </button>
                        <Layers className="w-5 h-5 text-[#C9A24D]" />
                        <div>
                          <div className="flex items-center gap-2">
                            <h3 className="text-base font-bold text-foreground">
                              {ar ? group.label.ar : group.label.en}
                            </h3>
                            <Badge variant="outline" className="text-xs font-semibold">
                              {gStats.checked}/{gStats.total} ({gStats.pct}%)
                            </Badge>
                          </div>
                          <span className="text-xs text-muted-foreground hidden sm:inline">
                            {ar ? group.description.ar : group.description.en}
                          </span>
                        </div>
                      </div>

                      {/* Group Bulk Actions */}
                      <div className="flex items-center gap-2 self-end sm:self-auto">
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-emerald-600 hover:text-emerald-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/40"
                          onClick={() => toggleCategoryGroup(group.id, true)}
                        >
                          <CheckCheck className="w-3.5 h-3.5 mr-1" />
                          {ar ? "تحديد القسم" : "Select Group"}
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          className="h-8 text-xs font-semibold text-rose-600 hover:text-rose-700 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          onClick={() => toggleCategoryGroup(group.id, false)}
                        >
                          <X className="w-3.5 h-3.5 mr-1" />
                          {ar ? "إلغاء القسم" : "Clear Group"}
                        </Button>
                      </div>
                    </div>

                    {/* Modules Grid */}
                    {!isCollapsed && (
                      <div className="grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-4 pt-1">
                        {group.modules.map((m) => {
                          const modulePerms = MODULE_ACTIONS[m] ?? [];
                          const status = moduleStatus(m);

                          return (
                            <div
                              key={m}
                              className={`rounded-3xl border transition-all duration-200 overflow-hidden flex flex-col justify-between ${
                                !status.isMasterOn
                                  ? "bg-muted/15 border-border/60 opacity-80"
                                  : "bg-card border-border shadow-xs hover:shadow-md"
                              }`}
                            >
                              {/* Card Header */}
                              <div
                                className={`p-4 border-b ${
                                  !status.isMasterOn
                                    ? "bg-muted/30"
                                    : status.isAllOn
                                    ? "bg-emerald-500/5 dark:bg-emerald-500/10 border-emerald-500/20"
                                    : "bg-primary/5 border-primary/15"
                                }`}
                              >
                                <div className="flex items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0">
                                    <div
                                      className={`w-10 h-10 rounded-2xl flex items-center justify-center flex-shrink-0 mt-0.5 ${
                                        !status.isMasterOn
                                          ? "bg-slate-200 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                                          : "bg-card shadow-xs border text-primary"
                                      }`}
                                    >
                                      {!status.isMasterOn ? (
                                        <Lock className="w-5 h-5" />
                                      ) : (
                                        <Sliders className="w-5 h-5" />
                                      )}
                                    </div>
                                    <div className="min-w-0">
                                      <h4 className="font-bold text-sm sm:text-base text-foreground truncate">
                                        {ar ? MODULE_LABELS[m]?.ar : MODULE_LABELS[m]?.en}
                                      </h4>
                                      <p className="text-xs text-muted-foreground line-clamp-2 mt-0.5">
                                        {ar
                                          ? MODULE_DESCRIPTIONS[m]?.ar
                                          : MODULE_DESCRIPTIONS[m]?.en}
                                      </p>
                                    </div>
                                  </div>

                                  {/* Master Switch */}
                                  <div className="flex flex-col items-end gap-1 flex-shrink-0">
                                    <Switch
                                      checked={status.isMasterOn}
                                      onCheckedChange={(val) => toggleModuleMaster(m, val)}
                                      className="data-[state=checked]:bg-emerald-600 scale-110"
                                      title={ar ? "تفعيل أو إغلاق الموديول بالكامل" : "Toggle module"}
                                    />
                                    <span className="text-[10px] font-bold text-muted-foreground uppercase">
                                      {status.isMasterOn
                                        ? ar
                                          ? "مفعل"
                                          : "Enabled"
                                        : ar
                                        ? "مغلق"
                                        : "Disabled"}
                                    </span>
                                  </div>
                                </div>

                                {/* Status Badge */}
                                <div className="mt-3 flex items-center justify-between">
                                  {!status.isMasterOn ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[11px] py-0.5 px-2 font-bold border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-1"
                                    >
                                      <Lock className="w-3 h-3" />
                                      <span>{ar ? "مغلق تماماً (غير مرئي للمستخدم)" : "Fully Blocked (Hidden)"}</span>
                                    </Badge>
                                  ) : status.isAllOn ? (
                                    <Badge
                                      variant="outline"
                                      className="text-[11px] py-0.5 px-2 font-bold border-emerald-300 dark:border-emerald-900 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                                    >
                                      <Check className="w-3 h-3" />
                                      <span>{ar ? "وصول كامل لكافة العمليات" : "Full Access"} ({status.checked}/{status.total})</span>
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[11px] py-0.5 px-2 font-bold border-blue-300 dark:border-blue-900 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center gap-1"
                                    >
                                      <Eye className="w-3 h-3" />
                                      <span>{ar ? "وصول مخصص" : "Custom Access"} ({status.checked}/{status.total})</span>
                                    </Badge>
                                  )}

                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {m}
                                  </span>
                                </div>
                              </div>

                              {/* Card Body: Actions List */}
                              <div className="p-3.5 flex-1">
                                {!status.isMasterOn ? (
                                  <div className="h-full min-h-[90px] p-3 rounded-2xl bg-muted/30 border border-dashed border-border/70 flex flex-col items-center justify-center text-center gap-2">
                                    <FolderLock className="w-6 h-6 text-rose-500/80" />
                                    <p className="text-xs text-muted-foreground max-w-xs">
                                      {ar
                                        ? "تم إغلاق هذه الصفحة بالكامل. لن تظهر في القائمة الجانبية ولن يتمكن المستخدم من دخولها."
                                        : "This page is blocked. It will not appear in the sidebar or via direct URL."}
                                    </p>
                                    <Button
                                      type="button"
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs font-bold text-primary hover:text-primary/90 mt-1"
                                      onClick={() => toggleModuleMaster(m, true)}
                                    >
                                      {ar ? "فتح هذه الصفحة" : "Enable Page"}
                                    </Button>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                    {modulePerms.map((a) => {
                                      const key = permKey(m, a);
                                      const isChecked = perms.has(key);
                                      const isViewAction = a === "view";
                                      const canGrant = actorCanGrant(m, a);
                                      const isActionDisabled = (!isViewAction && !status.hasView) || !canGrant;
                                      const isRoleDefault = roleDefaults.has(key);
                                      const isActionMatch = matchesActionSearch(a, searchQuery);

                                      // Visual state badges
                                      let statusBadge = null;
                                      let tooltipText = "";

                                      if (!canGrant) {
                                        statusBadge = (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-bold border-amber-300 dark:border-amber-900 bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 flex items-center gap-0.5"
                                          >
                                            <Lock className="w-2.5 h-2.5 text-amber-600" />
                                            <span>{ar ? "غير متاحة لك" : "Unowned"}</span>
                                          </Badge>
                                        );
                                        tooltipText = ar
                                          ? "لا تمتلك هذه الصلاحية في حسابك لمنحها لمستخدم آخر"
                                          : "You do not possess this permission to grant it";
                                      } else if (isChecked && isRoleDefault) {
                                        statusBadge = (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-semibold border-blue-300 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex items-center gap-0.5"
                                          >
                                            <Shield className="w-2.5 h-2.5 text-blue-500" />
                                            <span>{ar ? "افتراضي للدور" : "Role Default"}</span>
                                          </Badge>
                                        );
                                        tooltipText = ar
                                          ? `ممنوحة تلقائياً عبر دور (${primaryRole})`
                                          : `Granted by default by role (${primaryRole})`;
                                      } else if (isChecked && !isRoleDefault) {
                                        statusBadge = (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-bold border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 flex items-center gap-0.5"
                                          >
                                            <Sparkles className="w-2.5 h-2.5 text-emerald-600" />
                                            <span>{ar ? "+ مخصص" : "+ Custom"}</span>
                                          </Badge>
                                        );
                                        tooltipText = ar
                                          ? "صلاحية استثنائية مخصصة لهذا المستخدم"
                                          : "Custom grant override for this user";
                                      } else if (!isChecked && isRoleDefault) {
                                        statusBadge = (
                                          <Badge
                                            variant="outline"
                                            className="text-[9px] py-0 px-1 font-bold border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 flex items-center gap-0.5"
                                          >
                                            <MinusCircle className="w-2.5 h-2.5 text-rose-500" />
                                            <span>{ar ? "- ملغي" : "- Revoked"}</span>
                                          </Badge>
                                        );
                                        tooltipText = ar
                                          ? `ممنوحة عادة عبر دور (${primaryRole}) ولكن تم إلغاؤها`
                                          : `Normally included in role (${primaryRole}), but revoked`;
                                      }

                                      return (
                                        <Tooltip key={a}>
                                          <TooltipTrigger asChild>
                                            <div
                                              onClick={() => {
                                                if (!isActionDisabled) toggleAction(m, a);
                                              }}
                                              className={`p-2 rounded-xl border transition-all flex items-center justify-between gap-2 select-none ${
                                                isActionMatch
                                                  ? "ring-2 ring-[#C9A24D] bg-[#C9A24D]/10"
                                                  : ""
                                              } ${
                                                isActionDisabled
                                                  ? "opacity-40 cursor-not-allowed bg-muted/20 border-border/40"
                                                  : isChecked
                                                  ? "bg-primary/5 border-primary/25 cursor-pointer hover:bg-primary/10 shadow-2xs"
                                                  : "bg-card hover:bg-muted/50 cursor-pointer border-border/70"
                                              }`}
                                            >
                                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                                <Badge
                                                  variant="outline"
                                                  className={`capitalize text-[9px] px-1.5 py-0 font-bold tracking-wider flex-shrink-0 ${getActionColor(
                                                    a,
                                                  )}`}
                                                >
                                                  {a}
                                                </Badge>
                                                <div className="min-w-0 flex-1">
                                                  <div className="text-xs font-bold text-foreground/90 truncate">
                                                    {ar
                                                      ? ACTION_LABELS[a]?.ar || a
                                                      : ACTION_LABELS[a]?.en || a}
                                                  </div>
                                                  {statusBadge && <div className="mt-0.5">{statusBadge}</div>}
                                                </div>
                                              </div>

                                              <Switch
                                                checked={isChecked}
                                                disabled={isActionDisabled}
                                                onCheckedChange={() => toggleAction(m, a)}
                                                onClick={(e) => e.stopPropagation()}
                                                className="scale-75 data-[state=checked]:bg-[#0F2A44] dark:data-[state=checked]:bg-[#C9A24D]"
                                              />
                                            </div>
                                          </TooltipTrigger>
                                          <TooltipContent side="top" className="text-xs">
                                            {tooltipText || (ar ? ACTION_LABELS[a]?.ar || a : ACTION_LABELS[a]?.en || a)}
                                          </TooltipContent>
                                        </Tooltip>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </section>
                );
              })
            )}
          </div>
  );
}
