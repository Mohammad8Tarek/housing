// @ts-nocheck
import { useEffect, useMemo, useState } from "react";
import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useAuth, storeToken } from "@/context/AuthContext";
import { useLanguage } from "@/context/LanguageContext";
import { useLogin } from "@workspace/api-client-react";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Building2, Clock, Globe, KeyRound, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { Loader } from "@/components/ui/loader";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";

export default function Login() {
  const { isAuthenticated } = useAuth();
  const [, setLocation] = useLocation();
  const { language, dir, setLanguage } = useLanguage();

  const [showPassword, setShowPassword] = useState(false);
  const [keepLoggedIn, setKeepLoggedIn] = useState(false);
  const [logoutMsg, setLogoutMsg] = useState<string | null>(null);
  const [lockoutMsg, setLockoutMsg] = useState<{
    message: string;
    retryAfter?: number;
  } | null>(null);
  const [remainingAttempts, setRemainingAttempts] = useState<{
    count: number;
    max: number;
  } | null>(null);

  const isAr = language === "ar";

  const loginSchema = useMemo(
    () =>
      z.object({
        username: z
          .string()
          .min(1, isAr ? "اسم المستخدم مطلوب" : "Username is required"),
        password: z
          .string()
          .min(1, isAr ? "كلمة المرور مطلوبة" : "Password is required"),
      }),
    [isAr],
  );

  useEffect(() => {
    const reason = sessionStorage.getItem("auth_logout_reason");
    if (!reason) return;

    sessionStorage.removeItem("auth_logout_reason");
    setLogoutMsg(
      reason === "timeout"
        ? isAr
          ? "انتهت جلستك بسبب عدم النشاط لمدة 30 دقيقة."
          : "Your session expired after 30 minutes of inactivity."
        : isAr
          ? "يرجى تسجيل الدخول مجدداً."
          : "Please sign in again.",
    );
  }, [isAr]);

  useEffect(() => {
    if (isAuthenticated) {
      setLocation("/dashboard");
    }
  }, [isAuthenticated, setLocation]);

  const form = useForm<z.infer<typeof loginSchema>>({
    resolver: zodResolver(loginSchema),
    defaultValues: { username: "", password: "" },
  });

  const loginMutation = useLogin({
    mutation: {
      onSuccess: (data) => {
        setLockoutMsg(null);
        setRemainingAttempts(null);
        storeToken(data.token, keepLoggedIn);
        window.location.href = "/dashboard";
      },
      onError: (error: any) => {
        // ApiError stores parsed body in error.data, not error.response.data
        const errBody = error?.data ?? error?.response?.data;
        const code = errBody?.code;
        const errMsg = errBody?.error || errBody?.message || "";

        if (code === "ACCOUNT_LOCKED") {
          const mins = errBody?.retryAfterMinutes ?? 15;
          setLockoutMsg({
            message: isAr
              ? `الحساب مقفل. حاول مرة أخرى بعد ${mins} دقيقة`
              : `Account locked. Try again in ${mins} minute${mins > 1 ? "s" : ""}`,
            retryAfter: mins,
          });
          setRemainingAttempts(null);
        } else if (code === "INVALID_CREDENTIALS") {
          const remaining = errBody?.remainingAttempts ?? 0;
          const max = errBody?.maxAttempts ?? 5;
          setLockoutMsg(null);
          setRemainingAttempts({ count: remaining, max });
          toast.error(isAr ? "فشل تسجيل الدخول" : "Login Failed", {
            description: isAr
              ? `بيانات الدخول غير صحيحة. متبقي ${remaining} محاولات قبل قفل الحساب`
              : `Invalid credentials. ${remaining} attempt${remaining > 1 ? "s" : ""} remaining before lockout`,
          });
        } else {
          setLockoutMsg(null);
          setRemainingAttempts(null);
          toast.error(isAr ? "فشل تسجيل الدخول" : "Login Failed", {
            description:
              errMsg ||
              (isAr
                ? "بيانات الاعتماد غير صحيحة، يرجى المحاولة مرة أخرى."
                : "Invalid credentials, please try again."),
          });
        }
      },
    },
  });

  const onSubmit = (values: z.infer<typeof loginSchema>) => {
    loginMutation.mutate({ data: values });
  };

  return (
    <div
      className="min-h-[100dvh] flex bg-background selection:bg-primary/20"
      dir={dir}
    >
      <div className="hidden lg:flex flex-col w-[45%] text-white relative overflow-hidden shadow-2xl z-10">
        <img
          src={`${import.meta.env.BASE_URL}resort-bg.jpg`}
          alt="Sunrise Resort"
          className="absolute inset-0 w-full h-full object-cover object-center"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/60 via-black/30 to-black/70" />

        <div className="relative z-10 p-10 animate-in fade-in slide-in-from-top-4 duration-700">
          <div className="flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-black/30">
              <Building2 className="h-6 w-6 text-primary-foreground" />
            </div>
            <span className="text-2xl font-black tracking-tight drop-shadow-md">
              Sunrise Housing
            </span>
          </div>
        </div>

        <div className="relative z-10 flex-1 flex items-end p-10 pb-16 animate-in fade-in slide-in-from-left-8 duration-700 delay-150">
          <div>
            <h2 className="text-4xl font-extrabold leading-tight mb-3 drop-shadow-lg">
              {isAr ? "نظام إدارة سكن الموظفين" : "Staff Housing Management"}
            </h2>
            <p className="text-white/75 text-lg leading-relaxed max-w-md drop-shadow">
              {isAr
                ? "المنصة المتكاملة لإدارة التسكين، الحجوزات، والصيانة عبر جميع فروع ومنشآت سانرايز."
                : "The unified platform for managing accommodations, reservations, and maintenance across all Sunrise properties."}
            </p>
          </div>
        </div>

        <div className="relative z-10 p-10 pt-0 space-y-1 animate-in fade-in duration-700 delay-300">
          <p className="text-sm text-white/50 font-medium">
            &copy; {new Date().getFullYear()} Sunrise Resorts & Cruises.{" "}
            {isAr ? "جميع الحقوق محفوظة." : "All rights reserved."}
          </p>
          <p className="text-xs text-primary font-bold tracking-wide drop-shadow">
            {isAr
              ? "تصميم وتطوير: م. محمد طارق"
              : "Built by Eng. Mohamed Tarek"}
          </p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-6 md:p-10 relative">
        <div className="w-full max-w-[400px] space-y-8">
          <div className="lg:hidden flex flex-col items-center gap-4 text-center mb-8">
            <div className="h-14 w-14 rounded-2xl bg-primary flex items-center justify-center shadow-lg shadow-primary/20">
              <Building2 className="h-7 w-7 text-primary-foreground" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">
                Sunrise Housing
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                {isAr ? "نظام إدارة السكن" : "Staff Housing Management"}
              </p>
            </div>
          </div>

          {logoutMsg && (
            <Alert variant="destructive" className="flex gap-2 items-start">
              <Clock className="h-4 w-4 shrink-0 mt-0.5" />
              <AlertDescription>{logoutMsg}</AlertDescription>
            </Alert>
          )}

          {lockoutMsg && (
            <Alert
              variant="destructive"
              className="border-red-400 bg-red-50 dark:bg-red-950/30"
            >
              <AlertDescription className="text-sm font-medium">
                {lockoutMsg.message}
              </AlertDescription>
            </Alert>
          )}

          {remainingAttempts && (
            <Alert className="border-amber-400 bg-amber-50 dark:bg-amber-950/30 text-amber-800 dark:text-amber-200">
              <AlertDescription className="text-sm font-medium">
                {isAr
                  ? `متبقي ${remainingAttempts.count} من أصل ${remainingAttempts.max} محاولات قبل قفل الحساب`
                  : `${remainingAttempts.count} of ${remainingAttempts.max} attempts remaining before account lockout`}
              </AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <h3 className="text-3xl font-bold tracking-tight text-foreground">
              {isAr ? "مرحباً بعودتك" : "Welcome back"}
            </h3>
            <p className="text-muted-foreground">
              {isAr
                ? "يرجى إدخال بيانات الدخول للمتابعة إلى لوحة التحكم"
                : "Please enter your details to sign in to your account"}
            </p>
          </div>

          <Form {...form}>
            <form
              method="post"
              autoComplete="on"
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-5"
            >
              <FormField
                control={form.control}
                name="username"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">
                      {isAr ? "اسم المستخدم" : "Username"}
                    </FormLabel>
                    <FormControl>
                      <Input
                        id="username"
                        name="username"
                        type="text"
                        placeholder={
                          isAr ? "أدخل اسم المستخدم" : "Enter your username"
                        }
                        autoComplete="username"
                        autoFocus
                        spellCheck={false}
                        autoCapitalize="none"
                        autoCorrect="off"
                        className="h-11 transition-all focus-visible:ring-primary/50"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="font-semibold">
                      {isAr ? "كلمة المرور" : "Password"}
                    </FormLabel>
                    <FormControl>
                      <div className="relative">
                        <KeyRound
                          className={`absolute ${isAr ? "right-3" : "left-3"} top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground`}
                        />
                        <Input
                          id="password"
                          name="password"
                          type={showPassword ? "text" : "password"}
                          placeholder="••••••••"
                          autoComplete="off"
                          className="h-11 transition-all focus-visible:ring-primary/50 pl-10 pr-10"
                          {...field}
                          value={undefined}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className={`absolute ${isAr ? "left-3" : "right-3"} top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1 rounded-md hover:bg-muted`}
                          tabIndex={-1}
                          aria-label={
                            showPassword
                              ? isAr
                                ? "إخفاء كلمة المرور"
                                : "Hide password"
                              : isAr
                                ? "إظهار كلمة المرور"
                                : "Show password"
                          }
                        >
                          {showPassword ? (
                            <EyeOff className="h-4 w-4" />
                          ) : (
                            <Eye className="h-4 w-4" />
                          )}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="flex items-center justify-between pt-1">
                <label
                  htmlFor="keep-logged"
                  className="flex items-center gap-2 cursor-pointer group"
                >
                  <Checkbox
                    checked={keepLoggedIn}
                    onCheckedChange={(v) => setKeepLoggedIn(!!v)}
                    id="keep-logged"
                    className="data-[state=checked]:bg-primary"
                  />
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors select-none">
                    {isAr ? "تذكرني" : "Remember me"}
                  </span>
                </label>
                <button
                  type="button"
                  onClick={() =>
                    toast.info(
                      isAr ? "هل نسيت كلمة المرور؟" : "Forgot Password?",
                      {
                        description: isAr
                          ? "يرجى التواصل مع مسؤول النظام لإعادة التعيين."
                          : "Please contact your system administrator to reset.",
                      },
                    )
                  }
                  className="text-sm font-semibold text-primary hover:text-primary/80 transition-colors"
                >
                  {isAr ? "نسيت كلمة المرور؟" : "Forgot password?"}
                </button>
              </div>

              <Button
                type="submit"
                className="w-full h-11 text-base font-bold shadow-md hover:shadow-lg transition-all"
                disabled={loginMutation.isPending}
              >
                {loginMutation.isPending ? (
                  <span className="flex items-center">
                    <Loader
                      className={isAr ? "ml-2 h-4 w-4" : "mr-2 h-4 w-4"}
                    />
                    {isAr ? "جاري الدخول..." : "Signing in..."}
                  </span>
                ) : isAr ? (
                  "تسجيل الدخول"
                ) : (
                  "Sign In"
                )}
              </Button>
            </form>
          </Form>

          <div className="pt-6 flex justify-center border-t border-border/50">
            <Button
              variant="outline"
              size="sm"
              className="rounded-full px-4 h-9 border-border/50 hover:bg-muted/50 gap-2 font-medium"
              onClick={() => setLanguage(isAr ? "en" : "ar")}
            >
              <Globe className="w-4 h-4 text-primary" />
              {isAr ? "Switch to English" : "التصفح بالعربية"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
