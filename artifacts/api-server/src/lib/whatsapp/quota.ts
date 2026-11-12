// Anti-ban sending limits for the QR (Baileys) connection.
//
// Limits are counted per message from whatsapp_delivery_logs (status SENT),
// so they hold across restarts and across every way a message is sent. A newly
// linked number gets lower "warm-up" limits for its first days: sudden volume
// from a fresh number is one of the strongest ban signals.
import { pool } from "@workspace/db";

/** Service messages a resident expects; held only at higher limits. */
export const TRANSACTIONAL_TYPES = [
  "TEST",
  "DIRECT",
  "CHECKIN_WELCOME",
  "RESERVATION_CONFIRMATION",
  "RESERVATION_CONFIRM", // legacy spelling
  "OPT_OUT_CONFIRM",
];

export const isTransactionalType = (type: string | null | undefined) =>
  TRANSACTIONAL_TYPES.includes(String(type || ""));

export const LIMITS = {
  /** First WARMUP_DAYS days after the number's first sent message. */
  warmup: { hour: 12, day: 50 },
  established: { hour: 30, day: 150 },
};
export const WARMUP_DAYS = 14;
/** Transactional messages may go up to this multiple of the limits. */
export const TRANSACTIONAL_FACTOR = 1.5;

export interface QuotaStatus {
  sentLastHour: number;
  sentLast24h: number;
  hourLimit: number;
  dayLimit: number;
  warmup: boolean;
  /** Broadcast messages that can still go out in the next 24h. */
  broadcastRemaining: number;
}

export async function getQuotaStatus(propertyId: number): Promise<QuotaStatus> {
  const { rows } = await pool.query(
    `SELECT
       count(*) FILTER (WHERE created_at > NOW() - INTERVAL '1 hour')::int AS h,
       count(*) FILTER (WHERE created_at > NOW() - INTERVAL '24 hours')::int AS d,
       min(created_at) AS first_sent
     FROM public.whatsapp_delivery_logs
     WHERE property_id = $1 AND status = 'SENT' AND message_type <> 'TEST'`,
    [propertyId],
  );
  const r = rows[0] || {};
  const firstSent = r.first_sent ? new Date(r.first_sent).getTime() : null;
  const warmup =
    firstSent === null || Date.now() - firstSent < WARMUP_DAYS * 86_400_000;
  const lim = warmup ? LIMITS.warmup : LIMITS.established;
  const sentLastHour = Number(r.h || 0);
  const sentLast24h = Number(r.d || 0);
  return {
    sentLastHour,
    sentLast24h,
    hourLimit: lim.hour,
    dayLimit: lim.day,
    warmup,
    broadcastRemaining: Math.max(0, lim.day - sentLast24h),
  };
}

/**
 * May one more message of this type be sent now? Checked before every
 * message (not per batch).
 */
export async function checkSendQuota(
  propertyId: number,
  messageType: string,
): Promise<{ allowed: boolean; reason?: string }> {
  if (messageType === "TEST") return { allowed: true };
  const q = await getQuotaStatus(propertyId);
  const factor = isTransactionalType(messageType) ? TRANSACTIONAL_FACTOR : 1;
  const hourCap = Math.floor(q.hourLimit * factor);
  const dayCap = Math.floor(q.dayLimit * factor);
  if (q.sentLastHour >= hourCap) {
    return {
      allowed: false,
      reason: `تم بلوغ الحد الآمن في الساعة (${hourCap} رسالة). سيُستأنف الإرسال تلقائياً لاحقاً. / Hourly safe limit reached (${hourCap}).`,
    };
  }
  if (q.sentLast24h >= dayCap) {
    return {
      allowed: false,
      reason: `تم بلوغ الحد الآمن اليومي (${dayCap} رسالة). سيُستأنف الإرسال تلقائياً خلال 24 ساعة. / Daily safe limit reached (${dayCap}).`,
    };
  }
  return { allowed: true };
}

/**
 * Night quiet hours in Egypt (23:00 to 07:00): broadcasts wait for the
 * morning; transactional messages still go out.
 */
export function isQuietHoursNow(): boolean {
  try {
    const egyptHourStr = new Intl.DateTimeFormat("en-US", {
      timeZone: "Africa/Cairo",
      hour: "numeric",
      hour12: false,
    }).format(new Date());
    const hour = parseInt(egyptHourStr, 10) % 24;
    return hour >= 23 || hour < 7;
  } catch {
    const hour = (new Date().getUTCHours() + 2) % 24;
    return hour >= 23 || hour < 7;
  }
}
