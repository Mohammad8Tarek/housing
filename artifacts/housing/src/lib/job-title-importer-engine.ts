/**
 * Job Titles & Departments Importer Engine
 * Handles template generation and intelligent parsing of Excel/CSV files
 * containing Departments, Job Titles, and Job Title Levels with
 * Create / Update / Duplicate-Skip detection.
 */

import * as XLSX from "xlsx";

export type RowAction = "create" | "update" | "duplicate_skip" | "invalid";

export interface ParsedJobTitleRow {
  index: number;
  category?: string;
  department: string;
  jobTitle: string;
  valueEn?: string;
  valueAr?: string;
  parentValue?: string;
  extraValue?: string;
  capacity?: number;
  level: string;
  action: RowAction;
  existingLevel?: string;
  status: "valid" | "warning" | "invalid";
  issues: string[];
}

export interface ParseResult {
  rows: ParsedJobTitleRow[];
  totalRows: number;
  validCount: number;
  createCount: number;
  updateCount: number;
  duplicateCount: number;
  invalidCount: number;
  departments: string[];
  newDepartmentsCount: number;
  jobTitlesCount: number;
  headers: string[];
  filename: string;
}

// Canonical Column Keys
const DEPT_ALIASES = [
  "department",
  "dept",
  "department name",
  "dept name",
  "division",
  "القسم",
  "قسم",
  "إدارة",
  "الادارة",
  "الإدارة",
  "اسم القسم",
];

const TITLE_ALIASES = [
  "job title",
  "jobtitle",
  "title",
  "position",
  "job_title",
  "role",
  "designation",
  "المسمى الوظيفي",
  "المسمى",
  "الوظيفة",
  "المهنة",
  "اسم الوظيفة",
  "value",
  "الاسم",
  "القيمة",
  "البيان",
];

const LEVEL_ALIASES = [
  "level",
  "grade",
  "rank",
  "job level",
  "job_level",
  "band",
  "seniority",
  "الدرجة",
  "المستوى",
  "الدرجة الوظيفية",
  "المستوى الوظيفي",
  "الرتبة",
  "الفئة",
];

const TITLE_EN_ALIASES = [
  "job title (en)",
  "job title en",
  "job title english",
  "title en",
  "title english",
  "english title",
  "value en",
  "value (en)",
  "name en",
  "name (en)",
  "المسمى بالانجليزي",
  "المسمى بالإنجليزية",
  "الوظيفة بالانجليزي",
  "اسم الوظيفة بالانجليزي",
  "المسمى الوظيفي بالانجليزية",
  "الاسم بالانجليزي",
  "الاسم بالإنجليزية",
  "القيمة بالانجليزي",
  "القيمة بالإنجليزية",
  "classification en",
  "type en",
  "room type en",
  "bed type en",
  "view en",
];

const TITLE_AR_ALIASES = [
  "job title (ar)",
  "job title ar",
  "job title arabic",
  "title ar",
  "title arabic",
  "arabic title",
  "value ar",
  "value (ar)",
  "name ar",
  "name (ar)",
  "المسمى بالعربي",
  "المسمى بالعربية",
  "الوظيفة بالعربي",
  "اسم الوظيفة بالعربي",
  "المسمى الوظيفي بالعربية",
  "الاسم بالعربي",
  "الاسم بالعربية",
  "القيمة بالعربي",
  "القيمة بالعربية",
  "classification ar",
  "type ar",
  "room type ar",
  "bed type ar",
  "view ar",
];

const DEPT_EN_ALIASES = [
  "department (en)",
  "department en",
  "department english",
  "dept en",
  "dept english",
  "القسم بالانجليزي",
  "القسم بالإنجليزية",
  "اسم القسم بالانجليزي",
];

const DEPT_AR_ALIASES = [
  "department (ar)",
  "department ar",
  "department arabic",
  "dept ar",
  "dept arabic",
  "القسم بالعربي",
  "القسم بالعربية",
  "اسم القسم بالعربي",
];

const CAPACITY_ALIASES = [
  "capacity",
  "cap",
  "max capacity",
  "max occ",
  "max. occ.",
  "max occupancy",
  "occupancy",
  "beds count",
  "bed count",
  "السعة",
  "سعة",
  "أقصى سعة",
  "سعة الاستيعاب",
  "سعة الغرفة",
  "عدد الأسرة",
  "عدد الاسرة",
];

export const hasArabic = (text: string | null | undefined): boolean => {
  return /[\u0600-\u06FF]/.test(String(text || ""));
};

/**
 * Generates and triggers instant download of the Excel/CSV template for ANY lookup category
 */
export function downloadLookupTemplate(
  category: string = "job_title",
  format: "xlsx" | "csv" = "xlsx",
  language: "ar" | "en" = "ar"
) {
  const ar = language === "ar";
  const wb = XLSX.utils.book_new();

  if (category === "department") {
    const colDeptEn = ar ? "القسم بالإنجليزية (Department EN)" : "Department (EN)";
    const colDeptAr = ar ? "القسم بالعربية (Department AR)" : "Department (AR)";
    const sampleData = [
      { [colDeptEn]: "Front Office", [colDeptAr]: "المكاتب الأمامية" },
      { [colDeptEn]: "Housekeeping", [colDeptAr]: "الإشراف الداخلي" },
      { [colDeptEn]: "Food & Beverage", [colDeptAr]: "الأغذية والمشروبات" },
      { [colDeptEn]: "Kitchen", [colDeptAr]: "المطبخ" },
      { [colDeptEn]: "Engineering", [colDeptAr]: "الهندسة والصيانة" },
      { [colDeptEn]: "Human Resources", [colDeptAr]: "الموارد البشرية" },
      { [colDeptEn]: "Security", [colDeptAr]: "الأمن" },
      { [colDeptEn]: "Finance & Accounting", [colDeptAr]: "المالية والحسابات" },
      { [colDeptEn]: "General Management", [colDeptAr]: "الإدارة العامة" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 35 }, { wch: 35 }];
    XLSX.utils.book_append_sheet(wb, ws, ar ? "الأقسام" : "Departments");
    const filename = format === "csv" ? "departments_template.csv" : "departments_template.xlsx";
    XLSX.writeFile(wb, filename, { bookType: format });
    return;
  }

  if (category === "room_classification") {
    const colEn = ar ? "تصنيف الغرفة بالإنجليزية (Classification EN)" : "Classification (EN)";
    const colAr = ar ? "تصنيف الغرفة بالعربية (Classification AR)" : "Classification (AR)";
    const colTier = ar ? "المستوى المستهدف (Target Tier / Level)" : "Target Level";
    const sampleData = [
      { [colEn]: "Standard", [colAr]: "قياسية", [colTier]: "Staff" },
      { [colEn]: "Deluxe", [colAr]: "ديلوكس", [colTier]: "Supervisor" },
      { [colEn]: "Superior", [colAr]: "سوبيريور", [colTier]: "Management" },
      { [colEn]: "Family Suite", [colAr]: "جناح عائلي", [colTier]: "Families" },
      { [colEn]: "Executive Suite", [colAr]: "جناح تنفيذي", [colTier]: "Executives" },
      { [colEn]: "VIP", [colAr]: "كبار الشخصيات VIP", [colTier]: "VIP Guests" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 35 }, { wch: 35 }, { wch: 25 }];
    XLSX.utils.book_append_sheet(wb, ws, ar ? "تصنيفات الغرف" : "Room Classifications");
    const filename = format === "csv" ? "room_classifications_template.csv" : "room_classifications_template.xlsx";
    XLSX.writeFile(wb, filename, { bookType: format });
    return;
  }

  if (category === "room_type") {
    const colEn = ar ? "نوع الغرفة بالإنجليزية (Room Type EN)" : "Room Type (EN)";
    const colAr = ar ? "نوع الغرفة بالعربية (Room Type AR)" : "Room Type (AR)";
    const colCap = ar ? "أقصى سعة أسرة (Capacity)" : "Capacity";
    const sampleData = [
      { [colEn]: "Single Room", [colAr]: "غرفة مفردة", [colCap]: 1 },
      { [colEn]: "Double Room", [colAr]: "غرفة مزدوجة", [colCap]: 2 },
      { [colEn]: "Triple Room", [colAr]: "غرفة ثلاثية", [colCap]: 3 },
      { [colEn]: "Quad Room", [colAr]: "غرفة رباعية", [colCap]: 4 },
      { [colEn]: "Suite", [colAr]: "جناح", [colCap]: 2 },
      { [colEn]: "Studio", [colAr]: "ستوديو", [colCap]: 1 },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 30 }, { wch: 30 }, { wch: 18 }];
    XLSX.utils.book_append_sheet(wb, ws, ar ? "أنواع الغرف" : "Room Types");
    const filename = format === "csv" ? "room_types_template.csv" : "room_types_template.xlsx";
    XLSX.writeFile(wb, filename, { bookType: format });
    return;
  }

  if (category === "bed_type") {
    const colEn = ar ? "نوع السرير بالإنجليزية (Bed Type EN)" : "Bed Type (EN)";
    const colAr = ar ? "نوع السرير بالعربية (Bed Type AR)" : "Bed Type (AR)";
    const sampleData = [
      { [colEn]: "Single Bed", [colAr]: "سرير مفرد" },
      { [colEn]: "Twin Bed", [colAr]: "سرير توأم" },
      { [colEn]: "Queen Bed", [colAr]: "سرير كوين" },
      { [colEn]: "King Bed", [colAr]: "سرير كينج" },
      { [colEn]: "Bunk Bed", [colAr]: "سرير بطابقين" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, ar ? "أنواع الأسرة" : "Bed Types");
    const filename = format === "csv" ? "bed_types_template.csv" : "bed_types_template.xlsx";
    XLSX.writeFile(wb, filename, { bookType: format });
    return;
  }

  if (category === "room_view") {
    const colEn = ar ? "إطلالة الغرفة بالإنجليزية (Room View EN)" : "Room View (EN)";
    const colAr = ar ? "إطلالة الغرفة بالعربية (Room View AR)" : "Room View (AR)";
    const sampleData = [
      { [colEn]: "Sea View", [colAr]: "إطلالة على البحر" },
      { [colEn]: "Pool View", [colAr]: "إطلالة على حمام السباحة" },
      { [colEn]: "Garden View", [colAr]: "إطلالة على الحديقة" },
      { [colEn]: "Mountain View", [colAr]: "إطلالة جبلية" },
      { [colEn]: "Back View", [colAr]: "إطلالة خلفية" },
      { [colEn]: "Tal View", [colAr]: "إطلالة على التل" },
      { [colEn]: "Street View", [colAr]: "إطلالة على الشارع" },
    ];
    const ws = XLSX.utils.json_to_sheet(sampleData);
    ws["!cols"] = [{ wch: 30 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, ws, ar ? "إطلالات الغرف" : "Room Views");
    const filename = format === "csv" ? "room_views_template.csv" : "room_views_template.xlsx";
    XLSX.writeFile(wb, filename, { bookType: format });
    return;
  }

  // Default: Job Titles Template with bilingual support
  const colDept = ar ? "القسم (Department)" : "Department";
  const colTitleEn = ar ? "المسمى بالإنجليزية (Job Title EN)" : "Job Title (EN)";
  const colTitleAr = ar ? "المسمى بالعربية (Job Title AR)" : "Job Title (AR)";
  const colLevel = ar ? "الدرجة / المستوى (Level)" : "Level";

  const sampleData = [
    {
      [colDept]: "Front Office",
      [colTitleEn]: "Receptionist",
      [colTitleAr]: "موظف استقبال",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: "Front Office",
      [colTitleEn]: "Front Desk Supervisor",
      [colTitleAr]: "مشرف استقبال",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: "Front Office",
      [colTitleEn]: "Duty Manager",
      [colTitleAr]: "مدير مناوب",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: "Housekeeping",
      [colTitleEn]: "Room Attendant",
      [colTitleAr]: "مشرف غرف",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: "Housekeeping",
      [colTitleEn]: "Housekeeping Supervisor",
      [colTitleAr]: "مشرف قطاع",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: "Housekeeping",
      [colTitleEn]: "Executive Housekeeper",
      [colTitleAr]: "مدير الإشراف الداخلي",
      [colLevel]: "Level 4",
    },
    {
      [colDept]: "Food & Beverage",
      [colTitleEn]: "Waiter",
      [colTitleAr]: "مضيف",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: "Food & Beverage",
      [colTitleEn]: "F&B Captain",
      [colTitleAr]: "كابتن صالة",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: "Food & Beverage",
      [colTitleEn]: "Restaurant Manager",
      [colTitleAr]: "مدير مطعم",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: "Kitchen",
      [colTitleEn]: "Demi Chef de Partie",
      [colTitleAr]: "مساعد شيف",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: "Kitchen",
      [colTitleEn]: "Chef de Partie",
      [colTitleAr]: "شيف قسم",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: "Kitchen",
      [colTitleEn]: "Executive Chef",
      [colTitleAr]: "شيف تنفيذي",
      [colLevel]: "Level 4",
    },
    {
      [colDept]: "Engineering",
      [colTitleEn]: "Maintenance Technician",
      [colTitleAr]: "فني صيانة",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: "Engineering",
      [colTitleEn]: "Duty Engineer",
      [colTitleAr]: "مهندس مناوب",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: "Human Resources",
      [colTitleEn]: "HR Coordinator",
      [colTitleAr]: "منسق موارد بشرية",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: "Human Resources",
      [colTitleEn]: "HR Specialist",
      [colTitleAr]: "أخصائي موارد بشرية",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: "Security",
      [colTitleEn]: "Security Officer",
      [colTitleAr]: "فرد أمن",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: "General Management",
      [colTitleEn]: "General Manager",
      [colTitleAr]: "المدير العام",
      [colLevel]: "Executive",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);
  ws["!cols"] = [{ wch: 30 }, { wch: 35 }, { wch: 35 }, { wch: 20 }];
  const sheetName = ar ? "المسميات والأقسام" : "Departments & Job Titles";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const filename =
    format === "csv"
      ? (ar ? "نموذج_استيراد_المسميات_والاقسام.csv" : "job_titles_template.csv")
      : (ar ? "نموذج_استيراد_المسميات_والاقسام.xlsx" : "job_titles_template.xlsx");

  XLSX.writeFile(wb, filename, { bookType: format });
}

/**
 * Backward compatibility alias for downloadLookupTemplate("job_title", format, language)
 */
export function downloadJobTitlesTemplate(format: "xlsx" | "csv" = "xlsx", language: "ar" | "en" = "ar") {
  return downloadLookupTemplate("job_title", format, language);
}
/**
 * Intelligently identifies matching column in a row object
 */
function findValueByAliases(row: Record<string, any>, aliases: string[]): string {
  const rowKeys = Object.keys(row);
  for (const alias of aliases) {
    const matchedKey = rowKeys.find((k) => {
      const normalizedKey = k.trim().toLowerCase();
      return (
        normalizedKey === alias ||
        normalizedKey.includes(alias) ||
        alias.includes(normalizedKey)
      );
    });
    if (matchedKey && row[matchedKey] !== undefined && row[matchedKey] !== null) {
      const val = String(row[matchedKey]).trim();
      if (val) return val;
    }
  }
  return "";
}

/**
 * Parses uploaded Excel/CSV file and analyzes rows against existing lookups
 * Handles any lookup category (job_title, department, room_classification, room_type, bed_type, room_view)
 * with bilingual EN/AR auto-detection and duplicate skipping.
 */
export async function parseJobTitlesFile(
  file: File,
  existingLookups?: {
    departments?: any[];
    jobTitles?: any[];
    lookupValues?: any[];
    category?: string;
  }
): Promise<ParseResult> {
  const buffer = await file.arrayBuffer();
  const wb = XLSX.read(buffer, { type: "array" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    throw new Error("الملف لا يحتوي على أوراق عمل (Worksheets)");
  }

  const sheet = wb.Sheets[sheetName];
  const rawRows: any[] = XLSX.utils.sheet_to_json(sheet, { defval: "" });

  if (!rawRows || rawRows.length === 0) {
    throw new Error("الملف المرفوع فارغ ولا يحتوي على بيانات");
  }

  const activeCategory = existingLookups?.category || "job_title";

  // Pre-build indexed maps of existing database lookups for instant matching
  const existingDeptSet = new Set<string>(
    (existingLookups?.departments || []).map((d) => String(d.value || "").trim().toLowerCase())
  );

  const existingJobTitleMap = new Map<string, any>();
  for (const jt of existingLookups?.jobTitles || []) {
    const titleVal = String(jt.value || "").trim().toLowerCase();
    const deptVal = String(jt.parentValue || "").trim().toLowerCase();
    existingJobTitleMap.set(`${deptVal}:::${titleVal}`, jt);
  }

  // Generic existing lookup map for other categories
  const existingLookupMap = new Map<string, any>();
  for (const item of existingLookups?.lookupValues || []) {
    const v = String(item.value || "").trim().toLowerCase();
    const vAr = String(item.valueAr || "").trim().toLowerCase();
    if (v) existingLookupMap.set(v, item);
    if (vAr) existingLookupMap.set(vAr, item);
  }

  const headers = Object.keys(rawRows[0] || {});
  const parsedRows: ParsedJobTitleRow[] = [];
  const uniqueDeptsSet = new Set<string>();
  const seenRowsInFile = new Map<string, string>(); // fileKey -> extraValue

  let createCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let newDepartmentsCount = 0;

  rawRows.forEach((row, i) => {
    // Check if entire row is empty
    const values = Object.values(row).map((v) => String(v).trim());
    if (values.every((v) => !v)) return; // skip blank row

    // Extract specific or generic column values
    let dept = findValueByAliases(row, DEPT_ALIASES);
    const deptEn = findValueByAliases(row, DEPT_EN_ALIASES);
    const deptAr = findValueByAliases(row, DEPT_AR_ALIASES);
    if (deptEn || deptAr) {
      dept = deptEn || deptAr;
    }

    let title = findValueByAliases(row, TITLE_ALIASES);
    const titleEn = findValueByAliases(row, TITLE_EN_ALIASES);
    const titleAr = findValueByAliases(row, TITLE_AR_ALIASES);
    if (titleEn || titleAr) {
      title = titleEn || titleAr;
    }

    const level = findValueByAliases(row, LEVEL_ALIASES);
    const capStr = findValueByAliases(row, CAPACITY_ALIASES);
    const capacityNum = capStr ? parseInt(capStr, 10) : undefined;

    // Resolve bilingual values
    let valueEn = titleEn || (!hasArabic(title) ? title : "");
    let valueAr = titleAr || (hasArabic(title) ? title : "");

    if (activeCategory === "department") {
      valueEn = deptEn || (!hasArabic(dept || title) ? (dept || title) : "");
      valueAr = deptAr || (hasArabic(dept || title) ? (dept || title) : "");
      title = valueEn || valueAr;
    }

    const issues: string[] = [];
    let status: "valid" | "warning" | "invalid" = "valid";
    let action: RowAction = "create";
    let existingLevel: string | undefined = undefined;

    const normDept = dept.trim().toLowerCase();
    const normTitle = title.trim().toLowerCase();
    const normExtra = (level || (capacityNum ? String(capacityNum) : "")).trim();
    const fileKey = activeCategory === "job_title" ? `${normDept}:::${normTitle}` : normTitle;

    if (!dept && !title && !valueEn && !valueAr) {
      status = "invalid";
      action = "invalid";
      invalidCount++;
      issues.push("البيانات الأساسية مفقودة في هذا الصف");
    } else if (activeCategory === "job_title" && !title && dept) {
      // Department only row in Job Titles
      if (existingDeptSet.has(normDept) || seenRowsInFile.has(`dept_only:::${normDept}`)) {
        action = "duplicate_skip";
        status = "warning";
        duplicateCount++;
        issues.push("القسم موجود مسبقاً في النظام (لن ينزل مجدداً)");
      } else {
        action = "create";
        createCount++;
        newDepartmentsCount++;
        seenRowsInFile.set(`dept_only:::${normDept}`, "");
        issues.push("قسم جديد سيتم إنشاؤه");
      }
      uniqueDeptsSet.add(dept);
    } else {
      if (activeCategory === "job_title") {
        if (dept) {
          if (!existingDeptSet.has(normDept) && !seenRowsInFile.has(`seen_dept:::${normDept}`)) {
            newDepartmentsCount++;
            seenRowsInFile.set(`seen_dept:::${normDept}`, "new");
          }
          uniqueDeptsSet.add(dept);
        } else {
          status = "warning";
          issues.push("القسم غير محدد (سيتم التسكين بدون قسم)");
        }
      }

      // Check against existing database records
      const dbMatch = activeCategory === "job_title"
        ? existingJobTitleMap.get(fileKey)
        : (existingLookupMap.get(normTitle) || (valueAr ? existingLookupMap.get(valueAr.toLowerCase()) : null));

      const prevFileLevel = seenRowsInFile.get(fileKey);

      if (prevFileLevel !== undefined) {
        // Seen earlier in the SAME file
        if (normExtra.toLowerCase() === prevFileLevel.toLowerCase()) {
          action = "duplicate_skip";
          status = "warning";
          duplicateCount++;
          issues.push("مكرر داخل نفس الملف بنفس البيانات (لن ينزل مرتين)");
        } else {
          action = "update";
          status = "valid";
          existingLevel = prevFileLevel || "غير محدد";
          updateCount++;
          issues.push(`تعديل القيمة / الدرجة عن الصف السابق في الملف إلى "${normExtra}"`);
          seenRowsInFile.set(fileKey, normExtra);
        }
      } else if (dbMatch) {
        // Exists in Database!
        const dbExtra = dbMatch.extraValue ? String(dbMatch.extraValue).trim() : (dbMatch.parentValue || "");
        existingLevel = dbExtra;

        const needsValueArUpdate = valueAr && (!dbMatch.valueAr || dbMatch.valueAr.trim() !== valueAr);
        const needsExtraUpdate = normExtra && normExtra.toLowerCase() !== dbExtra.toLowerCase();

        if (needsExtraUpdate || needsValueArUpdate) {
          action = "update";
          status = "valid";
          updateCount++;
          const reasonParts: string[] = [];
          if (needsExtraUpdate) reasonParts.push(`تحديث الدرجة/السعة من (${dbExtra || "فارغ"}) إلى (${normExtra})`);
          if (needsValueArUpdate) reasonParts.push(`تحديث الترجمة العربية إلى (${valueAr})`);
          issues.push(`موجود مسبقاً — ${reasonParts.join(" و ")}`);
          seenRowsInFile.set(fileKey, normExtra);
        } else {
          action = "duplicate_skip";
          status = "warning";
          duplicateCount++;
          issues.push("مطابق تماماً للسجل الموجود في النظام — لن ينزل مجدداً لمنع التكرار");
          seenRowsInFile.set(fileKey, normExtra);
        }
      } else {
        // Brand new row -> CREATE!
        action = "create";
        status = "valid";
        createCount++;
        issues.push("سجل جديد سيتم إنشاؤه");
        seenRowsInFile.set(fileKey, normExtra);
      }
    }

    parsedRows.push({
      index: i + 1,
      category: activeCategory,
      department: dept,
      jobTitle: title || valueEn || valueAr,
      valueEn: valueEn || undefined,
      valueAr: valueAr || undefined,
      parentValue: dept || undefined,
      extraValue: level || (capacityNum ? String(capacityNum) : undefined),
      capacity: capacityNum,
      level: level || (capacityNum ? String(capacityNum) : ""),
      action,
      existingLevel,
      status,
      issues,
    });
  });

  const validCount = parsedRows.filter((r) => r.action !== "invalid").length;

  return {
    rows: parsedRows,
    totalRows: parsedRows.length,
    validCount,
    createCount,
    updateCount,
    duplicateCount,
    invalidCount,
    departments: Array.from(uniqueDeptsSet),
    newDepartmentsCount,
    jobTitlesCount: parsedRows.filter((r) => Boolean(r.jobTitle)).length,
    headers,
    filename: file.name,
  };
}
