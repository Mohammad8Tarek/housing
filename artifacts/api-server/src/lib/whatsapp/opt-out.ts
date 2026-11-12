// Opt-out list: numbers that replied 0 / STOP get no further broadcasts.
// Honouring opt-outs matters for bans: unwanted messages are reported as
// spam, and spam reports are what gets a number banned.
import { pool } from "@workspace/db";
import { normalizePhoneNumber } from "./templates.js";

/** Replies that mean "stop messaging me" (Arabic and English). */
const STOP_WORDS = new Set([
  "0",
  "٠",
  "stop",
  "unsubscribe",
  "cancel",
  "الغاء",
  "إلغاء",
  "الغاء الاشتراك",
  "إلغاء الاشتراك",
  "توقف",
  "وقف",
]);
/** Replies that undo an opt-out. */
const START_WORDS = new Set(["start", "subscribe", "اشتراك", "تفعيل"]);

const clean = (text: string) =>
  text
    .trim()
    .toLowerCase()
    .replace(/[.!؟?،,]+$/g, "")
    .trim();

export const isStopReply = (text: string) => STOP_WORDS.has(clean(text));
export const isStartReply = (text: string) => START_WORDS.has(clean(text));

export async function isOptedOut(
  propertyId: number,
  rawPhone: string,
): Promise<boolean> {
  const phone = normalizePhoneNumber(rawPhone);
  if (!phone) return false;
  try {
    const { rows } = await pool.query(
      `SELECT 1 FROM public.whatsapp_opt_outs WHERE property_id = $1 AND phone = $2 LIMIT 1`,
      [propertyId, phone],
    );
    return rows.length > 0;
  } catch {
    return false; // table missing before migrations ran
  }
}

export async function recordOptOut(
  propertyId: number,
  rawPhone: string,
  source: "reply" | "admin" = "reply",
): Promise<void> {
  const phone = normalizePhoneNumber(rawPhone);
  if (!phone) return;
  await pool.query(
    `INSERT INTO public.whatsapp_opt_outs (property_id, phone, source)
     VALUES ($1, $2, $3) ON CONFLICT (property_id, phone) DO NOTHING`,
    [propertyId, phone, source],
  );
  // Drop broadcasts already waiting for this number.
  await pool.query(
    `UPDATE public.whatsapp_outbox_queue
     SET status = 'OPTED_OUT', processed_at = NOW(), last_error = 'Recipient opted out'
     WHERE property_id = $1 AND recipient_phone = $2 AND status = 'PENDING' AND message_type = 'BROADCAST'`,
    [propertyId, phone],
  );
}

export async function removeOptOut(
  propertyId: number,
  rawPhone: string,
): Promise<void> {
  const phone = normalizePhoneNumber(rawPhone);
  if (!phone) return;
  await pool.query(
    `DELETE FROM public.whatsapp_opt_outs WHERE property_id = $1 AND phone = $2`,
    [propertyId, phone],
  );
}

export async function getOptOutCount(propertyId: number): Promise<number> {
  try {
    const { rows } = await pool.query(
      `SELECT count(*)::int AS n FROM public.whatsapp_opt_outs WHERE property_id = $1`,
      [propertyId],
    );
    return Number(rows[0]?.n || 0);
  } catch {
    return 0;
  }
}
