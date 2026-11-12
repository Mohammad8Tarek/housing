import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestWaWebVersion,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
  Browsers,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "node:path";
import fs from "node:fs";
import pino from "pino";
import { pool } from "@workspace/db";
import {
  processOutboxQueue,
  recordWhatsAppAlert,
  recoverStuckOutboxMessages,
} from "./send.js";
import {
  isStartReply,
  isStopReply,
  recordOptOut,
  removeOptOut,
} from "./opt-out.js";
import { normalizePhoneNumber } from "./templates.js";

// Canonical sessions storage directory
export function getCanonicalSessionsDir(): string {
  const cwd = process.cwd();
  let baseDir: string;
  if (cwd.includes("artifacts") && cwd.includes("api-server")) {
    baseDir = path.resolve(cwd, "storage/whatsapp_sessions");
  } else {
    baseDir = path.resolve(
      cwd,
      "artifacts/api-server/storage/whatsapp_sessions",
    );
  }
  if (!fs.existsSync(baseDir)) {
    fs.mkdirSync(baseDir, { recursive: true });
  }
  return baseDir;
}

export const SESSIONS_DIR = getCanonicalSessionsDir();

export interface SessionState {
  propertyId: number;
  sock: any | null;
  status: "disconnected" | "pairing" | "connected";
  qrCode?: string;
  pairingCode?: string;
  phoneNumber?: string;
  reconnectAttempts: number;
  isInitializing: boolean;
}

export const activeSessions = new Map<number, SessionState>();

/**
 * Get or initialize Baileys session for a given property
 */
export async function getWhatsAppSession(
  propertyId: number,
): Promise<SessionState> {
  let session = activeSessions.get(propertyId);
  if (!session) {
    session = {
      propertyId,
      sock: null,
      status: "disconnected",
      reconnectAttempts: 0,
      isInitializing: false,
    };
    activeSessions.set(propertyId, session);
  }

  // If session folder has valid registered creds.json and sock is null, automatically restore connection
  if (!session.sock && !session.isInitializing) {
    const sessionFolder = path.join(SESSIONS_DIR, `property_${propertyId}`);
    const credsPath = path.join(sessionFolder, "creds.json");
    if (fs.existsSync(credsPath)) {
      try {
        const raw = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
        if (raw?.registered && raw?.me) {
          session.isInitializing = true;
          connectPropertyWhatsApp(propertyId, false).catch((err) => {
            console.warn(
              `[WhatsApp] Auto-restore connection warning for property ${propertyId}:`,
              err?.message,
            );
          });
        }
      } catch {
        // Corrupt creds, ignore auto-restore
      }
    }
  }

  return session;
}

/**
 * Connect to WhatsApp for a property (generate QR code or restore existing session)
 */
export async function connectPropertyWhatsApp(
  propertyId: number,
  forceRestart: boolean = false,
  phoneNumberForPairingCode?: string,
  resetSession: boolean = false,
): Promise<SessionState> {
  let session = activeSessions.get(propertyId);
  if (!session) {
    session = {
      propertyId,
      sock: null,
      status: "disconnected",
      reconnectAttempts: 0,
      isInitializing: false,
    };
    activeSessions.set(propertyId, session);
  }

  // If already connected and socket is active, return it unless forced
  if (!forceRestart && session.status === "connected" && session.sock) {
    return session;
  }

  // If forceRestart requested or previous socket is dead/not connected, clean up old socket
  if (session.sock) {
    try {
      session.sock.ev.removeAllListeners("connection.update");
      session.sock.ev.removeAllListeners("creds.update");
      session.sock.end(undefined);
    } catch {}
    session.sock = null;
  }

  session.isInitializing = true;
  session.status = "pairing";
  session.qrCode = undefined;
  session.pairingCode = undefined;

  const sessionFolder = path.join(SESSIONS_DIR, `property_${propertyId}`);
  const credsPath = path.join(sessionFolder, "creds.json");
  let hasValidCreds = false;
  if (fs.existsSync(credsPath)) {
    try {
      const raw = JSON.parse(fs.readFileSync(credsPath, "utf-8"));
      hasValidCreds = Boolean(raw?.registered && raw?.me);
    } catch {
      hasValidCreds = false;
    }
  }

  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  } else if (resetSession || (forceRestart && !hasValidCreds)) {
    // Only purge session directory if explicitly requested to reset, OR if credentials are not registered
    console.log(
      `[WhatsApp] Purging unauthenticated session directory for property ${propertyId}`,
    );
    try {
      fs.rmSync(sessionFolder, { recursive: true, force: true });
      fs.mkdirSync(sessionFolder, { recursive: true });
    } catch {}
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

  // Fetch actual live WhatsApp Web version from WhatsApp CDN
  let version: [number, number, number] = [2, 3000, 1047787617];
  try {
    const v = await fetchLatestWaWebVersion();
    if (v?.version) version = v.version;
  } catch (err: any) {
    try {
      const v2 = await fetchLatestBaileysVersion();
      if (v2?.version) version = v2.version;
    } catch {}
    console.warn(
      "[WhatsApp] fetchLatestWaWebVersion fallback used:",
      err?.message,
    );
  }

  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    generateHighQualityLinkPreview: false,
    browser: Browsers.windows("Desktop"),
    // Not "online" all the time: a number that is permanently online looks
    // like a bot. Presence is set only around each message sent.
    markOnlineOnConnect: false,
    syncFullHistory: false,
    getMessage: async () => undefined,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 250,
  });

  session.sock = sock;

  // If pairing code requested and not already registered
  const validPairingPhone =
    typeof phoneNumberForPairingCode === "string" &&
    phoneNumberForPairingCode.trim().length > 0
      ? phoneNumberForPairingCode.trim()
      : undefined;

  if (validPairingPhone && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const cleanPhone = normalizePhoneNumber(validPairingPhone);
        if (cleanPhone && cleanPhone.length >= 8) {
          const code = await sock.requestPairingCode(cleanPhone);
          session.pairingCode = code;
          console.log(
            `[WhatsApp] Pairing Code for property ${propertyId}:`,
            code,
          );
        }
      } catch (err: any) {
        console.error("[WhatsApp] requestPairingCode error:", err?.message);
      }
    }, 2000);
  }

  sock.ev.on("creds.update", async () => {
    try {
      await saveCreds();
    } catch (err) {
      console.error(
        `[WhatsApp] Error saving creds for property ${propertyId}:`,
        err,
      );
    }
  });

  // Replies from residents: "0" / STOP opts the number out of broadcasts,
  // START opts back in. Each gets one short confirmation, and the message is
  // marked read (two-way conversations look like a real person's account).
  sock.ev.on("messages.upsert", async ({ messages, type }: any) => {
    if (type !== "notify") return;
    for (const m of messages ?? []) {
      try {
        await handleInboundMessage(propertyId, sock, m);
      } catch (err: any) {
        console.warn(
          `[WhatsApp] inbound message handling failed for property ${propertyId}:`,
          err?.message,
        );
      }
    }
  });

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

    if (connection === "connecting") {
      console.log(`[WhatsApp] Property ${propertyId} connecting...`);
    }

    if (qr) {
      session.status = "pairing";
      try {
        const qrDataUrl = await QRCode.toDataURL(qr, {
          margin: 2,
          width: 320,
          color: {
            dark: "#0F2A44",
            light: "#FFFFFF",
          },
        });
        session.qrCode = qrDataUrl;
        console.log(
          `[WhatsApp] New QR code generated for property ${propertyId}`,
        );
        // Persist fresh QR to DB for frontend polling
        await pool
          .query(
            `INSERT INTO public.property_whatsapp_configs (property_id, status, qr_code, updated_at)
           VALUES ($1, 'pairing', $2, NOW())
           ON CONFLICT (property_id) DO UPDATE
           SET status = 'pairing', qr_code = $2, updated_at = NOW()`,
            [propertyId, qrDataUrl],
          )
          .catch(() => {});
      } catch (err) {
        console.error("[WhatsApp] Error generating QR Data URL:", err);
      }
    }

    if (connection === "open") {
      session.status = "connected";
      session.qrCode = undefined;
      session.pairingCode = undefined;
      session.reconnectAttempts = 0;
      session.isInitializing = false;

      const userJid = sock.user?.id || "";
      const rawNumber = userJid.split(":")[0]?.split("@")[0] || "";
      session.phoneNumber = rawNumber ? `+${rawNumber}` : undefined;

      console.log(
        `[WhatsApp] Property ${propertyId} connected successfully as ${session.phoneNumber}`,
      );

      // Update database config
      await pool
        .query(
          `INSERT INTO public.property_whatsapp_configs (property_id, phone_number, status, qr_code, updated_at)
         VALUES ($1, $2, 'connected', NULL, NOW())
         ON CONFLICT (property_id) DO UPDATE
         SET phone_number = $2, status = 'connected', qr_code = NULL, updated_at = NOW()`,
          [propertyId, session.phoneNumber || ""],
        )
        .catch(() => {});

      // Immediately process any pending messages in outbox queue
      processOutboxQueue(propertyId).catch((err) => {
        console.error(
          `[WhatsApp Outbox] Auto-dispatch error on connect for property ${propertyId}:`,
          err,
        );
      });
    }

    if (connection === "close") {
      session.isInitializing = false;
      session.sock = null;

      const err = lastDisconnect?.error as any;
      const statusCode =
        err?.output?.statusCode ?? err?.statusCode ?? err?.status;
      const wasPairing = session.status === "pairing";
      session.status = "disconnected";

      // 401 can happen during pairing stream restart. Only treat as permanent logout if NOT pairing
      const isLoggedOut =
        (statusCode === DisconnectReason.loggedOut || statusCode === 401) &&
        !wasPairing;
      // 403: WhatsApp banned or restricted the number. Reconnecting again
      // and again only makes it worse.
      const isBanned =
        (statusCode === DisconnectReason.forbidden || statusCode === 403) &&
        !wasPairing;
      const isRestartRequired =
        statusCode === DisconnectReason.restartRequired ||
        statusCode === 515 ||
        statusCode === 428 ||
        statusCode === DisconnectReason.connectionLost ||
        wasPairing;

      console.log(
        `[WhatsApp] Property ${propertyId} connection closed (code ${statusCode}), isLoggedOut: ${isLoggedOut}, isRestartRequired: ${isRestartRequired}, wasPairing: ${wasPairing}`,
      );

      if (isBanned) {
        console.error(
          `[WhatsApp] ⛔ Property ${propertyId}: connection refused by WhatsApp (403). The number may be banned or restricted. Auto-reconnect stopped.`,
        );
        pool
          .query(
            `UPDATE public.property_whatsapp_configs
             SET status = 'banned', qr_code = NULL, updated_at = NOW()
             WHERE property_id = $1`,
            [propertyId],
          )
          .catch(() => {});
        recordWhatsAppAlert(
          propertyId,
          "واتساب رفض الاتصال بالرقم (403) — غالباً تم حظره أو تقييده. تم إيقاف الإرسال. / WhatsApp refused the number (403): likely banned or restricted. Sending stopped.",
          String(statusCode),
        ).catch(() => {});
      } else if (isRestartRequired || wasPairing) {
        // Pairing handshake or stream restart requested! WhatsApp requires immediate reconnect with saved credentials
        console.log(
          `[WhatsApp] Pairing handshake / stream restart in progress (code ${statusCode}) for property ${propertyId}. Immediate reconnect with saved credentials...`,
        );
        setTimeout(() => {
          connectPropertyWhatsApp(propertyId, false).catch((err) => {
            console.error(
              `[WhatsApp] Reconnect after restartRequired error:`,
              err,
            );
          });
        }, 500);
      } else if (isLoggedOut) {
        console.log(
          `[WhatsApp] Property ${propertyId} logged out. Resetting session credentials.`,
        );
        recordWhatsAppAlert(
          propertyId,
          "تم تسجيل خروج رقم الواتساب (من الهاتف أو بواسطة واتساب). الرسائل في الانتظار حتى يُعاد الربط. / WhatsApp number logged out; messages wait until it is linked again.",
          String(statusCode),
        ).catch(() => {});
        session.qrCode = undefined;
        session.pairingCode = undefined;
        session.phoneNumber = undefined;
        try {
          fs.rmSync(sessionFolder, { recursive: true, force: true });
        } catch {}
        pool
          .query(
            `UPDATE public.property_whatsapp_configs
           SET status = 'disconnected', qr_code = NULL, phone_number = NULL, updated_at = NOW()
           WHERE property_id = $1`,
            [propertyId],
          )
          .catch(() => {});
      } else {
        // Infinite auto-reconnect with exponential backoff!
        session.reconnectAttempts++;
        const delay = Math.min(session.reconnectAttempts * 2000, 15000);
        console.log(
          `[WhatsApp] Auto-reconnecting property ${propertyId} (attempt #${session.reconnectAttempts}) in ${delay}ms...`,
        );
        setTimeout(() => {
          connectPropertyWhatsApp(propertyId, false).catch((err) => {
            console.warn(
              `[WhatsApp] Auto-reconnect retry error for property ${propertyId}:`,
              err?.message,
            );
          });
        }, delay);
      }
    }
  });

  return session;
}

/**
 * Disconnect and clear session
 */
export async function disconnectPropertyWhatsApp(
  propertyId: number,
): Promise<void> {
  const session = activeSessions.get(propertyId);
  if (session?.sock) {
    try {
      await session.sock.logout();
    } catch {}
    try {
      session.sock.end(undefined);
    } catch {}
  }

  activeSessions.delete(propertyId);

  const sessionFolder = path.join(SESSIONS_DIR, `property_${propertyId}`);
  try {
    fs.rmSync(sessionFolder, { recursive: true, force: true });
  } catch {}

  await pool
    .query(
      `UPDATE public.property_whatsapp_configs
     SET status = 'disconnected', qr_code = NULL, phone_number = NULL, updated_at = NOW()
     WHERE property_id = $1`,
      [propertyId],
    )
    .catch(() => {});
}

export let heartbeatInterval: NodeJS.Timeout | null = null;

/**
 * Background Keep-Alive Heartbeat:
 * - Runs every 25 seconds
 * - Verifies socket health for all stored sessions
 * - Auto-restores disconnected sessions without user intervention
 * - Automatically dispatches any pending outbox queue messages
 */
export function startKeepAliveHeartbeat(): void {
  if (heartbeatInterval) return;

  heartbeatInterval = setInterval(async () => {
    try {
      if (!fs.existsSync(SESSIONS_DIR)) return;
      const entries = fs.readdirSync(SESSIONS_DIR);

      for (const entry of entries) {
        if (!entry.startsWith("property_")) continue;
        const propIdStr = entry.replace("property_", "");
        const propertyId = parseInt(propIdStr, 10);
        if (isNaN(propertyId)) continue;

        const sessionFolder = path.join(SESSIONS_DIR, entry);
        const credsPath = path.join(sessionFolder, "creds.json");
        if (!fs.existsSync(credsPath)) continue;

        let session = activeSessions.get(propertyId);

        // A banned number is not reconnected automatically.
        if (await isMarkedBanned(propertyId)) continue;

        // If session was disconnected or lost, auto-heal and restore
        if (
          !session ||
          (session.status !== "connected" && !session.isInitializing)
        ) {
          console.log(
            `[WhatsApp Heartbeat] Self-healing connection for property ${propertyId}...`,
          );
          connectPropertyWhatsApp(propertyId, false).catch(() => {});
        } else if (session.status === "connected" && session.sock) {
          // Check the socket without announcing presence: sending "available"
          // every 25s kept the number permanently online, a bot signal.
          const ws = (session.sock as any).ws;
          if (ws && ws.isOpen === false && ws.isConnecting !== true) {
            console.warn(
              `[WhatsApp Heartbeat] Socket closed for property ${propertyId}. Reconnecting...`,
            );
            connectPropertyWhatsApp(propertyId, false).catch(() => {});
          }

          // Trigger processing of any pending outbox items
          processOutboxQueue(propertyId).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn(
        "[WhatsApp Heartbeat] Heartbeat check notice:",
        err?.message,
      );
    }
  }, 25000);
}

/**
 * Auto-restore all active properties with stored WhatsApp credentials on server startup
 */
export async function autoRestoreAllWhatsAppSessions(): Promise<void> {
  try {
    await recoverStuckOutboxMessages();
    startKeepAliveHeartbeat();

    if (!fs.existsSync(SESSIONS_DIR)) return;
    const entries = fs.readdirSync(SESSIONS_DIR);
    for (const entry of entries) {
      if (entry.startsWith("property_")) {
        const propIdStr = entry.replace("property_", "");
        const propertyId = parseInt(propIdStr, 10);
        const credsPath = path.join(SESSIONS_DIR, entry, "creds.json");
        if (!isNaN(propertyId) && fs.existsSync(credsPath)) {
          console.log(
            `[WhatsApp] Auto-restoring existing session on boot for property ${propertyId}...`,
          );
          connectPropertyWhatsApp(propertyId).catch((err) => {
            console.warn(
              `[WhatsApp] Boot auto-restore failed for property ${propertyId}:`,
              err?.message,
            );
          });
        }
      }
    }
  } catch (err: any) {
    console.warn(
      "[WhatsApp] autoRestoreAllWhatsAppSessions error:",
      err?.message,
    );
  }
}

async function isMarkedBanned(propertyId: number): Promise<boolean> {
  try {
    const { rows } = await pool.query(
      `SELECT status FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId],
    );
    return rows[0]?.status === "banned";
  } catch {
    return false;
  }
}

/** Phone number (digits) of the sender of an incoming message, if known. */
function senderPhone(m: any): string | null {
  const key = m?.key ?? {};
  const candidates = [
    key.remoteJid,
    key.remoteJidAlt,
    key.senderPn,
    key.participantPn,
  ];
  for (const jid of candidates) {
    if (typeof jid === "string" && jid.endsWith("@s.whatsapp.net")) {
      return normalizePhoneNumber(jid.split("@")[0].split(":")[0]);
    }
  }
  return null;
}

async function handleInboundMessage(
  propertyId: number,
  sock: any,
  m: any,
): Promise<void> {
  if (!m?.message || m.key?.fromMe) return;
  const jid: string = m.key?.remoteJid || "";
  // Ignore groups, status updates and broadcasts.
  if (!jid || jid.endsWith("@g.us") || jid === "status@broadcast") return;
  const text: string =
    m.message.conversation || m.message.extendedTextMessage?.text || "";
  if (!text) return;

  const stop = isStopReply(text);
  const start = !stop && isStartReply(text);
  if (!stop && !start) return;

  const phone = senderPhone(m);
  if (!phone) {
    console.warn(
      `[WhatsApp] opt-out reply from ${jid} without a phone number; not recorded.`,
    );
    return;
  }

  if (stop) await recordOptOut(propertyId, phone, "reply");
  else await removeOptOut(propertyId, phone);

  await sock.readMessages?.([m.key]).catch(() => {});
  const reply = stop
    ? "تم إلغاء اشتراكك في الرسائل الجماعية ✅ لن تصلك رسائل جماعية بعد الآن. للاشتراك مرة أخرى أرسل: اشتراك\nYou have been unsubscribed from broadcast messages. Reply START to subscribe again."
    : "تم تفعيل اشتراكك في الرسائل مرة أخرى ✅\nYou are subscribed again.";
  await new Promise((r) => setTimeout(r, 1500 + Math.random() * 2000));
  await sock.sendMessage(jid, { text: reply });
  console.log(
    `[WhatsApp] Property ${propertyId}: ${phone} ${stop ? "opted out" : "opted back in"}.`,
  );
}
