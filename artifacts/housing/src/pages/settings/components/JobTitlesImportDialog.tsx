// @ts-nocheck
import { useState, useRef } from "react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { useQueryClient } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  FileSpreadsheet,
  Download,
  Upload,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  Loader2,
  Building2,
  Briefcase,
  Layers,
  Search,
  Check,
  RotateCcw,
  ShieldCheck,
  ArrowRight,
  RefreshCw,
  PlusCircle,
} from "lucide-react";
import {
  downloadJobTitlesTemplate,
  parseJobTitlesFile,
  type ParseResult,
  type ParsedJobTitleRow,
  type RowAction,
} from "@/lib/job-title-importer-engine";
import { useLookupValues, LOOKUP_CATEGORIES } from "@/hooks/use-lookup-values";

interface JobTitlesImportDialogProps {
  propertyId: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function JobTitlesImportDialog({
  propertyId,
  open,
  onOpenChange,
  onSuccess,
}: JobTitlesImportDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch current database lookups for accurate duplicate & update detection
  const { data: existingDepartments = [] } = useLookupValues(
    propertyId,
    LOOKUP_CATEGORIES.DEPARTMENT,
    true
  );
  const { data: existingJobTitles = [] } = useLookupValues(
    propertyId,
    LOOKUP_CATEGORIES.JOB_TITLE,
    true
  );

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [actionFilter, setActionFilter] = useState<"all" | RowAction>("all");
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const [importStats, setImportStats] = useState<{
    insertedCount: number;
    updatedCount: number;
    skippedCount: number;
    total: number;
  } | null>(null);

  const resetState = () => {
    setStep("upload");
    setParseResult(null);
    setSearchQuery("");
    setActionFilter("all");
    setIsProcessingFile(false);
    setImportProgress(0);
    setImportStats(null);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleClose = () => {
    if (step === "importing") return;
    onOpenChange(false);
    setTimeout(resetState, 300);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setIsProcessingFile(true);
    try {
      const result = await parseJobTitlesFile(file, {
        departments: existingDepartments,
        jobTitles: existingJobTitles,
      });
      setParseResult(result);
      setStep("preview");
      toast.success(
        ar
          ? `تم تحليل الملف: ${result.createCount} جديد، ${result.updateCount} للتحديث، ${result.duplicateCount} مكرر سيتم تخطيه`
          : `Analyzed: ${result.createCount} new, ${result.updateCount} to update, ${result.duplicateCount} duplicates skipped`
      );
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشلت قراءة الملف" : "Failed to parse file"));
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parseResult || !propertyId) return;

    // Filter down to actionable rows ONLY (Create & Update)
    // DUPLICATES ARE NEVER SENT TO BE INSERTED!
    const actionableRows = parseResult.rows.filter(
      (r) => r.action === "create" || r.action === "update"
    );

    if (actionableRows.length === 0 && parseResult.newDepartmentsCount === 0) {
      toast.info(
        ar
          ? "جميع السجلات الموجودة في الملف مكررة ومطابقة للنظام مسبقاً، لا توجد تغييرات لإضافتها."
          : "All records in the file already exist identically in the system. Nothing to import."
      );
      return;
    }

    setStep("importing");
    setImportProgress(15);

    try {
      // 1. Prepare batch items:
      // Unique departments that are new
      const existingDeptNames = new Set(
        existingDepartments.map((d) => String(d.value || "").trim().toLowerCase())
      );

      const batchItems: Array<{
        category: string;
        value: string;
        parentValue?: string | null;
        extraValue?: string | null;
      }> = [];

      for (const dept of parseResult.departments) {
        const norm = dept.trim().toLowerCase();
        if (norm && !existingDeptNames.has(norm)) {
          batchItems.push({
            category: "department",
            value: dept.trim(),
            parentValue: null,
            extraValue: null,
          });
          existingDeptNames.add(norm); // prevent in-batch duplicate
        }
      }

      setImportProgress(35);

      // 2. Actionable Job Title rows only (new or updated)
      for (const row of actionableRows) {
        if (row.jobTitle) {
          batchItems.push({
            category: "job_title",
            value: row.jobTitle.trim(),
            parentValue: row.department ? row.department.trim() : null,
            extraValue: row.level ? row.level.trim() : null,
          });
        }
      }

      setImportProgress(60);

      const resp = await fetch("/api/lookup-values/bulk", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId,
          items: batchItems,
        }),
      });

      setImportProgress(85);

      if (!resp.ok) {
        const errJson = await resp.json().catch(() => ({}));
        throw new Error(errJson.error || (ar ? "فشل تنفيذ الاستيراد" : "Failed to execute import"));
      }

      const resData = await resp.json();
      setImportStats({
        insertedCount: resData.insertedCount ?? parseResult.createCount,
        updatedCount: resData.updatedCount ?? parseResult.updateCount,
        skippedCount: parseResult.duplicateCount + (resData.skippedCount || 0),
        total: parseResult.totalRows,
      });
      setImportProgress(100);
      setStep("complete");

      await queryClient.invalidateQueries({ queryKey: ["lookup-values", propertyId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/lookup-values"] });
      if (onSuccess) onSuccess();

      toast.success(
        ar
          ? `تم الاستيراد بنجاح! تم إنشاء ${resData.insertedCount}، تحديث ${resData.updatedCount}، ومنع تكرار ${parseResult.duplicateCount} سجل`
          : `Import complete! ${resData.insertedCount} created, ${resData.updatedCount} updated, ${parseResult.duplicateCount} duplicates safely skipped.`
      );
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ أثناء الاستيراد" : "Error during import"));
      setStep("preview");
    }
  };

  const filteredRows = (parseResult?.rows || []).filter((r) => {
    if (actionFilter !== "all" && r.action !== actionFilter) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      const matchDept = (r.department || "").toLowerCase().includes(q);
      const matchTitle = (r.jobTitle || "").toLowerCase().includes(q);
      const matchLevel = (r.level || "").toLowerCase().includes(q);
      return matchDept || matchTitle || matchLevel;
    }
    return true;
  });

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 overflow-hidden">
        {/* Header */}
        <DialogHeader className="p-6 pb-4 border-b bg-muted/20">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary to-indigo-600 flex items-center justify-center text-white shadow-md">
              <FileSpreadsheet className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-xl font-bold flex items-center gap-2">
                <span>{ar ? "استيراد الأقسام والمسميات الوظيفية والدرجات" : "Import Departments, Job Titles & Levels"}</span>
                <Badge variant="outline" className="text-[10px] bg-primary/10 text-primary border-primary/20">
                  {ar ? "إنشاء وتحديث ذكي بدون تكرار" : "Smart Create & Update"}
                </Badge>
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "إنشاء السجلات الجديدة، تحديث درجات المسميات القائمة، ومنع نزول أي سجل مكرر"
                  : "Creates new records, updates levels for existing titles, and completely prevents duplicates"}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {/* STEP 1: UPLOAD */}
          {step === "upload" && (
            <div className="space-y-6">
              {/* Template Download Banner */}
              <div className="p-4 rounded-xl border border-primary/20 bg-primary/5 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="space-y-1">
                  <h4 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <Download className="w-4 h-4 text-primary" />
                    {ar ? "تحميل نموذج ملف الاستيراد الجاهز" : "Download Pre-formatted Import Template"}
                  </h4>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {ar
                      ? "يحتوي النموذج على الأعمدة الثلاثة المطلوبة (القسم، المسمى الوظيفي، والدرجة Level) مع أمثلة جاهزة تناسب معايير الفنادق والسكن."
                      : "The template contains the required columns (Department, Job Title, and Level) with sample hospitality positions."}
                  </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => downloadJobTitlesTemplate("xlsx", ar ? "ar" : "en")}
                    className="gap-2 font-semibold text-xs h-9 shadow-xs"
                  >
                    <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                    {ar ? "نموذج Excel (.xlsx)" : "Excel (.xlsx)"}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => downloadJobTitlesTemplate("csv", ar ? "ar" : "en")}
                    className="gap-1.5 font-semibold text-xs h-9"
                  >
                    CSV
                  </Button>
                </div>
              </div>

              {/* Upload Dropzone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-border/80 hover:border-primary/80 rounded-2xl p-10 text-center cursor-pointer transition-all bg-muted/10 hover:bg-muted/30 group"
              >
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".xlsx,.xls,.csv"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 text-primary flex items-center justify-center group-hover:scale-110 transition-transform shadow-xs">
                  {isProcessingFile ? (
                    <Loader2 className="w-8 h-8 animate-spin" />
                  ) : (
                    <Upload className="w-8 h-8" />
                  )}
                </div>
                <h3 className="text-base font-bold text-foreground">
                  {isProcessingFile
                    ? (ar ? "جاري قراءة وتحليل الملف ومقارنته بالنظام..." : "Reading and cross-referencing with database...")
                    : (ar ? "اضغط لاختيار ملف Excel أو CSV أو اسحبه هنا" : "Click to select Excel or CSV file or drag & drop")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {ar
                    ? "يدعم صيغ (.xlsx, .xls, .csv) حتى 25 ميجابايت"
                    : "Supports (.xlsx, .xls, .csv) up to 25MB"}
                </p>
              </div>

              {/* Feature Highlights */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border border-emerald-500/20 bg-emerald-500/5 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-emerald-700 dark:text-emerald-300">
                    <PlusCircle className="w-4 h-4 text-emerald-600" />
                    <span>{ar ? "إنشاء جديد (Create)" : "Create New"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "أي قسم أو مسمى وظيفي غير مسجل مسبقاً يتم إنشاؤه تلقائياً."
                      : "Any department or job title not yet in the system will be created."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-blue-500/20 bg-blue-500/5 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-blue-700 dark:text-blue-300">
                    <RefreshCw className="w-4 h-4 text-blue-600" />
                    <span>{ar ? "تحديث تلقائي (Update Level)" : "Update Level"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "إذا كان المسمى موجوداً في النظام وتم تغيير درجته (Level) في الملف، يتم تحديثها فوراً دون تكرار."
                      : "Existing titles with new or modified levels will be safely updated in place."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border border-muted-foreground/20 bg-muted/40 space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-foreground">
                    <ShieldCheck className="w-4 h-4 text-primary" />
                    <span>{ar ? "حظر التكرار (Zero Duplicates)" : "Zero Duplicates"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "أي سجل متطابق بالكامل يتم تخطيه تلقائياً ولن ينزل مجدداً أبداً."
                      : "Any identical record will be automatically skipped and never re-added."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === "preview" && parseResult && (
            <div className="space-y-4">
              {/* 4 Smart Metrics Cards */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-bold">
                      {ar ? "إنشاء جديد" : "To Create"}
                    </span>
                    <PlusCircle className="w-3.5 h-3.5 text-emerald-600" />
                  </div>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {parseResult.createCount}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {parseResult.newDepartmentsCount > 0
                      ? (ar ? `يتضمن ${parseResult.newDepartmentsCount} قسم جديد` : `Includes ${parseResult.newDepartmentsCount} new depts`)
                      : (ar ? "سجلات غير مسجلة مسبقاً" : "New items to be added")}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border bg-blue-500/10 border-blue-500/20 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-blue-800 dark:text-blue-300 font-bold">
                      {ar ? "تحديث الدرجة" : "To Update"}
                    </span>
                    <RefreshCw className="w-3.5 h-3.5 text-blue-600" />
                  </div>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {parseResult.updateCount}
                  </p>
                  <span className="text-[10px] text-muted-foreground">
                    {ar ? "مسميات موجودة مع تعديل الـ Level" : "Existing titles with new level"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/60 border-border/80 shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-bold">
                      {ar ? "مكرر (لن ينزل)" : "Duplicates (Skip)"}
                    </span>
                    <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-black text-muted-foreground mt-1">
                    {parseResult.duplicateCount}
                  </p>
                  <span className="text-[10px] text-emerald-700/80 dark:text-emerald-400/80 font-semibold">
                    {ar ? "محمية وممنوعة من التكرار" : "Protected from duplicate entry"}
                  </span>
                </div>

                <div className="p-3.5 rounded-xl border bg-card shadow-2xs">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] text-muted-foreground font-semibold">
                      {ar ? "إجمالي بالملف" : "Total in File"}
                    </span>
                    <FileSpreadsheet className="w-3.5 h-3.5 text-muted-foreground" />
                  </div>
                  <p className="text-2xl font-black text-foreground mt-1">{parseResult.totalRows}</p>
                  <span className="text-[10px] text-muted-foreground">
                    {ar ? `${parseResult.departments.length} قسم مختلف` : `${parseResult.departments.length} distinct depts`}
                  </span>
                </div>
              </div>

              {/* Table Filter Toolbar */}
              <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between pt-1">
                <div className="relative flex-1 max-w-sm">
                  <Search className="absolute left-2.5 top-2.5 h-3.5 w-3.5 text-muted-foreground rtl:left-auto rtl:right-2.5" />
                  <Input
                    placeholder={ar ? "بحث في المعاينة..." : "Search preview..."}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 text-xs pl-8 rtl:pl-3 rtl:pr-8"
                  />
                </div>

                <div className="flex items-center gap-1.5 flex-wrap">
                  <Button
                    type="button"
                    variant={actionFilter === "all" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActionFilter("all")}
                    className="h-7 text-xs px-2.5 font-semibold"
                  >
                    {ar ? "الكل" : "All"} ({parseResult.totalRows})
                  </Button>
                  <Button
                    type="button"
                    variant={actionFilter === "create" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActionFilter("create")}
                    className="h-7 text-xs px-2.5 font-semibold text-emerald-700 dark:text-emerald-300 border-emerald-500/30"
                  >
                    {ar ? "جديد" : "New"} ({parseResult.createCount})
                  </Button>
                  <Button
                    type="button"
                    variant={actionFilter === "update" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActionFilter("update")}
                    className="h-7 text-xs px-2.5 font-semibold text-blue-700 dark:text-blue-300 border-blue-500/30"
                  >
                    {ar ? "تحديث" : "Update"} ({parseResult.updateCount})
                  </Button>
                  <Button
                    type="button"
                    variant={actionFilter === "duplicate_skip" ? "default" : "outline"}
                    size="sm"
                    onClick={() => setActionFilter("duplicate_skip")}
                    className="h-7 text-xs px-2.5 font-semibold text-muted-foreground"
                  >
                    {ar ? "مكرر (تخطي)" : "Duplicates"} ({parseResult.duplicateCount})
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setStep("upload");
                      setParseResult(null);
                    }}
                    className="h-7 text-xs px-2 text-muted-foreground gap-1"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    {ar ? "تغيير الملف" : "Change File"}
                  </Button>
                </div>
              </div>

              {/* Preview Table */}
              <div className="rounded-xl border overflow-hidden max-h-72 overflow-y-auto shadow-2xs">
                <Table>
                  <TableHeader className="bg-muted/60 sticky top-0 z-10">
                    <TableRow>
                      <TableHead className="w-12 text-center text-xs font-bold">#</TableHead>
                      <TableHead className="text-xs font-bold">{ar ? "القسم" : "Department"}</TableHead>
                      <TableHead className="text-xs font-bold">{ar ? "المسمى الوظيفي" : "Job Title"}</TableHead>
                      <TableHead className="text-xs font-bold">{ar ? "الدرجة (Level)" : "Level"}</TableHead>
                      <TableHead className="text-xs font-bold w-44 text-center">{ar ? "الإجراء المتوقع" : "Action"}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredRows.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-6 text-xs text-muted-foreground">
                          {ar ? "لا توجد نتائج مطابقة للبحث أو الفلتر" : "No matching rows found"}
                        </TableCell>
                      </TableRow>
                    ) : (
                      filteredRows.slice(0, 100).map((r) => (
                        <TableRow
                          key={r.index}
                          className={`text-xs ${
                            r.action === "duplicate_skip"
                              ? "bg-muted/20 opacity-65"
                              : r.action === "update"
                              ? "bg-blue-500/5"
                              : ""
                          }`}
                        >
                          <TableCell className="text-center text-muted-foreground font-mono">
                            {r.index}
                          </TableCell>
                          <TableCell className="font-semibold text-foreground">
                            {r.department || (
                              <span className="text-muted-foreground italic">
                                {ar ? "(غير محدد)" : "(Not specified)"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell className="font-medium">
                            {r.jobTitle || (
                              <span className="text-muted-foreground italic">
                                {ar ? "(قسم فقط)" : "(Department only)"}
                              </span>
                            )}
                          </TableCell>
                          <TableCell>
                            {r.level ? (
                              <Badge variant="outline" className="font-mono text-[10px] bg-muted/40">
                                {r.level}
                              </Badge>
                            ) : (
                              <span className="text-muted-foreground">—</span>
                            )}
                          </TableCell>
                          <TableCell className="text-center">
                            {r.action === "create" && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-[10px] gap-1 font-semibold border-0">
                                <PlusCircle className="w-3 h-3 text-emerald-600" />
                                {ar ? "إنشاء جديد" : "Create New"}
                              </Badge>
                            )}
                            {r.action === "update" && (
                              <Badge className="bg-blue-500/15 text-blue-700 dark:text-blue-300 hover:bg-blue-500/20 text-[10px] gap-1 font-semibold border-0" title={r.issues.join(", ")}>
                                <RefreshCw className="w-3 h-3 text-blue-600" />
                                {ar ? "تحديث الدرجة" : "Update Level"}
                                {r.existingLevel ? ` (${r.existingLevel} ➔ ${r.level})` : ""}
                              </Badge>
                            )}
                            {r.action === "duplicate_skip" && (
                              <Badge
                                variant="outline"
                                className="bg-muted text-muted-foreground border-border text-[10px] gap-1 font-medium"
                                title={r.issues.join(", ")}
                              >
                                <ShieldCheck className="w-3 h-3 text-muted-foreground" />
                                {ar ? "مكرر (لن ينزل)" : "Duplicate (Skip)"}
                              </Badge>
                            )}
                            {r.action === "invalid" && (
                              <Badge
                                variant="destructive"
                                className="text-[10px] gap-1 font-semibold"
                                title={r.issues.join(", ")}
                              >
                                <AlertCircle className="w-3 h-3" />
                                {ar ? "مرفوض" : "Invalid"}
                              </Badge>
                            )}
                          </TableCell>
                        </TableRow>
                      ))
                    )}
                  </TableBody>
                </Table>
              </div>
              {filteredRows.length > 100 && (
                <p className="text-[11px] text-muted-foreground text-center">
                  {ar
                    ? `يتم عرض أول 100 صف من إجمالي ${filteredRows.length} صف للمعاينة السريعة`
                    : `Showing first 100 of ${filteredRows.length} rows`}
                </p>
              )}
            </div>
          )}

          {/* STEP 3: IMPORTING */}
          {step === "importing" && (
            <div className="py-12 text-center space-y-5">
              <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center animate-pulse">
                <Loader2 className="w-8 h-8 animate-spin" />
              </div>
              <div className="space-y-1.5">
                <h3 className="text-lg font-bold text-foreground">
                  {ar ? "جاري إنشاء وتحديث السجلات وحظر المكررات..." : "Creating, updating records and preventing duplicates..."}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {ar
                    ? "يتم الآن إدخال المسميات الجديدة، وتحديث الدرجات للموجود، وتخطي أي تكرار بالكامل."
                    : "Inserting new items, updating levels, and safely skipping identical records."}
                </p>
              </div>
              <div className="max-w-md mx-auto space-y-1">
                <Progress value={importProgress} className="h-2" />
                <span className="text-[11px] text-muted-foreground font-mono">{importProgress}%</span>
              </div>
            </div>
          )}

          {/* STEP 4: COMPLETE */}
          {step === "complete" && importStats && (
            <div className="py-8 text-center space-y-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-emerald-500/10 text-emerald-600 flex items-center justify-center shadow-sm">
                <Check className="w-8 h-8" />
              </div>
              <div className="space-y-1">
                <h3 className="text-xl font-bold text-foreground">
                  {ar ? "اكتمل الاستيراد والتحديث بنجاح!" : "Import & Update Completed Successfully!"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "تم تحديث قواعد بيانات الأقسام والمسميات الوظيفية بأمان مع منع تام للتكرار."
                    : "Lookups database has been updated safely with zero duplicates created."}
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20">
                  <span className="text-[11px] font-bold text-emerald-800 dark:text-emerald-300">
                    {ar ? "تم إنشاؤها (جديدة)" : "Created New"}
                  </span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {importStats.insertedCount}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-blue-500/10 border-blue-500/20">
                  <span className="text-[11px] font-bold text-blue-800 dark:text-blue-300">
                    {ar ? "تم تحديثها" : "Updated"}
                  </span>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {importStats.updatedCount}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/40">
                  <span className="text-[11px] font-bold text-muted-foreground">
                    {ar ? "مكررة (لم تنزل)" : "Skipped Duplicates"}
                  </span>
                  <p className="text-2xl font-black text-muted-foreground mt-1">
                    {importStats.skippedCount}
                  </p>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="p-4 border-t bg-muted/20 flex items-center justify-between gap-3">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleClose}
            disabled={step === "importing"}
            className="text-xs font-semibold h-9"
          >
            {step === "complete" ? (ar ? "إغلاق" : "Close") : (ar ? "إلغاء" : "Cancel")}
          </Button>

          {step === "preview" && parseResult && (
            <Button
              type="button"
              onClick={handleExecuteImport}
              disabled={parseResult.createCount === 0 && parseResult.updateCount === 0}
              className="gap-2 bg-gradient-to-r from-primary to-indigo-600 font-bold text-white shadow-md text-xs h-9 px-5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {parseResult.createCount === 0 && parseResult.updateCount === 0
                ? (ar ? "لا توجد سجلات جديدة (الكل مكرر)" : "All records are duplicates")
                : (ar
                  ? `بدء الاستيراد (${parseResult.createCount} إنشاء + ${parseResult.updateCount} تحديث)`
                  : `Start Import (${parseResult.createCount} Create + ${parseResult.updateCount} Update)`)}
            </Button>
          )}

          {step === "complete" && (
            <Button
              type="button"
              onClick={handleClose}
              className="bg-primary font-bold text-white shadow-md text-xs h-9 px-6"
            >
              {ar ? "تم" : "Done"}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
