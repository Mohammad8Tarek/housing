import React, { createContext, useContext, useState, useEffect } from "react";

interface PWAContextType {
  installPrompt: Event | null;
  handleInstall: () => Promise<void>;
}

const PWAContext = createContext<PWAContextType>({
  installPrompt: null,
  handleInstall: async () => {},
});

export function PWAProvider({ children }: { children: React.ReactNode }) {
  const [installPrompt, setInstallPrompt] = useState<Event | null>(null);

  useEffect(() => {
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };
    window.addEventListener("beforeinstallprompt", handler);
    return () => window.removeEventListener("beforeinstallprompt", handler);
  }, []);

  const handleInstall = async () => {
    if (!installPrompt) return;
    const promptEvent = installPrompt as Event & {
      prompt: () => void;
      userChoice: Promise<{ outcome: string }>;
    };
    promptEvent.prompt();
    const r = await promptEvent.userChoice;
    if (r.outcome === "accepted") {
      setInstallPrompt(null);
    }
  };

  return (
    <PWAContext.Provider value={{ installPrompt, handleInstall }}>
      {children}
    </PWAContext.Provider>
  );
}

export function usePWA() {
  return useContext(PWAContext);
}
