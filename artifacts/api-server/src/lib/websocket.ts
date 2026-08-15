/**
 * api-server/src/lib/websocket.ts — WebSocket Broadcast Module
 *
 * Features:
 * 1. SYNC_DATA global broadcast → triggers full re-fetch on clients
 * 2. data_updated targeted broadcast → module-specific invalidation
 * 3. No duplicate connections — one socket per userId+propertyId
 * 4. Clean disconnect: removes from map on close/error
 * 5. Heartbeat ping/pong every 30s to detect dead connections
 * 6. Auth validation on connect (rejects missing params)
 */

import { WebSocketServer, WebSocket } from "ws";
import type { Server } from "http";
import { pool } from "@workspace/db";
import { unsign } from "cookie-signature";
import { logger } from "./logger.js";
import { registerHotekBridge } from "./pms-server.js";
import { verifyWsAuthToken } from "./ws-auth-token.js";

// ─── Types ─────────────────────────────────────────────────────────────────
export type WsModule =
  | "employees"
  | "accommodation"
  | "housing"
  | "maintenance"
  | "reservations"
  | "notifications"
  | "dashboard"
  | "chat"
  | "buildings"
  | "floors"
  | "users"
  | "settings"
  | "properties";

export type WsAction =
  | "created"
  | "updated"
  | "deleted"
  | "checkin"
  | "checkout"
  | "transfer"
  | "sync"
  | "new_message"
  | "read_receipt"
  | "typing_start";

export interface WsPayload {
  type: "SYNC_DATA" | "data_updated" | "notification" | "connected" | "pong";
  module?: WsModule;
  action?: WsAction;
  entityId?: number;
  data?: Record<string, unknown>;
  timestamp: string;
}

interface Client {
  ws: WebSocket;
  propertyId: number;
  userId: number | string;
  username: string;
  connectedAt: number;
}

// ─── Client Registry ────────────────────────────────────────────────────────
// Key: `${userId}:${propertyId}` — enforces one connection per user+property.
// If the same user opens a new tab, the old connection is closed first.
const clients = new Map<string, Client>();
const MAX_WS_CLIENTS = Number(process.env["MAX_WS_CLIENTS"] ?? 5000);
const SESSION_COOKIE_NAME = process.env["SESSION_COOKIE_NAME"] ?? "sunrise.sid";
const SESSION_TABLE = process.env["SESSION_TABLE"] ?? "user_sessions";
const SESSION_TABLE_SQL = /^[A-Za-z_][A-Za-z0-9_]*$/.test(SESSION_TABLE)
  ? `"${SESSION_TABLE}"`
  : '"user_sessions"';
const HOTEK_BRIDGE_SECRET = process.env["HOTEK_BRIDGE_SECRET"] ?? "";

class HotekBridgeSocket {
  destroyed = false;
  remoteAddress = "hotek-bridge";
  remotePort = 0;
  private listeners = new Map<string, Set<(data: unknown) => void>>();

  constructor(private ws: WebSocket) {}

  on(event: string, listener: (data: unknown) => void): void {
    if (!this.listeners.has(event)) this.listeners.set(event, new Set());
    this.listeners.get(event)!.add(listener);
  }

  emit(event: string, data?: unknown): void {
    for (const listener of this.listeners.get(event) ?? []) {
      listener(data);
    }
  }

  write(data: Buffer | Uint8Array | string): boolean {
    if (this.destroyed || this.ws.readyState !== WebSocket.OPEN) return false;
    try {
      const payload = Buffer.isBuffer(data)
        ? data
        : typeof data === "string"
          ? Buffer.from(data)
          : Buffer.from(data);
      this.ws.send(payload);
      return true;
    } catch {
      return false;
    }
  }

  destroy(): void {
    if (this.destroyed) return;
    this.destroyed = true;
    try {
      this.ws.close();
    } catch {}
    this.emit("close");
  }

  setKeepAlive(): void {}
  setNoDelay(): void {}
  setTimeout(): void {}
}

function parseCookies(header: string | undefined): Record<string, string> {
  const result: Record<string, string> = {};
  if (!header) return result;
  for (const part of header.split(";")) {
    const eqIdx = part.indexOf("=");
    if (eqIdx <= 0) continue;
    const key = part.slice(0, eqIdx).trim();
    const value = part.slice(eqIdx + 1).trim();
    try {
      result[key] = decodeURIComponent(value);
    } catch {
      result[key] = value;
    }
  }
  return result;
}

function getSessionId(cookieHeader: string | undefined): string | null {
  const cookies = parseCookies(cookieHeader);
  const raw = cookies[SESSION_COOKIE_NAME] ?? cookies["connect.sid"];
  if (!raw?.startsWith("s:")) return null;
  const secret = process.env["SESSION_SECRET"];
  if (!secret) return null;
  const sid = unsign(raw.slice(2), secret);
  return sid || null;
}

async function loadSessionAuth(cookieHeader: string | undefined): Promise<{
  userId: number | string;
  propertyId: number;
  username: string;
  isSystemAdmin: boolean;
} | null> {
  const sid = getSessionId(cookieHeader);
  if (!sid) return null;
  const result = await pool.query(
    `SELECT sess FROM ${SESSION_TABLE_SQL} WHERE sid = $1 AND expire > NOW() LIMIT 1`,
    [sid],
  );
  const sess = result.rows[0]?.sess;
  if (!sess || typeof sess !== "object") return null;

  // Check for admin session
  const userId = Number(sess.userId);
  const propertyId = Number(sess.propertyId);
  if (userId && propertyId) {
    return {
      userId,
      propertyId,
      username: String(sess.username ?? "unknown"),
      isSystemAdmin: Boolean(sess.isSystemAdmin),
    };
  }

  // Check for employee portal session
  if (sess.portal?.employeeDbId && sess.portal?.propertyId) {
    return {
      userId: `emp_${sess.portal.employeeDbId}`,
      propertyId: Number(sess.portal.propertyId),
      username: sess.portal.fullName || "Employee",
      isSystemAdmin: false,
    };
  }

  return null;
}

// ✅ FIX: stable key — same user+property always gets the same key
function makeKey(userId: number | string, propertyId: number): string {
  return `${userId}:${propertyId}`;
}

function safeSend(ws: WebSocket, payload: WsPayload): void {
  if (ws.readyState !== WebSocket.OPEN) return;
  try {
    ws.send(JSON.stringify(payload));
  } catch {
    // ignore — connection may have died between the check and send
  }
}

// ─── Init ───────────────────────────────────────────────────────────────────
export function initWebSocket(server: Server): WebSocketServer {
  const wss = new WebSocketServer({ server, path: "/ws" });

  wss.on("connection", async (ws, req) => {
    const url = new URL(req.url ?? "/", "http://localhost");
    const requestedPropertyId = parseInt(
      url.searchParams.get("propertyId") ?? "0",
      10,
    );
    const tunnel = url.searchParams.get("tunnel") ?? "";
    const bridgeType = req.headers["x-bridge-type"];
    const isHotekBridge = tunnel === "hotek" || bridgeType === "hotek";
    const providedBridgeSecret =
      typeof req.headers["x-bridge-secret"] === "string"
        ? req.headers["x-bridge-secret"]
        : undefined;

    if (isHotekBridge) {
      const expectedBridgeSecret =
        HOTEK_BRIDGE_SECRET || process.env["SESSION_SECRET"] || "";
      if (
        !expectedBridgeSecret ||
        providedBridgeSecret !== expectedBridgeSecret
      ) {
        ws.close(1008, "Hotek bridge auth required.");
        return;
      }

      const propertyId = requestedPropertyId || 1;
      const bridgeSocket = new HotekBridgeSocket(ws);
      registerHotekBridge(propertyId, bridgeSocket as any);

      ws.on("message", (raw) => {
        const payload =
          raw instanceof Buffer
            ? raw
            : Buffer.isBuffer(raw)
              ? raw
              : Buffer.from(raw as ArrayBufferLike);
        bridgeSocket.emit("data", payload);
      });

      ws.on("close", () => {
        bridgeSocket.destroy();
      });

      ws.on("error", () => {
        bridgeSocket.destroy();
      });
      return;
    }

    if (clients.size >= MAX_WS_CLIENTS) {
      ws.close(1013, "Server is busy. Try again later.");
      return;
    }

    const token = url.searchParams.get("token") ?? "";
    const tokenAuth = token ? verifyWsAuthToken(token) : null;

    // Also check for session_id in query param (for cross-origin WS from Vercel→Railway)
    const querySessionId = url.searchParams.get("sessionId") ?? "";
    let sessionAuth: Awaited<ReturnType<typeof loadSessionAuth>> | null = null;
    if (!tokenAuth && querySessionId) {
      try {
        const result = await pool.query(
          `SELECT sess FROM ${SESSION_TABLE_SQL} WHERE sid = $1 AND expire > NOW() LIMIT 1`,
          [querySessionId],
        );
        const sess = result.rows[0]?.sess;
        if (sess && typeof sess === "object") {
          const userId = Number(sess.userId);
          const propertyId = Number(sess.propertyId);
          if (userId && propertyId) {
            sessionAuth = {
              userId,
              propertyId,
              username: String(sess.username ?? "unknown"),
              isSystemAdmin: Boolean(sess.isSystemAdmin),
            };
          } else if (sess.portal?.employeeDbId && sess.portal?.propertyId) {
            sessionAuth = {
              userId: `emp_${sess.portal.employeeDbId}`,
              propertyId: Number(sess.portal.propertyId),
              username: sess.portal.fullName || "Employee",
              isSystemAdmin: false,
            };
          }
        }
      } catch (err) {
        logger.warn({ err }, "[WS] Query sessionId auth lookup failed");
      }
    }

    const auth =
      tokenAuth ??
      sessionAuth ??
      (await loadSessionAuth(req.headers.cookie).catch((err) => {
        logger.warn({ err }, "[WS] Session auth lookup failed");
        return null;
      }));

    // Reject unauthenticated connections immediately
    if (!auth) {
      ws.close(1008, "Authenticated session required.");
      return;
    }
    const propertyId = requestedPropertyId || auth.propertyId;
    if (!auth.isSystemAdmin && propertyId !== auth.propertyId) {
      ws.close(1008, "Access denied to this property.");
      return;
    }
    const { userId, username } = auth;

    const key = makeKey(userId, propertyId);

    // ✅ FIX: close the existing connection before registering the new one
    const existing = clients.get(key);
    if (existing && existing.ws.readyState === WebSocket.OPEN) {
      existing.ws.close(1000, "Replaced by new connection from same user.");
      logger.info(
        { userId, propertyId },
        "[WS] Closing old connection — new tab opened",
      );
    }
    clients.set(key, {
      ws,
      propertyId,
      userId,
      username,
      connectedAt: Date.now(),
    });

    // Confirm connection
    safeSend(ws, {
      type: "connected",
      data: { clientKey: key },
      timestamp: new Date().toISOString(),
    });

    logger.info(
      { userId, propertyId, total: clients.size },
      "[WS] ✅ Client connected",
    );

    // Handle incoming messages
    ws.on("message", (raw) => {
      try {
        const rawSize = Array.isArray(raw)
          ? raw.reduce((total, item) => total + item.byteLength, 0)
          : raw.byteLength;
        if (rawSize > 1024) {
          ws.close(1009, "Message too large.");
          return;
        }
        const msg = JSON.parse(raw.toString());
        if (msg.type === "ping") {
          safeSend(ws, { type: "pong", timestamp: new Date().toISOString() });
        }
      } catch {
        // ignore malformed messages
      }
    });

    // Clean disconnect
    ws.on("close", () => {
      const current = clients.get(key);
      // Only delete if it's still this same socket (not the replacement)
      if (current?.ws === ws) {
        clients.delete(key);
        logger.info(
          { userId, propertyId, total: clients.size },
          "[WS] Client disconnected",
        );
      }
    });

    ws.on("error", (err) => {
      logger.warn(
        { err: err.message, userId, propertyId },
        "[WS] Client error",
      );
      const current = clients.get(key);
      if (current?.ws === ws) clients.delete(key);
      ws.close();
    });
  });

  // ─── Heartbeat: detect and remove dead connections every 30s ────────────
  setInterval(() => {
    for (const [key, client] of clients.entries()) {
      if (client.ws.readyState === WebSocket.OPEN) {
        client.ws.ping();
      } else {
        clients.delete(key);
      }
    }
  }, 30_000);

  logger.info("[WS] WebSocket server initialized on /ws");
  return wss;
}

// ─── Broadcast API ──────────────────────────────────────────────────────────

/**
 * broadcastToProperty — sends a targeted update for a specific module.
 *
 * Clients receive:
 *   { type: "data_updated", module: "maintenance", action: "created", ... }
 *
 * Frontend use-websocket.ts invalidates only the affected query keys.
 */
export function broadcastToProperty(
  propertyId: number,
  event: {
    type?: WsPayload["type"];
    module: WsModule;
    action: WsAction;
    entityId?: number;
    data?: Record<string, unknown>;
  },
): void {
  const payload: WsPayload = {
    type: event.type ?? "data_updated",
    module: event.module,
    action: event.action,
    entityId: event.entityId,
    data: event.data,
    timestamp: new Date().toISOString(),
  };

  let sent = 0;
  let failed = 0;
  for (const client of clients.values()) {
    if (client.propertyId === propertyId) {
      try {
        safeSend(client.ws, payload);
        sent++;
      } catch (err) {
        logger.warn(
          { err, clientUserId: client.userId, propertyId },
          "[WS] Failed to send to client",
        );
        failed++;
      }
    }
  }

  if (sent > 0) {
    logger.info(
      {
        propertyId,
        module: event.module,
        action: event.action,
        sent,
        failed,
        totalClients: clients.size,
      },
      "[WS] Broadcast completed",
    );
  } else {
    logger.warn(
      {
        propertyId,
        module: event.module,
        action: event.action,
        totalClients: clients.size,
      },
      "[WS] No clients for property — broadcast skipped",
    );
  }
}

/**
 * broadcastSyncAll — sends SYNC_DATA to ALL connected clients for a property.
 *
 * Use this after bulk operations (HR sync, import) where many things changed.
 * Clients will re-fetch everything.
 *
 * Payload: { type: "SYNC_DATA" }
 */
export function broadcastSyncAll(propertyId: number): void {
  const payload: WsPayload = {
    type: "SYNC_DATA",
    timestamp: new Date().toISOString(),
  };

  let sent = 0;
  for (const client of clients.values()) {
    if (client.propertyId === propertyId) {
      safeSend(client.ws, payload);
      sent++;
    }
  }
  logger.info({ propertyId, recipients: sent }, "[WS] SYNC_DATA broadcast");
}

/** Returns count of currently connected clients */
export function getConnectedCount(): number {
  return clients.size;
}

/** Returns client list (for admin endpoints) */
export function getConnectedClients(): Array<{
  userId: number;
  propertyId: number;
  username: string;
  connectedAt: string;
}> {
  return Array.from(clients.values()).map((c) => ({
    userId: c.userId,
    propertyId: c.propertyId,
    username: c.username,
    connectedAt: new Date(c.connectedAt).toISOString(),
  }));
}
/**
 * closeWebSocket — Closes all active WebSocket connections and clears the registry.
 * Required for graceful shutdown in index.ts.
 */
export function closeWebSocket(): void {
  logger.info(
    { count: clients.size },
    "[WS] Closing all connections for shutdown...",
  );

  for (const [key, client] of clients.entries()) {
    if (client.ws.readyState === WebSocket.OPEN) {
      client.ws.close(1001, "Server is shutting down.");
    }
    clients.delete(key);
  }
}
