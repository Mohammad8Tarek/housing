// Admin: make a survey template public and show its shareable link + QR code.
import { useState } from "react";
import QRCode from "qrcode";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Share2, Copy, Check, Loader2, Download } from "lucide-react";
import { toast } from "sonner";

export function ShareSurveyDialog({
  templateId,
  propertyId,
  ar,
}: {
  templateId: number;
  propertyId: number | string | undefined;
  ar: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [url, setUrl] = useState("");
  const [qr, setQr] = useState("");
  const [copied, setCopied] = useState(false);

  const enable = async () => {
    setLoading(true);
    try {
      const r = await fetch(
        `/api/evaluations/${templateId}/share?propertyId=${propertyId ?? ""}`,
        { method: "POST", credentials: "include" },
      );
      const data = await r.json();
      if (!r.ok || !data.success)
        throw new Error(data.message || "Failed to share");
      const fullUrl = `${window.location.origin}${data.path}`;
      setUrl(fullUrl);
      const dataUrl = await QRCode.toDataURL(fullUrl, {
        width: 320,
        margin: 2,
        color: { dark: "#0F2A44", light: "#ffffff" },
      });
      setQr(dataUrl);
    } catch (e: any) {
      toast.error(e?.message || (ar ? "تعذّر إنشاء الرابط" : "Could not create link"));
    } finally {
      setLoading(false);
    }
  };

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* ignore */
    }
  };

  const downloadQr = () => {
    const a = document.createElement("a");
    a.href = qr;
    a.download = `survey-${templateId}-qr.png`;
    a.click();
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(v) => {
        setOpen(v);
        if (v && !url) enable();
      }}
    >
      <DialogTrigger asChild>
        <Button
          variant="ghost"
          size="icon"
          className="h-7 w-7 text-emerald-600"
          title={ar ? "مشاركة (رابط / QR)" : "Share (link / QR)"}
        >
          <Share2 className="w-3.5 h-3.5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle className="text-base">
            {ar ? "مشاركة الاستبيان" : "Share survey"}
          </DialogTitle>
        </DialogHeader>
        {loading ? (
          <div className="flex items-center justify-center py-10">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : url ? (
          <div className="space-y-4">
            <p className="text-xs text-muted-foreground">
              {ar
                ? "أي شخص معه هذا الرابط أو يمسح الكود يقدر يجاوب الاستبيان بدون تسجيل دخول (مجهول)، حتى تاريخ الانتهاء."
                : "Anyone with this link or QR can answer the survey anonymously (no login), until the expiry date."}
            </p>
            {qr && (
              <div className="flex flex-col items-center gap-2">
                <img
                  src={qr}
                  alt="Survey QR"
                  className="w-48 h-48 rounded-xl border bg-white p-2"
                />
                <Button variant="outline" size="sm" onClick={downloadQr} className="gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  {ar ? "تحميل الكود" : "Download QR"}
                </Button>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={url}
                dir="ltr"
                className="flex-1 text-xs font-mono bg-muted rounded-lg px-2 py-2 border truncate"
              />
              <Button size="icon" className="h-9 w-9 flex-shrink-0" onClick={copy}>
                {copied ? (
                  <Check className="w-4 h-4" />
                ) : (
                  <Copy className="w-4 h-4" />
                )}
              </Button>
            </div>
          </div>
        ) : (
          <div className="py-6 text-center">
            <Button onClick={enable}>
              {ar ? "إنشاء رابط عام" : "Create public link"}
            </Button>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
