import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} from "@whiskeysockets/baileys";
import QRCode from "qrcode";
import path from "node:path";
import fs from "node:fs";
import pino from "pino";
import { pool } from "@workspace/db";

// Sessions storage directory
const SESSIONS_DIR = path.resolve(process.cwd(), "storage/whatsapp_sessions");
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

interface SessionState {
  propertyId: number;
  sock: any | null;
  status: "disconnected" | "pairing" | "connected";
  qrCode?: string;
  phoneNumber?: string;
  reconnectAttempts: number;
  isInitializing: boolean;
}

const activeSessions = new Map<number, SessionState>();

// Message queue for rate-limiting and anti-ban delay jitter
interface QueuedMessage {
  propertyId: number;
  rawPhone: string;
  text: string;
  messageType: string;
  recipientName?: string;
  resolve: (res: { success: boolean; reason?: string }) => void;
  reject: (err: any) => void;
}

const messageQueue: QueuedMessage[] = [];
let isQueueProcessing = false;

async function processQueue() {
  if (isQueueProcessing || messageQueue.length === 0) return;
  isQueueProcessing = true;

  while (messageQueue.length > 0) {
    const item = messageQueue.shift();
    if (!item) break;

    try {
      const res = await executeSendHumanLike(
        item.propertyId,
        item.rawPhone,
        item.text,
        item.messageType,
        item.recipientName
      );
      item.resolve(res);
    } catch (err: any) {
      item.reject(err);
    }

    // Anti-ban random delay jitter between consecutive messages (3500ms to 6500ms)
    if (messageQueue.length > 0) {
      const jitterMs = 3500 + Math.floor(Math.random() * 3000);
      await new Promise((r) => setTimeout(r, jitterMs));
    }
  }

  isQueueProcessing = false;
}

/**
 * Clean & normalize phone number for WhatsApp
 */
export function normalizePhoneNumber(rawPhone: string): string {
  let cleaned = rawPhone.replace(/[^0-9]/g, "");
  // Egyptian numbers: 01xxxxxxxxx (11 digits) -> 201xxxxxxxxx
  if (cleaned.startsWith("01") && cleaned.length === 11) {
    cleaned = "2" + cleaned;
  } else if (cleaned.startsWith("1") && cleaned.length === 10) {
    cleaned = "20" + cleaned;
  }
  // Strip any leading zeros
  cleaned = cleaned.replace(/^0+/, "");
  return cleaned;
}

/**
 * Get or initialize Baileys session for a given property
 */
export async function getWhatsAppSession(propertyId: number): Promise<SessionState> {
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

  // If session folder has creds.json and sock is null, automatically restore connection
  if (!session.sock && !session.isInitializing) {
    const sessionFolder = path.join(SESSIONS_DIR, `property_${propertyId}`);
    if (fs.existsSync(path.join(sessionFolder, "creds.json"))) {
      connectPropertyWhatsApp(propertyId).catch((err) => {
        console.warn(`[WhatsApp] Auto-restore connection warning for property ${propertyId}:`, err?.message);
      });
    }
  }

  return session;
}

/**
 * Connect to WhatsApp for a property (generate QR code or restore existing session)
 */
export async function connectPropertyWhatsApp(propertyId: number): Promise<SessionState> {
  const session = await getWhatsAppSession(propertyId);
  if (session.status === "connected" && session.sock) {
    return session;
  }
  if (session.isInitializing) {
    return session;
  }

  session.isInitializing = true;
  session.status = "pairing";

  const sessionFolder = path.join(SESSIONS_DIR, `property_${propertyId}`);
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
  const { version } = await fetchLatestBaileysVersion();

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
    browser: ["Sunrise Staff Housing", "Chrome", "1.0.0"],
    syncFullHistory: false,
  });

  session.sock = sock;

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", async (update) => {
    const { connection, lastDisconnect, qr } = update;

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
        // Persist QR to DB for frontend polling
        await pool.query(
          `UPDATE public.property_whatsapp_configs
           SET status = 'pairing', qr_code = $1, updated_at = NOW()
           WHERE property_id = $2`,
          [qrDataUrl, propertyId]
        ).catch(() => {});
      } catch (err) {
        console.error("[WhatsApp] Error generating QR Data URL:", err);
      }
    }

    if (connection === "open") {
      session.status = "connected";
      session.qrCode = undefined;
      session.reconnectAttempts = 0;
      session.isInitializing = false;

      const userJid = sock.user?.id || "";
      const rawNumber = userJid.split(":")[0]?.split("@")[0] || "";
      session.phoneNumber = rawNumber ? `+${rawNumber}` : undefined;

      console.log(`[WhatsApp] Property ${propertyId} connected successfully as ${session.phoneNumber}`);

      // Update database config
      await pool.query(
        `INSERT INTO public.property_whatsapp_configs (property_id, phone_number, status, qr_code, updated_at)
         VALUES ($1, $2, 'connected', NULL, NOW())
         ON CONFLICT (property_id) DO UPDATE
         SET phone_number = $2, status = 'connected', qr_code = NULL, updated_at = NOW()`,
        [propertyId, session.phoneNumber || ""]
      ).catch(() => {});
    }

    if (connection === "close") {
      session.isInitializing = false;
      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

      console.log(
        `[WhatsApp] Property ${propertyId} connection closed (code ${statusCode}), shouldReconnect: ${shouldReconnect}`
      );

      if (shouldReconnect) {
        if (session.reconnectAttempts < 5) {
          session.reconnectAttempts++;
          const delay = Math.min(session.reconnectAttempts * 3000, 15000);
          setTimeout(() => {
            connectPropertyWhatsApp(propertyId).catch(() => {});
          }, delay);
        } else {
          session.status = "disconnected";
        }
      } else {
        // Logged out
        session.status = "disconnected";
        session.sock = null;
        session.phoneNumber = undefined;
        session.qrCode = undefined;

        // Clean up session folder
        try {
          fs.rmSync(sessionFolder, { recursive: true, force: true });
        } catch {}

        await pool.query(
          `UPDATE public.property_whatsapp_configs
           SET status = 'disconnected', qr_code = NULL, phone_number = NULL, updated_at = NOW()
           WHERE property_id = $1`,
          [propertyId]
        ).catch(() => {});
      }
    }
  });

  return session;
}

/**
 * Disconnect and clear session
 */
export async function disconnectPropertyWhatsApp(propertyId: number): Promise<void> {
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

  await pool.query(
    `UPDATE public.property_whatsapp_configs
     SET status = 'disconnected', qr_code = NULL, phone_number = NULL, updated_at = NOW()
     WHERE property_id = $1`,
    [propertyId]
  ).catch(() => {});
}

/**
 * Auto-restore all active properties with stored WhatsApp credentials on server startup
 */
export async function autoRestoreAllWhatsAppSessions(): Promise<void> {
  try {
    if (!fs.existsSync(SESSIONS_DIR)) return;
    const entries = fs.readdirSync(SESSIONS_DIR);
    for (const entry of entries) {
      if (entry.startsWith("property_")) {
        const propIdStr = entry.replace("property_", "");
        const propertyId = parseInt(propIdStr, 10);
        const credsPath = path.join(SESSIONS_DIR, entry, "creds.json");
        if (!isNaN(propertyId) && fs.existsSync(credsPath)) {
          console.log(`[WhatsApp] Auto-restoring existing session on boot for property ${propertyId}...`);
          connectPropertyWhatsApp(propertyId).catch((err) => {
            console.warn(`[WhatsApp] Boot auto-restore failed for property ${propertyId}:`, err?.message);
          });
        }
      }
    }
  } catch (err: any) {
    console.warn("[WhatsApp] autoRestoreAllWhatsAppSessions error:", err?.message);
  }
}

/**
 * Actual execution of sending message with anti-ban human behavior
 */
async function executeSendHumanLike(
  propertyId: number,
  rawPhone: string,
  text: string,
  messageType: string = "CHECKIN_WELCOME",
  recipientName?: string
): Promise<{ success: boolean; reason?: string }> {
  let session = await getWhatsAppSession(propertyId);

  // If session is currently restoring or pairing, wait up to 10s for open connection
  if ((session.isInitializing || session.status === "pairing") && !session.sock) {
    for (let i = 0; i < 20; i++) {
      await new Promise((r) => setTimeout(r, 500));
      if (session.status === "connected" && session.sock) break;
    }
  }

  if (session.status !== "connected" || !session.sock) {
    await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "FAILED", "WhatsApp not connected");
    return { success: false, reason: "NOT_CONNECTED" };
  }

  const cleanPhone = normalizePhoneNumber(rawPhone);
  if (!cleanPhone || cleanPhone.length < 8) {
    await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "FAILED", "Invalid phone number format");
    return { success: false, reason: "INVALID_PHONE" };
  }

  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    // 1. Anti-ban: Pre-validate that destination phone number is registered on WhatsApp
    const [exists] = await session.sock.onWhatsApp(jid);
    if (!exists || !exists.exists) {
      console.warn(`[WhatsApp Anti-Ban] Number ${cleanPhone} is NOT registered on WhatsApp. Skipping send to protect number.`);
      await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "NOT_REGISTERED", "Number not on WhatsApp");
      return { success: false, reason: "NOT_REGISTERED" };
    }

    const verifiedJid = exists.jid;

    // 2. Anti-ban: Human simulation (presence available -> composing state -> realistic pause)
    await session.sock.sendPresenceUpdate("available");
    await session.sock.sendPresenceUpdate("composing", verifiedJid);

    // Realistic human typing delay (between 2500ms to 4500ms depending on message length)
    const typingDelay = Math.min(Math.max(text.length * 15, 2500), 4500) + Math.floor(Math.random() * 800);
    await new Promise((r) => setTimeout(r, typingDelay));

    await session.sock.sendPresenceUpdate("paused", verifiedJid);

    // 3. Send message
    await session.sock.sendMessage(verifiedJid, { text });

    // 4. Log successful delivery
    await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "SENT");
    console.log(`[WhatsApp] Message successfully sent to ${cleanPhone}`);
    return { success: true };
  } catch (err: any) {
    console.error(`[WhatsApp] Error sending to ${cleanPhone}:`, err.message);
    await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "FAILED", err.message || "Unknown error");
    return { success: false, reason: err.message };
  }
}

/**
 * Queue a message for safe human-like dispatch
 */
export function sendWhatsAppMessageSafe(
  propertyId: number,
  rawPhone: string,
  text: string,
  messageType: string = "CHECKIN_WELCOME",
  recipientName?: string
): Promise<{ success: boolean; reason?: string }> {
  return new Promise((resolve, reject) => {
    messageQueue.push({
      propertyId,
      rawPhone,
      text,
      messageType,
      recipientName,
      resolve,
      reject,
    });
    processQueue().catch(reject);
  });
}

/**
 * Log message delivery
 */
async function logDelivery(
  propertyId: number,
  phone: string,
  name: string | undefined,
  type: string,
  content: string,
  status: "SENT" | "FAILED" | "NOT_REGISTERED" | "QUEUED",
  errorMessage?: string
) {
  try {
    await pool.query(
      `INSERT INTO public.whatsapp_delivery_logs
       (property_id, recipient_phone, recipient_name, message_type, message_content, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [propertyId, phone, name || null, type, content, status, errorMessage || null]
    );
  } catch (e: any) {
    console.error("[WhatsApp] Error logging delivery:", e.message);
  }
}

/**
 * Compile template variables
 */
export function compileWhatsAppTemplate(
  template: string,
  vars: Record<string, string | number | undefined | null>
): string {
  let result = template;
  for (const [key, val] of Object.entries(vars)) {
    const regex = new RegExp(`{${key}}`, "g");
    result = result.replace(regex, String(val ?? ""));
  }
  return result;
}

/**
 * Automatic Check-In WhatsApp Notification Handler
 */
export async function sendCheckInWhatsAppNotification(params: {
  propertyId: number;
  profileId: number;
  roomId: number;
  bedId?: number | null;
  startDate?: string;
}) {
  try {
    const { propertyId, profileId, roomId, bedId, startDate } = params;

    // 1. Check if WhatsApp is configured & auto-send is enabled
    const session = await getWhatsAppSession(propertyId);
    const configRes = await pool.query(
      `SELECT * FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId]
    );
    const config = configRes.rows[0];
    
    // If auto send explicitly disabled, skip
    if (config && config.is_auto_send_enabled === false) {
      console.log(`[WhatsApp Auto-Send] Auto send is disabled for property ${propertyId}, skipping.`);
      return;
    }

    // Must be connected either in active session or DB
    const isConnected = session.status === "connected" || config?.status === "connected";
    if (!isConnected) {
      console.log(`[WhatsApp Auto-Send] WhatsApp is not connected for property ${propertyId} (session: ${session.status}, db: ${config?.status}), skipping.`);
      return;
    }

    // Resolve property & tenant schema name
    const propRes = await pool.query(
      `SELECT name, display_name, schema_name FROM public.properties WHERE id = $1`,
      [propertyId]
    );
    const prop = propRes.rows[0] || {};
    const schemaName = (prop.schema_name || "public").trim();
    const propertyName = prop.display_name || prop.name || "Sunrise Housing";

    // 2. Fetch profile info from tenant schema (fallback to public if not found)
    let profileRes = await pool.query(
      `SELECT first_name, last_name, phone FROM ${schemaName}.profiles WHERE id = $1`,
      [profileId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!profileRes.rows[0]) {
      profileRes = await pool.query(
        `SELECT first_name, last_name, phone FROM public.profiles WHERE id = $1`,
        [profileId]
      ).catch(() => ({ rows: [] as any[] }));
    }

    const profile = profileRes.rows[0];
    if (!profile || !profile.phone || !profile.phone.trim()) {
      console.log(`[WhatsApp Auto-Send] Profile ${profileId} has no phone number, skipping.`);
      return;
    }

    // 3. Fetch room, floor, building info from tenant schema
    let roomRes = await pool.query(
      `SELECT r.room_number, f.name as floor_name, b.name as building_name
       FROM ${schemaName}.rooms r
       LEFT JOIN ${schemaName}.floors f ON r.floor_id = f.id
       LEFT JOIN ${schemaName}.buildings b ON r.building_id = b.id
       WHERE r.id = $1`,
      [roomId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!roomRes.rows[0]) {
      roomRes = await pool.query(
        `SELECT r.room_number, f.name as floor_name, b.name as building_name
         FROM public.rooms r
         LEFT JOIN public.floors f ON r.floor_id = f.id
         LEFT JOIN public.buildings b ON r.building_id = b.id
         WHERE r.id = $1`,
        [roomId]
      ).catch(() => ({ rows: [] as any[] }));
    }
    const room = roomRes.rows[0] || {};

    // 4. Fetch bed info if any
    let bedLabel = "سرير مخصص / Assigned Bed";
    if (bedId) {
      let bedRes = await pool.query(
        `SELECT bed_number, bed_label FROM ${schemaName}.room_beds WHERE id = $1`,
        [bedId]
      ).catch(() => ({ rows: [] as any[] }));

      if (!bedRes.rows[0]) {
        bedRes = await pool.query(
          `SELECT bed_number, bed_label FROM public.room_beds WHERE id = $1`,
          [bedId]
        ).catch(() => ({ rows: [] as any[] }));
      }

      if (bedRes.rows[0]) {
        bedLabel = bedRes.rows[0].bed_label || `Bed ${bedRes.rows[0].bed_number}`;
      }
    }

    // 5. Compile template
    const fullName = `${profile.first_name || ""} ${profile.last_name || ""}`.trim();
    const portalUrl = process.env.PORTAL_URL || "https://portal.sunrise-housing.com";

    const vars = {
      employee_name: fullName,
      property_name: propertyName,
      building_name: room.building_name || "المبنى الرئيسي",
      floor_name: room.floor_name || "الطابق الأول",
      room_number: room.room_number || String(roomId),
      bed_label: bedLabel,
      checkin_date: startDate || new Date().toISOString().split("T")[0],
      portal_url: portalUrl,
      supervisor_contact: config?.supervisor_contact || "",
    };

    const template =
      config?.welcome_template_ar ||
      config?.welcome_template_en ||
      DEFAULT_WELCOME_AR;
    const compiledMessage = compileWhatsAppTemplate(template, vars);

    // 6. Dispatch through safe queue
    console.log(`[WhatsApp Auto-Send] Queuing welcome notification for ${fullName} (${profile.phone})`);
    sendWhatsAppMessageSafe(
      propertyId,
      profile.phone,
      compiledMessage,
      "CHECKIN_WELCOME",
      fullName
    ).catch((err) => {
      console.error("[WhatsApp Auto-Send] Failed to queue message:", err);
    });
  } catch (err: any) {
    console.error("[WhatsApp Auto-Send] Error in notification handler:", err);
  }
}
