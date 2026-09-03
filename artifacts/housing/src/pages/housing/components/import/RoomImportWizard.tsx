// @ts-nocheck
import { useState, useMemo, useRef } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useLocation } from "wouter";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Upload,
  FileSpreadsheet,
  CheckCircle2,
  AlertTriangle,
  XCircle,
  ArrowRight,
  ArrowLeft,
  Building2,
  RefreshCw,
  Download,
  Check,
  Eye,
  Settings2,
  Layers,
  Sparkles,
  Save,
  Search,
  Filter,
} from "lucide-react";
import {
  SYSTEM_FIELDS,
  detectColumnField,
  validateAndNormalizeRows,
  downloadRoomImportTemplate,
  type SystemFieldKey,
  type ProcessedRow,
  type ValidationError,
} from "@/lib/room-importer-engine";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  properties: any[];
  currentPropertyId?: number;
  buildings: any[];
  existingRooms: any[];
  onImportSuccess?: () => void;
};

type Step = "property" | "upload" | "mapping" | "mode" | "preview" | "progress" | "result";

export function RoomImportWizard({
  open,
  onOpenChange,
  properties = [],
  currentPropertyId,
  buildings = [],
  existingRooms = [],
  onImportSuccess,
}: Props) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [, setLocation] = useLocation();

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Wizard State
  const [step, setStep] = useState<Step>("property");
  const [selectedPropertyId, setSelectedPropertyId] = useState<string>(
    currentPropertyId ? String(currentPropertyId) : ""
  );
  const [selectedBuildingId, setSelectedBuildingId] = useState<string>("auto");

  // File state
  const [file, setFile] = useState<File | null>(null);
  const [sheetNames, setSheetNames] = useState<string[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("");
  const [workbook, setWorkbook] = useState<XLSX.WorkBook | null>(null);
  const [rawHeaders, setRawHeaders] = useState<string[]>([]);
  const [rawRows, setRawRows] = useState<Record<string, any>[]>([]);

  // Mapping state: fileHeader -> systemFieldKey
  const [columnMapping, setColumnMapping] = useState<Record<string, SystemFieldKey>>({});

  // Templates
  const [templates, setTemplates] = useState<any[]>([]);
  const [templateName, setTemplateName] = useState("");
  const [saveTemplateDialogOpen, setSaveTemplateDialogOpen] = useState(false);

  // Import mode
  const [importMode, setImportMode] = useState<"create_update" | "create_only" | "update_only" | "replace">("create_update");

  // Preview filtering & search
  const [previewSearch, setPreviewSearch] = useState("");
  const [previewFilter, setPreviewFilter] = useState<"all" | "errors" | "warnings" | "new" | "existing">("all");

  // Execution & Progress state
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionProgress, setExecutionProgress] = useState(0);
  const [executionPhase, setExecutionPhase] = useState("");
  const [importResult, setImportResult] = useState<any>(null);

  // Filter buildings for selected property
  const propertyBuildings = useMemo(() => {
    if (!selectedPropertyId) return [];
    return buildings.filter((b) => !b.propertyId || String(b.propertyId) === selectedPropertyId);
  }, [buildings, selectedPropertyId]);

  // Handle File Selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const selectedFile = files[0];
    processUploadedFile(selectedFile);
  };

  const processUploadedFile = (f: File) => {
    setFile(f);
    const reader = new FileReader();

    reader.onload = (evt) => {
      try {
        const data = evt.target?.result;
        const wb = XLSX.read(data, { type: "binary", cellDates: true });
        setWorkbook(wb);
        setSheetNames(wb.SheetNames);
        const firstSheet = wb.SheetNames[0];
        setSelectedSheet(firstSheet);
        loadSheetData(wb, firstSheet);
      } catch (err: any) {
        toast.error(ar ? "فشل قراءة الملف: " + err.message : "Failed to read file: " + err.message);
      }
    };

    reader.readAsBinaryString(f);
  };

  const loadSheetData = (wb: XLSX.WorkBook, sheetName: string) => {
    const ws = wb.Sheets[sheetName];
    if (!ws) return;

    // Read as array of objects
    const jsonData = XLSX.utils.sheet_to_json<Record<string, any>>(ws, { defval: "" });
    if (jsonData.length === 0) {
      toast.error(ar ? "الشيت فارغ لا يحتوي على بيانات" : "Selected sheet is empty");
      return;
    }

    // Extract headers
    const headers = Object.keys(jsonData[0] || {});
    setRawHeaders(headers);
    setRawRows(jsonData);

    // Auto-detect mappings
    const initialMapping: Record<string, SystemFieldKey> = {};
    headers.forEach((h) => {
      initialMapping[h] = detectColumnField(h);
    });
    setColumnMapping(initialMapping);

    // Fetch saved templates for property
    fetchTemplates();
  };

  const fetchTemplates = async () => {
    try {
      const res = await fetch(`/api/rooms/import/templates?propertyId=${selectedPropertyId}`);
      if (res.ok) {
        const data = await res.json();
        setTemplates(data);
      }
    } catch {}
  };

  const applyTemplate = (tmpl: any) => {
    if (!tmpl?.columnMapping) return;
    setColumnMapping((prev) => ({ ...prev, ...tmpl.columnMapping }));
    toast.success(ar ? `تم تطبيق القالب "${tmpl.name}"` : `Applied template "${tmpl.name}"`);
  };

  const handleSaveTemplate = async () => {
    if (!templateName.trim()) {
      toast.error(ar ? "الرجاء إدخال اسم القالب" : "Please enter template name");
      return;
    }
    try {
      const res = await fetch("/api/rooms/import/templates", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: selectedPropertyId ? parseInt(selectedPropertyId) : null,
          name: templateName.trim(),
          columnMapping,
        }),
      });
      if (res.ok) {
        toast.success(ar ? "تم حفظ قالب الاستيراد بنجاح" : "Template saved successfully");
        setSaveTemplateDialogOpen(false);
        fetchTemplates();
      } else {
        throw new Error("Failed to save template");
      }
    } catch (e: any) {
      toast.error(e.message || "Error saving template");
    }
  };

  // Required Fields Check
  const requiredFieldsMapped = useMemo(() => {
    const mappedValues = Object.values(columnMapping);
    const hasRoomNumber = mappedValues.includes("roomNumber");
    const hasRoomType = mappedValues.includes("roomType");
    const hasCapacity = mappedValues.includes("capacity");
    return {
      allMapped: hasRoomNumber && hasRoomType && hasCapacity,
      hasRoomNumber,
      hasRoomType,
      hasCapacity,
    };
  }, [columnMapping]);

  // Validation & Processing of Rows
  const validationResult = useMemo(() => {
    if (rawRows.length === 0) return null;
    return validateAndNormalizeRows({
      rows: rawRows,
      columnMapping,
      existingRooms,
    });
  }, [rawRows, columnMapping, existingRooms]);

  // Filtered Preview Rows
  const previewRows = useMemo(() => {
    if (!validationResult) return [];
    let list = validationResult.processedRows;

    if (previewFilter === "errors") {
      list = list.filter((r) => !r.isValid);
    } else if (previewFilter === "warnings") {
      list = list.filter((r) => r.warnings.length > 0);
    } else if (previewFilter === "new") {
      list = list.filter((r) => !r.isExisting);
    } else if (previewFilter === "existing") {
      list = list.filter((r) => r.isExisting);
    }

    if (previewSearch.trim()) {
      const q = previewSearch.trim().toLowerCase();
      list = list.filter(
        (r) =>
          r.normalizedRoom.roomNumber.toLowerCase().includes(q) ||
          r.normalizedRoom.roomType.toLowerCase().includes(q) ||
          r.normalizedRoom.floor.toLowerCase().includes(q) ||
          r.normalizedRoom.view.toLowerCase().includes(q)
      );
    }

    return list;
  }, [validationResult, previewFilter, previewSearch]);

  // Execute Import
  const handleExecuteImport = async () => {
    if (!validationResult || validationResult.validRows === 0) {
      toast.error(ar ? "لا توجد صفوف صالحة للاستيراد" : "No valid rows to import");
      return;
    }

    setStep("progress");
    setIsExecuting(true);
    setExecutionProgress(15);
    setExecutionPhase(ar ? "جاري تحضير وتدقيق الغرف..." : "Preparing room configurations...");

    try {
      // Filter only valid rows
      const validPayload = validationResult.processedRows
        .filter((r) => r.isValid)
        .map((r) => r.normalizedRoom);

      setExecutionProgress(40);
      setExecutionPhase(ar ? "جاري إرسال البيانات ومعالجة المعاملة..." : "Executing database transaction...");

      const response = await fetch("/api/rooms/import/execute", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          propertyId: parseInt(selectedPropertyId),
          buildingId: selectedBuildingId !== "auto" ? parseInt(selectedBuildingId) : undefined,
          importMode,
          fileName: file?.name || "import.xlsx",
          rooms: validPayload,
        }),
      });

      setExecutionProgress(80);
      setExecutionPhase(ar ? "جاري حفظ الطوابق والأسرة وسجل الاستيراد..." : "Finalizing rooms and physical beds...");

      if (!response.ok) {
        const errJson = await response.json().catch(() => ({}));
        throw new Error(errJson.error || "Import failed");
      }

      const result = await response.json();
      setExecutionProgress(100);
      setExecutionPhase(ar ? "اكتمل الاستيراد بنجاح!" : "Import completed!");
      setImportResult(result);
      setStep("result");

      toast.success(
        ar
          ? `تم استيراد ${result.createdRows} غرفة جديدة وتحديث ${result.updatedRows} غرفة`
          : `Imported ${result.createdRows} new rooms, updated ${result.updatedRows} rooms`
      );

      if (onImportSuccess) onImportSuccess();
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشل الاستيراد" : "Import failed"));
      setStep("preview");
    } finally {
      setIsExecuting(false);
    }
  };

  // Download Error Report
  const handleDownloadErrorReport = () => {
    if (!validationResult || validationResult.allErrors.length === 0) {
      toast.info(ar ? "لا توجد أخطاء لتنزيلها" : "No errors to export");
      return;
    }

    const errorRows = validationResult.allErrors.map((e) => ({
      "Row Number (رقم الصف)": e.rowNumber,
      "Column (العمود)": e.column,
      "Original Value (القيمة)": String(e.value ?? ""),
      "Error (الخطأ)": ar ? e.errorAr : e.errorEn,
      "Suggested Fix (مقترح التصحيح)": ar ? e.suggestedFixAr : e.suggestedFixEn,
    }));

    const ws = XLSX.utils.json_to_sheet(errorRows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Import_Errors");
    XLSX.writeFile(wb, `Room_Import_Errors_${new Date().toISOString().split("T")[0]}.xlsx`);
  };

  // Reset Wizard
  const resetWizard = () => {
    setStep("property");
    setFile(null);
    setRawHeaders([]);
    setRawRows([]);
    setColumnMapping({});
    setImportResult(null);
    setExecutionProgress(0);
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!isExecuting) { onOpenChange(v); if (!v) resetWizard(); } }}>
      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-0 overflow-hidden shadow-2xl rounded-2xl border bg-card">
        {/* ── DIALOG HEADER ── */}
        <div className="p-5 border-b bg-gradient-to-r from-primary/10 via-primary/5 to-transparent flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 rounded-xl bg-primary text-primary-foreground shadow-md">
              <FileSpreadsheet className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-lg font-black text-foreground">
                {ar ? "معالج استيراد وتكوين الغرف الشامل" : "Universal Room Configuration Importer"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "استيراد وتحديث غرف أي فندق أو سكن من ملفات Excel (.xlsx, .xls) أو CSV بمرونة تامة"
                  : "Import and configure rooms from Excel (.xlsx, .xls) or CSV files for any property"}
              </DialogDescription>
            </div>
          </div>
        </div>

        {/* ── STEPPER BAR ── */}
        <div className="px-6 py-2.5 bg-muted/30 border-b flex items-center justify-between overflow-x-auto text-xs font-semibold">
          {[
            { id: "property", label: ar ? "1. الفندق والمبنى" : "1. Property" },
            { id: "upload", label: ar ? "2. رفع الملف" : "2. Upload" },
            { id: "mapping", label: ar ? "3. مطابقة الأعمدة" : "3. Mapping" },
            { id: "mode", label: ar ? "4. نمط الاستيراد" : "4. Import Mode" },
            { id: "preview", label: ar ? "5. معاينة وتدقيق" : "5. Preview" },
            { id: "result", label: ar ? "6. النتيجة" : "6. Result" },
          ].map((s, idx) => {
            const isCurrent = step === s.id;
            return (
              <span
                key={s.id}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg transition-colors whitespace-nowrap ${
                  isCurrent
                    ? "bg-primary text-primary-foreground font-black shadow-sm"
                    : "text-muted-foreground"
                }`}
              >
                {s.label}
              </span>
            );
          })}
        </div>

        {/* ── STEP CONTENT CONTAINER ── */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: PROPERTY & BUILDING */}
          {step === "property" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 rounded-xl border bg-primary/5 border-primary/20 space-y-1">
                <h4 className="font-bold text-sm text-foreground flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-primary" />
                  {ar ? "الخطوة الأولى: تحديد الفندق / السكن المستهدف" : "Step 1: Select Target Property"}
                </h4>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "كل غرفة سيتم استيرادها سترتبط تلقائياً برقم الفندق المختار لعزل البيانات بشكل كامل وآمن."
                    : "Every imported room will be automatically assigned to the selected property for complete tenant isolation."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="text-xs font-bold">
                    {ar ? "اختر الفندق / السكن" : "Select Property"} <span className="text-red-500">*</span>
                  </Label>
                  <Select value={selectedPropertyId} onValueChange={setSelectedPropertyId}>
                    <SelectTrigger className="h-11 font-semibold">
                      <SelectValue placeholder={ar ? "اختر الفندق..." : "Select Property..."} />
                    </SelectTrigger>
                    <SelectContent>
                      {properties.map((p) => (
                        <SelectItem key={p.id} value={String(p.id)} className="font-semibold">
                          🏢 {p.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="text-xs font-bold">
                    {ar ? "المبنى المستهدف (اختياري)" : "Target Building (Optional)"}
                  </Label>
                  <Select value={selectedBuildingId} onValueChange={setSelectedBuildingId}>
                    <SelectTrigger className="h-11 font-semibold">
                      <SelectValue placeholder={ar ? "تحديد تلقائي / بحسب الملف" : "Auto / From File"} />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="auto">
                        ✨ {ar ? "تحديد تلقائي (أو إنشاء مبنى رئيسي)" : "Auto detect / Create Main"}
                      </SelectItem>
                      {propertyBuildings.map((b) => (
                        <SelectItem key={b.id} value={String(b.id)}>
                          🏢 {b.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: FILE UPLOAD */}
          {step === "upload" && (
            <div className="space-y-6 animate-in fade-in">
              {/* Template Download Banner */}
              <div className="p-4 rounded-xl border bg-gradient-to-r from-blue-500/10 via-indigo-500/10 to-primary/10 border-blue-500/20 flex flex-col sm:flex-row items-center justify-between gap-3 shadow-xs">
                <div className="flex items-center gap-3 text-start">
                  <div className="p-2.5 rounded-xl bg-blue-600/15 text-blue-600 dark:text-blue-400 shrink-0">
                    <FileSpreadsheet className="w-5 h-5" />
                  </div>
                  <div>
                    <h5 className="font-bold text-xs text-foreground">
                      {ar ? "ليس لديك ملف مهيأ؟ حمّل النموذج الجاهز (Template)" : "Need a template? Download our ready file"}
                    </h5>
                    <p className="text-[11px] text-muted-foreground mt-0.5">
                      {ar
                        ? "قالب Excel أو CSV معتمد يحتوي على كافة الأعمدة، أمثلة توضيحية، ودليل إرشادات التعبئة."
                        : "Standard template containing all columns, real examples, and a complete filling guide."}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0 w-full sm:w-auto">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadRoomImportTemplate("xlsx")}
                    className="gap-1.5 text-xs font-bold border-blue-300 hover:bg-blue-50 dark:border-blue-800 dark:hover:bg-blue-950/40 text-blue-700 dark:text-blue-300 flex-1 sm:flex-none shadow-xs"
                  >
                    <Download className="w-3.5 h-3.5" />
                    {ar ? "تحميل قالب Excel (.xlsx)" : "Download Excel"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadRoomImportTemplate("csv")}
                    className="gap-1.5 text-xs text-muted-foreground hover:text-foreground flex-1 sm:flex-none"
                  >
                    <Download className="w-3.5 h-3.5" />
                    CSV
                  </Button>
                </div>
              </div>

              <div
                onClick={() => fileInputRef.current?.click()}
                className="p-8 border-2 border-dashed rounded-2xl bg-muted/10 hover:bg-muted/20 border-primary/30 hover:border-primary transition-all text-center cursor-pointer flex flex-col items-center justify-center gap-3 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx, .xls, .csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="p-4 rounded-2xl bg-primary/10 text-primary group-hover:scale-110 transition-transform shadow-sm">
                  <Upload className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="font-extrabold text-base text-foreground">
                    {ar ? "اضغط لاختيار ملف أو اسحب الملف وأفلته هنا" : "Click to select or drag & drop file here"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    {ar ? "يدعم ملفات Excel (.xlsx, .xls) وملفات القيم المفصولة (.csv)" : "Supports Excel (.xlsx, .xls) and CSV (.csv)"}
                  </p>
                </div>
                {file && (
                  <div className="mt-2 px-3 py-1.5 rounded-lg bg-emerald-100 text-emerald-900 border border-emerald-300 font-bold text-xs flex items-center gap-2">
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    <span>{file.name}</span>
                    <span className="opacity-70">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                )}
              </div>

              {sheetNames.length > 1 && (
                <div className="p-4 rounded-xl border bg-card space-y-2">
                  <Label className="text-xs font-bold">
                    {ar ? "اختر ورقة العمل (Sheet) المطلوبة:" : "Select Worksheet:"}
                  </Label>
                  <Select
                    value={selectedSheet}
                    onValueChange={(s) => {
                      setSelectedSheet(s);
                      if (workbook) loadSheetData(workbook, s);
                    }}
                  >
                    <SelectTrigger className="h-10">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {sheetNames.map((s) => (
                        <SelectItem key={s} value={s}>
                          📑 {s}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}

              {rawRows.length > 0 && (
                <div className="p-4 rounded-xl border bg-emerald-50/50 dark:bg-emerald-950/20 border-emerald-500/20 flex items-center justify-between text-xs font-semibold">
                  <div className="flex items-center gap-2 text-emerald-800 dark:text-emerald-300">
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                    <span>
                      {ar
                        ? `تم التعرف على ${rawRows.length} صف و ${rawHeaders.length} عمود بنجاح`
                        : `Detected ${rawRows.length} rows and ${rawHeaders.length} columns`}
                    </span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* STEP 3: COLUMN MAPPING */}
          {step === "mapping" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-4 rounded-xl border bg-muted/30">
                <div>
                  <h4 className="font-bold text-sm text-foreground">
                    {ar ? "مطابقة أعمدة الملف مع حقول النظام" : "Map File Columns to System Fields"}
                  </h4>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {ar
                      ? "قام النظام بكشف الأعمدة تلقائياً. يمكنك تعديل أي عمود أو اختيار (تجاهل)."
                      : "Columns were auto-detected. Adjust any field or choose ignore."}
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {templates.length > 0 && (
                    <Select onValueChange={(id) => {
                      const t = templates.find((x) => String(x.id) === id);
                      if (t) applyTemplate(t);
                    }}>
                      <SelectTrigger className="h-8 text-xs w-[160px]">
                        <SelectValue placeholder={ar ? "تحميل قالب محفوظ..." : "Load template..."} />
                      </SelectTrigger>
                      <SelectContent>
                        {templates.map((t) => (
                          <SelectItem key={t.id} value={String(t.id)}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}

                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSaveTemplateDialogOpen(true)}
                    className="h-8 text-xs gap-1.5"
                  >
                    <Save className="w-3.5 h-3.5" />
                    {ar ? "حفظ كقالب" : "Save Template"}
                  </Button>
                </div>
              </div>

              {/* Required Fields Status */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold text-muted-foreground">{ar ? "الحقول الإجبارية:" : "Required Fields:"}</span>
                <Badge variant={requiredFieldsMapped.hasRoomNumber ? "default" : "destructive"} className="text-xs gap-1">
                  {requiredFieldsMapped.hasRoomNumber ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {ar ? "رقم الغرفة" : "Room Number"}
                </Badge>
                <Badge variant={requiredFieldsMapped.hasRoomType ? "default" : "destructive"} className="text-xs gap-1">
                  {requiredFieldsMapped.hasRoomType ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {ar ? "نوع الغرفة" : "Room Type"}
                </Badge>
                <Badge variant={requiredFieldsMapped.hasCapacity ? "default" : "destructive"} className="text-xs gap-1">
                  {requiredFieldsMapped.hasCapacity ? <Check className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                  {ar ? "أقصى سعة" : "Capacity"}
                </Badge>
              </div>

              {/* Mapping Table */}
              <div className="border rounded-xl overflow-hidden">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b font-bold text-muted-foreground">
                    <tr>
                      <th className="p-3 text-start">{ar ? "عمود ملف Excel" : "Excel Header"}</th>
                      <th className="p-3 text-start">{ar ? "عينة من الصف الأول" : "Sample Value"}</th>
                      <th className="p-3 text-start">{ar ? "حقل النظام المقابل" : "Target System Field"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {rawHeaders.map((header) => {
                      const sampleVal = rawRows[0]?.[header];
                      const currentField = columnMapping[header] || "ignore";
                      const isAuto = currentField !== "ignore";

                      return (
                        <tr key={header} className="hover:bg-muted/20 transition-colors">
                          <td className="p-3 font-semibold text-foreground">
                            {header}
                          </td>
                          <td className="p-3 text-muted-foreground font-mono truncate max-w-[200px]">
                            {sampleVal !== undefined && sampleVal !== null ? String(sampleVal) : "—"}
                          </td>
                          <td className="p-3">
                            <Select
                              value={currentField}
                              onValueChange={(val: SystemFieldKey) => {
                                setColumnMapping((prev) => ({ ...prev, [header]: val }));
                              }}
                            >
                              <SelectTrigger className="h-8 text-xs font-semibold w-[220px]">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="ignore" className="text-muted-foreground font-normal">
                                  ❌ {ar ? "(تجاهل هذا العمود)" : "(Ignore Column)"}
                                </SelectItem>
                                {SYSTEM_FIELDS.map((field) => (
                                  <SelectItem key={field.key} value={field.key} className="font-semibold">
                                    {ar ? field.labelAr : field.labelEn}
                                    {field.required ? " *" : ""}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 4: IMPORT MODE */}
          {step === "mode" && (
            <div className="space-y-6 animate-in fade-in">
              <div className="p-4 rounded-xl border bg-muted/30">
                <h4 className="font-bold text-sm text-foreground">
                  {ar ? "حدد كيفية التعامل مع الغرف المسجلة مسبقاً (Import Mode)" : "Choose Duplicate Room Handling Mode"}
                </h4>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {ar
                    ? "تحديد سلوك النظام في حال تطابق رقم الغرفة مع غرفة مسجلة مسبقاً في نفس الفندق."
                    : "Define system behavior when a room number matches an existing room."}
                </p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Mode 1: Create + Update */}
                <div
                  onClick={() => setImportMode("create_update")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-1.5 ${
                    importMode === "create_update"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-foreground flex items-center gap-1.5">
                      🔄 {ar ? "إنشاء وتحديث (موصى به)" : "Create + Update (Recommended)"}
                    </span>
                    {importMode === "create_update" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? "إضافة الغرف الجديدة وتحديث بيانات الغرف الموجودة مسبقاً (المساحة، الأسرة، الإطلالة، المميزات)."
                      : "Create new rooms and update existing rooms with imported details."}
                  </p>
                </div>

                {/* Mode 2: Create Only */}
                <div
                  onClick={() => setImportMode("create_only")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-1.5 ${
                    importMode === "create_only"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-foreground flex items-center gap-1.5">
                      🆕 {ar ? "إنشاء جديد فقط" : "Create Only"}
                    </span>
                    {importMode === "create_only" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? "استيراد الغرف الجديدة فقط. أي غرفة موجودة مسبقاً يتم تخطيها والإبلاغ عنها كتعارض."
                      : "Only import new rooms. Skip existing rooms and report conflict."}
                  </p>
                </div>

                {/* Mode 3: Update Only */}
                <div
                  onClick={() => setImportMode("update_only")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-1.5 ${
                    importMode === "update_only"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-foreground flex items-center gap-1.5">
                      ✏️ {ar ? "تحديث الموجود فقط" : "Update Only"}
                    </span>
                    {importMode === "update_only" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? "تحديث مواصفات الغرف الموجودة مسبقاً فقط وتجاهل أي غرف جديدة غير مسجلة."
                      : "Only update specifications for existing rooms. Skip new rooms."}
                  </p>
                </div>

                {/* Mode 4: Replace Configuration */}
                <div
                  onClick={() => setImportMode("replace")}
                  className={`p-4 rounded-xl border-2 cursor-pointer transition-all space-y-1.5 ${
                    importMode === "replace"
                      ? "border-primary bg-primary/5 ring-2 ring-primary/20"
                      : "border-border hover:border-muted-foreground/50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <span className="font-black text-sm text-foreground flex items-center gap-1.5">
                      ⚠️ {ar ? "مزامنة كاملة واستبدال" : "Replace Configuration"}
                    </span>
                    {importMode === "replace" && <CheckCircle2 className="w-5 h-5 text-primary" />}
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {ar
                      ? "مزامنة كاملة: إنشاء وتحديث، وأرشفة الغرف غير الموجودة بالملف (دون حذف السجلات التاريخية)."
                      : "Sync all rooms. Deactivate rooms missing from file (without deleting history)."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 5: PREVIEW & VALIDATION */}
          {step === "preview" && validationResult && (
            <div className="space-y-4 animate-in fade-in">
              {/* Summary KPIs */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                <div className="p-3 rounded-xl border bg-muted/20 text-center">
                  <span className="text-[11px] text-muted-foreground font-bold">{ar ? "إجمالي الصفوف" : "Total"}</span>
                  <p className="text-xl font-black text-foreground">{validationResult.totalRows}</p>
                </div>
                <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 text-center">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">{ar ? "صفوف سليمة ✅" : "Valid"}</span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400">{validationResult.validRows}</p>
                </div>
                <div className="p-3 rounded-xl border bg-red-500/10 border-red-500/20 text-center">
                  <span className="text-[11px] text-red-800 dark:text-red-300 font-bold">{ar ? "بها أخطاء ❌" : "Invalid"}</span>
                  <p className="text-xl font-black text-red-600 dark:text-red-400">{validationResult.invalidRows}</p>
                </div>
                <div className="p-3 rounded-xl border bg-blue-500/10 border-blue-500/20 text-center">
                  <span className="text-[11px] text-blue-800 dark:text-blue-300 font-bold">{ar ? "غرف جديدة 🆕" : "New"}</span>
                  <p className="text-xl font-black text-blue-600 dark:text-blue-400">{validationResult.newRoomsCount}</p>
                </div>
                <div className="p-3 rounded-xl border bg-amber-500/10 border-amber-500/20 text-center col-span-2 sm:col-span-1">
                  <span className="text-[11px] text-amber-800 dark:text-amber-300 font-bold">{ar ? "مسجلة مسبقاً 🔄" : "Existing"}</span>
                  <p className="text-xl font-black text-amber-600 dark:text-amber-400">{validationResult.existingRoomsCount}</p>
                </div>
              </div>

              {/* Filter & Search Bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5">
                <div className="relative flex-1 max-w-xs">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                  <Input
                    placeholder={ar ? "ابحث برقم الغرفة أو النوع..." : "Search room or type..."}
                    value={previewSearch}
                    onChange={(e) => setPreviewSearch(e.target.value)}
                    className="pl-8 h-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    size="sm"
                    variant={previewFilter === "all" ? "default" : "outline"}
                    onClick={() => setPreviewFilter("all")}
                    className="h-8 text-xs"
                  >
                    {ar ? "الكل" : "All"} ({validationResult.totalRows})
                  </Button>
                  {validationResult.invalidRows > 0 && (
                    <Button
                      size="sm"
                      variant={previewFilter === "errors" ? "destructive" : "outline"}
                      onClick={() => setPreviewFilter(previewFilter === "errors" ? "all" : "errors")}
                      className="h-8 text-xs gap-1"
                    >
                      <XCircle className="w-3.5 h-3.5" />
                      {ar ? "الأخطاء فقط" : "Errors Only"} ({validationResult.invalidRows})
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant={previewFilter === "new" ? "default" : "outline"}
                    onClick={() => setPreviewFilter(previewFilter === "new" ? "all" : "new")}
                    className="h-8 text-xs"
                  >
                    {ar ? "الجديدة" : "New"} ({validationResult.newRoomsCount})
                  </Button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="border rounded-xl max-h-[380px] overflow-y-auto">
                <table className="w-full text-xs">
                  <thead className="bg-muted/50 border-b font-bold text-muted-foreground sticky top-0 backdrop-blur">
                    <tr>
                      <th className="p-2.5 text-center w-12">#</th>
                      <th className="p-2.5 text-start">{ar ? "رقم الغرفة" : "Room #"}</th>
                      <th className="p-2.5 text-start">{ar ? "النوع" : "Type"}</th>
                      <th className="p-2.5 text-start">{ar ? "السرير" : "Bed"}</th>
                      <th className="p-2.5 text-center">{ar ? "السعة" : "Occ."}</th>
                      <th className="p-2.5 text-center">{ar ? "الدور" : "Floor"}</th>
                      <th className="p-2.5 text-start">{ar ? "الإطلالة" : "View"}</th>
                      <th className="p-2.5 text-center">{ar ? "المساحة" : "Size"}</th>
                      <th className="p-2.5 text-start">{ar ? "الحالة والتدقيق" : "Validation"}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {previewRows.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="p-8 text-center text-muted-foreground">
                          {ar ? "لا توجد صفوف تطابق الفلتر" : "No rows match filter"}
                        </td>
                      </tr>
                    ) : (
                      previewRows.map((row) => {
                        const r = row.normalizedRoom;
                        return (
                          <tr
                            key={row.rowNumber}
                            className={`transition-colors ${
                              !row.isValid
                                ? "bg-red-500/10 hover:bg-red-500/15"
                                : row.isExisting
                                ? "bg-amber-500/5 hover:bg-amber-500/10"
                                : "hover:bg-muted/20"
                            }`}
                          >
                            <td className="p-2.5 text-center font-mono text-muted-foreground">{row.rowNumber}</td>
                            <td className="p-2.5 font-bold font-mono text-foreground">{r.roomNumber || "—"}</td>
                            <td className="p-2.5">{r.roomType || "—"}</td>
                            <td className="p-2.5 text-muted-foreground">{r.bedType || "—"}</td>
                            <td className="p-2.5 text-center font-bold">{r.capacity}</td>
                            <td className="p-2.5 text-center">{r.floor}</td>
                            <td className="p-2.5 text-muted-foreground">{r.view || "—"}</td>
                            <td className="p-2.5 text-center font-mono">{r.size || "—"}</td>
                            <td className="p-2.5">
                              {row.errors.length > 0 ? (
                                <div className="space-y-0.5">
                                  {row.errors.map((e, idx) => (
                                    <span
                                      key={idx}
                                      className="inline-block px-2 py-0.5 rounded text-[10px] font-bold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300"
                                    >
                                      ❌ {ar ? e.errorAr : e.errorEn}
                                    </span>
                                  ))}
                                </div>
                              ) : row.isExisting ? (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                                  🔄 {ar ? "موجودة (سيتم تحديثها)" : "Existing (Update)"}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded text-[10px] font-bold bg-emerald-100 text-emerald-900 dark:bg-emerald-950 dark:text-emerald-200">
                                  ✅ {ar ? "جاهزة للإنشاء" : "Ready"}
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* STEP 6: EXECUTION PROGRESS */}
          {step === "progress" && (
            <div className="py-12 flex flex-col items-center justify-center text-center space-y-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-spin">
                <RefreshCw className="w-8 h-8" />
              </div>
              <div>
                <h4 className="font-black text-base text-foreground">{executionPhase}</h4>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar ? "يرجى الانتظار، جاري تطبيق التغييرات داخل معاملة آمنة..." : "Please wait, processing database transaction..."}
                </p>
              </div>
              <div className="w-full max-w-md h-2 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary transition-all duration-300"
                  style={{ width: `${executionProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* STEP 7: RESULTS */}
          {step === "result" && importResult && (
            <div className="py-8 space-y-6 text-center animate-in fade-in">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-100 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-300 flex items-center justify-center shadow-lg">
                <CheckCircle2 className="w-8 h-8" />
              </div>

              <div>
                <h3 className="text-xl font-black text-foreground">
                  {ar ? "اكتملت عملية الاستيراد بنجاح!" : "Import Completed Successfully!"}
                </h3>
                <p className="text-xs text-muted-foreground mt-1">
                  {ar ? "تم تسجيل وتحديث الغرف والأسرة الفيزيائية في النظام بنجاح" : "Rooms and beds were saved into the database"}
                </p>
              </div>

              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3.5 rounded-xl border bg-emerald-500/10 text-emerald-800 dark:text-emerald-300">
                  <span className="text-xs font-bold">{ar ? "غرف جديدة" : "Created"}</span>
                  <p className="text-2xl font-black">{importResult.createdRows}</p>
                </div>
                <div className="p-3.5 rounded-xl border bg-blue-500/10 text-blue-800 dark:text-blue-300">
                  <span className="text-xs font-bold">{ar ? "غرف تم تحديثها" : "Updated"}</span>
                  <p className="text-2xl font-black">{importResult.updatedRows}</p>
                </div>
                <div className="p-3.5 rounded-xl border bg-muted/40 text-muted-foreground">
                  <span className="text-xs font-bold">{ar ? "إجمالي المعالج" : "Total"}</span>
                  <p className="text-2xl font-black">{importResult.totalRows}</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center justify-center gap-3 pt-4 flex-wrap">
                {validationResult?.allErrors.length ? (
                  <Button
                    variant="outline"
                    onClick={handleDownloadErrorReport}
                    className="gap-2 text-xs font-bold"
                  >
                    <Download className="w-4 h-4" />
                    {ar ? "تنزيل تقرير الأخطاء (Excel)" : "Download Error Report"}
                  </Button>
                ) : null}

                <Button
                  onClick={() => {
                    onOpenChange(false);
                    setLocation("/housing?tab=room_space_view");
                  }}
                  className="gap-2 bg-gradient-to-r from-primary to-indigo-600 font-bold text-xs text-white shadow-md"
                >
                  <Eye className="w-4 h-4" />
                  {ar ? "استعراض في مخطط الغرف والأسرة" : "View in Room Space View"}
                </Button>
              </div>
            </div>
          )}
        </div>

        {/* ── FOOTER CONTROLS ── */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between">
          <div>
            {step !== "property" && step !== "progress" && step !== "result" && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => {
                  if (step === "upload") setStep("property");
                  else if (step === "mapping") setStep("upload");
                  else if (step === "mode") setStep("mapping");
                  else if (step === "preview") setStep("mode");
                }}
                className="gap-1.5 text-xs font-bold"
              >
                <ArrowRight className="w-3.5 h-3.5 rtl:rotate-180" />
                {ar ? "السابق" : "Back"}
              </Button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              disabled={isExecuting}
              className="text-xs"
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>

            {step === "property" && (
              <Button
                size="sm"
                disabled={!selectedPropertyId}
                onClick={() => setStep("upload")}
                className="gap-1.5 text-xs font-bold"
              >
                {ar ? "التالي: اختيار الملف" : "Next: Select File"}
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              </Button>
            )}

            {step === "upload" && (
              <Button
                size="sm"
                disabled={!file || rawRows.length === 0}
                onClick={() => setStep("mapping")}
                className="gap-1.5 text-xs font-bold"
              >
                {ar ? "التالي: مطابقة الأعمدة" : "Next: Map Columns"}
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              </Button>
            )}

            {step === "mapping" && (
              <Button
                size="sm"
                disabled={!requiredFieldsMapped.allMapped}
                onClick={() => setStep("mode")}
                className="gap-1.5 text-xs font-bold"
              >
                {ar ? "التالي: خيارات الاستيراد" : "Next: Import Options"}
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              </Button>
            )}

            {step === "mode" && (
              <Button
                size="sm"
                onClick={() => setStep("preview")}
                className="gap-1.5 text-xs font-bold"
              >
                {ar ? "التالي: معاينة وتدقيق" : "Next: Preview"}
                <ArrowLeft className="w-3.5 h-3.5 rtl:rotate-180" />
              </Button>
            )}

            {step === "preview" && (
              <Button
                size="sm"
                disabled={!validationResult || validationResult.validRows === 0}
                onClick={handleExecuteImport}
                className="gap-1.5 text-xs font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
              >
                <CheckCircle2 className="w-4 h-4" />
                {ar ? `تأكيد وبدء الاستيراد (${validationResult?.validRows} غرفة)` : `Confirm Import (${validationResult?.validRows} Rooms)`}
              </Button>
            )}
          </div>
        </div>
      </DialogContent>

      {/* Save Template Mini Dialog */}
      <Dialog open={saveTemplateDialogOpen} onOpenChange={setSaveTemplateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">
              {ar ? "حفظ قالب مطابقة الأعمدة" : "Save Column Mapping Template"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              {ar ? "احفظ هذا التعيين لاستخدامه مستقبلاً لأي ملف من نفس المصدر" : "Save this mapping for future imports"}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Label className="text-xs font-bold">{ar ? "اسم القالب" : "Template Name"}</Label>
            <Input
              placeholder={ar ? "مثال: Tal Avenue Room Configuration" : "e.g. Tal Avenue Config"}
              value={templateName}
              onChange={(e) => setTemplateName(e.target.value)}
              className="h-9 text-xs"
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button size="sm" variant="outline" onClick={() => setSaveTemplateDialogOpen(false)}>
                {ar ? "إلغاء" : "Cancel"}
              </Button>
              <Button size="sm" onClick={handleSaveTemplate}>
                {ar ? "حفظ" : "Save"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </Dialog>
  );
}
