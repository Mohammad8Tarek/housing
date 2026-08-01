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
    <div className="min-h-dvh flex relative overflow-hidden bg-black selection:bg-[#C9A24D]/30">
      {/* Background Image with Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[10s] ease-out scale-105"
          style={{
            backgroundImage:
              "url('https://images.unsplash.com/photo-1571896349842-33c89424de2d?q=80&w=2960&auto=format&fit=crop')",
          }}
        />
        {/* Gradient overlay for readability */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/40 to-black/60 dark:from-black/90 dark:via-black/60 dark:to-black/80" />
      </div>

      {/* Top Navigation */}
      <div
        className="absolute top-0 inset-x-0 z-50 flex items-center justify-between px-6 py-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 16px))" }}
      >
        <h1
          className="text-2xl font-bold tracking-[0.15em] text-white"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          SUNRISE
        </h1>
        <div className="flex items-center gap-3">
          <button
            onClick={toggleLang}
            className="w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all backdrop-blur-md"
            title={t("theme.language")}
          >
            <Languages className="w-4 h-4" />
          </button>
          <button
            onClick={toggleTheme}
            className="w-10 h-10 rounded-full bg-white/10 border border-white/20 text-white flex items-center justify-center hover:bg-white/20 transition-all backdrop-blur-md"
            title={t("theme.theme")}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4" />
            ) : (
              <Moon className="w-4 h-4" />
            )}
          </button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="relative z-10 flex-1 flex items-center justify-center px-5 sm:px-8 pt-20 pb-10 w-full md:w-[450px] md:mx-auto lg:mx-0 lg:ms-auto lg:me-32">
        <div className="w-full max-w-[420px] animate-[slideUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
          {/* Glassmorphic Login Card */}
          <div className="bg-white/10 dark:bg-[#12131C]/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[28px] p-7 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold text-white mb-2">
                {lang === "ar" ? "تسجيل الدخول" : "Welcome Back"}
              </h2>
              <p className="text-[14px] text-white/70">
                {lang === "ar"
                  ? "سجّل الدخول للوصول إلى مساحة عملك"
                  : "Sign in to access your secure workspace"}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-[13px] rounded-2xl flex gap-3 items-start animate-[fadeIn_0.3s_ease]">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            <form onSubmit={handleLogin} className="space-y-5">
              {/* Employee ID */}
              <div className="space-y-1.5">
                <label
                  htmlFor="employeeId"
                  className="text-[12px] font-medium text-white/80 ms-1"
                >
                  {lang === "ar" ? "معرف الموظف" : "Employee ID"}
                </label>
                <div className="relative group">
                  <input
                    ref={inputRef}
                    id="employeeId"
                    name="employeeId"
                    autoComplete="username"
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder={t("login.employeeIdPlaceholder")}
                    className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 ps-11 pe-4 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30"
                    required
                    disabled={isLoading}
                  />
                  <span className="absolute start-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#C9A24D] transition-colors">
                    <MaterialIcon icon="person" size={20} />
                  </span>
                </div>
              </div>

              {/* Password */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between ms-1 mb-1.5">
                  <label
                    htmlFor="password"
                    className="text-[12px] font-medium text-white/80"
                  >
                    {lang === "ar" ? "كلمة المرور" : "Password"}
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSupportAction("password")}
                    className="text-[11px] text-[#C9A24D] hover:text-[#E2C37A] font-medium transition-colors"
                  >
                    {lang === "ar" ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                  </button>
                </div>
                <div className="relative group">
                  <input
                    id="password"
                    name="password"
                    autoComplete="off"
                    type={showPassword ? "text" : "password"}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={t("login.passwordPlaceholder")}
                    className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 px-11 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30"
                    required
                    disabled={isLoading}
                  />
                  <span className="absolute start-4 top-1/2 -translate-y-1/2 text-white/40 group-focus-within:text-[#C9A24D] transition-colors">
                    <MaterialIcon icon="lock" size={20} />
                  </span>
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className={`absolute ${isRtl ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {/* Remember me */}
              {isNative && (
                <div className="pt-1">
                  <label className="flex items-center gap-3 cursor-pointer select-none group w-max">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={rememberMe}
                        onChange={(e) => setRememberMe(e.target.checked)}
                        className="peer sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-md border transition-all flex items-center justify-center ${
                          rememberMe
                            ? "border-[#C9A24D] bg-[#C9A24D]"
                            : "border-white/30 bg-black/20"
                        }`}
                      >
                        {rememberMe && (
                          <Check
                            className="w-3.5 h-3.5 text-black"
                            strokeWidth={3}
                          />
                        )}
                      </div>
                    </div>
                    <span className="text-[13px] text-white/70 group-hover:text-white transition-colors">
                      {lang === "ar" ? "تذكرني" : "Remember my login"}
                    </span>
                  </label>
                </div>
              )}

              {/* Sign In Button */}
              <MotionButton
                type="submit"
                withTap
                disabled={isLoading}
                className="w-full bg-gradient-to-r from-[#C9A24D] to-[#E2C37A] text-black font-semibold py-4 rounded-2xl hover:from-[#E2C37A] hover:to-[#C9A24D] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_4px_20px_rgba(201,162,77,0.3)] mt-2"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    {lang === "ar" ? "جاري التسجيل..." : "Authenticating..."}
                  </>
                ) : (
                  <>
                    <span className="text-[15px]">
                      {lang === "ar" ? "تسجيل الدخول" : "Sign In"}
                    </span>
                    <ArrowRight
                      className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`}
                    />
                  </>
                )}
              </MotionButton>
            </form>

            {/* Biometric */}
            {isNative && useFingerprint && biometric.isAvailable && (
              <div className="mt-6">
                <div className="relative mb-6">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#12131C] px-3 text-[11px] text-white/40 uppercase tracking-wider rounded-full backdrop-blur-md border border-white/5">
                      {lang === "ar" ? "أو" : "Or continue with"}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={isLoading}
                  className="w-full bg-white/5 border border-white/10 text-white font-medium py-3.5 rounded-2xl hover:bg-white/10 active:bg-white/5 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <Fingerprint className="w-5 h-5 text-[#C9A24D]" />
                  )}
                  {lang === "ar" ? "الدخول بالبصمة" : "Face ID / Touch ID"}
                </button>
              </div>
            )}
          </div>

          {/* Secure Portal Badge & Footer */}
          <div className="mt-8 text-center space-y-3">
            <div className="inline-flex items-center justify-center gap-2 py-1.5 px-4 rounded-full bg-black/40 border border-white/5 backdrop-blur-md text-[11px] text-white/60">
              <MaterialIcon
                icon="security"
                size={14}
                className="text-white/40"
              />
              <span>
                {lang === "ar"
                  ? "بوابة آمنة ومدعومة"
                  : "Secure Employee Portal"}
              </span>
            </div>
            <p className="text-[11px] text-white/40">
              &copy; {new Date().getFullYear()}{" "}
              {lang === "ar"
                ? "صَن رايز ريزورتس. جميع الحقوق محفوظة."
                : "Sunrise Resorts & Cruises."}
            </p>
          </div>

          {!isNative && (
            <div className="mt-4">
              <PWAInstallBanner />
            </div>
          )}
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
