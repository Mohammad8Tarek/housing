export {};

export interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

declare global {
  interface Window {
    deferredPrompt?: BeforeInstallPromptEvent | null;
    webkitAudioContext?: typeof AudioContext;
    PasswordCredential?: new (data: any) => any;
  }

  interface Navigator {
    standalone?: boolean;
  }
}
