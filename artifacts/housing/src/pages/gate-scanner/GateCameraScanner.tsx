import React, { useState, useEffect, useRef, useCallback } from "react";
import { Html5Qrcode, Html5QrcodeSupportedFormats } from "html5-qrcode";
import {
  Camera,
  CameraOff,
  FlipHorizontal,
  Zap,
  ZapOff,
  Upload,
  RefreshCw,
  AlertCircle,
  CheckCircle2,
  ScanLine,
  LogIn,
  LogOut,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";

interface GateCameraScannerProps {
  onScan: (decodedText: string, currentDirection?: "IN" | "OUT") => void;
  direction?: "IN" | "OUT";
  onDirectionChange?: (dir: "IN" | "OUT") => void;
  isVerifying: boolean;
  isAr: boolean;
  containerId?: string;
  active?: boolean;
}

export function GateCameraScanner({
  onScan,
  direction = "IN",
  onDirectionChange,
  isVerifying,
  isAr,
  containerId = "gate-camera-viewport",
  active = true,
}: GateCameraScannerProps) {
  const [isCameraActive, setIsCameraActive] = useState<boolean>(true);
  const [cameras, setCameras] = useState<Array<{ id: string; label: string }>>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("");
  const [facingMode, setFacingMode] = useState<"environment" | "user">("environment");
  const [hasTorch, setHasTorch] = useState<boolean>(false);
  const [isTorchOn, setIsTorchOn] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isStarting, setIsStarting] = useState<boolean>(false);
  const [lastScannedCode, setLastScannedCode] = useState<string | null>(null);
  const [cooldownRemaining, setCooldownRemaining] = useState<number>(0);

  const scannerRef = useRef<Html5Qrcode | null>(null);
  const cooldownTimerRef = useRef<any>(null);
  const isCooldownRef = useRef<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;
  const isVerifyingRef = useRef(isVerifying);
  isVerifyingRef.current = isVerifying;
  const directionRef = useRef(direction);
  directionRef.current = direction;

  // Stop camera helper
  const stopCamera = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) {
          await scannerRef.current.stop();
        }
        scannerRef.current.clear();
      } catch (err) {
        console.warn("[GateCameraScanner] Error stopping camera:", err);
      } finally {
        scannerRef.current = null;
      }
    }
    setIsTorchOn(false);
    setHasTorch(false);
  }, []);

  // Start camera helper
  const startCamera = useCallback(async (camId?: string, mode?: "environment" | "user") => {
    if (!active || !isCameraActive) return;
    setIsStarting(true);
    setCameraError(null);

    await stopCamera();

    // Check secure context (HTTPS / localhost required for getUserMedia)
    if (
      typeof window !== "undefined" &&
      !window.isSecureContext &&
      window.location.hostname !== "localhost" &&
      window.location.hostname !== "127.0.0.1"
    ) {
      setCameraError(
        isAr
          ? "متصفحك يمنع فتح الكاميرا بدون اتصال آمن (HTTPS). يرجى الدخول عبر رابط https:// أو إدخال الكود يدوياً."
          : "Camera requires a secure context (HTTPS). Please open the site via HTTPS or enter ID manually."
      );
      setIsStarting(false);
      return;
    }

    const containerEl = document.getElementById(containerId);
    if (!containerEl) {
      console.warn(`[GateCameraScanner] Container #${containerId} not found in DOM yet.`);
      setIsStarting(false);
      return;
    }

    try {
      const scanner = new Html5Qrcode(containerId, {
        formatsToSupport: [
          Html5QrcodeSupportedFormats.QR_CODE,
          Html5QrcodeSupportedFormats.CODE_128,
          Html5QrcodeSupportedFormats.CODE_39,
          Html5QrcodeSupportedFormats.EAN_13,
          Html5QrcodeSupportedFormats.UPC_A,
        ],
        verbose: false,
        experimentalFeatures: {
          useBarCodeDetectorIfSupported: true,
        },
      });
      scannerRef.current = scanner;

      // Enumerate cameras if not already done
      let targetCamId = camId || selectedCameraId;
      try {
        const devs = await Html5Qrcode.getCameras();
        if (devs && devs.length > 0) {
          setCameras(devs);
          if (!targetCamId) {
            // Pick back camera if labeled, or default to first
            const backCam = devs.find((d) =>
              /back|rear|environment|خلف/i.test(d.label)
            );
            if (backCam) {
              targetCamId = backCam.id;
              setSelectedCameraId(backCam.id);
            } else {
              targetCamId = devs[0].id;
              setSelectedCameraId(devs[0].id);
            }
          }
        }
      } catch (e) {
        console.warn("[GateCameraScanner] Could not enumerate devices:", e);
      }

      const scanConfig = {
        fps: 20,
        qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
          const minEdge = Math.min(viewfinderWidth, viewfinderHeight);
          const edgeSize = Math.max(220, Math.floor(minEdge * 0.85));
          return { width: edgeSize, height: edgeSize };
        },
      };

      const onScanSuccess = (decodedText: string) => {
        if (isCooldownRef.current || isVerifyingRef.current) return;
        isCooldownRef.current = true;
        setLastScannedCode(decodedText);
        setCooldownRemaining(2);

        onScanRef.current(decodedText, directionRef.current);

        let remaining = 2;
        if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
        cooldownTimerRef.current = setInterval(() => {
          remaining -= 1;
          setCooldownRemaining(remaining);
          if (remaining <= 0) {
            clearInterval(cooldownTimerRef.current);
            isCooldownRef.current = false;
            setCooldownRemaining(0);
          }
        }, 1000);
      };

      let started = false;
      // 1. Try with targetCamId or facingMode environment
      try {
        const camConfig: any = targetCamId
          ? { deviceId: { exact: targetCamId } }
          : { facingMode: { ideal: mode || facingMode } };
        await scanner.start(camConfig, scanConfig, onScanSuccess, () => {});
        started = true;
      } catch (err1) {
        console.warn("[GateCameraScanner] First camera attempt failed, retrying with fallback constraint:", err1);
      }

      // 2. If first attempt failed (e.g. desktop webcam without environment mode), try user or generic
      if (!started) {
        try {
          await scanner.start({ facingMode: "user" }, scanConfig, onScanSuccess, () => {});
          started = true;
        } catch (err2) {
          console.warn("[GateCameraScanner] User facing mode failed, trying default constraint:", err2);
          await scanner.start({} as any, scanConfig, onScanSuccess, () => {});
          started = true;
        }
      }

      // Check for torch capability
      try {
        const capabilities = scanner.getRunningTrackCapabilities();
        if (capabilities && (capabilities as any).torch) {
          setHasTorch(true);
        } else {
          setHasTorch(false);
        }
      } catch {}
    } catch (err: any) {
      console.error("[GateCameraScanner] Camera start error:", err);
      let errMsg = isAr
        ? "تعذر الوصول إلى الكاميرا. يرجى التأكد من منح الإذن للمتصفح واستخدام اتصال HTTPS."
        : "Failed to access camera. Please allow camera permissions and ensure HTTPS.";
      if (err?.name === "NotAllowedError" || String(err).includes("Permission")) {
        errMsg = isAr
          ? "تم رفض إذن الكاميرا. الرجاء السماح بالوصول للكاميرا من إعدادات المتصفح."
          : "Camera permission denied. Please allow camera access in browser settings.";
      } else if (err?.name === "NotFoundError" || String(err).includes("DevicesNotFoundError")) {
        errMsg = isAr
          ? "لم يتم العثور على أي كاميرا متصلة بالجهاز."
          : "No camera found on this device.";
      } else if (err?.name === "NotReadableError" || String(err).includes("Could not start video source")) {
        errMsg = isAr
          ? "الكاميرا قيد الاستخدام بواسطة تطبيق أو نافذة أخرى."
          : "Camera is already in use by another app or browser tab.";
      }
      setCameraError(errMsg);
    } finally {
      setIsStarting(false);
    }
  }, [active, containerId, facingMode, isAr, isCameraActive, selectedCameraId, stopCamera]);

  // Handle Torch Toggle
  const toggleTorch = async () => {
    if (!scannerRef.current || !hasTorch) return;
    try {
      const nextState = !isTorchOn;
      await scannerRef.current.applyVideoConstraints({
        advanced: [{ torch: nextState }] as any,
      });
      setIsTorchOn(nextState);
    } catch (err) {
      toast.error(isAr ? "فشل تفعيل فلاش الكاميرا" : "Failed to toggle torch");
    }
  };

  // Flip Camera between back and front
  const flipCamera = async () => {
    const nextMode = facingMode === "environment" ? "user" : "environment";
    setFacingMode(nextMode);
    setSelectedCameraId("");
    await startCamera(undefined, nextMode);
  };

  // Handle Image File Scan
  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      toast.info(isAr ? "جارٍ قراءة كود الـ QR من الصورة..." : "Scanning QR from image...");
      let html5QrCode = scannerRef.current;
      let tempInstance = false;
      if (!html5QrCode) {
        html5QrCode = new Html5Qrcode(containerId, {
          verbose: false,
          experimentalFeatures: {
            useBarCodeDetectorIfSupported: true,
          },
        });
        tempInstance = true;
      }
      const decodedText = await html5QrCode.scanFile(file, true);
      if (tempInstance) {
        html5QrCode.clear();
      }
      toast.success(isAr ? "تم قراءة الكود بنجاح!" : "QR Code detected successfully!");
      onScanRef.current(decodedText, directionRef.current);
    } catch (err) {
      toast.error(
        isAr
          ? "لم يتم العثور على كود QR واضح في الصورة المختارة"
          : "No valid QR code found in selected image"
      );
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  // Toggle Camera on/off
  const toggleCameraActive = async () => {
    if (isCameraActive) {
      await stopCamera();
      setIsCameraActive(false);
    } else {
      setIsCameraActive(true);
      // will be started by useEffect
    }
  };

  // Lifecycle
  useEffect(() => {
    let timer: any = null;
    if (active && isCameraActive) {
      timer = setTimeout(() => {
        startCamera(selectedCameraId);
      }, 150);
    } else {
      stopCamera();
    }

    return () => {
      if (timer) clearTimeout(timer);
      if (cooldownTimerRef.current) clearInterval(cooldownTimerRef.current);
      stopCamera();
    };
  }, [active, isCameraActive, selectedCameraId, startCamera, stopCamera]);

  return (
    <div className="space-y-3">
      {/* ── Top Bar Controls ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-2xl bg-muted/40 border border-border/60">
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant={isCameraActive ? "default" : "outline"}
            size="sm"
            onClick={toggleCameraActive}
            className={`h-8 px-3 rounded-xl text-xs font-bold gap-1.5 transition-all ${
              isCameraActive
                ? "bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                : "border-border text-muted-foreground"
            }`}
          >
            {isCameraActive ? (
              <>
                <Camera className="w-3.5 h-3.5 animate-pulse" />
                <span>{isAr ? "الكاميرا تعمل" : "Camera Active"}</span>
              </>
            ) : (
              <>
                <CameraOff className="w-3.5 h-3.5" />
                <span>{isAr ? "تشغيل الكاميرا" : "Turn On Camera"}</span>
              </>
            )}
          </Button>

          {cameras.length > 1 && isCameraActive && (
            <select
              value={selectedCameraId}
              onChange={(e) => {
                const newId = e.target.value;
                setSelectedCameraId(newId);
                startCamera(newId);
              }}
              className="h-8 px-2.5 rounded-xl border border-border bg-background text-xs font-medium text-foreground focus:outline-none focus:ring-1 focus:ring-primary max-w-[140px] truncate"
            >
              {cameras.map((c, i) => (
                <option key={c.id} value={c.id}>
                  {c.label || `${isAr ? "كاميرا" : "Camera"} ${i + 1}`}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Direction Switcher directly in Camera Toolbar */}
        {onDirectionChange && (
          <div className="flex items-center gap-1 p-0.5 bg-background border border-border/80 rounded-xl shadow-2xs">
            <button
              type="button"
              onClick={() => onDirectionChange("IN")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                direction === "IN"
                  ? "bg-emerald-600 text-white shadow-xs scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>{isAr ? "دخول (IN)" : "IN"}</span>
            </button>
            <button
              type="button"
              onClick={() => onDirectionChange("OUT")}
              className={`px-3 py-1 rounded-lg text-xs font-bold transition-all flex items-center gap-1.5 cursor-pointer ${
                direction === "OUT"
                  ? "bg-blue-600 text-white shadow-xs scale-[1.02]"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{isAr ? "خروج (OUT)" : "OUT"}</span>
            </button>
          </div>
        )}

        <div className="flex items-center gap-1.5">
          {/* Flip camera */}
          {isCameraActive && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={flipCamera}
              title={isAr ? "تبديل الكاميرا (أمامية / خلفية)" : "Flip Camera (Front / Back)"}
              className="h-8 w-8 p-0 rounded-xl"
            >
              <FlipHorizontal className="w-3.5 h-3.5" />
            </Button>
          )}

          {/* Flashlight / Torch */}
          {isCameraActive && hasTorch && (
            <Button
              type="button"
              variant={isTorchOn ? "default" : "outline"}
              size="sm"
              onClick={toggleTorch}
              title={isAr ? "فلاش الكاميرا" : "Flashlight"}
              className={`h-8 w-8 p-0 rounded-xl ${
                isTorchOn ? "bg-amber-500 hover:bg-amber-600 text-white" : ""
              }`}
            >
              {isTorchOn ? (
                <Zap className="w-3.5 h-3.5 fill-current" />
              ) : (
                <ZapOff className="w-3.5 h-3.5" />
              )}
            </Button>
          )}

          {/* Upload image */}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => fileInputRef.current?.click()}
            title={isAr ? "فحص كود من ملف صورة" : "Scan from image file"}
            className="h-8 px-2.5 rounded-xl text-xs gap-1 font-semibold"
          >
            <Upload className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">{isAr ? "مسح من صورة" : "Scan Image"}</span>
          </Button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
        </div>
      </div>

      {/* ── Viewport Container ── */}
      <div className="relative w-full aspect-square max-h-[380px] sm:max-h-[420px] rounded-3xl overflow-hidden bg-black/90 border-2 border-border/80 shadow-inner flex items-center justify-center">
        {/* The HTML5 QR Code DOM target */}
        <div
          id={containerId}
          className={`w-full h-full [&_video]:w-full [&_video]:h-full [&_video]:object-contain [&_canvas]:hidden ${
            !isCameraActive || cameraError ? "hidden" : ""
          }`}
        />

        {/* Laser Scanner Line and Corner Target Overlay (when active) */}
        {isCameraActive && !cameraError && !isStarting && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
            {/* Direction Indicator Badge (Clickable to switch) */}
            <div className="absolute top-3 inset-x-0 flex justify-center pointer-events-auto">
              <button
                type="button"
                onClick={() => onDirectionChange && onDirectionChange(direction === "IN" ? "OUT" : "IN")}
                className={`font-mono text-xs px-3.5 py-1 font-bold rounded-full shadow-lg transition-all flex items-center gap-1.5 border cursor-pointer ${
                  direction === "IN"
                    ? "bg-emerald-600/90 hover:bg-emerald-600 text-white border-emerald-400/60"
                    : "bg-blue-600/90 hover:bg-blue-600 text-white border-blue-400/60"
                }`}
                title={isAr ? "اضغط للتبديل بين الدخول والخروج" : "Click to toggle IN / OUT"}
              >
                {direction === "IN" ? (
                  <>
                    <LogIn className="w-3.5 h-3.5" />
                    <span>{isAr ? "اتجاه المسح: دخول (IN)" : "SCANNING: IN"}</span>
                  </>
                ) : (
                  <>
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{isAr ? "اتجاه المسح: خروج (OUT)" : "SCANNING: OUT"}</span>
                  </>
                )}
              </button>
            </div>

            {/* Viewfinder Target Box */}
            <div className="relative w-[85%] h-[85%] border-2 border-primary/60 rounded-3xl overflow-hidden shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]">
              {/* Corner Accents */}
              <div className="absolute top-0 start-0 w-6 h-6 border-t-4 border-s-4 border-emerald-400 rounded-tl-xl" />
              <div className="absolute top-0 end-0 w-6 h-6 border-t-4 border-e-4 border-emerald-400 rounded-tr-xl" />
              <div className="absolute bottom-0 start-0 w-6 h-6 border-b-4 border-s-4 border-emerald-400 rounded-bl-xl" />
              <div className="absolute bottom-0 end-0 w-6 h-6 border-b-4 border-e-4 border-emerald-400 rounded-br-xl" />

              {/* Animated Laser Scan Bar */}
              <div className="w-full h-0.5 bg-gradient-to-r from-transparent via-emerald-400 to-transparent shadow-[0_0_12px_#34d399] animate-[bounce_2s_infinite]" />
            </div>

            {/* Live scanning badge */}
            <div className="absolute bottom-3 inset-x-0 flex justify-center">
              <Badge
                variant="secondary"
                className="bg-black/70 backdrop-blur-md text-white border-white/20 text-[11px] px-3 py-1 font-mono flex items-center gap-1.5 shadow-lg"
              >
                <ScanLine className="w-3.5 h-3.5 text-emerald-400 animate-pulse" />
                <span>
                  {cooldownRemaining > 0
                    ? isAr
                      ? `تم المسح بنجاح (استئناف بعد ${cooldownRemaining}ث)`
                      : `Scanned! Resuming in ${cooldownRemaining}s`
                    : isAr
                    ? "وجّه كود الـ QR داخل الإطار للمسح التلقائي"
                    : "Align QR code inside the frame"}
                </span>
              </Badge>
            </div>
          </div>
        )}

        {/* Loading Spinner */}
        {isStarting && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/80 text-white z-10">
            <RefreshCw className="w-8 h-8 animate-spin text-primary" />
            <p className="text-xs font-semibold">
              {isAr ? "جارٍ تشغيل الكاميرا..." : "Starting camera feed..."}
            </p>
          </div>
        )}

        {/* Camera Off State */}
        {!isCameraActive && (
          <div className="flex flex-col items-center justify-center p-6 text-center text-white/70 space-y-3">
            <div className="w-14 h-14 rounded-3xl bg-white/10 flex items-center justify-center text-white/50 border border-white/15">
              <CameraOff className="w-7 h-7" />
            </div>
            <div>
              <h4 className="font-bold text-sm text-white">
                {isAr ? "الكاميرا متوقفة" : "Camera is Paused"}
              </h4>
              <p className="text-xs text-white/50 max-w-[220px] mt-1">
                {isAr
                  ? "اضغط الزر أدناه لتشغيل الكاميرا ومسح تصاريح الـ QR مباشرة"
                  : "Click below to activate camera and scan QR passes live"}
              </p>
            </div>
            <Button
              type="button"
              size="sm"
              onClick={toggleCameraActive}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl text-xs gap-1.5"
            >
              <Camera className="w-3.5 h-3.5" />
              <span>{isAr ? "تشغيل الكاميرا الآن" : "Start Camera"}</span>
            </Button>
          </div>
        )}

        {/* Error State */}
        {cameraError && (
          <div className="flex flex-col items-center justify-center p-6 text-center text-rose-300 space-y-3 bg-rose-950/40 m-4 rounded-2xl border border-rose-500/30">
            <AlertCircle className="w-8 h-8 text-rose-400" />
            <p className="text-xs font-medium leading-relaxed max-w-[280px]">
              {cameraError}
            </p>
            <div className="flex gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => startCamera(selectedCameraId)}
                className="h-8 px-3 text-xs bg-rose-500/20 hover:bg-rose-500/30 border-rose-500/40 text-rose-200"
              >
                <RefreshCw className="w-3.5 h-3.5 me-1" />
                {isAr ? "إعادة المحاولة" : "Retry"}
              </Button>
            </div>
          </div>
        )}

        {/* Cooldown / Verified Flash Indicator */}
        {cooldownRemaining > 0 && (
          <div className="absolute top-3 end-3 z-20 animate-in fade-in">
            <Badge className="bg-emerald-500 text-white font-bold text-xs px-2.5 py-1 gap-1 shadow-lg">
              <CheckCircle2 className="w-3.5 h-3.5" />
              <span>{isAr ? "تم التقاط الكود" : "Code Captured"}</span>
            </Badge>
          </div>
        )}
      </div>
    </div>
  );
}
