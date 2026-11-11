// Profile detail: ID / passport documents.
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Camera, Shield, Download, Trash2, Eye, FileText } from "lucide-react";
import { formatDate } from "@/lib/date-utils";
import type {
  ProfileDetailState,
  ProfileDetailView,
} from "./useProfileDetailState";

export function renderDocumentsCard(
  s: ProfileDetailState,
  v: ProfileDetailView,
) {
  const {
    ar,
    idFileRef,
    deletingDocIndex,
    setPreviewDoc,
    handleIdImageUpload,
    handleDeleteDoc,
    handleDownloadDoc,
    uploading,
  } = s;
  const { emp } = v;
  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-base flex items-center gap-2">
            <Shield className="w-4 h-4 text-primary" />
            {ar ? "مستندات الهوية / جواز السفر" : "ID / Passport Documents"}
          </CardTitle>
          <Button
            size="sm"
            variant="outline"
            onClick={() => idFileRef.current?.click()}
            disabled={uploading}
            className="gap-1.5"
          >
            <Camera className="w-3.5 h-3.5" />
            {ar ? "إضافة مستند" : "Add Document"}
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <input
          ref={idFileRef}
          type="file"
          multiple
          accept="image/*,.pdf"
          className="hidden"
          onChange={handleIdImageUpload}
        />
        {emp.idDocuments && emp.idDocuments.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 mt-2">
            {emp.idDocuments.map((doc: any, i: number) => {
              const isImage =
                doc.fileData && doc.fileData.startsWith("data:image");
              const isDeleting = deletingDocIndex === i;
              return (
                <div
                  key={i}
                  className="relative group border rounded-xl overflow-hidden flex flex-col justify-between bg-card hover:shadow-md transition-all duration-200 border-border"
                >
                  {/* Thumbnail & Preview Trigger */}
                  <div
                    className="relative h-32 w-full bg-muted/30 cursor-pointer overflow-hidden flex items-center justify-center border-b border-border/40"
                    onClick={() => setPreviewDoc(doc)}
                    title={ar ? "انقر للمعاينة" : "Click to preview"}
                  >
                    {isImage ? (
                      <img
                        src={doc.fileData}
                        alt={doc.fileName}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-1.5 text-muted-foreground p-3 text-center">
                        <FileText className="w-9 h-9 text-primary/70" />
                        <span className="text-[11px] font-mono font-medium">
                          PDF / Doc
                        </span>
                      </div>
                    )}
                    {/* Hover Overlay */}
                    <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center gap-1.5 text-white text-xs font-medium">
                      <Eye className="w-4 h-4" />
                      <span>{ar ? "معاينة" : "Preview"}</span>
                    </div>
                  </div>

                  {/* Bottom Info & Action Buttons */}
                  <div className="p-2.5 bg-background flex flex-col gap-2">
                    <div className="flex items-center justify-between gap-1">
                      <span
                        className="text-xs font-semibold truncate flex-1"
                        title={doc.fileName}
                      >
                        {doc.fileName}
                      </span>
                      {doc.uploadedAt && (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {formatDate(doc.uploadedAt)}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-1.5 pt-1.5 border-t border-border/60">
                      {/* Download button */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="flex-1 h-7 text-xs gap-1 text-primary hover:text-primary hover:bg-primary/10 font-medium"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDownloadDoc(doc);
                        }}
                      >
                        <Download className="w-3.5 h-3.5" />
                        {ar ? "تحميل" : "Download"}
                      </Button>

                      {/* Delete button */}
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-7 px-2.5 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30 gap-1 font-medium"
                        disabled={isDeleting}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDeleteDoc(i);
                        }}
                        title={ar ? "حذف هذا المستند" : "Delete this document"}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>
                          {isDeleting
                            ? ar
                              ? "..."
                              : "..."
                            : ar
                              ? "حذف"
                              : "Delete"}
                        </span>
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="mt-2 py-8 flex flex-col items-center justify-center text-muted-foreground border-2 border-dashed border-border rounded-xl bg-muted/20">
            <Shield className="w-8 h-8 mb-2 opacity-20" />
            <p className="text-sm">
              {ar
                ? "لا توجد مستندات هوية مرفوعة"
                : "No ID documents uploaded yet"}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
