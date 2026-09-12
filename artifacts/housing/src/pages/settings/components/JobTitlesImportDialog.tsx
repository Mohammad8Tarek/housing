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
} from "lucide-react";
import {
  downloadJobTitlesTemplate,
  parseJobTitlesFile,
  type ParseResult,
  type ParsedJobTitleRow,
} from "@/lib/job-title-importer-engine";

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

  const [step, setStep] = useState<"upload" | "preview" | "importing" | "complete">("upload");
  const [parseResult, setParseResult] = useState<ParseResult | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "valid" | "warning" | "invalid">("all");
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
    setStatusFilter("all");
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
      const result = await parseJobTitlesFile(file);
      setParseResult(result);
      setStep("preview");
      toast.success(
        ar
          ? `تمت قراءة الملف بنجاح (${result.totalRows} صف، ${result.departments.length} قسم)`
          : `File parsed successfully (${result.totalRows} rows, ${result.departments.length} departments)`
      );
    } catch (err: any) {
      toast.error(err.message || (ar ? "فشلت قراءة الملف" : "Failed to parse file"));
    } finally {
      setIsProcessingFile(false);
    }
  };

  const handleExecuteImport = async () => {
    if (!parseResult || parseResult.validCount === 0 || !propertyId) return;

    setStep("importing");
    setImportProgress(15);

    try {
      // 1. Prepare batch items:
      // First: unique departments
      const batchItems: Array<{
        category: string;
        value: string;
        parentValue?: string | null;
        extraValue?: string | null;
      }> = [];

      for (const dept of parseResult.departments) {
        if (dept.trim()) {
          batchItems.push({
            category: "department",
            value: dept.trim(),
            parentValue: null,
            extraValue: null,
          });
        }
      }

      setImportProgress(35);

      // Second: job titles with their department (parentValue) and level (extraValue)
      for (const row of parseResult.rows) {
        if (row.jobTitle && row.status !== "invalid") {
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
      setImportStats(resData);
      setImportProgress(100);
      setStep("complete");

      await queryClient.invalidateQueries({ queryKey: ["lookup-values", propertyId] });
      await queryClient.invalidateQueries({ queryKey: ["/api/lookup-values"] });
      if (onSuccess) onSuccess();

      toast.success(
        ar
          ? `تم الاستيراد بنجاح! (+${resData.insertedCount} جديد، ${resData.updatedCount} محدث)`
          : `Import completed! (+${resData.insertedCount} inserted, ${resData.updatedCount} updated)`
      );
    } catch (err: any) {
      toast.error(err.message || (ar ? "حدث خطأ أثناء الاستيراد" : "Error during import"));
      setStep("preview");
    }
  };

  const filteredRows = (parseResult?.rows || []).filter((r) => {
    if (statusFilter !== "all" && r.status !== statusFilter) return false;
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
              <DialogTitle className="text-xl font-bold">
                {ar ? "استيراد الأقسام والمسميات الوظيفية والدرجات" : "Import Departments, Job Titles & Levels"}
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                {ar
                  ? "استيراد سريع ومباشر من ملف Excel أو CSV مع تحديد القسم والوظيفة والدرجة (Level) دفعة واحدة"
                  : "Bulk import departments, positions, and job levels from Excel or CSV in one step"}
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
                      ? "يحتوي النموذج على الأعمدة المطلوبة (القسم، المسمى الوظيفي، والدرجة Level) مع أمثلة جاهزة تناسب معايير الفنادق والسكن."
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
                    ? (ar ? "جاري قراءة وتحليل الملف..." : "Reading and analyzing file...")
                    : (ar ? "اضغط لاختيار ملف Excel أو CSV أو اسحبه هنا" : "Click to select Excel or CSV file or drag & drop")}
                </h3>
                <p className="text-xs text-muted-foreground mt-1.5">
                  {ar
                    ? "يدعم صيغ (.xlsx, .xls, .csv) حتى 25 ميجابايت"
                    : "Supports (.xlsx, .xls, .csv) up to 25MB"}
                </p>
              </div>

              {/* Info Column Guide */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 pt-2">
                <div className="p-3.5 rounded-xl border bg-card/60 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-primary">
                    <Building2 className="w-4 h-4" />
                    <span>{ar ? "1. القسم (Department)" : "1. Department"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "اسم القسم التابع له المسمى. إذا لم يكن القسم موجوداً، سيتم إنشاؤه تلقائياً."
                      : "Department name. Missing departments will be automatically created."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-card/60 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-indigo-600 dark:text-indigo-400">
                    <Briefcase className="w-4 h-4" />
                    <span>{ar ? "2. المسمى الوظيفي (Job Title)" : "2. Job Title"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "اسم الوظيفة أو المنصب المراد إضافته وربطه بالقسم."
                      : "The position or title to be linked to the department."}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-card/60 shadow-2xs space-y-1">
                  <div className="flex items-center gap-2 text-xs font-bold text-amber-600 dark:text-amber-400">
                    <Layers className="w-4 h-4" />
                    <span>{ar ? "3. الدرجة / المستوى (Level)" : "3. Level / Grade"}</span>
                  </div>
                  <p className="text-[11px] text-muted-foreground">
                    {ar
                      ? "المستوى أو الدرجة الوظيفية (مثل Level 1، Level 2، الإشرافي، التنفيذي) لتسهيل توزيع السكن."
                      : "Job level or grade (e.g. Level 1, Level 2, Executive) for housing eligibility."}
                  </p>
                </div>
              </div>
            </div>
          )}

          {/* STEP 2: PREVIEW */}
          {step === "preview" && parseResult && (
            <div className="space-y-4">
              {/* Stats Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="p-3 rounded-xl border bg-card/70 shadow-2xs">
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    {ar ? "إجمالي الصفوف" : "Total Rows"}
                  </span>
                  <p className="text-xl font-black text-foreground mt-0.5">{parseResult.totalRows}</p>
                </div>

                <div className="p-3 rounded-xl border bg-card/70 shadow-2xs">
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    {ar ? "الأقسام المكتشفة" : "Departments"}
                  </span>
                  <p className="text-xl font-black text-primary mt-0.5">{parseResult.departments.length}</p>
                </div>

                <div className="p-3 rounded-xl border bg-card/70 shadow-2xs">
                  <span className="text-[11px] text-muted-foreground font-semibold">
                    {ar ? "المسميات الوظيفية" : "Job Titles"}
                  </span>
                  <p className="text-xl font-black text-indigo-600 dark:text-indigo-400 mt-0.5">
                    {parseResult.jobTitlesCount}
                  </p>
                </div>

                <div className="p-3 rounded-xl border bg-emerald-500/10 border-emerald-500/20 shadow-2xs">
                  <span className="text-[11px] text-emerald-800 dark:text-emerald-300 font-semibold">
                    {ar ? "السجلات الصالحة" : "Valid Records"}
                  </span>
                  <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-0.5">
                    {parseResult.validCount}
                  </p>
                </div>
              </div>

              {/* Table Toolbar */}
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
                  {(["all", "valid", "warning", "invalid"] as const).map((filterKey) => (
                    <Button
                      key={filterKey}
                      type="button"
                      variant={statusFilter === filterKey ? "default" : "outline"}
                      size="sm"
                      onClick={() => setStatusFilter(filterKey)}
                      className="h-7 text-xs px-2.5 font-semibold"
                    >
                      {filterKey === "all" && (ar ? "الكل" : "All")}
                      {filterKey === "valid" && (ar ? "سليم" : "Valid")}
                      {filterKey === "warning" && (ar ? "تنبيه" : "Warning")}
                      {filterKey === "invalid" && (ar ? "غير صالح" : "Invalid")}
                    </Button>
                  ))}
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
                      <TableHead className="text-xs font-bold w-28 text-center">{ar ? "الحالة" : "Status"}</TableHead>
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
                        <TableRow key={r.index} className="text-xs">
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
                            {r.status === "valid" && (
                              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 text-[10px] gap-1 font-semibold border-0">
                                <CheckCircle2 className="w-3 h-3 text-emerald-600" />
                                {ar ? "صالح" : "Valid"}
                              </Badge>
                            )}
                            {r.status === "warning" && (
                              <Badge
                                variant="outline"
                                className="bg-amber-500/10 text-amber-700 dark:text-amber-300 border-amber-500/20 text-[10px] gap-1 font-semibold"
                                title={r.issues.join(", ")}
                              >
                                <AlertTriangle className="w-3 h-3 text-amber-600" />
                                {ar ? "تنبيه" : "Warning"}
                              </Badge>
                            )}
                            {r.status === "invalid" && (
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
                  {ar ? "جاري استيراد وحفظ الأقسام والمسميات الوظيفية..." : "Importing departments and job titles..."}
                </h3>
                <p className="text-xs text-muted-foreground max-w-sm mx-auto">
                  {ar
                    ? "يتم الآن التحقق من قاعدة البيانات وإنشاء السجلات وتحديث الدرجات مع منع التكرار."
                    : "Verifying database records, creating lookups and updating levels..."}
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
                  {ar ? "اكتمل الاستيراد بنجاح!" : "Import Completed Successfully!"}
                </h3>
                <p className="text-xs text-muted-foreground">
                  {ar
                    ? "تم تحديث قوائم الأقسام والمسميات الوظيفية في النظام بنجاح"
                    : "Departments and job titles lookup lists have been updated"}
                </p>
              </div>

              {/* Summary Cards */}
              <div className="grid grid-cols-3 gap-3 max-w-md mx-auto">
                <div className="p-3.5 rounded-xl border bg-emerald-500/10 border-emerald-500/20">
                  <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-300">
                    {ar ? "سجلات جديدة" : "Inserted"}
                  </span>
                  <p className="text-2xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
                    {importStats.insertedCount}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-blue-500/10 border-blue-500/20">
                  <span className="text-[11px] font-semibold text-blue-800 dark:text-blue-300">
                    {ar ? "سجلات تم تحديثها" : "Updated"}
                  </span>
                  <p className="text-2xl font-black text-blue-600 dark:text-blue-400 mt-1">
                    {importStats.updatedCount}
                  </p>
                </div>

                <div className="p-3.5 rounded-xl border bg-muted/40">
                  <span className="text-[11px] font-semibold text-muted-foreground">
                    {ar ? "تم تخطيها (موجودة)" : "Skipped"}
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
              disabled={parseResult.validCount === 0}
              className="gap-2 bg-gradient-to-r from-primary to-indigo-600 font-bold text-white shadow-md text-xs h-9 px-5"
            >
              <FileSpreadsheet className="w-4 h-4" />
              {ar
                ? `استيراد ${parseResult.validCount} سجلاً الآن`
                : `Import ${parseResult.validCount} Records Now`}
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
