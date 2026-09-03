import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Search, RotateCcw, X } from "lucide-react";

export function ReportFilters({
  ar,
  activeTab,
  properties,
  propId,
  buildings,
  floors,
  floorOptions,
  departments,
  nationalities,
  filterProperty,
  setFilterProperty,
  filterBuilding,
  setFilterBuilding,
  filterFloor,
  setFilterFloor,
  filterStatus,
  setFilterStatus,
  filterRoomType,
  setFilterRoomType,
  filterEmploymentType,
  setFilterEmploymentType,
  filterCategory,
  setFilterCategory,
  filterDepartment,
  setFilterDepartment,
  filterGender,
  setFilterGender,
  filterNationality,
  setFilterNationality,
  search,
  setSearch,
  dateFrom,
  setDateFrom,
  dateTo,
  setDateTo,
  resetReportFilters,
  hasActiveReportFilters,
  currentDataLength,
  selectedRowsSize,
}: any) {
  const getStatusOptions = (): { value: string; label: string; labelAr: string }[] => {
    switch (activeTab) {
      case "housekeeping":
        return [
          { value: "dirty",         label: "Dirty — Needs Cleaning",  labelAr: "متسخة — تحتاج تنظيف فوري 🧹" },
          { value: "occupied_dirty",label: "Occupied — Dirty",        labelAr: "مشغولة ومتسخة" },
          { value: "available",     label: "Available — Ready",       labelAr: "شاغرة — جاهزة ✅" },
          { value: "occupied",      label: "Occupied — DND",          labelAr: "مشغولة — لا تزعج" },
          { value: "maintenance",   label: "Under Maintenance",       labelAr: "تحت الصيانة 🔧" },
          { value: "out_of_service",label: "Out of Service (OOS)",    labelAr: "خارج الخدمة (OOS)" },
          { value: "out_of_order",  label: "Out of Order (OOO)",      labelAr: "خارج النظام (OOO)" },
        ];
      case "housing":
        return [
          { value: "available",     label: "Available",         labelAr: "شاغرة / متاحة" },
          { value: "occupied",      label: "Occupied",          labelAr: "مشغولة" },
          { value: "dirty",         label: "Dirty",             labelAr: "متسخة (تحتاج تنظيف)" },
          { value: "occupied_dirty",label: "Occupied — Dirty",  labelAr: "مشغولة ومتسخة" },
          { value: "maintenance",   label: "Maintenance",       labelAr: "صيانة" },
          { value: "out_of_service",label: "Out of Service",    labelAr: "خارج الخدمة (OOS)" },
          { value: "out_of_order",  label: "Out of Order",      labelAr: "خارج النظام (OOO)" },
        ];
      case "vacant_rooms":
        return [
          { value: "available",     label: "Available (Vacant Beds)", labelAr: "شاغرة (بها أسرة فاضية)" },
          { value: "dirty",         label: "Dirty (Needs Cleaning)",  labelAr: "متسخة (تحتاج تنظيف)" },
          { value: "partially",     label: "Partially Occupied",      labelAr: "مشغولة جزئياً" },
        ];
      case "assignments":
        return [
          { value: "ACTIVE",       label: "Active — In-House",    labelAr: "مقيم بالسكن (ان هاوس)" },
          { value: "VACATION",     label: "On Vacation",          labelAr: "في إجازة (فيكيشن)" },
          { value: "CHECKED_OUT",  label: "Checked-Out",          labelAr: "مغادر (شيكاوت)" },
          { value: "TRANSFERRED",  label: "Transferred / Room Move", labelAr: "منقول (روم موف)" },
        ];
      case "profiles":
        return [
          { value: "ACTIVE",       label: "Active — In-House",    labelAr: "نشط / مقيم بالسكن" },
          { value: "VACATION",     label: "On Vacation",          labelAr: "في إجازة" },
          { value: "CHECKED_OUT",  label: "Checked-Out / Left",   labelAr: "مغادر / شيكاوت" },
          { value: "NO_ROOM",      label: "Not Assigned",         labelAr: "لم يُسكَّن بعد" },
          { value: "INACTIVE",     label: "Inactive",             labelAr: "غير نشط" },
        ];
      case "expiring_contracts":
        return [
          { value: "expired",     label: "Expired",               labelAr: "منتهي (مضى الأجل)" },
          { value: "expiring_30", label: "Expiring — 30 days",    labelAr: "ينتهي قريباً (خلال 30 يوم)" },
          { value: "active",      label: "Active",                labelAr: "سارٍ" },
        ];
      case "hostings":
        return [
          { value: "pending",     label: "Pending",               labelAr: "قيد الانتظار" },
          { value: "approved",    label: "Approved",              labelAr: "مقبول" },
          { value: "active",      label: "Active — Hosting",      labelAr: "مقيم (استضافة نشطة)" },
          { value: "completed",   label: "Completed",             labelAr: "مكتمل / مغادر" },
          { value: "cancelled",   label: "Cancelled",             labelAr: "ملغي" },
          { value: "rejected",    label: "Rejected",              labelAr: "مرفوض" },
        ];
      case "maintenance":
        return [
          { value: "open",        label: "Open",                  labelAr: "مفتوح (جديد)" },
          { value: "in_progress", label: "In Progress",           labelAr: "قيد التنفيذ" },
          { value: "on_hold",     label: "On Hold",               labelAr: "معلّق" },
          { value: "resolved",    label: "Resolved",              labelAr: "تم الحل" },
          { value: "closed",      label: "Closed",                labelAr: "مغلق" },
          { value: "cancelled",   label: "Cancelled",             labelAr: "ملغي" },
        ];
      case "reservations":
        return [
          { value: "UPCOMING",    label: "Upcoming Arrival",      labelAr: "وصول قادم" },
          { value: "CHECKED_IN",  label: "Checked-In",            labelAr: "تم التسكين" },
          { value: "NO_SHOW",     label: "No Show",               labelAr: "لم يحضر (نو شو)" },
          { value: "WAITLISTED",  label: "Waitlisted",            labelAr: "قائمة انتظار" },
          { value: "CANCELLED",   label: "Cancelled",             labelAr: "ملغي" },
          { value: "COMPLETED",   label: "Completed",             labelAr: "منتهي" },
        ];
      default:
        return [];
    }
  };

  const statusOptions = getStatusOptions();
  const showBuildingFloor = ["housing", "vacant_rooms", "assignments", "maintenance", "hostings"].includes(activeTab);
  const showEmploymentType = ["assignments", "profiles", "analytics"].includes(activeTab);
  const showRoomType = ["housing", "vacant_rooms", "assignments", "reservations"].includes(activeTab);
  const showDepartment = ["assignments", "profiles", "reservations", "hostings", "expiring_contracts"].includes(activeTab);
  const showGender = ["housing", "vacant_rooms", "assignments", "profiles", "expiring_contracts"].includes(activeTab);
  const showNationality = ["assignments", "profiles", "expiring_contracts"].includes(activeTab);
  const showCategory = activeTab === "maintenance";

  return (
    <div className="overflow-hidden rounded-xl border bg-card shadow-xs space-y-3 p-4">
      {/* Top Search & Actions Bar */}
      <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center justify-between">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground rtl:left-auto rtl:right-3" />
          <Input
            className="pl-9 pr-9 rtl:pr-9 rtl:pl-9 h-10 bg-background"
            placeholder={
              ar
                ? "بحث شامل (بالاسم، كود الموظف، رقم الغرفة، الهوية، الهاتف، المبنى...)"
                : "Live search across all fields (name, ID, room #, phone, building...)"
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground rtl:right-auto rtl:left-3"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="flex items-center gap-2">
          {hasActiveReportFilters && (
            <Button
              variant="outline"
              size="sm"
              onClick={resetReportFilters}
              className="h-10 gap-1.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
            >
              <RotateCcw className="w-3.5 h-3.5" />
              {ar ? "إعادة ضبط الفلاتر" : "Reset Filters"}
            </Button>
          )}

          <Badge variant="secondary" className="h-10 px-3 text-xs font-semibold gap-1.5">
            <span>{currentDataLength}</span>
            <span className="text-muted-foreground">{ar ? "سجل" : "records"}</span>
            {selectedRowsSize > 0 && (
              <span className="text-primary font-bold">
                • {selectedRowsSize} {ar ? "محدد" : "selected"}
              </span>
            )}
          </Badge>
        </div>
      </div>

      {/* Filter Selects Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-1">
        {/* Building Filter */}
        {showBuildingFloor && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "المبنى" : "Building"}</Label>
            <Select
              value={filterBuilding}
              onValueChange={(v) => {
                setFilterBuilding(v);
                setFilterFloor("all");
              }}
            >
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
                {buildings.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Floor Filter */}
        {showBuildingFloor && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "الطابق" : "Floor"}</Label>
            <Select value={filterFloor} onValueChange={setFilterFloor}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "كل الطوابق" : "All Floors"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الطوابق" : "All Floors"}</SelectItem>
                {floorOptions.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.name || `Floor ${f.floorNumber}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Employment Type Filter (Internal / Third Party) */}
        {showEmploymentType && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "نوع التوظيف" : "Employment Type"}</Label>
            <Select value={filterEmploymentType} onValueChange={setFilterEmploymentType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "الكل" : "All Types"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل (داخلي + طرف ثالث)" : "All Types"}</SelectItem>
                <SelectItem value="INTERNAL">{ar ? "🏢 موظف داخلي (فندق)" : "Internal Staff"}</SelectItem>
                <SelectItem value="THIRD_PARTY">{ar ? "👥 طرف خارجي (ثيرد بارتي)" : "Third-Party"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Room Type Filter */}
        {showRoomType && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "نوع الغرفة" : "Room Type"}</Label>
            <Select value={filterRoomType} onValueChange={setFilterRoomType}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "كل الأنواع" : "All Types"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأنواع" : "All Types"}</SelectItem>
                <SelectItem value="single">{ar ? "فردي (Single)" : "Single"}</SelectItem>
                <SelectItem value="double">{ar ? "مزدوج (Double)" : "Double"}</SelectItem>
                <SelectItem value="triple">{ar ? "ثلاثي (Triple)" : "Triple"}</SelectItem>
                <SelectItem value="quad">{ar ? "رباعي (Quad)" : "Quad"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Department Filter */}
        {showDepartment && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "القسم" : "Department"}</Label>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "كل الأقسام" : "All Depts"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأقسام" : "All Departments"}</SelectItem>
                {departments.map((d: string) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Status Filter */}
        {statusOptions.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "الحالة" : "Status"}</Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "كل الحالات" : "All Status"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "All Status"}</SelectItem>
                {statusOptions.map((s) => (
                  <SelectItem key={s.value} value={s.value}>{ar ? s.labelAr : s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Gender Filter */}
        {showGender && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "الجنس" : "Gender"}</Label>
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "الكل" : "All"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
                <SelectItem value="M">{ar ? "ذكر" : "Male"}</SelectItem>
                <SelectItem value="F">{ar ? "أنثى" : "Female"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Nationality Filter */}
        {showNationality && nationalities.length > 0 && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "الجنسية" : "Nationality"}</Label>
            <Select value={filterNationality} onValueChange={setFilterNationality}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "كل الجنسيات" : "All"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الجنسيات" : "All Nationalities"}</SelectItem>
                {nationalities.map((n: string) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Maintenance Category */}
        {showCategory && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "فئة الصيانة" : "Category"}</Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-xs"><SelectValue placeholder={ar ? "كل الفئات" : "All Categories"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الفئات" : "All Categories"}</SelectItem>
                <SelectItem value="plumbing">{ar ? "سباكة" : "Plumbing"}</SelectItem>
                <SelectItem value="electrical">{ar ? "كهرباء" : "Electrical"}</SelectItem>
                <SelectItem value="hvac">{ar ? "تكييف وتبريد" : "HVAC"}</SelectItem>
                <SelectItem value="carpentry">{ar ? "نجارة" : "Carpentry"}</SelectItem>
                <SelectItem value="general">{ar ? "عامة" : "General"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date From */}
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "من تاريخ" : "From Date"}</Label>
          <Input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} className="h-9 text-xs bg-background" />
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "إلى تاريخ" : "To Date"}</Label>
          <Input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} className="h-9 text-xs bg-background" />
        </div>
      </div>
    </div>
  );
}
