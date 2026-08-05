export function getApiBaseUrl(): string {
  const configured = import.meta.env.VITE_API_URL?.trim();
  if (configured) return configured.replace(/\/+$/, "");
  if (typeof window !== "undefined") return window.location.origin;
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
  const baseUrl = getApiBaseUrl();
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
    if (typeof input === "string") {
      return originalFetch(resolveApiUrl(input), init);
    }

    if (input instanceof URL && input.pathname.startsWith("/api")) {
      return originalFetch(
        resolveApiUrl(`${input.pathname}${input.search}`),
        init,
      );
    }

    return originalFetch(input, init);
  }) as typeof window.fetch;

  fetchInterceptorInstalled = true;
}
