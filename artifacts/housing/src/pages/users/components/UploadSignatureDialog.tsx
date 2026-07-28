import { useState, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { Loader2, Pen, Upload } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";

interface UploadSignatureDialogProps {
  user: any;
  onClose: () => void;
}

export function UploadSignatureDialog({
  user,
  onClose,
}: UploadSignatureDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(
        ar ? "يرجى رفع صورة PNG أو JPEG" : "Please upload a PNG or JPEG image",
      );
      return;
    }
    if (file.size > 2 * 1024 * 1024) {
      toast.error(
        ar
          ? "حجم الصورة يجب أن يكون أقل من 2 ميجابايت"
          : "Image must be under 2MB",
      );
      return;
    }

    setIsUploading(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error("Failed to read file"));
        reader.readAsDataURL(file);
      });
      const res = await fetch(`/api/users/${user.id}/signature`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      toast.success(
        ar ? "تم حفظ التوقيع بنجاح" : "Signature saved successfully",
      );
      onClose();
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : ar ? "فشل الرفع" : "Upload failed",
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  if (!user) return null;

  return (
    <Dialog open={!!user} onOpenChange={(open) => !open && onClose()}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {ar ? "رفع توقيع للمستخدم" : "Upload User Signature"}
          </DialogTitle>
          <DialogDescription>
            {ar
              ? `رفع صورة توقيع للمستخدم: ${user.username}`
              : `Upload a signature image for user: ${user.username}`}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center justify-center space-y-4 py-8">
          <div className="p-4 bg-muted/20 rounded-full border border-dashed border-primary/50">
            <Pen className="w-8 h-8 text-muted-foreground" />
          </div>

          <Button
            variant="outline"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploading}
            className="w-full max-w-sm"
          >
            {isUploading ? (
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
            ) : (
              <Upload className="w-4 h-4 mr-2" />
            )}
            {isUploading
              ? ar
                ? "جاري الرفع..."
                : "Uploading..."
              : ar
                ? "اختيار صورة التوقيع"
                : "Select Signature Image"}
          </Button>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/png,image/jpeg"
            className="hidden"
            onChange={handleFileSelect}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
}
