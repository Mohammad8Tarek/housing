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
  User,
  Lock,
  ShieldCheck,
  Sparkles,
  HelpCircle,
  X,
  Wrench,
  Home,
  MessageSquare,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch, saveSessionId, setCachedSessionId, clearSessionCache } from "../lib/api";
import { useBiometric } from "../hooks/useBiometric";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import PWAInstallBanner from "../components/PWAInstallBanner";
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
  const [useFingerprint, setUseFingerprint] = useState(true);
  const [showBiometricBtn, setShowBiometricBtn] = useState(false);
  const [showDefaultPwHint, setShowDefaultPwHint] = useState(false);
  const biometric = useBiometric();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const loadCheckboxDefaults = useCallback(async () => {
    try {
      if (isNative) {
        const { value: rm } = await Preferences.get({ key: "login_remember_me" });
        const { value: uf } = await Preferences.get({ key: "login_use_fingerprint" });
        if (rm !== null) setRememberMe(rm === "true");
        if (uf !== null) setUseFingerprint(uf === "true");
        else setUseFingerprint(true);
      } else {
        const rm = localStorage.getItem("login_remember_me");
        if (rm !== null) setRememberMe(rm === "true");
        const savedEmpId = localStorage.getItem("saved_portal_employee_id");
        if (savedEmpId) setEmployeeId(savedEmpId);
      }
    } catch {}
  }, []);

  const checkSavedSession = useCallback(async () => {
    try {
      if (isNative) {
        const { value: sessionOnly } = await Preferences.get({ key: "login_session_only" });
        if (sessionOnly === "true") {
          await Preferences.remove({ key: "portal_employee" });
          await Preferences.remove({ key: "session_id" });
          await Preferences.remove({ key: "login_session_only" });
          clearSessionCache();
          setCheckingSession(false);
          return;
        }
        const { value: empJson } = await Preferences.get({ key: "portal_employee" });
        if (!empJson) {
          setCheckingSession(false);
          return;
        }
        sessionStorage.setItem("portal_employee", empJson);
        const { value: sid } = await Preferences.get({ key: "session_id" });
        if (sid) {
          sessionStorage.setItem("session_id", sid);
          setCachedSessionId(sid);
        }
        setLocation("/dashboard");
        return;
      } else {
        const empJson =
          sessionStorage.getItem("portal_employee") ||
          localStorage.getItem("portal_employee");
        if (!empJson) {
          setCheckingSession(false);
          return;
        }
        sessionStorage.setItem("portal_employee", empJson);
        const sid =
          sessionStorage.getItem("session_id") ||
          localStorage.getItem("session_id");
        if (sid) {
          sessionStorage.setItem("session_id", sid);
          setCachedSessionId(sid);
        }
        setLocation("/dashboard");
        return;
      }
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
        body: JSON.stringify({
          profileId: empId.trim(),
          employeeId: empId.trim(),
          password: pass,
        }),
      });
      await saveSessionId(res);
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || t("login.failed"));
      const empObj = data.employee || data.profile || { profileId: empId.trim() };
      const empJson = JSON.stringify(empObj);
      sessionStorage.setItem("portal_employee", empJson);
      if (rememberMe) {
        localStorage.setItem("portal_employee", empJson);
      } else {
        localStorage.removeItem("portal_employee");
      }
      if (isNative) {
        await Preferences.set({ key: "portal_employee", value: empJson });
      }
      if (data.sessionId) {
        sessionStorage.setItem("session_id", data.sessionId);
        if (rememberMe) {
          localStorage.setItem("session_id", data.sessionId);
        } else {
          localStorage.removeItem("session_id");
        }
        setCachedSessionId(data.sessionId);
        if (isNative) {
          await Preferences.set({ key: "session_id", value: data.sessionId });
        }
      }
      return data;
    },
    [t, rememberMe],
  );

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!employeeId.trim() || !password.trim()) {
      setError(
        isRtl
          ? "يرجى إدخال كود الموظف أو رقم الإقامة وكلمة المرور"
          : "Please enter your employee ID and password",
      );
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const data = await doLogin(employeeId, password);

      // Save credentials for Web Credential Management API if available
      if (
        typeof window !== "undefined" &&
        "credentials" in navigator &&
        (window as any).PasswordCredential
      ) {
        try {
          const cred = new (window as any).PasswordCredential({
            id: employeeId.trim(),
            password: password,
            name: employeeId.trim(),
          });
          navigator.credentials.store(cred).catch(() => {});
        } catch {}
      }

      // Save remember-me state
      localStorage.setItem("login_remember_me", String(rememberMe));
      if (rememberMe) {
        localStorage.setItem("saved_portal_employee_id", employeeId.trim());
      } else {
        localStorage.removeItem("saved_portal_employee_id");
      }
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
          await biometric.saveCredentials(employeeId.trim(), password);
        } else if (!useFingerprint) {
          await biometric.deleteCredentials();
        }
        await Preferences.set({ key: "login_session_only", value: String(!rememberMe) });
      }

      await hapticFeedback("medium");
      toast.success(
        isRtl ? "أهلاً بك! تم تسجيل الدخول بنجاح" : "Welcome back! Signed in successfully",
      );

      if (data.mustChangePassword) {
        setLocation("/change-password");
      } else {
        setShowSignature(true);
      }
    } catch (err: unknown) {
      await hapticFeedback("heavy");
      const msg = err instanceof Error ? err.message : String(err);
      setError(msg);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSupportAction = (type: "password" | "access") => {
    if (type === "password") {
      setLocation("/forgot-password");
      return;
    }
    const email = "hr-support@sunrise-resorts.com";
    const subject = isRtl ? "طلب تفعيل دخول لبوابة سكن الموظفين" : "Housing Portal Access Request";
    const body = isRtl
      ? `أرغب في الحصول على صلاحيات الدخول للبوابة.\nمعرف الموظف: ${employeeId || "—"}`
      : `I would like to request access to the resident portal.\nEmployee ID: ${employeeId || "—"}`;
    window.location.href = `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  };

  const handleBiometricLogin = async () => {
    setIsLoading(true);
    setError("");
    try {
      const success = await biometric.authenticate(
        isRtl ? "تسجيل الدخول ببصمة الإصبع أو الوجه" : "Login with Fingerprint or Face ID",
      );
      if (!success) {
        setIsLoading(false);
        return;
      }
      const creds = await biometric.getCredentials();
      if (!creds) {
        setError(
          isRtl
            ? "لا توجد بيانات بيومترية مسجلة. يرجى تسجيل الدخول بكلمة المرور أولاً."
            : "No biometric credentials saved. Please sign in with password first.",
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
  }, [biometric.isAvailable, biometric.getCredentials]);

  if (checkingSession) {
    return (
      <div className="min-h-dvh bg-[#0d0f14] flex items-center justify-center p-4">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-[#C9A24D] to-[#F3DE9A] p-0.5 shadow-[0_0_30px_rgba(201,162,77,0.3)] animate-pulse">
            <div className="w-full h-full bg-[#0d0f14] rounded-[14px] flex items-center justify-center">
              <Sparkles className="w-8 h-8 text-[#C9A24D] animate-spin" />
            </div>
          </div>
          <div className="space-y-1">
            <h3 className="font-bold text-white text-lg tracking-wider">SUNRISE</h3>
            <p className="text-xs text-white/50">{isRtl ? "جاري التحقق من الجلسة..." : "Checking session..."}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh flex relative overflow-x-hidden bg-[#0A0B10] text-foreground selection:bg-[#C9A24D]/30">
      {/* Background Resort Image with Luxury Dark Gradient Overlay */}
      <div className="absolute inset-0 pointer-events-none z-0 overflow-hidden">
        <div
          className="absolute inset-0 bg-cover bg-center transition-transform duration-[12s] ease-out scale-105"
          style={{
            backgroundImage: "url('/resort-bg.jpg')",
          }}
        />
        {/* Multilayered Atmospheric Gradients for Perfect Contrast */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/95 via-black/80 to-black/90 dark:from-[#08090D]/95 dark:via-[#08090D]/85 dark:to-[#08090D]/95" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(201,162,77,0.15),transparent_60%)]" />
      </div>

      {/* Top Header Navigation */}
      <header
        className="absolute top-0 inset-x-0 z-50 flex items-center justify-between px-5 sm:px-10 py-4"
        style={{ paddingTop: "max(16px, env(safe-area-inset-top, 16px))" }}
      >
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#C9A24D] to-[#99772B] p-0.5 shadow-[0_4px_16px_rgba(201,162,77,0.3)]">
            <div className="w-full h-full bg-[#0D0F16] rounded-[10px] flex items-center justify-center">
              <span className="font-serif font-black text-transparent bg-clip-text bg-gradient-to-r from-[#F7E7B4] to-[#C9A24D] text-lg">
                S
              </span>
            </div>
          </div>
          <div>
            <span
              className="text-xl sm:text-2xl font-black tracking-[0.18em] text-white block leading-none font-serif"
            >
              SUNRISE
            </span>
            <span className="text-[10px] text-[#C9A24D] font-semibold tracking-wider uppercase block mt-1">
              {isRtl ? "بوابة المقيمين" : "Resident Portal"}
            </span>
          </div>
        </div>

        {/* Language & Theme Controls */}
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={toggleLang}
            className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-white flex items-center gap-1.5 transition-all backdrop-blur-md text-xs font-bold shadow-xs cursor-pointer"
            title={t("theme.language")}
          >
            <Languages className="w-4 h-4 text-[#C9A24D]" />
            <span>{lang === "ar" ? "EN" : "عربي"}</span>
          </button>

          <button
            type="button"
            onClick={toggleTheme}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/15 active:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all backdrop-blur-md shadow-xs cursor-pointer"
            title={t("theme.theme")}
          >
            {theme === "dark" ? (
              <Sun className="w-4 h-4 text-amber-300" />
            ) : (
              <Moon className="w-4 h-4 text-slate-200" />
            )}
          </button>
        </div>
      </header>

      {/* Main Responsive Grid Layout */}
      <main className="relative z-10 flex-1 grid grid-cols-1 lg:grid-cols-12 min-h-dvh pt-24 pb-10 px-4 sm:px-8 max-w-7xl mx-auto w-full items-center">
        {/* Left Side: Brand Welcome Hero (Visible on Desktop / Tablets) */}
        <section className="hidden lg:flex lg:col-span-7 flex-col justify-center pe-12 space-y-8 animate-[fadeIn_0.8s_ease]">
          <div className="space-y-4">
            <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 text-xs font-semibold text-[#E5CA85] backdrop-blur-md">
              <Sparkles className="w-3.5 h-3.5 text-[#C9A24D]" />
              <span>{isRtl ? "المنظومة السكنية الذكية الموحدة" : "Unified Smart Staff Housing Portal"}</span>
            </div>

            <h1 className="text-4xl xl:text-5xl font-extrabold text-white leading-[1.2] tracking-tight">
              {isRtl ? (
                <>
                  مرحباً بك في مجتمع <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F4DF9E] via-[#D8B45E] to-[#C9A24D]">
                    صن رايز للمنتجعات
                  </span>
                </>
              ) : (
                <>
                  Welcome to <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[#F4DF9E] via-[#D8B45E] to-[#C9A24D]">
                    SUNRISE Resorts
                  </span>{" "}
                  Living
                </>
              )}
            </h1>

            <p className="text-base text-white/70 max-w-lg leading-relaxed font-normal">
              {isRtl
                ? "بوابتك الرقمية الشاملة لمتابعة السكن، إرسال طلبات الصيانة والنظافة، تقييم جودة الخدمات، وإدارة الاستضافات بكل سهولة وسرعة."
                : "Your comprehensive digital workspace to manage housing accommodation, maintenance & housekeeping requests, service ratings, and guest passes."}
            </p>
          </div>

          {/* Feature Highlights Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-2">
            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2">
              <div className="w-9 h-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-[#C9A24D]">
                <Wrench className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">
                {isRtl ? "صيانة ونظافة فورية" : "Fast Service"}
              </h4>
              <p className="text-xs text-white/60 leading-normal">
                {isRtl ? "متابعة مسار طلباتك لحظة بلحظة مع التقييم" : "Instant order tracking and live feedback"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2">
              <div className="w-9 h-9 rounded-xl bg-blue-500/15 border border-blue-500/30 flex items-center justify-center text-blue-400">
                <Home className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">
                {isRtl ? "سكن واستضافات" : "Housing & Guests"}
              </h4>
              <p className="text-xs text-white/60 leading-normal">
                {isRtl ? "تصاريح الاستضافة وعهدة الغرف والنزلاء" : "Room inventory and guest pass permits"}
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md space-y-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
                <ShieldCheck className="w-5 h-5" />
              </div>
              <h4 className="font-bold text-sm text-white">
                {isRtl ? "أمان وخصوصية" : "Secure Access"}
              </h4>
              <p className="text-xs text-white/60 leading-normal">
                {isRtl ? "دخول بيومتري مشفر وحفظ آمن للبيانات" : "Encrypted biometric login & personal info"}
              </p>
            </div>
          </div>
        </section>

        {/* Right Side: Glassmorphic Login Card */}
        <section className="lg:col-span-5 flex flex-col justify-center items-center w-full max-w-[430px] mx-auto">
          <div className="w-full bg-[#12131A]/85 dark:bg-[#0E1017]/90 backdrop-blur-2xl border border-white/15 dark:border-white/10 rounded-[28px] p-6 sm:p-8 shadow-[0_16px_50px_rgba(0,0,0,0.6)] relative overflow-hidden">
            {/* Top Golden Light Accent */}
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-transparent via-[#C9A24D] to-transparent opacity-80" />

            {/* Title Section */}
            <div className="mb-6 text-center sm:text-start">
              <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
                {isRtl ? "تسجيل الدخول" : "Sign In to Portal"}
              </h2>
              <p className="text-xs sm:text-sm text-white/65 mt-1">
                {isRtl
                  ? "أدخل كود الموظف أو رقم البروفايل وكلمة المرور"
                  : "Enter your Employee ID and password to continue"}
              </p>
            </div>

            {/* Error Message */}
            {error && (
              <div className="mb-5 p-3.5 bg-rose-500/15 border border-rose-500/30 text-rose-200 text-xs rounded-2xl flex gap-2.5 items-start animate-[shake_0.4s_ease]">
                <AlertCircle className="w-4 h-4 mt-0.5 shrink-0 text-rose-400" />
                <span className="leading-relaxed font-medium">{error}</span>
              </div>
            )}

            <form
              method="post"
              autoComplete="on"
              onSubmit={handleLogin}
              className="space-y-4"
            >
              {/* Employee ID Field */}
              <div className="space-y-1.5">
                <label
                  htmlFor="employeeId"
                  className="text-xs font-semibold text-white/85 flex items-center justify-between"
                >
                  <span className="flex items-center gap-1.5">
                    <User className="w-3.5 h-3.5 text-[#C9A24D]" />
                    <span>{isRtl ? "كود الموظف / رقم البروفايل" : "Employee ID / Profile ID"}</span>
                  </span>
                  <span className="text-[10px] text-white/40">Required</span>
                </label>

                <div className="relative flex items-center">
                  <input
                    ref={inputRef}
                    id="employeeId"
                    name="username"
                    type="text"
                    autoComplete="username"
                    autoCapitalize="none"
                    autoCorrect="off"
                    spellCheck={false}
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder={isRtl ? "مثال: EMP-001 أو 1024" : "e.g. EMP-001 or 1024"}
                    className="w-full bg-black/40 hover:bg-black/50 focus:bg-black/60 border border-white/15 focus:border-[#C9A24D] text-white rounded-2xl py-3.5 ps-3.5 pe-10 focus:ring-2 focus:ring-[#C9A24D]/25 outline-none transition-all text-sm placeholder:text-white/30"
                    required
                    disabled={isLoading}
                  />
                  {employeeId && (
                    <button
                      type="button"
                      onClick={() => setEmployeeId("")}
                      className="absolute end-3 text-white/40 hover:text-white transition-colors p-1"
                      title={isRtl ? "مسح" : "Clear"}
                    >
                      <X className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>

              {/* Password Field */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between mb-1">
                  <label
                    htmlFor="password"
                    className="text-xs font-semibold text-white/85 flex items-center gap-1.5"
                  >
                    <Lock className="w-3.5 h-3.5 text-[#C9A24D]" />
                    <span>{isRtl ? "كلمة المرور" : "Password"}</span>
                  </label>
                  <button
                    type="button"
                    onClick={() => handleSupportAction("password")}
                    className="text-xs text-[#C9A24D] hover:text-[#E2C37A] font-medium transition-colors hover:underline cursor-pointer"
                  >
                    {isRtl ? "نسيت كلمة المرور؟" : "Forgot Password?"}
                  </button>
                </div>

                <div className="relative flex items-center">
                  <input
                    id="password"
                    name="password"
                    autoComplete="current-password"
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isRtl ? "أدخل كلمة المرور الخاصة بك" : "Enter your password"}
                    className="w-full bg-black/40 hover:bg-black/50 focus:bg-black/60 border border-white/15 focus:border-[#C9A24D] text-white rounded-2xl py-3.5 ps-3.5 pe-11 focus:ring-2 focus:ring-[#C9A24D]/25 outline-none transition-all text-sm placeholder:text-white/30 font-mono tracking-wider"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute end-3 text-white/50 hover:text-white transition-colors p-1.5 flex items-center justify-center rounded-lg cursor-pointer"
                    title={showPassword ? (isRtl ? "إخفاء" : "Hide") : (isRtl ? "إظهار" : "Show")}
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4 text-[#C9A24D]" />
                    ) : (
                      <Eye className="w-4 h-4 text-white/60" />
                    )}
                  </button>
                </div>
              </div>

              {/* First-time Default Password Hint Toggle */}
              <div className="pt-0.5">
                <button
                  type="button"
                  onClick={() => setShowDefaultPwHint(!showDefaultPwHint)}
                  className="text-[11px] text-white/60 hover:text-white/90 flex items-center gap-1.5 transition-colors cursor-pointer"
                >
                  <HelpCircle className="w-3.5 h-3.5 text-[#C9A24D]" />
                  <span>
                    {isRtl
                      ? "أول مرة تسجل دخول للبوابة؟"
                      : "First time logging in to the portal?"}
                  </span>
                </button>

                {showDefaultPwHint && (
                  <div className="mt-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/25 text-amber-200 text-xs space-y-1">
                    <p className="font-semibold">
                      {isRtl ? "💡 كلمة المرور الافتراضية لأول مرة هي: 1234" : "💡 Default initial password is: 1234"}
                    </p>
                    <p className="text-[11px] text-amber-300/80">
                      {isRtl
                        ? "سيطلب منك النظام تلقائياً تعيين كلمة مرور شخصية جديدة فور تسجيل الدخول بنجاح."
                        : "You will be prompted to choose a new secure password immediately upon first sign-in."}
                    </p>
                  </div>
                )}
              </div>

              {/* Options: Remember Me & Biometric Toggle */}
              <div className="pt-2 space-y-2.5">
                {/* Remember Me Checkbox — Works on BOTH Web and Native */}
                <label className="flex items-center gap-2.5 cursor-pointer select-none group w-max">
                  <div className="relative flex items-center justify-center">
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="sr-only"
                    />
                    <div
                      className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${
                        rememberMe
                          ? "border-[#C9A24D] bg-[#C9A24D] text-black shadow-[0_0_10px_rgba(201,162,77,0.4)]"
                          : "border-white/30 bg-black/30 group-hover:border-white/50"
                      }`}
                    >
                      {rememberMe && (
                        <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                      )}
                    </div>
                  </div>
                  <span className="text-xs text-white/75 group-hover:text-white transition-colors font-medium">
                    {isRtl ? "تذكر تسجيل الدخول على هذا الجهاز" : "Remember login on this device"}
                  </span>
                </label>

                {/* Native Fingerprint Enable Toggle */}
                {isNative && (
                  <label className="flex items-center gap-2.5 cursor-pointer select-none group w-max">
                    <div className="relative flex items-center justify-center">
                      <input
                        type="checkbox"
                        checked={useFingerprint}
                        onChange={(e) => setUseFingerprint(e.target.checked)}
                        className="sr-only"
                      />
                      <div
                        className={`w-5 h-5 rounded-lg border transition-all flex items-center justify-center ${
                          useFingerprint
                            ? "border-teal-500 bg-teal-500 text-black shadow-[0_0_10px_rgba(20,184,166,0.4)]"
                            : "border-white/30 bg-black/30 group-hover:border-white/50"
                        }`}
                      >
                        {useFingerprint && (
                          <Check className="w-3.5 h-3.5 text-black stroke-[3]" />
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 text-xs text-white/75 group-hover:text-white transition-colors">
                      <Fingerprint className="w-3.5 h-3.5 text-teal-400" />
                      <span>
                        {isRtl ? "تفعيل الدخول بالبصمة / Face ID" : "Enable Biometric / Face ID Login"}
                      </span>
                    </div>
                  </label>
                )}
              </div>

              {/* Sign In Submit Button */}
              <MotionButton
                type="submit"
                withTap
                disabled={isLoading}
                className="w-full mt-3 bg-gradient-to-r from-[#C9A24D] via-[#DFBF70] to-[#C9A24D] text-[#12131C] font-bold py-3.5 rounded-2xl hover:brightness-105 active:scale-[0.99] transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-[0_6px_25px_rgba(201,162,77,0.35)] cursor-pointer text-sm"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>{isRtl ? "جارٍ التحقق والدخول..." : "Authenticating..."}</span>
                  </>
                ) : (
                  <>
                    <span>{isRtl ? "تسجيل الدخول" : "Sign In"}</span>
                    <ArrowRight className={`w-4 h-4 ${isRtl ? "rotate-180" : ""}`} />
                  </>
                )}
              </MotionButton>
            </form>

            {/* Quick Biometric Shortcut Button (if saved credentials exist on Native) */}
            {isNative && useFingerprint && biometric.isAvailable && showBiometricBtn && (
              <div className="mt-5">
                <div className="relative mb-4">
                  <div className="absolute inset-0 flex items-center">
                    <div className="w-full border-t border-white/10" />
                  </div>
                  <div className="relative flex justify-center">
                    <span className="bg-[#12131A] px-3 text-[11px] text-white/40 uppercase tracking-wider rounded-full border border-white/5">
                      {isRtl ? "أو الدخول السريع" : "Or Quick Biometric"}
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleBiometricLogin}
                  disabled={isLoading}
                  className="w-full bg-white/5 border border-white/15 text-white font-semibold py-3 rounded-2xl hover:bg-white/10 active:bg-white/5 transition-all disabled:opacity-50 flex items-center justify-center gap-2 text-xs cursor-pointer"
                >
                  {isLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Fingerprint className="w-4 h-4 text-[#C9A24D]" />
                  )}
                  <span>{isRtl ? "تسجيل الدخول بالبصمة / Face ID" : "Sign In with Biometric"}</span>
                </button>
              </div>
            )}

            {/* Help / Contact Support Link */}
            <div className="mt-5 pt-4 border-t border-white/10 text-center">
              <button
                type="button"
                onClick={() => handleSupportAction("access")}
                className="text-xs text-white/50 hover:text-white/80 transition-colors cursor-pointer"
              >
                {isRtl
                  ? "تواجه مشكلة في حسابك؟ تواصل مع إدارة السكن"
                  : "Having trouble? Contact Housing Administration"}
              </button>
            </div>
          </div>

          {/* PWA Install Banner (Visible on Web Mobile & Desktop) */}
          {!isNative && (
            <div className="w-full">
              <PWAInstallBanner />
            </div>
          )}

          {/* Secure Portal & Copyright Footer */}
          <footer className="mt-6 text-center space-y-2">
            <div className="inline-flex items-center justify-center gap-1.5 py-1 px-3 rounded-full bg-black/40 border border-white/10 backdrop-blur-md text-[11px] text-white/60">
              <ShieldCheck className="w-3.5 h-3.5 text-[#C9A24D]" />
              <span>
                {isRtl
                  ? "بوابة سكن الموظفين المشفرة والآمنة"
                  : "Encrypted SUNRISE Resident Portal"}
              </span>
            </div>

            <p className="text-[11px] text-white/40">
              &copy; {new Date().getFullYear()}{" "}
              {isRtl
                ? "مجموعة صن رايز للمنتجعات والفنادق. جميع الحقوق محفوظة."
                : "SUNRISE Resorts & Cruises. All rights reserved."}
            </p>
          </footer>
        </section>
      </main>

      {/* Signature Transition to Dashboard */}
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
