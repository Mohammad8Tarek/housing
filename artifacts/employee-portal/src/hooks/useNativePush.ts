/**
 * useNativePush — registers the Capacitor app with FCM and persists the
 * device token on the server (POST /api/push/register-device) so the backend
 * can wake the phone with native push. No-op on the web build.
 */
import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";
import { toast } from "sonner";
import { apiFetch } from "../lib/api";

const TOKEN_STORAGE_KEY = "fcm_device_token";
const CHANNEL_ID = "sunrise_default";

function readStoredToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_STORAGE_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: string | null) {
  try {
    if (token) localStorage.setItem(TOKEN_STORAGE_KEY, token);
    else localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    /* storage unavailable */
  }
}

async function registerToken(token: string): Promise<void> {
  const platform = Capacitor.getPlatform() === "ios" ? "ios" : "android";
  const res = await apiFetch("/api/push/register-device", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ token, platform }),
  });
  if (res.ok) storeToken(token);
}

/** Call before clearing the session on logout so the device stops receiving this account's pushes. */
export async function unregisterNativePush(): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;
  const token = readStoredToken();
  if (!token) return;
  try {
    await apiFetch("/api/push/unregister-device", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ token }),
    });
  } catch {
    /* best effort */
  } finally {
    storeToken(null);
  }
}

interface Options {
  /** Only register once the user is authenticated. */
  enabled: boolean;
  /** Invoked when the user taps a notification; receives the `url` sent by the server. */
  onOpen?: (url: string) => void;
}

export function useNativePush({ enabled, onOpen }: Options) {
  useEffect(() => {
    if (!enabled || !Capacitor.isNativePlatform()) return;

    let cancelled = false;
    const handles: Array<{ remove: () => Promise<void> }> = [];

    (async () => {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");

        const perm = await PushNotifications.checkPermissions();
        const status =
          perm.receive === "granted" ? perm : await PushNotifications.requestPermissions();
        if (status.receive !== "granted" || cancelled) return;

        if (Capacitor.getPlatform() === "android") {
          await PushNotifications.createChannel({
            id: CHANNEL_ID,
            name: "Sunrise Housing",
            description: "إشعارات سكن صن رايز / Sunrise Housing notifications",
            importance: 5,
            visibility: 1,
            vibration: true,
          }).catch(() => {});
        }

        handles.push(
          await PushNotifications.addListener("registration", (token) => {
            if (cancelled || !token?.value) return;
            if (token.value !== readStoredToken()) {
              registerToken(token.value).catch(() => {});
            }
          }),
          await PushNotifications.addListener("registrationError", (err) => {
            console.warn("[push] FCM registration error", err);
          }),
          await PushNotifications.addListener("pushNotificationReceived", (n) => {
            // App is in the foreground: surface it in-app.
            if (n.title || n.body) toast(n.title || "", { description: n.body });
          }),
          await PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
            const url = (action.notification?.data as Record<string, string> | undefined)?.url;
            if (url && onOpen) onOpen(url);
          }),
        );

        await PushNotifications.register();
      } catch (err) {
        console.warn("[push] native push unavailable", err);
      }
    })();

    return () => {
      cancelled = true;
      handles.forEach((h) => h.remove().catch(() => {}));
    };
    // onOpen is intentionally excluded: listeners read the latest closure only on tap.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled]);
}
