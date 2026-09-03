import { Suspense, lazy } from "react";
import { Switch, Route, Router as WouterRouter, Redirect } from "wouter";
import {
  MutationCache,
  QueryClient,
  QueryClientProvider,
} from "@tanstack/react-query";
import { Toaster as SonnerToaster } from "sonner";
import { Toaster } from "@/components/ui/toaster";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "next-themes";
import { AuthProvider, useAuth } from "@/context/AuthContext";
import { LanguageProvider } from "@/context/LanguageContext";
import { PropertyProvider } from "@/context/PropertyContext";
import { AppLayout } from "@/components/layout/AppLayout";
import { PageLoader } from "@/components/ui/loader";
import { useWebSocket } from "@/hooks/use-websocket";
import { usePermission } from "@/hooks/use-permission";
import type { Module, Action } from "@/lib/permissions";
import NotFound from "@/pages/not-found";
import Login from "@/pages/login";
import Dashboard from "@/pages/dashboard";
import { ErrorBoundary } from "@/components/ErrorBoundary";

const Properties = lazy(() => import("@/pages/properties"));
const Housing = lazy(() => import("@/pages/housing"));
const Profiles = lazy(() => import("@/pages/profiles/index"));
const ProfileDetail = lazy(() => import("@/pages/profiles/detail"));
const Portal = lazy(() => import("@/pages/portal"));
const Reservations = lazy(() => import("@/pages/accommodation/reservations"));
const InHouse = lazy(() => import("@/pages/accommodation/in-house"));
const RoomAssignment = lazy(
  () => import("@/pages/accommodation/room-assignment"),
);
const GuestHosting = lazy(() => import("@/pages/accommodation/guest-hosting"));
const History = lazy(() => import("@/pages/accommodation/history"));
const Housekeeping = lazy(() => import("@/pages/housekeeping"));
const Tickets = lazy(() => import("@/pages/maintenance"));
const Reports = lazy(() => import("@/pages/reports"));
const Users = lazy(() => import("@/pages/users"));
const ActivityLog = lazy(() => import("@/pages/activity-log"));
const Settings = lazy(() => import("@/pages/settings"));
const EditHostingRequest = lazy(
  () => import("@/pages/hosting-requests/EditHostingRequest"),
);
const HostingRequestsList = lazy(
  () => import("@/pages/hosting-requests/HostingRequestsList"),
);
const CreateHostingRequest = lazy(
  () => import("@/pages/hosting-requests/CreateHostingRequest"),
);
const HostingRequestDetail = lazy(
  () => import("@/pages/hosting-requests/HostingRequestDetail"),
);

// Profile Portal Pages (Moved to standalone app)

let mutationRefreshTimer: ReturnType<typeof setTimeout> | null = null;

const queryClient = new QueryClient({
  mutationCache: new MutationCache({
    onSuccess: () => {
      if (mutationRefreshTimer) clearTimeout(mutationRefreshTimer);
      mutationRefreshTimer = setTimeout(() => {
        queryClient.invalidateQueries({
          type: "active",
          refetchType: "active",
        });
      }, 120);
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 0,
      refetchInterval: 5_000, // 5s heartbeat background sync for standing on pages
      gcTime: 5 * 60_000, // 5 min cache
      refetchOnWindowFocus: true,
      refetchOnReconnect: true,
      retry: 1,
    },
  },
});

/**
 * Global WebSocket Provider - stays mounted for the entire app session
 * This ensures WebSocket connection persists across route changes
 */
function WebSocketProvider({ children }: { children: React.ReactNode }) {
  useWebSocket();
  return <>{children}</>;
}

function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useAuth();
  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;
  return <AppLayout>{children}</AppLayout>;
}

/** Renders `children` if user has permission, else redirects to /dashboard */
function PermissionLayout({
  module,
  action = "view",
  children,
}: {
  module: Module;
  action?: Action;
  children: React.ReactNode;
}) {
  const { isAuthenticated, isLoading } = useAuth();
  const { can, isAdmin } = usePermission();

  if (isLoading) return <PageLoader />;
  if (!isAuthenticated) return <Redirect to="/login" />;

  // If user is admin they bypass permission checks
  if (!isAdmin && !can(module, action)) {
    return (
      <AppLayout>
        <div className="flex flex-col items-center justify-center h-full gap-4 py-20">
          <div className="w-16 h-16 rounded-full bg-red-100 flex items-center justify-center">
            <svg
              className="w-8 h-8 text-red-500"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"
              />
            </svg>
          </div>
          <h2 className="text-xl font-bold text-foreground">Access Denied</h2>
          <p className="text-muted-foreground text-sm text-center max-w-sm">
            You don&apos;t have permission to view this page. Contact your
            administrator to request access.
          </p>
          <a
            href="/dashboard"
            className="px-4 py-2 rounded-md bg-primary text-primary-foreground text-sm font-medium hover:opacity-90 transition-opacity"
          >
            Go to Dashboard
          </a>
        </div>
      </AppLayout>
    );
  }

  return <AppLayout>{children}</AppLayout>;
}

function Router() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Switch>
        <Route path="/login">
          <Login />
        </Route>

        <Route path="/">
          <Redirect to="/dashboard" />
        </Route>

        {/* Protected Routes wrapped in AppLayout */}
        <Route path="/dashboard">
          <ProtectedLayout>
            <Dashboard />
          </ProtectedLayout>
        </Route>

        <Route path="/room-space-view">
          <PermissionLayout module="housing">
            <Housing />
          </PermissionLayout>
        </Route>
        <Route path="/housing">
          <PermissionLayout module="housing">
            <Housing />
          </PermissionLayout>
        </Route>
        <Route path="/profiles/:id">
          <PermissionLayout module="profiles">
            <ProfileDetail />
          </PermissionLayout>
        </Route>
        <Route path="/profiles">
          <PermissionLayout module="profiles">
            <Profiles />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/reservations">
          <PermissionLayout module="accommodation">
            <Reservations />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/in-house">
          <PermissionLayout module="accommodation">
            <InHouse />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/room-assignment">
          <PermissionLayout module="accommodation">
            <Reservations />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/guest-hosting">
          <PermissionLayout module="accommodation">
            <GuestHosting />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation/history">
          <PermissionLayout module="accommodation">
            <History />
          </PermissionLayout>
        </Route>
        <Route path="/housekeeping">
          <PermissionLayout module="housekeeping">
            <Housekeeping />
          </PermissionLayout>
        </Route>
        <Route path="/accommodation">
          <Redirect to="/accommodation/reservations" />
        </Route>
        <Route path="/maintenance">
          <PermissionLayout module="maintenance">
            <Tickets />
          </PermissionLayout>
        </Route>
        <Route path="/reports">
          <PermissionLayout module="reports">
            <Reports />
          </PermissionLayout>
        </Route>
        <Route path="/users">
          <PermissionLayout module="users">
            <Users />
          </PermissionLayout>
        </Route>
        <Route path="/properties">
          <PermissionLayout module="properties">
            <Properties />
          </PermissionLayout>
        </Route>
        <Route path="/portal">
          <PermissionLayout module="portal_content">
            <Portal />
          </PermissionLayout>
        </Route>
        <Route path="/settings">
          <PermissionLayout module="settings">
            <Settings />
          </PermissionLayout>
        </Route>
        <Route path="/activity-log">
          <PermissionLayout module="activity_log">
            <ActivityLog />
          </PermissionLayout>
        </Route>

        <Route path="/hosting-requests/create">
          <PermissionLayout module="hosting_requests" action="create">
            <CreateHostingRequest />
          </PermissionLayout>
        </Route>
        <Route path="/hosting-requests/:id/edit">
          <PermissionLayout module="hosting_requests" action="edit">
            <EditHostingRequest />
          </PermissionLayout>
        </Route>
        <Route path="/hosting-requests/:id">
          <PermissionLayout module="hosting_requests" action="view">
            <HostingRequestDetail />
          </PermissionLayout>
        </Route>
        <Route path="/hosting-requests">
          <PermissionLayout module="hosting_requests" action="view">
            <HostingRequestsList />
          </PermissionLayout>
        </Route>

        <Route>
          <ProtectedLayout>
            <NotFound />
          </ProtectedLayout>
        </Route>
      </Switch>
    </Suspense>
  );
}

function App() {
  return (
    <ErrorBoundary>
      <QueryClientProvider client={queryClient}>
        <ThemeProvider
          attribute="class"
          defaultTheme="light"
          enableSystem={false}
        >
          <LanguageProvider>
            <AuthProvider>
              <PropertyProvider>
                <WebSocketProvider>
                  <TooltipProvider>
                    <WouterRouter>
                      <Router />
                    </WouterRouter>
                    <Toaster />
                    <SonnerToaster
                      position="top-right"
                      richColors
                      toastOptions={{
                        style: {
                          "--normal-bg": "var(--brand-teal, #2AB5B5)",
                        } as React.CSSProperties,
                      }}
                    />
                  </TooltipProvider>
                </WebSocketProvider>
              </PropertyProvider>
            </AuthProvider>
          </LanguageProvider>
        </ThemeProvider>
      </QueryClientProvider>
    </ErrorBoundary>
  );
}

export default App;
