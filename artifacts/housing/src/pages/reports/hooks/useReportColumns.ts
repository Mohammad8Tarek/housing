import { useState, useMemo, useEffect } from "react";
import { ColDef } from "@/components/ui/column-chooser";
import { Tab } from "../types";

export const REPORT_TAB_COLUMNS: Record<string, ColDef[]> = {
  manager_flash: [
    { key: "buildingName", label: "Building & Code", labelAr: "المبنى والكود", fixed: true },
    { key: "totalRooms", label: "Total Rooms", labelAr: "إجمالي الغرف" },
    { key: "totalBeds", label: "Total Beds", labelAr: "إجمالي الأسرة" },
    { key: "occupiedBeds", label: "Occupied Beds", labelAr: "الأسرة المشغولة" },
    { key: "vacantBeds", label: "Vacant Beds", labelAr: "الأسرة الشاغرة" },
    { key: "dirtyRooms", label: "Dirty Rooms", labelAr: "غرف متسخة" },
    { key: "oooRooms", label: "OOO Rooms", labelAr: "غرف صيانة" },
    { key: "occupancyRate", label: "Occupancy Rate", labelAr: "نسبة الإشغال" },
    { key: "status", label: "Status", labelAr: "الحالة التشغيلية" },
  ],
  arrivals_manifest: [
    { key: "profileName", label: "Guest Name / Profile", labelAr: "اسم النزيل / الحجز", fixed: true },
    { key: "department", label: "Dept & Job Title", labelAr: "القسم والمسمى" },
    { key: "buildingName", label: "Building & Floor", labelAr: "المبنى والدور" },
    { key: "roomNumber", label: "Room & Bed", labelAr: "الغرفة والسرير" },
    { key: "checkInDate", label: "Arrival Date (Due In)", labelAr: "تاريخ الوصول (Due In)" },
    { key: "checkOutDate", label: "Departure Date", labelAr: "تاريخ المغادرة" },
    { key: "nights", label: "Nights", labelAr: "الليالي" },
    { key: "vipStatus", label: "Category", labelAr: "الفئة" },
    { key: "status", label: "Reservation Status", labelAr: "حالة الحجز" },
  ],
  departures_manifest: [
    { key: "profileName", label: "Resident / Profile", labelAr: "الموظف / النزيل", fixed: true },
    { key: "department", label: "Dept & Job Title", labelAr: "القسم والمسمى" },
    { key: "buildingName", label: "Building & Floor", labelAr: "المبنى والدور" },
    { key: "roomNumber", label: "Room & Bed", labelAr: "الغرفة والسرير" },
    { key: "checkInDate", label: "Check-In Date", labelAr: "تاريخ التسكين" },
    { key: "checkOutDate", label: "Due Out Date", labelAr: "المغادرة المستحقة (Due Out)" },
    { key: "departureCategory", label: "Departure Type", labelAr: "نوع المغادرة" },
    { key: "reason", label: "Reason / Notes", labelAr: "السبب / ملاحظات HR" },
    { key: "roomStatusAfter", label: "Room Status", labelAr: "حالة الغرفة" },
  ],
  housekeeping_sheet: [
    { key: "buildingName", label: "Building & Floor", labelAr: "المبنى والدور", fixed: true },
    { key: "roomNumber", label: "Room No", labelAr: "الغرفة", fixed: true },
    { key: "foStatus", label: "FO Status", labelAr: "حالة الإشغال (FO)" },
    { key: "hkStatus", label: "HK Status", labelAr: "حالة النظافة (HK)" },
    { key: "taskType", label: "Task Assignment", labelAr: "نوع المهمة المطلوبة" },
    { key: "occupantNames", label: "Current Occupants", labelAr: "النزلاء الحاليون" },
    { key: "estimatedMins", label: "Est Time", labelAr: "الوقت التقديري" },
    { key: "linenCheck", label: "Linen Check", labelAr: "فحص المفروشات" },
    { key: "amenitiesCheck", label: "Amenities Check", labelAr: "فحص العهد" },
    { key: "signature", label: "Signature", labelAr: "التوقيع والوقت" },
  ],
  room_discrepancy: [
    { key: "severity", label: "Severity", labelAr: "مستوى الخطورة", fixed: true },
    { key: "type", label: "Discrepancy Type", labelAr: "نوع التباين" },
    { key: "buildingName", label: "Building", labelAr: "المبنى والدور" },
    { key: "roomNumber", label: "Room No", labelAr: "الغرفة" },
    { key: "foStatus", label: "FO Status", labelAr: "حالة الاستقبال (FO)" },
    { key: "hkStatus", label: "HK Status", labelAr: "حالة الهاوس كيبنج (HK)" },
    { key: "impactedResidents", label: "Impacted Residents", labelAr: "النزلاء المتأثرون" },
    { key: "recommendedAction", label: "Recommended Action", labelAr: "الإجراء الموصى به" },
  ],
  occupancy_forecast: [
    { key: "dateDisplay", label: "Date & Day", labelAr: "التاريخ واليوم", fixed: true },
    { key: "dayArrivals", label: "Arrivals (+ Due In)", labelAr: "الوصول المتوقع (+ Due In)" },
    { key: "dayDepartures", label: "Departures (- Due Out)", labelAr: "المغادرة المتوقعة (- Due Out)" },
    { key: "netShift", label: "Net Movement", labelAr: "صافي الحركة" },
    { key: "projectedOccupied", label: "Projected Occupied", labelAr: "الأسرة المشغولة" },
    { key: "projectedVacant", label: "Projected Vacant", labelAr: "الأسرة الشاغرة" },
    { key: "occupancyRate", label: "Occupancy Rate", labelAr: "نسبة الإشغال" },
    { key: "demandLevel", label: "Demand Tier", labelAr: "مستوى الضغط" },
  ],
  assignments: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Full Name", labelAr: "الاسم بالكامل", fixed: true },
    { key: "employmentType", label: "Employment Type", labelAr: "نوع التوظيف" },
    { key: "buildingName", label: "Building & Floor", labelAr: "المبنى والدور" },
    { key: "roomNumber", label: "Room & Bed", labelAr: "الغرفة والسرير" },
    { key: "department", label: "Dept & Job Title", labelAr: "القسم والوظيفة" },
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
    { key: "buildingName", label: "Building & Floor", labelAr: "المبنى والطابق", fixed: true },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة", fixed: true },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "capacity", label: "Capacity", labelAr: "السعة الإجمالية" },
    { key: "currentOccupancy", label: "Occupied", labelAr: "المشغول" },
    { key: "vacantBedsCount", label: "Vacant Beds", labelAr: "الأسرة الشاغرة" },
    { key: "availableBedsText", label: "Available Beds", labelAr: "الأسرة المتاحة" },
    { key: "genderPolicy", label: "Gender Policy", labelAr: "سياسة الجنس" },
    { key: "status", label: "Room Status", labelAr: "حالة الغرفة" },
  ],
  housing: [
    { key: "buildingName", label: "Building & Floor", labelAr: "المبنى والطابق", fixed: true },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة", fixed: true },
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
    { key: "fullName", label: "Full Name", labelAr: "الاسم بالكامل", fixed: true },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "level", label: "Level", labelAr: "الدرجة" },
    { key: "assignedRoom", label: "Current Housing", labelAr: "السكن الحالي" },
    { key: "employmentType", label: "Employment Type", labelAr: "نوع التوظيف" },
    { key: "companyName", label: "Company", labelAr: "الشركة / جهة العمل" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { key: "nationality", label: "Nationality", labelAr: "الجنسية" },
    { key: "gender", label: "Gender", labelAr: "الجنس" },
    { key: "hireDate", label: "Hire Date", labelAr: "تاريخ التعيين" },
    { key: "contractEndDate", label: "Contract End", labelAr: "انتهاء العقد" },
    { key: "status", label: "Status", labelAr: "الحالة بالسكن" },
    { key: "dateOfBirth", label: "Date of Birth", labelAr: "تاريخ الميلاد" },
    { key: "address", label: "Address", labelAr: "العنوان بالبطاقة" },
    { key: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { key: "emergencyContact", label: "Emergency Contact", labelAr: "هاتف الطوارئ" },
  ],
  expiring_contracts: [
    { key: "fullName", label: "Employee & Code", labelAr: "الموظف والكود", fixed: true },
    { key: "department", label: "Dept & Job Title", labelAr: "القسم والوظيفة" },
    { key: "assignedRoom", label: "Current Housing", labelAr: "السكن الحالي" },
    { key: "phone", label: "Phone", labelAr: "الهاتف" },
    { key: "contractEndDate", label: "Contract End Date", labelAr: "تاريخ انتهاء العقد" },
    { key: "daysRemaining", label: "Days Remaining", labelAr: "الأيام المتبقية" },
    { key: "expStatus", label: "Contract Status", labelAr: "حالة العقد" },
  ],
  reservations: [
    { key: "guestName", label: "Guest Name", labelAr: "اسم الضيف", fixed: true },
    { key: "nationalId", label: "ID & Phone", labelAr: "الرقم القومي والهاتف" },
    { key: "department", label: "Dept & Title", labelAr: "القسم والوظيفة" },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "roomNumber", label: "Reserved Room", labelAr: "الغرفة المحجوزة" },
    { key: "checkInDate", label: "Arrival Date", labelAr: "تاريخ الوصول" },
    { key: "checkOutDate", label: "Check-Out", labelAr: "تاريخ المغادرة" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  hostings: [
    { key: "hostEmployee", label: "Host Employee", labelAr: "الموظف المستضيف", fixed: true },
    { key: "guestName", label: "Guest & Relation", labelAr: "اسم الضيف والصلة", fixed: true },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "checkInDate", label: "Check-In", labelAr: "من تاريخ" },
    { key: "checkOutDate", label: "Check-Out", labelAr: "إلى تاريخ" },
    { key: "dailyRate", label: "Daily Rate", labelAr: "سعر اليوم" },
    { key: "totalAmount", label: "Total Fee", labelAr: "الإجمالي" },
    { key: "status", label: "Status", labelAr: "الحالة" },
  ],
  maintenance: [
    { key: "buildingName", label: "Building & Floor", labelAr: "المبنى والدور", fixed: true },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة", fixed: true },
    { key: "reportedBy", label: "Reported By", labelAr: "مقدم البلاغ", fixed: true },
    { key: "category", label: "Category", labelAr: "الفئة" },
    { key: "problemType", label: "Problem Details", labelAr: "نوع المشكلة" },
    { key: "priority", label: "Priority", labelAr: "الأولوية" },
    { key: "assignedTo", label: "Assigned To", labelAr: "الفني المعين" },
    { key: "reportedAt", label: "Reported Date", labelAr: "تاريخ البلاغ" },
    { key: "rating", label: "Rating & Feedback", labelAr: "التقييم (الريت)" },
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
    { key: "profileName", label: "Resident & Code", labelAr: "المقيم والكود" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "roomNumber", label: "Room & Bed", labelAr: "الغرفة والسرير" },
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
    { key: "profileName", label: "Person & ID", labelAr: "الاسم والكود" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "roomNumber", label: "Room & Building", labelAr: "الغرفة والمبنى" },
    { key: "guardName", label: "Security Officer", labelAr: "مسؤول الأمن" },
    { key: "status", label: "Access Status", labelAr: "حالة التصريح" },
    { key: "notes", label: "Notes", labelAr: "ملاحظات" },
  ],
  police_report: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Full Name", labelAr: "الاسم بالكامل", fixed: true },
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
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الطابق" },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "bedNumber", label: "Bed No", labelAr: "رقم السرير" },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة" },
    { key: "checkInDate", label: "Check-In Date", labelAr: "تاريخ التسكين" },
    { key: "hireDate", label: "Hire Date", labelAr: "تاريخ التعيين" },
    { key: "contractEndDate", label: "Contract End", labelAr: "انتهاء العقد" },
    { key: "email", label: "Email", labelAr: "البريد الإلكتروني" },
    { key: "emergencyContact", label: "Emergency Contact", labelAr: "هاتف الطوارئ" },
    { key: "status", label: "Status", labelAr: "الحالة بالسكن" },
  ],
  water_distribution: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Full Name", labelAr: "الاسم بالكامل", fixed: true },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "floorName", label: "Floor", labelAr: "الدور" },
    { key: "roomNumber", label: "Room No", labelAr: "الغرفة" },
    { key: "bedNumber", label: "Bed No", labelAr: "السرير" },
    { key: "waterIssue1", label: "1st Issue (1st Half)", labelAr: "الصرف الأول (النصف الأول)", fixed: true },
    { key: "waterIssue2", label: "2nd Issue (2nd Half)", labelAr: "الصرف الثاني (النصف الثاني)", fixed: true },
    { key: "signature", label: "Resident Signature", labelAr: "توقيع المستلم" },
  ],
  policy_exceptions: [
    { key: "profileName", label: "Resident Name", labelAr: "اسم المقيم", fixed: true },
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي" },
    { key: "jobLevel", label: "Job Level", labelAr: "الدرجة الوظيفية" },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "roomNumber", label: "Room No", labelAr: "رقم الغرفة" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "roomCapacity", label: "Capacity", labelAr: "سعة الغرفة" },
    { key: "currentOccupancy", label: "Occupancy", labelAr: "الإشغال الحالي" },
    { key: "violationType", label: "Violation Type", labelAr: "نوع المخالفة", fixed: true },
    { key: "violationDetails", label: "Policy Details", labelAr: "تفاصيل المخالفة والسياسة" },
    { key: "requestDate", label: "Exception Date", labelAr: "تاريخ الاستثناء" },
    { key: "severity", label: "Severity", labelAr: "مستوى الأهمية" },
    { key: "approvalStatus", label: "Status / Resolution", labelAr: "موقف المخالفة والتصحيح" },
    { key: "resolvedAt", label: "Resolution Date", labelAr: "تاريخ التصحيح" },
    { key: "resolutionDetails", label: "Resolution Action", labelAr: "إجراء المعالجة والتصحيح" },
    { key: "approvedBy", label: "Approved By", labelAr: "المعتمد للطلب" },
    { key: "overrideReason", label: "Override Reason", labelAr: "سبب ومسوغات الاستثناء" },
  ],
  vacations: [
    { key: "profileCode", label: "Employee Code", labelAr: "كود الموظف", fixed: true },
    { key: "fullName", label: "Employee Name", labelAr: "الاسم بالكامل", fixed: true },
    { key: "department", label: "Department", labelAr: "القسم" },
    { key: "jobTitle", label: "Job Title", labelAr: "الوظيفة" },
    { key: "buildingName", label: "Building", labelAr: "المبنى" },
    { key: "housingInfo", label: "Room & Bed", labelAr: "الغرفة والسرير" },
    { key: "startDate", label: "Vacation Start", labelAr: "بداية الإجازة", fixed: true },
    { key: "endDate", label: "Expected Return", labelAr: "العودة المتوقعة" },
    { key: "actualReturnDate", label: "Actual Return", labelAr: "العودة الفعلية" },
    { key: "duration", label: "Duration (Days)", labelAr: "المدة (أيام)" },
    { key: "status", label: "Status", labelAr: "حالة الإجازة", fixed: true },
    { key: "notes", label: "Notes", labelAr: "ملاحظات" },
  ],
};

export const DEFAULT_VISIBLE_KEYS: Partial<Record<string, string[]>> = {
  profiles: [
    "profileCode",
    "fullName",
    "department",
    "jobTitle",
    "level",
    "assignedRoom",
    "employmentType",
    "phone",
    "nationalId",
    "nationality",
    "status",
  ],
  assignments: [
    "profileCode",
    "fullName",
    "employmentType",
    "buildingName",
    "roomNumber",
    "department",
    "level",
    "phone",
    "checkInDate",
    "status",
  ],
  police_report: [
    "profileCode",
    "fullName",
    "nationalId",
    "nationality",
    "jobTitle",
    "department",
    "buildingName",
    "roomNumber",
    "bedNumber",
    "checkInDate",
    "status",
  ],
  policy_exceptions: [
    "profileName",
    "profileCode",
    "jobLevel",
    "department",
    "roomNumber",
    "violationType",
    "severity",
    "approvalStatus",
    "requestDate",
    "resolvedAt",
  ],
  vacations: [
    "profileCode",
    "fullName",
    "department",
    "jobTitle",
    "buildingName",
    "housingInfo",
    "startDate",
    "endDate",
    "actualReturnDate",
    "duration",
    "status",
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
    const def = DEFAULT_VISIBLE_KEYS[activeTab] || allCols.map((c) => c.key);
    return new Set(def);
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
    const def = DEFAULT_VISIBLE_KEYS[activeTab] || (REPORT_TAB_COLUMNS[activeTab] || []).map((c) => c.key);
    setVisibleKeys(new Set(def));
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
