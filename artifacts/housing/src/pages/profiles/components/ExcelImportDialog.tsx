//@ts-nocheck
// @ts-nocheck
import { useState, useRef, useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import {
  useListProfiles,
  useCreateProfile,
  useDeleteProfile,
  useUpdateProfile,
  getListProfilesQueryKey,
} from "@workspace/api-client-react";
import { useProperty } from "@/context/PropertyContext";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { motion, AnimatePresence } from "framer-motion";
import { usePrefersReducedMotion } from "@/hooks/use-reduced-motion";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Link } from "wouter";
import {
  Eye,
  Trash2,
  Plus,
  Search,
  Users,
  AlertCircle,
  FileSpreadsheet,
  Pencil,
  Download,
  Upload,
  X,
  CheckCircle2,
  Camera,
  Key,
  ArrowRightLeft,
} from "lucide-react";
import { PermissionGate } from "@/components/ui/permission-gate";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  ColumnChooser,
  useColumnVisibility,
} from "@/components/ui/column-chooser";
import { BulkActionBar } from "@/components/ui/bulk-action-bar";
import { Checkbox } from "@/components/ui/checkbox";
import { Card, CardContent } from "@/components/ui/card";
import * as XLSX from "xlsx";
import { DataPagination } from "@/components/DataPagination";
import { PaginationBar } from "@/components/ui/PaginationBar";

const MAX_PROFILE_IMPORT_FILE_SIZE = 1024 * 1024;
const PROFILE_IMPORT_EXTENSIONS = [".xlsx", ".xls"];

/* ── Profile Photo Avatar ──────────────────────────────────────────────── */
export function ExcelImportDialog({
  propertyId,
  isOpen,
  onClose,
  onImport,
  isImporting,
}: {
  propertyId: number;
  isOpen: boolean;
  onClose: () => void;
  onImport: (rows: ProfileForm[]) => void;
  isImporting: boolean;
}) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [parseError, setParseError] = useState("");

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
      ["Profile_Code", "Yes (نعم)", "Text (e.g. EMP-001, 105)", "Unique employee / profile ID (كود الموظف التعريفي الفريد)"],
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
      ["National_ID", "Yes (نعم)", "Text / Number", "National ID / Iqama / Passport (رقم الهوية أو الإقامة أو الجواز)"],
      ["Phone", "No (اختياري)", "Text / Phone Number", "Mobile / Phone number (رقم الجوال)"],
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
      setParseError(ar ? "نوع الملف غير مدعوم" : "Unsupported file type");
      e.target.value = "";
      return;
    }
    if (file.size > MAX_PROFILE_IMPORT_FILE_SIZE) {
      setParseError(
        ar
          ? "الملف كبير جداً. الحد الأقصى 1 ميغابايت"
          : "File is too large. Maximum size is 1 MB",
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
          sheetRows: 101,
        });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<ImportRow>(ws, { defval: "" });
        if (rows.length === 0) {
          setParseError(ar ? "الملف فارغ" : "File is empty");
          return;
        }
        setPreview(rows.slice(0, 100));
      } catch {
        setParseError(ar ? "فشل في قراءة الملف" : "Failed to parse file");
      }
    };
    reader.readAsBinaryString(file);
    e.target.value = "";
  };

  const handleImport = () => {
    const rows: ProfileForm[] = preview.map((r: any) => {
      const pId = String(
        r.Profile_Code || r.profileId || r.Code || r["الكود"] || r["كود الموظف"] || r["رقم الملف"] || "",
      ).trim();
      const fn = String(r.First_Name || r.firstName || r["الاسم الأول"] || r["الاسم"] || "").trim();
      const ln = String(
        r.Second_Name || r.lastName || r.Last_Name || r["الاسم الثاني"] || r["اسم العائلة"] || r["اللقب"] || "",
      ).trim();
      const tn = String(r.Third_Name || r.thirdName || r["الاسم الثالث"] || "").trim();
      const fourN = String(r.Fourth_Name || r.fourthName || r["الاسم الرابع"] || "").trim();
      const rawEmp = r.Employment_Type || r.employmentType || r["نوع التوظيف"] || r["نوع العمل"];
      const empType = parseEmploymentType(rawEmp);
      const comp = String(
        r.Company_Name || r.companyName || r.Workplace || r.workplace || r["الشركة"] || r["مكان العمل"] || r["جهة العمل"] || "",
      ).trim();
      const dept = String(r.Department || r.department || r["القسم"] || r["الإدارة"] || "").trim();
      const title = String(r.Job_Title || r.jobTitle || r["الوظيفة"] || r["المسمى الوظيفي"] || "").trim();
      const lvl = String(r.Level ?? r.level ?? r["الدرجة"] ?? "").trim();
      const nat = String(r.Nationality || r.nationality || r["الجنسية"] || "").trim();
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
        firstName: fn,
        lastName: ln,
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
    });
    onImport(rows);
  };

  const reset = () => {
    setPreview([]);
    setFileName("");
    setParseError("");
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={(v) => !v && reset()}>
      <DialogContent
        className="max-w-5xl max-h-[90vh] overflow-y-auto"
        srTitle={ar ? "استيراد ملفات شخصية من إكسل" : "Import Profiles from Excel"}
      >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-green-600" />
            {ar ? "استيراد ملفات شخصية من إكسل" : "Import Profiles from Excel"}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Step 1: Download Template */}
          <div className="p-4 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-100 dark:border-blue-900">
            <p className="text-sm font-semibold text-blue-800 dark:text-blue-300 mb-2">
              {ar ? "الخطوة 1: تحميل قالب Excel" : "Step 1: Download Template"}
            </p>
            <p className="text-xs text-blue-600 dark:text-blue-400 mb-3">
              {ar
                ? "قم بتحميل القالب، واملأ بيانات الملفات الشخصية، ثم ارفعه مرة أخرى"
                : "Download the template, fill in profile data, then upload it back"}
            </p>
            <Button
              variant="outline"
              size="sm"
              onClick={downloadTemplate}
              className="border-blue-200 text-blue-700 hover:bg-blue-100"
            >
              <Download className="w-4 h-4 mr-2" />
              {ar ? "تحميل قالب Excel" : "Download Excel Template"}
            </Button>
          </div>

          {/* Step 2: Upload */}
          <div className="p-4 rounded-xl border-2 border-dashed border-border hover:border-primary/40 transition-colors">
            <p className="text-sm font-semibold mb-2">
              {ar ? "الخطوة 2: رفع الملف" : "Step 2: Upload File"}
            </p>
            <input
              ref={fileRef}
              type="file"
              accept=".xlsx,.xls"
              onChange={handleFile}
              className="hidden"
            />
            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                onClick={() => fileRef.current?.click()}
              >
                <Upload className="w-4 h-4 mr-2" />
                {ar ? "اختر ملف إكسل" : "Choose Excel File"}
              </Button>
              {fileName && (
                <span className="text-sm text-muted-foreground flex items-center gap-1.5">
                  <FileSpreadsheet className="w-4 h-4 text-green-600" />
                  {fileName}
                  <button
                    onClick={() => {
                      setPreview([]);
                      setFileName("");
                    }}
                    className="hover:text-destructive"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                </span>
              )}
            </div>
            {parseError && (
              <p className="text-sm text-destructive mt-2 flex items-center gap-1">
                <AlertCircle className="w-4 h-4" />
                {parseError}
              </p>
            )}
          </div>

          {/* Step 3: Preview */}
          {preview.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-semibold flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-green-600" />
                  {ar
                    ? `معاينة (${preview.length} ملف شخصي)`
                    : `Preview (${preview.length} profiles)`}
                </p>
              </div>
              <div className="border rounded-xl overflow-hidden">
                <div className="overflow-x-auto max-h-64">
                  <table className="w-full text-xs">
                    <thead className="bg-muted/50">
                      <tr>
                        {[
                          "Code",
                          "Full Name",
                          "Employment Type",
                          "Company / Workplace",
                          "Dept",
                          "Job Title",
                          "Level",
                          "Nationality",
                          "Gender",
                          "National ID",
                          "Phone",
                          "Email",
                          "Contract End",
                          "Date of Birth",
                        ].map((h) => (
                          <th
                            key={h}
                            className="p-2 text-left font-semibold text-muted-foreground whitespace-nowrap"
                          >
                            {h}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {preview.map((row: any, i) => {
                        const rawEmp = row.Employment_Type || row.employmentType || row["نوع التوظيف"] || row["نوع العمل"];
                        const empType = parseEmploymentType(rawEmp);
                        const comp = String(
                          row.Company_Name || row.companyName || row.Workplace || row.workplace || row["الشركة"] || row["مكان العمل"] || "",
                        ).trim();
                        const fullName = [
                          row.First_Name || row.firstName || "",
                          row.Second_Name || row.lastName || "",
                          row.Third_Name || row.thirdName || "",
                          row.Fourth_Name || row.fourthName || "",
                        ].filter(Boolean).join(" ");

                        return (
                          <tr key={i} className="hover:bg-muted/20">
                            <td className="p-2 font-mono font-semibold">
                              {String(row.Profile_Code || row.profileId || row.Code || "")}
                            </td>
                            <td className="p-2 whitespace-nowrap">{fullName}</td>
                            <td className="p-2">
                              <span
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold ${
                                  empType === "EXTERNAL"
                                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                                    : empType === "THIRD_PARTY"
                                    ? "bg-purple-100 text-purple-800 dark:bg-purple-950/40 dark:text-purple-300"
                                    : "bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-300"
                                }`}
                              >
                                {empType}
                              </span>
                            </td>
                            <td className="p-2 text-muted-foreground whitespace-nowrap">
                              {comp || "—"}
                            </td>
                            <td className="p-2">{String(row.Department || row.department || "")}</td>
                            <td className="p-2">{String(row.Job_Title || row.jobTitle || "")}</td>
                            <td className="p-2 font-mono font-semibold">
                              {String(row.Level ?? row.level ?? "")}
                            </td>
                            <td className="p-2">{String(row.Nationality || row.nationality || "")}</td>
                            <td className="p-2">{String(row.Gender || row.gender || "")}</td>
                            <td className="p-2 font-mono">
                              {String(row.National_ID || row.nationalId || "")}
                            </td>
                            <td className="p-2 font-mono">
                              {String(row.Phone || row.phone || "")}
                            </td>
                            <td className="p-2 text-muted-foreground">
                              {String(row.Email || row.email || "")}
                            </td>
                            <td className="p-2 font-mono">
                              {String(
                                row.Contract_End_Date || row.Contract_End || row.contractEndDate || "",
                              )}
                            </td>
                            <td className="p-2 font-mono">
                              {String(row.Date_Of_Birth || row.dateOfBirth || "")}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
              <p className="text-xs text-muted-foreground mt-1.5">
                {ar
                  ? "سيتم ربط جميع الملفات الشخصية بالسكن النشط الحالي"
                  : "All profiles will be linked to the current active property"}
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end gap-2 pt-4 border-t">
          <Button variant="outline" onClick={reset}>
            {ar ? "إلغاء" : "Cancel"}
          </Button>
          <Button
            onClick={handleImport}
            disabled={preview.length === 0 || isImporting}
            className="bg-green-600 hover:bg-green-700 text-white"
          >
            <FileSpreadsheet className="w-4 h-4 mr-2" />
            {isImporting
              ? ar
                ? "جاري الاستيراد..."
                : "Importing..."
              : ar
                ? `استيراد ${preview.length} ملف شخصي`
                : `Import ${preview.length} profiles`}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

/* ── Main Profiles Page ─────────────────────────────────────────────────── */
