// @ts-nocheck
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./register-service-worker";
import * as Sentry from "@sentry/react";
import { setBaseUrl } from "@workspace/api-client-react";
import { getApiBaseUrl, installApiFetchInterceptor } from "@/lib/api-origin";

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

setBaseUrl(getApiBaseUrl());
installApiFetchInterceptor();

createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();
