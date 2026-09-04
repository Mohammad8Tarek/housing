import { useState } from "react";
import { DateInput } from "./date-input";
import { Plus, RotateCcw } from "lucide-react";

interface MaintenanceFilterBarProps {
  properties?: any[];
  departments?: string[];
  profiles?: any[];
  onCreateNew?: () => void;
  onFiltersChange?: (filters: MaintenanceFilterState) => void;
  ar?: boolean;
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
  propertyId: "",
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
const TYPE_OPTIONS = [
  { value: "maintenance", label: "Maintenance", labelAr: "صيانة" },
  { value: "housekeeping", label: "Housekeeping", labelAr: "هاوس كيبنج" },
  { value: "general", label: "General", labelAr: "عام" },
];
const CREATOR_OPTIONS = [
  { value: "", label: "All", labelAr: "الكل" },
  { value: "staff", label: "Staff", labelAr: "موظف" },
  { value: "guest", label: "Guest From App", labelAr: "ضيف من التطبيق" },
];

export default function MaintenanceFilterBar({
  properties = [],
  departments = ["Front Office", "Engineering", "House Keeping"],
  profiles = [],
  onCreateNew,
  onFiltersChange,
  ar = false,
}: MaintenanceFilterBarProps) {
  const [filters, setFilters] = useState<MaintenanceFilterState>({
    ...INITIAL_FILTERS,
  });
  const [openDropdowns, setOpenDropdowns] = useState<Record<string, boolean>>(
    {},
  );

  const toggleDropdown = (key: string) => {
    setOpenDropdowns((prev) => ({
      ...Object.keys(prev).reduce((acc, k) => ({ ...acc, [k]: false }), {}),
      [key]: !prev[key],
    }));
  };

  const handleMultiSelect = (value: string) => {
    const newFilters = {
      ...filters,
      departments: filters.departments.includes(value)
        ? filters.departments.filter((item) => item !== value)
        : [...filters.departments, value],
    };
    setFilters(newFilters);
    onFiltersChange?.(newFilters);
  };

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
  };

  const hasActiveFilters =
    filters.fromDate ||
    filters.toDate ||
    filters.status ||
    filters.type ||
    filters.priority ||
    filters.departments.length > 0 ||
    filters.creatorType ||
    filters.propertyId;

  const getSelectedLabel = (arr: string[]) => {
    if (arr.length === 0) return ar ? "اختر..." : "Select...";
    if (arr.length === 1) return arr[0];
    return `${arr[0]}, ${arr[1]}${arr.length > 2 ? "..." : ""}`;
  };

  const selectClass =
    "w-full px-3 py-1.5 bg-muted/50 border border-border rounded text-xs text-foreground focus:outline-none focus:border-primary transition-colors";
  const labelClass = "block text-xs font-semibold text-muted-foreground";

  return (
    <div className="bg-card rounded-lg p-4 space-y-4 border border-border shadow-sm">
      {/* Row 1 */}
      <div className="grid grid-cols-4 gap-3">
        {/* Property */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "العقارات" : "Properties"}</label>
          <select
            value={filters.propertyId}
            onChange={(e) => handleSingleSelect("propertyId", e.target.value)}
            className={selectClass}
          >
            <option value="">{ar ? "الكل" : "All"}</option>
            {properties.map((p) => (
              <option key={p.id} value={String(p.id)}>
                {p.displayName || p.name}
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
      </div>

      {/* Row 2 */}
      <div className="grid grid-cols-4 gap-3">
        {/* Type */}
        <div className="space-y-1">
          <label className={labelClass}>{ar ? "النوع" : "Type"}</label>
          <select
            value={filters.type}
            onChange={(e) => handleSingleSelect("type", e.target.value)}
            className={selectClass}
          >
            <option value="">{ar ? "الكل" : "All"}</option>
            {TYPE_OPTIONS.map((t) => (
              <option key={t.value} value={t.value}>
                {ar ? t.labelAr : t.label}
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

        {/* Departments (Removed - Not in Schema) */}
        {/* Creator Type (Removed - Not in Schema) */}
      </div>

      {/* Action Bar */}
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
        <button
          onClick={onCreateNew}
          className="inline-flex items-center gap-2 px-4 py-1.5 bg-primary text-primary-foreground rounded text-xs font-semibold hover:bg-primary/90 transition"
        >
          <Plus className="w-3.5 h-3.5" />
          {ar ? "إنشاء تذكرة جديدة" : "Create New Ticket"}
        </button>
      </div>
    </div>
  );
}
