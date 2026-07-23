/**
 * PWAInstallBanner.tsx
 * يعرض بانر تحميل التطبيق على Android/iOS بشكل ذكي
 * - على Android: يستخدم beforeinstallprompt event
 * - على iOS: يعرض تعليمات إضافة للشاشة الرئيسية
 */
import { useState, useEffect } from "react";
import { Download, X, Share, PlusSquare, Smartphone } from "lucide-react";
import { useTheme } from "../lib/theme";

function isIOS(): boolean {
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

function isInStandaloneMode(): boolean {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (window.navigator as any).standalone === true
  );
}

export default function PWAInstallBanner() {
  const { lang } = useTheme();
  const isRtl = lang === "ar";
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [showIOSGuide, setShowIOSGuide] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [installed, setInstalled] = useState(false);

  useEffect(() => {
    // If already installed as PWA or dismissed before, don't show
    if (isInStandaloneMode()) {
      setInstalled(true);
      return;
    }
    const wasDismissed = sessionStorage.getItem("pwa_banner_dismissed");
    if (wasDismissed) {
      setDismissed(true);
      return;
    }

    // Android: capture beforeinstallprompt
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);

    // iOS: check if we should show guide
    if (isIOS() && !isInStandaloneMode()) {
      setShowIOSGuide(true);
    }

    window.addEventListener("appinstalled", () => {
      setInstalled(true);
      setInstallPrompt(null);
    });

    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleAndroidInstall = async () => {
    if (!installPrompt) return;
    installPrompt.prompt();
    const result = await installPrompt.userChoice;
    if (result.outcome === "accepted") {
      setInstallPrompt(null);
      setInstalled(true);
    }
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem("pwa_banner_dismissed", "1");
  };

  // Don't show if installed, dismissed, or nothing to show
  if (installed || dismissed) return null;
  if (!installPrompt && !showIOSGuide) return null;

  // iOS Guide
  if (showIOSGuide && !installPrompt) {
    return (
      <div className="mt-4 p-4 bg-surface border border-border2 rounded-2xl relative animate-[fadeIn_0.3s_ease]">
        <button
          onClick={handleDismiss}
          className="absolute top-3 end-3 p-1 text-muted2 hover:text-foreground transition-colors"
          aria-label="Close"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="flex items-center gap-2 mb-3">
          <div className="w-8 h-8 rounded-xl bg-accent2/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="w-4 h-4 text-accent2" />
          </div>
          <span className="text-sm font-bold text-foreground">
            {isRtl ? "أضف التطبيق للشاشة الرئيسية" : "Add App to Home Screen"}
          </span>
        </div>
        <div className="space-y-2">
          <div className="flex items-center gap-2 text-xs text-muted2">
            <Share className="w-3.5 h-3.5 text-accent2 flex-shrink-0" />
            <span>
              {isRtl ? "اضغط على زر المشاركة" : "Tap the Share button"}
            </span>
            <span className="text-[10px] opacity-60">
              {isRtl ? "(⬆ في الأسفل)" : "(⬆ at the bottom)"}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted2">
            <PlusSquare className="w-3.5 h-3.5 text-accent2 flex-shrink-0" />
            <span>
              {isRtl
                ? 'اختر "إضافة إلى الشاشة الرئيسية"'
                : '"Add to Home Screen"'}
            </span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted2">
            <div className="w-3.5 h-3.5 rounded-sm bg-accent2/20 flex items-center justify-center flex-shrink-0">
              <span className="text-[8px] text-accent2 font-bold">✓</span>
            </div>
            <span>
              {isRtl
                ? "اضغط إضافة وستظهر في الشاشة الرئيسية"
                : "Tap Add — the app will appear on your home screen"}
            </span>
          </div>
        </div>
      </div>
    );
  }

  // Android Install Banner
  return (
    <div className="mt-4 p-4 bg-surface border border-accent2/20 rounded-2xl relative animate-[fadeIn_0.3s_ease] overflow-hidden">
      {/* Glow effect */}
      <div className="absolute inset-0 bg-gradient-to-r from-accent2/5 to-transparent pointer-events-none" />

      <button
        onClick={handleDismiss}
        className="absolute top-3 end-3 p-1 text-muted2 hover:text-foreground transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="flex items-center gap-3 relative">
        <div className="w-10 h-10 rounded-xl bg-accent2 flex items-center justify-center flex-shrink-0 shadow-lg shadow-accent2/30">
          <Download className="w-5 h-5 text-white" />
        </div>
        <div className="flex-1 min-w-0 pr-6">
          <p className="text-sm font-bold text-foreground">
            {isRtl
              ? "حمّل تطبيق بوابة الموظفين"
              : "Install Employee Portal App"}
          </p>
          <p className="text-xs text-muted2 mt-0.5">
            {isRtl
              ? "تجربة أفضل وأسرع بدون متصفح"
              : "Faster experience without browser"}
          </p>
        </div>
      </div>

      <button
        onClick={handleAndroidInstall}
        className="w-full mt-3 py-2.5 rounded-xl bg-accent2 text-accent2-foreground text-sm font-bold hover:opacity-90 transition-all active:scale-[0.98] flex items-center justify-center gap-2"
      >
        <Download className="w-4 h-4" />
        {isRtl ? "تثبيت التطبيق الآن" : "Install App Now"}
      </button>
    </div>
  );
}
