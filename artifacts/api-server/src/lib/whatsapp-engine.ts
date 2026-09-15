import makeWASocket, {
  DisconnectReason,
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  Browsers,
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

export const DEFAULT_WELCOME_AR = `مرحباً بك أ/ {employee_name} في {property_name} 🌴✨

يسعدنا إبلاغك بأنه تم إتمام إجراءات تسكينك بنجاح:
🏢 المبنى: {building_name} ({floor_name})
🚪 رقم الغرفة: {room_number}
🛏️ السرير: {bed_label}
📅 تاريخ التسكين: {checkin_date}

📱 للدخول إلى بوابة المقيمين وطلب الخدمات:
{portal_url}

نتمنى لك إقامة هانئة ومريحة! ✨`;

export const DEFAULT_WELCOME_EN = `Welcome Mr/Ms {employee_name} to {property_name}! 🌴✨

Your accommodation has been successfully confirmed:
🏢 Building: {building_name} ({floor_name})
🚪 Room: {room_number}
🛏️ Bed: {bed_label}
📅 Check-in Date: {checkin_date}

📱 Access Resident Portal:
{portal_url}

We wish you a pleasant and comfortable stay! ✨`;

export const DEFAULT_RESERVATION_AR = `مرحباً بك أ/ {guest_name} في {property_name} 🌴✨

يسعدنا تأكيد حجز إقامتك المسبق لدينا:
🔖 رقم الحجز: #{reservation_id}
🏢 المبنى / الغرفة: {room_info}
🛏️ تفاصيل السرير: {bed_info}
📅 تاريخ الوصول المتوقع: {checkin_date}
📅 تاريخ المغادرة المتوقع: {checkout_date}

ℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.

نتمنى لك رحلة موفقة وإقامة سعيدة! ✨`;

export const DEFAULT_RESERVATION_EN = `Welcome Mr/Ms {guest_name} to {property_name}! 🌴✨

We are pleased to confirm your upcoming reservation:
🔖 Booking Ref: #{reservation_id}
🏢 Building / Room: {room_info}
🛏️ Bed Info: {bed_info}
📅 Expected Check-in: {checkin_date}
📅 Expected Check-out: {checkout_date}

ℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.

We wish you a safe trip and a pleasant stay! ✨`;

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
            console.warn(`[WhatsApp] Auto-restore connection warning for property ${propertyId}:`, err?.message);
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
  forceRestart: boolean = false
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

  const sessionFolder = path.join(SESSIONS_DIR, `property_${propertyId}`);
  if (!fs.existsSync(sessionFolder)) {
    fs.mkdirSync(sessionFolder, { recursive: true });
  } else if (forceRestart) {
    // Only purge session directory if explicitly requested (e.g. user clicked Reconnect / Connect)
    console.log(`[WhatsApp] Force restart: purging previous session directory for property ${propertyId}`);
    try {
      fs.rmSync(sessionFolder, { recursive: true, force: true });
      fs.mkdirSync(sessionFolder, { recursive: true });
    } catch {}
  }

  const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);

  // Safe fetch of version with reliable fallback
  let version: [number, number, number] = [2, 3000, 1017531234];
  try {
    const v = await fetchLatestBaileysVersion();
    if (v?.version) version = v.version;
  } catch (err: any) {
    console.warn("[WhatsApp] fetchLatestBaileysVersion fallback used:", err?.message);
  }

  const logger = pino({ level: "silent" });

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: state.keys,
    },
    generateHighQualityLinkPreview: false,
    browser: Browsers.windows("Desktop"),
    syncFullHistory: false,
    connectTimeoutMs: 60000,
    defaultQueryTimeoutMs: 60000,
    keepAliveIntervalMs: 30000,
    retryRequestDelayMs: 250,
  });

  session.sock = sock;

  sock.ev.on("creds.update", async () => {
    try {
      await saveCreds();
    } catch (err) {
      console.error(`[WhatsApp] Error saving creds for property ${propertyId}:`, err);
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
        console.log(`[WhatsApp] New QR code generated for property ${propertyId}`);
        // Persist fresh QR to DB for frontend polling
        await pool.query(
          `INSERT INTO public.property_whatsapp_configs (property_id, status, qr_code, updated_at)
           VALUES ($1, 'pairing', $2, NOW())
           ON CONFLICT (property_id) DO UPDATE
           SET status = 'pairing', qr_code = $2, updated_at = NOW()`,
          [propertyId, qrDataUrl]
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
      session.sock = null;

      const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

      console.log(
        `[WhatsApp] Property ${propertyId} connection closed (code ${statusCode}), isLoggedOut: ${isLoggedOut}, isRestartRequired: ${isRestartRequired}`
      );

      if (isLoggedOut) {
        // Explicitly logged out or auth rejected
        session.status = "disconnected";
        session.phoneNumber = undefined;
        session.qrCode = undefined;
        session.reconnectAttempts = 0;

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
      } else if (isRestartRequired) {
        // QR Code was scanned! WhatsApp requires immediate reconnect with the newly saved credentials
        console.log(`[WhatsApp] Pairing handshake in progress (code 515) for property ${propertyId}. Reconnecting with saved credentials...`);
        setTimeout(() => {
          connectPropertyWhatsApp(propertyId, false).catch((err) => {
            console.error(`[WhatsApp] Reconnect after restartRequired error:`, err);
          });
        }, 500);
      } else {
        // Temporary network drop or handshake retry
        if (session.reconnectAttempts < 5) {
          session.reconnectAttempts++;
          const delay = Math.min(session.reconnectAttempts * 2000, 10000);
          console.log(`[WhatsApp] Reconnecting property ${propertyId} (attempt ${session.reconnectAttempts}/5) in ${delay}ms...`);
          setTimeout(() => {
            connectPropertyWhatsApp(propertyId, false).catch(() => {});
          }, delay);
        } else {
          session.status = "disconnected";
          session.qrCode = undefined;
          await pool.query(
            `UPDATE public.property_whatsapp_configs
             SET qr_code = NULL, updated_at = NOW()
             WHERE property_id = $1 AND status = 'pairing'`,
            [propertyId]
          ).catch(() => {});
        }
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
 * Determines whether a profile's nationality or identity is Arabic-speaking.
 * Checks nationality text, demonyms, Arabic script, and name characters.
 */
export function isArabicProfile(
  nationality?: string | null,
  firstName?: string | null,
  lastName?: string | null
): boolean {
  if (nationality && nationality.trim()) {
    const raw = nationality.trim().toLowerCase();

    // Check for any Arabic script characters (e.g. "مصر", "مصري", "سعودي")
    if (/[\u0600-\u06FF]/.test(raw)) {
      return true;
    }

    // 2. Exact matches for 2/3 letter country codes
    const shortCodes = new Set([
      "eg", "egy", "ksa", "uae", "kw", "kwt", "qa", "qat", 
      "bh", "bhr", "om", "omn", "ye", "yem", "jo", "jor", 
      "lb", "lbn", "sy", "syr", "iq", "irq", "ps", "pse", 
      "sd", "sdn", "ly", "lby", "tn", "tun", "dz", "dza", 
      "ma", "mar", "mr", "mrt", "so", "som", "dj", "dji", "km", "com"
    ]);
    if (shortCodes.has(raw)) {
      return true;
    }

    // 3. Whole-word matching for Arabic country names and demonyms
    const arabicWords = [
      "egypt", "egyptian", "egyptians",
      "saudi", "saudi arabia", "saudis",
      "united arab emirates", "emirates", "emirati", "emiratis",
      "kuwait", "kuwaiti", "kuwaitis",
      "qatar", "qatari", "qataris",
      "bahrain", "bahraini", "bahrainis",
      "oman", "omani", "omanis",
      "yemen", "yemeni", "yemenis",
      "jordan", "jordanian", "jordanians",
      "lebanon", "lebanese",
      "syria", "syrian", "syrians",
      "iraq", "iraqi", "iraqis",
      "palestine", "palestinian", "palestinians",
      "sudan", "sudanese",
      "libya", "libyan", "libyans",
      "tunisia", "tunisian", "tunisians",
      "algeria", "algerian", "algerians",
      "morocco", "moroccan", "moroccans",
      "mauritania", "mauritanian", "mauritanians",
      "somalia", "somali", "somalis",
      "djibouti", "djiboutian", "djiboutians",
      "comoros", "comorian", "comorians",
      "arab", "arabic"
    ];

    const regex = new RegExp(`\\b(${arabicWords.join("|")})\\b`, "i");
    if (regex.test(raw)) {
      return true;
    }

    // Explicit foreign nationality (e.g. Russia, Ukraine, Italy, India, Kazakhstan, etc.)
    return false;
  }

  // Fallback if nationality is not set: check if person's name has Arabic characters
  const fullName = `${firstName || ""} ${lastName || ""}`.trim();
  if (/[\u0600-\u06FF]/.test(fullName)) {
    return true;
  }

  // Default to Arabic in local hotel context if completely unspecified
  return true;
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
      `SELECT first_name, last_name, phone, nationality FROM ${schemaName}.profiles WHERE id = $1`,
      [profileId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!profileRes.rows[0]) {
      profileRes = await pool.query(
        `SELECT first_name, last_name, phone, nationality FROM public.profiles WHERE id = $1`,
        [profileId]
      ).catch(() => ({ rows: [] as any[] }));
    }

    const profile = profileRes.rows[0];
    const fullName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : `Profile #${profileId}`;
    if (!profile || !profile.phone || !profile.phone.trim()) {
      console.log(`[WhatsApp Auto-Send] Profile ${profileId} (${fullName}) has no phone number, skipping.`);
      await logDelivery(
        propertyId,
        "N/A",
        fullName || `Profile #${profileId}`,
        "CHECKIN_WELCOME",
        `تم تخطي الإرسال لعدم وجود رقم هاتف مسجل في ملف الموظف (${fullName || profileId}).`,
        "FAILED",
        "رقم هاتف الموظف غير مسجل في ملفه الشخصي (No phone number in profile)"
      ).catch(() => {});
      return;
    }

    // 3. Determine language dynamically based on nationality
    const isArabic = isArabicProfile(profile.nationality, profile.first_name, profile.last_name);
    console.log(
      `[WhatsApp Auto-Send] Profile ${profileId} nationality: "${profile.nationality || "unspecified"}" -> Selected language: ${isArabic ? "Arabic (عربي)" : "English"}`
    );

    // 4. Fetch room, floor, building info from tenant schema
    let roomRes = await pool.query(
      `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
       FROM ${schemaName}.rooms r
       LEFT JOIN ${schemaName}.floors f ON r.floor_id = f.id
       LEFT JOIN ${schemaName}.buildings b ON r.building_id = b.id
       WHERE r.id = $1`,
      [roomId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!roomRes.rows[0]) {
      roomRes = await pool.query(
        `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
         FROM public.rooms r
         LEFT JOIN public.floors f ON r.floor_id = f.id
         LEFT JOIN public.buildings b ON r.building_id = b.id
         WHERE r.id = $1`,
        [roomId]
      ).catch(() => ({ rows: [] as any[] }));
    }
    const room = roomRes.rows[0] || {};

    // 5. Bed info
    let bedLabel = isArabic ? "سرير مخصص" : "Assigned Bed";
    if (bedId) {
      bedLabel = isArabic ? `سرير ${bedId}` : `Bed ${bedId}`;
    }

    // Floor label
    let floorLabel = room.floor_name
      ? (isArabic ? `الدور ${room.floor_name}` : `Floor ${room.floor_name}`)
      : (isArabic ? "الطابق الأول" : "First Floor");

    // Clean check-in date
    const cleanDate = (String(startDate || "").split("T")[0]) || new Date().toISOString().split("T")[0];

    // 6. Compile template based on detected language
    const portalUrl = process.env.PORTAL_URL || "https://portal.sunrise-housing.com";

    const vars = {
      employee_name: fullName,
      property_name: propertyName,
      building_name: room.building_name || (isArabic ? "المبنى الرئيسي" : "Main Building"),
      floor_name: floorLabel,
      room_number: room.room_number || String(roomId),
      bed_label: bedLabel,
      checkin_date: cleanDate,
      portal_url: portalUrl,
      supervisor_contact: config?.supervisor_contact || "",
    };

    const template = isArabic
      ? (config?.welcome_template_ar || DEFAULT_WELCOME_AR)
      : (config?.welcome_template_en || DEFAULT_WELCOME_EN);
    const compiledMessage = compileWhatsAppTemplate(template, vars);

    // 7. Dispatch through safe queue
    console.log(`[WhatsApp Auto-Send] Queuing welcome notification for ${fullName} (${profile.phone}) in ${isArabic ? "Arabic" : "English"}`);
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

/**
 * Manually trigger or resend WhatsApp welcome notification for an assignment
 */
export async function sendWelcomeWhatsAppForAssignment(params: {
  propertyId: number;
  assignmentId: number;
  phoneOverride?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  const { propertyId, assignmentId, phoneOverride } = params;

  // Resolve tenant schema name
  const propRes = await pool.query(
    `SELECT name, display_name, schema_name FROM public.properties WHERE id = $1`,
    [propertyId]
  );
  const prop = propRes.rows[0];
  if (!prop) return { success: false, error: "Property not found" };
  const schemaName = (prop.schema_name || "public").trim();

  // Find assignment
  let assignRes = await pool.query(
    `SELECT * FROM ${schemaName}.assignments WHERE id = $1`,
    [assignmentId]
  ).catch(() => ({ rows: [] as any[] }));

  if (!assignRes.rows[0]) {
    assignRes = await pool.query(
      `SELECT * FROM public.assignments WHERE id = $1`,
      [assignmentId]
    ).catch(() => ({ rows: [] as any[] }));
  }

  const assignment = assignRes.rows[0];
  if (!assignment) {
    return { success: false, error: "Assignment record not found" };
  }

  // If phoneOverride provided, update profile phone in tenant schema
  if (phoneOverride && phoneOverride.trim()) {
    const cleanPhone = phoneOverride.trim();
    await pool.query(
      `UPDATE ${schemaName}.profiles SET phone = $1 WHERE id = $2`,
      [cleanPhone, assignment.profile_id]
    ).catch(() => {});
    await pool.query(
      `UPDATE public.profiles SET phone = $1 WHERE id = $2`,
      [cleanPhone, assignment.profile_id]
    ).catch(() => {});
  }

  // Trigger checkin notification
  await sendCheckInWhatsAppNotification({
    propertyId,
    profileId: assignment.profile_id,
    roomId: assignment.room_id,
    bedId: assignment.bed_number || assignment.bed_id || null,
    startDate: assignment.check_in_date || assignment.start_date,
  });

  return {
    success: true,
    message: "تم جدولة إرسال رسالة التسكين عبر الواتساب بنجاح",
  };
}

/**
 * Reservation Confirmation WhatsApp Notification
 */
export async function sendReservationConfirmationWhatsApp(params: {
  propertyId: number;
  reservationId: number;
  phoneOverride?: string;
}): Promise<{ success: boolean; error?: string; message?: string }> {
  try {
    const { propertyId, reservationId, phoneOverride } = params;

    // 1. Check session & property configs
    const session = await getWhatsAppSession(propertyId);
    const configRes = await pool.query(
      `SELECT * FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId]
    );
    const config = configRes.rows[0];

    if (config && config.is_reservation_send_enabled === false) {
      console.log(`[WhatsApp Reservation] Auto send is disabled for property ${propertyId}, skipping.`);
      return { success: false, error: "تم تعطيل إرسال تأكيد الحجز في إعدادات الواتساب" };
    }

    const isConnected = session.status === "connected" || config?.status === "connected";
    if (!isConnected) {
      console.log(`[WhatsApp Reservation] WhatsApp is not connected for property ${propertyId}, skipping.`);
      return { success: false, error: "خدمة الواتساب غير متصلة حالياً" };
    }

    // Resolve property & tenant schema name
    const propRes = await pool.query(
      `SELECT name, display_name, schema_name FROM public.properties WHERE id = $1`,
      [propertyId]
    );
    const prop = propRes.rows[0] || {};
    const schemaName = (prop.schema_name || "public").trim();
    const propertyName = prop.display_name || prop.name || "Sunrise Staff Housing";

    // 2. Fetch reservation details
    let resQuery = await pool.query(
      `SELECT * FROM ${schemaName}.reservations WHERE id = $1`,
      [reservationId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!resQuery.rows[0]) {
      resQuery = await pool.query(
        `SELECT * FROM public.reservations WHERE id = $1`,
        [reservationId]
      ).catch(() => ({ rows: [] as any[] }));
    }

    const reservation = resQuery.rows[0];
    if (!reservation) {
      return { success: false, error: "سجل الحجز غير موجود" };
    }

    // If phone override provided, update reservation and matching profile
    let effectivePhone = (phoneOverride || reservation.guest_phone || "").trim();
    if (phoneOverride && phoneOverride.trim()) {
      await pool.query(
        `UPDATE ${schemaName}.reservations SET guest_phone = $1 WHERE id = $2`,
        [phoneOverride.trim(), reservationId]
      ).catch(() => {});
      await pool.query(
        `UPDATE public.reservations SET guest_phone = $1 WHERE id = $2`,
        [phoneOverride.trim(), reservationId]
      ).catch(() => {});

      if (reservation.profile_code || reservation.guest_id_card_number) {
        await pool.query(
          `UPDATE ${schemaName}.profiles SET phone = $1 
           WHERE (profile_id = $2 OR national_id = $3) AND (phone IS NULL OR phone = '')`,
          [phoneOverride.trim(), reservation.profile_code || "", reservation.guest_id_card_number || ""]
        ).catch(() => {});
        await pool.query(
          `UPDATE public.profiles SET phone = $1 
           WHERE (profile_id = $2 OR national_id = $3) AND (phone IS NULL OR phone = '')`,
          [phoneOverride.trim(), reservation.profile_code || "", reservation.guest_id_card_number || ""]
        ).catch(() => {});
      }
    }

    const fullName = `${reservation.first_name || ""} ${reservation.last_name || ""}`.trim() || "Guest";

    if (!effectivePhone) {
      console.log(`[WhatsApp Reservation] Reservation #${reservationId} (${fullName}) has no phone number, skipping.`);
      await logDelivery(
        propertyId,
        "N/A",
        fullName,
        "RESERVATION_CONFIRMATION",
        `تم تخطي الإرسال لعدم وجود رقم هاتف مسجل في بيانات الحجز (${fullName}).`,
        "FAILED",
        "رقم هاتف النزيل غير مسجل في بيانات الحجز (No phone number in reservation)"
      ).catch(() => {});
      return { success: false, error: "رقم هاتف النزيل غير مسجل في بيانات الحجز" };
    }

    // 3. Determine language
    const isArabic = isArabicProfile(reservation.nationality, reservation.first_name, reservation.last_name);

    // 4. Room & Bed info
    let roomInfo = isArabic ? "غرفة قياسية (تُحدد عند الوصول)" : "Standard Room (Assigned upon arrival)";
    let bedInfo = isArabic ? "حسب التوفر" : "Subject to availability";

    if (reservation.room_id) {
      let rRes = await pool.query(
        `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
         FROM ${schemaName}.rooms r
         LEFT JOIN ${schemaName}.floors f ON r.floor_id = f.id
         LEFT JOIN ${schemaName}.buildings b ON r.building_id = b.id
         WHERE r.id = $1`,
        [reservation.room_id]
      ).catch(() => ({ rows: [] as any[] }));

      if (!rRes.rows[0]) {
        rRes = await pool.query(
          `SELECT r.room_number, f.floor_number as floor_name, b.name as building_name
           FROM public.rooms r
           LEFT JOIN public.floors f ON r.floor_id = f.id
           LEFT JOIN public.buildings b ON r.building_id = b.id
           WHERE r.id = $1`,
          [reservation.room_id]
        ).catch(() => ({ rows: [] as any[] }));
      }

      const rData = rRes.rows[0];
      if (rData) {
        const bName = rData.building_name || "";
        const fLabel = rData.floor_name ? (isArabic ? `الدور ${rData.floor_name}` : `Floor ${rData.floor_name}`) : "";
        roomInfo = `${isArabic ? "غرفة" : "Room"} ${rData.room_number} ${bName ? `- ${bName}` : ""} ${fLabel ? `(${fLabel})` : ""}`.trim();
      }
    } else if (reservation.room_type) {
      roomInfo = reservation.room_type;
    }

    if (reservation.bed_number) {
      if (reservation.bed_number === "ALL") {
        bedInfo = isArabic ? "الغرفة بالكامل (حجز خاص)" : "Entire Room (Full Lock)";
      } else {
        bedInfo = isArabic ? `سرير رقم ${reservation.bed_number}` : `Bed #${reservation.bed_number}`;
      }
    }

    const checkInDate = (String(reservation.check_in_date || "").split("T")[0]) || "N/A";
    const checkOutDate = (String(reservation.check_out_date || "").split("T")[0]) || (isArabic ? "غير محدد" : "N/A");

    // 5. Compile template
    const vars = {
      guest_name: fullName,
      property_name: propertyName,
      reservation_id: String(reservation.id),
      room_info: roomInfo,
      bed_info: bedInfo,
      checkin_date: checkInDate,
      checkout_date: checkOutDate,
      supervisor_contact: config?.supervisor_contact || "",
    };

    const template = isArabic
      ? (config?.reservation_template_ar || DEFAULT_RESERVATION_AR)
      : (config?.reservation_template_en || DEFAULT_RESERVATION_EN);

    const compiledMessage = compileWhatsAppTemplate(template, vars);

    console.log(`[WhatsApp Reservation] Queuing confirmation for ${fullName} (${effectivePhone}) in ${isArabic ? "Arabic" : "English"}`);
    sendWhatsAppMessageSafe(
      propertyId,
      effectivePhone,
      compiledMessage,
      "RESERVATION_CONFIRMATION",
      fullName
    ).catch((err) => {
      console.error("[WhatsApp Reservation] Failed to queue message:", err);
    });

    return {
      success: true,
      message: isArabic ? "تم جدولة إرسال تأكيد الحجز بنجاح" : "Reservation confirmation queued successfully",
    };
  } catch (err: any) {
    console.error("[WhatsApp Reservation] Error in confirmation handler:", err);
    return { success: false, error: err.message };
  }
}

export interface BroadcastRecipient {
  profileId: number;
  name: string;
  phone: string;
  roomNumber?: string;
  buildingName?: string;
  floorName?: string;
}

/**
 * Broadcast Bulk Messaging with anti-ban safe queuing
 */
export async function sendWhatsAppBroadcast(params: {
  propertyId: number;
  recipients: BroadcastRecipient[];
  messageText: string;
}): Promise<{ total: number; queued: number; skippedNoPhone: number }> {
  const { propertyId, recipients, messageText } = params;

  // Resolve property name
  const propRes = await pool.query(
    `SELECT name, display_name FROM public.properties WHERE id = $1`,
    [propertyId]
  );
  const prop = propRes.rows[0] || {};
  const propertyName = prop.display_name || prop.name || "Sunrise Staff Housing";

  let queued = 0;
  let skippedNoPhone = 0;

  for (const r of recipients) {
    const rawPhone = (r.phone || "").trim();
    if (!rawPhone) {
      skippedNoPhone++;
      continue;
    }

    // Compile dynamic variables
    const vars: Record<string, string> = {
      name: r.name || "",
      employee_name: r.name || "",
      room: r.roomNumber || "",
      room_number: r.roomNumber || "",
      building: r.buildingName || "",
      building_name: r.buildingName || "",
      floor: r.floorName || "",
      floor_name: r.floorName || "",
      property: propertyName,
      property_name: propertyName,
    };

    const textToSend = compileWhatsAppTemplate(messageText, vars);

    sendWhatsAppMessageSafe(
      propertyId,
      rawPhone,
      textToSend,
      "BROADCAST",
      r.name
    ).catch((err) => {
      console.error(`[WhatsApp Broadcast] Error queuing for ${r.name}:`, err);
    });

    queued++;
  }

  return {
    total: recipients.length,
    queued,
    skippedNoPhone,
  };
}

