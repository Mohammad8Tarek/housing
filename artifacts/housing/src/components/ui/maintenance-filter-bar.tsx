import { useState, useEffect } from "react";
import { DateInput } from "./date-input";
import {
  Plus,
  RotateCcw,
  Layers,
  Wrench,
  Sparkles,
  FileText,
  User,
  AlertCircle,
} from "lucide-react";

interface MaintenanceFilterBarProps {
  properties?: any[];
  departments?: string[];
  profiles?: any[];
  onCreateNew?: () => void;
  onFiltersChange?: (filters: MaintenanceFilterState) => void;
  ar?: boolean;
  allowedCategories?: string[];
  initialPropertyId?: string;
  initialType?: string;
  categoryFilter?: string;
  onCategoryChange?: (cat: string) => void;
  scopeFilter?: "all" | "me" | "unassigned";
  onScopeChange?: (scope: "all" | "me" | "unassigned") => void;
  hasBoth?: boolean;
  hasManagerialScope?: boolean;
  totalCount?: number;
  maintenanceCount?: number;
  housekeepingCount?: number;
  generalCount?: number;
  myTicketsCount?: number;
}

interface MaintenanceFilterState {
  fromDate: string;
  toDate: string;
  status: string;
  type: string;
  priority: string;
  departments: string[];
  creatorType: string;
  propertyId: string;
}

const INITIAL_FILTERS: MaintenanceFilterState = {
  fromDate: "",
  toDate: "",
  status: "",
  type: "",
  priority: "",
  departments: [],
  creatorType: "",
  propertyId: "all",
};

const STATUS_OPTIONS = [
  { value: "open", label: "Open", labelAr: "مفتوحة" },
  { value: "in_progress", label: "In Progress", labelAr: "قيد التنفيذ" },
  { value: "resolved", label: "Resolved", labelAr: "محلولة" },
  { value: "closed", label: "Closed", labelAr: "مغلقة" },
];
const PRIORITY_OPTIONS = [
  { value: "low", label: "Low", labelAr: "منخفضة" },
  { value: "medium", label: "Medium", labelAr: "متوسطة" },
  { value: "high", label: "High", labelAr: "عالية" },
  { value: "urgent", label: "Urgent", labelAr: "عاجلة" },
];

export default function MaintenanceFilterBar({
  properties = [],
  departments = ["Front Office", "Engineering", "House Keeping"],
  profiles = [],
  onCreateNew,
  onFiltersChange,
  ar = false,
  allowedCategories,
  initialPropertyId = "all",
  initialType = "",
  categoryFilter = "all",
  onCategoryChange,
  scopeFilter = "all",
  onScopeChange,
  hasBoth = false,
  hasManagerialScope = true,
  totalCount = 0,
  maintenanceCount = 0,
  housekeepingCount = 0,
  generalCount = 0,
  myTicketsCount = 0,
}: MaintenanceFilterBarProps) {
  const [filters, setFilters] = useState<MaintenanceFilterState>({
    ...INITIAL_FILTERS,
    propertyId: initialPropertyId,
    type: initialType || (allowedCategories && allowedCategories.length === 1 ? allowedCategories[0] : ""),
  });

  useEffect(() => {
    if (initialPropertyId !== undefined && initialPropertyId !== filters.propertyId) {
      setFilters((f) => ({ ...f, propertyId: initialPropertyId }));
    }
  }, [initialPropertyId]);

  useEffect(() => {
    if (initialType !== undefined && initialType !== filters.type) {
      setFilters((f) => ({ ...f, type: initialType }));
    }
  }, [initialType]);

  const handleSingleSelect = (
    key: keyof MaintenanceFilterState,
    value: string,
  ) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleDateChange = (key: "fromDate" | "toDate", value: string) => {
    const newFilters = { ...filters, [key]: value };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

  const handleResetAll = () => {
    const resetFilters = { ...INITIAL_FILTERS };
    setFilters(resetFilters);
    onFiltersChange?.(resetFilters);
    if (onCategoryChange && hasBoth) {
      onCategoryChange("all");
    }
    if (onScopeChange && hasManagerialScope) {
      onScopeChange("all");
    }
  };

  const hasActiveFilters =
    filters.fromDate ||
    filters.toDate ||
    filters.status ||
    filters.priority ||
    filters.propertyId !== "all" ||
    (categoryFilter !== "all" && hasBoth) ||
    (scopeFilter !== "all" && hasManagerialScope);

  const selectClass =
    "w-full px-3 py-1.5 bg-muted/50 border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary transition-colors";
  const labelClass = "block text-xs font-semibold text-muted-foreground";

  return (
    <div className="bg-card rounded-xl p-4 space-y-4 border border-border shadow-xs">
      {/* ── Integrated Category & Scoping Bar ── */}
      {(hasBoth || onScopeChange) && (
        <div className="flex flex-wrap items-center justify-between gap-3 pb-3.5 border-b border-border">
          {/* Category Switcher Tabs */}
          {hasBoth && onCategoryChange && (
            <div className="flex items-center gap-1 p-1 bg-muted/80 dark:bg-muted/40 border rounded-xl shadow-2xs overflow-x-auto max-w-full">
              <button
                type="button"
                onClick={() => onCategoryChange("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  categoryFilter === "all"
                    ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <Layers className="w-3.5 h-3.5" />
                <span>{ar ? "كل الأقسام" : "All Categories"}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    categoryFilter === "all"
                      ? "bg-primary/15 text-primary"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {totalCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onCategoryChange("maintenance")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  categoryFilter === "maintenance"
                    ? "bg-amber-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <Wrench className="w-3.5 h-3.5" />
                <span>{ar ? "الصيانة" : "Maintenance"}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    categoryFilter === "maintenance"
                      ? "bg-white/20 text-white"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300"
                  }`}
                >
                  {maintenanceCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onCategoryChange("housekeeping")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  categoryFilter === "housekeeping"
                    ? "bg-sky-600 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>{ar ? "الهاوس كيبنج" : "Housekeeping"}</span>
                <span
                  className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                    categoryFilter === "housekeeping"
                      ? "bg-white/20 text-white"
                      : "bg-sky-100 text-sky-800 dark:bg-sky-900/40 dark:text-sky-300"
                  }`}
                >
                  {housekeepingCount}
                </span>
              </button>

              <button
                type="button"
                onClick={() => onCategoryChange("general")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  categoryFilter === "general"
                    ? "bg-slate-700 text-white shadow-xs"
                    : "text-muted-foreground hover:text-foreground hover:bg-background/40"
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{ar ? "عام" : "General"}</span>
                {generalCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      categoryFilter === "general"
                        ? "bg-white/20 text-white"
                        : "bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300"
                    }`}
                  >
                    {generalCount}
                  </span>
                )}
              </button>
            </div>
          )}

          {/* Scope Switcher Tabs */}
          {onScopeChange && (
            <div className="flex items-center gap-1 p-1 bg-indigo-50/70 dark:bg-indigo-950/40 border border-indigo-200/80 dark:border-indigo-800/70 rounded-xl shadow-2xs overflow-x-auto max-w-full">
              {hasManagerialScope && (
                <button
                  type="button"
                  onClick={() => onScopeChange("all")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    scopeFilter === "all"
                      ? "bg-background text-foreground shadow-xs ring-1 ring-border"
                      : "text-indigo-900 dark:text-indigo-300 hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <Layers className="w-3.5 h-3.5" />
                  <span>{ar ? "كل الأوردرات" : "All Orders"}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => onScopeChange("me")}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                  scopeFilter === "me"
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-indigo-900 dark:text-indigo-300 hover:text-foreground hover:bg-background/40"
                }`}
              >
                <User className="w-3.5 h-3.5" />
                <span>{ar ? "أوردراتي أنا فقط" : "Assigned to Me"}</span>
                {myTicketsCount > 0 && (
                  <span
                    className={`text-[10px] px-1.5 py-0.2 rounded-full font-bold ${
                      scopeFilter === "me"
                        ? "bg-white/20 text-white"
                        : "bg-indigo-200 text-indigo-900 dark:bg-indigo-900/60 dark:text-indigo-200"
                    }`}
                  >
                    {myTicketsCount}
                  </span>
                )}
              </button>

              {hasManagerialScope && (
                <button
                  type="button"
                  onClick={() => onScopeChange("unassigned")}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 whitespace-nowrap ${
                    scopeFilter === "unassigned"
                      ? "bg-slate-700 text-white shadow-xs"
                      : "text-indigo-900 dark:text-indigo-300 hover:text-foreground hover:bg-background/40"
                  }`}
                >
                  <AlertCircle className="w-3.5 h-3.5" />
                  <span>{ar ? "غير مسندة" : "Unassigned"}</span>
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Filters Input Row (5 Columns) ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3">
        {/* Hotel / Property */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "الفندق / العقار" : "Hotel / Property"}</label>
          <select
            value={filters.propertyId}
            onChange={(e) => handleSingleSelect("propertyId", e.target.value)}
            className={selectClass}
          >
            <option value="all">{ar ? "كل الفنادق" : "All Properties"}</option>
            {properties.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.displayName || p.name}
              </option>
            ))}
          </select>
        </div>

        {/* Status */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "الحالة" : "Status"}</label>
          <select
            value={filters.status}
            onChange={(e) => handleSingleSelect("status", e.target.value)}
            className={selectClass}
          >
            <option value="">{ar ? "الكل" : "All"}</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {ar ? s.labelAr : s.label}
              </option>
            ))}
          </select>
        </div>

        {/* Priority */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "الأولوية" : "Priority"}</label>
          <select
            value={filters.priority}
            onChange={(e) => handleSingleSelect("priority", e.target.value)}
            className={selectClass}
          >
            <option value="">{ar ? "الكل" : "All"}</option>
            {PRIORITY_OPTIONS.map((p) => (
              <option key={p.value} value={p.value}>
                {ar ? p.labelAr : p.label}
              </option>
            ))}
          </select>
        </div>

        {/* From Date */}
        <div className="space-y-1">
          <label className={labelClass}>
            {ar ? "من التاريخ" : "From Date"}
          </label>
          <DateInput
            value={filters.fromDate}
            onChange={(iso) => handleDateChange("fromDate", iso)}
          />
        </div>

        {/* To Date */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "إلى التاريخ" : "To Date"}</label>
          <DateInput
            value={filters.toDate}
            onChange={(iso) => handleDateChange("toDate", iso)}
          />
        </div>
      </div>

      {/* ── Action Bar ── */}
      <div className="flex items-center justify-between pt-2 border-t border-border">
        {hasActiveFilters ? (
          <button
            onClick={handleResetAll}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-muted-foreground hover:text-foreground rounded border border-border hover:bg-accent transition-colors"
          >
            <RotateCcw className="w-3 h-3" />
            {ar ? "إعادة تعيين الفلاتر" : "Reset Filters"}
          </button>
        ) : (
          <div />
        )}
        {onCreateNew && (
          <button
            onClick={onCreateNew}
            className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-semibold hover:bg-primary/90 transition shadow-xs"
          >
            <Plus className="w-3.5 h-3.5" />
            {ar ? "إنشاء تذكرة جديدة" : "Create New Ticket"}
          </button>
        )}
      </div>
    </div>
  );
}
