import { useState, useMemo, useEffect } from "react";
import { ColDef } from "@/components/ui/column-chooser";
import { Tab } from "../types";

export const REPORT_TAB_COLUMNS: Record<string, ColDef[]> = {
  manager_flash: [
    { key: "buildingName", label: "Building", labelAr: "المبنى", fixed: true },
    { key: "code", label: "Code", labelAr: "كود المبنى" },
    { key: "totalRooms", label: "Total Rooms", labelAr: "إجمالي الغرف" },
    { key: "totalBeds", label: "Total Beds", labelAr: "إجمالي الأسرة" },
    { key: "occupiedBeds", label: "Occupied Beds", labelAr: "الأسرة المشغولة" },
    { key: "vacantBeds", label: "Vacant Beds", labelAr: "الأسرة الشاغرة" },
    { key: "dirtyRooms", label: "Dirty Rooms", labelAr: "غرف متسخة" },
    { key: "oooRooms", label: "OOO Rooms", labelAr: "غرف صيانة" },
    { key: "occupancyRate", label: "Occupancy Rate", labelAr: "نسبة الإشغال" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  arrivals_manifest: [
    { key: "profileName", label: "Guest Name", labelAr: "اسم النزيل", fixed: true },
    { key: "profileId", label: "Profile / ID", labelAr: "رقم الموظف / الهوية" },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "المسمى الوظيفي" },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "bedNumber", label: "Bed No", labelAr: "السرير" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "checkInDate", label: "Arrival Date", labelAr: "تاريخ الوصول" },
    { key: "checkOutDate", label: "Departure Date", labelAr: "تاريخ المغادرة" },
    { key: "nights", label: "Nights", labelAr: "الليالي" },
    { key: "vipStatus", label: "Category", labelAr: "الفئة" },
    { key: "status", label: "Status", labelAr: "حالة الحجز" },
    { key: "notes", label: "Notes", labelAr: "ملاحظات" },
  ],
  departures_manifest: [
    { key: "profileName", label: "Employee Name", labelAr: "اسم الموظف", fixed: true },
    { key: "profileId", label: "Profile ID", labelAr: "كود الموظف" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "roomNumber", label: "Room No", labelAr: "الغرفة" },
    { key: "bedNumber", label: "Bed No", labelAr: "السرير" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "checkInDate", label: "Check-In Date", labelAr: "تاريخ التسكين" },
    { key: "checkOutDate", label: "Due Out Date", labelAr: "المغادرة المستحقة" },
    { key: "departureCategory", label: "Departure Type", labelAr: "نوع المغادرة" },
    { key: "reason", label: "Reason / Notes", labelAr: "السبب / ملاحظات HR" },
    { key: "roomStatusAfter", label: "Room Status", labelAr: "حالة الغرفة" },
  ],
  housekeeping_sheet: [
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة", fixed: true },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "foStatus", label: "FO Status", labelAr: "حالة الإشغال (FO)" },
    { key: "hkStatus", label: "HK Status", labelAr: "حالة النظافة (HK)" },
    { key: "taskType", label: "Task Type", labelAr: "المهمة المطلوبة" },
    { key: "estimatedMins", label: "Est Time", labelAr: "الوقت التقديري" },
    { key: "occupantNames", label: "Current Occupants", labelAr: "النزلاء الحاليون" },
    { key: "linenCheck", label: "Linen Check", labelAr: "فحص المفروشات" },
    { key: "amenitiesCheck", label: "Amenities Check", labelAr: "فحص العهد" },
    { key: "signature", label: "Signature", labelAr: "توقيع المنفذ" },
  ],
  room_discrepancy: [
    { key: "severityLabel", label: "Severity", labelAr: "مستوى الخطورة", fixed: true },
    { key: "typeLabel", label: "Discrepancy Type", labelAr: "نوع التباين" },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "foStatus", label: "FO Status", labelAr: "حالة الاستقبال (FO)" },
    { key: "hkStatus", label: "HK Status", labelAr: "حالة الهاوس كيبنج (HK)" },
    { key: "impactedResidents", label: "Impacted Residents", labelAr: "النزلاء المتأثرون" },
    { key: "recommendedAction", label: "Recommended Action", labelAr: "الإجراء الموصى به" },
  ],
  occupancy_forecast: [
    { key: "dateDisplay", label: "Date", labelAr: "التاريخ", fixed: true },
    { key: "dayName", label: "Day", labelAr: "اليوم" },
    { key: "dayArrivals", label: "Arrivals (+ Due In)", labelAr: "الوصول المتوقع (+ Due In)" },
    { key: "dayDepartures", label: "Departures (- Due Out)", labelAr: "المغادرة المتوقعة (- Due Out)" },
    { key: "netShift", label: "Net Movement", labelAr: "صافي الحركة" },
    { key: "projectedOccupied", label: "Projected Occupied", labelAr: "الأسرة المشغولة" },
    { key: "projectedVacant", label: "Projected Vacant", labelAr: "الأسرة الشاغرة" },
    { key: "totalBeds", label: "Total Capacity", labelAr: "إجمالي الطاقة" },
    { key: "occupancyRate", label: "Occupancy Rate", labelAr: "نسبة الإشغال" },
    { key: "demandLevel", label: "Demand Tier", labelAr: "مستوى الضغط" },
  ],
  assignments: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Full Name", labelAr: "الاسم بالكامل (ثلاثي)", fixed: true },
    { key: "thirdName", label: "Third Name", labelAr: "الاسم الثالث" },
    { key: "employmentType", label: "Employment Type", labelAr: "نوع التوظيف" },
    { key: "companyName", label: "Company", labelAr: "الشركة" },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "bedNumber", label: "Bed No", labelAr: "رقم السرير" },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "level", label: "Level", labelAr: "الدرجة" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { key: "nationality", label: "Nationality", labelAr: "الجنسية" },
    { key: "gender", label: "Gender", labelAr: "الجنس" },
    { key: "dateOfBirth", label: "Date of Birth", labelAr: "تاريخ الميلاد" },
    { key: "address", label: "Address", labelAr: "العنوان" },
    { key: "hireDate", label: "Hire Date", labelAr: "تاريخ التعيين" },
    { key: "checkInDate", label: "Check-In Date", labelAr: "تاريخ التسكين" },
    { key: "contractEndDate", label: "Contract End", labelAr: "انتهاء العقد" },
    { key: "expectedCheckOutDate", label: "Expected Check-Out", labelAr: "المغادرة المتوقعة" },
    { key: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { key: "emergencyContact", label: "Emergency Contact", labelAr: "هاتف الطوارئ" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  vacant_rooms: [
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة", fixed: true },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "capacity", label: "Capacity", labelAr: "السعة الإجمالية" },
    { key: "currentOccupancy", label: "Occupied", labelAr: "المشغول" },
    { key: "vacantBedsCount", label: "Vacant Beds", labelAr: "عدد الأسرة الشاغرة" },
    { key: "availableBedsText", label: "Available Beds", labelAr: "الأسرة المتاحة" },
    { key: "genderPolicy", label: "Gender Policy", labelAr: "سياسة الجنس" },
    { key: "status", label: "Room Status", labelAr: "حالة الغرفة" },
  ],
  housing: [
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة", fixed: true },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "capacity", label: "Capacity", labelAr: "السعة" },
    { key: "currentOccupancy", label: "Occupied", labelAr: "المشغول" },
    { key: "vacantBeds", label: "Vacant Beds", labelAr: "الشاغر" },
    { key: "occupancyRate", label: "Occupancy Rate", labelAr: "نسبة الإشغال" },
    { key: "genderPolicy", label: "Gender Policy", labelAr: "سياسة الجنس" },
    { key: "status", label: "Room Status", labelAr: "حالة الغرفة" },
  ],
  profiles: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Full Name", labelAr: "الاسم بالكامل (ثلاثي)", fixed: true },
    { key: "firstName", label: "First Name", labelAr: "الاسم الأول" },
    { key: "lastName", label: "Second Name", labelAr: "الاسم الثاني" },
    { key: "thirdName", label: "Third Name", labelAr: "الاسم الثالث" },
    { key: "fourthName", label: "Fourth Name", labelAr: "الاسم الرابع" },
    { key: "employmentType", label: "Employment Type", labelAr: "نوع التوظيف" },
    { key: "companyName", label: "Company", labelAr: "الشركة" },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "nationality", label: "Nationality", labelAr: "الجنسية" },
    { key: "gender", label: "Gender", labelAr: "الجنس" },
    { key: "dateOfBirth", label: "Date of Birth", labelAr: "تاريخ الميلاد" },
    { key: "address", label: "Address", labelAr: "العنوان" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "level", label: "Level", labelAr: "الدرجة" },
    { key: "assignedRoom", label: "Current Housing", labelAr: "السكن الحالي" },
    { key: "hireDate", label: "Hire Date", labelAr: "تاريخ التعيين" },
    { key: "contractEndDate", label: "Contract End", labelAr: "انتهاء العقد" },
    { key: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { key: "emergencyContact", label: "Emergency Contact", labelAr: "هاتف الطوارئ" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  expiring_contracts: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Employee Name", labelAr: "اسم الموظف", fixed: true },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "assignedRoom", label: "Current Housing", labelAr: "السكن الحالي" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { key: "contractEndDate", label: "Contract End Date", labelAr: "تاريخ انتهاء العقد" },
    { key: "daysRemaining", label: "Days Remaining", labelAr: "الأيام المتبقية" },
    { key: "expStatus", label: "Contract Status", labelAr: "حالة العقد" },
  ],
  reservations: [
    { key: "guestName", label: "Guest Name", labelAr: "اسم الضيف", fixed: true },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "roomNumber", label: "Reserved Room", labelAr: "الغرفة المحجوزة" },
    { key: "checkInDate", label: "Check-In", labelAr: "تاريخ الوصول" },
    { key: "checkOutDate", label: "Check-Out", labelAr: "تاريخ المغادرة" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  hostings: [
    { key: "hostEmployee", label: "Host Employee", labelAr: "الموظف المستضيف", fixed: true },
    { key: "hostDept", label: "Department", labelAr: "القسم" },
    { key: "guestName", label: "Guest Name", labelAr: "اسم الضيف", fixed: true },
    { key: "relation", label: "Relationship", labelAr: "صلة القرابة" },
    { key: "guestId", label: "ID Number", labelAr: "رقم الهوية" },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "checkInDate", label: "Check-In", labelAr: "تاريخ الدخول" },
    { key: "checkOutDate", label: "Check-Out", labelAr: "تاريخ المغادرة" },
    { key: "dailyRate", label: "Daily Rate", labelAr: "سعر اليوم" },
    { key: "totalAmount", label: "Total Fee", labelAr: "الإجمالي" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  maintenance: [
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة", fixed: true },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "category", label: "Category", labelAr: "الفئة" },
    { key: "problemType", label: "Problem Details", labelAr: "وصف المشكلة" },
    { key: "priority", label: "Priority", labelAr: "الأولوية" },
    { key: "assignedTo", label: "Assigned To", labelAr: "الفني المعين" },
    { key: "reportedAt", label: "Reported Date", labelAr: "تاريخ البلاغ" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  equipment_inventory: [
    { key: "itemName", label: "Item Name", labelAr: "اسم الصنف / المعدة", fixed: true },
    { key: "category", label: "Category", labelAr: "التصنيف" },
    { key: "totalQuantity", label: "Total Quantity", labelAr: "إجمالي الكمية" },
    { key: "goodCount", label: "Good / Working", labelAr: "سليم / ممتاز" },
    { key: "needsRepairCount", label: "Needs Repair", labelAr: "بحاجة لصيانة" },
    { key: "damagedCount", label: "Damaged", labelAr: "تالف" },
    { key: "missingCount", label: "Missing", labelAr: "مفقود" },
    { key: "roomsCount", label: "Rooms Count", labelAr: "عدد الغرف" },
    { key: "roomsSummary", label: "Rooms List", labelAr: "أرقام الغرف" },
  ],
  daily_movement: [
    { key: "movementType", label: "Movement Type", labelAr: "نوع الحركة", fixed: true },
    { key: "date", label: "Date / Time", labelAr: "التاريخ والوقت", fixed: true },
    { key: "profileName", label: "Resident / Profile", labelAr: "المقيم / النزيل" },
    { key: "profileCode", label: "Code", labelAr: "كود الموظف" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "roomNumber", label: "Room No", labelAr: "الغرفة" },
    { key: "bedNumber", label: "Bed No", labelAr: "السرير" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "notes", label: "Details / Reason", labelAr: "التفاصيل والملاحظات" },
  ],
  department_occupancy: [
    { key: "department", label: "Department", labelAr: "القسم", fixed: true },
    { key: "residentCount", label: "Total Residents", labelAr: "إجمالي المقيمين", fixed: true },
    { key: "maleCount", label: "Males", labelAr: "ذكور" },
    { key: "femaleCount", label: "Females", labelAr: "إناث" },
    { key: "roomsCount", label: "Rooms Occupied", labelAr: "الغرف المشغولة" },
    { key: "shareOfHousing", label: "Share of Occupancy (%)", labelAr: "نسبة الإشغال الكلية" },
    { key: "buildingsList", label: "Assigned Buildings", labelAr: "المباني المسكن بها" },
  ],
  gate_logs: [
    { key: "scannedAt", label: "Scan Time", labelAr: "وقت المسح", fixed: true },
    { key: "action", label: "Direction / Action", labelAr: "الحركة (دخول/خروج)", fixed: true },
    { key: "profileName", label: "Person Name", labelAr: "الاسم" },
    { key: "profileCode", label: "ID / Code", labelAr: "كود الموظف" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "roomNumber", label: "Room No", labelAr: "الغرفة" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "guardName", label: "Security Officer", labelAr: "مسؤول الأمن" },
    { key: "status", label: "Access Status", labelAr: "حالة التصريح" },
  ],
  police_report: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Full Name", labelAr: "الاسم بالكامل (ثلاثي)", fixed: true },
    { key: "thirdName", label: "Third Name", labelAr: "الاسم الثالث" },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي", fixed: true },
    { key: "nationality", label: "Nationality", labelAr: "الجنسية" },
    { key: "dateOfBirth", label: "Date of Birth", labelAr: "تاريخ الميلاد" },
    { key: "gender", label: "Gender", labelAr: "الجنس" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "level", label: "Level", labelAr: "الدرجة" },
    { key: "employmentType", label: "Employment Type", labelAr: "نوع التوظيف" },
    { key: "companyName", label: "Company", labelAr: "الشركة / جهة العمل" },
    { key: "address", label: "Address", labelAr: "العنوان بالبطاقة" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "bedNumber", label: "Bed No", labelAr: "رقم السرير" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "checkInDate", label: "Check-In Date", labelAr: "تاريخ التسكين" },
    { key: "hireDate", label: "Hire Date", labelAr: "تاريخ التعيين" },
    { key: "contractEndDate", label: "Contract End", labelAr: "انتهاء العقد" },
    { key: "emergencyContact", label: "Emergency Contact", labelAr: "هاتف الطوارئ" },
    { key: "status", label: "Status", labelAr: "الحالة بالسكن" },
  ],
};

export function useReportColumns(activeTab: string, ar: boolean) {
  const allCols = useMemo<ColDef[]>(() => {
    return REPORT_TAB_COLUMNS[activeTab] || [];
  }, [activeTab]);

  const storageKey = `report_cols_${activeTab}`;

  const [visibleKeys, setVisibleKeys] = useState<Set<string>>(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return new Set(parsed);
        }
      }
    } catch {
      /* ignore */
    }
    return new Set(allCols.map((c) => c.key));
  });

  // Re-sync when tab changes
  useEffect(() => {
    try {
      const saved = localStorage.getItem(`report_cols_${activeTab}`);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          setVisibleKeys(new Set(parsed));
          return;
        }
      }
    } catch {
      /* ignore */
    }
    setVisibleKeys(new Set((REPORT_TAB_COLUMNS[activeTab] || []).map((c) => c.key)));
  }, [activeTab]);

  const toggle = (key: string, checked: boolean) => {
    setVisibleKeys((prev) => {
      const next = new Set(prev);
      if (checked) next.add(key);
      else {
        // Keep at least 1 column
        if (next.size > 1) next.delete(key);
      }
      try {
        localStorage.setItem(`report_cols_${activeTab}`, JSON.stringify(Array.from(next)));
      } catch {
        /* ignore */
      }
      return next;
    });
  };

  const showAll = () => {
    const next = new Set(allCols.map((c) => c.key));
    setVisibleKeys(next);
    try {
      localStorage.setItem(`report_cols_${activeTab}`, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }
  };

  const hideAll = () => {
    const next = new Set(allCols.filter((c) => c.fixed).map((c) => c.key));
    if (next.size === 0 && allCols.length > 0) {
      next.add(allCols[0].key);
    }
    setVisibleKeys(next);
    try {
      localStorage.setItem(`report_cols_${activeTab}`, JSON.stringify(Array.from(next)));
    } catch {
      /* ignore */
    }
  };

  const isVisible = (key: string) => visibleKeys.has(key);

  /** Filter row object by visible keys (maps either raw key or translated label) */
  const filterRow = (row: Record<string, any>): Record<string, any> => {
    if (allCols.length === 0) return row;
    const filtered: Record<string, any> = {};

    for (const [colKey, val] of Object.entries(row)) {
      // Find matching col definition
      const matchedCol = allCols.find(
        (c) => c.key === colKey || c.label === colKey || c.labelAr === colKey
      );

      if (matchedCol) {
        if (visibleKeys.has(matchedCol.key)) {
          filtered[colKey] = val;
        }
      } else {
        filtered[colKey] = val;
      }
    }

    return filtered;
  };

  return {
    cols: allCols,
    visible: visibleKeys,
    toggle,
    showAll,
    hideAll,
    isVisible,
    filterRow,
  };
}
