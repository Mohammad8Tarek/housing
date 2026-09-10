import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./mobile-additions.css";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";

import { setBaseUrl, setSessionIdGetter } from "@workspace/api-client-react";
import { getSessionId } from "./lib/api";
import { Capacitor } from "@capacitor/core";
import * as Sentry from "@sentry/react";

// Automatically attach session ID to all TanStack Query / customFetch requests
setSessionIdGetter(getSessionId);

if (import.meta.env.VITE_SENTRY_DSN) {
  Sentry.init({
    dsn: import.meta.env.VITE_SENTRY_DSN,
    integrations: [
      Sentry.browserTracingIntegration(),
      Sentry.replayIntegration(),
    ],
    tracesSampleRate: 1.0,
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,
  });
}

import { Preferences } from "@capacitor/preferences";

if (Capacitor.isNativePlatform()) {
  const nativeApiUrl = import.meta.env.VITE_API_URL?.trim() || "https://resident.sunrise-resorts.com";
  setBaseUrl(nativeApiUrl);

  // Eagerly restore session from native Preferences into Web storage
  Preferences.get({ key: "session_id" }).then(({ value }) => {
    if (value) {
      sessionStorage.setItem("session_id", value);
      localStorage.setItem("session_id", value);
    }
  }).catch(() => {});

  Preferences.get({ key: "portal_employee" }).then(({ value }) => {
    if (value) {
      sessionStorage.setItem("portal_employee", value);
      localStorage.setItem("portal_employee", value);
    }
  }).catch(() => {});
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
