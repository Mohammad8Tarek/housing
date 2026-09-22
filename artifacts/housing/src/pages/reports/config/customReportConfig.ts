import {
  Users,
  Hotel,
  Building2,
  UserCheck,
  Wrench,
  Palmtree,
  Home,
  LucideIcon,
} from "lucide-react";

export type DataSourceType =
  | "in_house"
  | "profiles"
  | "rooms"
  | "reservations"
  | "maintenance"
  | "vacations"
  | "hostings";

export interface DataSourceDef {
  id: DataSourceType;
  label: string;
  labelAr: string;
  description: string;
  descriptionAr: string;
  icon: LucideIcon;
  color: string;
}

export interface CustomColumnDef {
  key: string;
  label: string;
  labelAr: string;
  category: string;
  categoryAr: string;
  type: "text" | "id" | "badge" | "date" | "number" | "status" | "boolean";
  defaultSelected?: boolean;
}

export const DATA_SOURCES: DataSourceDef[] = [
  {
    id: "in_house",
    label: "In-House Occupants & Beds",
    labelAr: "المقيمين والتسكين الفعلي",
    description: "Detailed report of actual residents, rooms, beds, buildings, and check-in stays.",
    descriptionAr: "تقرير تفصيلي بالنزلاء الفعليين بالسكن والغرف والأسرة والمباني وتواريخ الإقامة.",
    icon: Users,
    color: "text-blue-500 bg-blue-50 dark:bg-blue-950/40 border-blue-200",
  },
  {
    id: "profiles",
    label: "Staff Profiles Directory",
    labelAr: "دليل الموظفين والبروفايلات",
    description: "Staff directory with departments, job titles, levels, phone, and housing location.",
    descriptionAr: "دليل شامل لكافة موظفي الفندق وبياناتهم الوظيفية، الأقسام، الدرجات، وموقع سكنهم.",
    icon: Hotel,
    color: "text-purple-500 bg-purple-50 dark:bg-purple-950/40 border-purple-200",
  },
  {
    id: "rooms",
    label: "Rooms & Operational Capacity",
    labelAr: "الغرف والسعة التشغيلية",
    description: "Inventory of rooms, total capacity, occupied/vacant beds, cleanliness & status.",
    descriptionAr: "حصر شامل للغرف، السعة، المشغول، الأسرة الشاغرة، وحالات النظافة والصيانة.",
    icon: Building2,
    color: "text-emerald-500 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200",
  },
  {
    id: "reservations",
    label: "Reservations & Arrivals",
    labelAr: "الحجوزات والوصول المستقبلي",
    description: "Upcoming guest arrivals, booking sources, stay dates, and reserved room types.",
    descriptionAr: "كشف بالحجوزات وتواريخ الوصول والمغادرة والليالي المحجوزة ومصادر الحجز.",
    icon: UserCheck,
    color: "text-amber-500 bg-amber-50 dark:bg-amber-950/40 border-amber-200",
  },
  {
    id: "maintenance",
    label: "Maintenance Work Orders",
    labelAr: "طلبات وأوامر الصيانة",
    description: "Maintenance tickets tracking, categories, priorities, technicians, and ratings.",
    descriptionAr: "سجل متابعة طلبات الصيانة والأولويات والأقسام والفنيين وتواريخ الإنجاز والتقييم.",
    icon: Wrench,
    color: "text-rose-500 bg-rose-50 dark:bg-rose-950/40 border-rose-200",
  },
  {
    id: "vacations",
    label: "Staff Vacations & Archive",
    labelAr: "سجل وأرشيف إجازات الموظفين",
    description: "Historical leave archive, expected/actual returns, department, and contact phone.",
    descriptionAr: "سجل تاريخي لإجازات الموظفين، مواعيد النزول والعودة، أرقام الهواتف، وحالة العودة.",
    icon: Palmtree,
    color: "text-teal-500 bg-teal-50 dark:bg-teal-950/40 border-teal-200",
  },
  {
    id: "hostings",
    label: "Guest Hostings & Visitors",
    labelAr: "الاستضافات والزوار",
    description: "Guest hosting requests, relation, host employee, room, and approval status.",
    descriptionAr: "سجل تصاريح استضافة الأقارب والزوار، صلة القرابة، الموظف المستضيف، والغرفة.",
    icon: Home,
    color: "text-sky-500 bg-sky-50 dark:bg-sky-950/40 border-sky-200",
  },
];

export const SOURCE_COLUMNS: Record<DataSourceType, CustomColumnDef[]> = {
  in_house: [
    // Employee Info
    { key: "name", label: "Employee Name", labelAr: "اسم الموظف", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "employeeId", label: "Employee ID", labelAr: "الرقم الوظيفي", category: "Employee Info", categoryAr: "بيانات الموظف", type: "id", defaultSelected: true },
    { key: "department", label: "Department", labelAr: "القسم", category: "Employee Info", categoryAr: "بيانات الموظف", type: "badge", defaultSelected: true },
    { key: "jobTitle", label: "Job Title", labelAr: "المسمى الوظيفي", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "jobLevel", label: "Job Level", labelAr: "الدرجة الوظيفية", category: "Employee Info", categoryAr: "بيانات الموظف", type: "badge", defaultSelected: false },
    { key: "gender", label: "Gender", labelAr: "النوع", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },
    { key: "phone", label: "Phone", labelAr: "رقم الهاتف", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },
    { key: "company", label: "Company / Hotel", labelAr: "الشركة / الفندق", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },
    { key: "nationality", label: "Nationality", labelAr: "الجنسية", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },

    // Room Info
    { key: "buildingName", label: "Building", labelAr: "المبنى", category: "Room & Housing", categoryAr: "بيانات السكن والغرفة", type: "text", defaultSelected: true },
    { key: "floorNumber", label: "Floor", labelAr: "الدور", category: "Room & Housing", categoryAr: "بيانات السكن والغرفة", type: "text", defaultSelected: true },
    { key: "roomNumber", label: "Room Number", labelAr: "رقم الغرفة", category: "Room & Housing", categoryAr: "بيانات السكن والغرفة", type: "id", defaultSelected: true },
    { key: "bedNumber", label: "Bed Number", labelAr: "السرير", category: "Room & Housing", categoryAr: "بيانات السكن والغرفة", type: "id", defaultSelected: true },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة", category: "Room & Housing", categoryAr: "بيانات السكن والغرفة", type: "text", defaultSelected: false },
    { key: "isEntireRoom", label: "Entire Room", labelAr: "غرفة كاملة (مفردة)", category: "Room & Housing", categoryAr: "بيانات السكن والغرفة", type: "boolean", defaultSelected: false },

    // Dates & Status
    { key: "checkInDate", label: "Check-in Date", labelAr: "تاريخ التسكين", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "date", defaultSelected: true },
    { key: "daysInHouse", label: "Days in House", labelAr: "أيام الإقامة", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "number", defaultSelected: true },
    { key: "checkOutDate", label: "Expected Check-out", labelAr: "تاريخ المغادرة المتوقع", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "date", defaultSelected: false },
    { key: "status", label: "Status", labelAr: "الحالة", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "status", defaultSelected: true },
    { key: "notes", label: "Notes", labelAr: "ملاحظات", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "text", defaultSelected: false },
  ],

  profiles: [
    // Core Profile
    { key: "employeeId", label: "Employee ID", labelAr: "الرقم الوظيفي", category: "Employee Details", categoryAr: "بيانات الموظف", type: "id", defaultSelected: true },
    { key: "name", label: "Employee Name", labelAr: "اسم الموظف", category: "Employee Details", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "department", label: "Department", labelAr: "القسم", category: "Employee Details", categoryAr: "بيانات الموظف", type: "badge", defaultSelected: true },
    { key: "jobTitle", label: "Job Title", labelAr: "المسمى الوظيفي", category: "Employee Details", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "jobLevel", label: "Job Level", labelAr: "الدرجة الوظيفية", category: "Employee Details", categoryAr: "بيانات الموظف", type: "badge", defaultSelected: true },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي", category: "Employee Details", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },
    { key: "gender", label: "Gender", labelAr: "النوع", category: "Employee Details", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },
    { key: "phone", label: "Phone", labelAr: "الهاتف", category: "Employee Details", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "nationality", label: "Nationality", labelAr: "الجنسية", category: "Employee Details", categoryAr: "بيانات الموظف", type: "text", defaultSelected: false },
    { key: "company", label: "Company", labelAr: "الشركة / الفندق", category: "Employee Details", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    
    // Housing Location
    { key: "buildingName", label: "Building", labelAr: "المبنى الحالي", category: "Housing Location", categoryAr: "موقع السكن الحالي", type: "text", defaultSelected: true },
    { key: "roomNumber", label: "Room", labelAr: "الغرفة الحالية", category: "Housing Location", categoryAr: "موقع السكن الحالي", type: "id", defaultSelected: true },
    { key: "bedNumber", label: "Bed", labelAr: "السرير", category: "Housing Location", categoryAr: "موقع السكن الحالي", type: "id", defaultSelected: false },

    // Status & Contract
    { key: "status", label: "Status", labelAr: "الحالة الوظيفية", category: "Contract & Status", categoryAr: "التعاقد والحالة", type: "status", defaultSelected: true },
    { key: "hireDate", label: "Hire Date", labelAr: "تاريخ التعيين", category: "Contract & Status", categoryAr: "التعاقد والحالة", type: "date", defaultSelected: false },
    { key: "contractEnd", label: "Contract Expiry", labelAr: "انتهاء العقد", category: "Contract & Status", categoryAr: "التعاقد والحالة", type: "date", defaultSelected: false },
  ],

  rooms: [
    // Identification
    { key: "roomNumber", label: "Room Number", labelAr: "رقم الغرفة", category: "Room Identification", categoryAr: "بيانات الغرفة", type: "id", defaultSelected: true },
    { key: "buildingName", label: "Building", labelAr: "المبنى", category: "Room Identification", categoryAr: "بيانات الغرفة", type: "text", defaultSelected: true },
    { key: "floorNumber", label: "Floor", labelAr: "الدور", category: "Room Identification", categoryAr: "بيانات الغرفة", type: "text", defaultSelected: true },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة", category: "Room Identification", categoryAr: "بيانات الغرفة", type: "text", defaultSelected: true },

    // Capacity & Occupancy
    { key: "capacity", label: "Capacity", labelAr: "السعة الإجمالية", category: "Capacity & Occupancy", categoryAr: "السعة والإشغال", type: "number", defaultSelected: true },
    { key: "occupiedBeds", label: "Occupied Beds", labelAr: "الأسرة المشغولة", category: "Capacity & Occupancy", categoryAr: "السعة والإشغال", type: "number", defaultSelected: true },
    { key: "vacantBeds", label: "Vacant Beds", labelAr: "الأسرة الشاغرة", category: "Capacity & Occupancy", categoryAr: "السعة والإشغال", type: "number", defaultSelected: true },
    { key: "occupancyPct", label: "Occ. %", labelAr: "نسبة الإشغال", category: "Capacity & Occupancy", categoryAr: "السعة والإشغال", type: "badge", defaultSelected: true },

    // Operational Status
    { key: "status", label: "Operational Status", labelAr: "الحالة التشغيلية", category: "Operational Status", categoryAr: "الحالة التشغيلية والنظافة", type: "status", defaultSelected: true },
    { key: "cleanlinessStatus", label: "Cleanliness Status", labelAr: "حالة النظافة", category: "Operational Status", categoryAr: "الحالة التشغيلية والنظافة", type: "status", defaultSelected: true },
    { key: "genderPolicy", label: "Gender Policy", labelAr: "سياسة النوع", category: "Operational Status", categoryAr: "الحالة التشغيلية والنظافة", type: "text", defaultSelected: false },
    { key: "notes", label: "Notes", labelAr: "ملاحظات", category: "Operational Status", categoryAr: "الحالة التشغيلية والنظافة", type: "text", defaultSelected: false },
  ],

  reservations: [
    { key: "guestName", label: "Guest Name", labelAr: "اسم النزيل", category: "Guest & Details", categoryAr: "النزيل والتفاصيل", type: "text", defaultSelected: true },
    { key: "employeeId", label: "Employee ID", labelAr: "الرقم الوظيفي", category: "Guest & Details", categoryAr: "النزيل والتفاصيل", type: "id", defaultSelected: true },
    { key: "department", label: "Department", labelAr: "القسم", category: "Guest & Details", categoryAr: "النزيل والتفاصيل", type: "badge", defaultSelected: true },
    { key: "jobTitle", label: "Job Title", labelAr: "المسمى الوظيفي", category: "Guest & Details", categoryAr: "النزيل والتفاصيل", type: "text", defaultSelected: false },
    { key: "buildingName", label: "Building", labelAr: "المبنى", category: "Accommodation", categoryAr: "السكن والغرفة", type: "text", defaultSelected: true },
    { key: "roomNumber", label: "Room", labelAr: "الغرفة المحجوزة", category: "Accommodation", categoryAr: "السكن والغرفة", type: "id", defaultSelected: true },
    { key: "roomType", label: "Room Type", labelAr: "نوع الغرفة", category: "Accommodation", categoryAr: "السكن والغرفة", type: "text", defaultSelected: false },
    { key: "checkInDate", label: "Check-in", labelAr: "تاريخ الوصول", category: "Stay Schedule", categoryAr: "مواعيد الإقامة", type: "date", defaultSelected: true },
    { key: "checkOutDate", label: "Check-out", labelAr: "تاريخ المغادرة", category: "Stay Schedule", categoryAr: "مواعيد الإقامة", type: "date", defaultSelected: true },
    { key: "nights", label: "Nights", labelAr: "الليالي", category: "Stay Schedule", categoryAr: "مواعيد الإقامة", type: "number", defaultSelected: true },
    { key: "bookingSource", label: "Source", labelAr: "مصدر الحجز", category: "Status & Channel", categoryAr: "الحالة والقناة", type: "text", defaultSelected: false },
    { key: "status", label: "Status", labelAr: "الحالة", category: "Status & Channel", categoryAr: "الحالة والقناة", type: "status", defaultSelected: true },
    { key: "notes", label: "Special Requests", labelAr: "ملاحظات خاصة", category: "Status & Channel", categoryAr: "الحالة والقناة", type: "text", defaultSelected: false },
  ],

  maintenance: [
    { key: "ticketNumber", label: "Ticket #", labelAr: "رقم البلاغ", category: "Ticket Info", categoryAr: "بيانات البلاغ", type: "id", defaultSelected: true },
    { key: "buildingName", label: "Building", labelAr: "المبنى", category: "Location", categoryAr: "الموقع", type: "text", defaultSelected: true },
    { key: "roomNumber", label: "Room Number", labelAr: "الغرفة", category: "Location", categoryAr: "الموقع", type: "id", defaultSelected: true },
    { key: "category", label: "Category", labelAr: "القسم الفني", category: "Details", categoryAr: "تفاصيل المشكلة", type: "badge", defaultSelected: true },
    { key: "problemType", label: "Problem Type", labelAr: "نوع العطل", category: "Details", categoryAr: "تفاصيل المشكلة", type: "text", defaultSelected: true },
    { key: "description", label: "Description", labelAr: "الوصف", category: "Details", categoryAr: "تفاصيل المشكلة", type: "text", defaultSelected: false },
    { key: "priority", label: "Priority", labelAr: "الأولوية", category: "Details", categoryAr: "تفاصيل المشكلة", type: "badge", defaultSelected: true },
    { key: "status", label: "Status", labelAr: "الحالة", category: "Resolution & Team", categoryAr: "الفريق والإنجاز", type: "status", defaultSelected: true },
    { key: "workerName", label: "Assigned Technician", labelAr: "الفني المعين", category: "Resolution & Team", categoryAr: "الفريق والإنجاز", type: "text", defaultSelected: true },
    { key: "reportedBy", label: "Reported By", labelAr: "مقدم البلاغ", category: "Resolution & Team", categoryAr: "الفريق والإنجاز", type: "text", defaultSelected: false },
    { key: "reportedAt", label: "Reported Date", labelAr: "تاريخ البلاغ", category: "Timeline & Quality", categoryAr: "التواريخ والتقييم", type: "date", defaultSelected: true },
    { key: "resolvedAt", label: "Resolved Date", labelAr: "تاريخ الإصلاح", category: "Timeline & Quality", categoryAr: "التواريخ والتقييم", type: "date", defaultSelected: false },
    { key: "rating", label: "Rating", labelAr: "التقييم", category: "Timeline & Quality", categoryAr: "التواريخ والتقييم", type: "number", defaultSelected: false },
  ],

  vacations: [
    { key: "name", label: "Employee Name", labelAr: "اسم الموظف", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "employeeId", label: "Employee ID", labelAr: "الرقم الوظيفي", category: "Employee Info", categoryAr: "بيانات الموظف", type: "id", defaultSelected: true },
    { key: "department", label: "Department", labelAr: "القسم", category: "Employee Info", categoryAr: "بيانات الموظف", type: "badge", defaultSelected: true },
    { key: "jobTitle", label: "Job Title", labelAr: "المسمى الوظيفي", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "phone", label: "Phone", labelAr: "الهاتف أثناء الإجازة", category: "Employee Info", categoryAr: "بيانات الموظف", type: "text", defaultSelected: true },
    { key: "startDate", label: "Leave Start", labelAr: "تاريخ النزول", category: "Dates & Status", categoryAr: "التواريخ والمطابقة", type: "date", defaultSelected: true },
    { key: "endDate", label: "Expected Return", labelAr: "العودة المتوقعة", category: "Dates & Status", categoryAr: "التواريخ والمطابقة", type: "date", defaultSelected: true },
    { key: "actualReturnDate", label: "Actual Return", labelAr: "العودة الفعلية", category: "Dates & Status", categoryAr: "التواريخ والمطابقة", type: "date", defaultSelected: false },
    { key: "status", label: "Status", labelAr: "حالة الإجازة", category: "Dates & Status", categoryAr: "التواريخ والمطابقة", type: "status", defaultSelected: true },
    { key: "notes", label: "Notes", labelAr: "ملاحظات", category: "Dates & Status", categoryAr: "التواريخ والمطابقة", type: "text", defaultSelected: false },
  ],

  hostings: [
    { key: "guestName", label: "Guest Name", labelAr: "اسم الزائر / الضيف", category: "Guest Info", categoryAr: "بيانات الضيف", type: "text", defaultSelected: true },
    { key: "relation", label: "Relation", labelAr: "صلة القرابة", category: "Guest Info", categoryAr: "بيانات الضيف", type: "badge", defaultSelected: true },
    { key: "nationalId", label: "National ID", labelAr: "الرقم القومي / الجواز", category: "Guest Info", categoryAr: "بيانات الضيف", type: "text", defaultSelected: false },
    { key: "hostName", label: "Host Employee", labelAr: "الموظف المستضيف", category: "Host Info", categoryAr: "الموظف المستضيف", type: "text", defaultSelected: true },
    { key: "employeeId", label: "Host ID", labelAr: "الرقم الوظيفي للمستضيف", category: "Host Info", categoryAr: "الموظف المستضيف", type: "id", defaultSelected: true },
    { key: "department", label: "Host Department", labelAr: "قسم المستضيف", category: "Host Info", categoryAr: "الموظف المستضيف", type: "badge", defaultSelected: false },
    { key: "buildingName", label: "Building", labelAr: "المبنى", category: "Accommodation", categoryAr: "مكان الاستضافة", type: "text", defaultSelected: true },
    { key: "roomNumber", label: "Room", labelAr: "الغرفة", category: "Accommodation", categoryAr: "مكان الاستضافة", type: "id", defaultSelected: true },
    { key: "startDate", label: "Start Date", labelAr: "تاريخ البدء", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "date", defaultSelected: true },
    { key: "endDate", label: "End Date", labelAr: "تاريخ الانتهاء", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "date", defaultSelected: true },
    { key: "status", label: "Status", labelAr: "حالة التصريح", category: "Dates & Status", categoryAr: "التواريخ والحالة", type: "status", defaultSelected: true },
  ],
};
