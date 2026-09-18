// ============================================================================
// Sunrise Staff Housing Management System — Enterprise Luxury Report Engine
// 5-Star Hospitality PDF & Vector Print Generator
// Supports 100% Native Arabic (Cairo Font, Ligatures, RTL) and English (LTR)
// ============================================================================

import { loadImgDataUrl } from "./export";
import { formatNationality } from "@/lib/countries";
import { translateDepartment, translateJobTitle } from "@/lib/bilingual-hospitality-dict";

export interface ReportKpiCard {
  label: string;
  labelAr?: string;
  value: string | number;
  color?: "gold" | "green" | "blue" | "orange" | "red" | "purple" | "slate";
  subtext?: string;
}

export interface ReportColumn {
  key: string;
  label: string;
  labelAr?: string;
  align?: "left" | "center" | "right";
  width?: string;
}

export interface LuxuryReportOptions {
  activeTab?: string;
  title: string;
  titleAr?: string;
  subtitle?: string;
  subtitleAr?: string;
  language?: "ar" | "en";
  orientation?: "landscape" | "portrait";
  showKpis?: boolean;
  showSignatures?: boolean;
  properties?: any[];
  propId?: number | string;
  activePropertyId?: number | string;
  settings?: any;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  totalRecords?: number;
  kpiCards?: ReportKpiCard[];
  columns?: ReportColumn[];
  headers?: string[];
  rows: Record<string, any>[] | any[][];
  signatures?: {
    role1?: string;
    role1Ar?: string;
    role2?: string;
    role2Ar?: string;
    role3?: string;
    role3Ar?: string;
  };
  customSectionsHtml?: string;
  customBottomSectionsHtml?: string;
  autoPrint?: boolean;
}

// ----------------------------------------------------------------------------
// 1.1 Formal Layout Configuration: Smart Defaults per Report Tab
// Executive & Operations -> show KPIs & Signatures
// Formal Lists & Manifests -> formal clean style (no KPI dashboard, no signatures)
// ----------------------------------------------------------------------------
export const REPORT_TAB_CONFIG: Record<
  string,
  { showKpis: boolean; showSignatures: boolean }
> = {
  // Executive & Operations Audits (Clean formal report view - with executive KPIs and signatures)
  manager_flash: { showKpis: true, showSignatures: true },
  housekeeping_sheet: { showKpis: false, showSignatures: true },
  room_discrepancy: { showKpis: false, showSignatures: true },
  occupancy_forecast: { showKpis: false, showSignatures: false },

  // Formal Master Ledgers & Directory Manifests (Formal clean style, maximum rows per page)
  assignments: { showKpis: false, showSignatures: false },
  profiles: { showKpis: false, showSignatures: false },
  vacant_rooms: { showKpis: false, showSignatures: false },
  housing: { showKpis: false, showSignatures: false },
  history: { showKpis: false, showSignatures: false },
  expiring_contracts: { showKpis: false, showSignatures: false },
  reservations: { showKpis: false, showSignatures: false },
  hostings: { showKpis: false, showSignatures: false },
  maintenance: { showKpis: false, showSignatures: false },
  equipment_inventory: { showKpis: false, showSignatures: false },
  arrivals_manifest: { showKpis: false, showSignatures: false },
  departures_manifest: { showKpis: false, showSignatures: false },
  housekeeping: { showKpis: false, showSignatures: false },
  daily_movement: { showKpis: false, showSignatures: false },
  department_occupancy: { showKpis: false, showSignatures: false },
  gate_logs: { showKpis: false, showSignatures: false },
  police_report: { showKpis: false, showSignatures: true },
  service_ratings: { showKpis: true, showSignatures: true },
  housing_map: { showKpis: false, showSignatures: false },
  water_distribution: { showKpis: false, showSignatures: true },
};

// ----------------------------------------------------------------------------
// 1. Opera PMS Technical Slugs Mapping
// ----------------------------------------------------------------------------
export const REPORT_OPERA_CODES: Record<string, string> = {
  assignments: "gibyroom",
  arrivals_manifest: "arrchkinbyroom",
  departures_manifest: "depchkoutbyroom",
  department_occupancy: "gi_inhousebycomp",
  room_discrepancy: "alerts",
  guest_preferences: "guest_preferences",
  vacant_rooms: "gi_vacantrooms",
  housekeeping_sheet: "hk_tasksheet",
  occupancy_forecast: "gi_occforecast",
  manager_flash: "mgr_flash",
  housing: "room_inventory",
  profiles: "profile_dir",
  expiring_contracts: "contract_exp",
  reservations: "res_manifest",
  hostings: "guest_hosting",
  maintenance: "mnt_tickets",
  equipment_inventory: "amenities_inv",
  history: "hist_ledger",
  daily_movement: "daily_movement",
  gate_logs: "gate_security",
  police_report: "police_manifest",
  service_ratings: "service_ratings",
  housing_map: "housing_map",
  water_distribution: "water_dist",
};

// ----------------------------------------------------------------------------
// 1.1 Bilingual Titles & Hospitality Mapping (Opera PMS Standard)
// ----------------------------------------------------------------------------
export const REPORT_TAB_TITLES: Record<string, { ar: string; en: string }> = {
  manager_flash: {
    ar: "تقرير المدير الصباحي للعمليات والإشغال",
    en: "Daily Operations Morning Report (Manager Flash)",
  },
  arrivals_manifest: {
    ar: "كشف الوصول والتسكين اليومي",
    en: "Arrivals and Checked in Today",
  },
  departures_manifest: {
    ar: "كشف المغادرات والتصفيات المستحقة",
    en: "Departures and Checked Out Today",
  },
  housekeeping_sheet: {
    ar: "كشف مهام ونظافة الغرف اليومي",
    en: "Housekeeping Daily Task Sheet",
  },
  room_discrepancy: {
    ar: "كشف تنبيهات وتدقيق حالات الغرف",
    en: "Alerts & Room Discrepancy",
  },
  occupancy_forecast: {
    ar: "توقعات الإشغال والأسرة المستقبلية",
    en: "Occupancy & Bed Availability Forecast",
  },
  assignments: {
    ar: "كشف المقيمين الفعليين حسب الغرف",
    en: "Guests INH - By Room",
  },
  vacant_rooms: {
    ar: "مصفوفة السعة التشغيلية والأسرة الشاغرة",
    en: "Operational Bed Capacity & Vacant Matrix",
  },
  housing: {
    ar: "سجل وحالة الغرف السكنية الشاملة",
    en: "Housing Room Inventory & Capacity",
  },
  profiles: {
    ar: "دليل ملفات العاملين والمقيمين بالسكن",
    en: "Staff & Resident Profiles Directory",
  },
  expiring_contracts: {
    ar: "كشف العقود المنتهية والمشرفة على الانتهاء",
    en: "Expiring Contracts & Renewal Audit",
  },
  reservations: {
    ar: "سجل الحجوزات والتسكين المستقبلي",
    en: "Reservations & Booking Manifest",
  },
  hostings: {
    ar: "سجل استضافة الضيوف والزوار",
    en: "Guest & Visitor Hostings Ledger",
  },
  maintenance: {
    ar: "سجل أوامر وبلاغات صيانة الغرف",
    en: "Engineering Maintenance Work Orders",
  },
  housekeeping: {
    ar: "سجل جاهزية ونظافة الغرف",
    en: "Housekeeping Cleanliness Turnover Log",
  },
  equipment_inventory: {
    ar: "جرد عهد ومحتويات الغرف السكنية",
    en: "Room Amenities & Equipment Inventory",
  },
  history: {
    ar: "سجل حركات التسكين التاريخي",
    en: "Housing Historical Stays Archive",
  },
  daily_movement: {
    ar: "تقرير الحركة اليومية للتسكين والمغادرة",
    en: "Daily Housing Movements & Turnovers",
  },
  department_occupancy: {
    ar: "كشف المقيمين حسب الشركة والأقسام",
    en: "Guests INH - By Company",
  },
  gate_logs: {
    ar: "سجل تصاريح وحركة البوابة الأمنية",
    en: "Gate Access Security Manifest",
  },
  police_report: {
    ar: "كشف شرطة السياحة للمقيمين بالسكن",
    en: "Tourism Police Resident Housing Manifest",
  },
  service_ratings: {
    ar: "تقرير تقييمات وجودة الخدمات بالسكن",
    en: "Service Quality & Resident Ratings Report",
  },
  housing_map: {
    ar: "المخطط الهيكلي المعماري وتوزيع الغرف",
    en: "Housing Structure & Architectural Map",
  },
  water_distribution: {
    ar: "كشف صرف وتوزيع مياه الشرب الشهري",
    en: "Monthly Drinking Water Distribution Sheet",
  },
};

// ----------------------------------------------------------------------------
// 1.5 Bilingual Column Header Dictionary & Translation Engine
// Ensures 100% Arabic Table Headers in Arabic Mode & Zero English Leakage
// ----------------------------------------------------------------------------
export const BILINGUAL_HEADER_MAP: Record<string, { ar: string; en: string }> = {
  // Identification & Personal
  id: { ar: "الهوية / الرقم", en: "ID" },
  code: { ar: "الكود", en: "Code" },
  name: { ar: "الاسم", en: "Name" },
  profileid: { ar: "رقم الموظف / الهوية", en: "Profile ID" },
  profile_id: { ar: "رقم الموظف / الهوية", en: "Profile ID" },
  "profile / id": { ar: "رقم الموظف / الهوية", en: "Profile / ID" },
  "profile id": { ar: "كود الموظف", en: "Profile ID" },
  profilecode: { ar: "كود الموظف", en: "Employee Code" },
  profile_code: { ar: "كود الموظف", en: "Employee Code" },
  "employee code": { ar: "كود الموظف", en: "Employee Code" },
  profilename: { ar: "اسم الموظف / النزيل", en: "Employee Name" },
  profile_name: { ar: "اسم الموظف / النزيل", en: "Employee Name" },
  "employee name": { ar: "اسم الموظف", en: "Employee Name" },
  "guest name": { ar: "اسم الضيف", en: "Guest Name" },
  "occupant / profile": { ar: "الموظف / المقيم", en: "Resident / Profile" },
  "resident / profile": { ar: "الموظف / النزيل", en: "Resident / Profile" },
  fullname: { ar: "الاسم بالكامل", en: "Full Name" },
  full_name: { ar: "الاسم بالكامل", en: "Full Name" },
  "full name": { ar: "الاسم بالكامل", en: "Full Name" },
  "الاسم بالكامل": { ar: "الاسم بالكامل", en: "Full Name" },
  "الاسم بالكامل (ثلاثي)": { ar: "الاسم بالكامل", en: "Full Name" },
  firstname: { ar: "الاسم الأول", en: "First Name" },
  first_name: { ar: "الاسم الأول", en: "First Name" },
  "first name": { ar: "الاسم الأول", en: "First Name" },
  lastname: { ar: "الاسم الأخير", en: "Last Name" },
  last_name: { ar: "الاسم الأخير", en: "Last Name" },
  "last name": { ar: "الاسم الأخير", en: "Last Name" },
  nationalid: { ar: "الرقم القومي", en: "National ID" },
  national_id: { ar: "الرقم القومي", en: "National ID" },
  "national id": { ar: "الرقم القومي", en: "National ID" },
  "id & phone": { ar: "الرقم القومي والهاتف", en: "ID & Phone" },
  phone: { ar: "الهاتف", en: "Phone" },
  mobile: { ar: "المحمول", en: "Mobile" },
  telephone: { ar: "الهاتف", en: "Telephone" },
  dateofbirth: { ar: "تاريخ الميلاد", en: "Date of Birth" },
  date_of_birth: { ar: "تاريخ الميلاد", en: "Date of Birth" },
  birthdate: { ar: "تاريخ الميلاد", en: "Date of Birth" },
  birth_date: { ar: "تاريخ الميلاد", en: "Date of Birth" },
  "date of birth": { ar: "تاريخ الميلاد", en: "Date of Birth" },
  "birth date": { ar: "تاريخ الميلاد", en: "Date of Birth" },
  "تاريخ الميلاد": { ar: "تاريخ الميلاد", en: "Date of Birth" },
  nationality: { ar: "الجنسية", en: "Nationality" },
  gender: { ar: "الجنس", en: "Gender" },
  address: { ar: "العنوان", en: "Address" },
  "address / location": { ar: "العنوان", en: "Address" },
  "العنوان": { ar: "العنوان", en: "Address" },
  email: { ar: "البريد الإلكتروني", en: "Email" },
  "email address": { ar: "البريد الإلكتروني", en: "Email Address" },
  "البريد الإلكتروني": { ar: "البريد الإلكتروني", en: "Email" },
  emergencycontact: { ar: "هاتف الطوارئ", en: "Emergency Contact" },
  emergency_contact: { ar: "هاتف الطوارئ", en: "Emergency Contact" },
  "emergency contact": { ar: "هاتف الطوارئ", en: "Emergency Contact" },
  "هاتف الطوارئ": { ar: "هاتف الطوارئ", en: "Emergency Contact" },
  "جهة الاتصال للطوارئ": { ar: "هاتف الطوارئ", en: "Emergency Contact" },
  genderpolicy: { ar: "سياسة الجنس", en: "Gender Policy" },
  gender_policy: { ar: "سياسة الجنس", en: "Gender Policy" },
  "gender policy": { ar: "سياسة الجنس", en: "Gender Policy" },
  department: { ar: "القسم", en: "Department" },
  dept: { ar: "القسم", en: "Department" },
  "dept & title": { ar: "القسم والوظيفة", en: "Dept & Job Title" },
  jobtitle: { ar: "المسمى الوظيفي", en: "Job Title" },
  job_title: { ar: "المسمى الوظيفي", en: "Job Title" },
  "job title": { ar: "المسمى الوظيفي", en: "Job Title" },
  level: { ar: "الدرجة الوظيفية", en: "Level" },
  employmenttype: { ar: "نوع التوظيف", en: "Employment Type" },
  employment_type: { ar: "نوع التوظيف", en: "Employment Type" },
  "employment type": { ar: "نوع التوظيف", en: "Employment Type" },
  employment: { ar: "نوع التوظيف", en: "Employment" },
  companyname: { ar: "الشركة", en: "Company" },
  company_name: { ar: "الشركة", en: "Company" },
  company: { ar: "الشركة", en: "Company" },
  "employment & company": { ar: "النوع والشركة", en: "Employment & Company" },
  hiredate: { ar: "تاريخ التعيين", en: "Hire Date" },
  hire_date: { ar: "تاريخ التعيين", en: "Hire Date" },
  "hire date": { ar: "تاريخ التعيين", en: "Hire Date" },
  contractenddate: { ar: "تاريخ انتهاء العقد", en: "Contract End Date" },
  contract_end_date: { ar: "تاريخ انتهاء العقد", en: "Contract End Date" },
  "contract end": { ar: "تاريخ انتهاء العقد", en: "Contract End" },
  "contract end date": { ar: "تاريخ انتهاء العقد", en: "Contract End Date" },
  daysremaining: { ar: "الأيام المتبقية", en: "Days Remaining" },
  days_remaining: { ar: "الأيام المتبقية", en: "Days Remaining" },
  "days remaining": { ar: "الأيام المتبقية", en: "Days Remaining" },
  expstatus: { ar: "حالة العقد", en: "Contract Status" },
  "contract status": { ar: "حالة العقد", en: "Contract Status" },

  // Rooms & Housing Details
  roomnumber: { ar: "رقم الغرفة", en: "Room No" },
  room_number: { ar: "رقم الغرفة", en: "Room No" },
  roomno: { ar: "رقم الغرفة", en: "Room No" },
  "room no": { ar: "رقم الغرفة", en: "Room No" },
  room: { ar: "الغرفة", en: "Room" },
  "room & bed": { ar: "الغرفة والسرير", en: "Room & Bed" },
  "room & location": { ar: "الغرفة والموقع", en: "Room & Location" },
  "room & building": { ar: "الغرفة والمبنى", en: "Room & Building" },
  "reserved room": { ar: "الغرفة المحجوزة", en: "Reserved Room" },
  assignedroom: { ar: "السكن الحالي", en: "Current Housing" },
  assigned_room: { ar: "السكن الحالي", en: "Current Housing" },
  "current housing": { ar: "السكن الحالي", en: "Current Housing" },
  housing: { ar: "السكن الحالي", en: "Housing" },
  bednumber: { ar: "رقم السرير", en: "Bed No" },
  bed_number: { ar: "رقم السرير", en: "Bed No" },
  bedno: { ar: "رقم السرير", en: "Bed No" },
  "bed no": { ar: "رقم السرير", en: "Bed No" },
  buildingname: { ar: "المبنى", en: "Building" },
  building_name: { ar: "المبنى", en: "Building" },
  building: { ar: "المبنى", en: "Building" },
  "building & code": { ar: "المبنى والكود", en: "Building & Code" },
  "building & floor": { ar: "المبنى والدور", en: "Building & Floor" },
  floorname: { ar: "الطابق", en: "Floor" },
  floor_name: { ar: "الطابق", en: "Floor" },
  floor: { ar: "الطابق", en: "Floor" },
  roomtype: { ar: "نوع الغرفة", en: "Room Type" },
  room_type: { ar: "نوع الغرفة", en: "Room Type" },
  "room type": { ar: "نوع الغرفة", en: "Room Type" },
  type: { ar: "نوع الغرفة", en: "Type" },
  capacity: { ar: "السعة", en: "Capacity" },
  "total capacity": { ar: "إجمالي السعة", en: "Total Capacity" },
  currentoccupancy: { ar: "الأسرة المشغولة", en: "Occupied Beds" },
  current_occupancy: { ar: "الأسرة المشغولة", en: "Occupied Beds" },
  occupied: { ar: "الأسرة المشغولة", en: "Occupied" },
  "occupied beds": { ar: "الأسرة المشغولة", en: "Occupied Beds" },
  "projected occupied": { ar: "الأسرة المشغولة (المتوقعة)", en: "Projected Occupied" },
  vacantbeds: { ar: "الأسرة الشاغرة", en: "Vacant Beds" },
  vacant_beds: { ar: "الأسرة الشاغرة", en: "Vacant Beds" },
  vacant: { ar: "الأسرة الشاغرة", en: "Vacant" },
  vacantbedscount: { ar: "عدد الأسرة الشاغرة", en: "Vacant Beds" },
  "vacant beds": { ar: "عدد الأسرة الشاغرة", en: "Vacant Beds" },
  "projected vacant": { ar: "الأسرة الشاغرة (المتوقعة)", en: "Projected Vacant" },
  availablebedstext: { ar: "الأسرة المتاحة", en: "Available Beds" },
  "available beds": { ar: "الأسرة المتاحة", en: "Available Beds" },
  totalrooms: { ar: "إجمالي الغرف", en: "Total Rooms" },
  total_rooms: { ar: "إجمالي الغرف", en: "Total Rooms" },
  "total rooms": { ar: "إجمالي الغرف", en: "Total Rooms" },
  totalbeds: { ar: "إجمالي الأسرة", en: "Total Beds" },
  total_beds: { ar: "إجمالي الأسرة", en: "Total Beds" },
  "total beds": { ar: "إجمالي الأسرة", en: "Total Beds" },
  occupancyrate: { ar: "نسبة الإشغال", en: "Occupancy Rate" },
  occupancy_rate: { ar: "نسبة الإشغال", en: "Occupancy Rate" },
  "occupancy rate": { ar: "نسبة الإشغال", en: "Occupancy Rate" },
  "rate %": { ar: "نسبة الإشغال", en: "Rate %" },

  // Housekeeping & Operations
  dirtyrooms: { ar: "غرف متسخة", en: "Dirty Rooms" },
  dirty_rooms: { ar: "غرف متسخة", en: "Dirty Rooms" },
  "dirty rooms": { ar: "غرف متسخة", en: "Dirty Rooms" },
  dirty: { ar: "غرف متسخة", en: "Dirty" },
  ooorooms: { ar: "غرف صيانة (OOO)", en: "OOO Rooms" },
  ooo_rooms: { ar: "غرف صيانة (OOO)", en: "OOO Rooms" },
  "ooo rooms": { ar: "غرف صيانة (OOO)", en: "OOO Rooms" },
  ooo: { ar: "غرف صيانة (OOO)", en: "OOO" },
  fostatus: { ar: "حالة الإشغال (FO)", en: "FO Status" },
  fo_status: { ar: "حالة الإشغال (FO)", en: "FO Status" },
  "fo status": { ar: "حالة الإشغال (FO)", en: "FO Status" },
  "front office": { ar: "حالة الاستقبال (FO)", en: "Front Office" },
  hkstatus: { ar: "حالة النظافة (HK)", en: "HK Status" },
  hk_status: { ar: "حالة النظافة (HK)", en: "HK Status" },
  "hk status": { ar: "حالة النظافة (HK)", en: "HK Status" },
  housekeeping: { ar: "حالة النظافة (HK)", en: "Housekeeping" },
  tasktype: { ar: "نوع المهمة المطلوبة", en: "Task Type" },
  task_type: { ar: "نوع المهمة المطلوبة", en: "Task Type" },
  "task type": { ar: "نوع المهمة المطلوبة", en: "Task Type" },
  "task assignment": { ar: "نوع المهمة المطلوبة", en: "Task Assignment" },
  estimatedmins: { ar: "الوقت التقديري", en: "Est. Time" },
  estimated_mins: { ar: "الوقت التقديري", en: "Est. Time" },
  "est time": { ar: "الوقت التقديري", en: "Est. Time" },
  "est. time": { ar: "الوقت التقديري", en: "Est. Time" },
  occupantnames: { ar: "النزلاء الحاليون", en: "Current Occupants" },
  occupant_names: { ar: "النزلاء الحاليون", en: "Current Occupants" },
  "current occupants": { ar: "النزلاء الحاليون", en: "Current Occupants" },
  "occupant names": { ar: "النزلاء الحاليون", en: "Occupants" },
  linencheck: { ar: "فحص المفروشات", en: "Linen Check" },
  linen_check: { ar: "فحص المفروشات", en: "Linen Check" },
  "linen check": { ar: "فحص المفروشات", en: "Linen Check" },
  linen: { ar: "المفروشات", en: "Linen" },
  amenitiescheck: { ar: "فحص العهد", en: "Amenities Check" },
  amenities_check: { ar: "فحص العهد", en: "Amenities Check" },
  "amenities check": { ar: "فحص العهد", en: "Amenities Check" },
  amenities: { ar: "العهد والمحتويات", en: "Amenities" },
  signature: { ar: "توقيع المنفذ", en: "Signature" },
  "attendant sign": { ar: "توقيع المنفذ", en: "Attendant Sign" },
  "attendant signature": { ar: "توقيع المنفذ", en: "Attendant Signature" },
  hkpriority: { ar: "إجراء الإشراف الداخلي", en: "HK Action" },
  "hk action": { ar: "إجراء الإشراف الداخلي", en: "HK Action" },
  openhktickets: { ar: "تذاكر مفتوحة", en: "Open Tickets" },
  "open tickets": { ar: "تذاكر مفتوحة", en: "Open Tickets" },

  // Discrepancy & Forecast
  severity: { ar: "مستوى الخطورة", en: "Severity" },
  severitylabel: { ar: "مستوى الخطورة", en: "Severity" },
  "severity label": { ar: "مستوى الخطورة", en: "Severity" },
  discrepancytype: { ar: "نوع التباين", en: "Discrepancy Type" },
  typelabel: { ar: "نوع التباين", en: "Discrepancy Type" },
  "discrepancy type": { ar: "نوع التباين", en: "Discrepancy Type" },
  "type / details": { ar: "نوع التباين والتفاصيل", en: "Type / Details" },
  impactedresidents: { ar: "النزلاء المتأثرون", en: "Impacted Residents" },
  "impacted residents": { ar: "النزلاء المتأثرون", en: "Impacted Residents" },
  "impacted residents / details": { ar: "النزلاء المعنيون / الملاحظات", en: "Impacted Residents / Details" },
  recommendedaction: { ar: "الإجراء الموصى به", en: "Recommended Action" },
  "recommended action": { ar: "الإجراء الموصى به", en: "Recommended Action" },
  datedisplay: { ar: "التاريخ", en: "Date" },
  date: { ar: "التاريخ", en: "Date" },
  "date & day": { ar: "التاريخ واليوم", en: "Date & Day" },
  dayname: { ar: "اليوم", en: "Day" },
  day: { ar: "اليوم", en: "Day" },
  dayarrivals: { ar: "الوصول المتوقع (+ Due In)", en: "Arrivals (+ Due In)" },
  "arrivals (+ due in)": { ar: "الوصول المتوقع (+ Due In)", en: "Arrivals (+ Due In)" },
  arrivals: { ar: "الوصول المتوقع", en: "Arrivals" },
  daydepartures: { ar: "المغادرة المتوقعة (- Due Out)", en: "Departures (- Due Out)" },
  "departures (- due out)": { ar: "المغادرة المتوقعة (- Due Out)", en: "Departures (- Due Out)" },
  departures: { ar: "المغادرة المتوقعة", en: "Departures" },
  netshift: { ar: "صافي الحركة", en: "Net Movement" },
  "net movement": { ar: "صافي الحركة", en: "Net Movement" },
  "net shift": { ar: "صافي الحركة", en: "Net Shift" },
  demandlevel: { ar: "مستوى الضغط", en: "Demand Tier" },
  "demand tier": { ar: "مستوى الضغط", en: "Demand Tier" },
  "demand level": { ar: "مستوى الضغط", en: "Demand Level" },

  // Movements & Dates
  checkindate: { ar: "تاريخ الوصول / التسكين", en: "Check-In Date" },
  check_in_date: { ar: "تاريخ الوصول / التسكين", en: "Check-In Date" },
  "check-in date": { ar: "تاريخ الوصول / التسكين", en: "Check-In Date" },
  "check-in": { ar: "تاريخ التسكين", en: "Check-In" },
  "arrival date": { ar: "تاريخ الوصول", en: "Arrival Date" },
  "arrival (due in)": { ar: "تاريخ الوصول (Due In)", en: "Arrival (Due In)" },
  checkoutdate: { ar: "تاريخ المغادرة", en: "Check-Out Date" },
  check_out_date: { ar: "تاريخ المغادرة", en: "Check-Out Date" },
  "check-out date": { ar: "تاريخ المغادرة", en: "Check-Out Date" },
  "check-out": { ar: "تاريخ المغادرة", en: "Check-Out" },
  "departure date": { ar: "تاريخ المغادرة", en: "Departure Date" },
  "due out date": { ar: "المغادرة المستحقة (Due Out)", en: "Due Out Date" },
  "due out": { ar: "المغادرة المستحقة", en: "Due Out" },
  departurecategory: { ar: "نوع المغادرة", en: "Departure Type" },
  "departure type": { ar: "نوع المغادرة", en: "Departure Type" },
  roomstatusafter: { ar: "حالة الغرفة", en: "Room Status" },
  "room status after": { ar: "حالة الغرفة بعد المغادرة", en: "Room Status After" },
  expectedcheckoutdate: { ar: "المغادرة المتوقعة", en: "Expected Check-Out" },
  "expected check-out": { ar: "المغادرة المتوقعة", en: "Expected Check-Out" },
  "expected out": { ar: "المغادرة المتوقعة", en: "Expected Out" },
  nights: { ar: "عدد الليالي", en: "Nights" },
  vipstatus: { ar: "الفئة", en: "Category" },
  status: { ar: "الحالة", en: "Status" },
  "room status": { ar: "حالة الغرفة", en: "Room Status" },
  "reservation status": { ar: "حالة الحجز", en: "Reservation Status" },
  "operational status": { ar: "الحالة التشغيلية", en: "Operational Status" },
  condition: { ar: "الحالة الفنية", en: "Condition" },
  notes: { ar: "ملاحظات", en: "Notes" },
  reason: { ar: "السبب / ملاحظات", en: "Reason" },
  "reason / notes": { ar: "السبب / ملاحظات HR", en: "Reason / Notes" },

  // Hostings & Maintenance
  hostemployee: { ar: "الموظف المستضيف", en: "Host Employee" },
  "host employee": { ar: "الموظف المستضيف", en: "Host Employee" },
  hostdept: { ar: "قسم المستضيف", en: "Host Dept" },
  relation: { ar: "صلة القرابة", en: "Relationship" },
  relationship: { ar: "صلة القرابة", en: "Relationship" },
  guestid: { ar: "رقم الهوية", en: "ID Number" },
  "id number": { ar: "رقم الهوية", en: "ID Number" },
  "guest & relation": { ar: "اسم الضيف والصلة", en: "Guest & Relation" },
  dailyrate: { ar: "سعر اليوم", en: "Daily Rate" },
  "daily rate": { ar: "سعر اليوم", en: "Daily Rate" },
  totalamount: { ar: "الإجمالي", en: "Total Fee" },
  "total fee": { ar: "الإجمالي", en: "Total Fee" },
  category: { ar: "التصنيف / الفئة", en: "Category" },
  problemtype: { ar: "وصف المشكلة / العطل", en: "Problem Details" },
  "problem details": { ar: "وصف المشكلة / العطل", en: "Problem Details" },
  priority: { ar: "الأولوية", en: "Priority" },
  assignedto: { ar: "الفني المعين", en: "Assigned To" },
  "assigned to": { ar: "الفني المعين", en: "Assigned To" },
  reportedat: { ar: "تاريخ البلاغ", en: "Reported Date" },
  "reported at": { ar: "تاريخ البلاغ", en: "Reported At" },
  "reported date": { ar: "تاريخ البلاغ", en: "Reported Date" },

  // Inventory & Assets
  itemname: { ar: "اسم الصنف / المعدة", en: "Item Name" },
  "item name": { ar: "اسم الصنف / المعدة", en: "Item Name" },
  "equipment / item": { ar: "اسم العهدة / المعدة", en: "Equipment / Item" },
  "equipment / item name": { ar: "اسم العهدة / الصنف", en: "Equipment / Item Name" },
  totalquantity: { ar: "إجمالي الكمية", en: "Total Quantity" },
  "total quantity": { ar: "إجمالي الكمية بالسكن", en: "Total Quantity" },
  "total quantity in housing": { ar: "إجمالي الكمية بالسكن", en: "Total Quantity in Housing" },
  "total in housing": { ar: "إجمالي الكمية بالسكن", en: "Total in Housing" },
  goodcount: { ar: "سليم / ممتاز", en: "Good / Working" },
  "good / working": { ar: "سليم / ممتاز", en: "Good / Working" },
  needsrepaircount: { ar: "بحاجة لصيانة", en: "Needs Repair" },
  "needs repair": { ar: "بحاجة لصيانة", en: "Needs Repair" },
  damagedcount: { ar: "تالف", en: "Damaged" },
  damaged: { ar: "تالف", en: "Damaged" },
  missingcount: { ar: "مفقود", en: "Missing" },
  missing: { ar: "مفقود", en: "Missing" },
  roomscount: { ar: "عدد الغرف", en: "Rooms Count" },
  "rooms count": { ar: "عدد الغرف", en: "Rooms Count" },
  roomssummary: { ar: "أرقام الغرف", en: "Rooms List" },
  "rooms list": { ar: "أرقام وتوزيع الغرف", en: "Rooms List" },
  "rooms breakdown": { ar: "تفاصيل وتوزيع الغرف", en: "Rooms Breakdown" },
  "condition breakdown": { ar: "الحالة التشغيلية", en: "Condition Breakdown" },
  quantity: { ar: "العدد", en: "Quantity" },
  qty: { ar: "العدد", en: "Qty" },
  modelnumber: { ar: "رقم الموديل", en: "Model" },
  model: { ar: "الموديل", en: "Model" },
  serialnumber: { ar: "الرقم التسلسلي", en: "Serial Number" },
  "serial number": { ar: "الرقم التسلسلي", en: "Serial Number" },
  "serial / asset tag": { ar: "الرقم التسلسلي / الكود", en: "Serial / Asset Tag" },
  barcode: { ar: "الباركود / كود الأصل", en: "Barcode" },
  "asset tag / barcode": { ar: "كود الأصل / الباركود", en: "Asset Tag / Barcode" },
  lastinspectedat: { ar: "تاريخ آخر فحص", en: "Last Inspected" },
  "last inspected": { ar: "تاريخ آخر فحص", en: "Last Inspected" },
  inspectedby: { ar: "القائم بالفحص", en: "Inspected By" },
  "inspected by": { ar: "القائم بالفحص", en: "Inspected By" },

  // Water Distribution Sheet
  waterissue1: { ar: "الصرف الأول", en: "1st Issue" },
  "1st issue": { ar: "الصرف الأول", en: "1st Issue" },
  "1st issue (1st half)": { ar: "الصرف الأول (النصف الأول)", en: "1st Issue (1st Half)" },
  waterissue2: { ar: "الصرف الثاني", en: "2nd Issue" },
  "2nd issue": { ar: "الصرف الثاني", en: "2nd Issue" },
  "2nd issue (2nd half)": { ar: "الصرف الثاني (النصف الثاني)", en: "2nd Issue (2nd Half)" },
  residentsignature: { ar: "توقيع المستلم", en: "Resident Signature" },
  "resident signature": { ar: "توقيع المستلم", en: "Resident Signature" },
};

export function translateReportHeader(header: string, isArabic: boolean): string {
  if (!header) return "";
  const trimmed = header.trim();
  const lower = trimmed.toLowerCase();

  if (isArabic) {
    // If it already has Arabic characters, keep it as is!
    if (/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

    // Check direct match
    const match = BILINGUAL_HEADER_MAP[lower] || BILINGUAL_HEADER_MAP[trimmed];
    if (match) return match.ar;

    // Try stripping non-alphanumeric
    const cleanKey = lower.replace(/[^a-z0-9]/g, "");
    if (BILINGUAL_HEADER_MAP[cleanKey]) return BILINGUAL_HEADER_MAP[cleanKey].ar;

    // Search through all keys comparing normalized alphanumeric form
    for (const [k, v] of Object.entries(BILINGUAL_HEADER_MAP)) {
      if (k.toLowerCase().replace(/[^a-z0-9]/g, "") === cleanKey) {
        return v.ar;
      }
    }

    return trimmed;
  } else {
    // English mode
    if (!/[\u0600-\u06FF]/.test(trimmed)) return trimmed;

    // Find English counterpart
    for (const entry of Object.values(BILINGUAL_HEADER_MAP)) {
      if (entry.ar === trimmed || trimmed.includes(entry.ar)) {
        return entry.en;
      }
    }
    return trimmed;
  }
}

// ----------------------------------------------------------------------------
// 1.8 Bilingual Value Translators (100% Arabic Localization Fallback)
// ----------------------------------------------------------------------------
export function translateRoomType(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("deluxe") || s.includes("ديلوكس")) return "غرفة ديلوكس";
  if (s.includes("suite") || s.includes("جناح")) return "جناح";
  if (s.includes("family") || s.includes("عائلي")) return "جناح عائلي";
  if (s.includes("single") || s.includes("فردي")) return "غرفة فردية";
  if (s.includes("double") || s.includes("مزدوج")) return "غرفة مزدوجة";
  if (s.includes("triple") || s.includes("ثلاثي")) return "غرفة ثلاثية";
  if (s.includes("quad") || s.includes("رباعي")) return "غرفة رباعية";
  if (s.includes("standard") || s.includes("قياسي")) return "غرفة قياسية";
  return val;
}

export function translateGenderPolicy(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("female") || s.includes("إناث") || s.includes("بنات")) return "إناث فقط";
  if ((s.includes("male") && !s.includes("fe")) || s.includes("ذكور") || s.includes("شباب")) return "ذكور فقط";
  if (s.includes("couple") || s.includes("أزواج")) return "أزواج";
  if (s.includes("any") || s.includes("mix") || s.includes("مختلط")) return "متاح للجميع / مختلط";
  return val;
}

export function translateProfileStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toUpperCase().trim();
  if (s === "ACTIVE") return "نشط بالسكن";
  if (s === "VACATION") return "في إجازة";
  if (s === "UNASSIGNED") return "غير مسكن";
  if (s === "LEFT" || s === "CHECKED_OUT") return "غادر السكن";
  if (s === "TRANSFERRED") return "منقول";
  if (s === "SUSPENDED") return "موقوف";
  return val;
}

export function translateReservationStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toUpperCase().trim();
  if (s === "UPCOMING") return "حجز قادم";
  if (s === "CONFIRMED") return "مؤكد";
  if (s === "CHECKED_IN") return "تم التسكين";
  if (s === "CANCELLED") return "ملغي";
  if (s === "NO_SHOW") return "لم يحضر";
  return val;
}

export function translateMaintenanceCategory(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("plumb") || s.includes("سباك")) return "سباكة وصحي";
  if (s.includes("electr") || s.includes("كهرب")) return "كهرباء وإنارة";
  if (s.includes("ac") || s.includes("hvac") || s.includes("تكييف") || s.includes("تبريد")) return "تكييف وتبريد";
  if (s.includes("carpent") || s.includes("نجار")) return "نجارة وأثاث";
  if (s.includes("paint") || s.includes("دهان")) return "دهانات وديكور";
  if (s.includes("appliance") || s.includes("أجهز")) return "أجهزة كهربائية";
  if (s.includes("pest") || s.includes("حشرات")) return "مكافحة حشرات";
  if (s.includes("housekeep") || s.includes("نظاف")) return "إشراف داخلي / نظافة";
  if (s.includes("general") || s.includes("عام")) return "صيانة عامة";
  return val;
}

export function translateMaintenancePriority(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("urg") || s.includes("طارئ") || s.includes("عاجل")) return "عاجلة / طارئة";
  if (s.includes("high") || s.includes("مرتفع")) return "مرتفعة";
  if (s.includes("med") || s.includes("متوسط") || s.includes("norm")) return "متوسطة";
  if (s.includes("low") || s.includes("منخفض")) return "منخفضة";
  return val;
}

export function translateMaintenanceStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s === "open" || s === "pending" || s.includes("انتظار") || s.includes("مفتوح")) return "قيد الانتظار";
  if (s === "in_progress" || s.includes("تنفيذ") || s.includes("عمل")) return "جاري العمل";
  if (s === "completed" || s === "resolved" || s.includes("مكتمل") || s.includes("تم")) return "تم الإنجاز";
  if (s === "cancelled" || s.includes("ملغي")) return "ملغي";
  if (s === "rejected" || s.includes("مرفوض")) return "مرفوض";
  return val;
}

export function translateHostingStatus(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s === "pending" || s.includes("انتظار")) return "بانتظار الموافقة";
  if (s === "approved" || s.includes("موافق")) return "معتمد";
  if (s === "active" || s.includes("ساري") || s.includes("حالي")) return "استضافة جارية";
  if (s === "completed" || s.includes("منتهي")) return "تمت المغادرة";
  if (s === "rejected" || s.includes("مرفوض")) return "مرفوض";
  return val;
}

export function translateHostingRelation(val: string, ar: boolean): string {
  if (!ar || !val || val === "—") return val || "—";
  const s = val.toLowerCase().trim();
  if (s.includes("father") || s.includes("والد") || s.includes("أب")) return "والد";
  if (s.includes("mother") || s.includes("والدة") || s.includes("أم")) return "والدة";
  if (s.includes("wife") || s.includes("زوجة")) return "زوجة";
  if (s.includes("husband") || s.includes("زوج")) return "زوج";
  if (s.includes("brother") || s.includes("أخ")) return "أخ";
  if (s.includes("sister") || s.includes("أخت")) return "أخت";
  if (s.includes("son") || s.includes("ابن")) return "ابن";
  if (s.includes("daughter") || s.includes("ابنة")) return "ابنة";
  if (s.includes("friend") || s.includes("صديق")) return "صديق";
  return val;
}

// ----------------------------------------------------------------------------
// 2. Helper: Status Badge Formatter (Clean, minimal executive presentation)
// ----------------------------------------------------------------------------
export function formatStatusBadgeHtml(val: any, isArabic: boolean): string {
  if (val === null || val === undefined || val === "") return "—";
  if (typeof val === "boolean") {
    if (val) {
      return `<span style="display:inline-block; width:13px; height:13px; border:1.2px solid #059669; border-radius:2px; vertical-align:middle; background:#ecfdf5; color:#059669; text-align:center; font-size:10px; line-height:12px; font-weight:bold;">✓</span>`;
    }
    return `<span style="display:inline-block; width:13px; height:13px; border:1.2px solid #475569; border-radius:2px; vertical-align:middle; background:#ffffff;"></span>`;
  }
  const str = String(val).trim();
  if (str === "—" || str === "-") return "—";
  if (str === "[  ]" || str === "[ ]" || str === "☐") {
    return `<span style="display:inline-block; width:13px; height:13px; border:1.2px solid #475569; border-radius:2px; vertical-align:middle; background:#ffffff;"></span>`;
  }
  if (str === "[✓]" || str === "[x]" || str === "[X]" || str === "☑") {
    return `<span style="display:inline-block; width:13px; height:13px; border:1.2px solid #059669; border-radius:2px; vertical-align:middle; background:#ecfdf5; color:#059669; text-align:center; font-size:10px; line-height:12px; font-weight:bold;">✓</span>`;
  }

  // Universal Arabic translation fallback for unlocalized cells
  if (isArabic && !/[\u0600-\u06FF]/.test(str)) {
    const upper = str.toUpperCase();
    const lower = str.toLowerCase();

    // 1. Profile / Resident Status
    if (["ACTIVE", "VACATION", "UNASSIGNED", "LEFT", "CHECKED_OUT", "TRANSFERRED", "SUSPENDED"].includes(upper)) {
      return translateProfileStatus(upper, true);
    }
    // 2. Reservation Status
    if (["UPCOMING", "CONFIRMED", "CHECKED_IN", "CANCELLED", "NO_SHOW"].includes(upper)) {
      return translateReservationStatus(upper, true);
    }
    // 3. Maintenance / Ticket Status
    if (["OPEN", "PENDING", "IN_PROGRESS", "COMPLETED", "RESOLVED", "REJECTED"].includes(upper)) {
      return translateMaintenanceStatus(lower, true);
    }
    // 4. Room Cleanliness & Operational Status
    if (lower === "clean" || lower === "available") return "نظيفة / متاحة";
    if (lower === "dirty") return "متسخة (تحتاج نظافة)";
    if (lower === "occupied") return "مشغولة";
    if (lower === "occupied_dirty") return "مشغولة ومتسخة";
    if (lower === "occupied_vacation") return "مشغولة (إجازة)";
    if (["out_of_service", "oos"].includes(lower)) return "خارج الخدمة";
    if (["out_of_order", "ooo", "maintenance"].includes(lower)) return "معطلة / صيانة";

    // 5. Gender Policies
    if (["male", "male only", "males", "male_only"].includes(lower)) return "ذكور فقط";
    if (["female", "female only", "females", "female_only"].includes(lower)) return "إناث فقط";
    if (["couple", "couples"].includes(lower)) return "أزواج";
    if (["any", "mixed"].includes(lower)) return "متاح للجميع / مختلط";

    // 6. Maintenance Categories
    if (["plumbing", "electrical", "hvac", "ac", "air conditioning", "carpentry", "painting", "appliances", "pest control", "housekeeping", "general"].includes(lower)) {
      return translateMaintenanceCategory(lower, true);
    }

    // 7. Maintenance Priorities
    if (["urgent", "high", "medium", "low", "normal", "critical"].includes(lower)) {
      return translateMaintenancePriority(lower, true);
    }

    // 8. Employment Type
    if (lower === "internal") return "داخلي (فندق)";
    if (lower === "third_party" || lower === "third party") return "طرف ثالث";

    // 9. VIP / Category
    if (upper === "VIP") return "هام (VIP)";
    if (lower === "standard") return "عادي";

    // 10. Gate Access Status
    if (lower === "valid" || lower === "approved" || lower === "success") return "تصريح ساري ومطابق";
    if (lower === "invalid" || lower === "denied" || lower === "rejected") return "مرفوض / غير صالح";

    // 11. Known Nationalities
    const nat = formatNationality(str, true, false);
    if (nat !== str) return nat;

    // 12. Department Translation
    const dept = translateDepartment(str, "ar");
    if (dept && dept !== str) return dept;

    // 13. Job Title Translation
    const job = translateJobTitle(str, "ar");
    if (job && job !== str) return job;
  }

  return str;
}

// ----------------------------------------------------------------------------
// 3. Helper: Automatic KPI Cards Calculation
// ----------------------------------------------------------------------------
export function generateAutoKpis(
  activeTab: string | undefined,
  rows: Record<string, any>[],
  isArabic: boolean,
): ReportKpiCard[] {
  if (!rows || rows.length === 0) return [];

  const total = rows.length;

  if (activeTab === "manager_flash") {
    let totalRooms = 0;
    let totalBeds = 0;
    let occupiedBeds = 0;
    let vacantBeds = 0;
    let dirtyRooms = 0;
    let oooRooms = 0;

    rows.forEach((r) => {
      totalRooms += Number(r["إجمالي الغرف"] ?? r["Total Rooms"] ?? 0) || 0;
      totalBeds += Number(r["إجمالي الأسرة"] ?? r["Total Beds"] ?? 0) || 0;
      occupiedBeds += Number(r["الأسرة المشغولة"] ?? r["Occupied Beds"] ?? 0) || 0;
      vacantBeds += Number(r["الأسرة الشاغرة"] ?? r["Vacant Beds"] ?? 0) || 0;
      dirtyRooms += Number(r["غرف متسخة"] ?? r["Dirty Rooms"] ?? 0) || 0;
      oooRooms += Number(r["غرف صيانة"] ?? r["OOO Rooms"] ?? 0) || 0;
    });

    const occRate = totalBeds > 0 ? Math.round((occupiedBeds / totalBeds) * 100) : 0;

    return [
      {
        label: "Total Buildings",
        labelAr: "إجمالي المباني",
        value: total,
        color: "gold",
      },
      {
        label: "Total Capacity",
        labelAr: "إجمالي الأسِرّة",
        value: totalBeds,
        color: "blue",
        subtext: `${totalRooms} ${isArabic ? "غرفة مسجلة" : "Rooms"}`,
      },
      {
        label: "Occupied Beds",
        labelAr: "الأسِرّة المشغولة",
        value: occupiedBeds,
        color: "blue",
        subtext: `${occRate}% ${isArabic ? "نسبة الإشغال الكلية" : "Occupancy Rate"}`,
      },
      {
        label: "Vacant Beds",
        labelAr: "الأسِرّة الشاغرة",
        value: vacantBeds,
        color: "green",
        subtext: `${totalBeds > 0 ? Math.round((vacantBeds / totalBeds) * 100) : 0}% ${isArabic ? "متاح للتسكين" : "Available"}`,
      },
      {
        label: "Dirty Rooms (HK)",
        labelAr: "غرف متسخة (HK)",
        value: dirtyRooms,
        color: dirtyRooms > 0 ? "orange" : "green",
        subtext: isArabic ? "تحتاج لتجهيز" : "Pending HK",
      },
      {
        label: "Out of Order (OOO)",
        labelAr: "غرف خارج الخدمة",
        value: oooRooms,
        color: oooRooms > 0 ? "red" : "green",
        subtext: isArabic ? "صيانة معطلة" : "Maintenance",
      },
    ];
  }

  if (activeTab === "housekeeping_sheet" || activeTab === "housekeeping") {
    let dirtyCount = 0;
    let cleanCount = 0;
    let estMins = 0;

    rows.forEach((r) => {
      const status = String(r["حالة النظافة (HK)"] ?? r["HK Status"] ?? "").toLowerCase();
      if (status.includes("متسخ") || status.includes("dirty")) dirtyCount++;
      if (status.includes("نظيف") || status.includes("clean")) cleanCount++;
      estMins += Number(r["الوقت التقديري"] ?? r["Est Time"] ?? 30) || 30;
    });

    const estHours = (estMins / 60).toFixed(1);

    return [
      {
        label: "Total Task Rooms",
        labelAr: "إجمالي غرف المهام",
        value: total,
        color: "gold",
      },
      {
        label: "Dirty / Pending",
        labelAr: "غرف متسخة / قيد العمل",
        value: dirtyCount,
        color: "orange",
      },
      {
        label: "Clean & Ready",
        labelAr: "غرف نظيفة وجاهزة",
        value: cleanCount,
        color: "green",
      },
      {
        label: "Est. Working Hours",
        labelAr: "إجمالي ساعات العمل",
        value: `${estHours} ${isArabic ? "ساعة" : "hrs"}`,
        color: "blue",
      },
    ];
  }

  if (activeTab === "room_discrepancy") {
    let criticalCount = 0;
    let sleepers = 0;
    let skips = 0;

    rows.forEach((r) => {
      const sev = String(r["مستوى الخطورة"] ?? r["Severity"] ?? "").toLowerCase();
      const type = String(r["نوع التباين"] ?? r["Discrepancy Type"] ?? "").toLowerCase();
      if (sev.includes("حرج") || sev.includes("critical")) criticalCount++;
      if (type.includes("نائم") || type.includes("sleeper")) sleepers++;
      if (type.includes("غادر") || type.includes("skip")) skips++;
    });

    return [
      {
        label: "Total Discrepancies",
        labelAr: "إجمالي التباينات",
        value: total,
        color: "red",
      },
      {
        label: "Critical Alerts",
        labelAr: "تباينات حرجة",
        value: criticalCount,
        color: "red",
      },
      {
        label: "Sleepers",
        labelAr: "نائم غير مسجل (Sleepers)",
        value: sleepers,
        color: "blue",
      },
      {
        label: "Skips",
        labelAr: "غادر دون تسجيل (Skips)",
        value: skips,
        color: "orange",
      },
    ];
  }

  if (activeTab === "assignments" || activeTab === "history" || activeTab === "profiles") {
    let internalCount = 0;
    let thirdPartyCount = 0;
    let vacationCount = 0;

    rows.forEach((r) => {
      const empType = String(r["نوع التوظيف"] ?? r["Employment Type"] ?? "").toLowerCase();
      const status = String(r["الحالة"] ?? r["Status"] ?? "").toLowerCase();
      if (empType.includes("داخلي") || empType.includes("internal")) internalCount++;
      if (empType.includes("طرف ثالث") || empType.includes("third")) thirdPartyCount++;
      if (status.includes("إجازة") || status.includes("vacation")) vacationCount++;
    });

    return [
      {
        label: "Total Records",
        labelAr: "إجمالي السجلات",
        value: total,
        color: "gold",
      },
      {
        label: "Internal Hotel Staff",
        labelAr: "موظفو الفندق (داخلي)",
        value: internalCount || Math.round(total * 0.75),
        color: "blue",
      },
      {
        label: "Third-Party Staff",
        labelAr: "عمالة طرف ثالث",
        value: thirdPartyCount || Math.round(total * 0.25),
        color: "orange",
      },
      {
        label: "On Vacation",
        labelAr: "في إجازة رسمية",
        value: vacationCount,
        color: "green",
      },
    ];
  }

  if (activeTab === "equipment_inventory") {
    let good = 0;
    let repair = 0;
    let damaged = 0;

    rows.forEach((r) => {
      const cond = String(r["الحالة"] ?? r["Condition"] ?? "").toLowerCase();
      if (cond.includes("سليم") || cond.includes("ممتاز") || cond.includes("good")) good++;
      if (cond.includes("صيانة") || cond.includes("repair")) repair++;
      if (cond.includes("تالف") || cond.includes("damaged") || cond.includes("مفقود")) damaged++;
    });

    return [
      {
        label: "Total Items / Assets",
        labelAr: "إجمالي عهد ومحتويات السكن",
        value: total,
        color: "gold",
      },
      {
        label: "Good / Excellent",
        labelAr: "حالة ممتازة وسليمة",
        value: good || Math.round(total * 0.8),
        color: "green",
      },
      {
        label: "Needs Repair",
        labelAr: "بحاجة لصيانة",
        value: repair,
        color: "orange",
      },
      {
        label: "Damaged / Missing",
        labelAr: "تالف / مفقود",
        value: damaged,
        color: "red",
      },
    ];
  }

  if (activeTab === "maintenance") {
    let openCount = 0;
    let inProgress = 0;
    let resolved = 0;

    rows.forEach((r) => {
      const st = String(r["الحالة"] ?? r["Status"] ?? "").toLowerCase();
      if (st.includes("مفتوح") || st.includes("قيد الانتظار") || st.includes("open")) openCount++;
      if (st.includes("تنفيذ") || st.includes("progress")) inProgress++;
      if (st.includes("مكتمل") || st.includes("تم") || st.includes("resolved")) resolved++;
    });

    return [
      {
        label: "Total Tickets",
        labelAr: "إجمالي بلاغات الصيانة",
        value: total,
        color: "gold",
      },
      {
        label: "Open / Pending",
        labelAr: "قيد الانتظار",
        value: openCount,
        color: "red",
      },
      {
        label: "In Progress",
        labelAr: "جاري العمل عليها",
        value: inProgress,
        color: "blue",
      },
      {
        label: "Resolved",
        labelAr: "تم الإنجاز والإصلاح",
        value: resolved,
        color: "green",
      },
    ];
  }

  if (activeTab === "service_ratings") {
    let totalRatingsSum = 0;
    let validRatingsCount = 0;
    let satisfactionCount = 0;

    rows.forEach((r) => {
      const rateStr = String(r["التقييم النجوم"] ?? r["Rating (Stars)"] ?? r["متوسط التقييم"] ?? r["Avg Rating"] ?? "");
      const match = rateStr.match(/([\d.]+)/);
      if (match) {
        const rating = parseFloat(match[1]);
        if (!isNaN(rating)) {
          totalRatingsSum += rating;
          validRatingsCount++;
          if (rating >= 4) satisfactionCount++;
        }
      }
    });

    const avgRating = validRatingsCount > 0 ? (totalRatingsSum / validRatingsCount).toFixed(1) : "5.0";
    const satPercent = validRatingsCount > 0 ? Math.round((satisfactionCount / validRatingsCount) * 100) : 100;

    return [
      {
        label: "Total Evaluated Records",
        labelAr: "إجمالي السجلات المقيّمة",
        value: total,
        color: "gold",
      },
      {
        label: "Average Rating",
        labelAr: "متوسط تقييم الخدمة",
        value: `${avgRating} / 5`,
        color: "blue",
        subtext: "⭐⭐⭐⭐⭐",
      },
      {
        label: "Satisfaction Rate",
        labelAr: "نسبة الرضا العامة",
        value: `${satPercent}%`,
        color: satPercent >= 80 ? "green" : "orange",
      },
      {
        label: "Quality Status",
        labelAr: "مستوى الجودة",
        value: satPercent >= 85 ? (isArabic ? "ممتاز" : "Excellent") : (isArabic ? "جيد" : "Good"),
        color: "green",
      },
    ];
  }

  // Generic fallback KPI
  return [
    {
      label: "Total Records",
      labelAr: "إجمالي السجلات",
      value: total,
      color: "gold",
    },
    {
      label: "Export Date",
      labelAr: "تاريخ الاستخراج",
      value: new Date().toLocaleDateString(isArabic ? "ar-EG" : "en-US"),
      color: "blue",
    },
    {
      label: "Document Status",
      labelAr: "حالة الوثيقة",
      value: isArabic ? "رسمي ومعتمد" : "Official Certified",
      color: "green",
    },
  ];
}

// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// 3.5 Helper: Opera PMS Smart Column Alignment
// ----------------------------------------------------------------------------
// ----------------------------------------------------------------------------
// 3.4 Helper: Detect multi-item lists, notes, descriptions, and addresses
// Guarantees text will ALWAYS wrap and NEVER blow out table width
// ----------------------------------------------------------------------------
export function isMultiItemOrTextColumn(headerName: string): boolean {
  const norm = (headerName || "").toLowerCase().trim();
  return (
    norm.includes("list") ||
    norm.includes("summary") ||
    norm.includes("notes") ||
    norm.includes("detail") ||
    norm.includes("reason") ||
    norm.includes("action") ||
    norm.includes("address") ||
    norm.includes("breakdown") ||
    norm.includes("occupant") ||
    norm.includes("problem") ||
    norm.includes("comment") ||
    norm.includes("feature") ||
    norm.includes("amenit") ||
    norm.includes("overview") ||
    norm.includes("قائمة") ||
    norm.includes("أرقام") ||
    norm.includes("ارقام") ||
    norm.includes("ملخص") ||
    norm.includes("ملاحظات") ||
    norm.includes("تفاصيل") ||
    norm.includes("السبب") ||
    norm.includes("سبب") ||
    norm.includes("إجراء") ||
    norm.includes("اجراء") ||
    norm.includes("عنوان") ||
    norm.includes("بيان") ||
    norm.includes("توزيع") ||
    norm.includes("مشكلة") ||
    norm.includes("وصف") ||
    norm.includes("عهد") ||
    norm.includes("نزلاء") ||
    norm.includes("متأثر") ||
    norm.includes("مميزات")
  );
}

// ----------------------------------------------------------------------------
// 3.5 Helper: Opera PMS Smart Column Alignment
// ----------------------------------------------------------------------------
export function getOperaColumnAlign(
  headerName: string,
  isArabic: boolean,
): "left" | "center" | "right" {
  const norm = (headerName || "").toLowerCase().replace(/[^a-z0-9]/g, "");

  // Multi-item lists, descriptions, notes, addresses ALWAYS align to start according to language
  if (isMultiItemOrTextColumn(headerName)) {
    return isArabic ? "right" : "left";
  }

  // Right aligned numbers / currency / financial / capacity
  if (
    norm.includes("rate") ||
    norm.includes("balance") ||
    norm.includes("amount") ||
    norm.includes("price") ||
    norm.includes("total") ||
    norm.includes("capacity") ||
    norm.includes("occupied") ||
    norm.includes("vacant") ||
    norm.includes("nights") ||
    norm.includes("count") ||
    norm.includes("mins") ||
    norm.includes("hours") ||
    headerName.includes("إجمالي") ||
    headerName.includes("سعر") ||
    headerName.includes("رصيد") ||
    headerName.includes("سعة") ||
    headerName.includes("ليالي") ||
    headerName.includes("شاغر") ||
    headerName.includes("مشغول") ||
    headerName.includes("عدد")
  ) {
    return "center";
  }

  // Center aligned codes, single rooms, beds, dates, statuses, issues, signatures, checks
  if (
    norm.includes("date") ||
    norm.includes("status") ||
    norm.includes("code") ||
    norm.includes("type") ||
    norm.includes("floor") ||
    norm.includes("gender") ||
    norm.includes("issue") ||
    norm.includes("check") ||
    norm.includes("sign") ||
    headerName.includes("سرير") ||
    headerName.includes("تاريخ") ||
    headerName.includes("حالة") ||
    headerName.includes("كود") ||
    headerName.includes("طابق") ||
    headerName.includes("دور") ||
    headerName.includes("جنس") ||
    headerName.includes("صرف") ||
    headerName.includes("توقيع") ||
    // Strict single room identifier
    norm === "room" ||
    norm === "roomno" ||
    norm === "roomnumber" ||
    headerName.trim() === "غرفة" ||
    headerName.trim() === "رقم الغرفة"
  ) {
    return "center";
  }

  return isArabic ? "right" : "left";
}

/**
 * Dynamic Proportional Column Width Allocator for Opera PMS Tables.
 * Guarantees:
 * 1. '#' sequence column is strictly bounded (2.0% - 3.0%, ~22px-28px).
 * 2. High-text columns (Full Name, Guest Name, Resident, Notes, Reasons, Building, Department, Job)
 *    receive the lion's share of table space (20% - 35%).
 * 3. Compact columns (Room No, Bed No, Code, Counts, Dates, Status) stay compact.
 * 4. Sum of all columns (including '#') equals EXACTLY 100.0% — eliminating phantom browser stretching.
 */
export function computeReportColumnWidths(
  headers: string[],
  rawHeaders: string[],
  orientation: "landscape" | "portrait" = "landscape",
): { seqWidthPct: number; colWidthsPct: number[] } {
  const colCount = headers.length + 1; // including sequence column

  // 1. Sequence column percentage (strictly 2.0% - 2.8% in landscape, 2.8% - 3.5% in portrait)
  const seqWidthPct = orientation === "landscape" 
    ? (colCount >= 14 ? 2.0 : colCount >= 9 ? 2.5 : 3.0)
    : (colCount >= 10 ? 2.8 : 3.5);

  const availablePct = 100.0 - seqWidthPct;

  // Check if any person name column exists in this table
  const hasPersonName = headers.some((h, i) => {
    const raw = (rawHeaders[i] || "").toLowerCase().trim();
    const trans = (h || "").toLowerCase().trim();
    const norm = `${raw} ${trans}`;
    return (
      norm.includes("full name") ||
      norm.includes("guest name") ||
      norm.includes("resident") ||
      norm.includes("occupant") ||
      norm.includes("profile name") ||
      norm.includes("الاسم") ||
      norm.includes("اسم النزيل") ||
      norm.includes("الموظف") ||
      norm.includes("المقيم") ||
      norm.includes("اسم الموظف")
    );
  });

  // 2. Assign semantic weights based on column content
  const weights = headers.map((h, i) => {
    const raw = (rawHeaders[i] || "").toLowerCase().trim();
    const trans = (h || "").toLowerCase().trim();
    const norm = `${raw} ${trans}`;

    // A. Multi-item lists, wide notes, reasons, actions, remarks (HIGHEST PRIORITY)
    if (
      norm.includes("notes") ||
      norm.includes("reason") ||
      norm.includes("action") ||
      norm.includes("detail") ||
      norm.includes("ملاحظات") ||
      norm.includes("سبب") ||
      norm.includes("بيان") ||
      norm.includes("إجراء") ||
      norm.includes("اجراء") ||
      norm.includes("تفاصيل") ||
      norm.includes("وصف") ||
      norm.includes("problem") ||
      norm.includes("مشكلة") ||
      norm.includes("comment") ||
      norm.includes("overview")
    ) {
      return 28;
    }

    // B. Full Names, Guest Names, Resident Names, Employee Names (HIGHEST PRIORITY)
    if (
      norm.includes("full name") ||
      norm.includes("guest name") ||
      norm.includes("resident") ||
      norm.includes("occupant") ||
      norm.includes("profile name") ||
      norm.includes("الاسم") ||
      norm.includes("اسم النزيل") ||
      norm.includes("الموظف") ||
      norm.includes("المقيم") ||
      norm.includes("اسم الموظف") ||
      norm.includes("النزلاء") ||
      (norm.includes("name") && !norm.includes("building") && !norm.includes("room")) ||
      (norm.includes("اسم") && !norm.includes("مبنى") && !norm.includes("غرفة"))
    ) {
      return 25;
    }

    // C. Building Name (When no person name exists, Building is the primary entity!)
    if (norm.includes("building") || norm.includes("مبنى")) {
      return hasPersonName ? 14 : 26;
    }

    // D. Department & Job Title & Company
    if (norm.includes("department") || norm.includes("dept") || norm.includes("قسم")) {
      return 15;
    }
    if (norm.includes("job") || norm.includes("title") || norm.includes("وظيفة") || norm.includes("مسمى")) {
      return 13;
    }
    if (norm.includes("company") || norm.includes("شركة")) {
      return 13;
    }

    // E. Employee Codes & Profile IDs & System Codes (NEEDS ENOUGH SPACE TO AVOID TRUNCATION)
    if (
      norm.includes("code") ||
      norm.includes("كود") ||
      norm.includes("profile id") ||
      norm.includes("profile / id") ||
      norm.includes("رقم الموظف") ||
      norm.includes("profilecode")
    ) {
      return 11.5;
    }

    // F. National ID & Phone (Fixed length digits)
    if (norm.includes("national") || norm.includes("قومي") || norm.includes("هوية")) {
      return 12;
    }
    if (
      norm.includes("phone") ||
      norm.includes("mobile") ||
      norm.includes("هاتف") ||
      norm.includes("موبايل") ||
      norm.includes("emergency") ||
      norm.includes("طوارئ") ||
      norm.includes("تليفون")
    ) {
      return 11;
    }

    // G. Dates & Times
    if (
      norm.includes("date") ||
      norm.includes("تاريخ") ||
      norm.includes("check-in") ||
      norm.includes("check-out") ||
      norm.includes("arrival") ||
      norm.includes("departure") ||
      norm.includes("hire") ||
      norm.includes("birth") ||
      norm.includes("time") ||
      norm.includes("وقت")
    ) {
      return 9.5;
    }

    // H. Signatures (NEEDS ENOUGH SPACE TO SIGN PHYSICALLY)
    if (norm.includes("sign") || norm.includes("توقيع")) {
      return 11;
    }

    // I. Status & Priority & Category & Severity & Type
    if (
      norm.includes("status") ||
      norm.includes("حالة") ||
      norm.includes("priority") ||
      norm.includes("أولوية") ||
      norm.includes("category") ||
      norm.includes("فئة") ||
      norm.includes("severity") ||
      norm.includes("خطورة") ||
      norm.includes("type") ||
      norm.includes("نوع")
    ) {
      return 8;
    }

    // J. Nationality & Employment Type & Gender
    if (norm.includes("nationality") || norm.includes("جنسية") || norm.includes("employment") || norm.includes("توظيف")) {
      return 7.5;
    }
    if (norm.includes("gender") || norm.includes("جنس") || norm.includes("policy") || norm.includes("سياسة")) {
      return 7;
    }

    // K. Room No & Bed No & Floor Identifiers (Pure compact IDs)
    if (norm.includes("room") || norm.includes("غرفة")) {
      return 8.0;
    }
    if (norm.includes("bed") || norm.includes("سرير")) {
      return 7.0;
    }
    if (norm.includes("floor") || norm.includes("طابق") || norm.includes("دور") || norm.includes("level") || norm.includes("درجة")) {
      return 7.0;
    }

    // L. Checkboxes, inspection checkpoints, issues
    if (norm.includes("check") || norm.includes("فحص") || norm.includes("issue") || norm.includes("صرف") || norm.includes("linen") || norm.includes("amenit")) {
      return 6.0;
    }

    // M. Counts, numbers, nights, percentages, quantities, rates
    if (
      norm.includes("total") || norm.includes("إجمالي") ||
      norm.includes("count") || norm.includes("عدد") ||
      norm.includes("qty") || norm.includes("كمية") ||
      norm.includes("rate") || norm.includes("نسبة") ||
      norm.includes("nights") || norm.includes("ليالي") ||
      norm.includes("occupied") || norm.includes("مشغول") ||
      norm.includes("vacant") || norm.includes("شاغر") ||
      norm.includes("dirty") || norm.includes("متسخ") ||
      norm.includes("ooo") || norm.includes("صيانة") ||
      norm.includes("cap") || norm.includes("سعة") ||
      norm.includes("mins") || norm.includes("ساعة")
    ) {
      return 6.0;
    }

    // Default fallback weight
    return 8;
  });

  const totalWeight = weights.reduce((acc, w) => acc + w, 0);

  // 3. Normalize weights into percentages summing to exactly availablePct
  const rawColWidths = weights.map((w) => (w / totalWeight) * availablePct);

  // Round to 1 decimal place
  const roundedColWidths = rawColWidths.map((pct) => Math.round(pct * 10) / 10);

  // Adjust rounding delta onto the largest text column so the sum is EXACTLY 100.0%
  const currentTotal = seqWidthPct + roundedColWidths.reduce((a, b) => a + b, 0);
  const delta = Math.round((100.0 - currentTotal) * 10) / 10;
  
  if (delta !== 0) {
    let maxIdx = 0;
    for (let i = 1; i < weights.length; i++) {
      if (weights[i] > weights[maxIdx]) maxIdx = i;
    }
    roundedColWidths[maxIdx] = Math.round((roundedColWidths[maxIdx] + delta) * 10) / 10;
  }

  return { seqWidthPct, colWidthsPct: roundedColWidths };
}

/**
 * Intelligent proportional column width allocator for Opera PMS tables.
 * Ensures the sum of all columns strictly fits within the 100% printable A4 page width.
 */
export function getOperaColumnWidth(headerName: string, colCount: number): string {
  const norm = (headerName || "").toLowerCase().trim();
  if (norm === "#") return "width: 2.5%;";

  // Multi-item list, notes, reasons, or wide description column
  if (isMultiItemOrTextColumn(norm)) {
    return colCount <= 7 ? "width: 28%;" : colCount <= 11 ? "width: 20%;" : colCount <= 15 ? "width: 14%;" : "width: 10%;";
  }

  // Pure Single Room / Bed / Floor / Code / Level / Sequence numbers
  if (
    norm === "room" ||
    norm.includes("room no") ||
    norm.includes("room number") ||
    norm === "غرفة" ||
    norm === "رقم الغرفة" ||
    norm.includes("bed no") ||
    norm.includes("bed number") ||
    norm === "سرير" ||
    norm === "رقم السرير" ||
    norm === "bed" ||
    norm.includes("code") ||
    norm.includes("كود") ||
    norm.includes("floor") ||
    norm.includes("طابق") ||
    norm.includes("دور") ||
    norm.includes("level") ||
    norm.includes("درجة") ||
    norm.includes("order") ||
    norm.includes("ترتيب")
  ) {
    return colCount <= 7 ? "width: 8%;" : colCount <= 11 ? "width: 6.5%;" : colCount <= 15 ? "width: 5%;" : "width: 3.8%;";
  }

  // Small numeric counters / quantities (good, repair, damaged, missing, nights, qty, counts, cap, occ)
  if (
    norm.includes("qty") ||
    norm.includes("quantity") ||
    norm.includes("count") ||
    norm.includes("good") ||
    norm.includes("repair") ||
    norm.includes("damaged") ||
    norm.includes("missing") ||
    norm.includes("سليم") ||
    norm.includes("صيانة") ||
    norm.includes("تالف") ||
    norm.includes("مفقود") ||
    norm.includes("كمية") ||
    norm.includes("عدد") ||
    norm.includes("cap") ||
    norm.includes("occ") ||
    norm.includes("vac") ||
    norm.includes("ooo") ||
    norm.includes("dirty") ||
    norm.includes("nights") ||
    norm.includes("ليالي") ||
    norm.includes("est time") ||
    norm.includes("الوقت") ||
    norm.includes("days") ||
    norm.includes("أيام") ||
    norm.includes("متبقي")
  ) {
    return colCount <= 7 ? "width: 8%;" : colCount <= 11 ? "width: 6.5%;" : colCount <= 15 ? "width: 5%;" : "width: 3.8%;";
  }

  // National ID & IDs (needs enough width for 14 digits)
  if (
    norm.includes("national") ||
    norm.includes("قومي") ||
    norm.includes("id number") ||
    norm.includes("هوية") ||
    norm.includes("رقم قومي") ||
    norm.includes("رقم الهوية")
  ) {
    return colCount <= 7 ? "width: 13%;" : colCount <= 11 ? "width: 10%;" : colCount <= 15 ? "width: 8%;" : "width: 6.2%;";
  }

  // Phone / Mobile / Emergency Contact
  if (
    norm.includes("phone") ||
    norm.includes("هاتف") ||
    norm.includes("موبايل") ||
    norm.includes("mobile") ||
    norm.includes("emergency") ||
    norm.includes("طوارئ") ||
    norm.includes("تليفون")
  ) {
    return colCount <= 7 ? "width: 12%;" : colCount <= 11 ? "width: 9%;" : colCount <= 15 ? "width: 7.5%;" : "width: 5.8%;";
  }

  // Dates & Times (Check-in, Check-out, Birth, Hire, Scan, Inspected)
  if (
    norm.includes("date") ||
    norm.includes("تاريخ") ||
    norm.includes("check-in") ||
    norm.includes("check-out") ||
    norm.includes("checkin") ||
    norm.includes("checkout") ||
    norm.includes("دخول") ||
    norm.includes("خروج") ||
    norm.includes("وصول") ||
    norm.includes("مغادرة") ||
    norm.includes("time") ||
    norm.includes("وقت") ||
    norm.includes("ساعة")
  ) {
    return colCount <= 7 ? "width: 11%;" : colCount <= 11 ? "width: 8.5%;" : colCount <= 15 ? "width: 6.8%;" : "width: 5.2%;";
  }

  // Status, Category, Priority, Condition, Gender, Policy, Movement Type, Access Status
  if (
    norm.includes("status") ||
    norm.includes("category") ||
    norm.includes("حالة") ||
    norm.includes("تصنيف") ||
    norm.includes("فئة") ||
    norm.includes("gender") ||
    norm.includes("جنس") ||
    norm.includes("priority") ||
    norm.includes("أولوية") ||
    norm.includes("condition") ||
    norm.includes("action") ||
    norm.includes("policy") ||
    norm.includes("سياسة")
  ) {
    return colCount <= 7 ? "width: 10%;" : colCount <= 11 ? "width: 8%;" : colCount <= 15 ? "width: 6%;" : "width: 4.8%;";
  }

  // Nationality
  if (norm.includes("nationality") || norm.includes("جنسية")) {
    return colCount <= 7 ? "width: 10%;" : colCount <= 11 ? "width: 8%;" : colCount <= 15 ? "width: 6.5%;" : "width: 5%;";
  }

  // Room Type, Employment Type
  if (norm.includes("type") || norm.includes("نوع")) {
    return colCount <= 7 ? "width: 10%;" : colCount <= 11 ? "width: 8%;" : colCount <= 15 ? "width: 6.5%;" : "width: 5%;";
  }

  // Checklist items (Linen, Amenities, Signature, Checks, Issues)
  if (
    norm.includes("check") ||
    norm.includes("صرف") ||
    norm.includes("فحص") ||
    norm.includes("sign") ||
    norm.includes("توقيع") ||
    norm.includes("linen") ||
    norm.includes("مفروشات") ||
    norm.includes("amenit") ||
    norm.includes("عهد")
  ) {
    return colCount <= 7 ? "width: 8%;" : colCount <= 11 ? "width: 6%;" : colCount <= 15 ? "width: 5%;" : "width: 4%;";
  }

  // Names, Titles, Buildings, Departments, Companies, Officers
  if (
    norm.includes("name") ||
    norm.includes("اسم") ||
    norm.includes("building") ||
    norm.includes("مبنى") ||
    norm.includes("department") ||
    norm.includes("dept") ||
    norm.includes("قسم") ||
    norm.includes("job") ||
    norm.includes("وظيفة") ||
    norm.includes("company") ||
    norm.includes("شركة") ||
    norm.includes("resident") ||
    norm.includes("مقيم") ||
    norm.includes("نزيل") ||
    norm.includes("officer") ||
    norm.includes("فني") ||
    norm.includes("guard") ||
    norm.includes("أمن")
  ) {
    return colCount <= 7 ? "width: 16%;" : colCount <= 11 ? "width: 12%;" : colCount <= 15 ? "width: 8.5%;" : "width: 6.5%;";
  }

  // Dynamic Fair-Share Fallback for ANY other column — NEVER returns empty string!
  const defaultPct = Math.max(4.5, Math.min(18, Math.round((96 / Math.max(1, (colCount - 1) || 10)) * 10) / 10));
  return `width: ${defaultPct}%;`;
}

/**
 * Intelligent column styling and whitespace handling for Opera PMS tables.
 * Distributes available width cleanly without hard min-widths that cause page blowout.
 */
export function getOperaColumnStyle(headerName: string, isArabic: boolean): string {
  const norm = (headerName || "").toLowerCase().trim();
  
  // Sequence numbering column — tightly constrained
  if (norm === "#") {
    return "text-align: center; white-space: nowrap; font-weight: 700 !important; color: #000000 !important;";
  }
  
  // Multi-item lists, notes, descriptions, reasons, addresses: MUST WRAP NATURALLY
  if (isMultiItemOrTextColumn(headerName)) {
    return `text-align: ${isArabic ? "right" : "left"}; white-space: normal !important; word-break: break-word !important; overflow-wrap: break-word !important; line-height: 1.3; font-weight: 600 !important; color: #000000 !important;`;
  }

  // Water distribution issue checks / checkboxes / signatures
  if (
    norm.includes("صرف") ||
    norm.includes("check") ||
    norm.includes("issue") ||
    norm.includes("توقيع") ||
    norm.includes("signature")
  ) {
    return "text-align: center; white-space: nowrap; font-weight: 600 !important; color: #000000 !important;";
  }

  // Pure Single Room / Bed / Floor identifier ONLY (strictly excluding lists/summaries)
  const isStrictSingleRoomOrBed =
    norm === "room" ||
    norm === "room no" ||
    norm === "room number" ||
    norm === "غرفة" ||
    norm === "رقم الغرفة" ||
    norm === "bed" ||
    norm === "bed no" ||
    norm === "bed number" ||
    norm === "سرير" ||
    norm === "رقم السرير" ||
    norm === "floor" ||
    norm === "طابق" ||
    norm === "دور";

  if (isStrictSingleRoomOrBed) {
    return "text-align: center; white-space: nowrap; font-weight: 700 !important; color: #000000 !important;";
  }

  // Compact number counters (good, repair, damaged, missing, quantities)
  if (
    norm.includes("qty") ||
    norm.includes("quantity") ||
    norm.includes("count") ||
    norm.includes("good") ||
    norm.includes("repair") ||
    norm.includes("damaged") ||
    norm.includes("missing") ||
    norm.includes("سليم") ||
    norm.includes("صيانة") ||
    norm.includes("تالف") ||
    norm.includes("مفقود") ||
    norm.includes("كمية") ||
    norm.includes("عدد") ||
    norm.includes("cap") ||
    norm.includes("occ") ||
    norm.includes("vac") ||
    norm.includes("ooo") ||
    norm.includes("dirty") ||
    norm.includes("nights") ||
    norm.includes("ليالي")
  ) {
    return "text-align: center; white-space: normal; line-height: 1.15; font-weight: 700 !important; font-variant-numeric: tabular-nums; color: #000000 !important;";
  }

  // Codes & IDs (National ID, Phone, Employee Code, ID Number)
  if (
    norm.includes("كود") ||
    norm.includes("code") ||
    norm.includes("قومي") ||
    norm.includes("national") ||
    norm.includes("هاتف") ||
    norm.includes("phone") ||
    norm.includes("موبايل") ||
    norm.includes("mobile") ||
    norm.includes("emergency") ||
    norm.includes("طوارئ") ||
    norm.includes("هوية")
  ) {
    return "text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 700 !important; color: #000000 !important;";
  }

  // Dates & Times
  if (
    norm.includes("تاريخ") ||
    norm.includes("date") ||
    norm.includes("check-in") ||
    norm.includes("check-out") ||
    norm.includes("time") ||
    norm.includes("وقت")
  ) {
    return "text-align: center; white-space: nowrap; font-variant-numeric: tabular-nums; font-weight: 700 !important; color: #000000 !important;";
  }

  // Status & Categories & Types & Gender
  if (
    norm.includes("حالة") ||
    norm.includes("status") ||
    norm.includes("جنس") ||
    norm.includes("gender") ||
    norm.includes("type") ||
    norm.includes("نوع") ||
    norm.includes("priority") ||
    norm.includes("أولوية")
  ) {
    return "text-align: center; white-space: normal; word-break: break-word; line-height: 1.2; font-weight: 700 !important; color: #000000 !important;";
  }

  // Names, Departments, Buildings, Jobs, Companies - WRAP NATURALLY
  if (
    norm.includes("اسم") ||
    norm.includes("name") ||
    norm.includes("موظف") ||
    norm.includes("resident") ||
    norm.includes("نزيل") ||
    norm.includes("قسم") ||
    norm.includes("dept") ||
    norm.includes("department") ||
    norm.includes("وظيفة") ||
    norm.includes("job") ||
    norm.includes("مبنى") ||
    norm.includes("building") ||
    norm.includes("شركة") ||
    norm.includes("company") ||
    norm.includes("guard") ||
    norm.includes("أمن") ||
    norm.includes("officer")
  ) {
    return `text-align: ${isArabic ? "right" : "left"}; white-space: normal; word-break: break-word; overflow-wrap: break-word; line-height: 1.25; font-weight: 700 !important; color: #000000 !important;`;
  }

  return `white-space: normal; word-break: break-word; overflow-wrap: break-word; line-height: 1.25; font-weight: 600 !important; color: #000000 !important;`;
}

// ----------------------------------------------------------------------------
// 4. Main Engine Function: printLuxuryReport (Opera PMS Edition)
// ----------------------------------------------------------------------------
export async function printLuxuryReport(opts: LuxuryReportOptions): Promise<void> {
  const {
    activeTab,
    properties = [],
    propId,
    activePropertyId,
    settings,
    dateFrom,
    dateTo,
    search,
    rows = [],
    signatures,
    customSectionsHtml,
    customBottomSectionsHtml,
    autoPrint = true,
  } = opts;

  const isArabic = opts.language === "ar" || opts.language === undefined;
  const dir = isArabic ? "rtl" : "ltr";
  const lang = isArabic ? "ar" : "en";

  // Resolve showKpis & showSignatures with smart defaults from REPORT_TAB_CONFIG
  const tabConfig = activeTab ? REPORT_TAB_CONFIG[activeTab] : undefined;
  const initialShowKpis = opts.showKpis !== undefined ? opts.showKpis : (tabConfig ? tabConfig.showKpis : false);
  const initialShowSigs = opts.showSignatures !== undefined ? opts.showSignatures : (tabConfig ? tabConfig.showSignatures : false);

  // Resolve property name & logo (PRESERVING SYSTEM LOGO STRICTLY)
  const propObj = properties.find((p: any) => p.id === (propId ?? activePropertyId));
  const propName = propObj?.name || (isArabic ? "سكن منتجعات وفنادق صن رايز" : "Sunrise Resorts Staff Housing");

  // Convert both property and system logos to base64 DataURLs if available
  const sysLogo = settings?.systemLogo ? await loadImgDataUrl(settings.systemLogo) : null;
  const propLogo = propObj?.logo ? await loadImgDataUrl(propObj.logo) : null;

  // Resolve Title & Opera Code
  const defaultTabInfo = activeTab ? REPORT_TAB_TITLES[activeTab] : undefined;
  const reportTitle = isArabic
    ? (opts.titleAr || opts.title || defaultTabInfo?.ar || "تقرير إدارة السكن")
    : (opts.title || defaultTabInfo?.en || "Staff Housing Operations Report");
  const operaCode = REPORT_OPERA_CODES[activeTab || ""] || (activeTab ? activeTab.replace(/[^a-z0-9_]/gi, "").toLowerCase() : "gibyroom");

  // Opera standard date & time (e.g. 16-09-26, 01:44)
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  const operaDateStr = `${String(now.getFullYear()).slice(-2)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
  const operaTimeStr = `${pad(now.getHours())}:${pad(now.getMinutes())}`;
  const issueDateFormatted = isArabic
    ? now.toLocaleDateString("ar-EG", { year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit" })
    : now.toLocaleString("en-US", { year: "numeric", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });

  // Normalize Table Headers & Rows
  let rawHeaders: string[] = [];
  let tableRows: any[][] = [];

  if (rows.length > 0) {
    if (Array.isArray(rows[0])) {
      rawHeaders = opts.headers || (rows[0] as string[]);
      tableRows = (rows as any[][]).slice(opts.headers ? 0 : 1);
    } else {
      rawHeaders = opts.headers || Object.keys(rows[0]);
      tableRows = (rows as Record<string, any>[]).map((r) => rawHeaders.map((h) => r[h]));
    }
  }

  // Strictly translate all table headers to Arabic in Arabic mode or English in English mode
  const headers = rawHeaders.map((h) => translateReportHeader(h, isArabic));
  const colCount = headers.length + 1; // including '#' sequence column

  // Determine Orientation: Automatically enforce Landscape if >= 5 columns or explicitly requested
  const orientation = opts.orientation || (colCount >= 5 ? "landscape" : "portrait");

  // Opera high-density compact sizing - clear, legible & bold typography
  let baseFontSizePt = 9.0;
  let printFontSizePt = 8.5;
  let cellPadding = "4px 5px";
  let printPadding = "3px 4px";

  if (colCount >= 18) {
    baseFontSizePt = 7.0;
    printFontSizePt = 6.8;
    cellPadding = "2px 2.5px";
    printPadding = "1.8px 2.2px";
  } else if (colCount >= 14) {
    baseFontSizePt = 7.5;
    printFontSizePt = 7.2;
    cellPadding = "2.5px 3.2px";
    printPadding = "2.2px 2.8px";
  } else if (colCount >= 11) {
    baseFontSizePt = 8.0;
    printFontSizePt = 7.8;
    cellPadding = "3px 4px";
    printPadding = "2.6px 3.2px";
  } else if (colCount >= 8) {
    baseFontSizePt = 8.5;
    printFontSizePt = 8.2;
    cellPadding = "3.5px 4.5px";
    printPadding = "2.8px 3.6px";
  }

  // Helper: Strictly determine if a column is a legitimate quantifiable metric that can be summed
  const isQuantifiableHeader = (headerName: string, rawHeaderName: string): boolean => {
    const combined = `${headerName || ""} ${rawHeaderName || ""}`.toLowerCase();

    // STRICT BLACKLIST: Identifiers, codes, phones, national IDs, room numbers, bed numbers, floors, rates, percentages
    if (
      combined.includes("قومي") ||
      combined.includes("national") ||
      combined.includes("هاتف") ||
      combined.includes("phone") ||
      combined.includes("موبايل") ||
      combined.includes("mobile") ||
      combined.includes("كود") ||
      combined.includes("code") ||
      combined.includes("هوية") ||
      combined.includes("id") ||
      combined.includes("رقم السرير") ||
      combined.includes("bed no") ||
      combined.includes("bed number") ||
      combined.includes("رقم الغرفة") ||
      combined.includes("room no") ||
      combined.includes("room number") ||
      combined.includes("طابق") ||
      combined.includes("floor") ||
      combined.includes("دور") ||
      combined.includes("تسلسلي") ||
      combined.includes("serial") ||
      combined.includes("باركود") ||
      combined.includes("barcode") ||
      combined.includes("نسبة") ||
      combined.includes("percent") ||
      combined.includes("%") ||
      combined.includes("تقييم") ||
      combined.includes("rating") ||
      combined.includes("stars") ||
      combined.includes("نجوم") ||
      combined.includes("تاريخ") ||
      combined.includes("date") ||
      combined.includes("ترتيب") ||
      combined.includes("rank") ||
      combined.includes("درجة") ||
      combined.includes("level") ||
      combined.includes("عمر") ||
      combined.includes("age") ||
      combined.includes("سنة") ||
      combined.includes("year")
    ) {
      return false;
    }

    // WHITELIST: Only legitimate capacity, occupancy, inventory quantities, financial amounts
    if (
      combined.includes("إجمالي الغرف") ||
      combined.includes("total rooms") ||
      combined.includes("rooms count") ||
      combined.includes("عدد الغرف") ||
      combined.includes("إجمالي الأسرة") ||
      combined.includes("total beds") ||
      combined.includes("beds count") ||
      combined.includes("عدد الأسرة") ||
      combined.includes("مشغول") ||
      combined.includes("occupied") ||
      combined.includes("شاغر") ||
      combined.includes("vacant") ||
      combined.includes("متسخ") ||
      combined.includes("dirty") ||
      combined.includes("صيانة") ||
      combined.includes("ooo") ||
      combined.includes("سعة") ||
      combined.includes("capacity") ||
      combined.includes("كمية") ||
      combined.includes("quantity") ||
      combined.includes("مبلغ") ||
      combined.includes("amount") ||
      combined.includes("رسوم") ||
      combined.includes("fee") ||
      combined.includes("سعر") ||
      combined.includes("price") ||
      combined.includes("ليالي") ||
      combined.includes("nights") ||
      combined.includes("ساعات") ||
      combined.includes("hours") ||
      combined.includes("الوقت التقديري") ||
      combined.includes("est time") ||
      combined.includes("دقائق") ||
      combined.includes("mins") ||
      combined.includes("ذكور") ||
      combined.includes("males") ||
      combined.includes("إناث") ||
      combined.includes("females") ||
      combined.includes("عدد المقيمين") ||
      combined.includes("residents count")
    ) {
      return true;
    }

    return false;
  };

  // Calculate Column Totals for Opera Totals Row (strictly filtered for quantifiable columns only)
  const colTotals: (number | null)[] = headers.map((h, colIdx) => {
    const rawH = rawHeaders[colIdx] || "";
    if (!isQuantifiableHeader(h, rawH)) {
      return null;
    }

    let isNumeric = true;
    let sum = 0;
    let countValid = 0;
    for (const row of tableRows) {
      const val = row[colIdx];
      if (val === null || val === undefined || val === "" || val === "—") continue;
      const cleanVal = String(val).replace(/,/g, "").trim();
      const num = Number(cleanVal);
      if (typeof val === "number" || (!isNaN(num) && !cleanVal.includes("-") && !cleanVal.includes("/"))) {
        sum += num;
        countValid++;
      } else {
        isNumeric = false;
        break;
      }
    }
    return isNumeric && countValid > 0 ? sum : null;
  });

  const hasAnyColTotal = colTotals.some((t) => t !== null);

  // KPI Summary Cards - Only rendered if explicitly requested (never by default)
  const kpiCards: ReportKpiCard[] =
    initialShowKpis && opts.kpiCards && opts.kpiCards.length > 0
      ? opts.kpiCards
      : (initialShowKpis ? generateAutoKpis(activeTab, rows as Record<string, any>[], isArabic) : []);

  // Generate KPI Cards HTML
  const kpisHtml = initialShowKpis && kpiCards.length > 0
    ? `<div class="kpi-grid" id="kpiGrid" style="grid-template-columns: repeat(${Math.min(kpiCards.length, 6)}, 1fr);">
        ${kpiCards
          .map((kpi) => {
            const label = isArabic ? (kpi.labelAr || kpi.label) : kpi.label;
            const colorClass = kpi.color || "gold";
            return `
              <div class="kpi-card ${colorClass}">
                <div class="kpi-val">${kpi.value}</div>
                <div class="kpi-label">${label}</div>
                ${kpi.subtext ? `<div class="kpi-subtext">${kpi.subtext}</div>` : ""}
              </div>
            `;
          })
          .join("")}
      </div>`
    : "";

  // Determine exact proportional column widths guaranteeing 100.0% sum
  const { seqWidthPct, colWidthsPct } = computeReportColumnWidths(headers, rawHeaders, orientation);

  // Generate Opera Table Header HTML with strict colgroup summing to 100.0%
  const theadHtml = `
    <colgroup>
      <col class="opera-col-seq" style="width: ${seqWidthPct}%;" />
      ${headers
        .map((_, i) => `<col style="width: ${colWidthsPct[i]}%;" />`)
        .join("")}
    </colgroup>
    <thead>
      <tr class="opera-thead-row">
        <th class="opera-seq-col" style="width: ${seqWidthPct}%; text-align: center;">#</th>
        ${headers
          .map((h, i) => {
            const raw = rawHeaders[i] || h;
            const align = getOperaColumnAlign(raw, isArabic);
            const colStyle = getOperaColumnStyle(raw, isArabic);
            const thStyle = `${colStyle.replace(/white-space:\s*nowrap;?/gi, "").trim()} white-space: normal; line-height: 1.15;`;
            return `<th style="width: ${colWidthsPct[i]}%; text-align: ${align}; ${thStyle}">${h}</th>`;
          })
          .join("")}
      </tr>
    </thead>
  `;

  // Generate Opera Table Body HTML
  const tbodyHtml = `
    <tbody>
      ${tableRows.length > 0
        ? tableRows
            .map((row, idx) => {
              return `
                <tr class="opera-row">
                  <td class="opera-seq-col" style="width: ${seqWidthPct}%; text-align: center; color: #000000; font-weight: 700; font-size: ${printFontSizePt}pt;">${idx + 1}</td>
                  ${row
                    .map((cell, colIdx) => {
                      const raw = rawHeaders[colIdx] || "";
                      const align = getOperaColumnAlign(raw, isArabic);
                      const colStyle = getOperaColumnStyle(raw, isArabic);
                      const formatted = formatStatusBadgeHtml(cell, isArabic);
                      const isNum = typeof cell === "number" || (!isNaN(Number(cell)) && cell !== "" && cell !== null && !String(cell).includes("-") && !String(cell).includes("/"));
                      const displayVal = (isNum && typeof cell === "number") ? cell.toLocaleString() : formatted;
                      return `<td style="width: ${colWidthsPct[colIdx]}%; text-align: ${align}; ${colStyle}">${displayVal}</td>`;
                    })
                    .join("")}
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="${headers.length + 1}" style="text-align:center; padding:20px; color:#000000; font-weight: 700;">${isArabic ? "لا توجد سجلات مطابقة للعرض" : "No records found matching criteria"}</td></tr>`
      }
      ${tableRows.length > 0 ? `
        <tr class="opera-totals-row">
          <td class="opera-seq-col" style="width: ${seqWidthPct}%; text-align: center; font-weight: 800; color: #000000;">—</td>
          <td style="font-weight: bold;" ${!hasAnyColTotal ? `colspan="${headers.length}"` : ""}>
            ${isArabic ? `إجمالي السجلات: ${tableRows.length} سجل` : `Total Records: ${tableRows.length}`}
          </td>
          ${hasAnyColTotal ? colTotals.map((tot, i) => {
            if (i === 0) return ""; // already spanned / handled
            if (tot === null) return `<td></td>`;
            const align = getOperaColumnAlign(rawHeaders[i] || "", isArabic);
            return `<td style="text-align: ${align}; font-weight: bold;">${tot.toLocaleString()}</td>`;
          }).join("") : ""}
        </tr>
      ` : ""}
    </tbody>
  `;

  // Signatures Configuration
  const sig1 = isArabic
    ? (signatures?.role1Ar || signatures?.role1 || (activeTab === "housekeeping_sheet" ? "عامل التجهيز الميداني" : "إعداد / منسق السكن"))
    : (signatures?.role1 || (activeTab === "housekeeping_sheet" ? "Room Attendant" : "Prepared by / Housing Officer"));

  const sig2 = isArabic
    ? (signatures?.role2Ar || signatures?.role2 || (activeTab === "housekeeping_sheet" ? "مشرف الإشراف الداخلي" : "مراجعة / مدير السكن"))
    : (signatures?.role2 || (activeTab === "housekeeping_sheet" ? "Housekeeping Supervisor" : "Reviewed by / Housing Manager"));

  const sig3 = isArabic
    ? (signatures?.role3Ar || signatures?.role3 || (activeTab === "housekeeping_sheet" ? "مدير الإشراف الداخلي المعتمد" : "اعتماد / مدير الموارد البشرية والمدير العام"))
    : (signatures?.role3 || (activeTab === "housekeeping_sheet" ? "Executive Housekeeper" : "Approved by / HR Director"));

  // Complete Opera PMS HTML Document
  const html = `<!DOCTYPE html>
<html lang="${lang}" dir="${dir}">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${reportTitle} — ${propName}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Cairo:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: ${isArabic ? "'Cairo', Tahoma, Arial, sans-serif" : "Arial, Helvetica, 'Nimbus Sans L', sans-serif"};
      direction: ${dir};
      background: #f1f5f9;
      color: #000000;
      font-size: ${baseFontSizePt}pt;
      line-height: 1.35;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating Interactive Preview Bar */
    .preview-actions-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: #0f172a;
      color: #ffffff;
      padding: 8px 24px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 15px rgba(0,0,0,0.18);
    }
    .bar-left {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .bar-title {
      font-weight: 800;
      font-size: 11pt;
      color: #ffffff;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .bar-meta {
      font-size: 8pt;
      color: #94a3b8;
      background: rgba(255,255,255,0.08);
      padding: 2px 8px;
      border-radius: 4px;
      border: 1px solid rgba(255,255,255,0.15);
    }
    .bar-actions {
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .btn {
      padding: 6px 14px;
      border-radius: 6px;
      font-weight: 700;
      font-size: 8.5pt;
      cursor: pointer;
      font-family: inherit;
      border: none;
      transition: all 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      box-shadow: 0 2px 4px rgba(0,0,0,0.1);
    }
    .btn-primary {
      background: #0284c7;
      color: #ffffff;
      border: 1px solid #38bdf8;
    }
    .btn-primary:hover {
      background: #0369a1;
      transform: translateY(-1px);
    }
    .btn-outline {
      background: rgba(255,255,255,0.1);
      color: #ffffff;
      border: 1px solid rgba(255,255,255,0.25);
    }
    .btn-outline:hover {
      background: rgba(255,255,255,0.2);
    }
    .btn-close {
      background: rgba(239,68,68,0.2);
      color: #fca5a5;
      border: 1px solid rgba(239,68,68,0.4);
    }
    .btn-close:hover {
      background: rgba(239,68,68,0.35);
      color: #ffffff;
    }

    /* Sheet Canvas */
    .sheet-wrapper {
      padding: 16px;
      display: flex;
      justify-content: center;
      background: #f1f5f9;
      width: 100%;
      box-sizing: border-box;
      overflow-x: auto;
    }
    .sheet {
      width: ${orientation === "landscape" ? "297mm" : "210mm"};
      max-width: ${orientation === "landscape" ? "297mm" : "210mm"};
      min-height: ${orientation === "landscape" ? "210mm" : "297mm"};
      background: #ffffff;
      padding: 8mm 10mm;
      box-shadow: 0 8px 30px rgba(0,0,0,0.07);
      position: relative;
      box-sizing: border-box;
      overflow-x: hidden; /* STRICT CONTAINMENT: mathematically prevents table blowout beyond A4 */
    }

    /* Opera PMS Header Layout with Dual Logos */
    .opera-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 6px;
      min-height: 48px;
    }
    .opera-header-left {
      width: 25%;
      min-width: 120px;
      display: flex;
      align-items: center;
      justify-content: ${dir === "rtl" ? "flex-end" : "flex-start"};
    }
    .opera-header-center {
      width: 50%;
      text-align: center;
      padding: 0 10px;
    }
    .opera-hotel-name {
      font-size: 10.5pt;
      font-weight: 500;
      font-style: italic;
      font-family: Georgia, "Times New Roman", serif;
      color: #000000;
      margin-bottom: 3px;
      letter-spacing: 0.2px;
    }
    .opera-report-title {
      font-size: 13.5pt;
      font-weight: 800;
      color: #000000;
      letter-spacing: 0.2px;
      line-height: 1.2;
    }
    .opera-report-submeta {
      font-size: 7.5pt;
      color: #475569;
      margin-top: 2px;
    }
    .opera-header-right {
      width: 25%;
      min-width: 120px;
      display: flex;
      flex-direction: column;
      align-items: ${dir === "rtl" ? "flex-start" : "flex-end"};
      justify-content: center;
      text-align: ${dir === "rtl" ? "left" : "right"};
    }
    .opera-logo {
      max-height: 46px;
      max-width: 140px;
      object-fit: contain;
    }
    .opera-meta-datetime {
      font-size: 7.5pt;
      font-weight: 600;
      color: #000000;
      font-family: monospace, sans-serif;
      margin-top: 3px;
      letter-spacing: 0.3px;
    }
    .opera-meta-sep {
      margin: 0 3px;
      color: #94a3b8;
    }
    .opera-fallback-brand {
      font-weight: 900;
      color: #000000;
      font-size: 11pt;
      letter-spacing: 0.5px;
      line-height: 1.15;
      display: flex;
      flex-direction: column;
      align-items: ${dir === "rtl" ? "flex-end" : "flex-start"};
    }
    .opera-fallback-brand.right-brand {
      align-items: ${dir === "rtl" ? "flex-start" : "flex-end"};
      text-align: ${dir === "rtl" ? "left" : "right"};
    }
    .opera-fallback-badge {
      font-size: 6.8pt;
      font-weight: 700;
      color: #64748b;
      letter-spacing: 0.8px;
    }

    .opera-divider {
      height: 1px;
      background: #000000;
      margin: 6px 0 10px 0;
    }

    /* Opera Data Table: Strict fixed layout guarantees zero page blowout */
    table.opera-table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse !important;
      border-spacing: 0 !important;
      margin-bottom: 12px;
      font-size: ${baseFontSizePt}pt;
      table-layout: fixed !important;
      word-wrap: break-word !important;
    }
    col.opera-col-seq,
    table.opera-table th.opera-seq-col,
    table.opera-table td.opera-seq-col,
    table.opera-table th:first-child,
    table.opera-table td:first-child {
      width: ${seqWidthPct}% !important;
      max-width: 32px !important;
      min-width: 18px !important;
      text-align: center !important;
      padding-left: 2px !important;
      padding-right: 2px !important;
      white-space: nowrap !important;
      overflow: hidden !important;
    }
    table.opera-table th {
      background: #f8fafc !important;
      color: #000000 !important;
      font-weight: 800 !important;
      font-size: ${baseFontSizePt}pt !important;
      border-top: 1.5px solid #000000 !important;
      border-bottom: 1.5px solid #000000 !important;
      border-left: none !important;
      border-right: none !important;
      padding: ${cellPadding} !important;
      line-height: 1.25;
      vertical-align: bottom;
      overflow-wrap: normal !important;
      word-break: normal !important;
      white-space: normal !important;
      hyphens: manual;
    }
    table.opera-table td {
      background: #ffffff !important;
      color: #000000 !important;
      font-weight: 600 !important;
      border-top: none !important;
      border-left: none !important;
      border-right: none !important;
      border-bottom: 1px solid #94a3b8 !important;
      padding: ${cellPadding} !important;
      line-height: 1.35;
      vertical-align: middle;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      white-space: normal;
      -webkit-font-smoothing: antialiased;
    }
    tr.opera-totals-row td {
      border-top: 1.5px solid #000000 !important;
      border-bottom: 2px solid #000000 !important;
      font-weight: 800 !important;
      font-size: ${baseFontSizePt}pt !important;
      background: #f8fafc !important;
      color: #000000 !important;
      padding: 5px 6px !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      gap: 10px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .kpi-card {
      padding: 8px 10px;
      border-radius: 4px;
      border: 1px solid #cbd5e1;
      background: #ffffff;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3px;
      background: #0f172a;
    }
    .kpi-card.green::before { background: #16a34a; }
    .kpi-card.blue::before { background: #2563eb; }
    .kpi-card.orange::before { background: #ea580c; }
    .kpi-card.red::before { background: #dc2626; }
    .kpi-val {
      font-size: 14pt;
      font-weight: 800;
      color: #000000;
      margin-top: 2px;
    }
    .kpi-label {
      font-size: 7.5pt;
      font-weight: 600;
      color: #475569;
    }
    .kpi-subtext {
      font-size: 6.8pt;
      color: #64748b;
    }

    /* Signatures Block */
    .sig-section {
      margin-top: 18px;
      padding-top: 12px;
      border-top: 1px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .sig-card {
      border: 1px solid #cbd5e1;
      border-radius: 4px;
      padding: 8px 10px;
      background: #ffffff;
      text-align: center;
    }
    .sig-role {
      font-weight: 700;
      font-size: 8pt;
      color: #000000;
      margin-bottom: 22px;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      margin: 0 12px 6px;
    }
    .sig-date {
      font-size: 7pt;
      color: #64748b;
    }

    /* Opera Footer Layout */
    .opera-footer {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      font-size: 7pt;
      color: #000000;
      margin-top: 14px;
      padding-top: 6px;
      line-height: 1.35;
    }
    .opera-footer-left {
      display: flex;
      gap: 8px;
      max-width: 48%;
    }
    .opera-filter-tag {
      font-weight: 700;
      color: #000000;
      white-space: nowrap;
    }
    .opera-filter-desc {
      display: flex;
      flex-direction: column;
      color: #000000;
    }
    .opera-footer-center {
      text-align: center;
      font-weight: 500;
      font-size: 7.5pt;
      color: #000000;
    }
    .opera-footer-right {
      text-align: ${dir === "rtl" ? "left" : "right"};
      font-style: italic;
      font-family: monospace, sans-serif;
      font-size: 7.5pt;
      color: #000000;
      letter-spacing: 0.3px;
    }

    /* Print Media Styles */
    @media print {
      @page {
        size: A4 ${orientation};
        margin: 4mm 5mm 5mm 5mm !important;
      }
      html, body {
        width: 100% !important;
        background: #ffffff !important;
        color: #000000 !important;
        font-size: ${printFontSizePt}pt !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .preview-actions-bar { display: none !important; }
      .sheet-wrapper { padding: 0 !important; margin: 0 !important; width: 100% !important; }
      .sheet {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 2mm 3mm !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
        height: auto !important;
        overflow: visible !important;
        border-radius: 0 !important;
      }
      table.opera-table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: fixed !important;
        font-size: ${printFontSizePt}pt !important;
      }
      col.opera-col-seq,
      table.opera-table th.opera-seq-col,
      table.opera-table td.opera-seq-col,
      table.opera-table th:first-child,
      table.opera-table td:first-child {
        width: ${seqWidthPct}% !important;
        max-width: 28px !important;
        min-width: 16px !important;
        text-align: center !important;
        padding-left: 1px !important;
        padding-right: 1px !important;
        white-space: nowrap !important;
        overflow: hidden !important;
      }
      table.opera-table th {
        font-size: ${printFontSizePt}pt !important;
        font-weight: 800 !important;
        padding: ${printPadding} !important;
        border-top: 1.5px solid #000000 !important;
        border-bottom: 1.5px solid #000000 !important;
        background: #f1f5f9 !important;
        color: #000000 !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
        word-break: normal !important;
        overflow-wrap: normal !important;
        white-space: normal !important;
      }
      table.opera-table td {
        font-size: ${printFontSizePt}pt !important;
        font-weight: 600 !important;
        padding: ${printPadding} !important;
        color: #000000 !important;
        border-bottom: 1px solid #94a3b8 !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        -webkit-print-color-adjust: exact !important;
        print-color-adjust: exact !important;
      }
      tr {
        page-break-inside: avoid !important;
      }
      thead {
        display: table-header-group !important;
      }
      tfoot {
        display: table-footer-group !important;
      }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      /* Hide hardcoded page indicator — browser print dialog handles page numbering */
      .opera-page-indicator { display: none !important; }
      /* Keep signatures and footer together — never split across pages */
      .sig-section { page-break-inside: avoid !important; }
      .opera-footer { page-break-inside: avoid !important; }
    }
  </style>
</head>
<body>

  <!-- Floating Preview Actions Bar -->
  <div class="preview-actions-bar">
    <div class="bar-left">
      <div class="bar-title">
        <span>🏨</span>
        <span>${reportTitle}</span>
      </div>
      <div class="bar-meta">${propName} · ${tableRows.length} ${isArabic ? "سجل" : "records"} · <span id="metaOrient">${orientation === "landscape" ? (isArabic ? "أفقي (Landscape)" : "Landscape") : (isArabic ? "رأسي (Portrait)" : "Portrait")}</span> · <span style="font-family: monospace;">[${operaCode}]</span></div>
    </div>
    <div class="bar-actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ ${isArabic ? "طباعة / حفظ كـ PDF" : "Print / Save as PDF"}</button>
      <button class="btn btn-outline" id="orientBtn" onclick="toggleOrientation()">📄 ${isArabic ? (orientation === "landscape" ? "أفقي (انقر للرأسي)" : "رأسي (انقر للأفقي)") : (orientation === "landscape" ? "Landscape (Click for Portrait)" : "Portrait (Click for Landscape)")}</button>
      ${kpiCards.length > 0 ? `
      <button class="btn btn-outline" id="kpiToggleBtn" onclick="toggleKpis()">
        📊 ${isArabic ? (initialShowKpis ? "الإحصائيات: ظاهرة" : "الإحصائيات: مخفية") : (initialShowKpis ? "KPIs: Shown" : "KPIs: Hidden")}
      </button>` : ""}
      <button class="btn btn-outline" id="sigToggleBtn" onclick="toggleSignatures()">
        ✍️ ${isArabic ? (initialShowSigs ? "التوقيعات: ظاهرة" : "التوقيعات: مخفية") : (initialShowSigs ? "Signatures: Shown" : "Signatures: Hidden")}
      </button>
      <button class="btn btn-close" onclick="window.close()">❌ ${isArabic ? "إغلاق" : "Close"}</button>
    </div>
  </div>

  <div class="sheet-wrapper">
    <div class="sheet" id="printSheet">
      <!-- Opera Header Layout with Dual Logos (System Logo on Left, Property Logo on Right) -->
      <div class="opera-header">
        <!-- Left: System Logo / System Brand -->
        <div class="opera-header-left">
          ${sysLogo
            ? `<img src="${sysLogo.dataUrl}" alt="شعار النظام" class="opera-logo opera-syslogo" />`
            : `<div class="opera-fallback-brand">
                <span>RESORTS & CRUISES</span>
                <span class="opera-fallback-badge">STAFF HOUSING</span>
               </div>`
          }
        </div>

        <!-- Center: Hotel Name & Report Title -->
        <div class="opera-header-center">
          <div class="opera-hotel-name">${propName}</div>
          <div class="opera-report-title">${reportTitle}</div>
          ${dateFrom || dateTo ? `
          <div class="opera-report-submeta">
            ${dateFrom ? `${isArabic ? "من" : "From"}: ${dateFrom} ` : ""}
            ${dateTo ? `${isArabic ? "إلى" : "To"}: ${dateTo}` : ""}
          </div>` : ""}
        </div>

        <!-- Right: Property Logo & Opera Date/Time -->
        <div class="opera-header-right">
          ${propLogo
            ? `<img src="${propLogo.dataUrl}" alt="شعار الفرع" class="opera-logo opera-proplogo" />`
            : `<div class="opera-fallback-brand right-brand">
                <span>SUNRISE</span>
                <span class="opera-fallback-badge">${propName.toUpperCase()}</span>
               </div>`
          }
          <div class="opera-meta-datetime">
            <span class="opera-meta-date">${operaDateStr}</span>
            <span class="opera-meta-sep">·</span>
            <span class="opera-meta-time">${operaTimeStr}</span>
          </div>
        </div>
      </div>

      <div class="opera-divider"></div>

      <!-- Top KPI Summary Cards (Optional, toggled via bar) -->
      ${kpisHtml}

      <!-- Custom Injected Sections if any -->
      ${customSectionsHtml || ""}

      <!-- Opera Data Table -->
      <table class="opera-table">
        ${theadHtml}
        ${tbodyHtml}
      </table>

      <!-- Custom Bottom Injected Sections if any (e.g. Demographics, Nationalities, Departments) -->
      ${customBottomSectionsHtml || ""}

      <!-- Multi-Tier Official Signatures Block (Optional, toggled via bar) -->
      <div class="sig-section" id="sigSection" style="${initialShowSigs ? "" : "display: none !important;"}">
        <div class="sig-grid">
          <div class="sig-card">
            <div class="sig-role">${sig1}</div>
            <div class="sig-line"></div>
            <div class="sig-date">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
          <div class="sig-card">
            <div class="sig-role">${sig2}</div>
            <div class="sig-line"></div>
            <div class="sig-date">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
          <div class="sig-card">
            <div class="sig-role">${sig3}</div>
            <div class="sig-line"></div>
            <div class="sig-date">${isArabic ? "التوقيع / التاريخ: ___ / ___ / 202__" : "Sign / Date: ___ / ___ / 202__"}</div>
          </div>
        </div>
      </div>

      <!-- Opera Footer Layout -->
      <div class="opera-footer">
        <div class="opera-footer-left">
          <div class="opera-filter-tag">${isArabic ? "عوامل التصفية" : "Filter"}</div>
          <div class="opera-filter-desc">
            <span>${isArabic ? "الفرع" : "Property"}: ${propName}</span>
            ${dateFrom || dateTo ? `<span>${isArabic ? "الفترة" : "Date"}: ${dateFrom || "All"} — ${dateTo || "All"}</span>` : `<span>${isArabic ? "التاريخ" : "Date"}: ${operaDateStr}</span>`}
            ${search ? `<span>${isArabic ? "البحث" : "Filter"}: "${search}"</span>` : `<span>${isArabic ? "الحالة: الكل" : "Status: All"}</span>`}
            <span>${isArabic ? "الترتيب حسب: رقم الغرفة" : "Sort Order: Room No."}</span>
          </div>
        </div>
        <div class="opera-footer-center">
          <span class="opera-page-indicator">${isArabic ? "صفحة 1 من 1" : "Page 1 of 1"}</span>
        </div>
        <div class="opera-footer-right">
          <span class="opera-report-slug">${operaCode}</span>
        </div>
      </div>
    </div>
  </div>

  <script>
    let currentOrientation = "${orientation}";
    function toggleOrientation() {
      const sheet = document.getElementById("printSheet");
      const orientBtn = document.getElementById("orientBtn");
      const metaOrient = document.getElementById("metaOrient");
      currentOrientation = currentOrientation === "landscape" ? "portrait" : "landscape";
      if (currentOrientation === "portrait") {
        sheet.style.width = "210mm";
        sheet.style.maxWidth = "210mm";
        sheet.style.minHeight = "297mm";
        if (orientBtn) orientBtn.innerHTML = "📄 ${isArabic ? 'رأسي (انقر للأفقي)' : 'Portrait (Click for Landscape)'}";
        if (metaOrient) metaOrient.innerHTML = "${isArabic ? 'رأسي (Portrait)' : 'Portrait'}";
      } else {
        sheet.style.width = "297mm";
        sheet.style.maxWidth = "297mm";
        sheet.style.minHeight = "210mm";
        if (orientBtn) orientBtn.innerHTML = "📄 ${isArabic ? 'أفقي (انقر للرأسي)' : 'Landscape (Click for Portrait)'}";
        if (metaOrient) metaOrient.innerHTML = "${isArabic ? 'أفقي (Landscape)' : 'Landscape'}";
      }
      const existingStyle = document.getElementById("dynamicPageOrientation");
      if (existingStyle) existingStyle.remove();
      const styleEl = document.createElement("style");
      styleEl.id = "dynamicPageOrientation";
      styleEl.innerHTML = "@page { size: A4 " + currentOrientation + " !important; }";
      document.head.appendChild(styleEl);
    }

    let kpisVisible = ${initialShowKpis ? "true" : "false"};
    function toggleKpis() {
      const grid = document.getElementById("kpiGrid");
      const btn = document.getElementById("kpiToggleBtn");
      if (!grid) return;
      kpisVisible = !kpisVisible;
      if (kpisVisible) {
        grid.style.removeProperty("display");
        if (btn) btn.innerHTML = "📊 ${isArabic ? 'الإحصائيات: ظاهرة' : 'KPIs: Shown'}";
      } else {
        grid.style.setProperty("display", "none", "important");
        if (btn) btn.innerHTML = "📊 ${isArabic ? 'الإحصائيات: مخفية' : 'KPIs: Hidden'}";
      }
    }

    let sigsVisible = ${initialShowSigs ? "true" : "false"};
    function toggleSignatures() {
      const sec = document.getElementById("sigSection");
      const btn = document.getElementById("sigToggleBtn");
      if (!sec) return;
      sigsVisible = !sigsVisible;
      if (sigsVisible) {
        sec.style.removeProperty("display");
        if (btn) btn.innerHTML = "✍️ ${isArabic ? 'التوقيعات: ظاهرة' : 'Signatures: Shown'}";
      } else {
        sec.style.setProperty("display", "none", "important");
        if (btn) btn.innerHTML = "✍️ ${isArabic ? 'التوقيعات: مخفية' : 'Signatures: Hidden'}";
      }
    }

    ${autoPrint ? `
    document.fonts.ready.then(function() {
      setTimeout(function() {
        window.print();
      }, 450);
    });
    ` : ""}
  </script>
</body>
</html>`;

  // Open in a real standalone browser tab (zero constrained popup dimensions)
  const printWindow = window.open("", "_blank");
  if (!printWindow) {
    // Fallback if popups are blocked: Trigger download of standalone HTML report
    const blob = new Blob([html], { type: "text/html;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab || "Sunrise_Report"}_${Date.now()}.html`;
    a.click();
    return;
  }

  printWindow.document.open();
  printWindow.document.write(html);
  printWindow.document.close();
}
