import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { App as CapApp } from "@capacitor/app";
import { toast } from "sonner";

interface BackButtonOptions {
  activeTab?: string;
  onTabChange?: (tab: string) => void;
  isChatOpen?: boolean;
  isModalOpen?: boolean;
  onCloseModal?: () => void;
  currentPath?: string;
  onNavigate?: (path: string) => void;
  isRtl?: boolean;
}

export function useBackButton({
  activeTab = "overview",
  onTabChange,
  isChatOpen = false,
  isModalOpen = false,
  onCloseModal,
  currentPath = "/dashboard",
  onNavigate,
  isRtl = true,
}: BackButtonOptions) {
  const lastPressRef = useRef<number>(0);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;

    let listenerHandle: any = null;

    const setupListener = async () => {
      try {
        listenerHandle = await CapApp.addListener("backButton", ({ canGoBack }) => {
          // 1. If custom modal is open, close it
          if (isModalOpen && onCloseModal) {
            onCloseModal();
            return;
          }

          // 2. If inside a chat conversation or new chat screen, close it
          if (isChatOpen) {
            window.dispatchEvent(new CustomEvent("portal_chat_close"));
            return;
          }

          // 3. If on a sub-route (e.g., /request-details, /change-password), navigate back to /dashboard
          if (currentPath !== "/dashboard" && currentPath !== "/login") {
            if (onNavigate) {
              onNavigate("/dashboard");
            } else if (canGoBack) {
              window.history.back();
            }
            return;
          }

          // 4. If in /dashboard and not on overview tab, switch to overview
          if (currentPath === "/dashboard" && activeTab !== "overview" && onTabChange) {
            onTabChange("overview");
            return;
          }

          // 5. On overview tab: require double press within 2s to exit app
          const now = Date.now();
          if (now - lastPressRef.current < 2000) {
            CapApp.exitApp();
          } else {
            lastPressRef.current = now;
            toast(isRtl ? "اضغط مرة أخرى للخروج من التطبيق" : "Press back again to exit app", {
              duration: 2000,
            });
          }
        });
      } catch {
        /* ignore */
      }
    };

    setupListener();

    return () => {
      if (listenerHandle) {
        listenerHandle.remove().catch(() => {});
      }
    };
  }, [
    activeTab,
    onTabChange,
    isChatOpen,
    isModalOpen,
    onCloseModal,
    currentPath,
    onNavigate,
    isRtl,
  ]);
}
