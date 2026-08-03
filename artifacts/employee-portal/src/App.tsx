import { Switch, Route, Redirect, useLocation } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { AnimatePresence } from "framer-motion";
import { ThemeProvider } from "./lib/theme";
import { PWAProvider } from "./lib/pwa";
import translations from "./lib/translations";
import ErrorBoundary from "./components/ErrorBoundary";
import { AppToaster } from "./components/AppToaster";
import { PageTransition } from "./components/PageTransition";
import { usePrefersReducedMotion } from "./hooks/useReducedMotion";
import Login from "./pages/login";
import ForgotPassword from "./pages/forgot-password";
import Dashboard from "./pages/dashboard";
import ChangePassword from "./pages/change-password";
import RequestDetails from "./pages/request-details";
import { useEffect, useState, useCallback } from "react";
import { Loader2 } from "lucide-react";
import { apiFetch } from "./lib/api";
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const queryClient = new QueryClient();

function AuthGuard({ children }: { children: React.ReactNode }) {
  const [, setLocation] = useLocation();
  const [checking, setChecking] = useState(true);
  const isNative = Capacitor.isNativePlatform();

  const checkAuth = useCallback(async () => {
    try {
      if (isNative) {
        const { value: empJson } = await Preferences.get({
          key: "portal_employee",
        });
        if (!empJson) {
          setLocation("/login");
          return;
        }
        const { value: sid } = await Preferences.get({ key: "session_id" });
        if (sid) sessionStorage.setItem("session_id", sid);
      } else {
        if (!sessionStorage.getItem("portal_employee")) {
          setLocation("/login");
          return;
        }
      }

      const res = await apiFetch("/api/portal-auth/me");
      if (!res.ok) {
        setLocation("/login");
        return;
      }
    } catch {
      setLocation("/login");
      return;
    }
    setChecking(false);

    // Request permissions on native after auth check
    if (isNative) {
      try {
        const { PushNotifications } =
          await import("@capacitor/push-notifications");
        const { LocalNotifications } =
          await import("@capacitor/local-notifications");
        await PushNotifications.requestPermissions();
        await LocalNotifications.requestPermissions();
      } catch (err) {
        console.error("Permission request failed", err);
      }
    }
  }, []);

  useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  if (checking) {
    return (
      <div className="min-h-dvh bg-surface2 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-accent2" />
      </div>
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
