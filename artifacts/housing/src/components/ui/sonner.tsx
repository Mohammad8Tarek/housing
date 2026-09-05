// @ts-nocheck
"use client";

import * as React from "react";
import { useTheme } from "next-themes";
import { Toaster as Sonner } from "sonner";
import { useLanguage } from "@/context/LanguageContext";
import { CheckCircle2, AlertCircle, AlertTriangle, Info, Loader2 } from "lucide-react";

type ToasterProps = React.ComponentProps<typeof Sonner>;

const Toaster = ({ ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme();
  let ar = false;
  try {
    const langContext = useLanguage();
    ar = langContext.language === "ar";
  } catch {}

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      dir={ar ? "rtl" : "ltr"}
      position={ar ? "top-left" : "top-right"}
      className="toaster group"
      closeButton
      duration={4000}
      gap={10}
      icons={{
        success: (
          <div className="w-8 h-8 rounded-xl bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center shrink-0 shadow-xs">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        ),
        error: (
          <div className="w-8 h-8 rounded-xl bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center shrink-0 shadow-xs">
            <AlertCircle className="w-5 h-5" />
          </div>
        ),
        warning: (
          <div className="w-8 h-8 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center shrink-0 shadow-xs">
            <AlertTriangle className="w-5 h-5" />
          </div>
        ),
        info: (
          <div className="w-8 h-8 rounded-xl bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center shrink-0 shadow-xs">
            <Info className="w-5 h-5" />
          </div>
        ),
        loading: (
          <div className="w-8 h-8 rounded-xl bg-primary/15 text-primary flex items-center justify-center shrink-0 shadow-xs">
            <Loader2 className="w-5 h-5 animate-spin" />
          </div>
        ),
      }}
      toastOptions={{
        classNames: {
          toast:
            "group toast group-[.toaster]:bg-card/95 group-[.toaster]:text-foreground group-[.toaster]:border-border/80 group-[.toaster]:shadow-2xl group-[.toaster]:rounded-2xl group-[.toaster]:backdrop-blur-xl group-[.toaster]:p-4",
          description: "group-[.toast]:text-muted-foreground group-[.toast]:text-xs group-[.toast]:mt-1 group-[.toast]:leading-relaxed",
          title: "group-[.toast]:text-sm group-[.toast]:font-bold group-[.toast]:text-foreground",
          actionButton:
            "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground group-[.toast]:rounded-xl group-[.toast]:font-semibold group-[.toast]:text-xs",
          cancelButton:
            "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground group-[.toast]:rounded-xl group-[.toast]:text-xs",
          closeButton:
            "group-[.toast]:bg-muted/80 hover:group-[.toast]:bg-muted group-[.toast]:text-muted-foreground hover:group-[.toast]:text-foreground group-[.toast]:border-border/60",
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
export default Toaster;
