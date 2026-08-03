import { useState } from "react";
import { useLocation } from "wouter";
import { Loader2, ArrowRight, ArrowLeft, Check, AlertCircle } from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";
import MaterialIcon from "../components/MaterialIcon";
import { MotionButton } from "../components/motion-primitives";
import { toast } from "sonner";
import { hapticFeedback } from "../lib/haptics";

export default function ForgotPassword() {
  const [, setLocation] = useLocation();
  const { t, lang } = useTheme();
  const isRtl = lang === "ar";
  
  // Step 1: Verification
  const [step, setStep] = useState<1 | 2>(1);
  const [employeeId, setEmployeeId] = useState("");
  const [nationalId, setNationalId] = useState("");
  const [roomNumber, setRoomNumber] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  
  // Step 2: Reset
  const [resetToken, setResetToken] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const handleVerify = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setIsLoading(true);
    
    try {
      const res = await apiFetch("/api/portal-auth/forgot-password/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          employeeId,
          nationalId,
          roomNumber,
          dateOfBirth,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        hapticFeedback("heavy");
        setError(data.message || (isRtl ? "حدث خطأ" : "An error occurred"));
      } else {
        hapticFeedback("medium");
        setResetToken(data.token);
        setStep(2);
      }
    } catch (err: any) {
      hapticFeedback("heavy");
      setError(isRtl ? "تعذر الاتصال بالخادم" : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  const handleReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(isRtl ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    
    setError("");
    setIsLoading(true);
    
    try {
      const res = await apiFetch("/api/portal-auth/forgot-password/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          token: resetToken,
          newPassword,
          confirmPassword,
        }),
      });
      
      const data = await res.json();
      
      if (!res.ok || !data.success) {
        hapticFeedback("heavy");
        setError(data.message || (isRtl ? "حدث خطأ" : "An error occurred"));
      } else {
        hapticFeedback("medium");
        toast.success(data.message || (isRtl ? "تم تغيير كلمة المرور بنجاح" : "Password changed successfully"));
        setLocation("/login");
      }
    } catch (err: any) {
      hapticFeedback("heavy");
      setError(isRtl ? "تعذر الاتصال بالخادم" : "Connection failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className={`min-h-[100dvh] flex flex-col relative overflow-hidden bg-gradient-to-br from-[#0F2A44] via-[#1a365d] to-[#0d2238] font-sans ${isRtl ? "dir-rtl" : "dir-ltr"}`}>
      {/* Background patterns matching login */}
      <div className="absolute top-[-10%] left-[-10%] w-96 h-96 bg-[#C9A24D]/10 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[30rem] h-[30rem] bg-white/5 rounded-full blur-[100px] pointer-events-none" />

      {/* Header */}
      <div className="relative z-20 flex items-center justify-between p-4 sm:p-6 w-full max-w-7xl mx-auto">
        <button
          onClick={() => setLocation("/login")}
          className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-white/10 text-white hover:bg-white/10 transition-colors"
        >
          {isRtl ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
        </button>
      </div>

      <div className="relative z-10 flex-1 flex items-center justify-center px-5 sm:px-8 pb-10 w-full md:w-[450px] md:mx-auto">
        <div className="w-full max-w-[420px] animate-[slideUp_0.6s_cubic-bezier(0.16,1,0.3,1)]">
          <div className="bg-white/10 dark:bg-[#12131C]/40 backdrop-blur-2xl border border-white/20 dark:border-white/10 rounded-[28px] p-7 sm:p-8 shadow-[0_8px_32px_rgba(0,0,0,0.4)]">
            <div className="mb-8">
              <h2 className="text-3xl font-semibold text-white mb-2">
                {isRtl ? "استعادة كلمة المرور" : "Reset Password"}
              </h2>
              <p className="text-[14px] text-white/70">
                {step === 1
                  ? isRtl
                    ? "الرجاء إدخال بياناتك للتحقق من هويتك"
                    : "Please enter your details to verify your identity"
                  : isRtl
                    ? "قم بإنشاء كلمة مرور جديدة لحسابك"
                    : "Create a new password for your account"}
              </p>
            </div>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 text-red-200 text-[13px] rounded-2xl flex gap-3 items-start animate-[fadeIn_0.3s_ease]">
                <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-red-400" />
                <span className="leading-relaxed">{error}</span>
              </div>
            )}

            {step === 1 ? (
              <form onSubmit={handleVerify} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-white/80 ms-1">
                    {isRtl ? "معرف الموظف" : "Employee ID"}
                  </label>
                  <input
                    value={employeeId}
                    onChange={(e) => setEmployeeId(e.target.value)}
                    placeholder={isRtl ? "مثال: EMP-1234" : "e.g. EMP-1234"}
                    className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30"
                    required
                    disabled={isLoading}
                  />
                </div>
                
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-white/80 ms-1">
                    {isRtl ? "الرقم القومي / رقم الهوية" : "National ID"}
                  </label>
                  <input
                    value={nationalId}
                    onChange={(e) => setNationalId(e.target.value)}
                    placeholder={isRtl ? "الرقم القومي" : "National ID"}
                    className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-white/80 ms-1">
                    {isRtl ? "تاريخ الميلاد" : "Date of Birth"}
                  </label>
                  <input
                    type="date"
                    value={dateOfBirth}
                    onChange={(e) => setDateOfBirth(e.target.value)}
                    className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30 [color-scheme:dark]"
                    required
                    disabled={isLoading}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-white/80 ms-1">
                    {isRtl ? "رقم الغرفة الحالي" : "Current Room Number"}
                  </label>
                  <input
                    value={roomNumber}
                    onChange={(e) => setRoomNumber(e.target.value)}
                    placeholder={isRtl ? "رقم الغرفة" : "Room number"}
                    className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 px-4 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30"
                    required
                    disabled={isLoading}
                  />
                </div>

                <MotionButton
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-[#C9A24D] hover:bg-[#E2C37A] text-[#0F2A44] font-bold rounded-2xl py-4 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(201,162,77,0.3)] transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <span>{isRtl ? "تحقق" : "Verify"}</span>
                      {isRtl ? <ArrowLeft className="w-5 h-5" /> : <ArrowRight className="w-5 h-5" />}
                    </>
                  )}
                </MotionButton>
              </form>
            ) : (
              <form onSubmit={handleReset} className="space-y-5">
                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-white/80 ms-1">
                    {isRtl ? "كلمة المرور الجديدة" : "New Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showNewPassword ? "text" : "password"}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 ps-4 pe-11 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className={`absolute ${isRtl ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}
                    >
                      <MaterialIcon icon={showNewPassword ? "visibility_off" : "visibility"} size={20} />
                    </button>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[12px] font-medium text-white/80 ms-1">
                    {isRtl ? "تأكيد كلمة المرور" : "Confirm Password"}
                  </label>
                  <div className="relative">
                    <input
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      className="w-full bg-black/20 hover:bg-black/30 focus:bg-black/40 border border-white/10 text-white rounded-2xl py-3.5 ps-4 pe-11 focus:border-[#C9A24D]/50 focus:ring-1 focus:ring-[#C9A24D]/50 outline-none transition-all text-[15px] placeholder:text-white/30"
                      required
                      disabled={isLoading}
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className={`absolute ${isRtl ? "left-4" : "right-4"} top-1/2 -translate-y-1/2 text-white/40 hover:text-white transition-colors`}
                    >
                      <MaterialIcon icon={showConfirmPassword ? "visibility_off" : "visibility"} size={20} />
                    </button>
                  </div>
                </div>

                <MotionButton
                  type="submit"
                  disabled={isLoading}
                  className="w-full mt-4 bg-emerald-500 hover:bg-emerald-400 text-white font-bold rounded-2xl py-4 flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(16,185,129,0.3)] transition-all"
                >
                  {isLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Check className="w-5 h-5" />
                      <span>{isRtl ? "تغيير كلمة المرور" : "Reset Password"}</span>
                    </>
                  )}
                </MotionButton>
              </form>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
