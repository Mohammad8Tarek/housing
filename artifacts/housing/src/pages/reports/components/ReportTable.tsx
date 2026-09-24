import { useState } from "react";
import { formatDate } from "@/lib/date-utils";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Bed, Building, Clock, AlertTriangle, CheckCircle2, Eye, PackageCheck, DoorClosed, Building2, Layers, User, Star } from "lucide-react";
import { roomStatusBadge, getRoomStatusLabel } from "@/pages/housing/utils";
import { SortableHead } from "@/components/ui/sortable-head";

export function ReportTable({
  isLoading,
  allData,
  paginatedData,
  selectedRows,
  setSelectedRows,
  activeTab,
  inventoryViewMode = "summary",
  ar,
  sort,
  onSortToggle,
  floorMap,
  buildingMap,
  empMap,
  roomMap,
  visibleCols,
}: any) {
  const isVis = (k: string) => !visibleCols || visibleCols.has(k);
  const [selectedItemRooms, setSelectedItemRooms] = useState<any | null>(null);
  const [waterCheckState, setWaterCheckState] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem("water_distribution_checks");
      return saved ? JSON.parse(saved) : {};
    } catch {
      return {};
    }
  });

  const toggleWaterCheck = (key: string, val: boolean) => {
    setWaterCheckState((prev) => {
      const next = { ...prev, [key]: val };
      try {
        localStorage.setItem("water_distribution_checks", JSON.stringify(next));
      } catch {
        /* ignore */
      }
      return next;
    });
  };
  const H = (sortKey: string, label: React.ReactNode, className?: string) => (
    <SortableHead
      label={label}
      sortKey={sortKey}
      activeKey={sort?.key ?? null}
      dir={sort?.dir ?? "asc"}
      onToggle={onSortToggle ?? (() => {})}
      className={className}
    />
  );
  if (isLoading) {
    return (
      <div className="space-y-2 p-4">
        {Array.from({ length: 8 }).map((_, i) => (
          <Skeleton key={i} className="h-12 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (!paginatedData || paginatedData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground">
        <Building className="w-10 h-10 mb-3 opacity-30" />
        <p className="font-semibold text-base">
          {ar ? "لا توجد سجلات مطابقة للفلاتر المحددة" : "No records found matching filters"}
        </p>
        <p className="text-xs mt-1">
          {ar ? "جرب تغيير خيارات الفلترة أو البحث" : "Try adjusting your filter options or search query"}
        </p>
      </div>
    );
  }

  const isAllSelected =
    paginatedData.length > 0 &&
    paginatedData.every((r: any) => selectedRows.has(r.id));

  const toggleAll = (checked: boolean) => {
    if (checked) {
      const next = new Set(selectedRows);
      paginatedData.forEach((r: any) => next.add(r.id));
      setSelectedRows(next);
    } else {
      const next = new Set(selectedRows);
      paginatedData.forEach((r: any) => next.delete(r.id));
      setSelectedRows(next);
    }
  };

  const toggleOne = (id: number) => {
    const next = new Set(selectedRows);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedRows(next);
  };

  return (
    <div className="overflow-x-auto">
      <Table>
        <TableHeader>
          <TableRow className="bg-[#0F2A44] hover:bg-[#0F2A44] text-white">
            <TableHead className="w-10 px-3 text-white">
              <Checkbox
                className="border-white/50 data-[state=checked]:bg-white data-[state=checked]:text-[#0F2A44]"
                checked={isAllSelected}
                onCheckedChange={toggleAll}
              />
            </TableHead>

            {/* OPERA PMS: MANAGER FLASH HEADERS */}
            {activeTab === "manager_flash" && (
              <>
                {H("buildingName", ar ? "المبنى والكود" : "Building & Code")}
                {H("totalRooms", ar ? "إجمالي الغرف" : "Total Rooms", "text-center")}
                {H("totalBeds", ar ? "إجمالي الأسرة" : "Total Beds", "text-center")}
                {H("occupiedBeds", ar ? "المشغول" : "Occupied", "text-center")}
                {H("vacantBeds", ar ? "الشاغر" : "Vacant", "text-center")}
                {H("dirtyRooms", ar ? "متسخ" : "Dirty", "text-center")}
                {H("oooRooms", ar ? "صيانة OOO" : "OOO", "text-center")}
                {H("occupancyRate", ar ? "نسبة الإشغال" : "Occupancy Rate", "text-center")}
                {H("status", ar ? "الحالة التشغيلية" : "Operational Status")}
              </>
            )}

            {/* OPERA PMS: EXPECTED ARRIVALS HEADERS */}
            {activeTab === "arrivals_manifest" && (
              <>
                {H("profileName", ar ? "اسم النزيل / الحجز" : "Guest / Profile")}
                {H("department", ar ? "القسم والمسمى" : "Dept & Title")}
                {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
                {H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
                {H("checkInDate", ar ? "تاريخ الوصول (Due In)" : "Arrival (Due In)")}
                {H("checkOutDate", ar ? "تاريخ المغادرة" : "Check-Out")}
                {H("nights", ar ? "الليالي" : "Nights", "text-center")}
                {H("vipStatus", ar ? "الفئة" : "Category")}
                {H("status", ar ? "حالة الحجز" : "Reservation Status")}
              </>
            )}

            {/* OPERA PMS: DUE OUT & DEPARTURES HEADERS */}
            {activeTab === "departures_manifest" && (
              <>
                {H("profileName", ar ? "الموظف / النزيل" : "Resident / Profile")}
                {H("department", ar ? "القسم والمسمى" : "Dept & Title")}
                {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
                {H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
                {H("checkInDate", ar ? "تاريخ التسكين" : "Check-In")}
                {H("checkOutDate", ar ? "المغادرة المستحقة (Due Out)" : "Due Out Date")}
                {H("departureCategory", ar ? "نوع المغادرة" : "Departure Type")}
                {H("reason", ar ? "السبب / ملاحظات HR" : "Reason / Notes")}
                {H("roomStatusAfter", ar ? "حالة الغرفة" : "Room Status")}
              </>
            )}

            {/* OPERA PMS: HOUSEKEEPING ATTENDANT TASK SHEET HEADERS */}
            {activeTab === "housekeeping_sheet" && (
              <>
                {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
                {H("roomNumber", ar ? "الغرفة" : "Room")}
                {H("foStatus", ar ? "حالة الإشغال (FO)" : "FO Status", "text-center")}
                {H("hkStatus", ar ? "حالة النظافة (HK)" : "HK Status")}
                {H("taskType", ar ? "نوع المهمة المطلوبة" : "Task Assignment")}
                {H("occupantNames", ar ? "النزلاء الحاليون" : "Current Occupants")}
                {H("linenCheck", ar ? "فحص المفروشات" : "Linen", "text-center w-28")}
                {H("amenitiesCheck", ar ? "فحص العهد" : "Amenities", "text-center w-28")}
                {H("signature", ar ? "التوقيع والوقت" : "Attendant Sign", "text-center w-32")}
              </>
            )}

            {/* OPERA PMS: ROOM DISCREPANCY HEADERS */}
            {activeTab === "room_discrepancy" && (
              <>
                {H("severity", ar ? "الخطورة" : "Severity", "text-center")}
                {H("type", ar ? "نوع التباين والفحص الميداني" : "Discrepancy Type")}
                {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
                {H("roomNumber", ar ? "الغرفة" : "Room")}
                {H("foStatus", ar ? "حالة الاستقبال (Front Office)" : "Front Office")}
                {H("hkStatus", ar ? "حالة النظافة الميدانية (HK)" : "Housekeeping")}
                {H("impactedResidents", ar ? "النزلاء المعنيون / الملاحظات" : "Impacted Residents / Details")}
                {H("recommendedAction", ar ? "الإجراء الفندقي الموصى به" : "Recommended Action")}
              </>
            )}

            {/* OPERA PMS: OCCUPANCY FORECAST HEADERS */}
            {activeTab === "occupancy_forecast" && (
              <>
                {H("dateDisplay", ar ? "التاريخ واليوم" : "Date & Day")}
                {H("dayArrivals", ar ? "الوصول المتوقع" : "Arrivals", "text-center")}
                {H("dayDepartures", ar ? "المغادرة المتوقعة" : "Departures", "text-center")}
                {H("netShift", ar ? "صافي الحركة" : "Net Shift", "text-center")}
                {H("projectedOccupied", ar ? "الأسرة المشغولة" : "Projected Occupied", "text-center")}
                {H("projectedVacant", ar ? "الأسرة الشاغرة" : "Projected Vacant", "text-center")}
                {H("occupancyRate", ar ? "نسبة الإشغال" : "Occupancy Rate", "text-center")}
                {H("demandLevel", ar ? "مستوى الضغط" : "Demand Level", "text-center")}
              </>
            )}

            {/* 1. ASSIGNMENTS HEADERS */}
            {activeTab === "assignments" && (
              <>
                {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Code")}
                {isVis("fullName") && H("fullName", ar ? "الموظف / المقيم" : "Occupant / Profile")}
                {isVis("employmentType") && H("employmentType", ar ? "نوع التوظيف" : "Employment")}
                {isVis("buildingName") && H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {isVis("roomNumber") && H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
                {isVis("department") && H("department", ar ? "القسم والمسمى" : "Dept & Title")}
                {isVis("level") && H("level", ar ? "الدرجة" : "Level")}
                {isVis("phone") && H("phone", ar ? "الهاتف" : "Phone")}
                {isVis("nationalId") && H("nationalId", ar ? "الرقم القومي" : "National ID")}
                {isVis("nationality") && H("nationality", ar ? "الجنسية" : "Nationality")}
                {isVis("gender") && H("gender", ar ? "الجنس" : "Gender")}
                {isVis("dateOfBirth") && H("dateOfBirth", ar ? "تاريخ الميلاد" : "Date of Birth")}
                {isVis("address") && H("address", ar ? "العنوان" : "Address")}
                {isVis("hireDate") && H("hireDate", ar ? "تاريخ التعيين" : "Hire Date")}
                {isVis("checkInDate") && H("checkInDate", ar ? "تاريخ التسكين" : "Check-In")}
                {isVis("contractEndDate") && H("contractEndDate", ar ? "انتهاء العقد" : "Contract End")}
                {isVis("expectedCheckOutDate") && H("expectedCheckOutDate", ar ? "المغادرة المتوقعة" : "Expected Out")}
                {isVis("email") && H("email", ar ? "البريد الإلكتروني" : "Email")}
                {isVis("emergencyContact") && H("emergencyContact", ar ? "هاتف الطوارئ" : "Emergency Contact")}
                {isVis("status") && H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 2. VACANT ROOMS HEADERS */}
            {activeTab === "vacant_rooms" && (
              <>
                {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
                {H("capacity", ar ? "السعة" : "Capacity", "text-center")}
                {H("currentOccupancy", ar ? "المشغول" : "Occupied", "text-center")}
                {H("vacantBedsCount", ar ? "الأسرة الشاغرة" : "Vacant Beds", "text-center")}
                {H("availableBedsText", ar ? "أرقام الأسرة المتاحة" : "Available Beds")}
                {H("genderPolicy", ar ? "سياسة الجنس" : "Gender Policy")}
                {H("status", ar ? "حالة الغرفة" : "Room Status")}
              </>
            )}

            {/* 3. HOUSING INVENTORY HEADERS */}
            {activeTab === "housing" && (
              <>
                {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("roomType", ar ? "النوع" : "Type")}
                {H("capacity", ar ? "السعة" : "Capacity", "text-center")}
                {H("currentOccupancy", ar ? "المشغول" : "Occupied", "text-center")}
                {H("vacantBeds", ar ? "الشاغر" : "Vacant", "text-center")}
                {H("occupancyRate", ar ? "نسبة الإشغال" : "Occupancy Rate", "text-center")}
                {H("genderPolicy", ar ? "سياسة الجنس" : "Gender Policy")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 4. PROFILES HEADERS */}
            {activeTab === "profiles" && (
              <>
                {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Employee Code")}
                {isVis("fullName") && H("fullName", ar ? "اسم الموظف" : "Employee Name")}
                {isVis("department") && H("department", ar ? "القسم" : "Department")}
                {isVis("jobTitle") && H("jobTitle", ar ? "الوظيفة" : "Job Title")}
                {isVis("level") && H("level", ar ? "الدرجة" : "Level", "text-center")}
                {isVis("assignedRoom") && H("assignedRoom", ar ? "السكن الحالي" : "Housing")}
                {isVis("employmentType") && H("employmentType", ar ? "نوع التوظيف" : "Employment")}
                {isVis("companyName") && H("companyName", ar ? "الشركة / جهة العمل" : "Company")}
                {isVis("phone") && H("phone", ar ? "الهاتف" : "Phone")}
                {isVis("nationalId") && H("nationalId", ar ? "الرقم القومي" : "National ID")}
                {isVis("nationality") && H("nationality", ar ? "الجنسية" : "Nationality")}
                {isVis("gender") && H("gender", ar ? "الجنس" : "Gender", "text-center")}
                {isVis("hireDate") && H("hireDate", ar ? "تاريخ التعيين" : "Hire Date")}
                {isVis("contractEndDate") && H("contractEndDate", ar ? "انتهاء العقد" : "Contract End")}
                {isVis("status") && H("status", ar ? "الحالة بالسكن" : "Status", "text-center")}
                {isVis("dateOfBirth") && H("dateOfBirth", ar ? "تاريخ الميلاد" : "Date of Birth")}
                {isVis("address") && H("address", ar ? "العنوان" : "Address")}
                {isVis("email") && H("email", ar ? "البريد الإلكتروني" : "Email")}
                {isVis("emergencyContact") && H("emergencyContact", ar ? "هاتف الطوارئ" : "Emergency Contact")}
              </>
            )}

            {/* 5. EXPIRING CONTRACTS HEADERS */}
            {activeTab === "expiring_contracts" && (
              <>
                {H("fullName", ar ? "الموظف" : "Employee")}
                {H("department", ar ? "القسم والوظيفة" : "Dept & Title")}
                {H("assignedRoom", ar ? "السكن الحالي" : "Current Housing")}
                {H("phone", ar ? "الهاتف" : "Phone")}
                {H("contractEndDate", ar ? "تاريخ انتهاء العقد" : "Contract End Date")}
                {H("daysRemaining", ar ? "الأيام المتبقية" : "Days Remaining", "text-center")}
                {H("expStatus", ar ? "حالة العقد" : "Contract Status")}
              </>
            )}

            {/* 6. RESERVATIONS HEADERS */}
            {activeTab === "reservations" && (
              <>
                {H("guestName", ar ? "اسم الضيف" : "Guest Name")}
                {H("nationalId", ar ? "الرقم القومي والهاتف" : "ID & Phone")}
                {H("department", ar ? "القسم والوظيفة" : "Dept & Title")}
                {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
                {H("roomNumber", ar ? "الغرفة المحجوزة" : "Reserved Room")}
                {H("checkInDate", ar ? "تاريخ الوصول" : "Arrival Date")}
                {H("checkOutDate", ar ? "تاريخ المغادرة" : "Check-Out")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 7. HOSTINGS HEADERS */}
            {activeTab === "hostings" && (
              <>
                {H("hostEmployee", ar ? "الموظف المستضيف" : "Host Employee")}
                {H("guestName", ar ? "اسم الضيف والصلة" : "Guest & Relation")}
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("checkInDate", ar ? "من تاريخ" : "Check-In")}
                {H("checkOutDate", ar ? "إلى تاريخ" : "Check-Out")}
                {H("dailyRate", ar ? "سعر اليوم" : "Daily Rate")}
                {H("totalAmount", ar ? "الإجمالي" : "Total Fee")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 8. MAINTENANCE HEADERS */}
            {activeTab === "maintenance" && (
              <>
                {H("buildingName", ar ? "المبنى والدور" : "Building & Floor")}
                {H("roomNumber", ar ? "الغرفة" : "Room No")}
                {H("reportedBy", ar ? "مقدم البلاغ (الطالب)" : "Reported By")}
                {H("category", ar ? "الفئة" : "Category")}
                {H("problemType", ar ? "نوع المشكلة" : "Problem Details")}
                {H("priority", ar ? "الأولوية" : "Priority")}
                {H("assignedTo", ar ? "الفني المعين" : "Assigned To")}
                {H("reportedAt", ar ? "تاريخ البلاغ" : "Reported At")}
                {H("rating", ar ? "التقييم (الريت)" : "Rating & Feedback")}
                {H("status", ar ? "الحالة" : "Status")}
              </>
            )}

            {/* 9. HOUSEKEEPING HEADERS */}
            {activeTab === "housekeeping" && (
              <>
                {H("buildingName", ar ? "المبنى والطابق" : "Building & Floor")}
                {H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {H("roomType", ar ? "نوع الغرفة" : "Room Type")}
                {H("capacity", ar ? "السعة" : "Cap", "text-center")}
                {H("currentOccupancy", ar ? "المشغول" : "Occ", "text-center")}
                {H("vacantBeds", ar ? "الأسرة الشاغرة" : "Vacant", "text-center")}
                {H("status", ar ? "حالة الغرفة" : "Room Status")}
                {H("hkPriority", ar ? "الإجراء المطلوب" : "HK Action")}
                {H("openHkTickets", ar ? "تذاكر مفتوحة" : "Open Tickets", "text-center")}
              </>
            )}

            {/* 10. EQUIPMENT INVENTORY HEADERS */}
            {activeTab === "equipment_inventory" && (
              inventoryViewMode === "summary" ? (
                <>
                  {H("itemName", ar ? "اسم العهدة / المعدة" : "Equipment / Item")}
                  {H("category", ar ? "التصنيف" : "Category")}
                  {H("totalQuantity", ar ? "إجمالي الكمية بالسكن" : "Total in Housing", "text-center")}
                  <TableHead className="text-start">{ar ? "الحالة التشغيلية" : "Condition Breakdown"}</TableHead>
                  {H("roomsCount", ar ? "عدد الغرف" : "Rooms Count", "text-center")}
                  <TableHead className="text-start">{ar ? "تفاصيل وتوزيع الغرف" : "Rooms Breakdown"}</TableHead>
                </>
              ) : (
                <>
                  {H("buildingName", ar ? "المبنى والموقع" : "Building & Location")}
                  {H("roomNumber", ar ? "الغرفة" : "Room")}
                  {H("itemName", ar ? "اسم المعدة / القطعة" : "Equipment / Item")}
                  {H("category", ar ? "التصنيف" : "Category")}
                  {H("quantity", ar ? "العدد" : "Qty", "text-center")}
                  {H("condition", ar ? "الحالة" : "Condition")}
                  {H("serialNumber", ar ? "الرقم التسلسلي / الكود" : "Serial / Asset Tag")}
                  {H("lastInspectedAt", ar ? "تاريخ الفحص" : "Last Inspected")}
                  {H("notes", ar ? "ملاحظات" : "Notes")}
                </>
              )
            )}

            {/* 11. DAILY MOVEMENT HEADERS */}
            {activeTab === "daily_movement" && (
              <>
                {H("movementType", ar ? "نوع الحركة" : "Movement Type")}
                {H("date", ar ? "التاريخ والوقت" : "Date & Time")}
                {H("profileName", ar ? "المقيم / النزيل" : "Resident / Profile")}
                {H("department", ar ? "القسم" : "Department")}
                {H("buildingName", ar ? "المبنى" : "Building")}
                {H("roomNumber", ar ? "الغرفة والسرير" : "Room & Bed")}
                {H("notes", ar ? "التفاصيل والملاحظات" : "Details & Notes")}
              </>
            )}

            {/* 12. DEPARTMENT OCCUPANCY HEADERS */}
            {activeTab === "department_occupancy" && (
              <>
                {H("department", ar ? "القسم الإداري" : "Department")}
                {H("residentCount", ar ? "إجمالي المقيمين" : "Total Residents", "text-center")}
                {H("maleCount", ar ? "ذكور" : "Males", "text-center")}
                {H("femaleCount", ar ? "إناث" : "Females", "text-center")}
                {H("roomsCount", ar ? "الغرف المشغولة" : "Rooms Occupied", "text-center")}
                {H("shareOfHousing", ar ? "نسبة الإشغال بالسكن" : "Share of Housing", "text-center")}
                {H("buildingsList", ar ? "المباني المسكن بها" : "Assigned Buildings")}
              </>
            )}

            {/* 13. GATE SECURITY LOGS HEADERS */}
            {activeTab === "gate_logs" && (
              <>
                {H("scannedAt", ar ? "وقت المسح" : "Scan Time")}
                {H("action", ar ? "الحركة" : "Action / Direction", "text-center")}
                {H("profileName", ar ? "الموظف / النزيل" : "Name & ID")}
                {H("department", ar ? "القسم" : "Department")}
                {H("roomNumber", ar ? "الغرفة والمبنى" : "Room & Building")}
                {H("guardName", ar ? "مسؤول الأمن" : "Security Officer")}
                {H("status", ar ? "حالة التصريح" : "Pass Status", "text-center")}
                {H("notes", ar ? "ملاحظات" : "Notes")}
              </>
            )}

            {/* 18. TOURISM POLICE & MINISTRY OF TOURISM REPORT HEADERS */}
            {activeTab === "police_report" && (
              <>
                {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Code")}
                {isVis("fullName") && H("fullName", ar ? "الاسم بالكامل" : "Full Name")}
                {isVis("nationalId") && H("nationalId", ar ? "الرقم القومي" : "National ID")}
                {isVis("nationality") && H("nationality", ar ? "الجنسية" : "Nationality")}
                {isVis("dateOfBirth") && H("dateOfBirth", ar ? "تاريخ الميلاد" : "Date of Birth")}
                {isVis("gender") && H("gender", ar ? "الجنس" : "Gender")}
                {isVis("jobTitle") && H("jobTitle", ar ? "الوظيفة" : "Job Title")}
                {isVis("department") && H("department", ar ? "القسم" : "Department")}
                {isVis("level") && H("level", ar ? "الدرجة" : "Level")}
                {isVis("employmentType") && H("employmentType", ar ? "نوع التوظيف" : "Employment")}
                {isVis("companyName") && H("companyName", ar ? "الشركة" : "Company")}
                {isVis("address") && H("address", ar ? "العنوان بالبطاقة" : "Address")}
                {isVis("phone") && H("phone", ar ? "الهاتف" : "Phone")}
                {isVis("buildingName") && H("buildingName", ar ? "المبنى" : "Building")}
                {isVis("floorName") && H("floorName", ar ? "الطابق" : "Floor")}
                {isVis("roomNumber") && H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {isVis("bedNumber") && H("bedNumber", ar ? "السرير" : "Bed No")}
                {isVis("checkInDate") && H("checkInDate", ar ? "تاريخ التسكين" : "Check-In")}
                {isVis("hireDate") && H("hireDate", ar ? "تاريخ التعيين" : "Hire Date")}
                {isVis("contractEndDate") && H("contractEndDate", ar ? "انتهاء العقد" : "Contract End")}
                {isVis("emergencyContact") && H("emergencyContact", ar ? "هاتف الطوارئ" : "Emergency Contact")}
                {isVis("status") && H("status", ar ? "الحالة بالسكن" : "Status")}
              </>
            )}

            {/* 19. WATER DISTRIBUTION SHEET HEADERS */}
            {activeTab === "water_distribution" && (
              <>
                {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Code")}
                {isVis("fullName") && H("fullName", ar ? "الاسم بالكامل" : "Full Name")}
                {isVis("department") && H("department", ar ? "القسم" : "Department")}
                {isVis("buildingName") && H("buildingName", ar ? "المبنى" : "Building")}
                {isVis("floorName") && H("floorName", ar ? "الدور" : "Floor")}
                {isVis("roomNumber") && H("roomNumber", ar ? "الغرفة" : "Room No")}
                {isVis("bedNumber") && H("bedNumber", ar ? "السرير" : "Bed No")}
                {isVis("waterIssue1") && (
                  <TableHead className="text-center min-w-[110px] font-bold text-xs bg-cyan-500/10 text-cyan-800 dark:text-cyan-300">
                    <div className="flex flex-col items-center justify-center">
                      <span>{ar ? "الصرف الأول" : "1st Issue"}</span>
                      <span className="text-[10px] font-normal opacity-75">{ar ? "(نصف أول)" : "(1st Half)"}</span>
                    </div>
                  </TableHead>
                )}
                {isVis("waterIssue2") && (
                  <TableHead className="text-center min-w-[110px] font-bold text-xs bg-sky-500/10 text-sky-800 dark:text-sky-300">
                    <div className="flex flex-col items-center justify-center">
                      <span>{ar ? "الصرف الثاني" : "2nd Issue"}</span>
                      <span className="text-[10px] font-normal opacity-75">{ar ? "(نصف ثاني)" : "(2nd Half)"}</span>
                    </div>
                  </TableHead>
                )}
                {isVis("signature") && (
                  <TableHead className="text-center min-w-[120px] font-semibold text-xs">
                    {ar ? "توقيع المستلم" : "Signature"}
                  </TableHead>
                )}
              </>
            )}

            {/* POLICY EXCEPTIONS & AUDIT HEADERS */}
            {activeTab === "policy_exceptions" && (
              <>
                {isVis("profileName") && H("profileName", ar ? "اسم المقيم" : "Resident Name")}
                {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Employee Code")}
                {isVis("nationalId") && H("nationalId", ar ? "الرقم القومي" : "National ID")}
                {isVis("jobLevel") && H("jobLevel", ar ? "الدرجة الوظيفية" : "Job Level")}
                {isVis("department") && H("department", ar ? "القسم" : "Department")}
                {isVis("roomNumber") && H("roomNumber", ar ? "رقم الغرفة" : "Room No")}
                {isVis("buildingName") && H("buildingName", ar ? "المبنى" : "Building")}
                {isVis("roomCapacity") && H("roomCapacity", ar ? "سعة الغرفة" : "Capacity", "text-center")}
                {isVis("currentOccupancy") && H("currentOccupancy", ar ? "الإشغال الحالي" : "Occupancy", "text-center")}
                {isVis("violationType") && H("violationType", ar ? "نوع المخالفة" : "Violation Type")}
                {isVis("violationDetails") && H("violationDetails", ar ? "تفاصيل المخالفة والسياسة" : "Policy Details")}
                {isVis("requestDate") && H("requestDate", ar ? "تاريخ الاستثناء" : "Exception Date", "text-center")}
                {isVis("severity") && H("severity", ar ? "مستوى الأهمية" : "Severity", "text-center")}
                {isVis("approvalStatus") && H("approvalStatus", ar ? "حالة الاعتماد" : "Approval Status", "text-center")}
                {isVis("resolvedAt") && H("resolvedAt", ar ? "تاريخ المعالجة والتصحيح" : "Resolution Date", "text-center")}
                {isVis("resolutionDetails") && H("resolutionDetails", ar ? "إجراء المعالجة والتصحيح" : "Resolution Action")}
                {isVis("approvedBy") && H("approvedBy", ar ? "المعتمد للطلب" : "Approved By")}
                {isVis("overrideReason") && H("overrideReason", ar ? "سبب ومسوغات الاستثناء" : "Override Reason")}
              </>
            )}

            {/* VACATIONS & HISTORICAL LEAVES HEADERS */}
            {activeTab === "vacations" && (
              <>
                {isVis("profileCode") && H("profileCode", ar ? "كود الموظف" : "Code")}
                {isVis("fullName") && H("fullName", ar ? "الاسم بالكامل" : "Employee Name")}
                {isVis("department") && H("department", ar ? "القسم" : "Department")}
                {isVis("jobTitle") && H("jobTitle", ar ? "الوظيفة" : "Job Title")}
                {isVis("buildingName") && H("buildingName", ar ? "المبنى" : "Building")}
                {isVis("housingInfo") && H("housingInfo", ar ? "الغرفة والسرير" : "Room & Bed")}
                {isVis("startDate") && H("startDate", ar ? "بداية الإجازة" : "Start Date")}
                {isVis("endDate") && H("endDate", ar ? "العودة المتوقعة" : "Expected Return")}
                {isVis("actualReturnDate") && H("actualReturnDate", ar ? "العودة الفعلية" : "Actual Return")}
                {isVis("duration") && H("duration", ar ? "المدة (أيام)" : "Duration", "text-center")}
                {isVis("status") && H("status", ar ? "حالة الإجازة" : "Status", "text-center")}
                {isVis("notes") && H("notes", ar ? "ملاحظات" : "Notes")}
              </>
            )}
          </TableRow>
        </TableHeader>

        <TableBody>
          {paginatedData.map((row: any, idx: number) => {
            const isSelected = selectedRows.has(row.id);

            return (
              <TableRow
                key={`${activeTab}-${row.id ?? "row"}-${idx}`}
                className={`hover:bg-muted/50 transition-colors ${
                  isSelected ? "bg-primary/5" : ""
                }`}
              >
                <TableCell className="px-3">
                  <Checkbox
                    checked={isSelected}
                    onCheckedChange={() => toggleOne(row.id)}
                  />
                </TableCell>

                {/* OPERA PMS: MANAGER FLASH ROW */}
                {activeTab === "manager_flash" && (
                  <>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-semibold text-foreground">
                        <Building className="w-3.5 h-3.5 text-muted-foreground" />
                        <span>{row.buildingName}</span>
                        {row.code !== "—" && (
                          <span className="text-[10px] text-muted-foreground font-mono">({row.code})</span>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">{row.totalRooms}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{row.totalBeds}</TableCell>
                    <TableCell className="text-center font-mono text-emerald-600 font-semibold">{row.occupiedBeds}</TableCell>
                    <TableCell className="text-center font-mono text-sky-600 font-semibold">{row.vacantBeds}</TableCell>
                    <TableCell className="text-center font-mono text-rose-600 font-semibold">{row.dirtyRooms}</TableCell>
                    <TableCell className="text-center font-mono text-amber-600 font-semibold">{row.oooRooms}</TableCell>
                    <TableCell className="text-center font-mono font-bold text-amber-600">{row.occupancyRate}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                        {row.status}
                      </Badge>
                    </TableCell>
                  </>
                )}

                {/* OPERA PMS: EXPECTED ARRIVALS ROW */}
                {activeTab === "arrivals_manifest" && (
                  <>
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm text-foreground">{row.profileName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.profileId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-xs text-foreground">{row.department}</p>
                      <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{row.buildingName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-blue-50 text-blue-700 border-blue-200">
                        {ar ? `غرفة ${row.roomNumber} (${row.bedNumber})` : `Room ${row.roomNumber} (${row.bedNumber})`}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-emerald-700 bg-emerald-50 border-emerald-200">
                        {row.checkInDate}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.checkOutDate}</TableCell>
                    <TableCell className="text-center font-mono font-semibold">{row.nights}</TableCell>
                    <TableCell>
                      <Badge variant={row.vipStatus === "VIP" ? "default" : "outline"} className="text-xs">
                        {row.vipStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-xs">
                        {row.status}
                      </Badge>
                    </TableCell>
                  </>
                )}

                {/* OPERA PMS: DUE OUT & DEPARTURES ROW */}
                {activeTab === "departures_manifest" && (
                  <>
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm text-foreground">{row.profileName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.profileId}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-xs text-foreground">{row.department}</p>
                      <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{row.buildingName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="font-mono bg-slate-50 text-slate-700 border-slate-200">
                        {ar ? `غرفة ${row.roomNumber} (سرير ${row.bedNumber})` : `Room ${row.roomNumber} (Bed ${row.bedNumber})`}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">{row.checkInDate}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-rose-700 bg-rose-50 border-rose-200 font-bold">
                        {row.checkOutDate}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.departureCategory?.includes("تصفية") || row.departureCategory?.includes("Departed")
                            ? "bg-red-100 text-red-800 border-red-200 font-semibold"
                            : row.departureCategory?.includes("Due Out") || row.departureCategory?.includes("اليوم")
                            ? "bg-amber-100 text-amber-800 border-amber-200 font-semibold"
                            : "bg-blue-50 text-blue-700 border-blue-200"
                        }
                      >
                        {row.departureCategory}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs max-w-[200px] truncate text-muted-foreground" title={row.reason}>
                      {row.reason}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs">
                        {row.roomStatusAfter}
                      </Badge>
                    </TableCell>
                  </>
                )}

                {/* OPERA PMS: HOUSEKEEPING ATTENDANT TASK SHEET ROW */}
                {activeTab === "housekeeping_sheet" && (
                  <>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{row.buildingName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-base font-mono text-foreground">{row.roomNumber}</span>
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0 font-normal">
                          {row.roomType}
                        </Badge>
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          row.foStatus === "مشغول" || row.foStatus === "Occupied"
                            ? "bg-blue-50 text-blue-700 border-blue-200"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200"
                        }
                      >
                        {row.foStatus} ({row.activeCount}/{row.capacity})
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={
                          row.hkStatus === "dirty" || row.hkStatus === "occupied_dirty"
                            ? "bg-rose-100 text-rose-800 border-rose-200"
                            : row.hkStatus === "clean" || row.hkStatus === "inspected"
                            ? "bg-emerald-100 text-emerald-800 border-emerald-200"
                            : "bg-amber-100 text-amber-800 border-amber-200"
                        }
                      >
                        {getRoomStatusLabel(row.hkStatus, ar)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.taskPriority === 1
                            ? "bg-red-50 text-red-700 border-red-300 font-semibold"
                            : row.taskPriority === 2
                            ? "bg-blue-50 text-blue-700 border-blue-300"
                            : "bg-slate-50 text-slate-600 border-slate-200"
                        }
                      >
                        {row.taskType}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[240px] truncate text-xs text-foreground" title={row.occupantNames}>
                      {row.occupantNames}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-muted-foreground">
                      {row.estimatedMins}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center w-5 h-5 rounded border border-muted-foreground/40 bg-white" />
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="inline-flex items-center justify-center w-5 h-5 rounded border border-muted-foreground/40 bg-white" />
                    </TableCell>
                    <TableCell className="text-center">
                      <span className="text-xs text-muted-foreground font-mono">___________</span>
                    </TableCell>
                  </>
                )}

                {/* OPERA PMS: ROOM DISCREPANCY ROW */}
                {activeTab === "room_discrepancy" && (
                  <>
                    <TableCell className="text-center">
                      <Badge
                        variant="default"
                        className={
                          row.severity === "CRITICAL"
                            ? "bg-rose-600 hover:bg-rose-600 text-white font-bold"
                            : row.severity === "WARNING"
                            ? "bg-amber-500 hover:bg-amber-500 text-white font-semibold"
                            : "bg-sky-500 hover:bg-sky-500 text-white"
                        }
                      >
                        {row.severityLabel}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5">
                        <AlertTriangle className={
                          row.severity === "CRITICAL" ? "w-4 h-4 text-rose-600 shrink-0" : "w-4 h-4 text-amber-500 shrink-0"
                        } />
                        <span className="font-bold text-sm text-foreground">{row.typeLabel}</span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium text-foreground">{row.buildingName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-base font-mono text-foreground">{row.roomNumber}</span>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                        {row.foStatus}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-xs">
                        {row.hkStatus}
                      </Badge>
                    </TableCell>
                    <TableCell className="max-w-[200px] truncate text-xs text-foreground" title={row.impactedResidents}>
                      {row.impactedResidents}
                    </TableCell>
                    <TableCell>
                      <p className="text-xs text-emerald-800 dark:text-emerald-300 font-medium bg-emerald-50 dark:bg-emerald-950/40 px-2 py-1 rounded border border-emerald-200 dark:border-emerald-800/50">
                        {row.recommendedAction}
                      </p>
                    </TableCell>
                  </>
                )}

                {/* OPERA PMS: OCCUPANCY FORECAST ROW */}
                {activeTab === "occupancy_forecast" && (
                  <>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-lg bg-violet-50 dark:bg-violet-950/40 border border-violet-200 dark:border-violet-800/50 flex flex-col items-center justify-center text-[10px] font-bold text-violet-700 dark:text-violet-300 shrink-0">
                          <span>{row.dateDisplay?.slice(0, 2)}</span>
                        </div>
                        <div>
                          <p className="font-bold text-sm text-foreground">{row.dayName}</p>
                          <p className="text-xs text-muted-foreground font-mono">{row.dateDisplay}</p>
                        </div>
                      </div>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <Badge variant="secondary" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                        +{row.dayArrivals}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono">
                      <Badge variant="secondary" className="bg-rose-50 text-rose-700 border-rose-200 font-bold">
                        -{row.dayDepartures}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-xs">
                      {row.netShift}
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-sm">
                      {row.projectedOccupied}
                    </TableCell>
                    <TableCell className="text-center font-mono font-semibold text-emerald-600">
                      {row.projectedVacant}
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-xs">
                      {row.occupancyRate}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="text-xs">
                        {row.demandLevel}
                      </Badge>
                    </TableCell>
                  </>
                )}

                {/* 1. ASSIGNMENTS ROW */}
                {activeTab === "assignments" && (
                  <>
                    {isVis("profileCode") && (
                      <TableCell className="font-mono text-xs font-semibold text-muted-foreground whitespace-nowrap">
                        {row.profileCode}
                      </TableCell>
                    )}
                    {isVis("fullName") && (
                      <TableCell>
                        <p className="font-bold text-sm text-foreground">{row.fullName}</p>
                      </TableCell>
                    )}
                    {isVis("employmentType") && (
                      <TableCell>
                        {row.employmentType === "THIRD_PARTY" ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                            {row.companyName || (ar ? "طرف ثالث" : "Third Party")}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            {ar ? "موظف داخلي" : "Internal"}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isVis("buildingName") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.buildingName} • {row.floorName}
                      </TableCell>
                    )}
                    {isVis("roomNumber") && (
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-bold text-primary">{row.roomNumber}</span>
                          {row.bedNumber !== "—" && (
                            <Badge variant="secondary" className="text-[11px] h-5 px-1.5 font-medium">
                              {ar ? `سرير ${row.bedNumber}` : `Bed ${row.bedNumber}`}
                            </Badge>
                          )}
                          {row.roomType && row.roomType !== "—" && (
                            <Badge variant="outline" className="text-[10px] h-5 px-1.5 font-normal text-muted-foreground bg-muted/30">
                              {row.roomType}
                              {row.capacity ? ` (${row.capacity} ${ar ? "أسرة" : "beds"})` : ""}
                            </Badge>
                          )}
                          {row.isEntireRoom && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/50 dark:text-purple-300 text-[10px] h-5 px-1.5 font-medium">
                              {ar ? "غرفة كاملة" : "Full Lock"}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVis("department") && (
                      <TableCell>
                        <p className="text-xs font-medium">{row.department}</p>
                        <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
                      </TableCell>
                    )}
                    {isVis("level") && <TableCell className="text-xs">{row.level}</TableCell>}
                    {isVis("phone") && <TableCell className="text-xs font-mono">{row.phone}</TableCell>}
                    {isVis("nationalId") && <TableCell className="text-xs font-mono">{row.nationalId}</TableCell>}
                    {isVis("nationality") && <TableCell className="text-xs">{row.nationality}</TableCell>}
                    {isVis("gender") && (
                      <TableCell className="text-xs">
                        {row.gender === "M" ? (ar ? "ذكر" : "Male") : row.gender === "F" ? (ar ? "أنثى" : "Female") : row.gender}
                      </TableCell>
                    )}
                    {isVis("dateOfBirth") && <TableCell className="text-xs">{row.dateOfBirth}</TableCell>}
                    {isVis("address") && (
                      <TableCell className="text-xs max-w-[180px] truncate" title={row.address}>
                        {row.address}
                      </TableCell>
                    )}
                    {isVis("hireDate") && <TableCell className="text-xs">{row.hireDate}</TableCell>}
                    {isVis("checkInDate") && <TableCell className="text-xs">{row.checkInDate}</TableCell>}
                    {isVis("contractEndDate") && (
                      <TableCell>
                        {row.contractEndDate !== "—" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-mono">
                            {row.contractEndDate}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVis("expectedCheckOutDate") && <TableCell className="text-xs">{row.expectedCheckOutDate}</TableCell>}
                    {isVis("email") && <TableCell className="text-xs font-mono">{row.email}</TableCell>}
                    {isVis("emergencyContact") && <TableCell className="text-xs font-mono">{row.emergencyContact}</TableCell>}
                    {isVis("status") && (
                      <TableCell>
                        {row.status === "VACATION" ? (
                          <div className="flex flex-col gap-0.5 items-start">
                            <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 text-xs font-semibold">
                              {ar ? "في إجازة" : "On Vacation"}
                            </Badge>
                            {row.vacationEndDate && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                {ar ? `حتى ${formatDate(row.vacationEndDate)}` : `Till ${formatDate(row.vacationEndDate)}`}
                              </span>
                            )}
                          </div>
                        ) : row.status === "CHECKED_OUT" || row.status === "LEFT" ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-xs font-medium">
                            {ar ? "تمت المغادرة" : "Checked Out"}
                          </Badge>
                        ) : row.status === "TRANSFERRED" ? (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            {ar ? "تم النقل" : "Transferred"}
                          </Badge>
                        ) : (
                          <div className="flex flex-wrap items-center gap-1">
                            <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-semibold">
                              {ar ? "مقيم بالسكن" : "In-House"}
                            </Badge>
                            {row.isEntireRoom && (
                              <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-300 text-[10px] px-1 py-0 font-medium">
                                {ar ? "غرفة كاملة" : "Entire Room"}
                              </Badge>
                            )}
                          </div>
                        )}
                      </TableCell>
                    )}
                  </>
                )}

                {/* 2. VACANT ROOMS ROW */}
                {activeTab === "vacant_rooms" && (
                  <>
                    <TableCell className="text-xs">
                      {row.buildingName} • {row.floorName}
                    </TableCell>
                    <TableCell className="font-bold text-base text-primary">
                      {row.roomNumber}
                    </TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-center font-semibold">{row.capacity}</TableCell>
                    <TableCell className="text-center text-muted-foreground">{row.currentOccupancy}</TableCell>
                    <TableCell className="text-center">
                      <Badge className="bg-emerald-600 text-white font-bold text-xs">
                        {row.vacantBedsCount} {ar ? "سرير شاغر" : "beds free"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <span className="text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/40 px-2 py-0.5 rounded">
                        {row.availableBedsText}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{row.genderPolicy}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${roomStatusBadge(row.status)}`}>
                        {getRoomStatusLabel(row.status, ar)}
                      </span>
                    </TableCell>
                  </>
                )}

                {/* 3. HOUSING INVENTORY ROW */}
                {activeTab === "housing" && (
                  <>
                    <TableCell className="text-xs">{row.buildingName} • {row.floorName}</TableCell>
                    <TableCell className="font-bold text-primary">{row.roomNumber}</TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-center font-semibold">{row.capacity}</TableCell>
                    <TableCell className="text-center">{row.currentOccupancy}</TableCell>
                    <TableCell className="text-center">
                      <span className={row.vacantBeds > 0 ? "text-emerald-600 font-bold" : "text-muted-foreground"}>
                        {row.vacantBeds}
                      </span>
                    </TableCell>
                    <TableCell className="text-center font-mono font-bold text-xs">{row.occupancyRate}</TableCell>
                    <TableCell className="text-xs capitalize">{row.genderPolicy}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-semibold ${roomStatusBadge(row.status)}`}>
                        {getRoomStatusLabel(row.status, ar)}
                      </span>
                    </TableCell>
                  </>
                )}

                {/* 4. PROFILES ROW */}
                {activeTab === "profiles" && (
                  <>
                    {isVis("profileCode") && (
                      <TableCell className="font-mono text-xs font-bold text-primary">
                        {row.profileCode}
                      </TableCell>
                    )}
                    {isVis("fullName") && (
                      <TableCell>
                        <div className="font-bold text-sm text-foreground">
                          {row.fullName}
                        </div>
                      </TableCell>
                    )}
                    {isVis("department") && (
                      <TableCell className="text-xs font-medium">
                        {row.department}
                      </TableCell>
                    )}
                    {isVis("jobTitle") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.jobTitle}
                      </TableCell>
                    )}
                    {isVis("level") && (
                      <TableCell className="text-xs text-center font-semibold">
                        {row.level}
                      </TableCell>
                    )}
                    {isVis("assignedRoom") && (
                      <TableCell>
                        {row.hasRoom ? (
                          <span className="inline-flex items-center text-xs font-semibold text-primary bg-primary/5 px-2 py-0.5 rounded border border-primary/20">
                            {row.assignedRoom}
                          </span>
                        ) : (
                          <span className="inline-flex items-center text-xs text-muted-foreground bg-muted/60 px-2 py-0.5 rounded">
                            {ar ? "غير مسكّن" : "Unassigned"}
                          </span>
                        )}
                      </TableCell>
                    )}
                    {isVis("employmentType") && (
                      <TableCell>
                        {row.employmentType === "THIRD_PARTY" ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                            {ar ? "طرف ثالث" : "Third Party"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            {ar ? "داخلي" : "Internal"}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isVis("companyName") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.companyName}
                      </TableCell>
                    )}
                    {isVis("phone") && (
                      <TableCell className="text-xs font-mono">
                        {row.phone}
                      </TableCell>
                    )}
                    {isVis("nationalId") && (
                      <TableCell className="text-xs font-mono">
                        {row.nationalId}
                      </TableCell>
                    )}
                    {isVis("nationality") && (
                      <TableCell className="text-xs">
                        {row.nationality}
                      </TableCell>
                    )}
                    {isVis("gender") && (
                      <TableCell className="text-xs text-center">
                        {row.gender === "M" ? (ar ? "ذكر" : "Male") : row.gender === "F" ? (ar ? "أنثى" : "Female") : row.gender}
                      </TableCell>
                    )}
                    {isVis("hireDate") && (
                      <TableCell className="text-xs font-mono">
                        {row.hireDate}
                      </TableCell>
                    )}
                    {isVis("contractEndDate") && (
                      <TableCell>
                        {row.contractEndDate !== "—" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-mono">
                            {row.contractEndDate}
                          </Badge>
                        ) : (
                          <span className="text-muted-foreground text-xs">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVis("status") && (
                      <TableCell className="text-center">
                        {row.rawStatus === "VACATION" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold">
                            {ar ? "في إجازة" : "On Vacation"}
                          </Badge>
                        ) : row.rawStatus === "ACTIVE" ? (
                          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200 text-xs font-semibold">
                            {ar ? "مقيم بالسكن" : "In-House"}
                          </Badge>
                        ) : row.rawStatus === "UNASSIGNED" ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs font-medium">
                            {ar ? "غير مسكّن" : "Unassigned"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-xs">
                            {row.status}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isVis("dateOfBirth") && <TableCell className="text-xs font-mono">{row.dateOfBirth}</TableCell>}
                    {isVis("address") && (
                      <TableCell className="text-xs max-w-[180px] truncate" title={row.address}>
                        {row.address}
                      </TableCell>
                    )}
                    {isVis("email") && <TableCell className="text-xs font-mono">{row.email}</TableCell>}
                    {isVis("emergencyContact") && <TableCell className="text-xs font-mono">{row.emergencyContact}</TableCell>}
                  </>
                )}

                {/* 5. EXPIRING CONTRACTS ROW */}
                {activeTab === "expiring_contracts" && (
                  <>
                    <TableCell>
                      <div>
                        <p className="font-bold text-sm text-foreground">{row.fullName}</p>
                        <p className="text-xs text-muted-foreground font-mono">{row.profileCode}</p>
                      </div>
                    </TableCell>
                    <TableCell>
                      <p className="text-xs font-medium">{row.department}</p>
                      <p className="text-[11px] text-muted-foreground">{row.jobTitle}</p>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{row.assignedRoom}</TableCell>
                    <TableCell className="text-xs font-mono">{row.phone}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="bg-amber-50 text-amber-900 border-amber-400 font-mono font-bold text-xs">
                        {row.contractEndDate}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      <span
                        className={`font-bold text-xs px-2 py-1 rounded-full ${
                          row.daysRemaining < 0
                            ? "bg-rose-100 text-rose-800"
                            : row.daysRemaining <= 30
                            ? "bg-amber-100 text-amber-800"
                            : "bg-emerald-100 text-emerald-800"
                        }`}
                      >
                        {row.daysRemaining < 0
                          ? ar ? `منتهي منذ ${Math.abs(row.daysRemaining)} يوم` : `Expired ${Math.abs(row.daysRemaining)}d ago`
                          : ar ? `متبقي ${row.daysRemaining} يوم` : `${row.daysRemaining} days left`}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{row.expStatus}</TableCell>
                  </>
                )}

                {/* 6. RESERVATIONS ROW */}
                {activeTab === "reservations" && (
                  <>
                    <TableCell className="font-bold text-sm">{row.guestName}</TableCell>
                    <TableCell className="text-xs font-mono">{row.nationalId} • {row.phone}</TableCell>
                    <TableCell className="text-xs">{row.department} • {row.jobTitle}</TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-xs font-semibold text-primary">{row.roomNumber}</TableCell>
                    <TableCell className="text-xs">{row.checkInDate}</TableCell>
                    <TableCell className="text-xs">{row.checkOutDate}</TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status === "UPCOMING"
                            ? "bg-amber-50 text-amber-800 border-amber-300"
                            : row.status === "CHECKED_IN"
                            ? "bg-green-50 text-green-800 border-green-300"
                            : "bg-muted text-muted-foreground"
                        }
                      >
                        {row.status === "UPCOMING" ? (ar ? "حجز مستقبلي" : "Future") : row.status}
                      </Badge>
                    </TableCell>
                  </>
                )}

                {/* 7. HOSTINGS ROW */}
                {activeTab === "hostings" && (
                  <>
                    <TableCell>
                      <p className="font-bold text-xs">{row.hostEmployee}</p>
                      <p className="text-[11px] text-muted-foreground">{row.hostDept}</p>
                    </TableCell>
                    <TableCell>
                      <p className="font-medium text-xs">{row.guestName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.relation} • {row.guestId}</p>
                    </TableCell>
                    <TableCell className="font-bold text-primary text-xs">{row.roomNumber}</TableCell>
                    <TableCell className="text-xs">{row.checkInDate}</TableCell>
                    <TableCell className="text-xs">{row.checkOutDate}</TableCell>
                    <TableCell className="text-xs">{row.dailyRate}</TableCell>
                    <TableCell className="text-xs font-bold text-emerald-600">{row.totalAmount}</TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize">{row.status}</Badge>
                    </TableCell>
                  </>
                )}

                {/* 8. MAINTENANCE ROW */}
                {activeTab === "maintenance" && (
                  <>
                    <TableCell>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-semibold text-foreground flex items-center gap-1">
                          <Building2 className="w-3 h-3 text-sky-600 shrink-0" />
                          {row.buildingName}
                        </span>
                        <span className="text-[11px] text-muted-foreground flex items-center gap-1">
                          <Layers className="w-3 h-3 text-amber-600 shrink-0" />
                          {row.floorName}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-primary flex items-center gap-1">
                        <DoorClosed className="w-3.5 h-3.5 text-primary shrink-0" />
                        {row.roomNumber}
                      </span>
                    </TableCell>
                    <TableCell>
                      <div className="flex items-center gap-1.5 font-medium text-xs text-foreground">
                        <User className="w-3.5 h-3.5 text-primary shrink-0" />
                        <span className="truncate max-w-[160px]" title={row.reportedBy}>{row.reportedBy}</span>
                      </div>
                    </TableCell>
                    <TableCell className="text-xs font-semibold capitalize">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-medium ${
                        row.rawCategory === "housekeeping" || String(row.category).includes("نظافة")
                          ? "bg-sky-50 dark:bg-sky-950/40 text-sky-700 dark:text-sky-300 border border-sky-200"
                          : "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border border-amber-200"
                      }`}>
                        {row.category}
                      </span>
                    </TableCell>
                    <TableCell className="text-xs max-w-xs truncate" title={row.problemType}>
                      {row.problemType}
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.priority === "Urgent" || row.priority === "عاجلة" || row.rawPriority?.toLowerCase() === "urgent"
                            ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                            : row.priority === "High" || row.priority === "عالية"
                              ? "bg-orange-50 text-orange-700 border-orange-200 text-xs font-semibold"
                              : "text-xs"
                        }
                      >
                        {row.priority}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs font-medium">{row.assignedTo}</TableCell>
                    <TableCell className="text-xs font-mono text-muted-foreground">{row.reportedAt}</TableCell>
                    <TableCell>
                      {row.rating != null && row.rating > 0 ? (
                        <div className="flex flex-col gap-0.5">
                          <div className="flex items-center gap-1">
                            <div className="flex items-center gap-0.5">
                              {[1, 2, 3, 4, 5].map((star) => (
                                <Star
                                  key={star}
                                  className={`w-3.5 h-3.5 ${
                                    star <= row.rating
                                      ? "text-amber-500 fill-amber-500"
                                      : "text-slate-200 dark:text-slate-700"
                                  }`}
                                />
                              ))}
                            </div>
                            <span className="text-xs font-bold text-foreground font-mono">
                              {row.rating}/5
                            </span>
                          </div>
                          {row.ratingComment && (
                            <p className="text-[10px] text-muted-foreground italic truncate max-w-[150px]" title={row.ratingComment}>
                              "{row.ratingComment}"
                            </p>
                          )}
                        </div>
                      ) : (
                        <span className="text-[11px] text-muted-foreground italic">
                          {ar ? "لم يتم التقييم" : "Not rated"}
                        </span>
                      )}
                    </TableCell>
                    <TableCell>
                      <Badge variant="outline" className="text-xs capitalize font-medium">{row.status}</Badge>
                    </TableCell>
                  </>
                )}

                {/* 9. HOUSEKEEPING ROW */}
                {activeTab === "housekeeping" && (
                  <>
                    <TableCell>
                      <p className="text-xs font-medium">{row.buildingName}</p>
                      <p className="text-[11px] text-muted-foreground">{row.floorName}</p>
                    </TableCell>
                    <TableCell>
                      <span className="font-bold text-primary">{row.roomNumber}</span>
                    </TableCell>
                    <TableCell className="text-xs capitalize">{row.roomType}</TableCell>
                    <TableCell className="text-center text-xs font-semibold">{row.capacity}</TableCell>
                    <TableCell className="text-center text-xs">{row.currentOccupancy}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          row.vacantBeds === 0
                            ? "bg-red-50 text-red-700 border-red-200 text-xs"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                        }
                      >
                        {row.vacantBeds}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.status?.toLowerCase() === "dirty"
                            ? "bg-orange-50 text-orange-700 border-orange-200 text-xs"
                            : row.status?.toLowerCase() === "occupied_dirty"
                            ? "bg-red-50 text-red-700 border-red-200 text-xs"
                            : row.status?.toLowerCase() === "available"
                            ? "bg-green-50 text-green-700 border-green-200 text-xs"
                            : row.status?.toLowerCase() === "occupied"
                            ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                            : row.status?.toLowerCase() === "maintenance"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                            : "text-xs"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.hkPriority === "high"
                            ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                            : row.hkPriority === "none"
                            ? "bg-green-50 text-green-700 border-green-200 text-xs"
                            : row.hkPriority === "maintenance"
                            ? "bg-yellow-50 text-yellow-700 border-yellow-200 text-xs"
                            : "text-xs"
                        }
                      >
                        {ar
                          ? row.status?.toLowerCase() === "dirty" ? "تنظيف فوري 🧹"
                          : row.status?.toLowerCase() === "occupied_dirty" ? "تنظيف عند الخروج"
                          : row.status?.toLowerCase() === "available" ? "✅ جاهزة"
                          : row.status?.toLowerCase() === "occupied" ? "مشغولة — لا تزعج"
                          : row.status?.toLowerCase() === "maintenance" ? "🔧 صيانة"
                          : "مراجعة"
                          : row.status?.toLowerCase() === "dirty" ? "Immediate Clean 🧹"
                          : row.status?.toLowerCase() === "occupied_dirty" ? "Clean on Checkout"
                          : row.status?.toLowerCase() === "available" ? "✅ Ready"
                          : row.status?.toLowerCase() === "occupied" ? "Occupied — DND"
                          : row.status?.toLowerCase() === "maintenance" ? "🔧 Maintenance"
                          : "Review"
                        }
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center">
                      {row.openHkTickets > 0 ? (
                        <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold">
                          {row.openHkTickets}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </TableCell>
                  </>
                )}

                {/* 10. EQUIPMENT INVENTORY ROWS */}
                {activeTab === "equipment_inventory" && (
                  inventoryViewMode === "summary" ? (
                    <>
                      <TableCell>
                        <div className="font-semibold text-sm text-foreground flex items-center gap-2">
                          <PackageCheck className="w-4 h-4 text-cyan-600 shrink-0" />
                          <span>{row.itemName}</span>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize font-medium">
                          {ar
                            ? row.category === "appliances" ? "كهربائية وتكييف (Electric)"
                            : row.category === "other" ? "أخرى (Other)"
                            : row.category === "electronics" ? "إلكترونيات (Electronics)"
                            : row.category === "furniture" ? "أثاث (Furniture)"
                            : row.category === "fixtures" ? "مرافق (Fixtures)"
                            : row.category === "linen" ? "مفروشات (Linen)"
                            : "أخرى (Other)"
                            : row.category === "appliances" ? "Electric / Appliances"
                            : row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center">
                        <span className="inline-flex items-center justify-center min-w-[38px] px-2.5 py-1 text-sm font-bold rounded-full bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-800 shadow-xs">
                          {row.totalQuantity}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {row.goodCount > 0 && (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 text-[11px] font-semibold">
                              {ar ? "سليم" : "Good"}: {row.goodCount}
                            </Badge>
                          )}
                          {row.needsRepairCount > 0 && (
                            <Badge variant="outline" className="bg-amber-50 text-amber-700 border-amber-200 text-[11px] font-bold">
                              {ar ? "صيانة" : "Repair"}: {row.needsRepairCount}
                            </Badge>
                          )}
                          {row.damagedCount > 0 && (
                            <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-200 text-[11px] font-bold">
                              {ar ? "تالف" : "Damaged"}: {row.damagedCount}
                            </Badge>
                          )}
                          {row.missingCount > 0 && (
                            <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-[11px] font-bold">
                              {ar ? "مفقود" : "Missing"}: {row.missingCount}
                            </Badge>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="text-xs font-semibold">
                          {row.roomsCount} {ar ? "غرفة" : "rooms"}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="flex items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 text-xs gap-1.5 text-cyan-700 dark:text-cyan-400 border-cyan-200 dark:border-cyan-800 hover:bg-cyan-50 dark:hover:bg-cyan-950/40"
                            onClick={() => setSelectedItemRooms(row)}
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {ar ? "استعراض الغرف" : "View Rooms"}
                            <span className="text-[10px] text-muted-foreground font-mono">({row.roomsCount})</span>
                          </Button>
                          <span className="text-[11px] text-muted-foreground truncate max-w-[140px]" title={row.roomsSummary}>
                            {row.roomsSummary}
                          </span>
                        </div>
                      </TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell>
                        <div className="text-xs font-medium text-foreground">
                          {row.buildingName}
                        </div>
                        <div className="text-[11px] text-muted-foreground">
                          {row.floorName}
                        </div>
                      </TableCell>
                      <TableCell>
                        <span className="font-bold text-primary text-sm">
                          {ar ? "غرفة" : "Room"} {row.roomNumber}
                        </span>
                      </TableCell>
                      <TableCell>
                        <div className="font-medium text-sm text-foreground flex items-center gap-1.5">
                          <span>{row.itemName}</span>
                        </div>
                        {row.modelNumber && row.modelNumber !== "—" && (
                          <div className="text-[11px] text-muted-foreground">
                            {row.modelNumber}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline" className="text-xs capitalize font-medium">
                          {ar
                            ? row.category === "appliances" ? "كهربائية وتكييف (Electric)"
                            : row.category === "other" ? "أخرى (Other)"
                            : row.category === "electronics" ? "إلكترونيات (Electronics)"
                            : row.category === "furniture" ? "أثاث (Furniture)"
                            : row.category === "fixtures" ? "مرافق (Fixtures)"
                            : row.category === "linen" ? "مفروشات (Linen)"
                            : "أخرى (Other)"
                            : row.category === "appliances" ? "Electric / Appliances"
                            : row.category}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-center font-bold text-sm">
                        {row.quantity || 1}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            row.condition === "good"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
                              : row.condition === "fair"
                              ? "bg-blue-50 text-blue-700 border-blue-200 text-xs"
                              : row.condition === "needs_repair"
                              ? "bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold"
                              : row.condition === "damaged"
                              ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                              : "bg-purple-50 text-purple-700 border-purple-200 text-xs font-bold"
                          }
                        >
                          {ar
                            ? row.condition === "good" ? "ممتاز / سليم"
                            : row.condition === "fair" ? "مقبول / يعمل"
                            : row.condition === "needs_repair" ? "بحاجة لصيانة"
                            : row.condition === "damaged" ? "تالف / معطل"
                            : row.condition === "missing" ? "مفقود"
                            : row.condition
                            : row.condition === "good" ? "Good / OK"
                            : row.condition === "fair" ? "Fair"
                            : row.condition === "needs_repair" ? "Needs Repair"
                            : row.condition === "damaged" ? "Damaged"
                            : row.condition === "missing" ? "Missing"
                            : row.condition}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <div className="text-xs font-mono text-foreground">
                          {row.serialNumber && row.serialNumber !== "—" ? row.serialNumber : (row.barcode || "—")}
                        </div>
                        {row.barcode && row.barcode !== "—" && row.serialNumber && row.serialNumber !== "—" && (
                          <div className="text-[10px] text-muted-foreground font-mono">
                            Tag: {row.barcode}
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="text-xs text-muted-foreground">{row.lastInspectedAt || "—"}</div>
                        {row.inspectedBy && row.inspectedBy !== "—" && (
                          <div className="text-[10px] text-muted-foreground">{row.inspectedBy}</div>
                        )}
                      </TableCell>
                      <TableCell className="max-w-[160px] truncate text-xs text-muted-foreground" title={row.notes}>
                        {row.notes || "—"}
                      </TableCell>
                    </>
                  )
                )}

                {/* 11. DAILY MOVEMENT ROW */}
                {activeTab === "daily_movement" && (
                  <>
                    <TableCell>
                      <Badge
                        variant="outline"
                        className={
                          row.typeKey === "check_in"
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold"
                            : row.typeKey === "check_out"
                            ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-semibold"
                            : row.typeKey === "transfer"
                            ? "bg-blue-50 text-blue-700 border-blue-200 text-xs font-semibold"
                            : "bg-purple-50 text-purple-700 border-purple-200 text-xs font-semibold"
                        }
                      >
                        {row.movementType}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground whitespace-nowrap">
                      {row.date}
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{row.profileName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{row.profileCode}</div>
                    </TableCell>
                    <TableCell className="text-xs">{row.department}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.buildingName}</TableCell>
                    <TableCell>
                      <Badge variant="secondary" className="font-mono text-xs">
                        {ar ? "غرفة" : "Room"} {row.roomNumber}
                      </Badge>
                      {row.bedNumber && row.bedNumber !== "—" && (
                        <span className="text-[11px] text-muted-foreground ms-1">
                          ({ar ? "سرير" : "Bed"} {row.bedNumber})
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={row.notes}>
                      {row.notes}
                    </TableCell>
                  </>
                )}

                {/* 12. DEPARTMENT OCCUPANCY ROW */}
                {activeTab === "department_occupancy" && (
                  <>
                    <TableCell className="font-bold text-foreground">{row.department}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="secondary" className="text-xs font-bold px-2.5 py-0.5">
                        {row.residentCount}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-blue-600 font-semibold">
                      {row.maleCount}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs text-pink-600 font-semibold">
                      {row.femaleCount}
                    </TableCell>
                    <TableCell className="text-center font-mono text-xs font-semibold">
                      {row.roomsCount}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-200 font-bold">
                        {row.shareOfHousing}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[250px] truncate" title={row.buildingsList}>
                      {row.buildingsList}
                    </TableCell>
                  </>
                )}

                {/* 13. GATE SECURITY LOGS ROW */}
                {activeTab === "gate_logs" && (
                  <>
                    <TableCell className="font-mono text-xs whitespace-nowrap text-muted-foreground">
                      {row.scannedAt}
                    </TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          row.direction === "exit" || row.direction === "OUT"
                            ? "bg-amber-50 text-amber-700 border-amber-200 text-xs font-bold"
                            : "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-bold"
                        }
                      >
                        {row.action}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="font-semibold text-foreground">{row.profileName}</div>
                      <div className="text-[11px] text-muted-foreground font-mono">{row.profileCode}</div>
                    </TableCell>
                    <TableCell className="text-xs">{row.department}</TableCell>
                    <TableCell>
                      <span className="font-semibold text-xs">{row.roomNumber}</span>
                      <span className="text-[11px] text-muted-foreground ms-1">({row.buildingName})</span>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">{row.guardName}</TableCell>
                    <TableCell className="text-center">
                      <Badge
                        variant="outline"
                        className={
                          row.isValid
                            ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs"
                            : "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold"
                        }
                      >
                        {row.status}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground max-w-[160px] truncate" title={row.notes}>
                      {row.notes}
                    </TableCell>
                  </>
                )}

                {/* 18. TOURISM POLICE REPORT ROW */}
                {activeTab === "police_report" && (
                  <>
                    {isVis("profileCode") && <TableCell className="text-xs font-mono font-semibold">{row.profileCode}</TableCell>}
                    {isVis("fullName") && <TableCell className="text-xs font-bold text-foreground">{row.fullName}</TableCell>}
                    {isVis("nationalId") && <TableCell className="text-xs font-mono font-medium">{row.nationalId}</TableCell>}
                    {isVis("nationality") && <TableCell className="text-xs">{row.nationality}</TableCell>}
                    {isVis("dateOfBirth") && <TableCell className="text-xs font-mono">{row.dateOfBirth}</TableCell>}
                    {isVis("gender") && (
                      <TableCell className="text-xs">
                        {row.gender === "M" ? (ar ? "ذكر" : "Male") : row.gender === "F" ? (ar ? "أنثى" : "Female") : row.gender}
                      </TableCell>
                    )}
                    {isVis("jobTitle") && <TableCell className="text-xs font-medium">{row.jobTitle}</TableCell>}
                    {isVis("department") && <TableCell className="text-xs text-muted-foreground">{row.department}</TableCell>}
                    {isVis("level") && <TableCell className="text-xs">{row.level}</TableCell>}
                    {isVis("employmentType") && (
                      <TableCell>
                        {row.employmentType === "THIRD_PARTY" ? (
                          <Badge variant="outline" className="bg-purple-50 text-purple-700 border-purple-200 text-xs">
                            {ar ? "طرف ثالث" : "Third Party"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-blue-50 text-blue-700 border-blue-200 text-xs">
                            {ar ? "داخلي" : "Internal"}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                    {isVis("companyName") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.companyName}
                      </TableCell>
                    )}
                    {isVis("address") && (
                      <TableCell className="text-xs max-w-[180px] truncate" title={row.address}>
                        {row.address}
                      </TableCell>
                    )}
                    {isVis("phone") && <TableCell className="text-xs font-mono">{row.phone}</TableCell>}
                    {isVis("buildingName") && <TableCell className="text-xs text-muted-foreground">{row.buildingName}</TableCell>}
                    {isVis("floorName") && <TableCell className="text-xs text-muted-foreground">{row.floorName}</TableCell>}
                    {isVis("roomNumber") && <TableCell className="text-xs font-bold text-primary">{row.roomNumber}</TableCell>}
                    {isVis("bedNumber") && (
                      <TableCell className="text-xs">
                        {row.bedNumber !== "—" ? (
                          <Badge variant="secondary" className="text-[11px] h-5 px-1.5 font-medium">
                            {ar ? `سرير ${row.bedNumber}` : `Bed ${row.bedNumber}`}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    {isVis("checkInDate") && <TableCell className="text-xs font-mono">{row.checkInDate}</TableCell>}
                    {isVis("hireDate") && <TableCell className="text-xs font-mono">{row.hireDate}</TableCell>}
                    {isVis("contractEndDate") && <TableCell className="text-xs font-mono">{row.contractEndDate}</TableCell>}
                    {isVis("emergencyContact") && <TableCell className="text-xs font-mono">{row.emergencyContact}</TableCell>}
                    {isVis("status") && (
                      <TableCell>
                        {row.status === "VACATION" ? (
                          <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 text-xs font-semibold">
                            {ar ? "في إجازة" : "Vacation"}
                          </Badge>
                        ) : row.status === "CHECKED_OUT" ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-700 border-slate-300 text-xs">
                            {ar ? "مغادر" : "Checked Out"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 text-xs font-medium">
                            {ar ? "مقيم بالسكن" : "In-House"}
                          </Badge>
                        )}
                      </TableCell>
                    )}
                  </>
                )}

                {/* 19. WATER DISTRIBUTION ROW */}
                {activeTab === "water_distribution" && (
                  <>
                    {isVis("profileCode") && (
                      <TableCell className="font-mono text-xs font-bold text-muted-foreground whitespace-nowrap">
                        {row.profileCode}
                      </TableCell>
                    )}
                    {isVis("fullName") && (
                      <TableCell className="font-bold text-xs text-foreground whitespace-nowrap">
                        {row.fullName}
                      </TableCell>
                    )}
                    {isVis("department") && (
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[11px] font-medium">
                          {row.department}
                        </Badge>
                      </TableCell>
                    )}
                    {isVis("buildingName") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.buildingName}
                      </TableCell>
                    )}
                    {isVis("floorName") && (
                      <TableCell className="text-xs text-muted-foreground whitespace-nowrap">
                        {row.floorName}
                      </TableCell>
                    )}
                    {isVis("roomNumber") && (
                      <TableCell className="text-xs font-bold text-primary">
                        {row.roomNumber}
                      </TableCell>
                    )}
                    {isVis("bedNumber") && (
                      <TableCell className="text-xs text-center">
                        {row.bedNumber !== "—" ? (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {row.bedNumber}
                          </Badge>
                        ) : (
                          "—"
                        )}
                      </TableCell>
                    )}
                    {isVis("waterIssue1") && (
                      <TableCell className="text-center bg-cyan-50/25 dark:bg-cyan-950/10">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={Boolean(waterCheckState[`${row.id}_1`])}
                            onCheckedChange={(checked) =>
                              toggleWaterCheck(`${row.id}_1`, Boolean(checked))
                            }
                            className="h-4 w-4 data-[state=checked]:bg-cyan-600 data-[state=checked]:border-cyan-600"
                          />
                        </div>
                      </TableCell>
                    )}
                    {isVis("waterIssue2") && (
                      <TableCell className="text-center bg-sky-50/25 dark:bg-sky-950/10">
                        <div className="flex items-center justify-center">
                          <Checkbox
                            checked={Boolean(waterCheckState[`${row.id}_2`])}
                            onCheckedChange={(checked) =>
                              toggleWaterCheck(`${row.id}_2`, Boolean(checked))
                            }
                            className="h-4 w-4 data-[state=checked]:bg-sky-600 data-[state=checked]:border-sky-600"
                          />
                        </div>
                      </TableCell>
                    )}
                    {isVis("signature") && (
                      <TableCell className="text-center text-xs text-muted-foreground/40 font-mono">
                        ....................
                      </TableCell>
                    )}
                  </>
                )}

                {/* VACATIONS & HISTORICAL LEAVES ROW */}
                {activeTab === "vacations" && (
                  <>
                    {isVis("profileCode") && (
                      <TableCell className="font-mono text-xs font-semibold text-primary">
                        {row.profileCode || "—"}
                      </TableCell>
                    )}
                    {isVis("fullName") && (
                      <TableCell className="font-semibold text-foreground">
                        <div>{row.fullName}</div>
                        {row.phone && <div className="text-[11px] text-muted-foreground">{row.phone}</div>}
                      </TableCell>
                    )}
                    {isVis("department") && (
                      <TableCell className="text-xs text-muted-foreground font-medium">
                        {row.department || "—"}
                      </TableCell>
                    )}
                    {isVis("jobTitle") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.jobTitle || "—"}
                      </TableCell>
                    )}
                    {isVis("buildingName") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.buildingName || "—"}
                      </TableCell>
                    )}
                    {isVis("housingInfo") && (
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs">
                          <Bed className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                          <span className="font-semibold">{row.roomNumber || "—"}</span>
                          {row.bedNumber && row.bedNumber !== "—" && (
                            <span className="text-muted-foreground text-[11px]">({ar ? `سرير ${row.bedNumber}` : `Bed ${row.bedNumber}`})</span>
                          )}
                        </div>
                      </TableCell>
                    )}
                    {isVis("startDate") && (
                      <TableCell className="text-xs font-mono font-medium">
                        {row.startDate ? formatDate(row.startDate) : "—"}
                      </TableCell>
                    )}
                    {isVis("endDate") && (
                      <TableCell className="text-xs font-mono">
                        {row.endDate ? formatDate(row.endDate) : "—"}
                      </TableCell>
                    )}
                    {isVis("actualReturnDate") && (
                      <TableCell className="text-xs font-mono font-medium">
                        {row.actualReturnDate && row.actualReturnDate !== "—" ? (
                          <span className="text-emerald-600 font-semibold">{formatDate(row.actualReturnDate)}</span>
                        ) : (
                          <span className="text-muted-foreground/60">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVis("duration") && (
                      <TableCell className="text-center text-xs font-mono font-semibold">
                        {row.duration ? `${row.duration} ${ar ? "يوم" : "d"}` : "—"}
                      </TableCell>
                    )}
                    {isVis("status") && (
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            row.statusKey === "COMPLETED"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-xs font-semibold dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800"
                              : row.statusKey === "OVERDUE"
                              ? "bg-rose-50 text-rose-700 border-rose-200 text-xs font-bold animate-pulse dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800"
                              : "bg-amber-50 text-amber-700 border-amber-200 text-xs font-semibold dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-800"
                          }
                        >
                          {row.status}
                        </Badge>
                      </TableCell>
                    )}
                    {isVis("notes") && (
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                        {row.notes || "—"}
                      </TableCell>
                    )}
                  </>
                )}

                {/* POLICY EXCEPTIONS & AUDIT ROW */}
                {activeTab === "policy_exceptions" && (
                  <>
                    {isVis("profileName") && (
                      <TableCell className="font-semibold text-foreground">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-muted-foreground shrink-0" />
                          <span>{row.profileName || "—"}</span>
                        </div>
                      </TableCell>
                    )}
                    {isVis("profileCode") && (
                      <TableCell className="font-mono text-xs text-muted-foreground">
                        {row.profileCode || "—"}
                      </TableCell>
                    )}
                    {isVis("nationalId") && (
                      <TableCell className="font-mono text-xs">
                        {row.nationalId || "—"}
                      </TableCell>
                    )}
                    {isVis("jobLevel") && (
                      <TableCell className="text-xs font-medium">
                        {row.jobLevel || "—"}
                      </TableCell>
                    )}
                    {isVis("department") && (
                      <TableCell className="text-xs">
                        <Badge variant="outline" className="text-[11px] font-normal">
                          {row.department || "—"}
                        </Badge>
                      </TableCell>
                    )}
                    {isVis("roomNumber") && (
                      <TableCell className="font-semibold text-xs">
                        {row.roomNumber || "—"}
                      </TableCell>
                    )}
                    {isVis("buildingName") && (
                      <TableCell className="text-xs text-muted-foreground">
                        {row.buildingName || "—"}
                      </TableCell>
                    )}
                    {isVis("roomCapacity") && (
                      <TableCell className="text-center font-mono text-xs">
                        {row.roomCapacity ?? "—"}
                      </TableCell>
                    )}
                    {isVis("currentOccupancy") && (
                      <TableCell className="text-center font-mono text-xs">
                        {row.currentOccupancy ?? "—"}
                      </TableCell>
                    )}
                    {isVis("violationType") && (
                      <TableCell>
                        <div className="flex items-center gap-1.5 text-xs font-semibold text-rose-700 dark:text-rose-400">
                          <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                          <span>{row.violationType || "—"}</span>
                        </div>
                      </TableCell>
                    )}
                    {isVis("violationDetails") && (
                      <TableCell className="text-xs text-muted-foreground max-w-[240px] truncate" title={row.violationDetails}>
                        {row.violationDetails || "—"}
                      </TableCell>
                    )}
                    {isVis("requestDate") && (
                      <TableCell className="text-center font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {row.requestDate ? formatDate(row.requestDate) : "—"}
                      </TableCell>
                    )}
                    {isVis("severity") && (
                      <TableCell className="text-center">
                        <Badge
                          variant="outline"
                          className={
                            row.severity === "حرجة" || row.severity === "Critical"
                              ? "bg-rose-50 text-rose-700 border-rose-300 text-xs font-bold dark:bg-rose-950/40 dark:text-rose-300"
                              : row.severity === "مرتفعة" || row.severity === "High"
                              ? "bg-amber-50 text-amber-700 border-amber-300 text-xs font-semibold dark:bg-amber-950/40 dark:text-amber-300"
                              : "bg-blue-50 text-blue-700 border-blue-300 text-xs dark:bg-blue-950/40 dark:text-blue-300"
                          }
                        >
                          {row.severity}
                        </Badge>
                      </TableCell>
                    )}
                    {isVis("approvalStatus") && (
                      <TableCell className="text-center">
                        <Badge
                          variant="secondary"
                          className={
                            row.isResolved
                              ? "bg-emerald-50 text-emerald-700 border-emerald-300 text-xs font-semibold dark:bg-emerald-950/40 dark:text-emerald-300"
                              : row.isApproved || row.approvalStatus?.includes("معتمد") || row.approvalStatus?.includes("Approved")
                              ? "bg-blue-50 text-blue-700 border-blue-300 text-xs font-semibold dark:bg-blue-950/40 dark:text-blue-300"
                              : "bg-rose-50 text-rose-700 border-rose-300 text-xs font-semibold dark:bg-rose-950/40 dark:text-rose-300"
                          }
                        >
                          {row.approvalStatus || (ar ? "قيد المراجعة" : "Pending")}
                        </Badge>
                      </TableCell>
                    )}
                    {isVis("resolvedAt") && (
                      <TableCell className="text-center font-mono text-xs text-muted-foreground whitespace-nowrap">
                        {row.resolvedAt ? formatDate(row.resolvedAt) : "—"}
                      </TableCell>
                    )}
                    {isVis("resolutionDetails") && (
                      <TableCell className="text-xs max-w-[220px] truncate" title={row.resolutionDetails}>
                        {row.resolutionDetails ? (
                          <span className="text-emerald-700 dark:text-emerald-400 font-medium">
                            {row.resolutionDetails}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </TableCell>
                    )}
                    {isVis("approvedBy") && (
                      <TableCell className="text-xs font-medium">
                        {row.approvedBy || "—"}
                      </TableCell>
                    )}
                    {isVis("overrideReason") && (
                      <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate" title={row.overrideReason}>
                        {row.overrideReason || "—"}
                      </TableCell>
                    )}
                  </>
                )}
              </TableRow>
            );
          })}
        </TableBody>
      </Table>

      {/* Drill-down Dialog for Rooms containing the Item */}
      <Dialog open={!!selectedItemRooms} onOpenChange={(open) => !open && setSelectedItemRooms(null)}>
        <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto" dir={ar ? "rtl" : "ltr"}>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base font-bold">
              <PackageCheck className="w-5 h-5 text-cyan-600" />
              <span>{selectedItemRooms?.itemName}</span>
              <Badge variant="secondary" className="capitalize text-xs font-semibold">
                {selectedItemRooms?.category}
              </Badge>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ar
                ? `إجمالي الكمية المسجلة: ${selectedItemRooms?.totalQuantity || 0} قطعة موزعة على ${selectedItemRooms?.roomsCount || 0} غرفة بالسكن`
                : `Total quantity: ${selectedItemRooms?.totalQuantity || 0} units across ${selectedItemRooms?.roomsCount || 0} rooms in housing`}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 mt-2">
            {/* Condition Stats Banner */}
            <div className="grid grid-cols-4 gap-2 p-2.5 rounded-lg bg-muted/30 border text-center text-xs">
              <div>
                <div className="text-muted-foreground text-[10px]">{ar ? "إجمالي الكمية" : "Total"}</div>
                <div className="font-bold text-sm text-foreground">{selectedItemRooms?.totalQuantity || 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px]">{ar ? "سليم / ممتاز" : "Good"}</div>
                <div className="font-bold text-sm text-emerald-600">{selectedItemRooms?.goodCount || 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px]">{ar ? "بحاجة لصيانة" : "Needs Repair"}</div>
                <div className="font-bold text-sm text-amber-600">{selectedItemRooms?.needsRepairCount || 0}</div>
              </div>
              <div>
                <div className="text-muted-foreground text-[10px]">{ar ? "تالف / مفقود" : "Damaged / Missing"}</div>
                <div className="font-bold text-sm text-rose-600">{(selectedItemRooms?.damagedCount || 0) + (selectedItemRooms?.missingCount || 0)}</div>
              </div>
            </div>

            {/* Rooms List Table */}
            <div className="border rounded-lg overflow-hidden">
              <Table>
                <TableHeader>
                  <TableRow className="bg-muted/40">
                    <TableHead className="text-xs font-bold">{ar ? "الغرفة" : "Room"}</TableHead>
                    <TableHead className="text-xs font-bold">{ar ? "المبنى والطابق" : "Building & Floor"}</TableHead>
                    <TableHead className="text-xs font-bold text-center">{ar ? "الكمية" : "Qty"}</TableHead>
                    <TableHead className="text-xs font-bold">{ar ? "الحالة" : "Condition"}</TableHead>
                    <TableHead className="text-xs font-bold">{ar ? "السيريال / الكود" : "Serial / Tag"}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {selectedItemRooms?.roomsList?.map((rm: any, rmIdx: number) => (
                    <TableRow key={rmIdx} className="text-xs hover:bg-muted/30">
                      <TableCell className="font-semibold text-foreground">
                        {ar ? "غرفة" : "Room"} {rm.roomNumber}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {rm.buildingName} • {rm.floorName || rm.floorNumber}
                      </TableCell>
                      <TableCell className="text-center font-bold">
                        {rm.quantity || 1}
                      </TableCell>
                      <TableCell>
                        <Badge
                          variant="outline"
                          className={
                            rm.condition === "good"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200 text-[10px] font-semibold"
                              : rm.condition === "fair"
                              ? "bg-blue-50 text-blue-700 border-blue-200 text-[10px]"
                              : rm.condition === "needs_repair"
                              ? "bg-amber-50 text-amber-700 border-amber-200 text-[10px] font-bold"
                              : "bg-rose-50 text-rose-700 border-rose-200 text-[10px] font-bold"
                          }
                        >
                          {ar
                            ? rm.condition === "good" ? "ممتاز"
                            : rm.condition === "fair" ? "مقبول"
                            : rm.condition === "needs_repair" ? "صيانة"
                            : rm.condition === "damaged" ? "تالف"
                            : "مفقود"
                            : rm.condition}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono text-muted-foreground">
                        {rm.serialNumber || rm.barcode || "—"}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
