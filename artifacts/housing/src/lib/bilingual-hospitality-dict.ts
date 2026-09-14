/**
 * Bilingual Hospitality Dictionary
 * Standard Arabic & English mappings for Hotel Departments and Job Titles.
 */

export interface TranslationItem {
  en: string;
  ar: string;
}

export const HOSPITALITY_DEPARTMENTS: TranslationItem[] = [
  { en: "Front Office", ar: "المكاتب الأمامية" },
  { en: "Housekeeping", ar: "الإشراف الداخلي" },
  { en: "Food & Beverage", ar: "الأغذية والمشروبات" },
  { en: "F&B", ar: "الأغذية والمشروبات" },
  { en: "Kitchen", ar: "المطبخ" },
  { en: "Culinary", ar: "المطبخ والطهي" },
  { en: "Stewarding", ar: "الستيوارد" },
  { en: "Engineering", ar: "الهندسة والصيانة" },
  { en: "Maintenance", ar: "الصيانة العامة" },
  { en: "Security", ar: "الأمن والحراسة" },
  { en: "Human Resources", ar: "الموارد البشرية" },
  { en: "HR", ar: "الموارد البشرية" },
  { en: "Finance", ar: "المالية والحسابات" },
  { en: "Accounting", ar: "الحسابات" },
  { en: "Purchasing", ar: "المشتريات والمخازن" },
  { en: "Stores", ar: "المخازن" },
  { en: "Sales & Marketing", ar: "المبيعات والتسويق" },
  { en: "IT", ar: "تكنولوجيا المعلومات" },
  { en: "Information Technology", ar: "تكنولوجيا المعلومات" },
  { en: "Recreation", ar: "الترفيه والأنشطة" },
  { en: "Spa & Wellness", ar: "النادي الصحي والسبا" },
  { en: "Laundry", ar: "المغسلة" },
  { en: "Transportation", ar: "الحركة والنقل" },
  { en: "Drivers", ar: "السائقين" },
  { en: "Executive Office", ar: "المكتب التنفيذي والإدارة العامة" },
  { en: "Administration", ar: "الإدارة العامة" },
  { en: "Gardening", ar: "الزراعة والحدائق" },
  { en: "Staff Housing", ar: "سكن الموظفين" },
  { en: "Housing Management", ar: "إدارة السكن" },
  { en: "Third Party", ar: "طرف ثالث" },
  { en: "Contractors", ar: "مقاولين وشركات خارجية" },
];

export const HOSPITALITY_JOB_TITLES: TranslationItem[] = [
  // Executive & Management
  { en: "General Manager", ar: "المدير العام" },
  { en: "Hotel Manager", ar: "مدير الفندق" },
  { en: "Resident Manager", ar: "مدير الفندق المقيم" },
  { en: "Assistant General Manager", ar: "مساعد المدير العام" },
  { en: "Director of Operations", ar: "مدير العمليات" },
  { en: "Director of HR", ar: "مدير الموارد البشرية" },
  { en: "HR Manager", ar: "مدير الموارد البشرية" },
  { en: "HR Officer", ar: "مسؤول موارد بشرية" },
  { en: "HR Coordinator", ar: "منسق موارد بشرية" },
  { en: "Personnel Officer", ar: "مسؤول شؤون العاملين" },
  { en: "Training Manager", ar: "مدير التدريب" },
  { en: "Housing Manager", ar: "مدير سكن العاملين" },
  { en: "Housing Supervisor", ar: "مشرف سكن العاملين" },
  { en: "Housing Attendant", ar: "عامل سكن العاملين" },

  // Front Office
  { en: "Front Office Manager", ar: "مدير المكاتب الأمامية" },
  { en: "Assistant Front Office Manager", ar: "مساعد مدير المكاتب الأمامية" },
  { en: "Front Desk Supervisor", ar: "مشرف استقبال" },
  { en: "Front Desk Agent", ar: "موظف استقبال" },
  { en: "Receptionist", ar: "موظف استقبال" },
  { en: "Night Auditor", ar: "مراجع ليلي" },
  { en: "Night Manager", ar: "مدير الفترة الليلية" },
  { en: "Duty Manager", ar: "المدير المناوب" },
  { en: "Concierge", ar: "كونسيرج" },
  { en: "Bell Captain", ar: "رئيس حاملي الحقائب" },
  { en: "Bellman", ar: "حامل حقائب" },
  { en: "Doorman", ar: "بواب" },
  { en: "Guest Relations Manager", ar: "مدير علاقات النزلاء" },
  { en: "Guest Relations Officer", ar: "مسؤول علاقات النزلاء" },
  { en: "Telephone Operator", ar: "موظف سنترال" },

  // Housekeeping
  { en: "Executive Housekeeper", ar: "مدير الإشراف الداخلي" },
  { en: "Assistant Executive Housekeeper", ar: "مساعد مدير الإشراف الداخلي" },
  { en: "Housekeeping Supervisor", ar: "مشرف إشراف داخلي" },
  { en: "Floor Supervisor", ar: "مشرف أدوار" },
  { en: "Room Attendant", ar: "عامل تجهيز غرف" },
  { en: "Public Area Supervisor", ar: "مشرف مناطق عامة" },
  { en: "Public Area Attendant", ar: "عامل مناطق عامة" },
  { en: "Linen Runner", ar: "عامل بياضات ومفروشات" },
  { en: "Order Taker", ar: "أوردر تيكر" },
  { en: "Laundry Manager", ar: "مدير المغسلة" },
  { en: "Laundry Supervisor", ar: "مشرف مغسلة" },
  { en: "Laundry Attendant", ar: "عامل مغسلة" },
  { en: "Presser", ar: "مكوجي" },
  { en: "Tailor", ar: "ترزي" },

  // Food & Beverage Service
  { en: "F&B Manager", ar: "مدير الأغذية والمشروبات" },
  { en: "Assistant F&B Manager", ar: "مساعد مدير الأغذية والمشروبات" },
  { en: "Restaurant Manager", ar: "مدير مطعم" },
  { en: "Restaurant Supervisor", ar: "مشرف مطعم" },
  { en: "Captain", ar: "كابتن صالة" },
  { en: "Waiter", ar: "مضيف / ويتر" },
  { en: "Waitress", ar: "مضيفة" },
  { en: "Server", ar: "مضيف" },
  { en: "Busboy", ar: "مساعد مضيف" },
  { en: "Bar Manager", ar: "مدير البار" },
  { en: "Bartender", ar: "بارتندر" },
  { en: "Barista", ar: "باريستا" },
  { en: "Room Service Supervisor", ar: "مشرف خدمة الغرف" },
  { en: "Room Service Waiter", ar: "مضيف خدمة الغرف" },

  // Culinary / Kitchen & Stewarding
  { en: "Executive Chef", ar: "الشيف العمومي" },
  { en: "Executive Sous Chef", ar: "مساعد الشيف العمومي" },
  { en: "Sous Chef", ar: "سوس شيف" },
  { en: "Chef de Partie", ar: "شيف دي بارتي" },
  { en: "Demi Chef de Partie", ar: "ديمي شيف دي بارتي" },
  { en: "Demi Chef", ar: "ديمي شيف" },
  { en: "Commis I", ar: "كومي أول" },
  { en: "Commis II", ar: "كومي ثان" },
  { en: "Commis III", ar: "كومي ثالث" },
  { en: "Commis", ar: "طاهي مبتدئ / كومي" },
  { en: "Cook", ar: "طباخ" },
  { en: "Pastry Chef", ar: "شيف حلواني" },
  { en: "Baker", ar: "خباز" },
  { en: "Butcher", ar: "جزار" },
  { en: "Chief Steward", ar: "رئيس قسم الستيوارد" },
  { en: "Assistant Chief Steward", ar: "مساعد رئيس قسم الستيوارد" },
  { en: "Steward Supervisor", ar: "مشرف ستيوارد" },
  { en: "Steward", ar: "عامل نظافة مطبخ / ستيوارد" },

  // Engineering & Maintenance
  { en: "Director of Engineering", ar: "مدير الإدارة الهندسية" },
  { en: "Chief Engineer", ar: "رئيس المهندسين" },
  { en: "Assistant Chief Engineer", ar: "مساعد رئيس المهندسين" },
  { en: "Maintenance Supervisor", ar: "مشرف صيانة" },
  { en: "Electrical Engineer", ar: "مهندس كهرباء" },
  { en: "Mechanical Engineer", ar: "مهندس ميكانيكا" },
  { en: "Electrician", ar: "فني كهرباء" },
  { en: "Plumber", ar: "فني سباكة" },
  { en: "HVAC Technician", ar: "فني تبريد وتكييف" },
  { en: "AC Technician", ar: "فني تكييف وتبريد" },
  { en: "Carpenter", ar: "فني نجارة" },
  { en: "Painter", ar: "فني نقاشة" },
  { en: "Mason", ar: "فني بناء ومحارة" },
  { en: "Boiler Technician", ar: "فني غلايات" },
  { en: "Kitchen Technician", ar: "فني معدات مطابخ" },
  { en: "General Technician", ar: "فني صيانة عامة" },

  // Security & Safety
  { en: "Director of Security", ar: "مدير قطاع الأمن" },
  { en: "Security Manager", ar: "مدير الأمن" },
  { en: "Security Supervisor", ar: "مشرف أمن" },
  { en: "Security Officer", ar: "فرد أمن" },
  { en: "Security Guard", ar: "حارس أمن" },
  { en: "CCTV Operator", ar: "مشغل كاميرات مراقبة" },
  { en: "Safety Officer", ar: "مسؤول السلامة والصحة المهنية" },
  { en: "Fire Officer", ar: "مسؤول الحريق والطوارئ" },

  // Recreation, Pool & Beach
  { en: "Recreation Manager", ar: "مدير الترفيه والأنشطة" },
  { en: "Lifeguard", ar: "منقذ شاطئ ومسبح" },
  { en: "Pool Attendant", ar: "عامل حمام سباحة" },
  { en: "Fitness Instructor", ar: "مدرب لياقة بدنية" },
  { en: "Massage Therapist", ar: "أخصائي مساج وتدليك" },

  // Finance, Accounting & Stores
  { en: "Financial Controller", ar: "المدير المالي" },
  { en: "Director of Finance", ar: "مدير الإدارة المالية" },
  { en: "Chief Accountant", ar: "رئيس الحسابات" },
  { en: "General Accountant", ar: "محاسب عام" },
  { en: "Income Auditor", ar: "مراجع إيرادات" },
  { en: "Accounts Payable", ar: "محاسب موردين" },
  { en: "Accounts Receivable", ar: "محاسب عملاء" },
  { en: "Paymaster", ar: "محاسب رواتب" },
  { en: "Cost Controller", ar: "مراقب تكاليف" },
  { en: "General Cashier", ar: "أمين الخزينة العامة" },
  { en: "Cashier", ar: "أمين صندوق / كاشير" },
  { en: "Purchasing Manager", ar: "مدير المشتريات" },
  { en: "Purchasing Officer", ar: "مسؤول مشتريات" },
  { en: "Storekeeper", ar: "أمين مخزن" },
  { en: "Receiving Clerk", ar: "أمين استلام بضائع" },

  // IT & Systems
  { en: "IT Manager", ar: "مدير تكنولوجيا المعلومات" },
  { en: "IT Officer", ar: "مسؤول تكنولوجيا المعلومات" },
  { en: "IT Specialist", ar: "أخصائي نظم معلومات" },
  { en: "Network Engineer", ar: "مهندس شبكات" },

  // Transportation
  { en: "Transportation Manager", ar: "مدير النقل والحركة" },
  { en: "Head Driver", ar: "سائق أول / مسؤول الحركة" },
  { en: "Driver", ar: "سائق" },
  { en: "Bus Driver", ar: "سائق حافلة" },
];

// Helper maps for O(1) lookup
const DEPT_MAP_EN_TO_AR = new Map<string, string>();
const DEPT_MAP_AR_TO_EN = new Map<string, string>();
for (const item of HOSPITALITY_DEPARTMENTS) {
  DEPT_MAP_EN_TO_AR.set(item.en.toLowerCase().trim(), item.ar);
  DEPT_MAP_AR_TO_EN.set(item.ar.trim(), item.en);
}

const TITLE_MAP_EN_TO_AR = new Map<string, string>();
const TITLE_MAP_AR_TO_EN = new Map<string, string>();
for (const item of HOSPITALITY_JOB_TITLES) {
  TITLE_MAP_EN_TO_AR.set(item.en.toLowerCase().trim(), item.ar);
  TITLE_MAP_AR_TO_EN.set(item.ar.trim(), item.en);
}

/**
 * Translate Department between Arabic and English
 */
export function translateDepartment(dept: string | null | undefined, targetLang: "ar" | "en"): string {
  if (!dept || !dept.trim()) return "";
  const cleaned = dept.trim();

  if (targetLang === "ar") {
    const match = DEPT_MAP_EN_TO_AR.get(cleaned.toLowerCase());
    if (match) return match;
    // Partial search
    for (const [en, ar] of DEPT_MAP_EN_TO_AR.entries()) {
      if (cleaned.toLowerCase().includes(en)) return ar;
    }
    return cleaned; // fallback to original
  } else {
    const match = DEPT_MAP_AR_TO_EN.get(cleaned);
    if (match) return match;
    // Partial search
    for (const [ar, en] of DEPT_MAP_AR_TO_EN.entries()) {
      if (cleaned.includes(ar)) return en;
    }
    return cleaned; // fallback to original
  }
}

/**
 * Translate Job Title between Arabic and English
 */
export function translateJobTitle(title: string | null | undefined, targetLang: "ar" | "en"): string {
  if (!title || !title.trim()) return "";
  const cleaned = title.trim();

  if (targetLang === "ar") {
    const match = TITLE_MAP_EN_TO_AR.get(cleaned.toLowerCase());
    if (match) return match;
    for (const [en, ar] of TITLE_MAP_EN_TO_AR.entries()) {
      if (cleaned.toLowerCase().includes(en)) return ar;
    }
    return cleaned;
  } else {
    const match = TITLE_MAP_AR_TO_EN.get(cleaned);
    if (match) return match;
    for (const [ar, en] of TITLE_MAP_AR_TO_EN.entries()) {
      if (cleaned.includes(ar)) return en;
    }
    return cleaned;
  }
}
