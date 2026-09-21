import { useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Download,
  Copy,
  Printer,
  ExternalLink,
  Check,
  Building,
  Sparkles,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { getRoomServiceUrl, getRoomQrImageUrl } from "@/lib/qr-service";

interface RoomQrModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  room: any | null;
  propertyId: number;
  propertyName?: string;
  buildingName?: string;
  floorNumber?: number;
}

export function RoomQrModal({
  open,
  onOpenChange,
  room,
  propertyId,
  propertyName = "Sunrise Staff Housing",
  buildingName,
  floorNumber,
}: RoomQrModalProps) {
  const { language } = useLanguage();
  const ar = language === "ar";
  const [copied, setCopied] = useState(false);

  if (!room) return null;

  const targetUrl = getRoomServiceUrl(propertyId, room.id);
  const qrImageUrl = getRoomQrImageUrl(propertyId, room.id, "png");
  const bName = buildingName || room.buildingName || `Building #${room.buildingId}`;
  const fNum = floorNumber ?? room.floorNumber ?? 0;

  const handleCopyUrl = async () => {
    try {
      await navigator.clipboard.writeText(targetUrl);
      setCopied(true);
      toast.success(ar ? "تم نسخ الرابط إلى الحافظة" : "URL copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error(ar ? "فشل نسخ الرابط" : "Failed to copy URL");
    }
  };

  const handleDownloadQr = async () => {
    try {
      const response = await fetch(qrImageUrl);
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Room_${room.roomNumber}_QR.png`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
      toast.success(ar ? "تم تحميل رمز الـ QR بنجاح" : "QR code downloaded");
    } catch {
      toast.error(ar ? "فشل تحميل الصورة" : "Failed to download QR code");
    }
  };

  const handlePrintSinglePlacard = () => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error(ar ? "يرجى السماح بالنوافذ المنبثقة للطباعة" : "Please allow popups to print");
      return;
    }

    const htmlContent = `
      <!DOCTYPE html>
      <html dir="${ar ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>Room ${room.roomNumber} - Door QR Placard</title>
          <style>
            @page {
              size: A5 portrait;
              margin: 10mm;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #fff;
              color: #0F2A44;
              display: flex;
              align-items: center;
              justify-content: center;
              min-height: 100vh;
            }
            .placard {
              width: 100%;
              max-width: 130mm;
              border: 3px solid #0F2A44;
              border-radius: 16px;
              padding: 24px;
              text-align: center;
              box-sizing: border-box;
              background: #ffffff;
              box-shadow: 0 4px 12px rgba(0,0,0,0.05);
            }
            .brand-header {
              border-bottom: 2px solid #C9A24D;
              padding-bottom: 12px;
              margin-bottom: 16px;
            }
            .brand-name {
              font-size: 16px;
              font-weight: 800;
              color: #0F2A44;
              text-transform: uppercase;
              letter-spacing: 1px;
            }
            .brand-sub {
              font-size: 11px;
              color: #C9A24D;
              font-weight: 700;
              margin-top: 2px;
            }
            .room-number-wrap {
              margin: 12px 0 8px 0;
            }
            .room-label {
              font-size: 12px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: bold;
            }
            .room-number {
              font-size: 42px;
              font-weight: 900;
              color: #0F2A44;
              line-height: 1.1;
              letter-spacing: -0.5px;
            }
            .location-badges {
              display: flex;
              justify-content: center;
              gap: 8px;
              margin-bottom: 16px;
            }
            .badge {
              background: #f1f5f9;
              color: #0F2A44;
              border: 1px solid #cbd5e1;
              border-radius: 6px;
              padding: 4px 10px;
              font-size: 11px;
              font-weight: bold;
            }
            .qr-frame {
              background: #ffffff;
              padding: 12px;
              border: 2px dashed #C9A24D;
              border-radius: 12px;
              display: inline-block;
              margin: 8px auto 14px auto;
            }
            .qr-image {
              width: 160px;
              height: 160px;
              display: block;
            }
            .instructions {
              margin-top: 8px;
              border-top: 1px dashed #cbd5e1;
              padding-top: 12px;
            }
            .inst-ar {
              font-size: 13px;
              font-weight: 800;
              color: #0F2A44;
              margin-bottom: 4px;
            }
            .inst-en {
              font-size: 11px;
              font-weight: 600;
              color: #64748b;
            }
            .service-tags {
              display: flex;
              justify-content: center;
              gap: 12px;
              margin-top: 10px;
              font-size: 11px;
              font-weight: bold;
              color: #C9A24D;
            }
          </style>
        </head>
        <body>
          <div class="placard">
            <div class="brand-header">
              <div class="brand-name">${propertyName}</div>
              <div class="brand-sub">SUNRISE STAFF HOUSING MANAGEMENT</div>
            </div>

            <div class="room-number-wrap">
              <div class="room-label">${ar ? "غرفة رقم" : "ROOM"}</div>
              <div class="room-number">${room.roomNumber}</div>
            </div>

            <div class="location-badges">
              <span class="badge">${bName}</span>
              <span class="badge">${ar ? `الدور ${fNum}` : `Floor ${fNum}`}</span>
            </div>

            <div class="qr-frame">
              <img src="${qrImageUrl}" alt="Room QR Code" class="qr-image" />
            </div>

            <div class="instructions">
              <div class="inst-ar">امسح الرمز بكاميرا الجوال لطلب الصيانة أو النظافة</div>
              <div class="inst-en">Scan with phone camera to request Maintenance or Housekeeping</div>
              <div class="service-tags">
                <span>🔧 صيانة (Maintenance)</span>
                <span>•</span>
                <span>🧹 نظافة (Housekeeping)</span>
              </div>
            </div>
          </div>

          <script>
            window.onload = function() {
              setTimeout(function() {
                window.print();
              }, 400);
            };
          </script>
        </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="w-5 h-5 text-primary" />
            {ar ? `رمز QR للغرفة (${room.roomNumber})` : `Room QR Code (${room.roomNumber})`}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "رمز مسح ذكي يوضع على باب الغرفة لتمكين النزلاء والمشرفين من طلب الصيانة والنظافة فورياً"
              : "Smart QR code placed on the room door for instant maintenance and housekeeping requests"}
          </DialogDescription>
        </DialogHeader>

        {/* Printable Preview Card */}
        <div className="flex flex-col items-center justify-center p-4 rounded-xl border-2 border-primary/20 bg-card text-center space-y-3 shadow-xs">
          <div className="space-y-0.5">
            <span className="text-[10px] uppercase font-bold text-amber-600 dark:text-amber-400 tracking-wider">
              {propertyName}
            </span>
            <h3 className="text-2xl font-black text-foreground tracking-tight">
              {ar ? `غرفة ${room.roomNumber}` : `Room ${room.roomNumber}`}
            </h3>
            <div className="flex items-center justify-center gap-1.5 pt-0.5">
              <Badge variant="outline" className="text-[10px] font-semibold">
                <Building className="w-3 h-3 me-1 text-primary" />
                {bName}
              </Badge>
              <Badge variant="secondary" className="text-[10px]">
                {ar ? `الدور ${fNum}` : `Floor ${fNum}`}
              </Badge>
            </div>
          </div>

          {/* QR Code Frame */}
          <div className="p-3 rounded-xl bg-white border-2 border-dashed border-amber-400/80 shadow-xs">
            <img
              src={qrImageUrl}
              alt={`QR Room ${room.roomNumber}`}
              className="w-44 h-44 object-contain"
            />
          </div>

          <div className="space-y-1">
            <p className="text-xs font-bold text-primary">
              {ar ? "امسح الرمز لطلب الصيانة أو النظافة" : "Scan QR for Maintenance or Housekeeping"}
            </p>
            <p className="text-[10px] text-muted-foreground">
              {ar ? "يعمل تلقائياً بكاميرا أي جوال بدون الحاجة لتسجيل دخول" : "Works instantly with any smartphone camera"}
            </p>
          </div>
        </div>

        {/* Target URL Pill */}
        <div className="flex items-center justify-between gap-2 p-2 rounded-lg bg-muted/40 border text-xs">
          <span className="truncate text-muted-foreground font-mono text-[11px] ltr">
            {targetUrl}
          </span>
          <div className="flex items-center gap-1 shrink-0">
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={handleCopyUrl}
              className="h-7 w-7"
              title={ar ? "نسخ الرابط" : "Copy URL"}
            >
              {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            </Button>
            <a
              href={targetUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center h-7 w-7 rounded-md hover:bg-muted text-muted-foreground"
              title={ar ? "معاينة صفحة الجوال" : "Preview mobile page"}
            >
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDownloadQr}
            className="text-xs gap-1.5"
          >
            <Download className="w-3.5 h-3.5" />
            {ar ? "تحميل PNG" : "Download PNG"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrintSinglePlacard}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-semibold"
          >
            <Printer className="w-3.5 h-3.5" />
            {ar ? "طباعة لاصق الباب" : "Print Door Placard"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
