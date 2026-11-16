import { pool, withTenant, settingsTable } from "@workspace/db";
import {
  checkSendQuota,
  isQuietHoursNow,
  TRANSACTIONAL_TYPES,
  isTransactionalType,
  normalizeSafetyLevel,
  safetyFactors,
  type SafetyLevel,
} from "./quota.js";

/** Read a property's WhatsApp anti-ban safety level from its settings. */
async function getSafetyLevel(propertyId: number): Promise<SafetyLevel> {
  try {
    const level = await withTenant(propertyId, async (tenantDb) => {
      const [s] = await tenantDb.select().from(settingsTable).limit(1);
      return (s as any)?.whatsappSafetyLevel;
    });
    return normalizeSafetyLevel(level);
  } catch {
    return "balanced";
  }
}
import { injectAntiBanFingerprint, normalizePhoneNumber } from "./templates.js";
import { getWhatsAppSession } from "./session.js";
import { isOptedOut } from "./opt-out.js";

// Outbox queue processing state per property
export const isProcessingOutbox = new Map<number, boolean>();

// Track consecutive sent messages per property for anti-ban batch cooling
export const propertyBatchSentCount = new Map<number, number>();

/**
 * Sending paused for a property (rate limited / restricted by WhatsApp).
 * While paused nothing is sent; messages stay PENDING.
 */
export const sendingPausedUntil = new Map<number, number>();

const MAX_RETRIES = 4;
/** Minutes before retry n (1-based): 5, 15, 45, 120. */
const RETRY_DELAY_MIN = [5, 15, 45, 120];

/** Errors that mean WhatsApp is throttling or restricting the number. */
const RATE_LIMIT_RE = /rate-overlimit|rate limit|too many|429|blocked|spam/i;

/**
 * Process pending messages from public.whatsapp_outbox_queue, one at a time.
 * Anti-ban rules (QR / Baileys):
 * - quota checked before every message, counted from the delivery log
 *   (survives restarts), with lower warm-up limits for a new number
 * - transactional messages first; broadcasts wait during night quiet hours
 * - opted-out numbers are skipped
 * - human-like pacing: typing simulation, 10-18s between messages and a
 *   70-110s pause every 8 messages
 * - failures retried later with backoff, not immediately
 * - rate-limit / restriction errors pause sending for the property
 */
export async function processOutboxQueue(
  propertyId: number,
): Promise<{ processed: number; failed: number; pendingRemaining: number }> {
  if (isProcessingOutbox.get(propertyId)) {
    return {
      processed: 0,
      failed: 0,
      pendingRemaining: await getPendingQueueCount(propertyId),
    };
  }
  const pausedUntil = sendingPausedUntil.get(propertyId) ?? 0;
  if (pausedUntil > Date.now()) {
    return {
      processed: 0,
      failed: 0,
      pendingRemaining: await getPendingQueueCount(propertyId),
    };
  }

  isProcessingOutbox.set(propertyId, true);

  try {
    const configRes = await pool.query(
      `SELECT provider, meta_access_token, meta_phone_number_id
       FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId],
    );
    const provider = configRes.rows[0]?.provider;
    // HTTP-based providers (Meta Cloud, UltraMsg, Custom Gateway) send over a REST
    // call and need no Baileys QR session, quota throttling or anti-ban pacing.
    const isHttpProvider =
      provider === "meta_cloud" ||
      provider === "ultramsg" ||
      provider === "custom_gateway";
    const isMetaCloud = provider === "meta_cloud";

    // Anti-ban posture for this property (scales caps and the gaps below).
    const safetyLevel = isHttpProvider
      ? "balanced"
      : await getSafetyLevel(propertyId);
    const gapFactor = safetyFactors(safetyLevel).gap;

    if (!isHttpProvider) {
      const session = await getWhatsAppSession(propertyId);
      if (session.status !== "connected" || !session.sock) {
        // Offline: messages stay PENDING until the connection is back.
        return {
          processed: 0,
          failed: 0,
          pendingRemaining: await getPendingQueueCount(propertyId),
        };
      }
    }

    let processed = 0;
    let failed = 0;

    while (true) {
      // Night quiet hours: only transactional messages go out.
      const inQuietHours = isQuietHoursNow();
      const { rows } = await pool.query(
        `SELECT id, property_id, recipient_phone, recipient_name, message_type, message_content, retry_count
         FROM public.whatsapp_outbox_queue
         WHERE property_id = $1 AND status = 'PENDING'
           AND (next_attempt_at IS NULL OR next_attempt_at <= NOW())
           AND ($2::boolean = false OR message_type = ANY($3::text[]))
         ORDER BY (CASE WHEN message_type = 'TEST' THEN 1
                        WHEN message_type = ANY($3::text[]) THEN 2
                        ELSE 3 END) ASC, id ASC
         LIMIT 1`,
        [propertyId, inQuietHours, TRANSACTIONAL_TYPES],
      );
      const item = rows[0];
      if (!item) break;

      // Per-message quota (Baileys only; HTTP providers have their own limits).
      if (!isHttpProvider) {
        const quota = await checkSendQuota(
          propertyId,
          item.message_type,
          safetyLevel,
        );
        if (!quota.allowed) {
          console.warn(`[WhatsApp Anti-Ban] 🛡️ ${quota.reason}`);
          break;
        }
      }

      // Opted-out recipients get no broadcasts.
      if (
        !isTransactionalType(item.message_type) &&
        (await isOptedOut(propertyId, item.recipient_phone))
      ) {
        await pool
          .query(
            `UPDATE public.whatsapp_outbox_queue
             SET status = 'OPTED_OUT', processed_at = NOW(), last_error = 'Recipient opted out'
             WHERE id = $1`,
            [item.id],
          )
          .catch(() => {});
        await logDelivery(
          propertyId,
          item.recipient_phone,
          item.recipient_name,
          item.message_type,
          item.message_content,
          "FAILED",
          "المستلم ألغى الاشتراك / Recipient opted out",
        );
        continue;
      }

      // Re-verify the session (Baileys)
      if (!isHttpProvider) {
        const currentSession = await getWhatsAppSession(propertyId);
        if (currentSession.status !== "connected" || !currentSession.sock) {
          console.warn(
            `[WhatsApp Outbox] Connection dropped while processing outbox for property ${propertyId}. Halting until reconnect.`,
          );
          break;
        }
      }

      await pool
        .query(
          `UPDATE public.whatsapp_outbox_queue SET status = 'PROCESSING' WHERE id = $1`,
          [item.id],
        )
        .catch(() => {});

      const result = await executeSendHumanLike(
        item.property_id,
        item.recipient_phone,
        item.message_content,
        item.message_type,
        item.recipient_name,
        item.id,
      );

      if (result.success) {
        processed++;
        const batchTotal = (propertyBatchSentCount.get(propertyId) || 0) + 1;
        propertyBatchSentCount.set(propertyId, batchTotal);

        await pool
          .query(
            `UPDATE public.whatsapp_outbox_queue
             SET status = 'SENT', processed_at = NOW(), last_error = NULL
             WHERE id = $1`,
            [item.id],
          )
          .catch(() => {});

        if (isHttpProvider) {
          await sleep(600);
        } else if (batchTotal % 8 === 0) {
          // Longer break every 8 messages, like a person pausing.
          const coolDownMs = Math.round(
            (70000 + Math.floor(Math.random() * 40000)) * gapFactor,
          );
          console.log(
            `[WhatsApp Anti-Ban] 🛡️ 8 messages sent for property ${propertyId} (level=${safetyLevel}); pausing ${Math.round(coolDownMs / 1000)}s.`,
          );
          await sleep(coolDownMs);
        } else {
          await sleep(
            Math.round((10000 + Math.floor(Math.random() * 8000)) * gapFactor),
          );
        }
      } else if (result.reason === "NOT_REGISTERED") {
        failed++;
        await pool
          .query(
            `UPDATE public.whatsapp_outbox_queue
             SET status = 'NOT_REGISTERED', processed_at = NOW(), last_error = 'Number not registered on WhatsApp'
             WHERE id = $1`,
            [item.id],
          )
          .catch(() => {});
        await sleep(2000 + Math.floor(Math.random() * 1500));
      } else if (result.reason === "INVALID_PHONE") {
        failed++;
        await pool
          .query(
            `UPDATE public.whatsapp_outbox_queue
             SET status = 'FAILED', processed_at = NOW(), last_error = 'Invalid phone number'
             WHERE id = $1`,
            [item.id],
          )
          .catch(() => {});
      } else if (result.reason === "NOT_CONNECTED") {
        // Back to PENDING; sent when the connection is restored.
        await pool
          .query(
            `UPDATE public.whatsapp_outbox_queue
             SET status = 'PENDING', last_error = 'WhatsApp disconnected during dispatch'
             WHERE id = $1`,
            [item.id],
          )
          .catch(() => {});
        break;
      } else {
        failed++;
        const nextRetry = (item.retry_count || 0) + 1;
        const giveUp = nextRetry > MAX_RETRIES;
        const delayMin =
          RETRY_DELAY_MIN[Math.min(nextRetry, RETRY_DELAY_MIN.length) - 1];
        await pool
          .query(
            `UPDATE public.whatsapp_outbox_queue
             SET status = $1, retry_count = $2, last_error = $3,
                 processed_at = ${giveUp ? "NOW()" : "NULL"},
                 next_attempt_at = ${giveUp ? "NULL" : `NOW() + ($5 || ' minutes')::interval`}
             WHERE id = $4`,
            giveUp
              ? ["FAILED", nextRetry, result.reason || "Unknown error", item.id]
              : [
                  "PENDING",
                  nextRetry,
                  result.reason || "Unknown error",
                  item.id,
                  String(delayMin),
                ],
          )
          .catch(() => {});

        // WhatsApp throttling / restricting the number: stop for an hour.
        if (!isMetaCloud && RATE_LIMIT_RE.test(String(result.reason || ""))) {
          sendingPausedUntil.set(propertyId, Date.now() + 60 * 60 * 1000);
          console.error(
            `[WhatsApp Anti-Ban] ⛔ Property ${propertyId}: WhatsApp rate-limited or restricted the number (${result.reason}). Sending paused for 1 hour.`,
          );
          await recordWhatsAppAlert(
            propertyId,
            "تم إيقاف إرسال الواتساب مؤقتاً لمدة ساعة لأن واتساب قيّد الرقم أو حدّ من الإرسال. / WhatsApp sending paused for 1 hour: the number was rate-limited or restricted.",
            String(result.reason || ""),
          );
          break;
        }
        await sleep(3000);
      }
    }

    const pendingRemaining = await getPendingQueueCount(propertyId);
    return { processed, failed, pendingRemaining };
  } finally {
    isProcessingOutbox.set(propertyId, false);
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/**
 * Critical WhatsApp event (paused, logged out, banned): written to the
 * activity log so admins see it.
 */
export async function recordWhatsAppAlert(
  propertyId: number,
  message: string,
  detail?: string,
): Promise<void> {
  try {
    await pool.query(
      `INSERT INTO public.activity_logs
         (property_id, username, action, action_type, module, severity, entity_type, details, timestamp)
       VALUES ($1, 'system', $2, 'ALERT', 'whatsapp', 'critical', 'whatsapp', $3, NOW())`,
      [propertyId, message, JSON.stringify({ detail: detail ?? null })],
    );
  } catch (err: any) {
    console.error("[WhatsApp] could not record alert:", err?.message);
  }
}

/**
 * Messages left PROCESSING by a restart mid-send go back to PENDING.
 */
export async function recoverStuckOutboxMessages(): Promise<void> {
  try {
    const res = await pool.query(
      `UPDATE public.whatsapp_outbox_queue SET status = 'PENDING'
       WHERE status = 'PROCESSING'`,
    );
    if (res.rowCount) {
      console.log(
        `[WhatsApp Outbox] Recovered ${res.rowCount} message(s) stuck in PROCESSING.`,
      );
    }
  } catch {}
}

/**
 * Get count of pending outbox messages for a property
 */
export async function getPendingQueueCount(
  propertyId: number,
): Promise<number> {
  try {
    const res = await pool.query(
      `SELECT COUNT(*) as count FROM public.whatsapp_outbox_queue WHERE property_id = $1 AND status = 'PENDING'`,
      [propertyId],
    );
    return parseInt(res.rows[0]?.count || "0", 10);
  } catch {
    return 0;
  }
}

/**
 * Official Meta WhatsApp Cloud API Sender (100% immune to bans, 1,000 free conversations/month)
 */
export async function sendMetaCloudMessage(params: {
  propertyId: number;
  phoneNumberId?: string | null;
  accessToken?: string | null;
  recipientPhone: string;
  recipientName?: string;
  messageType?: string;
  text: string;
}): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  const {
    propertyId,
    phoneNumberId,
    accessToken,
    recipientPhone,
    recipientName,
    messageType = "CHECKIN_WELCOME",
    text,
  } = params;

  if (!phoneNumberId || !accessToken) {
    const reason =
      "بيانات Meta Cloud API غير مكتملة (يرجى إدخال Phone Number ID و Access Token في الإعدادات)";
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      reason,
    );
    return { success: false, reason };
  }

  const cleanPhone = normalizePhoneNumber(recipientPhone);
  if (!cleanPhone || cleanPhone.length < 8) {
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      "Invalid phone number format",
    );
    return { success: false, reason: "INVALID_PHONE" };
  }

  try {
    const url = `https://graph.facebook.com/v21.0/${phoneNumberId.trim()}/messages`;
    const response = await fetch(url, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${accessToken.trim()}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: cleanPhone,
        type: "text",
        text: {
          preview_url: true,
          body: text,
        },
      }),
    });

    const data: any = await response.json();
    if (!response.ok) {
      const errMsg =
        data?.error?.message || `Meta Cloud API error (${response.status})`;
      console.error(
        `[WhatsApp Meta Cloud] Send failed to ${cleanPhone}:`,
        errMsg,
      );
      await logDelivery(
        propertyId,
        recipientPhone,
        recipientName,
        messageType,
        text,
        "FAILED",
        errMsg,
      );
      return { success: false, reason: errMsg };
    }

    const messageId = data?.messages?.[0]?.id || "meta-cloud-ok";
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "SENT",
    );
    console.log(
      `[WhatsApp Meta Cloud] ✅ Message successfully sent to ${cleanPhone} via official Meta Cloud API (ID: ${messageId})`,
    );
    return { success: true, messageId };
  } catch (err: any) {
    console.error(`[WhatsApp Meta Cloud] Network/HTTP error:`, err?.message);
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      err?.message || "Meta Network Error",
    );
    return { success: false, reason: err?.message };
  }
}

/**
 * UltraMsg sender (https://ultramsg.com) — simple HTTP API, no Baileys session.
 */
export async function sendUltraMsgMessage(params: {
  propertyId: number;
  instanceId?: string | null;
  token?: string | null;
  recipientPhone: string;
  recipientName?: string;
  messageType?: string;
  text: string;
}): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  const {
    propertyId,
    instanceId,
    token,
    recipientPhone,
    recipientName,
    messageType = "CHECKIN_WELCOME",
    text,
  } = params;

  if (!instanceId || !token) {
    const reason =
      "بيانات UltraMsg غير مكتملة (يرجى إدخال Instance ID و Token في الإعدادات)";
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      reason,
    );
    return { success: false, reason };
  }

  const cleanPhone = normalizePhoneNumber(recipientPhone);
  if (!cleanPhone || cleanPhone.length < 8) {
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      "Invalid phone number format",
    );
    return { success: false, reason: "INVALID_PHONE" };
  }

  try {
    const url = `https://api.ultramsg.com/${instanceId.trim()}/messages/chat`;
    const form = new URLSearchParams();
    form.set("token", token.trim());
    form.set("to", cleanPhone);
    form.set("body", text);

    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: form.toString(),
    });
    const data: any = await response.json().catch(() => ({}));
    // UltraMsg returns { sent: "true", id } on success, or { error }.
    const sentOk =
      response.ok &&
      (data?.sent === true ||
        data?.sent === "true" ||
        data?.message === "ok" ||
        Boolean(data?.id));
    if (!sentOk) {
      const errMsg = String(
        data?.error ||
          data?.message ||
          `UltraMsg API error (${response.status})`,
      );
      await logDelivery(
        propertyId,
        recipientPhone,
        recipientName,
        messageType,
        text,
        "FAILED",
        errMsg,
      );
      return { success: false, reason: errMsg };
    }
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "SENT",
    );
    return { success: true, messageId: String(data?.id ?? "ultramsg-ok") };
  } catch (err: any) {
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      err?.message || "UltraMsg Network Error",
    );
    return { success: false, reason: err?.message };
  }
}

/**
 * Custom HTTP gateway sender — posts to an operator-configured endpoint. The
 * phone/message field names, HTTP method, body encoding and extra headers are
 * all configurable so it can target most self-hosted WhatsApp gateways.
 */
export async function sendCustomGatewayMessage(params: {
  propertyId: number;
  gatewayUrl?: string | null;
  gatewayToken?: string | null;
  method?: string | null;
  payloadType?: string | null;
  phoneField?: string | null;
  messageField?: string | null;
  headers?: string | null;
  recipientPhone: string;
  recipientName?: string;
  messageType?: string;
  text: string;
}): Promise<{ success: boolean; reason?: string; messageId?: string }> {
  const {
    propertyId,
    gatewayUrl,
    gatewayToken,
    recipientPhone,
    recipientName,
    messageType = "CHECKIN_WELCOME",
    text,
  } = params;

  if (!gatewayUrl || !gatewayUrl.trim()) {
    const reason =
      "رابط البوابة المخصصة غير مُعرّف (يرجى إدخال Gateway URL في الإعدادات)";
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      reason,
    );
    return { success: false, reason };
  }

  const cleanPhone = normalizePhoneNumber(recipientPhone);
  if (!cleanPhone || cleanPhone.length < 8) {
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      "Invalid phone number format",
    );
    return { success: false, reason: "INVALID_PHONE" };
  }

  const method = (params.method || "POST").toUpperCase() === "GET" ? "GET" : "POST";
  const payloadType = (params.payloadType || "json").toLowerCase();
  const phoneField = (params.phoneField || "to").trim() || "to";
  const messageField = (params.messageField || "body").trim() || "body";

  // Extra headers are stored as a JSON object string; ignore if malformed.
  const headers: Record<string, string> = {};
  if (params.headers && params.headers.trim()) {
    try {
      const parsed = JSON.parse(params.headers);
      if (parsed && typeof parsed === "object") {
        for (const [k, v] of Object.entries(parsed)) headers[k] = String(v);
      }
    } catch {
      /* ignore malformed custom headers */
    }
  }
  if (gatewayToken && gatewayToken.trim() && !headers.Authorization) {
    headers.Authorization = `Bearer ${gatewayToken.trim()}`;
  }

  try {
    let response: Response;
    if (method === "GET") {
      const u = new URL(gatewayUrl.trim());
      u.searchParams.set(phoneField, cleanPhone);
      u.searchParams.set(messageField, text);
      response = await fetch(u.toString(), { method: "GET", headers });
    } else if (payloadType === "form") {
      const form = new URLSearchParams();
      form.set(phoneField, cleanPhone);
      form.set(messageField, text);
      response = await fetch(gatewayUrl.trim(), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/x-www-form-urlencoded" },
        body: form.toString(),
      });
    } else {
      response = await fetch(gatewayUrl.trim(), {
        method: "POST",
        headers: { ...headers, "Content-Type": "application/json" },
        body: JSON.stringify({ [phoneField]: cleanPhone, [messageField]: text }),
      });
    }

    if (!response.ok) {
      const body = await response.text().catch(() => "");
      const errMsg = `Custom gateway error (${response.status})${body ? `: ${body.slice(0, 200)}` : ""}`;
      await logDelivery(
        propertyId,
        recipientPhone,
        recipientName,
        messageType,
        text,
        "FAILED",
        errMsg,
      );
      return { success: false, reason: errMsg };
    }
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "SENT",
    );
    return { success: true, messageId: "custom-gateway-ok" };
  } catch (err: any) {
    await logDelivery(
      propertyId,
      recipientPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      err?.message || "Custom Gateway Network Error",
    );
    return { success: false, reason: err?.message };
  }
}

/**
 * Actual execution of sending message with anti-ban human behavior
 */
export async function executeSendHumanLike(
  propertyId: number,
  rawPhone: string,
  text: string,
  messageType: string = "CHECKIN_WELCOME",
  recipientName?: string,
  _queueId?: number,
): Promise<{ success: boolean; reason?: string }> {
  // 1. Check if property is configured with official Meta WhatsApp Cloud API (Zero ban risk)
  try {
    const configRes = await pool.query(
      `SELECT provider, meta_access_token, meta_phone_number_id, meta_waba_id,
              ultramsg_instance_id, ultramsg_token,
              custom_gateway_url, custom_gateway_token, custom_gateway_method,
              custom_gateway_payload_type, custom_gateway_phone_field,
              custom_gateway_message_field, custom_gateway_headers
       FROM public.property_whatsapp_configs WHERE property_id = $1`,
      [propertyId],
    );
    const config = configRes.rows[0];
    if (config?.provider === "meta_cloud") {
      return await sendMetaCloudMessage({
        propertyId,
        phoneNumberId: config.meta_phone_number_id,
        accessToken: config.meta_access_token,
        recipientPhone: rawPhone,
        recipientName,
        messageType,
        text,
      });
    }
    if (config?.provider === "ultramsg") {
      return await sendUltraMsgMessage({
        propertyId,
        instanceId: config.ultramsg_instance_id,
        token: config.ultramsg_token,
        recipientPhone: rawPhone,
        recipientName,
        messageType,
        text,
      });
    }
    if (config?.provider === "custom_gateway") {
      return await sendCustomGatewayMessage({
        propertyId,
        gatewayUrl: config.custom_gateway_url,
        gatewayToken: config.custom_gateway_token,
        method: config.custom_gateway_method,
        payloadType: config.custom_gateway_payload_type,
        phoneField: config.custom_gateway_phone_field,
        messageField: config.custom_gateway_message_field,
        headers: config.custom_gateway_headers,
        recipientPhone: rawPhone,
        recipientName,
        messageType,
        text,
      });
    }
  } catch (err: any) {
    console.warn(
      `[WhatsApp] Provider check error for property ${propertyId}:`,
      err?.message,
    );
  }

  // 2. Default / Direct QR Mode (Baileys)
  let session = await getWhatsAppSession(propertyId);

  // If session is currently restoring or pairing, wait up to 10s for open connection
  if (
    (session.isInitializing || session.status === "pairing") &&
    !session.sock
  ) {
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
    await logDelivery(
      propertyId,
      rawPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      "Invalid phone number format",
    );
    return { success: false, reason: "INVALID_PHONE" };
  }

  const jid = `${cleanPhone}@s.whatsapp.net`;

  try {
    // 1. Anti-ban: Pre-validate that destination phone number is registered on WhatsApp
    let verifiedJid = jid;
    try {
      const onWaResult = await session.sock.onWhatsApp(jid);
      if (Array.isArray(onWaResult) && onWaResult.length > 0) {
        if (!onWaResult[0]?.exists) {
          console.warn(
            `[WhatsApp Anti-Ban] Number ${cleanPhone} is NOT registered on WhatsApp. Skipping send to protect number.`,
          );
          await logDelivery(
            propertyId,
            rawPhone,
            recipientName,
            messageType,
            text,
            "NOT_REGISTERED",
            "Number not on WhatsApp",
          );
          return { success: false, reason: "NOT_REGISTERED" };
        }
        if (onWaResult[0]?.jid) {
          verifiedJid = onWaResult[0].jid;
        }
      }
    } catch (onWaErr: any) {
      console.warn(
        `[WhatsApp] onWhatsApp pre-check warning (proceeding directly):`,
        onWaErr?.message,
      );
    }

    // 2. Anti-ban: Realistic human simulation (quick for TEST messages)
    if (messageType === "TEST") {
      await new Promise((r) => setTimeout(r, 600));
    } else {
      await session.sock.sendPresenceUpdate("available").catch(() => {});
      await new Promise((r) =>
        setTimeout(r, 1000 + Math.floor(Math.random() * 1000)),
      );

      await session.sock
        .sendPresenceUpdate("composing", verifiedJid)
        .catch(() => {});
      const baseTyping = Math.min(Math.max(text.length * 15, 2500), 5500);
      await new Promise((r) => setTimeout(r, baseTyping));

      await session.sock
        .sendPresenceUpdate("paused", verifiedJid)
        .catch(() => {});
      await new Promise((r) => setTimeout(r, 800));
    }

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
    await logDelivery(
      propertyId,
      rawPhone,
      recipientName,
      messageType,
      text,
      "SENT",
    );
    console.log(
      `[WhatsApp Anti-Ban] Message successfully sent to ${cleanPhone} with unique fingerprint (Payload length: ${antiBanPayload.length})`,
    );
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
    await logDelivery(
      propertyId,
      rawPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      err.message || "Unknown error",
    );
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
  recipientName?: string,
): Promise<{ success: boolean; reason?: string; queued?: boolean }> {
  const cleanPhone = normalizePhoneNumber(rawPhone);
  if (!cleanPhone || cleanPhone.length < 8) {
    await logDelivery(
      propertyId,
      rawPhone,
      recipientName,
      messageType,
      text,
      "FAILED",
      "Invalid phone number format",
    );
    return { success: false, reason: "INVALID_PHONE" };
  }

  if (messageType !== "TEST") {
    // Broadcasts are never sent to numbers that opted out.
    if (
      !isTransactionalType(messageType) &&
      (await isOptedOut(propertyId, cleanPhone))
    ) {
      return { success: false, reason: "OPTED_OUT" };
    }
    // Same text to the same number already waiting or sent in the last 24h
    // (double click, repeated broadcast): sending it twice looks like spam.
    try {
      const dup = await pool.query(
        `SELECT 1 FROM public.whatsapp_outbox_queue
         WHERE property_id = $1 AND recipient_phone = $2 AND message_content = $3
           AND (status IN ('PENDING', 'PROCESSING')
                OR (status = 'SENT' AND processed_at > NOW() - INTERVAL '24 hours'))
         LIMIT 1`,
        [propertyId, cleanPhone, text],
      );
      if (dup.rows.length > 0) {
        return { success: false, reason: "DUPLICATE" };
      }
    } catch {}
  }

  // 1. Insert into persistent database outbox queue
  try {
    await pool.query(
      `INSERT INTO public.whatsapp_outbox_queue 
       (property_id, recipient_phone, recipient_name, message_type, message_content, status, retry_count, created_at)
       VALUES ($1, $2, $3, $4, $5, 'PENDING', 0, NOW())`,
      [propertyId, cleanPhone, recipientName || null, messageType, text],
    );

    // Initial log entry as QUEUED
    await logDelivery(
      propertyId,
      cleanPhone,
      recipientName,
      messageType,
      text,
      "QUEUED",
      "في طابور الإرسال بانتظار المعالجة",
    );
  } catch (err: any) {
    console.error(
      "[WhatsApp Outbox] Error inserting message into outbox queue:",
      err,
    );
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
export async function logDelivery(
  propertyId: number,
  phone: string,
  name: string | undefined,
  type: string,
  content: string,
  status: "SENT" | "FAILED" | "NOT_REGISTERED" | "QUEUED",
  errorMessage?: string,
) {
  try {
    if (
      status === "SENT" ||
      status === "NOT_REGISTERED" ||
      status === "FAILED"
    ) {
      const updateRes = await pool.query(
        `UPDATE public.whatsapp_delivery_logs
         SET status = $1, error_message = $2
         WHERE id = (
           SELECT id FROM public.whatsapp_delivery_logs
           WHERE property_id = $3 AND recipient_phone = $4 AND message_type = $5 AND status = 'QUEUED'
           ORDER BY id DESC LIMIT 1
         )
         RETURNING id`,
        [status, errorMessage || null, propertyId, phone, type],
      );
      if (updateRes.rows.length > 0) return;
    }

    await pool.query(
      `INSERT INTO public.whatsapp_delivery_logs
       (property_id, recipient_phone, recipient_name, message_type, message_content, status, error_message, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
      [
        propertyId,
        phone,
        name || null,
        type,
        content,
        status,
        errorMessage || null,
      ],
    );
  } catch (e: any) {
    console.error("[WhatsApp] Error logging delivery:", e.message);
  }
}
