/**
 * usePortalRealtime — one WebSocket for the whole portal.
 *
 * Listens to the server's `data_updated` / `SYNC_DATA` events and invalidates
 * the matching TanStack Query keys, so notifications, request status, documents
 * and activities refresh the moment the admin changes them. Replaces the old
 * 15s/30s polling loops. While the socket is down, queries fall back to a slow
 * refetch interval so nothing goes permanently stale.
 */
import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Capacitor } from "@capacitor/core";
import { invalidateAllPortal, invalidateForModule } from "../lib/portal-queries";

export function getPortalWsEndpoint(): string {
  const configuredWs = import.meta.env.VITE_WS_URL?.trim();
  if (configuredWs) return configuredWs;

  const toWs = (httpUrl: string) => httpUrl.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws";

  if (Capacitor.isNativePlatform()) {
    return toWs(import.meta.env.VITE_API_URL?.trim() || "https://resident.sunrise-resorts.com");
  }
  if (typeof window !== "undefined") {
    if (window.location.hostname.endsWith(".vercel.app")) {
      return toWs(import.meta.env.VITE_API_URL?.trim() || "https://resident.sunrise-resorts.com");
    }
    if (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1") {
      return "ws://localhost:4000/ws";
    }
    const proto = window.location.protocol === "https:" ? "wss:" : "ws:";
    return `${proto}//${window.location.host}/ws`;
  }
  return "ws://localhost:4000/ws";
}

function readSessionId(): string | null {
  try {
    return sessionStorage.getItem("session_id") || localStorage.getItem("session_id");
  } catch {
    return null;
  }
}

export type RealtimeStatus = "connecting" | "online" | "offline";

interface Options {
  /** Connect only once the user is authenticated. */
  enabled: boolean;
  /** Called for every data_updated event, after invalidation (e.g. to play a sound). */
  onEvent?: (event: { module: string; action?: string; data?: any }) => void;
}

export function usePortalRealtime({ enabled, onEvent }: Options): RealtimeStatus {
  const qc = useQueryClient();
  const [status, setStatus] = useState<RealtimeStatus>("connecting");
  const onEventRef = useRef(onEvent);
  onEventRef.current = onEvent;

  useEffect(() => {
    if (!enabled) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let pingTimer: ReturnType<typeof setInterval> | undefined;
    let attempts = 0;
    let unmounted = false;

    const connect = () => {
      if (unmounted) return;
      const sid = readSessionId();
      if (!sid && !Capacitor.isNativePlatform()) {
        setStatus("offline");
        return;
      }
      const base = getPortalWsEndpoint();
      const url = sid ? `${base}${base.includes("?") ? "&" : "?"}sessionId=${encodeURIComponent(sid)}` : base;

      try {
        ws = new WebSocket(url);
      } catch {
        scheduleReconnect();
        return;
      }

      ws.onopen = () => {
        attempts = 0;
        setStatus("online");
        // Anything that changed while we were disconnected
        invalidateAllPortal(qc);
        clearInterval(pingTimer);
        pingTimer = setInterval(() => {
          if (ws && ws.readyState === WebSocket.OPEN) ws.send(JSON.stringify({ type: "ping" }));
        }, 20_000);
      };

      ws.onmessage = (ev) => {
        let msg: any;
        try {
          msg = JSON.parse(ev.data);
        } catch {
          return;
        }
        if (!msg || msg.type === "pong" || msg.type === "connected") return;
        if (msg.type === "SYNC_DATA") {
          invalidateAllPortal(qc);
          return;
        }
        // chat has its own handler inside TabChat; everything else maps to queries
        if (msg.module && msg.module !== "chat") {
          invalidateForModule(qc, String(msg.module));
          onEventRef.current?.({ module: String(msg.module), action: msg.action, data: msg.data });
        }
        if (msg.type === "notification") {
          invalidateForModule(qc, "notifications");
          onEventRef.current?.({ module: "notifications", action: "push", data: msg.data });
        }
      };

      ws.onclose = () => {
        clearInterval(pingTimer);
        setStatus("offline");
        scheduleReconnect();
      };
      ws.onerror = () => {
        ws?.close();
      };
    };

    const scheduleReconnect = () => {
      if (unmounted) return;
      attempts += 1;
      const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
      clearTimeout(reconnectTimer);
      reconnectTimer = setTimeout(connect, delay);
    };

    const onVisible = () => {
      if (document.visibilityState === "visible" && (!ws || ws.readyState !== WebSocket.OPEN)) {
        clearTimeout(reconnectTimer);
        connect();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onVisible);

    connect();

    return () => {
      unmounted = true;
      clearTimeout(reconnectTimer);
      clearInterval(pingTimer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onVisible);
      try {
        ws?.close();
      } catch {
        /* ignore */
      }
    };
  }, [enabled, qc]);

  return status;
}
