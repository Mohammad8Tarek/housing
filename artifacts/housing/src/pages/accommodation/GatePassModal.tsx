import React, { useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  QrCode,
  Printer,
  Download,
  ShieldCheck,
  Building,
  Bed,
  Calendar,
  AlertCircle,
  User,
  CheckCircle2,
} from "lucide-react";
import { useProperty } from "@/context/PropertyContext";

interface GatePassModalProps {
  profileId: number | null;
  isOpen: boolean;
  onClose: () => void;
  language?: string;
}

export function GatePassModal({
  profileId,
  isOpen,
  onClose,
  language = "ar",
}: GatePassModalProps) {
  const isAr = language === "ar";
  const { selectedPropertyId } = useProperty();
  const printCardRef = useRef<HTMLDivElement>(null);

  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ["gate-pass", profileId, selectedPropertyId],
    queryFn: async () => {
      if (!profileId) return null;
      const res = await fetch(
        `/api/gate/pass/${profileId}?propertyId=${selectedPropertyId || ""}`,
        { headers: { "Content-Type": "application/json" } }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to load gate pass");
      }
      return res.json();
    },
    enabled: isOpen && Boolean(profileId),
  });

  const gatePass = data?.gatePass;

  const handlePrint = () => {
    window.print();
  };

  const handleDownloadQr = () => {
    if (!gatePass?.qrDataUrl) return;
    const a = document.createElement("a");
    a.href = gatePass.qrDataUrl;
    a.download = `GatePass_QR_${gatePass.employeeId || profileId}.png`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md max-w-[95vw] p-0 overflow-hidden bg-background border rounded-3xl shadow-2xl">
        <DialogHeader className="p-4 sm:p-5 border-b bg-muted/30">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-primary/10 text-primary flex items-center justify-center shrink-0">
              <QrCode className="w-5 h-5" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold text-foreground">
                {isAr ? "تصريح بوابة السكن الإلكترونية" : "Electronic Gate Pass"}
              </DialogTitle>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "بطاقة الهوية والـ QR المعتمد للمرور عبر بوابات السكن"
                  : "Official digital resident pass & scannable QR for gate entry"}
              </p>
            </div>
          </div>
        </DialogHeader>

        <div className="p-4 sm:p-6 space-y-4">
          {isLoading ? (
            <div className="space-y-4 p-4 border rounded-2xl">
              <div className="flex items-center gap-3">
                <Skeleton className="w-14 h-14 rounded-2xl" />
                <div className="space-y-2 flex-1">
                  <Skeleton className="h-5 w-3/4" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              </div>
              <Skeleton className="h-48 w-full rounded-2xl" />
            </div>
          ) : isError || !gatePass ? (
            <div className="p-6 text-center space-y-3 bg-red-500/10 border border-red-500/20 rounded-2xl text-destructive">
              <AlertCircle className="w-10 h-10 mx-auto" />
              <p className="text-sm font-semibold">
                {error instanceof Error ? error.message : (isAr ? "تعذر تحميل تصريح السكن" : "Failed to load gate pass")}
              </p>
              <Button size="sm" variant="outline" onClick={() => refetch()}>
                {isAr ? "إعادة المحاولة" : "Try Again"}
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {/* ── LUXURY DIGITAL RESIDENT CARD (PRINTABLE) ── */}
              <div
                ref={printCardRef}
                id="printable-gate-card"
                className="relative overflow-hidden rounded-[24px] bg-gradient-to-br from-[#0B1528] via-[#122240] to-[#1C335C] text-white p-5 sm:p-6 shadow-2xl border border-white/15"
              >
                {/* Background lighting accents */}
                <div className="absolute -top-12 -right-12 w-48 h-48 bg-[#C9A24D]/15 blur-[60px] rounded-full pointer-events-none" />
                <div className="absolute -bottom-10 -left-10 w-40 h-40 bg-blue-500/10 blur-[50px] rounded-full pointer-events-none" />

                {/* Card Header */}
                <div className="relative z-10 flex items-center justify-between gap-2 pb-3 border-b border-white/10">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-lg bg-[#C9A24D]/20 border border-[#C9A24D]/30 flex items-center justify-center text-[#E0C070]">
                      <ShieldCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-[#E0C070]">
                        SUNRISE RESIDENTS
                      </div>
                      <div className="text-[11px] font-semibold text-white/90">
                        {gatePass.property?.name || "Staff Housing"}
                      </div>
                    </div>
                  </div>

                  <Badge
                    variant="outline"
                    className={`font-mono text-[10px] uppercase px-2.5 py-0.5 border ${
                      gatePass.housing?.isAssigned
                        ? "bg-emerald-500/20 text-emerald-300 border-emerald-500/40"
                        : "bg-amber-500/20 text-amber-300 border-amber-500/40"
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full mr-1.5 inline-block ${
                        gatePass.housing?.isAssigned ? "bg-emerald-400" : "bg-amber-400"
                      }`}
                    />
                    {gatePass.housing?.isAssigned
                      ? (isAr ? "مقيم نشط" : "Active Resident")
                      : (isAr ? "قيد التسكين" : "Unassigned")}
                  </Badge>
                </div>

                {/* Resident Profile Section */}
                <div className="relative z-10 flex items-center gap-3.5 my-4">
                  {gatePass.photoUrl ? (
                    <img
                      src={gatePass.photoUrl}
                      alt={gatePass.fullName}
                      className="w-14 h-14 rounded-2xl object-cover border-2 border-[#E0C070]/60 shadow-md shrink-0"
                    />
                  ) : (
                    <div className="w-14 h-14 rounded-2xl bg-white/10 border-2 border-[#E0C070]/40 flex items-center justify-center text-white/80 shrink-0 shadow-inner">
                      <User className="w-7 h-7" />
                    </div>
                  )}

                  <div className="min-w-0 flex-1">
                    <h3 className="text-base sm:text-lg font-extrabold text-white truncate leading-tight">
                      {gatePass.fullName}
                    </h3>
                    <p className="text-xs text-[#E0C070] font-medium truncate mt-0.5">
                      {gatePass.jobTitle} · {gatePass.department}
                    </p>
                    <div className="flex items-center gap-2 mt-1 text-[11px] text-white/70 font-mono">
                      <span>ID: <strong className="text-white">{gatePass.employeeId}</strong></span>
                      {gatePass.nationalId && (
                        <span>· NID: {gatePass.nationalId}</span>
                      )}
                    </div>
                  </div>
                </div>

                {/* Housing Details Row */}
                <div className="relative z-10 grid grid-cols-3 gap-2 bg-black/30 border border-white/10 rounded-xl p-2.5 mb-4 text-center">
                  <div>
                    <div className="text-[10px] text-white/60 font-medium">
                      {isAr ? "المبنى" : "Building"}
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">
                      {gatePass.housing?.buildingName || "—"}
                    </div>
                  </div>
                  <div className="border-x border-white/10">
                    <div className="text-[10px] text-[#E0C070] font-medium">
                      {isAr ? "رقم الغرفة" : "Room No."}
                    </div>
                    <div className="text-sm font-black font-mono text-emerald-400 mt-0.5">
                      {gatePass.housing?.roomNumber || "—"}
                    </div>
                  </div>
                  <div>
                    <div className="text-[10px] text-white/60 font-medium">
                      {isAr ? "السرير" : "Bed"}
                    </div>
                    <div className="text-xs font-bold text-white truncate mt-0.5">
                      #{gatePass.housing?.bedNumber || "1"}
                    </div>
                  </div>
                </div>

                {/* Scannable Real QR Code */}
                <div className="relative z-10 flex flex-col items-center justify-center p-3.5 bg-white rounded-2xl shadow-lg mx-auto max-w-[210px]">
                  <img
                    src={gatePass.qrDataUrl}
                    alt="Gate QR Code"
                    className="w-40 h-40 object-contain rounded-lg"
                  />
                  <div className="text-[9px] font-bold text-slate-800 tracking-wider mt-1.5 uppercase text-center font-mono">
                    GATE PASS · {gatePass.employeeId}
                  </div>
                </div>

                {/* Footer Security Watermark */}
                <div className="relative z-10 flex items-center justify-between text-[10px] text-white/50 mt-3 pt-2 border-t border-white/10 font-mono">
                  <span>SIG: {gatePass.signature}</span>
                  <span>{new Date().toLocaleDateString("en-GB")}</span>
                </div>
              </div>

              {/* ── ACTION BUTTONS ── */}
              <div className="grid grid-cols-2 gap-2.5 pt-1">
                <Button
                  variant="outline"
                  className="gap-2 rounded-xl h-10 text-xs font-bold"
                  onClick={handleDownloadQr}
                >
                  <Download className="w-4 h-4" />
                  {isAr ? "تحميل الـ QR كصورة" : "Download QR Image"}
                </Button>

                <Button
                  className="gap-2 rounded-xl h-10 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90"
                  onClick={handlePrint}
                >
                  <Printer className="w-4 h-4" />
                  {isAr ? "طباعة الكارنيه" : "Print Gate Badge"}
                </Button>
              </div>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
