/**
 * api.ts — Centralized API fetch for both web and Capacitor native app
 * In browser: uses relative /api/ (proxied by Vite/Nginx), session via cookie
 * In Capacitor: uses full URL http://SERVER:PORT/api/, session via X-Session-Id header
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const isNative = Capacitor.isNativePlatform();
const DEFAULT_RAILWAY_API_URL = "https://housing-production-302d.up.railway.app";
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();

function isVercelHost(): boolean {
  return (
    typeof window !== "undefined" &&
    window.location.hostname.endsWith(".vercel.app")
  );
}

const SERVER_URL = (isNative
  ? configuredApiUrl || DEFAULT_RAILWAY_API_URL
  : ""
).replace(/\/+$/, "");

// Cache session_id in memory to avoid slow Preferences.get on every request
let _cachedSid: string | null | undefined = undefined;

async function getSessionId(): Promise<string | null> {
  if (_cachedSid !== undefined && _cachedSid !== null) return _cachedSid;
  if (typeof sessionStorage !== "undefined") {
    const sid = sessionStorage.getItem("session_id");
    if (sid) {
      _cachedSid = sid;
      return _cachedSid;
    }
  }
  if (typeof localStorage !== "undefined") {
    const sid = localStorage.getItem("session_id");
    if (sid) {
      _cachedSid = sid;
      return _cachedSid;
    }
  }
  if (isNative) {
    try {
      const { value } = await Preferences.get({ key: "session_id" });
      _cachedSid = value;
      return _cachedSid;
    } catch {}
  }
  return null;
}

export function clearSessionCache() {
  _cachedSid = undefined;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.removeItem("session_id");
    sessionStorage.removeItem("portal_employee");
  }
  if (typeof localStorage !== "undefined") {
    localStorage.removeItem("session_id");
    localStorage.removeItem("portal_employee");
  }
  if (isNative) {
    Preferences.remove({ key: "session_id" }).catch(() => {});
    Preferences.remove({ key: "portal_employee" }).catch(() => {});
  }
}

export function setCachedSessionId(sid: string) {
  _cachedSid = sid;
  if (typeof sessionStorage !== "undefined") {
    sessionStorage.setItem("session_id", sid);
  }
  if (typeof localStorage !== "undefined") {
    localStorage.setItem("session_id", sid);
  }
}

export function apiUrl(path: string): string {
  if (SERVER_URL) return SERVER_URL + path;
  return path;
}

function fallbackApiUrl(path: string): string | null {
  if (SERVER_URL || !isVercelHost() || !path.startsWith("/api")) return null;
  const fallbackBaseUrl = (configuredApiUrl || DEFAULT_RAILWAY_API_URL).replace(
    /\/+$/,
    "",
  );
  return `${fallbackBaseUrl}${path}`;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = apiUrl(path);
  const headers: Record<string, string> = {};

  const sid = await getSessionId();
  if (sid) headers["X-Session-Id"] = sid;

  const mergedHeaders: Record<string, string> = {
    ...headers,
    ...((init?.headers as Record<string, string>) || {}),
  };

  const requestInit = {
    ...init,
    headers: mergedHeaders,
    credentials: SERVER_URL ? "omit" : "include",
  } satisfies RequestInit;

  let res: Response;
  try {
    res = await fetch(url, requestInit);
  } catch (error) {
    const fallbackUrl = fallbackApiUrl(path);
    if (!fallbackUrl) throw error;
    res = await fetch(fallbackUrl, {
      ...requestInit,
      credentials: "omit",
    });
  }

  if ((res.status === 404 || res.status === 405) && !SERVER_URL) {
    const fallbackUrl = fallbackApiUrl(path);
    if (fallbackUrl) {
      res = await fetch(fallbackUrl, {
        ...requestInit,
        credentials: "omit",
      });
    }
  }

  return res;
}

export async function saveSessionId(res: Response) {
  try {
    const clone = res.clone();
    const text = await clone.text();
    const json = JSON.parse(text);
    if (json.sessionId) {
      if (typeof sessionStorage !== "undefined") {
        sessionStorage.setItem("session_id", json.sessionId);
      }
      if (typeof localStorage !== "undefined") {
        localStorage.setItem("session_id", json.sessionId);
      }
      if (isNative) {
        await Preferences.set({ key: "session_id", value: json.sessionId });
      }
      setCachedSessionId(json.sessionId);
    }
  } catch {
    /* not all responses are JSON */
  }
}
