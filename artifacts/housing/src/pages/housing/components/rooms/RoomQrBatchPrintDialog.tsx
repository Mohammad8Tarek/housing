import { useState, useMemo, useEffect } from "react";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  QrCode,
  Printer,
  Building,
  Layers,
  Sparkles,
  LayoutGrid,
  Check,
} from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { getRoomQrImageUrl, generateRoomQrDataUrl } from "@/lib/qr-service";

interface RoomQrBatchPrintDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  rooms: any[];
  buildings: any[];
  floors: any[];
  propertyId: number;
  propertyName?: string;
  selectedRoomIds?: Set<number>;
}

export function RoomQrBatchPrintDialog({
  open,
  onOpenChange,
  rooms,
  buildings,
  floors,
  propertyId,
  propertyName = "Sunrise Staff Housing",
  selectedRoomIds,
}: RoomQrBatchPrintDialogProps) {
  const { language } = useLanguage();
  const ar = language === "ar";

  const [buildingFilter, setBuildingFilter] = useState("all");
  const [floorFilter, setFloorFilter] = useState("all");
  const [layoutMode, setLayoutMode] = useState<"4" | "6" | "8">("6");
  const [isPreparingPrint, setIsPreparingPrint] = useState(false);
  const [previewQrMap, setPreviewQrMap] = useState<Record<number, string>>({});

  // Filtered rooms to print
  const printableRooms = useMemo(() => {
    return rooms.filter((r) => {
      // If specific rooms were selected from the table
      if (selectedRoomIds && selectedRoomIds.size > 0) {
        if (!selectedRoomIds.has(r.id)) return false;
      }
      if (buildingFilter !== "all" && r.buildingId !== Number(buildingFilter)) {
        return false;
      }
      if (floorFilter !== "all" && r.floorId !== Number(floorFilter)) {
        return false;
      }
      return true;
    });
  }, [rooms, selectedRoomIds, buildingFilter, floorFilter]);

  // Load client-side QR codes for the first preview batch
  useEffect(() => {
    let active = true;
    if (!open) return;
    const loadPreviews = async () => {
      const slice = printableRooms.slice(0, 12);
      const newMap: Record<number, string> = {};
      for (const r of slice) {
        try {
          newMap[r.id] = await generateRoomQrDataUrl(propertyId, r.id, { width: 250 });
        } catch {
          newMap[r.id] = getRoomQrImageUrl(propertyId, r.id, "png");
        }
      }
      if (active) {
        setPreviewQrMap((prev) => ({ ...prev, ...newMap }));
      }
    };
    loadPreviews();
    return () => {
      active = false;
    };
  }, [open, printableRooms, propertyId]);

  const handlePrint = async () => {
    if (printableRooms.length === 0) {
      toast.error(ar ? "لا توجد غرف مطابقة للطباعة" : "No rooms match criteria to print");
      return;
    }

    setIsPreparingPrint(true);
    const toastId = toast.loading(
      ar ? "جاري إعداد الرموز بدقة عالية..." : "Preparing high-resolution placards..."
    );

    const qrUrls: Record<number, string> = {};
    try {
      await Promise.all(
        printableRooms.map(async (r) => {
          try {
            qrUrls[r.id] = await generateRoomQrDataUrl(propertyId, r.id, { width: 350 });
          } catch {
            qrUrls[r.id] = getRoomQrImageUrl(propertyId, r.id, "png");
          }
        })
      );
    } finally {
      toast.dismiss(toastId);
      setIsPreparingPrint(false);
    }

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      toast.error(ar ? "يرجى السماح بالنوافذ المنبثقة للطباعة" : "Please allow popups to print");
      return;
    }

    const gridCols = layoutMode === "4" ? "2" : layoutMode === "6" ? "2" : "2";
    const cardHeight = layoutMode === "4" ? "128mm" : layoutMode === "6" ? "88mm" : "66mm";
    const qrSize = layoutMode === "4" ? "110px" : layoutMode === "6" ? "85px" : "65px";
    const roomFont = layoutMode === "4" ? "32px" : layoutMode === "6" ? "26px" : "20px";

    const cardsHtml = printableRooms
      .map((r) => {
        const b = buildings.find((x) => x.id === r.buildingId);
        const f = floors.find((x) => x.id === r.floorId);
        const bName = b?.name || `Building #${r.buildingId}`;
        const fNum = f?.floorNumber ?? 0;
        const qrUrl = qrUrls[r.id] || getRoomQrImageUrl(propertyId, r.id, "png");

        return `
          <div class="placard-card">
            <div class="card-brand">
              <span class="prop-title">${propertyName}</span>
              <span class="sub-title">STAFF HOUSING SERVICE</span>
            </div>

            <div class="room-hero">
              <span class="r-label">${ar ? "غرفة" : "ROOM"}</span>
              <span class="r-number">${r.roomNumber}</span>
            </div>

            <div class="meta-row">
              <span class="meta-tag">${bName}</span>
              <span class="meta-tag">${ar ? `الدور ${fNum}` : `Floor ${fNum}`}</span>
            </div>

            <div class="qr-container">
              <img src="${qrUrl}" alt="QR ${r.roomNumber}" class="qr-img" />
            </div>

            <div class="card-footer">
              <div class="caption-ar">امسح الرمز لطلب الصيانة أو النظافة</div>
              <div class="caption-en">Scan for Maintenance or Housekeeping</div>
            </div>
          </div>
        `;
      })
      .join("");

    const printHtml = `
      <!DOCTYPE html>
      <html dir="${ar ? "rtl" : "ltr"}">
        <head>
          <meta charset="utf-8" />
          <title>${propertyName} - Room QR Placards</title>
          <style>
            @page {
              size: A4 portrait;
              margin: 8mm 6mm;
            }
            body {
              font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
              margin: 0;
              padding: 0;
              background-color: #fff;
              color: #0F2A44;
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            .sheet-grid {
              display: grid;
              grid-template-columns: repeat(${gridCols}, 1fr);
              gap: 6mm;
              box-sizing: border-box;
            }
            .placard-card {
              border: 2px solid #0F2A44;
              border-radius: 12px;
              padding: 10px 12px;
              text-align: center;
              box-sizing: border-box;
              height: ${cardHeight};
              display: flex;
              flex-direction: column;
              justify-content: space-between;
              page-break-inside: avoid;
              background: #ffffff;
              position: relative;
            }
            .card-brand {
              border-bottom: 1.5px solid #C9A24D;
              padding-bottom: 4px;
              display: flex;
              flex-direction: column;
              align-items: center;
            }
            .prop-title {
              font-size: 10px;
              font-weight: 800;
              color: #0F2A44;
              text-transform: uppercase;
              letter-spacing: 0.5px;
            }
            .sub-title {
              font-size: 8px;
              color: #C9A24D;
              font-weight: 700;
            }
            .room-hero {
              display: flex;
              align-items: baseline;
              justify-content: center;
              gap: 6px;
              margin: 2px 0;
            }
            .r-label {
              font-size: 10px;
              text-transform: uppercase;
              color: #64748b;
              font-weight: bold;
            }
            .r-number {
              font-size: ${roomFont};
              font-weight: 900;
              color: #0F2A44;
              line-height: 1;
            }
            .meta-row {
              display: flex;
              justify-content: center;
              gap: 6px;
              margin-bottom: 4px;
            }
            .meta-tag {
              background: #f1f5f9;
              color: #0F2A44;
              border: 1px solid #cbd5e1;
              border-radius: 4px;
              padding: 2px 6px;
              font-size: 9px;
              font-weight: bold;
            }
            .qr-container {
              display: flex;
              justify-content: center;
              align-items: center;
              margin: 2px 0;
            }
            .qr-img {
              width: ${qrSize};
              height: ${qrSize};
              display: block;
              border: 1px dashed #C9A24D;
              padding: 4px;
              border-radius: 6px;
            }
            .card-footer {
              border-top: 1px dashed #cbd5e1;
              padding-top: 4px;
            }
            .caption-ar {
              font-size: 9px;
              font-weight: 800;
              color: #0F2A44;
            }
            .caption-en {
              font-size: 8px;
              font-weight: 600;
              color: #64748b;
            }
          </style>
        </head>
        <body>
          <div class="sheet-grid">
            ${cardsHtml}
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
    printWindow.document.write(printHtml);
    printWindow.document.close();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <QrCode className="w-5 h-5 text-primary" />
            {ar ? "طباعة ملصقات QR المجمعة لأبواب الغرف" : "Batch Print Room QR Door Placards"}
          </DialogTitle>
          <DialogDescription className="text-xs">
            {ar
              ? "طباعة ملصقات وبطاقات الـ QR الرسمية المخصصة للصق على أبواب الغرف (صيانة ونظافة فورية)"
              : "Generate printable A4 sticker sheets for room doors with QR codes"}
          </DialogDescription>
        </DialogHeader>

        {/* Filter Controls */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 p-3 rounded-xl bg-muted/40 border">
          <div>
            <label className="text-[11px] font-semibold block mb-1">
              {ar ? "تصفية المبنى:" : "Building:"}
            </label>
            <Select value={buildingFilter} onValueChange={setBuildingFilter}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder={ar ? "كل المباني" : "All Buildings"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل المباني" : "All Buildings"}</SelectItem>
                {buildings.map((b) => (
                  <SelectItem key={b.id} value={String(b.id)}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-semibold block mb-1">
              {ar ? "تصفية الدور:" : "Floor:"}
            </label>
            <Select value={floorFilter} onValueChange={setFloorFilter}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue placeholder={ar ? "كل الطوابق" : "All Floors"} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{ar ? "كل الطوابق" : "All Floors"}</SelectItem>
                {floors
                  .filter(
                    (f) =>
                      buildingFilter === "all" ||
                      f.buildingId === Number(buildingFilter)
                  )
                  .map((f) => (
                    <SelectItem key={f.id} value={String(f.id)}>
                      {ar ? `الدور ${f.floorNumber}` : `Floor ${f.floorNumber}`}
                    </SelectItem>
                  ))}
              </SelectContent>
            </Select>
          </div>

          <div>
            <label className="text-[11px] font-semibold block mb-1">
              {ar ? "تنسيق الورقة (A4):" : "Sheet Layout (A4):"}
            </label>
            <Select value={layoutMode} onValueChange={(val: any) => setLayoutMode(val)}>
              <SelectTrigger className="h-8 text-xs bg-background">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="4">{ar ? "4 ملصقات كبيرة / ورقة" : "4 Large Cards / Sheet"}</SelectItem>
                <SelectItem value="6">{ar ? "6 ملصقات متوسطة / ورقة (قياسي)" : "6 Medium Cards (Standard)"}</SelectItem>
                <SelectItem value="8">{ar ? "8 ملصقات مدمجة / ورقة" : "8 Compact Cards / Sheet"}</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Selected Count Indicator */}
        <div className="flex items-center justify-between text-xs px-1 text-muted-foreground">
          <span>
            {ar
              ? `إجمالي الغرف المحددة للطباعة: ${printableRooms.length} غرفة`
              : `Total rooms to print: ${printableRooms.length}`}
          </span>
          {selectedRoomIds && selectedRoomIds.size > 0 && (
            <Badge variant="outline" className="text-[10px] text-primary">
              {ar ? "تم تفعيل حصر الغرف المحددة" : "Filtered by checked rooms"}
            </Badge>
          )}
        </div>

        {/* Live Grid Preview (Scrollable) */}
        <div className="flex-1 overflow-y-auto max-h-[360px] p-2 border rounded-xl bg-card">
          {printableRooms.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground text-xs">
              <QrCode className="w-8 h-8 opacity-40 mx-auto mb-2" />
              <p>{ar ? "لا توجد غرف تطابق الفلتر الحالي" : "No rooms match criteria"}</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
              {printableRooms.slice(0, 12).map((r) => {
                const b = buildings.find((x) => x.id === r.buildingId);
                const f = floors.find((x) => x.id === r.floorId);
                const qrUrl = getRoomQrImageUrl(propertyId, r.id, "png");
                return (
                  <div
                    key={r.id}
                    className="p-3 rounded-lg border-2 border-primary/20 bg-muted/20 text-center space-y-1.5 shadow-2xs"
                  >
                    <div className="flex items-baseline justify-between border-b pb-1">
                      <span className="text-[9px] font-bold text-amber-600 truncate max-w-[80px]">
                        {b?.name || "Sunrise"}
                      </span>
                      <span className="text-[9px] text-muted-foreground font-semibold">
                        {ar ? `دور ${f?.floorNumber ?? 0}` : `F${f?.floorNumber ?? 0}`}
                      </span>
                    </div>

                    <div className="text-xl font-black text-foreground">
                      {r.roomNumber}
                    </div>

                    <div className="w-20 h-20 mx-auto bg-white p-1 rounded border border-dashed border-amber-400 flex items-center justify-center">
                      {previewQrMap[r.id] ? (
                        <img
                          src={previewQrMap[r.id]}
                          alt={`QR ${r.roomNumber}`}
                          className="w-full h-full object-contain"
                        />
                      ) : (
                        <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                      )}
                    </div>

                    <p className="text-[8px] font-bold text-primary truncate">
                      {ar ? "صيانة ونظافة" : "Service Request"}
                    </p>
                  </div>
                );
              })}
            </div>
          )}
          {printableRooms.length > 12 && (
            <p className="text-center text-[11px] text-muted-foreground pt-3">
              {ar
                ? `... وعرض بقية الـ ${printableRooms.length} غرفة ستُدرج جميعاً بالطباعة`
                : `... and ${printableRooms.length - 12} more rooms will be included in print`}
            </p>
          )}
        </div>

        <DialogFooter className="gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onOpenChange(false)}
            className="text-xs"
          >
            {ar ? "إغلاق" : "Cancel"}
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handlePrint}
            disabled={printableRooms.length === 0}
            className="text-xs gap-1.5 bg-primary text-primary-foreground font-bold shadow-md"
          >
            <Printer className="w-3.5 h-3.5" />
            {ar ? `طباعة ${printableRooms.length} ملصق A4` : `Print ${printableRooms.length} Placards`}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
