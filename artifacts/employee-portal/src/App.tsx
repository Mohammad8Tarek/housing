import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { createSyncStoragePersister } from "@tanstack/query-sync-storage-persister";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./lib/theme";
import { PWAProvider } from "./lib/pwa";
import translations from "./lib/translations";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppToaster } from "./components/AppToaster";
import { PageTransition } from "./components/PageTransition";
import Login from "./pages/login";
import ForgotPassword from "./pages/forgot-password";
import Dashboard from "./pages/dashboard";
import ChangePassword from "./pages/change-password";
import RequestDetails from "./pages/request-details";
import BiometricLockScreen from "./components/BiometricLockScreen";
import { useEffect, useState, useRef, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch, clearSessionCache, setCachedSessionId } from "./lib/api";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

// ─── Query Client with aggressive caching ───────────────────────────────────
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60_000,       // data stays fresh 5 min
      gcTime: 24 * 60 * 60_000,    // keep in memory 24 h (for persistence)
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

// ─── LocalStorage persister for offline / instant-load caching ───────────────
const localStoragePersister = createSyncStoragePersister({
  storage: typeof window !== "undefined" ? window.localStorage : undefined,
  key: "SUNRISE_PORTAL_QUERY_CACHE",
  throttleTime: 1000,
});

// ─── AuthGuard ───────────────────────────────────────────────────────────────
// IMPORTANT: We do NOT include `biometric` in the checkAuth useCallback deps.
// The biometric hook updates its state after mount which previously caused a
// second re-run of checkAuth → double API call → race condition → logout.
// We read biometric state directly from Preferences inside checkAuth instead.

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const wasBackground = useRef(false);
  const authDone = useRef(false); // prevent double-run in StrictMode

  const checkAuth = useCallback(async () => {
    if (authDone.current) return;
    authDone.current = true;

    try {
      if (isNative) {
        // session_only flag → user chose rememberMe=false → don't auto-login on cold start
        const { value: sessionOnly } = await Preferences.get({ key: "login_session_only" });
        if (sessionOnly === "true") {
          const hasCurrent = sessionStorage.getItem("portal_employee");
          if (!hasCurrent) {
            await Preferences.remove({ key: "portal_employee" });
            await Preferences.remove({ key: "session_id" });
            await Preferences.remove({ key: "login_session_only" });
            clearSessionCache();
            setChecking(false);
            setLocation("/login");
            return;
          }
        }

        const { value: empJson } = await Preferences.get({ key: "portal_employee" });
        if (!empJson) {
          clearSessionCache();
          setChecking(false);
          setLocation("/login");
          return;
        }
        sessionStorage.setItem("portal_employee", empJson);

        const { value: sid } = await Preferences.get({ key: "session_id" });
        if (sid) {
          sessionStorage.setItem("session_id", sid);
          setCachedSessionId(sid);
        }
      } else {
        const empJson =
          sessionStorage.getItem("portal_employee") ||
          localStorage.getItem("portal_employee");
        if (!empJson) {
          clearSessionCache();
          setChecking(false);
          setLocation("/login");
          return;
        }
        sessionStorage.setItem("portal_employee", empJson);
        const sid =
          sessionStorage.getItem("session_id") ||
          localStorage.getItem("session_id");
        if (sid) {
          sessionStorage.setItem("session_id", sid);
          setCachedSessionId(sid);
        }
      }

      // Verify session with backend (single call, no retry here)
      try {
        const res = await apiFetch("/api/portal-auth/me");
        if (res.status === 401 || res.status === 403) {
          clearSessionCache();
          setChecking(false);
          setLocation("/login");
          return;
        }
        // Any other status (200, network error handled below) → allow in
      } catch {
        // Network offline → use cached data, allow in
        const hasLocal =
          sessionStorage.getItem("portal_employee") ||
          localStorage.getItem("portal_employee");
        if (!hasLocal) {
          clearSessionCache();
          setChecking(false);
          setLocation("/login");
          return;
        }
      }

      // Check biometric lock for initial open — read Preferences directly (no hook dep)
      if (isNative) {
        try {
          const { value: useFingerprint } = await Preferences.get({ key: "login_use_fingerprint" });
          if (useFingerprint === "true") {
            const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
            const available = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
            if (available.isAvailable) {
              const creds = await NativeBiometric.getCredentials({ server: "com.sunrisehousing.portal" }).catch(() => null);
              if (creds) {
                setLocked(true);
                setChecking(false);
                return;
              }
            }
          }
        } catch {
          // Biometric not available — skip lock
        }
      }

      setChecking(false);

      // Register push notifications after successful auth (fire-and-forget)
      if (isNative) {
        import("@capacitor/push-notifications").then(({ PushNotifications }) => {
          PushNotifications.requestPermissions().then(() => PushNotifications.register());
          PushNotifications.addListener("registration", (token) => {
            apiFetch("/api/push/register-device", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ token: token.value, platform: "android" }),
            }).catch(() => {});
          });
          PushNotifications.addListener("pushNotificationReceived", (n) => {
            console.log("[push] received:", n.title);
          });
        }).catch(() => {});
      }
    } catch {
      setChecking(false);
      setLocation("/login");
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isNative, setLocation]); // NOT including biometric — see note above

  // Run once on mount
  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Re-lock biometric on app resume
  useEffect(() => {
    if (!isNative) return;

    const handleVisibility = async () => {
      if (document.visibilityState === "hidden") {
        wasBackground.current = true;
      } else if (document.visibilityState === "visible" && wasBackground.current) {
        wasBackground.current = false;
        try {
          const { value: useFingerprint } = await Preferences.get({ key: "login_use_fingerprint" });
          if (useFingerprint === "true") {
            const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
            const available = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
            if (available.isAvailable) {
              const creds = await NativeBiometric.getCredentials({ server: "com.sunrisehousing.portal" }).catch(() => null);
              if (creds) setLocked(true);
            }
          }
        } catch {}
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isNative]);

  if (checking) {
    return (
      <div className="min-h-dvh bg-[#0c0e14] flex items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <div className="w-16 h-16 rounded-[18px] bg-[#18B0BB]/10 border border-[#18B0BB]/20 flex items-center justify-center">
            <svg viewBox="0 0 100 100" width="40" height="40" fill="none">
              <circle cx="50" cy="52" r="22" fill="#18B0BB" opacity="0.9" />
              <line x1="15" y1="70" x2="85" y2="70" stroke="#18B0BB" strokeWidth="3.5" strokeLinecap="round" />
              <path d="M50 30 Q50 10 72 22" stroke="#18B0BB" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
              <path d="M50 30 Q50 10 28 22" stroke="#18B0BB" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.6" />
            </svg>
          </div>
          <Loader2 className="w-6 h-6 animate-spin text-[#18B0BB]" />
        </div>
      </div>
    );
  }

  if (locked) {
    return (
      <BiometricLockScreen
        onUnlocked={() => setLocked(false)}
        onFailed={() => {
          clearSessionCache();
          setLocked(false);
          setLocation("/login");
        }}
      />
    );
  }

  return <>{children}</>;
}

// ─── Routes ───────────────────────────────────────────────────────────────────
function AnimatedRoutes() {
  const [location] = useLocation();
  const routeSlug = location.split("/")[0] || "root";

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={routeSlug} pageKey={routeSlug}>
        <Switch location={location}>
          <Route path="/login" component={Login} />
          <Route path="/forgot-password" component={ForgotPassword} />
          <Route path="/change-password" component={ChangePassword} />
          <Route path="/dashboard">
            <AuthGuard>
              <Dashboard />
            </AuthGuard>
          </Route>
          <Route path="/request-details">
            <AuthGuard>
              <RequestDetails />
            </AuthGuard>
          </Route>
          <Route path="/">
            <Redirect to="/login" />
          </Route>
        </Switch>
      </PageTransition>
    </AnimatePresence>
  );
}

// ─── Root App ─────────────────────────────────────────────────────────────────
function App() {
  return (
    <ErrorBoundary>
      <PersistQueryClientProvider
        client={queryClient}
        persistOptions={{
          persister: localStoragePersister,
          maxAge: 24 * 60 * 60 * 1000, // cache survives 24 h
          buster: "v1",
        }}
      >
        <PWAProvider>
          <ThemeProvider translations={translations}>
            <AnimatedRoutes />
            <AppToaster />
          </ThemeProvider>
        </PWAProvider>
      </PersistQueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
