import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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
import { useEffect, useState, useCallback, useRef } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch, clearSessionCache, setCachedSessionId } from "./lib/api";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";
import { useBiometric } from "./hooks/useBiometric";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      gcTime: 5 * 60_000,
      refetchOnWindowFocus: false,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);
  const [locked, setLocked] = useState(false);
  const isNative = Capacitor.isNativePlatform();
  const biometric = useBiometric();
  const wasBackground = useRef(false);

  const checkAuth = useCallback(async () => {
    try {
      if (isNative) {
        // If session_only flag set, this is a cold start - clear session and go to login
        const { value: sessionOnly } = await Preferences.get({ key: "login_session_only" });
        if (sessionOnly === "true") {
          // Clear for next cold start (but user already logged in this session via sessionStorage)
          const hasCurrent = sessionStorage.getItem("portal_employee");
          if (!hasCurrent) {
            // Cold start with no session - clear and go to login
            await Preferences.remove({ key: "portal_employee" });
            await Preferences.remove({ key: "session_id" });
            await Preferences.remove({ key: "login_session_only" });
            clearSessionCache();
            setLocation("/login");
            return;
          }
          // Already has session in memory - keep going
        }

        const { value: empJson } = await Preferences.get({ key: "portal_employee" });
        if (!empJson) {
          clearSessionCache();
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

      const res = await apiFetch("/api/portal-auth/me");
      if (!res.ok) {
        if (res.status === 401 || res.status === 403) {
          clearSessionCache();
          setLocation("/login");
          return;
        }
      }
    } catch {
      const hasStored =
        sessionStorage.getItem("portal_employee") ||
        localStorage.getItem("portal_employee");
      if (!hasStored) {
        clearSessionCache();
        setLocation("/login");
        return;
      }
    }

    // Check if biometric lock should be shown on first open
    if (isNative && biometric.isAvailable) {
      const { value: useFingerprint } = await Preferences.get({ key: "login_use_fingerprint" });
      const creds = await biometric.getCredentials();
      if (useFingerprint === "true" && creds) {
        setLocked(true);
        setChecking(false);
        return;
      }
    }

    setChecking(false);

    // Request permissions on native after auth check
    if (isNative) {
      try {
        const { PushNotifications } = await import("@capacitor/push-notifications");
        const { LocalNotifications } = await import("@capacitor/local-notifications");
        await PushNotifications.requestPermissions();
        await LocalNotifications.requestPermissions();

        // Register push and listen for notifications
        await PushNotifications.register();
        PushNotifications.addListener("registration", (token) => {
          console.log("FCM Token:", token.value);
          apiFetch("/api/push/register-device", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ token: token.value, platform: "android" }),
          }).catch(() => {});
        });
        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Push received:", notification);
        });
        PushNotifications.addListener("pushNotificationActionPerformed", (action) => {
          console.log("Push action:", action);
        });
      } catch (err) {
        console.error("Permission request failed", err);
      }
    }
  }, [isNative, biometric, setLocation]);

  // App resume biometric lock — use visibilitychange (works in Capacitor WebView)
  useEffect(() => {
    if (!isNative) return;

    const handleVisibility = async () => {
      if (document.visibilityState === "hidden") {
        wasBackground.current = true;
      } else if (document.visibilityState === "visible" && wasBackground.current) {
        wasBackground.current = false;
        // Re-lock when app comes to foreground
        const { value: useFingerprint } = await Preferences.get({ key: "login_use_fingerprint" });
        const creds = await biometric.getCredentials();
        if (useFingerprint === "true" && creds && biometric.isAvailable) {
          setLocked(true);
        }
      }
    };

    document.addEventListener("visibilitychange", handleVisibility);
    return () => {
      document.removeEventListener("visibilitychange", handleVisibility);
    };
  }, [isNative, biometric]);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

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
          <Route path="/tickets">
            <Redirect to="/login" />
          </Route>
          <Route path="/">
            <Redirect to="/login" />
          </Route>
        </Switch>
      </PageTransition>
    </AnimatePresence>
  );
}

function Router() {
  return <AnimatedRoutes />;
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <PWAProvider>
          <ThemeProvider translations={translations}>
            <Router />
            <AppToaster />
          </ThemeProvider>
        </PWAProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
