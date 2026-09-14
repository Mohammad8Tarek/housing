// ============================================================================
// Sunrise Staff Housing Management System — Enterprise Luxury Report Engine
// 5-Star Hospitality PDF & Vector Print Generator
// Supports 100% Native Arabic (Cairo Font, Ligatures, RTL) and English (LTR)
// ============================================================================

import { loadImgDataUrl } from "./export";

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
  autoPrint?: boolean;
}

// ----------------------------------------------------------------------------
// 1. Bilingual Titles & Hospitality Mapping
// ----------------------------------------------------------------------------
export const REPORT_TAB_TITLES: Record<string, { ar: string; en: string }> = {
  manager_flash: {
    ar: "تقرير المدير الصباحي — مصفوفة المباني والعمليات اليومية",
    en: "Daily Operations & Occupancy Morning Report (Manager Flash)",
  },
  arrivals_manifest: {
    ar: "كشف المتوقع وصولهم وتسكينهم (Arrivals Manifest)",
    en: "Expected Arrivals & Check-in Manifest",
  },
  departures_manifest: {
    ar: "كشف المغادرات والتصفيات المستحقة (Due Out & Departures)",
    en: "Due Out & Departures Manifest",
  },
  housekeeping_sheet: {
    ar: "كشف مهام الهاوس كيبنج والتفتيش الميداني اليومي",
    en: "Housekeeping Room Attendant Daily Task Sheet",
  },
  room_discrepancy: {
    ar: "تقرير تدقيق ومطابقة حالات الغرف (Discrepancy Audit)",
    en: "Room Status Discrepancy & Audit Report",
  },
  occupancy_forecast: {
    ar: "تقرير توقعات الإشغال وحركة الأسرة المستقبلية",
    en: "Occupancy & Bed Availability Forecast",
  },
  assignments: {
    ar: "كشف المقيمين الفعليين وتوزيع الأسرة بالسكن (In-House)",
    en: "In-House Resident Occupancy & Bed Distribution Report",
  },
  vacant_rooms: {
    ar: "كشف الغرف الشاغرة والأسرة المتاحة للتسكين",
    en: "Vacant Rooms & Available Beds Report",
  },
  housing: {
    ar: "دليل الغرف السكنية والطاقة الاستيعابية الشاملة",
    en: "Housing Room Inventory & Capacity Report",
  },
  profiles: {
    ar: "دليل ملفات الموظفين والنزلاء وبيانات السكن",
    en: "Staff & Resident Profiles Directory",
  },
  expiring_contracts: {
    ar: "تقرير تدقيق العقود المنتهية والمشرفة على الانتهاء",
    en: "Contract Expiration & Renewal Audit Report",
  },
  reservations: {
    ar: "سجل الحجوزات والتسكين المستقبلي (Reservations)",
    en: "Reservations & Booking Manifest",
  },
  hostings: {
    ar: "سجل استضافة الضيوف والزيارات العائلية (Guest Hosting)",
    en: "Guest & Family Visitor Hostings Report",
  },
  maintenance: {
    ar: "سجل أوامر العمل وبلاغات الصيانة الهندسية",
    en: "Engineering Maintenance Work Orders & Defect Log",
  },
  housekeeping: {
    ar: "سجل نظافة الغرف وجاهزية الإشراف الداخلي",
    en: "Housekeeping Cleanliness Status & Turnover Log",
  },
  equipment_inventory: {
    ar: "جرد عهد ومحتويات ومعدات الغرف السكنية",
    en: "Room Amenities & Equipment Inventory Report",
  },
  history: {
    ar: "سجل التسكين التاريخي وحركات الإقامة السابقة",
    en: "Housing Historical Stays & Movements Archive",
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
  "code & name": { ar: "كود واسم الموظف", en: "Code & Name" },
  fullname: { ar: "الاسم الكامل", en: "Full Name" },
  full_name: { ar: "الاسم الكامل", en: "Full Name" },
  "full name": { ar: "الاسم الكامل", en: "Full Name" },
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
  nationality: { ar: "الجنسية", en: "Nationality" },
  gender: { ar: "الجنس", en: "Gender" },
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
// 2. Helper: Status Badge Formatter
// ----------------------------------------------------------------------------
export function formatStatusBadgeHtml(val: any, isArabic: boolean): string {
  if (val === null || val === undefined || val === "") return "—";
  const str = String(val).trim();

  // Pattern matching for status badges
  const greenPatterns = [
    "متاح", "شاغر", "سليم", "ممتاز", "ممتازة", "نظيفة", "جاهز", "معتمد", "مكتمل",
    "نشط", "good", "clean", "available", "ready", "approved", "resolved", "active",
    "completed", "confirmed", "مؤكد", "عادي", "low", "منخفض",
  ];

  const redPatterns = [
    "متسخ", "تالف", "معطل", "مفقود", "حرج", "صيانة", "مرفوض", "خارج الخدمة",
    "غير مطابق", "dirty", "damaged", "missing", "critical", "ooo", "out of order",
    "rejected", "urgent", "high", "طارئ", "عاجل", "مرتفع", "skip", "غادر دون تسجيل",
  ];

  const bluePatterns = [
    "مشغول", "داخلي", "فندق", "مقيم", "مقيم بالسكن", "occupied", "internal",
    "checked-in", "in-house", "قيد التنفيذ", "in progress", "sleeper", "نائم غير مسجل",
  ];

  const orangePatterns = [
    "إجازة", "طرف ثالث", "بحاجة لصيانة", "قيد الانتظار", "معلق", "تحذير", "متوسط",
    "vacation", "third party", "needs repair", "needs_repair", "pending", "warning",
    "medium", "fair", "مقبول", "مستحق اليوم", "due out",
  ];

  const slatePatterns = [
    "منتهي", "مغادر", "ملغي", "تمت المغادرة", "منقول", "expired", "left",
    "checked-out", "checked_out", "transferred", "cancelled",
  ];

  const lower = str.toLowerCase();

  const isGreen = greenPatterns.some((p) => lower.includes(p));
  const isRed = redPatterns.some((p) => lower.includes(p));
  const isBlue = bluePatterns.some((p) => lower.includes(p));
  const isOrange = orangePatterns.some((p) => lower.includes(p));
  const isSlate = slatePatterns.some((p) => lower.includes(p));

  let colorClass = "badge-slate";
  let dotColor = "#64748b";

  if (isRed) {
    colorClass = "badge-red";
    dotColor = "#ef4444";
  } else if (isGreen) {
    colorClass = "badge-green";
    dotColor = "#10b981";
  } else if (isBlue) {
    colorClass = "badge-blue";
    dotColor = "#3b82f6";
  } else if (isOrange) {
    colorClass = "badge-orange";
    dotColor = "#f59e0b";
  } else if (isSlate) {
    colorClass = "badge-slate";
    dotColor = "#94a3b8";
  } else {
    // Regular cell value without badge wrapper
    return str;
  }

  return `<span class="badge ${colorClass}"><span class="badge-dot" style="background:${dotColor};"></span>${str}</span>`;
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

    rows.forEach((r) => {
      totalRooms += Number(r["إجمالي الغرف"] ?? r["Total Rooms"] ?? 0) || 0;
      totalBeds += Number(r["إجمالي الأسرة"] ?? r["Total Beds"] ?? 0) || 0;
      occupiedBeds += Number(r["الأسرة المشغولة"] ?? r["Occupied Beds"] ?? 0) || 0;
      vacantBeds += Number(r["الأسرة الشاغرة"] ?? r["Vacant Beds"] ?? 0) || 0;
      dirtyRooms += Number(r["غرف متسخة"] ?? r["Dirty Rooms"] ?? 0) || 0;
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
      },
      {
        label: "Occupied Beds",
        labelAr: "الأسِرّة المشغولة",
        value: occupiedBeds,
        color: "blue",
        subtext: `${occRate}% ${isArabic ? "نسبة الإشغال" : "Occupancy"}`,
      },
      {
        label: "Vacant Beds",
        labelAr: "الأسِرّة الشاغرة",
        value: vacantBeds,
        color: "green",
      },
      {
        label: "Dirty Rooms",
        labelAr: "غرف متسخة (HK)",
        value: dirtyRooms,
        color: dirtyRooms > 0 ? "orange" : "green",
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
// 4. Main Engine Function: printLuxuryReport
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
    autoPrint = true,
  } = opts;

  const isArabic = opts.language === "ar" || opts.language === undefined;
  const dir = isArabic ? "rtl" : "ltr";
  const lang = isArabic ? "ar" : "en";

  // Resolve property name & logo
  const propObj = properties.find((p: any) => p.id === (propId ?? activePropertyId));
  const propName = propObj?.name || (isArabic ? "سكن منتجعات وفنادق صن رايز" : "Sunrise Resorts Staff Housing");
  const propAddress = propObj?.address || "";

  // Convert logos to base64 DataURLs if available
  const sysLogo = settings?.systemLogo ? await loadImgDataUrl(settings.systemLogo) : null;
  const propLogo = propObj?.logo && propObj.logo !== settings?.systemLogo ? await loadImgDataUrl(propObj.logo) : null;

  // Resolve Title & Subtitle
  const defaultTabInfo = activeTab ? REPORT_TAB_TITLES[activeTab] : undefined;
  const reportTitle = isArabic
    ? (opts.titleAr || opts.title || defaultTabInfo?.ar || "تقرير إدارة السكن")
    : (opts.title || defaultTabInfo?.en || "Staff Housing Operations Report");

  const now = new Date();
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

  // Dynamic font sizing & padding to guarantee zero-overflow fit on A4
  let baseFontSizePt = 8.5;
  let printFontSizePt = 8.0;
  let cellPadding = "5px 7px";
  let printPadding = "3.5px 5px";

  if (colCount >= 14) {
    baseFontSizePt = 6.8;
    printFontSizePt = 5.8;
    cellPadding = "2.5px 3.5px";
    printPadding = "2px 3px";
  } else if (colCount >= 11) {
    baseFontSizePt = 7.4;
    printFontSizePt = 6.5;
    cellPadding = "3px 4.5px";
    printPadding = "2.5px 4px";
  } else if (colCount >= 8) {
    baseFontSizePt = 8.0;
    printFontSizePt = 7.2;
    cellPadding = "4px 6px";
    printPadding = "3px 4.5px";
  }

  // KPI Summary Cards
  const kpiCards: ReportKpiCard[] =
    opts.kpiCards && opts.kpiCards.length > 0
      ? opts.kpiCards
      : generateAutoKpis(activeTab, rows as Record<string, any>[], isArabic);

  // Generate KPI Cards HTML
  const kpisHtml = kpiCards.length > 0
    ? `<div class="kpi-grid" style="grid-template-columns: repeat(${Math.min(kpiCards.length, 6)}, 1fr);">
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

  // Generate Table HTML
  const theadHtml = `
    <thead>
      <tr>
        <th style="width: 32px; text-align: center;">#</th>
        ${headers
          .map((h) => {
            return `<th>${h}</th>`;
          })
          .join("")}
      </tr>
    </thead>
  `;

  const tbodyHtml = `
    <tbody>
      ${tableRows.length > 0
        ? tableRows
            .map((row, idx) => {
              return `
                <tr>
                  <td style="text-align: center; font-weight: 700; color: #64748b;">${idx + 1}</td>
                  ${row
                    .map((cell) => {
                      const formatted = formatStatusBadgeHtml(cell, isArabic);
                      const isNum = typeof cell === "number" || (!isNaN(Number(cell)) && cell !== "" && cell !== null && !String(cell).includes("-") && !String(cell).includes("/"));
                      const alignStyle = isNum ? "text-align: center;" : "";
                      return `<td style="${alignStyle}">${formatted}</td>`;
                    })
                    .join("")}
                </tr>
              `;
            })
            .join("")
        : `<tr><td colspan="${headers.length + 1}" style="text-align:center; padding:24px; color:#94a3b8;">${isArabic ? "لا توجد سجلات مطابقة للعرض" : "No records found matching criteria"}</td></tr>`
      }
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

  // Build Metadata Badges
  const metaBadges = [
    `📅 ${issueDateFormatted}`,
    `🏨 ${propName}`,
    `📊 ${rows.length} ${isArabic ? "سجل" : "records"}`,
    dateFrom ? `${isArabic ? "من" : "From"}: ${dateFrom}` : "",
    dateTo ? `${isArabic ? "إلى" : "To"}: ${dateTo}` : "",
    search ? `🔍 "${search}"` : "",
  ].filter(Boolean);

  // Complete HTML Document
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
    :root {
      --primary: #0f2a44;
      --primary-light: #1b3d60;
      --gold: #c9a24d;
      --gold-light: #dfbe73;
      --gold-dark: #a88233;
      --bg-page: #f8fafc;
      --text-main: #0f172a;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }

    * { margin: 0; padding: 0; box-sizing: border-box; }

    body {
      font-family: 'Cairo', -apple-system, BlinkMacSystemFont, 'Segoe UI', Tahoma, Arial, sans-serif;
      direction: ${dir};
      background: var(--bg-page);
      color: var(--text-main);
      font-size: 8.5pt;
      line-height: 1.4;
      -webkit-font-smoothing: antialiased;
    }

    /* Floating Interactive Preview Bar */
    .preview-actions-bar {
      position: sticky;
      top: 0;
      z-index: 9999;
      background: var(--primary);
      color: #ffffff;
      padding: 10px 24px;
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
      gap: 6px;
    }
    .bar-meta {
      font-size: 8pt;
      color: var(--gold-light);
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
      padding: 7px 16px;
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
      background: linear-gradient(135deg, #c9a24d 0%, #b38e3c 100%);
      color: #0f2a44;
      border: 1px solid #e0be6c;
    }
    .btn-primary:hover {
      background: linear-gradient(135deg, #dfbe73 0%, #c9a24d 100%);
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
    }
    .sheet {
      width: ${orientation === "landscape" ? "297mm" : "210mm"};
      min-height: ${orientation === "landscape" ? "210mm" : "297mm"};
      background: #ffffff;
      padding: 12mm 14mm;
      box-shadow: 0 8px 30px rgba(0,0,0,0.07);
      border-radius: 6px;
      position: relative;
    }

    /* Header */
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }
    .logo-container img {
      max-height: 44px;
      max-width: 140px;
      object-fit: contain;
    }
    .brand-fallback {
      font-weight: 900;
      color: var(--primary);
      font-size: 13pt;
      letter-spacing: 0.5px;
      display: flex;
      align-items: center;
      gap: 8px;
    }
    .brand-fallback-badge {
      font-size: 7.5pt;
      color: var(--gold-dark);
      border-inline-start: 2px solid var(--gold);
      padding-inline-start: 8px;
      font-weight: 700;
      line-height: 1.2;
    }

    .gold-divider {
      height: 2.5px;
      background: linear-gradient(90deg, #c9a24d 0%, #0f2a44 50%, #c9a24d 100%);
      border: none;
      margin: 8px 0 12px;
      border-radius: 2px;
    }

    .title-box {
      text-align: center;
      margin-bottom: 12px;
    }
    .report-title {
      font-size: 15pt;
      font-weight: 900;
      color: var(--primary);
      margin-bottom: 4px;
    }
    .report-subtitle {
      font-size: 8.5pt;
      color: var(--text-muted);
      font-weight: 600;
    }

    /* Metadata Badge Bar */
    .meta-bar {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 6px;
      margin-bottom: 14px;
    }
    .meta-chip {
      background: #f1f5f9;
      border: 1px solid #e2e8f0;
      padding: 3px 10px;
      border-radius: 20px;
      font-size: 7.5pt;
      font-weight: 600;
      color: #334155;
      display: inline-flex;
      align-items: center;
      gap: 4px;
    }

    /* KPI Summary Cards */
    .kpi-grid {
      display: grid;
      gap: 10px;
      margin-bottom: 16px;
      page-break-inside: avoid;
    }
    .kpi-card {
      padding: 10px 12px;
      border-radius: 8px;
      border: 1px solid var(--border-color);
      background: #fafbfc;
      text-align: center;
      position: relative;
      overflow: hidden;
      box-shadow: 0 1px 3px rgba(0,0,0,0.03);
    }
    .kpi-card::before {
      content: '';
      position: absolute;
      top: 0; left: 0; right: 0;
      height: 3.5px;
      background: var(--gold);
    }
    .kpi-card.green::before { background: #10b981; }
    .kpi-card.blue::before { background: #2563eb; }
    .kpi-card.orange::before { background: #ea580c; }
    .kpi-card.red::before { background: #ef4444; }
    .kpi-card.purple::before { background: #8b5cf6; }
    .kpi-card.slate::before { background: #64748b; }

    .kpi-val {
      font-size: 16pt;
      font-weight: 900;
      line-height: 1.1;
      margin-top: 2px;
      color: var(--primary);
    }
    .kpi-card.green .kpi-val { color: #047857; }
    .kpi-card.blue .kpi-val { color: #1d4ed8; }
    .kpi-card.orange .kpi-val { color: #c2410c; }
    .kpi-card.red .kpi-val { color: #dc2626; }
    .kpi-card.gold .kpi-val { color: var(--gold-dark); }

    .kpi-label {
      font-size: 7.5pt;
      font-weight: 700;
      color: var(--text-muted);
      margin-top: 3px;
    }
    .kpi-subtext {
      font-size: 6.8pt;
      font-weight: 600;
      color: #94a3b8;
      margin-top: 2px;
    }

    /* Data Table */
    table {
      width: 100% !important;
      max-width: 100% !important;
      border-collapse: collapse;
      margin-bottom: 16px;
      font-size: ${baseFontSizePt}pt;
      table-layout: auto !important;
      word-break: break-word !important;
      overflow-wrap: break-word !important;
    }
    th, td {
      border: 1px solid #cbd5e1;
      padding: ${cellPadding};
      text-align: ${dir === "rtl" ? "right" : "left"};
      word-break: break-word !important;
      overflow-wrap: break-word !important;
      white-space: normal !important;
      vertical-align: middle;
      line-height: 1.25;
    }
    th {
      background: var(--primary);
      color: #ffffff;
      font-weight: 800;
      font-size: ${baseFontSizePt}pt;
      letter-spacing: 0.1px;
      border-color: #0f2a44;
      white-space: normal !important;
    }
    tr:nth-child(even) td {
      background: #f8fafc;
    }
    tr:hover td {
      background: #f1f5f9;
    }

    /* Badges */
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 2px 7px;
      border-radius: 12px;
      font-size: 7.2pt;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
    }
    .badge-dot {
      width: 5px;
      height: 5px;
      border-radius: 50%;
      display: inline-block;
    }
    .badge-green { background: #dcfce7; color: #15803d; border: 1px solid #bbf7d0; }
    .badge-red { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }
    .badge-blue { background: #dbeafe; color: #1d4ed8; border: 1px solid #bfdbfe; }
    .badge-orange { background: #fef3c7; color: #b45309; border: 1px solid #fde68a; }
    .badge-slate { background: #f1f5f9; color: #475569; border: 1px solid #e2e8f0; }

    /* Signatures Block */
    .sig-section {
      margin-top: 20px;
      padding-top: 14px;
      border-top: 1.5px dashed #cbd5e1;
      page-break-inside: avoid;
    }
    .sig-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 16px;
    }
    .sig-card {
      border: 1px solid var(--border-color);
      border-radius: 8px;
      padding: 10px 12px;
      background: #fafbfc;
      text-align: center;
    }
    .sig-role {
      font-weight: 800;
      font-size: 8pt;
      color: var(--primary);
      margin-bottom: 24px;
    }
    .sig-line {
      border-top: 1px dashed #94a3b8;
      margin: 0 12px 6px;
    }
    .sig-date {
      font-size: 7pt;
      color: var(--text-muted);
    }

    /* Footer */
    .foot {
      display: flex;
      justify-content: space-between;
      align-items: center;
      font-size: 7pt;
      color: #94a3b8;
      margin-top: 16px;
      padding-top: 8px;
      border-top: 1px solid #e2e8f0;
    }
    .foot-cert {
      font-weight: 700;
      color: var(--gold-dark);
      display: flex;
      align-items: center;
      gap: 4px;
    }

    /* Print Specific Media Styles */
    @media print {
      @page {
        size: A4 ${orientation};
        margin: 4mm 6mm !important;
      }
      html, body {
        width: 100% !important;
        background: #ffffff !important;
        font-size: ${printFontSizePt}pt !important;
        margin: 0 !important;
        padding: 0 !important;
      }
      .preview-actions-bar { display: none !important; }
      .sheet-wrapper { padding: 0 !important; margin: 0 !important; width: 100% !important; }
      .sheet {
        box-shadow: none !important;
        margin: 0 !important;
        padding: 4mm 6mm !important;
        width: 100% !important;
        max-width: 100% !important;
        min-height: auto !important;
        border-radius: 0 !important;
      }
      table {
        width: 100% !important;
        max-width: 100% !important;
        table-layout: auto !important;
        font-size: ${printFontSizePt}pt !important;
      }
      th, td {
        font-size: ${printFontSizePt}pt !important;
        padding: ${printPadding} !important;
        word-break: break-word !important;
        overflow-wrap: break-word !important;
        white-space: normal !important;
      }
      th {
        background: #0f2a44 !important;
        color: #ffffff !important;
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
      .badge {
        white-space: normal !important;
        word-break: break-word !important;
        font-size: calc(${printFontSizePt}pt - 0.5pt) !important;
        padding: 1px 4px !important;
      }
      .badge-green { background: #dcfce7 !important; color: #15803d !important; -webkit-print-color-adjust: exact !important; }
      .badge-red { background: #fee2e2 !important; color: #b91c1c !important; -webkit-print-color-adjust: exact !important; }
      .badge-blue { background: #dbeafe !important; color: #1d4ed8 !important; -webkit-print-color-adjust: exact !important; }
      .badge-orange { background: #fef3c7 !important; color: #b45309 !important; -webkit-print-color-adjust: exact !important; }
      .kpi-card { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      tr:nth-child(even) td { background: #f8fafc !important; -webkit-print-color-adjust: exact !important; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
    }
  </style>
</head>
<body>

  <!-- Floating Preview Actions Bar -->
  <div class="preview-actions-bar">
    <div class="bar-left">
      <div class="bar-title">
        <span>👑</span>
        <span>${reportTitle}</span>
      </div>
      <div class="bar-meta">${propName} · ${rows.length} ${isArabic ? "سجل" : "records"} · <span id="metaOrient">${orientation === "landscape" ? (isArabic ? "أفقي (Landscape)" : "Landscape") : (isArabic ? "رأسي (Portrait)" : "Portrait")}</span></div>
    </div>
    <div class="bar-actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ ${isArabic ? "طباعة / حفظ كـ PDF" : "Print / Save as PDF"}</button>
      <button class="btn btn-outline" id="orientBtn" onclick="toggleOrientation()">📄 ${isArabic ? (orientation === "landscape" ? "أفقي (انقر للرأسي)" : "رأسي (انقر للأفقي)") : (orientation === "landscape" ? "Landscape (Click for Portrait)" : "Portrait (Click for Landscape)")}</button>
      <button class="btn btn-close" onclick="window.close()">❌ ${isArabic ? "إغلاق" : "Close"}</button>
    </div>
  </div>

  <div class="sheet-wrapper">
    <div class="sheet" id="printSheet">
      <!-- Header: Dual Logo -->
      <div class="header">
        <div class="logo-container">
          ${propLogo
            ? `<img src="${propLogo.dataUrl}" alt="شعار الفرع" />`
            : `<div class="brand-fallback">
                <span>SUNRISE</span>
                <span class="brand-fallback-badge">${propName.toUpperCase()}</span>
               </div>`
          }
        </div>
        <div class="logo-container">
          ${sysLogo
            ? `<img src="${sysLogo.dataUrl}" alt="شعار النظام" />`
            : `<div class="brand-fallback">
                <span>RESORTS & CRUISES</span>
                <span class="brand-fallback-badge">STAFF HOUSING</span>
               </div>`
          }
        </div>
      </div>

      <hr class="gold-divider" />

      <!-- Title & Subtitle -->
      <div class="title-box">
        <h1 class="report-title">${reportTitle}</h1>
        <div class="report-subtitle">
          ${isArabic
            ? `الفرع: <strong>${propName}</strong> ${propAddress ? `(${propAddress})` : ""} · تصنيف الوثيقة: تقرير عمليات معتمد`
            : `Property: <strong>${propName}</strong> ${propAddress ? `(${propAddress})` : ""} · Certified Operations Document`}
        </div>
      </div>

      <!-- Metadata Chips -->
      <div class="meta-bar">
        ${metaBadges.map((badge) => `<div class="meta-chip">${badge}</div>`).join("")}
      </div>

      <!-- Top KPI Summary Cards -->
      ${kpisHtml}

      <!-- Custom Injected Sections if any -->
      ${customSectionsHtml || ""}

      <!-- Main Data Table -->
      <table>
        ${theadHtml}
        ${tbodyHtml}
      </table>

      <!-- Multi-Tier Official Signatures Block -->
      <div class="sig-section">
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

      <!-- Footer -->
      <div class="foot">
        <div>${isArabic ? "تاريخ الإصدار والطباعة:" : "Issue Date & Time:"} ${issueDateFormatted}</div>
        <div class="foot-cert">
          <span>🛡️</span>
          <span>${isArabic ? "نظام إدارة سكن العاملين — وثيقة تشغيلية رسمية معتمدة" : "Sunrise Staff Housing Management System — Official Certified Document"}</span>
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
        sheet.style.minHeight = "297mm";
        if (orientBtn) orientBtn.innerHTML = "📄 ${isArabic ? 'رأسي (انقر للأفقي)' : 'Portrait (Click for Landscape)'}";
        if (metaOrient) metaOrient.innerHTML = "${isArabic ? 'رأسي (Portrait)' : 'Portrait'}";
      } else {
        sheet.style.width = "297mm";
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

  // Open Preview Window
  const printWindow = window.open("", "_blank", "width=1200,height=900,menubar=no,toolbar=no,status=no");
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
