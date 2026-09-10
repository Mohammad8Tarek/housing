import { useEffect, useState } from "react";
import { Fingerprint, Loader2, ShieldAlert } from "lucide-react";
import { useBiometric } from "../hooks/useBiometric";
import { useTheme } from "../lib/theme";

interface BiometricLockScreenProps {
  onUnlocked: () => void;
  onFailed: () => void;
}

export default function BiometricLockScreen({ onUnlocked, onFailed }: BiometricLockScreenProps) {
  const { lang } = useTheme();
  const ar = lang === "ar";
  const biometric = useBiometric();
  const [status, setStatus] = useState<"idle" | "checking" | "failed">("idle");
  const [attempts, setAttempts] = useState(0);
  const MAX_ATTEMPTS = 3;

  const runBiometric = async () => {
    setStatus("checking");
    const success = await biometric.authenticate(
      ar ? "تحقق من هويتك للمتابعة" : "Verify your identity to continue"
    );
    if (success) {
      onUnlocked();
    } else {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_ATTEMPTS) {
        onFailed();
      } else {
        setStatus("failed");
      }
    }
  };

  useEffect(() => {
    // Auto-trigger on mount after short delay
    const timer = setTimeout(() => {
      runBiometric();
    }, 400);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-[#0c0e14]"
      style={{ paddingBottom: "env(safe-area-inset-bottom, 0px)" }}
    >
      {/* Logo area */}
      <div className="flex flex-col items-center gap-2 mb-12">
        <div className="w-20 h-20 rounded-[22px] bg-[#18B0BB]/10 border border-[#18B0BB]/30 flex items-center justify-center mb-2">
          <svg viewBox="0 0 100 100" width="52" height="52" fill="none">
            {/* Sunrise icon */}
            <circle cx="50" cy="52" r="22" fill="#18B0BB" opacity="0.9" />
            <line x1="15" y1="70" x2="85" y2="70" stroke="#18B0BB" strokeWidth="3.5" strokeLinecap="round" />
            <path d="M50 30 Q50 10 72 22" stroke="#18B0BB" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
            <path d="M50 30 Q50 10 28 22" stroke="#18B0BB" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
          </svg>
        </div>
        <p className="text-white/90 text-xl font-bold tracking-widest uppercase">SUNRISE</p>
        <p className="text-white/50 text-xs tracking-wider">
          {ar ? "بوابة المقيمين" : "Resident Portal"}
        </p>
      </div>

      {/* Lock status */}
      <div className="flex flex-col items-center gap-6">
        {status === "checking" ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-12 h-12 text-[#18B0BB] animate-spin" />
            <p className="text-white/60 text-sm">
              {ar ? "جاري التحقق..." : "Verifying..."}
            </p>
          </div>
        ) : status === "failed" ? (
          <div className="flex flex-col items-center gap-4">
            <ShieldAlert className="w-12 h-12 text-red-400" />
            <p className="text-red-300 text-sm text-center px-8">
              {ar
                ? `فشل التحقق. المحاولات المتبقية: ${MAX_ATTEMPTS - attempts}`
                : `Verification failed. ${MAX_ATTEMPTS - attempts} attempts left`}
            </p>
            <button
              onClick={runBiometric}
              className="mt-2 px-8 py-3 rounded-2xl bg-[#18B0BB]/20 border border-[#18B0BB]/40 text-[#18B0BB] font-medium text-sm flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Fingerprint className="w-4 h-4" />
              {ar ? "إعادة المحاولة" : "Try Again"}
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#18B0BB]/10 border border-[#18B0BB]/30 flex items-center justify-center">
              <Fingerprint className="w-8 h-8 text-[#18B0BB]" />
            </div>
            <p className="text-white/60 text-sm text-center px-8">
              {ar ? "استخدم البصمة لإلغاء القفل" : "Use fingerprint to unlock"}
            </p>
            <button
              onClick={runBiometric}
              className="mt-1 px-8 py-3 rounded-2xl bg-[#18B0BB]/20 border border-[#18B0BB]/40 text-[#18B0BB] font-medium text-sm flex items-center gap-2 active:scale-95 transition-transform"
            >
              <Fingerprint className="w-4 h-4" />
              {ar ? "فتح بالبصمة" : "Unlock with Biometrics"}
            </button>
          </div>
        )}
      </div>

      {/* Use password fallback */}
      <button
        onClick={onFailed}
        className="absolute bottom-12 text-white/30 text-xs underline underline-offset-2"
      >
        {ar ? "تسجيل الدخول بكلمة المرور" : "Sign in with password"}
      </button>
    </div>
  );
}
