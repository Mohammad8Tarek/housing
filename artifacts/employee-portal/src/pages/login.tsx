import { useState, useEffect, useRef, useCallback } from "react";
import { useLocation } from "wouter";
import {
  Loader2,
  Moon,
  Sun,
  Languages,
  Fingerprint,
  AlertCircle,
  Check,
  ArrowRight,
  Eye,
  EyeOff,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch, saveSessionId, setCachedSessionId } from "../lib/api";
import { useBiometric } from "../hooks/useBiometric";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import PWAInstallBanner from "../components/PWAInstallBanner";
import MaterialIcon from "../components/MaterialIcon";
import { MotionButton } from "../components/motion-primitives";
import { LoginSignatureTransition } from "../components/PageTransition";
import { hapticFeedback } from "../lib/haptics";
import { toast } from "sonner";

const isNative = Capacitor.isNativePlatform();

export default function Login() {
  const [, setLocation] = useLocation();
  const { t, lang, toggleLang, toggleTheme, theme } = useTheme();
  const isRtl = lang === "ar";
  const [employeeId, setEmployeeId] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [showSignature, setShowSignature] = useState(false);
  const [error, setError] = useState("");
  const [checkingSession, setCheckingSession] = useState(true);
  const [rememberMe, setRememberMe] = useState(true);
  const [useFingerprint, setUseFingerprint] = useState(false);
  const [showBiometricBtn, setShowBiometricBtn] = useState(false);
  const biometric = useBiometric();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadCheckboxDefaults = useCallback(async () => {
    if (!isNative) return;
    try {
      const { value: rm } = await Preferences.get({ key: "login_remember_me" });
      const { value: uf } = await Preferences.get({
        key: "login_use_fingerprint",
      });
      if (rm !== null) setRememberMe(rm === "true");
      if (uf !== null) setUseFingerprint(uf === "true");
    } catch {}
  }, []);

  const checkSavedSession = useCallback(async () => {
    try {
      if (isNative) {
        const { value: empJson } = await Preferences.get({
          key: "portal_employee",
        });
        if (!empJson) {
          setCheckingSession(false);
          return;
        }
        sessionStorage.setItem("portal_employee", empJson);
        const { value: sid } = await Preferences.get({ key: "session_id" });
        if (sid) sessionStorage.setItem("session_id", sid);
      } else {
        if (!sessionStorage.getItem("portal_employee")) {
          setCheckingSession(false);
          return;
        }
      }
      const res = await apiFetch("/api/portal-auth/me");
      if (res.ok) {
        setLocation("/dashboard");
        return;
      }
      sessionStorage.removeItem("portal_employee");
      if (isNative) await Preferences.remove({ key: "portal_employee" });
    } catch {}
    setCheckingSession(false);
  }, [setLocation]);

  useEffect(() => {
    checkSavedSession();
    loadCheckboxDefaults();
  }, [checkSavedSession, loadCheckboxDefaults]);

  const doLogin = useCallback(
    async (empId: string, pass: string) => {
      const res = await apiFetch("/api/portal-auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ employeeId: empId, password: pass }),
      });
      await saveSessionId(res);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("login.failed"));
      const empJson = JSON.stringify(data.employee);
      sessionStorage.setItem("portal_employee", empJson);
      if (isNative) {
        await Preferences.set({ key: "portal_employee", value: empJson });
      }
      if (data.sessionId && isNative) {
        await Preferences.set({ key: "session_id", value: data.sessionId });
        sessionStorage.setItem("session_id", data.sessionId);
        setCachedSessionId(data.sessionId);
      }
      return data;
    },
    [t],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      setError(
        isRtl
          ? "يرجى إدخال معرف الموظف وكلمة المرور"
          : "Please enter your employee ID and password",
      );
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await doLogin(employeeId, password);
      if (isNative) {
        await Preferences.set({
          key: "login_remember_me",
          value: String(rememberMe),
        });
        await Preferences.set({
          key: "login_use_fingerprint",
          value: String(useFingerprint),
        });
        if (useFingerprint && biometric.isAvailable) {
          await biometric.saveCredentials(employeeId, password);
        } else {
          await biometric.deleteCredentials();
        }
        if (!rememberMe) {
          await Preferences.remove({ key: "portal_employee" });
          await Preferences.remove({ key: "session_id" });
        }
      }
      if (data.mustChangePassword) {
        await hapticFeedback("medium");
        toast.success(
          isRtl ? "تم تسجيل الدخول بنجاح" : "Signed in successfully",
        );
        setShowSignature(true);
      } else {
        await hapticFeedback("medium");
        toast.success(
          isRtl ? "تم تسجيل الدخول بنجاح" : "Signed in successfully",
        );
        setShowSignature(true);
      }
    } catch (err: unknown) {
      await hapticFeedback("heavy");
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupportAction = (type: "password" | "access") => {
    const email = "hr-support@sunrise-resorts.com";
    const subject =
      type === "password"
        ? isRtl
          ? "طلب إعادة تعيين كلمة المرور"
          : "Password reset request"
        : isRtl
          ? "طلب دخول للبوابة"
          : "Portal access request";
    const body =
      type === "password"
        ? isRtl
          ? "أرغب في إعادة تعيين كلمة المرور الخاصة بي للبوابة."
          : "I would like to reset my portal password."
        : isRtl
          ? "أرغب في الحصول على صلاحيات الوصول إلى البوابة."
          : "I would like to request access to the portal.";
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const success = await biometric.authenticate(
        isRtl ? "سجّل الدخول بالبصمة" : "Login with fingerprint",
      );
      if (!success) {
        setError(isRtl ? "تم الإلغاء" : "Cancelled");
        setIsLoading(false);
        return;
      }
      const creds = await biometric.getCredentials();
      if (!creds) {
        setError(
          isRtl
            ? "لا توجد بيانات محفوظة. سجّل الدخول يدوياً أولاً"
            : "No saved credentials. Login manually first.",
        );
        setIsLoading(false);
        return;
      }
      const data = await doLogin(creds.username, creds.password);
      if (data.mustChangePassword) setLocation("/change-password");
      else setLocation("/dashboard");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (biometric.isAvailable) {
      biometric.getCredentials().then((creds) => {
        setShowBiometricBtn(!!creds);
      });
    }
  }, [biometric]);

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-surface2 flex items-center justify-center p-4">
        <div className="w-full max-w-[420px]">
          <div className="bg-card border border-border2 rounded-[20px] sm:rounded-[24px] p-6 sm:p-8 shadow-2xl">
            <div className="flex items-center gap-3 mb-8">
              <div className="w-12 h-12 rounded-[14px] bg-surface animate-pulse" />
              <div className="space-y-2">
                <div className="w-32 h-4 bg-surface rounded animate-pulse" />
                <div className="w-20 h-3 bg-surface rounded animate-pulse" />
              </div>
            </div>
            <div className="space-y-4">
              <div className="w-24 h-4 bg-surface rounded animate-pulse" />
              <div className="h-12 bg-surface rounded-xl animate-pulse" />
              <div className="w-20 h-4 bg-surface rounded animate-pulse" />
              <div className="h-12 bg-surface rounded-xl animate-pulse" />
              <div className="h-12 bg-accent2/30 rounded-xl animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-[#F9F9FF] dark:bg-[#12131C] flex flex-col relative overflow-hidden">
      {/* Full-screen resort sunset background */}
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-[0.12] dark:opacity-[0.06]"
          style={{
            backgroundImage:
              "url('https://lh3.googleusercontent.com/aida-public/AB6AXuAWBy0tJ-YKL-w3M1sWj91-bCQmW_v8KCFDhlPc5RXyJqPS74oQRfTxygbk9vXui1xNuwBjHKREk1E13VgshPJPSRabiktxIsXndvqhRAYvBqK2qdyb8d3_zXsNCVA3YD2IHFJn6NEHza_sSeF2fiokNl-n2MZRp_Bd5n_YnKFMIcSAPaufLyFfI0iKRf6mLvyXSD6ulFkMi1UZ7IMugrXpRN7Fag3NrLK73kM8xzfBtEqaK_FxHbrlWVTf1Ow7uBxKCV_BLVsALjs')",
            filter: "blur(2px)",
          }}
        />
        <div className="absolute top-0 start-0 w-full h-48 bg-gradient-to-b from-[#1A2B4C]/10 to-transparent dark:from-[#1A2B4C]/20" />
        <div className="absolute top-1/3 end-1/4 w-80 h-80 bg-[#C9A24D] opacity-[0.05] dark:opacity-[0.08] blur-[150px] rounded-full" />
      </div>

      {/* Language/Theme toggles (fixed top-right) */}
      <div
        className="fixed top-4 end-4 z-50 flex items-center gap-2"
        style={{ paddingTop: "env(safe-area-inset-top)" }}
      >
        <button
          onClick={toggleLang}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-card border border-[#E5E7EB] dark:border-border2 text-muted2 hover:text-foreground transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
          title={t("theme.language")}
        >
          <Languages className="w-4 h-4" />
        </button>
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-white/80 dark:bg-card border border-[#E5E7EB] dark:border-border2 text-muted2 hover:text-foreground transition-all hover:scale-105 active:scale-95 backdrop-blur-sm"
          title={t("theme.theme")}
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>

      {/* Stitch-style top bar: menu | SUNRISE | account_circle */}
      <div
        className="relative z-10 flex items-center justify-between px-4 pt-4 pb-2"
        style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
      >
        <MaterialIcon
          icon="menu"
          size={24}
          className="text-[#1A2B4C] dark:text-white/80"
        />
        <h1
          className="text-lg font-bold tracking-[0.12em] text-[#1A2B4C] dark:text-white"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          SUNRISE
        </h1>
        <MaterialIcon
          icon="account_circle"
          size={24}
          className="text-[#1A2B4C] dark:text-white/80"
        />
      </div>

      {/* Feature highlight decorative element */}
      <div className="relative z-10 flex justify-center mt-1 mb-2">
        <MaterialIcon
          icon="feature_highlight"
          size={32}
          className="text-accent2/30"
          fill
        />
      </div>

      {/* Main content - centered */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-4 pb-6">
        <div className="w-full max-w-[400px]">
          {/* Login Card */}
          <div className="bg-white dark:bg-card border border-[#E5E7EB] dark:border-border2 rounded-2xl p-6 sm:p-7 shadow-[0_4px_24px_-4px_rgba(26,43,76,0.08)] dark:shadow-[0_4px_24px_-4px_rgba(0,0,0,0.3)] login-card-enter">
            <h2
              className="text-lg font-bold text-[#1A2B4C] dark:text-foreground mb-1"
              style={{ fontFamily: "'Playfair Display', serif" }}
            >
              {lang === "ar" ? "تسجيل دخول الموظفين" : "Employee Login"}
            </h2>
            <p className="text-[13px] text-[#6B7280] dark:text-muted2 mb-6">
              {lang === "ar"
                ? "مرحباً بك في مساحة عملك الآمنة"
                : "Welcome to your secure workspace."}
            </p>

            {error && (
              <div className="mb-4 p-3 bg-red-50 dark:bg-destructive/10 border border-red-200 dark:border-destructive/30 text-red-600 dark:text-destructive text-sm rounded-xl flex items-center gap-2 animate-[fadeIn_0.2s_ease]">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-4">
              {/* Employee ID */}
              <div>
                <label
                  htmlFor="employeeId"
                  className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-muted2 block mb-1.5"
                >
                  {lang === "ar" ? "معرف الموظف" : "Employee ID"}
                </label>
                <div className="relative">
                  <input
                    ref={inputRef}
                    id="employeeId"
                    name="employeeId"
                    autoComplete="username"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder={t("login.employeeIdPlaceholder")}
                    className="w-full bg-[#F9FAFB] dark:bg-surface border border-[#E5E7EB] dark:border-border2 text-[#111827] dark:text-foreground rounded-xl py-3 ps-10 pe-4 focus:border-[#C9A24D] focus:ring-2 focus:ring-[#C9A24D]/20 outline-none transition-all text-[15px]"
                    required
                    disabled={isLoading}
                  />
                  <span className="absolute start-3 top-1/2 -translate-y-1/2 text-[#9CA3AF] dark:text-muted2 pointer-events-none flex">
                    <MaterialIcon icon="badge" size={18} />
                  </span>
                </div>
              </div>

              {/* Password */}
              <div>
                <label
                  htmlFor="password"
                  className="text-[11px] font-semibold uppercase tracking-wider text-[#6B7280] dark:text-muted2 block mb-1.5"
                >
                  {lang === "ar" ? "كلمة المرور" : "Password"}
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    autoComplete="off"
                    type={showPassword ? "text" : "password"}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholder")}
                    className="w-full bg-[#F9FAFB] dark:bg-surface border border-[#E5E7EB] dark:border-border2 text-[#111827] dark:text-foreground rounded-xl py-3 px-4 pe-11 focus:border-[#C9A24D] focus:ring-2 focus:ring-[#C9A24D]/20 outline-none transition-all text-[15px]"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute ${isRtl ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-[#9CA3AF] hover:text-[#4B5563] dark:text-muted2 dark:hover:text-foreground transition-colors p-1.5`}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me + Forgot Password */}
              <div className="flex items-center justify-between">
                {isNative && (
                  <label className="flex items-center gap-2 cursor-pointer select-none group">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div
                        className={`w-4 h-4 rounded border-2 transition-all flex items-center justify-center ${
                          rememberMe
                            ? "border-[#C9A24D] bg-[#C9A24D]"
                            : "border-[#D1D5DB] dark:border-border2"
                        }`}
                      >
                        {rememberMe && (
                          <Check
                            className="w-2.5 h-2.5 text-white"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-[#6B7280] dark:text-muted2 group-hover:text-[#C9A24D] transition-colors">
                      {lang === "ar" ? "تذكرني" : "Remember me"}
                    </span>
                  </label>
                )}
                {!isNative && <div />}
                <button
                  type="button"
                  onClick={() => handleSupportAction("password")}
                  className="text-xs text-[#C9A24D] hover:text-[#B8922E] dark:text-[#C9A24D] dark:hover:text-[#D9B36A] font-medium transition-colors"
                >
                  {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                </button>
              </div>

              {/* Sign In Button */}
              <MotionButton
                type="submit"
                withTap
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#C9A24D] to-[#D9B36A] text-white font-bold py-3.5 rounded-xl hover:from-[#B8922E] hover:to-[#C9A24D] transition-all disabled:opacity-50 disabled:hover:from-[#C9A24D] disabled:hover:to-[#D9B36A] flex items-center justify-center gap-2 shadow-lg shadow-[#C9A24D]/20"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    {lang === "ar" ? "جاري التسجيل..." : "Signing in..."}
                  </>
                ) : (
                  <>
                    <span>{lang === "ar" ? "تسجيل الدخول" : "Sign In"}</span>
                    <MaterialIcon
                      icon="arrow_forward"
                      size={18}
                      className={isRtl ? "rotate-180" : ""}
                    />
                  </>
                )}
              </MotionButton>
            </form>

            {/* Biometric */}
            {isNative && useFingerprint && biometric.isAvailable && (
              <div className="mt-4">
                <div className="relative my-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-[#E5E7EB] dark:border-border2" />
                  </div>
                  <div className="relative flex justify-center text-[11px]">
                    <span className="bg-white dark:bg-card px-3 text-[#9CA3AF] dark:text-muted2 uppercase tracking-wider">
                      {lang === "ar" ? "أو" : "OR"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={isLoading}
                  className="w-full border-2 border-[#C9A24D]/30 text-[#C9A24D] font-bold py-3.5 rounded-xl hover:bg-[#C9A24D]/10 active:scale-[0.98] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5" />
                  )}
                  {lang === "ar" ? "الدخول بالبصمة" : "Login with Fingerprint"}
                </button>
              </div>
            )}

            {/* Request Access */}
            <div className="text-center mt-5">
              <p className="text-xs text-[#9CA3AF] dark:text-muted2">
                {lang === "ar" ? "ليس لديك حساب؟" : "Don't have an account?"}{" "}
                <button
                  type="button"
                  onClick={() => handleSupportAction("access")}
                  className="text-[#C9A24D] hover:text-[#B8922E] font-medium transition-colors"
                >
                  {lang === "ar" ? "طلب دخول" : "Request Access"}
                </button>
              </p>
            </div>
          </div>

          {/* Secure Portal Badge */}
          <div className="flex items-center justify-center gap-1.5 mt-5 text-[11px] text-[#9CA3AF] dark:text-muted2">
            <MaterialIcon
              icon="verified_user"
              size={14}
              className="text-[#9CA3AF] dark:text-muted2"
            />
            <span className="font-medium">
              {lang === "ar" ? "بوابة آمنة" : "Secure Portal"}
            </span>
            <span className="w-1 h-1 rounded-full bg-[#D1D5DB] dark:bg-border2 mx-1" />
            <MaterialIcon
              icon="lock_reset"
              size={13}
              className="text-[#9CA3AF] dark:text-muted2"
            />
            <span>256-bit SSL</span>
          </div>

          {/* Footer */}
          <p className="text-center text-[10px] text-[#9CA3AF] dark:text-muted2 mt-2">
            &copy; {new Date().getFullYear()}{" "}
            {lang === "ar"
              ? "صَن رايز ريزورتس. جميع الحقوق محفوظة."
              : "Sunrise Resorts & Cruises. All rights reserved."}
          </p>
          <p className="text-center text-[10px] text-[#9CA3AF] dark:text-muted2 mt-0.5">
            {lang === "ar"
              ? "مدعوم من صن رايز للموارد البشرية"
              : "Powered by Sunrise HR"}
          </p>

          {!isNative && <PWAInstallBanner />}
        </div>
      </div>
      <LoginSignatureTransition
        show={showSignature}
        onComplete={() => {
          setShowSignature(false);
          setLocation("/dashboard");
        }}
      />
    </div>
  );
}
