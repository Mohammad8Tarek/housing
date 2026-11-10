// Multi-criteria filters and search.
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import type { ReportConfigurationPageState } from "./useReportConfigurationPageState";

export function renderFiltersPanel(s: ReportConfigurationPageState) {
  const { ar, selectedSource, searchTerm, setSearchTerm, filterBuilding, setFilterBuilding, filterFloor, setFilterFloor, filterDepartment, setFilterDepartment, filterJobLevel, setFilterJobLevel, filterGender, setFilterGender, filterStatus, setFilterStatus, dateFrom, setDateFrom, dateTo, setDateTo, setPage, buildings, availableFloors, departments } = s;
  return (
<div className="space-y-3">
        <h2 className="text-sm font-bold flex items-center gap-2 text-foreground">
          <span className="w-6 h-6 rounded-lg bg-primary/10 text-primary font-black text-xs flex items-center justify-center">
            3
          </span>
          {ar ? "الفلاتر والبحث المتقدم (Multi-Criteria Filters)" : "Multi-Criteria Filters & Search"}
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 bg-card border rounded-2xl p-4">
          {/* Search Box */}
          <div className="space-y-1 col-span-1 sm:col-span-2">
            <Label className="text-xs font-medium">{ar ? "بحث سريع بالاسم / الرقم / الغرفة" : "Search Name, ID, Room"}</Label>
            <div className="relative">
              <Search className="w-4 h-4 absolute start-2.5 top-2.5 text-muted-foreground" />
              <Input
                value={searchTerm}
                onChange={(e) => {
                  setSearchTerm(e.target.value);
                  setPage(1);
                }}
                placeholder={ar ? "ابحث بالاسم، الرقم الوظيفي، الغرفة..." : "Search..."}
                className="ps-8 text-xs h-9"
              />
              {searchTerm && (
                <button
                  onClick={() => setSearchTerm("")}
                  className="absolute end-2.5 top-2.5 text-muted-foreground hover:text-foreground text-xs"
                >
                  ✕
                </button>
              )}
            </div>
          </div>

          {/* Building Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "المبنى" : "Building"}</Label>
            <Select
              value={filterBuilding}
              onValueChange={(val) => {
                setFilterBuilding(val);
                setFilterFloor("all");
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
                {buildings.map((b: any) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Floor Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "الدور / الطابق" : "Floor"}</Label>
            <Select
              value={filterFloor}
              onValueChange={(val) => {
                setFilterFloor(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الأدوار" : "All Floors"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأدوار" : "All Floors"}</SelectItem>
                {availableFloors.map((f: any) => (
                  <SelectItem key={f.id} value={String(f.id)}>
                    {ar ? `الدور ${f.number}` : `Floor ${f.number}`}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Department Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "القسم" : "Department"}</Label>
            <Select
              value={filterDepartment}
              onValueChange={(val) => {
                setFilterDepartment(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الأقسام" : "All Departments"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الأقسام" : "All Departments"}</SelectItem>
                {departments.map((d: string) => (
                  <SelectItem key={d} value={d}>
                    {d}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Job Level Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "الدرجة الوظيفية" : "Job Level"}</Label>
            <Select
              value={filterJobLevel}
              onValueChange={(val) => {
                setFilterJobLevel(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "كل الدرجات" : "All Levels"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الدرجات" : "All Levels"}</SelectItem>
                <SelectItem value="0">{ar ? "Level 0 - إدارة عليا (GM)" : "Level 0 - Executive"}</SelectItem>
                <SelectItem value="1">{ar ? "Level 1 - مدراء أقسام (Dept Head)" : "Level 1 - Dept Head"}</SelectItem>
                <SelectItem value="2">{ar ? "Level 2 - مشرفين (Supervisors)" : "Level 2 - Supervisors"}</SelectItem>
                <SelectItem value="3">{ar ? "Level 3 - موظفي تشغيل (Staff)" : "Level 3 - Staff"}</SelectItem>
                <SelectItem value="4">{ar ? "Level 4 - عمالة مساعدة (Support)" : "Level 4 - Support"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Gender Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "النوع" : "Gender"}</Label>
            <Select
              value={filterGender}
              onValueChange={(val) => {
                setFilterGender(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "الكل" : "All Genders"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "الكل" : "All"}</SelectItem>
                <SelectItem value="MALE">{ar ? "ذكور" : "Male"}</SelectItem>
                <SelectItem value="FEMALE">{ar ? "إناث" : "Female"}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Status Filter */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "الحالة" : "Status"}</Label>
            <Select
              value={filterStatus}
              onValueChange={(val) => {
                setFilterStatus(val);
                setPage(1);
              }}
            >
              <SelectTrigger className="h-9 text-xs">
                <SelectValue placeholder={ar ? "الكل" : "All Status"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الحالات" : "All Status"}</SelectItem>
                {selectedSource === "in_house" && (
                  <>
                    <SelectItem value="ACTIVE">{ar ? "نشط بالسكن" : "Active"}</SelectItem>
                    <SelectItem value="VACATION">{ar ? "في إجازة" : "On Vacation"}</SelectItem>
                    <SelectItem value="COMPLETED">{ar ? "غادر / منتهي" : "Checked Out"}</SelectItem>
                  </>
                )}
                {selectedSource === "rooms" && (
                  <>
                    <SelectItem value="room_and_bed_vacant">{ar ? "روم آند بد فيكنت (الكل)" : "Room & Bed Vacant"}</SelectItem>
                    <SelectItem value="room_vacant">{ar ? "روم فيكنت (فارغة بالكامل)" : "Room Vacant (Only Full Rooms)"}</SelectItem>
                    <SelectItem value="bed_vacant">{ar ? "بد فيكنت (أسِرّة شاغرة)" : "Bed Vacant (Only Vacant Beds)"}</SelectItem>
                    <SelectItem value="occupied">{ar ? "مشغول بالكامل" : "Occupied"}</SelectItem>
                    <SelectItem value="dirty">{ar ? "متسخ" : "Dirty"}</SelectItem>
                    <SelectItem value="out_of_service">{ar ? "خارج الخدمة" : "Out of Service"}</SelectItem>
                  </>
                )}
                {selectedSource === "maintenance" && (
                  <>
                    <SelectItem value="open">{ar ? "مفتوح / قيد المتابعة" : "Open"}</SelectItem>
                    <SelectItem value="in_progress">{ar ? "جاري الإصلاح" : "In Progress"}</SelectItem>
                    <SelectItem value="resolved">{ar ? "تم الإصلاح" : "Resolved"}</SelectItem>
                  </>
                )}
                {selectedSource === "reservations" && (
                  <>
                    <SelectItem value="pending">{ar ? "معلق" : "Pending"}</SelectItem>
                    <SelectItem value="confirmed">{ar ? "مؤكد" : "Confirmed"}</SelectItem>
                    <SelectItem value="cancelled">{ar ? "ملغي" : "Cancelled"}</SelectItem>
                  </>
                )}
                {selectedSource === "vacations" && (
                  <>
                    <SelectItem value="ACTIVE">{ar ? "في إجازة حالياً" : "On Vacation"}</SelectItem>
                    <SelectItem value="RETURNED">{ar ? "عاد للعمل" : "Returned"}</SelectItem>
                    <SelectItem value="OVERDUE">{ar ? "متأخر عن العودة" : "Overdue"}</SelectItem>
                  </>
                )}
                {selectedSource === "hostings" && (
                  <>
                    <SelectItem value="approved">{ar ? "معتمد" : "Approved"}</SelectItem>
                    <SelectItem value="pending">{ar ? "قيد المراجعة" : "Pending"}</SelectItem>
                    <SelectItem value="completed">{ar ? "منتهي" : "Completed"}</SelectItem>
                  </>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Date From */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "من تاريخ" : "From Date"}</Label>
            <DateInput
              value={dateFrom}
              onChange={(iso) => {
                setDateFrom(iso);
                setPage(1);
              }}
              placeholder={ar ? "يوم / شهر / سنة" : "DD/MM/YYYY"}
              className="h-9 text-xs bg-background"
            />
          </div>

          {/* Date To */}
          <div className="space-y-1">
            <Label className="text-xs font-medium">{ar ? "إلى تاريخ" : "To Date"}</Label>
            <DateInput
              value={dateTo}
              onChange={(iso) => {
                setDateTo(iso);
                setPage(1);
              }}
              min={dateFrom}
              placeholder={ar ? "يوم / شهر / سنة" : "DD/MM/YYYY"}
              className="h-9 text-xs bg-background"
            />
          </div>
        </div>
      </div>
  );
}
