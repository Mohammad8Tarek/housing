import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Search, Calendar, RefreshCw } from "lucide-react";

export function ReportFilters({
  ar, activeTab, properties, propId, buildings, floors, floorOptions, departments, nationalities,
  filterProperty, setFilterProperty,
  filterBuilding, setFilterBuilding,
  filterFloor, setFilterFloor,
  filterStatus, setFilterStatus,
  filterCategory, setFilterCategory,
  filterDepartment, setFilterDepartment,
  filterGender, setFilterGender,
  filterNationality, setFilterNationality,
  search, setSearch,
  dateFrom, setDateFrom,
  dateTo, setDateTo,
  resetReportFilters, hasActiveReportFilters,
  currentDataLength, selectedRowsSize
}: any) {
  const filterFieldClass = "min-w-0 space-y-1.5";
  const filterLabelClass = "flex min-h-4 items-center gap-1 truncate text-[11px] font-bold uppercase tracking-normal text-muted-foreground/80";
  const filterControlClass = "h-9 w-full bg-background text-sm";

  const getStatusOptions = (): { value: string; label: string }[] => {
    switch (activeTab) {
      case "housing": return [{ value: "available", label: "Available" }, { value: "occupied", label: "Occupied" }, { value: "maintenance", label: "Maintenance" }];
      case "employees": return [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }];
      case "assignments": return [{ value: "active", label: "Active" }, { value: "checked_out", label: "Checked Out" }];
      case "hostings": return [{ value: "pending", label: "Pending" }, { value: "approved", label: "Approved" }, { value: "active", label: "Active" }, { value: "completed", label: "Completed" }, { value: "cancelled", label: "Cancelled" }];
      case "maintenance": return [{ value: "open", label: "Open" }, { value: "in_progress", label: "In Progress" }, { value: "resolved", label: "Resolved" }];
      case "reservations": return [{ value: "pending", label: "Pending" }, { value: "confirmed", label: "Confirmed" }, { value: "checked_in", label: "Checked In" }, { value: "checked_out", label: "Checked Out" }, { value: "cancelled", label: "Cancelled" }];
      default: return [];
    }
  };

  return (
    <div className="overflow-hidden rounded-lg border bg-card shadow-sm">
      <div className="flex flex-col gap-2 border-b px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-sm font-bold text-foreground">{ar ? "الفلاتر" : "Filters"}</h2>
        </div>
        <Badge variant="outline" className="h-8 w-fit px-3 text-xs font-semibold bg-muted/40">
          {currentDataLength} {ar ? "سجل" : "records"}
          {selectedRowsSize > 0 && (
            <span className={ar ? "mr-1.5 text-primary" : "ml-1.5 text-primary"}>
              | {selectedRowsSize} {ar ? "محدد" : "selected"}
            </span>
          )}
        </Badge>
      </div>

      <div className="grid gap-3 p-4 [grid-template-columns:repeat(auto-fit,minmax(180px,1fr))]">
        {properties.length > 1 && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "العقار" : "Property"}</label>
            <Select
              value={filterProperty}
              onValueChange={(v) => {
                setFilterProperty(v); setFilterBuilding("all"); setFilterFloor("all");
                setFilterStatus("all"); setFilterCategory("all"); setFilterDepartment("all");
                setFilterGender("all"); setFilterNationality("all"); setSearch(""); setDateFrom(""); setDateTo("");
              }}
            >
              <SelectTrigger className={filterControlClass}>
                <SelectValue placeholder={ar ? "اختر العقار" : "Select Property"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "العقار النشط" : "Active Property"}</SelectItem>
                {properties.map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {propId && (
              <p className="text-[10px] text-muted-foreground truncate block">
                {ar ? "الحالي: " : "Now: "}
                {properties.find((p: any) => p.id === propId)?.name ?? `#${propId}`}
              </p>
            )}
          </div>
        )}

        {activeTab === "maintenance" && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "التصنيف" : "Category"}</label>
            <Select value={filterCategory} onValueChange={setFilterCategory}>
              <SelectTrigger className={filterControlClass}><SelectValue placeholder="All" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
                <SelectItem value="maintenance">{ar ? "صيانة" : "Maintenance"}</SelectItem>
                <SelectItem value="housekeeping">{ar ? "هاوس كيبنج" : "Housekeeping"}</SelectItem>
                <SelectItem value="general">{ar ? "عام" : "General"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        )}

        {["housing", "assignments", "maintenance", "hostings"].includes(activeTab) && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "المبنى" : "Building"}</label>
            <Select value={filterBuilding} onValueChange={(v) => { setFilterBuilding(v); setFilterFloor("all"); }}>
              <SelectTrigger className={filterControlClass}><SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
                {buildings.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>{b.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {["housing", "assignments", "maintenance", "hostings"].includes(activeTab) && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "الدور" : "Floor"}</label>
            <Select value={filterFloor} onValueChange={setFilterFloor} disabled={filterBuilding === "all" && floorOptions.length === 0}>
              <SelectTrigger className={filterControlClass}><SelectValue placeholder={ar ? "كل الأدوار" : "All Floors"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأدوار" : "All Floors"}</SelectItem>
                {floorOptions.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>{f.name || f.floorNumber || `Floor ${f.id}`}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {getStatusOptions().length > 0 && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "الحالة" : "Status"}</label>
            <Select value={filterStatus} onValueChange={setFilterStatus}>
              <SelectTrigger className={filterControlClass}><SelectValue placeholder={ar ? "كل الحالات" : "All Statuses"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "All Statuses"}</SelectItem>
                {getStatusOptions().map((s) => (
                  <SelectItem key={s.value} value={s.value}>{s.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {["employees", "assignments", "reservations", "hostings"].includes(activeTab) && departments.length > 0 && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "القسم" : "Department"}</label>
            <Select value={filterDepartment} onValueChange={setFilterDepartment}>
              <SelectTrigger className={filterControlClass}><SelectValue placeholder={ar ? "كل الأقسام" : "All Departments"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأقسام" : "All Departments"}</SelectItem>
                {departments.map((d: any) => (
                  <SelectItem key={d} value={d}>{d}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {["employees", "housing", "assignments", "hostings"].includes(activeTab) && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "النوع" : "Gender"}</label>
            <Select value={filterGender} onValueChange={setFilterGender}>
              <SelectTrigger className={filterControlClass}><SelectValue placeholder={ar ? "الكل" : "All"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "All Genders"}</SelectItem>
                <SelectItem value="male">{ar ? "ذكور" : "Male"}</SelectItem>
                <SelectItem value="female">{ar ? "إناث" : "Female"}</SelectItem>
                {activeTab === "housing" && <SelectItem value="mixed">{ar ? "مختلط" : "Mixed"}</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        )}

        {activeTab === "employees" && nationalities.length > 0 && (
          <div className={filterFieldClass}>
            <label className={filterLabelClass}>{ar ? "الجنسية" : "Nationality"}</label>
            <Select value={filterNationality} onValueChange={setFilterNationality}>
              <SelectTrigger className={filterControlClass}><SelectValue placeholder={ar ? "الكل" : "All"} /></SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "All Nationalities"}</SelectItem>
                {nationalities.map((n: any) => (
                  <SelectItem key={n} value={n}>{n}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        <div className={`${filterFieldClass} sm:col-span-2`}>
          <label className={filterLabelClass}>{ar ? "بحث" : "Search"}</label>
          <div className="relative w-full">
            <Search className={`absolute top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground ${ar ? "right-2.5" : "left-2.5"}`} />
            <Input className={`${filterControlClass} ${ar ? "pr-8" : "pl-8"}`} placeholder={ar ? "ابحث هنا..." : "Search records..."} value={search} onChange={(e) => setSearch(e.target.value)} />
          </div>
        </div>

        {activeTab !== "housing" && (
          <>
            <div className={filterFieldClass}>
              <label className={filterLabelClass}>
                <Calendar className="w-3 h-3 text-muted-foreground/80" />
                {activeTab === "employees" ? (ar ? "التعيين من" : "Hired From") : (ar ? "من" : "From")}
              </label>
              <Input type="date" className={filterControlClass} value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
            </div>
            <div className={filterFieldClass}>
              <label className={filterLabelClass}>
                <Calendar className="w-3 h-3 text-muted-foreground/80" />
                {activeTab === "employees" ? (ar ? "التعيين إلى" : "Hired To") : (ar ? "إلى" : "To")}
              </label>
              <Input type="date" className={filterControlClass} value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
          </>
        )}
      </div>

      {hasActiveReportFilters && (
        <div className="flex flex-col gap-2 border-t px-4 py-3 sm:flex-row sm:items-center sm:justify-end">
          <Button variant="outline" size="sm" className="h-8 gap-2 text-xs text-muted-foreground hover:text-foreground" onClick={resetReportFilters}>
            <RefreshCw className="w-3.5 h-3.5" />
            {ar ? "تهيئة الفلاتر" : "Reset Filters"}
          </Button>
        </div>
      )}
    </div>
  );
}
