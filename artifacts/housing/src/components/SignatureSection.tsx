import { useState, useEffect, useRef } from "react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { formatDate } from "@/lib/date-utils";
import { Upload, Trash2, Loader2, Pen } from "lucide-react";

export function SignatureSection() {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [signature, setSignature] = useState<{
    signatureImageUrl: string | null;
    uploadedAt: string | null;
  }>({
    signatureImageUrl: null,
    uploadedAt: null,
  });
  const [isLoading, setIsLoading] = useState(true);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [showCanvas, setShowCanvas] = useState(false);
  const [isDrawing, setIsDrawing] = useState(false);

  useEffect(() => {
    fetch("/api/users/me/signature")
      .then((r) => r.json())
      .then((data) => {
        setSignature({
          signatureImageUrl: data.signatureImageUrl,
          uploadedAt: data.uploadedAt,
        });
      })
      .catch(() =>
        toast.error(ar ? "فشل تحميل التوقيع" : "Failed to load signature"),
      )
      .finally(() => setIsLoading(false));
  }, []);

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!["image/png", "image/jpeg"].includes(file.type)) {
      toast.error(
        ar ? "يرجى رفع صورة PNG أو JPEG" : "Please upload a PNG or JPEG image",
      );
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error(
        ar
          ? "حجم الصورة يجب أن يكون أقل من 5 ميجابايت"
          : "Image must be under 5MB",
      );
      return;
    }

    setIsUploading(true);
    try {
      // Load image and draw to a high-resolution canvas to improve quality
      const img = await new Promise<HTMLImageElement>((resolve, reject) => {
        const r = new FileReader();
        r.onload = () => {
          const image = new Image();
          image.onload = () => resolve(image);
          image.onerror = reject;
          image.src = String(r.result);
        };
        r.onerror = reject;
        r.readAsDataURL(file);
      });

      const maxWidth = 1200;
      const scale = Math.min(1, maxWidth / img.width) || 1;
      const targetWidth = Math.round(img.width * scale);
      const targetHeight = Math.round(img.height * scale);
      const off = document.createElement("canvas");
      off.width = targetWidth * 2; // export at 2x for sharpness
      off.height = targetHeight * 2;
      const ctx = off.getContext("2d");
      if (!ctx) throw new Error("Canvas not supported");
      // White background for signatures
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, off.width, off.height);
      ctx.drawImage(img, 0, 0, off.width, off.height);

      const base64 = off.toDataURL("image/png");

      const res = await fetch("/api/users/me/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setSignature({
        signatureImageUrl: base64,
        uploadedAt: new Date().toISOString(),
      });
      toast.success(ar ? "تم حفظ التوقيع" : "Signature saved");
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : ar ? "فشل الرفع" : "Upload failed",
      );
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const startDrawing = (e: React.PointerEvent) => {
    setIsDrawing(true);
    const c = canvasRef.current;
    if (!c) return;
    c.setPointerCapture(e.pointerId);
  };

  const stopDrawing = (e: React.PointerEvent) => {
    setIsDrawing(false);
    const c = canvasRef.current;
    if (!c) return;
    try {
      c.releasePointerCapture(e.pointerId);
    } catch {}
  };

  const draw = (e: React.PointerEvent) => {
    if (!isDrawing) return;
    const c = canvasRef.current;
    if (!c) return;
    const rect = c.getBoundingClientRect();
    const ctx = c.getContext("2d");
    if (!ctx) return;
    const x = (e.clientX - rect.left) * (c.width / rect.width);
    const y = (e.clientY - rect.top) * (c.height / rect.height);
    ctx.lineJoin = "round";
    ctx.lineCap = "round";
    ctx.strokeStyle = "#0a3";
    ctx.lineWidth = Math.max(2, c.width / 200);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.1, y + 0.1);
    ctx.stroke();
  };

  const clearCanvas = () => {
    const c = canvasRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, c.width, c.height);
  };

  const saveCanvas = async () => {
    const c = canvasRef.current;
    if (!c) return;
    setIsUploading(true);
    try {
      const base64 = c.toDataURL("image/png");
      const res = await fetch("/api/users/me/signature", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ signatureImage: base64 }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Upload failed");
      setSignature({
        signatureImageUrl: base64,
        uploadedAt: new Date().toISOString(),
      });
      toast.success(ar ? "تم حفظ التوقيع" : "Signature saved");
      setShowCanvas(false);
    } catch (err: unknown) {
      toast.error(
        err instanceof Error ? err.message : ar ? "فشل الرفع" : "Upload failed",
      );
    } finally {
      setIsUploading(false);
    }
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{ar ? "توقيعي" : "My Signature"}</CardTitle>
        <CardDescription>
          {ar
            ? "ارفع صورة توقيعك. سيتم استخدامها تلقائياً عند اعتماد أي طلب يتطلب توقيعك."
            : "Upload an image of your signature. It will be used automatically whenever you approve a request."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {isLoading ? (
          <Skeleton className="h-32 w-full" />
        ) : (
          <>
            {signature.signatureImageUrl ? (
              <div className="border rounded-lg p-4 bg-muted/30 flex flex-col items-center gap-2">
                <img
                  src={signature.signatureImageUrl}
                  alt={ar ? "توقيعي" : "My signature"}
                  className="max-h-24 object-contain"
                />
                <span className="text-xs text-muted-foreground">
                  {ar ? "تم الرفع" : "Uploaded"}{" "}
                  {signature.uploadedAt ? formatDate(signature.uploadedAt) : ""}
                </span>
              </div>
            ) : (
              <div className="border rounded-lg p-8 bg-muted/10 flex flex-col items-center gap-2 text-muted-foreground">
                <Pen className="w-8 h-8" />
                <span className="text-sm">
                  {ar ? "لم يتم رفع توقيع بعد" : "No signature uploaded yet"}
                </span>
              </div>
            )}

            <div className="flex gap-2">
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
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
                    ? "رفع توقيع"
                    : "Upload Signature"}
              </Button>
              <Button variant="ghost" onClick={() => setShowCanvas((v) => !v)}>
                {showCanvas
                  ? ar
                    ? "إغلاق الرسم"
                    : "Close Draw"
                  : ar
                    ? "ارسم توقيع"
                    : "Draw Signature"}
              </Button>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/png,image/jpeg"
              className="hidden"
              onChange={handleFileSelect}
            />
            {showCanvas && (
              <div className="mt-4">
                <div className="border rounded-lg p-2 bg-white">
                  <canvas
                    ref={(el) => {
                      if (!el) return;
                      // initialize large HiDPI canvas
                      canvasRef.current = el;
                      const dpr = window.devicePixelRatio || 1;
                      const w = 800;
                      const h = 240;
                      el.style.width = `${w}px`;
                      el.style.height = `${h}px`;
                      el.width = Math.round(w * dpr);
                      el.height = Math.round(h * dpr);
                      const ctx = el.getContext("2d");
                      if (ctx) {
                        ctx.fillStyle = "#ffffff";
                        ctx.fillRect(0, 0, el.width, el.height);
                        ctx.scale(dpr, dpr);
                      }
                    }}
                    className="w-full h-24 touch-none"
                    onPointerDown={startDrawing}
                    onPointerUp={stopDrawing}
                    onPointerMove={draw}
                  />
                </div>
                <div className="flex gap-2 mt-2">
                  <Button variant="outline" onClick={clearCanvas}>
                    {ar ? "مسح" : "Clear"}
                  </Button>
                  <Button onClick={saveCanvas} disabled={isUploading}>
                    {isUploading
                      ? ar
                        ? "جاري الحفظ..."
                        : "Saving..."
                      : ar
                        ? "حفظ التوقيع"
                        : "Save Signature"}
                  </Button>
                </div>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
