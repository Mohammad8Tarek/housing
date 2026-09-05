import { exportExcel, exportPDF, exportAnalyticsPDF, printArabicAnalyticsReport } from "../utils/export";
import { getRoomStatusLabel } from "@/pages/housing/utils";

export function useReportExport({
  ar = true,
  activeTab,
  canExportReports,
  currentData,
  properties,
  propId,
  activePropertyId,
  dateFrom,
  dateTo,
  search,
  settings,
  analytics,
  rooms,
  profiles,
  evalStats,
  floorMap,
  buildingMap,
  empMap,
  roomMap,
  openPrintDialog,
}: any) {
  const toExcelRows = (): Record<string, any>[] => {
    const data = currentData();
    switch (activeTab) {
      case "assignments":
        return data.map((a: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: a.profileCode,
          [ar ? "الاسم" : "Full Name"]: a.fullName,
          [ar ? "نوع التوظيف" : "Employment Type"]:
            a.employmentType === "THIRD_PARTY"
              ? (ar ? "طرف ثالث" : "Third Party")
              : (ar ? "داخلي (فندق)" : "Internal"),
          [ar ? "الشركة" : "Company"]: a.companyName,
          [ar ? "رقم الغرفة" : "Room No"]: a.roomNumber,
          [ar ? "رقم السرير" : "Bed No"]:
            a.isEntireRoom
              ? `${a.bedNumber && a.bedNumber !== "—" ? a.bedNumber : 1} (${ar ? "غرفة كاملة" : "Full Lock"})`
              : a.bedNumber,
          [ar ? "المبنى" : "Building"]: a.buildingName,
          [ar ? "الطابق" : "Floor"]: a.floorName,
          [ar ? "القسم" : "Department"]: a.department,
          [ar ? "الوظيفة" : "Job Title"]: a.jobTitle,
          [ar ? "الهاتف" : "Phone"]: a.phone,
          [ar ? "الرقم القومي" : "National ID"]: a.nationalId,
          [ar ? "تاريخ التسكين" : "Check-In Date"]: a.checkInDate,
          [ar ? "انتهاء العقد" : "Contract End"]: a.contractEndDate,
          [ar ? "المغادرة المتوقعة" : "Expected Check-Out"]: a.expectedCheckOutDate,
          [ar ? "الحالة" : "Status"]:
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
          [ar ? "رقم الغرفة" : "Room No"]: r.roomNumber,
          [ar ? "المبنى" : "Building"]: r.buildingName,
          [ar ? "الطابق" : "Floor"]: r.floorName,
          [ar ? "نوع الغرفة" : "Room Type"]: r.roomType,
          [ar ? "السعة الإجمالية" : "Capacity"]: r.capacity,
          [ar ? "المشغول" : "Occupied"]: r.currentOccupancy,
          [ar ? "عدد الأسرة الشاغرة" : "Vacant Beds"]: r.vacantBedsCount,
          [ar ? "الأسرة المتاحة" : "Available Beds"]: r.availableBedsText,
          [ar ? "سياسة الجنس" : "Gender Policy"]: r.genderPolicy,
          [ar ? "حالة الغرفة" : "Room Status"]: getRoomStatusLabel(r.status, ar),
        }));

      case "housing":
        return data.map((r: any) => ({
          [ar ? "رقم الغرفة" : "Room No"]: r.roomNumber,
          [ar ? "المبنى" : "Building"]: r.buildingName,
          [ar ? "الطابق" : "Floor"]: r.floorName,
          [ar ? "نوع الغرفة" : "Room Type"]: r.roomType,
          [ar ? "السعة" : "Capacity"]: r.capacity,
          [ar ? "المشغول" : "Occupied"]: r.currentOccupancy,
          [ar ? "الشاغر" : "Vacant Beds"]: r.vacantBeds,
          [ar ? "نسبة الإشغال" : "Occupancy Rate"]: r.occupancyRate,
          [ar ? "سياسة الجنس" : "Gender Policy"]: r.genderPolicy,
          [ar ? "حالة الغرفة" : "Room Status"]: getRoomStatusLabel(r.status, ar),
        }));

      case "profiles":
        return data.map((e: any) => ({
          [ar ? "كود الموظف" : "Employee Code"]: e.profileCode,
          [ar ? "الاسم الأول" : "First Name"]: e.firstName,
          [ar ? "الاسم الأخير" : "Last Name"]: e.lastName,
          [ar ? "نوع التوظيف" : "Employment Type"]:
            e.employmentType === "THIRD_PARTY"
              ? (ar ? "طرف ثالث" : "Third Party")
              : (ar ? "داخلي (فندق)" : "Internal"),
          [ar ? "الشركة" : "Company"]: e.companyName,
          [ar ? "الرقم القومي" : "National ID"]: e.nationalId,
          [ar ? "الهاتف" : "Phone"]: e.phone,
          [ar ? "الجنسية" : "Nationality"]: e.nationality,
          [ar ? "الجنس" : "Gender"]: e.gender,
          [ar ? "القسم" : "Department"]: e.department,
          [ar ? "الوظيفة" : "Job Title"]: e.jobTitle,
          [ar ? "الدرجة" : "Level"]: e.level,
          [ar ? "السكن الحالي" : "Current Housing"]: e.assignedRoom,
          [ar ? "تاريخ التعيين" : "Hire Date"]: e.hireDate,
          [ar ? "انتهاء العقد" : "Contract End"]: e.contractEndDate,
          [ar ? "الحالة" : "Status"]: e.status,
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
          [ar ? "نوع الغرفة" : "Room Type"]: r.roomType,
          [ar ? "الغرفة المحجوزة" : "Reserved Room"]: r.roomNumber,
          [ar ? "تاريخ الوصول" : "Check-In"]: r.checkInDate,
          [ar ? "تاريخ المغادرة" : "Check-Out"]: r.checkOutDate,
          [ar ? "الحالة" : "Status"]: r.status,
        }));

      case "hostings":
        return data.map((h: any) => ({
          [ar ? "الموظف المستضيف" : "Host Employee"]: h.hostEmployee,
          [ar ? "القسم" : "Department"]: h.hostDept,
          [ar ? "اسم الضيف" : "Guest Name"]: h.guestName,
          [ar ? "صلة القرابة" : "Relationship"]: h.relation,
          [ar ? "رقم الهوية" : "ID Number"]: h.guestId,
          [ar ? "رقم الغرفة" : "Room No"]: h.roomNumber,
          [ar ? "تاريخ الدخول" : "Check-In"]: h.checkInDate,
          [ar ? "تاريخ المغادرة" : "Check-Out"]: h.checkOutDate,
          [ar ? "سعر اليوم" : "Daily Rate"]: h.dailyRate,
          [ar ? "الإجمالي" : "Total Fee"]: h.totalAmount,
          [ar ? "الحالة" : "Status"]: h.status,
        }));

      case "maintenance":
        return data.map((m: any) => ({
          [ar ? "رقم الغرفة" : "Room No"]: m.roomNumber,
          [ar ? "المبنى" : "Building"]: m.buildingName,
          [ar ? "الفئة" : "Category"]: m.category,
          [ar ? "وصف المشكلة" : "Problem Details"]: m.problemType,
          [ar ? "الأولوية" : "Priority"]: m.priority,
          [ar ? "الفني المعين" : "Assigned To"]: m.assignedTo,
          [ar ? "تاريخ البلاغ" : "Reported Date"]: m.reportedAt,
          [ar ? "الحالة" : "Status"]: m.status,
        }));

      default:
        return data;
    }
  };

  const handleExportExcel = () => {
    if (!canExportReports) return;
    const rows = toExcelRows();
    exportExcel(activeTab, rows);
  };

  const handleExportPDF = () => {
    if (!canExportReports) return;
    const rows = toExcelRows();
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
    );
  };

  const handleExportAnalyticsPDF = async () => {
    if (!canExportReports) return;
    let isArabic = ar;
    if (typeof openPrintDialog === "function") {
      isArabic = await openPrintDialog();
    }
    if (isArabic) {
      printArabicAnalyticsReport({
        analytics,
        rooms,
        profiles,
        evalStats,
        properties,
        propId,
        activePropertyId,
        settings,
      });
    } else {
      exportAnalyticsPDF(
        analytics,
        rooms,
        profiles,
        evalStats,
        properties,
        propId,
        activePropertyId,
        settings,
      );
    }
  };

  return {
    handleExportExcel,
    handleExportPDF,
    handleExportAnalyticsPDF,
  };
}
