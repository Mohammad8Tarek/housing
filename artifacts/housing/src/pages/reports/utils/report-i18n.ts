// ============================================================================
// Sunrise Staff Housing Management System — Enterprise Luxury Report Engine
// Report tab configuration, Opera codes, bilingual header map and value translators.
// ============================================================================

import { escapeHtml, TrustedHtml } from "@/lib/html-escape";
import { formatNationality } from "@/lib/countries";
import { translateDepartment, translateJobTitle } from "@/lib/bilingual-hospitality-dict";
import {
  translateRoomType,
  translateGenderPolicy,
  translateProfileStatus,
  translateReservationStatus,
  translateMaintenanceCategory,
  translateMaintenancePriority,
  translateMaintenanceStatus,
  translateHostingStatus,
  translateHostingRelation,
} from "@workspace/report-rows/value-translators";

export {
  translateRoomType,
  translateGenderPolicy,
  translateProfileStatus,
  translateReservationStatus,
  translateMaintenanceCategory,
  translateMaintenancePriority,
  translateMaintenanceStatus,
  translateHostingStatus,
  translateHostingRelation,
};

// ----------------------------------------------------------------------------
// 1.1 Formal Layout Configuration: Smart Defaults per Report Tab
// Executive & Operations -> show KPIs & Signatures
// Formal Lists & Manifests -> formal clean style (no KPI dashboard, no signatures)
// ----------------------------------------------------------------------------
export const REPORT_TAB_CONFIG: Record<
  string,
  { showKpis: boolean; showSignatures: boolean; orientation?: "landscape" | "portrait" }
> = {
  // Executive & Operations Audits (Clean formal report view - with executive KPIs and signatures)
  manager_flash: { showKpis: true, showSignatures: true, orientation: "landscape" },
  housekeeping_sheet: { showKpis: false, showSignatures: true, orientation: "landscape" },
  room_discrepancy: { showKpis: false, showSignatures: true, orientation: "landscape" },
  occupancy_forecast: { showKpis: false, showSignatures: false, orientation: "landscape" },

  // Formal Master Ledgers & Directory Manifests (Formal clean style, maximum rows per page)
  assignments: { showKpis: false, showSignatures: false, orientation: "landscape" },
  profiles: { showKpis: false, showSignatures: false, orientation: "landscape" },
  vacant_rooms: { showKpis: false, showSignatures: false, orientation: "landscape" },
  housing: { showKpis: false, showSignatures: false, orientation: "landscape" },
  history: { showKpis: false, showSignatures: false, orientation: "landscape" },
  expiring_contracts: { showKpis: false, showSignatures: false, orientation: "landscape" },
  reservations: { showKpis: false, showSignatures: false, orientation: "landscape" },
  hostings: { showKpis: false, showSignatures: false, orientation: "landscape" },
  maintenance: { showKpis: true, showSignatures: true, orientation: "landscape" },
  equipment_inventory: { showKpis: false, showSignatures: false, orientation: "landscape" },
  arrivals_manifest: { showKpis: false, showSignatures: false, orientation: "landscape" },
  departures_manifest: { showKpis: false, showSignatures: false, orientation: "landscape" },
  housekeeping: { showKpis: false, showSignatures: false, orientation: "landscape" },
  daily_movement: { showKpis: false, showSignatures: false, orientation: "landscape" },
  department_occupancy: { showKpis: false, showSignatures: false, orientation: "portrait" },
  gate_logs: { showKpis: false, showSignatures: false, orientation: "landscape" },
  police_report: { showKpis: false, showSignatures: true, orientation: "landscape" },
  service_ratings: { showKpis: true, showSignatures: true, orientation: "landscape" },
  housing_map: { showKpis: false, showSignatures: false, orientation: "landscape" },
  water_distribution: { showKpis: false, showSignatures: true, orientation: "landscape" },
  vacations: { showKpis: true, showSignatures: true, orientation: "landscape" },
  policy_exceptions: { showKpis: true, showSignatures: true, orientation: "landscape" },
  housing_ratings: { showKpis: true, showSignatures: false, orientation: "landscape" },
  room_moves: { showKpis: true, showSignatures: false, orientation: "landscape" },
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
  vacations: "vacation_ledger",
  policy_exceptions: "policy_audit",
  housing_ratings: "housing_pulse",
  room_moves: "room_move_log",
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
  vacations: {
    ar: "تقرير الإجازات",
    en: "Vacations Report",
  },
  policy_exceptions: {
    ar: "تقرير مخالفات واستثناءات سياسات السكن",
    en: "Housing Policy Exceptions & Audit Report",
  },
  housing_ratings: {
    ar: "تقرير استطلاع جودة السكن الأسبوعي (سري تماماً)",
    en: "Weekly Housing Quality Pulse Report (Anonymous)",
  },
  room_moves: {
    ar: "كشف حركات نقل وتغيير الغرف والأسرة",
    en: "Room Moves & Bed Transfers Audit Report",
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
  reportedby: { ar: "مقدم البلاغ", en: "Reported By" },
  "reported by": { ar: "مقدم البلاغ", en: "Reported By" },
  "مقدم البلاغ": { ar: "مقدم البلاغ", en: "Reported By" },
  reportedat: { ar: "تاريخ البلاغ", en: "Reported Date" },
  "reported at": { ar: "تاريخ البلاغ", en: "Reported At" },
  "reported date": { ar: "تاريخ البلاغ", en: "Reported Date" },
  rating: { ar: "التقييم", en: "Rating" },
  "rating & feedback": { ar: "التقييم والملاحظات", en: "Rating & Feedback" },
  "rating comments": { ar: "ملاحظات التقييم", en: "Rating Comments" },
  occupantssummary: { ar: "المقيمين والنزلاء بالأسرة", en: "Residents & Beds" },
  "residents & beds": { ar: "المقيمين والنزلاء بالأسرة", en: "Residents & Beds" },
  "المقيمين والنزلاء بالأسرة": { ar: "المقيمين والنزلاء بالأسرة", en: "Residents & Beds" },

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

  // Department Occupancy Breakdown
  residentcount: { ar: "إجمالي المقيمين", en: "Total Residents" },
  resident_count: { ar: "إجمالي المقيمين", en: "Total Residents" },
  "resident count": { ar: "إجمالي المقيمين", en: "Total Residents" },
  "total residents": { ar: "إجمالي المقيمين", en: "Total Residents" },
  "إجمالي المقيمين": { ar: "إجمالي المقيمين", en: "Total Residents" },
  malecount: { ar: "ذكور", en: "Males" },
  male_count: { ar: "ذكور", en: "Males" },
  "male count": { ar: "ذكور", en: "Males" },
  males: { ar: "ذكور", en: "Males" },
  "ذكور": { ar: "ذكور", en: "Males" },
  femalecount: { ar: "إناث", en: "Females" },
  female_count: { ar: "إناث", en: "Females" },
  "female count": { ar: "إناث", en: "Females" },
  "rooms occupied": { ar: "الغرف المشغولة", en: "Rooms Occupied" },
  "الغرف المشغولة": { ar: "الغرف المشغولة", en: "Rooms Occupied" },
  shareofhousing: { ar: "نسبة الإشغال بالسكن", en: "Share of Housing" },
  share_of_housing: { ar: "نسبة الإشغال بالسكن", en: "Share of Housing" },
  "share of housing": { ar: "نسبة الإشغال بالسكن", en: "Share of Housing" },
  "share of occupancy (%)": { ar: "نسبة الإشغال الكلية", en: "Share of Occupancy (%)" },
  "نسبة الإشغال بالسكن": { ar: "نسبة الإشغال بالسكن", en: "Share of Housing" },
  "نسبة الإشغال الكلية": { ar: "نسبة الإشغال الكلية", en: "Share of Occupancy (%)" },
  buildingslist: { ar: "المباني المسكن بها", en: "Assigned Buildings" },
  buildings_list: { ar: "المباني المسكن بها", en: "Assigned Buildings" },
  "buildings list": { ar: "المباني المسكن بها", en: "Assigned Buildings" },
  "assigned buildings": { ar: "المباني المسكن بها", en: "Assigned Buildings" },
  "المباني المسكن بها": { ar: "المباني المسكن بها", en: "Assigned Buildings" },
  "القسم الإداري": { ar: "القسم الإداري", en: "Department" },

  // Water Distribution Sheet
  waterissue1: { ar: "الصرف الأول (النصف الأول)", en: "1st Issue (1st Half)" },
  water_issue_1: { ar: "الصرف الأول (النصف الأول)", en: "1st Issue (1st Half)" },
  "water issue 1": { ar: "الصرف الأول (النصف الأول)", en: "1st Issue (1st Half)" },
  "1st issue": { ar: "الصرف الأول", en: "1st Issue" },
  "1st issue (1st half)": { ar: "الصرف الأول (النصف الأول)", en: "1st Issue (1st Half)" },
  "الصرف الأول": { ar: "الصرف الأول", en: "1st Issue" },
  "الصرف الأول (النصف الأول)": { ar: "الصرف الأول (النصف الأول)", en: "1st Issue (1st Half)" },
  waterissue2: { ar: "الصرف الثاني (النصف الثاني)", en: "2nd Issue (2nd Half)" },
  water_issue_2: { ar: "الصرف الثاني (النصف الثاني)", en: "2nd Issue (2nd Half)" },
  "water issue 2": { ar: "الصرف الثاني (النصف الثاني)", en: "2nd Issue (2nd Half)" },
  "2nd issue": { ar: "الصرف الثاني", en: "2nd Issue" },
  "2nd issue (2nd half)": { ar: "الصرف الثاني (النصف الثاني)", en: "2nd Issue (2nd Half)" },
  "الصرف الثاني": { ar: "الصرف الثاني", en: "2nd Issue" },
  "الصرف الثاني (النصف الثاني)": { ar: "الصرف الثاني (النصف الثاني)", en: "2nd Issue (2nd Half)" },
  residentsignature: { ar: "توقيع المستلم", en: "Resident Signature" },
  "resident signature": { ar: "توقيع المستلم", en: "Resident Signature" },
  "توقيع المستلم": { ar: "توقيع المستلم", en: "Resident Signature" },

  // Policy Exceptions & Governance
  violationtype: { ar: "نوع المخالفة", en: "Violation Type" },
  "violation type": { ar: "نوع المخالفة", en: "Violation Type" },
  violationdetails: { ar: "تفاصيل المخالفة والسياسة", en: "Policy Details" },
  "violation details": { ar: "تفاصيل المخالفة والسياسة", en: "Policy Details" },
  approvalstatus: { ar: "حالة الاعتماد", en: "Approval Status" },
  "approval status": { ar: "حالة الاعتماد", en: "Approval Status" },
  approvedby: { ar: "المعتمد للطلب", en: "Approved By" },
  "approved by": { ar: "المعتمد للطلب", en: "Approved By" },
  overridereason: { ar: "سبب ومسوغات الاستثناء", en: "Override Reason" },
  "override reason": { ar: "سبب ومسوغات الاستثناء", en: "Override Reason" },
  requestdate: { ar: "تاريخ الاستثناء", en: "Exception Date" },
  "request date": { ar: "تاريخ الاستثناء", en: "Exception Date" },
  exceptiondate: { ar: "تاريخ الاستثناء", en: "Exception Date" },
  "exception date": { ar: "تاريخ الاستثناء", en: "Exception Date" },
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

// 1.8 Bilingual value translators live in @workspace/report-rows (shared with the API).

// ----------------------------------------------------------------------------
// 2. Helper: Status Badge Formatter (Clean, minimal executive presentation)
// ----------------------------------------------------------------------------
export function formatStatusBadgeHtml(val: any, isArabic: boolean): string {
  // Cell values are user data unless explicitly marked as markup we built ourselves.
  if (val instanceof TrustedHtml) return val.html;
  if (val === null || val === undefined || val === "") return "—";
  // Safety net: never render raw objects/arrays as "[object Object]".
  if (Array.isArray(val)) {
    if (val.length === 0) return "—";
    return val
      .map((v: any) => {
        if (v !== null && typeof v === "object") {
          return v.name ?? v.label ?? v.value ?? v.title ?? JSON.stringify(v);
        }
        return v;
      })
      .map((v: any) => escapeHtml(v))
      .join(" | ");
  }
  if (typeof val === "object") {
    const o = val as Record<string, any>;
    const picked = o.name ?? o.label ?? o.value ?? o.title ?? o.text;
    return picked !== undefined && picked !== null && typeof picked !== "object"
      ? escapeHtml(picked)
      : "—";
  }
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

  // Star rating badge styling
  if (str.includes("★")) {
    return `<span style="display:inline-flex; align-items:center; gap:3px; padding:2px 8px; border-radius:12px; font-size:11px; font-weight:700; background:#fffbeb; border:1px solid #fde68a; color:#d97706; white-space:nowrap;">${escapeHtml(str)}</span>`;
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
    if (nat !== str) return escapeHtml(nat);

    // 12. Department Translation
    const dept = translateDepartment(str, "ar");
    if (dept && dept !== str) return escapeHtml(dept);

    // 13. Job Title Translation
    const job = translateJobTitle(str, "ar");
    if (job && job !== str) return escapeHtml(job);
  }

  return escapeHtml(str);
}
