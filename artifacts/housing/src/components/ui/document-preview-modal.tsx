import { useState, useEffect, useMemo } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import {
  Download,
  ExternalLink,
  FileText,
  Printer,
  Eye,
  FileSpreadsheet,
  FileCode,
  File,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

export interface PreviewableDocument {
  fileName: string;
  fileType?: string;
  fileData?: string;
  title?: string;
}

interface DocumentPreviewModalProps {
  doc: PreviewableDocument | null;
  isOpen: boolean;
  onClose: () => void;
}

/**
 * Converts a base64 Data URI or raw base64 string to a native browser Blob
 */
export function dataUriToBlob(dataUri: string, defaultMime = "application/octet-stream"): Blob {
  try {
    if (dataUri.startsWith("blob:") || dataUri.startsWith("http")) {
      return new Blob([]);
    }

    if (!dataUri.startsWith("data:")) {
      const byteCharacters = atob(dataUri);
      const byteNumbers = new Uint8Array(byteCharacters.length);
      for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
      }
      return new Blob([byteNumbers], { type: defaultMime });
    }

    const parts = dataUri.split(",");
    const mimeMatch = parts[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : defaultMime;
    const base64Data = parts[1] || "";
    const byteCharacters = atob(base64Data);
    const byteNumbers = new Uint8Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    return new Blob([byteNumbers], { type: mime });
  } catch (err) {
    console.error("Failed to parse document data to Blob", err);
    return new Blob([]);
  }
}

/**
 * Robust document download handler
 */
export function downloadDocument(doc: PreviewableDocument) {
  if (!doc.fileData) return;

  try {
    let url = doc.fileData;
    let shouldRevoke = false;

    if (doc.fileData.startsWith("data:")) {
      const blob = dataUriToBlob(doc.fileData, doc.fileType || "application/octet-stream");
      url = URL.createObjectURL(blob);
      shouldRevoke = true;
    }

    const link = document.createElement("a");
    link.href = url;
    link.download = doc.fileName || "document";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    if (shouldRevoke) {
      setTimeout(() => URL.revokeObjectURL(url), 1500);
    }
  } catch (err) {
    console.error("Download failed", err);
  }
}

export function DocumentPreviewModal({
  doc,
  isOpen,
  onClose,
}: DocumentPreviewModalProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  // Determine file type and extension
  const { isImage, isPdf, ext, mime } = useMemo(() => {
    if (!doc) return { isImage: false, isPdf: false, ext: "", mime: "" };

    const name = (doc.fileName || "").toLowerCase();
    const extension = name.split(".").pop() || "";
    const rawData = doc.fileData || "";
    const rawType = (doc.fileType || "").toLowerCase();

    const imageExts = ["jpg", "jpeg", "png", "webp", "gif", "svg", "bmp"];
    const detectedIsImage =
      rawData.startsWith("data:image") ||
      rawType.startsWith("image/") ||
      imageExts.includes(extension);

    const detectedIsPdf =
      rawData.startsWith("data:application/pdf") ||
      rawType === "application/pdf" ||
      extension === "pdf";

    return {
      isImage: detectedIsImage,
      isPdf: detectedIsPdf,
      ext: extension,
      mime: rawType,
    };
  }, [doc]);

  // Generate safe Blob URL for PDFs and binary documents
  useEffect(() => {
    if (!isOpen || !doc?.fileData) {
      if (blobUrl) {
        URL.revokeObjectURL(blobUrl);
        setBlobUrl(null);
      }
      return;
    }

    if (doc.fileData.startsWith("blob:") || doc.fileData.startsWith("http")) {
      setBlobUrl(doc.fileData);
      return;
    }

    if (doc.fileData.startsWith("data:")) {
      const defaultMime = isPdf
        ? "application/pdf"
        : isImage
        ? "image/jpeg"
        : "application/octet-stream";
      const blob = dataUriToBlob(doc.fileData, defaultMime);
      if (blob.size > 0) {
        const url = URL.createObjectURL(blob);
        setBlobUrl(url);

        return () => {
          URL.revokeObjectURL(url);
        };
      }
    }

    return undefined;
  }, [isOpen, doc, isPdf, isImage]);

  if (!doc) return null;

  const handleOpenNewTab = () => {
    if (blobUrl) {
      window.open(blobUrl, "_blank");
    } else if (doc.fileData) {
      const blob = dataUriToBlob(doc.fileData, doc.fileType);
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank");
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    }
  };

  const handlePrint = () => {
    if (isPdf && blobUrl) {
      const iframe = document.createElement("iframe");
      iframe.style.display = "none";
      iframe.src = blobUrl;
      document.body.appendChild(iframe);
      iframe.onload = () => {
        iframe.contentWindow?.print();
        setTimeout(() => document.body.removeChild(iframe), 60000);
      };
    } else {
      window.print();
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-4xl w-[95vw] max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        {/* Header */}
        <DialogHeader className="flex flex-row items-center justify-between gap-3 pb-3 border-b flex-none">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-lg bg-primary/10 text-primary shrink-0">
              {isImage ? (
                <Eye className="w-4 h-4" />
              ) : isPdf ? (
                <FileText className="w-4 h-4 text-red-500" />
              ) : (
                <File className="w-4 h-4 text-blue-500" />
              )}
            </div>
            <div className="min-w-0">
              <DialogTitle className="text-base sm:text-lg font-bold truncate">
                {doc.title || doc.fileName}
              </DialogTitle>
              {doc.title && doc.fileName !== doc.title && (
                <p className="text-xs text-muted-foreground truncate">
                  {doc.fileName}
                </p>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex items-center gap-1.5 shrink-0">
            {(isPdf || isImage) && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs"
                onClick={handleOpenNewTab}
                title={ar ? "فتح في نافذة كاملة" : "Open in new tab"}
              >
                <ExternalLink className="w-3.5 h-3.5 text-primary" />
                <span className="hidden sm:inline">
                  {ar ? "نافذة جديدة" : "New Tab"}
                </span>
              </Button>
            )}

            {isPdf && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 gap-1.5 text-xs hidden md:flex"
                onClick={handlePrint}
                title={ar ? "طباعة" : "Print"}
              >
                <Printer className="w-3.5 h-3.5" />
                <span>{ar ? "طباعة" : "Print"}</span>
              </Button>
            )}

            <Button
              size="sm"
              variant="default"
              className="h-8 gap-1.5 text-xs shadow-xs"
              onClick={() => downloadDocument(doc)}
            >
              <Download className="w-3.5 h-3.5" />
              <span>{ar ? "تحميل" : "Download"}</span>
            </Button>
          </div>
        </DialogHeader>

        {/* Preview Content Body */}
        <div className="flex-1 min-h-[300px] max-h-[76vh] overflow-auto rounded-xl bg-muted/20 border border-border/60 mt-3 p-2 flex items-center justify-center">
          {/* 1. Image Preview */}
          {isImage ? (
            <div className="flex items-center justify-center w-full h-full p-2">
              <img
                src={blobUrl || doc.fileData}
                alt={doc.fileName}
                className="max-h-[72vh] max-w-full object-contain rounded-lg shadow-sm"
              />
            </div>
          ) : isPdf ? (
            /* 2. PDF Preview */
            <div className="w-full h-full min-h-[550px] flex flex-col">
              {blobUrl ? (
                <iframe
                  src={`${blobUrl}#toolbar=1&navpanes=0`}
                  title={doc.fileName}
                  className="w-full h-full min-h-[550px] rounded-lg border-0 bg-background"
                />
              ) : (
                <div className="flex flex-col items-center justify-center p-12 text-center text-muted-foreground gap-3">
                  <FileText className="w-16 h-16 text-red-500/80 animate-pulse" />
                  <p className="text-sm font-semibold text-foreground">
                    {ar ? "جاري تحميل مستند PDF..." : "Loading PDF document..."}
                  </p>
                </div>
              )}
            </div>
          ) : (
            /* 3. Non-previewable / Office / Binary files */
            <div className="flex flex-col items-center justify-center p-12 text-center gap-4">
              <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-primary shadow-xs">
                {ext === "xlsx" || ext === "xls" || ext === "csv" ? (
                  <FileSpreadsheet className="w-10 h-10 text-emerald-600" />
                ) : ext === "json" || ext === "xml" ? (
                  <FileCode className="w-10 h-10 text-blue-600" />
                ) : (
                  <File className="w-10 h-10 text-primary" />
                )}
              </div>
              <div>
                <h4 className="text-base font-bold text-foreground">
                  {doc.fileName}
                </h4>
                <p className="text-xs text-muted-foreground mt-1 max-w-md">
                  {ar
                    ? "معاينة هذا النوع من الملفات تتطلب تحميله وفتحه بالتطبيق المخصص له."
                    : "Preview for this file type is not supported directly in the browser. Please download to view."}
                </p>
              </div>
              <Button
                size="sm"
                onClick={() => downloadDocument(doc)}
                className="gap-2 shadow-xs"
              >
                <Download className="w-4 h-4" />
                {ar ? "تحميل وفتح الملف" : "Download to View"}
              </Button>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
