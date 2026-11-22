import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./register-service-worker";
import { setBaseUrl } from "@workspace/api-client-react";
import { getApiBaseUrl, installApiFetchInterceptor } from "@/lib/api-origin";

// Load the Sentry SDK lazily and only when a DSN is configured, so the
// ~200kB browser-tracing + replay bundle never enters the main entry chunk
// (which loads on every page view).
if (import.meta.env.VITE_SENTRY_DSN) {
  void import("@sentry/react").then((Sentry) => {
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
  });
}

setBaseUrl(getApiBaseUrl());
installApiFetchInterceptor();

// Auto-heal stale chunk load errors on new builds/deployments
window.addEventListener("vite:preloadError", (event) => {
  event.preventDefault();
  const now = Date.now();
  const lastReload = Number(
    sessionStorage.getItem("sunrise_last_chunk_reload") || 0,
  );
  if (now - lastReload > 10000) {
    sessionStorage.setItem("sunrise_last_chunk_reload", String(now));
    window.location.reload();
  }
});

createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();
