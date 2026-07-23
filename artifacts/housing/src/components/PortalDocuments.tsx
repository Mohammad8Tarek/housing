// @ts-nocheck
import { useState, useRef } from "react";
import { useProperty } from "@/context/PropertyContext";
import { useLanguage } from "@/context/LanguageContext";
import { useToast } from "@/hooks/use-toast";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Upload, Trash2, FileText } from "lucide-react";

const CATEGORIES = [
  { value: "policy", label: "Policy", labelAr: "سياسة" },
  { value: "form", label: "Form", labelAr: "نموذج" },
  { value: "guide", label: "Guide", labelAr: "دليل" },
  { value: "report", label: "Report", labelAr: "تقرير" },
];

const CATEGORY_BADGE: Record<string, string> = {
  policy: "bg-blue-100 text-blue-800 dark:bg-blue-900/40 dark:text-blue-300",
  form: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  guide:
    "bg-purple-100 text-purple-800 dark:bg-purple-900/40 dark:text-purple-300",
  report:
    "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-300",
};

export default function PortalDocuments() {
  const { activePropertyId } = useProperty();
  const { language } = useLanguage();
  const ar = language === "ar";
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [isOpen, setIsOpen] = useState(false);
  const [titleAr, setTitleAr] = useState("");
  const [titleEn, setTitleEn] = useState("");
  const [category, setCategory] = useState("policy");
  const [file, setFile] = useState<File | null>(null);
  const [fileData, setFileData] = useState("");
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetForm = () => {
    setTitleAr("");
    setTitleEn("");
    setCategory("policy");
    setFile(null);
    setFileData("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const { data: documents, isLoading } = useQuery({
    queryKey: ["documents", activePropertyId],
    queryFn: async () => {
      const res = await fetch(`/api/documents?propertyId=${activePropertyId}`, {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch documents");
      return res.json();
    },
    enabled: !!activePropertyId,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selected = e.target.files?.[0];
    if (!selected) return;
    setFile(selected);
    const reader = new FileReader();
    reader.onload = (ev) => {
      setFileData(ev.target?.result as string);
    };
    reader.readAsDataURL(selected);
  };

  const handleUpload = async () => {
    if (!titleAr.trim() || !fileData) {
      toast({
        title: ar ? "يرجى ملء الحقول المطلوبة" : "Please fill required fields",
        variant: "destructive",
      });
      return;
    }
    setUploading(true);
    try {
      const res = await fetch("/api/documents", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          propertyId: activePropertyId,
          titleAr: titleAr.trim(),
          titleEn: titleEn.trim(),
          fileName: file?.name || "",
          fileType: file?.type || "",
          fileData,
          category,
        }),
      });
      if (!res.ok) {
        const err = await res
          .json()
          .catch(() => ({ message: "Upload failed" }));
        throw new Error(err.message || "Upload failed");
      }
      toast({ title: ar ? "تم رفع المستند" : "Document uploaded" });
      queryClient.invalidateQueries({
        queryKey: ["documents", activePropertyId],
      });
      setIsOpen(false);
      resetForm();
    } catch (err: any) {
      toast({
        title: ar ? "فشل الرفع" : "Upload failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setUploading(false);
    }
  };

  const [deleteTarget, setDeleteTarget] = useState<{
    id: number;
    title: string;
  } | null>(null);

  const handleDelete = async (id: number, title: string) => {
    setDeleteTarget({ id, title });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    try {
      const res = await fetch(
        `/api/documents/${deleteTarget.id}?propertyId=${activePropertyId}`,
        { method: "DELETE", credentials: "include" },
      );
      if (!res.ok) throw new Error("Delete failed");
      toast({ title: ar ? "تم حذف المستند" : "Document deleted" });
      queryClient.invalidateQueries({
        queryKey: ["documents", activePropertyId],
      });
    } catch (err: any) {
      toast({
        title: ar ? "فشل الحذف" : "Delete failed",
        description: err.message,
        variant: "destructive",
      });
    } finally {
      setDeleteTarget(null);
    }
  };

  const formatDate = (dateStr: string) => {
    if (!dateStr) return "—";
    return new Date(dateStr).toLocaleDateString(ar ? "ar-AE" : "en-GB", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getFileExt = (name: string) =>
    name?.split(".").pop()?.toUpperCase() || "";

  const docList: any[] = documents || [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div>
          <h3 className="text-lg font-bold">
            {ar ? "المستندات" : "Documents"}
          </h3>
          <p className="text-xs text-muted-foreground mt-0.5">
            {ar ? "إدارة مستندات البوابة" : "Manage portal documents"}
          </p>
        </div>
        <Button size="sm" onClick={() => setIsOpen(true)}>
          <Upload className="w-4 h-4 mr-2" />
          {ar ? "رفع مستند" : "Upload Document"}
        </Button>
      </div>

      {/* Table */}
      {isLoading ? (
        <Skeleton className="h-64 w-full" />
      ) : (
        <div className="border rounded-lg bg-card overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/30">
                <TableHead className="font-semibold h-10">
                  {ar ? "العنوان" : "Title"}
                </TableHead>
                <TableHead className="font-semibold h-10">
                  {ar ? "التصنيف" : "Category"}
                </TableHead>
                <TableHead className="font-semibold h-10">
                  {ar ? "تاريخ الرفع" : "Upload Date"}
                </TableHead>
                <TableHead className="font-semibold text-right h-10">
                  {ar ? "الإجراءات" : "Actions"}
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {docList.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 text-muted-foreground">
                      <FileText className="w-8 h-8 opacity-30" />
                      <p className="font-medium">
                        {ar ? "لا توجد مستندات" : "No documents found"}
                      </p>
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                docList.map((doc: any) => (
                  <TableRow key={doc.id} className="hover:bg-muted/20">
                    <TableCell className="font-medium">
                      <div>
                        <div className="text-sm">
                          {ar ? doc.titleAr : doc.titleEn || doc.titleAr}
                        </div>
                        <div className="text-[10px] text-muted-foreground font-mono">
                          {doc.fileName} ({getFileExt(doc.fileName)})
                        </div>
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge
                        variant="secondary"
                        className={`text-[10px] font-semibold px-2 py-0 h-5 capitalize ${
                          CATEGORY_BADGE[doc.category] ?? ""
                        }`}
                      >
                        {ar
                          ? (CATEGORIES.find((c) => c.value === doc.category)
                              ?.labelAr ?? doc.category)
                          : (CATEGORIES.find((c) => c.value === doc.category)
                              ?.label ?? doc.category)}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {formatDate(doc.createdAt)}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-muted-foreground hover:text-destructive"
                        onClick={() => handleDelete(doc.id, doc.titleAr)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Upload Dialog */}
      <Dialog
        open={isOpen}
        onOpenChange={(v) => {
          if (!v) {
            setIsOpen(false);
            resetForm();
          }
        }}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Upload className="w-5 h-5 text-primary" />
              {ar ? "رفع مستند" : "Upload Document"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {ar ? "العنوان (بالعربية)" : "TITLE (ARABIC)"}{" "}
                <span className="text-red-500">*</span>
              </Label>
              <Input
                placeholder={
                  ar ? "أدخل العنوان بالعربية" : "Enter title in Arabic"
                }
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {ar ? "العنوان (بالإنجليزية)" : "TITLE (ENGLISH)"}
              </Label>
              <Input
                placeholder={
                  ar ? "أدخل العنوان بالإنجليزية" : "Enter title in English"
                }
                value={titleEn}
                onChange={(e) => setTitleEn(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {ar ? "التصنيف" : "CATEGORY"}
              </Label>
              <Select value={category} onValueChange={setCategory}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CATEGORIES.map((c) => (
                    <SelectItem key={c.value} value={c.value}>
                      {ar ? c.labelAr : c.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
                {ar ? "الملف" : "FILE"} <span className="text-red-500">*</span>
              </Label>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                className="hidden"
                onChange={handleFileSelect}
              />
              <div
                className="border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:border-primary/60 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center gap-2 justify-center">
                    <FileText className="w-5 h-5 text-primary" />
                    <span className="text-sm font-medium">{file.name}</span>
                    <span className="text-xs text-muted-foreground">
                      ({(file.size / 1024).toFixed(1)} KB)
                    </span>
                  </div>
                ) : (
                  <div className="flex flex-col items-center gap-1 text-muted-foreground">
                    <Upload className="w-6 h-6" />
                    <p className="text-sm">
                      {ar ? "انقر لاختيار ملف" : "Click to select a file"}
                    </p>
                    <p className="text-xs">PDF, DOC, DOCX, PNG, JPG</p>
                  </div>
                )}
              </div>
            </div>
          </div>
          <div className="flex gap-3 justify-end pt-4 border-t mt-4">
            <Button
              variant="outline"
              onClick={() => {
                setIsOpen(false);
                resetForm();
              }}
            >
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button
              onClick={handleUpload}
              disabled={uploading || !titleAr.trim() || !fileData}
            >
              {uploading
                ? ar
                  ? "جاري الرفع..."
                  : "Uploading..."
                : ar
                  ? "رفع"
                  : "Upload"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={!!deleteTarget}
        onOpenChange={(v) => {
          if (!v) setDeleteTarget(null);
        }}
      >
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>{ar ? "تأكيد الحذف" : "Confirm Delete"}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-muted-foreground">
            {ar
              ? `هل تريد حذف "${deleteTarget?.title}"؟`
              : `Delete "${deleteTarget?.title}"?`}
          </p>
          <div className="flex gap-3 justify-end pt-4 border-t">
            <Button variant="outline" onClick={() => setDeleteTarget(null)}>
              {ar ? "إلغاء" : "Cancel"}
            </Button>
            <Button variant="destructive" onClick={confirmDelete}>
              {ar ? "حذف" : "Delete"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
