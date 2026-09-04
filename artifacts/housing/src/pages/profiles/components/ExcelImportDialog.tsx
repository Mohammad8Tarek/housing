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

  const downloadTemplate = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      [
        "Profile_Code",
        "First_Name",
        "Second_Name",
        "Third_Name",
        "Fourth_Name",
        "Department",
        "Job_Title",
        "Level",
        "Nationality",
        "Gender",
        "National_ID",
        "Phone",
        "Hire_Date",
        "Contract_End_Date",
        "Date_Of_Birth",
        "Address",
      ],
      [
        "EMP-001",
        "Ahmed",
        "Al-Said",
        "Omar",
        "Hassan",
        "IT",
        "Developer",
        "1",
        "Saudi",
        "M",
        "1234567890",
        "+966501234567",
        "2024-01-01",
        "2026-01-01",
        "1990-01-01",
        "Riyadh",
      ],
      [
        "EMP-002",
        "Fatima",
        "Hassan",
        "Ali",
        "Sayed",
        "HR",
        "HR Specialist",
        "2",
        "Egyptian",
        "F",
        "0987654321",
        "+966507654321",
        "2024-03-15",
        "2026-03-15",
        "1995-05-15",
        "Jeddah",
      ],
    ]);
    ws["!cols"] = Array(16).fill({ wch: 18 });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Profiles");
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
    const rows: ProfileForm[] = preview.map((r: any) => ({
      profileId: String(r.Profile_Code || ""),
      firstName: String(r.First_Name || ""),
      lastName: String(r.Second_Name || r.Last_Name || ""),
      thirdName: String(r.Third_Name || ""),
      fourthName: String(r.Fourth_Name || ""),
      department: String(r.Department || ""),
      jobTitle: String(r.Job_Title || ""),
      nationality: String(r.Nationality || ""),
      gender: String(r.Gender || "M").toUpperCase() === "F" ? "F" : "M",
      nationalId: String(r.National_ID || ""),
      phone: String(r.Phone || ""),
      hireDate: String(r.Hire_Date || new Date().toISOString().split("T")[0]),
      contractEndDate:
        String(
          r.Contract_End_Date ||
            r.Contract_End ||
            r.contract_end_date ||
            r.contract_end ||
            "",
        ).trim() || undefined,
      level: String(r.Level ?? "").trim(),
      dateOfBirth: String(r.Date_Of_Birth || ""),
      address: String(r.Address || ""),
      status: "ACTIVE",
    }));
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
                          "First Name",
                          "Last Name",
                          "Dept",
                          "Job Title",
                          "Level",
                          "Nationality",
                          "Gender",
                          "National ID",
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
                      {preview.map((row: any, i) => (
                        <tr key={i} className="hover:bg-muted/20">
                          <td className="p-2 font-mono">
                            {String(row.Profile_Code || "")}
                          </td>
                          <td className="p-2">{String(row.First_Name || "")}</td>
                          <td className="p-2">
                            {String(row.Second_Name || row.Last_Name || "")}
                          </td>
                          <td className="p-2">{String(row.Department || "")}</td>
                          <td className="p-2">{String(row.Job_Title || "")}</td>
                          <td className="p-2 font-mono font-semibold">
                            {String(row.Level ?? "")}
                          </td>
                          <td className="p-2">{String(row.Nationality || "")}</td>
                          <td className="p-2">{String(row.Gender || "")}</td>
                          <td className="p-2 font-mono">
                            {String(row.National_ID || "")}
                          </td>
                          <td className="p-2 font-mono">
                            {String(
                              row.Contract_End_Date || row.Contract_End || "",
                            )}
                          </td>
                          <td className="p-2 font-mono">
                            {String(row.Date_Of_Birth || "")}
                          </td>
                        </tr>
                      ))}
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
