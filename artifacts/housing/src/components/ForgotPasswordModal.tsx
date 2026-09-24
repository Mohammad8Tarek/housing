import { useState, useEffect, useRef } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  InputOTP,
  InputOTPGroup,
  InputOTPSeparator,
  InputOTPSlot,
} from "@/components/ui/input-otp";
import { toast } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import {
  Mail,
  KeyRound,
  ShieldCheck,
  Clock,
  RefreshCw,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  Lock,
} from "lucide-react";
import { Loader } from "@/components/ui/loader";

interface ForgotPasswordModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (username: string) => void;
}

export function ForgotPasswordModal({
  open,
  onOpenChange,
  onSuccess,
}: ForgotPasswordModalProps) {
  const { language, dir } = useLanguage();
  const ar = language === "ar";

  // Step state: 1 = request OTP, 2 = verify OTP, 3 = reset password
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [identifier, setIdentifier] = useState("");
  const [maskedEmail, setMaskedEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Timers
  const [otpRemainingSeconds, setOtpRemainingSeconds] = useState(120); // 2 minutes strict TTL
  const [cooldownRemainingSeconds, setCooldownRemainingSeconds] = useState(0);

  // Interval timer for OTP and Cooldown
  useEffect(() => {
    if (!open || step !== 2) return;

    const timer = setInterval(() => {
      setOtpRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
      setCooldownRemainingSeconds((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [open, step]);

  // Reset state on dialog close
  useEffect(() => {
    if (!open) {
      setTimeout(() => {
        setStep(1);
        setIdentifier("");
        setMaskedEmail("");
        setOtp("");
        setResetToken("");
        setNewPassword("");
        setConfirmPassword("");
        setErrorMessage(null);
        setIsLoading(false);
        setOtpRemainingSeconds(120);
        setCooldownRemainingSeconds(0);
      }, 300);
    }
  }, [open]);

  // Format seconds to mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  // ─── Step 1: Request OTP ───────────────────────────────────────────────
  const handleRequestOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!identifier.trim()) {
      setErrorMessage(
        ar
          ? "يرجى إدخال اسم المستخدم أو البريد الإلكتروني"
          : "Please enter your username or email",
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || (ar ? "حدث خطأ أثناء إرسال الرمز" : "Failed to send code"));
        return;
      }

      setMaskedEmail(data.maskedEmail || "");
      setOtpRemainingSeconds(data.expiresInSeconds || 180);
      setCooldownRemainingSeconds(data.cooldownSeconds || 60);
      setOtp("");
      setStep(2);
      toast.success(
        ar
          ? "تم إرسال رمز التحقق بنجاح إلى بريدك الإلكتروني"
          : "Verification code sent to your email",
      );
    } catch (err: any) {
      setErrorMessage(
        ar ? "فشل الاتصال بالخادم، يرجى المحاولة لاحقاً" : "Connection failed, please try again",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Resend OTP ────────────────────────────────────────────────
  const handleResendOtp = async () => {
    if (cooldownRemainingSeconds > 0 || isLoading) return;

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/request-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier: identifier.trim() }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || (ar ? "فشلت إعادة الإرسال" : "Failed to resend code"));
        if (data.cooldownSeconds) {
          setCooldownRemainingSeconds(data.cooldownSeconds);
        }
        return;
      }

      setOtpRemainingSeconds(data.expiresInSeconds || 180);
      setCooldownRemainingSeconds(data.cooldownSeconds || 120);
      setOtp("");
      toast.success(
        ar ? "تمت إعادة إرسال رمز التحقق بنجاح!" : "Verification code resent successfully!",
      );
    } catch (err) {
      setErrorMessage(
        ar ? "فشل الاتصال بالخادم" : "Connection failed, please try again",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 2: Verify OTP ────────────────────────────────────────────────
  const handleVerifyOtp = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (otp.length < 6) {
      setErrorMessage(
        ar
          ? "يرجى إدخال رمز التحقق المكون من 6 أرقام كاملاً"
          : "Please enter the complete 6-digit OTP code",
      );
      return;
    }

    if (otpRemainingSeconds <= 0) {
      setErrorMessage(
        ar
          ? "انتهت صلاحية الرمز (مر دقيقتين). اضغط على إعادة الإرسال للحصول على رمز جديد."
          : "OTP code expired. Please click Resend to get a new code.",
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/verify-otp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          otp: otp.trim(),
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || (ar ? "رمز التحقق غير صحيح" : "Invalid OTP code"));
        return;
      }

      setResetToken(data.resetToken);
      setStep(3);
      toast.success(
        ar ? "تم التحقق بنجاح! قم الآن بتعيين كلمة المرور الجديدة" : "Verified! Now set your new password",
      );
    } catch (err) {
      setErrorMessage(
        ar ? "فشل الاتصال بالخادم" : "Connection error, please try again",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // ─── Step 3: Reset Password ────────────────────────────────────────────
  const handleResetPassword = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();

    if (!newPassword) {
      setErrorMessage(ar ? "يرجى إدخال كلمة المرور الجديدة" : "Please enter new password");
      return;
    }

    if (newPassword.length < 8) {
      setErrorMessage(
        ar
          ? "يجب ألا تقل كلمة المرور عن 8 أحرف"
          : "Password must be at least 8 characters",
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(
        ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match",
      );
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);

    try {
      const res = await fetch("/api/auth/forgot-password/reset-password", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: identifier.trim(),
          resetToken,
          newPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMessage(data.error || (ar ? "فشل تغيير كلمة المرور" : "Failed to reset password"));
        return;
      }

      toast.success(
        ar
          ? "تم تغيير كلمة المرور بنجاح! يمكنك الآن تسجيل الدخول بكلمة المرور الجديدة."
          : "Password reset successfully! You can now log in.",
      );

      if (onSuccess) {
        onSuccess(identifier.trim());
      }
      onOpenChange(false);
    } catch (err) {
      setErrorMessage(
        ar ? "فشل الاتصال بالخادم" : "Connection error, please try again",
      );
    } finally {
      setIsLoading(false);
    }
  };

  // Password requirements calculation
  const hasMinLength = newPassword.length >= 8;
  const hasUpper = /[A-Z]/.test(newPassword);
  const hasLower = /[a-z]/.test(newPassword);
  const hasNumber = /[0-9]/.test(newPassword);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 sm:rounded-2xl" dir={dir}>
        <DialogHeader className="space-y-2 text-center sm:text-right">
          <div className="mx-auto sm:mx-0 w-12 h-12 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mb-1">
            {step === 1 && <Mail className="w-6 h-6 text-primary" />}
            {step === 2 && <KeyRound className="w-6 h-6 text-primary" />}
            {step === 3 && <ShieldCheck className="w-6 h-6 text-primary" />}
          </div>
          <DialogTitle className="text-xl font-bold tracking-tight">
            {step === 1 && (ar ? "استعادة كلمة المرور" : "Forgot Password")}
            {step === 2 && (ar ? "رمز التحقق (OTP)" : "Enter Verification Code")}
            {step === 3 && (ar ? "تعيين كلمة المرور الجديدة" : "Set New Password")}
          </DialogTitle>
          <DialogDescription className="text-sm text-muted-foreground">
            {step === 1 &&
              (ar
                ? "أدخل اسم المستخدم أو البريد الإلكتروني المسجل لإرسال رمز التحقق الأمني"
                : "Enter your registered username or email to receive a secure verification code")}
            {step === 2 &&
              (ar
                ? "أدخل رمز التحقق المكون من 6 أرقام المرسل إلى بريدك الإلكتروني"
                : "Enter the 6-digit code sent to your registered email")}
            {step === 3 &&
              (ar
                ? "اختر كلمة مرور قوية لتأمين حسابك"
                : "Create a strong new password to secure your account")}
          </DialogDescription>
        </DialogHeader>

        {/* Step Progress Indicators */}
        <div className="flex items-center justify-center gap-2 py-2">
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              step >= 1 ? "w-8 bg-primary" : "w-2 bg-muted"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              step >= 2 ? "w-8 bg-primary" : "w-2 bg-muted"
            }`}
          />
          <div
            className={`h-2 rounded-full transition-all duration-300 ${
              step >= 3 ? "w-8 bg-primary" : "w-2 bg-muted"
            }`}
          />
        </div>

        {/* Error Alert Box */}
        {errorMessage && (
          <div className="p-3 bg-red-50 dark:bg-red-950/30 border border-red-200 dark:border-red-900 rounded-xl flex items-start gap-2.5 text-sm text-red-700 dark:text-red-300 animate-in fade-in">
            <AlertCircle className="w-5 h-5 shrink-0 mt-0.5 text-red-600" />
            <span className="leading-snug">{errorMessage}</span>
          </div>
        )}

        {/* ─── STEP 1: Request OTP Form ──────────────────────────────── */}
        {step === 1 && (
          <form onSubmit={handleRequestOtp} className="space-y-4 pt-2">
            <div className="space-y-2">
              <Label htmlFor="reset-identifier" className="font-semibold text-sm">
                {ar ? "اسم المستخدم أو البريد الإلكتروني" : "Username or Email"}
              </Label>
              <div className="relative">
                <Input
                  id="reset-identifier"
                  type="text"
                  autoFocus
                  value={identifier}
                  onChange={(e) => {
                    setIdentifier(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder={
                    ar ? "مثال: admin أو admin@sunrise-resorts.com" : "e.g. admin or user@sunrise.com"
                  }
                  className="h-11 transition-all focus-visible:ring-primary/50 text-base"
                />
              </div>
            </div>

            <Button
              type="submit"
              disabled={isLoading || !identifier.trim()}
              className="w-full h-11 font-bold shadow-md text-base mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader className="w-4 h-4" />
                  {ar ? "جاري الإرسال..." : "Sending..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  {ar ? "إرسال رمز التحقق" : "Send Verification Code"}
                  {ar ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
                </span>
              )}
            </Button>
          </form>
        )}

        {/* ─── STEP 2: Verify OTP Form ───────────────────────────────── */}
        {step === 2 && (
          <form onSubmit={handleVerifyOtp} className="space-y-5 pt-1">
            {/* Email notice badge */}
            <div className="bg-muted/60 border border-border/80 rounded-xl p-3 text-center space-y-1">
              <div className="text-xs text-muted-foreground">
                {ar ? "تم إرسال الرمز إلى البريد الإلكتروني:" : "Verification code sent to:"}
              </div>
              <div className="font-semibold text-foreground text-sm tracking-wide font-mono">
                {maskedEmail || identifier}
              </div>
            </div>

            {/* Live Expiration Countdown */}
            <div className="flex items-center justify-between px-1 text-sm">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Clock className="w-4 h-4 text-primary" />
                {ar ? "صلاحية الرمز:" : "Code validity:"}
              </span>
              <span
                className={`font-mono font-bold px-2 py-0.5 rounded-md ${
                  otpRemainingSeconds > 30
                    ? "bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-300"
                    : otpRemainingSeconds > 0
                      ? "bg-red-100 text-red-800 dark:bg-red-950/40 dark:text-red-300 animate-pulse"
                      : "bg-red-200 text-red-900 dark:bg-red-900/60 dark:text-red-200"
                }`}
              >
                {otpRemainingSeconds > 0 ? (
                  formatTime(otpRemainingSeconds)
                ) : (
                  <span>{ar ? "انتهت الصلاحية" : "Expired"}</span>
                )}
              </span>
            </div>

            {/* OTP Input Slots */}
            <div className="flex justify-center py-2" dir="ltr">
              <InputOTP
                maxLength={6}
                value={otp}
                onChange={(val) => {
                  setOtp(val);
                  if (errorMessage) setErrorMessage(null);
                }}
                autoFocus
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-11 h-12 text-lg font-bold" />
                  <InputOTPSlot index={1} className="w-11 h-12 text-lg font-bold" />
                  <InputOTPSlot index={2} className="w-11 h-12 text-lg font-bold" />
                </InputOTPGroup>
                <InputOTPSeparator />
                <InputOTPGroup>
                  <InputOTPSlot index={3} className="w-11 h-12 text-lg font-bold" />
                  <InputOTPSlot index={4} className="w-11 h-12 text-lg font-bold" />
                  <InputOTPSlot index={5} className="w-11 h-12 text-lg font-bold" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {/* Verify Action Button */}
            <Button
              type="submit"
              disabled={isLoading || otp.length < 6 || otpRemainingSeconds <= 0}
              className="w-full h-11 font-bold shadow-md text-base"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader className="w-4 h-4" />
                  {ar ? "جاري التحقق..." : "Verifying..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <CheckCircle2 className="w-4 h-4" />
                  {ar ? "تأكيد الرمز والمتابعة" : "Confirm Code & Continue"}
                </span>
              )}
            </Button>

            {/* Resend OTP button with cooldown */}
            <div className="flex items-center justify-between pt-1 text-sm">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => {
                  setStep(1);
                  setErrorMessage(null);
                }}
                className="text-muted-foreground hover:text-foreground text-xs"
              >
                {ar ? "تغيير اسم المستخدم" : "Change username"}
              </Button>

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResendOtp}
                disabled={cooldownRemainingSeconds > 0 || isLoading}
                className="gap-1.5 text-xs font-semibold"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${isLoading ? "animate-spin" : ""}`}
                />
                {cooldownRemainingSeconds > 0 ? (
                  <span>
                    {ar
                      ? `إعادة الإرسال بعد (${cooldownRemainingSeconds} ث)`
                      : `Resend in (${cooldownRemainingSeconds}s)`}
                  </span>
                ) : (
                  <span>{ar ? "إعادة إرسال الرمز" : "Resend Code"}</span>
                )}
              </Button>
            </div>
          </form>
        )}

        {/* ─── STEP 3: Set New Password Form ─────────────────────────── */}
        {step === 3 && (
          <form onSubmit={handleResetPassword} className="space-y-4 pt-1">
            <div className="space-y-2">
              <Label htmlFor="new-pwd" className="font-semibold text-sm">
                {ar ? "كلمة المرور الجديدة" : "New Password"}
              </Label>
              <div className="relative">
                <Input
                  id="new-pwd"
                  type={showNewPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => {
                    setNewPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  autoFocus
                  placeholder="••••••••"
                  className="h-11 transition-all focus-visible:ring-primary/50 pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword((v) => !v)}
                  className={`absolute ${ar ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1`}
                  tabIndex={-1}
                >
                  {showNewPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="confirm-pwd" className="font-semibold text-sm">
                {ar ? "تأكيد كلمة المرور" : "Confirm Password"}
              </Label>
              <div className="relative">
                <Input
                  id="confirm-pwd"
                  type={showConfirmPassword ? "text" : "password"}
                  value={confirmPassword}
                  onChange={(e) => {
                    setConfirmPassword(e.target.value);
                    if (errorMessage) setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  className="h-11 transition-all focus-visible:ring-primary/50 pl-10 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword((v) => !v)}
                  className={`absolute ${ar ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground p-1`}
                  tabIndex={-1}
                >
                  {showConfirmPassword ? (
                    <EyeOff className="w-4 h-4" />
                  ) : (
                    <Eye className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>

            {/* Password Policy Checks */}
            <div className="p-3 bg-muted/50 rounded-xl space-y-1.5 text-xs text-muted-foreground">
              <div className="font-semibold text-foreground mb-1">
                {ar ? "شروط كلمة المرور:" : "Password requirements:"}
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <div
                  className={`flex items-center gap-1.5 ${
                    hasMinLength ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
                  }`}
                >
                  <span className="text-sm">{hasMinLength ? "✓" : "•"}</span>
                  {ar ? "8 أحرف على الأقل" : "8+ characters"}
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasUpper ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
                  }`}
                >
                  <span className="text-sm">{hasUpper ? "✓" : "•"}</span>
                  {ar ? "حرف كبير (A-Z)" : "Uppercase letter"}
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasLower ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
                  }`}
                >
                  <span className="text-sm">{hasLower ? "✓" : "•"}</span>
                  {ar ? "حرف صغير (a-z)" : "Lowercase letter"}
                </div>
                <div
                  className={`flex items-center gap-1.5 ${
                    hasNumber ? "text-emerald-600 dark:text-emerald-400 font-medium" : ""
                  }`}
                >
                  <span className="text-sm">{hasNumber ? "✓" : "•"}</span>
                  {ar ? "رقم (0-9)" : "Number (0-9)"}
                </div>
              </div>
            </div>

            <Button
              type="submit"
              disabled={
                isLoading ||
                !newPassword ||
                !confirmPassword ||
                newPassword !== confirmPassword ||
                !hasMinLength
              }
              className="w-full h-11 font-bold shadow-md text-base mt-2"
            >
              {isLoading ? (
                <span className="flex items-center gap-2">
                  <Loader className="w-4 h-4" />
                  {ar ? "جاري الحفظ..." : "Saving..."}
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" />
                  {ar ? "حفظ كلمة المرور الجديدة" : "Save New Password"}
                </span>
              )}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
