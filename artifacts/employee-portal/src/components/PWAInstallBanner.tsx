/**
 * PWAInstallBanner.tsx
 * يعرض بانر تحميل وتثبيت التطبيق على Android/iOS/Desktop
 */
import { useState, useEffect } from "react";
import { Download, X, Share, PlusSquare, Smartphone, HelpCircle, Check } from "lucide-react";
import { useTheme } from "../lib/theme";

function isIOS(): boolean {
  if (typeof window === "undefined") return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function PWAInstallBanner({ compact = false }: { compact?: boolean }) {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [installPrompt, setInstallPrompt] = useState<any>(() => {
    if (typeof window !== "undefined" && (window as any).deferredPrompt) {
      return (window as any).deferredPrompt;
    }
    return null;
  });
  const [showManualGuide, setShowManualGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    if (isInStandaloneMode()) {
      setInstalled(true);
      return;
    }
    const wasDismissed = sessionStorage.getItem("pwa_banner_dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    const handler = (e: Event) => {
      (window as any).deferredPrompt = e;
      setInstallPrompt(e);
    };

    const handlePromptReady = () => {
      if ((window as any).deferredPrompt) {
        setInstallPrompt((window as any).deferredPrompt);
      }
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("pwa-prompt-ready", handlePromptReady);

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setInstallPrompt(null);
      (window as any).deferredPrompt = null;
    });

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
    };
  }, []);

  const handleInstallClick = async () => {
    const promptObj = installPrompt || (typeof window !== "undefined" ? (window as any).deferredPrompt : null);

    if (promptObj && typeof promptObj.prompt === "function") {
      try {
        await promptObj.prompt();
        const result = await promptObj.userChoice;
        if (result && result.outcome === "accepted") {
          setInstallPrompt(null);
          setInstalled(true);
          (window as any).deferredPrompt = null;
        }
      } catch (e) {
        console.warn("[PWA] prompt error:", e);
        setShowManualGuide(true);
      }
    } else {
      setShowManualGuide(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa_banner_dismissed", "1");
  };

  // Don't show if already installed in standalone mode
  if (installed || isInStandaloneMode()) return null;
  if (dismissed && !showManualGuide) return null;

  const ios = isIOS();

  // Compact Variant (e.g. For Header or Inside Cards)
  if (compact) {
    return (
      <div className="w-full bg-[#12131C] border border-[#C9A24D]/30 rounded-xl p-2.5 flex items-center justify-between gap-2 shadow-md">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-[#C9A24D]/20 flex items-center justify-center shrink-0">
            <Smartphone className="w-4 h-4 text-[#C9A24D]" />
          </div>
          <span className="text-xs font-semibold text-white/90">
            {isRtl ? "تثبيت البوابة كتطبيق على هاتفك" : "Install Portal App on Mobile"}
          </span>
        </div>
        <button
          type="button"
          onClick={handleInstallClick}
          className="px-3 py-1 bg-[#C9A24D] hover:bg-[#DFBF70] text-black font-bold rounded-lg text-xs transition-colors shrink-0 shadow-sm cursor-pointer"
        >
          {isRtl ? "تثبيت" : "Install"}
        </button>
      </div>
    );
  }

  return (
    <div className="mt-4 p-4 bg-[#12131A] border border-[#C9A24D]/30 rounded-2xl relative animate-[fadeIn_0.3s_ease] overflow-hidden text-start shadow-xl shadow-black/50">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-[#C9A24D]/10 to-transparent pointer-events-none" />

      <button
        type="button"
        onClick={handleDismiss}
        className="absolute top-3 end-3 p-1.5 text-white/40 hover:text-white rounded-lg hover:bg-white/10 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 relative">
        <div className="w-11 h-11 rounded-2xl bg-gradient-to-br from-[#C9A24D] to-[#997A30] flex items-center justify-center shrink-0 shadow-lg shadow-[#C9A24D]/25">
          <Smartphone className="w-6 h-6 text-[#12131C]" />
        </div>
        <div className="flex-1 min-w-0 pe-6">
          <div className="flex items-center gap-2">
            <h4 className="text-sm font-bold text-white">
              {isRtl ? "تثبيت تطبيق بوابة المقيمين" : "Install Resident Portal App"}
            </h4>
            <span className="px-1.5 py-0.5 rounded bg-[#C9A24D]/20 text-[#DFBF70] font-mono text-[10px] font-bold">
              PWA
            </span>
          </div>
          <p className="text-xs text-white/65 mt-0.5">
            {isRtl
              ? "تطبيق خفيف وسريع بدون متصفح مع إشعارات مباشرة"
              : "Fast, standalone web app with instant notifications"}
          </p>
        </div>
      </div>

      {!showManualGuide && (
        <button
          type="button"
          onClick={handleInstallClick}
          className="w-full mt-3.5 py-2.5 rounded-xl bg-gradient-to-r from-[#C9A24D] via-[#DFBF70] to-[#C9A24D] text-[#12131C] text-xs sm:text-sm font-bold hover:brightness-105 active:scale-[0.98] transition-all flex items-center justify-center gap-2 shadow-md shadow-[#C9A24D]/25 cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#12131C]" />
          <span>{isRtl ? "تثبيت التطبيق الآن" : "Install App Now"}</span>
        </button>
      )}

      {/* Manual Step-by-Step Guide for iOS or Browsers without prompt */}
      {(showManualGuide || (ios && !installPrompt)) && (
        <div className="mt-3 pt-3 border-t border-white/10 space-y-2 text-xs text-white/85">
          {ios ? (
            <>
              <div className="flex items-center gap-1.5 font-semibold text-[#DFBF70]">
                <Smartphone className="w-4 h-4 shrink-0" />
                <span>{isRtl ? "طريقة التثبيت على آيفون (Safari):" : "Install on iOS Safari:"}</span>
              </div>
              <div className="flex items-center gap-2 text-white/70 ps-1">
                <Share className="w-3.5 h-3.5 text-[#DFBF70] shrink-0" />
                <span>{isRtl ? "1. اضغط على زر المشاركة (⬆) أسفل شاشة المتصفح" : "1. Tap the Share button (⬆) at the bottom"}</span>
              </div>
              <div className="flex items-center gap-2 text-white/70 ps-1">
                <PlusSquare className="w-3.5 h-3.5 text-[#DFBF70] shrink-0" />
                <span>{isRtl ? "2. اختر 'إضافة إلى الشاشة الرئيسية' (Add to Home Screen)" : "2. Select 'Add to Home Screen'"}</span>
              </div>
              <div className="flex items-center gap-2 text-white/70 ps-1">
                <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                <span>{isRtl ? "3. اضغط 'إضافة' وسيظهر التطبيق على شاشتك" : "3. Tap 'Add' and app icon will appear"}</span>
              </div>
            </>
          ) : (
            <>
              <div className="flex items-center gap-1.5 font-semibold text-[#DFBF70]">
                <HelpCircle className="w-4 h-4 shrink-0" />
                <span>{isRtl ? "طريقة التثبيت من المتصفح:" : "Browser Installation Guide:"}</span>
              </div>
              <p className="text-white/70 ps-1 leading-relaxed">
                {isRtl
                  ? "اضغط على قائمة خيارات المتصفح (⋮ أو أيقونة ⊕ في شريط العنوان)، ثم اختر 'تثبيت التطبيق' (Install App) أو 'إضافة إلى الشاشة الرئيسية'."
                  : "Tap your browser menu (⋮ or ⊕ in the address bar) and select 'Install app' or 'Add to Home screen'."}
              </p>
            </>
          )}
        </div>
      )}
    </div>
  );
}
