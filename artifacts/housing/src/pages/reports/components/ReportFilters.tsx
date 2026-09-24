import { useMemo } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  SelectGroup,
  SelectLabel,
  SelectSeparator,
} from "@/components/ui/select";
import { Search, RotateCcw, X, Layers, LayoutList } from "lucide-react";

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
  inventoryViewMode = "summary",
  setInventoryViewMode,
  inHouseViewMode = "grouped",
  setInHouseViewMode,
  waterSortMode = "room",
  setWaterSortMode,
  rooms = [],
  roomTypes = [],
}: any) {
  const dynamicRoomTypes = useMemo(() => {
    const set = new Set<string>();
    (roomTypes || []).forEach((t: any) => {
      const val = typeof t === "string" ? t : t?.value;
      if (val && String(val).trim() && String(val).trim() !== "—") set.add(String(val).trim());
    });
    return Array.from(set).sort();
  }, [roomTypes]);

  const getStatusOptions = (): { value: string; label: string; labelAr: string }[] => {
    switch (activeTab) {
      case "housekeeping_sheet":
        return [
          { value: "dirty",         label: "Dirty (Needs Service)", labelAr: "متسخة (تحتاج خدمة)" },
          { value: "occupied_dirty",label: "Occupied — Dirty",      labelAr: "مشغولة ومتسخة" },
          { value: "clean",         label: "Clean & Ready",         labelAr: "نظيفة وجاهزة" },
          { value: "available",     label: "Available",             labelAr: "شاغرة" },
          { value: "occupied",      label: "Occupied",              labelAr: "مشغولة" },
          { value: "out_of_order",  label: "Out of Order (OOO)",    labelAr: "خارج الخدمة (OOO)" },
        ];
      case "room_discrepancy":
        return [
          { value: "CRITICAL",      label: "Critical Only",         labelAr: "حالات حرجة فقط" },
          { value: "WARNING",       label: "Warnings Only",         labelAr: "تحذيرات فقط" },
          { value: "SLEEP",         label: "Sleep Discrepancies",   labelAr: "نائم غير مسجل (Sleep)" },
          { value: "SKIP",          label: "Skip Discrepancies",    labelAr: "غادر دون تسجيل (Skip)" },
          { value: "OVERCROWDED",   label: "Overcrowded Rooms",     labelAr: "تجاوز السعة (تكدس)" },
          { value: "OOO_OCCUPIED",  label: "OOO With Occupants",    labelAr: "صيانة وبها نزيل" },
          { value: "STALE_DIRTY",   label: "Vacant Dirty Turnover", labelAr: "شاغرة متسخة معلقة" },
        ];
      case "housekeeping":
        return [
          { value: "dirty",         label: "Dirty — Needs Cleaning",  labelAr: "متسخة — تحتاج تنظيف" },
          { value: "occupied_dirty",label: "Occupied — Dirty",        labelAr: "مشغولة ومتسخة" },
          { value: "available",     label: "Available — Ready",       labelAr: "شاغرة — جاهزة" },
          { value: "occupied",      label: "Occupied — DND",          labelAr: "مشغولة — لا تزعج" },
          { value: "maintenance",   label: "Under Maintenance",       labelAr: "تحت الصيانة" },
          { value: "out_of_service",label: "Out of Service",          labelAr: "صيانة مؤقتة" },
          { value: "out_of_order",  label: "Out of Order",            labelAr: "خارج الخدمة" },
        ];
      case "housing":
        return [
          { value: "room_and_bed_vacant", label: "Room & Bed Vacant",                  labelAr: "روم آند بد فيكنت (غرف وأسِرّة شاغرة)" },
          { value: "room_vacant",         label: "Room Vacant (Only Full Rooms)",      labelAr: "روم فيكنت (غرف فارغة بالكامل)" },
          { value: "bed_vacant",          label: "Bed Vacant (Only Vacant Beds)",      labelAr: "بد فيكنت (أسِرّة شاغرة)" },
          { value: "occupied",            label: "Occupied",                           labelAr: "مشغولة" },
          { value: "dirty",               label: "Dirty",                              labelAr: "متسخة (تحتاج تنظيف)" },
          { value: "occupied_dirty",      label: "Occupied — Dirty",                   labelAr: "مشغولة ومتسخة" },
          { value: "maintenance",         label: "Maintenance",                        labelAr: "صيانة" },
          { value: "out_of_service",      label: "Out of Service",                     labelAr: "صيانة مؤقتة" },
          { value: "out_of_order",        label: "Out of Order",                       labelAr: "خارج الخدمة" },
        ];
      case "vacant_rooms":
        return [
          { value: "room_and_bed_vacant", label: "Room & Bed Vacant",                  labelAr: "روم آند بد فيكنت (غرف وأسِرّة شاغرة)" },
          { value: "room_vacant",         label: "Room Vacant (Only Full Rooms)",      labelAr: "روم فيكنت (غرف فارغة بالكامل)" },
          { value: "bed_vacant",          label: "Bed Vacant (Only Vacant Beds)",      labelAr: "بد فيكنت (أسِرّة شاغرة)" },
          { value: "dirty",               label: "Dirty (Needs Cleaning)",             labelAr: "متسخة (تحتاج تنظيف)" },
        ];
      case "assignments":
        return [
          { value: "all",          label: "All Current Occupants",labelAr: "الكل (المقيمين حالياً)" },
          { value: "ACTIVE",       label: "Active In-House",      labelAr: "مقيم بالسكن" },
          { value: "VACATION",     label: "On Vacation",          labelAr: "في إجازة" },
          { value: "CHECKED_OUT",  label: "Checked-Out / Past",   labelAr: "سجل المغادرين" },
          { value: "TRANSFERRED",  label: "Transferred",          labelAr: "تم النقل" },
          { value: "ALL_HISTORY",  label: "All (Including History)", labelAr: "الكل (شامل المغادرين)" },
        ];
      case "profiles":
        return [
          { value: "ACTIVE",       label: "Active — In-House",    labelAr: "نشط / مقيم بالسكن" },
          { value: "VACATION",     label: "On Vacation",          labelAr: "في إجازة" },
          { value: "CHECKED_OUT",  label: "Checked-Out / Left",   labelAr: "مغادر" },
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
          { value: "open",        label: "Open",                  labelAr: "مفتوح" },
          { value: "in_progress", label: "In Progress",           labelAr: "قيد التنفيذ" },
          { value: "on_hold",     label: "On Hold",               labelAr: "معلّق" },
          { value: "resolved",    label: "Resolved",              labelAr: "تم الحل" },
          { value: "closed",      label: "Closed",                labelAr: "مغلق" },
          { value: "cancelled",   label: "Cancelled",             labelAr: "ملغي" },
        ];
      case "reservations":
        return [
          { value: "UPCOMING",    label: "Future",                labelAr: "حجز مستقبلي" },
          { value: "CHECKED_IN",  label: "Checked-In",            labelAr: "تم التسكين" },
          { value: "NO_SHOW",     label: "No Show",               labelAr: "لم يحضر (نو شو)" },
          { value: "WAITLISTED",  label: "Waitlisted",            labelAr: "قائمة انتظار" },
          { value: "CANCELLED",   label: "Cancelled",             labelAr: "ملغي" },
          { value: "COMPLETED",   label: "Completed",             labelAr: "منتهي" },
        ];
      case "equipment_inventory":
        return [
          { value: "good",         label: "Good / Excellent",     labelAr: "سليم / ممتاز" },
          { value: "fair",         label: "Fair / Working",       labelAr: "مقبول / يعمل" },
          { value: "needs_repair", label: "Needs Repair",         labelAr: "بحاجة لصيانة" },
          { value: "damaged",      label: "Damaged / Broken",     labelAr: "تالف / معطل" },
          { value: "missing",      label: "Missing / Lost",       labelAr: "مفقود / ناقص" },
        ];
      case "policy_exceptions":
        return [
          { value: "OPEN",        label: "Active Violations (Unresolved)", labelAr: "مخالفات قائمة حالياً (غير مصححة)" },
          { value: "RESOLVED",    label: "Corrected & Resolved",          labelAr: "مخالفات تم تصحيحها ومعالجتها" },
          { value: "APPROVED",    label: "Approved Exceptions Only",      labelAr: "استثناءات معتمدة رسمياً فقط" },
          { value: "UNAPPROVED",  label: "All Unapproved Violations",     labelAr: "كافة المخالفات غير المعتمدة" },
          { value: "CRITICAL",    label: "Critical Severity Only",        labelAr: "مستوى خطورة حرج فقط" },
          { value: "HIGH",        label: "High Severity Only",            labelAr: "مستوى خطورة مرتفع" },
          { value: "MEDIUM",      label: "Medium Severity Only",          labelAr: "مستوى خطورة متوسط" },
        ];
      case "vacations":
        return [
          { value: "ON_VACATION", label: "On Vacation",             labelAr: "في إجازة حالياً" },
          { value: "COMPLETED",   label: "Returned to Work",        labelAr: "عاد للعمل" },
          { value: "OVERDUE",     label: "Overdue Return",          labelAr: "متأخر عن العودة" },
        ];
      default:
        return [];
    }
  };

  const statusOptions = getStatusOptions();
  const showBuildingFloor = ["housing", "vacant_rooms", "assignments", "profiles", "maintenance", "hostings", "housekeeping", "equipment_inventory", "policy_exceptions", "vacations", "water_distribution", "department_occupancy"].includes(activeTab);
  const showEmploymentType = ["assignments", "profiles", "analytics", "vacations", "water_distribution"].includes(activeTab);
  const showRoomType = [
    "housing",
    "vacant_rooms",
    "assignments",
    "reservations",
    "housekeeping_sheet",
    "housekeeping",
    "room_discrepancy",
    "arrivals_manifest",
    "departures_manifest",
    "daily_movement",
    "vacations",
  ].includes(activeTab);
  const showDepartment = ["assignments", "profiles", "reservations", "hostings", "expiring_contracts", "policy_exceptions", "vacations", "water_distribution", "department_occupancy"].includes(activeTab);
  const showGender = ["housing", "vacant_rooms", "assignments", "profiles", "expiring_contracts", "vacations", "water_distribution", "department_occupancy"].includes(activeTab);
  const showNationality = ["assignments", "profiles", "expiring_contracts", "vacations", "water_distribution", "department_occupancy"].includes(activeTab);
  const showCategory = activeTab === "maintenance" || activeTab === "equipment_inventory" || activeTab === "policy_exceptions";

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

        <div className="flex items-center gap-2 flex-wrap">
          {activeTab === "assignments" && setInHouseViewMode && (
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <Button
                type="button"
                size="sm"
                variant={inHouseViewMode === "grouped" ? "default" : "ghost"}
                className="h-8 px-3 text-xs font-semibold gap-1.5"
                onClick={() => setInHouseViewMode("grouped")}
              >
                <Layers className="w-3.5 h-3.5" />
                {ar ? "مجمّع حسب الغرف" : "By Room"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={inHouseViewMode === "flat" ? "default" : "ghost"}
                className="h-8 px-3 text-xs font-semibold gap-1.5"
                onClick={() => setInHouseViewMode("flat")}
              >
                <LayoutList className="w-3.5 h-3.5" />
                {ar ? "جدول تفصيلي بالنزلاء" : "Flat Table"}
              </Button>
            </div>
          )}

          {activeTab === "equipment_inventory" && setInventoryViewMode && (
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <Button
                type="button"
                size="sm"
                variant={inventoryViewMode === "summary" ? "default" : "ghost"}
                className="h-8 px-3 text-xs font-semibold gap-1.5"
                onClick={() => setInventoryViewMode("summary")}
              >
                <Layers className="w-3.5 h-3.5" />
                {ar ? "إجمالي مجمّع" : "Aggregated"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={inventoryViewMode === "detailed" ? "default" : "ghost"}
                className="h-8 px-3 text-xs font-semibold gap-1.5"
                onClick={() => setInventoryViewMode("detailed")}
              >
                <LayoutList className="w-3.5 h-3.5" />
                {ar ? "تفصيلي حسب الغرف" : "By Room"}
              </Button>
            </div>
          )}

          {activeTab === "water_distribution" && setWaterSortMode && (
            <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
              <Button
                type="button"
                size="sm"
                variant={waterSortMode === "room" ? "default" : "ghost"}
                className="h-8 px-3 text-xs font-semibold gap-1.5"
                onClick={() => setWaterSortMode("room")}
              >
                <Layers className="w-3.5 h-3.5" />
                {ar ? "ترتيب حسب الغرف" : "By Room"}
              </Button>
              <Button
                type="button"
                size="sm"
                variant={waterSortMode === "department" ? "default" : "ghost"}
                className="h-8 px-3 text-xs font-semibold gap-1.5"
                onClick={() => setWaterSortMode("department")}
              >
                <LayoutList className="w-3.5 h-3.5" />
                {ar ? "ترتيب حسب الأقسام" : "By Department"}
              </Button>
            </div>
          )}

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
                <SelectItem value="all">{ar ? "كافة الفئات" : "All Types"}</SelectItem>
                <SelectItem value="INTERNAL">{ar ? "موظف داخلي" : "Internal Staff"}</SelectItem>
                <SelectItem value="THIRD_PARTY">{ar ? "طرف ثالث" : "Third-Party"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Room Type & Capacity Filter */}
        {showRoomType && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "نوع وسعة الغرفة" : "Room Type & Beds"}</Label>
            <Select value={filterRoomType} onValueChange={setFilterRoomType}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الأنواع والسعات" : "All Types & Beds"} />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">{ar ? "كل الأنواع والسعات" : "All Types & Beds"}</SelectItem>
                
                <SelectGroup>
                  <SelectLabel className="text-[11px] font-bold text-primary px-2 pt-1 pb-0.5">
                    {ar ? "حسب عدد الأسرة (السعة):" : "By Bed Count / Capacity:"}
                  </SelectLabel>
                  <SelectItem value="single">{ar ? "غرفة سرير واحد (فردي)" : "1 Bed (Single)"}</SelectItem>
                  <SelectItem value="double">{ar ? "غرفة سريرين (مزدوج)" : "2 Beds (Double)"}</SelectItem>
                  <SelectItem value="triple">{ar ? "غرفة 3 أسرة (ثلاثي)" : "3 Beds (Triple)"}</SelectItem>
                  <SelectItem value="quad">{ar ? "غرفة 4 أسرة (رباعي)" : "4 Beds (Quad)"}</SelectItem>
                  <SelectItem value="5">{ar ? "غرفة 5 أسرة (خماسي)" : "5 Beds (Quint)"}</SelectItem>
                  <SelectItem value="6+">{ar ? "غرفة 6 أسرة فأكثر" : "6+ Beds"}</SelectItem>
                </SelectGroup>

                {dynamicRoomTypes.length > 0 && (
                  <>
                    <SelectSeparator />
                    <SelectGroup>
                      <SelectLabel className="text-[11px] font-bold text-primary px-2 pt-1 pb-0.5">
                        {ar ? "حسب تصنيف الغرفة:" : "By Room Category:"}
                      </SelectLabel>
                      {dynamicRoomTypes.map((t) => (
                        <SelectItem key={t} value={t}>
                          {t}
                        </SelectItem>
                      ))}
                    </SelectGroup>
                  </>
                )}
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
            <Label className="text-[11px] font-bold text-muted-foreground">
              {activeTab === "policy_exceptions"
                ? ar ? "موقف المخالفة والتصحيح" : "Violation & Correction Status"
                : ar ? "الحالة" : "Status"}
            </Label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue
                  placeholder={
                    activeTab === "policy_exceptions"
                      ? ar ? "الكل (المخالفات القائمة والمصححة)" : "All (Active & Resolved)"
                      : ar ? "كل الحالات" : "All Status"
                  }
                />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">
                  {activeTab === "policy_exceptions"
                    ? ar ? "كافة الحالات (القائمة والمصححة والمعتمدة)" : "All (Active, Resolved & Approved)"
                    : ar ? "كل الحالات" : "All Status"}
                </SelectItem>
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

        {/* Category (Maintenance, Equipment Inventory, or Policy Exceptions) */}
        {showCategory && (
          <div className="space-y-1">
            <Label className="text-[11px] font-bold text-muted-foreground">
              {activeTab === "equipment_inventory"
                ? ar ? "تصنيف المعدات" : "Equipment Category"
                : activeTab === "policy_exceptions"
                ? ar ? "نوع المخالفة / السياسة" : "Violation / Policy Type"
                : ar ? "فئة الصيانة" : "Category"}
            </Label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className="h-9 text-xs">
                <SelectValue
                  placeholder={
                    activeTab === "policy_exceptions"
                      ? ar ? "كافة أنواع السياسات" : "All Policies & Types"
                      : ar ? "كل الفئات" : "All Categories"
                  }
                />
              </SelectTrigger>
              <SelectContent className="max-h-80">
                <SelectItem value="all">
                  {activeTab === "policy_exceptions"
                    ? ar ? "كافة أنواع السياسات والمخالفات" : "All Policies & Violations"
                    : ar ? "كل الفئات" : "All Categories"}
                </SelectItem>
                {activeTab === "equipment_inventory" ? (
                  <>
                    <SelectItem value="appliances">{ar ? "أجهزة كهربائية وتكييف (Electric / Appliances)" : "Electric & Appliances"}</SelectItem>
                    <SelectItem value="other">{ar ? "أخرى (Other)" : "Other"}</SelectItem>
                    <SelectItem value="electronics">{ar ? "أجهزة إلكترونية وشاشات (Electronics)" : "Electronics & Screens"}</SelectItem>
                    <SelectItem value="furniture">{ar ? "أثاث وغرف نوم (Furniture)" : "Furniture"}</SelectItem>
                    <SelectItem value="fixtures">{ar ? "مرافق وتجهيزات (Fixtures & Safes)" : "Fixtures & Safes"}</SelectItem>
                    <SelectItem value="linen">{ar ? "مفروشات وبياضات (Linen & Bedding)" : "Linen & Bedding"}</SelectItem>
                  </>
                ) : activeTab === "policy_exceptions" ? (
                  <>
                    <SelectItem value="capacity">{ar ? "تجاوز سعة الدرجة الوظيفية (Capacity & Level)" : "Level Capacity Exceeded"}</SelectItem>
                    <SelectItem value="department">{ar ? "خلط الأقسام بالغرفة (Department Mixing)" : "Department Mixing"}</SelectItem>
                    <SelectItem value="entire_room">{ar ? "حجز غرفة كاملة غير مصرح (Entire Room)" : "Unauthorized Entire Room"}</SelectItem>
                    <SelectItem value="gender">{ar ? "مخالفة فصل الجنسين الصارمة (Gender)" : "Gender Segregation Violation"}</SelectItem>
                    <SelectItem value="family">{ar ? "مخالفة سكن العائلات الصارمة (Family)" : "Family Housing Violation"}</SelectItem>
                    <SelectItem value="contract">{ar ? "انتهاء عقد العمل مع الإقامة (Contract)" : "Contract Expiry Overstay"}</SelectItem>
                    <SelectItem value="smoking">{ar ? "تعارض سياسة التدخين (Smoking)" : "Smoking Policy Mismatch"}</SelectItem>
                    <SelectItem value="dnr">{ar ? "حظر الجمع بين نزلاء (DNR Mutual Exclusion)" : "Do Not Room Together (DNR)"}</SelectItem>
                    <SelectItem value="visit">{ar ? "تجاوز مدة الزيارة العائلية (Visit Overstay)" : "Family Visit Overstay"}</SelectItem>
                  </>
                ) : (
                  <>
                    <SelectItem value="plumbing">{ar ? "سباكة" : "Plumbing"}</SelectItem>
                    <SelectItem value="electrical">{ar ? "كهرباء" : "Electrical"}</SelectItem>
                    <SelectItem value="hvac">{ar ? "تكييف وتبريد" : "HVAC"}</SelectItem>
                    <SelectItem value="carpentry">{ar ? "نجارة" : "Carpentry"}</SelectItem>
                    <SelectItem value="general">{ar ? "عامة" : "General"}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Date From */}
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "من تاريخ" : "From Date"}</Label>
          <DateInput value={dateFrom} onChange={(iso) => setDateFrom(iso)} className="h-9 text-xs bg-background" />
        </div>

        {/* Date To */}
        <div className="space-y-1">
          <Label className="text-[11px] font-bold text-muted-foreground">{ar ? "إلى تاريخ" : "To Date"}</Label>
          <DateInput value={dateTo} onChange={(iso) => setDateTo(iso)} className="h-9 text-xs bg-background" />
        </div>
      </div>
    </div>
  );
}
