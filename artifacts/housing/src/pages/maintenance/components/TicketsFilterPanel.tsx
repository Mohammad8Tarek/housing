import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DateInput } from "@/components/ui/date-input";
import {
  Building2,
  Calendar,
  CheckCircle,
  Layers,
  AlertCircle,
  HardHat,
  User,
  RotateCcw,
} from "lucide-react";
import { PRIORITIES, PRIORITY_AR } from "../utils/ticket-constants";

interface TicketsFilterPanelProps {
  ar: boolean;
  properties: any[];
  propertyFilter: string;
  setPropertyFilter: (v: string) => void;
  fromDate: string;
  setFromDate: (v: string) => void;
  toDate: string;
  setToDate: (v: string) => void;
  statusFilter: string;
  setStatusFilter: (v: string) => void;
  categoryFilter: string;
  setCategoryFilter: (v: string) => void;
  priorityFilter: string;
  setPriorityFilter: (v: string) => void;
  scopeFilter: "all" | "me" | "unassigned";
  setScopeFilter: (v: "all" | "me" | "unassigned") => void;
  creatorTypeFilter: string;
  setCreatorTypeFilter: (v: string) => void;
  hasBoth: boolean;
  canViewMnt: boolean;
  canViewHsk: boolean;
  hasActiveFilters: boolean;
  clearAllFilters: () => void;
}

export function TicketsFilterPanel({
  ar,
  properties,
  propertyFilter,
  setPropertyFilter,
  fromDate,
  setFromDate,
  toDate,
  setToDate,
  statusFilter,
  setStatusFilter,
  categoryFilter,
  setCategoryFilter,
  priorityFilter,
  setPriorityFilter,
  scopeFilter,
  setScopeFilter,
  creatorTypeFilter,
  setCreatorTypeFilter,
  hasBoth,
  canViewMnt,
  canViewHsk,
  hasActiveFilters,
  clearAllFilters,
}: TicketsFilterPanelProps) {
  return (
    <div className="px-4 sm:px-6">
      <div className="bg-card p-4 rounded-xl border shadow-xs space-y-3.5">
        {/* Row 1: Hotels, From Date, To Date, Status */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
          {/* Property Filter */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Building2 className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "الفندق / السكن" : "Property / Housing"}</span>
            </Label>
            <Select value={propertyFilter} onValueChange={(v) => setPropertyFilter(v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder={ar ? "جميع الفنادق والوحدات" : "All Properties"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "جميع الفنادق والوحدات" : "All Properties"}</SelectItem>
                {properties.map((p) => (
                  <SelectItem key={p.id} value={String(p.id)}>
                    {p.displayName || p.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* From Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "من تاريخ" : "From Date"}</span>
            </Label>
            <DateInput
              value={fromDate}
              onChange={(iso) => setFromDate(iso)}
              className="h-9 text-xs bg-background"
            />
          </div>

          {/* To Date */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "إلى تاريخ" : "To Date"}</span>
            </Label>
            <DateInput
              value={toDate}
              onChange={(iso) => setToDate(iso)}
              className="h-9 text-xs bg-background"
            />
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <CheckCircle className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "الحالة" : "Status"}</span>
            </Label>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder={ar ? "كل الحالات" : "All Statuses"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
                <SelectItem value="open">{ar ? "لم تبدأ / مفتوحة" : "Not Started"}</SelectItem>
                <SelectItem value="in_progress">{ar ? "قيد التنفيذ" : "In Progress"}</SelectItem>
                <SelectItem value="resolved">{ar ? "تم الإنجاز" : "Order Completed"}</SelectItem>
                <SelectItem value="closed">{ar ? "مغلقة" : "Closed"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Type, Priority, Departments, Creator Type + Reset */}
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
          {/* Type */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <Layers className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "النوع" : "Type"}</span>
            </Label>
            <Select value={categoryFilter} onValueChange={(v) => setCategoryFilter(v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder={ar ? "كل الأنواع" : "All Types"} />
              </SelectTrigger>
              <SelectContent>
                {hasBoth && (
                  <SelectItem value="all">{ar ? "كل الأنواع" : "All Types"}</SelectItem>
                )}
                {canViewMnt && (
                  <SelectItem value="maintenance">{ar ? "صيانة فنية" : "Maintenance"}</SelectItem>
                )}
                {canViewHsk && (
                  <SelectItem value="housekeeping">{ar ? "هاوس كيبنج" : "Housekeeping"}</SelectItem>
                )}
                {hasBoth && (
                  <SelectItem value="general">{ar ? "عام" : "General"}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Priority */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "الأولوية" : "Priority"}</span>
            </Label>
            <Select value={priorityFilter || "all"} onValueChange={(v) => setPriorityFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder={ar ? "كل الأولويات" : "All Priorities"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأولويات" : "All Priorities"}</SelectItem>
                {PRIORITIES.map((p) => (
                  <SelectItem key={p} value={p}>
                    <div className="flex items-center gap-1.5">
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        p === "URGENT" ? "bg-red-500" :
                        p === "HIGH" ? "bg-orange-500" :
                        p === "MEDIUM" ? "bg-yellow-500" : "bg-slate-400"
                      }`} />
                      <span>{ar ? PRIORITY_AR[p] : p}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Assignment Scope */}
          <div className="space-y-1">
            <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
              <HardHat className="w-3.5 h-3.5 text-primary" />
              <span>{ar ? "نطاق التعيين" : "Assignment"}</span>
            </Label>
            <Select value={scopeFilter} onValueChange={(v: "all" | "me" | "unassigned") => setScopeFilter(v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder={ar ? "كل التذاكر" : "All Tickets"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل التذاكر" : "All Tickets"}</SelectItem>
                <SelectItem value="me">{ar ? "تذاكري المسندة إليّ" : "Assigned to Me"}</SelectItem>
                <SelectItem value="unassigned">{ar ? "تذاكر غير مسندة" : "Unassigned"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Creator Type & Reset */}
          <div className="space-y-1">
            <div className="flex items-center justify-between">
              <Label className="text-[11px] font-semibold text-muted-foreground uppercase flex items-center gap-1.5">
                <User className="w-3.5 h-3.5 text-primary" />
                <span>{ar ? "جهة البلاغ" : "Creator Type"}</span>
              </Label>
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={clearAllFilters}
                  className="text-[11px] text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors font-medium"
                  title={ar ? "إعادة ضبط جميع الفلاتر" : "Reset all filters"}
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>{ar ? "إعادة ضبط" : "Reset"}</span>
                </button>
              )}
            </div>
            <Select value={creatorTypeFilter || "all"} onValueChange={(v) => setCreatorTypeFilter(v === "all" ? "" : v)}>
              <SelectTrigger className="h-9 text-xs bg-background">
                <SelectValue placeholder={ar ? "كل جهات البلاغ" : "All Creators"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
                <SelectItem value="staff">{ar ? "إدارة السكن / المشرف" : "Staff / Supervisor"}</SelectItem>
                <SelectItem value="resident">{ar ? "النزيل / بوابة المقيمين" : "Resident / Portal"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </div>
    </div>
  );
}
