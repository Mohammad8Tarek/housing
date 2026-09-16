import React, { createContext, useContext, useState, useEffect } from "react";

interface PWAContextType {
  installPrompt: any;
  isInstalled: boolean;
  handleInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  installPrompt: null,
  isInstalled: false,
  handleInstall: async () => {},
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<any>(() => {
    if (typeof window !== "undefined" && window.deferredPrompt) {
      return window.deferredPrompt;
    }
    return null;
  });

  const [isInstalled, setIsInstalled] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return (
      window.matchMedia("(display-mode: standalone)").matches ||
      window.navigator.standalone === true
    );
  });

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      window.deferredPrompt = e as any;
      setInstallPrompt(e);
    };

    const handlePromptReady = () => {
      if (window.deferredPrompt) {
        setInstallPrompt(window.deferredPrompt);
      }
    };

    const handleAppInstalled = () => {
      window.deferredPrompt = null;
      setInstallPrompt(null);
      setIsInstalled(true);
    };

    window.addEventListener("beforeinstallprompt", handler);
    window.addEventListener("pwa-prompt-ready", handlePromptReady);
    window.addEventListener("appinstalled", handleAppInstalled);
    window.addEventListener("pwa-app-installed", handleAppInstalled);

    return () => {
      window.removeEventListener("beforeinstallprompt", handler);
      window.removeEventListener("pwa-prompt-ready", handlePromptReady);
      window.removeEventListener("appinstalled", handleAppInstalled);
      window.removeEventListener("pwa-app-installed", handleAppInstalled);
    };
  }, []);

  const handleInstall = async () => {
    const promptEvent = installPrompt || (typeof window !== "undefined" ? window.deferredPrompt : null);
    if (!promptEvent) return;
    try {
      if (typeof promptEvent.prompt === "function") {
        promptEvent.prompt();
        const r = await promptEvent.userChoice;
        if (r && r.outcome === "accepted") {
          window.deferredPrompt = null;
          setInstallPrompt(null);
          setIsInstalled(true);
        }
      }
    } catch {
      // User dismissed prompt or browser refused install
    }
  };

  return (
    <PWAContext.Provider value={{ installPrompt, isInstalled, handleInstall }}>
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  return useContext(PWAContext);
}
