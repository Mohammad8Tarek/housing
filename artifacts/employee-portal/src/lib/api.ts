/**
 * api.ts — Centralized API fetch for both web and Capacitor native app
 * In browser: uses relative /api/ (proxied by Vite/Nginx), session via cookie
 * In Capacitor: uses full URL http://SERVER:PORT/api/, session via X-Session-Id header
 */
import { Capacitor } from "@capacitor/core";
import { Preferences } from "@capacitor/preferences";

const isNative = Capacitor.isNativePlatform();
const configuredApiUrl = import.meta.env.VITE_API_URL?.trim();
const SERVER_URL = (
  configuredApiUrl || (isNative ? "http://192.168.0.103:4000" : "")
).replace(/\/+$/, "");

// Cache session_id in memory to avoid slow Preferences.get on every request
let _cachedSid: string | null | undefined = undefined;

async function getSessionId(): Promise<string | null> {
  if (!isNative) return null;
  if (_cachedSid !== undefined) return _cachedSid;
  const { value } = await Preferences.get({ key: "session_id" });
  _cachedSid = value;
  return _cachedSid;
}

export function clearSessionCache() {
  _cachedSid = undefined;
}

export function setCachedSessionId(sid: string) {
  _cachedSid = sid;
}

export function apiUrl(path: string): string {
  if (SERVER_URL) return SERVER_URL + path;
  return path;
}

export async function apiFetch(
  path: string,
  init?: RequestInit,
): Promise<Response> {
  const url = apiUrl(path);
  const headers: Record<string, string> = {};

  if (isNative) {
    const sid = await getSessionId();
    if (sid) headers["X-Session-Id"] = sid;
  }

  const mergedHeaders: Record<string, string> = {
    ...headers,
    ...((init?.headers as Record<string, string>) || {}),
  };

  const res = await fetch(url, {
    ...init,
    headers: mergedHeaders,
    credentials: isNative ? "omit" : "include",
  });

  return res;
}

export async function saveSessionId(res: Response) {
  if (!isNative) return;
  try {
    const clone = res.clone();
    const text = await clone.text();
    const json = JSON.parse(text);
    if (json.sessionId) {
      await Preferences.set({ key: "session_id", value: json.sessionId });
      setCachedSessionId(json.sessionId);
    }
  } catch {
    /* not all responses are JSON */
  }
}
