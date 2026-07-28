import { Toaster } from "sonner";
import { useTheme } from "../lib/theme";

export function AppToaster() {
  const { lang } = useTheme();
  const rtl = lang === "ar";

  return (
    <Toaster
      position="top-center"
      dir={rtl ? "rtl" : "ltr"}
      richColors
      closeButton
      toastOptions={{
        style: {
          "--normal-bg": "var(--accent2, #f0a500)",
        } as React.CSSProperties,
        duration: 3000,
      }}
    />
  );
}
