/**
 * Universal Room Importer Engine
 * Handles automatic column detection, alias matching, normalization,
 * and comprehensive validation for ANY room configuration file (.xlsx, .xls, .csv).
 */

import * as XLSX from "xlsx";

export type SystemFieldKey =
  | "roomNumber"
  | "roomType"
  | "capacity"
  | "bedType"
  | "floor"
  | "view"
  | "separatorDoor"
  | "features"
  | "size"
  | "building"
  | "gender"
  | "ignore";

export type SystemFieldDef = {
  key: SystemFieldKey;
  labelAr: string;
  labelEn: string;
  required: boolean;
  descriptionAr: string;
  descriptionEn: string;
  aliases: string[];
};

export const SYSTEM_FIELDS: SystemFieldDef[] = [
  {
    key: "roomNumber",
    labelAr: "رقم الغرفة",
    labelEn: "Room Number",
    required: true,
    descriptionAr: "رقم أو كود الغرفة (إجباري)",
    descriptionEn: "Unique room number / identifier (Required)",
    aliases: [
      "room numbers",
      "room number",
      "room no",
      "room no.",
      "room #",
      "room",
      "roomnumber",
      "rooms",
      "no.",
      "no",
      "رقم الغرفة",
      "الغرفة",
      "رقم",
    ],
  },
  {
    key: "roomType",
    labelAr: "نوع / تصنيف الغرفة",
    labelEn: "Room Type / Classification",
    required: true,
    descriptionAr: "نوع الغرفة كـ Deluxe أو Standard أو Suite (إجباري)",
    descriptionEn: "Room classification or type (Required)",
    aliases: [
      "room classification",
      "room type",
      "room category",
      "classification",
      "category",
      "roomtype",
      "type",
      "room_type",
      "نوع الغرفة",
      "تصنيف الغرفة",
      "التصنيف",
      "الفئة",
      "النوع",
    ],
  },
  {
    key: "capacity",
    labelAr: "أقصى سعة إشغال",
    labelEn: "Maximum Occupancy",
    required: true,
    descriptionAr: "أقصى عدد للنزلاء / الأسرة (إجباري)",
    descriptionEn: "Max bed / guest capacity (Required)",
    aliases: [
      "max. occ.",
      "max. occ",
      "max occ",
      "max occupancy",
      "maximum occupancy",
      "capacity",
      "max capacity",
      "max",
      "occ",
      "pax",
      "السعة",
      "أقصى إشغال",
      "سعة الغرفة",
      "عدد النزلاء",
      "طاقة الغرفة",
    ],
  },
  {
    key: "bedType",
    labelAr: "نوع السرير",
    labelEn: "Bed Type",
    required: false,
    descriptionAr: "نوع السرير (Twin, Queen, King, Single)",
    descriptionEn: "Bedding configuration (Twin, Queen, King)",
    aliases: [
      "bed type",
      "bed",
      "bedding",
      "bed configuration",
      "beds",
      "bed_type",
      "نوع السرير",
      "السرير",
      "توزيع الاسرة",
      "نوع الأسرة",
    ],
  },
  {
    key: "floor",
    labelAr: "الطابق / الدور",
    labelEn: "Floor / Level",
    required: false,
    descriptionAr: "رقم أو اسم الطابق (1st, 2nd, Ground, إلخ)",
    descriptionEn: "Floor number or name (1st, 2nd, Ground)",
    aliases: [
      "floor",
      "floor no",
      "floor no.",
      "floor number",
      "level",
      "story",
      "الدور",
      "الطابق",
      "رقم الدور",
      "رقم الطابق",
    ],
  },
  {
    key: "view",
    labelAr: "إطلالة الغرفة",
    labelEn: "Room View",
    required: false,
    descriptionAr: "إطلالة الغرفة (Back view, Tal view, Sea view)",
    descriptionEn: "View from room (Sea view, Garden view)",
    aliases: [
      "rooms view",
      "room view",
      "view",
      "views",
      "rooms_view",
      "room_view",
      "إطلالة الغرفة",
      "الإطلالة",
      "الفيو",
      "إطلالة",
    ],
  },
  {
    key: "separatorDoor",
    labelAr: "باب فاصل / متصلة",
    labelEn: "Separator / Connecting Door",
    required: false,
    descriptionAr: "هل يوجد باب فاصل متصل (Yes / No)",
    descriptionEn: "Whether room has connecting door (Yes / No)",
    aliases: [
      "separator door",
      "separator_door",
      "connecting door",
      "connecting",
      "separator",
      "باب فاصل",
      "غرفة متصلة",
      "كونكتد",
      "باب متصل",
    ],
  },
  {
    key: "features",
    labelAr: "تجهيزات ومميزات الغرفة",
    labelEn: "Room Features & Amenities",
    required: false,
    descriptionAr: "مواصفات وتجهيزات الغرفة كالنص الأصلي والمميزات المنقحة",
    descriptionEn: "Amenities & facilities text",
    aliases: [
      "room features",
      "room_features",
      "features",
      "amenities",
      "room amenities",
      "facilities",
      "مميزات الغرفة",
      "المميزات",
      "التجهيزات",
      "المرافق",
      "مواصفات الغرفة",
    ],
  },
  {
    key: "size",
    labelAr: "مساحة الغرفة",
    labelEn: "Room Size / Area",
    required: false,
    descriptionAr: "مساحة الغرفة بالمتر المربع (e.g. 40m2)",
    descriptionEn: "Room area in square meters (e.g. 40m2)",
    aliases: [
      "size",
      "room size",
      "area",
      "room area",
      "sqm",
      "m2",
      "المساحة",
      "مساحة الغرفة",
      "الحجم",
      "المساحة بالمتر",
    ],
  },
  {
    key: "building",
    labelAr: "المبنى",
    labelEn: "Building",
    required: false,
    descriptionAr: "اسم أو رقم المبنى في حال احتوى الملف على عدة مبانٍ",
    descriptionEn: "Building name / identifier",
    aliases: [
      "building",
      "building name",
      "block",
      "المبنى",
      "اسم المبنى",
      "العمارة",
      "مبنى",
    ],
  },
  {
    key: "gender",
    labelAr: "تخصيص الجنس",
    labelEn: "Gender Allocation",
    required: false,
    descriptionAr: "تخصيص الغرفة رجال أو سيدات (male / female)",
    descriptionEn: "Gender preference (male / female)",
    aliases: [
      "gender",
      "sex",
      "النوع",
      "الجنس",
      "تخصيص الجنس",
    ],
  },
];

/**
 * Intelligent auto-detection of system field from raw column header
 */
export function detectColumnField(headerName: string): SystemFieldKey {
  if (!headerName) return "ignore";
  const norm = headerName
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ");

  // 1. Exact alias match (longest first)
  const allAliases: { key: SystemFieldKey; alias: string }[] = [];
  for (const field of SYSTEM_FIELDS) {
    for (const a of field.aliases) {
      allAliases.push({ key: field.key, alias: a });
    }
  }
  allAliases.sort((a, b) => b.alias.length - a.alias.length);

  for (const item of allAliases) {
    if (norm === item.alias) {
      return item.key;
    }
  }

  // 2. Specific feature/attribute checks before generic room checks
  if (norm.includes("feat") || norm.includes("amenit") || norm.includes("ميز") || norm.includes("مرافق")) return "features";
  if (norm.includes("view") || norm.includes("إطلال") || norm.includes("فيو")) return "view";
  if (norm.includes("door") || norm.includes("separat") || norm.includes("connect") || norm.includes("فاصل") || norm.includes("متصل")) return "separatorDoor";
  if (norm.includes("bed") || norm.includes("سرير") || norm.includes("أسرة")) return "bedType";
  if (norm.includes("class") || norm.includes("type") || norm.includes("category") || norm.includes("صنيف") || norm.includes("نوع")) return "roomType";
  if (norm.includes("occ") || norm.includes("capac") || norm.includes("pax") || norm.includes("سعة") || norm.includes("إشغال")) return "capacity";
  if (norm.includes("floor") || norm.includes("level") || norm.includes("story") || norm.includes("دور") || norm.includes("طابق")) return "floor";
  if (norm.includes("size") || norm.includes("area") || norm.includes("sqm") || norm.includes("m2") || norm.includes("مساح")) return "size";
  if (norm.includes("build") || norm.includes("block") || norm.includes("مبنى") || norm.includes("عمار")) return "building";
  if (norm.includes("gender") || norm.includes("sex") || norm.includes("جنس") || norm.includes("نوع")) return "gender";

  // 3. Room number checks
  if (
    norm === "no." ||
    norm === "no" ||
    norm === "#" ||
    (norm.includes("room") && (norm.includes("num") || norm.includes("no") || norm.includes("#") || norm.includes("s"))) ||
    norm.includes("غرف")
  ) {
    return "roomNumber";
  }

  return "ignore";
}

/**
 * Data Normalization Functions
 */
export function normalizeBoolean(val: any): boolean {
  if (val === null || val === undefined) return false;
  if (typeof val === "boolean") return val;
  const s = String(val).trim().toLowerCase();
  return ["yes", "y", "true", "1", "نعم", "ايوه", "متاح", "صح"].includes(s);
}

export function normalizeSize(val: any): { numeric: number | null; unit: string; original: string } {
  if (val === null || val === undefined) return { numeric: null, unit: "m²", original: "" };
  const orig = String(val).trim();
  const match = orig.match(/([0-9]+(?:\.[0-9]+)?)/);
  const numeric = match ? Math.round(parseFloat(match[1])) : null;
  return { numeric, unit: "m²", original: orig };
}

export function normalizeFloor(val: any): string {
  if (val === null || val === undefined) return "1";
  const s = String(val).trim().toLowerCase();
  if (s === "gf" || s.includes("ground") || s.includes("أرضي")) return "0";
  if (s === "1st" || s.includes("first") || s.includes("اول") || s.includes("أول")) return "1";
  if (s === "2nd" || s.includes("second") || s.includes("ثاني")) return "2";
  if (s === "3rd" || s.includes("third") || s.includes("ثالث")) return "3";
  if (s === "4th" || s.includes("fourth") || s.includes("رابع")) return "4";
  if (s === "5th" || s.includes("fifth") || s.includes("خامس")) return "5";
  const match = s.match(/([0-9]+)/);
  if (match) return match[1];
  return String(val).trim() || "1";
}

export function normalizeBedType(val: any): string {
  if (!val) return "Standard Bed";
  const s = String(val).trim();
  const lower = s.toLowerCase();
  if (lower.includes("twin")) return "Twin Bed";
  if (lower.includes("queen")) return "Queen Bed";
  if (lower.includes("king")) return "King Bed";
  if (lower.includes("single")) return "Single Bed";
  if (lower.includes("bunk")) return "Bunk Bed";
  return s;
}

export function normalizeFeatures(val: any): { raw: string; list: string[] } {
  if (!val) return { raw: "", list: [] };
  const raw = String(val).trim();
  const parts = raw
    .split(/[,;\n]+/)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);
  const unique = Array.from(new Set(parts));
  return { raw, list: unique };
}

export function normalizeRoomType(val: any): string {
  if (!val) return "Standard";
  const s = String(val).trim();
  // Capitalize words nicely
  return s
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}

/**
 * Row Validation & Conflict Check
 */
export type ValidationError = {
  rowNumber: number;
  column: string;
  fieldKey: SystemFieldKey;
  value: any;
  errorAr: string;
  errorEn: string;
  suggestedFixAr: string;
  suggestedFixEn: string;
  severity: "error" | "warning";
};

export type ProcessedRow = {
  rowNumber: number;
  originalData: Record<string, any>;
  normalizedRoom: {
    roomNumber: string;
    roomType: string;
    capacity: number;
    bedType: string;
    floor: string;
    view: string;
    separatorDoor: boolean;
    size: string;
    sizeSqm: number | null;
    features: string;
    featuresList: string[];
    building?: string;
    gender?: string;
  };
  isValid: boolean;
  isExisting: boolean;
  existingRoom?: any;
  errors: ValidationError[];
  warnings: ValidationError[];
};

export function validateAndNormalizeRows({
  rows,
  columnMapping,
  existingRooms = [],
}: {
  rows: Record<string, any>[];
  columnMapping: Record<string, SystemFieldKey>;
  existingRooms?: any[];
}): {
  processedRows: ProcessedRow[];
  totalRows: number;
  validRows: number;
  invalidRows: number;
  newRoomsCount: number;
  existingRoomsCount: number;
  allErrors: ValidationError[];
  allWarnings: ValidationError[];
} {
  const existingMap = new Map<string, any>();
  for (const r of existingRooms) {
    if (r.roomNumber) {
      existingMap.set(String(r.roomNumber).trim().toLowerCase(), r);
    }
  }

  const processedRows: ProcessedRow[] = [];
  const allErrors: ValidationError[] = [];
  const allWarnings: ValidationError[] = [];

  const seenRoomNumbersInFile = new Set<string>();

  rows.forEach((rawRow, index) => {
    const rowNumber = index + 2; // header is row 1
    const errors: ValidationError[] = [];
    const warnings: ValidationError[] = [];

    // Extract mapped values
    let rawRoomNumber: any = null;
    let rawRoomType: any = null;
    let rawCapacity: any = null;
    let rawBedType: any = null;
    let rawFloor: any = null;
    let rawView: any = null;
    let rawSeparatorDoor: any = null;
    let rawFeatures: any = null;
    let rawSize: any = null;
    let rawBuilding: any = null;
    let rawGender: any = null;

    for (const [colName, fieldKey] of Object.entries(columnMapping)) {
      const val = rawRow[colName];
      if (fieldKey === "roomNumber") rawRoomNumber = val;
      else if (fieldKey === "roomType") rawRoomType = val;
      else if (fieldKey === "capacity") rawCapacity = val;
      else if (fieldKey === "bedType") rawBedType = val;
      else if (fieldKey === "floor") rawFloor = val;
      else if (fieldKey === "view") rawView = val;
      else if (fieldKey === "separatorDoor") rawSeparatorDoor = val;
      else if (fieldKey === "features") rawFeatures = val;
      else if (fieldKey === "size") rawSize = val;
      else if (fieldKey === "building") rawBuilding = val;
      else if (fieldKey === "gender") rawGender = val;
    }

    // 1. Room Number Validation
    const cleanRoomNumber = String(rawRoomNumber ?? "").trim();
    if (!cleanRoomNumber) {
      errors.push({
        rowNumber,
        column: "Room Number",
        fieldKey: "roomNumber",
        value: rawRoomNumber,
        errorAr: "رقم الغرفة مفقود أو فارغ",
        errorEn: "Room number is missing or empty",
        suggestedFixAr: "أدخل رقم أو كود الغرفة (مثل 101 أو 201)",
        suggestedFixEn: "Enter a valid room number (e.g. 101, 201)",
        severity: "error",
      });
    } else {
      const lowerKey = cleanRoomNumber.toLowerCase();
      if (seenRoomNumbersInFile.has(lowerKey)) {
        errors.push({
          rowNumber,
          column: "Room Number",
          fieldKey: "roomNumber",
          value: cleanRoomNumber,
          errorAr: `رقم الغرفة "${cleanRoomNumber}" مكرر داخل هذا الملف`,
          errorEn: `Duplicate room number "${cleanRoomNumber}" in file`,
          suggestedFixAr: "تأكد من عدم تكرار أرقام الغرف داخل الملف",
          suggestedFixEn: "Ensure room numbers are unique within the file",
          severity: "error",
        });
      }
      seenRoomNumbersInFile.add(lowerKey);
    }

    // 2. Room Type Validation
    const cleanRoomType = normalizeRoomType(rawRoomType);
    if (!cleanRoomType || cleanRoomType === "Standard" && !rawRoomType) {
      errors.push({
        rowNumber,
        column: "Room Type",
        fieldKey: "roomType",
        value: rawRoomType,
        errorAr: "نوع أو تصنيف الغرفة مفقود",
        errorEn: "Room type/classification is missing",
        suggestedFixAr: "حدد نوع الغرفة (مثل Deluxe room أو Standard)",
        suggestedFixEn: "Specify room classification (e.g. Deluxe, Standard)",
        severity: "error",
      });
    }

    // 3. Capacity Validation
    let capacityNum = parseInt(String(rawCapacity ?? ""), 10);
    if (isNaN(capacityNum) || capacityNum <= 0) {
      if (rawCapacity !== undefined && rawCapacity !== null && String(rawCapacity).trim() !== "") {
        errors.push({
          rowNumber,
          column: "Max. Occ.",
          fieldKey: "capacity",
          value: rawCapacity,
          errorAr: `أقصى إشغال "${rawCapacity}" يجب أن يكون رقماً صحيحاً موجباً`,
          errorEn: `Maximum occupancy "${rawCapacity}" must be a positive number`,
          suggestedFixAr: "أدخل رقماً صحيحاً (مثل 1 أو 2 أو 3)",
          suggestedFixEn: "Enter a positive integer (e.g. 1, 2, 3)",
          severity: "error",
        });
      } else {
        // Warning: defaulting to 1
        capacityNum = 1;
        warnings.push({
          rowNumber,
          column: "Max. Occ.",
          fieldKey: "capacity",
          value: rawCapacity,
          errorAr: "لم يتم تحديد أقصى إشغال، تم الاعتماد الافتراضي: 1 سرير",
          errorEn: "Occupancy missing, defaulted to 1 bed",
          suggestedFixAr: "حدد السعة في الملف أو اعتمد القيمة 1",
          suggestedFixEn: "Specify capacity or accept default 1",
          severity: "warning",
        });
      }
    }

    // Normalizations
    const normSize = normalizeSize(rawSize);
    const normFloor = normalizeFloor(rawFloor);
    const normBedType = normalizeBedType(rawBedType);
    const normFeatures = normalizeFeatures(rawFeatures);
    const normSepDoor = normalizeBoolean(rawSeparatorDoor);

    const isExisting = cleanRoomNumber ? existingMap.has(cleanRoomNumber.toLowerCase()) : false;
    const existingRoom = cleanRoomNumber ? existingMap.get(cleanRoomNumber.toLowerCase()) : undefined;

    if (isExisting) {
      warnings.push({
        rowNumber,
        column: "Room Number",
        fieldKey: "roomNumber",
        value: cleanRoomNumber,
        errorAr: `الغرفة "${cleanRoomNumber}" مسجلة مسبقاً بالنظام (سيتم تحديثها أو تخطيها حسب نمط الاستيراد)`,
        errorEn: `Room "${cleanRoomNumber}" already exists (will be updated or skipped by mode)`,
        suggestedFixAr: "اختر نمط الاستيراد المناسب (Create + Update أو Update Only)",
        suggestedFixEn: "Select appropriate import mode",
        severity: "warning",
      });
    }

    const processedRow: ProcessedRow = {
      rowNumber,
      originalData: rawRow,
      normalizedRoom: {
        roomNumber: cleanRoomNumber,
        roomType: cleanRoomType,
        capacity: capacityNum,
        bedType: normBedType,
        floor: normFloor,
        view: String(rawView ?? "").trim(),
        separatorDoor: normSepDoor,
        size: normSize.original,
        sizeSqm: normSize.numeric,
        features: normFeatures.raw,
        featuresList: normFeatures.list,
        building: String(rawBuilding ?? "").trim() || undefined,
        gender: String(rawGender ?? "").trim() || undefined,
      },
      isValid: errors.length === 0,
      isExisting,
      existingRoom,
      errors,
      warnings,
    };

    processedRows.push(processedRow);
    allErrors.push(...errors);
    allWarnings.push(...warnings);
  });

  const totalRows = processedRows.length;
  const validRows = processedRows.filter((r) => r.isValid).length;
  const invalidRows = totalRows - validRows;
  const existingRoomsCount = processedRows.filter((r) => r.isExisting).length;
  const newRoomsCount = totalRows - existingRoomsCount;

  return {
    processedRows,
    totalRows,
    validRows,
    invalidRows,
    newRoomsCount,
    existingRoomsCount,
    allErrors,
    allWarnings,
  };
}

/**
 * Generates and downloads a universal Room Configuration import template
 * (.xlsx or .csv) pre-filled with the exact column headers, realistic examples,
 * and an educational guidance worksheet.
 */
export function downloadRoomImportTemplate(format: "xlsx" | "csv" = "xlsx") {
  const sampleData = [
    {
      "NO.": 1,
      "Room Numbers": "201",
      "Room Classification": "Deluxe room",
      "Bed Type": "Twin Bed",
      "Max. Occ.": 3,
      "Floor": "1st",
      "Rooms View": "Back view",
      "Separator door": "Yes",
      "Room Features": "bedroom, seating area, bathroom",
      "Size": "40m2",
      "Building": "Main Building",
    },
    {
      "NO.": 2,
      "Room Numbers": "202",
      "Room Classification": "Deluxe room",
      "Bed Type": "Twin Bed",
      "Max. Occ.": 3,
      "Floor": "1st",
      "Rooms View": "Tal View",
      "Separator door": "Yes",
      "Room Features": "bedroom, seating area, bathroom",
      "Size": "40m2",
      "Building": "Main Building",
    },
    {
      "NO.": 3,
      "Room Numbers": "203",
      "Room Classification": "Deluxe room",
      "Bed Type": "Queen Bed",
      "Max. Occ.": 3,
      "Floor": "1st",
      "Rooms View": "Back view",
      "Separator door": "Yes",
      "Room Features": "bedroom, seating area, bathroom",
      "Size": "40m2",
      "Building": "Main Building",
    },
    {
      "NO.": 4,
      "Room Numbers": "204",
      "Room Classification": "Deluxe room",
      "Bed Type": "Queen Bed",
      "Max. Occ.": 3,
      "Floor": "1st",
      "Rooms View": "Tal View",
      "Separator door": "Yes",
      "Room Features": "bedroom, seating area, bathroom",
      "Size": "40m2",
      "Building": "Main Building",
    },
    {
      "NO.": 5,
      "Room Numbers": "205",
      "Room Classification": "Superior room",
      "Bed Type": "Queen Bed",
      "Max. Occ.": 3,
      "Floor": "1st",
      "Rooms View": "Tal View",
      "Separator door": "NO",
      "Room Features": "bedroom, bathroom",
      "Size": "40m2",
      "Building": "Main Building",
    },
    {
      "NO.": 6,
      "Room Numbers": "206",
      "Room Classification": "Family suite",
      "Bed Type": "Twin Bed",
      "Max. Occ.": 4,
      "Floor": "1st",
      "Rooms View": "Tal View",
      "Separator door": "Yes",
      "Room Features": "two bedrooms, dressing room, bathroom",
      "Size": "50m2",
      "Building": "Main Building",
    },
  ];

  const guideData = [
    {
      "العمود (Column)": "Room Numbers (أو رقم الغرفة)",
      "إلزامي؟ (Required)": "نعم (Yes)",
      "الأمثلة (Examples)": "201, 202, 101-A",
      "الوصف والملاحظات (Description)": "رقم أو كود الغرفة الفريد داخل المبنى",
    },
    {
      "العمود (Column)": "Room Classification (نوع الغرفة)",
      "إلزامي؟ (Required)": "نعم (Yes)",
      "الأمثلة (Examples)": "Deluxe room, Superior room, Family suite, Standard",
      "الوصف والملاحظات (Description)": "تصنيف ونوع الغرفة ومستواها",
    },
    {
      "العمود (Column)": "Max. Occ. (أقصى سعة إشغال)",
      "إلزامي؟ (Required)": "نعم (Yes)",
      "الأمثلة (Examples)": "1, 2, 3, 4",
      "الوصف والملاحظات (Description)": "العدد الأقصى للأفراد / الأسرة في الغرفة (رقم صحيح)",
    },
    {
      "العمود (Column)": "Bed Type (نوع السرير)",
      "إلزامي؟ (Required)": "اختياري (Optional)",
      "الأمثلة (Examples)": "Twin Bed, Queen Bed, King Bed, Single Bed",
      "الوصف والملاحظات (Description)": "نوع السرير لتسجيله في بطاقة الغرفة والأسرة الفيزيائية",
    },
    {
      "العمود (Column)": "Floor (الدور / الطابق)",
      "إلزامي؟ (Required)": "اختياري (Optional)",
      "الأمثلة (Examples)": "Ground, 1st, 2nd, 3rd أو 0, 1, 2",
      "الوصف والملاحظات (Description)": "رقم أو اسم الطابق (سيتم إنشاؤه تلقائياً إذا لم يكن موجوداً)",
    },
    {
      "العمود (Column)": "Rooms View (إطلالة الغرفة)",
      "إلزامي؟ (Required)": "اختياري (Optional)",
      "الأمثلة (Examples)": "Tal View, Back view, Sea view, Pool view, Garden view",
      "الوصف والملاحظات (Description)": "إطلالة الغرفة للمساعدة في التسكين ومقارنة المستويات",
    },
    {
      "العمود (Column)": "Separator door (باب فاصل)",
      "إلزامي؟ (Required)": "اختياري (Optional)",
      "الأمثلة (Examples)": "Yes / NO أو نعم / لا",
      "الوصف والملاحظات (Description)": "هل يوجد باب فاصل متصل بغرفة مجاورة (Connecting Room)",
    },
    {
      "العمود (Column)": "Room Features (مميزات وتجهيزات الغرفة)",
      "إلزامي؟ (Required)": "اختياري (Optional)",
      "الأمثلة (Examples)": "bedroom, seating area, bathroom, balcony",
      "الوصف والملاحظات (Description)": "مرافق ومميزات الغرفة مفصولة بفاصلة (,) لتظهر كشارات ملونة",
    },
    {
      "العمود (Column)": "Size (المساحة)",
      "إلزامي؟ (Required)": "اختياري (Optional)",
      "الأمثلة (Examples)": "40m2, 50, 45 sqm",
      "الوصف والملاحظات (Description)": "مساحة الغرفة بالمتر المربع (يتم استخراج الرقم الصافي آلياً)",
    },
    {
      "العمود (Column)": "Building (المبنى)",
      "إلزامي؟ (Required)": "اختياري (Optional)",
      "الأمثلة (Examples)": "Main Building, Block A, Building 1",
      "الوصف والملاحظات (Description)": "اسم المبنى (في حال عدم تحديده ينسب للمبنى الافتراضي)",
    },
  ];

  const wb = XLSX.utils.book_new();

  const wsRooms = XLSX.utils.json_to_sheet(sampleData);
  wsRooms["!cols"] = [
    { wch: 6 },
    { wch: 15 },
    { wch: 22 },
    { wch: 14 },
    { wch: 12 },
    { wch: 10 },
    { wch: 15 },
    { wch: 16 },
    { wch: 38 },
    { wch: 10 },
    { wch: 18 },
  ];
  XLSX.utils.book_append_sheet(wb, wsRooms, "Room Configuration");

  const wsGuide = XLSX.utils.json_to_sheet(guideData);
  wsGuide["!cols"] = [
    { wch: 32 },
    { wch: 18 },
    { wch: 35 },
    { wch: 55 },
  ];
  XLSX.utils.book_append_sheet(wb, wsGuide, "تعليمات وأدلة التعبئة (Guide)");

  if (format === "csv") {
    XLSX.writeFile(wb, "Room_Configuration_Template.csv", { bookType: "csv" });
  } else {
    XLSX.writeFile(wb, "Room_Configuration_Template.xlsx", { bookType: "xlsx" });
  }
}
