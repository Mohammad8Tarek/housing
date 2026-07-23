import React, { createContext, useContext, useEffect, useState } from "react";

type Lang = "ar" | "en";
type Theme = "dark" | "light";

interface ThemeContextType {
  lang: Lang;
  theme: Theme;
  setLang: (l: Lang) => void;
  setTheme: (t: Theme) => void;
  toggleLang: () => void;
  toggleTheme: () => void;
  t: (key: string) => string;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function getInitialLang(): Lang {
  if (typeof window === "undefined") return "ar";
  return (localStorage.getItem("portal_lang") as Lang) || "ar";
}

function getInitialTheme(): Theme {
  if (typeof window === "undefined") return "dark";
  return (localStorage.getItem("portal_theme") as Theme) || "dark";
}

export function ThemeProvider({
  children,
  translations,
}: {
  children: React.ReactNode;
  translations: Record<string, { ar: string; en: string }>;
}) {
  const [lang, setLangState] = useState<Lang>(getInitialLang);
  const [theme, setThemeState] = useState<Theme>(getInitialTheme);

  const setLang = (l: Lang) => {
    setLangState(l);
    localStorage.setItem("portal_lang", l);
  };
  const setTheme = (t: Theme) => {
    setThemeState(t);
    localStorage.setItem("portal_theme", t);
  };
  const toggleLang = () => setLang(lang === "ar" ? "en" : "ar");
  const toggleTheme = () => setTheme(theme === "dark" ? "light" : "dark");

  const t = (key: string) => {
    const entry = translations[key];
    if (!entry) return key;
    return entry[lang] || key;
  };

  useEffect(() => {
    document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
    document.documentElement.classList.toggle("light", theme === "light");
  }, [theme]);

  return (
    <ThemeContext.Provider
      value={{ lang, theme, setLang, setTheme, toggleLang, toggleTheme, t }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
