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
} from "lucide-react";
import * as XLSX from "xlsx";

const MAX_PROFILE_IMPORT_FILE_SIZE = 25 * 1024 * 1024;
const PROFILE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

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

interface AnalyzedRow {
  index: number;
  raw: any;
  profile: ProfileImportRow;
  isDuplicate: boolean;
  duplicateReason?: string;
  duplicateField?: "profileId" | "nationalId" | "phone" | "in_file";
}

interface SkippedItem {
  profileId: string;
  name: string;
  nationalId: string;
  phone: string;
  reason: string;
}

interface ImportResult {
  total: number;
  success: number;
  skipped: number;
  skippedItems: SkippedItem[];
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

  // DB existing identifiers for fast client-side check
  const [existingIdentifiers, setExistingIdentifiers] = useState<{
    profileIds: Set<string>;
    nationalIds: Set<string>;
    phones: Set<string>;
  }>({
    profileIds: new Set(),
    nationalIds: new Set(),
    phones: new Set(),
  });

  // Preview filtering & search
  const [previewFilter, setPreviewFilter] = useState<"all" | "valid" | "duplicates">("all");
  const [previewSearch, setPreviewSearch] = useState("");

  // Processing state
  const [progressPercent, setProgressPercent] = useState(0);
  const [progressStage, setProgressStage] = useState("");
  const [importResult, setImportResult] = useState<ImportResult | null>(null);

  // Load existing identifiers when dialog opens
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
            const pIds = new Set<string>();
            const nIds = new Set<string>();
            const phones = new Set<string>();
            for (const r of data.profiles) {
              if (r.profileId) pIds.add(r.profileId.trim().toLowerCase());
              if (r.nationalId) nIds.add(r.nationalId.trim());
              if (r.phone) phones.add(r.phone.trim());
            }
            setExistingIdentifiers({ profileIds: pIds, nationalIds: nIds, phones: phones });
          }
        }
      } catch (err) {
        console.error("Error fetching existing identifiers:", err);
      } finally {
        if (isMounted) setIsCheckingDuplicates(false);
      }
    }
    fetchExisting();
    return () => {
      isMounted = false;
    };
  }, [isOpen, propertyId]);

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

  // Analyze all parsed rows for duplicates
  const analyzedRows = useMemo<AnalyzedRow[]>(() => {
    if (allParsedRows.length === 0) return [];

    const seenProfileIdsInFile = new Set<string>();
    const seenNationalIdsInFile = new Set<string>();
    const seenPhonesInFile = new Set<string>();

    return allParsedRows.map((raw, index) => {
      const profile = mapRawToProfile(raw, index);
      const pId = profile.profileId?.trim().toLowerCase();
      const nid = profile.nationalId?.trim();
      const ph = profile.phone?.trim();

      let isDuplicate = false;
      let duplicateReason = "";
      let duplicateField: "profileId" | "nationalId" | "phone" | "in_file" | undefined;

      // Check 1: Profile ID
      if (pId) {
        if (existingIdentifiers.profileIds.has(pId)) {
          isDuplicate = true;
          duplicateField = "profileId";
          duplicateReason = ar
            ? `كود الموظف (${profile.profileId}) مسجل مسبقاً في النظام`
            : `Profile ID (${profile.profileId}) already exists in system`;
        } else if (seenProfileIdsInFile.has(pId)) {
          isDuplicate = true;
          duplicateField = "in_file";
          duplicateReason = ar
            ? `كود الموظف (${profile.profileId}) مكرر داخل نفس ملف الإكسل`
            : `Profile ID (${profile.profileId}) duplicate inside file`;
        }
      }

      // Check 2: National ID
      if (!isDuplicate && nid) {
        if (existingIdentifiers.nationalIds.has(nid)) {
          isDuplicate = true;
          duplicateField = "nationalId";
          duplicateReason = ar
            ? `الرقم القومي (${nid}) مسجل مسبقاً في النظام`
            : `National ID (${nid}) already exists in system`;
        } else if (seenNationalIdsInFile.has(nid)) {
          isDuplicate = true;
          duplicateField = "in_file";
          duplicateReason = ar
            ? `الرقم القومي (${nid}) مكرر داخل نفس ملف الإكسل`
            : `National ID (${nid}) duplicate inside file`;
        }
      }

      // Check 3: Phone
      if (!isDuplicate && ph) {
        if (existingIdentifiers.phones.has(ph)) {
          isDuplicate = true;
          duplicateField = "phone";
          duplicateReason = ar
            ? `رقم الهاتف (${ph}) مسجل مسبقاً في النظام`
            : `Phone (${ph}) already exists in system`;
        } else if (seenPhonesInFile.has(ph)) {
          isDuplicate = true;
          duplicateField = "in_file";
          duplicateReason = ar
            ? `رقم الهاتف (${ph}) مكرر داخل نفس ملف الإكسل`
            : `Phone (${ph}) duplicate inside file`;
        }
      }

      if (!isDuplicate) {
        if (pId) seenProfileIdsInFile.add(pId);
        if (nid) seenNationalIdsInFile.add(nid);
        if (ph) seenPhonesInFile.add(ph);
      }

      return {
        index,
        raw,
        profile,
        isDuplicate,
        duplicateReason,
        duplicateField,
      };
    });
  }, [allParsedRows, existingIdentifiers, ar]);

  const validRows = useMemo(() => analyzedRows.filter((r) => !r.isDuplicate), [analyzedRows]);
  const duplicateRows = useMemo(() => analyzedRows.filter((r) => r.isDuplicate), [analyzedRows]);

  // Filtered rows for the preview table
  const displayedPreviewRows = useMemo(() => {
    let list = analyzedRows;
    if (previewFilter === "valid") {
      list = validRows;
    } else if (previewFilter === "duplicates") {
      list = duplicateRows;
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
        (r.duplicateReason && r.duplicateReason.toLowerCase().includes(q))
      );
    });
  }, [analyzedRows, validRows, duplicateRows, previewFilter, previewSearch]);

  // Execute the import with processing feedback
  const handleStartImport = async () => {
    if (validRows.length === 0) {
      toast.error(
        ar
          ? "لا توجد سجلات صالحة للاستيراد. جميع السجلات بالملف مكررة ومسجلة مسبقاً."
          : "No valid records to import. All rows are duplicates.",
      );
      return;
    }

    setStep("processing");
    setProgressPercent(10);
    setProgressStage(ar ? "جاري تدقيق السجلات والتأكد من مطابقة المعايير..." : "Validating records...");

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
            ? `تصفية واستبعاد ${duplicateRows.length} سجل مكرر لمنع تكرار البيانات...`
            : `Filtering ${duplicateRows.length} duplicate records...`,
        );
      }, 600);

      setTimeout(() => {
        setProgressStage(
          ar
            ? `جاري حفظ وإدخال ${validRows.length} ملف شخصي جديد في قاعدة البيانات...`
            : `Inserting ${validRows.length} new profiles into database...`,
        );
      }, 1300);

      const payload = validRows.map((r) => r.profile);
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

      // Combine client-side detected duplicates with any server-skipped items
      const allSkippedCombined: SkippedItem[] = [
        ...duplicateRows.map((d) => ({
          profileId: d.profile.profileId,
          name: `${d.profile.firstName} ${d.profile.lastName}`.trim() || d.profile.profileId,
          nationalId: d.profile.nationalId,
          phone: d.profile.phone,
          reason: d.duplicateReason || (ar ? "سجل مكرر" : "Duplicate record"),
        })),
        ...(data.skippedItems || []).filter(
          (s: any) =>
            !duplicateRows.some(
              (d) => d.profile.profileId?.toLowerCase() === s.profileId?.toLowerCase(),
            ),
        ),
      ];

      setImportResult({
        total: allParsedRows.length,
        success: data.success,
        skipped: allSkippedCombined.length,
        skippedItems: allSkippedCombined,
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
        srTitle={ar ? "استيراد ملفات شخصية من إكسل" : "Import Profiles from Excel"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            {ar ? "استيراد ملفات شخصية من إكسل" : "Import Profiles from Excel"}
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
                      ? "قم بتحميل القالب الجاهز، وتعبئة بيانات الموظفين، ثم رفعه مرة أخرى"
                      : "Download the pre-formatted template, fill in profiles data, and re-upload"}
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
                    <FileSpreadsheet className="w-4 h-4 text-green-600 shrink-0" />
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
                {/* Statistics Cards */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div className="p-3 rounded-xl border bg-muted/30">
                    <div className="text-xs text-muted-foreground mb-1">
                      {ar ? "إجمالي السجلات بالملف" : "Total in File"}
                    </div>
                    <div className="text-2xl font-bold font-mono">
                      {allParsedRows.length}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
                    <div className="text-xs text-green-700 dark:text-green-400 font-medium flex items-center gap-1 mb-1">
                      <CheckCircle2 className="w-3.5 h-3.5" />
                      {ar ? "جاهز للاستيراد (سجلات جديدة)" : "Ready to Import (New)"}
                    </div>
                    <div className="text-2xl font-bold font-mono text-green-700 dark:text-green-400">
                      {validRows.length}
                    </div>
                  </div>

                  <div className={`p-3 rounded-xl border ${duplicateRows.length > 0 ? "border-amber-300 bg-amber-50/60 dark:bg-amber-950/30 dark:border-amber-800" : "border-muted bg-muted/20"}`}>
                    <div className={`text-xs font-medium flex items-center gap-1 mb-1 ${duplicateRows.length > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {ar ? "مكررة (سيتم استبعادها)" : "Duplicates (Skipped)"}
                    </div>
                    <div className={`text-2xl font-bold font-mono ${duplicateRows.length > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                      {duplicateRows.length}
                    </div>
                  </div>
                </div>

                {/* Duplicates Notification Alert */}
                {duplicateRows.length > 0 && (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200 dark:border-amber-800 text-amber-900 dark:text-amber-200 flex items-start gap-2.5 text-xs">
                    <AlertTriangle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <span className="font-bold">
                        {ar
                          ? `تنبيه التكرارات: تم العثور على ${duplicateRows.length} سجل مكرر.`
                          : `Duplicate Warning: Found ${duplicateRows.length} duplicate records.`}
                      </span>{" "}
                      {ar
                        ? "سيتم استبعاد هذه السجلات تلقائياً ولن يتم إضافتها لمنع تكرار البيانات. سيتم فقط استيراد السجلات الصالحة (الخضراء)."
                        : "These records will be skipped automatically to prevent duplicates. Only clean, valid records will be imported."}
                    </div>
                  </div>
                )}

                {/* Table Filters & Search */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-1">
                  <div className="flex items-center gap-1.5 p-1 bg-muted rounded-lg text-xs w-fit">
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("all")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${previewFilter === "all" ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? `الكل (${allParsedRows.length})` : `All (${allParsedRows.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("valid")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${previewFilter === "valid" ? "bg-background text-green-700 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? `الصالحة فقط (${validRows.length})` : `Valid (${validRows.length})`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setPreviewFilter("duplicates")}
                      className={`px-3 py-1.5 rounded-md font-medium transition-colors ${previewFilter === "duplicates" ? "bg-background text-amber-800 shadow-sm font-semibold" : "text-muted-foreground hover:text-foreground"}`}
                    >
                      {ar ? `المكررات (${duplicateRows.length})` : `Duplicates (${duplicateRows.length})`}
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
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الحالة" : "Status"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "كود الموظف" : "Code"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الاسم" : "Full Name"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الرقم القومي" : "National ID"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الهاتف" : "Phone"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "القسم" : "Department"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "الوظيفة" : "Job Title"}</th>
                          <th className="p-2 text-start font-semibold text-muted-foreground whitespace-nowrap">{ar ? "نوع التوظيف" : "Employment"}</th>
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
                                row.isDuplicate
                                  ? "bg-amber-50/40 dark:bg-amber-950/20 hover:bg-amber-100/40"
                                  : "hover:bg-muted/30"
                              }
                            >
                              <td className="p-2 whitespace-nowrap">
                                {row.isDuplicate ? (
                                  <Badge
                                    variant="outline"
                                    className="bg-amber-100/80 text-amber-800 border-amber-300 dark:bg-amber-950/60 dark:text-amber-300 dark:border-amber-700 text-[10px] gap-1 font-semibold"
                                  >
                                    <AlertTriangle className="w-3 h-3" />
                                    {row.duplicateReason}
                                  </Badge>
                                ) : (
                                  <Badge
                                    variant="outline"
                                    className="bg-green-100 text-green-800 border-green-300 dark:bg-green-950/60 dark:text-green-300 dark:border-green-700 text-[10px] gap-1"
                                  >
                                    <Check className="w-3 h-3" />
                                    {ar ? "صالح للاستيراد" : "Ready"}
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
                              <td className="p-2 whitespace-nowrap">
                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-muted font-medium">
                                  {p.employmentType}
                                </span>
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
                  <span>{ar ? "سيتم حفظ الملفات بالسكن الحالي النشط" : "Profiles will be linked to active property"}</span>
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
                disabled={allParsedRows.length === 0 || validRows.length === 0}
                className="bg-green-600 hover:bg-green-700 text-white font-semibold gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                {validRows.length > 0
                  ? ar
                    ? `استيراد السجلات الصالحة فقط (${validRows.length})`
                    : `Import Valid Profiles Only (${validRows.length})`
                  : ar
                    ? "لا توجد سجلات صالحة"
                    : "No Valid Profiles"}
              </Button>
            </div>
          </div>
        )}

        {/* ── STEP 2: PROCESSING SCREEN (عملية البروسيسنج أثناء الرفع) ────────────────── */}
        {step === "processing" && (
          <div className="py-12 px-6 flex flex-col items-center justify-center space-y-6 text-center">
            {/* Spinning Indicator */}
            <div className="relative">
              <div className="w-20 h-20 rounded-full border-4 border-primary/20 border-t-primary animate-spin" />
              <FileSpreadsheet className="w-8 h-8 text-primary absolute inset-0 m-auto" />
            </div>

            <div className="space-y-2 max-w-md">
              <h3 className="text-lg font-bold">
                {ar ? "جاري معالجة ورفع الملفات الشخصية..." : "Processing Profiles Import..."}
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
            <div className="flex items-center justify-center gap-6 text-xs text-muted-foreground pt-2">
              <div>
                <span className="font-bold text-foreground font-mono">{validRows.length}</span>{" "}
                {ar ? "سجل صالح جاري إدخاله" : "valid records"}
              </div>
              <div className="w-1 h-1 rounded-full bg-muted-foreground" />
              <div>
                <span className="font-bold text-amber-700 dark:text-amber-400 font-mono">{duplicateRows.length}</span>{" "}
                {ar ? "سجل مكرر مستبعد" : "duplicates skipped"}
              </div>
            </div>

            <p className="text-[11px] text-muted-foreground italic">
              {ar ? "يرجى عدم إغلاق الصفحة حتى تكتمل المعالجة بأمان..." : "Please wait while records are safely saved..."}
            </p>
          </div>
        )}

        {/* ── STEP 3: RESULTS & REPORT SCREEN (تقرير النتائج والمكررات) ────────────────── */}
        {step === "result" && importResult && (
          <div className="space-y-5 py-2">
            {/* Header Status Card */}
            <div className="p-5 rounded-xl border bg-gradient-to-br from-green-50 to-background dark:from-green-950/20 dark:to-background border-green-200 dark:border-green-900 flex flex-col sm:flex-row items-center gap-4 text-center sm:text-start">
              <div className="w-12 h-12 rounded-full bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400 flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h3 className="text-base font-bold text-foreground">
                  {ar ? "اكتملت عملية الاستيراد بنجاح!" : "Import Completed Successfully!"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? `تم استيراد ${importResult.success} ملف شخصي جديد بنجاح${importResult.skipped > 0 ? `، وتم استبعاد ${importResult.skipped} سجل مكرر لمنع تكرار البيانات.` : "."}`
                    : `Successfully imported ${importResult.success} profiles${importResult.skipped > 0 ? ` and skipped ${importResult.skipped} duplicate records.` : "."}`}
                </p>
              </div>
            </div>

            {/* Stat Counters */}
            <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-xl border border-green-200 bg-green-50/50 dark:bg-green-950/20 dark:border-green-900">
                <div className="text-xs text-green-700 dark:text-green-400 font-medium mb-1 flex items-center gap-1.5">
                  <CheckCircle2 className="w-4 h-4" />
                  {ar ? "تمت الإضافة بنجاح" : "Successfully Added"}
                </div>
                <div className="text-3xl font-bold font-mono text-green-700 dark:text-green-400">
                  {importResult.success}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {ar ? "ملفات شخصية جديدة في السكن" : "New profiles inserted"}
                </div>
              </div>

              <div className={`p-4 rounded-xl border ${importResult.skipped > 0 ? "border-amber-300 bg-amber-50/50 dark:bg-amber-950/20 dark:border-amber-900" : "border-muted bg-muted/20"}`}>
                <div className={`text-xs font-medium mb-1 flex items-center gap-1.5 ${importResult.skipped > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                  <AlertTriangle className="w-4 h-4" />
                  {ar ? "سجلات مكررة تم استبعادها" : "Duplicates Skipped"}
                </div>
                <div className={`text-3xl font-bold font-mono ${importResult.skipped > 0 ? "text-amber-800 dark:text-amber-400" : "text-muted-foreground"}`}>
                  {importResult.skipped}
                </div>
                <div className="text-[11px] text-muted-foreground mt-1">
                  {ar ? "لم يتم إضافتها لمنع التكرار" : "Not inserted to prevent duplicates"}
                </div>
              </div>
            </div>

            {/* Skipped Items Detailed Report */}
            {importResult.skippedItems.length > 0 && (
              <div className="space-y-3 pt-2">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <h4 className="text-xs font-bold uppercase tracking-wide text-muted-foreground flex items-center gap-1.5">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    {ar ? "تفاصيل السجلات المكررة المستبعدة" : "Skipped Duplicates Details"}
                  </h4>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={downloadSkippedDuplicatesExcel}
                    className="gap-2 text-xs border-amber-200 text-amber-900 hover:bg-amber-100 dark:border-amber-800 dark:text-amber-300"
                  >
                    <FileDown className="w-4 h-4" />
                    {ar ? "تنزيل تقرير المكررات (Excel)" : "Download Duplicates (Excel)"}
                  </Button>
                </div>

                <div className="border rounded-xl overflow-hidden bg-card">
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
                </div>
              </div>
            )}

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
                      ? `تم استيراد ${importResult.success} ملف شخصي بنجاح`
                      : `Imported ${importResult.success} profiles`,
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
