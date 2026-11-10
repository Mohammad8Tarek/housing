

// Hourly and Daily quota windows for anti-ban rate limiting
export interface QuotaWindow {
  count: number;
  windowStart: number;
}

export const propertyHourlySent = new Map<number, QuotaWindow>();

export const propertyDailySent = new Map<number, QuotaWindow>();

export const SAFE_HOURLY_LIMIT = 30;

 // Max 30 messages per rolling hour
export const SAFE_DAILY_LIMIT = 150;

 // Max 150 messages per rolling 24 hours

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
