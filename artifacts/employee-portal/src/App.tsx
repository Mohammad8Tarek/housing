import { Switch, Route, Redirect, useLocation } from "wouter";
import { PersistQueryClientProvider } from "@tanstack/react-query-persist-client";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./lib/theme";
import { PWAProvider } from "./lib/pwa";
import translations from "./lib/translations";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppToaster } from "./components/AppToaster";
import { PageTransition } from "./components/PageTransition";
import Login from "./pages/login";
// Route-level code splitting: only the login screen ships in the entry chunk.
const ForgotPassword = lazy(() => import("./pages/forgot-password"));
const Dashboard = lazy(() => import("./pages/dashboard"));
const ChangePassword = lazy(() => import("./pages/change-password"));
const RequestDetails = lazy(() => import("./pages/request-details"));
import BiometricLockScreen from "./components/BiometricLockScreen";
import { useEffect, useState, useRef, useCallback, lazy, Suspense } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch, clearSessionCache, setCachedSessionId } from "./lib/api";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

import { queryClient, localStoragePersister, PORTAL_CACHE_BUSTER } from "./lib/query-client";

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

      // ── Verify session with backend ──────────────────────────────────────
      // On native, the X-Session-Id header lookup in requirePortalAuth is async
      // and the server session may have expired on server restart.
      // Strategy:
      //   1. Try /me — if OK, continue normally
      //   2. If 401 and we have biometric credentials → silent re-login
      //   3. If 401 and no biometric → trust local session (user just logged in)
      //   4. If network error → trust local session
      try {
        const res = await apiFetch("/api/portal-auth/me");

        if (res.ok) {
          // Session valid — update stored employee data from fresh server response
          try {
            const data = await res.json();
            if (data.profile || data.employee) {
              const emp = data.profile || data.employee;
              const empJson = JSON.stringify(emp);
              sessionStorage.setItem("portal_employee", empJson);
              localStorage.setItem("portal_employee", empJson);
              if (isNative) {
                await Preferences.set({ key: "portal_employee", value: empJson });
              }
            }
          } catch {}
        } else if (res.status === 401 || res.status === 403) {
          if (isNative) {
            // Try silent re-login with saved biometric credentials
            let reloginOk = false;
            try {
              const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
              const creds = await NativeBiometric.getCredentials({ server: "com.sunrisehousing.portal" }).catch(() => null);
              if (creds?.username && creds?.password) {
                const loginRes = await apiFetch("/api/portal-auth/login", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ employeeId: creds.username, password: creds.password }),
                });
                if (loginRes.ok) {
                  const loginData = await loginRes.json();
                  if (loginData.sessionId) {
                    sessionStorage.setItem("session_id", loginData.sessionId);
                    localStorage.setItem("session_id", loginData.sessionId);
                    await Preferences.set({ key: "session_id", value: loginData.sessionId });
                    setCachedSessionId(loginData.sessionId);
                  }
                  if (loginData.profile || loginData.employee) {
                    const emp = loginData.profile || loginData.employee;
                    const empJson = JSON.stringify(emp);
                    sessionStorage.setItem("portal_employee", empJson);
                    localStorage.setItem("portal_employee", empJson);
                    await Preferences.set({ key: "portal_employee", value: empJson });
                  }
                  reloginOk = true;
                }
              }
            } catch {}

            if (!reloginOk) {
              // No biometric creds — trust local session (user may have just logged in)
              const hasSid = sessionStorage.getItem("session_id") || localStorage.getItem("session_id");
              if (!hasSid) {
                clearSessionCache();
                setChecking(false);
                setLocation("/login");
                return;
              }
              // Has session_id → let through; APIs will handle per-request auth
            }
          } else {
            clearSessionCache();
            setChecking(false);
            setLocation("/login");
            return;
          }
        }
      } catch {
        // Network offline or server error → trust local session data
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
          if (useFingerprint !== "false") {
            const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
            const available = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
            if (available.isAvailable) {
              setLocked(true);
              setChecking(false);
              return;
            }
          }
        } catch {
          // Biometric not available — skip lock
        }
      }

      setChecking(false);
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
          if (useFingerprint !== "false") {
            const { NativeBiometric } = await import("@capgo/capacitor-native-biometric");
            const available = await NativeBiometric.isAvailable().catch(() => ({ isAvailable: false }));
            if (available.isAvailable) {
              setLocked(true);
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
          setLocked(false);
          setLocation("/login");
        }}
      />
    );
  }

  return <>{children}</>;
}

// ─── Route chunk fallback ─────────────────────────────────────────────────────
function RouteFallback() {
  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "hsl(var(--bg))",
      }}
    >
      <Loader2 className="animate-spin" style={{ width: 28, height: 28, color: "hsl(var(--gold))" }} />
    </div>
  );
}

// ─── Routes ───────────────────────────────────────────────────────────────────
function AnimatedRoutes() {
  const [location] = useLocation();
  const routeSlug = location.split("/").filter(Boolean)[0] || "root";

  return (
    <AnimatePresence mode="wait">
      <PageTransition key={routeSlug} pageKey={routeSlug}>
        <Suspense fallback={<RouteFallback />}>
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
        </Suspense>
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
          buster: PORTAL_CACHE_BUSTER,
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
