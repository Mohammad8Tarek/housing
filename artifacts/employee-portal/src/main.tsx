import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import "./mobile-additions.css";
import App from "./App.tsx";
import ErrorBoundary from "./components/ErrorBoundary.tsx";

import { setBaseUrl } from "@workspace/api-client-react";

import { Capacitor } from "@capacitor/core";

if (import.meta.env.VITE_API_URL && Capacitor.isNativePlatform()) {
  setBaseUrl(import.meta.env.VITE_API_URL);
}

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </StrictMode>,
);
