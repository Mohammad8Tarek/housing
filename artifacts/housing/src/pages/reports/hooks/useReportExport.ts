import { exportExcel, exportPDF, exportAnalyticsPDF, printArabicAnalyticsReport } from "../utils/export";
import { formatDate } from "@/lib/date-utils";
import {
  translateReportHeader,
  translateRoomType,
  translateGenderPolicy,
  translateProfileStatus,
  translateReservationStatus,
  translateMaintenanceCategory,
  translateMaintenancePriority,
  translateMaintenanceStatus,
  translateHostingStatus,
  translateHostingRelation,
} from "../utils/luxury-report-engine";
import { formatNationality } from "@/lib/countries";
import { getProfileDisplayDepartment } from "@/lib/profile-display-utils";
import { getRoomStatusLabel } from "@/pages/housing/utils";
import { toast } from "sonner";

export function useReportExport({
  ar = true,
  activeTab,
  canExportReports,
  currentData,
  currentPageData,
  properties,
  propId,
  activePropertyId,
  dateFrom,
  dateTo,
  search,
  settings,
  analytics,
  stats,
  rooms,
  profiles,
  buildings,
  floors,
  evalStats,
  floorMap,
  buildingMap,
  empMap,
  roomMap,
  openPrintDialog,
  inventoryViewMode = "summary",
  filterRow,
}: any) {
  const getRawRows = (scope: "all" | "page" = "all"): Record<string, any>[] => {
    const data = (scope === "page" && typeof currentPageData === "function") ? currentPageData() : currentData();
    switch (activeTab) {
      case "manager_flash":
        return data.map((b: any) => ({
          [ar ? "المبنى" : "Building"]: b.buildingName,
          [ar ? "كود المبنى" : "Code"]: b.code,
          [ar ? "إجمالي الغرف" : "Total Rooms"]: b.totalRooms,
          [ar ? "إجمالي الأسرة" : "Total Beds"]: b.totalBeds,
          [ar ? "الأسرة المشغولة" : "Occupied Beds"]: b.occupiedBeds,
          [ar ? "الأسرة الشاغرة" : "Vacant Beds"]: b.vacantBeds,
          [ar ? "غرف متسخة" : "Dirty Rooms"]: b.dirtyRooms,
          [ar ? "غرف صيانة" : "OOO Rooms"]: b.oooRooms,
          [ar ? "نسبة الإشغال" : "Occupancy Rate"]: b.occupancyRate,
          [ar ? "الحالة" : "Status"]: b.status,
        }));

      case "arrivals_manifest":
        return data.map((r: any) => ({
          [ar ? "اسم النزيل" : "Guest Name"]: r.profileName,
          [ar ? "رقم الموظف / الهوية" : "Profile / ID"]: r.profileId,
          [ar ? "الرقم القومي" : "National ID"]: r.nationalId,
          [ar ? "الهاتف" : "Phone"]: r.phone,
          [ar ? "القسم" : "Department"]: r.department,
          [ar ? "المسمى الوظيفي" : "Job Title"]: r.jobTitle,
          [ar ? "المبنى" : "Building"]: r.buildingName,
          [ar ? "الطابق" : "Floor"]: r.floorName,
          [ar ? "رقم الغرفة" : "Room No"]: r.roomNumber,
          [ar ? "السرير" : "Bed No"]: r.bedNumber,
          [ar ? "تاريخ الوصول" : "Arrival Date"]: r.checkInDate,
          [ar ? "تاريخ المغادرة" : "Departure Date"]: r.checkOutDate,
          [ar ? "الليالي" : "Nights"]: r.nights,
          [ar ? "الفئة" : "Category"]: r.vipStatus,
          [ar ? "حالة الحجز" : "Reservation Status"]: r.status,
          [ar ? "ملاحظات" : "Notes"]: r.notes,
        }));

      case "departures_manifest":
        return data.map((d: any) => ({
          [ar ? "اسم الموظف" : "Employee Name"]: d.profileName,
          [ar ? "كود الموظف" : "Profile ID"]: d.profileId,
          [ar ? "القسم" : "Department"]: d.department,
          [ar ? "الوظيفة" : "Job Title"]: d.jobTitle,
          [ar ? "المبنى" : "Building"]: d.buildingName,
          [ar ? "الغرفة" : "Room No"]: d.roomNumber,
          [ar ? "السرير" : "Bed No"]: d.bedNumber,
          [ar ? "تاريخ التسكين" : "Check-In Date"]: d.checkInDate,
          [ar ? "المغادرة المستحقة" : "Due Out Date"]: d.checkOutDate,
          [ar ? "نوع المغادرة" : "Departure Type"]: d.departureCategory,
          [ar ? "السبب / ملاحظات HR" : "Reason / Notes"]: d.reason,
          [ar ? "حالة الغرفة" : "Room Status"]: d.roomStatusAfter,
        }));

      case "housekeeping_sheet":
        return data.map((h: any) => ({
          [ar ? "المبنى" : "Building"]: h.buildingName,
          [ar ? "الطابق" : "Floor"]: h.floorName,
          [ar ? "رقم الغرفة" : "Room No"]: h.roomNumber,
          [ar ? "نوع الغرفة" : "Room Type"]: h.roomType,
          [ar ? "حالة الإشغال (FO)" : "FO Status"]: h.foStatus,
          [ar ? "حالة النظافة (HK)" : "HK Status"]: getRoomStatusLabel(h.hkStatus, ar),
          [ar ? "المهمة المطلوبة" : "Task Type"]: h.taskType,
          [ar ? "الوقت التقديري" : "Est Time"]: h.estimatedMins,
          [ar ? "النزلاء الحاليون" : "Current Occupants"]: h.occupantNames,
          [ar ? "فحص المفروشات" : "Linen Check"]: "[  ]",
          [ar ? "فحص العهد" : "Amenities Check"]: "[  ]",
          [ar ? "توقيع المنفذ" : "Attendant Signature"]: "",
        }));

      case "room_discrepancy":
        return data.map((d: any) => ({
          [ar ? "مستوى الخطورة" : "Severity"]: d.severityLabel,
          [ar ? "نوع التباين" : "Discrepancy Type"]: d.typeLabel,
          [ar ? "المبنى" : "Building"]: d.buildingName,
          [ar ? "الطابق" : "Floor"]: d.floorName,
          [ar ? "رقم الغرفة" : "Room No"]: d.roomNumber,
          [ar ? "حالة الاستقبال (FO)" : "FO Status"]: d.foStatus,
          [ar ? "حالة الهاوس كيبنج (HK)" : "HK Status"]: d.hkStatus,
          [ar ? "النزلاء المتأثرون" : "Impacted Residents"]: d.impactedResidents,
          [ar ? "الإجراء الموصى به" : "Recommended Action"]: d.recommendedAction,
        }));

      case "occupancy_forecast":
        return data.map((f: any) => ({
          [ar ? "التاريخ" : "Date"]: f.dateDisplay,
          [ar ? "اليوم" : "Day"]: f.dayName,
          [ar ? "الوصول المتوقع (+ Due In)" : "Arrivals (+ Due In)"]: f.dayArrivals,
          [ar ? "المغادرة المتوقعة (- Due Out)" : "Departures (- Due Out)"]: f.dayDepartures,
          [ar ? "صافي الحركة" : "Net Movement"]: f.netShift,
          [ar ? "الأسرة المشغولة" : "Projected Occupied"]: f.projectedOccupied,
          [ar ? "الأسرة الشاغرة" : "Projected Vacant"]: f.projectedVacant,
          [ar ? "إجمالي الطاقة" : "Total Capacity"]: f.totalBeds,
          [ar ? "نسبة الإشغال" : "Occupancy Rate"]: f.occupancyRate,
          [ar ? "مستوى الضغط" : "Demand Tier"]: f.demandLevel,
        }));

      case "assignments":
        return data.map((a: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: a.profileCode,
          [ar ? "الاسم بالكامل" : "Full Name"]: a.fullName,
          [ar ? "نوع التوظيف" : "Employment Type"]:
            a.employmentType === "THIRD_PARTY"
              ? (ar ? "طرف ثالث" : "Third Party")
              : (ar ? "داخلي (فندق)" : "Internal"),
          [ar ? "الشركة" : "Company"]: a.companyName || "—",
          [ar ? "المبنى والطابق" : "Building & Floor"]: `${a.buildingName || "—"}${a.floorName ? ` (${a.floorName})` : ""}`,
          [ar ? "الغرفة والسرير" : "Room & Bed"]: `${a.roomNumber || "—"}${a.isEntireRoom ? ` (${ar ? "غرفة كاملة" : "Full Lock"})` : (a.bedNumber && a.bedNumber !== "—" ? ` - سرير ${a.bedNumber}` : "")}`,
          [ar ? "القسم" : "Department"]: a.department,
          [ar ? "الوظيفة" : "Job Title"]: a.jobTitle,
          [ar ? "الهاتف" : "Phone"]: a.phone || "—",
          [ar ? "الرقم القومي" : "National ID"]: a.nationalId || "—",
          [ar ? "الجنسية" : "Nationality"]: ar ? formatNationality(a.nationality, ar, false) : (a.nationality || "—"),
          [ar ? "تاريخ التسكين" : "Check-In Date"]: a.checkInDate || "—",
          [ar ? "المغادرة المتوقعة" : "Expected Check-Out"]: a.expectedCheckOutDate || a.contractEndDate || "—",
          [ar ? "الحالة بالسكن" : "Status"]:
            a.status === "VACATION"
              ? (ar
                  ? `في إجازة${a.vacationEndDate ? ` (حتى ${a.vacationEndDate})` : ""}`
                  : `Vacation${a.vacationEndDate ? ` (until ${a.vacationEndDate})` : ""}`)
              : a.status === "CHECKED_OUT" || a.status === "LEFT"
              ? (ar ? "مغادر" : "Checked Out")
              : a.status === "TRANSFERRED"
              ? (ar ? "منقول" : "Transferred")
              : (ar
                  ? `مقيم بالسكن${a.isEntireRoom ? " (غرفة كاملة)" : ""}`
                  : `In-House${a.isEntireRoom ? " (Full Room)" : ""}`),
        }));

      case "vacant_rooms":
        return data.map((r: any) => ({
          [ar ? "المبنى" : "Building"]: r.buildingName,
          [ar ? "الطابق" : "Floor"]: r.floorName,
          [ar ? "رقم الغرفة" : "Room No"]: r.roomNumber,
          [ar ? "نوع الغرفة" : "Room Type"]: translateRoomType(r.roomType, ar),
          [ar ? "السعة الإجمالية" : "Capacity"]: r.capacity,
          [ar ? "المشغول" : "Occupied"]: r.currentOccupancy,
          [ar ? "عدد الأسرة الشاغرة" : "Vacant Beds"]: r.vacantBedsCount,
          [ar ? "الأسرة المتاحة" : "Available Beds"]: r.availableBedsText,
          [ar ? "سياسة الجنس" : "Gender Policy"]: translateGenderPolicy(r.genderPolicy, ar),
          [ar ? "حالة الغرفة" : "Room Status"]: getRoomStatusLabel(r.status, ar),
        }));

      case "housing":
        return data.map((r: any) => ({
          [ar ? "المبنى" : "Building"]: r.buildingName,
          [ar ? "الطابق" : "Floor"]: r.floorName,
          [ar ? "رقم الغرفة" : "Room No"]: r.roomNumber,
          [ar ? "نوع الغرفة" : "Room Type"]: translateRoomType(r.roomType, ar),
          [ar ? "السعة" : "Capacity"]: r.capacity,
          [ar ? "المشغول" : "Occupied"]: r.currentOccupancy,
          [ar ? "الشاغر" : "Vacant Beds"]: r.vacantBeds,
          [ar ? "نسبة الإشغال" : "Occupancy Rate"]: r.occupancyRate,
          [ar ? "سياسة الجنس" : "Gender Policy"]: translateGenderPolicy(r.genderPolicy, ar),
          [ar ? "حالة الغرفة" : "Room Status"]: getRoomStatusLabel(r.status, ar),
        }));

      case "profiles":
        return data.map((e: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: e.profileCode,
          [ar ? "الاسم بالكامل" : "Full Name"]: e.fullName,
          [ar ? "نوع التوظيف" : "Employment Type"]:
            e.employmentType === "THIRD_PARTY"
              ? (ar ? "طرف ثالث" : "Third Party")
              : (ar ? "داخلي (فندق)" : "Internal"),
          [ar ? "الشركة" : "Company"]: e.companyName,
          [ar ? "الرقم القومي" : "National ID"]: e.nationalId,
          [ar ? "الهاتف" : "Phone"]: e.phone,
          [ar ? "الجنسية" : "Nationality"]: ar ? formatNationality(e.nationality, ar, false) : (e.nationality || "—"),
          [ar ? "الجنس" : "Gender"]: e.gender === "M" ? (ar ? "ذكر" : "Male") : e.gender === "F" ? (ar ? "أنثى" : "Female") : e.gender,
          [ar ? "تاريخ الميلاد" : "Date of Birth"]: e.dateOfBirth,
          [ar ? "العنوان" : "Address"]: e.address,
          [ar ? "القسم" : "Department"]: e.department,
          [ar ? "الوظيفة" : "Job Title"]: e.jobTitle,
          [ar ? "الدرجة" : "Level"]: e.level,
          [ar ? "السكن الحالي" : "Current Housing"]: e.assignedRoom,
          [ar ? "تاريخ التعيين" : "Hire Date"]: e.hireDate,
          [ar ? "انتهاء العقد" : "Contract End"]: e.contractEndDate,
          [ar ? "البريد الإلكتروني" : "Email"]: e.email,
          [ar ? "الحالة" : "Status"]: ar
            ? translateProfileStatus(e.rawStatus || e.status, true)
            : (e.rawStatus === "ACTIVE" ? "In-House" : e.rawStatus === "VACATION" ? "Vacation" : e.rawStatus === "UNASSIGNED" ? "Unassigned" : (e.rawStatus || e.status || "—")),
        }));

      case "expiring_contracts":
        return data.map((c: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: c.profileCode,
          [ar ? "اسم الموظف" : "Employee Name"]: c.fullName,
          [ar ? "القسم" : "Department"]: c.department,
          [ar ? "الوظيفة" : "Job Title"]: c.jobTitle,
          [ar ? "السكن الحالي" : "Current Housing"]: c.assignedRoom,
          [ar ? "الهاتف" : "Phone"]: c.phone,
          [ar ? "الرقم القومي" : "National ID"]: c.nationalId,
          [ar ? "تاريخ انتهاء العقد" : "Contract End Date"]: c.contractEndDate,
          [ar ? "الأيام المتبقية" : "Days Remaining"]: c.daysRemaining,
          [ar ? "حالة العقد" : "Contract Status"]: c.expStatus,
        }));

      case "reservations":
        return data.map((r: any) => ({
          [ar ? "اسم الضيف" : "Guest Name"]: r.guestName,
          [ar ? "الرقم القومي" : "National ID"]: r.nationalId,
          [ar ? "الهاتف" : "Phone"]: r.phone,
          [ar ? "القسم" : "Department"]: r.department,
          [ar ? "الوظيفة" : "Job Title"]: r.jobTitle,
          [ar ? "نوع الغرفة" : "Room Type"]: translateRoomType(r.roomType, ar),
          [ar ? "الغرفة المحجوزة" : "Reserved Room"]: r.roomNumber,
          [ar ? "تاريخ الوصول" : "Check-In"]: r.checkInDate,
          [ar ? "تاريخ المغادرة" : "Check-Out"]: r.checkOutDate,
          [ar ? "الحالة" : "Status"]: translateReservationStatus(r.status, ar),
        }));

      case "hostings":
        return data.map((h: any) => ({
          [ar ? "الموظف المستضيف" : "Host Employee"]: h.hostEmployee,
          [ar ? "القسم" : "Department"]: h.hostDept,
          [ar ? "اسم الضيف" : "Guest Name"]: h.guestName,
          [ar ? "صلة القرابة" : "Relationship"]: translateHostingRelation(h.relation, ar),
          [ar ? "رقم الهوية" : "ID Number"]: h.guestId,
          [ar ? "رقم الغرفة" : "Room No"]: h.roomNumber,
          [ar ? "تاريخ الدخول" : "Check-In"]: h.checkInDate,
          [ar ? "تاريخ المغادرة" : "Check-Out"]: h.checkOutDate,
          [ar ? "سعر اليوم" : "Daily Rate"]: h.dailyRate,
          [ar ? "الإجمالي" : "Total Fee"]: h.totalAmount,
          [ar ? "الحالة" : "Status"]: translateHostingStatus(h.status, ar),
        }));

      case "maintenance":
        return data.map((m: any) => ({
          [ar ? "المبنى" : "Building"]: m.buildingName || "—",
          [ar ? "الدور" : "Floor"]: m.floorName || "—",
          [ar ? "رقم الغرفة" : "Room No"]: m.roomNumber,
          [ar ? "مقدم البلاغ" : "Reported By"]: m.reportedBy || "—",
          [ar ? "الفئة" : "Category"]: translateMaintenanceCategory(m.category, ar),
          [ar ? "وصف المشكلة" : "Problem Details"]: m.problemType,
          [ar ? "الأولوية" : "Priority"]: translateMaintenancePriority(m.priority, ar),
          [ar ? "الفني المعين" : "Assigned To"]: m.assignedTo,
          [ar ? "تاريخ البلاغ" : "Reported Date"]: m.reportedAt,
          [ar ? "التقييم" : "Rating"]: m.rating ? `${m.rating}/5 ★` : (ar ? "لم يتم التقييم" : "Not rated"),
          [ar ? "ملاحظات التقييم" : "Rating Comments"]: m.ratingComment || "—",
          [ar ? "الحالة" : "Status"]: translateMaintenanceStatus(m.status, ar),
        }));

      case "equipment_inventory":
        if (inventoryViewMode === "summary") {
          return data.map((it: any) => ({
            [ar ? "اسم المعدة / الصنف" : "Equipment / Item Name"]: it.itemName,
            [ar ? "التصنيف" : "Category"]:
              ar
                ? it.category === "electronics" ? "إلكترونيات وشاشات"
                : it.category === "appliances" ? "أجهزة وتكييف"
                : it.category === "furniture" ? "أثاث"
                : it.category === "fixtures" ? "مرافق وخزائن"
                : it.category === "linen" ? "مفروشات"
                : "أخرى"
                : it.category,
            [ar ? "إجمالي الكمية بالسكن" : "Total Quantity in Housing"]: it.totalQuantity,
            [ar ? "سليم / ممتاز" : "Good / Working"]: it.goodCount,
            [ar ? "بحاجة لصيانة" : "Needs Repair"]: it.needsRepairCount,
            [ar ? "تالف" : "Damaged"]: it.damagedCount,
            [ar ? "مفقود" : "Missing"]: it.missingCount,
            [ar ? "عدد الغرف المتواجد بها" : "Rooms Count"]: it.roomsCount,
            [ar ? "أرقام الغرف" : "Rooms List"]: it.roomsSummary || "—",
          }));
        }

        return data.map((it: any) => ({
          [ar ? "المبنى" : "Building"]: it.buildingName,
          [ar ? "الطابق" : "Floor"]: it.floorName,
          [ar ? "رقم الغرفة" : "Room No"]: it.roomNumber,
          [ar ? "اسم المعدة / القطعة" : "Item Name"]: it.itemName,
          [ar ? "الموديل" : "Model"]: it.modelNumber || "—",
          [ar ? "التصنيف" : "Category"]:
            ar
              ? it.category === "electronics" ? "إلكترونيات وشاشات"
              : it.category === "appliances" ? "أجهزة وتكييف"
              : it.category === "furniture" ? "أثاث"
              : it.category === "fixtures" ? "مرافق وخزائن"
              : it.category === "linen" ? "مفروشات"
              : "أخرى"
              : it.category,
          [ar ? "العدد" : "Quantity"]: it.quantity,
          [ar ? "الحالة" : "Condition"]:
            ar
              ? it.condition === "good" ? "ممتاز / سليم"
              : it.condition === "fair" ? "مقبول / يعمل"
              : it.condition === "needs_repair" ? "بحاجة لصيانة"
              : it.condition === "damaged" ? "تالف / معطل"
              : it.condition === "missing" ? "مفقود"
              : it.condition
              : it.condition,
          [ar ? "الرقم التسلسلي" : "Serial Number"]: it.serialNumber || "—",
          [ar ? "كود الأصل / الباركود" : "Asset Tag / Barcode"]: it.barcode || "—",
          [ar ? "تاريخ الفحص" : "Last Inspected"]: it.lastInspectedAt || "—",
          [ar ? "القائم بالفحص" : "Inspected By"]: it.inspectedBy || "—",
          [ar ? "ملاحظات" : "Notes"]: it.notes || "—",
        }));

      case "daily_movement":
        return data.map((m: any) => ({
          [ar ? "نوع الحركة" : "Movement Type"]: m.movementType,
          [ar ? "التاريخ والوقت" : "Date / Time"]: m.date,
          [ar ? "المقيم / النزيل" : "Resident / Profile"]: m.profileName,
          [ar ? "كود الموظف" : "Code"]: m.profileCode,
          [ar ? "القسم" : "Department"]: m.department,
          [ar ? "المبنى" : "Building"]: m.buildingName,
          [ar ? "الغرفة" : "Room No"]: m.roomNumber,
          [ar ? "السرير" : "Bed No"]: m.bedNumber,
          [ar ? "التفاصيل والملاحظات" : "Details / Reason"]: m.notes,
        }));

      case "department_occupancy":
        return data.map((d: any) => ({
          [ar ? "القسم" : "Department"]: d.department,
          [ar ? "إجمالي المقيمين" : "Total Residents"]: d.residentCount,
          [ar ? "ذكور" : "Males"]: d.maleCount,
          [ar ? "إناث" : "Females"]: d.femaleCount,
          [ar ? "الغرف المشغولة" : "Rooms Occupied"]: d.roomsCount,
          [ar ? "نسبة الإشغال الكلية" : "Share of Occupancy (%)"]: d.shareOfHousing,
          [ar ? "المباني المسكن بها" : "Assigned Buildings"]: d.buildingsList,
        }));

      case "gate_logs":
        return data.map((g: any) => ({
          [ar ? "وقت المسح" : "Scan Time"]: g.scannedAt,
          [ar ? "الحركة (دخول/خروج)" : "Direction / Action"]: g.action,
          [ar ? "الاسم" : "Person Name"]: g.profileName,
          [ar ? "كود الموظف" : "ID / Code"]: g.profileCode,
          [ar ? "القسم" : "Department"]: g.department,
          [ar ? "المبنى" : "Building"]: g.buildingName,
          [ar ? "الغرفة" : "Room No"]: g.roomNumber,
          [ar ? "مسؤول الأمن" : "Security Officer"]: g.guardName,
          [ar ? "حالة التصريح" : "Access Status"]: g.status,
          [ar ? "ملاحظات" : "Notes"]: g.notes,
        }));

      case "police_report":
        return data.map((p: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: p.profileCode,
          [ar ? "الاسم بالكامل" : "Full Name"]: p.fullName,
          [ar ? "الرقم القومي" : "National ID"]: p.nationalId,
          [ar ? "الجنسية" : "Nationality"]: ar ? formatNationality(p.nationality, ar, false) : (p.nationality || "—"),
          [ar ? "تاريخ الميلاد" : "Date of Birth"]: p.dateOfBirth,
          [ar ? "الجنس" : "Gender"]: p.gender === "M" ? (ar ? "ذكر" : "Male") : p.gender === "F" ? (ar ? "أنثى" : "Female") : p.gender,
          [ar ? "الوظيفة" : "Job Title"]: p.jobTitle,
          [ar ? "القسم" : "Department"]: p.department,
          [ar ? "الدرجة" : "Level"]: p.level,
          [ar ? "نوع التوظيف" : "Employment Type"]:
            p.employmentType === "THIRD_PARTY"
              ? (ar ? "طرف ثالث" : "Third Party")
              : (ar ? "داخلي (فندق)" : "Internal"),
          [ar ? "الشركة / جهة العمل" : "Company"]: p.companyName,
          [ar ? "العنوان بالبطاقة" : "Address"]: p.address,
          [ar ? "الهاتف" : "Phone"]: p.phone,
          [ar ? "المبنى" : "Building"]: p.buildingName,
          [ar ? "الطابق" : "Floor"]: p.floorName,
          [ar ? "رقم الغرفة" : "Room No"]: p.roomNumber,
          [ar ? "رقم السرير" : "Bed No"]:
            p.isEntireRoom
              ? `${p.bedNumber && p.bedNumber !== "—" ? p.bedNumber : 1} (${ar ? "غرفة كاملة" : "Full Lock"})`
              : p.bedNumber,
          [ar ? "تاريخ التسكين" : "Check-In Date"]: p.checkInDate,
          [ar ? "تاريخ التعيين" : "Hire Date"]: p.hireDate,
          [ar ? "انتهاء العقد" : "Contract End"]: p.contractEndDate,
          [ar ? "هاتف الطوارئ" : "Emergency Contact"]: p.emergencyContact,
          [ar ? "الحالة بالسكن" : "Status"]:
            p.status === "VACATION"
              ? (ar ? "في إجازة" : "Vacation")
              : p.status === "CHECKED_OUT"
              ? (ar ? "مغادر" : "Checked Out")
              : (ar ? "مقيم بالسكن" : "In-House"),
        }));

      case "water_distribution":
        return data.map((w: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: w.profileCode,
          [ar ? "الاسم بالكامل" : "Full Name"]: w.fullName,
          [ar ? "القسم" : "Department"]: w.department,
          [ar ? "المبنى" : "Building"]: w.buildingName,
          [ar ? "الدور" : "Floor"]: w.floorName,
          [ar ? "الغرفة" : "Room No"]: w.roomNumber,
          [ar ? "السرير" : "Bed No"]: w.bedNumber,
          [ar ? "الصرف الأول" : "1st Issue"]: "[  ]",
          [ar ? "الصرف الثاني" : "2nd Issue"]: "[  ]",
          [ar ? "توقيع المستلم" : "Signature"]: "",
        }));

      case "policy_exceptions":
        return data.map((ex: any) => ({
          [ar ? "اسم المقيم" : "Resident Name"]: ex.profileName,
          [ar ? "كود الموظف" : "Employee Code"]: ex.profileCode,
          [ar ? "الرقم القومي" : "National ID"]: ex.nationalId,
          [ar ? "الدرجة الوظيفية" : "Job Level"]: ex.jobLevel,
          [ar ? "القسم" : "Department"]: ex.department,
          [ar ? "المبنى" : "Building"]: ex.buildingName,
          [ar ? "رقم الغرفة" : "Room No"]: ex.roomNumber,
          [ar ? "سعة الغرفة" : "Capacity"]: ex.roomCapacity,
          [ar ? "الإشغال الحالي" : "Occupancy"]: ex.currentOccupancy,
          [ar ? "نوع المخالفة" : "Violation Type"]: ex.violationType,
          [ar ? "تفاصيل المخالفة والسياسة" : "Policy Details"]: ex.violationDetails,
          [ar ? "مستوى الأهمية" : "Severity"]: ex.severity,
          [ar ? "موقف المخالفة والتصحيح" : "Status / Resolution"]: ex.approvalStatus || (ar ? "قيد المراجعة" : "Pending"),
          [ar ? "تاريخ التصحيح" : "Resolution Date"]: ex.resolvedAt ? formatDate(ex.resolvedAt) : "—",
          [ar ? "إجراء المعالجة والتصحيح" : "Resolution Action"]: ex.resolutionDetails || "—",
          [ar ? "المعتمد للطلب" : "Approved By"]: ex.approvedBy || "—",
          [ar ? "سبب ومسوغات الاستثناء" : "Override Reason"]: ex.overrideReason,
        }));

      case "vacations":
        return data.map((v: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: v.profileCode,
          [ar ? "الاسم بالكامل" : "Employee Name"]: v.fullName,
          [ar ? "القسم" : "Department"]: v.department,
          [ar ? "الوظيفة" : "Job Title"]: v.jobTitle,
          [ar ? "المبنى" : "Building"]: v.buildingName,
          [ar ? "الطابق" : "Floor"]: v.floorName || "—",
          [ar ? "الغرفة والسرير" : "Room & Bed"]: v.housingInfo,
          [ar ? "نوع الغرفة" : "Room Type"]: v.roomType || "—",
          [ar ? "الجنس" : "Gender"]: v.genderLabel || (v.gender === "M" ? (ar ? "ذكر" : "Male") : v.gender === "F" ? (ar ? "أنثى" : "Female") : (v.gender || "—")),
          [ar ? "الجنسية" : "Nationality"]: v.nationalityLabel || (ar ? formatNationality(v.nationality, ar, false) : (v.nationality || "—")),
          [ar ? "بداية الإجازة" : "Vacation Start"]: v.startDate ? formatDate(v.startDate) : "—",
          [ar ? "العودة المتوقعة" : "Expected Return"]: v.endDate ? formatDate(v.endDate) : "—",
          [ar ? "العودة الفعلية" : "Actual Return"]: v.actualReturnDate && v.actualReturnDate !== "—" ? formatDate(v.actualReturnDate) : "—",
          [ar ? "المدة (أيام)" : "Duration (Days)"]: v.duration,
          [ar ? "حالة الإجازة" : "Status"]: v.status,
          [ar ? "ملاحظات" : "Notes"]: v.notes,
        }));

      default:
        if (ar && Array.isArray(data)) {
          return data.map((item: any) => {
            const trItem: Record<string, any> = {};
            for (const [key, val] of Object.entries(item)) {
              trItem[translateReportHeader(key, true)] = val;
            }
            return trItem;
          });
        }
        return data;
    }
  };

  const toExcelRows = (scope: "all" | "page" = "all"): Record<string, any>[] => {
    const raw = getRawRows(scope);
    if (typeof filterRow === "function") {
      return raw.map((r) => filterRow(r));
    }
    return raw;
  };

  const handleExportExcel = (scope: "all" | "page" = "all") => {
    if (!canExportReports) {
      toast.error(ar ? "ليس لديك صلاحية تصدير التقارير" : "You do not have permission to export reports");
      return;
    }
    const rows = toExcelRows(scope);
    if (!rows || rows.length === 0) {
      toast.warning(ar ? "لا توجد بيانات مطابقة لتصديرها إلى Excel" : "No matching data available to export to Excel");
      return;
    }
    exportExcel(activeTab, rows);
  };

  const handleExportPDF = async (scope: "all" | "page" = "all") => {
    if (!canExportReports) {
      toast.error(ar ? "ليس لديك صلاحية تصدير التقارير" : "You do not have permission to export reports");
      return;
    }
    const rows = toExcelRows(scope);
    if (!rows || rows.length === 0) {
      toast.warning(ar ? "لا توجد بيانات مطابقة لتصديرها كـ PDF" : "No matching data available to export as PDF");
      return;
    }
    const isArabic = ar; // Direct language mode — zero popup prompting!
    let extraOpts: any = {};

    if (activeTab === "manager_flash" && profiles && profiles.length > 0) {
      // Top Departments breakdown
      const deptCounts: Record<string, number> = {};
      profiles.forEach((p: any) => {
        const dept = isArabic ? getProfileDisplayDepartment(p, true) : (p.department?.trim() || "Unassigned");
        deptCounts[dept] = (deptCounts[dept] || 0) + 1;
      });
      const totalP = profiles.length || 1;
      const deptList = Object.entries(deptCounts)
        .map(([name, count]) => ({
          name,
          count,
          percent: Math.round((count / totalP) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 6);

      // Top Nationalities breakdown
      const natCounts: Record<string, number> = {};
      profiles.forEach((p: any) => {
        const nat = isArabic ? (formatNationality(p.nationality, true, false) || "غير مسجل") : (p.nationality?.trim() || "Other");
        natCounts[nat] = (natCounts[nat] || 0) + 1;
      });
      const natList = Object.entries(natCounts)
        .map(([name, count]) => ({
          name,
          count,
          percent: Math.round((count / totalP) * 100),
        }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 5);

      extraOpts.customBottomSectionsHtml = `
        <div class="demographics-grid" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin: 14px 0 16px 0; page-break-inside: avoid;">
          <!-- Top Occupying Departments -->
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #ffffff;">
            <div style="font-weight: 800; font-size: 8.5pt; color: #0f2a44; border-bottom: 1.5px solid #0f2a44; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <span>🏢 ${isArabic ? "أعلى الإدارات والأقسام إشغالاً بالسكن (Top Departments)" : "Top Occupying Departments"}</span>
              <span style="font-size: 7.5pt; color: #64748b; font-weight: 600;">${profiles.length} ${isArabic ? "موظف مسجل" : "Registered Staff"}</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
              <thead>
                <tr style="border-bottom: 1px solid #cbd5e1; color: #334155; font-weight: 700;">
                  <th style="text-align: ${isArabic ? "right" : "left"}; padding: 4px 5px;">${isArabic ? "الإدارة / القسم" : "Department"}</th>
                  <th style="text-align: center; padding: 4px 5px; width: 60px;">${isArabic ? "العدد" : "Count"}</th>
                  <th style="text-align: center; padding: 4px 5px; width: 60px;">${isArabic ? "النسبة" : "Percent"}</th>
                  <th style="text-align: center; padding: 4px 5px; width: 90px;">${isArabic ? "التمثيل" : "Progress"}</th>
                </tr>
              </thead>
              <tbody>
                ${deptList.map((d) => `
                  <tr style="border-bottom: 0.5px solid #f1f5f9;">
                    <td style="text-align: ${isArabic ? "right" : "left"}; padding: 4px 5px; font-weight: 600; color: #0f172a;">${d.name}</td>
                    <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #0284c7;">${d.count}</td>
                    <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #334155;">${d.percent}%</td>
                    <td style="text-align: center; padding: 4px 5px;">
                      <div style="background: #e2e8f0; border-radius: 3px; height: 6px; width: 100%; overflow: hidden;">
                        <div style="background: #0284c7; height: 6px; width: ${Math.min(d.percent, 100)}%;"></div>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>

          <!-- Nationalities Distribution -->
          <div style="border: 1px solid #cbd5e1; border-radius: 6px; padding: 10px 12px; background: #ffffff;">
            <div style="font-weight: 800; font-size: 8.5pt; color: #0f2a44; border-bottom: 1.5px solid #0f2a44; padding-bottom: 4px; margin-bottom: 8px; display: flex; justify-content: space-between; align-items: center;">
              <span>🌍 ${isArabic ? "توزيع الجنسيات بالسكن (Nationalities Distribution)" : "Nationalities Distribution"}</span>
              <span style="font-size: 7.5pt; color: #64748b; font-weight: 600;">${natList.length} ${isArabic ? "جنسيات" : "Nationalities"}</span>
            </div>
            <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt;">
              <thead>
                <tr style="border-bottom: 1px solid #cbd5e1; color: #334155; font-weight: 700;">
                  <th style="text-align: ${isArabic ? "right" : "left"}; padding: 4px 5px;">${isArabic ? "الجنسية" : "Nationality"}</th>
                  <th style="text-align: center; padding: 4px 5px; width: 60px;">${isArabic ? "العدد" : "Count"}</th>
                  <th style="text-align: center; padding: 4px 5px; width: 60px;">${isArabic ? "النسبة" : "Percent"}</th>
                  <th style="text-align: center; padding: 4px 5px; width: 90px;">${isArabic ? "التمثيل" : "Progress"}</th>
                </tr>
              </thead>
              <tbody>
                ${natList.map((n) => `
                  <tr style="border-bottom: 0.5px solid #f1f5f9;">
                    <td style="text-align: ${isArabic ? "right" : "left"}; padding: 4px 5px; font-weight: 600; color: #0f172a;">${n.name}</td>
                    <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #059669;">${n.count}</td>
                    <td style="text-align: center; padding: 4px 5px; font-weight: 700; color: #334155;">${n.percent}%</td>
                    <td style="text-align: center; padding: 4px 5px;">
                      <div style="background: #e2e8f0; border-radius: 3px; height: 6px; width: 100%; overflow: hidden;">
                        <div style="background: #059669; height: 6px; width: ${Math.min(n.percent, 100)}%;"></div>
                      </div>
                    </td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          </div>
        </div>
      `;
    }

    exportPDF(
      activeTab,
      rows,
      properties,
      propId,
      activePropertyId,
      dateFrom,
      dateTo,
      search,
      settings,
      isArabic ? "ar" : "en",
      extraOpts,
    );
  };

  const handleExportAnalyticsPDF = async () => {
    if (!canExportReports) return;
    const isArabic = ar; // Direct language mode — zero popup prompting!
    printArabicAnalyticsReport({
      analytics,
      stats,
      rooms,
      profiles,
      buildings,
      floors,
      evalStats,
      properties,
      propId,
      activePropertyId,
      settings,
      language: isArabic ? "ar" : "en",
    });
  };

  return {
    handleExportExcel,
    handleExportPDF,
    handleExportAnalyticsPDF,
  };
}
