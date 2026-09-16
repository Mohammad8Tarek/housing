import React, { useState, useEffect, useRef } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useLanguage } from "@/context/LanguageContext";
import { useProperty } from "@/context/PropertyContext";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  QrCode,
  ScanLine,
  LogIn,
  LogOut,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  User,
  Building,
  RefreshCw,
  Search,
  Download,
  Users,
  ShieldCheck,
  Camera,
  Keyboard,
  Clock,
  Maximize2,
} from "lucide-react";
import { toast } from "sonner";
import * as XLSX from "xlsx";
import { GateCameraScanner } from "./GateCameraScanner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function playChime(isSuccess: boolean) {
  try {
    const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    if (isSuccess) {
      osc.frequency.setValueAtTime(523.25, ctx.currentTime); // C5
      osc.frequency.setValueAtTime(659.25, ctx.currentTime + 0.1); // E5
      osc.frequency.setValueAtTime(783.99, ctx.currentTime + 0.2); // G5
    } else {
      osc.frequency.setValueAtTime(440, ctx.currentTime); // A4
      osc.frequency.setValueAtTime(311.13, ctx.currentTime + 0.15); // Eb4
    }
    gain.gain.setValueAtTime(0.15, ctx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start();
    osc.stop(ctx.currentTime + 0.35);
  } catch (_) {}
}

export default function GateScannerPage() {
  const { language } = useLanguage();
  const isAr = language === "ar";
  const { selectedPropertyId } = useProperty();
  const queryClient = useQueryClient();

  // State
  const [direction, setDirection] = useState<"IN" | "OUT">("IN");
  const [scanMode, setScanMode] = useState<"CAMERA" | "MANUAL">("CAMERA");
  const [fullscreenCameraOpen, setFullscreenCameraOpen] = useState<boolean>(false);
  const [scanInput, setScanInput] = useState("");
  const [lastVerification, setLastVerification] = useState<any | null>(null);
  const [autoLogEnabled, setAutoLogEnabled] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [filterDirection, setFilterDirection] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const inputRef = useRef<HTMLInputElement>(null);

  // Auto-focus input for barcode scanner gun when in manual mode
  useEffect(() => {
    if (scanMode === "MANUAL") {
      inputRef.current?.focus();
    }
  }, [direction, lastVerification, scanMode]);

  // Fetch gate stats
  const { data: statsData, refetch: refetchStats } = useQuery({
    queryKey: ["gate-stats", selectedPropertyId],
    queryFn: async () => {
      const res = await fetch(
        `/api/gate/stats?propertyId=${selectedPropertyId || ""}`
      );
      if (!res.ok) throw new Error("Failed to fetch gate stats");
      return res.json();
    },
    refetchInterval: 10000,
  });

  const stats = statsData?.stats || {
    todayEntries: 0,
    todayExits: 0,
    currentlyInside: 0,
    todayDenied: 0,
    totalScans: 0,
  };

  // Fetch recent gate logs
  const {
    data: logsData,
    isLoading: isLogsLoading,
    refetch: refetchLogs,
  } = useQuery({
    queryKey: [
      "gate-logs",
      selectedPropertyId,
      filterDirection,
      filterStatus,
      searchQuery,
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        propertyId: selectedPropertyId ? String(selectedPropertyId) : "all",
        direction: filterDirection,
        status: filterStatus,
        search: searchQuery,
        limit: "25",
        page: "1",
      });
      const res = await fetch(`/api/gate/logs?${params.toString()}`);
      if (!res.ok) throw new Error("Failed to fetch logs");
      return res.json();
    },
    refetchInterval: 8000,
  });

  const logs = logsData?.logs || [];

  // Log movement mutation
  const logMovementMutation = useMutation({
    mutationFn: async (payload: any) => {
      const res = await fetch("/api/gate/log", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "Failed to record log");
      }
      return res.json();
    },
    onSuccess: (data) => {
      toast.success(
        isAr
          ? `تم تسجيل حركة ${direction === "IN" ? "الدخول" : "الخروج"} بنجاح`
          : `Recorded ${direction} movement successfully`
      );
      queryClient.invalidateQueries({ queryKey: ["gate-logs"] });
      queryClient.invalidateQueries({ queryKey: ["gate-stats"] });
    },
    onError: (err: any) => {
      toast.error(err.message || "Failed to log movement");
    },
  });

  // Verify pass function
  const handleVerify = async (valueToVerify?: string, methodOverride?: string) => {
    const rawVal = (valueToVerify !== undefined ? valueToVerify : scanInput).trim();
    if (!rawVal) return;

    setIsVerifying(true);
    try {
      const isPayload = rawVal.startsWith("SUNRISE:GATE:");
      const body = isPayload
        ? { qrPayload: rawVal, propertyId: selectedPropertyId }
        : { employeeId: rawVal, propertyId: selectedPropertyId };

      const res = await fetch("/api/gate/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const result = await res.json();
      setLastVerification(result);
      setScanInput("");

      const isGranted = result.verdict === "GRANTED";
      playChime(isGranted);

      const effectiveScanMethod = methodOverride || (isPayload ? "QR_SCAN" : "BARCODE_GUN");

      if (isGranted) {
        toast.success(
          isAr
            ? `مصرّح: ${result.resident?.fullName} (غرفة ${result.resident?.roomNumber})`
            : `Authorized: ${result.resident?.fullName} (Room ${result.resident?.roomNumber})`
        );

        // Auto log if enabled
        if (autoLogEnabled && result.resident) {
          logMovementMutation.mutate({
            propertyId: selectedPropertyId || result.resident.propertyId || 1,
            profileId: result.resident.profileId,
            employeeId: result.resident.employeeId,
            fullName: result.resident.fullName,
            department: result.resident.department,
            jobTitle: result.resident.jobTitle,
            roomNumber: result.resident.roomNumber,
            buildingName: result.resident.buildingName,
            direction,
            status: "GRANTED",
            reason: result.reason,
            scanMethod: effectiveScanMethod,
          });
        }
      } else {
        toast.error(
          isAr
            ? `مرفوض: ${result.reason || "غير مصرّح بالدخول"}`
            : `Denied: ${result.reason || "Access Denied"}`
        );

        // Record denied attempt in logs
        logMovementMutation.mutate({
          propertyId: selectedPropertyId || 1,
          profileId: result.resident?.profileId || null,
          employeeId: result.resident?.employeeId || rawVal,
          fullName: result.resident?.fullName || `Unknown (${rawVal})`,
          department: result.resident?.department || null,
          jobTitle: result.resident?.jobTitle || null,
          roomNumber: result.resident?.roomNumber || null,
          buildingName: result.resident?.buildingName || null,
          direction,
          status: "DENIED",
          reason: result.reason,
          scanMethod: effectiveScanMethod,
        });
      }
    } catch (err: any) {
      toast.error(err.message || "Verification request failed");
    } finally {
      setIsVerifying(false);
      setTimeout(() => {
        if (scanMode === "MANUAL") inputRef.current?.focus();
      }, 100);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleVerify();
    }
  };

  // Export to Excel
  const handleExportExcel = () => {
    if (!logs.length) {
      toast.info(isAr ? "لا توجد سجلات لتصديرها" : "No logs to export");
      return;
    }

    const dataToExport = logs.map((l: any, i: number) => ({
      "م": i + 1,
      "الوقت والتاريخ": new Date(l.scannedAt).toLocaleString("ar-EG"),
      "الاتجاه": l.direction === "IN" ? "دخول (IN)" : "خروج (OUT)",
      "الحالة": l.status === "GRANTED" ? "مقبول" : "مرفوض",
      "رقم الموظف": l.employeeId,
      "الاسم الكامل": l.fullName,
      "القسم": l.department || "—",
      "المبنى": l.buildingName || "—",
      "الغرفة": l.roomNumber || "—",
      "السبب / الملاحظات": l.reason || "—",
      "مسؤول الأمن": l.scannedBy || "—",
      "طريقة الفحص": l.scanMethod || "—",
    }));

    const ws = XLSX.utils.json_to_sheet(dataToExport);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "GateLogs");
    XLSX.writeFile(wb, `Housing_Gate_Logs_${new Date().toISOString().slice(0, 10)}.xlsx`);
    toast.success(isAr ? "تم تصدير سجل البوابة إلى ملف Excel" : "Exported gate logs to Excel");
  };

  return (
    <div className="space-y-6 w-full pb-10 px-1 sm:px-2">
      {/* ── 1. HEADER ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2.5">
            <div className="w-10 h-10 rounded-2xl bg-primary/10 text-primary flex items-center justify-center shadow-xs">
              <QrCode className="w-6 h-6" />
            </div>
            <div>
              <h1 className="text-2xl font-black text-foreground tracking-tight">
                {isAr ? "بوابة السكن الإلكترونية" : "Electronic Housing Gate"}
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                {isAr
                  ? "فحص وتصريح الدخول الذكي عبر الـ QR Code وتسجيل حركات النزلاء"
                  : "Smart QR access control, pass verification and resident movement logging"}
              </p>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-bold"
            onClick={() => {
              refetchStats();
              refetchLogs();
              toast.info(isAr ? "تم تحديث البيانات" : "Data refreshed");
            }}
          >
            <RefreshCw className="w-3.5 h-3.5" />
            {isAr ? "تحديث" : "Refresh"}
          </Button>

          <Button
            variant="outline"
            size="sm"
            className="gap-1.5 rounded-xl text-xs font-bold"
            onClick={handleExportExcel}
          >
            <Download className="w-3.5 h-3.5" />
            {isAr ? "تصدير Excel" : "Export Excel"}
          </Button>
        </div>
      </div>

      {/* ── 2. TOP METRICS CARDS ── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {/* Today Entries */}
        <Card className="rounded-2xl border bg-card/60 backdrop-blur-md shadow-2xs hover:border-emerald-500/40 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">
                {isAr ? "دخول السكن اليوم" : "Today's Entries"}
              </p>
              <h3 className="text-2xl font-black font-mono text-emerald-600 dark:text-emerald-400 mt-1">
                {stats.todayEntries}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 flex items-center justify-center">
              <LogIn className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Today Exits */}
        <Card className="rounded-2xl border bg-card/60 backdrop-blur-md shadow-2xs hover:border-blue-500/40 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">
                {isAr ? "خروج من السكن اليوم" : "Today's Exits"}
              </p>
              <h3 className="text-2xl font-black font-mono text-blue-600 dark:text-blue-400 mt-1">
                {stats.todayExits}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
              <LogOut className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Currently Inside Housing */}
        <Card className="rounded-2xl border bg-card/60 backdrop-blur-md shadow-2xs hover:border-indigo-500/40 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">
                {isAr ? "المتواجدون بالسكن حالياً" : "Currently Inside"}
              </p>
              <h3 className="text-2xl font-black font-mono text-indigo-600 dark:text-indigo-400 mt-1">
                {stats.currentlyInside}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <Users className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>

        {/* Denied Attempts */}
        <Card className="rounded-2xl border bg-card/60 backdrop-blur-md shadow-2xs hover:border-rose-500/40 transition-all">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-[11px] font-semibold text-muted-foreground">
                {isAr ? "محاولات مرفوضة" : "Denied Scans"}
              </p>
              <h3 className="text-2xl font-black font-mono text-rose-600 dark:text-rose-400 mt-1">
                {stats.todayDenied}
              </h3>
            </div>
            <div className="w-10 h-10 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 flex items-center justify-center">
              <XCircle className="w-5 h-5" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── 3. SCAN & VERIFICATION OPERATIONS CENTER ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left / Top: Scanner Input & Direction Selector (7 cols) */}
        <div className="lg:col-span-7 space-y-4">
          <Card className="rounded-3xl border shadow-sm overflow-hidden">
            <CardHeader className="bg-muted/30 pb-4">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <CardTitle className="text-base font-bold flex items-center gap-2">
                    <ScanLine className="w-5 h-5 text-primary" />
                    {isAr ? "محطة مسح وفحص تصريح البوابة" : "Gate Pass Scanner Station"}
                  </CardTitle>
                  <CardDescription className="text-xs mt-1">
                    {isAr
                      ? "فحص وتصريح فوري عبر كاميرا الجهاز أو قارئ الباركود أو الإدخال اليدوي"
                      : "Instant verification via camera scan, barcode gun, or manual entry"}
                  </CardDescription>
                </div>

                <div className="flex items-center gap-2 flex-wrap">
                  {/* Mode Selector */}
                  <div className="flex items-center gap-1 p-1 bg-background border border-border/80 rounded-2xl shadow-2xs">
                    <button
                      type="button"
                      onClick={() => setScanMode("CAMERA")}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        scanMode === "CAMERA"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Camera className="w-3.5 h-3.5" />
                      <span>{isAr ? "كاميرا حية" : "Camera"}</span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        setScanMode("MANUAL");
                        setTimeout(() => inputRef.current?.focus(), 100);
                      }}
                      className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer ${
                        scanMode === "MANUAL"
                          ? "bg-primary text-primary-foreground shadow-xs"
                          : "text-muted-foreground hover:text-foreground"
                      }`}
                    >
                      <Keyboard className="w-3.5 h-3.5" />
                      <span>{isAr ? "قارئ / يدوي" : "Barcode / Gun"}</span>
                    </button>
                  </div>

                  {/* Fullscreen Camera trigger */}
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setFullscreenCameraOpen(true)}
                    title={isAr ? "فتح الكاميرا بملء الشاشة" : "Full Screen Camera"}
                    className="h-8 px-2.5 rounded-xl text-xs gap-1 font-semibold hidden sm:flex"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>{isAr ? "شاشة كاملة" : "Full View"}</span>
                  </Button>

                  {/* Auto Log Switch */}
                  <div className="flex items-center gap-1.5 ms-1">
                    <label className="text-xs font-semibold text-muted-foreground flex items-center gap-1.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={autoLogEnabled}
                        onChange={(e) => setAutoLogEnabled(e.target.checked)}
                        className="rounded border-border text-primary focus:ring-primary h-4 w-4"
                      />
                      <span>{isAr ? "تسجيل تلقائي" : "Auto-log"}</span>
                    </label>
                  </div>
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-5 sm:p-6 space-y-5">
              {/* Direction Selector: BIG BUTTONS */}
              <div>
                <label className="text-xs font-bold text-muted-foreground block mb-2 uppercase tracking-wider">
                  {isAr ? "اختر اتجاه الحركة:" : "Select Movement Direction:"}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => {
                      setDirection("IN");
                      if (scanMode === "MANUAL") inputRef.current?.focus();
                    }}
                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all border-2 text-sm sm:text-base cursor-pointer ${
                      direction === "IN"
                        ? "bg-emerald-500/15 border-emerald-500 text-emerald-700 dark:text-emerald-300 shadow-md scale-[1.01]"
                        : "bg-card border-border/70 text-muted-foreground hover:border-emerald-500/40"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        direction === "IN"
                          ? "bg-emerald-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <LogIn className="w-5 h-5" />
                    </div>
                    <span>{isAr ? "دخول السكن (IN)" : "Housing Entry (IN)"}</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => {
                      setDirection("OUT");
                      if (scanMode === "MANUAL") inputRef.current?.focus();
                    }}
                    className={`flex items-center justify-center gap-3 p-4 rounded-2xl font-bold transition-all border-2 text-sm sm:text-base cursor-pointer ${
                      direction === "OUT"
                        ? "bg-blue-500/15 border-blue-500 text-blue-700 dark:text-blue-300 shadow-md scale-[1.01]"
                        : "bg-card border-border/70 text-muted-foreground hover:border-blue-500/40"
                    }`}
                  >
                    <div
                      className={`w-9 h-9 rounded-xl flex items-center justify-center ${
                        direction === "OUT"
                          ? "bg-blue-500 text-white"
                          : "bg-muted text-muted-foreground"
                      }`}
                    >
                      <LogOut className="w-5 h-5" />
                    </div>
                    <span>{isAr ? "خروج من السكن (OUT)" : "Housing Exit (OUT)"}</span>
                  </button>
                </div>
              </div>

              {/* ── CONDITIONAL SCANNER VIEW: CAMERA VS BARCODE/MANUAL ── */}
              {scanMode === "CAMERA" ? (
                <div className="space-y-4 pt-1 animate-in fade-in">
                  <GateCameraScanner
                    onScan={(decodedCode) => handleVerify(decodedCode, "CAMERA_SCAN")}
                    isVerifying={isVerifying}
                    isAr={isAr}
                  />

                  {/* Fallback keyboard entry drawer */}
                  <div className="pt-2 border-t border-border/60">
                    <details className="group text-xs text-muted-foreground">
                      <summary className="cursor-pointer hover:text-foreground font-semibold flex items-center gap-1.5 select-none py-1">
                        <Keyboard className="w-3.5 h-3.5 text-primary" />
                        <span>
                          {isAr
                            ? "أو أدخل رقم الموظف يدوياً / قارئ الباركود السلكي"
                            : "Or enter staff ID manually / USB barcode gun"}
                        </span>
                      </summary>
                      <div className="flex gap-2 pt-2.5">
                        <Input
                          ref={inputRef}
                          type="text"
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            isAr
                              ? "اكتب رقم الموظف (مثال: 203) ثم اضغط Enter..."
                              : "Type Staff ID (e.g. 203) and hit Enter..."
                          }
                          className="h-10 rounded-xl text-xs font-mono"
                        />
                        <Button
                          onClick={() => handleVerify(undefined, "MANUAL")}
                          disabled={isVerifying || !scanInput.trim()}
                          size="sm"
                          className="h-10 px-4 rounded-xl font-bold bg-primary text-primary-foreground"
                        >
                          {isAr ? "تحقق" : "Verify"}
                        </Button>
                      </div>
                    </details>
                  </div>
                </div>
              ) : (
                /* Barcode Gun & Manual Mode */
                <div className="space-y-4 pt-1 animate-in fade-in">
                  <div>
                    <label className="text-xs font-bold text-muted-foreground block mb-2">
                      {isAr ? "مسح الـ QR أو إدخال كود الموظف:" : "Scan QR / Enter Staff ID:"}
                    </label>
                    <div className="flex gap-2">
                      <div className="relative flex-1">
                        <ScanLine className="absolute start-3.5 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
                        <Input
                          ref={inputRef}
                          type="text"
                          value={scanInput}
                          onChange={(e) => setScanInput(e.target.value)}
                          onKeyDown={handleKeyDown}
                          placeholder={
                            isAr
                              ? "وجّه القارئ أو اكتب رقم الموظف (مثال: 203) ثم اضغط Enter..."
                              : "Scan QR or type Staff ID (e.g. 203) and hit Enter..."
                          }
                          className="ps-11 h-12 rounded-2xl text-sm font-mono"
                          autoFocus
                        />
                      </div>

                      <Button
                        onClick={() => handleVerify(undefined, "BARCODE_GUN")}
                        disabled={isVerifying || !scanInput.trim()}
                        className="h-12 px-6 rounded-2xl font-bold gap-2 bg-primary text-primary-foreground hover:bg-primary/90"
                      >
                        {isVerifying ? (
                          <RefreshCw className="w-4 h-4 animate-spin" />
                        ) : (
                          <CheckCircle2 className="w-4 h-4" />
                        )}
                        {isAr ? "تحقق فوري" : "Verify"}
                      </Button>
                    </div>
                  </div>

                  {/* Quick sample chips for testing */}
                  <div className="flex items-center gap-2 text-xs text-muted-foreground pt-1 flex-wrap">
                    <span className="font-semibold">{isAr ? "تجربة سريعة:" : "Quick test:"}</span>
                    <button
                      type="button"
                      onClick={() => handleVerify("203", "MANUAL")}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-primary/15 hover:text-primary transition-colors font-mono font-bold cursor-pointer"
                    >
                      EMP #203
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify("1001", "MANUAL")}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-primary/15 hover:text-primary transition-colors font-mono font-bold cursor-pointer"
                    >
                      EMP #1001
                    </button>
                    <button
                      type="button"
                      onClick={() => handleVerify("99999", "MANUAL")}
                      className="px-2.5 py-1 rounded-lg bg-muted hover:bg-red-500/15 hover:text-red-500 transition-colors font-mono font-bold cursor-pointer"
                    >
                      EMP #99999 (Invalid)
                    </button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right / Bottom: Instant Verification Result Card (5 cols) */}
        <div className="lg:col-span-5">
          {lastVerification ? (
            <div
              className={`rounded-3xl border-2 p-5 sm:p-6 shadow-xl transition-all duration-300 animate-in fade-in zoom-in-95 ${
                lastVerification.verdict === "GRANTED"
                  ? "bg-emerald-500/10 border-emerald-500/60 shadow-emerald-500/10"
                  : lastVerification.verdict === "WARNING"
                  ? "bg-amber-500/10 border-amber-500/60 shadow-amber-500/10"
                  : "bg-rose-500/10 border-rose-500/60 shadow-rose-500/10"
              }`}
            >
              {/* Verdict Header Badge */}
              <div className="flex items-center justify-between gap-2 pb-4 border-b border-border/60">
                <div className="flex items-center gap-2.5">
                  {lastVerification.verdict === "GRANTED" ? (
                    <div className="w-10 h-10 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-md">
                      <CheckCircle2 className="w-6 h-6" />
                    </div>
                  ) : lastVerification.verdict === "WARNING" ? (
                    <div className="w-10 h-10 rounded-2xl bg-amber-500 text-white flex items-center justify-center shadow-md">
                      <AlertTriangle className="w-6 h-6" />
                    </div>
                  ) : (
                    <div className="w-10 h-10 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-md">
                      <XCircle className="w-6 h-6" />
                    </div>
                  )}

                  <div>
                    <h3
                      className={`text-lg font-black ${
                        lastVerification.verdict === "GRANTED"
                          ? "text-emerald-600 dark:text-emerald-400"
                          : lastVerification.verdict === "WARNING"
                          ? "text-amber-600 dark:text-amber-400"
                          : "text-rose-600 dark:text-rose-400"
                      }`}
                    >
                      {lastVerification.verdict === "GRANTED"
                        ? isAr
                          ? "مصرّح بالمرور (AUTHORIZED)"
                          : "ACCESS GRANTED"
                        : lastVerification.verdict === "WARNING"
                        ? isAr
                          ? "تنبيه إجازة (ON VACATION)"
                          : "ON VACATION"
                        : isAr
                        ? "ممنوع الدخول (DENIED)"
                        : "ACCESS DENIED"}
                    </h3>
                    <p className="text-xs font-semibold text-muted-foreground mt-0.5">
                      {lastVerification.reason}
                    </p>
                  </div>
                </div>

                <Badge
                  className={`font-mono text-xs px-3 py-1 uppercase rounded-full ${
                    direction === "IN"
                      ? "bg-emerald-500 text-white"
                      : "bg-blue-500 text-white"
                  }`}
                >
                  {direction === "IN" ? (isAr ? "دخول" : "IN") : (isAr ? "خروج" : "OUT")}
                </Badge>
              </div>

              {/* Resident Details if available */}
              {lastVerification.resident ? (
                <div className="space-y-4 pt-4">
                  <div className="flex items-center gap-3.5">
                    {lastVerification.resident.photoUrl ? (
                      <img
                        src={lastVerification.resident.photoUrl}
                        alt=""
                        className="w-16 h-16 rounded-2xl object-cover border-2 border-border shadow-sm shrink-0"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded-2xl bg-muted border-2 border-border flex items-center justify-center text-muted-foreground shrink-0 shadow-inner">
                        <User className="w-8 h-8" />
                      </div>
                    )}

                    <div className="min-w-0 flex-1">
                      <h4 className="text-base font-extrabold text-foreground truncate">
                        {lastVerification.resident.fullName}
                      </h4>
                      <p className="text-xs text-muted-foreground truncate mt-0.5 font-medium">
                        {lastVerification.resident.jobTitle} · {lastVerification.resident.department}
                      </p>
                      <p className="text-xs font-mono text-primary font-bold mt-1">
                        ID: #{lastVerification.resident.employeeId}
                      </p>
                    </div>
                  </div>

                  {/* Room Highlight Box */}
                  <div className="grid grid-cols-2 gap-2.5 p-3 rounded-2xl bg-card/80 border text-center shadow-xs">
                    <div>
                      <span className="text-[10px] text-muted-foreground font-bold uppercase">
                        {isAr ? "المبنى" : "Building"}
                      </span>
                      <p className="text-xs font-extrabold text-foreground truncate mt-0.5">
                        {lastVerification.resident.buildingName || "—"}
                      </p>
                    </div>

                    <div className="border-s border-border">
                      <span className="text-[10px] text-primary font-bold uppercase">
                        {isAr ? "رقم الغرفة" : "Room Number"}
                      </span>
                      <p className="text-xl font-black font-mono text-emerald-600 dark:text-emerald-400">
                        {lastVerification.resident.roomNumber || "—"}
                      </p>
                    </div>
                  </div>

                  {/* Manual Log Action Button (if auto-log is off) */}
                  {!autoLogEnabled && (
                    <Button
                      onClick={() =>
                        logMovementMutation.mutate({
                          propertyId: selectedPropertyId || lastVerification.resident.propertyId || 1,
                          profileId: lastVerification.resident.profileId,
                          employeeId: lastVerification.resident.employeeId,
                          fullName: lastVerification.resident.fullName,
                          department: lastVerification.resident.department,
                          jobTitle: lastVerification.resident.jobTitle,
                          roomNumber: lastVerification.resident.roomNumber,
                          buildingName: lastVerification.resident.buildingName,
                          direction,
                          status: lastVerification.verdict,
                          reason: lastVerification.reason,
                          scanMethod: "MANUAL",
                        })
                      }
                      disabled={logMovementMutation.isPending}
                      className="w-full h-11 rounded-2xl font-bold gap-2 text-xs"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      {isAr
                        ? `تأكيد تسجيل حركة ${direction === "IN" ? "الدخول" : "الخروج"} الآن`
                        : `Confirm & Record ${direction} Movement`}
                    </Button>
                  )}
                </div>
              ) : (
                <div className="pt-4 text-center py-6 text-muted-foreground text-xs">
                  {isAr
                    ? "الرمز غير مسجل بقاعدة بيانات موظفي السكن."
                    : "No resident record associated with this identifier."}
                </div>
              )}
            </div>
          ) : (
            <Card className="rounded-3xl border border-dashed h-full flex flex-col items-center justify-center p-8 text-center bg-card/40">
              <div className="w-14 h-14 rounded-2xl bg-muted/60 text-muted-foreground flex items-center justify-center mb-3">
                <ScanLine className="w-7 h-7" />
              </div>
              <h4 className="text-sm font-bold text-foreground">
                {isAr ? "بانتظار مسح التصريح..." : "Waiting for Gate Scan..."}
              </h4>
              <p className="text-xs text-muted-foreground mt-1 max-w-[240px]">
                {isAr
                  ? "وجّه الماسح الضوئي لكود الـ QR لظهور بيانات المقيم وحالة صلاحية الدخول فوراً"
                  : "Scan a resident QR pass or enter staff ID to view instant verification"}
              </p>
            </Card>
          )}
        </div>
      </div>

      {/* ── 4. REAL-TIME GATE ACTIVITY FEED & LOGS TABLE ── */}
      <Card className="rounded-3xl border shadow-sm">
        <CardHeader className="pb-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <CardTitle className="text-base font-bold flex items-center gap-2">
                <Clock className="w-5 h-5 text-primary" />
                {isAr ? "سجل حركات بوابة السكن اللحظي" : "Live Gate Movement Log"}
              </CardTitle>
              <CardDescription className="text-xs mt-0.5">
                {isAr
                  ? "توثيق شامل وفوري لعمليات الدخول والخروج مع التوقيت ورقم الغرفة"
                  : "Real-time audit trail of resident gate entries and exits"}
              </CardDescription>
            </div>

            {/* Table Filters */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Direction Filter */}
              <select
                value={filterDirection}
                onChange={(e) => setFilterDirection(e.target.value)}
                className="h-9 rounded-xl text-xs border border-border bg-background px-2.5 font-medium"
              >
                <option value="all">{isAr ? "كل الحركات" : "All Directions"}</option>
                <option value="IN">{isAr ? "دخول فقط (IN)" : "IN Only"}</option>
                <option value="OUT">{isAr ? "خروج فقط (OUT)" : "OUT Only"}</option>
              </select>

              {/* Status Filter */}
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="h-9 rounded-xl text-xs border border-border bg-background px-2.5 font-medium"
              >
                <option value="all">{isAr ? "كل الحالات" : "All Status"}</option>
                <option value="GRANTED">{isAr ? "مقبول فقط" : "Granted Only"}</option>
                <option value="DENIED">{isAr ? "مرفوض فقط" : "Denied Only"}</option>
              </select>

              {/* Search input */}
              <div className="relative">
                <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground" />
                <Input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={isAr ? "بحث بالاسم أو الكود..." : "Search..."}
                  className="ps-8 h-9 rounded-xl text-xs w-36 sm:w-44"
                />
              </div>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/40">
                  <TableHead className="w-24">{isAr ? "الوقت" : "Time"}</TableHead>
                  <TableHead className="w-28">{isAr ? "الاتجاه" : "Direction"}</TableHead>
                  <TableHead className="w-24">{isAr ? "طريقة الفحص" : "Method"}</TableHead>
                  <TableHead>{isAr ? "المقيم" : "Resident"}</TableHead>
                  <TableHead>{isAr ? "الغرفة والمبنى" : "Room & Building"}</TableHead>
                  <TableHead className="w-28">{isAr ? "الحالة" : "Status"}</TableHead>
                  <TableHead>{isAr ? "السبب / الملاحظات" : "Reason / Details"}</TableHead>
                  <TableHead className="w-32">{isAr ? "رجل الأمن" : "Officer"}</TableHead>
                </TableRow>
              </TableHeader>

              <TableBody>
                {isLogsLoading ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <TableRow key={i}>
                      <TableCell colSpan={8} className="py-3">
                        <div className="h-5 bg-muted animate-pulse rounded-lg" />
                      </TableCell>
                    </TableRow>
                  ))
                ) : logs.length === 0 ? (
                  <TableRow>
                    <TableCell
                      colSpan={8}
                      className="text-center py-10 text-muted-foreground text-xs"
                    >
                      {isAr
                        ? "لا توجد حركات مسجلة حالياً لبوابة السكن."
                        : "No gate movements recorded yet today."}
                    </TableCell>
                  </TableRow>
                ) : (
                  logs.map((log: any) => {
                    const timeFormatted = new Date(log.scannedAt).toLocaleTimeString(
                      isAr ? "ar-EG" : "en-US",
                      { hour: "2-digit", minute: "2-digit", second: "2-digit" }
                    );

                    return (
                      <TableRow key={log.id} className="hover:bg-muted/30">
                        {/* Time */}
                        <TableCell className="font-mono text-xs font-semibold text-muted-foreground">
                          {timeFormatted}
                        </TableCell>

                        {/* Direction Badge */}
                        <TableCell>
                          <Badge
                            className={`font-mono text-[11px] font-bold px-2.5 py-0.5 rounded-md ${
                              log.direction === "IN"
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30"
                                : "bg-blue-500/15 text-blue-700 dark:text-blue-300 border border-blue-500/30"
                            }`}
                          >
                            {log.direction === "IN" ? (
                              <span className="flex items-center gap-1">
                                <LogIn className="w-3 h-3" />
                                {isAr ? "دخول" : "IN"}
                              </span>
                            ) : (
                              <span className="flex items-center gap-1">
                                <LogOut className="w-3 h-3" />
                                {isAr ? "خروج" : "OUT"}
                              </span>
                            )}
                          </Badge>
                        </TableCell>

                        {/* Scan Method */}
                        <TableCell>
                          <Badge variant="outline" className="text-[10px] font-mono gap-1 rounded-md px-1.5 py-0.5 bg-muted/40">
                            {log.scanMethod === "CAMERA_SCAN" ? (
                              <>
                                <Camera className="w-3 h-3 text-emerald-500" />
                                <span>{isAr ? "كاميرا" : "Camera"}</span>
                              </>
                            ) : log.scanMethod === "QR_SCAN" ? (
                              <>
                                <QrCode className="w-3 h-3 text-blue-500" />
                                <span>QR</span>
                              </>
                            ) : (
                              <>
                                <Keyboard className="w-3 h-3 text-muted-foreground" />
                                <span>{isAr ? "يدوي" : "Manual"}</span>
                              </>
                            )}
                          </Badge>
                        </TableCell>

                        {/* Resident */}
                        <TableCell>
                          <div className="font-bold text-xs text-foreground leading-tight">
                            {log.fullName}
                          </div>
                          <div className="text-[11px] text-muted-foreground font-mono mt-0.5">
                            ID: {log.employeeId} {log.department ? `· ${log.department}` : ""}
                          </div>
                        </TableCell>

                        {/* Room & Building */}
                        <TableCell>
                          {log.roomNumber ? (
                            <div className="text-xs">
                              <span className="font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {isAr ? "غرفة " : "Room "}
                                {log.roomNumber}
                              </span>
                              {log.buildingName && (
                                <span className="text-muted-foreground text-[11px] block mt-0.5">
                                  {log.buildingName}
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-muted-foreground text-xs">—</span>
                          )}
                        </TableCell>

                        {/* Status */}
                        <TableCell>
                          <Badge
                            variant={log.status === "GRANTED" ? "default" : "destructive"}
                            className={`text-[10px] font-bold uppercase rounded-full ${
                              log.status === "GRANTED"
                                ? "bg-emerald-600 hover:bg-emerald-600"
                                : ""
                            }`}
                          >
                            {log.status === "GRANTED"
                              ? isAr
                                ? "مقبول"
                                : "GRANTED"
                              : isAr
                              ? "مرفوض"
                              : "DENIED"}
                          </Badge>
                        </TableCell>

                        {/* Reason */}
                        <TableCell className="text-xs text-muted-foreground max-w-[200px] truncate">
                          {log.reason || "—"}
                        </TableCell>

                        {/* Officer */}
                        <TableCell className="text-xs font-medium text-foreground">
                          {log.scannedBy}
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* ── 5. FULL SCREEN CAMERA MODAL (TABLETS & PHONES) ── */}
      <Dialog open={fullscreenCameraOpen} onOpenChange={setFullscreenCameraOpen}>
        <DialogContent className="max-w-2xl w-full p-4 sm:p-6 rounded-3xl bg-background border shadow-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center justify-between">
              <span className="flex items-center gap-2 text-base font-bold text-foreground">
                <Camera className="w-5 h-5 text-primary" />
                {isAr ? "كاميرا فحص تصريح البوابة بملء الشاشة" : "Full Screen Gate Pass Camera"}
              </span>
              <Badge
                className={`font-mono text-xs px-3 py-1 uppercase rounded-full ${
                  direction === "IN" ? "bg-emerald-500 text-white" : "bg-blue-500 text-white"
                }`}
              >
                {direction === "IN" ? (isAr ? "دخول (IN)" : "IN") : (isAr ? "خروج (OUT)" : "OUT")}
              </Badge>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 pt-2">
            <GateCameraScanner
              onScan={(code) => {
                handleVerify(code, "CAMERA_SCAN");
              }}
              isVerifying={isVerifying}
              isAr={isAr}
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
