// One-click role presets, search and view toggle.
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Check, X, Search, Sparkles, Eye, RotateCcw, LayoutGrid, Table as TableIcon, Download } from "lucide-react";
import { PERMISSION_GROUPS } from "@/lib/permissions";
import { SYSTEM_ROLE_PRESETS } from "./PermissionMatrixCenter.constants";
import type { PermissionMatrixCenterState, PermissionMatrixCenterView } from "./usePermissionMatrixCenterState";

export function renderRolePresetsBar(s: PermissionMatrixCenterState, v: PermissionMatrixCenterView) {
  const { ar, primaryRole, searchQuery, setSearchQuery, selectedGroup, setSelectedGroup, hasChanges, viewMode, setViewMode, applyRoleDefaults, selectAll, deselectAll, applyReadOnlyAll, resetToStored, revertToRoleDefaults, exportPermissionsSummary } = s;
  return (
<div className="p-4 sm:p-5 rounded-3xl border bg-card shadow-xs space-y-4">
          {/* Row 1: All 9 System Role Presets + Actions */}
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 border-b pb-4">
            <div className="space-y-1.5 flex-1">
              <div className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
                <span>{ar ? "قوالب الأدوار السريعة (تطبيق بنقرة واحدة)" : "One-Click Role Presets (9 System Roles)"}</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {SYSTEM_ROLE_PRESETS.map((preset) => (
                  <button
                    key={preset.value}
                    type="button"
                    onClick={() => applyRoleDefaults(preset.value)}
                    className={`px-3 py-1.5 rounded-xl text-xs font-semibold border transition-all flex items-center gap-1.5 shadow-2xs ${
                      preset.value === primaryRole
                        ? "ring-1 ring-primary bg-muted font-bold"
                        : "bg-muted/40 hover:bg-muted text-foreground"
                    }`}
                    title={ar ? preset.labelAr : preset.labelEn}
                  >
                    <span className="w-2 h-2 rounded-full bg-current" />
                    <span>{ar ? preset.labelAr : preset.labelEn}</span>
                    {preset.value === primaryRole && (
                      <span className="text-[10px] text-muted-foreground font-normal">
                        ({ar ? "الحالي" : "current"})
                      </span>
                    )}
                  </button>
                ))}

                <button
                  type="button"
                  onClick={applyReadOnlyAll}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-blue-300 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 hover:bg-blue-100 transition-all flex items-center gap-1.5 shadow-2xs"
                  title={ar ? "منح صلاحيات العرض فقط لكافة الأقسام" : "Grant view-only across all modules"}
                >
                  <Eye className="w-3.5 h-3.5 text-blue-600" />
                  <span>{ar ? "عرض فقط للكل" : "Read-Only All"}</span>
                </button>

                <button
                  type="button"
                  onClick={revertToRoleDefaults}
                  className="px-3 py-1.5 rounded-xl text-xs font-semibold border border-[#C9A24D]/40 bg-[#C9A24D]/10 text-amber-800 dark:text-amber-300 hover:bg-[#C9A24D]/20 transition-all flex items-center gap-1.5 shadow-2xs"
                  title={
                    ar
                      ? "استعادة افتراضيات الدور ومسح التخصيصات (وراثة ديناميكية)"
                      : "Revert custom overrides back to dynamic role inheritance"
                  }
                >
                  <RotateCcw className="w-3.5 h-3.5 text-[#C9A24D]" />
                  <span>{ar ? "استعادة افتراضيات الدور" : "Revert to Role"}</span>
                </button>
              </div>
            </div>

            {/* View Mode Switcher + Global Bulk Actions */}
            <div className="flex flex-wrap items-center gap-2 self-end lg:self-auto">
              {/* Dual View Toggle */}
              <div className="flex items-center p-1 bg-muted rounded-xl border">
                <button
                  type="button"
                  onClick={() => setViewMode("cards")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === "cards"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={ar ? "عرض البطاقات المرئية" : "Visual Cards View"}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                  <span>{ar ? "بطاقات" : "Cards"}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode("table")}
                  className={`px-3 py-1 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-all ${
                    viewMode === "table"
                      ? "bg-card text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  title={ar ? "عرض جدول المصفوفة التفاعلي" : "Spreadsheet Table View"}
                >
                  <TableIcon className="w-3.5 h-3.5" />
                  <span>{ar ? "جدول المصفوفة" : "Table"}</span>
                </button>
              </div>

              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold rounded-xl"
                onClick={selectAll}
              >
                <Check className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                {ar ? "تحديد الكل" : "Select All"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold rounded-xl text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                onClick={deselectAll}
              >
                <X className="w-3.5 h-3.5 mr-1" />
                {ar ? "إلغاء الكل" : "Clear All"}
              </Button>
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs font-semibold rounded-xl text-primary"
                onClick={exportPermissionsSummary}
                title={ar ? "تصدير ملخص الصلاحيات بتنسيق JSON" : "Export permission summary as JSON"}
              >
                <Download className="w-3.5 h-3.5 mr-1" />
                {ar ? "تصدير" : "Export"}
              </Button>
              {hasChanges && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-xs font-semibold rounded-xl text-muted-foreground"
                  onClick={resetToStored}
                >
                  <RotateCcw className="w-3.5 h-3.5 mr-1" />
                  {ar ? "استعادة" : "Reset"}
                </Button>
              )}
            </div>
          </div>

          {/* Row 2: Action-Aware Search + Category Filter Tabs */}
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
            {/* Action-Aware Search Input */}
            <div className="relative flex-1 max-w-md">
              <Search className="w-4 h-4 text-muted-foreground absolute start-3.5 top-1/2 -translate-y-1/2" />
              <Input
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder={
                  ar
                    ? "ابحث بموديول أو عملية (مثال: حذف، تصدير، اعتماد، تسكين)..."
                    : "Search module or action (e.g. delete, export, approve)..."
                }
                className="ps-10 pe-9 h-10 text-xs rounded-xl"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery("")}
                  className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Category Tabs */}
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar py-1">
              <button
                type="button"
                onClick={() => setSelectedGroup("all")}
                className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                  selectedGroup === "all"
                    ? "bg-primary text-primary-foreground shadow-xs"
                    : "bg-muted/60 hover:bg-muted text-muted-foreground"
                }`}
              >
                {ar ? "كافة الأقسام" : "All Domains"}
              </button>
              {PERMISSION_GROUPS.map((g) => (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setSelectedGroup(g.id)}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold transition-all whitespace-nowrap ${
                    selectedGroup === g.id
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "bg-muted/60 hover:bg-muted text-muted-foreground"
                  }`}
                >
                  {ar ? g.label.ar : g.label.en}
                </button>
              ))}
            </div>
          </div>
        </div>
  );
}
