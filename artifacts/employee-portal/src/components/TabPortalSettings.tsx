import { useState, useEffect } from "react";
import {
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from "lucide-react";
import { useTheme } from "../lib/theme";
import { usePWA } from "../lib/pwa";
import { apiFetch, clearSessionCache } from "../lib/api";
import { useLocation } from "wouter";
import { Preferences } from "@capacitor/preferences";
import { Capacitor } from "@capacitor/core";
import MaterialIcon from "./MaterialIcon";
import { useBiometric } from "../hooks/useBiometric";

const isNative = Capacitor.isNativePlatform();

export default function TabPortalSettings() {
  const { t, lang, setLang, setTheme, theme } = useTheme();
  const isRtl = lang === "ar";
  const [, setLocation] = useLocation();
  const { installPrompt, handleInstall } = usePWA();
  const biometric = useBiometric();

  const [cpForm, setCpForm] = useState({
    currentPassword: "",
    newPassword: "",
    confirmPassword: "",
  });
  const [showPw, setShowPw] = useState(false);
  const [cpStatus, setCpStatus] = useState<
    "idle" | "loading" | "success" | "error"
  >("idle");
  const [cpMsg, setCpMsg] = useState("");
  const [bioEnabled, setBioEnabled] = useState(false);

  useEffect(() => {
    if (biometric.isAvailable) {
      biometric
        .getCredentials()
        .then((creds) => setBioEnabled(!!creds))
        .catch(() => {});
    }
  }, [biometric]);

  useEffect(() => {
    if (installPrompt) {
      handleInstall();
    }
  }, [installPrompt]);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (cpForm.newPassword !== cpForm.confirmPassword) {
      setCpStatus("error");
      setCpMsg(t("changepw.matchError"));
      return;
    }
    if (cpForm.newPassword.length < 6) {
      setCpStatus("error");
      setCpMsg(t("changepw.lengthError"));
      return;
    }
    setCpStatus("loading");
    setCpMsg("");
    try {
      const res = await apiFetch("/api/portal-auth/change-password", {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cpForm),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || "Failed");
      setCpStatus("success");
      setCpMsg(t("changepw.success"));
      setCpForm({ currentPassword: "", newPassword: "", confirmPassword: "" });
      setTimeout(() => setCpStatus("idle"), 3000);
    } catch (err: any) {
      setCpStatus("error");
      setCpMsg(err.message);
    }
  };

  const handleLogout = () => {
    clearSessionCache();
    setLocation("/login");
  };

  const handleBiometricToggle = async () => {
    if (!biometric.isAvailable) return;
    if (bioEnabled) {
      await biometric.deleteCredentials();
      setBioEnabled(false);
    } else {
      setCpStatus("error");
      setCpMsg(
        isRtl
          ? "سجّل الدخول أولاً لتفعيل البصمة"
          : "Login first to enable biometric",
      );
      setTimeout(() => setCpStatus("idle"), 3000);
    }
  };

  return (
    <div className="px-4 pt-4 pb-4 space-y-4">
      <div>
        <h2
          className="text-xl font-bold text-foreground"
          style={{ fontFamily: "'Playfair Display', serif" }}
        >
          {isRtl ? "الإعدادات والأمان" : "Settings & Security"}
        </h2>
        <p className="text-[11px] text-muted2 mt-0.5">
          {isRtl
            ? "إدارة تفضيلات الحساب وإعدادات الأمان"
            : "Manage your account preferences and security protocols."}
        </p>
      </div>

      {cpStatus === "success" && (
        <div className="flex items-center gap-2 p-3 bg-green-400/10 border border-green-400/20 rounded-xl text-green-400 text-[12px]">
          <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
          {cpMsg}
        </div>
      )}
      {cpStatus === "error" && (
        <div className="flex items-center gap-2 p-3 bg-red-400/10 border border-red-400/20 rounded-xl text-red-400 text-[12px]">
          <AlertCircle className="w-4 h-4 flex-shrink-0" />
          {cpMsg}
        </div>
      )}

      {/* Account Security */}

      {/* Preferences Section */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MaterialIcon icon="settings" size={18} className="text-accent2" />
          {isRtl ? "التفضيلات" : "Preferences"}
        </h3>
        <div className="bg-card border border-border2 rounded-xl divide-y divide-border2">
          {/* Language Switcher */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                <MaterialIcon
                  icon="language"
                  size={16}
                  className="text-muted2"
                />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-foreground">
                  {isRtl ? "اللغة" : "Language"}
                </div>
                <div className="text-[10px] text-muted2">
                  {isRtl ? "الإنجليزية" : "English"}
                </div>
              </div>
            </div>
            <div className="flex bg-surface rounded-lg p-1 border border-border2">
              <button
                onClick={() => setLang("en")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  !isRtl
                    ? "bg-accent2 text-accent2-foreground shadow-sm"
                    : "text-muted2 hover:text-foreground"
                }`}
              >
                EN
              </button>
              <button
                onClick={() => setLang("ar")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  isRtl
                    ? "bg-accent2 text-accent2-foreground shadow-sm"
                    : "text-muted2 hover:text-foreground"
                }`}
              >
                عربي
              </button>
            </div>
          </div>

          {/* Theme Switcher */}
          <div className="px-4 py-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                <MaterialIcon
                  icon="palette"
                  size={16}
                  className="text-muted2"
                />
              </div>
              <div>
                <div className="text-[12px] font-semibold text-foreground">
                  {isRtl ? "المظهر" : "Theme"}
                </div>
                <div className="text-[10px] text-muted2">
                  {theme === "dark"
                    ? isRtl
                      ? "داكن"
                      : "Dark"
                    : isRtl
                      ? "فاتح"
                      : "Light"}
                </div>
              </div>
            </div>
            <div className="flex bg-surface rounded-lg p-1 border border-border2">
              <button
                onClick={() => setTheme("light")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  theme === "light"
                    ? "bg-accent2 text-accent2-foreground shadow-sm"
                    : "text-muted2 hover:text-foreground"
                }`}
              >
                {isRtl ? "فاتح" : "Light"}
              </button>
              <button
                onClick={() => setTheme("dark")}
                className={`px-3 py-1.5 rounded-md text-[10px] font-bold transition-all ${
                  theme === "dark"
                    ? "bg-accent2 text-accent2-foreground shadow-sm"
                    : "text-muted2 hover:text-foreground"
                }`}
              >
                {isRtl ? "داكن" : "Dark"}
              </button>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MaterialIcon
            icon="manage_accounts"
            size={18}
            className="text-accent2"
          />
          {t("settings.security")}
        </h3>
        <div className="bg-card border border-border2 rounded-xl divide-y divide-border2">
          <div className="px-4 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                  <MaterialIcon icon="lock" size={16} className="text-muted2" />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-foreground">
                    {t("settings.password")}
                  </div>
                  <div className="text-[10px] text-muted2">
                    {t("settings.lastChanged")}
                  </div>
                </div>
              </div>
              <button
                onClick={() =>
                  setCpForm((f) => ({
                    ...f,
                    currentPassword: "",
                    newPassword: "",
                    confirmPassword: "",
                  }))
                }
                className="px-3 py-1.5 rounded-lg bg-accent2/10 text-accent2 text-[10px] font-bold hover:bg-accent2/20 transition-all"
              >
                {t("settings.update")}
              </button>
            </div>

            {/* Inline change password form */}
            {cpForm.currentPassword !== undefined && (
              <form
                onSubmit={handleChangePassword}
                className="mt-4 pt-4 border-t border-border2 space-y-3"
              >
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
                    {t("changepw.current")}
                  </label>
                  <div className="relative">
                    <input
                      type={showPw ? "text" : "password"}
                      onChange={(e) =>
                        setCpForm((f) => ({
                          ...f,
                          currentPassword: e.target.value,
                        }))
                      }
                      className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 pe-10 text-[13px] focus:outline-none focus:border-accent2/50"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPw(!showPw)}
                      className="absolute end-3 top-1/2 -translate-y-1/2 text-muted2 hover:text-foreground transition-colors p-1"
                    >
                      {showPw ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
                    {t("changepw.new")}
                  </label>
                  <input
                    type={showPw ? "text" : "password"}
                    onChange={(e) =>
                      setCpForm((f) => ({ ...f, newPassword: e.target.value }))
                    }
                    className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-accent2/50"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-semibold uppercase tracking-wider text-muted2 block mb-1">
                    {t("changepw.confirm")}
                  </label>
                  <input
                    type={showPw ? "text" : "password"}
                    onChange={(e) =>
                      setCpForm((f) => ({
                        ...f,
                        confirmPassword: e.target.value,
                      }))
                    }
                    className="w-full bg-surface border border-border2 text-foreground rounded-xl py-2.5 px-3 text-[13px] focus:outline-none focus:border-accent2/50"
                  />
                </div>
                <div className="flex gap-2">
                  <button
                    type="submit"
                    disabled={cpStatus === "loading"}
                    className="flex-1 py-2.5 rounded-xl bg-accent2 text-accent2-foreground text-[13px] font-bold hover:scale-[1.01] transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {cpStatus === "loading" ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Lock className="w-4 h-4" />
                    )}
                    {t("submit")}
                  </button>
                </div>
              </form>
            )}
          </div>

          {isNative && biometric.isAvailable && (
            <div className="flex items-center justify-between px-4 py-3.5">
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-surface flex items-center justify-center">
                  <MaterialIcon
                    icon="fingerprint"
                    size={16}
                    className="text-muted2"
                  />
                </div>
                <div>
                  <div className="text-[12px] font-semibold text-foreground">
                    {t("settings.biometric")}
                  </div>
                  <div className="text-[10px] text-muted2">
                    {t("settings.useFaceId")}
                  </div>
                </div>
              </div>
              <button
                onClick={handleBiometricToggle}
                className={`relative w-10 h-6 rounded-full transition-all ${bioEnabled ? "bg-accent2" : "bg-border2"}`}
              >
                <span
                  className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${bioEnabled ? "start-[18px]" : "start-0.5"}`}
                />
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Privacy & Data */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MaterialIcon
            icon="shield_person"
            size={18}
            className="text-accent2"
          />
          {t("settings.privacy")}
        </h3>
        <div className="bg-card border border-border2 rounded-xl p-4 mb-3">
          <p className="text-[11px] text-muted2 leading-relaxed">
            {t("settings.privacyDesc")}
          </p>
        </div>
        <div className="bg-card border border-border2 rounded-xl divide-y divide-border2">
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent2/5 transition-colors">
            <div className="flex items-center gap-3">
              <MaterialIcon icon="history" size={16} className="text-muted2" />
              <span className="text-[12px] text-foreground">
                {t("settings.loginActivity")}
              </span>
            </div>
            <MaterialIcon
              icon="chevron_right"
              size={16}
              className="text-muted2"
            />
          </button>
          <button className="w-full flex items-center justify-between px-4 py-3 hover:bg-accent2/5 transition-colors">
            <div className="flex items-center gap-3">
              <MaterialIcon icon="download" size={16} className="text-muted2" />
              <span className="text-[12px] text-foreground">
                {t("settings.exportData")}
              </span>
            </div>
            <MaterialIcon
              icon="chevron_right"
              size={16}
              className="text-muted2"
            />
          </button>
        </div>
      </div>

      {/* Appearance */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3">
          {t("settings.appearance")}
        </h3>
        <div className="grid grid-cols-2 gap-2.5"></div>
      </div>

      {/* Language */}
      <div>
        <h3 className="text-sm font-bold text-foreground mb-3 flex items-center gap-2">
          <MaterialIcon icon="language" size={18} className="text-accent2" />
          {t("settings.language")}
        </h3>
        <div className="grid grid-cols-2 gap-2.5"></div>
      </div>

      {/* Logout */}
      <button
        onClick={handleLogout}
        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl bg-red-400/10 border border-red-400/20 text-red-400 text-[13px] font-bold hover:bg-red-400/20 transition-all"
      >
        <MaterialIcon icon="logout" size={18} />
        {t("settings.logOut")}
      </button>

      <p
        className="text-center text-[13px] text-accent2/40 italic leading-relaxed px-4"
        style={{ fontFamily: "'Playfair Display', serif" }}
      >
        &ldquo;{t("settings.excellence")}&rdquo;
      </p>
    </div>
  );
}
