// @ts-nocheck
import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { registerServiceWorker } from "./register-service-worker";

// API base URL is handled by Vercel proxy (see vercel.json)

createRoot(document.getElementById("root")!).render(<App />);
registerServiceWorker();
