// @ts-nocheck
import { useState, useRef, useEffect, useMemo } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  FileSpreadsheet,
  Download,
  Upload,
  X,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Search,
  RotateCcw,
  Check,
  FileDown,
  PlusCircle,
  RefreshCw,
} from "lucide-react";
import * as XLSX from "xlsx";

const MAX_PROFILE_IMPORT_FILE_SIZE = 25 * 1024 * 1024;
const PROFILE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

export type ProfileRowAction = "create" | "update" | "skip" | "invalid";

export interface ProfileImportRow {
  profileId: string;
  firstName: string;
  lastName: string;
  thirdName: string;
  fourthName: string;
  employmentType: string;
  companyName: string;
  department: string;
  jobTitle: string;
  level: string;
  nationality: string;
  gender: string;
  nationalId: string;
  phone: string;
  email: string;
  emergencyContact: string;
  hireDate: string;
  contractEndDate?: string;
  dateOfBirth: string;
  address: string;
  status: string;
}

export interface ProfileFieldDiff {
  field: string;
  labelAr: string;
  labelEn: string;
  oldValue: string;
  newValue: string;
}

export interface AnalyzedRow {
  index: number;
  raw: any;
  profile: ProfileImportRow;
  action: ProfileRowAction;
  statusReason: string;
  diffs: ProfileFieldDiff[];
}

export interface SkippedItem {
  profileId: string;
  name: string;
  nationalId: string;
  phone: string;
  reason: string;
}

export interface UpdatedItem {
  profileId: string;
  name: string;
  nationalId: string;
  diffsSummary: string;
}

export interface ImportResult {
  total: number;
  success: number;
  created: number;
  updated: number;
  skipped: number;
  skippedItems: SkippedItem[];
  updatedItems: UpdatedItem[];
}

export function ExcelImportDialog({
  propertyId,
  isOpen,
  onClose,
  onImportSuccess,
  onImport,
  isImporting: externalIsImporting,
}: {
  propertyId: number;
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess?: () => void;
  onImport?: (rows: any[]) => void;
  isImporting?: boolean;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const fileRef = useRef<HTMLInputElement>(null);

  // Wizard steps: 'upload' | 'processing' | 'result'
  const [step, setStep] = useState<"upload" | "processing" | "result">("upload");
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");
  const [allParsedRows, setAllParsedRows] = useState<any[]>([]);
  const [isCheckingDuplicates, setIsCheckingDuplicates] = useState(false);

  // DB existing profiles for client-side comparison
  const [existingProfiles, setExistingProfiles] = useState<any[]>([]);

  // Preview filtering & search
  const [previewFilter, setPreviewFilter] = useState<"all" | "create" | "update" | "skip">("all");
  const [previewSearch, setPreviewSearch] = useState("");

  // Result tab view: 'skipped' | 'updated'
  const [resultTab, setResultTab] = useState<"skipped" | "updated">("skipped");

  // Processing state
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Load existing profiles when dialog opens
  useEffect(() => {
    if (!isOpen || !propertyId) return;
    let isMounted = true;
    async function fetchExisting() {
      setIsCheckingDuplicates(true);
      try {
        const res = await fetch(`/api/profiles/existing-identifiers?propertyId=${propertyId}`);
        if (res.ok) {
          const data = await res.json();
          if (isMounted && Array.isArray(data.profiles)) {
            setExistingProfiles(data.profiles);
          }
        }
      } catch (err) {
        console.error("Error fetching existing profiles:", err);
      } finally {
        if (isMounted) setIsCheckingDuplicates(false);
      }
    }
    fetchExisting();
    return () => {
      isMounted = false;
    };
  }, [isOpen, propertyId]);

  // Fast lookup maps of existing profiles
  const existingMaps = useMemo(() => {
    const byProfileId = new Map<string, any>();
    const byNationalId = new Map<string, any>();
    for (const r of existingProfiles) {
      if (r.profileId) byProfileId.set(r.profileId.trim().toLowerCase(), r);
      if (r.nationalId) byNationalId.set(r.nationalId.trim(), r);
    }
    return { byProfileId, byNationalId };
  }, [existingProfiles]);

  const parseExcelDate = (val: any): string => {
    if (!val) return "";
    if (val instanceof Date) {
      return isNaN(val.getTime()) ? "" : val.toISOString().split("T")[0];
    }
    if (typeof val === "number") {
      const d = new Date(Math.round((val - 25569) * 86400 * 1000));
      return isNaN(d.getTime()) ? "" : d.toISOString().split("T")[0];
    }
    const s = String(val).trim();
    if (!s) return "";
    const dmyMatch = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (dmyMatch) {
      const [, day, month, year] = dmyMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    const ymdMatch = s.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})/);
    if (ymdMatch) {
      const [, year, month, day] = ymdMatch;
      return `${year}-${month.padStart(2, "0")}-${day.padStart(2, "0")}`;
    }
    return s;
  };

  const parseEmploymentType = (val: any): string => {
    if (!val) return "INTERNAL";
    const s = String(val).trim().toUpperCase();
    if (s.includes("EXT") || s.includes("خارج")) return "EXTERNAL";
    if (s.includes("THIRD") || s.includes("طرف") || s.includes("ثالث") || s.includes("مقاول") || s.includes("شركة")) return "THIRD_PARTY";
    return "INTERNAL";
  };

  const parseGender = (val: any): string => {
    if (!val) return "M";
    const s = String(val).trim().toUpperCase();
    if (s === "F" || s === "FEMALE" || s.includes("أنث") || s.includes("انث")) return "F";
    return "M";
  };

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Profile_Code",
        "First_Name",
        "Second_Name",
        "Third_Name",
        "Fourth_Name",
        "Employment_Type",
        "Company_Name",
        "Department",
        "Job_Title",
        "Level",
        "Nationality",
        "Gender",
        "National_ID",
        "Phone",
        "Email",
        "Emergency_Contact",
        "Hire_Date",
        "Contract_End_Date",
        "Date_Of_Birth",
        "Address",
      ],
      [
        "EMP-001",
        "Ahmed",
        "Mohamed",
        "Ali",
        "Hassan",
        "INTERNAL",
        "Sunrise Head Office",
        "IT",
        "Software Engineer",
        "1",
        "Egyptian",
        "M",
        "29001011234567",
        "+201001234567",
        "ahmed.mohamed@example.com",
        "+201099999999",
        "2024-01-01",
        "2026-01-01",
        "1990-05-15",
        "Cairo, Egypt",
      ],
      [
        "EMP-002",
        "Sara",
        "Ibrahim",
        "Khaled",
        "Mahmoud",
        "EXTERNAL",
        "Al-Binaa Contracting",
        "Engineering",
        "Civil Engineer",
        "2",
        "Egyptian",
        "F",
        "29502021234568",
        "+201111234567",
        "sara.ibrahim@example.com",
        "+201188888888",
        "2024-03-01",
        "2025-12-31",
        "1995-08-20",
        "Alexandria, Egypt",
      ],
      [
        "EMP-003",
        "Tarek",
        "Mahmoud",
        "Salem",
        "Al-Sayed",
        "THIRD_PARTY",
        "Delta Security Services",
        "Security",
        "Security Guard",
        "3",
        "Egyptian",
        "M",
        "29203031234569",
        "+201221234567",
        "tarek.guard@example.com",
        "+201277777777",
        "2024-06-01",
        "2025-06-01",
        "1992-11-10",
        "Giza, Egypt",
      ],
    ]);
    ws["!cols"] = Array(20).fill({ wch: 22 });

    const wsInstructions = XLSX.utils.aoa_to_sheet([
      ["Column Name (اسم العمود)", "Required (إلزامي)", "Allowed Values / Format (القيم المسموحة / التنسيق)", "Description (الوصف)"],
      ["Profile_Code", "Yes (نعم)", "Text (e.g. EMP-001, 105)", "Unique employee / profile ID (كود الموظف التعريفي الفريد - يمنع التكرار)"],
      ["First_Name", "Yes (نعم)", "Text", "First name (الاسم الأول)"],
      ["Second_Name", "Yes (نعم)", "Text", "Father's name / Second name (الاسم الثاني / اسم الأب)"],
      ["Third_Name", "No (اختياري)", "Text", "Grandfather's name (الاسم الثالث / اسم الجد)"],
      ["Fourth_Name", "No (اختياري)", "Text", "Family name (الاسم الرابع / اسم العائلة)"],
      ["Employment_Type", "No (افتراضي INTERNAL)", "INTERNAL | EXTERNAL | THIRD_PARTY", "نوع التوظيف: داخلي (INTERNAL) أو خارجي (EXTERNAL) أو طرف ثالث / شركة (THIRD_PARTY)"],
      ["Company_Name", "Conditional (مشروط)", "Text", "اسم الشركة أو مكان العمل (Workplace / Company Name)"],
      ["Department", "No (اختياري)", "Text (e.g. IT, HR, Maintenance)", "Department / Division (القسم أو الإدارة)"],
      ["Job_Title", "No (اختياري)", "Text", "Job title / Designation (المسمى الوظيفي)"],
      ["Level", "No (اختياري)", "Text (e.g. 1, 2, 3)", "Job grade / Level (الدرجة الوظيفية)"],
      ["Nationality", "No (اختياري)", "Text (e.g. Egyptian, Saudi)", "Nationality (الجنسية)"],
      ["Gender", "No (افتراضي M)", "M (ذكر) | F (أنثى)", "Gender: M for Male, F for Female"],
      ["National_ID", "Yes (نعم)", "Text / Number", "National ID / Iqama / Passport (رقم الهوية أو الإقامة أو الجواز - يمنع التكرار)"],
      ["Phone", "No (اختياري)", "Text / Phone Number", "Mobile / Phone number (رقم الجوال - يمنع التكرار)"],
      ["Email", "No (اختياري)", "Valid Email", "Email address (البريد الإلكتروني)"],
      ["Emergency_Contact", "No (اختياري)", "Phone Number", "Emergency contact phone (هاتف الطوارئ)"],
      ["Hire_Date", "No (اختياري)", "YYYY-MM-DD", "Hire date (تاريخ التعيين)"],
      ["Contract_End_Date", "No (اختياري)", "YYYY-MM-DD", "Contract end date (تاريخ انتهاء العقد)"],
      ["Date_Of_Birth", "No (اختياري)", "YYYY-MM-DD", "Date of birth (تاريخ الميلاد)"],
      ["Address", "No (اختياري)", "Text", "Residential address (العنوان)"],
    ]);
    wsInstructions["!cols"] = [{ wch: 22 }, { wch: 18 }, { wch: 35 }, { wch: 55 }];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profiles");
    XLSX.utils.book_append_sheet(wb, wsInstructions, "Instructions_إرشادات");
    XLSX.writeFile(wb, "profile_import_template.xlsx");
  };

  const handleFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const lowerName = file.name.toLowerCase();
    if (!PROFILE_IMPORT_EXTENSIONS.some((ext) => lowerName.endsWith(ext))) {
      setParseError(ar ? "نوع الملف غير مدعوم. يرجى اختيار ملف Excel (.xlsx أو .xls)" : "Unsupported file type. Please choose .xlsx or .xls");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PROFILE_IMPORT_FILE_SIZE) {
      setParseError(
        ar
          ? "الملف كبير جداً. الحد الأقصى 25 ميغابايت"
          : "File is too large. Maximum size is 25 MB",
      );
      e.target.value = "";
      return;
    }
    setFileName(file.name);
    setParseError("");
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, {
          type: "binary",
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<any>(ws, { defval: "" });
        if (rows.length === 0) {
          setParseError(ar ? "ملف الإكسل فارغ ولا يحتوي على أي بيانات" : "Excel file is empty");
          return;
        }
        setAllParsedRows(rows);
        setStep("upload");
      } catch {
        setParseError(ar ? "فشل في قراءة ملف الإكسل" : "Failed to parse excel file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  // Convert raw row to normalized ProfileImportRow
  const mapRawToProfile = (r: any, index: number): ProfileImportRow => {
    let pId = String(
      r.Profile_Code || r.profileId || r.Code || r["الكود"] || r["كود الموظف"] || r["رقم الملف"] || "",
    ).trim();
    let fn = String(r.First_Name || r.firstName || r["الاسم الأول"] || r["الاسم"] || "").trim();
    let ln = String(
      r.Second_Name || r.lastName || r.Last_Name || r["الاسم الثاني"] || r["اسم العائلة"] || r["اللقب"] || "",
    ).trim();
    let tn = String(r.Third_Name || r.thirdName || r["الاسم الثالث"] || "").trim();
    let fourN = String(r.Fourth_Name || r.fourthName || r["الاسم الرابع"] || "").trim();

    if (fn && !ln && !tn && !fourN) {
      const parts = fn.split(/\s+/);
      if (parts.length >= 4) {
        fn = parts[0];
        ln = parts[1];
        tn = parts[2];
        fourN = parts.slice(3).join(" ");
      } else if (parts.length === 3) {
        fn = parts[0];
        ln = parts[1];
        tn = parts[2];
      } else if (parts.length === 2) {
        fn = parts[0];
        ln = parts[1];
      }
    }

    const rawEmp = r.Employment_Type || r.employmentType || r["نوع التوظيف"] || r["نوع العمل"];
    const empType = parseEmploymentType(rawEmp);

    if (!pId) {
      pId = `${empType === "THIRD_PARTY" ? "TP" : "EMP"}-${Date.now().toString().slice(-5)}${index + 1}`;
    }

    const comp = String(
      r.Company_Name || r.companyName || r.Workplace || r.workplace || r["الشركة"] || r["مكان العمل"] || r["جهة العمل"] || "",
    ).trim();
    let dept = String(r.Department || r.department || r["القسم"] || r["الإدارة"] || "").trim();
    if (!dept) {
      dept = empType === "THIRD_PARTY" ? (ar ? "طرف ثالث" : "Third Party") : (ar ? "عام" : "General");
    }
    let title = String(r.Job_Title || r.jobTitle || r["الوظيفة"] || r["المسمى الوظيفي"] || "").trim();
    if (!title) {
      title = ar ? "موظف" : "Staff";
    }
    const lvl = String(r.Level ?? r.level ?? r["الدرجة"] ?? "").trim() || "—";
    let nat = String(r.Nationality || r.nationality || r["الجنسية"] || "").trim();
    if (!nat) {
      nat = ar ? "مصري" : "Egyptian";
    }
    const g = parseGender(r.Gender || r.gender || r["الجنس"]);
    const nid = String(r.National_ID || r.nationalId || r["رقم الهوية"] || r["الهوية"] || r["الرقم القومي"] || "").trim();
    const ph = String(r.Phone || r.phone || r["الهاتف"] || r["الجوال"] || r["الموبايل"] || "").trim();
    const em = String(r.Email || r.email || r["البريد"] || r["الإيميل"] || "").trim();
    const emer = String(r.Emergency_Contact || r.emergencyContact || r["طوارئ"] || r["هاتف الطوارئ"] || "").trim();
    const hd = parseExcelDate(r.Hire_Date || r.hireDate || r["تاريخ التعيين"]) || new Date().toISOString().split("T")[0];
    const ced = parseExcelDate(
      r.Contract_End_Date || r.contractEndDate || r.Contract_End || r.contract_end_date || r.contract_end || r["انتهاء العقد"] || r["تاريخ انتهاء العقد"]
    ) || undefined;
    const dob = parseExcelDate(r.Date_Of_Birth || r.dateOfBirth || r["تاريخ الميلاد"]) || "";
    const addr = String(r.Address || r.address || r["العنوان"] || "").trim();

    return {
      profileId: pId,
      firstName: fn || "—",
      lastName: ln || "—",
      thirdName: tn,
      fourthName: fourN,
      employmentType: empType,
      companyName: comp,
      department: dept,
      jobTitle: title,
      level: lvl,
      nationality: nat,
      gender: g,
      nationalId: nid,
      phone: ph,
      email: em,
      emergencyContact: emer,
      hireDate: hd,
      contractEndDate: ced,
      dateOfBirth: dob,
      address: addr,
      status: "UNASSIGNED",
    };
  };

  // Analyze all parsed rows for Smart Upsert (Create, Update, Skip Duplicates)
  const analyzedRows = useMemo<AnalyzedRow[]>(() => {
    if (allParsedRows.length === 0) return [];

    const seenProfileIdsInFile = new Set<string>();
    const seenNationalIdsInFile = new Set<string>();

    return allParsedRows.map((raw, index) => {
      const profile = mapRawToProfile(raw, index);
      const pId = profile.profileId?.trim().toLowerCase();
      const nid = profile.nationalId?.trim();

      // Check 1: Duplicate within file itself
      if (pId && seenProfileIdsInFile.has(pId)) {
        return {
          index,
          raw,
          profile,
          action: "skip",
          statusReason: ar
            ? `كود الموظف (${profile.profileId}) مكرر داخل نفس ملف الإكسل (لن ينزل)`
            : `Profile ID (${profile.profileId}) duplicate inside file (skipped)`,
          diffs: [],
        };
      }
      if (nid && seenNationalIdsInFile.has(nid)) {
        return {
          index,
          raw,
          profile,
          action: "skip",
          statusReason: ar
            ? `الرقم القومي (${nid}) مكرر داخل نفس ملف الإكسل (لن ينزل)`
            : `National ID (${nid}) duplicate inside file (skipped)`,
          diffs: [],
        };
      }

      if (pId) seenProfileIdsInFile.add(pId);
      if (nid) seenNationalIdsInFile.add(nid);

      // Check 2: Match against existing database records
      const existing = (pId ? existingMaps.byProfileId.get(pId) : null) || (nid ? existingMaps.byNationalId.get(nid) : null);

      if (existing) {
        // Employee exists in database -> Compare fields for updates
        const diffs: ProfileFieldDiff[] = [];

        const checkDiff = (field: string, labelAr: string, labelEn: string, rawVal: any, extVal: any) => {
          const inc = rawVal !== undefined && rawVal !== null ? String(rawVal).trim() : "";
          const ext = extVal !== undefined && extVal !== null ? String(extVal).trim() : "";
          if (inc && inc !== "—" && inc !== ext) {
            diffs.push({
              field,
              labelAr,
              labelEn,
              oldValue: ext || "—",
              newValue: inc,
            });
          }
        };

        checkDiff("firstName", "الاسم الأول", "First Name", profile.firstName, existing.firstName);
        checkDiff("lastName", "اسم العائلة", "Last Name", profile.lastName, existing.lastName);
        checkDiff("thirdName", "الاسم الثالث", "Third Name", profile.thirdName, existing.thirdName);
        checkDiff("fourthName", "الاسم الرابع", "Fourth Name", profile.fourthName, existing.fourthName);
        checkDiff("department", "القسم", "Department", profile.department, existing.department);
        checkDiff("jobTitle", "الوظيفة", "Job Title", profile.jobTitle, existing.jobTitle);
        checkDiff("level", "الدرجة", "Level", profile.level, existing.level);
        checkDiff("nationality", "الجنسية", "Nationality", profile.nationality, existing.nationality);
        if (profile.gender && (profile.gender === "M" || profile.gender === "F") && profile.gender !== existing.gender) {
          diffs.push({
            field: "gender",
            labelAr: "النوع",
            labelEn: "Gender",
            oldValue: existing.gender || "M",
            newValue: profile.gender,
          });
        }
        checkDiff("phone", "الهاتف", "Phone", profile.phone, existing.phone);
        checkDiff("email", "البريد الإلكتروني", "Email", profile.email, existing.email);
        checkDiff("emergencyContact", "طوارئ", "Emergency Contact", profile.emergencyContact, existing.emergencyContact);
        checkDiff("companyName", "الشركة", "Company", profile.companyName, existing.companyName);
        checkDiff("employmentType", "نوع التوظيف", "Employment Type", profile.employmentType, existing.employmentType);
        checkDiff("hireDate", "تاريخ التعيين", "Hire Date", profile.hireDate, existing.hireDate);
        checkDiff("contractEndDate", "انتهاء العقد", "Contract End Date", profile.contractEndDate, existing.contractEndDate);
        checkDiff("dateOfBirth", "تاريخ الميلاد", "Date of Birth", profile.dateOfBirth, existing.dateOfBirth);
        checkDiff("address", "العنوان", "Address", profile.address, existing.address);

        if (nid && nid !== existing.nationalId) {
          diffs.push({
            field: "nationalId",
            labelAr: "الرقم القومي",
            labelEn: "National ID",
            oldValue: existing.nationalId || "—",
            newValue: nid,
          });
        }

        if (diffs.length > 0) {
          return {
            index,
            raw,
            profile,
            action: "update",
            statusReason: ar
              ? `تحديث ${diffs.length} حقل: ${diffs.map((d) => d.labelAr).join("، ")}`
              : `Update ${diffs.length} fields: ${diffs.map((d) => d.labelEn).join(", ")}`,
            diffs,
          };
        } else {
          // Identical duplicate -> Skip safely!
          return {
            index,
            raw,
            profile,
            action: "skip",
            statusReason: ar
              ? "سجل مكرر ومطابق تماماً في النظام (لن ينزل)"
              : "Identical duplicate record in system (skipped)",
            diffs: [],
          };
        }
      }

      // Check 3: New Profile -> Create!
      return {
        index,
        raw,
        profile,
        action: "create",
        statusReason: ar ? "موظف جديد (سيتم إضافته)" : "New employee (will be created)",
        diffs: [],
      };
    });
  }, [allParsedRows, existingMaps, ar]);

  const createRows = useMemo(() => analyzedRows.filter((r) => r.action === "create"), [analyzedRows]);
  const updateRows = useMemo(() => analyzedRows.filter((r) => r.action === "update"), [analyzedRows]);
  const skipRows = useMemo(() => analyzedRows.filter((r) => r.action === "skip"), [analyzedRows]);
  const actionableRows = useMemo(() => analyzedRows.filter((r) => r.action === "create" || r.action === "update"), [analyzedRows]);

  // Filtered rows for the preview table
  const displayedPreviewRows = useMemo(() => {
    let list = analyzedRows;
    if (previewFilter === "create") {
      list = createRows;
    } else if (previewFilter === "update") {
      list = updateRows;
    } else if (previewFilter === "skip") {
      list = skipRows;
    }

    if (!previewSearch.trim()) return list;
    const q = previewSearch.trim().toLowerCase();
    return list.filter((r) => {
      const p = r.profile;
      const fullName = `${p.firstName} ${p.lastName} ${p.thirdName} ${p.fourthName}`.toLowerCase();
      return (
        fullName.includes(q) ||
        p.profileId.toLowerCase().includes(q) ||
        p.nationalId.includes(q) ||
        p.phone.includes(q) ||
        p.department.toLowerCase().includes(q) ||
        (r.statusReason && r.statusReason.toLowerCase().includes(q))
      );
    });
  }, [analyzedRows, createRows, updateRows, skipRows, previewFilter, previewSearch]);

  // Execute the import with processing feedback
  const handleStartImport = async () => {
    if (actionableRows.length === 0) {
      toast.error(
        ar
          ? "لا توجد تعديلات أو سجلات جديدة للاستيراد. جميع السجلات بالملف مكررة ومطابقة للبيانات الحالية."
          : "No changes or new profiles to import. All rows are identical duplicates.",
      );
      return;
    }

    setStep("processing");
    setProgressPercent(10);
    setProgressStage(ar ? "جاري تدقيق ومطابقة السجلات مع قاعدة البيانات..." : "Matching records with database...");

    // Smooth simulated progress while sending request
    const interval = setInterval(() => {
      setProgressPercent((prev) => {
        if (prev < 80) return prev + Math.floor(Math.random() * 8) + 4;
        return prev;
      });
    }, 350);

    try {
      setTimeout(() => {
        setProgressStage(
          ar
            ? `تصفية واستبعاد ${skipRows.length} سجل مكرر ومطابق لمنع تكرار البيانات...`
            : `Filtering ${skipRows.length} duplicate records...`,
        );
      }, 600);

      setTimeout(() => {
        setProgressStage(
          ar
            ? `جاري حفظ وإدخال ${createRows.length} ملف شخصي جديد وتحديث ${updateRows.length} موظف...`
            : `Inserting ${createRows.length} new profiles and updating ${updateRows.length} existing...`,
        );
      }, 1300);

      const payload = actionableRows.map((r) => r.profile);
      const res = await fetch(`/api/profiles/bulk?propertyId=${propertyId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          profiles: payload,
          propertyId,
        }),
      });

      clearInterval(interval);

      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || (ar ? "فشل الاستيراد" : "Import failed"));
      }

      const data = await res.json();
      setProgressPercent(95);
      setProgressStage(ar ? "تحديث حسابات البوابة وسجلات النشاط..." : "Finalizing portal accounts...");

      await new Promise((r) => setTimeout(r, 500));
      setProgressPercent(100);
      setProgressStage(ar ? "اكتملت العملية بنجاح!" : "Import completed successfully!");

      const allSkippedCombined: SkippedItem[] = [
        ...skipRows.map((s) => ({
          profileId: s.profile.profileId,
          name: [s.profile.firstName, s.profile.lastName, s.profile.thirdName, s.profile.fourthName].filter(Boolean).join(" "),
          nationalId: s.profile.nationalId,
          phone: s.profile.phone,
          reason: s.statusReason,
        })),
        ...(data.skippedItems || []).filter(
          (srvSkip: any) =>
            !skipRows.some(
              (cl) => cl.profile.profileId?.toLowerCase() === srvSkip.profileId?.toLowerCase(),
            ),
        ),
      ];

      const allUpdatedList: UpdatedItem[] = updateRows.map((u) => ({
        profileId: u.profile.profileId,
        name: [u.profile.firstName, u.profile.lastName, u.profile.thirdName, u.profile.fourthName].filter(Boolean).join(" "),
        nationalId: u.profile.nationalId,
        diffsSummary: u.diffs
          .map((d) => (ar ? `${d.labelAr}: ${d.oldValue} ➔ ${d.newValue}` : `${d.labelEn}: ${d.oldValue} ➔ ${d.newValue}`))
          .join(" | "),
      }));

      setImportResult({
        total: allParsedRows.length,
        success: data.success ?? (createRows.length + updateRows.length),
        created: data.created ?? createRows.length,
        updated: data.updated ?? updateRows.length,
        skipped: allSkippedCombined.length,
        skippedItems: allSkippedCombined,
        updatedItems: allUpdatedList,
      });

      if (onImportSuccess) {
        onImportSuccess();
      }

      setStep("result");
    } catch (err: any) {
      clearInterval(interval);
      setStep("upload");
      toast.error(err?.message || (ar ? "فشل الاستيراد" : "Import failed"));
    }
  };

  // Download skipped duplicates as Excel
  const downloadSkippedDuplicatesExcel = () => {
    if (!importResult || importResult.skippedItems.length === 0) return;

    const exportRows = importResult.skippedItems.map((item, idx) => ({
      "م": idx + 1,
      "كود الموظف (Profile Code)": item.profileId || "—",
      "اسم الموظف (Name)": item.name || "—",
      "الرقم القومي (National ID)": item.nationalId || "—",
      "رقم الهاتف (Phone)": item.phone || "—",
      "سبب الاستبعاد (Reason)": item.reason,
    }));

    const ws = XLSX.utils.json_to_sheet(exportRows);
    ws["!cols"] = [
      { wch: 6 },
      { wch: 25 },
      { wch: 30 },
      { wch: 25 },
      { wch: 20 },
      { wch: 50 },
    ];

    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Skipped_Duplicates");
    XLSX.writeFile(wb, `skipped_duplicates_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success(ar ? "تم تنزيل تقرير السجلات المكررة بنجاح" : "Downloaded duplicates report");
  };

  const reset = () => {
    setAllParsedRows([]);
    setFileName("");
    setParseError("");
    setStep("upload");
    setPreviewFilter("all");
    setPreviewSearch("");
    setProgressPercent(0);
    setProgressStage("");
    setImportResult(null);
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && step !== "processing" && reset()}>
      <DialogContent
        className="max-w-5xl max-h-[92vh] overflow-y-auto"
        srTitle={ar ? "استيراد وتحديث ملفات الموظفين من إكسل" : "Import & Update Profiles from Excel"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-600" />
            {ar ? "استيراد وتحديث ملفات الموظفين (Create & Update)" : "Import & Update Profiles from Excel"}
          </DialogTitle>
        </DialogHeader>

        {/* ── STEP 1: UPLOAD & PREVIEW ────────────────────────────────────────────── */}
        {step === "upload" && (
          <div className="space-y-4">
            {/* Step 1: Download Template */}
            <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-1">
                    {ar ? "الخطوة 1: تحميل قالب Excel الإرشادي" : "Step 1: Download Excel Template"}
                  </p>
                  <p className="text-xs text-blue-600 dark:text-blue-400">
                    {ar
                      ? "يدعم النظام الاستيراد الذكي (Smart Upsert): الموظفون الجدد يضافون تلقائياً، والمسجلون مسبقاً يتم تحديث بياناتهم، والسجلات المتطابقة يتم تخطيها تلقائياً."
                      : "Supports Smart Upsert: New profiles are inserted, existing profiles updated, and duplicate records safely skipped."}
                  </p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadTemplate}
                  className="shrink-0 border-blue-200 text-blue-700 hover:bg-blue-100 dark:border-blue-800 dark:text-blue-300"
                >
                  <Download className="w-4 h-4 mr-2 rtl:ml-2 rtl:mr-0" />
                  {ar ? "تحميل القالب المعتمد" : "Download Template"}
                </Button>
              </div>
            </div>

            {/* Step 2: Upload File */}
            <div className="p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors">
              <p className="text-sm font-semibold mb-2">
                {ar ? "الخطوة 2: اختيار ورفع ملف إكسل" : "Step 2: Choose and Upload Excel File"}
              </p>
              <input
                ref={fileRef}
                type="file"
                accept=".xlsx,.xls"
                onChange={handleFile}
                className="hidden"
              />
              <div className="flex flex-wrap items-center gap-3">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => fileRef.current?.click()}
                  className="gap-2"
                >
                  <Upload className="w-4 h-4" />
                  {ar ? "اختر ملف إكسل من جهازك" : "Select Excel File"}
                </Button>

                {fileName && (
                  <span className="text-sm text-muted-foreground flex items-center gap-2 px-3 py-1 bg-muted rounded-lg">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600 shrink-0" />
                    <span className="truncate max-w-xs">{fileName}</span>
                    <button
                      onClick={() => {
                        setAllParsedRows([]);
                        setFileName("");
                      }}
                      className="text-muted-foreground hover:text-destructive"
                      title={ar ? "إلغاء الملف" : "Clear file"}
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </span>
                )}

                {isCheckingDuplicates && (
                  <span className="text-xs text-muted-foreground flex items-center gap-1.5 animate-pulse">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-primary" />
                    {ar ? "جاري مطابقة المعرفات وقاعدة البيانات..." : "Matching database identifiers..."}
                  </span>
                )}
              </div>

              {parseError && (
                <p className="text-sm text-destructive mt-2.5 flex items-center gap-1.5 bg-destructive/10 p-2.5 rounded-lg">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {parseError}
                </p>
              )}
            </div>

            {/* Step 3: Analysis Summary & Preview */}
            {allParsedRows.length > 0 && (
              <div className="space-y-3 pt-2">
                {/* 4 Statistics Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl border bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">
                      {ar ? "إجمالي السجلات بالملف" : "Total in File"}
                    </div>
                    <div className="text-2xl font-bold font-mono">
                      {allParsedRows.length}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
                    <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium flex items-center gap-1 mb-1">
                      <PlusCircle className="w-3.5 h-3.5" />
                      {ar ? "إضافة جديد (Create)" : "To Create (New)"}
                    </div>
                    <div className="text-2xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                      {createRows.length}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
                    <div className="text-xs text-blue-700 dark:text-blue-400 font-medium flex items-center gap-1 mb-1">
                      <RefreshCw className="w-3.5 h-3.5" />
                      {ar ? "تحديث بيانات (Update)" : "To Update"}
                    </div>
                    <div className="text-2xl font-bold font-mono text-blue-700 dark:text-blue-400">
                      {updateRows.length}
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${skipRows.length > 0 ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800" : "border-muted bg-muted/20"}`}>
                    <div className={`text-xs font-medium flex items-center gap-1 mb-1 ${skipRows.length > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {ar ? "مكرر ومطابق (لن ينزل)" : "Duplicates (Skip)"}
                    </div>
                    <div className={`text-2xl font-bold font-mono ${skipRows.length > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {skipRows.length}
                    </div>
                  </div>
                </div>

                {/* Duplicates Notice */}
                {skipRows.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {ar
                          ? `تنبيه التكرارات: تم العثور على ${skipRows.length} سجل مكرر ومطابق.`
                          : `Duplicates Alert: Found ${skipRows.length} duplicate records.`}
                      </span>{" "}
                      {ar
                        ? "هذه السجلات مطابقة تماماً للمسجل بالنظام أو مكررة في الملف، وسيتم تخطيها تلقائياً ولن يتم تكرارها."
                        : "These records are identical to existing data or duplicate in file, and will be safely skipped."}
                    </div>
                  </div>
                )}

                {/* Table Filters & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg text-xs w-fit overflow-x-auto">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("all")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${previewFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? `الكل (${allParsedRows.length})` : `All (${allParsedRows.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("create")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${previewFilter === "create" ? "bg-background text-emerald-700 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? `إضافة جديد (${createRows.length})` : `New (${createRows.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("update")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${previewFilter === "update" ? "bg-background text-blue-700 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? `تحديث (${updateRows.length})` : `Update (${updateRows.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("skip")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${previewFilter === "skip" ? "bg-background text-amber-800 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? `مكرر ومطابق (${skipRows.length})` : `Duplicates (${skipRows.length})`}
                    </button>
                  </div>

                  <div className="relative w-full sm:w-64">
                    <Search className="w-3.5 h-3.5 absolute left-2.5 rtl:right-2.5 rtl:left-auto top-2.5 text-muted-foreground" />
                    <Input
                      placeholder={ar ? "بحث في السجلات..." : "Search preview..."}
                      value={previewSearch}
                      onChange={(e) => setPreviewSearch(e.target.value)}
                      className="h-8 text-xs pl-8 rtl:pr-8 rtl:pl-2"
                    />
                  </div>
                </div>

                {/* Preview Table */}
                <div className="border rounded-xl overflow-hidden bg-card">
                  <div className="overflow-x-auto max-h-72">
                    <table className="w-full text-xs">
                      <thead className="bg-muted/60 sticky top-0 z-10">
                        <tr>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الإجراء" : "Action"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "كود الموظف" : "Code"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الاسم" : "Full Name"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الرقم القومي" : "National ID"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الهاتف" : "Phone"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "القسم" : "Department"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الوظيفة" : "Job Title"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الدرجة" : "Level"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "تفاصيل التحديث / الحالة" : "Details / Status"}</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {displayedPreviewRows.slice(0, 100).map((row, i) => {
                          const p = row.profile;
                          const fullName = [p.firstName, p.lastName, p.thirdName, p.fourthName].filter(Boolean).join(" ");
                          return (
                            <tr
                              key={i}
                              className={
                                row.action === "update"
                                  ? "bg-blue-50/30 dark:bg-blue-950/15 hover:bg-blue-100/30"
                                  : row.action === "skip"
                                  ? "bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/40"
                                  : "hover:bg-muted/30"
                              }
                            >
                              <td className="p-2 whitespace-nowrap">
                                {row.action === "create" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/60 dark:text-emerald-300 dark:border-emerald-700 text-[10px] gap-1 font-semibold"
                                  >
                                    <PlusCircle className="w-3 h-3" />
                                    {ar ? "إضافة جديد" : "New"}
                                  </Badge>
                                )}
                                {row.action === "update" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-blue-50 text-blue-700 border-blue-300 dark:bg-blue-950/60 dark:text-blue-300 dark:border-blue-700 text-[10px] gap-1 font-semibold"
                                  >
                                    <RefreshCw className="w-3 h-3" />
                                    {ar ? "تحديث بيانات" : "Update"}
                                  </Badge>
                                )}
                                {row.action === "skip" && (
                                  <Badge
                                    variant="outline"
                                    className="bg-slate-100 text-slate-700 border-slate-300 dark:bg-slate-800 dark:text-slate-300 text-[10px] gap-1 font-semibold"
                                  >
                                    <AlertTriangle className="w-3 h-3 text-amber-600" />
                                    {ar ? "مكرر (لن ينزل)" : "Duplicate (Skip)"}
                                  </Badge>
                                )}
                              </td>
                              <td className="p-2 font-mono font-semibold whitespace-nowrap">
                                {p.profileId}
                              </td>
                              <td className="p-2 whitespace-nowrap font-medium">{fullName}</td>
                              <td className="p-2 font-mono whitespace-nowrap">{p.nationalId || "—"}</td>
                              <td className="p-2 font-mono whitespace-nowrap">{p.phone || "—"}</td>
                              <td className="p-2 whitespace-nowrap text-muted-foreground">{p.department}</td>
                              <td className="p-2 whitespace-nowrap text-muted-foreground">{p.jobTitle}</td>
                              <td className="p-2 whitespace-nowrap">{p.level}</td>
                              <td className="p-2">
                                {row.action === "update" ? (
                                  <div className="flex flex-wrap gap-1 max-w-xs">
                                    {row.diffs.map((d, idx) => (
                                      <span
                                        key={idx}
                                        className="text-[10px] bg-blue-100 dark:bg-blue-900/50 text-blue-900 dark:text-blue-200 px-1.5 py-0.5 rounded font-medium inline-flex items-center gap-1"
                                      >
                                        <span>{ar ? d.labelAr : d.labelEn}:</span>
                                        <span className="line-through text-muted-foreground text-[9px]">{d.oldValue}</span>
                                        <span>➔</span>
                                        <span className="font-semibold text-blue-700 dark:text-blue-300">{d.newValue}</span>
                                      </span>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-muted-foreground text-[11px] truncate max-w-xs block">
                                    {row.statusReason}
                                  </span>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>

                <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
                  <span>
                    {ar
                      ? `معاينة ${Math.min(displayedPreviewRows.length, 100)} من إجمالي ${displayedPreviewRows.length} سجل معروض`
                      : `Showing ${Math.min(displayedPreviewRows.length, 100)} of ${displayedPreviewRows.length} rows`}
                  </span>
                  <span>{ar ? "سيتم ربط الملفات بالسكن الحالي النشط" : "Profiles will be linked to active property"}</span>
                </div>
              </div>
            )}

            {/* Footer Buttons */}
            <div className="flex justify-end gap-2 pt-4 border-t">
              <Button variant="outline" onClick={reset}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button
                onClick={handleStartImport}
                disabled={allParsedRows.length === 0 || actionableRows.length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-semibold gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {actionableRows.length > 0
                  ? ar
                    ? `تنفيذ الاستيراد والتحديث (${actionableRows.length})`
                    : `Execute Import & Update (${actionableRows.length})`
                  : ar
                    ? "لا توجد تعديلات أو سجلات جديدة"
                    : "No Changes or New Profiles"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: PROCESSING SCREEN ────────────────────────────────────────────── */}
        {step === "processing" && (
          <div className="py-12 px-6 flex flex-col items-center justify-center space-y-6 text-center">
            {/* Spinning Indicator */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <FileSpreadsheet className="w-8 h-8 text-primary absolute inset-0 m-auto" />
            </div>

            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-bold">
                {ar ? "جاري معالجة وتحديث الملفات الشخصية..." : "Processing Profiles Import & Update..."}
              </h3>
              <p className="text-sm text-muted-foreground transition-all duration-300">
                {progressStage}
              </p>
            </div>

            {/* Progress Bar with Percentage */}
            <div className="w-full max-w-md space-y-2">
              <div className="flex justify-between items-center text-xs font-semibold">
                <span className="text-muted-foreground">{ar ? "نسبة الإنجاز" : "Progress"}</span>
                <span className="text-primary font-mono text-sm">{progressPercent}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-3 overflow-hidden">
                <div
                  className="bg-primary h-3 rounded-full transition-all duration-300 ease-out shadow-sm"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Real-time counters summary */}
            <div className="flex flex-wrap items-center justify-center gap-4 text-xs text-muted-foreground pt-2">
              <div>
                <span className="font-bold text-emerald-600 font-mono">{createRows.length}</span>{" "}
                {ar ? "ملف جديد للإضافة" : "to create"}
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div>
                <span className="font-bold text-blue-600 font-mono">{updateRows.length}</span>{" "}
                {ar ? "ملف للتحديث" : "to update"}
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div>
                <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">{skipRows.length}</span>{" "}
                {ar ? "مكرر مستبعد" : "duplicates skipped"}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              {ar ? "يرجى عدم إغلاق الصفحة حتى تكتمل المعالجة بأمان..." : "Please wait while records are safely processed..."}
            </p>
          </div>
        )}

        {/* ── STEP 3: RESULTS & REPORT SCREEN ────────────────────────────────────── */}
        {step === "result" && importResult && (
          <div className="space-y-5 py-2">
            {/* Header Status Card */}
            <div className="p-5 rounded-xl border bg-gradient-to-br from-emerald-50 to-background dark:from-emerald-950/20 dark:to-background border-emerald-200 dark:border-emerald-900 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start">
              <div className="w-12 h-12 rounded-full bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  {ar ? "اكتملت عملية الاستيراد والتحديث بنجاح!" : "Import & Update Completed Successfully!"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? `تم إضافة ${importResult.created} موظف جديد، وتحديث بيانات ${importResult.updated} موظف، واستبعاد ${importResult.skipped} سجل مكرر ومطابق لمنع تكرار البيانات.`
                    : `Created ${importResult.created} profiles, updated ${importResult.updated} profiles, and skipped ${importResult.skipped} duplicates.`}
                </p>
              </div>
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="p-4 rounded-xl border border-emerald-200 bg-emerald-50/50 dark:bg-emerald-950/20 dark:border-emerald-900">
                <div className="text-xs text-emerald-700 dark:text-emerald-400 font-medium mb-1 flex items-center gap-1.5">
                  <PlusCircle className="w-4 h-4" />
                  {ar ? "تمت الإضافة بنجاح" : "Successfully Added"}
                </div>
                <div className="text-3xl font-bold font-mono text-emerald-700 dark:text-emerald-400">
                  {importResult.created}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {ar ? "ملفات شخصية جديدة بالسكن" : "New profiles created"}
                </div>
              </div>

              <div className="p-4 rounded-xl border border-blue-200 bg-blue-50/50 dark:bg-blue-950/20 dark:border-blue-900">
                <div className="text-xs text-blue-700 dark:text-blue-400 font-medium mb-1 flex items-center gap-1.5">
                  <RefreshCw className="w-4 h-4" />
                  {ar ? "تم التحديث بنجاح" : "Successfully Updated"}
                </div>
                <div className="text-3xl font-bold font-mono text-blue-700 dark:text-blue-400">
                  {importResult.updated}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {ar ? "ملفات قائمة تم تحديث بياناتها" : "Existing profiles updated"}
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${importResult.skipped > 0 ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900" : "border-muted bg-muted/20"}`}>
                <div className={`text-xs font-medium mb-1 flex items-center gap-1.5 ${importResult.skipped > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                  <AlertTriangle className="w-4 h-4" />
                  {ar ? "مكررات تم تخطيها" : "Duplicates Skipped"}
                </div>
                <div className={`text-3xl font-bold font-mono ${importResult.skipped > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {importResult.skipped}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {ar ? "لم تنزل لمنع تكرار البيانات" : "Not added to prevent duplicates"}
                </div>
              </div>
            </div>

            {/* Results Details Tabs: Skipped vs Updated */}
            <div className="space-y-3 pt-2">
              <div className="flex items-center justify-between border-b pb-2">
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setResultTab("skipped")}
                    className={`text-xs font-bold pb-1 transition-colors ${resultTab === "skipped" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {ar ? `المكررات المستبعدة (${importResult.skippedItems.length})` : `Skipped Duplicates (${importResult.skippedItems.length})`}
                  </button>
                  <button
                    type="button"
                    onClick={() => setResultTab("updated")}
                    className={`text-xs font-bold pb-1 transition-colors ${resultTab === "updated" ? "text-primary border-b-2 border-primary" : "text-muted-foreground hover:text-foreground"}`}
                  >
                    {ar ? `السجلات المحدثة (${importResult.updatedItems.length})` : `Updated Profiles (${importResult.updatedItems.length})`}
                  </button>
                </div>

                {resultTab === "skipped" && importResult.skippedItems.length > 0 && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSkippedDuplicatesExcel}
                    className="gap-2 text-xs border-amber-200 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
                  >
                    <FileDown className="w-3.5 h-3.5" />
                    {ar ? "تنزيل تقرير المكررات (Excel)" : "Download Duplicates (Excel)"}
                  </Button>
                )}
              </div>

              {/* Tab 1: Skipped Duplicates */}
              {resultTab === "skipped" && (
                <div className="border rounded-xl overflow-hidden bg-card">
                  {importResult.skippedItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      {ar ? "لا توجد سجلات مكررة تم استبعادها." : "No duplicate records were skipped."}
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0 z-10">
                          <tr>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "كود الموظف" : "Code"}</th>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الاسم" : "Name"}</th>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الرقم القومي" : "National ID"}</th>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الهاتف" : "Phone"}</th>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "سبب الاستبعاد" : "Reason"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importResult.skippedItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/30">
                              <td className="p-2 font-mono font-semibold whitespace-nowrap">{item.profileId || "—"}</td>
                              <td className="p-2 whitespace-nowrap font-medium">{item.name || "—"}</td>
                              <td className="p-2 font-mono whitespace-nowrap">{item.nationalId || "—"}</td>
                              <td className="p-2 font-mono whitespace-nowrap">{item.phone || "—"}</td>
                              <td className="p-2 whitespace-nowrap">
                                <Badge
                                  variant="outline"
                                  className="bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 text-[10px]"
                                >
                                  {item.reason}
                                </Badge>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Tab 2: Updated Profiles */}
              {resultTab === "updated" && (
                <div className="border rounded-xl overflow-hidden bg-card">
                  {importResult.updatedItems.length === 0 ? (
                    <div className="p-6 text-center text-xs text-muted-foreground">
                      {ar ? "لم يتم تحديث أي موظف (جميع السجلات كانت جديدة أو مكررة مطابقة)." : "No existing profiles were updated."}
                    </div>
                  ) : (
                    <div className="overflow-x-auto max-h-60">
                      <table className="w-full text-xs">
                        <thead className="bg-muted/60 sticky top-0 z-10">
                          <tr>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "كود الموظف" : "Code"}</th>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الاسم" : "Name"}</th>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الرقم القومي" : "National ID"}</th>
                            <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "التحديثات المنفذة" : "Applied Changes"}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {importResult.updatedItems.map((item, idx) => (
                            <tr key={idx} className="hover:bg-muted/30">
                              <td className="p-2 font-mono font-semibold whitespace-nowrap text-blue-700 dark:text-blue-400">{item.profileId || "—"}</td>
                              <td className="p-2 whitespace-nowrap font-medium">{item.name || "—"}</td>
                              <td className="p-2 font-mono whitespace-nowrap">{item.nationalId || "—"}</td>
                              <td className="p-2 text-muted-foreground font-mono text-[11px] leading-relaxed">
                                {item.diffsSummary}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Bottom Final Actions */}
            <div className="flex justify-between items-center pt-4 border-t">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep("upload");
                  setAllParsedRows([]);
                  setFileName("");
                  setImportResult(null);
                }}
                className="text-xs gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                {ar ? "استيراد ملف إكسل آخر" : "Import another file"}
              </Button>

              <Button
                onClick={() => {
                  reset();
                  toast.success(
                    ar
                      ? `تمت إضافة ${importResult.created} وتحديث ${importResult.updated} بنجاح`
                      : `Added ${importResult.created} and updated ${importResult.updated} profiles`,
                  );
                }}
                className="bg-primary text-primary-foreground font-semibold px-6"
              >
                {ar ? "تم وإنهاء" : "Done"}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
