import { getSecurityHeaders } from "./security-signer";

const DEFAULT_RAILWAY_API_URL = "https://housing-production-302d.up.railway.app";

export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  // In web browsers, always use relative paths ("") so the browser/Vite proxy
  // handles requests with same-origin cookies and credentials correctly.
  return "";
}

export function resolveApiUrl(path: string): string {
  if (!path.startsWith("/api")) return path;
  const baseUrl = getApiBaseUrl();
  return baseUrl ? `${baseUrl}${path}` : path;
}

export function createWebSocketUrl(
  path: string,
  search: URLSearchParams,
): string {
  const configured =
    import.meta.env.VITE_WS_URL?.trim() || import.meta.env.VITE_API_URL?.trim();
  const baseUrl =
    configured ||
    (typeof window !== "undefined" &&
    window.location.hostname.endsWith(".vercel.app")
      ? DEFAULT_RAILWAY_API_URL
      : getApiBaseUrl());
  const url = new URL(path, baseUrl || window.location.origin);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.search = search.toString();
  return url.toString();
}


let fetchInterceptorInstalled = false;

export function installApiFetchInterceptor(): void {
  if (fetchInterceptorInstalled || typeof window === "undefined") return;

  const originalFetch = window.fetch.bind(window);

  window.fetch = ((input: RequestInfo | URL, init?: RequestInit) => {
    const urlStr =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.toString()
          : (input as Request)?.url || "";

    let targetPath = "/";
    try {
      if (urlStr.startsWith("http")) {
        targetPath = new URL(urlStr).pathname;
      } else {
        targetPath = urlStr.split("?")[0] || "/";
      }
    } catch {
      targetPath = "/";
    }

    const isApi = targetPath.startsWith("/api");
    const method =
      init?.method ||
      (typeof input === "object" && "method" in input
        ? (input as Request).method
        : "GET");

    let updatedInit = init;
    if (isApi) {
      try {
        const secHeaders = getSecurityHeaders(method, targetPath);
        const headers = new Headers(init?.headers);
        for (const [k, v] of Object.entries(secHeaders)) {
          if (!headers.has(k)) {
            headers.set(k, v);
          }
        }
        updatedInit = { ...init, headers };
      } catch {
        // Fallback to original init if header construction fails
      }
    }

    if (typeof input === "string") {
      return originalFetch(resolveApiUrl(input), updatedInit);
    }

    if (input instanceof URL && input.pathname.startsWith("/api")) {
      return originalFetch(
        resolveApiUrl(`${input.pathname}${input.search}`),
        updatedInit,
      );
    }

    return originalFetch(input, updatedInit);
  }) as typeof window.fetch;

  fetchInterceptorInstalled = true;
}
