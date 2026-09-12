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
  department: string;
  jobTitle: string;
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

/**
 * Generates and triggers instant download of the Excel/CSV template
 */
export function downloadJobTitlesTemplate(format: "xlsx" | "csv" = "xlsx", language: "ar" | "en" = "ar") {
  const ar = language === "ar";

  // Bilingual headers
  const colDept = ar ? "القسم (Department)" : "Department";
  const colTitle = ar ? "المسمى الوظيفي (Job Title)" : "Job Title";
  const colLevel = ar ? "الدرجة / المستوى (Level)" : "Level";

  // Representative sample data
  const sampleData = [
    {
      [colDept]: ar ? "المكاتب الأمامية (Front Office)" : "Front Office",
      [colTitle]: ar ? "موظف استقبال (Receptionist)" : "Receptionist",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: ar ? "المكاتب الأمامية (Front Office)" : "Front Office",
      [colTitle]: ar ? "مشرف استقبال (Front Desk Supervisor)" : "Front Desk Supervisor",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: ar ? "المكاتب الأمامية (Front Office)" : "Front Office",
      [colTitle]: ar ? "مدير مناوب (Duty Manager)" : "Duty Manager",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: ar ? "الإشراف الداخلي (Housekeeping)" : "Housekeeping",
      [colTitle]: ar ? "مشرف غرف (Room Attendant)" : "Room Attendant",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: ar ? "الإشراف الداخلي (Housekeeping)" : "Housekeeping",
      [colTitle]: ar ? "مشرف قطاع (Housekeeping Supervisor)" : "Housekeeping Supervisor",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: ar ? "الإشراف الداخلي (Housekeeping)" : "Housekeeping",
      [colTitle]: ar ? "مدير الإشراف الداخلي (Executive Housekeeper)" : "Executive Housekeeper",
      [colLevel]: "Level 4",
    },
    {
      [colDept]: ar ? "الأغذية والمشروبات (Food & Beverage)" : "Food & Beverage",
      [colTitle]: ar ? "مضيف (Waiter)" : "Waiter",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: ar ? "الأغذية والمشروبات (Food & Beverage)" : "Food & Beverage",
      [colTitle]: ar ? "كابتن صالة (F&B Captain)" : "F&B Captain",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: ar ? "الأغذية والمشروبات (Food & Beverage)" : "Food & Beverage",
      [colTitle]: ar ? "مدير مطعم (Restaurant Manager)" : "Restaurant Manager",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: ar ? "المطبخ (Kitchen)" : "Kitchen",
      [colTitle]: ar ? "مساعد شيف (Demi Chef de Partie)" : "Demi Chef de Partie",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: ar ? "المطبخ (Kitchen)" : "Kitchen",
      [colTitle]: ar ? "شيف قسم (Chef de Partie)" : "Chef de Partie",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: ar ? "المطبخ (Kitchen)" : "Kitchen",
      [colTitle]: ar ? "شيف تنفيذي (Executive Chef)" : "Executive Chef",
      [colLevel]: "Level 4",
    },
    {
      [colDept]: ar ? "الهندسة والصيانة (Engineering)" : "Engineering",
      [colTitle]: ar ? "فني صيانة (Maintenance Technician)" : "Maintenance Technician",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: ar ? "الهندسة والصيانة (Engineering)" : "Engineering",
      [colTitle]: ar ? "مهندس مناوب (Duty Engineer)" : "Duty Engineer",
      [colLevel]: "Level 3",
    },
    {
      [colDept]: ar ? "الموارد البشرية (Human Resources)" : "Human Resources",
      [colTitle]: ar ? "منسق موارد بشرية (HR Coordinator)" : "HR Coordinator",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: ar ? "الموارد البشرية (Human Resources)" : "Human Resources",
      [colTitle]: ar ? "أخصائي موارد بشرية (HR Specialist)" : "HR Specialist",
      [colLevel]: "Level 2",
    },
    {
      [colDept]: ar ? "الأمن (Security)" : "Security",
      [colTitle]: ar ? "فرد أمن (Security Officer)" : "Security Officer",
      [colLevel]: "Level 1",
    },
    {
      [colDept]: ar ? "الإدارة العامة (General Management)" : "General Management",
      [colTitle]: ar ? "المدير العام (General Manager)" : "General Manager",
      [colLevel]: "Executive",
    },
  ];

  const ws = XLSX.utils.json_to_sheet(sampleData);

  // Set optimal column widths
  ws["!cols"] = [{ wch: 35 }, { wch: 40 }, { wch: 25 }];

  const wb = XLSX.utils.book_new();
  const sheetName = ar ? "المسميات والأقسام" : "Departments & Job Titles";
  XLSX.utils.book_append_sheet(wb, ws, sheetName);

  const filename =
    format === "csv"
      ? (ar ? "نموذج_استيراد_المسميات_والاقسام.csv" : "job_titles_template.csv")
      : (ar ? "نموذج_استيراد_المسميات_والاقسام.xlsx" : "job_titles_template.xlsx");

  XLSX.writeFile(wb, filename, { bookType: format });
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
 */
export async function parseJobTitlesFile(
  file: File,
  existingLookups?: { departments?: any[]; jobTitles?: any[] }
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

  const headers = Object.keys(rawRows[0] || {});
  const parsedRows: ParsedJobTitleRow[] = [];
  const uniqueDeptsSet = new Set<string>();
  const seenRowsInFile = new Map<string, string>(); // `${dept}:::${title}` -> level

  let createCount = 0;
  let updateCount = 0;
  let duplicateCount = 0;
  let invalidCount = 0;
  let newDepartmentsCount = 0;

  rawRows.forEach((row, i) => {
    // Check if entire row is empty
    const values = Object.values(row).map((v) => String(v).trim());
    if (values.every((v) => !v)) return; // skip blank row

    const dept = findValueByAliases(row, DEPT_ALIASES);
    const title = findValueByAliases(row, TITLE_ALIASES);
    const level = findValueByAliases(row, LEVEL_ALIASES);

    const issues: string[] = [];
    let status: "valid" | "warning" | "invalid" = "valid";
    let action: RowAction = "create";
    let existingLevel: string | undefined = undefined;

    const normDept = dept.trim().toLowerCase();
    const normTitle = title.trim().toLowerCase();
    const normLevel = level.trim();
    const fileKey = `${normDept}:::${normTitle}`;

    if (!dept && !title) {
      status = "invalid";
      action = "invalid";
      invalidCount++;
      issues.push("القسم والمسمى الوظيفي مفقودان معاً في هذا الصف");
    } else if (!title && dept) {
      // Department only row
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
      // Title row (with or without department)
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

      // Check against existing database records
      const dbMatch = existingJobTitleMap.get(fileKey);
      const prevFileLevel = seenRowsInFile.get(fileKey);

      if (prevFileLevel !== undefined) {
        // Seen earlier in the SAME file
        if (normLevel.toLowerCase() === prevFileLevel.toLowerCase()) {
          action = "duplicate_skip";
          status = "warning";
          duplicateCount++;
          issues.push("مكرر داخل نفس الملف بنفس البيانات (لن ينزل مرتين)");
        } else {
          action = "update";
          status = "valid";
          existingLevel = prevFileLevel || "غير محدد";
          updateCount++;
          issues.push(`تعديل المستوى عن الصف السابق في الملف إلى "${normLevel}"`);
          seenRowsInFile.set(fileKey, normLevel);
        }
      } else if (dbMatch) {
        // Exists in Database!
        const dbLevel = dbMatch.extraValue ? String(dbMatch.extraValue).trim() : "";
        existingLevel = dbLevel;

        if (normLevel && normLevel.toLowerCase() !== dbLevel.toLowerCase()) {
          // Level is different -> UPDATE!
          action = "update";
          status = "valid";
          updateCount++;
          issues.push(
            dbLevel
              ? `المسمى موجود مسبقاً — سيتم تحديث الدرجة من (${dbLevel}) إلى (${normLevel})`
              : `المسمى موجود مسبقاً — سيتم تعيين الدرجة (${normLevel})`
          );
          seenRowsInFile.set(fileKey, normLevel);
        } else {
          // Exact duplicate in DB -> DUPLICATE SKIP!
          action = "duplicate_skip";
          status = "warning";
          duplicateCount++;
          issues.push("مطابق تماماً للسجل الموجود في النظام — لن ينزل مجدداً لمنع التكرار");
          seenRowsInFile.set(fileKey, normLevel);
        }
      } else {
        // Brand new job title -> CREATE!
        action = "create";
        status = "valid";
        createCount++;
        issues.push(
          dept && !existingDeptSet.has(normDept)
            ? "مسمى جديد وقسم جديد (سيتم إنشاؤهما معاً)"
            : "مسمى وظيفي جديد سيتم إنشاؤه"
        );
        seenRowsInFile.set(fileKey, normLevel);
      }
    }

    parsedRows.push({
      index: i + 1,
      department: dept,
      jobTitle: title,
      level: level,
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
