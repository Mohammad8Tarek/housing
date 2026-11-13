/**
 * portal-socket.ts — the portal's single shared WebSocket.
 *
 * The server allows one socket per resident (a new connection replaces the
 * previous one), so every consumer (realtime cache invalidation, chat,
 * presence) must share this connection instead of opening its own, or they
 * evict each other in a reconnect loop.
 *
 * Reference-counted: the socket stays open while at least one subscriber is
 * mounted and closes when the last one unsubscribes or on `closePortalSocket()`
 * (logout). Reconnects with exponential backoff, re-connects when the tab
 * becomes visible or the network comes back, and pings every 20s.
 */
import { Capacitor } from "@capacitor/core";

export type PortalSocketStatus = "connecting" | "online" | "offline";

export interface PortalSocketMessage {
  type?: string;
  module?: string;
  action?: string;
  data?: any;
  [key: string]: unknown;
}

interface Subscriber {
  onMessage?: (msg: PortalSocketMessage) => void;
  onStatus?: (status: PortalSocketStatus) => void;
}

export function getPortalWsEndpoint(): string {
  const configuredWs = import.meta.env.VITE_WS_URL?.trim();
  if (configuredWs) return configuredWs;

  const toWs = (httpUrl: string) =>
    httpUrl.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws";

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

const subscribers = new Set<Subscriber>();
let ws: WebSocket | null = null;
let status: PortalSocketStatus = "offline";
let attempts = 0;
let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
let pingTimer: ReturnType<typeof setInterval> | undefined;
let listenersInstalled = false;

function setStatus(next: PortalSocketStatus) {
  if (status === next) return;
  status = next;
  subscribers.forEach((s) => s.onStatus?.(next));
}

function scheduleReconnect() {
  if (subscribers.size === 0) return;
  attempts += 1;
  const delay = Math.min(30_000, 1_000 * 2 ** Math.min(attempts, 5));
  clearTimeout(reconnectTimer);
  reconnectTimer = setTimeout(connect, delay);
}

function connect() {
  if (subscribers.size === 0) return;
  if (ws && (ws.readyState === WebSocket.OPEN || ws.readyState === WebSocket.CONNECTING)) return;

  const sid = readSessionId();
  if (!sid && !Capacitor.isNativePlatform()) {
    setStatus("offline");
    return;
  }
  const base = getPortalWsEndpoint();
  const url = sid ? `${base}${base.includes("?") ? "&" : "?"}sessionId=${encodeURIComponent(sid)}` : base;

  setStatus("connecting");
  let socket: WebSocket;
  try {
    socket = new WebSocket(url);
  } catch {
    scheduleReconnect();
    return;
  }
  ws = socket;

  socket.onopen = () => {
    clearInterval(pingTimer);
    pingTimer = setInterval(() => {
      if (socket.readyState === WebSocket.OPEN) socket.send(JSON.stringify({ type: "ping" }));
    }, 20_000);
  };

  socket.onmessage = (ev) => {
    let msg: PortalSocketMessage;
    try {
      msg = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (!msg || msg.type === "pong") return;
    if (msg.type === "connected") {
      // Only an authenticated socket counts as online (a rejected one opens then closes).
      attempts = 0;
      setStatus("online");
    }
    subscribers.forEach((s) => {
      try {
        s.onMessage?.(msg);
      } catch (err) {
        console.warn("[portal-socket] subscriber error", err);
      }
    });
  };

  socket.onclose = (event) => {
    clearInterval(pingTimer);
    if (ws === socket) ws = null;
    setStatus("offline");
    // 1008 = not authenticated: wait for a login instead of hammering the server
    if (event.code === 1008 || event.code === 4001) return;
    scheduleReconnect();
  };

  socket.onerror = () => {
    try {
      socket.close();
    } catch {
      /* ignore */
    }
  };
}

function onVisible() {
  if (document.visibilityState !== "visible") return;
  if (subscribers.size > 0 && (!ws || ws.readyState !== WebSocket.OPEN)) {
    clearTimeout(reconnectTimer);
    attempts = 0;
    connect();
  }
}

function installWindowListeners() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("online", onVisible);
}

/** Subscribe to the shared socket. Returns an unsubscribe function. */
export function subscribePortalSocket(sub: Subscriber): () => void {
  subscribers.add(sub);
  installWindowListeners();
  sub.onStatus?.(status);
  connect();
  return () => {
    subscribers.delete(sub);
    if (subscribers.size === 0) closePortalSocket();
  };
}

/** Send a JSON message if the socket is open. Returns false when it was not sent. */
export function sendPortalSocket(payload: unknown): boolean {
  if (!ws || ws.readyState !== WebSocket.OPEN) return false;
  try {
    ws.send(JSON.stringify(payload));
    return true;
  } catch {
    return false;
  }
}

export function getPortalSocketStatus(): PortalSocketStatus {
  return status;
}

/** Drop the connection (logout). Subscribers stay registered and reconnect on the next login. */
export function closePortalSocket(): void {
  clearTimeout(reconnectTimer);
  clearInterval(pingTimer);
  attempts = 0;
  const socket = ws;
  ws = null;
  try {
    socket?.close();
  } catch {
    /* ignore */
  }
  setStatus("offline");
}

/** After a new login the session id changed: reconnect with the new credentials. */
export function reconnectPortalSocket(): void {
  closePortalSocket();
  if (subscribers.size > 0) connect();
}
