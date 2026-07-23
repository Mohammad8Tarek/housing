import React, { useState, useEffect } from "react";
import { useLocation } from "wouter";
import {
  Lock,
  Eye,
  EyeOff,
  Loader2,
  ShieldCheck,
  ChevronRight,
  ChevronLeft,
  Languages,
  Sun,
  Moon,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { apiFetch } from "../lib/api";

export default function ChangePassword() {
  const [, setLocation] = useLocation();
  const { t, lang, toggleLang, toggleTheme, theme } = useTheme();
  const isRtl = lang === "ar";
  const [employee, setEmployee] = useState<any>(null);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    let cancelled = false;

    const bootstrap = async () => {
      try {
        const res = await apiFetch("/api/portal-auth/me", {
          credentials: "include",
        });
        if (res.status === 401 || res.status === 403) {
          sessionStorage.removeItem("portal_employee");
          setLocation("/login");
          return;
        }

        const data = await res.json();
        if (!data.success || !data.employee) {
          sessionStorage.removeItem("portal_employee");
          setLocation("/login");
          return;
        }

        sessionStorage.setItem(
          "portal_employee",
          JSON.stringify(data.employee),
        );
        if (!data.mustChangePassword) {
          setLocation("/dashboard");
          return;
        }

        if (!cancelled) setEmployee(data.employee);
      } catch {
        const stored = sessionStorage.getItem("portal_employee");
        if (stored && !cancelled) {
          setEmployee(JSON.parse(stored));
          return;
        }

        sessionStorage.removeItem("portal_employee");
        setLocation("/login");
      }
    };

    bootstrap();
    return () => {
      cancelled = true;
    };
  }, [setLocation]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (newPassword !== confirmPassword) {
      setError(t("changepw.matchError"));
      return;
    }
    if (newPassword.length < 6) {
      setError(t("changepw.lengthError"));
      return;
    }
    setIsLoading(true);
    setError("");
    try {
      const res = await apiFetch("/api/portal-auth/first-login-reset", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setSuccess(true);
      setTimeout(() => setLocation("/dashboard"), 2000);
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  if (!employee) return null;
  const ChevronIcon = isRtl ? ChevronLeft : ChevronRight;

  return (
    <div className="min-h-screen bg-surface2 flex items-center justify-center p-4 relative overflow-hidden">
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-1/3 start-1/3 w-96 h-96 bg-accent2 opacity-[0.04] blur-[120px] rounded-full" />
      </div>

      <div className="fixed top-4 end-4 z-50 flex items-center gap-2">
        <button
          onClick={toggleLang}
          className="p-2.5 rounded-xl bg-card border border-border2 text-muted2 hover:text-foreground transition-all"
        >
          <Languages className="w-4 h-4" />
        </button>
        <button
          onClick={toggleTheme}
          className="p-2.5 rounded-xl bg-card border border-border2 text-muted2 hover:text-foreground transition-all"
        >
          {theme === "dark" ? (
            <Sun className="w-4 h-4" />
          ) : (
            <Moon className="w-4 h-4" />
          )}
        </button>
      </div>

      <div className="w-full max-w-[440px] bg-card border border-border2 rounded-[28px] p-8 shadow-2xl relative z-10">
        <div className="w-14 h-14 bg-accent2/10 border border-accent2/20 rounded-2xl flex items-center justify-center mb-6 mx-auto">
          <ShieldCheck className="w-7 h-7 text-accent2" />
        </div>

        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {t("changepw.title")}
          </h1>
          <p className="text-muted2 text-sm leading-relaxed px-2">
            {t("changepw.welcome").replace("{name}", employee.fullName)}
          </p>
        </div>

        {error && (
          <div className="mb-5 p-4 bg-destructive/10 border border-destructive/30 text-destructive text-sm rounded-2xl">
            ⚠ {error}
          </div>
        )}
        {success && (
          <div className="mb-5 p-4 bg-green-950/20 border border-green-900/50 text-green-400 text-sm rounded-2xl text-center">
            ✓ {t("changepw.success")}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted2 block mb-2">
              {t("changepw.newPassword")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-border2 text-foreground rounded-xl py-3.5 ps-11 pe-11 focus:border-accent2 outline-none transition-colors placeholder:opacity-30"
                required
              />
              <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted2" />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute end-4 top-1/2 -translate-y-1/2 text-muted2 hover:text-foreground transition-colors p-1"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="text-[11px] font-bold uppercase tracking-widest text-muted2 block mb-2">
              {t("changepw.confirmPassword")}
            </label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-surface border border-border2 text-foreground rounded-xl py-3.5 ps-11 pe-4 focus:border-accent2 outline-none transition-colors placeholder:opacity-30"
                required
              />
              <Lock className="absolute start-4 top-1/2 -translate-y-1/2 w-4 h-4 text-muted2" />
            </div>
          </div>

          <button
            type="submit"
            disabled={isLoading || success}
            className="w-full bg-accent2 text-accent2-foreground font-bold py-3.5 rounded-xl hover:scale-[1.01] active:scale-100 transition-all disabled:opacity-50 mt-2 flex items-center justify-center gap-2"
          >
            {isLoading ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <>
                {t("changepw.update")} <ChevronIcon className="w-4 h-4" />
              </>
            )}
          </button>
        </form>

        <p className="mt-6 text-center text-[10px] text-muted2 uppercase tracking-widest leading-relaxed">
          {t("changepw.securityNote")}
        </p>
      </div>
    </div>
  );
}
