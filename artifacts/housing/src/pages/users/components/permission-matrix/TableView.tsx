// Permissions as a spreadsheet table.
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { Check, Lock, Sparkles, Sliders, Layers, MinusCircle, Shield } from "lucide-react";
import { MODULE_ACTIONS, MODULE_LABELS, ACTION_LABELS, permKey, type Action } from "@/lib/permissions";
import type { PermissionMatrixCenterState, PermissionMatrixCenterView } from "./usePermissionMatrixCenterState";

export function renderTableView(s: PermissionMatrixCenterState, v: PermissionMatrixCenterView) {
  const { ar, actorCanGrant, roleDefaults, perms, searchQuery, matchesActionSearch, toggleAction, toggleModuleMaster, toggleCategoryGroup, toggleColumnAction, filteredGroups, moduleStatus } = s;
  return (
<div className="rounded-3xl border bg-card shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-start text-xs border-collapse">
                {/* Table Header with Column Bulk Toggles */}
                <thead className="bg-muted/60 border-b text-muted-foreground font-bold">
                  <tr>
                    <th className="p-3.5 text-start min-w-[220px] max-w-[280px]">
                      {ar ? "الموديول والصفحة" : "Module & Page"}
                    </th>

                    {/* Canonical Action Columns with Bulk Column Click */}
                    {(
                      [
                        { key: "view", en: "View", ar: "عرض" },
                        { key: "create", en: "Create", ar: "إنشاء" },
                        { key: "edit", en: "Edit", ar: "تعديل" },
                        { key: "delete", en: "Delete", ar: "حذف" },
                        { key: "export", en: "Export", ar: "تصدير" },
                        { key: "approve", en: "Approve", ar: "اعتماد" },
                      ] as const
                    ).map((col) => (
                      <th
                        key={col.key}
                        className="p-3 text-center min-w-[90px] border-s border-border/50"
                      >
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <button
                              type="button"
                              onClick={() => toggleColumnAction(col.key)}
                              className="w-full inline-flex items-center justify-center gap-1 hover:text-primary transition-colors py-1 rounded-lg hover:bg-muted"
                            >
                              <span>{ar ? col.ar : col.en}</span>
                              <Sliders className="w-2.5 h-2.5 opacity-60" />
                            </button>
                          </TooltipTrigger>
                          <TooltipContent side="top">
                            {ar
                              ? `تبديل صلاحية (${col.ar}) للكل في الموديولات الظاهرة`
                              : `Toggle ${col.en} across all visible modules`}
                          </TooltipContent>
                        </Tooltip>
                      </th>
                    ))}

                    <th className="p-3.5 text-start min-w-[260px] border-s border-border/50">
                      {ar ? "العمليات الخاصة والإضافية" : "Special Operations"}
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-border/60">
                  {filteredGroups.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="p-12 text-center text-muted-foreground">
                        {ar ? "لا توجد موديولات مطابقة" : "No matching modules"}
                      </td>
                    </tr>
                  ) : (
                    filteredGroups.map((group) => {
                      return (
                        <tr key={`group-${group.id}`} className="contents">
                          {/* Category Subheader Row */}
                          <tr className="bg-muted/40 font-bold text-foreground">
                            <td colSpan={8} className="p-2.5 px-4">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <Layers className="w-4 h-4 text-[#C9A24D]" />
                                  <span>{ar ? group.label.ar : group.label.en}</span>
                                  <span className="text-[10px] text-muted-foreground font-normal">
                                    ({group.modules.length} {ar ? "موديول" : "modules"})
                                  </span>
                                </div>
                                <div className="flex items-center gap-1.5">
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] font-bold text-emerald-600 hover:text-emerald-700"
                                    onClick={() => toggleCategoryGroup(group.id, true)}
                                  >
                                    {ar ? "تحديد القسم" : "Select Group"}
                                  </Button>
                                  <Button
                                    type="button"
                                    variant="ghost"
                                    size="sm"
                                    className="h-6 text-[10px] font-bold text-rose-600 hover:text-rose-700"
                                    onClick={() => toggleCategoryGroup(group.id, false)}
                                  >
                                    {ar ? "إلغاء القسم" : "Clear Group"}
                                  </Button>
                                </div>
                              </div>
                            </td>
                          </tr>

                          {/* Module Rows */}
                          {group.modules.map((m) => {
                            const modulePerms = MODULE_ACTIONS[m] ?? [];
                            const status = moduleStatus(m);

                            // Extra special actions not in standard 6 columns
                            const standardCols: Action[] = [
                              "view",
                              "create",
                              "edit",
                              "delete",
                              "export",
                              "approve",
                            ];
                            const specialActions = modulePerms.filter(
                              (a) => !standardCols.includes(a),
                            );

                            return (
                              <tr
                                key={m}
                                className={`transition-colors hover:bg-muted/20 ${
                                  !status.isMasterOn ? "opacity-60 bg-muted/10" : ""
                                }`}
                              >
                                {/* Module Name & Master Switch */}
                                <td className="p-3 align-middle">
                                  <div className="flex items-center justify-between gap-2">
                                    <div className="min-w-0">
                                      <div className="font-bold text-foreground text-xs truncate">
                                        {ar ? MODULE_LABELS[m]?.ar : MODULE_LABELS[m]?.en}
                                      </div>
                                      <div className="text-[10px] font-mono text-muted-foreground">
                                        {m}
                                      </div>
                                    </div>
                                    <Switch
                                      checked={status.isMasterOn}
                                      onCheckedChange={(val) => toggleModuleMaster(m, val)}
                                      className="scale-75 data-[state=checked]:bg-emerald-600 flex-shrink-0"
                                      title={ar ? "تفعيل أو إغلاق الموديول" : "Toggle module"}
                                    />
                                  </div>
                                </td>

                                {/* Standard Action Columns */}
                                {standardCols.map((act) => {
                                  const supportsAction = modulePerms.includes(act);
                                  if (!supportsAction) {
                                    return (
                                      <td
                                        key={act}
                                        className="p-2 text-center text-muted-foreground/40 border-s border-border/40"
                                      >
                                        —
                                      </td>
                                    );
                                  }

                                  const key = permKey(m, act);
                                  const isChecked = perms.has(key);
                                  const isRoleDefault = roleDefaults.has(key);
                                  const isViewAction = act === "view";
                                  const canGrant = actorCanGrant(m, act);
                                  const isActionDisabled = (!isViewAction && !status.hasView) || !canGrant;
                                  const isActionMatch = matchesActionSearch(act, searchQuery);

                                  let badgeIcon = null;
                                  let tooltipDesc = "";

                                  if (!canGrant) {
                                    badgeIcon = <Lock className="w-2 h-2 text-amber-600" />;
                                    tooltipDesc = ar ? "غير متاحة لك لمنحها" : "Unowned (Cannot grant)";
                                  } else if (isChecked && isRoleDefault) {
                                    badgeIcon = <Shield className="w-2 h-2 text-blue-500" />;
                                    tooltipDesc = ar ? "افتراضي للدور" : "Role Default";
                                  } else if (isChecked && !isRoleDefault) {
                                    badgeIcon = <Sparkles className="w-2 h-2 text-emerald-500" />;
                                    tooltipDesc = ar ? "+ منح مخصص" : "+ Custom Grant";
                                  } else if (!isChecked && isRoleDefault) {
                                    badgeIcon = <MinusCircle className="w-2 h-2 text-rose-500" />;
                                    tooltipDesc = ar ? "- ملغي من الدور" : "- Revoked from Role";
                                  }

                                  return (
                                    <td
                                      key={act}
                                      className={`p-2 text-center border-s border-border/40 ${
                                        isActionMatch ? "bg-[#C9A24D]/10" : ""
                                      }`}
                                    >
                                      <Tooltip>
                                        <TooltipTrigger asChild>
                                          <div className="inline-flex flex-col items-center gap-0.5">
                                            <Switch
                                              checked={isChecked}
                                              disabled={isActionDisabled}
                                              onCheckedChange={() => toggleAction(m, act)}
                                              className="scale-75 data-[state=checked]:bg-[#0F2A44] dark:data-[state=checked]:bg-[#C9A24D]"
                                            />
                                            {badgeIcon && (
                                              <div className="flex items-center gap-0.5 text-[8px] text-muted-foreground font-semibold">
                                                {badgeIcon}
                                              </div>
                                            )}
                                          </div>
                                        </TooltipTrigger>
                                        <TooltipContent side="top" className="text-xs">
                                          {ar ? ACTION_LABELS[act]?.ar : ACTION_LABELS[act]?.en}: {tooltipDesc}
                                        </TooltipContent>
                                      </Tooltip>
                                    </td>
                                  );
                                })}

                                {/* Special Operations Chips */}
                                <td className="p-2 border-s border-border/40">
                                  {specialActions.length === 0 ? (
                                    <span className="text-[11px] text-muted-foreground/50 italic">
                                      {ar ? "لا توجد عمليات إضافية" : "No special actions"}
                                    </span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {specialActions.map((sa) => {
                                        const key = permKey(m, sa);
                                        const isChecked = perms.has(key);
                                        const canGrant = actorCanGrant(m, sa);
                                        const isActionDisabled =
                                          ((!status.hasView &&
                                          sa !== "view_maintenance" &&
                                          sa !== "view_housekeeping") || !canGrant);
                                        const isRoleDefault = roleDefaults.has(key);
                                        const isActionMatch = matchesActionSearch(sa, searchQuery);

                                        let pillBadge = "";
                                        if (isChecked && isRoleDefault) {
                                          pillBadge = "border-blue-300 dark:border-blue-900 bg-blue-50/70 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300";
                                        } else if (isChecked && !isRoleDefault) {
                                          pillBadge = "border-emerald-300 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300";
                                        } else if (!isChecked && isRoleDefault) {
                                          pillBadge = "border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400";
                                        } else {
                                          pillBadge = "border-border bg-card text-muted-foreground hover:bg-muted";
                                        }

                                        return (
                                          <Tooltip key={sa}>
                                            <TooltipTrigger asChild>
                                              <button
                                                type="button"
                                                disabled={isActionDisabled}
                                                onClick={() => toggleAction(m, sa)}
                                                className={`px-2 py-0.5 rounded-lg border text-[10px] font-bold transition-all flex items-center gap-1 ${pillBadge} ${
                                                  isActionMatch ? "ring-2 ring-[#C9A24D]" : ""
                                                } ${
                                                  isActionDisabled ? "opacity-30 cursor-not-allowed" : ""
                                                }`}
                                              >
                                                <span>
                                                  {ar
                                                    ? ACTION_LABELS[sa]?.ar || sa
                                                    : ACTION_LABELS[sa]?.en || sa}
                                                </span>
                                                {isChecked ? (
                                                  <Check className="w-2.5 h-2.5" />
                                                ) : isRoleDefault ? (
                                                  <MinusCircle className="w-2.5 h-2.5 text-rose-500" />
                                                ) : null}
                                              </button>
                                            </TooltipTrigger>
                                            <TooltipContent side="top" className="text-xs">
                                              {sa}:{" "}
                                              {isChecked && isRoleDefault
                                                ? ar
                                                  ? "افتراضي للدور"
                                                  : "Role Default"
                                                : isChecked && !isRoleDefault
                                                ? ar
                                                  ? "+ منح مخصص"
                                                  : "+ Custom Grant"
                                                : !isChecked && isRoleDefault
                                                ? ar
                                                  ? "- ملغي من الدور"
                                                  : "- Revoked from Role"
                                                : ar
                                                ? "غير مفعل"
                                                : "Disabled"}
                                            </TooltipContent>
                                          </Tooltip>
                                        );
                                      })}
                                    </div>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
  );
}
