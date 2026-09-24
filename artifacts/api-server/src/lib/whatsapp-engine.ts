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
import { ensureProfilePortalAccount } from "./portal-accounts.js";

// Canonical sessions storage directory
const SESSIONS_DIR = fs.existsSync(path.resolve(process.cwd(), "artifacts/api-server/storage/whatsapp_sessions"))
  ? path.resolve(process.cwd(), "artifacts/api-server/storage/whatsapp_sessions")
  : path.resolve(process.cwd(), "storage/whatsapp_sessions");
if (!fs.existsSync(SESSIONS_DIR)) {
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
}

interface SessionState {
  propertyId: number;
  sock: any | null;
  status: "disconnected" | "pairing" | "connected";
  qrCode?: string;
  pairingCode?: string;
  phoneNumber?: string;
  reconnectAttempts: number;
  isInitializing: boolean;
}

const activeSessions = new Map<number, SessionState>();

export const DEFAULT_WELCOME_AR = `{مرحباً بك|أهلاً وسهلاً بك|تحياتنا الطيبة لك|عزيزنا} أ/ {employee_name} في {property_name} 🌴✨

{يسعدنا إبلاغك بأنه تم إتمام وتأكيد إجراءات تسكينك بنجاح|نحيطك علماً باعتماد تفاصيل تسكينك وإقامتك المعتمدة|تم الانتهاء من تجهيز وتأكيد غرفة إقامتك بنجاح}:
🏢 المبنى: {building_name} ({floor_name})
🚪 رقم الغرفة: {room_number}
🛏️ السرير: {bed_label}
📅 تاريخ التسكين: {checkin_date}

🌐 رابط بوابة المقيمين:
{portal_url}

🔑 بيانات وطريقة تسجيل الدخول:
• اسم المستخدم: {profile_id} (رقمك الوظيفي)
• كلمة المرور الافتراضية: 1234
*(يرجى استخدام كلمة المرور الشخصية إذا قمت بتعيينها مسبقاً، أو سيطلب منك النظام تعيين كلمة مرور جديدة فور أول تسجيل دخول)*

📲 من خلال البوابة يمكنك:
• تسجيل ومتابعة بلاغات الصيانة والأعطال
• طلب خدمات النظافة والهاوس كيبنج
• التقديم على تصاريح استضافة الأقارب والزيارات
• المحادثة المباشرة مع مشرفي إدارة السكن

{نتمنى لك إقامة هانئة ومريحة! ✨|إقامة سعيدة وموفقة بإذن الله تعالى! 🌴|نسعد دائماً بوجودك ونتمنى لك وقتاً ممتعاً ومريحاً! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 إدارة سكن العاملين — مجموعة فنادق صن رايز
📌 رسالة آلية رسمية خاصة بإقامتك وسكنك الفندقي. في حال وجود أي استفسار أو رغبة في عدم استقبال إشعارات الواتساب، يرجى الرد على هذه الرسالة أو مراجعة مكتب الإسكان مباشرة.`;

export const DEFAULT_WELCOME_EN = `{Welcome|Greetings|Warm welcome} Mr/Ms {employee_name} to {property_name}! 🌴✨

{Your accommodation has been successfully confirmed|We are pleased to confirm your room assignment details|Your staff housing placement is now officially ready}:
🏢 Building: {building_name} ({floor_name})
🚪 Room: {room_number}
🛏️ Bed: {bed_label}
📅 Check-in Date: {checkin_date}

🌐 Resident Portal Link:
{portal_url}

🔑 Portal Login Instructions:
• Username: {profile_id} (Your Employee ID)
• Default Password: 1234
*(Please use your personal password if already set, or you will be prompted to set a new password upon your first sign-in)*

📲 Through the portal you can:
• Submit and track maintenance tickets
• Request housekeeping & room cleaning
• Apply for guest and visitor hosting permits
• Chat directly with Housing Supervisors

{We wish you a pleasant and comfortable stay! ✨|Wishing you a safe and joyful stay! 🌴|We are glad to have you with us! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 Staff Housing Management — SUNRISE Resorts
📌 Official automated service notification. For inquiries or support, please reply to this message or visit the housing office.`;

export const DEFAULT_RESERVATION_AR = `{مرحباً بك|أهلاً وسهلاً بك|تحياتنا الطيبة لك} أ/ {guest_name} في {property_name} 🌴✨

{يسعدنا تأكيد حجز إقامتك المسبق لدينا|تم تسجيل واعتماد بيانات حجز إقامتك القادمة بنجاح|يسرنا إحاطتك علماً بتفاصيل حجز إقامتك لدينا}:
🔖 رقم الحجز: #{reservation_id}
🏢 المبنى / الغرفة: {room_info}
🛏️ تفاصيل السرير: {bed_info}
📅 تاريخ الوصول المتوقع: {checkin_date}
📅 تاريخ المغادرة المتوقع: {checkout_date}

🌐 رابط بوابة المقيمين:
{portal_url}

ℹ️ تنويه: يُرجى التوجه لمكتب الإسكان فور وصولك لاستلام المفتاح وإتمام إجراءات التسكين.

{نتمنى لك رحلة موفقة وإقامة سعيدة! ✨|نسعد باستقبالك ونتمنى لك إقامة ممتعة! 🌴|مع خالص تمنياتنا لك بإقامة طيبة ومريحة! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 إدارة سكن العاملين — مجموعة فنادق صن رايز
📌 رسالة آلية رسمية لتأكيد حجز السكن. للتواصل أو الاستفسار يرجى الرد هنا أو مراجعة مكتب الإسكان.`;

export const DEFAULT_RESERVATION_EN = `{Welcome|Greetings|Warm welcome} Mr/Ms {guest_name} to {property_name}! 🌴✨

{We are pleased to confirm your upcoming reservation|Your staff accommodation booking is confirmed|We are delighted to confirm your upcoming stay}:
🔖 Booking Ref: #{reservation_id}
🏢 Building / Room: {room_info}
🛏️ Bed Info: {bed_info}
📅 Expected Check-in: {checkin_date}
📅 Expected Check-out: {checkout_date}

🌐 Resident Portal Link:
{portal_url}

ℹ️ Note: Please visit the Housing Office upon your arrival to complete check-in and collect your keys.

{We wish you a safe trip and a pleasant stay! ✨|Looking forward to welcoming you! 🌴|Wishing you a safe journey and great stay! ✨}

━━━━━━━━━━━━━━━━━━━━
🏨 Staff Housing Management — SUNRISE Resorts
📌 Official automated reservation notice. For assistance, please reply to this message or contact the housing office.`;

// Outbox queue processing state per property
const isProcessingOutbox = new Map<number, boolean>();

// Track consecutive sent messages per property for anti-ban batch cooling
const propertyBatchSentCount = new Map<number, number>();

// Hourly and Daily quota windows for anti-ban rate limiting
interface QuotaWindow {
  count: number;
  windowStart: number;
}
const propertyHourlySent = new Map<number, QuotaWindow>();
const propertyDailySent = new Map<number, QuotaWindow>();

export const SAFE_HOURLY_LIMIT = 30; // Max 30 messages per rolling hour
export const SAFE_DAILY_LIMIT = 150; // Max 150 messages per rolling 24 hours

/**
 * Checks and increments anti-ban quota counters.
 * Prevents account from triggering WhatsApp velocity filters.
 */
export function checkAndIncrementAntiBanQuota(propertyId: number): { allowed: boolean; reason?: string } {
  const now = Date.now();

  // 1. Hourly check
  let h = propertyHourlySent.get(propertyId);
  if (!h || now - h.windowStart > 3600000) {
    h = { count: 0, windowStart: now };
    propertyHourlySent.set(propertyId, h);
  }
  if (h.count >= SAFE_HOURLY_LIMIT) {
    const waitMin = Math.ceil((3600000 - (now - h.windowStart)) / 60000);
    return {
      allowed: false,
      reason: `تم بلوغ الحد الأقصى الآمن للإرسال في الساعة (${SAFE_HOURLY_LIMIT} رسالة/ساعة). سيتم استئناف الإرسال تلقائياً بعد ${waitMin} دقيقة لتفادي حظر الرقم.`,
    };
  }

  // 2. Daily check
  let d = propertyDailySent.get(propertyId);
  if (!d || now - d.windowStart > 86400000) {
    d = { count: 0, windowStart: now };
    propertyDailySent.set(propertyId, d);
  }
  if (d.count >= SAFE_DAILY_LIMIT) {
    return {
      allowed: false,
      reason: `تم بلوغ الحد الأقصى الآمن للإرسال اليومي (${SAFE_DAILY_LIMIT} رسالة/يوم). سيتم استئناف الإرسال غداً لتفادي حظر الرقم.`,
    };
  }

  h.count++;
  d.count++;
  return { allowed: true };
}

/**
 * Checks if current time in Egypt is during night quiet hours (23:00 to 07:30).
 * Prevents recipient irritation and spam reports during sleeping hours.
 */
export function isQuietHoursNow(): boolean {
  try {
    const egyptHourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    const hour = parseInt(egyptHourStr, 10);
    return hour >= 23 || hour < 7;
  } catch {
    const hour = (new Date().getUTCHours() + 2) % 24;
    return hour >= 23 || hour < 7;
  }
}

/**
 * Resolves Spintax format: {option1|option2|option3} into a random choice.
 * Ensures natural linguistic variation across messages to evade duplicate text detection.
 */
export function resolveSpintax(text: string): string {
  if (!text || typeof text !== "string") return text;
  return text.replace(/\{([^{}]+)\}/g, (match, contents) => {
    if (contents.includes("|")) {
      const parts = contents.split("|");
      return parts[Math.floor(Math.random() * parts.length)];
    }
    return match;
  });
}

const ZERO_WIDTH_SALT_CHARS = [
  "\u200B", // Zero-Width Space
  "\u200C", // Zero-Width Non-Joiner
  "\u200D", // Zero-Width Joiner
  "\u2060", // Word Joiner
  "\uFEFF", // Zero-Width No-Break Space
];

/**
 * Injects an invisible cryptographic fingerprint and zero-width salt into the message text.
 * This ensures that every single message sent across WhatsApp has a 100% unique byte hash (SHA-256)
 * and perceptual fingerprint, preventing WhatsApp AI spam/bulk detection filters from blocking the account,
 * while rendering completely invisible and clean to the recipient.
 */
export function injectAntiBanFingerprint(text: string, seed?: string | number): string {
  if (!text || typeof text !== "string") return text;

  // 1. Subtle intra-text variance: randomly salt a small portion of space characters with zero-width markers
  let salted = text.replace(/ /g, (m) =>
    Math.random() < 0.2 ? m + ZERO_WIDTH_SALT_CHARS[Math.floor(Math.random() * ZERO_WIDTH_SALT_CHARS.length)] : m
  );

  // 2. Generate high-resolution timestamp & entropy
  const entropy = `${Date.now().toString(36)}_${seed || ""}_${Math.random().toString(36).slice(2, 7)}`;
  let binaryHash = "";
  for (let i = 0; i < entropy.length; i++) {
    const code = entropy.charCodeAt(i);
    binaryHash += code % 2 === 0 ? "\u200B" : "\u200C";
  }

  // 3. Trailing random zero-width salt sequence
  const saltLen = 6 + Math.floor(Math.random() * 8);
  let tailSalt = "";
  for (let i = 0; i < saltLen; i++) {
    tailSalt += ZERO_WIDTH_SALT_CHARS[Math.floor(Math.random() * ZERO_WIDTH_SALT_CHARS.length)];
  }

  // Combine cleanly without any visible marks
  return `${salted.trimEnd()}${tailSalt}${binaryHash}`;
}

/**
 * Process all pending messages from public.whatsapp_outbox_queue in FIFO order
 * Incorporates strict anti-ban safety:
 * - Pre-validates destination phone numbers
 * - Random human delay jitter between consecutive messages (5s to 9s)
 * - Cooling-off break of 40s-60s every 15 dispatched messages
 * - Invisible cryptographic fingerprinting on every payload
 */
export async function processOutboxQueue(
  propertyId: number
): Promise<{ processed: number; failed: number; pendingRemaining: number }> {
  if (isProcessingOutbox.get(propertyId)) {
    return { processed: 0, failed: 0, pendingRemaining: await getPendingQueueCount(propertyId) };
  }

  isProcessingOutbox.set(propertyId, true);

  try {
    const session = await getWhatsAppSession(propertyId);
    if (session.status !== "connected" || !session.sock) {
      // Offline: messages remain securely in whatsapp_outbox_queue with status 'PENDING'
      return { processed: 0, failed: 0, pendingRemaining: await getPendingQueueCount(propertyId) };
    }

    // Anti-ban check: Quiet hours (23:00 to 07:30)
    if (isQuietHoursNow()) {
      console.log(
        `[WhatsApp Anti-Ban] 🌙 Night quiet hours active in Egypt (23:00 - 07:30). Holding pending messages in outbox to prevent spam reports.`
      );
      return { processed: 0, failed: 0, pendingRemaining: await getPendingQueueCount(propertyId) };
    }

    let processed = 0;
    let failed = 0;

    while (true) {
      // Check quota before fetching next batch
      const quotaCheck = checkAndIncrementAntiBanQuota(propertyId);
      if (!quotaCheck.allowed) {
        console.warn(`[WhatsApp Anti-Ban] 🛡️ ${quotaCheck.reason}`);
        break;
      }

      const { rows: pendingItems } = await pool.query(
        `SELECT id, property_id, recipient_phone, recipient_name, message_type, message_content, retry_count
         FROM public.whatsapp_outbox_queue
         WHERE property_id = $1 AND status = 'PENDING'
         ORDER BY id ASC
         LIMIT 50`,
        [propertyId]
      );

      if (pendingItems.length === 0) {
        break;
      }

      console.log(
        `[WhatsApp Outbox] Dispatching batch chunk of ${pendingItems.length} pending messages for property ${propertyId}...`
      );

      for (const item of pendingItems) {
        // Re-verify session is still active
        const currentSession = await getWhatsAppSession(propertyId);
        if (currentSession.status !== "connected" || !currentSession.sock) {
          console.warn(
            `[WhatsApp Outbox] Connection dropped while processing outbox for property ${propertyId}. Halting until reconnect.`
          );
          return { processed, failed, pendingRemaining: await getPendingQueueCount(propertyId) };
        }

        // Mark as PROCESSING
        await pool.query(
          `UPDATE public.whatsapp_outbox_queue SET status = 'PROCESSING' WHERE id = $1`,
          [item.id]
        ).catch(() => {});

        const result = await executeSendHumanLike(
          item.property_id,
          item.recipient_phone,
          item.message_content,
          item.message_type,
          item.recipient_name,
          item.id
        );

        if (result.success) {
          processed++;
          const batchTotal = (propertyBatchSentCount.get(propertyId) || 0) + 1;
          propertyBatchSentCount.set(propertyId, batchTotal);

          await pool.query(
            `UPDATE public.whatsapp_outbox_queue 
             SET status = 'SENT', processed_at = NOW(), last_error = NULL 
             WHERE id = $1`,
            [item.id]
          ).catch(() => {});

          // Anti-ban cooling rule:
          // Every 8 sent messages, enforce an extended cooling-off pause of 70-110 seconds to mimic human breaks
          if (batchTotal > 0 && batchTotal % 8 === 0) {
            const coolDownMs = 70000 + Math.floor(Math.random() * 40000); // 70s to 110s
            console.log(
              `[WhatsApp Anti-Ban] 🛡️ Completed safety cycle of 8 messages for property ${propertyId}. Enforcing cooling-off pause for ${Math.round(coolDownMs / 1000)}s to prevent account flag...`
            );
            await new Promise((r) => setTimeout(r, coolDownMs));
            console.log(`[WhatsApp Anti-Ban] ✅ Cooling-off pause completed. Resuming safe dispatch.`);
          } else {
            // Enhanced human delay jitter: 10,000ms to 18,000ms (10 to 18 seconds)
            const jitterMs = 10000 + Math.floor(Math.random() * 8000);
            await new Promise((r) => setTimeout(r, jitterMs));
          }
        } else if (result.reason === "NOT_REGISTERED") {
          failed++;
          await pool.query(
            `UPDATE public.whatsapp_outbox_queue 
             SET status = 'NOT_REGISTERED', processed_at = NOW(), last_error = 'Number not registered on WhatsApp' 
             WHERE id = $1`,
            [item.id]
          ).catch(() => {});
          // Gentle 2-3s delay before trying next item
          await new Promise((r) => setTimeout(r, 2000 + Math.floor(Math.random() * 1500)));
        } else if (result.reason === "NOT_CONNECTED") {
          // Revert to PENDING so it retries automatically when connection restores
          await pool.query(
            `UPDATE public.whatsapp_outbox_queue 
             SET status = 'PENDING', retry_count = retry_count + 1, last_error = 'WhatsApp disconnected during dispatch' 
             WHERE id = $1`,
            [item.id]
          ).catch(() => {});
          return { processed, failed, pendingRemaining: await getPendingQueueCount(propertyId) };
        } else {
          const nextRetry = (item.retry_count || 0) + 1;
          const finalStatus = nextRetry >= 5 ? "FAILED" : "PENDING";
          failed++;
          await pool.query(
            `UPDATE public.whatsapp_outbox_queue 
             SET status = $1, retry_count = $2, last_error = $3, processed_at = ${finalStatus === "FAILED" ? "NOW()" : "NULL"} 
             WHERE id = $4`,
            [finalStatus, nextRetry, result.reason || "Unknown error", item.id]
          ).catch(() => {});
          await new Promise((r) => setTimeout(r, 3000));
        }
      }
    }

    const pendingRemaining = await getPendingQueueCount(propertyId);
    return { processed, failed, pendingRemaining };
  } finally {
    isProcessingOutbox.set(propertyId, false);
  }
}

/**
 * Get count of pending outbox messages for a property
 */
export async function getPendingQueueCount(propertyId: number): Promise<number> {
  try {
    const res = await pool.query(
      `SELECT COUNT(*) as count FROM public.whatsapp_outbox_queue WHERE property_id = $1 AND status = 'PENDING'`,
      [propertyId]
    );
    return parseInt(res.rows[0]?.count || "0", 10);
  } catch {
    return 0;
  }
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
  forceRestart: boolean = false,
  phoneNumberForPairingCode?: string
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
    console.warn("[WhatsApp] fetchLatestWaWebVersion fallback used:", err?.message);
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
    typeof phoneNumberForPairingCode === "string" && phoneNumberForPairingCode.trim().length > 0
      ? phoneNumberForPairingCode.trim()
      : undefined;

  if (validPairingPhone && !state.creds.registered) {
    setTimeout(async () => {
      try {
        const cleanPhone = normalizePhoneNumber(validPairingPhone);
        if (cleanPhone && cleanPhone.length >= 8) {
          const code = await sock.requestPairingCode(cleanPhone);
          session.pairingCode = code;
          console.log(`[WhatsApp] Pairing Code for property ${propertyId}:`, code);
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
      session.pairingCode = undefined;
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

      // Immediately process any pending messages in outbox queue
      processOutboxQueue(propertyId).catch((err) => {
        console.error(`[WhatsApp Outbox] Auto-dispatch error on connect for property ${propertyId}:`, err);
      });
    }

    if (connection === "close") {
      session.isInitializing = false;
      session.sock = null;

      const err = lastDisconnect?.error as any;
      const statusCode = err?.output?.statusCode ?? err?.statusCode ?? err?.status;
      const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401;
      const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

      console.log(
        `[WhatsApp] Property ${propertyId} connection closed (code ${statusCode}), isLoggedOut: ${isLoggedOut}, isRestartRequired: ${isRestartRequired}`
      );

      const wasPairing = session.status === "pairing";
      session.status = "disconnected";

      if (isLoggedOut) {
        console.log(`[WhatsApp] Property ${propertyId} logged out. Resetting session credentials.`);
        session.qrCode = undefined;
        session.pairingCode = undefined;
        session.phoneNumber = undefined;
        try {
          fs.rmSync(sessionFolder, { recursive: true, force: true });
        } catch {}
        pool.query(
          `UPDATE public.property_whatsapp_configs
           SET status = 'disconnected', qr_code = NULL, phone_number = NULL, updated_at = NOW()
           WHERE property_id = $1`,
          [propertyId]
        ).catch(() => {});
      } else if (isRestartRequired || statusCode === 515 || wasPairing) {
        // QR Code was scanned or stream restart requested! WhatsApp requires immediate reconnect with saved credentials
        console.log(`[WhatsApp] Pairing handshake in progress (code ${statusCode}) for property ${propertyId}. Immediate reconnect with saved credentials...`);
        setTimeout(() => {
          connectPropertyWhatsApp(propertyId, false).catch((err) => {
            console.error(`[WhatsApp] Reconnect after restartRequired error:`, err);
          });
        }, 50);
      } else {
        // Infinite auto-reconnect with exponential backoff!
        session.reconnectAttempts++;
        const delay = Math.min(session.reconnectAttempts * 2000, 20000);
        console.log(`[WhatsApp] Auto-reconnecting property ${propertyId} (attempt #${session.reconnectAttempts}) in ${delay}ms...`);
        setTimeout(() => {
          connectPropertyWhatsApp(propertyId, false).catch((err) => {
            console.warn(`[WhatsApp] Auto-reconnect retry error for property ${propertyId}:`, err?.message);
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

let heartbeatInterval: NodeJS.Timeout | null = null;

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

        // If session was disconnected or lost, auto-heal and restore
        if (!session || (session.status !== "connected" && !session.isInitializing)) {
          console.log(`[WhatsApp Heartbeat] Self-healing connection for property ${propertyId}...`);
          connectPropertyWhatsApp(propertyId, false).catch(() => {});
        } else if (session.status === "connected" && session.sock) {
          // Verify socket is responsive by updating presence
          try {
            await session.sock.sendPresenceUpdate("available");
          } catch {
            console.warn(`[WhatsApp Heartbeat] Socket silent failure for property ${propertyId}. Reconnecting...`);
            connectPropertyWhatsApp(propertyId, false).catch(() => {});
          }

          // Trigger processing of any pending outbox items
          processOutboxQueue(propertyId).catch(() => {});
        }
      }
    } catch (err: any) {
      console.warn("[WhatsApp Heartbeat] Heartbeat check notice:", err?.message);
    }
  }, 25000);
}

/**
 * Auto-restore all active properties with stored WhatsApp credentials on server startup
 */
export async function autoRestoreAllWhatsAppSessions(): Promise<void> {
  try {
    startKeepAliveHeartbeat();

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
  recipientName?: string,
  _queueId?: number
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

    // 2. Anti-ban: Realistic human simulation (reading delay -> composing -> pre-send pause)
    await session.sock.sendPresenceUpdate("available").catch(() => {});
    // Simulate user reading/preparing to type (1.5s to 3s)
    await new Promise((r) => setTimeout(r, 1500 + Math.floor(Math.random() * 1500)));

    await session.sock.sendPresenceUpdate("composing", verifiedJid).catch(() => {});

    // Realistic human typing delay (proportional to message length, 3.2s to 7s)
    const baseTyping = Math.min(Math.max(text.length * 18, 3200), 6800);
    const typingDelay = baseTyping + Math.floor(Math.random() * 1500);
    await new Promise((r) => setTimeout(r, typingDelay));

    // Natural human pause right before hitting send (1s to 1.8s)
    await session.sock.sendPresenceUpdate("paused", verifiedJid).catch(() => {});
    await new Promise((r) => setTimeout(r, 1000 + Math.floor(Math.random() * 800)));

    // 3. Anti-ban: Inject unique invisible zero-width fingerprint & hash salt
    // Each dispatched message gets an entirely unique cryptographic hash on WhatsApp servers
    const antiBanPayload = injectAntiBanFingerprint(text, _queueId);

    // 4. Send message with unique wire payload
    await session.sock.sendMessage(verifiedJid, { text: antiBanPayload });

    // 5. Reset presence to idle/unavailable after sending to avoid suspicious permanent-online bot signal
    setTimeout(() => {
      session.sock?.sendPresenceUpdate("unavailable").catch(() => {});
    }, 2000);

    // 6. Log successful delivery (saving clean text for clean admin dashboard viewing)
    await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "SENT");
    console.log(`[WhatsApp Anti-Ban] Message successfully sent to ${cleanPhone} with unique fingerprint (Payload length: ${antiBanPayload.length})`);
    return { success: true };
  } catch (err: any) {
    console.error(`[WhatsApp] Error sending to ${cleanPhone}:`, err.message);
    const isConnErr =
      err?.message?.includes("Connection") ||
      err?.message?.includes("closed") ||
      err?.message?.includes("output: 428") ||
      err?.message?.includes("not-authorized");
    if (isConnErr) {
      return { success: false, reason: "NOT_CONNECTED" };
    }
    await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "FAILED", err.message || "Unknown error");
    return { success: false, reason: err.message };
  }
}

/**
 * Queue a message for safe human-like dispatch via persistent database outbox
 */
export async function sendWhatsAppMessageSafe(
  propertyId: number,
  rawPhone: string,
  text: string,
  messageType: string = "CHECKIN_WELCOME",
  recipientName?: string
): Promise<{ success: boolean; reason?: string; queued?: boolean }> {
  const cleanPhone = normalizePhoneNumber(rawPhone);
  if (!cleanPhone || cleanPhone.length < 8) {
    await logDelivery(propertyId, rawPhone, recipientName, messageType, text, "FAILED", "Invalid phone number format");
    return { success: false, reason: "INVALID_PHONE" };
  }

  // 1. Insert into persistent database outbox queue
  try {
    await pool.query(
      `INSERT INTO public.whatsapp_outbox_queue 
       (property_id, recipient_phone, recipient_name, message_type, message_content, status, retry_count, created_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', 0, NOW())`,
      [propertyId, cleanPhone, recipientName || null, messageType, text]
    );

    // Initial log entry as QUEUED
    await logDelivery(
      propertyId,
      cleanPhone,
      recipientName,
      messageType,
      text,
      "QUEUED",
      "في طابور الإرسال بانتظار المعالجة"
    );
  } catch (err: any) {
    console.error("[WhatsApp Outbox] Error inserting message into outbox queue:", err);
  }

  // 2. Trigger asynchronous queue processing (dispatches immediately if connected, or stays pending if offline)
  processOutboxQueue(propertyId).catch((err) => {
    console.error("[WhatsApp Outbox] Outbox processor error:", err);
  });

  return { success: true, queued: true };
}

/**
 * Log message delivery (transitions QUEUED to SENT / FAILED if applicable)
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
    if (status === "SENT" || status === "NOT_REGISTERED" || status === "FAILED") {
      const updateRes = await pool.query(
        `UPDATE public.whatsapp_delivery_logs
         SET status = $1, error_message = $2
         WHERE id = (
           SELECT id FROM public.whatsapp_delivery_logs
           WHERE property_id = $3 AND recipient_phone = $4 AND message_type = $5 AND status = 'QUEUED'
           ORDER BY id DESC LIMIT 1
         )
         RETURNING id`,
        [status, errorMessage || null, propertyId, phone, type]
      );
      if (updateRes.rows.length > 0) return;
    }

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
  // Anti-ban Spintax resolution: ensures each recipient receives a uniquely phrased message
  result = resolveSpintax(result);
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
    
    // If auto send explicitly disabled in settings, skip
    if (config && config.is_auto_send_enabled === false) {
      console.log(`[WhatsApp Auto-Send] Auto send is disabled for property ${propertyId}, skipping.`);
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
      `SELECT id, profile_id, first_name, last_name, phone, nationality FROM ${schemaName}.profiles WHERE id = $1`,
      [profileId]
    ).catch(() => ({ rows: [] as any[] }));

    if (!profileRes.rows[0]) {
      profileRes = await pool.query(
        `SELECT id, profile_id, first_name, last_name, phone, nationality FROM public.profiles WHERE id = $1`,
        [profileId]
      ).catch(() => ({ rows: [] as any[] }));
    }

    const profile = profileRes.rows[0];
    const fullName = profile ? `${profile.first_name || ""} ${profile.last_name || ""}`.trim() : `Profile #${profileId}`;
    const employeeCode = (profile?.profile_id || String(profileId)).trim();

    // Auto ensure active portal account exists for this resident
    if (profile?.profile_id) {
      ensureProfilePortalAccount(propertyId, profile.profile_id).catch((err) => {
        console.warn("[WhatsApp Auto-Send] ensureProfilePortalAccount notice:", err?.message || err);
      });
    }

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
    const portalUrl = process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/";

    const vars = {
      employee_name: fullName,
      profile_id: employeeCode,
      employee_id: employeeCode,
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
    const portalUrl = process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/";

    const vars = {
      guest_name: fullName,
      property_name: propertyName,
      reservation_id: String(reservation.id),
      room_info: roomInfo,
      bed_info: bedInfo,
      checkin_date: checkInDate,
      checkout_date: checkOutDate,
      portal_url: portalUrl,
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
  const portalUrl = process.env.PORTAL_URL || "https://resident.sunrise-resorts.com/portal/";

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
      portal_url: portalUrl,
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

