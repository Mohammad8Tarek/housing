import { exportExcel, exportPDF, exportAnalyticsPDF } from "../utils/export";

export function useReportExport({
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
}: any) {
  const toExcelRows = (): Record<string, any>[] => {
    const data = currentData();
    switch (activeTab) {
      case "assignments":
        return data.map((a: any) => ({
          "كود الموظف / Code": a.profileCode,
          "الاسم / Full Name": a.fullName,
          "نوع التوظيف / Type": a.employmentType === "THIRD_PARTY" ? "طرف ثالث" : "داخلي (فندق)",
          "الشركة / Works At": a.companyName,
          "رقم الغرفة / Room No": a.roomNumber,
          "رقم السرير / Bed No": a.bedNumber,
          "المبنى / Building": a.buildingName,
          "الطابق / Floor": a.floorName,
          "القسم / Department": a.department,
          "الوظيفة / Job Title": a.jobTitle,
          "الهاتف / Phone": a.phone,
          "الرقم القومي / National ID": a.nationalId,
          "تاريخ التسكين / Check-In": a.checkInDate,
          "انتهاء العقد / Contract End": a.contractEndDate,
          "المغادرة المتوقعة / Expected Out": a.expectedCheckOutDate,
          "الحالة / Status": a.status,
        }));

      case "vacant_rooms":
        return data.map((r: any) => ({
          "رقم الغرفة / Room No": r.roomNumber,
          "المبنى / Building": r.buildingName,
          "الطابق / Floor": r.floorName,
          "نوع الغرفة / Room Type": r.roomType,
          "السعة الإجمالية / Capacity": r.capacity,
          "المشغول / Occupied": r.currentOccupancy,
          "عدد الأسرة الشاغرة / Vacant Beds": r.vacantBedsCount,
          "الأسرة المتاحة / Available Beds": r.availableBedsText,
          "سياسة الجنس / Gender Policy": r.genderPolicy,
          "حالة الغرفة / Status": r.status,
        }));

      case "housing":
        return data.map((r: any) => ({
          "رقم الغرفة / Room No": r.roomNumber,
          "المبنى / Building": r.buildingName,
          "الطابق / Floor": r.floorName,
          "نوع الغرفة / Type": r.roomType,
          "السعة / Capacity": r.capacity,
          "المشغول / Occupied": r.currentOccupancy,
          "الشاغر / Vacant Beds": r.vacantBeds,
          "نسبة الإشغال / Occupancy Rate": r.occupancyRate,
          "سياسة الجنس / Gender Policy": r.genderPolicy,
          "حالة الغرفة / Status": r.status,
        }));

      case "profiles":
        return data.map((e: any) => ({
          "كود الموظف / Code": e.profileCode,
          "الاسم الأول / First Name": e.firstName,
          "الاسم الأخير / Last Name": e.lastName,
          "نوع التوظيف / Type": e.employmentType === "THIRD_PARTY" ? "طرف ثالث" : "داخلي (فندق)",
          "الشركة / Works At": e.companyName,
          "الرقم القومي / National ID": e.nationalId,
          "الهاتف / Phone": e.phone,
          "الجنسية / Nationality": e.nationality,
          "الجنس / Gender": e.gender,
          "القسم / Department": e.department,
          "الوظيفة / Job Title": e.jobTitle,
          "الدرجة / Level": e.level,
          "السكن الحالي / Current Housing": e.assignedRoom,
          "تاريخ التعيين / Hire Date": e.hireDate,
          "انتهاء العقد / Contract End": e.contractEndDate,
          "الحالة / Status": e.status,
        }));

      case "expiring_contracts":
        return data.map((c: any) => ({
          "كود الموظف / Code": c.profileCode,
          "اسم الموظف / Name": c.fullName,
          "القسم / Department": c.department,
          "الوظيفة / Job Title": c.jobTitle,
          "السكن الحالي / Housing": c.assignedRoom,
          "الهاتف / Phone": c.phone,
          "الرقم القومي / National ID": c.nationalId,
          "تاريخ انتهاء العقد / Contract End Date": c.contractEndDate,
          "الأيام المتبقية / Days Remaining": c.daysRemaining,
          "حالة العقد / Status": c.expStatus,
        }));

      case "reservations":
        return data.map((r: any) => ({
          "اسم الضيف / Guest Name": r.guestName,
          "الرقم القومي / ID Card": r.nationalId,
          "الهاتف / Phone": r.phone,
          "القسم / Department": r.department,
          "الوظيفة / Job Title": r.jobTitle,
          "نوع الغرفة / Room Type": r.roomType,
          "الغرفة المحجوزة / Reserved Room": r.roomNumber,
          "تاريخ الوصول / Check-In": r.checkInDate,
          "تاريخ المغادرة / Check-Out": r.checkOutDate,
          "الحالة / Status": r.status,
        }));

      case "hostings":
        return data.map((h: any) => ({
          "الموظف المستضيف / Host": h.hostEmployee,
          "القسم / Department": h.hostDept,
          "اسم الضيف / Guest Name": h.guestName,
          "صلة القرابة / Relation": h.relation,
          "رقم الهوية / ID": h.guestId,
          "رقم الغرفة / Room No": h.roomNumber,
          "تاريخ الدخول / Check-In": h.checkInDate,
          "تاريخ المغادرة / Check-Out": h.checkOutDate,
          "سعر اليوم / Daily Rate": h.dailyRate,
          "الإجمالي / Total Fee": h.totalAmount,
          "الحالة / Status": h.status,
        }));

      case "maintenance":
        return data.map((m: any) => ({
          "رقم الغرفة / Room No": m.roomNumber,
          "المبنى / Building": m.buildingName,
          "الفئة / Category": m.category,
          "وصف المشكلة / Problem Details": m.problemType,
          "الأولوية / Priority": m.priority,
          "الفني المعين / Assigned To": m.assignedTo,
          "تاريخ البلاغ / Reported Date": m.reportedAt,
          "الحالة / Status": m.status,
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

  const handleExportAnalyticsPDF = () => {
    if (!canExportReports) return;
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
  };

  return {
    handleExportExcel,
    handleExportPDF,
    handleExportAnalyticsPDF,
  };
}
